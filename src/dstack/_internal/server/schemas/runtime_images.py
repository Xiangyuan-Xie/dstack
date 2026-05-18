from typing import Annotated

from pydantic import Field

from dstack._internal.core.models.common import CoreModel


class RuntimeImage(CoreModel):
    name: Annotated[str, Field(description="Human-readable image name.")]
    image: Annotated[str, Field(description="Docker image reference.")]


class ListRuntimeImagesRequest(CoreModel):
    pass


class UpdateRuntimeImagesRequest(CoreModel):
    images: Annotated[list[RuntimeImage], Field(description="Runtime image whitelist.")]
