from typing import Tuple

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.server.db import get_session
from dstack._internal.server.models import ProjectModel, UserModel
from dstack._internal.server.schemas.gpu_requests import (
    ApproveGpuRequestRequest,
    CreateGpuRequestRequest,
    GetGpuRequestRequest,
    GpuRequest,
    ListAllGpuRequestsRequest,
    ListGpuRequestsRequest,
    RejectGpuRequestRequest,
)
from dstack._internal.server.security.permissions import Authenticated, ProjectMember
from dstack._internal.server.services import gpu_requests as gpu_requests_services
from dstack._internal.server.services.pipelines import PipelineHinterProtocol, get_pipeline_hinter
from dstack._internal.server.utils.routers import (
    CustomORJSONResponse,
    get_base_api_additional_responses,
)

root_router = APIRouter(
    prefix="/api/gpu_requests",
    tags=["gpu_requests"],
    responses=get_base_api_additional_responses(),
)

router = APIRouter(
    prefix="/api/project/{project_name}/gpu_requests",
    tags=["gpu_requests"],
    responses=get_base_api_additional_responses(),
)


@root_router.post("/list", summary="List visible GPU requests", response_model=list[GpuRequest])
async def list_all_gpu_requests(
    body: ListAllGpuRequestsRequest,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(Authenticated()),
):
    requests = await gpu_requests_services.list_all_gpu_requests(
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


@router.post("/create", summary="Create GPU request", response_model=GpuRequest)
async def create_gpu_request(
    body: CreateGpuRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    request = await gpu_requests_services.create_gpu_request(
        session=session,
        project=project,
        applicant=user,
        request=body.request,
    )
    return CustomORJSONResponse(request)


@router.post("/list", summary="List GPU requests", response_model=list[GpuRequest])
async def list_gpu_requests(
    body: ListGpuRequestsRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    requests = await gpu_requests_services.list_gpu_requests(
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


@router.post("/get", summary="Get GPU request", response_model=GpuRequest)
async def get_gpu_request(
    body: GetGpuRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    request = await gpu_requests_services.get_gpu_request(
        session=session,
        project=project,
        user=user,
        request_id=body.id,
    )
    return CustomORJSONResponse(request)


@router.post("/approve", summary="Approve GPU request", response_model=GpuRequest)
async def approve_gpu_request(
    body: ApproveGpuRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
    pipeline_hinter: PipelineHinterProtocol = Depends(get_pipeline_hinter),
):
    user, project = user_project
    request = await gpu_requests_services.approve_gpu_request(
        session=session,
        project=project,
        reviewer=user,
        request_id=body.id,
        pipeline_hinter=pipeline_hinter,
    )
    return CustomORJSONResponse(request)


@router.post("/reject", summary="Reject GPU request", response_model=GpuRequest)
async def reject_gpu_request(
    body: RejectGpuRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
):
    user, project = user_project
    request = await gpu_requests_services.reject_gpu_request(
        session=session,
        project=project,
        reviewer=user,
        request_id=body.id,
        reason=body.reason,
    )
    return CustomORJSONResponse(request)


@router.post("/retry", summary="Retry failed GPU request", response_model=GpuRequest)
async def retry_gpu_request(
    body: ApproveGpuRequestRequest,
    session: AsyncSession = Depends(get_session),
    user_project: Tuple[UserModel, ProjectModel] = Depends(ProjectMember()),
    pipeline_hinter: PipelineHinterProtocol = Depends(get_pipeline_hinter),
):
    user, project = user_project
    request = await gpu_requests_services.retry_gpu_request(
        session=session,
        project=project,
        reviewer=user,
        request_id=body.id,
        pipeline_hinter=pipeline_hinter,
    )
    return CustomORJSONResponse(request)
