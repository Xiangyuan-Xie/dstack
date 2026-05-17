import argparse
import socket
import time

import requests

from dstack._internal.cli.commands import BaseCommand
from dstack._internal.cli.utils.common import console
from dstack._internal.core.errors import CLIError


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
                client.heartbeat(worker_id=worker_id, status="idle")
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

    def heartbeat(self, worker_id: str, status: str) -> dict:
        return self._post(
            "/api/workers/heartbeat",
            {
                "worker_id": worker_id,
                "status": status,
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
        return {"cpus": 1, "memory_mib": 1024, "disk_mib": 102400, "gpus": []}

    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    return {
        "cpus": psutil.cpu_count(logical=True) or 1,
        "memory_mib": int(memory.total / 1024 / 1024),
        "disk_mib": int(disk.total / 1024 / 1024),
        "gpus": [],
    }
