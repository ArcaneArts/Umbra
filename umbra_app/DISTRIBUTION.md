# App distribution

Build one shared frontend for three delivery targets. [Configuration](../docs/umbra/CONFIGURATION.md) owns public settings and secret boundaries. Choose versions and signing infrastructure when initializing the product; this template supplies no release pipeline or native projects.

| Target | Artifact | Deployment responsibility |
| --- | --- | --- |
| Web | Static frontend output, default `dist/` | Bucket/static host/CDN with application routing rules |
| Desktop | Tauri OS-specific bundles/installers | Signed downloads or selected distribution channel |
| Mobile | Capacitor platform builds | App Store / Google Play or intended managed channel |

## Static web

Supply production HTTPS API and WSS URLs at build time or through an explicitly designed public runtime-config mechanism. Upload only the build output. Configure history-route fallback if used, correct asset base paths, MIME types, and immutable caching for hashed assets; avoid indefinitely caching the HTML entry point. Keep API paths on the separately configured service.

Test a direct deep-route load, refresh, authentication redirects, WebSocket connections through the real proxy, and any presigned transfers. Configure exact browser origins on the server. Browser policy, cookie scope, and storage CORS must agree with the deployed domains. Decide service-worker/update behavior only if the product needs it.

## Tauri desktop

Configure the product name, stable bundle identifier, app icons, embedded frontend path, capabilities, CSP, supported operating systems, and architecture targets. Build bundles with the platform tooling supported by Tauri; do not assume one host can produce and sign all operating-system artifacts. Store signing/notarization credentials in the release environment.

Serve actual versioned, signed artifacts from the chosen download host. Coordinate URLs and release metadata with [the public site](../umbra_site/DEPLOYMENT.md). If enabling automatic updates, configure signed update metadata, key management, release channels, and rollback behavior explicitly. The desktop binary still connects to the independent API, so maintain protocol compatibility for installed older clients.

See [Tauri distribution](https://v2.tauri.app/distribute/) for target-specific packaging and signing.

## Capacitor mobile

Build static frontend assets and sync them into the native projects before creating release builds. Configure stable application IDs, app/store versions, icons, launch assets, platform permissions and privacy declarations, verified links, production network policy, and signing identities. Do not ship development live-reload URLs or debug-only cleartext exceptions.

Build, sign, and validate native archives/bundles with the selected platform toolchains. Confirm release assets, permissions, login redirect handling, deep links, and background/resume on each intended platform. App-store policy and privacy text must reflect the actual product; the template does not supply publishable legal content.

See [Capacitor iOS deployment](https://capacitorjs.com/docs/ios/deploying-to-app-store) and [Android deployment](https://capacitorjs.com/docs/android/deploying-to-google-play).

## Version compatibility

Version native artifacts independently from deployment timestamps. Document the minimum supported protocol/client versions and keep additive server changes compatible with installed applications. A server deployment cannot assume every desktop/mobile client updates immediately. Keep public release links and Open App destinations correct when domains or channels change.
