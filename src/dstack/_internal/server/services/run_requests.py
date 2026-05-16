import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from dstack._internal.core.errors import ForbiddenError, ResourceNotExistsError, ServerClientError
from dstack._internal.core.models.configurations import TaskConfiguration
from dstack._internal.core.models.profiles import Profile
from dstack._internal.core.models.runs import ApplyRunPlanInput, RunSpec
from dstack._internal.core.models.users import GlobalRole, ProjectRole
from dstack._internal.server.models import (
    MemberModel,
    ProjectModel,
    RunRequestModel,
    RunRequestStatus,
    UserModel,
)
from dstack._internal.server.schemas.run_requests import RunRequest, RunRequestSpec
from dstack._internal.server.services import runs as runs_services
from dstack._internal.server.services.pipelines import PipelineHinterProtocol
from dstack._internal.server.services.projects import get_user_project_role
from dstack._internal.server.services.users import refresh_ssh_key
from dstack._internal.utils.common import get_current_datetime


async def create_run_request(
    session: AsyncSession,
    project: ProjectModel,
    applicant: UserModel,
    request: RunRequestSpec,
) -> RunRequest:
    request_model = RunRequestModel(
        project_id=project.id,
        project=project,
        applicant_id=applicant.id,
        applicant=applicant,
        status=RunRequestStatus.PENDING,
        request=request.json(),
    )
    session.add(request_model)
    await session.commit()
    request_model = await _get_run_request_model(
        session=session,
        project=project,
        request_id=request_model.id,
    )
    return run_request_model_to_schema(request_model)


async def list_run_requests(
    session: AsyncSession,
    project: ProjectModel,
    user: UserModel,
    status: Optional[RunRequestStatus],
    include_all: bool,
    prev_created_at: Optional[datetime],
    prev_id: Optional[uuid.UUID],
    limit: int,
    ascending: bool,
) -> list[RunRequest]:
    filters = [RunRequestModel.project_id == project.id]
    if status is not None:
        filters.append(RunRequestModel.status == status)
    if not _can_review_run_requests(user=user, project=project):
        filters.append(RunRequestModel.applicant_id == user.id)
    if prev_created_at is not None:
        if ascending:
            if prev_id is None:
                filters.append(RunRequestModel.created_at > prev_created_at)
            else:
                filters.append(
                    or_(
                        RunRequestModel.created_at > prev_created_at,
                        and_(
                            RunRequestModel.created_at == prev_created_at,
                            RunRequestModel.id < prev_id,
                        ),
                    )
                )
        elif prev_id is None:
            filters.append(RunRequestModel.created_at < prev_created_at)
        else:
            filters.append(
                or_(
                    RunRequestModel.created_at < prev_created_at,
                    and_(
                        RunRequestModel.created_at == prev_created_at,
                        RunRequestModel.id > prev_id,
                    ),
                )
            )
    order_by = (RunRequestModel.created_at.desc(), RunRequestModel.id)
    if ascending:
        order_by = (RunRequestModel.created_at.asc(), RunRequestModel.id.desc())
    res = await session.execute(
        select(RunRequestModel)
        .where(*filters)
        .order_by(*order_by)
        .limit(limit)
        .options(joinedload(RunRequestModel.project))
        .options(joinedload(RunRequestModel.applicant))
        .options(joinedload(RunRequestModel.reviewer))
        .options(joinedload(RunRequestModel.run))
    )
    return [run_request_model_to_schema(model) for model in res.scalars().all()]


async def list_all_run_requests(
    session: AsyncSession,
    user: UserModel,
    status: Optional[RunRequestStatus],
    include_all: bool,
    prev_created_at: Optional[datetime],
    prev_id: Optional[uuid.UUID],
    limit: int,
    ascending: bool,
) -> list[RunRequest]:
    filters = _get_visible_run_request_filters(user=user, include_all=include_all)
    if status is not None:
        filters.append(RunRequestModel.status == status)
    if prev_created_at is not None:
        if ascending:
            if prev_id is None:
                filters.append(RunRequestModel.created_at > prev_created_at)
            else:
                filters.append(
                    or_(
                        RunRequestModel.created_at > prev_created_at,
                        and_(
                            RunRequestModel.created_at == prev_created_at,
                            RunRequestModel.id < prev_id,
                        ),
                    )
                )
        elif prev_id is None:
            filters.append(RunRequestModel.created_at < prev_created_at)
        else:
            filters.append(
                or_(
                    RunRequestModel.created_at < prev_created_at,
                    and_(
                        RunRequestModel.created_at == prev_created_at,
                        RunRequestModel.id > prev_id,
                    ),
                )
            )
    order_by = (RunRequestModel.created_at.desc(), RunRequestModel.id)
    if ascending:
        order_by = (RunRequestModel.created_at.asc(), RunRequestModel.id.desc())
    res = await session.execute(
        select(RunRequestModel)
        .where(*filters)
        .order_by(*order_by)
        .limit(limit)
        .options(joinedload(RunRequestModel.project))
        .options(joinedload(RunRequestModel.applicant))
        .options(joinedload(RunRequestModel.reviewer))
        .options(joinedload(RunRequestModel.run))
    )
    return [run_request_model_to_schema(model) for model in res.scalars().all()]


async def get_run_request(
    session: AsyncSession,
    project: ProjectModel,
    user: UserModel,
    request_id: uuid.UUID,
) -> RunRequest:
    model = await _get_run_request_model(session=session, project=project, request_id=request_id)
    if not _can_access_run_request(user=user, project=project, request_model=model):
        raise ResourceNotExistsError("run request not found")
    return run_request_model_to_schema(model)


async def approve_run_request(
    session: AsyncSession,
    project: ProjectModel,
    reviewer: UserModel,
    request_id: uuid.UUID,
    pipeline_hinter: Optional[PipelineHinterProtocol],
) -> RunRequest:
    _check_can_review_run_requests(user=reviewer, project=project)
    request_model = await _get_run_request_model(
        session=session,
        project=project,
        request_id=request_id,
        for_update=True,
    )
    if request_model.status != RunRequestStatus.PENDING:
        raise ServerClientError("Only pending run requests can be approved")
    return await _submit_request_run(
        session=session,
        project=project,
        reviewer=reviewer,
        request_model=request_model,
        pipeline_hinter=pipeline_hinter,
    )


async def reject_run_request(
    session: AsyncSession,
    project: ProjectModel,
    reviewer: UserModel,
    request_id: uuid.UUID,
    reason: str,
) -> RunRequest:
    _check_can_review_run_requests(user=reviewer, project=project)
    request_model = await _get_run_request_model(
        session=session,
        project=project,
        request_id=request_id,
        for_update=True,
    )
    if request_model.status != RunRequestStatus.PENDING:
        raise ServerClientError("Only pending run requests can be rejected")
    reason = reason.strip()
    if not reason:
        raise ServerClientError("Reject reason is required")
    request_model.status = RunRequestStatus.REJECTED
    request_model.reviewer_id = reviewer.id
    request_model.reviewer = reviewer
    request_model.reviewed_at = get_current_datetime()
    request_model.review_message = reason
    await session.commit()
    request_model = await _get_run_request_model(
        session=session,
        project=project,
        request_id=request_model.id,
    )
    return run_request_model_to_schema(request_model)


async def retry_run_request(
    session: AsyncSession,
    project: ProjectModel,
    reviewer: UserModel,
    request_id: uuid.UUID,
    pipeline_hinter: Optional[PipelineHinterProtocol],
) -> RunRequest:
    _check_can_review_run_requests(user=reviewer, project=project)
    request_model = await _get_run_request_model(
        session=session,
        project=project,
        request_id=request_id,
        for_update=True,
    )
    if request_model.status != RunRequestStatus.FAILED:
        raise ServerClientError("Only failed run requests can be retried")
    return await _submit_request_run(
        session=session,
        project=project,
        reviewer=reviewer,
        request_model=request_model,
        pipeline_hinter=pipeline_hinter,
    )


def run_request_model_to_schema(request_model: RunRequestModel) -> RunRequest:
    request = RunRequestSpec.parse_raw(request_model.request)
    run_name = request_model.run.run_name if request_model.run is not None else request.name
    return RunRequest(
        id=request_model.id,
        project_name=request_model.project.name,
        applicant=request_model.applicant.name,
        status=request_model.status,
        request=request,
        created_at=request_model.created_at,
        reviewed_by=request_model.reviewer.name if request_model.reviewer is not None else None,
        reviewed_at=request_model.reviewed_at,
        review_message=request_model.review_message,
        run_id=request_model.run_id,
        run_name=run_name,
    )


async def _submit_request_run(
    session: AsyncSession,
    project: ProjectModel,
    reviewer: UserModel,
    request_model: RunRequestModel,
    pipeline_hinter: Optional[PipelineHinterProtocol],
) -> RunRequest:
    request_id = request_model.id
    project_id = project.id
    reviewer_id = reviewer.id
    applicant = request_model.applicant
    if applicant.ssh_public_key is None:
        await refresh_ssh_key(session=session, actor=applicant)
        request_model = await _get_run_request_model(
            session=session,
            project_id=project_id,
            request_id=request_id,
            for_update=True,
        )
        applicant = request_model.applicant
    run_spec = _build_run_spec(
        request=RunRequestSpec.parse_raw(request_model.request), applicant=applicant
    )
    try:
        run = await runs_services.apply_plan(
            session=session,
            user=applicant,
            project=project,
            plan=ApplyRunPlanInput(run_spec=run_spec),
            force=False,
            pipeline_hinter=pipeline_hinter,
        )
    except Exception as exc:
        await session.rollback()
        request_model = await _get_run_request_model(
            session=session,
            project_id=project_id,
            request_id=request_id,
            for_update=True,
        )
        request_model.status = RunRequestStatus.FAILED
        request_model.reviewer_id = reviewer_id
        request_model.reviewed_at = get_current_datetime()
        request_model.review_message = str(exc) or exc.__class__.__name__
        await session.commit()
        request_model = await _get_run_request_model(
            session=session,
            project_id=project_id,
            request_id=request_id,
        )
        return run_request_model_to_schema(request_model)

    request_model = await _get_run_request_model(
        session=session,
        project_id=project_id,
        request_id=request_id,
        for_update=True,
    )
    request_model.status = RunRequestStatus.APPROVED
    request_model.reviewer_id = reviewer_id
    request_model.reviewed_at = get_current_datetime()
    request_model.review_message = None
    request_model.run_id = run.id
    await session.commit()
    session.expire(request_model, ["reviewer"])
    request_model = await _get_run_request_model(
        session=session,
        project_id=project_id,
        request_id=request_id,
    )
    return run_request_model_to_schema(request_model)


def _build_run_spec(request: RunRequestSpec, applicant: UserModel) -> RunSpec:
    configuration = TaskConfiguration(
        name=request.name,
        image=request.image,
        commands=request.commands,
        env=request.env,
        ports=request.ports,
        nodes=request.nodes,
        resources=request.resources,
        max_duration=request.max_duration,
        fleets=request.fleets,
    )
    return RunSpec(
        run_name=request.name,
        configuration=configuration,
        profile=Profile(name="default"),
        ssh_key_pub=applicant.ssh_public_key,
    )


async def _get_run_request_model(
    session: AsyncSession,
    request_id: uuid.UUID,
    project: Optional[ProjectModel] = None,
    project_id: Optional[uuid.UUID] = None,
    for_update: bool = False,
) -> RunRequestModel:
    if project_id is None:
        if project is None:
            raise ValueError("project or project_id is required")
        project_id = project.id
    query = (
        select(RunRequestModel)
        .where(
            RunRequestModel.project_id == project_id,
            RunRequestModel.id == request_id,
        )
        .options(joinedload(RunRequestModel.project))
        .options(joinedload(RunRequestModel.applicant))
        .options(joinedload(RunRequestModel.reviewer))
        .options(joinedload(RunRequestModel.run))
    )
    if for_update:
        query = query.with_for_update()
    res = await session.execute(query)
    request_model = res.scalar()
    if request_model is None:
        raise ResourceNotExistsError("run request not found")
    return request_model


def _can_access_run_request(
    user: UserModel, project: ProjectModel, request_model: RunRequestModel
) -> bool:
    if _can_review_run_requests(user=user, project=project):
        return True
    return request_model.applicant_id == user.id


def _check_can_review_run_requests(user: UserModel, project: ProjectModel) -> None:
    if not _can_review_run_requests(user=user, project=project):
        raise ForbiddenError("Only project admins and highest admins can review run requests")


def _can_review_run_requests(user: UserModel, project: ProjectModel) -> bool:
    if user.global_role == GlobalRole.ADMIN:
        return True
    return get_user_project_role(user=user, project=project) in {
        ProjectRole.ADMIN,
        ProjectRole.MANAGER,
    }


def _get_visible_run_request_filters(user: UserModel, include_all: bool) -> list:
    if user.global_role == GlobalRole.ADMIN:
        return []
    if include_all:
        manageable_project_ids = select(MemberModel.project_id).where(
            MemberModel.user_id == user.id,
            MemberModel.project_role.in_([ProjectRole.ADMIN, ProjectRole.MANAGER]),
        )
        return [
            or_(
                RunRequestModel.applicant_id == user.id,
                RunRequestModel.project_id.in_(manageable_project_ids),
            )
        ]
    return [RunRequestModel.applicant_id == user.id]
