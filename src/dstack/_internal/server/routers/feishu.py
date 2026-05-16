import hashlib
import re
import urllib.parse
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.errors import ResourceExistsError, ServerClientError
from dstack._internal.core.models.auth import OAuthProviderInfo
from dstack._internal.core.models.users import GlobalRole, UserWithCreds
from dstack._internal.server import settings
from dstack._internal.server.db import get_session
from dstack._internal.server.models import UserModel
from dstack._internal.server.schemas.auth import (
    OAuthAuthorizeRequest,
    OAuthAuthorizeResponse,
    OAuthCallbackRequest,
    OAuthInfoResponse,
)
from dstack._internal.server.services import auth as auth_services
from dstack._internal.server.services import oauth as oauth_services
from dstack._internal.server.services import users as users_services
from dstack._internal.server.utils.routers import CustomORJSONResponse

_PROVIDER_NAME = "feishu"
_AUTHORIZE_URL = "https://open.feishu.cn/open-apis/authen/v1/authorize"
_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v2/oauth/token"
_USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"

router = APIRouter(prefix=f"/api/auth/{_PROVIDER_NAME}", tags=["authentication"])


def _is_enabled() -> bool:
    return settings.FEISHU_APP_ID is not None and settings.FEISHU_APP_SECRET is not None


auth_services.register_provider(OAuthProviderInfo(name=_PROVIDER_NAME, enabled=_is_enabled()))
auth_services.register_provider_enabled_getter(_PROVIDER_NAME, _is_enabled)


@router.post("/info", summary="Get Feishu OAuth info", response_model=OAuthInfoResponse)
async def get_info(session: AsyncSession = Depends(get_session)):
    config = await oauth_services.get_effective_feishu_config(session=session)
    return CustomORJSONResponse(OAuthInfoResponse(enabled=config.enabled))


@router.post(
    "/authorize",
    summary="Get Feishu OAuth authorization URL",
    response_model=OAuthAuthorizeResponse,
)
async def authorize(
    body: Optional[OAuthAuthorizeRequest] = None,
    session: AsyncSession = Depends(get_session),
):
    config = await oauth_services.get_effective_feishu_config(session=session)
    _check_enabled(config)
    if body is None:
        body = OAuthAuthorizeRequest()
    state = auth_services.generate_oauth_state(local_port=body.local_port)
    redirect_uri = _get_redirect_uri(body.base_url)
    params = {
        "app_id": config.app_id,
        "redirect_uri": redirect_uri,
        "state": state,
    }
    if config.scope:
        params["scope"] = config.scope
    authorization_url = f"{_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"
    response = CustomORJSONResponse(OAuthAuthorizeResponse(authorization_url=authorization_url))
    auth_services.set_state_cookie(response, state)
    return response


@router.post("/callback", summary="Complete Feishu OAuth", response_model=UserWithCreds)
async def callback(
    body: OAuthCallbackRequest,
    request: Request,
    session: AsyncSession = Depends(get_session),
):
    config = await oauth_services.get_effective_feishu_config(session=session)
    _check_enabled(config)
    auth_services.get_validated_state(request=request, state=body.state)
    user_info = await _get_feishu_user_info(
        code=body.code,
        redirect_uri=_get_redirect_uri(body.base_url),
        config=config,
    )
    external_id = _get_external_id(user_info)
    user = await _get_or_create_user(
        session=session,
        external_id=external_id,
        user_info=user_info,
    )
    return CustomORJSONResponse(users_services.user_model_to_user_with_creds(user))


def _check_enabled(config: oauth_services.EffectiveOAuthConfig) -> None:
    if not config.enabled:
        raise ServerClientError("Feishu OAuth is not configured")


def _get_redirect_uri(base_url: Optional[str]) -> str:
    base_url = (base_url or settings.SERVER_URL).rstrip("/")
    return f"{base_url}/auth/feishu/callback"


async def _get_feishu_user_info(
    code: str,
    redirect_uri: str,
    config: oauth_services.EffectiveOAuthConfig,
) -> dict:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_response = await client.post(
                _TOKEN_URL,
                json={
                    "grant_type": "authorization_code",
                    "client_id": config.app_id,
                    "client_secret": config.app_secret,
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
            )
            token_payload = _parse_feishu_response(token_response)
            user_access_token = token_payload.get("access_token") or token_payload.get(
                "user_access_token"
            )
            if not user_access_token:
                raise ServerClientError("Feishu OAuth did not return a user access token")
            user_response = await client.get(
                _USER_INFO_URL,
                headers={"Authorization": f"Bearer {user_access_token}"},
            )
            return _parse_feishu_response(user_response)
    except httpx.HTTPError as e:
        raise ServerClientError("Feishu OAuth request failed") from e
    except ValueError as e:
        raise ServerClientError("Feishu OAuth returned an invalid response") from e


def _parse_feishu_response(response: httpx.Response) -> dict:
    try:
        response.raise_for_status()
        payload = response.json()
    except httpx.HTTPError as e:
        raise ServerClientError("Feishu OAuth request failed") from e
    except ValueError as e:
        raise ServerClientError("Feishu OAuth returned an invalid response") from e
    code = payload.get("code", 0)
    if code != 0:
        msg = payload.get("msg") or payload.get("message") or "Feishu OAuth request failed"
        raise ServerClientError(str(msg))
    data = payload.get("data")
    if not isinstance(data, dict):
        raise ServerClientError("Feishu OAuth returned an invalid response")
    return data


def _get_external_id(user_info: dict) -> str:
    open_id = user_info.get("open_id")
    if not isinstance(open_id, str) or open_id == "":
        raise ServerClientError("Feishu OAuth did not return an open_id")
    return f"feishu:{open_id}"


async def _get_or_create_user(
    session: AsyncSession,
    external_id: str,
    user_info: dict,
) -> UserModel:
    res = await session.execute(
        select(UserModel).where(
            UserModel.external_id == external_id,
            UserModel.deleted == False,
        )
    )
    user = res.scalar_one_or_none()
    if user is not None:
        if user_info.get("email") and user.email != user_info["email"]:
            user.email = user_info["email"]
            await session.commit()
        return user
    return await _create_user_with_available_name(session, external_id, user_info)


async def _create_user_with_available_name(
    session: AsyncSession,
    external_id: str,
    user_info: dict,
) -> UserModel:
    username = _build_username(user_info)
    for attempt in range(10):
        suffix = "" if attempt == 0 else f"-{attempt}"
        candidate = f"{username[: 50 - len(suffix)]}{suffix}"
        try:
            return await users_services.create_user(
                session=session,
                username=candidate,
                global_role=GlobalRole.USER,
                email=user_info.get("email"),
                external_id=external_id,
            )
        except ResourceExistsError:
            continue
    raise ServerClientError("Cannot create a unique username for Feishu user")


def _build_username(user_info: dict) -> str:
    open_id = user_info["open_id"]
    suffix = hashlib.sha256(open_id.encode()).hexdigest()[:8]
    safe_open_id = re.sub("[^a-zA-Z0-9-_]", "-", open_id).strip("-") or "user"
    prefix = "feishu-"
    max_open_id_len = 50 - len(prefix) - len(suffix) - 1
    return f"{prefix}{safe_open_id[:max_open_id_len]}-{suffix}"
