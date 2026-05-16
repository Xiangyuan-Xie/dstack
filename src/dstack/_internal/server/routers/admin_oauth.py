from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.server.db import get_session
from dstack._internal.server.models import UserModel
from dstack._internal.server.schemas.admin_oauth import (
    GetFeishuOAuthConfigResponse,
    UpdateFeishuOAuthConfigRequest,
)
from dstack._internal.server.security.permissions import GlobalAdmin
from dstack._internal.server.services import oauth as oauth_services
from dstack._internal.server.utils.routers import CustomORJSONResponse

router = APIRouter(prefix="/api/admin/oauth", tags=["admin"])


@router.post(
    "/feishu/get",
    summary="Get Feishu OAuth configuration",
    response_model=GetFeishuOAuthConfigResponse,
)
async def get_feishu_config(
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(GlobalAdmin()),
):
    return CustomORJSONResponse(await oauth_services.get_feishu_config(session=session))


@router.post(
    "/feishu/update",
    summary="Update Feishu OAuth configuration",
    response_model=GetFeishuOAuthConfigResponse,
)
async def update_feishu_config(
    body: UpdateFeishuOAuthConfigRequest,
    session: AsyncSession = Depends(get_session),
    user: UserModel = Depends(GlobalAdmin()),
):
    return CustomORJSONResponse(
        await oauth_services.update_feishu_config(session=session, user=user, body=body)
    )
