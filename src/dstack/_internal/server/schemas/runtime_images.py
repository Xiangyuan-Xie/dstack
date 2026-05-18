from typing import Annotated, Optional

from pydantic import Field

from dstack._internal.core.models.common import CoreModel


class RuntimeImage(CoreModel):
    name: Annotated[str, Field(description="Human-readable image name.")]
    image: Annotated[str, Field(description="Docker image reference.")]
    category: Annotated[
        Optional[str],
        Field(description="Optional UI category for grouping runtime images."),
    ] = None
    description: Annotated[
        Optional[str],
        Field(description="Optional human-readable usage note."),
    ] = None
    tags: Annotated[list[str], Field(description="Optional UI tags.")] = []
    recommended_env: Annotated[
        dict[str, str],
        Field(description="Environment variables recommended for this image."),
    ] = {}


class ListRuntimeImagesRequest(CoreModel):
    pass


class UpdateRuntimeImagesRequest(CoreModel):
    images: Annotated[list[RuntimeImage], Field(description="Runtime image whitelist.")]
