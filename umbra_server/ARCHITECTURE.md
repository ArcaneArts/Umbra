# Server architecture

## Starting choices

**Required:** Rust, PostgreSQL, S3-compatible storage, independent service deployment, and pushed updates instead of recurring HTTP polling. **Replaceable defaults:** Axum for HTTP/WebSockets, Tokio for async runtime, SQLx for SQL/migrations, Serde for wire serialization, and tracing for structured diagnostics. **Product decisions:** domain model, authentication provider, session policy, tenancy, durable event replay, job processing, and deployment vendor.

Use the [Axum documentation](https://docs.rs/axum/latest/axum/), [Tokio documentation](https://docs.rs/tokio/latest/tokio/), and [SQLx repository](https://github.com/transact-rs/sqlx) when choosing compatible dependencies. Pin versions and commit Cargo.lock when creating this executable. No Cargo project exists in the template yet.

## Responsibilities

Start with one executable and small modules for configuration, application state, transport handlers, business operations, database queries, storage, and event delivery. This is a responsibility map, not a requirement to generate empty modules or multiple crates. Extract modules as they gain code.

Construct shared application state once: validated config, database pool, S3 client(s), and bounded event/subscription infrastructure. Keep the pool/SDK clients reusable rather than connecting per request. Pass authenticated principals into business operations; transport handlers parse/validate input and translate results into the [protocol](PROTOCOL.md).

Both HTTP handlers and socket requests call the same business operation where they represent the same action. Authorization, constraints, transaction handling, and idempotency cannot live only in one transport handler. Keep database models, domain results, and public DTOs separate when their semantics differ; never serialize credentials or internal columns merely because a database struct supports serialization.

The service owns PostgreSQL and storage access. It does not expose a generic SQL interface, unrestricted object-key signer, or native-client bypass. Tauri and Capacitor clients have the same server permissions as web clients.

## Runtime and failure handling

At startup, parse configuration without logging secrets, connect through a bounded retry policy, run or verify migrations according to the selected [migration strategy](DATA.md), construct storage clients, and bind the listener. Test actual operations; an open TCP port does not prove credentials/schema/storage work. Local tooling already creates the development bucket; production provisioning is a deployment responsibility.

Use typed internal errors and map them to stable public errors. Include correlation identifiers in logs and responses, with private details only in appropriate server logs. Apply input limits, timeouts, and bounded concurrency at operations that consume resources. Do not hold a database transaction open while waiting for a socket client or uploading object bytes.

Avoid blocking the async runtime with CPU-heavy work or blocking libraries. Use Tokio's appropriate blocking/task facilities when needed. Preserve cancellation semantics: a disconnected client does not automatically roll back a committed operation. [Mutation retry rules](PROTOCOL.md) must handle ambiguous outcomes.

Use structured logs for startup/shutdown, operation failures, connection lifecycle, subscription counts, and data/storage errors. Redact tokens, cookies, database URLs, object signing URLs, and credentials. Use request/connection IDs for correlation; avoid logging every message body or sensitive payload by default.

## Events and lifecycle

Publish only after commit. Start with one server instance and an in-memory broadcaster if fresh snapshots on reconnect satisfy the product. Bound per-client outgoing queues and disconnect slow consumers with a recoverable resynchronization requirement. Socket state must not become the only record of a committed operation.

If delivery must survive a crash between commit and broadcast, use a transactional outbox or equivalent durable mechanism. Adding replicas requires cross-instance delivery and shared session/revocation behavior; PostgreSQL LISTEN/NOTIFY alone is not a durable replay log. Add infrastructure only for demonstrated requirements.

On SIGINT/SIGTERM, stop accepting new work, notify/close sockets, allow bounded in-flight operations to finish, cancel background tasks, and close the pool/clients. Use a shutdown deadline aligned with the deployment platform. Report startup/runtime failures with nonzero exit codes; do not conceal failures behind an endless retry loop.
