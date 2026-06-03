# Repository Guidelines

## First Read
- Use a Python 3.11+ development environment. Conda, venv, and `uv` are all acceptable; keep environment-specific paths out of committed docs and scripts.
- Read `contributing/ARCHITECTURE.md` before touching cross-cutting behavior.
- Read the topic guide that matches your task:
  - Backends: `contributing/BACKENDS.md` and `contributing/GPUHUNT.md`.
  - DB migrations: `contributing/MIGRATIONS.md`.
  - Run/job lifecycle: `contributing/RUNS-AND-JOBS.md`.
  - Background workers: `contributing/PIPELINES.md`.
  - Locks and transactions: `contributing/LOCKING.md`.
  - Proxy/gateways/services: `contributing/PROXY.md`.
  - Runner/shim: `contributing/RUNNER-AND-SHIM.md` and `runner/README.md`.
  - Frontend: `contributing/FRONTEND.md`.
  - Docs: `contributing/DOCS.md`.

## Project Structure & Module Organization
- Core Python package lives in `src/dstack`; internal modules sit under `_internal`, API surfaces under `api`, public core exports under `core`, and plugin integrations under `plugins`.
- Tests reside in `src/tests` and mirror package paths; add new suites alongside the code they cover.
- Frontend lives in `frontend` and is built into `src/dstack/_internal/server/statics`.
- Docs sources are under `mkdocs/` with main user docs in `mkdocs/docs/`; there is no root `docs/` source tree.
- Runner and shim are Go code in `runner`; optional gateway package metadata and code live under `gateway`.
- Dev/release scripts live in `scripts`; agent-facing dstack CLI skill lives in `skills/dstack/SKILL.md`.

## Development Environment
- Recommended Python version for local development is 3.11. The package supports Python 3.10+, but some docs/test tooling is easiest on 3.11.
- Create and activate an environment with your preferred tool. Examples:

```sh
conda create -n dstack-dev python=3.11 pip -y
conda activate dstack-dev
```

```sh
python -m venv .venv
. .venv/bin/activate
```

- Install Python dependencies from the activated environment. The upstream default is:

```sh
uv sync --all-extras
```

- If using pip/conda instead of `uv`, install the editable package and local tooling:

```sh
python -m pip install -e '.[all]' \
  pre-commit 'pytest~=8.0' 'pytest-asyncio>=0.25.2' 'pytest-mock>=3.14.0' \
  'pytest-httpbin>=2.1.0' 'pytest-socket>=0.7.0' 'pytest-env>=1.1.0' \
  'pytest-unordered>=0.7.0' 'requests-mock>=1.12.1' 'freezegun>=1.5.1' \
  ruff==0.12.7 'testcontainers>=4.9.2' 'pytest-xdist>=3.6.1' \
  'pyinstrument>=5.0.0' kubernetes-stubs-elephant-fork 'pyright[nodejs]' \
  pillow cairosvg 'mkdocs-material>=9.7.0' 'mkdocs-material[imaging]' \
  mkdocs-material-extensions mkdocs-redirects mkdocs-gen-files \
  'mkdocstrings[python]' mkdocs-render-swagger-plugin
```

- Frontend work requires Node.js 20+ and npm. Install it via your OS package manager, conda-forge, nvm, asdf, or another local tool.

## Build, Test, and Development Commands
- Run CLI/server from source after activating your environment: `dstack ...` (e.g., `dstack server --port 8000`).
- Lint/format: `ruff check .` and `ruff format .`.
- Type check: `pyright -p .`.
- Test suite: `pytest`.
- Focused tests:

```sh
pytest src/tests/path/to/test_file.py
pytest src/tests/path/to/test_file.py::TestClass::test_name
pytest -k "keyword" src/tests
pytest src/tests/_internal/server/routers/test_secrets.py --runpostgres
pytest src/tests/_internal/server/test_app.py::TestApp::test_returns_html --runui
```

- Frontend: from `frontend/` run `npm ci`, `npm run build`, then copy `frontend/build` into `src/dstack/_internal/server/statics/`; for dev, run `npm run start` with API on port 8000.
- After every frontend-related change, run a production frontend build and refresh the backend static files before handing off:

```sh
cd frontend
npm run build
cd ..
rsync -a --delete frontend/build/ src/dstack/_internal/server/statics/
```

- Docs preview/build: `mkdocs serve --livereload -s` and `mkdocs build -s`.

## Python Architecture Boundaries
- CLI entry point: `src/dstack/_internal/cli/main.py`, exposed by `pyproject.toml` as `dstack = "dstack._internal.cli.main:main"`.
- CLI commands live in `src/dstack/_internal/cli/commands`; the CLI should normally call the server through `src/dstack/api/server` or higher-level API wrappers, not access the DB directly.
- Server entry point: `src/dstack/_internal/server/main.py`.
- FastAPI app wiring, lifespan, routers, static UI, migrations, and background startup live in `src/dstack/_internal/server/app.py`.
- HTTP routers belong in `src/dstack/_internal/server/routers` and should stay thin: request schemas, auth/dependencies, response shaping, and calls into services.
- Server business logic belongs in `src/dstack/_internal/server/services`.
- Request/response schemas belong in `src/dstack/_internal/server/schemas`.
- Domain/configuration models belong in `src/dstack/_internal/core/models`; if unsure where a Pydantic model should live, prefer this package over server-specific locations.
- SQLAlchemy ORM models are centralized in `src/dstack/_internal/server/models.py`.
- DB/session/migration helpers are in `src/dstack/_internal/server/db.py`.
- Alembic migrations live in `src/dstack/_internal/server/migrations/versions`.
- Low-level HTTP API client modules live in `src/dstack/api/server/_*.py`; high-level public API modules live in `src/dstack/api/_public`.

## Backend Integrations
- Preserve the three-layer backend shape:
  - `Backend`: provider-level object.
  - `Compute`: provisioning, instance, volume, and capability operations.
  - `Configurator`: config validation, credential handling, stored config conversion, and backend instantiation.
- Common files and registrations:
  - Backend type enum: `src/dstack/_internal/core/models/backends/base.py`.
  - Backend config unions: `src/dstack/_internal/core/backends/models.py`.
  - Configurator registry: `src/dstack/_internal/core/backends/configurators.py`.
  - Existing provider examples: `src/dstack/_internal/core/backends/aws`, `gcp`, `azure`, `kubernetes`, `runpod`, and `vastai`.
- Use `python scripts/add_backend.py -n ProviderName` for a new backend scaffold, then adjust the generated models, compute, configurator, registrations, docs, and tests.
- Do not expose sensitive credential fields in API responses.

## Runs, Jobs, Pipelines, and Locks
- Runs are user-facing workload units; jobs are per-node/per-replica execution units. Read `contributing/RUNS-AND-JOBS.md` before changing status transitions, retries, termination, or service replica behavior.
- Background processing uses pipelines under `src/dstack/_internal/server/background/pipeline_tasks`.
- Pipeline workers should keep heavy work outside DB sessions. Use short DB sessions for refetch, lock acquisition, and guarded apply.
- Apply updates to locked resources should be guarded by `id + lock_token`; if the update affects zero rows, treat the work item as stale.
- Services that create work for a pipeline should hint after commit with the existing pipeline hinter pattern.
- For lock-sensitive code, read `contributing/LOCKING.md`; SQLite and Postgres have different locking behavior.

## Database and Migrations
- If `src/dstack/_internal/server/models.py` or persisted data shape changes, add an Alembic migration in `src/dstack/_internal/server/migrations/versions`.
- Generate from the server directory:

```sh
cd src/dstack/_internal/server
alembic revision -m "message" --autogenerate
```

- Review generated migrations manually.
- Keep migrations deployment-compatible where possible. For destructive or type-changing changes, use expand-and-contract steps. If a migration cannot be compatible with older replicas, call it out explicitly in the PR.
- For Postgres index creation, prefer retry-safe concurrent index patterns from `contributing/MIGRATIONS.md`.

## Coding Style & Naming Conventions
- Python targets 3.10+ with 4-space indentation and max line length of 99 (see `pyproject.toml`; `E501` is ignored but keep lines readable).
- Imports are sorted via Ruff’s isort settings (`dstack` treated as first-party).
- Keep primary/public functions before local helper functions in a module section.
- Roughly keep function definitions in the order they are referenced within a file so call flow stays easy to follow.
- Prefer early returns over nested `if`/`else` blocks when they make the control flow simpler.
- Keep private classes, exceptions, and similar implementation-specific types close to the private functions that use them unless they are shared more broadly in the module.
- Prefer pydantic-style models in `core/models`; Pydantic is v1 (`pydantic>=1.10.10,<2.0.0`), so do not write Pydantic v2-only code.
- Document attributes when the note adds behavior, compatibility, or semantic context that is not obvious from the name and type. Use attribute docstrings without leading newline.
- Add comments only when they clarify non-obvious behavior, compatibility, or concurrency details.
- Tests use `test_*.py` modules and `test_*` functions; fixtures live near usage.

## Testing Guidelines
- Default to `pytest`. Use markers from `src/tests/conftest.py` such as `--runpostgres` or `--runui` when needed.
- Group tests for the same unit using `Test*` classes that mirror the unit's name.
- Put tests next to the mirrored implementation area:
  - CLI: `src/tests/_internal/cli`.
  - Server: `src/tests/_internal/server`.
  - Core/backends: `src/tests/_internal/core/backends`.
  - Public API: `src/tests/api`.
  - Plugins: `src/tests/plugins`.
- Keep tests hermetic. Default pytest disables external sockets and allows only localhost and Unix sockets; mock cloud APIs and other network calls.
- Feature flags are disabled by an autouse fixture in `src/tests/conftest.py`; monkeypatch `FeatureFlags` in tests that need a flag enabled.
- UI tests are skipped unless `--runui` is passed.
- Postgres tests are skipped unless `--runpostgres` is passed and require Docker/testcontainers.
- Mark Windows-sensitive tests with the existing `windows` or `windows_only` markers rather than relying on platform accidents.

## Docker
- Docker is optional for many local tasks, but required for container smoke tests and Postgres/testcontainers-backed tests.
- Install Docker Engine or Docker Desktop using the official instructions for your OS. On Ubuntu-like systems this repository also provides a helper script:

```sh
sudo bash scripts/install-docker-ubuntu.sh
```

- The script installs Docker Engine, CLI, containerd, Buildx, and Compose plugin from the Docker apt repo, starts Docker, and adds the sudo user to the `docker` group.
- If your network cannot reach Docker's apt repo, pass a mirror URL appropriate for your location:

```sh
sudo DOCKER_APT_BASE=https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/ubuntu \
  bash scripts/install-docker-ubuntu.sh
```

- If Docker Hub pulls are slow or incomplete on your network, configure a registry mirror in `/etc/docker/daemon.json`, then restart Docker. Example:

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
```

- Reopen the terminal after Docker installation so the `docker` group membership takes effect. Until then, use `sudo docker ...` if needed.
- `dstack worker` stores local workspaces under `DSTACK_WORKER_DATA_DIR` when set. By default, root workers use `/var/lib/dstack/worker` and non-root workers use `~/.dstack/worker`; set the environment variable for dedicated data disks or restricted hosts.
- Quick verification:

```sh
docker version
docker run --rm hello-world
docker run --rm python:3.11-slim python --version
```

- `python:3.11-slim` is the lightweight default runtime image for local container creation smoke tests.

## Verification Notes
- Default Python checks:

```sh
ruff check .
ruff format .
pyright -p .
pytest
```

- Use narrower pytest targets during development, then broaden based on risk.
- CI lint uses `pre-commit run -a --show-diff-on-failure`, not only Ruff.
- Pyright checks only the include list in `pyproject.toml`; code outside that list may not be type checked by `pyright -p .`.
- CI runs pytest with `-n auto`; UI tests are included after frontend artifacts are available.
- Ubuntu CI includes Postgres tests; macOS does not because Docker is unavailable there.

## Frontend
- Stack: React 18, TypeScript, Redux Toolkit/RTK Query, React Router, webpack 5, Babel, Jest/jsdom, ESLint/Prettier, Sass/CSS modules.
- Key directories: `frontend/src/App`, `frontend/src/pages/Console`, `frontend/src/services`, `frontend/src/ui`, `frontend/src/hooks`, `frontend/src/libs`, `frontend/src/types`, and `frontend/src/assets`.
- Dev server:

```sh
dstack server --port 8000
cd frontend
npm ci
npm run start
```

- The webpack dev server proxies API calls to `http://127.0.0.1:8000`.
- Build and integrate static UI:

```sh
cd frontend
npm run build
cd ..
rsync -a --delete frontend/build/ src/dstack/_internal/server/statics/
```

- Or use `scripts/build_frontend.sh`, which installs dependencies, builds, removes the old static directory, and copies the new build.
- Frontend verification: `cd frontend && npm run eslint && npm test && npm run build`.
- Every frontend-related code, asset, style, dependency, webpack, or generated API change must finish with `npm run build` and a refreshed `src/dstack/_internal/server/statics` copy.
- `npm run generate-api` depends on a running server at `http://127.0.0.1:8000/openapi.json`.

## Docs
- MkDocs config: `mkdocs.yml`; docs source root is `mkdocs`, and main user docs are under `mkdocs/docs`.
- Custom build hooks and generators live in `scripts/docs`.
- Docs build requires Python 3.11 or newer for all docs dependencies.
- Preview/build:

```sh
mkdocs serve --livereload -s
mkdocs build -s
```

- Expensive generation can be disabled with environment flags during local preview:

```sh
export DSTACK_DOCS_DISABLE_LLM_TXT=1
export DSTACK_DOCS_DISABLE_CLI_REFERENCE=1
export DSTACK_DOCS_DISABLE_YAML_SCHEMAS=1
export DSTACK_DOCS_DISABLE_OPENAPI_REFERENCE=1
export DSTACK_DOCS_DISABLE_REST_PLUGIN_SPEC_REFERENCE=1
```

- Reference docs may use `#SCHEMA#` placeholders expanded at build time.
- HTTP API docs use `!!swagger openapi.json tag="..."!!`; keep tag names aligned with the generated OpenAPI schema.
- Check generated docs artifacts when touching docs tooling: `site/llms.txt`, `site/llms-full.txt`, and `site/.well-known/skills/index.json`.

## Runner, Shim, and Gateway
- `dstack-runner` runs inside job containers and handles env/secrets, commands, logs, status, and graceful termination.
- `dstack-shim` runs on VM-style providers and manages Docker image pull, container lifecycle, mounts, GPU forwarding, and termination.
- Server communication with runner/shim happens over HTTP through SSH tunnels.
- Root `.justfile` imports `runner/.justfile`, `frontend/.justfile`, and `mkdocs/.justfile`; run `just` to list available recipes.

## Dependency and Network Assumptions
- Tests should stay hermetic. Do not add tests that require external network access; mock external services and cloud APIs.
- Adding dependencies should be deliberate and reflected in `pyproject.toml` extras or the relevant package metadata.
- For frontend dependencies, update `frontend/package.json` and lockfile state as appropriate.

## Commit & Pull Request Guidelines
- Commit messages follow the existing style: short, imperative summaries (e.g., "Fix exclude_not_available ignored"); include rationale in the body if needed.
- For PRs, describe behavior changes and link related issues.
- Include screenshots or terminal output when touching UX/CLI messages or frontend flows.
- Always disclose AI Assistance in PRs.
