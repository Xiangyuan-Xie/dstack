from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.errors import ServerClientError
from dstack._internal.server.models import RuntimeImageModel, UserModel
from dstack._internal.server.schemas.runtime_images import RuntimeImage, UpdateRuntimeImagesRequest
from dstack._internal.utils.common import get_current_datetime

DEFAULT_RUNTIME_IMAGES = [
    RuntimeImage(
        name="PyTorch 2.5 CUDA 12.4",
        image="pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime",
        category="PyTorch",
        description="PyTorch runtime with CUDA 12.4 and cuDNN 9.",
        tags=["pytorch", "cuda12.4", "cudnn9", "runtime"],
    ),
    RuntimeImage(
        name="PyTorch 2.4 CUDA 12.1",
        image="pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime",
        category="PyTorch",
        description="PyTorch runtime for CUDA 12.1 compatibility.",
        tags=["pytorch", "cuda12.1", "cudnn9", "runtime"],
    ),
    RuntimeImage(
        name="CUDA 12.4 base",
        image="nvidia/cuda:12.4.1-base-ubuntu22.04",
        category="CUDA",
        tags=["cuda12.4", "base"],
    ),
    RuntimeImage(
        name="CUDA 12.4 runtime",
        image="nvidia/cuda:12.4.1-runtime-ubuntu22.04",
        category="CUDA",
        tags=["cuda12.4", "runtime"],
    ),
    RuntimeImage(
        name="CUDA 12.4 cuDNN runtime",
        image="nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04",
        category="CUDA",
        tags=["cuda12.4", "cudnn", "runtime"],
    ),
    RuntimeImage(
        name="CUDA 12.4 devel",
        image="nvidia/cuda:12.4.1-devel-ubuntu22.04",
        category="CUDA",
        tags=["cuda12.4", "devel"],
    ),
    RuntimeImage(
        name="CUDA 12.4 cuDNN devel",
        image="nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04",
        category="CUDA",
        tags=["cuda12.4", "cudnn", "devel"],
    ),
    RuntimeImage(
        name="CUDA 11.8 cuDNN runtime",
        image="nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04",
        category="CUDA",
        tags=["cuda11.8", "cudnn8", "runtime"],
    ),
    RuntimeImage(
        name="CUDA 11.8 cuDNN devel",
        image="nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04",
        category="CUDA",
        tags=["cuda11.8", "cudnn8", "devel"],
    ),
    RuntimeImage(
        name="Isaac Sim 6.0",
        image="nvcr.io/nvidia/isaac-sim:6.0.0-dev2",
        category="Isaac Sim",
        description="NVIDIA Isaac Sim container. Requires NVIDIA EULA acceptance.",
        tags=["isaac-sim", "robotics", "simulation"],
        recommended_env={"ACCEPT_EULA": "Y"},
    ),
    RuntimeImage(
        name="Isaac Sim 5.1",
        image="nvcr.io/nvidia/isaac-sim:5.1.0",
        category="Isaac Sim",
        description="NVIDIA Isaac Sim 5.1 container. Requires NVIDIA EULA acceptance.",
        tags=["isaac-sim", "robotics", "simulation"],
        recommended_env={"ACCEPT_EULA": "Y"},
    ),
    RuntimeImage(
        name="Isaac Sim 5.0",
        image="nvcr.io/nvidia/isaac-sim:5.0.0",
        category="Isaac Sim",
        description="NVIDIA Isaac Sim 5.0 container. Requires NVIDIA EULA acceptance.",
        tags=["isaac-sim", "robotics", "simulation"],
        recommended_env={"ACCEPT_EULA": "Y"},
    ),
    RuntimeImage(
        name="Isaac Sim 4.5",
        image="nvcr.io/nvidia/isaac-sim:4.5.0",
        category="Isaac Sim",
        description="NVIDIA Isaac Sim 4.5 container. Requires NVIDIA EULA acceptance.",
        tags=["isaac-sim", "robotics", "simulation"],
        recommended_env={"ACCEPT_EULA": "Y"},
    ),
    RuntimeImage(
        name="Isaac Sim 4.2",
        image="nvcr.io/nvidia/isaac-sim:4.2.0",
        category="Isaac Sim",
        description="NVIDIA Isaac Sim 4.2 container. Requires NVIDIA EULA acceptance.",
        tags=["isaac-sim", "robotics", "simulation"],
        recommended_env={"ACCEPT_EULA": "Y"},
    ),
]


async def list_runtime_images(session: AsyncSession) -> list[RuntimeImage]:
    res = await session.execute(
        select(RuntimeImageModel).order_by(RuntimeImageModel.position, RuntimeImageModel.name)
    )
    images = [_model_to_runtime_image(model) for model in res.scalars().all()]
    if images:
        return images
    return DEFAULT_RUNTIME_IMAGES


async def update_runtime_images(
    session: AsyncSession,
    user: UserModel,
    body: UpdateRuntimeImagesRequest,
) -> list[RuntimeImage]:
    images = _clean_runtime_images(body.images)
    await session.execute(delete(RuntimeImageModel))
    now = get_current_datetime()
    for position, image in enumerate(images):
        session.add(
            RuntimeImageModel(
                name=image.name,
                image=image.image,
                position=position,
                created_at=now,
                updated_at=now,
                updated_by=user,
            )
        )
    await session.commit()
    return await list_runtime_images(session=session)


def _clean_runtime_images(images: list[RuntimeImage]) -> list[RuntimeImage]:
    cleaned: list[RuntimeImage] = []
    seen_names: set[str] = set()
    seen_images: set[str] = set()
    for image in images:
        name = image.name.strip()
        image_ref = image.image.strip()
        if not name:
            raise ServerClientError("Runtime image name must not be empty")
        if not image_ref:
            raise ServerClientError("Runtime image reference must not be empty")
        if name in seen_names:
            raise ServerClientError(f"Runtime image name {name!r} is duplicated")
        if image_ref in seen_images:
            raise ServerClientError(f"Runtime image reference {image_ref!r} is duplicated")
        seen_names.add(name)
        seen_images.add(image_ref)
        cleaned.append(
            RuntimeImage(
                name=name,
                image=image_ref,
                category=image.category.strip() if image.category else None,
                description=image.description.strip() if image.description else None,
                tags=[tag.strip() for tag in image.tags if tag.strip()],
                recommended_env=image.recommended_env,
            )
        )
    return cleaned


def _model_to_runtime_image(model: RuntimeImageModel) -> RuntimeImage:
    return RuntimeImage(name=model.name, image=model.image)
