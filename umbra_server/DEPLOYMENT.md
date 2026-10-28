# Server deployment

Deploy the Rust server as an independent long-lived service or container with WebSocket support. Frontend and website assets are hosted separately. Hosting vendor, orchestration platform, authentication provider, and production S3 provider remain product decisions.

## Service and network

Build a release binary using the committed Cargo.lock and a documented Rust toolchain. Supply production configuration through the deployment environment. Listen on the interface/port expected by the host, terminate TLS at the selected service/proxy, and expose HTTPS plus WSS to clients. Keep database and object-administration interfaces private.

Configure the proxy/load balancer to forward WebSocket upgrade headers and preserve long-lived connections. Set idle/request timeouts consistently with heartbeat behavior. Account for service draining and client reconnects during rollout. Trust forwarded client/protocol headers only from known proxies; do not blindly accept client-provided forwarding headers for security decisions.

Set exact browser origins for HTTP CORS and separately validate WebSocket origins. Credentialed cookies require compatible secure/same-site/domain settings and CSRF protection for relevant HTTP operations. Document native application origins and authentication separately; origin checks do not authenticate non-browser clients. Do not solve deployment failures with a blanket permissive origin policy.

## Persistence and secrets

Use a production PostgreSQL database with appropriate TLS, least-privilege roles, connection limits, backups, and tested restores. Run migrations using the strategy selected in [Data](DATA.md). Design rollout order so old server/client versions remain compatible during changes.

Provision a private S3-compatible bucket and credentials with the required scope. Configure endpoint, region, path-style behavior, transfer CORS, lifecycle/retention, and publicly reachable signing endpoint deliberately. Local development defaults are not production credentials. Inject database/storage/signing/provider secrets through the host's secret mechanism and exclude them from build artifacts and logs.

Monitor database and object metadata together; restoring one without the other can produce broken references. Define backup/recovery objectives from product requirements rather than assuming the storage provider covers the whole application.

## Operations and scaling

Expose `/health/live` and `/health/ready` as defined in [Protocol](PROTOCOL.md). Readiness should reflect dependencies actually needed for serving work and remain bounded; it must not report success solely because the process exists. Coordinate readiness with graceful draining so the platform stops routing before shutdown deadlines expire.

Use structured correlation logs and basic measurements for latency, errors, active sockets, queue pressure, database pools, and storage failures. Keep secrets/user payloads out of routine logs. Configure resource limits and graceful SIGTERM handling for the selected platform.

Begin with one instance if sufficient. Before scaling out, solve cross-instance event delivery, authentication revocation, idempotency storage, and cursor recovery. Sticky connections alone do not propagate changes from one instance to another. Use a durable outbox/log only when guarantees require it; document the resulting delivery semantics.

Validate against the real deployed domains: health/readiness, a committed operation, subscription delivery, proxy idle behavior, reconnect after a rollout, authenticated browser/native requests, and an authorized object transfer if implemented. A local green check does not establish production proxy/origin behavior.
