import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.instances import InstanceStatus
from dstack._internal.core.models.users import GlobalRole, ProjectRole
from dstack._internal.server.models import MemberModel
from dstack._internal.server.testing.common import (
    create_fleet,
    create_instance,
    create_job,
    create_project,
    create_repo,
    create_run,
    create_user,
    get_auth_headers,
)

pytestmark = pytest.mark.asyncio


class TestResourcePoolAssignments:
    async def test_global_admin_assigns_whole_pool_to_project(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        pool = await create_fleet(session=session, project=project, name="lab-pool")
        await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-1",
            status=InstanceStatus.IDLE,
        )

        response = await client.post(
            "/api/resource_pools/assignments/update",
            headers=get_auth_headers(admin.token),
            json={
                "resource_pool_name": "lab-pool",
                "project_name": "research",
                "assign_whole_pool": True,
                "instance_ids": [],
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["name"] == "lab-pool"
        assert response_json["assignments"][0]["project_name"] == "research"
        assert response_json["assignments"][0]["whole_pool"] is True
        assert response_json["instances"][0]["authorized_projects"] == ["research"]
        assert response_json["instances"][0]["occupancy"]["status"] == "idle"

    async def test_global_admin_assigns_selected_instances_to_project(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        pool = await create_fleet(session=session, project=project, name="lab-pool")
        instance_a = await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-1",
            status=InstanceStatus.IDLE,
        )
        await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-2",
            instance_num=1,
            status=InstanceStatus.IDLE,
        )

        response = await client.post(
            "/api/resource_pools/assignments/update",
            headers=get_auth_headers(admin.token),
            json={
                "resource_pool_name": "lab-pool",
                "project_name": "research",
                "assign_whole_pool": False,
                "instance_ids": [str(instance_a.id)],
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        authorized_by_instance = {
            instance["name"]: instance["authorized_projects"]
            for instance in response_json["instances"]
        }
        assert authorized_by_instance == {
            "gpu-box-1": ["research"],
            "gpu-box-2": [],
        }

    async def test_non_admin_cannot_update_resource_pool_assignments(
        self, session: AsyncSession, client: AsyncClient
    ):
        user = await create_user(session, name="user", global_role=GlobalRole.USER)
        project = await create_project(session, name="research", owner=user)
        await create_fleet(session=session, project=project, name="lab-pool")

        response = await client.post(
            "/api/resource_pools/assignments/update",
            headers=get_auth_headers(user.token),
            json={
                "resource_pool_name": "lab-pool",
                "project_name": "research",
                "assign_whole_pool": True,
                "instance_ids": [],
            },
        )

        assert response.status_code == 403

    async def test_project_resource_pool_list_only_returns_authorized_pools(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        user = await create_user(session, name="user", global_role=GlobalRole.USER)
        project = await create_project(session, name="research", owner=user)
        session.add(MemberModel(project=project, user=user, project_role=ProjectRole.USER))
        await session.commit()
        visible_pool = await create_fleet(
            session=session,
            project=project,
            name="visible-pool",
            assign_to_project=False,
        )
        await create_fleet(
            session=session,
            project=project,
            name="hidden-pool",
            assign_to_project=False,
        )
        await client.post(
            "/api/resource_pools/assignments/update",
            headers=get_auth_headers(admin.token),
            json={
                "resource_pool_name": visible_pool.name,
                "project_name": project.name,
                "assign_whole_pool": True,
                "instance_ids": [],
            },
        )

        response = await client.post(
            f"/api/project/{project.name}/resource_pools/list",
            headers=get_auth_headers(user.token),
            json={},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert [pool["name"] for pool in response_json] == ["visible-pool"]

    async def test_resource_pool_detail_reports_running_project_occupancy(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        repo = await create_repo(session=session, project_id=project.id)
        run = await create_run(session=session, project=project, repo=repo, user=admin)
        pool = await create_fleet(session=session, project=project, name="lab-pool")
        instance = await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-1",
            status=InstanceStatus.BUSY,
            busy_blocks=1,
        )
        await create_job(session=session, run=run, fleet=pool, instance=instance)

        response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "lab-pool"},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["instances"][0]["occupancy"] == {
            "status": "busy",
            "project_names": ["research"],
            "task_count": 1,
        }
