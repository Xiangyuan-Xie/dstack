from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from dstack._internal.core.models.common import CoreModel
from dstack._internal.core.models.instances import Gpu
from dstack._internal.core.models.runs import JobStatus, JobTerminationReason


class RegisteredWorkerResources(CoreModel):
    cpus: int
    memory_mib: int
    gpus: list[Gpu]
    disk_mib: int = 102400


class CreateWorkerRegistrationTokenRequest(CoreModel):
    fleet_name: str
    expires_at: Optional[datetime] = None


class WorkerRegistrationToken(CoreModel):
    id: UUID
    fleet_name: str
    enabled: bool
    created_at: datetime
    expires_at: Optional[datetime] = None
    token: Optional[str] = None


class DeleteWorkerRegistrationTokenRequest(CoreModel):
    id: UUID


class RegisterWorkerRequest(CoreModel):
    worker_name: str
    hostname: Optional[str] = None
    labels: dict[str, str] = Field(default_factory=dict)
    resources: RegisteredWorkerResources
    version: Optional[str] = None
    total_blocks: int = 1


class RegisterWorkerResponse(CoreModel):
    worker_id: UUID
    fleet_name: str
    worker_name: str


class WorkerHeartbeatRequest(CoreModel):
    worker_id: UUID
    status: str = "idle"
    total_blocks: Optional[int] = None
    busy_blocks: Optional[int] = None


class WorkerHeartbeatResponse(CoreModel):
    worker_id: UUID
    status: str


class WorkerPollRequest(CoreModel):
    worker_id: UUID


class WorkerAssignment(CoreModel):
    job_id: UUID


class WorkerPollResponse(CoreModel):
    assignments: list[WorkerAssignment]


class WorkerJobReportRequest(CoreModel):
    worker_id: UUID
    job_id: UUID
    status: JobStatus
    termination_reason: Optional[JobTerminationReason] = None
    termination_message: Optional[str] = None
    exit_status: Optional[int] = None
    runner_timestamp: Optional[int] = None


class WorkerJobReportResponse(CoreModel):
    job_id: UUID
    status: JobStatus
