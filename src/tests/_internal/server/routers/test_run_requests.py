from datetime import datetime, timezone
from unittest.mock import patch
from uuid import UUID

import pytest
from freezegun import freeze_time
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.users import GlobalRole, ProjectRole
from dstack._internal.server.models import RunModel
from dstack._internal.server.services.projects import add_project_member
from dstack._internal.server.testing.common import (
    create_project,
    create_user,
    get_auth_headers,
)

pytestmark = pytest.mark.usefixtures("image_config_mock")


def _request_body(name: str = "train-job") -> dict:
    return {
        "request": {
            "name": name,
            "image": "ubuntu:22.04",
            "commands": ["echo hello"],
            "env": {"MODEL": "qwen"},
            "ports": [8888],
            "nodes": 1,
            "resources": {
                "cpu": "4",
                "memory": "16GB",
                "gpu": "A100:1",
                "disk": "200GB",
            },
            "max_duration": "2h",
        }
    }


async def _create_project_with_users(session: AsyncSession):
    owner = await create_user(session=session, name="owner", global_role=GlobalRole.USER)
    applicant = await create_user(
        session=session,
        name="applicant",
        global_role=GlobalRole.USER,
        ssh_public_key="ssh-ed25519 applicant",
    )
    manager = await create_user(
        session=session,
        name="manager",
        global_role=GlobalRole.USER,
        ssh_public_key="ssh-ed25519 manager",
    )
    member = await create_user(session=session, name="member", global_role=GlobalRole.USER)
    outsider = await create_user(session=session, name="outsider", global_role=GlobalRole.USER)
    project = await create_project(session=session, owner=owner, name="main")
    await add_project_member(
        session=session, project=project, user=owner, project_role=ProjectRole.ADMIN
    )
    await add_project_member(
        session=session, project=project, user=applicant, project_role=ProjectRole.USER
    )
    await add_project_member(
        session=session, project=project, user=manager, project_role=ProjectRole.MANAGER
    )
    await add_project_member(
        session=session, project=project, user=member, project_role=ProjectRole.USER
    )
    return project, applicant, manager, member, outsider


async def _create_run_request(
    client: AsyncClient,
    project_name: str,
    user,
    name: str,
) -> dict:
    response = await client.post(
        f"/api/project/{project_name}/run_requests/create",
        headers=get_auth_headers(user.token),
        json=_request_body(name),
    )
    assert response.status_code == 200, response.json()
    return response.json()


class TestRunRequests:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_member_can_create_and_list_own_requests(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, *_ = await _create_project_with_users(session)

        with freeze_time(datetime(2026, 5, 15, 10, 0, tzinfo=timezone.utc)):
            response = await client.post(
                f"/api/project/{project.name}/run_requests/create",
                headers=get_auth_headers(applicant.token),
                json=_request_body(),
            )

        assert response.status_code == 200, response.json()
        created = response.json()
        assert created["status"] == "pending"
        assert created["project_name"] == project.name
        assert created["applicant"] == applicant.name
        assert created["request"]["image"] == "ubuntu:22.04"
        assert created["run_id"] is None

        member_list = await client.post(
            f"/api/project/{project.name}/run_requests/list",
            headers=get_auth_headers(applicant.token),
            json={},
        )
        assert member_list.status_code == 200, member_list.json()
        assert [item["id"] for item in member_list.json()] == [created["id"]]

        manager_list = await client.post(
            f"/api/project/{project.name}/run_requests/list",
            headers=get_auth_headers(manager.token),
            json={},
        )
        assert manager_list.status_code == 200, manager_list.json()
        assert [item["id"] for item in manager_list.json()] == [created["id"]]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_member_include_all_still_lists_only_own_requests(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, _, member, _ = await _create_project_with_users(session)
        applicant_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body("applicant-job"),
        )
        assert applicant_response.status_code == 200, applicant_response.json()
        member_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(member.token),
            json=_request_body("member-job"),
        )
        assert member_response.status_code == 200, member_response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/list",
            headers=get_auth_headers(member.token),
            json={"include_all": True},
        )

        assert response.status_code == 200, response.json()
        assert [item["id"] for item in response.json()] == [member_response.json()["id"]]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_global_list_regular_user_sees_own_requests_across_projects(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, _, member, _ = await _create_project_with_users(session)
        other_project = await create_project(session=session, owner=applicant, name="secondary")
        await add_project_member(
            session=session,
            project=other_project,
            user=applicant,
            project_role=ProjectRole.ADMIN,
        )
        await add_project_member(
            session=session, project=other_project, user=member, project_role=ProjectRole.USER
        )
        with freeze_time(datetime(2026, 5, 15, 10, 0, tzinfo=timezone.utc)):
            own_main = await _create_run_request(client, project.name, applicant, "own-main")
        with freeze_time(datetime(2026, 5, 15, 10, 1, tzinfo=timezone.utc)):
            own_secondary = await _create_run_request(
                client, other_project.name, applicant, "own-secondary"
            )
        with freeze_time(datetime(2026, 5, 15, 10, 2, tzinfo=timezone.utc)):
            await _create_run_request(client, project.name, member, "member-main")

        response = await client.post(
            "/api/run_requests/list",
            headers=get_auth_headers(applicant.token),
            json={"include_all": True},
        )

        assert response.status_code == 200, response.json()
        assert [item["id"] for item in response.json()] == [
            own_secondary["id"],
            own_main["id"],
        ]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_global_list_project_manager_sees_managed_projects(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, member, _ = await _create_project_with_users(session)
        managed_project = await create_project(session=session, owner=member, name="managed")
        await add_project_member(
            session=session, project=managed_project, user=member, project_role=ProjectRole.ADMIN
        )
        await add_project_member(
            session=session, project=managed_project, user=manager, project_role=ProjectRole.ADMIN
        )
        unmanaged_project = await create_project(
            session=session, owner=applicant, name="unmanaged"
        )
        await add_project_member(
            session=session,
            project=unmanaged_project,
            user=applicant,
            project_role=ProjectRole.ADMIN,
        )
        with freeze_time(datetime(2026, 5, 15, 10, 0, tzinfo=timezone.utc)):
            main_request = await _create_run_request(client, project.name, applicant, "main")
        with freeze_time(datetime(2026, 5, 15, 10, 1, tzinfo=timezone.utc)):
            managed_request = await _create_run_request(
                client, managed_project.name, member, "managed"
            )
        with freeze_time(datetime(2026, 5, 15, 10, 2, tzinfo=timezone.utc)):
            await _create_run_request(client, unmanaged_project.name, applicant, "unmanaged")

        response = await client.post(
            "/api/run_requests/list",
            headers=get_auth_headers(manager.token),
            json={"include_all": True},
        )

        assert response.status_code == 200, response.json()
        assert [item["id"] for item in response.json()] == [
            managed_request["id"],
            main_request["id"],
        ]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_global_list_admin_sees_all_projects_and_status_filter(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, _, member, _ = await _create_project_with_users(session)
        second_project = await create_project(session=session, owner=member, name="global-second")
        await add_project_member(
            session=session, project=second_project, user=member, project_role=ProjectRole.ADMIN
        )
        global_admin = await create_user(
            session=session,
            name="global-list-admin",
            global_role=GlobalRole.ADMIN,
            ssh_public_key="ssh-ed25519 global-list-admin",
        )
        with freeze_time(datetime(2026, 5, 15, 10, 0, tzinfo=timezone.utc)):
            first = await _create_run_request(client, project.name, applicant, "first")
        with freeze_time(datetime(2026, 5, 15, 10, 1, tzinfo=timezone.utc)):
            second = await _create_run_request(client, second_project.name, member, "second")
        reject = await client.post(
            f"/api/project/{project.name}/run_requests/reject",
            headers=get_auth_headers(global_admin.token),
            json={"id": first["id"], "reason": "not now"},
        )
        assert reject.status_code == 200, reject.json()

        response = await client.post(
            "/api/run_requests/list",
            headers=get_auth_headers(global_admin.token),
            json={"status": "pending", "limit": 1},
        )

        assert response.status_code == 200, response.json()
        assert [item["id"] for item in response.json()] == [second["id"]]

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_non_member_cannot_access_project_requests(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, _, _, outsider = await _create_project_with_users(session)
        response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert response.status_code == 200, response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/list",
            headers=get_auth_headers(outsider.token),
            json={},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_regular_member_cannot_approve(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, _, member, _ = await _create_project_with_users(session)
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/approve",
            headers=get_auth_headers(member.token),
            json={"id": create_response.json()["id"]},
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_manager_approve_creates_applicant_owned_task_run(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, *_ = await _create_project_with_users(session)
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/approve",
            headers=get_auth_headers(manager.token),
            json={"id": create_response.json()["id"]},
        )

        assert response.status_code == 200, response.json()
        approved = response.json()
        assert approved["status"] == "approved"
        assert approved["reviewed_by"] == manager.name
        assert approved["run_id"] is not None
        assert approved["run_name"] == "train-job"

        run_model = await session.get(RunModel, UUID(approved["run_id"]))
        assert run_model is not None
        assert run_model.user_id == applicant.id
        assert run_model.run_name == "train-job"
        assert '"type":"task"' in run_model.run_spec

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_global_admin_can_approve_any_project_request(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, *_ = await _create_project_with_users(session)
        global_admin = await create_user(
            session=session,
            name="global-admin",
            global_role=GlobalRole.ADMIN,
            ssh_public_key="ssh-ed25519 global-admin",
        )
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/approve",
            headers=get_auth_headers(global_admin.token),
            json={"id": create_response.json()["id"]},
        )

        assert response.status_code == 200, response.json()
        approved = response.json()
        assert approved["status"] == "approved"
        assert approved["reviewed_by"] == global_admin.name
        assert approved["run_id"] is not None
        run_model = await session.get(RunModel, UUID(approved["run_id"]))
        assert run_model is not None
        assert run_model.user_id == applicant.id

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_cannot_approve_processed_request_twice(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, *_ = await _create_project_with_users(session)
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()
        first = await client.post(
            f"/api/project/{project.name}/run_requests/approve",
            headers=get_auth_headers(manager.token),
            json={"id": create_response.json()["id"]},
        )
        assert first.status_code == 200, first.json()

        second = await client.post(
            f"/api/project/{project.name}/run_requests/approve",
            headers=get_auth_headers(manager.token),
            json={"id": create_response.json()["id"]},
        )

        assert second.status_code == 400

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_manager_can_reject_with_reason(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, *_ = await _create_project_with_users(session)
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/reject",
            headers=get_auth_headers(manager.token),
            json={"id": create_response.json()["id"], "reason": "Need more detail"},
        )

        assert response.status_code == 200, response.json()
        rejected = response.json()
        assert rejected["status"] == "rejected"
        assert rejected["reviewed_by"] == manager.name
        assert rejected["review_message"] == "Need more detail"

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_reject_requires_reason(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, *_ = await _create_project_with_users(session)
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()

        response = await client.post(
            f"/api/project/{project.name}/run_requests/reject",
            headers=get_auth_headers(manager.token),
            json={"id": create_response.json()["id"], "reason": ""},
        )

        assert response.status_code == 422

    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_failed_request_can_be_retried(
        self, test_db, session: AsyncSession, client: AsyncClient
    ):
        project, applicant, manager, *_ = await _create_project_with_users(session)
        create_response = await client.post(
            f"/api/project/{project.name}/run_requests/create",
            headers=get_auth_headers(applicant.token),
            json=_request_body(),
        )
        assert create_response.status_code == 200, create_response.json()

        with patch(
            "dstack._internal.server.services.run_requests.runs_services.apply_plan",
            side_effect=RuntimeError("boom"),
        ):
            failed = await client.post(
                f"/api/project/{project.name}/run_requests/approve",
                headers=get_auth_headers(manager.token),
                json={"id": create_response.json()["id"]},
            )
            assert failed.status_code == 200, failed.json()
            assert failed.json()["status"] == "failed"
            assert failed.json()["review_message"] == "boom"

        retry = await client.post(
            f"/api/project/{project.name}/run_requests/retry",
            headers=get_auth_headers(manager.token),
            json={"id": create_response.json()["id"]},
        )

        assert retry.status_code == 200, retry.json()
        assert retry.json()["status"] == "approved"
        assert retry.json()["run_id"] is not None
        run_id = retry.json()["run_id"]
        run_model = await session.get(RunModel, UUID(run_id))
        assert run_model is not None
        assert run_model.user_id == applicant.id
