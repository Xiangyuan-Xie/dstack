import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server.testing.common import create_user, get_auth_headers

pytestmark = pytest.mark.asyncio


class TestRuntimeImages:
    async def test_lists_default_runtime_images_when_not_configured(
        self, session: AsyncSession, client: AsyncClient
    ):
        user = await create_user(session, name="user", global_role=GlobalRole.USER)

        response = await client.post(
            "/api/runtime_images/list",
            headers=get_auth_headers(user.token),
            json={},
        )

        assert response.status_code == 200, response.json()
        images = response.json()
        assert any(image["category"] == "PyTorch" for image in images)
        assert any(image["category"] == "CUDA" and "devel" in image["tags"] for image in images)
        isaac_sim_images = [image for image in images if image["category"] == "Isaac Sim"]
        assert len(isaac_sim_images) >= 3

    async def test_regular_user_can_list_runtime_images(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        user = await create_user(session, name="user", global_role=GlobalRole.USER)
        update_response = await client.post(
            "/api/admin/runtime_images/update",
            headers=get_auth_headers(admin.token),
            json={
                "images": [
                    {
                        "name": "PyTorch CUDA",
                        "image": "pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime",
                    },
                    {
                        "name": "Jupyter CUDA",
                        "image": "quay.io/jupyter/pytorch-notebook:cuda12-python-3.11",
                    },
                ]
            },
        )
        assert update_response.status_code == 200, update_response.json()

        response = await client.post(
            "/api/runtime_images/list",
            headers=get_auth_headers(user.token),
            json={},
        )

        assert response.status_code == 200, response.json()
        assert response.json() == [
            {
                "name": "PyTorch CUDA",
                "image": "pytorch/pytorch:2.5.1-cuda12.4-cudnn9-runtime",
                "category": None,
                "description": None,
                "tags": [],
                "recommended_env": {},
            },
            {
                "name": "Jupyter CUDA",
                "image": "quay.io/jupyter/pytorch-notebook:cuda12-python-3.11",
                "category": None,
                "description": None,
                "tags": [],
                "recommended_env": {},
            },
        ]

    async def test_regular_user_cannot_update_runtime_images(
        self, session: AsyncSession, client: AsyncClient
    ):
        user = await create_user(session, name="user", global_role=GlobalRole.USER)

        response = await client.post(
            "/api/admin/runtime_images/update",
            headers=get_auth_headers(user.token),
            json={"images": [{"name": "PyTorch", "image": "pytorch/pytorch:latest"}]},
        )

        assert response.status_code == 403

    async def test_global_admin_replaces_runtime_images(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)

        first = await client.post(
            "/api/admin/runtime_images/update",
            headers=get_auth_headers(admin.token),
            json={"images": [{"name": "Old", "image": "old/image:latest"}]},
        )
        assert first.status_code == 200, first.json()
        second = await client.post(
            "/api/admin/runtime_images/update",
            headers=get_auth_headers(admin.token),
            json={"images": [{"name": "New", "image": "new/image:latest"}]},
        )

        assert second.status_code == 200, second.json()
        assert second.json() == [
            {
                "name": "New",
                "image": "new/image:latest",
                "category": None,
                "description": None,
                "tags": [],
                "recommended_env": {},
            }
        ]

    async def test_rejects_duplicate_runtime_image_names(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)

        response = await client.post(
            "/api/admin/runtime_images/update",
            headers=get_auth_headers(admin.token),
            json={
                "images": [
                    {"name": "PyTorch", "image": "pytorch/pytorch:latest"},
                    {"name": "PyTorch", "image": "pytorch/pytorch:2.5.1"},
                ]
            },
        )

        assert response.status_code == 400
