import argparse
import os
import socket
import subprocess
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path

import requests

from dstack._internal.cli.commands import BaseCommand
from dstack._internal.cli.utils.common import console
from dstack._internal.core.errors import CLIError
from dstack._internal.utils.gpu import convert_nvidia_gpu_name

_WORKER_DATA_DIR = Path("/var/lib/dstack/worker")


@dataclass
class _WorkerAssignment:
    job_id: str
    run_name: str
    image: str
    command: list[str]
    env: dict[str, str] = field(default_factory=dict)
    cpu: float | None = None
    memory_gib: float | None = None
    shm_size_gib: float | None = None
    gpu_uuids: list[str] = field(default_factory=list)
    username: str = "user"
    workspace_mount_path: str = "/workspace"

    @classmethod
    def from_dict(cls, data: dict) -> "_WorkerAssignment":
        return cls(
            job_id=str(data["job_id"]),
            run_name=data["run_name"],
            image=data["image"],
            command=list(data.get("command") or []),
            env=dict(data.get("env") or {}),
            cpu=data.get("cpu"),
            memory_gib=data.get("memory_gib"),
            shm_size_gib=data.get("shm_size_gib"),
            gpu_uuids=list(data.get("gpu_uuids") or []),
            username=data.get("username") or "user",
            workspace_mount_path=data.get("workspace_mount_path") or "/workspace",
        )


@dataclass
class _RunningAssignment:
    assignment: _WorkerAssignment
    process: subprocess.Popen


class WorkerCommand(BaseCommand):
    NAME = "worker"
    DESCRIPTION = "Register this machine as a worker"

    def _register(self):
        self._parser.add_argument(
            "--server",
            required=True,
            help="The dstack server URL, e.g. http://127.0.0.1:3000",
        )
        self._parser.add_argument(
            "--token",
            required=True,
            help="Worker registration token created by an administrator",
        )
        self._parser.add_argument(
            "--name",
            default=socket.gethostname(),
            help="Worker name. Defaults to the host name.",
        )
        self._parser.add_argument(
            "--interval",
            type=int,
            default=10,
            help="Heartbeat and poll interval in seconds. Defaults to 10.",
        )
        self._parser.add_argument(
            "--transport",
            choices=["auto", "http", "websocket"],
            default="auto",
            help="Worker transport. Currently uses HTTP polling; websocket is reserved.",
        )

    def _command(self, args: argparse.Namespace):
        super()._command(args)
        if args.transport == "websocket":
            raise CLIError(
                "WebSocket worker transport is not implemented yet; use --transport http"
            )
        client = _WorkerHTTPClient(server=args.server, token=args.token)
        resources = _detect_resources()
        if resources["gpus"]:
            gpu_summary = ", ".join(
                f"{gpu['name']} {int(gpu['memory_mib'] / 1024)}GiB" for gpu in resources["gpus"]
            )
            console.print(f"Detected GPU resources: {gpu_summary}")
        else:
            console.print(
                "No NVIDIA GPUs detected by nvidia-smi. The worker will register as CPU-only."
            )
        registered = client.register(
            worker_name=args.name,
            hostname=socket.gethostname(),
            resources=resources,
        )
        worker_id = registered["worker_id"]
        console.print(
            f"Worker [code]{registered['worker_name']}[/] registered in fleet "
            f"[code]{registered['fleet_name']}[/]"
        )
        running_assignments: dict[str, _RunningAssignment] = {}
        try:
            while True:
                _report_finished_assignments(
                    client=client,
                    worker_id=worker_id,
                    running_assignments=running_assignments,
                )
                client.heartbeat(
                    worker_id=worker_id,
                    status="busy" if running_assignments else "idle",
                    interval_seconds=args.interval,
                    usage=_detect_usage(),
                )
                poll_response = client.poll(worker_id=worker_id)
                assignments = poll_response.get("assignments", [])
                for assignment_data in assignments:
                    assignment = _WorkerAssignment.from_dict(assignment_data)
                    if assignment.job_id in running_assignments:
                        continue
                    running_assignments[assignment.job_id] = _start_assignment(
                        client=client,
                        worker_id=worker_id,
                        assignment=assignment,
                    )
                time.sleep(args.interval)
        except KeyboardInterrupt:
            console.print("\nWorker stopped")


class _WorkerHTTPClient:
    def __init__(self, server: str, token: str):
        self._server = server.rstrip("/")
        self._session = requests.Session()
        self._session.headers.update({"Authorization": f"Bearer {token}"})

    def register(self, worker_name: str, hostname: str, resources: dict) -> dict:
        return self._post(
            "/api/workers/register",
            {
                "worker_name": worker_name,
                "hostname": hostname,
                "resources": resources,
            },
        )

    def heartbeat(
        self,
        worker_id: str,
        status: str,
        interval_seconds: int,
        usage: dict,
    ) -> dict:
        return self._post(
            "/api/workers/heartbeat",
            {
                "worker_id": worker_id,
                "status": status,
                "interval_seconds": interval_seconds,
                "usage": usage,
            },
        )

    def poll(self, worker_id: str) -> dict:
        return self._post(
            "/api/workers/poll",
            {
                "worker_id": worker_id,
            },
        )

    def report(
        self,
        worker_id: str,
        assignment: _WorkerAssignment,
        status: str,
        exit_status: int | None = None,
        message: str | None = None,
    ) -> dict:
        return self._post(
            "/api/workers/report",
            {
                "worker_id": worker_id,
                "job_id": assignment.job_id,
                "status": status,
                "exit_status": exit_status,
                "termination_message": message,
            },
        )

    def _post(self, path: str, body: dict) -> dict:
        try:
            response = self._session.post(f"{self._server}{path}", json=body, timeout=30)
        except requests.RequestException as exc:
            raise CLIError(f"Failed to connect to dstack server: {exc}") from exc
        if response.status_code >= 400:
            raise CLIError(f"Server returned {response.status_code}: {response.text}")
        return response.json()


def _detect_resources() -> dict:
    try:
        import psutil
    except ImportError:
        return {"cpus": 1, "memory_mib": 1024, "disk_mib": 102400, "gpus": _detect_nvidia_gpus()}

    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpus": psutil.cpu_count(logical=True) or 1,
        "memory_mib": int(memory.total / 1024 / 1024),
        "disk_mib": int(disk.total / 1024 / 1024),
        "gpus": _detect_nvidia_gpus(),
    }


def _detect_usage() -> dict:
    gpus = _detect_nvidia_gpu_usage()
    usage = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "gpu_memory_used_gib": _mib_to_gib(sum(gpu["memory_used_mib"] for gpu in gpus))
        if gpus
        else None,
        "gpu_memory_total_gib": _mib_to_gib(sum(gpu["memory_total_mib"] for gpu in gpus))
        if gpus
        else None,
        "gpu_util_percent": _average([gpu["utilization_percent"] for gpu in gpus]),
    }
    try:
        import psutil
    except ImportError:
        return usage

    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    usage.update(
        {
            "cpu_percent": psutil.cpu_percent(),
            "memory_used_gib": _bytes_to_gib(memory.used),
            "memory_total_gib": _bytes_to_gib(memory.total),
            "disk_used_gib": _bytes_to_gib(disk.used),
            "disk_total_gib": _bytes_to_gib(disk.total),
        }
    )
    return usage


def _detect_nvidia_gpus() -> list[dict]:
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=uuid,index,name,memory.total",
                "--format=csv,noheader,nounits",
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return []

    gpus = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        try:
            uuid, index, name, memory_mib = [part.strip() for part in line.split(",", 3)]
            memory_mib_int = int(float(memory_mib))
            index_int = int(index)
        except ValueError:
            continue
        gpus.append(
            {
                "uuid": uuid,
                "index": index_int,
                "vendor": "nvidia",
                "name": convert_nvidia_gpu_name(name),
                "memory_mib": memory_mib_int,
            }
        )
    return gpus


def _start_assignment(
    client: _WorkerHTTPClient,
    worker_id: str,
    assignment: _WorkerAssignment,
) -> _RunningAssignment:
    host_workspace = _get_user_workspace(assignment.username)
    host_workspace.mkdir(parents=True, exist_ok=True)
    container_name = f"dstack-{assignment.job_id}"
    command = _build_docker_run_command(
        assignment=assignment,
        container_name=container_name,
        host_workspace=str(host_workspace),
    )
    client.report(worker_id=worker_id, assignment=assignment, status="pulling")
    try:
        process = subprocess.Popen(command)
    except FileNotFoundError as exc:
        client.report(
            worker_id=worker_id,
            assignment=assignment,
            status="failed",
            message="Docker is not installed or not available in PATH",
        )
        raise CLIError("Docker is not installed or not available in PATH") from exc
    client.report(worker_id=worker_id, assignment=assignment, status="running")
    return _RunningAssignment(assignment=assignment, process=process)


def _report_finished_assignments(
    client: _WorkerHTTPClient,
    worker_id: str,
    running_assignments: dict[str, _RunningAssignment],
) -> None:
    finished_job_ids = []
    for job_id, running in running_assignments.items():
        exit_status = running.process.poll()
        if exit_status is None:
            continue
        status = "done" if exit_status == 0 else "failed"
        client.report(
            worker_id=worker_id,
            assignment=running.assignment,
            status=status,
            exit_status=exit_status,
        )
        finished_job_ids.append(job_id)
    for job_id in finished_job_ids:
        del running_assignments[job_id]


def _build_docker_run_command(
    assignment: _WorkerAssignment,
    container_name: str,
    host_workspace: str,
) -> list[str]:
    command = [
        "docker",
        "run",
        "--name",
        container_name,
        "--rm",
        "--label",
        f"dstack.job_id={assignment.job_id}",
    ]
    if assignment.cpu is not None:
        command += ["--cpus", f"{assignment.cpu:g}"]
    if assignment.memory_gib is not None:
        command += ["--memory", f"{assignment.memory_gib:g}g"]
    if assignment.shm_size_gib is not None:
        command += ["--shm-size", f"{assignment.shm_size_gib:g}g"]
    if assignment.gpu_uuids:
        command += ["--gpus", "device=" + ",".join(assignment.gpu_uuids)]
    for key, value in assignment.env.items():
        command += ["-e", f"{key}={value}"]
    command += ["-v", f"{host_workspace}:{assignment.workspace_mount_path}"]
    command += ["-w", assignment.workspace_mount_path]
    command.append(assignment.image)
    command.extend(assignment.command)
    return command


def _get_user_workspace(username: str) -> Path:
    safe_username = "".join(ch if ch.isalnum() or ch in "._-" else "_" for ch in username)
    return (
        Path(os.environ.get("DSTACK_WORKER_DATA_DIR", str(_WORKER_DATA_DIR)))
        / "users"
        / safe_username
    )


def _detect_nvidia_gpu_usage() -> list[dict]:
    try:
        result = subprocess.run(
            [
                "nvidia-smi",
                "--query-gpu=memory.used,memory.total,utilization.gpu",
                "--format=csv,noheader,nounits",
            ],
            check=True,
            capture_output=True,
            text=True,
            timeout=10,
        )
    except (FileNotFoundError, subprocess.SubprocessError):
        return []

    gpus = []
    for line in result.stdout.splitlines():
        if not line.strip():
            continue
        try:
            memory_used_mib, memory_total_mib, utilization_percent = [
                part.strip() for part in line.split(",", 2)
            ]
            memory_used_mib_int = int(float(memory_used_mib))
            memory_total_mib_int = int(float(memory_total_mib))
            utilization_percent_int = int(float(utilization_percent))
        except ValueError:
            continue
        gpus.append(
            {
                "vendor": "nvidia",
                "memory_used_mib": memory_used_mib_int,
                "memory_total_mib": memory_total_mib_int,
                "utilization_percent": utilization_percent_int,
            }
        )
    return gpus


def _bytes_to_gib(value: int) -> float:
    return round(value / 1024 / 1024 / 1024, 2)


def _mib_to_gib(value: int) -> float:
    return round(value / 1024, 2)


def _average(values: list[int]) -> float | None:
    if not values:
        return None
    return round(sum(values) / len(values), 2)
