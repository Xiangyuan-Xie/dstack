from contextlib import asynccontextmanager
import json
import os
from itertools import chain
from pathlib import Path
import time
from typing import Optional

from aiorwlock import RWLock
from pydantic import BaseModel, ValidationError

from dstack._internal.proxy.gateway.models import GlobalProxyConfig, ModelEntrypoint
from dstack._internal.proxy.lib.models import ChatModel, Project, Service
from dstack._internal.proxy.lib.repo import BaseProxyRepo
from dstack._internal.utils.common import run_async
from dstack._internal.utils.logging import get_logger

logger = get_logger(__name__)


class State(BaseModel):
    services: dict[str, dict[str, Service]] = {}
    models: dict[str, dict[str, ChatModel]] = {}
    entrypoints: dict[str, ModelEntrypoint] = {}
    projects: dict[str, Project] = {}
    config: GlobalProxyConfig = GlobalProxyConfig()


class GatewayProxyRepo(BaseProxyRepo):
    """
    Repo implementation used on gateways. Stores state in memory and maintains a copy on disk.
    """

    def __init__(self, state: Optional[State] = None, file: Optional[Path] = None) -> None:
        self._state = state or State()
        self._file = file
        self._lock = RWLock()

    async def list_services(self) -> list[Service]:
        async with self.reader():
            services_by_project = (
                project_services.values() for project_services in self._state.services.values()
            )
            return list(chain(*services_by_project))

    async def get_service(self, project_name: str, run_name: str) -> Optional[Service]:
        async with self.reader():
            return self._state.services.get(project_name, {}).get(run_name)

    async def get_service_by_domain(self, domain: str) -> Optional[Service]:
        async with self.reader():
            for project_services in self._state.services.values():
                for service in project_services.values():
                    if service.domain == domain:
                        return service
            return None

    async def set_service(self, service: Service) -> None:
        async with self.writer():
            self._state.services.setdefault(service.project_name, {})[service.run_name] = service

    async def delete_service(self, project_name: str, run_name: str) -> None:
        async with self.writer():
            project_services = self._state.services.get(project_name, {})
            project_services.pop(run_name, None)
            if not project_services:
                self._state.services.pop(project_name, None)

    async def list_models(self, project_name: str) -> list[ChatModel]:
        async with self.reader():
            return list(self._state.models.get(project_name, {}).values())

    async def get_model(self, project_name: str, name: str) -> Optional[ChatModel]:
        async with self.reader():
            return self._state.models.get(project_name, {}).get(name)

    async def set_model(self, model: ChatModel) -> None:
        async with self.writer():
            self._state.models.setdefault(model.project_name, {})[model.name] = model

    async def delete_models_by_run(self, project_name: str, run_name: str) -> None:
        async with self.writer():
            project_models = self._state.models.get(project_name, {})
            models_to_delete = [m for m in project_models.values() if m.run_name == run_name]
            for model in models_to_delete:
                project_models.pop(model.name, None)
            if not project_models:
                self._state.models.pop(project_name, None)

    async def list_entrypoints(self) -> list[ModelEntrypoint]:
        async with self.reader():
            return list(self._state.entrypoints.values())

    async def set_entrypoint(self, entrypoint: ModelEntrypoint) -> None:
        async with self.writer():
            self._state.entrypoints[entrypoint.project_name] = entrypoint

    async def get_project(self, name: str) -> Optional[Project]:
        async with self.reader():
            return self._state.projects.get(name)

    async def set_project(self, project: Project) -> None:
        async with self.writer():
            self._state.projects[project.name] = project

    async def get_config(self) -> GlobalProxyConfig:
        async with self.reader():
            return self._state.config

    async def set_config(self, config: GlobalProxyConfig) -> None:
        async with self.writer():
            self._state.config = config

    @asynccontextmanager
    async def reader(self):
        async with self._lock.reader:
            yield

    @asynccontextmanager
    async def writer(self):
        async with self._lock.writer:
            yield
            await run_async(self.save)

    @staticmethod
    def load(state_file: Path) -> "GatewayProxyRepo":
        if state_file.exists():
            try:
                state = State.parse_file(state_file)
            except (json.JSONDecodeError, ValidationError, ValueError) as e:
                corrupt_file = _move_corrupt_state_file(state_file)
                logger.error(
                    "Gateway state file %s is corrupt and was moved to %s: %s",
                    state_file,
                    corrupt_file,
                    e,
                )
                state = None
        else:
            state = None
        return GatewayProxyRepo(state=state, file=state_file)

    def save(self) -> None:
        if self._file is not None:
            _atomic_write_text(self._file, self._state.json())


def _move_corrupt_state_file(state_file: Path) -> Path:
    corrupt_file = state_file.with_name(f"{state_file.name}.corrupt.{time.time_ns()}")
    os.replace(state_file, corrupt_file)
    return corrupt_file


def _atomic_write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = path.with_name(f".{path.name}.{os.getpid()}.{time.time_ns()}.tmp")
    try:
        with tmp_path.open("w") as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, path)
        _fsync_parent_dir(path)
    except BaseException:
        tmp_path.unlink(missing_ok=True)
        raise


def _fsync_parent_dir(path: Path) -> None:
    if os.name == "nt":
        return
    fd = os.open(path.parent, os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)
