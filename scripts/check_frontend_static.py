#!/usr/bin/env python3
import hashlib
import sys
from pathlib import Path


def _file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _snapshot(root: Path) -> dict[str, str]:
    return {
        str(path.relative_to(root)): _file_hash(path)
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def main() -> int:
    frontend_build = Path("frontend/build")
    server_statics = Path("src/dstack/_internal/server/statics")
    if not frontend_build.is_dir():
        print(f"{frontend_build} does not exist; run `cd frontend && npm run build` first")
        return 2
    if not server_statics.is_dir():
        print(f"{server_statics} does not exist")
        return 2

    build_snapshot = _snapshot(frontend_build)
    statics_snapshot = _snapshot(server_statics)
    if build_snapshot == statics_snapshot:
        print("frontend/build matches src/dstack/_internal/server/statics")
        return 0

    build_files = set(build_snapshot)
    statics_files = set(statics_snapshot)
    missing = sorted(build_files - statics_files)
    extra = sorted(statics_files - build_files)
    changed = sorted(
        path
        for path in build_files & statics_files
        if build_snapshot[path] != statics_snapshot[path]
    )
    if missing:
        print("Missing from server statics:")
        print("\n".join(f"  {path}" for path in missing[:50]))
    if extra:
        print("Extra in server statics:")
        print("\n".join(f"  {path}" for path in extra[:50]))
    if changed:
        print("Different file contents:")
        print("\n".join(f"  {path}" for path in changed[:50]))
    return 1


if __name__ == "__main__":
    sys.exit(main())
