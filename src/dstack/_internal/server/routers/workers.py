from typing import Annotated

from fastapi import APIRouter, Depends, Security
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

import dstack._internal.server.services.workers as workers_services
from dstack._internal.server.db import get_session
from dstack._internal.server.models import UserModel, WorkerRegistrationTokenModel
from dstack._internal.server.schemas.workers import (
    CreateWorkerRegistrationTokenRequest,
    DeleteWorkerRegistrationTokenRequest,
    RegisterWorkerRequest,
    RegisterWorkerResponse,
    WorkerHeartbeatRequest,
    WorkerHeartbeatResponse,
    WorkerJobReportRequest,
    WorkerJobReportResponse,
    WorkerPollRequest,
    WorkerPollResponse,
    WorkerRegistrationToken,
)
from dstack._internal.server.security.permissions import Authenticated
from dstack._internal.server.utils.routers import (
    CustomORJSONResponse,
    get_base_api_additional_responses,
)

admin_router = APIRouter(
    prefix="/api/admin/worker_tokens",
    tags=["workers"],
    responses=get_base_api_additional_responses(),
)
worker_router = APIRouter(
    prefix="/api/workers",
    tags=["workers"],
    responses=get_base_api_additional_responses(),
)


class RegisteredWorkerToken:
    async def __call__(
        self,
        session: Annotated[AsyncSession, Depends(get_session)],
        token: Annotated[HTTPAuthorizationCredentials, Security(HTTPBearer())],
    ) -> WorkerRegistrationTokenModel:
        return await workers_services.authenticate_worker_token(
            session=session,
            token=token.credentials,
        )


@admin_router.post("/create", response_model=WorkerRegistrationToken)
async def create_worker_registration_token(
    body: CreateWorkerRegistrationTokenRequest,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(Authenticated()),
):
    token = await workers_services.create_registration_token(
        session=session,
        user=user,
        fleet_name=body.fleet_name,
        expires_at=body.expires_at,
    )
    return CustomORJSONResponse(token)


@admin_router.post("/list", response_model=list[WorkerRegistrationToken])
async def list_worker_registration_tokens(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(Authenticated()),
):
    return CustomORJSONResponse(
        await workers_services.list_registration_tokens(session=session, user=user)
    )


@admin_router.post("/delete")
async def delete_worker_registration_token(
    body: DeleteWorkerRegistrationTokenRequest,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(Authenticated()),
):
    await workers_services.delete_registration_token(
        session=session,
        user=user,
        token_id=body.id,
    )


@worker_router.post("/register", response_model=RegisterWorkerResponse)
async def register_worker(
    body: RegisterWorkerRequest,
    session: AsyncSession = Depends(get_session),
    token_model: WorkerRegistrationTokenModel = Depends(RegisteredWorkerToken()),
):
    worker = await workers_services.register_worker(
        session=session,
        token_model=token_model,
        body=body,
    )
    return CustomORJSONResponse(
        RegisterWorkerResponse(
            worker_id=worker.id,
            fleet_name=worker.fleet.name,
            worker_name=worker.name,
        )
    )


@worker_router.post("/heartbeat", response_model=WorkerHeartbeatResponse)
async def heartbeat_worker(
    body: WorkerHeartbeatRequest,
    session: AsyncSession = Depends(get_session),
    token_model: WorkerRegistrationTokenModel = Depends(RegisteredWorkerToken()),
):
    worker = await workers_services.heartbeat_worker(
        session=session,
        token_model=token_model,
        worker_id=body.worker_id,
        status=body.status,
        total_blocks=body.total_blocks,
        busy_blocks=body.busy_blocks,
        interval_seconds=body.interval_seconds,
        usage=body.usage,
    )
    return CustomORJSONResponse(
        WorkerHeartbeatResponse(
            worker_id=worker.id,
            status=worker.instance.status.value,
        )
    )


@worker_router.post("/poll", response_model=WorkerPollResponse)
async def poll_worker(
    body: WorkerPollRequest,
    session: AsyncSession = Depends(get_session),
    token_model: WorkerRegistrationTokenModel = Depends(RegisteredWorkerToken()),
):
    assignments = await workers_services.poll_worker_assignments(
        session=session,
        token_model=token_model,
        worker_id=body.worker_id,
    )
    return CustomORJSONResponse(WorkerPollResponse(assignments=assignments))


@worker_router.post("/report", response_model=WorkerJobReportResponse)
async def report_worker_job(
    body: WorkerJobReportRequest,
    session: AsyncSession = Depends(get_session),
    token_model: WorkerRegistrationTokenModel = Depends(RegisteredWorkerToken()),
):
    job = await workers_services.report_worker_job(
        session=session,
        token_model=token_model,
        body=body,
    )
    return CustomORJSONResponse(WorkerJobReportResponse(job_id=job.id, status=job.status))
