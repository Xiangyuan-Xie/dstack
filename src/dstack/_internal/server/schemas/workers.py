from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import Field

from dstack._internal.core.models.common import CoreModel
from dstack._internal.core.models.instances import Gpu
from dstack._internal.core.models.runs import JobStatus, JobTerminationReason

DEFAULT_WORKER_TOTAL_BLOCKS = 1


class RegisteredWorkerResources(CoreModel):
    cpus: int
    memory_mib: int
    gpus: list[Gpu]
    disk_mib: int = 102400


class RegisteredWorkerResourceUsage(CoreModel):
    cpu_percent: Optional[float] = None
    memory_used_gib: Optional[float] = None
    memory_total_gib: Optional[float] = None
    disk_used_gib: Optional[float] = None
    disk_total_gib: Optional[float] = None
    gpu_memory_used_gib: Optional[float] = None
    gpu_memory_total_gib: Optional[float] = None
    gpu_util_percent: Optional[float] = None
    updated_at: Optional[datetime] = None


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
    total_blocks: int = DEFAULT_WORKER_TOTAL_BLOCKS


class RegisterWorkerResponse(CoreModel):
    worker_id: UUID
    fleet_name: str
    worker_name: str


class WorkerHeartbeatRequest(CoreModel):
    worker_id: UUID
    status: str = "idle"
    total_blocks: Optional[int] = None
    busy_blocks: Optional[int] = None
    interval_seconds: Optional[int] = None
    usage: Optional[RegisteredWorkerResourceUsage] = None


class WorkerHeartbeatResponse(CoreModel):
    worker_id: UUID
    status: str


class WorkerPollRequest(CoreModel):
    worker_id: UUID


class WorkerAssignment(CoreModel):
    job_id: UUID
    run_name: str
    image: str
    command: list[str]
    env: dict[str, str]
    cpu: Optional[float] = None
    memory_gib: Optional[float] = None
    shm_size_gib: Optional[float] = None
    gpu_uuids: list[str] = Field(default_factory=list)
    username: str
    workspace_mount_path: str = "/workspace"


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
