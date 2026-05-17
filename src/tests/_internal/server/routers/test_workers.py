import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.backends.base import BackendType
from dstack._internal.core.models.fleets import FleetStatus
from dstack._internal.core.models.instances import InstanceStatus
from dstack._internal.core.models.runs import JobStatus, JobTerminationReason
from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server.models import (
    FleetModel,
    InstanceModel,
    JobModel,
    WorkerRegistrationTokenModel,
)
from dstack._internal.server.testing.common import (
    create_fleet,
    create_job,
    create_project,
    create_repo,
    create_run,
    create_user,
    get_auth_headers,
)

pytestmark = pytest.mark.asyncio


class TestWorkerRegistrationTokens:
    async def test_global_admin_creates_registration_token(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        await create_fleet(session=session, project=project, name="lab-workers")

        response = await client.post(
            "/api/admin/worker_tokens/create",
            headers=get_auth_headers(admin.token),
            json={"fleet_name": "lab-workers"},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["fleet_name"] == "lab-workers"
        assert response_json["token"].startswith("dstack-worker-")

        token_model = (await session.execute(select(WorkerRegistrationTokenModel))).scalar_one()
        assert token_model.token_hash != response_json["token"]

    async def test_non_admin_cannot_create_registration_token(
        self, session: AsyncSession, client: AsyncClient
    ):
        user = await create_user(session, global_role=GlobalRole.USER)
        project = await create_project(session, name="main-project", owner=user)
        await create_fleet(session=session, project=project, name="lab-workers")

        response = await client.post(
            "/api/admin/worker_tokens/create",
            headers=get_auth_headers(user.token),
            json={"fleet_name": "lab-workers"},
        )

        assert response.status_code == 403


class TestRegisteredWorkers:
    async def test_worker_registers_as_fleet_instance(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        await create_fleet(session=session, project=project, name="lab-workers")
        token = (
            await client.post(
                "/api/admin/worker_tokens/create",
                headers=get_auth_headers(admin.token),
                json={"fleet_name": "lab-workers"},
            )
        ).json()["token"]

        response = await client.post(
            "/api/workers/register",
            headers=get_auth_headers(token),
            json={
                "worker_name": "gpu-box-1",
                "hostname": "gpu-box-1.local",
                "resources": {
                    "cpus": 32,
                    "memory_mib": 262144,
                    "disk_mib": 1048576,
                    "gpus": [{"name": "NVIDIA A100", "memory_mib": 81920}],
                },
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["fleet_name"] == "lab-workers"
        assert response_json["worker_name"] == "gpu-box-1"

        fleet = (await session.execute(select(FleetModel))).scalar_one()
        assert fleet.name == "lab-workers"
        assert fleet.status == FleetStatus.ACTIVE
        instance = (await session.execute(select(InstanceModel))).scalar_one()
        assert instance.name == "gpu-box-1"
        assert instance.backend == BackendType.REGISTERED
        assert instance.status == InstanceStatus.IDLE
        assert instance.total_blocks == 1

    async def test_worker_heartbeat_updates_instance_status(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        await create_fleet(session=session, project=project, name="lab-workers")
        token = (
            await client.post(
                "/api/admin/worker_tokens/create",
                headers=get_auth_headers(admin.token),
                json={"fleet_name": "lab-workers"},
            )
        ).json()["token"]
        register_response = await client.post(
            "/api/workers/register",
            headers=get_auth_headers(token),
            json={
                "worker_name": "gpu-box-1",
                "hostname": "gpu-box-1.local",
                "resources": {"cpus": 4, "memory_mib": 8192, "gpus": []},
            },
        )

        response = await client.post(
            "/api/workers/heartbeat",
            headers=get_auth_headers(token),
            json={
                "worker_id": register_response.json()["worker_id"],
                "status": "idle",
                "total_blocks": 2,
                "busy_blocks": 0,
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["status"] == "idle"
        instance = (await session.execute(select(InstanceModel))).scalar_one()
        assert instance.total_blocks == 2
        assert instance.busy_blocks == 0
        assert instance.unreachable is False

    async def test_worker_poll_returns_empty_assignments(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        await create_fleet(session=session, project=project, name="lab-workers")
        token = (
            await client.post(
                "/api/admin/worker_tokens/create",
                headers=get_auth_headers(admin.token),
                json={"fleet_name": "lab-workers"},
            )
        ).json()["token"]
        register_response = await client.post(
            "/api/workers/register",
            headers=get_auth_headers(token),
            json={
                "worker_name": "gpu-box-1",
                "hostname": "gpu-box-1.local",
                "resources": {"cpus": 4, "memory_mib": 8192, "gpus": []},
            },
        )

        response = await client.post(
            "/api/workers/poll",
            headers=get_auth_headers(token),
            json={"worker_id": register_response.json()["worker_id"]},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json == {"assignments": []}

    async def test_worker_poll_returns_submitted_registered_job(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        repo = await create_repo(session=session, project_id=project.id)
        run = await create_run(session=session, project=project, repo=repo, user=admin)
        await create_fleet(session=session, project=project, name="lab-workers")
        token = (
            await client.post(
                "/api/admin/worker_tokens/create",
                headers=get_auth_headers(admin.token),
                json={"fleet_name": "lab-workers"},
            )
        ).json()["token"]
        register_response = await client.post(
            "/api/workers/register",
            headers=get_auth_headers(token),
            json={
                "worker_name": "gpu-box-1",
                "hostname": "gpu-box-1.local",
                "resources": {"cpus": 4, "memory_mib": 8192, "gpus": []},
            },
        )
        instance = (await session.execute(select(InstanceModel))).scalar_one()
        job = await create_job(
            session=session,
            run=run,
            status=JobStatus.PROVISIONING,
            instance=instance,
            instance_assigned=True,
        )
        job.job_provisioning_data = instance.job_provisioning_data
        await session.commit()

        response = await client.post(
            "/api/workers/poll",
            headers=get_auth_headers(token),
            json={"worker_id": register_response.json()["worker_id"]},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["assignments"][0]["job_id"] == str(job.id)

    async def test_worker_report_updates_job_status(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        repo = await create_repo(session=session, project_id=project.id)
        run = await create_run(session=session, project=project, repo=repo, user=admin)
        await create_fleet(session=session, project=project, name="lab-workers")
        token = (
            await client.post(
                "/api/admin/worker_tokens/create",
                headers=get_auth_headers(admin.token),
                json={"fleet_name": "lab-workers"},
            )
        ).json()["token"]
        register_response = await client.post(
            "/api/workers/register",
            headers=get_auth_headers(token),
            json={
                "worker_name": "gpu-box-1",
                "hostname": "gpu-box-1.local",
                "resources": {"cpus": 4, "memory_mib": 8192, "gpus": []},
            },
        )
        instance = (await session.execute(select(InstanceModel))).scalar_one()
        job = await create_job(
            session=session,
            run=run,
            status=JobStatus.PROVISIONING,
            instance=instance,
            instance_assigned=True,
        )

        response = await client.post(
            "/api/workers/report",
            headers=get_auth_headers(token),
            json={
                "worker_id": register_response.json()["worker_id"],
                "job_id": str(job.id),
                "status": "done",
                "termination_reason": "done_by_runner",
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        updated_job = await session.get(JobModel, job.id)
        await session.refresh(updated_job)
        assert updated_job.status == JobStatus.TERMINATING
        assert updated_job.termination_reason == JobTerminationReason.DONE_BY_RUNNER
