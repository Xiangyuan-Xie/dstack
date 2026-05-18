from subprocess import CompletedProcess
from unittest.mock import Mock

from dstack._internal.cli.commands.worker import (
    _build_docker_run_command,
    _detect_resources,
    _detect_usage,
    _WorkerAssignment,
)


def test_detect_resources_reports_nvidia_gpus(monkeypatch):
    psutil = Mock()
    psutil.cpu_count.return_value = 16
    psutil.virtual_memory.return_value = Mock(total=64 * 1024 * 1024 * 1024)
    psutil.disk_usage.return_value = Mock(total=1024 * 1024 * 1024 * 1024)

    def run(*args, **kwargs):
        assert args[0][0] == "nvidia-smi"
        return CompletedProcess(
            args=args[0],
            returncode=0,
            stdout=(
                "GPU-111, 0, NVIDIA A100-SXM4-40GB, 40960\n"
                "GPU-222, 1, NVIDIA A100-SXM4-40GB, 40960\n"
            ),
            stderr="",
        )

    monkeypatch.setitem(__import__("sys").modules, "psutil", psutil)
    monkeypatch.setattr("subprocess.run", run)

    resources = _detect_resources()

    assert resources["cpus"] == 16
    assert resources["memory_mib"] == 64 * 1024
    assert resources["disk_mib"] == 1024 * 1024
    assert resources["gpus"] == [
        {"uuid": "GPU-111", "index": 0, "vendor": "nvidia", "name": "A100", "memory_mib": 40960},
        {"uuid": "GPU-222", "index": 1, "vendor": "nvidia", "name": "A100", "memory_mib": 40960},
    ]


def test_detect_resources_keeps_cpu_resources_when_nvidia_smi_is_unavailable(monkeypatch):
    psutil = Mock()
    psutil.cpu_count.return_value = 8
    psutil.virtual_memory.return_value = Mock(total=32 * 1024 * 1024 * 1024)
    psutil.disk_usage.return_value = Mock(total=512 * 1024 * 1024 * 1024)

    def run(*_args, **_kwargs):
        raise FileNotFoundError()

    monkeypatch.setitem(__import__("sys").modules, "psutil", psutil)
    monkeypatch.setattr("subprocess.run", run)

    resources = _detect_resources()

    assert resources == {
        "cpus": 8,
        "memory_mib": 32 * 1024,
        "disk_mib": 512 * 1024,
        "gpus": [],
    }


def test_detect_usage_reports_host_and_nvidia_gpu_usage(monkeypatch):
    psutil = Mock()
    psutil.cpu_percent.return_value = 17.5
    psutil.virtual_memory.return_value = Mock(
        used=12 * 1024 * 1024 * 1024,
        total=64 * 1024 * 1024 * 1024,
    )
    psutil.disk_usage.return_value = Mock(
        used=100 * 1024 * 1024 * 1024,
        total=1024 * 1024 * 1024 * 1024,
    )

    def run(*args, **kwargs):
        assert args[0][0] == "nvidia-smi"
        return CompletedProcess(
            args=args[0],
            returncode=0,
            stdout="512, 40960, 22\n1024, 40960, 44\n",
            stderr="",
        )

    monkeypatch.setitem(__import__("sys").modules, "psutil", psutil)
    monkeypatch.setattr("subprocess.run", run)

    usage = _detect_usage()

    assert usage["cpu_percent"] == 17.5
    assert usage["memory_used_gib"] == 12
    assert usage["memory_total_gib"] == 64
    assert usage["disk_used_gib"] == 100
    assert usage["disk_total_gib"] == 1024
    assert usage["gpu_memory_used_gib"] == 1.5
    assert usage["gpu_memory_total_gib"] == 80
    assert usage["gpu_util_percent"] == 33
    assert usage["updated_at"]


def test_detect_usage_does_not_fake_gpus_when_nvidia_smi_is_unavailable(monkeypatch):
    psutil = Mock()
    psutil.cpu_percent.return_value = 0.0
    psutil.virtual_memory.return_value = Mock(used=1, total=2)
    psutil.disk_usage.return_value = Mock(used=3, total=4)

    def run(*_args, **_kwargs):
        raise FileNotFoundError()

    monkeypatch.setitem(__import__("sys").modules, "psutil", psutil)
    monkeypatch.setattr("subprocess.run", run)

    usage = _detect_usage()

    assert usage["gpu_memory_used_gib"] is None
    assert usage["gpu_memory_total_gib"] is None
    assert usage["gpu_util_percent"] is None


def test_build_docker_run_command_applies_assignment_limits():
    assignment = _WorkerAssignment(
        job_id="job-1",
        run_name="train",
        image="pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime",
        command=["python", "train.py"],
        env={"EPOCHS": "1"},
        cpu=4,
        memory_gib=16,
        shm_size_gib=2,
        gpu_uuids=["GPU-111"],
        username="alice",
        workspace_mount_path="/workspace",
    )

    command = _build_docker_run_command(
        assignment=assignment,
        container_name="dstack-job-1",
        host_workspace="/var/lib/dstack/worker/users/alice",
    )

    assert command[:3] == ["docker", "run", "--name"]
    assert "--cpus" in command
    assert command[command.index("--cpus") + 1] == "4"
    assert "--memory" in command
    assert command[command.index("--memory") + 1] == "16g"
    assert "--shm-size" in command
    assert command[command.index("--shm-size") + 1] == "2g"
    assert "--gpus" in command
    assert command[command.index("--gpus") + 1] == "device=GPU-111"
    assert "-v" in command
    assert command[command.index("-v") + 1] == "/var/lib/dstack/worker/users/alice:/workspace"
    assert "-w" in command
    assert command[command.index("-w") + 1] == "/workspace"
    image_index = command.index("pytorch/pytorch:2.4.0-cuda12.4-cudnn9-runtime")
    assert command[image_index + 1 :] == ["python", "train.py"]
