# Application protocol

This document defines default interfaces for the future server and clients. It is not an implemented API. Add product operations here before implementing them, and keep both transports consistent. JSON is the replaceable encoding default.

## Endpoints and authentication

Use `/ws` for a WebSocket upgrade. Provide HTTP `/health/live` for process liveness and `/health/ready` for readiness based on the service's actual required dependencies. Health responses expose no secrets. Additional HTTP endpoints should fit the product: authentication, initial queries, bounded commands, transfer authorization/finalization, and callbacks. Do not make clients repeatedly poll HTTP for live changes.

Choose authentication before exposing user data. Browser WebSocket APIs cannot set arbitrary handshake headers. Supported designs include an authenticated cookie handshake with strict origin validation, or an HTTPS-obtained short-lived single-use socket ticket/authentication message. Do not put reusable bearer tokens in logged URLs. The exact flow/provider remains a product decision.

Validate allowed browser origins on upgrades independently of HTTP CORS. Origin validation is not authentication, and native/non-browser clients can omit or forge it; require credentials and define an explicit policy for expected native origins. For post-upgrade authentication, accept only negotiation/authentication frames until success and enforce a short deadline. Recheck session expiry/revocation during long-lived connections according to the selected session design. Authorize every request and subscription scope, and react to permission changes.

## Default JSON envelope

Every application frame has integer `v` (initially `1`) and string `type`. Requests have a client-generated unique `id` within the connection and an `op`. Responses echo that ID and include either `ok: true` with a payload, or `ok: false` with an error. Events carry a server-issued subscription ID and an opaque cursor/revision suitable for the selected topic. Example shapes use placeholder topics, not a product domain:

```json
{"v":1,"type":"request","id":"r1","op":"subscribe","payload":{"topic":"product-defined-topic","after":null}}
{"v":1,"type":"response","id":"r1","ok":true,"payload":{"subscription_id":"s1","snapshot":{},"cursor":"opaque-c1"}}
{"v":1,"type":"event","subscription_id":"s1","cursor":"opaque-c2","payload":{}}
{"v":1,"type":"request","id":"r2","op":"unsubscribe","payload":{"subscription_id":"s1"}}
{"v":1,"type":"response","id":"r2","ok":true,"payload":{}}
{"v":1,"type":"response","id":"r3","ok":false,"error":{"code":"forbidden","message":"Access denied","retryable":false}}
```

Define each operation's payload/result schema and each topic's allowed scope when the product adds it. Validate frames at runtime. Reject invalid versions, types, schemas, and limits with a stable error; never dispatch arbitrary user-supplied function names. Unknown optional fields may be ignored for additive compatibility. Breaking changes need a negotiated/new protocol version and an installed-client compatibility policy.

Encode timestamps as UTC RFC 3339 strings, opaque identifiers as strings, and integers/decimal amounts that exceed safe JSON number precision as explicit strings. Define missing versus null semantics. Do not expose raw SQL errors or stack traces.

## Errors and requests

Use stable codes such as `invalid_request`, `unauthenticated`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `unsupported_version`, `resync_required`, and `internal`. `retryable` describes whether a later attempt may succeed; it does not establish mutation idempotency. Optional safe details can identify invalid fields or a retry delay. Echo the request ID when a valid one was parsed; malformed unsolicited frames can receive a connection-level error or protocol close.

Use equivalent HTTP statuses and error envelopes for HTTP operations. Include correlation IDs separately from user-facing messages. Bound request timeouts and concurrent requests. A client timeout means the outcome is unknown; canceling a response wait does not prove the transaction was canceled.

For mutations that may be retried, accept a separate idempotency key whose scope includes the authenticated principal and operation. A connection-local request ID is only correlation. Persist the idempotency result atomically with the mutation when duplicate execution matters, compare request fingerprints, and define retention. Return the existing result for a matching retry; reject conflicting reuse. Never automatically resend arbitrary mutations after reconnect. Without idempotency, reconcile/query the outcome or ask for a deliberate retry.

## Subscriptions, ordering, and recovery

`subscribe` validates the topic and authorization, installs a scoped subscription, and returns its identifier plus a snapshot/cursor. The initial snapshot and subsequent events must have a coherent boundary. Merely fetching a snapshot and then registering a listener loses changes between those steps. Choose a real solution: register/buffer events before obtaining a revisioned consistent snapshot and replay only later revisions, or use a durable cursor/event-log design. Define per-topic ordering and revision semantics as part of the product implementation.

Events describe committed state or invalidations that let clients fetch authoritative state. Publish after the transaction commits. Clients may deduplicate by a documented cursor/event identifier; they must not assume arbitrary opaque cursor strings sort lexicographically. Ignore events from subscriptions that are no longer active. Unsubscribe and disconnect must release server resources.

The simple default is **fresh snapshot synchronization on every reconnect**, with no promise of durable event replay. Cursors identify a synchronization boundary but do not by themselves imply replay support. If `after` cannot be honored, return `resync_required`; the client clears obsolete subscription state and subscribes with `after: null`. Add resumable streams only with explicit retained-history, cursor scope, retention, and ordering guarantees. Never accept a cursor from one user/topic as authority for another.

On a connection failure, use exponential backoff with jitter, for example 0.5 seconds initially with a 30-second cap. Reset only after a stable live connection. Pause/adjust for mobile background state; reconnect on resume or network return. Reauthenticate, restore only currently desired subscriptions, and synchronize before declaring the UI live. Authentication failures require credential refresh/user action rather than an endless reconnect loop.

## Liveness and limits

Starting defaults to implement and tune: 256 KiB inbound application frames, 16 active subscriptions per connection, 32 concurrent requests, a 15-second request deadline, and a bounded outgoing queue (for example 128 messages with an additional byte limit). Specify larger payload handling through object storage/HTTP rather than increasing socket limits without bounds. Apply per-principal/IP rate limits where appropriate.

A server can send WebSocket ping control frames every 30 seconds and require a pong within 10 seconds. Browser engines handle control pongs; browser JavaScript does not expose raw ping control frames. If application-level heartbeat messages are needed, define their schemas and deadlines separately. Heartbeats test connection activity and never replace data subscriptions with polling.

Disconnect slow consumers instead of buffering indefinitely, and require resynchronization after reconnect. Use standard protocol/policy close codes where appropriate; document any application-specific 4000–4999 codes before using them. Do not include private error details in close reasons. Define server restart/draining behavior so clients reconnect with backoff rather than stampeding a recovering service.
