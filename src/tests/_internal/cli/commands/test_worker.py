from subprocess import CompletedProcess
from unittest.mock import Mock

from dstack._internal.cli.commands.worker import _detect_resources, _detect_usage


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
            stdout="NVIDIA A100-SXM4-40GB, 40960\nNVIDIA A100-SXM4-40GB, 40960\n",
            stderr="",
        )

    monkeypatch.setitem(__import__("sys").modules, "psutil", psutil)
    monkeypatch.setattr("subprocess.run", run)

    resources = _detect_resources()

    assert resources["cpus"] == 16
    assert resources["memory_mib"] == 64 * 1024
    assert resources["disk_mib"] == 1024 * 1024
    assert resources["gpus"] == [
        {"vendor": "nvidia", "name": "A100", "memory_mib": 40960},
        {"vendor": "nvidia", "name": "A100", "memory_mib": 40960},
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
