# Site deployment

Build static output and deploy it to a static host, bucket/CDN, or equivalent. The site, web app, and application API have independent origins/deployments. Configure `PUBLIC_APP_URL` for the deployed web application and `PUBLIC_SITE_URL` for the site's canonical origin using the framework's explicit public-config mechanism.

Serve HTTPS, correct MIME types, cache policies suited to hashed assets versus HTML, and clean routes for policies/support. Choose redirects and canonical URLs deliberately. The site should remain useful even while the application API is unavailable.

Host native artifacts on the selected release/download service and link to actual available versions. Keep version, operating-system/architecture labels, checksums/signatures where published, and download links aligned with app releases. Prefer authoritative mobile store links once published. Do not put signing credentials into the static build.

Open App defaults to an ordinary web link. If implementing native deep links, verify domain association/custom scheme behavior and preserve a useful web fallback. Document how the site decides which destination to open without relying on unreliable installation detection.

Publish product-specific privacy, terms, and support content. Make any forms, analytics, or external widgets deliberate product decisions with corresponding operational and privacy documentation.

Before publishing, build the actual static artifact and verify its rendered entry page, direct policy routes, Open App, downloads/store links, mobile layout, and keyboard use on the deployed origin. This template has no website implementation or deployment credentials.
