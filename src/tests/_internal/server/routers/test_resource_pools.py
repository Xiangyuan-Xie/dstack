import json

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.instances import Gpu, InstanceStatus
from dstack._internal.core.models.runs import JobStatus
from dstack._internal.core.models.users import GlobalRole, ProjectRole
from dstack._internal.server.models import (
    MemberModel,
    ProjectModel,
    RegisteredWorkerGpuAllocationModel,
    RegisteredWorkerModel,
    WorkerRegistrationTokenModel,
)
from dstack._internal.server.testing.common import (
    create_fleet,
    create_instance,
    create_job,
    create_project,
    create_repo,
    create_run,
    create_user,
    get_auth_headers,
    get_fleet_spec,
    get_instance_offer_with_availability,
)

pytestmark = pytest.mark.asyncio


class TestResourcePoolManagement:
    async def test_global_admin_creates_resource_pool_without_creating_project(
        self, session: AsyncSession, client: AsyncClient, monkeypatch: pytest.MonkeyPatch
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        spec = get_fleet_spec()
        spec.configuration.name = "lab-pool"

        response = await client.post(
            "/api/resource_pools/create",
            headers=get_auth_headers(admin.token),
            json={"plan": {"spec": spec.dict()}, "force": False},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["name"] == "lab-pool"
        projects = (await session.execute(select(ProjectModel))).scalars().all()
        assert projects == []

    async def test_global_admin_deletes_resource_pool_without_project(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        spec = get_fleet_spec()
        spec.configuration.name = "lab-pool"
        create_response = await client.post(
            "/api/resource_pools/create",
            headers=get_auth_headers(admin.token),
            json={"plan": {"spec": spec.dict()}, "force": False},
        )
        assert create_response.status_code == 200, create_response.json()

        response = await client.post(
            "/api/resource_pools/delete",
            headers=get_auth_headers(admin.token),
            json={"names": ["lab-pool"]},
        )

        assert response.status_code == 200, response.json()
        get_response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "lab-pool"},
        )
        assert get_response.status_code == 400

    async def test_global_admin_renames_resource_pool(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        pool = await create_fleet(session=session, project=project, name="old-pool")
        await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-1",
            status=InstanceStatus.IDLE,
        )

        response = await client.post(
            "/api/resource_pools/update",
            headers=get_auth_headers(admin.token),
            json={"resource_pool_name": "old-pool", "new_resource_pool_name": "new-pool"},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["name"] == "new-pool"
        assert response_json["instances"][0]["name"] == "gpu-box-1"

        old_response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "old-pool"},
        )
        new_response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "new-pool"},
        )

        assert old_response.status_code == 400
        assert new_response.status_code == 200, new_response.json()

    async def test_rename_resource_pool_rejects_existing_name(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        await create_fleet(session=session, project=project, name="old-pool")
        await create_fleet(session=session, project=project, name="existing-pool")

        response = await client.post(
            "/api/resource_pools/update",
            headers=get_auth_headers(admin.token),
            json={"resource_pool_name": "old-pool", "new_resource_pool_name": "existing-pool"},
        )

        assert response.status_code == 400


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

    async def test_resource_pool_detail_reports_instance_resource_summary(
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
            offer=get_instance_offer_with_availability(
                gpu_count=2,
                gpu_name="A100",
                gpu_memory_gib=40,
                cpu_count=16,
                memory_gib=128,
                disk_gib=500,
            ),
        )
        await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-2",
            instance_num=1,
            offer=get_instance_offer_with_availability(
                gpu_count=1,
                gpu_name="L40S",
                gpu_memory_gib=48,
                cpu_count=8,
                memory_gib=64,
                disk_gib=250,
            ),
        )

        response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "lab-pool"},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["resource_summary"] == {
            "instance_count": 2,
            "cpu_count": 24,
            "memory_gib": 192,
            "disk_gib": 750,
            "gpu_count": 3,
            "gpus": [
                {"name": "A100", "count": 2, "memory_gib": 40},
                {"name": "L40S", "count": 1, "memory_gib": 48},
            ],
        }
        assert response_json["instances"][0]["resources"] == {
            "cpu_count": 16,
            "memory_gib": 128,
            "disk_gib": 500,
            "gpu_count": 2,
            "gpus": [{"name": "A100", "count": 2, "memory_gib": 40}],
            "gpu_devices": [
                {
                    "uuid": None,
                    "index": None,
                    "name": "A100",
                    "memory_gib": 40,
                    "occupied": False,
                    "project_name": None,
                    "run_name": None,
                    "job_id": None,
                },
                {
                    "uuid": None,
                    "index": None,
                    "name": "A100",
                    "memory_gib": 40,
                    "occupied": False,
                    "project_name": None,
                    "run_name": None,
                    "job_id": None,
                },
            ],
        }

    async def test_resource_pool_detail_reports_per_gpu_occupancy(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        repo = await create_repo(session=session, project_id=project.id)
        run = await create_run(session=session, project=project, repo=repo, user=admin)
        pool = await create_fleet(session=session, project=project, name="lab-pool")
        offer = get_instance_offer_with_availability(
            gpu_count=0,
            cpu_count=16,
            memory_gib=128,
            disk_gib=500,
        )
        offer.instance.resources.gpus = [
            Gpu(uuid="GPU-111", index=0, name="RTX4090D", memory_mib=24564),
            Gpu(uuid="GPU-222", index=1, name="RTX4090D", memory_mib=24564),
        ]
        instance = await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-1",
            offer=offer,
        )
        token = WorkerRegistrationTokenModel(
            created_by=admin,
            fleet_name=pool.name,
            token_hash="worker-token-hash",
            enabled=True,
        )
        session.add(token)
        await session.flush()
        worker = RegisteredWorkerModel(
            registration_token=token,
            fleet=pool,
            instance=instance,
            name="gpu-box-1",
            gpus=json.dumps(
                [
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
            ),
        )
        session.add(worker)
        job = await create_job(
            session=session,
            run=run,
            status=JobStatus.RUNNING,
            fleet=pool,
            instance=instance,
            instance_assigned=True,
        )
        session.add(
            RegisteredWorkerGpuAllocationModel(
                worker=worker,
                instance=instance,
                job=job,
                gpu_uuid="GPU-111",
            )
        )
        await session.commit()

        response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "lab-pool"},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["instances"][0]["resources"]["gpu_devices"] == [
            {
                "uuid": "GPU-111",
                "index": 0,
                "name": "RTX4090D",
                "memory_gib": 23.99,
                "occupied": True,
                "project_name": "research",
                "run_name": "test-run",
                "job_id": str(job.id),
            },
            {
                "uuid": "GPU-222",
                "index": 1,
                "name": "RTX4090D",
                "memory_gib": 23.99,
                "occupied": False,
                "project_name": None,
                "run_name": None,
                "job_id": None,
            },
        ]

    async def test_resource_pool_list_and_detail_report_same_resource_summary(
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
            offer=get_instance_offer_with_availability(
                gpu_count=2,
                gpu_name="A100",
                gpu_memory_gib=40,
                cpu_count=16,
                memory_gib=128,
                disk_gib=500,
            ),
        )

        list_response = await client.post(
            "/api/resource_pools/list",
            headers=get_auth_headers(admin.token),
            json={"only_active": False, "limit": 100},
        )
        detail_response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "lab-pool"},
        )

        list_json = list_response.json()
        detail_json = detail_response.json()
        assert list_response.status_code == 200, list_json
        assert detail_response.status_code == 200, detail_json
        listed_pool = next(pool for pool in list_json if pool["name"] == "lab-pool")
        assert listed_pool["resource_summary"] == detail_json["resource_summary"]

    async def test_resource_pool_reports_registered_worker_usage(
        self, session: AsyncSession, client: AsyncClient
    ):
        admin = await create_user(session, name="admin", global_role=GlobalRole.ADMIN)
        project = await create_project(session, name="research", owner=admin)
        pool = await create_fleet(session=session, project=project, name="lab-pool")
        instance = await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-1",
            offer=get_instance_offer_with_availability(
                gpu_count=1,
                gpu_name="A100",
                gpu_memory_gib=40,
                cpu_count=16,
                memory_gib=128,
                disk_gib=500,
            ),
        )
        token = WorkerRegistrationTokenModel(
            created_by=admin,
            fleet_name=pool.name,
            token_hash="worker-token-hash",
            enabled=True,
        )
        session.add(token)
        await session.flush()
        session.add(
            RegisteredWorkerModel(
                registration_token=token,
                fleet=pool,
                instance=instance,
                name="gpu-box-1",
                latest_usage=json.dumps(
                    {
                        "cpu_percent": 25,
                        "memory_used_gib": 32,
                        "memory_total_gib": 128,
                        "disk_used_gib": 120,
                        "disk_total_gib": 500,
                        "gpu_memory_used_gib": 8,
                        "gpu_memory_total_gib": 40,
                        "gpu_util_percent": 60,
                        "updated_at": "2026-05-18T12:40:00",
                    }
                ),
            )
        )
        await session.commit()

        response = await client.post(
            "/api/resource_pools/get",
            headers=get_auth_headers(admin.token),
            json={"name": "lab-pool"},
        )

        response_json = response.json()
        assert response.status_code == 200, response_json
        assert response_json["instances"][0]["usage"]["cpu_percent"] == 25
        assert response_json["instances"][0]["usage"]["gpu_util_percent"] == 60
        assert response_json["usage_summary"] == {
            "cpu_percent": 25,
            "memory_used_gib": 32,
            "memory_total_gib": 128,
            "disk_used_gib": 120,
            "disk_total_gib": 500,
            "gpu_memory_used_gib": 8,
            "gpu_memory_total_gib": 40,
            "gpu_util_percent": 60,
            "updated_at": "2026-05-18T12:40:00",
            "instance_count": 1,
            "reporting_instance_count": 1,
        }
