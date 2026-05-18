from typing import Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.server.db import get_session
from dstack._internal.server.models import ProjectModel, UserModel
from dstack._internal.server.schemas.run_requests import (
    ApproveRunRequestRequest,
    CreateRunRequestRequest,
    GetRunRequestRequest,
    ListAllRunRequestsRequest,
    ListRunRequestsRequest,
    RejectRunRequestRequest,
    RunRequest,
)
from dstack._internal.server.security.permissions import Authenticated, ProjectMember
from dstack._internal.server.services import run_requests as run_requests_services
from dstack._internal.server.services.pipelines import PipelineHinterProtocol, get_pipeline_hinter
from dstack._internal.server.utils.routers import (
    CustomORJSONResponse,
    get_base_api_additional_responses,
)

root_router = APIRouter(
    prefix="/api/run_requests",
    tags=["run_requests"],
    responses=get_base_api_additional_responses(),
)

router = APIRouter(
    prefix="/api/project/{project_name}/run_requests",
    tags=["run_requests"],
    responses=get_base_api_additional_responses(),
)


@root_router.post("/list", summary="List visible run requests", response_model=list[RunRequest])
async def list_all_run_requests(
    body: ListAllRunRequestsRequest,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(Authenticated()),
):
    requests = await run_requests_services.list_all_run_requests(
        session=session,
        user=user,
        status=body.status,
        include_all=body.include_all,
        prev_created_at=body.prev_created_at,
        prev_id=body.prev_id,
        limit=body.limit,
        ascending=body.ascending,
    )
    return CustomORJSONResponse(requests)


@router.post("/create", summary="Create run request", response_model=RunRequest)
async def create_run_request(
    body: CreateRunRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
    pipeline_hinter: PipelineHinterProtocol = Depends(get_pipeline_hinter),
):
    user, project = user_project
    request = await run_requests_services.create_run_request(
        session=session,
        project=project,
        applicant=user,
        request=body.request,
        pipeline_hinter=pipeline_hinter,
    )
    return CustomORJSONResponse(request)


@router.post("/list", summary="List run requests", response_model=list[RunRequest])
async def list_run_requests(
    body: ListRunRequestsRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    requests = await run_requests_services.list_run_requests(
        session=session,
        project=project,
        user=user,
        status=body.status,
        include_all=body.include_all,
        prev_created_at=body.prev_created_at,
        prev_id=body.prev_id,
        limit=body.limit,
        ascending=body.ascending,
    )
    return CustomORJSONResponse(requests)


@router.post("/get", summary="Get run request", response_model=RunRequest)
async def get_run_request(
    body: GetRunRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    request = await run_requests_services.get_run_request(
        session=session,
        project=project,
        user=user,
        request_id=body.id,
    )
    return CustomORJSONResponse(request)


@router.post("/approve", summary="Approve run request", response_model=RunRequest)
async def approve_run_request(
    body: ApproveRunRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
    pipeline_hinter: PipelineHinterProtocol = Depends(get_pipeline_hinter),
):
    user, project = user_project
    request = await run_requests_services.approve_run_request(
        session=session,
        project=project,
        reviewer=user,
        request_id=body.id,
        pipeline_hinter=pipeline_hinter,
    )
    return CustomORJSONResponse(request)


@router.post("/reject", summary="Reject run request", response_model=RunRequest)
async def reject_run_request(
    body: RejectRunRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    request = await run_requests_services.reject_run_request(
        session=session,
        project=project,
        reviewer=user,
        request_id=body.id,
        reason=body.reason,
    )
    return CustomORJSONResponse(request)


@router.post("/retry", summary="Retry failed run request", response_model=RunRequest)
async def retry_run_request(
    body: ApproveRunRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
    pipeline_hinter: PipelineHinterProtocol = Depends(get_pipeline_hinter),
):
    user, project = user_project
    request = await run_requests_services.retry_run_request(
        session=session,
        project=project,
        reviewer=user,
        request_id=body.id,
        pipeline_hinter=pipeline_hinter,
    )
    return CustomORJSONResponse(request)
