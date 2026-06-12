import asyncio

import pytest

from dstack._internal.proxy.lib.services import service_connection
from dstack._internal.proxy.lib.services.service_connection import ServiceConnectionPool
from dstack._internal.proxy.lib.testing.common import make_project, make_service


class FakeServiceConnection:
    open_calls = 0
    close_calls = 0
    open_gate: asyncio.Event
    opened: asyncio.Event
    fail_open = False

    def __init__(self, project, service, replica) -> None:
        self.project = project
        self.service = service
        self.replica = replica

    async def open(self) -> None:
        type(self).open_calls += 1
        type(self).opened.set()
        await type(self).open_gate.wait()
        if type(self).fail_open:
            raise RuntimeError("open failed")

    async def close(self) -> None:
        type(self).close_calls += 1


@pytest.fixture(autouse=True)
def reset_fake_connection(monkeypatch):
    FakeServiceConnection.open_calls = 0
    FakeServiceConnection.close_calls = 0
    FakeServiceConnection.open_gate = asyncio.Event()
    FakeServiceConnection.opened = asyncio.Event()
    FakeServiceConnection.fail_open = False
    monkeypatch.setattr(service_connection, "ServiceConnection", FakeServiceConnection)


@pytest.mark.asyncio
async def test_get_or_add_same_replica_opens_once() -> None:
    pool = ServiceConnectionPool()
    project = make_project("test-project")
    service = make_service("test-project", "test-run")
    replica = service.replicas[0]

    first = asyncio.create_task(pool.get_or_add(project, service, replica))
    await FakeServiceConnection.opened.wait()
    second = asyncio.create_task(pool.get_or_add(project, service, replica))

    await asyncio.sleep(0)
    assert await pool.get(replica.id) is None
    assert FakeServiceConnection.open_calls == 1

    FakeServiceConnection.open_gate.set()
    first_conn, second_conn = await asyncio.gather(first, second)

    assert first_conn is second_conn
    assert await pool.get(replica.id) is first_conn
    assert FakeServiceConnection.open_calls == 1


@pytest.mark.asyncio
async def test_get_or_add_failed_open_is_not_published_and_can_retry() -> None:
    pool = ServiceConnectionPool()
    project = make_project("test-project")
    service = make_service("test-project", "test-run")
    replica = service.replicas[0]

    FakeServiceConnection.fail_open = True
    FakeServiceConnection.open_gate.set()
    with pytest.raises(RuntimeError, match="open failed"):
        await pool.get_or_add(project, service, replica)

    assert await pool.get(replica.id) is None

    FakeServiceConnection.fail_open = False
    conn = await pool.get_or_add(project, service, replica)

    assert await pool.get(replica.id) is conn
    assert FakeServiceConnection.open_calls == 2


@pytest.mark.asyncio
async def test_remove_waits_for_in_flight_open_and_closes_connection() -> None:
    pool = ServiceConnectionPool()
    project = make_project("test-project")
    service = make_service("test-project", "test-run")
    replica = service.replicas[0]

    add_task = asyncio.create_task(pool.get_or_add(project, service, replica))
    await FakeServiceConnection.opened.wait()
    remove_task = asyncio.create_task(pool.remove(replica.id))

    await asyncio.sleep(0)
    assert FakeServiceConnection.close_calls == 0

    FakeServiceConnection.open_gate.set()
    opened_conn = await add_task
    await remove_task

    assert FakeServiceConnection.close_calls == 1
    assert await pool.get(replica.id) is None
    assert opened_conn.replica.id == replica.id


@pytest.mark.asyncio
async def test_remove_all_waits_for_in_flight_open_and_closes_connection() -> None:
    pool = ServiceConnectionPool()
    project = make_project("test-project")
    service = make_service("test-project", "test-run")
    replica = service.replicas[0]

    add_task = asyncio.create_task(pool.get_or_add(project, service, replica))
    await FakeServiceConnection.opened.wait()
    remove_all_task = asyncio.create_task(pool.remove_all())

    await asyncio.sleep(0)
    assert FakeServiceConnection.close_calls == 0

    FakeServiceConnection.open_gate.set()
    await add_task
    await remove_all_task

    assert FakeServiceConnection.close_calls == 1
    assert await pool.get(replica.id) is None
