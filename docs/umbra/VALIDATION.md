# Template validation

Validation performed on 2026-10-27 on macOS/arm64 with Node 24.14.0, pnpm 11.15.1, and Docker Compose v2.31.0. This records evidence for the template tooling and documentation, not for an implemented product.

## Real infrastructure

Used isolated Compose projects `umbra-template-verify` and `umbra-template-verify-second`, PostgreSQL host ports 55439/55440, and MinIO host ports 19490–19493. No application development database or unrelated Docker project was used.

| Check | Observed result |
| --- | --- |
| First MinIO build | Built server and CLI from the checksum-pinned source archives using the digest-pinned Go/Alpine inputs |
| Fresh second namespace | Built from cached source layers with no published MinIO image dependency; created separate containers, network, and volumes |
| PostgreSQL version | Runtime reported PostgreSQL 17.11 |
| Infrastructure startup | Real `SELECT 1` and authenticated bucket creation succeeded; observed/recovered from real connection refusals while services started |
| Database write/read | Created a probe table, committed an insert inside a transaction, and read `umbra durable database probe` |
| Host database port | A disposable PostgreSQL client container connected through the host's published port and read the committed row |
| S3 write/read | AWS Signature v4 authenticated HTTP PUT and GET through the published host port returned exact probe bytes |
| Bucket privacy | Anonymous GET of the existing probe object returned HTTP 403 |
| Persistence | Ran ordinary `infra:down`, confirmed both named volumes remained, then `infra:up`; the committed database row and S3 bytes remained readable |
| Namespace separation | The second namespace's PostgreSQL and MinIO containers remained running when the first namespace was removed |
| Logs and Ctrl+C | Real `pnpm infra:logs` streamed service output and exited 130 on SIGINT |
| Uninitialized browser/desktop stacks | `pnpm dev` and `pnpm devtop` reached infrastructure setup and actual component commands, then returned Cargo's missing-manifest error (101) |
| Uninitialized website | `pnpm dev:site` returned pnpm's missing-manifest error (1), without infrastructure startup |

The plain source-compiled MinIO binaries report `DEVELOPMENT.GOGET` in their version banners. Their actual source releases are pinned in [the Dockerfile](../../scripts/Minio.Dockerfile) and identified by image labels. They are local source builds, not upstream-signed release binaries.

Temporary validation containers, networks, volumes, namespace image tags, and downloaded source archives are removed after verification. Normal user `infra:down` preserves volumes; explicit deletion was limited to these disposable validation resources.

## Tooling fixtures

`pnpm test:tooling` runs 11 POSIX checks with temporary directories and executable Docker/Cargo fixtures. The frontend hooks run through real pnpm and launch real child/descendant processes. Failure triggers are coordinated after readiness rather than assuming a fixed application startup duration.

Coverage includes web/desktop/site command selection and arguments, environment precedence and URL derivation, removal of configured server secrets from frontend children, checkout-derived and explicit namespaces, stdout/stderr prefixes, propagation of nonzero and successful child exits, SIGINT/SIGTERM, forced cleanup of stubborn descendant groups, cancellation during infrastructure startup, retries of failed operations, missing-executable status 127, raw Compose argument forwarding, and preservation of volume data by ordinary down commands. No real Docker calls are made by this fixture suite.

`pnpm install --frozen-lockfile`, Node syntax checks for both scripts, and Git whitespace validation also passed. The final documentation audit checked 25 Markdown files and 93 local links/anchors, with zero broken targets.

## Scope and repeatability

The application, server, public site, Tauri project, and Capacitor native projects are intentionally absent. No actual product build, Rust integration suite, native packaging/signing, visual UI, authentication flow, or production deployment has been tested. Successful desktop fixtures prove hook/process ownership, not Tauri behavior. Native Windows process-tree cleanup and other host/CPU targets were not executed; the POSIX fixture suite explicitly skips Windows.

To repeat the supervisor checks, run `pnpm test:tooling`. To repeat infrastructure verification, choose a unique `UMBRA_PROJECT_NAME` and unused explicit ports, run `pnpm infra:up`, perform actual SQL and signed S3 writes/reads, run ordinary `infra:down`/`infra:up`, and confirm the same values. Inspect a second isolated namespace if checking separation. Clean only resources created by that verification. See [Scripts](../../scripts/README.md) and [Configuration](CONFIGURATION.md) for the exact command and environment contracts.
