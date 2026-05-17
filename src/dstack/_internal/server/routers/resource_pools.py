from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

import dstack._internal.server.services.resource_pools as resource_pools_services
from dstack._internal.server.db import get_session
from dstack._internal.server.models import ProjectModel, UserModel
from dstack._internal.server.schemas.resource_pools import (
    CreateResourcePoolRequest,
    DeleteResourcePoolsRequest,
    GetResourcePoolRequest,
    ListResourcePoolsRequest,
    ResourcePool,
    UpdateResourcePoolAssignmentRequest,
    UpdateResourcePoolRequest,
)
from dstack._internal.server.security.permissions import GlobalAdmin, ProjectMember
from dstack._internal.server.services.pipelines import PipelineHinterProtocol, get_pipeline_hinter
from dstack._internal.server.utils.routers import (
    CustomORJSONResponse,
    get_base_api_additional_responses,
)

root_router = APIRouter(
    prefix="/api/resource_pools",
    tags=["resource_pools"],
    responses=get_base_api_additional_responses(),
)
project_router = APIRouter(
    prefix="/api/project/{project_name}/resource_pools",
    tags=["resource_pools"],
    responses=get_base_api_additional_responses(),
)


@root_router.post("/list", response_model=list[ResourcePool])
async def list_resource_pools(
    body: ListResourcePoolsRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[UserModel, Depends(GlobalAdmin())],
):
    return CustomORJSONResponse(
        await resource_pools_services.list_resource_pools(
            session=session,
            only_active=body.only_active,
            limit=body.limit,
        )
    )


@root_router.post("/get", response_model=ResourcePool)
async def get_resource_pool(
    body: GetResourcePoolRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[UserModel, Depends(GlobalAdmin())],
):
    return CustomORJSONResponse(
        await resource_pools_services.get_resource_pool(
            session=session,
            name=body.name,
            id=body.id,
        )
    )


@root_router.post("/create", response_model=ResourcePool)
async def create_resource_pool(
    body: CreateResourcePoolRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserModel, Depends(GlobalAdmin())],
    pipeline_hinter: Annotated[PipelineHinterProtocol, Depends(get_pipeline_hinter)],
):
    return CustomORJSONResponse(
        await resource_pools_services.apply_resource_pool(
            session=session,
            user=user,
            plan=body.plan,
            force=body.force,
            pipeline_hinter=pipeline_hinter,
        )
    )


@root_router.post("/update", response_model=ResourcePool)
async def update_resource_pool(
    body: UpdateResourcePoolRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserModel, Depends(GlobalAdmin())],
    pipeline_hinter: Annotated[PipelineHinterProtocol, Depends(get_pipeline_hinter)],
):
    return CustomORJSONResponse(
        await resource_pools_services.apply_resource_pool(
            session=session,
            user=user,
            plan=body.plan,
            force=body.force,
            pipeline_hinter=pipeline_hinter,
        )
    )


@root_router.post("/delete")
async def delete_resource_pools(
    body: DeleteResourcePoolsRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserModel, Depends(GlobalAdmin())],
    pipeline_hinter: Annotated[PipelineHinterProtocol, Depends(get_pipeline_hinter)],
):
    await resource_pools_services.delete_resource_pools(
        session=session,
        user=user,
        names=body.names,
        pipeline_hinter=pipeline_hinter,
    )


@root_router.post("/assignments/update", response_model=ResourcePool)
async def update_resource_pool_assignment(
    body: UpdateResourcePoolAssignmentRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[UserModel, Depends(GlobalAdmin())],
):
    return CustomORJSONResponse(
        await resource_pools_services.update_assignment(
            session=session,
            resource_pool_name=body.resource_pool_name,
            project_name=body.project_name,
            assign_whole_pool=body.assign_whole_pool,
            instance_ids=body.instance_ids,
        )
    )


@project_router.post("/list", response_model=list[ResourcePool])
async def list_project_resource_pools(
    session: AsyncSession = Depends(get_session),
    user_project: tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    _, project = user_project
    return CustomORJSONResponse(
        await resource_pools_services.list_project_resource_pools(
            session=session,
            project=project,
        )
    )
