# Public website

This directory is documentation-only until the product's public website is initialized. Build an independently hosted static website for discovery, downloads, policies, and entry into the application. Its framework and styling can be chosen independently from the app.

## Content and navigation

Describe the real product, intended users, capabilities, and supported platforms. Add screenshots, feature explanations, and calls to action as the product develops. Avoid claims about capabilities or platform availability that have not shipped.

Provide versioned desktop downloads and/or links to the product's actual release host, mobile store links for available targets, support/contact links, and privacy/terms pages appropriate to the product. Policy text must reflect actual data processing and distribution practices; the template does not supply publishable legal claims or fake download links.

The Open App button points to configurable `PUBLIC_APP_URL`, defaulting locally to the app's web development URL and in production to the hosted web application. Keep this distinct from the API URL. Native deep links are optional: add them deliberately with a browser fallback rather than making ordinary web access depend on native installation.

Keep marketing navigation and app routing independent. Reuse branding/assets when useful without coupling site deployment to app runtime code or making the Rust API serve static resources.

Read [Development](DEVELOPMENT.md), [Deployment](DEPLOYMENT.md), and [shared configuration](../docs/umbra/CONFIGURATION.md) for operational contracts.
