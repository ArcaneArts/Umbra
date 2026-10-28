# Application

This directory currently contains implementation guidance. Build one shared frontend for a static web deployment, a Tauri desktop wrapper, and Capacitor iOS/Android wrappers. The application connects to the independently deployed Rust server; desktop packaging does not embed that service by default.

| Read | For |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Shared logic, platform boundaries, state, authentication, routing |
| [Development](DEVELOPMENT.md) | Required commands, frontend/Tauri integration, mobile development |
| [Distribution](DISTRIBUTION.md) | Static hosting, desktop bundles, mobile releases |
| [Configuration](../docs/umbra/CONFIGURATION.md) | Public URLs, addresses, secrets, and environment loading |
| [Server protocol](../umbra_server/PROTOCOL.md) | Wire messages and connection/recovery semantics |

TypeScript and Vite are replaceable defaults. Choose the UI framework and styling system from the product's requirements. The first implementation should preserve ordinary browser operation and keep native APIs behind platform adapters.
