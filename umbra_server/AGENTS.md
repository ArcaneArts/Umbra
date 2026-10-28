# Server instructions

Read [Architecture](ARCHITECTURE.md) and [Protocol](PROTOCOL.md) before adding endpoints or events. Read [Data](DATA.md) before persistence changes. Use Rust and keep application APIs separate from static frontend hosting.

Use WebSocket subscriptions for ongoing updates. Keep business operations reusable across HTTP and sockets; enforce authorization for each operation and subscription, and commit state before acknowledging/publishing. Keep queues bounded and make reconnect recovery explicit.

Use PostgreSQL and S3-compatible storage, with the provided Docker development infrastructure. Tests must use isolated databases/object namespaces. Follow [Configuration](../docs/umbra/CONFIGURATION.md) and the [Cargo entry-point contract](../scripts/README.md#component-hooks). Never log credentials or claim a tooling fixture proves real server behavior.

The server is uninitialized until product scaffolding is requested. Axum/Tokio/SQLx are defaults, not a pre-existing implementation.
