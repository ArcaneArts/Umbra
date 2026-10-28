# Data and object storage

## PostgreSQL ownership

Use PostgreSQL for durable structured state, ownership/authorization metadata, and references to stored objects. Model only product entities justified by requirements. Use constraints for invariants the database can enforce, parameterized queries, deliberate indexes for real access paths, and UTC timestamps with explicit wire conversion.

SQLx is the replaceable default for queries, pools, and migrations. Size the pool relative to deployment replicas and database capacity; use acquisition/connect timeouts and avoid holding transactions across network waits. Group related changes and their idempotency records in one transaction. Handle uniqueness/concurrency conflicts as expected public errors. Retry deadlocks/serialization failures only with bounded retries around an operation safe to repeat.

## Migrations and startup

Keep ordered SQL migrations inside the future server project, default `migrations/`. Add a documented migration command once SQLx is initialized. Apply the same migrations to development, tests, and production. Never infer schema validity merely from a running container or an existing migration filename.

For a simple development server, applying migrations during startup is acceptable. For production, prefer a deployment migration step, or implement deliberate coordination if every replica runs them. Select one strategy and document it; avoid racing independent migration runners. Plan additive/expand-and-contract changes when old clients or server replicas remain live. Do not rewrite already applied production migrations.

SQLx compile-time query checking may require a live database or prepared offline query metadata depending on the selected API. Document that build behavior and keep prepared metadata current if used. Do not force production database access merely to compile the service.

Use small opt-in development seeds once real entities exist. Keep secrets and actual user data out of seeds. [Configuration](../docs/umbra/CONFIGURATION.md) explains first-volume initialization credentials and host/container addresses.

## Development and integration tests

`pnpm infra:up` provides PostgreSQL and creates the private development object bucket. Persistent named volumes survive normal shutdown. Tests must not share the interactive application's database or object keys.

Use a uniquely named database per test run/worker or a genuinely isolated equivalent, apply real migrations, and connect with an explicit test-only URL. Test transactions work only when every tested operation uses the same transaction; HTTP/WebSocket integration tests usually need their own database because the service owns separate connections. A test must know which database it created and drop only that database during cleanup. Use separate CI infrastructure credentials and resource names.

For S3 tests, use a distinct bucket or unique run prefix under a dedicated test bucket. Scope cleanup to resources created by the test, including aborted multipart uploads when applicable. Check real authorization, writes, reads, and failures rather than mocking every SDK operation. Preserve useful logs on failure and clean temporary objects/databases in a finalizer.

## S3 configuration

Use an S3-compatible SDK with configurable endpoint, region, bucket, credentials, and force-path-style mode. Follow [the environment contract](../docs/umbra/CONFIGURATION.md). The local server connects to MinIO using host ports; Compose jobs use `http://minio:9000`. Production may use AWS S3 or another compatible provider with its own endpoint/addressing requirements. MinIO is the local development service, not a mandated production deployment.

Use separate operation and signing endpoints when required. A signed URL must contain the hostname/path the client reaches. Give the production service credentials limited to its intended buckets/actions; browsers/native applications never receive reusable service credentials. The template uses development-only MinIO root credentials for convenience on loopback-bound local ports.

## Authorized transfer lifecycle

Keep buckets private by default. Use authenticated server-proxied transfers for simple flows, or authorize narrowly scoped short-lived presigned requests for direct transfers. The server chooses object keys and validates ownership, size/type requirements, and intended operation. Never sign an arbitrary client-supplied bucket/key without authorization.

For direct uploads, reserve an upload/object record or equivalent, return a bounded transfer authorization, upload bytes, then finalize through the server. Verify actual object existence and required metadata/checksum/size before marking the record available. A client saying upload succeeded is insufficient. For stricter upload restrictions, use a mechanism that actually enforces the required conditions, such as a suitable POST policy or server-proxied upload; a presigned PUT does not enforce every product constraint automatically.

Treat object bytes and PostgreSQL metadata as separate systems: there is no cross-system SQL transaction. Use explicit pending/ready/deleting state or equivalent, idempotent finalization/deletion, and cleanup of abandoned uploads/orphans as the product requires. Do not announce a usable file before metadata and object state agree. Delete only keys owned by the authorized operation.

Set bucket CORS deliberately for browser direct transfers, independent of API CORS. Match allowed origins, methods, request headers, and exposed response headers to the actual upload/download flow. Keep console/admin access private. Limit signed URL lifetimes and avoid logging them. See [AWS presigned-upload documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) for the underlying transfer semantics.
