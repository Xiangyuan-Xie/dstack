from unittest.mock import AsyncMock, Mock

import pytest

from dstack._internal.core.models.users import GlobalRole, ProjectRole
from dstack._internal.server.models import DecryptedString, ProjectModel, UserModel
from dstack._internal.server.services import users


class TestListServerTestUserTokens:
    def test_returns_no_tokens_when_disabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(users.settings, "SERVER_TEST_USERS_ENABLED", False)

        assert users.list_server_test_user_tokens() == []

    def test_returns_fixed_tokens_when_enabled(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setattr(users.settings, "SERVER_TEST_USERS_ENABLED", True)

        assert [user.token for user in users.list_server_test_user_tokens()] == [
            "dstack-test-admin-token",
            "dstack-test-manager-token",
            "dstack-test-user-token",
        ]


class TestEnsureServerTestUsers:
    @pytest.mark.asyncio
    async def test_creates_fixed_tokens_and_project_roles(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        created_users = {}
        ensured_roles = []
        project = Mock(spec=ProjectModel)
        session = Mock()

        async def get_user_model_by_name(session, username: str):
            return created_users.get(username)

        async def create_user(session, username: str, global_role: GlobalRole, token: str):
            user = Mock(spec=UserModel)
            user.name = username
            user.global_role = global_role
            user.token = DecryptedString(plaintext=token)
            created_users[username] = user
            return user

        async def ensure_project_member_role(session, project, user, project_role):
            ensured_roles.append((user.name, project_role))

        monkeypatch.setattr(users, "get_user_model_by_name", get_user_model_by_name)
        monkeypatch.setattr(users, "create_user", create_user)
        monkeypatch.setattr(users, "_ensure_project_member_role", ensure_project_member_role)

        created = await users.ensure_server_test_users(session=session, project=project)

        assert [user.username for user in created] == [
            "test-admin",
            "test-manager",
            "test-user",
        ]
        assert created_users["test-admin"].global_role == GlobalRole.ADMIN
        assert created_users["test-user"].global_role == GlobalRole.USER
        assert ensured_roles == [
            ("test-manager", ProjectRole.MANAGER),
            ("test-user", ProjectRole.USER),
        ]

    @pytest.mark.asyncio
    async def test_reconciles_existing_test_user_tokens(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        existing_user = Mock(spec=UserModel)
        existing_user.name = "test-user"
        existing_user.global_role = GlobalRole.ADMIN
        existing_user.active = False
        existing_user.token = DecryptedString(plaintext="old-token")
        session = Mock()
        session.commit = AsyncMock()

        async def get_user_model_by_name(session, username: str):
            if username == "test-user":
                return existing_user
            return None

        async def create_user(session, username: str, global_role: GlobalRole, token: str):
            user = Mock(spec=UserModel)
            user.name = username
            user.global_role = global_role
            return user

        monkeypatch.setattr(users, "get_user_model_by_name", get_user_model_by_name)
        monkeypatch.setattr(users, "create_user", create_user)
        monkeypatch.setattr(users, "_ensure_project_member_role", AsyncMock())

        await users.ensure_server_test_users(session=session, project=Mock(spec=ProjectModel))

        assert existing_user.global_role == GlobalRole.USER
        assert existing_user.active is True
        assert existing_user.token.get_plaintext_or_error() == "dstack-test-user-token"
        assert existing_user.token_hash == users.get_token_hash("dstack-test-user-token")

    @pytest.mark.asyncio
    async def test_deactivates_removed_project_admin_test_user(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        removed_user = Mock(spec=UserModel)
        removed_user.name = "test-project-admin"
        removed_user.active = True
        session = Mock()
        session.commit = AsyncMock()

        async def get_user_model_by_name(session, username: str):
            if username == "test-project-admin":
                return removed_user
            return None

        async def create_user(session, username: str, global_role: GlobalRole, token: str):
            user = Mock(spec=UserModel)
            user.name = username
            user.global_role = global_role
            return user

        monkeypatch.setattr(users, "get_user_model_by_name", get_user_model_by_name)
        monkeypatch.setattr(users, "create_user", create_user)
        monkeypatch.setattr(users, "_ensure_project_member_role", AsyncMock())

        await users.ensure_server_test_users(session=session, project=Mock(spec=ProjectModel))

        assert removed_user.active is False
        session.commit.assert_awaited_once()
