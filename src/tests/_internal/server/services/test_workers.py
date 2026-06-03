import datetime as dt

from dstack._internal.core.models.backends.base import BackendType
from dstack._internal.core.models.instances import InstanceStatus
from dstack._internal.server.models import InstanceModel
from dstack._internal.server.services import workers


def test_prepare_existing_registered_instance_for_reconnect_restores_deleted_instance():
    instance = InstanceModel(
        name="gpu-box-1",
        instance_num=0,
        project=None,
        status=InstanceStatus.TERMINATED,
        unreachable=True,
        created_at=dt.datetime.now(dt.timezone.utc),
        started_at=dt.datetime.now(dt.timezone.utc),
        finished_at=dt.datetime.now(dt.timezone.utc),
        backend=BackendType.REGISTERED,
        price=0,
        region="registered",
        deleted=True,
        deleted_at=dt.datetime.now(dt.timezone.utc),
        volume_attachments=[],
        total_blocks=1,
        busy_blocks=0,
    )

    workers.prepare_existing_registered_instance_for_reconnect(
        instance_model=instance,
        offer_json="{}",
        job_provisioning_data_json="{}",
        total_blocks=2,
    )

    assert instance.status == InstanceStatus.IDLE
    assert instance.unreachable is False
    assert instance.deleted is False
    assert instance.deleted_at is None
    assert instance.finished_at is None
    assert instance.backend == BackendType.REGISTERED
    assert instance.offer == "{}"
    assert instance.job_provisioning_data == "{}"
    assert instance.total_blocks == 2
    assert instance.busy_blocks == 0
