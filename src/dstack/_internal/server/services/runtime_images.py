from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.errors import ServerClientError
from dstack._internal.server.models import RuntimeImageModel, UserModel
from dstack._internal.server.schemas.runtime_images import RuntimeImage, UpdateRuntimeImagesRequest
from dstack._internal.utils.common import get_current_datetime


async def list_runtime_images(session: AsyncSession) -> list[RuntimeImage]:
    res = await session.execute(
        select(RuntimeImageModel).order_by(RuntimeImageModel.position, RuntimeImageModel.name)
    )
    return [_model_to_runtime_image(model) for model in res.scalars().all()]


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
        cleaned.append(RuntimeImage(name=name, image=image_ref))
    return cleaned


def _model_to_runtime_image(model: RuntimeImageModel) -> RuntimeImage:
    return RuntimeImage(name=model.name, image=model.image)
