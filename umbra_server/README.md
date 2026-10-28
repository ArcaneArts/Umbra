# Application server

Implement an independent Rust application service here when the product is initialized. It owns application operations, authentication/authorization enforcement, durable structured state in PostgreSQL, object metadata and authorized S3 access, and pushed updates. It does not serve either frontend's resources.

| Read | For |
| --- | --- |
| [Architecture](ARCHITECTURE.md) | Runtime, modules, business boundaries, lifecycle |
| [Protocol](PROTOCOL.md) | HTTP/socket contracts, errors, subscriptions, recovery |
| [Data](DATA.md) | PostgreSQL, migrations, tests, object storage |
| [Development](DEVELOPMENT.md) | Entry point, local infrastructure, debugging/testing |
| [Deployment](DEPLOYMENT.md) | Service hosting, origins, proxies, secrets, operations |

Rust, PostgreSQL, and S3-compatible storage are requirements. Axum, Tokio, and SQLx are replaceable defaults. Authentication provider, domain model, and product-specific API operations remain product decisions. Shared environment names are defined in [Configuration](../docs/umbra/CONFIGURATION.md).
