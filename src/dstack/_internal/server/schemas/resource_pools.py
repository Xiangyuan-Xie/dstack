from datetime import datetime
from typing import Optional
from uuid import UUID

from dstack._internal.core.models.common import CoreModel
from dstack._internal.core.models.fleets import ApplyFleetPlanInput, FleetSpec, FleetStatus
from dstack._internal.core.models.instances import InstanceStatus


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
    plan: ApplyFleetPlanInput
    force: bool


class DeleteResourcePoolsRequest(CoreModel):
    names: list[str]


class UpdateResourcePoolAssignmentRequest(CoreModel):
    resource_pool_name: str
    project_name: str
    assign_whole_pool: bool
    instance_ids: list[UUID] = []
