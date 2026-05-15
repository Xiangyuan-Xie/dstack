from datetime import datetime
from typing import Annotated, Dict, List, Optional
from uuid import UUID

from pydantic import Field, validator

from dstack._internal.core.models.common import CoreModel
from dstack._internal.core.models.resources import ResourcesSpec
from dstack._internal.server.models import GpuRequestStatus


class GpuRequestSpec(CoreModel):
    name: Annotated[
        Optional[str],
        Field(description="The run name. If not specified, a random name is generated."),
    ] = None
    image: Annotated[str, Field(description="The Docker image to run")]
    commands: Annotated[List[str], Field(description="The shell commands to run")]
    env: Annotated[
        Dict[str, str], Field(description="Environment variables for the container")
    ] = {}
    ports: Annotated[List[int], Field(description="Container ports to expose")] = []
    nodes: Annotated[int, Field(description="Number of nodes", ge=1)] = 1
    resources: Annotated[
        ResourcesSpec, Field(description="Resources required by the requested task")
    ] = ResourcesSpec()
    max_duration: Annotated[
        Optional[str],
        Field(description="Maximum run duration, e.g. `2h`. Omit for the dstack default."),
    ] = None
    fleets: Annotated[
        Optional[List[str]],
        Field(description="Fleets considered for reuse/provisioning"),
    ] = None

    @validator("commands")
    def validate_commands(cls, v: List[str]) -> List[str]:
        v = [command.strip() for command in v if command.strip()]
        if not v:
            raise ValueError("At least one command is required")
        return v


class CreateGpuRequestRequest(CoreModel):
    request: GpuRequestSpec


class ListGpuRequestsRequest(CoreModel):
    status: Optional[GpuRequestStatus] = None
    include_all: bool = False
    prev_created_at: Optional[datetime] = None
    prev_id: Optional[UUID] = None
    limit: int = Field(100, ge=0, le=100)
    ascending: bool = False


class ListAllGpuRequestsRequest(ListGpuRequestsRequest):
    pass


class GetGpuRequestRequest(CoreModel):
    id: UUID


class ApproveGpuRequestRequest(CoreModel):
    id: UUID


class RejectGpuRequestRequest(CoreModel):
    id: UUID
    reason: Annotated[str, Field(min_length=1, max_length=2000)]


class GpuRequest(CoreModel):
    id: UUID
    project_name: str
    applicant: str
    status: GpuRequestStatus
    request: GpuRequestSpec
    created_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_message: Optional[str] = None
    run_id: Optional[UUID] = None
    run_name: Optional[str] = None
