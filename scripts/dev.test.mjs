import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const supported = process.platform !== 'win32';
const quote = value => `'${value.replaceAll("'", "'\\''")}'`;
const fixtureProgram = `
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
const [role, ...args] = process.argv.slice(2);
const trace = process.env.FIXTURE_TRACE;
const selected = ['DATABASE_URL','POSTGRES_PASSWORD','S3_SECRET_ACCESS_KEY','PUBLIC_API_URL','PUBLIC_WS_URL','PUBLIC_APP_URL','VITE_API_URL','VITE_WS_URL','APP_PORT','ROOT_SECRET'];
const record = extra => appendFileSync(trace, JSON.stringify({role, pid:process.pid, args, ...extra})+'\\n');
record({phase:'start', env:Object.fromEntries(selected.map(k=>[k,process.env[k]??null]))});
if (role === 'docker') {
  const action = args[args.indexOf('-f')+2];
  if (action === 'up' && process.env.FIXTURE_UP_FAIL) process.exit(29);
  if (action === 'exec') {
    const service = args[args.indexOf('exec')+2];
    const prior = readFileSync(trace,'utf8').trim().split('\\n').map(JSON.parse);
    const calls = prior.filter(x=>x.role==='docker' && x.args.includes('exec') && x.args[x.args.indexOf('exec')+2]===service).length;
    if (calls <= Number(process.env[service==='postgres'?'FIXTURE_SQL_FAILURES':'FIXTURE_S3_FAILURES']??0)) {
      console.error('real operation fixture failure: '+service); process.exit(9);
    }
  }
  process.exit(0);
}
const service = role === 'cargo' ? 'server' : role;
console.log(service+' stdout');
console.error(service+' stderr');
const grandchild = spawn(process.execPath, ['--input-type=module','-e',
  "import {appendFileSync} from 'node:fs'; appendFileSync(process.env.FIXTURE_TRACE,JSON.stringify({role:'descendant',owner:"+JSON.stringify(service)+",pid:process.pid,phase:'ready'})+String.fromCharCode(10)); process.on('SIGTERM',()=>{if(process.env.FIXTURE_STUBBORN!=="+JSON.stringify(service)+") process.exit(0)}); setInterval(()=>{},1000)"
], {stdio:['ignore','inherit','inherit']});
record({phase:'ready',service,child:grandchild.pid});
process.on('SIGTERM',()=>{
  record({phase:'term'});
  if(process.env.FIXTURE_STUBBORN!==service) process.exit(0);
});
if(process.env.FIXTURE_EXIT_ROLE===service) setInterval(()=>{
  if(existsSync(process.env.FIXTURE_EXIT_TRIGGER)) process.exit(Number(process.env.FIXTURE_EXIT_CODE??'7'));
},20);
setInterval(()=>{},1000);
`;

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function until(predicate, description, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await delay(25);
  }
  throw new Error(`Timed out: ${description}`);
}

async function fixture(t, { mode = 'dev', env = {}, local = '', args = [], noDocker = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'umbra fixture '));
  await mkdir(join(directory, 'scripts'));
  await mkdir(join(directory, 'bin'));
  for (const name of ['package.json', 'pnpm-workspace.yaml', '.env.example']) {
    await cp(join(root, name), join(directory, name));
  }
  for (const name of ['dev.mjs', 'compose.dev.yaml']) {
    await cp(join(root, 'scripts', name), join(directory, 'scripts', name));
  }
  if (local) await writeFile(join(directory, '.env'), local);
  const program = join(directory, 'fixture.mjs');
  await writeFile(program, fixtureProgram);
  for (const tool of ['docker', 'cargo']) {
    if (tool === 'docker' && noDocker) continue;
    await writeFile(join(directory, 'bin', tool), `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(program)} ${tool} "$@"\n`, { mode: 0o755 });
  }
  for (const [component, scripts] of [
    ['umbra_app', { 'dev:web': 'node fixture.mjs web', 'dev:desktop': 'node fixture.mjs desktop' }],
    ['umbra_site', { dev: 'node fixture.mjs site' }],
  ]) {
    await mkdir(join(directory, component));
    await writeFile(join(directory, component, 'package.json'), JSON.stringify({ name: component, private: true, type: 'module', scripts }));
    await writeFile(join(directory, component, 'fixture.mjs'), fixtureProgram);
  }
  const trace = join(directory, 'trace.jsonl');
  await writeFile(trace, '');
  const childEnv = { ...process.env };
  const defaults = parseEnv(await readFile(join(directory, '.env.example'), 'utf8'));
  for (const key of Object.keys(childEnv)) {
    if (Object.hasOwn(defaults, key) || /^(UMBRA_PROJECT_NAME$|DATABASE_URL$|S3_|PUBLIC_|VITE_|ALLOWED_ORIGINS$|FIXTURE_)/.test(key)) {
      delete childEnv[key];
    }
  }
  Object.assign(childEnv, {
    PATH: `${join(directory, 'bin')}:${process.env.PATH}`,
    FIXTURE_TRACE: trace,
    FIXTURE_EXIT_TRIGGER: join(directory, 'exit-now'),
    ...env,
  });
  if (noDocker) childEnv.PATH = join(directory, 'bin');
  const child = spawn(process.execPath, [join(directory, 'scripts/dev.mjs'), mode, ...args], {
    cwd: tmpdir(), env: childEnv, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  const result = new Promise(resolveResult => child.once('close', (code, signal) => resolveResult({ code, signal })));
  const events = async () => (await readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await Promise.race([result, delay(6500)]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    for (const event of await events()) {
      if (alive(event.pid)) {
        try { process.kill(event.pid, 'SIGKILL'); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      }
    }
    await rm(directory, { recursive: true, force: true });
  });
  return {
    directory, child, result, events, output: () => output,
    async triggerExit() { await writeFile(join(directory, 'exit-now'), 'exit'); },
    async ready(...roles) {
      await until(async () => {
        const all = await events();
        return roles.every(role => all.some(event => event.phase === 'ready' && (event.service === role || event.owner === role)))
          && roles.every(role => all.some(event => event.role === 'descendant' && event.owner === role));
      }, `ready ${roles.join(', ')}`).catch(error => { error.message += `\n${output}`; throw error; });
    },
    async finished(code) {
      let timer;
      const actual = await Promise.race([
        result,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Supervisor hung:\n${output}`)), 15000); }),
      ]).finally(() => clearTimeout(timer));
      assert.equal(actual.code, code, output);
      assert.equal(actual.signal, null, output);
      const pids = [...new Set((await events()).map(event => event.pid))];
      await until(() => pids.every(pid => !alive(pid)), 'fixture process cleanup', 3000);
    },
  };
}

const options = { skip: supported ? false : 'These executable/process-group fixtures require POSIX; native Windows validation is separate.' };

test('web mode uses real pnpm hooks, merges config, keeps secrets private, forwards arguments, and cleans up on SIGINT', options, async t => {
  const f = await fixture(t, {
    local: 'APP_PORT=6001\nSERVER_PORT=8765\nPOSTGRES_PASSWORD="file $literal"\nROOT_SECRET=private\n',
    env: { APP_PORT: '5997' }, args: ['--', '--fixture-label', 'two words'],
  });
  await f.ready('server', 'web');
  const events = await f.events();
  const server = events.find(event => event.role === 'cargo');
  const web = events.find(event => event.role === 'web');
  assert.deepEqual(server.args, ['run', '--manifest-path', 'umbra_server/Cargo.toml']);
  assert.equal(server.env.DATABASE_URL, 'postgresql://umbra:file%20%24literal@127.0.0.1:54329/umbra');
  assert.equal(server.env.ROOT_SECRET, 'private');
  assert.equal(web.env.DATABASE_URL, null);
  assert.equal(web.env.POSTGRES_PASSWORD, null);
  assert.equal(web.env.S3_SECRET_ACCESS_KEY, null);
  assert.equal(web.env.ROOT_SECRET, null);
  assert.equal(web.env.VITE_API_URL, 'http://127.0.0.1:8765');
  assert.equal(web.env.VITE_WS_URL, 'ws://127.0.0.1:8765/ws');
  assert.deepEqual(web.args, ['--host', '127.0.0.1', '--port', '5997', '--fixture-label', 'two words']);
  const first = events.find(event => event.role === 'docker');
  const expected = 'umbra-' + createHash('sha256').update(await realpath(f.directory)).digest('hex').slice(0, 10);
  assert.equal(first.args[first.args.indexOf('--project-name') + 1], expected);
  assert.match(f.output(), /\[server\] server stderr/);
  assert.match(f.output(), /\[app\] web stdout/);
  f.child.kill('SIGINT');
  await f.finished(130);
  assert(!(await f.events()).some(event => event.role === 'docker' && event.args.includes('down')));
});

test('desktop hook owns its frontend tree and a successful exit shuts down the server', options, async t => {
  const f = await fixture(t, { mode: 'devtop', env: { FIXTURE_EXIT_ROLE: 'desktop', FIXTURE_EXIT_CODE: '0' } });
  await f.ready('server', 'desktop');
  await f.triggerExit();
  await f.finished(0);
  assert(!(await f.events()).some(event => event.role === 'web'));
});

test('website runs independently and handles SIGTERM without Docker or server work', options, async t => {
  const f = await fixture(t, { mode: 'dev:site', env: { PUBLIC_API_URL: 'unused-invalid-api', PUBLIC_APP_URL: 'https://app.example.test' } });
  await f.ready('site');
  const events = await f.events();
  assert(!events.some(event => ['docker', 'cargo', 'web', 'desktop'].includes(event.role)));
  assert.equal(events.find(event => event.role === 'site').env.PUBLIC_APP_URL, 'https://app.example.test');
  f.child.kill('SIGTERM');
  await f.finished(143);
});

test('a failing server propagates its status and stops sibling/descendant processes', options, async t => {
  const f = await fixture(t, { env: { FIXTURE_EXIT_ROLE: 'server', FIXTURE_EXIT_CODE: '23' } });
  await f.ready('server', 'web');
  await f.triggerExit();
  await f.finished(23);
});

test('shutdown force-kills a stubborn invocation-owned process group after its grace period', options, async t => {
  const f = await fixture(t, { env: { FIXTURE_STUBBORN: 'server' } });
  await f.ready('server', 'web');
  f.child.kill('SIGTERM');
  await f.finished(143);
});

test('infrastructure failure is returned before any application process is started', options, async t => {
  const f = await fixture(t, { env: { FIXTURE_UP_FAIL: '1' } });
  await f.finished(29);
  assert((await f.events()).every(event => event.role === 'docker'));
});

test('SIGINT during an infrastructure retry stops startup without launching components', options, async t => {
  const f = await fixture(t, { mode: 'dev', env: { FIXTURE_SQL_FAILURES: '30' } });
  await until(() => f.output().includes('PostgreSQL query attempt 1/30 failed'), 'first actual query failure');
  f.child.kill('SIGINT');
  await f.finished(130);
  assert((await f.events()).every(event => event.role === 'docker'));
});

test('infrastructure retries actual failed SQL/S3 operations and succeeds without component manifests', options, async t => {
  const f = await fixture(t, { mode: 'infra:up', env: { FIXTURE_SQL_FAILURES: '1', FIXTURE_S3_FAILURES: '1' } });
  await rm(join(f.directory, 'umbra_app'), { recursive: true });
  await rm(join(f.directory, 'umbra_site'), { recursive: true });
  await f.finished(0);
  const calls = (await f.events()).filter(event => event.args.includes('exec'));
  assert.equal(calls.filter(event => event.args[event.args.indexOf('exec') + 2] === 'postgres').length, 2);
  assert.equal(calls.filter(event => event.args[event.args.indexOf('exec') + 2] === 'minio').length, 2);
  assert.match(f.output(), /real operation fixture failure/);
});

test('a missing executable produces the actual spawn error and status 127', options, async t => {
  const f = await fixture(t, { mode: 'infra:compose', args: ['ps'], noDocker: true });
  await f.finished(127);
  assert.match(f.output(), /ENOENT/);
});

test('raw Compose arguments preserve explicit namespace, and unrelated invalid client config cannot block infrastructure', options, async t => {
  const f = await fixture(t, {
    mode: 'infra:compose', args: ['--', 'ps', '--format', 'json'],
    env: { UMBRA_PROJECT_NAME: 'fixture-explicit', PUBLIC_API_URL: 'not-a-url', PUBLIC_APP_URL: 'not-a-url' },
  });
  await f.finished(0);
  const [event] = await f.events();
  assert.equal(event.args[event.args.indexOf('--project-name') + 1], 'fixture-explicit');
  assert.deepEqual(event.args.slice(-3), ['ps', '--format', 'json']);
});

test('ordinary infrastructure shutdown never requests volume or global resource deletion', options, async t => {
  const f = await fixture(t, { mode: 'infra:down' });
  await f.finished(0);
  const [event] = await f.events();
  assert.equal(event.args.at(-1), 'down');
  assert(!event.args.some(arg => ['--volumes', '--remove-orphans', 'prune'].includes(arg)));
});
