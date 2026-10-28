# App instructions

Read [Architecture](ARCHITECTURE.md) and the document relevant to your task. Implement shared frontend behavior once, with small adapters for Tauri, Capacitor, and browser capabilities. Keep server business rules and authorization on the server.

Follow the [server protocol](../umbra_server/PROTOCOL.md), [public configuration contract](../docs/umbra/CONFIGURATION.md), and [command hooks](../scripts/README.md#component-hooks). Tauri owns its internal frontend development process in desktop mode. Never load server credentials into frontend configuration.

This directory is documentation-only until product scaffolding is requested. UI framework, styling, authentication provider, and offline behavior need product decisions.
