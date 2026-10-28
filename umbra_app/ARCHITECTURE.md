# Application architecture

## Decisions and boundaries

**Required:** one shared frontend; browser delivery; Tauri desktop; Capacitor mobile; independent Rust server; pushed updates for live state. **Default:** TypeScript, Vite, static build output `dist/`, and JSON wire messages. **Product decisions:** UI framework, styling, state/query libraries, authentication/session design, offline behavior, and native features.

Keep presentation, application actions/state, server transport, and platform capabilities separable. Start with small modules rather than a mandatory framework architecture. An illustrative future layout is `src/features/`, `src/transport/`, `src/platform/`, and `src/config/`; create these only when they have actual responsibilities.

Feature code calls application actions and capability interfaces. Transport code owns wire serialization, validation, HTTP errors, and the socket lifecycle. Platform adapters own native/plugin imports, secure storage, file selection, external navigation, and lifecycle events. UI components should not select native implementations or scatter platform checks throughout features. Detect unsupported capabilities and present useful browser fallbacks where appropriate.

Keep Tauri Rust commands focused on desktop capabilities. The Tauri process is a client-side trust boundary, not the application backend. Put shared business rules and authoritative data checks in `umbra_server/` so web and mobile receive the same behavior.

## State and server integration

Treat server state, temporary UI state, and platform persistence separately. Choose a simple cache/store appropriate to the framework. Cache identifiers and wire data, not database row types or native objects. Preserve decimal, timestamp, and nullable-field semantics explicitly; JSON numbers cannot represent every Rust/PostgreSQL integer exactly.

Use the [protocol](../umbra_server/PROTOCOL.md) as the source for event and request behavior. Centralize the socket connection rather than opening one per component. Model disconnected, connecting, authenticating, synchronizing, live, and terminal failure states as useful to the product. Do not label the UI live before its snapshot/subscriptions are synchronized.

On reconnect, use bounded jittered backoff, authenticate again, restore current subscriptions, and resume from valid cursors or fetch a new snapshot. On mobile background/resume and desktop sleep/wake, assume the connection may have died and validate it through real protocol activity. Do not add periodic HTTP polling as the default recovery mechanism. A heartbeat is connection liveness, not application data polling.

Apply events only to their intended subscription and reconcile revisions/cursors. Discard obsolete subscription responses after navigation. Handle duplicate events safely where at-least-once delivery is used. Cancel or ignore stale HTTP requests so an older response cannot overwrite newer state. Optimistic changes need an explicit rollback/reconciliation path; transport reconnect does not imply that a timed-out mutation failed.

## Authentication and configuration

Choose a session design that works for a hosted browser and native wrappers. A cookie approach requires explicit credentialed CORS, secure cookie policy, CSRF protection where applicable, and WebSocket origin checks. A token approach requires expiration, refresh/revocation handling, safe storage, and a socket authentication mechanism compatible with browser WebSocket APIs. Do not assume arbitrary Authorization headers can be set on a browser WebSocket handshake.

Use system-browser authorization and verified redirect handling where the selected provider/native flow requires it. Keep provider secrets on the server. Handle logout by clearing local identity/cache/subscriptions and closing the authenticated socket; reauthentication must not leak one account's cached state to another.

Read public settings through one validated configuration module. [Configuration](../docs/umbra/CONFIGURATION.md) owns names and addresses. Use `VITE_API_URL` and `VITE_WS_URL` for the default app, with build-time production values. Report invalid configuration explicitly; silently falling back to a production endpoint from a broken development setup is dangerous. Never bundle root server environment values.

## Routing, links, and platform storage

Choose browser routing together with hosting. History routing needs an index fallback for application routes; hash routing is an acceptable deliberate default when the host cannot support rewrites. Confirm desktop/mobile asset paths and routing work without a traditional web server. A route should represent navigable product state rather than native process state.

Handle native deep links through a single parser and route dispatcher. Validate schemes, hosts, paths, state/nonces for authentication, and whether the user may open the destination. Handle both a cold launch and a link delivered to an existing window. Buffer a valid destination until initialization/authentication completes. Document app links/universal links and custom schemes when enabled.

Use browser memory for ephemeral state, IndexedDB or equivalent for intentional durable browser data, and platform secure storage for native credentials where supported. Browser localStorage is readable by scripts on that origin; do not treat it as secure credential storage. A generic native preferences plugin is not automatically a secure keystore. Choose and document an adapter that actually provides the required protection.

Request native permissions when a feature needs them and handle denial/revocation. Define Tauri capabilities/CSP and Capacitor plugin permissions for the actual feature set. Avoid broad filesystem/shell permissions. Offline support, background tasks, push notifications, and durable mutation queues remain product decisions; each introduces lifecycle and consistency obligations beyond a socket reconnect.
