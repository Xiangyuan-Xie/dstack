import http.client
import logging
from unittest.mock import Mock, patch

import pytest
from apscheduler.triggers.date import DateTrigger
from apscheduler.triggers.interval import IntervalTrigger

from dstack._internal.server import settings
from dstack._internal.server.background.scheduled_tasks import (
    start_scheduled_tasks,
)
from dstack._internal.server.background.scheduled_tasks.offers_catalog import (
    preload_offers_catalog,
)


def test_does_not_schedule_preload_offers_catalog_by_default() -> None:
    scheduler_mock = Mock()

    with (
        patch.multiple(settings, PRELOAD_OFFERS_CATALOG_ENABLED=False),
        patch(
            "dstack._internal.server.background.scheduled_tasks._scheduler",
            scheduler_mock,
        ),
    ):
        start_scheduled_tasks()

    scheduled_funcs = [call.args[0] for call in scheduler_mock.add_job.call_args_list]
    assert preload_offers_catalog not in scheduled_funcs


def test_schedules_preload_offers_catalog_when_enabled() -> None:
    scheduler_mock = Mock()

    with (
        patch.multiple(settings, PRELOAD_OFFERS_CATALOG_ENABLED=True),
        patch(
            "dstack._internal.server.background.scheduled_tasks._scheduler",
            scheduler_mock,
        ),
    ):
        start_scheduled_tasks()

    preload_calls = [
        call
        for call in scheduler_mock.add_job.call_args_list
        if call.args[0] == preload_offers_catalog
    ]
    assert len(preload_calls) == 2
    assert isinstance(preload_calls[0].args[1], DateTrigger)
    assert isinstance(preload_calls[1].args[1], IntervalTrigger)
    assert preload_calls[1].args[1].interval.total_seconds() == 10 * 60


@pytest.mark.asyncio
async def test_preload_offers_catalog_logs_warning_on_remote_disconnected(
    caplog: pytest.LogCaptureFixture,
) -> None:
    catalog_mock = Mock()
    catalog_mock.load.side_effect = http.client.RemoteDisconnected("remote closed")
    caplog.set_level(
        logging.WARNING,
        logger="dstack._internal.server.background.scheduled_tasks.offers_catalog",
    )

    async def run_async_mock(func):
        return func()

    with patch(
        "dstack._internal.server.background.scheduled_tasks.offers_catalog.gpuhunt.default_catalog",
        return_value=catalog_mock,
    ), patch(
        "dstack._internal.server.background.scheduled_tasks.offers_catalog.run_async",
        run_async_mock,
    ):
        await preload_offers_catalog()

    catalog_mock.load.assert_called_once()
    assert "Failed to pre-load offers catalog" in caplog.text
