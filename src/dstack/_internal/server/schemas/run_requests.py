from datetime import datetime
from typing import Annotated, Dict, List, Optional, Union
from uuid import UUID

from pydantic import Field, validator

from dstack._internal.core.models.common import CoreModel
from dstack._internal.core.models.resources import ResourcesSpec
from dstack._internal.server.models import RunRequestStatus


class RunRequestSpec(CoreModel):
    name: Annotated[
        Optional[str],
        Field(description="The run name. If not specified, a random name is generated."),
    ] = None
    image: Annotated[str, Field(description="The Docker image to run")]
    entrypoint: Annotated[Optional[str], Field(description="The Docker entrypoint")] = None
    working_dir: Annotated[
        Optional[str],
        Field(description="The absolute path to the working directory inside the container"),
    ] = None
    commands: Annotated[List[str], Field(description="The shell commands to run")]
    env: Annotated[
        Dict[str, str], Field(description="Environment variables for the container")
    ] = {}
    ports: Annotated[
        List[Union[int, str]], Field(description="Container ports or host:container mappings")
    ] = []
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
    volumes: Annotated[List[str], Field(description="Container mount points")] = []
    privileged: Annotated[bool, Field(description="Run the container in privileged mode")] = False

    @validator("commands")
    def validate_commands(cls, v: List[str]) -> List[str]:
        v = [command.strip() for command in v if command.strip()]
        if not v:
            raise ValueError("At least one command is required")
        return v


class CreateRunRequestRequest(CoreModel):
    request: RunRequestSpec


class ListRunRequestsRequest(CoreModel):
    status: Optional[RunRequestStatus] = None
    include_all: bool = False
    prev_created_at: Optional[datetime] = None
    prev_id: Optional[UUID] = None
    limit: int = Field(100, ge=0, le=100)
    ascending: bool = False


class ListAllRunRequestsRequest(ListRunRequestsRequest):
    pass


class GetRunRequestRequest(CoreModel):
    id: UUID


class ApproveRunRequestRequest(CoreModel):
    id: UUID


class RejectRunRequestRequest(CoreModel):
    id: UUID
    reason: Annotated[str, Field(min_length=1, max_length=2000)]


class RunRequest(CoreModel):
    id: UUID
    project_name: str
    applicant: str
    status: RunRequestStatus
    request: RunRequestSpec
    created_at: datetime
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    review_message: Optional[str] = None
    run_id: Optional[UUID] = None
    run_name: Optional[str] = None
