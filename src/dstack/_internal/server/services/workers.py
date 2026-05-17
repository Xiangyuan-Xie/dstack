import json
import secrets
from datetime import datetime
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from dstack._internal.core.errors import ForbiddenError, ResourceNotExistsError, ServerClientError
from dstack._internal.core.models.backends.base import BackendType
from dstack._internal.core.models.instances import (
    Disk,
    InstanceAvailability,
    InstanceOfferWithAvailability,
    InstanceRuntime,
    InstanceStatus,
    InstanceType,
    Resources,
)
from dstack._internal.core.models.profiles import TerminationPolicy
from dstack._internal.core.models.runs import JobProvisioningData, JobStatus, JobTerminationReason
from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server.models import (
    FleetModel,
    InstanceModel,
    JobModel,
    RegisteredWorkerModel,
    UserModel,
    WorkerRegistrationTokenModel,
)
from dstack._internal.server.schemas.workers import (
    RegisteredWorkerResources,
    RegisterWorkerRequest,
    WorkerAssignment,
    WorkerJobReportRequest,
    WorkerRegistrationToken,
)
from dstack._internal.server.services.jobs import switch_job_status
from dstack._internal.server.services.users import get_token_hash
from dstack._internal.utils.common import get_current_datetime


def worker_registration_token_model_to_schema(
    token_model: WorkerRegistrationTokenModel,
    token: Optional[str] = None,
) -> WorkerRegistrationToken:
    return WorkerRegistrationToken(
        id=token_model.id,
        fleet_name=token_model.fleet_name,
        enabled=token_model.enabled,
        created_at=token_model.created_at,
        expires_at=token_model.expires_at,
        token=token,
    )


async def create_registration_token(
    session: AsyncSession,
    user: UserModel,
    fleet_name: str,
    expires_at: Optional[datetime],
) -> WorkerRegistrationToken:
    if user.global_role != GlobalRole.ADMIN:
        raise ForbiddenError()
    await _get_registered_fleet_by_name(session=session, fleet_name=fleet_name)
    token = f"dstack-worker-{secrets.token_urlsafe(32)}"
    token_model = WorkerRegistrationTokenModel(
        created_by=user,
        fleet_name=fleet_name,
        token_hash=get_token_hash(token),
        enabled=True,
        expires_at=expires_at,
    )
    session.add(token_model)
    await session.commit()
    return worker_registration_token_model_to_schema(token_model, token=token)


async def list_registration_tokens(
    session: AsyncSession,
    user: UserModel,
) -> list[WorkerRegistrationToken]:
    if user.global_role != GlobalRole.ADMIN:
        raise ForbiddenError()
    res = await session.execute(
        select(WorkerRegistrationTokenModel).order_by(
            WorkerRegistrationTokenModel.created_at.desc()
        )
    )
    return [worker_registration_token_model_to_schema(t) for t in res.scalars().unique().all()]


async def delete_registration_token(
    session: AsyncSession,
    user: UserModel,
    token_id: UUID,
) -> None:
    if user.global_role != GlobalRole.ADMIN:
        raise ForbiddenError()
    token_model = await session.get(WorkerRegistrationTokenModel, token_id)
    if token_model is None:
        raise ResourceNotExistsError()
    token_model.enabled = False
    await session.commit()


async def authenticate_worker_token(
    session: AsyncSession,
    token: str,
) -> WorkerRegistrationTokenModel:
    res = await session.execute(
        select(WorkerRegistrationTokenModel).where(
            WorkerRegistrationTokenModel.token_hash == get_token_hash(token)
        )
    )
    token_model = res.scalar_one_or_none()
    if token_model is None or not token_model.enabled:
        raise ForbiddenError()
    if token_model.expires_at is not None and token_model.expires_at <= get_current_datetime():
        raise ForbiddenError()
    return token_model


async def register_worker(
    session: AsyncSession,
    token_model: WorkerRegistrationTokenModel,
    body: RegisterWorkerRequest,
) -> RegisteredWorkerModel:
    fleet_model = await _get_registered_fleet_by_name(
        session=session, fleet_name=token_model.fleet_name
    )
    instance_type = _resources_to_instance_type(body.resources)
    offer = _resources_to_offer(body.resources, instance_type)
    job_provisioning_data = JobProvisioningData(
        backend=BackendType.REGISTERED,
        instance_type=instance_type,
        instance_id=body.worker_name,
        hostname=body.hostname or body.worker_name,
        internal_ip=None,
        region="registered",
        price=0,
        username="root",
        dockerized=True,
        backend_data=json.dumps({"worker_name": body.worker_name}),
    )
    res = await session.execute(
        select(RegisteredWorkerModel)
        .where(
            RegisteredWorkerModel.registration_token_id == token_model.id,
            RegisteredWorkerModel.name == body.worker_name,
        )
        .options(
            joinedload(RegisteredWorkerModel.instance),
            joinedload(RegisteredWorkerModel.fleet),
        )
    )
    worker_model = res.scalar_one_or_none()
    now = get_current_datetime()
    if worker_model is None:
        instance_num = _next_instance_num(fleet_model)
        instance_model = InstanceModel(
            name=body.worker_name,
            instance_num=instance_num,
            project=fleet_model.project,
            fleet=fleet_model,
            status=InstanceStatus.IDLE,
            unreachable=False,
            created_at=now,
            started_at=now,
            backend=BackendType.REGISTERED,
            price=0,
            region="registered",
            offer=offer.json(),
            job_provisioning_data=job_provisioning_data.json(),
            termination_policy=TerminationPolicy.DONT_DESTROY,
            termination_idle_time=0,
            total_blocks=body.total_blocks,
            busy_blocks=0,
            volume_attachments=[],
        )
        worker_model = RegisteredWorkerModel(
            registration_token=token_model,
            fleet=fleet_model,
            instance=instance_model,
            name=body.worker_name,
        )
        session.add(instance_model)
        session.add(worker_model)
    else:
        instance_model = worker_model.instance
        instance_model.status = InstanceStatus.IDLE
        instance_model.unreachable = False
        instance_model.backend = BackendType.REGISTERED
        instance_model.offer = offer.json()
        instance_model.job_provisioning_data = job_provisioning_data.json()
        instance_model.total_blocks = body.total_blocks
    worker_model.hostname = body.hostname
    worker_model.labels = json.dumps(body.labels)
    worker_model.last_heartbeat_at = now
    worker_model.version = body.version
    await session.commit()
    await session.refresh(worker_model, ["fleet", "instance"])
    return worker_model


async def heartbeat_worker(
    session: AsyncSession,
    token_model: WorkerRegistrationTokenModel,
    worker_id: UUID,
    status: str,
    total_blocks: Optional[int],
    busy_blocks: Optional[int],
) -> RegisteredWorkerModel:
    worker_model = await _get_worker_for_token(session, token_model, worker_id)
    worker_model.last_heartbeat_at = get_current_datetime()
    instance_model = worker_model.instance
    instance_model.unreachable = False
    if total_blocks is not None:
        instance_model.total_blocks = total_blocks
    if busy_blocks is not None:
        instance_model.busy_blocks = busy_blocks
    if status == "busy":
        instance_model.status = InstanceStatus.BUSY
    elif status == "idle":
        instance_model.status = InstanceStatus.IDLE
    elif status == "terminating":
        instance_model.status = InstanceStatus.TERMINATING
    else:
        raise ServerClientError(f"Unsupported worker status: {status}")
    await session.commit()
    return worker_model


async def poll_worker_assignments(
    session: AsyncSession,
    token_model: WorkerRegistrationTokenModel,
    worker_id: UUID,
) -> list[WorkerAssignment]:
    worker_model = await _get_worker_for_token(session, token_model, worker_id)
    res = await session.execute(
        select(JobModel)
        .where(
            JobModel.instance_id == worker_model.instance_id,
            JobModel.status.in_([JobStatus.PROVISIONING, JobStatus.PULLING, JobStatus.RUNNING]),
        )
        .order_by(JobModel.submitted_at.asc(), JobModel.id)
    )
    return [WorkerAssignment(job_id=job.id) for job in res.scalars().unique().all()]


async def report_worker_job(
    session: AsyncSession,
    token_model: WorkerRegistrationTokenModel,
    body: WorkerJobReportRequest,
) -> JobModel:
    worker_model = await _get_worker_for_token(session, token_model, body.worker_id)
    res = await session.execute(
        select(JobModel).where(
            JobModel.id == body.job_id,
            JobModel.instance_id == worker_model.instance_id,
        )
    )
    job_model = res.scalar_one_or_none()
    if job_model is None:
        raise ResourceNotExistsError()
    if body.runner_timestamp is not None:
        job_model.runner_timestamp = body.runner_timestamp
    if body.exit_status is not None:
        job_model.exit_status = body.exit_status
    if body.status == JobStatus.DONE:
        job_model.termination_reason = (
            body.termination_reason or JobTerminationReason.DONE_BY_RUNNER
        )
        job_model.termination_reason_message = body.termination_message
        switch_job_status(session, job_model, JobStatus.TERMINATING)
    elif body.status in [JobStatus.FAILED, JobStatus.TERMINATED, JobStatus.ABORTED]:
        job_model.termination_reason = (
            body.termination_reason or JobTerminationReason.EXECUTOR_ERROR
        )
        job_model.termination_reason_message = body.termination_message
        switch_job_status(session, job_model, JobStatus.TERMINATING)
    elif body.status in [JobStatus.PULLING, JobStatus.RUNNING]:
        job_model.termination_reason = None
        job_model.termination_reason_message = None
        switch_job_status(session, job_model, body.status)
    else:
        raise ServerClientError(f"Unsupported worker job status: {body.status}")
    await session.commit()
    return job_model


async def _get_worker_for_token(
    session: AsyncSession,
    token_model: WorkerRegistrationTokenModel,
    worker_id: UUID,
) -> RegisteredWorkerModel:
    res = await session.execute(
        select(RegisteredWorkerModel)
        .where(
            RegisteredWorkerModel.id == worker_id,
            RegisteredWorkerModel.registration_token_id == token_model.id,
        )
        .options(joinedload(RegisteredWorkerModel.instance))
    )
    worker_model = res.scalar_one_or_none()
    if worker_model is None:
        raise ResourceNotExistsError()
    return worker_model


async def _get_registered_fleet_by_name(
    session: AsyncSession,
    fleet_name: str,
) -> FleetModel:
    res = await session.execute(
        select(FleetModel)
        .where(
            FleetModel.name == fleet_name,
            FleetModel.deleted == False,
        )
        .options(joinedload(FleetModel.instances), joinedload(FleetModel.project))
        .limit(2)
    )
    fleet_models = list(res.scalars().unique().all())
    if len(fleet_models) == 0:
        raise ResourceNotExistsError(f"Resource pool {fleet_name!r} not found")
    if len(fleet_models) > 1:
        raise ServerClientError(f"Resource pool name {fleet_name!r} is not unique")
    return fleet_models[0]


def _resources_to_instance_type(resources: RegisteredWorkerResources) -> InstanceType:
    return InstanceType(
        name="registered-worker",
        resources=Resources(
            cpus=resources.cpus,
            memory_mib=resources.memory_mib,
            gpus=resources.gpus,
            spot=False,
            disk=Disk(size_mib=resources.disk_mib),
        ),
    )


def _resources_to_offer(
    resources: RegisteredWorkerResources,
    instance_type: InstanceType,
) -> InstanceOfferWithAvailability:
    return InstanceOfferWithAvailability(
        backend=BackendType.REGISTERED,
        instance=instance_type,
        region="registered",
        price=0,
        availability=InstanceAvailability.AVAILABLE,
        instance_runtime=InstanceRuntime.SHIM,
        blocks=1,
        total_blocks=1,
    )


def _next_instance_num(fleet_model: FleetModel) -> int:
    used_nums = {instance.instance_num for instance in fleet_model.instances}
    num = 0
    while num in used_nums:
        num += 1
    return num
