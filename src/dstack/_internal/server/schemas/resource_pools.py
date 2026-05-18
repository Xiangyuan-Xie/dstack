from datetime import datetime
from typing import Optional
from uuid import UUID

from dstack._internal.core.models.common import CoreModel
from dstack._internal.core.models.fleets import ApplyFleetPlanInput, FleetSpec, FleetStatus
from dstack._internal.core.models.instances import InstanceStatus


class ResourcePoolGpuSummary(CoreModel):
    name: str
    count: int
    memory_gib: Optional[float] = None


class ResourcePoolGpuDevice(CoreModel):
    uuid: Optional[str] = None
    index: Optional[int] = None
    name: str
    memory_gib: Optional[float] = None
    occupied: bool = False
    project_name: Optional[str] = None
    run_name: Optional[str] = None
    job_id: Optional[UUID] = None


class ResourcePoolResources(CoreModel):
    cpu_count: Optional[int] = None
    memory_gib: Optional[float] = None
    disk_gib: Optional[float] = None
    gpu_count: int = 0
    gpus: list[ResourcePoolGpuSummary] = []
    gpu_devices: list[ResourcePoolGpuDevice] = []


class ResourcePoolResourceSummary(CoreModel):
    instance_count: int
    cpu_count: int
    memory_gib: float
    disk_gib: float
    gpu_count: int
    gpus: list[ResourcePoolGpuSummary]


class ResourcePoolUsage(CoreModel):
    cpu_percent: Optional[float] = None
    memory_used_gib: Optional[float] = None
    memory_total_gib: Optional[float] = None
    disk_used_gib: Optional[float] = None
    disk_total_gib: Optional[float] = None
    gpu_memory_used_gib: Optional[float] = None
    gpu_memory_total_gib: Optional[float] = None
    gpu_util_percent: Optional[float] = None
    updated_at: Optional[datetime] = None


class ResourcePoolUsageSummary(ResourcePoolUsage):
    instance_count: int = 0
    reporting_instance_count: int = 0


class ResourcePoolOccupancy(CoreModel):
    status: str
    project_names: list[str]
    task_count: int


class ResourcePoolInstance(CoreModel):
    id: UUID
    name: str
    instance_num: int
    status: InstanceStatus
    backend: Optional[str] = None
    authorized_projects: list[str]
    occupancy: ResourcePoolOccupancy
    resources: ResourcePoolResources
    usage: Optional[ResourcePoolUsage] = None


class ResourcePoolAssignment(CoreModel):
    project_name: str
    whole_pool: bool
    instance_ids: list[UUID]


class ResourcePool(CoreModel):
    id: UUID
    name: str
    spec: FleetSpec
    created_at: datetime
    status: FleetStatus
    status_message: Optional[str] = None
    assignments: list[ResourcePoolAssignment]
    instances: list[ResourcePoolInstance]
    authorized_project_names: list[str]
    idle_instance_count: int
    busy_instance_count: int
    resource_summary: ResourcePoolResourceSummary
    usage_summary: ResourcePoolUsageSummary


class ListResourcePoolsRequest(CoreModel):
    only_active: bool = False
    limit: int = 100


class GetResourcePoolRequest(CoreModel):
    name: Optional[str] = None
    id: Optional[UUID] = None


class CreateResourcePoolRequest(CoreModel):
    plan: ApplyFleetPlanInput
    force: bool


class UpdateResourcePoolRequest(CoreModel):
    plan: Optional[ApplyFleetPlanInput] = None
    force: bool = False
    resource_pool_name: Optional[str] = None
    new_resource_pool_name: Optional[str] = None


class DeleteResourcePoolsRequest(CoreModel):
    names: list[str]


class UpdateResourcePoolAssignmentRequest(CoreModel):
    resource_pool_name: str
    project_name: str
    assign_whole_pool: bool
    instance_ids: list[UUID] = []
