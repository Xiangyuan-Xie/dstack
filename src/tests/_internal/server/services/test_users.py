import pytest

from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server.models import DecryptedString, UserModel
from dstack._internal.server.schemas.users import UpdateMyUserRequest
from dstack._internal.server.services import users
from dstack._internal.server.services.users import is_valid_username


class TestIsValidUsername:
    @pytest.mark.parametrize(
        "username",
        [
            "special#$symbols",
            "A,B",
            "",
            "a" * 61,
        ],
    )
    def test_valid(self, username: str):
        assert not is_valid_username(username)

    @pytest.mark.parametrize(
        "username",
        [
            "regularusername",
            "CaseUsername",
            "username_with_underscores-and-dashes1234",
            "a" * 60,
        ],
    )
    def test_invalid(self, username: str):
        assert is_valid_username(username)


class TestUpdateMyUser:
    @pytest.mark.asyncio
    async def test_updates_only_current_user_email(self, mocker):
        class FakeSession:
            async def commit(self):
                pass

        user = UserModel(
            name="alice",
            global_role=GlobalRole.USER,
            token=DecryptedString(plaintext="token"),
            token_hash="token-hash",
            email=None,
            active=True,
        )
        mocker.patch("dstack._internal.server.services.events.emit")

        res = await users.update_my_user(
            session=FakeSession(), actor=user, email="alice@example.com"
        )

        assert res.name == "alice"
        assert res.email == "alice@example.com"
        assert res.global_role == GlobalRole.USER
        assert res.active is True

    def test_request_rejects_fields_other_than_email(self):
        with pytest.raises(ValueError):
            UpdateMyUserRequest(
                email="alice@example.com",
                username="admin",
                global_role=GlobalRole.ADMIN,
                active=False,
            )
