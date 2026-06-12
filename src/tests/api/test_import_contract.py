import subprocess
import sys
from textwrap import dedent


def test_api_imports_do_not_load_server_runtime() -> None:
    code = dedent(
        """
        import sys

        import dstack.api
        import dstack.api.server

        runtime_modules = [
            name
            for name in sys.modules
            if name in {
                "dstack._internal.server.app",
                "dstack._internal.server.main",
            }
        ]
        if runtime_modules:
            raise SystemExit(f"server runtime loaded: {runtime_modules}")
        """
    )

    subprocess.run([sys.executable, "-c", code], check=True, text=True)
