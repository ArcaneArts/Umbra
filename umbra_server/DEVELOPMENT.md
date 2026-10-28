# Server development

The server is currently uninitialized. Create an executable Cargo project in this directory when product implementation begins. Root tooling runs `cargo run --manifest-path umbra_server/Cargo.toml` from the repository root, with [server environment settings](../docs/umbra/CONFIGURATION.md). Keep a default binary or set Cargo's `default-run` if adding multiple binaries.

Implement environment parsing for listen host/port, database URL, S3 endpoint/public endpoint, bucket, region, credentials, path-style mode, allowed origins, and tracing filter. Report invalid values explicitly without including secrets. Root tooling derives local URLs from configured ports; direct Cargo invocations need their environment supplied explicitly and do not automatically load root `.env`.

## Run and inspect

Before an app exists, run `pnpm infra:up` to start the real database and object service. After server/app hooks exist, `pnpm dev` starts the browser stack and `pnpm devtop` starts desktop mode. Use `pnpm infra:logs` to inspect container output and Ctrl+C to stop attached logs.

Use `pnpm infra:compose -- ps` and `pnpm infra:compose -- exec -T postgres ...` for scoped diagnostics. A real database query can be run as follows; the inner shell expands the container's initialization variables:

```sh
pnpm infra:compose -- exec -T postgres sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "SELECT current_database(), version();"'
```

The initialization job includes the pinned `mc` CLI and can be used for real S3 diagnostics through the same Compose network. See [Scripts](../scripts/README.md) for image/build details and raw Compose access. The bucket is private; add CORS only when implementing an actual direct-browser transfer flow.

`pnpm infra:down` removes the project's containers/network while keeping named data volumes. It never runs a global prune or deletes volumes. Changing PostgreSQL initialization credentials does not update existing database roles.

## Iteration and testing

Start with `cargo run`; add a pinned file watcher only if useful and keep the root entry point documented if changing it. Root orchestration does not require a third-party Rust watcher. Use the debugger/profiler directly with an explicitly supplied local environment when needed.

Add formatting, linting, and tests after source exists: `cargo fmt --check`, an appropriate `cargo clippy` invocation, and `cargo test`. Test pure business operations with focused unit tests and database/storage/socket behavior through real integration tests. [Data](DATA.md) owns test isolation. Include permission failures, malformed messages, disconnect/reconnect, duplicate mutation outcomes, and bounded queue behavior for the implemented scope.

`pnpm test:tooling` tests the template's process supervisor using temporary fixtures; it does not compile Rust or verify application behavior. The template's [validation record](../docs/umbra/VALIDATION.md) distinguishes actual infrastructure checks from fixtures and absent application tests.
