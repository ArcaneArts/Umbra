# Site development

Choose a framework capable of static output when the product is initialized. Add a component `package.json` with a `dev` script that accepts `--host HOST --port PORT` and fails on an occupied port. Root `pnpm dev:site` supplies `SITE_HOST` and `SITE_PORT`, defaulting to `127.0.0.1:4321`.

Provide an explicit production build script and document its output directory. The root workspace discovers this package when its manifest exists. Do not add server-side hosting requirements merely to render static marketing/policy content.

The root hook receives public app/site URLs. Map them to the selected framework's explicit public configuration convention; the root tool does not choose the website framework or generate its source. Follow [Configuration](../docs/umbra/CONFIGURATION.md) and keep server credentials out of build environments and output.

`pnpm dev:site` starts only this website, without Docker, the Rust server, or the application. Open App can therefore point at an app that is not running. Start the app separately when testing that navigation. Ctrl+C stops the website's process tree.

Validate responsive content, keyboard navigation, meaningful link labels, real download/store destinations, public configuration, and policy routes. Verify the static production build independently of the development server before publishing.
