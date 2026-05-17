from collections import defaultdict
from typing import Iterable, Optional
from uuid import UUID

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from dstack._internal.core.errors import ForbiddenError, ResourceNotExistsError, ServerClientError
from dstack._internal.core.models.fleets import ApplyFleetPlanInput, FleetStatus
from dstack._internal.core.models.instances import InstanceStatus
from dstack._internal.core.models.runs import JobStatus
from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server.models import (
    FleetModel,
    InstanceModel,
    JobModel,
    ProjectModel,
    ProjectResourceInstanceAssignmentModel,
    ProjectResourcePoolAssignmentModel,
)
from dstack._internal.server.schemas.resource_pools import (
    ResourcePool,
    ResourcePoolAssignment,
    ResourcePoolInstance,
    ResourcePoolOccupancy,
)
from dstack._internal.server.services import fleets as fleets_services
from dstack._internal.server.services.fleets import get_fleet_spec
from dstack._internal.server.services.pipelines import PipelineHinterProtocol
from dstack._internal.server.services.projects import (
    get_or_create_default_project,
    get_project_model_by_name_or_error,
)


async def list_resource_pools(
    session: AsyncSession,
    only_active: bool = False,
    limit: int = 100,
) -> list[ResourcePool]:
    filters = [FleetModel.deleted == False]
    if only_active:
        filters.append(FleetModel.status.in_([FleetStatus.ACTIVE, FleetStatus.SUBMITTED]))
    res = await session.execute(
        select(FleetModel)
        .where(*filters)
        .order_by(FleetModel.created_at.desc(), FleetModel.id)
        .limit(limit)
        .options(selectinload(FleetModel.instances.and_(InstanceModel.deleted == False)))
    )
    fleets = list(res.unique().scalars().all())
    return await _fleet_models_to_resource_pools(session, fleets)


async def list_project_resource_pools(
    session: AsyncSession,
    project: ProjectModel,
) -> list[ResourcePool]:
    res = await session.execute(
        select(FleetModel)
        .where(
            FleetModel.deleted == False,
            or_(
                ProjectResourcePoolAssignmentModel.project_id == project.id,
                ProjectResourceInstanceAssignmentModel.project_id == project.id,
            ),
        )
        .outerjoin(
            ProjectResourcePoolAssignmentModel,
            ProjectResourcePoolAssignmentModel.fleet_id == FleetModel.id,
        )
        .outerjoin(
            ProjectResourceInstanceAssignmentModel,
            ProjectResourceInstanceAssignmentModel.fleet_id == FleetModel.id,
        )
        .order_by(FleetModel.created_at.desc(), FleetModel.id)
        .options(selectinload(FleetModel.instances.and_(InstanceModel.deleted == False)))
    )
    fleets = list(res.unique().scalars().all())
    return await _fleet_models_to_resource_pools(session, fleets)


async def get_resource_pool(
    session: AsyncSession,
    name: Optional[str] = None,
    id: Optional[UUID] = None,
) -> ResourcePool:
    filters = [FleetModel.deleted == False]
    if id is not None:
        filters.append(FleetModel.id == id)
    elif name is not None:
        filters.append(FleetModel.name == name)
    else:
        raise ServerClientError("name or id must be specified")
    res = await session.execute(
        select(FleetModel)
        .where(*filters)
        .options(selectinload(FleetModel.instances.and_(InstanceModel.deleted == False)))
    )
    fleet = res.unique().scalar_one_or_none()
    if fleet is None:
        raise ResourceNotExistsError()
    return (await _fleet_models_to_resource_pools(session, [fleet]))[0]


async def apply_resource_pool(
    session: AsyncSession,
    user,
    plan: ApplyFleetPlanInput,
    force: bool,
    pipeline_hinter: PipelineHinterProtocol,
) -> ResourcePool:
    if user.global_role != GlobalRole.ADMIN:
        raise ForbiddenError("Only global administrators can manage resource pools")
    default_project, _ = await get_or_create_default_project(session=session, user=user)
    default_project_model = await get_project_model_by_name_or_error(
        session=session,
        project_name=default_project.name,
    )
    fleet = await fleets_services.apply_plan(
        session=session,
        user=user,
        project=default_project_model,
        plan=plan,
        force=force,
        pipeline_hinter=pipeline_hinter,
    )
    return await get_resource_pool(session=session, id=fleet.id)


async def delete_resource_pools(
    session: AsyncSession,
    user,
    names: list[str],
    pipeline_hinter: PipelineHinterProtocol,
) -> None:
    if user.global_role != GlobalRole.ADMIN:
        raise ForbiddenError("Only global administrators can manage resource pools")
    default_project, _ = await get_or_create_default_project(session=session, user=user)
    default_project_model = await get_project_model_by_name_or_error(
        session=session,
        project_name=default_project.name,
    )
    await fleets_services.delete_fleets(
        session=session,
        project=default_project_model,
        user=user,
        names=names,
        pipeline_hinter=pipeline_hinter,
    )


async def update_assignment(
    session: AsyncSession,
    resource_pool_name: str,
    project_name: str,
    assign_whole_pool: bool,
    instance_ids: list[UUID],
) -> ResourcePool:
    pool_res = await session.execute(
        select(FleetModel)
        .where(FleetModel.name == resource_pool_name, FleetModel.deleted == False)
        .options(selectinload(FleetModel.instances.and_(InstanceModel.deleted == False)))
    )
    pool = pool_res.unique().scalar_one_or_none()
    if pool is None:
        raise ResourceNotExistsError(f"Resource pool {resource_pool_name!r} not found")
    project_res = await session.execute(
        select(ProjectModel).where(
            ProjectModel.name == project_name, ProjectModel.deleted == False
        )
    )
    project = project_res.scalar_one_or_none()
    if project is None:
        raise ResourceNotExistsError(f"Project {project_name!r} not found")
    pool_instance_ids = {instance.id for instance in pool.instances if not instance.deleted}
    unknown_ids = set(instance_ids) - pool_instance_ids
    if unknown_ids:
        raise ServerClientError(
            f"Instances {sorted(map(str, unknown_ids))} are not in resource pool {resource_pool_name!r}"
        )

    await session.execute(
        delete(ProjectResourcePoolAssignmentModel).where(
            ProjectResourcePoolAssignmentModel.project_id == project.id,
            ProjectResourcePoolAssignmentModel.fleet_id == pool.id,
        )
    )
    await session.execute(
        delete(ProjectResourceInstanceAssignmentModel).where(
            ProjectResourceInstanceAssignmentModel.project_id == project.id,
            ProjectResourceInstanceAssignmentModel.fleet_id == pool.id,
        )
    )
    if assign_whole_pool:
        session.add(
            ProjectResourcePoolAssignmentModel(
                project=project,
                fleet=pool,
                whole_pool=True,
            )
        )
    else:
        for instance in pool.instances:
            if instance.id not in set(instance_ids):
                continue
            session.add(
                ProjectResourceInstanceAssignmentModel(
                    project=project,
                    fleet=pool,
                    instance=instance,
                )
            )
    await session.commit()
    return await get_resource_pool(session=session, id=pool.id)


async def get_project_authorized_fleet_filters(
    session: AsyncSession,
    project: ProjectModel,
) -> tuple[set[UUID], set[UUID]]:
    pool_res = await session.execute(
        select(ProjectResourcePoolAssignmentModel.fleet_id).where(
            ProjectResourcePoolAssignmentModel.project_id == project.id,
            ProjectResourcePoolAssignmentModel.whole_pool == True,
        )
    )
    instance_res = await session.execute(
        select(ProjectResourceInstanceAssignmentModel.instance_id).where(
            ProjectResourceInstanceAssignmentModel.project_id == project.id,
        )
    )
    return set(pool_res.scalars().all()), set(instance_res.scalars().all())


async def _fleet_models_to_resource_pools(
    session: AsyncSession,
    fleets: list[FleetModel],
) -> list[ResourcePool]:
    if not fleets:
        return []
    fleet_ids = [fleet.id for fleet in fleets]
    assignments_by_fleet, instance_assignments_by_fleet = await _load_assignments(
        session, fleet_ids
    )
    occupancy_by_instance = await _load_occupancy(
        session, [i.id for f in fleets for i in f.instances]
    )
    return [
        _fleet_model_to_resource_pool(
            fleet,
            assignments_by_fleet.get(fleet.id, []),
            instance_assignments_by_fleet.get(fleet.id, []),
            occupancy_by_instance,
        )
        for fleet in fleets
    ]


async def _load_assignments(
    session: AsyncSession,
    fleet_ids: Iterable[UUID],
) -> tuple[
    dict[UUID, list[ProjectResourcePoolAssignmentModel]],
    dict[UUID, list[ProjectResourceInstanceAssignmentModel]],
]:
    pool_res = await session.execute(
        select(ProjectResourcePoolAssignmentModel)
        .where(ProjectResourcePoolAssignmentModel.fleet_id.in_(fleet_ids))
        .options(joinedload(ProjectResourcePoolAssignmentModel.project))
    )
    instance_res = await session.execute(
        select(ProjectResourceInstanceAssignmentModel)
        .where(ProjectResourceInstanceAssignmentModel.fleet_id.in_(fleet_ids))
        .options(joinedload(ProjectResourceInstanceAssignmentModel.project))
    )
    pool_assignments: dict[UUID, list[ProjectResourcePoolAssignmentModel]] = defaultdict(list)
    instance_assignments: dict[UUID, list[ProjectResourceInstanceAssignmentModel]] = defaultdict(
        list
    )
    for assignment in pool_res.scalars().all():
        pool_assignments[assignment.fleet_id].append(assignment)
    for assignment in instance_res.scalars().all():
        instance_assignments[assignment.fleet_id].append(assignment)
    return pool_assignments, instance_assignments


async def _load_occupancy(
    session: AsyncSession,
    instance_ids: list[UUID],
) -> dict[UUID, ResourcePoolOccupancy]:
    if not instance_ids:
        return {}
    res = await session.execute(
        select(JobModel.used_instance_id, ProjectModel.name, func.count(JobModel.id))
        .join(ProjectModel, ProjectModel.id == JobModel.project_id)
        .where(
            JobModel.used_instance_id.in_(instance_ids),
            JobModel.status.not_in(JobStatus.finished_statuses()),
        )
        .group_by(JobModel.used_instance_id, ProjectModel.name)
    )
    projects_by_instance: dict[UUID, list[str]] = defaultdict(list)
    counts_by_instance: dict[UUID, int] = defaultdict(int)
    for instance_id, project_name, count in res.all():
        projects_by_instance[instance_id].append(project_name)
        counts_by_instance[instance_id] += count
    return {
        instance_id: ResourcePoolOccupancy(
            status="busy" if counts_by_instance[instance_id] else "idle",
            project_names=sorted(project_names),
            task_count=counts_by_instance[instance_id],
        )
        for instance_id, project_names in projects_by_instance.items()
    }


def _fleet_model_to_resource_pool(
    fleet: FleetModel,
    pool_assignments: list[ProjectResourcePoolAssignmentModel],
    instance_assignments: list[ProjectResourceInstanceAssignmentModel],
    occupancy_by_instance: dict[UUID, ResourcePoolOccupancy],
) -> ResourcePool:
    whole_pool_project_names = sorted({assignment.project.name for assignment in pool_assignments})
    instance_project_names: dict[UUID, list[str]] = defaultdict(list)
    instance_ids_by_project: dict[str, list[UUID]] = defaultdict(list)
    for assignment in instance_assignments:
        instance_project_names[assignment.instance_id].append(assignment.project.name)
        instance_ids_by_project[assignment.project.name].append(assignment.instance_id)

    assignments = [
        ResourcePoolAssignment(project_name=name, whole_pool=True, instance_ids=[])
        for name in whole_pool_project_names
    ]
    assignments.extend(
        ResourcePoolAssignment(
            project_name=project_name,
            whole_pool=False,
            instance_ids=sorted(instance_ids),
        )
        for project_name, instance_ids in sorted(instance_ids_by_project.items())
    )

    instances = []
    idle_count = 0
    busy_count = 0
    for instance in sorted(fleet.instances, key=lambda item: item.instance_num):
        authorized_projects = sorted(
            set(whole_pool_project_names) | set(instance_project_names.get(instance.id, []))
        )
        occupancy = occupancy_by_instance.get(
            instance.id,
            ResourcePoolOccupancy(status="idle", project_names=[], task_count=0),
        )
        if occupancy.task_count:
            busy_count += 1
        elif instance.status == InstanceStatus.IDLE:
            idle_count += 1
        instances.append(
            ResourcePoolInstance(
                id=instance.id,
                name=instance.name,
                instance_num=instance.instance_num,
                status=instance.status,
                backend=instance.backend.value if instance.backend else None,
                authorized_projects=authorized_projects,
                occupancy=occupancy,
            )
        )

    return ResourcePool(
        id=fleet.id,
        name=fleet.name,
        spec=get_fleet_spec(fleet),
        created_at=fleet.created_at,
        status=fleet.status,
        status_message=fleet.status_message,
        assignments=assignments,
        instances=instances,
        authorized_project_names=sorted(
            set(whole_pool_project_names) | set(instance_ids_by_project.keys())
        ),
        idle_instance_count=idle_count,
        busy_instance_count=busy_count,
    )
