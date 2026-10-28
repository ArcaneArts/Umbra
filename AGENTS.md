# Working in Umbra

This repository starts as an application template: documentation plus development tooling. The app, server, website, and native projects are intentionally uninitialized. Read [the template guide](docs/umbra/README.md) and the relevant component's instructions before implementing a product.

## Map and boundaries

- `umbra_app/`: shared web frontend; Tauri desktop wrapper; Capacitor iOS/Android wrappers. See its [instructions](umbra_app/AGENTS.md).
- `umbra_server/`: independent Rust application API; PostgreSQL and S3 storage. It never serves either frontend. See its [instructions](umbra_server/AGENTS.md).
- `umbra_site/`: independent static public website, downloads, policies, and Open App link. See its [instructions](umbra_site/AGENTS.md).
- `docs/`: consuming project's requirements, plans, and decisions. `docs/umbra/` owns shared template guidance.
- `scripts/`: pnpm development orchestration and Docker infrastructure. Read [its contract](scripts/README.md) before modifying commands.

## Essential rules

Prefer WebSocket subscriptions and pushed updates over periodic HTTP polling. Keep the server authoritative for permissions and durable state. Share frontend logic across targets through small platform adapters. Keep server credentials out of frontend configuration and bundles.

Distinguish requirements from replaceable defaults and product decisions. Record changed decisions in the document that owns them; link instead of duplicating guidance. Do not introduce product-specific behavior without product requirements. Once scaffolding is requested, follow [the bootstrap sequence](docs/umbra/BOOTSTRAP.md).

Use pnpm at the repository root; Cargo owns Rust builds. `pnpm infra:up`, `infra:down`, and `infra:logs` work before application scaffolding. `pnpm dev`, `devtop`, and `dev:site` require the component hooks documented in `scripts/README.md`. `pnpm test:tooling` checks the supervisor with temporary fixtures; it is not application testing.

Attempt actual operations and surface their errors. Avoid inferred environment gates, broad process killing, and automatic deletion of persistent data. Preserve unrelated work and resources. If `docs/MANUAL_CHANGE_PROTOCOL.md` exists, follow it for changes.
