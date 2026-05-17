import copy
from unittest.mock import AsyncMock

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from dstack._internal.core.models.configurations import TaskConfiguration
from dstack._internal.core.models.fleets import FleetNodesSpec, InstanceGroupPlacement
from dstack._internal.core.models.instances import InstanceAvailability
from dstack._internal.core.models.profiles import Profile
from dstack._internal.server.models import (
    ProjectResourceInstanceAssignmentModel,
    ProjectResourcePoolAssignmentModel,
)
from dstack._internal.server.services.jobs import get_jobs_from_run_spec
from dstack._internal.server.services.runs.plan import (
    _freeze_offer_identity_value,
    _get_backend_offer_identity,
    _get_backend_offers_in_fleet,
    get_run_candidate_fleet_models_filters,
    select_run_candidate_fleet_models_with_filters,
)
from dstack._internal.server.testing.common import (
    create_fleet,
    create_instance,
    create_project,
    create_repo,
    create_user,
    get_fleet_spec,
    get_instance_offer_with_availability,
    get_job_provisioning_data,
    get_run_spec,
)

pytestmark = pytest.mark.usefixtures("image_config_mock")


class TestFreezeOfferIdentityValue:
    def test_normalizes_nested_mappings_and_sets(self) -> None:
        first = {
            "b": [1, {"y": InstanceAvailability.IDLE, "x": {3, 2}}],
            "a": ("z", None),
        }
        second = {
            "a": ("z", None),
            "b": [1, {"x": {2, 3}, "y": InstanceAvailability.IDLE}],
        }

        frozen_first = _freeze_offer_identity_value(first)
        frozen_second = _freeze_offer_identity_value(second)

        assert frozen_first == frozen_second
        assert hash(frozen_first) == hash(frozen_second)

    def test_get_backend_offer_identity_uses_full_offer_payload(self) -> None:
        offer = get_instance_offer_with_availability(availability=InstanceAvailability.UNKNOWN)
        offer.backend_data = {
            "region_hint": {"b": 2, "a": 1},
            "azs": ["us-east-1b", "us-east-1a"],
        }
        same_offer = copy.deepcopy(offer)
        same_offer.backend_data = {
            "azs": ["us-east-1b", "us-east-1a"],
            "region_hint": {"a": 1, "b": 2},
        }
        different_offer = copy.deepcopy(offer)
        different_offer.backend_data = {
            "azs": ["us-east-1b", "us-east-1a"],
            "region_hint": {"a": 3, "b": 2},
        }

        assert _get_backend_offer_identity(offer) == _get_backend_offer_identity(same_offer)
        assert _get_backend_offer_identity(offer) != _get_backend_offer_identity(different_offer)


class TestGetBackendOffersInFleet:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("test_db", ["sqlite", "postgres"], indirect=True)
    async def test_keeps_unconstrained_offers_for_non_empty_cluster_fleet_without_elected_master(
        self, test_db, session: AsyncSession, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        user = await create_user(session=session)
        project = await create_project(session=session, owner=user)
        repo = await create_repo(session=session, project_id=project.id)
        fleet_spec = get_fleet_spec()
        fleet_spec.configuration.placement = InstanceGroupPlacement.CLUSTER
        fleet_spec.configuration.nodes = FleetNodesSpec(min=0, target=1, max=2)
        fleet = await create_fleet(session=session, project=project, spec=fleet_spec)
        await create_instance(
            session=session,
            project=project,
            fleet=fleet,
            job_provisioning_data=get_job_provisioning_data(region="eu-west-1"),
        )
        run_spec = get_run_spec(
            repo_id=repo.name,
            configuration=TaskConfiguration(image="debian", nodes=2),
        )
        jobs = await get_jobs_from_run_spec(run_spec=run_spec, secrets={}, replica_num=0)
        get_offers_by_requirements_mock = AsyncMock()
        monkeypatch.setattr(
            "dstack._internal.server.services.runs.plan.get_offers_by_requirements",
            get_offers_by_requirements_mock,
        )
        offer = get_instance_offer_with_availability()
        backend = AsyncMock()
        get_offers_by_requirements_mock.return_value = [(backend, offer)]

        offers = await _get_backend_offers_in_fleet(
            project=project,
            fleet_model=fleet,
            run_spec=run_spec,
            job=jobs[0],
            volumes=None,
        )

        assert offers == [(backend, offer)]
        get_offers_by_requirements_mock.assert_awaited_once()
        assert (
            get_offers_by_requirements_mock.await_args.kwargs["master_job_provisioning_data"]
            is None
        )


class TestRunCandidateResourcePoolAuthorization:
    @pytest.mark.asyncio
    async def test_excludes_unassigned_resource_pools(self, session: AsyncSession) -> None:
        user = await create_user(session=session)
        project = await create_project(session=session, owner=user)
        pool = await create_fleet(
            session=session,
            project=project,
            name="lab-pool",
            assign_to_project=False,
        )
        await create_instance(session=session, project=project, fleet=pool)
        run_spec = get_run_spec(repo_id="repo")

        fleet_filters, instance_filters = await get_run_candidate_fleet_models_filters(
            session=session,
            project=project,
            run_model=None,
            run_spec=run_spec,
        )
        (
            fleets_with_instances,
            fleets_without_instances,
        ) = await select_run_candidate_fleet_models_with_filters(
            session=session,
            fleet_filters=fleet_filters,
            instance_filters=instance_filters,
            lock_instances=False,
        )

        assert fleets_with_instances == []
        assert fleets_without_instances == []

    @pytest.mark.asyncio
    async def test_whole_pool_assignment_allows_all_pool_instances(
        self, session: AsyncSession
    ) -> None:
        user = await create_user(session=session)
        project = await create_project(session=session, owner=user)
        pool = await create_fleet(
            session=session,
            project=project,
            name="lab-pool",
            assign_to_project=False,
        )
        first_instance = await create_instance(
            session=session, project=project, fleet=pool, name="gpu-box-1"
        )
        second_instance = await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-2",
            instance_num=1,
        )
        session.add(
            ProjectResourcePoolAssignmentModel(
                project=project,
                fleet=pool,
                whole_pool=True,
            )
        )
        await session.commit()
        run_spec = get_run_spec(repo_id="repo")

        fleet_filters, instance_filters = await get_run_candidate_fleet_models_filters(
            session=session,
            project=project,
            run_model=None,
            run_spec=run_spec,
        )
        fleets_with_instances, _ = await select_run_candidate_fleet_models_with_filters(
            session=session,
            fleet_filters=fleet_filters,
            instance_filters=instance_filters,
            lock_instances=False,
        )

        assert [fleet.name for fleet in fleets_with_instances] == ["lab-pool"]
        assert {instance.id for instance in fleets_with_instances[0].instances} == {
            first_instance.id,
            second_instance.id,
        }

    @pytest.mark.asyncio
    async def test_instance_assignment_limits_pool_instances(self, session: AsyncSession) -> None:
        user = await create_user(session=session)
        project = await create_project(session=session, owner=user)
        pool = await create_fleet(
            session=session,
            project=project,
            name="lab-pool",
            assign_to_project=False,
        )
        allowed_instance = await create_instance(
            session=session, project=project, fleet=pool, name="gpu-box-1"
        )
        await create_instance(
            session=session,
            project=project,
            fleet=pool,
            name="gpu-box-2",
            instance_num=1,
        )
        session.add(
            ProjectResourceInstanceAssignmentModel(
                project=project,
                fleet=pool,
                instance=allowed_instance,
            )
        )
        await session.commit()
        run_spec = get_run_spec(repo_id="repo")

        fleet_filters, instance_filters = await get_run_candidate_fleet_models_filters(
            session=session,
            project=project,
            run_model=None,
            run_spec=run_spec,
        )
        fleets_with_instances, _ = await select_run_candidate_fleet_models_with_filters(
            session=session,
            fleet_filters=fleet_filters,
            instance_filters=instance_filters,
            lock_instances=False,
        )

        assert [fleet.name for fleet in fleets_with_instances] == ["lab-pool"]
        assert [instance.id for instance in fleets_with_instances[0].instances] == [
            allowed_instance.id
        ]

    @pytest.mark.asyncio
    async def test_explicit_fleet_must_still_be_authorized(self, session: AsyncSession) -> None:
        user = await create_user(session=session)
        project = await create_project(session=session, owner=user)
        pool = await create_fleet(
            session=session,
            project=project,
            name="lab-pool",
            assign_to_project=False,
        )
        await create_instance(session=session, project=project, fleet=pool)
        run_spec = get_run_spec(repo_id="repo", profile=Profile(fleets=["lab-pool"]))

        fleet_filters, instance_filters = await get_run_candidate_fleet_models_filters(
            session=session,
            project=project,
            run_model=None,
            run_spec=run_spec,
        )
        (
            fleets_with_instances,
            fleets_without_instances,
        ) = await select_run_candidate_fleet_models_with_filters(
            session=session,
            fleet_filters=fleet_filters,
            instance_filters=instance_filters,
            lock_instances=False,
        )

        assert fleets_with_instances == []
        assert fleets_without_instances == []
