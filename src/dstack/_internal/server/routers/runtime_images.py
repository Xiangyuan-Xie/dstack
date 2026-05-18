from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.server.db import get_session
from dstack._internal.server.models import UserModel
from dstack._internal.server.schemas.runtime_images import (
    ListRuntimeImagesRequest,
    RuntimeImage,
    UpdateRuntimeImagesRequest,
)
from dstack._internal.server.security.permissions import Authenticated, GlobalAdmin
from dstack._internal.server.services import runtime_images as runtime_images_services
from dstack._internal.server.utils.routers import CustomORJSONResponse

root_router = APIRouter(prefix="/api/runtime_images", tags=["runtime_images"])
admin_router = APIRouter(prefix="/api/admin/runtime_images", tags=["admin"])


@root_router.post("/list", response_model=list[RuntimeImage])
async def list_runtime_images(
    body: ListRuntimeImagesRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    _: Annotated[UserModel, Depends(Authenticated())],
):
    return CustomORJSONResponse(await runtime_images_services.list_runtime_images(session=session))


@admin_router.post("/update", response_model=list[RuntimeImage])
async def update_runtime_images(
    body: UpdateRuntimeImagesRequest,
    session: Annotated[AsyncSession, Depends(get_session)],
    user: Annotated[UserModel, Depends(GlobalAdmin())],
):
    return CustomORJSONResponse(
        await runtime_images_services.update_runtime_images(session=session, user=user, body=body)
    )
