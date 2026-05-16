from typing import Annotated, Literal, Optional

from pydantic import Field

from dstack._internal.core.models.common import CoreModel

OAuthConfigSource = Literal["database", "environment", "none"]


class GetFeishuOAuthConfigResponse(CoreModel):
    enabled: Annotated[bool, Field(description="Whether Feishu OAuth is enabled.")]
    app_id: Annotated[Optional[str], Field(description="The configured Feishu app ID.")] = None
    scope: Annotated[str, Field(description="OAuth scopes requested from Feishu.")] = ""
    has_app_secret: Annotated[
        bool, Field(description="Whether a Feishu app secret is configured.")
    ]
    source: Annotated[
        OAuthConfigSource,
        Field(description="Where the effective Feishu OAuth configuration comes from."),
    ]


class UpdateFeishuOAuthConfigRequest(CoreModel):
    enabled: Annotated[bool, Field(description="Whether Feishu OAuth should be enabled.")]
    app_id: Annotated[Optional[str], Field(description="The Feishu app ID.")] = None
    app_secret: Annotated[
        Optional[str],
        Field(
            description=(
                "The Feishu app secret. Omit the field to keep the current secret unchanged."
            )
        ),
    ] = None
    scope: Annotated[Optional[str], Field(description="OAuth scopes requested from Feishu.")] = None
