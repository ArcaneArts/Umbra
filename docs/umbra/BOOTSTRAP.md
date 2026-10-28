# Build a product from Umbra

Follow this sequence when the user asks to initialize a product. The component directories currently contain documentation, not runnable projects. Infrastructure can run immediately; application commands become usable as the hooks below are implemented.

## 1. Record the product

Create a short requirements document in [`docs/`](../README.md): purpose, users, core actions, first end-to-end flow, sensitive data, target platforms, deployment constraints, and known exclusions. Record unresolved decisions instead of guessing business rules. Start with the smallest useful flow that crosses the UI, API, and persistence boundary.

Choose which targets to build first. Web is a useful default for validating the shared client/server flow; desktop and mobile retain the same service boundary. Decide whether offline behavior is required before designing a durable mutation queue or conflict handling.

## 2. Adopt names and remaining defaults

Replace the Umbra title, package names, app display name, desktop/mobile identifiers, URL schemes, domains, download destinations, bucket/database names, and native signing identities as relevant. Keep directory names if useful; renaming is optional. Update orchestration paths/workspace patterns if directories change. Do not rename an existing Compose namespace without accounting for its volumes.

Select a UI framework and styling approach; an authentication/session design suitable for browsers and native clients; a static-site framework; and deployment providers. TypeScript/Vite and Axum/Tokio/SQLx are starting defaults. Verify compatible current versions in official documentation, pin direct tool/dependency versions deliberately, and commit the pnpm and Cargo lockfiles once generated. Keep Cargo as the Rust dependency manager.

## 3. Initialize component interfaces

Read [App architecture](../../umbra_app/ARCHITECTURE.md), [Server architecture](../../umbra_server/ARCHITECTURE.md), and [Site](../../umbra_site/README.md). Create actual projects inside their existing directories without overwriting their guidance. Scaffold only the targets requested for the product.

Implement the exact hooks in [Scripts](../../scripts/README.md#component-hooks): app `dev:web` and `dev:desktop`, site `dev`, and the server's `cargo run` entry point. The app web hook must accept host/port arguments and use a fixed port. Tauri's `beforeDevCommand` owns its frontend development server; root `devtop` must not start another one. Add production build commands to each component and document their artifacts.

Implement the server configuration contract, an HTTP health endpoint, and `/ws` using the [protocol](../../umbra_server/PROTOCOL.md). Browser authentication, native authentication, allowed origins, and permissions must be explicit before exposing user data. Define runtime message validation; do not treat generated TypeScript types as validation.

## 4. Establish real data operations

Run `pnpm install` and `pnpm infra:up`. Inspect [Configuration](CONFIGURATION.md), copy `.env.example` to `.env` only if customization is needed, and implement server configuration parsing without logging credentials. Use the dedicated development PostgreSQL and MinIO instances.

Add the first product migration, apply it through a documented command, and verify an actual transaction. Use [Data](../../umbra_server/DATA.md) for migration/concurrency and S3 ownership guidance. Add an isolated integration-test database and object namespace before tests write data. Implement storage authorization and transfer finalization only as the product needs them.

## 5. Complete one observable flow

Run `pnpm dev` and exercise a user action through the real frontend, server, and database. Verify authorization failures and useful errors as well as success. Confirm the UI receives a committed change through a subscription without periodic polling. Disconnect/reconnect the client and verify fresh state or cursor recovery. Ensure the initial fetch/subscription ordering does not miss intervening events.

If files are part of the first flow, upload and read a real object through the chosen authorized transfer design and verify browser CORS and reachable signed endpoints. Restart infrastructure and confirm intended data persists. Run integration tests against their isolated resources, not the interactive database.

Then run `pnpm devtop` on a supported desktop host and verify one frontend server is launched. Add Capacitor platforms after a real frontend build exists; sync that build, test physical-device addresses, lifecycle/reconnect, permissions, and deep links. Toolchain availability differs by platform, so report target-specific validation accurately.

## 6. Prepare public deployment and maintain evidence

Build and deploy the app and site as separate static artifacts, and the server as its own service. Configure production HTTPS/WSS addresses, exact origins, PostgreSQL, private storage, migration execution, and secrets. Follow [App distribution](../../umbra_app/DISTRIBUTION.md), [Server deployment](../../umbra_server/DEPLOYMENT.md), and [Site deployment](../../umbra_site/DEPLOYMENT.md).

Replace example marketing copy and policy placeholders with product-specific reviewed content. Publish real download/store destinations and configure Open App to the deployed web app. Keep signing material out of source control.

After each architectural change, update its authoritative document and link it from project decisions if needed. Replace template assumptions with actual commands and behavior. Document verification and remaining limitations without presenting tooling fixtures as application tests.
