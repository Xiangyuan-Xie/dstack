import uuid

import pytest

from dstack._internal.server.background.pipeline_tasks import runs


class _SessionCtx:
    def __init__(self, events: list[str]) -> None:
        self._events = events

    async def __aenter__(self):
        self._events.append("session_enter")
        return object()

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        self._events.append("session_exit")


class _GatewayConnection:
    def __init__(self, events: list[str], fail: bool = False) -> None:
        self._events = events
        self._fail = fail

    async def get_stats(self, project_name: str, run_name: str):
        self._events.append("get_stats")
        assert self._events[-2] == "session_exit"
        if self._fail:
            raise RuntimeError("gateway unavailable")
        return {"project": project_name, "run": run_name}


@pytest.mark.asyncio
async def test_fetch_gateway_stats_closes_session_before_gateway_io(monkeypatch) -> None:
    events: list[str] = []
    connection = _GatewayConnection(events)

    monkeypatch.setattr(runs, "get_session_ctx", lambda: _SessionCtx(events))

    async def get_connection(session, gateway_id):
        events.append("get_connection")
        return None, connection

    monkeypatch.setattr(runs, "get_or_add_gateway_connection", get_connection)

    result = await runs._fetch_gateway_stats(
        runs._GatewayStatsFetchRequest(
            gateway_id=uuid.uuid4(),
            project_name="test-project",
            run_name="test-run",
        )
    )

    assert result == {"project": "test-project", "run": "test-run"}
    assert events == ["session_enter", "get_connection", "session_exit", "get_stats"]


@pytest.mark.asyncio
async def test_fetch_gateway_stats_failure_returns_none(monkeypatch, caplog) -> None:
    events: list[str] = []
    connection = _GatewayConnection(events, fail=True)

    monkeypatch.setattr(runs, "get_session_ctx", lambda: _SessionCtx(events))

    async def get_connection(session, gateway_id):
        return None, connection

    monkeypatch.setattr(runs, "get_or_add_gateway_connection", get_connection)

    result = await runs._fetch_gateway_stats(
        runs._GatewayStatsFetchRequest(
            gateway_id=uuid.uuid4(),
            project_name="test-project",
            run_name="test-run",
        )
    )

    assert result is None
    assert "Failed to fetch gateway stats" in caplog.text
