from dataclasses import dataclass
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.server import settings
from dstack._internal.server.models import DecryptedString, OAuthConfigModel, UserModel
from dstack._internal.server.schemas.admin_oauth import (
    GetFeishuOAuthConfigResponse,
    OAuthConfigSource,
    UpdateFeishuOAuthConfigRequest,
)
from dstack._internal.utils.common import get_current_datetime

FEISHU_PROVIDER = "feishu"


@dataclass(frozen=True)
class EffectiveOAuthConfig:
    enabled: bool
    app_id: Optional[str]
    app_secret: Optional[str]
    scope: str
    source: OAuthConfigSource


async def get_feishu_config(session: AsyncSession) -> GetFeishuOAuthConfigResponse:
    model = await get_oauth_config_model(session=session, provider=FEISHU_PROVIDER)
    if model is not None:
        return GetFeishuOAuthConfigResponse(
            enabled=model.enabled,
            app_id=model.app_id,
            scope=model.scope or "",
            has_app_secret=_get_plaintext_secret(model) is not None,
            source="database",
        )

    return GetFeishuOAuthConfigResponse(
        enabled=_environment_feishu_enabled(),
        app_id=settings.FEISHU_APP_ID,
        scope=settings.FEISHU_SCOPE or "",
        has_app_secret=settings.FEISHU_APP_SECRET is not None,
        source="environment" if _environment_feishu_enabled() else "none",
    )


async def get_effective_feishu_config(session: AsyncSession) -> EffectiveOAuthConfig:
    model = await get_oauth_config_model(session=session, provider=FEISHU_PROVIDER)
    if model is not None:
        secret = _get_plaintext_secret(model)
        return EffectiveOAuthConfig(
            enabled=model.enabled and bool(model.app_id) and bool(secret),
            app_id=model.app_id,
            app_secret=secret,
            scope=model.scope or "",
            source="database",
        )

    return EffectiveOAuthConfig(
        enabled=_environment_feishu_enabled(),
        app_id=settings.FEISHU_APP_ID,
        app_secret=settings.FEISHU_APP_SECRET,
        scope=settings.FEISHU_SCOPE or "",
        source="environment" if _environment_feishu_enabled() else "none",
    )


async def update_feishu_config(
    session: AsyncSession,
    user: UserModel,
    body: UpdateFeishuOAuthConfigRequest,
) -> GetFeishuOAuthConfigResponse:
    model = await get_oauth_config_model(session=session, provider=FEISHU_PROVIDER)
    if model is None:
        model = OAuthConfigModel(provider=FEISHU_PROVIDER, enabled=False)
        session.add(model)

    model.enabled = body.enabled
    model.app_id = _clean_optional_string(body.app_id)
    model.scope = _clean_optional_string(body.scope) or ""
    if body.app_secret is not None:
        secret = _clean_optional_string(body.app_secret)
        model.app_secret = DecryptedString(plaintext=secret) if secret is not None else None
    model.updated_at = get_current_datetime()
    model.updated_by = user
    await session.commit()
    await session.refresh(model)
    return GetFeishuOAuthConfigResponse(
        enabled=model.enabled,
        app_id=model.app_id,
        scope=model.scope or "",
        has_app_secret=_get_plaintext_secret(model) is not None,
        source="database",
    )


async def get_oauth_config_model(
    session: AsyncSession,
    provider: str,
) -> Optional[OAuthConfigModel]:
    res = await session.execute(
        select(OAuthConfigModel).where(OAuthConfigModel.provider == provider)
    )
    return res.scalar_one_or_none()


def _environment_feishu_enabled() -> bool:
    return settings.FEISHU_APP_ID is not None and settings.FEISHU_APP_SECRET is not None


def _get_plaintext_secret(model: OAuthConfigModel) -> Optional[str]:
    if model.app_secret is None:
        return None
    secret = model.app_secret.get_plaintext_or_error()
    return secret or None


def _clean_optional_string(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    value = value.strip()
    return value or None
