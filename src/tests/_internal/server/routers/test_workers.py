import json

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.backends.base import BackendType
from dstack._internal.core.models.fleets import FleetStatus
from dstack._internal.core.models.instances import InstanceOfferWithAvailability, InstanceStatus
from dstack._internal.core.models.runs import JobStatus, JobTerminationReason
from dstack._internal.core.models.users import GlobalRole
from dstack._internal.server.models import (
    FleetModel,
    InstanceModel,
    JobModel,
    RegisteredWorkerGpuAllocationModel,
    RegisteredWorkerModel,
    WorkerRegistrationTokenModel,
)
from dstack._internal.server.services.users import get_token_hash
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

    async def test_creating_registration_token_replaces_pending_token_for_same_fleet(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="main-project", owner=admin)
        await create_fleet(session=session, project=project, name="lab-workers")

        first_response = await client.post(
            "/api/admin/worker_tokens/create",
            headers=get_auth_headers(admin.token),
            json={"fleet_name": "lab-workers"},
        )
        second_response = await client.post(
            "/api/admin/worker_tokens/create",
            headers=get_auth_headers(admin.token),
            json={"fleet_name": "lab-workers"},
        )

        first_json = first_response.json()
        second_json = second_response.json()
        assert first_response.status_code == 200, first_json
        assert second_response.status_code == 200, second_json
        assert first_json["id"] == second_json["id"]
        assert first_json["token"] != second_json["token"]

        token_models = (
            (await session.execute(select(WorkerRegistrationTokenModel))).scalars().all()
        )
        assert len(token_models) == 1
        assert str(token_models[0].id) == second_json["id"]
        assert token_models[0].enabled is True
        assert token_models[0].token_hash == get_token_hash(second_json["token"])
        assert token_models[0].token_hash != get_token_hash(first_json["token"])

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
        offer = InstanceOfferWithAvailability.__response__.parse_raw(instance.offer)
        assert [gpu.name for gpu in offer.instance.resources.gpus] == ["NVIDIA A100"]
        assert [gpu.memory_mib for gpu in offer.instance.resources.gpus] == [81920]

    async def test_worker_registers_gpu_uuids_for_single_card_assignment(
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
                    "memory_mib": 65536,
                    "gpus": [
                        {
                            "uuid": "GPU-111",
                            "index": 0,
                            "name": "NVIDIA RTX 4090 D",
                            "memory_mib": 24564,
                        },
                        {
                            "uuid": "GPU-222",
                            "index": 1,
                            "name": "NVIDIA RTX 4090 D",
                            "memory_mib": 24564,
                        },
                    ],
                },
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        worker = (await session.execute(select(RegisteredWorkerModel))).scalar_one()
        assert json.loads(worker.gpus) == [
            {
                "uuid": "GPU-111",
                "index": 0,
                "name": "RTX4090D",
                "memory_mib": 24564,
                "vendor": "nvidia",
            },
            {
                "uuid": "GPU-222",
                "index": 1,
                "name": "RTX4090D",
                "memory_mib": 24564,
                "vendor": "nvidia",
            },
        ]

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

    async def test_worker_heartbeat_saves_interval_and_usage(
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
        usage = {
            "cpu_percent": 12.5,
            "memory_used_gib": 4,
            "memory_total_gib": 8,
            "disk_used_gib": 1,
            "disk_total_gib": 2,
            "gpu_memory_used_gib": 0.5,
            "gpu_memory_total_gib": 4,
            "gpu_util_percent": 33,
            "updated_at": "2026-05-18T12:40:00+00:00",
        }

        response = await client.post(
            "/api/workers/heartbeat",
            headers=get_auth_headers(token),
            json={
                "worker_id": register_response.json()["worker_id"],
                "status": "idle",
                "interval_seconds": 15,
                "usage": usage,
            },
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        worker = (await session.execute(select(RegisteredWorkerModel))).scalar_one()
        assert worker.heartbeat_interval_seconds == 15
        assert json.loads(worker.latest_usage) == usage

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

    async def test_worker_poll_returns_container_assignment_with_reserved_gpu(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
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
                "resources": {
                    "cpus": 8,
                    "memory_mib": 32768,
                    "gpus": [
                        {
                            "uuid": "GPU-111",
                            "index": 0,
                            "name": "NVIDIA RTX 4090 D",
                            "memory_mib": 24564,
                        }
                    ],
                },
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
        session.add(
            RegisteredWorkerGpuAllocationModel(
                worker_id=register_response.json()["worker_id"],
                instance_id=instance.id,
                job_id=job.id,
                gpu_uuid="GPU-111",
            )
        )
        await session.commit()

        response = await client.post(
            "/api/workers/poll",
            headers=get_auth_headers(token),
            json={"worker_id": register_response.json()["worker_id"]},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assignment = response_json["assignments"][0]
        assert assignment["job_id"] == str(job.id)
        assert assignment["run_name"] == "test-run"
        assert assignment["image"]
        assert assignment["gpu_uuids"] == ["GPU-111"]
        assert assignment["cpu"] is not None
        assert assignment["memory_gib"] is not None
        assert assignment["username"] == "admin"
        assert assignment["workspace_mount_path"] == "/workspace"

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

    async def test_worker_report_releases_gpu_allocation(
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
                "resources": {
                    "cpus": 4,
                    "memory_mib": 8192,
                    "gpus": [
                        {
                            "uuid": "GPU-111",
                            "index": 0,
                            "name": "NVIDIA RTX 4090 D",
                            "memory_mib": 24564,
                        }
                    ],
                },
            },
        )
        instance = (await session.execute(select(InstanceModel))).scalar_one()
        job = await create_job(
            session=session,
            run=run,
            status=JobStatus.RUNNING,
            instance=instance,
            instance_assigned=True,
        )
        allocation = RegisteredWorkerGpuAllocationModel(
            worker_id=register_response.json()["worker_id"],
            instance_id=instance.id,
            job_id=job.id,
            gpu_uuid="GPU-111",
        )
        session.add(allocation)
        await session.commit()

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
        await session.refresh(allocation)
        assert allocation.released_at is not None
