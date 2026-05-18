import argparse
import socket
import subprocess
import time
from datetime import datetime, timezone

import requests

from dstack._internal.cli.commands import BaseCommand
from dstack._internal.cli.utils.common import console
from dstack._internal.core.errors import CLIError
from dstack._internal.utils.gpu import convert_nvidia_gpu_name


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
        try:
            while True:
                client.heartbeat(
                    worker_id=worker_id,
                    status="idle",
                    interval_seconds=args.interval,
                    usage=_detect_usage(),
                )
                poll_response = client.poll(worker_id=worker_id)
                assignments = poll_response.get("assignments", [])
                if assignments:
                    console.print(
                        "Received assignments, but local execution is not implemented in this CLI worker yet."
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
                "--query-gpu=name,memory.total",
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
            name, memory_mib = [part.strip() for part in line.split(",", 1)]
            memory_mib_int = int(float(memory_mib))
        except ValueError:
            continue
        gpus.append(
            {
                "vendor": "nvidia",
                "name": convert_nvidia_gpu_name(name),
                "memory_mib": memory_mib_int,
            }
        )
    return gpus


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
