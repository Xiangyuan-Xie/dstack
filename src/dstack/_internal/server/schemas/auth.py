from typing import Annotated, Optional

from pydantic import Field

from dstack._internal.core.models.common import CoreModel


class OAuthInfoResponse(CoreModel):
    enabled: Annotated[
        bool, Field(description="Whether the OAuth2 provider is configured on the server.")
    ]


class OAuthAuthorizeRequest(CoreModel):
    local_port: Annotated[
        Optional[int],
        Field(
            description="If specified, the user is redirected to localhost:local_port after the redirect from the provider.",
            ge=1,
            le=65535,
        ),
    ] = None
    base_url: Annotated[
        Optional[str],
        Field(
            description=(
                "The server base URL used to access the dstack server, e.g. `http://localhost:3000`."
                " Used to build redirect URLs when the dstack server is available on multiple domains."
            )
        ),
    ] = None


class OAuthAuthorizeResponse(CoreModel):
    authorization_url: Annotated[str, Field(description="An OAuth2 authorization URL.")]


class OAuthCallbackRequest(CoreModel):
    code: Annotated[
        str,
        Field(
            description="The OAuth2 authorization code received from the provider in the redirect URL."
        ),
    ]
    state: Annotated[
        str,
        Field(description="The state parameter received from the provider in the redirect URL."),
    ]
    base_url: Annotated[
        Optional[str],
        Field(
            description=(
                "The server base URL used to access the dstack server, e.g. `http://localhost:3000`."
                " Used to build redirect URLs when the dstack server is available on multiple domains."
                " It must match the base URL specified when generating the authorization URL."
            )
        ),
    ] = None


class OAuthGetNextRedirectRequest(CoreModel):
    code: Annotated[
        str,
        Field(
            description="The OAuth2 authorization code received from the provider in the redirect URL."
        ),
    ]
    state: Annotated[
        str,
        Field(description="The state parameter received from the provider in the redirect URL."),
    ]


class OAuthGetNextRedirectResponse(CoreModel):
    redirect_url: Annotated[
        Optional[str],
        Field(
            description=(
                "The URL that the user needs to be redirected to."
                " If `null`, there is no next redirect."
            )
        ),
    ]


class TestUserToken(CoreModel):
    username: Annotated[str, Field(description="The test user's username.")]
    label: Annotated[str, Field(description="A short user-facing role label.")]
    role: Annotated[str, Field(description="The test role represented by the token.")]
    token: Annotated[str, Field(description="The fixed token that can be used to sign in.")]
    description: Annotated[str, Field(description="A short description of available permissions.")]


class ListTestUsersResponse(CoreModel):
    enabled: Annotated[
        bool,
        Field(description="Whether server test users are enabled."),
    ]
    users: Annotated[
        list[TestUserToken],
        Field(description="Fixed test users available for token sign-in."),
    ] = []
