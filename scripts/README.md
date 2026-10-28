# Development tooling

The root package exposes pnpm commands, `dev.mjs` supervises host processes and invokes Docker Compose, and `compose.dev.yaml` defines PostgreSQL and MinIO. These are real tools. Application/server/site projects remain uninitialized until [bootstrap](../docs/umbra/BOOTSTRAP.md).

## Runtime and reproducibility

Use the Node version in [`.node-version`](../.node-version) (24.14.0) and pnpm 11.15.1 from root `packageManager`. The supported Node floor is 22.13, matching pnpm's requirement. Use Docker Engine/Desktop with Compose v2 and BuildKit. No third-party Node runtime dependencies are needed. `pnpm install` establishes the workspace/lockfile; future component manifests are discovered through `pnpm-workspace.yaml`.

PostgreSQL 17.11 uses the immutable image digest in `compose.dev.yaml`. MinIO server source `RELEASE.2025-09-07T16-13-09Z` and CLI source `RELEASE.2025-08-13T08-35-41Z` are downloaded with SHA-256 verification in `Minio.Dockerfile`; Go and Alpine base images are pinned by digest. The upstream MinIO repository is archived and its former published images were unavailable during template validation, so local builds use verified source instead of `latest`. The first build requires network access and takes longer than subsequent cached starts. See [upstream MinIO](https://github.com/minio/minio), [upstream CLI](https://github.com/minio/mc), and the Dockerfile for exact pins and included licenses.

Update pins deliberately, run `pnpm infra:compose -- build minio` to rebuild an existing MinIO image, and repeat real PostgreSQL/S3 and persistence checks. Ordinary startup reuses an existing image. Source checksums are provenance/reproducibility checks, not environment-readiness guesses. The image is development infrastructure; a production object-storage deployment needs its own operational choice.

## Commands

| Root command | Behavior |
| --- | --- |
| `pnpm dev` | Start/reuse detached infrastructure, execute a real SQL query and bucket creation, then supervise Rust and app web hooks |
| `pnpm devtop` | Same infrastructure/server, with the Tauri desktop hook instead of the web hook |
| `pnpm dev:site` | Supervise only the public website |
| `pnpm infra:up` | Start/reuse PostgreSQL/MinIO, retry a real SQL query and private bucket creation |
| `pnpm infra:down` | Remove this project's containers/network; preserve named data volumes |
| `pnpm infra:logs` | Follow this project's PostgreSQL/MinIO logs |
| `pnpm infra:compose -- ARGS` | Run Docker Compose with this checkout's namespace/config/environment |
| `pnpm test:tooling` | Verify supervisor behavior with temporary command fixtures; no Docker required |

Additional `dev`, `devtop`, or `dev:site` arguments, with an optional leading `--`, go to the selected frontend hook. They do not go to Cargo or infrastructure commands. `infra:compose` is deliberate raw access; destructive options such as `down --volumes` delete this namespace's data and should be used only when intended.

## Component hooks

| Component | Actual command invoked | Future project responsibility |
| --- | --- | --- |
| Server | `cargo run --manifest-path umbra_server/Cargo.toml` from root | Executable Cargo project with one default binary; consume server environment |
| App web | `pnpm --dir umbra_app run dev:web --host HOST --port PORT` | Shared frontend development server; honor host/port and fail if occupied |
| App desktop | `pnpm --dir umbra_app run dev:desktop` | Tauri dev; its `beforeDevCommand` owns the one frontend development process |
| Site | `pnpm --dir umbra_site run dev --host HOST --port PORT` | Independent static-site development server |

See [App development](../umbra_app/DEVELOPMENT.md) for the internal `dev:tauri-web` hook and Tauri config, and [Server development](../umbra_server/DEVELOPMENT.md) for direct Cargo use. These hooks deliberately attempt real commands. Missing manifests/scripts produce the underlying tool's failure; there is no stub or successful skip. Infrastructure can run before those manifests exist.

## Process and data ownership

Compose resources use an explicit project namespace derived from the checkout's real path, or `UMBRA_PROJECT_NAME` when supplied. Volumes, networks, and built-image names are scoped to that namespace. No fixed container names, global prune, port-based killing, or automatic orphan removal are used. Choose distinct ports for simultaneous checkouts; see [Configuration](../docs/umbra/CONFIGURATION.md).

Infrastructure has an explicit detached lifetime: both successful and failed development sessions leave it available until `pnpm infra:down`. This avoids stopping a database being used by another terminal/session. Volumes survive ordinary down/up. Docker startup may leave partially started resources if it fails; inspect logs and use `infra:down` for this namespace when needed.

The supervisor owns only the host command/process trees it starts. If a supervised application command exits, it stops its siblings and exits with that command's status. A successful desktop exit ends the session successfully. Ctrl+C/SIGINT exits 130; SIGTERM exits 143. Commands that cannot spawn exit 127. POSIX children run in invocation-owned process groups; shutdown sends TERM, allows up to five seconds, then kills remaining group members. Windows uses `taskkill /T /F` for invocation-owned child trees; run commands through pnpm so its Node CLI path is available. Platform-specific verification is recorded separately.

The tool never inspects a manifest, probes a free port, or checks Docker status as a gate before starting. Infrastructure setup retries actual SQL/S3 operations with bounded attempts. A genuine startup or connection error is shown and eventually returned. Server/frontend startup then runs concurrently; clients must handle the service starting or reconnecting.

## Configuration and evidence

[Configuration](../docs/umbra/CONFIGURATION.md) owns environment precedence, derived URLs, public/private settings, and network addresses. Root scripts work from any current directory when invoked with pnpm's directory selection; relative paths resolve from this checkout. `.env` is optional and never executed as shell code.

[Validation](../docs/umbra/VALIDATION.md) records checks performed on this template and their limits. Tooling fixtures test command selection, errors, signals, and cleanup. They are not a Rust, Tauri, Capacitor, frontend, or website implementation.
