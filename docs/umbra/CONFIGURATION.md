# Configuration contract

## Loading and ownership

The root tooling reads `.env.example` as local defaults, optionally overlays root `.env`, then overlays the shell environment. Values use Node's dotenv syntax; there is no shell execution or `${VAR}` expansion. Unset derived URLs are calculated after this merge. An explicitly supplied URL wins, so update explicit URLs when changing their ports.

`.env` is ignored by Git. `.env.example` contains development-only values and public examples. Production deployments inject configuration through their own environment/secret system. Frontend configuration is build-time unless the consuming project deliberately implements a public runtime config document.

The supervisor passes root server configuration to the Rust process and passes only the documented public/host/port settings from the root configuration to app/site processes. Existing shell variables are inherited, except the known server secret keys are removed for frontend children. This is configuration hygiene, not a sandbox; never configure a frontend bundler to expose all environment variables or load the root server environment as public configuration.

## Local settings

The complete editable default set is [`.env.example`](../../.env.example). These are development settings; changing them does not configure a production deployment.

| Variable | Default / derivation | Consumer |
| --- | --- | --- |
| `UMBRA_PROJECT_NAME` | `umbra-` plus a hash of the checkout's real absolute path | Compose namespace and image names |
| `DEV_BIND_HOST` | `127.0.0.1` | Published PostgreSQL/MinIO ports |
| `POSTGRES_PORT` | `54329` | Host PostgreSQL port |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Development credentials/name in `.env.example` | PostgreSQL initialization and server URL |
| `DATABASE_URL` | Encoded credentials at `127.0.0.1:POSTGRES_PORT/POSTGRES_DB` | Rust server |
| `MINIO_PORT`, `MINIO_CONSOLE_PORT` | `19000`, `19001` | Host S3/API and console ports |
| `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | Development credentials in `.env.example` | MinIO and development S3 credentials |
| `S3_ENDPOINT` | `http://127.0.0.1:MINIO_PORT` | Server S3 operations |
| `S3_PUBLIC_ENDPOINT` | `S3_ENDPOINT` | Server's presigned-URL client |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | MinIO development credentials | Server only |
| `S3_REGION`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE` | `us-east-1`, `umbra-dev`, `true` | Server; bucket name also used by local initialization |
| `SERVER_HOST`, `SERVER_PORT` | `127.0.0.1`, `8080` | Rust listen address |
| `APP_HOST`, `APP_PORT` | `127.0.0.1`, `5173` | App development server |
| `SITE_HOST`, `SITE_PORT` | `127.0.0.1`, `4321` | Site development server |
| `PUBLIC_API_URL` | `http://127.0.0.1:SERVER_PORT` | Public client API base |
| `PUBLIC_WS_URL` | Public API origin with `ws`/`wss`, path `/ws` | Public socket URL |
| `PUBLIC_APP_URL` | `http://127.0.0.1:APP_PORT` | Site Open App destination |
| `PUBLIC_SITE_URL` | `http://127.0.0.1:SITE_PORT` | Public website/canonical origin |
| `ALLOWED_ORIGINS` | Local app and site origins | Server HTTP CORS and WebSocket origin validation |
| `RUST_LOG` | `info,umbra_server=debug` | Rust tracing filter |

The tooling maps `PUBLIC_API_URL` and `PUBLIC_WS_URL` to `VITE_API_URL` and `VITE_WS_URL` for the proposed Vite app. The website hook receives `PUBLIC_APP_URL` and `PUBLIC_SITE_URL`; adapt these to the chosen framework's explicit public configuration convention. Define additional public values deliberately rather than copying the root environment wholesale.

Host/port settings are passed to frontend hooks as `--host HOST --port PORT`; hooks must honor these arguments and fail on occupied ports. The Tauri hook forwards its arguments to Tauri itself; see [App development](../../umbra_app/DEVELOPMENT.md) for its internal frontend hook.

## Addresses across environments

| Caller | PostgreSQL | Object storage | Application API |
| --- | --- | --- | --- |
| Host Rust server | `127.0.0.1:54329` | `http://127.0.0.1:19000` | Listens at `127.0.0.1:8080` |
| Compose initialization/diagnostic jobs | `postgres:5432` | `http://minio:9000` | Host API requires an explicitly reachable host address |
| Host browser / desktop webview | No direct access | Presigned URL using public endpoint | Public API and socket URLs |
| Physical phone | No direct access | Developer machine's LAN address if transfers are tested | Developer machine's LAN address, never the phone's localhost |
| Production clients | No direct access | Public HTTPS object endpoint | Public HTTPS/WSS API endpoint |

For a phone, bind the server and frontend to a reachable interface, set public URLs to the developer machine's reachable address, update the origin allowlist, and set `S3_PUBLIC_ENDPOINT` if using direct transfers. `0.0.0.0` is a listening address, not a public destination. Docker service names work only inside the Compose network. Keep the console private; clients use the S3 API port.

Presign requests with the endpoint the client actually reaches. Rewriting a signed URL's host/path after signing can invalidate its signature. If server and client need different S3 endpoints, configure separate SDK clients for operations and signing. Define bucket CORS for actual browser transfer origins when direct uploads/downloads are implemented; bucket initialization here leaves the bucket private and does not invent a CORS policy.

## Secrets and lifecycle

Server-only values include database URLs/passwords, S3 credentials, signing keys, and any future provider secrets. Public values include API endpoints, app/site URLs, and native bundle identifiers. Never prefix secrets with `VITE_` or another framework's public prefix. Do not put tokens in persistent logs or socket query strings.

PostgreSQL initialization credentials apply when its data volume is first created. Changing `.env` does not alter existing database roles/passwords; use SQL to change them or deliberately recreate disposable data. The same principle applies to migrations: service startup must use actual database operations and report errors, not infer readiness from a port or container label.

The checkout path determines the default infrastructure namespace. Moving a checkout changes that namespace; use an explicit stable `UMBRA_PROJECT_NAME` to retain the old one. Two checkouts can have isolated containers and volumes but still need distinct host ports when running simultaneously.
