import json
import urllib.parse
from base64 import b64encode
from typing import Optional

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.auth import OAuthProviderInfo
from dstack._internal.server import settings as server_settings
from dstack._internal.server.services.auth import register_provider


class TestListProviders:
    @pytest.mark.asyncio
    async def test_returns_registered_feishu_provider(
        self, monkeypatch: pytest.MonkeyPatch, client: AsyncClient
    ):
        _configure_feishu(monkeypatch, app_id=None, app_secret=None)

        response = await client.post("/api/auth/list_providers")

        assert response.status_code == 200
        assert response.json() == [{"name": "feishu", "enabled": False}]

    @pytest.mark.asyncio
    async def test_returns_registered_providers(
        self, monkeypatch: pytest.MonkeyPatch, client: AsyncClient
    ):
        _configure_feishu(monkeypatch, app_id=None, app_secret=None)
        register_provider(OAuthProviderInfo(name="provider1", enabled=True))
        register_provider(OAuthProviderInfo(name="provider2", enabled=False))
        response = await client.post("/api/auth/list_providers")
        assert response.status_code == 200
        assert response.json() == [
            {
                "name": "feishu",
                "enabled": False,
            },
            {
                "name": "provider1",
                "enabled": True,
            },
            {
                "name": "provider2",
                "enabled": False,
            },
        ]

    @pytest.mark.asyncio
    async def test_returns_dynamic_feishu_provider_state(
        self, monkeypatch: pytest.MonkeyPatch, client: AsyncClient
    ):
        _configure_feishu(monkeypatch)

        response = await client.post("/api/auth/list_providers")

        assert response.status_code == 200
        assert {"name": "feishu", "enabled": True} in response.json()


class TestListTestUsers:
    @pytest.mark.asyncio
    async def test_returns_disabled_when_test_users_are_disabled(
        self, monkeypatch: pytest.MonkeyPatch, client: AsyncClient
    ):
        monkeypatch.setattr(server_settings, "SERVER_TEST_USERS_ENABLED", False)

        response = await client.post("/api/auth/test_users")

        assert response.status_code == 200
        assert response.json() == {"enabled": False, "users": []}

    @pytest.mark.asyncio
    async def test_returns_fixed_tokens_when_test_users_are_enabled(
        self, monkeypatch: pytest.MonkeyPatch, client: AsyncClient
    ):
        monkeypatch.setattr(server_settings, "SERVER_TEST_USERS_ENABLED", True)

        response = await client.post("/api/auth/test_users")

        assert response.status_code == 200
        assert response.json() == {
            "enabled": True,
            "users": [
                {
                    "username": "test-admin",
                    "label": "最高管理员",
                    "role": "global_admin",
                    "token": "dstack-test-admin-token",
                    "description": "可访问完整资源、项目、用户和系统事件管理。",
                },
                {
                    "username": "test-manager",
                    "label": "项目管理员",
                    "role": "project_manager",
                    "token": "dstack-test-manager-token",
                    "description": "可审批运行任务并管理项目内服务器。",
                },
                {
                    "username": "test-user",
                    "label": "普通用户",
                    "role": "user",
                    "token": "dstack-test-user-token",
                    "description": "只能提交运行任务、查看自己的任务和个人中心。",
                },
            ],
        }


class TestGetNextRedirectURL:
    @pytest.mark.asyncio
    async def test_returns_no_redirect_url_if_local_port_not_set(self, client: AsyncClient):
        state = b64encode(json.dumps({"value": "12356", "local_port": None}).encode()).decode()
        response = await client.post(
            "/api/auth/get_next_redirect", json={"code": "1234", "state": state}
        )
        assert response.status_code == 200
        assert response.json() == {"redirect_url": None}

    @pytest.mark.asyncio
    async def test_returns_redirect_url_if_local_port_set(self, client: AsyncClient):
        state = b64encode(json.dumps({"value": "12356", "local_port": 12345}).encode()).decode()
        response = await client.post(
            "/api/auth/get_next_redirect", json={"code": "1234", "state": state}
        )
        assert response.status_code == 200
        assert response.json() == {
            "redirect_url": f"http://localhost:12345/auth/callback?code=1234&state={state}"
        }

    @pytest.mark.asyncio
    async def test_returns_400_if_state_invalid(self, client: AsyncClient):
        state = "some_invalid_state"
        response = await client.post(
            "/api/auth/get_next_redirect", json={"code": "1234", "state": state}
        )
        assert response.status_code == 400
        assert "Invalid state token" in response.json()["detail"][0]["msg"]


class TestFeishuOAuth:
    @pytest.mark.asyncio
    async def test_info_returns_disabled_when_credentials_are_missing(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        _configure_feishu(monkeypatch, app_id=None, app_secret=None)

        response = await client.post("/api/auth/feishu/info")

        assert response.status_code == 200
        assert response.json() == {"enabled": False}

    @pytest.mark.asyncio
    async def test_authorize_returns_feishu_url_and_sets_state_cookie(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        _configure_feishu(monkeypatch)

        response = await client.post("/api/auth/feishu/authorize")

        assert response.status_code == 200
        assert "oauth-state" in response.cookies
        authorization_url = response.json()["authorization_url"]
        assert authorization_url.startswith(
            "https://open.feishu.cn/open-apis/authen/v1/authorize?"
        )
        assert "app_id=test-app-id" in authorization_url
        assert "redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fauth%2Ffeishu%2Fcallback" in (
            authorization_url
        )
        query = urllib.parse.parse_qs(urllib.parse.urlparse(authorization_url).query)
        assert query["state"] == [response.cookies["oauth-state"].strip('"')]

    @pytest.mark.asyncio
    async def test_callback_returns_created_regular_user_from_feishu_identity(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        _configure_feishu(monkeypatch)
        _mock_feishu_http(
            monkeypatch,
            user_access_token="test-user-access-token",
            user_info={
                "open_id": "ou_123456",
                "union_id": "on_123456",
                "name": "张三",
                "email": "zhangsan@example.com",
            },
        )
        _mock_get_or_create_feishu_user(monkeypatch)
        authorize_response = await client.post("/api/auth/feishu/authorize")
        state = authorize_response.cookies["oauth-state"].strip('"')

        response = await client.post(
            "/api/auth/feishu/callback",
            json={"code": "test-code", "state": state},
        )

        assert response.status_code == 200
        body = response.json()
        assert body["username"] == "feishu-ou_123456"
        assert body["global_role"] == "user"
        assert body["email"] == "zhangsan@example.com"
        assert body["creds"]["token"]

    @pytest.mark.asyncio
    async def test_callback_uses_stable_feishu_external_id(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        _configure_feishu(monkeypatch)
        _mock_feishu_http(
            monkeypatch,
            user_access_token="test-user-access-token",
            user_info={"open_id": "ou_123456", "name": "张三"},
        )
        calls = _mock_get_or_create_feishu_user(monkeypatch)
        authorize_response = await client.post("/api/auth/feishu/authorize")
        state = authorize_response.cookies["oauth-state"].strip('"')

        response = await client.post(
            "/api/auth/feishu/callback",
            json={"code": "test-code", "state": state},
        )

        assert response.status_code == 200
        assert calls == [
            {
                "external_id": "feishu:ou_123456",
                "open_id": "ou_123456",
            }
        ]

    @pytest.mark.asyncio
    async def test_callback_rejects_invalid_state(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        _configure_feishu(monkeypatch)

        response = await client.post(
            "/api/auth/feishu/callback",
            json={"code": "test-code", "state": "invalid-state"},
        )

        assert response.status_code == 400
        assert "Invalid state token" in response.json()["detail"][0]["msg"]

    def test_build_username_keeps_database_length_limit(self):
        from dstack._internal.server.routers.feishu import _build_username

        username = _build_username({"open_id": "ou_" + ("x" * 120)})

        assert len(username) <= 50
        assert username.startswith("feishu-ou_")
        assert username.endswith("-53e2b545")

    @pytest.mark.asyncio
    async def test_create_user_candidate_keeps_database_length_limit(self, monkeypatch):
        from dstack._internal.core.errors import ResourceExistsError, ServerClientError
        from dstack._internal.server.routers.feishu import _create_user_with_available_name

        candidates = []

        async def create_user(session, username, global_role, email=None, external_id=None):
            candidates.append(username)
            raise ResourceExistsError()

        monkeypatch.setattr(
            "dstack._internal.server.routers.feishu.users_services.create_user",
            create_user,
        )

        with pytest.raises(ServerClientError):
            await _create_user_with_available_name(
                session=None,
                external_id="feishu:ou_test",
                user_info={"open_id": "ou_" + ("x" * 120)},
            )

        assert all(len(candidate) <= 50 for candidate in candidates)


def _configure_feishu(
    monkeypatch: pytest.MonkeyPatch,
    app_id: Optional[str] = "test-app-id",
    app_secret: Optional[str] = "test-app-secret",
):
    monkeypatch.setattr(server_settings, "FEISHU_APP_ID", app_id)
    monkeypatch.setattr(server_settings, "FEISHU_APP_SECRET", app_secret)
    monkeypatch.setattr(server_settings, "FEISHU_SCOPE", "")
    monkeypatch.setattr(server_settings, "SERVER_URL", "http://localhost:3000")


def _mock_feishu_http(
    monkeypatch: pytest.MonkeyPatch,
    user_access_token: str,
    user_info: dict,
):
    class ResponseMock:
        def __init__(self, payload: dict):
            self._payload = payload

        def json(self) -> dict:
            return self._payload

        def raise_for_status(self) -> None:
            return None

    class ClientMock:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return None

        async def post(self, *args, **kwargs):
            return ResponseMock(
                {
                    "code": 0,
                    "msg": "success",
                    "data": {"access_token": user_access_token},
                }
            )

        async def get(self, *args, **kwargs):
            return ResponseMock(
                {
                    "code": 0,
                    "msg": "success",
                    "data": user_info,
                }
            )

    monkeypatch.setattr("dstack._internal.server.routers.feishu.httpx.AsyncClient", ClientMock)


def _mock_get_or_create_feishu_user(monkeypatch: pytest.MonkeyPatch) -> list[dict]:
    from dstack._internal.core.models.users import (
        GlobalRole,
        UserTokenCreds,
        UserWithCreds,
    )

    calls = []

    async def get_or_create_user(session, external_id: str, user_info: dict):
        calls.append({"external_id": external_id, "open_id": user_info["open_id"]})
        return UserWithCreds(
            id="00000000-0000-4000-8000-000000000001",
            username=f"feishu-{user_info['open_id']}",
            global_role=GlobalRole.USER,
            email=user_info.get("email"),
            active=True,
            creds=UserTokenCreds(token="test-token"),
        )

    def user_model_to_user_with_creds(user):
        return user

    monkeypatch.setattr(
        "dstack._internal.server.routers.feishu._get_or_create_user",
        get_or_create_user,
    )
    monkeypatch.setattr(
        "dstack._internal.server.routers.feishu.users_services.user_model_to_user_with_creds",
        user_model_to_user_with_creds,
    )
    return calls
