import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server import settings as server_settings
from dstack._internal.server.models import OAuthConfigModel
from dstack._internal.server.services import users


class TestFeishuOAuthConfig:
    @pytest.mark.asyncio
    async def test_regular_user_cannot_read_config(
        self, session: AsyncSession, client: AsyncClient
    ):
        token = await _create_user_token(session, "regular-user", GlobalRole.USER)

        response = await client.post(
            "/api/admin/oauth/feishu/get",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_global_admin_can_save_and_read_config_without_secret(
        self, session: AsyncSession, client: AsyncClient
    ):
        token = await _create_user_token(session, "admin", GlobalRole.ADMIN)

        update_response = await client.post(
            "/api/admin/oauth/feishu/update",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "enabled": True,
                "app_id": "db-app-id",
                "app_secret": "db-app-secret",
                "scope": "contact:user.base:readonly",
            },
        )

        assert update_response.status_code == 200
        assert update_response.json() == {
            "enabled": True,
            "app_id": "db-app-id",
            "scope": "contact:user.base:readonly",
            "has_app_secret": True,
            "source": "database",
        }

        get_response = await client.post(
            "/api/admin/oauth/feishu/get",
            headers={"Authorization": f"Bearer {token}"},
        )

        assert get_response.status_code == 200
        assert get_response.json() == {
            "enabled": True,
            "app_id": "db-app-id",
            "scope": "contact:user.base:readonly",
            "has_app_secret": True,
            "source": "database",
        }
        assert "db-app-secret" not in get_response.text

    @pytest.mark.asyncio
    async def test_app_secret_is_encrypted(self, session: AsyncSession, client: AsyncClient):
        token = await _create_user_token(session, "admin", GlobalRole.ADMIN)

        response = await client.post(
            "/api/admin/oauth/feishu/update",
            headers={"Authorization": f"Bearer {token}"},
            json={"enabled": True, "app_id": "db-app-id", "app_secret": "db-app-secret"},
        )

        assert response.status_code == 200
        res = await session.execute(
            select(OAuthConfigModel).where(OAuthConfigModel.provider == "feishu")
        )
        model = res.scalar_one()
        assert model.app_secret.get_plaintext_or_error() == "db-app-secret"

    @pytest.mark.asyncio
    async def test_info_uses_environment_when_database_config_is_missing(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        monkeypatch.setattr(server_settings, "FEISHU_APP_ID", "env-app-id")
        monkeypatch.setattr(server_settings, "FEISHU_APP_SECRET", "env-app-secret")
        monkeypatch.setattr(server_settings, "FEISHU_SCOPE", "")

        response = await client.post("/api/auth/feishu/info")

        assert response.status_code == 200
        assert response.json() == {"enabled": True}

    @pytest.mark.asyncio
    async def test_database_disabled_config_overrides_environment(
        self, monkeypatch: pytest.MonkeyPatch, session: AsyncSession, client: AsyncClient
    ):
        monkeypatch.setattr(server_settings, "FEISHU_APP_ID", "env-app-id")
        monkeypatch.setattr(server_settings, "FEISHU_APP_SECRET", "env-app-secret")
        token = await _create_user_token(session, "admin", GlobalRole.ADMIN)
        response = await client.post(
            "/api/admin/oauth/feishu/update",
            headers={"Authorization": f"Bearer {token}"},
            json={"enabled": False, "app_id": "db-app-id", "app_secret": "db-app-secret"},
        )
        assert response.status_code == 200

        info_response = await client.post("/api/auth/feishu/info")

        assert info_response.status_code == 200
        assert info_response.json() == {"enabled": False}


async def _create_user_token(session: AsyncSession, username: str, role: GlobalRole) -> str:
    token = f"{username}-token"
    await users.create_user(session=session, username=username, global_role=role, token=token)
    return token
