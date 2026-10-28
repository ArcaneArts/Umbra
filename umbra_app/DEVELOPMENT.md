# App development

This is a contract for the future application project. It is not a runnable frontend yet. [Bootstrap](../docs/umbra/BOOTSTRAP.md) describes when and how to initialize it. Node/pnpm versions and all root command behavior are owned by [Scripts](../scripts/README.md).

## Required hooks

Create an app `package.json` with `dev:web` and `dev:desktop` scripts. For the Vite/Tauri defaults, their bodies can be `vite --strictPort` and `tauri dev`. Root tooling invokes the web hook with `--host APP_HOST --port APP_PORT`. The desktop hook is invoked once and must allow Tauri to manage its own frontend hook.

Add a separate `dev:tauri-web` script during scaffolding. It runs Vite with `--strictPort` using `APP_HOST` and `APP_PORT` inherited from root tooling (or documented local defaults when called directly). A tiny Node wrapper or Vite configuration can read these variables portably; do not use platform-specific shell expansion as the only implementation.

The following is an illustrative Tauri build configuration, not a checked-in native project:

```json
{
  "build": {
    "beforeDevCommand": "pnpm run dev:tauri-web",
    "devUrl": "http://127.0.0.1:5173",
    "beforeBuildCommand": "pnpm run build:web",
    "frontendDist": "../dist"
  }
}
```

Keep `devUrl` synchronized with the effective frontend host/port through Tauri's supported config override when customizing ports. Root `pnpm devtop -- --config PATH` forwards options to the desktop hook; the hook must pass them to Tauri. Changing `APP_PORT` alone cannot rewrite a static Tauri JSON file. Vite must fail on an occupied port rather than silently move away from `devUrl`.

Tauri's `beforeDevCommand` starts exactly one frontend process and owns its lifecycle. It must never call root `pnpm dev` or root `pnpm devtop`, which would recursively start the stack. In web mode the root supervisor starts `dev:web`; in desktop mode it starts `dev:desktop` only. See [Tauri development](https://v2.tauri.app/develop/) and [configuration](https://v2.tauri.app/reference/config/).

## Local workflow

After hooks and the Rust entry point exist, run `pnpm dev` for browser development or `pnpm devtop` for desktop development. Use the printed URLs and prefixed logs. API startup and frontend startup run concurrently; clients must tolerate a server that is still starting. The server must retry actual database connections with a bounded policy.

The root supervisor supplies public URLs and maps the two API variables to Vite's public prefix. If using Vite environment files, keep them inside this component and commit only safe examples. A direct component command outside root tooling needs its own documented public configuration; it does not load root `.env` automatically.

For browser testing, validate a deep route reload, login/logout, permission errors, loading/reconnect UI, and update delivery without polling. For Tauri, additionally validate capabilities, asset paths, external links, window lifecycle, and sleep/resume. Closing the desktop command shuts down the invocation's other host processes; infrastructure remains available until `pnpm infra:down`.

## Capacitor workflow

Initialize Capacitor inside this directory after a real frontend exists. Point `webDir` at the built web assets directory, default `dist`, then create only the requested native targets. The ordinary sequence is build the frontend, run `pnpm exec cap sync`, and open/run the chosen native project using the Capacitor CLI and platform IDE. Pin compatible Capacitor core, CLI, platforms, and plugin versions together. See [Capacitor installation](https://capacitorjs.com/docs/getting-started) and [workflow](https://capacitorjs.com/docs/basics/workflow).

Android/iOS SDKs, platform signing, and iOS builds on a suitable macOS host are target-specific requirements. Root `devtop` is for Tauri desktop; mobile launch remains an explicit component workflow.

For physical devices, set reachable public API/WebSocket/object URLs as described in [Configuration](../docs/umbra/CONFIGURATION.md). A live-reload server URL is a development-only choice. Remove it from release configuration so the installed app embeds its built assets. Test background/resume, reconnect, native permissions, and deep links on real targets; a browser test does not prove native behavior.
