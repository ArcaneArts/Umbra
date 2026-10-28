# Umbra template

Umbra is a documentation-first starting point for an AI-assisted application. It supplies component boundaries, suggested implementation choices, configuration and command contracts, and working PostgreSQL/MinIO development infrastructure. It does not yet contain an application, Rust service, public website, or native platform projects.

## Start here

1. Record your product requirements in [`docs/`](../README.md).
2. Follow [Bootstrap](BOOTSTRAP.md) to initialize the components around those requirements.
3. Use [Architecture](ARCHITECTURE.md) for shared boundaries and [Configuration](CONFIGURATION.md) for environment ownership and addresses.
4. Read the component documents linked below before changing that component.

| Location | Owns |
| --- | --- |
| [`umbra_app/`](../../umbra_app/README.md) | One frontend delivered on web, Tauri desktop, and Capacitor mobile |
| [`umbra_server/`](../../umbra_server/README.md) | Rust API, authorization, PostgreSQL, S3, and pushed events |
| [`umbra_site/`](../../umbra_site/README.md) | Static public website, downloads, policies, and Open App link |
| [`docs/`](../README.md) | The consuming project's requirements, plans, and decisions |
| [`scripts/`](../../scripts/README.md) | Local infrastructure and process orchestration |

## What runs now

Install Node.js and pnpm, with Docker Engine/Desktop and Docker Compose available. The checked-in Node/pnpm versions and container pins are described in [Scripts](../../scripts/README.md). From the repository root:

```sh
pnpm install
pnpm infra:up
pnpm infra:logs
pnpm infra:down
```

No `.env` is required for the local defaults. Copy `.env.example` to `.env` to customize them. The first infrastructure startup builds MinIO and its CLI from pinned upstream source; subsequent starts reuse the image/build cache.

After the consuming project implements the [component command hooks](../../scripts/README.md#component-hooks), `pnpm dev` starts infrastructure, the Rust server, and the web app. `pnpm devtop` starts infrastructure, the Rust server, and Tauri. `pnpm dev:site` runs the public website independently. These commands attempt the actual component commands and fail honestly until those projects exist.

## How to interpret this template

**Requirements** preserve the intended architecture: pnpm entry points; shared web frontend with Tauri desktop and Capacitor mobile; independent Rust server; PostgreSQL; S3-compatible storage with local MinIO; separate static public website; pushed updates rather than recurring polling.

**Defaults** are coherent starting choices that can be replaced deliberately: TypeScript/Vite, Axum/Tokio/SQLx, JSON protocol messages, ports, folder layouts below each component, and deployment providers. Keep documented interfaces consistent when changing a default.

**Product decisions** need actual requirements: UI framework and styling, domain model, authentication provider/session policy, offline features, retention, analytics, notifications, release channels, and hosting vendors. Do not invent them to fill template gaps.

When adopting Umbra, keep this guidance as a reference and update it as choices change. The root README can stay a short pointer, or become the product's README after adoption. Keep agent entry points concise; agents should read detailed documents only when their task needs them.
