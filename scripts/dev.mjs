import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { constants } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';

class CommandError extends Error {
  constructor(message, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

async function configuration(mode) {
  const defaults = parseEnv(await readFile(join(root, '.env.example'), 'utf8'));
  let local = {};
  try {
    local = parseEnv(await readFile(join(root, '.env'), 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const env = { ...defaults, ...local, ...process.env };
  const hash = createHash('sha256').update(await realpath(root)).digest('hex').slice(0, 10);
  env.UMBRA_PROJECT_NAME ??= `umbra-${hash}`;
  env.DATABASE_URL ??= `postgresql://${encodeURIComponent(env.POSTGRES_USER)}:${encodeURIComponent(env.POSTGRES_PASSWORD)}@127.0.0.1:${env.POSTGRES_PORT}/${encodeURIComponent(env.POSTGRES_DB)}`;
  env.S3_ENDPOINT ??= `http://127.0.0.1:${env.MINIO_PORT}`;
  env.S3_PUBLIC_ENDPOINT ??= env.S3_ENDPOINT;
  env.S3_ACCESS_KEY_ID ??= env.MINIO_ROOT_USER;
  env.S3_SECRET_ACCESS_KEY ??= env.MINIO_ROOT_PASSWORD;
  env.PUBLIC_API_URL ??= `http://127.0.0.1:${env.SERVER_PORT}`;
  if (['dev', 'devtop'].includes(mode) && env.PUBLIC_WS_URL === undefined) {
    const socket = new URL(env.PUBLIC_API_URL);
    socket.protocol = socket.protocol === 'https:' ? 'wss:' : 'ws:';
    socket.pathname = '/ws';
    socket.search = '';
    socket.hash = '';
    env.PUBLIC_WS_URL = socket.href;
  }
  env.PUBLIC_APP_URL ??= `http://127.0.0.1:${env.APP_PORT}`;
  env.PUBLIC_SITE_URL ??= `http://127.0.0.1:${env.SITE_PORT}`;
  if (['dev', 'devtop'].includes(mode)) {
    env.ALLOWED_ORIGINS ??= `${new URL(env.PUBLIC_APP_URL).origin},${new URL(env.PUBLIC_SITE_URL).origin}`;
  }
  // Never let inherited Compose options remove unrelated containers implicitly.
  env.COMPOSE_REMOVE_ORPHANS = '0';

  const frontendEnv = { ...process.env };
  for (const key of Object.keys(frontendEnv)) {
    if (/^(DATABASE_URL$|POSTGRES_|MINIO_|S3_|ALLOWED_ORIGINS$|RUST_LOG$)/.test(key)
      || Object.hasOwn(defaults, key) || Object.hasOwn(local, key)) {
      delete frontendEnv[key];
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (/^PUBLIC_/.test(key) || ['APP_HOST', 'APP_PORT', 'SITE_HOST', 'SITE_PORT'].includes(key)) {
      frontendEnv[key] = value;
    }
  }
  frontendEnv.VITE_API_URL = env.PUBLIC_API_URL;
  if (env.PUBLIC_WS_URL !== undefined) frontendEnv.VITE_WS_URL = env.PUBLIC_WS_URL;
  return { env, frontendEnv };
}

function statusOf(result) {
  if (result.error) return 127;
  if (result.code !== null) return result.code;
  return 128 + (constants.signals[result.signal] ?? 1);
}

class Supervisor {
  tasks = new Set();
  abort = new AbortController();
  stopping = false;
  stopPromise;

  start(label, command, args, { env, persistent = false } = {}) {
    if (this.stopping) throw new CommandError('Shutdown requested');
    console.log(`[${label}] ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd: root, env, detached: !windows, windowsHide: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    const task = { child, label, persistent };
    for (const [stream, output] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
      const lines = createInterface({ input: stream });
      lines.on('line', line => output.write(`[${label}] ${line}\n`));
    }
    task.result = new Promise(resolveResult => {
      child.once('error', error => {
        console.error(`[${label}] ${error.message}`);
        resolveResult({ code: null, signal: null, error });
      });
      child.once('exit', (code, signal) => resolveResult({ code, signal }));
    });
    task.closed = new Promise(resolveClosed => child.once('close', () => {
      if (!persistent) this.tasks.delete(task);
      resolveClosed();
    }));
    this.tasks.add(task);
    return task;
  }

  async run(label, command, args, options) {
    const result = await this.start(label, command, args, options).result;
    if (this.stopping) throw new CommandError('Shutdown requested');
    const code = statusOf(result);
    if (code !== 0) throw new CommandError(`${label} exited with status ${code}`, code);
  }

  signal(task, signal) {
    if (!task.child.pid) return;
    if (windows) {
      // A Node CLI path is used for pnpm; taskkill handles its descendant tree.
      const killer = spawn('taskkill', ['/PID', String(task.child.pid), '/T', '/F'], {
        windowsHide: true, stdio: 'ignore',
      });
      killer.on('error', () => task.child.kill());
    } else {
      try {
        process.kill(-task.child.pid, signal);
      } catch (error) {
        if (error.code !== 'ESRCH') console.error(`[shutdown] ${error.message}`);
      }
    }
  }

  stop() {
    if (this.stopPromise) return this.stopPromise;
    this.stopping = true;
    this.abort.abort();
    this.stopPromise = (async () => {
      const tasks = [...this.tasks];
      for (const task of tasks) this.signal(task, 'SIGTERM');
      let timer;
      await Promise.race([
        Promise.all(tasks.map(task => task.closed)),
        new Promise(resolveTimeout => { timer = setTimeout(resolveTimeout, 5000); }),
      ]);
      clearTimeout(timer);
      // Persistent leaders may exit before their grandchildren. Address the group.
      if (!windows) for (const task of tasks) this.signal(task, 'SIGKILL');
    })();
    return this.stopPromise;
  }
}

async function main() {
  const [mode, ...rawArgs] = process.argv.slice(2);
  const args = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  const supervisor = new Supervisor();
  let signalStatus;
  const onInt = () => { signalStatus ??= 130; void supervisor.stop(); };
  const onTerm = () => { signalStatus ??= 143; void supervisor.stop(); };
  process.on('SIGINT', onInt);
  process.on('SIGTERM', onTerm);
  try {
    const { env, frontendEnv } = await configuration(mode);
    const compose = [
      'compose', '--project-name', env.UMBRA_PROJECT_NAME, '--project-directory', root,
      '--env-file', join(root, '.env.example'), '-f', join(root, 'scripts/compose.dev.yaml'),
    ];
    const docker = (...more) => supervisor.run('infra', 'docker', [...compose, ...more], { env });
    const retry = async (description, operation) => {
      let lastError;
      for (let attempt = 1; attempt <= 30; attempt++) {
        if (supervisor.stopping) throw new CommandError('Shutdown requested');
        try {
          await operation();
          return;
        } catch (error) {
          if (supervisor.stopping) throw error;
          lastError = error;
          if (attempt < 30) {
            console.log(`[infra] ${description} attempt ${attempt}/30 failed; retrying in 1s`);
            await delay(1000, undefined, { signal: supervisor.abort.signal });
          }
        }
      }
      throw new CommandError(`${description} failed after 30 real attempts: ${lastError.message}`, lastError.exitCode);
    };
    const infrastructure = async () => {
      console.log(`[infra] Project ${env.UMBRA_PROJECT_NAME}; persistent data survives infra:down`);
      await docker('up', '-d', 'postgres', 'minio');
      await retry('PostgreSQL query', () => docker('exec', '-T', 'postgres', 'sh', '-ec',
        'PGCONNECT_TIMEOUT=2 PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "SELECT 1;"'));
      await retry('S3 bucket creation', () => docker('exec', '-T', 'minio', 'sh', '-ec',
        'config_dir=$(mktemp -d); trap \'rm -rf "$config_dir"\' EXIT; mc --config-dir "$config_dir" --conn-read-deadline 5s --conn-write-deadline 5s alias set local http://127.0.0.1:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"; mc --config-dir "$config_dir" --conn-read-deadline 5s --conn-write-deadline 5s mb --ignore-existing "local/$S3_BUCKET"'));
      console.log(`[infra] PostgreSQL 127.0.0.1:${env.POSTGRES_PORT}; S3 ${env.S3_ENDPOINT}; console http://127.0.0.1:${env.MINIO_CONSOLE_PORT}`);
    };
    const pnpm = (label, directory, hook, extra) => {
      const command = process.env.npm_execpath ? process.execPath : 'pnpm';
      const prefix = process.env.npm_execpath ? [process.env.npm_execpath] : [];
      return supervisor.start(label, command, [...prefix, '--dir', join(root, directory), 'run', hook, ...extra], {
        env: frontendEnv, persistent: true,
      });
    };

    switch (mode) {
      case 'infra:up':
        await infrastructure();
        break;
      case 'infra:down':
        await docker('down');
        break;
      case 'infra:compose':
        await docker(...args);
        break;
      case 'infra:logs':
        await supervisor.run('infra', 'docker', [...compose, 'logs', '--follow', '--tail', '100', 'postgres', 'minio'], { env, persistent: true });
        break;
      case 'dev':
      case 'devtop':
      case 'dev:site': {
        const tasks = [];
        if (mode !== 'dev:site') {
          await infrastructure();
          tasks.push(supervisor.start('server', 'cargo', ['run', '--manifest-path', 'umbra_server/Cargo.toml'], { env, persistent: true }));
        }
        if (mode === 'dev') {
          console.log(`[app] Web ${env.PUBLIC_APP_URL}; API ${env.PUBLIC_API_URL}`);
          tasks.push(pnpm('app', 'umbra_app', 'dev:web', ['--host', env.APP_HOST, '--port', env.APP_PORT, ...args]));
        } else if (mode === 'devtop') {
          tasks.push(pnpm('desktop', 'umbra_app', 'dev:desktop', args));
        } else {
          console.log(`[site] Website ${env.PUBLIC_SITE_URL}; Open App ${env.PUBLIC_APP_URL}`);
          tasks.push(pnpm('site', 'umbra_site', 'dev', ['--host', env.SITE_HOST, '--port', env.SITE_PORT, ...args]));
        }
        const result = await Promise.race(tasks.map(async task => ({ task, result: await task.result })));
        const code = statusOf(result.result);
        console.log(`[${result.task.label}] Exited with status ${code}; stopping this session's host processes`);
        process.exitCode = code;
        break;
      }
      default:
        throw new CommandError(`Unknown command: ${mode ?? '(none)'}. See scripts/README.md.`);
    }
  } catch (error) {
    if (!supervisor.stopping) {
      console.error(`[umbra] ${error.message}`);
      process.exitCode = error.exitCode ?? 1;
    }
  } finally {
    await supervisor.stop();
    process.exitCode = signalStatus ?? process.exitCode ?? 0;
    process.off('SIGINT', onInt);
    process.off('SIGTERM', onTerm);
  }
}

await main();
