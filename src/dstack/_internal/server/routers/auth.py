from fastapi import APIRouter

from dstack._internal.core.models.auth import OAuthProviderInfo
from dstack._internal.server.schemas.auth import (
    ListTestUsersResponse,
    OAuthGetNextRedirectRequest,
    OAuthGetNextRedirectResponse,
)
from dstack._internal.server.services import auth as auth_services
from dstack._internal.server.services import users as users_services
from dstack._internal.server.utils.routers import CustomORJSONResponse

router = APIRouter(prefix="/api/auth", tags=["authentication"])


@router.post(
    "/list_providers", summary="List OAuth providers", response_model=list[OAuthProviderInfo]
)
async def list_providers():
    """
    Returns OAuth2 providers registered on the server.
    """
    return CustomORJSONResponse(auth_services.list_providers())


@router.post(
    "/test_users",
    summary="List server test users",
    response_model=ListTestUsersResponse,
)
async def list_test_users():
    """
    Returns fixed test tokens when the server is started with test users enabled.
    """
    test_users = users_services.list_server_test_user_tokens()
    return CustomORJSONResponse(ListTestUsersResponse(enabled=bool(test_users), users=test_users))


@router.post(
    "/get_next_redirect",
    summary="Get next redirect URL",
    response_model=OAuthGetNextRedirectResponse,
)
async def get_next_redirect(body: OAuthGetNextRedirectRequest):
    """
    A helper endpoint that returns the next redirect URL in case the state encodes it.
    Can be used by the UI after the redirect from the provider
    to determine if the user needs to be redirected further (CLI login)
    or the auth callback endpoint needs to be called directly (UI login).
    """
    return CustomORJSONResponse(
        OAuthGetNextRedirectResponse(
            redirect_url=auth_services.get_next_redirect_url(code=body.code, state=body.state)
        )
    )
