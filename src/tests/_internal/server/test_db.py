from pathlib import Path
from unittest.mock import Mock

import pytest
from sqlalchemy.ext.asyncio import create_async_engine

from dstack._internal.server import db, settings


@pytest.mark.asyncio
async def test_reset_sqlite_database_for_test_users_recreates_local_db(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    sqlite_path = tmp_path / "sqlite.db"
    sqlite_path.write_text("old")
    sqlite_path.with_name("sqlite.db-wal").write_text("wal")
    sqlite_path.with_name("sqlite.db-shm").write_text("shm")
    old_db = db.Database(url=f"sqlite+aiosqlite:///{sqlite_path}")
    new_db = db.Database(
        url=f"sqlite+aiosqlite:///{sqlite_path}",
        engine=create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'new.sqlite'}"),
    )

    monkeypatch.setattr(settings, "SERVER_TEST_USERS_ENABLED", True)
    monkeypatch.setattr(db, "_db", old_db)
    monkeypatch.setattr(db, "get_new_db", Mock(return_value=new_db))

    await db.reset_sqlite_database_for_test_users()

    assert not sqlite_path.exists()
    assert not sqlite_path.with_name("sqlite.db-wal").exists()
    assert not sqlite_path.with_name("sqlite.db-shm").exists()
    assert db.get_db() is new_db
    await new_db.dispose()


@pytest.mark.asyncio
async def test_reset_sqlite_database_for_test_users_is_disabled_without_test_users(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    sqlite_path = tmp_path / "sqlite.db"
    sqlite_path.write_text("old")
    current_db = db.Database(url=f"sqlite+aiosqlite:///{sqlite_path}")

    monkeypatch.setattr(settings, "SERVER_TEST_USERS_ENABLED", False)
    monkeypatch.setattr(db, "_db", current_db)

    await db.reset_sqlite_database_for_test_users()

    assert sqlite_path.exists()
    assert db.get_db() is current_db
    await current_db.dispose()
