import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { stopHarness } from '../../scripts/machine/harness-process.mjs';
import { harnessStartVerb } from '../../scripts/machine/harness-verbs.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const childProcess = (pid) => Object.assign(new EventEmitter(), {
  pid,
  killed: false,
  kill() {
    this.killed = true;
    queueMicrotask(() => this.emit('exit', 0));
    return true;
  },
});

const context = (lifecycle, out, now = 1_000) => ({
  args: {},
  env: { FIXTURE: 'yes' },
  now,
  io: { stdout: (text) => { out.value += text; }, stderr: () => {} },
  lifecycle,
});

test('start verb records the in-process server owner and resolves with code one when its Vite child fails', async (t) => {
  const dir = mkdtemp(t, 'starci-harness-process-');
  const stateFile = path.join(dir, 'harness.json');
  const lifecycle = new EventEmitter();
  const child = childProcess(501);
  const closed = [];
  const output = { value: '' };
  const resultPromise = harnessStartVerb(context(lifecycle, output), {
    url: 'http://127.0.0.1:4547',
    startOptions: {
      stateFile,
      pid: 77,
      lifecycle,
      serverFactory: ({ env }) => {
        assert.equal(env.FIXTURE, 'yes');
        return { server: { fixture: true }, close: async () => { closed.push('server'); } };
      },
      spawnApp: (args, options) => {
        assert.match(args[0].replace(/\\/g, '/'), /node_modules\/vite\/bin\/vite\.js$/);
        assert.equal(options.env.FIXTURE, 'yes');
        return child;
      },
    },
  });
  const record = JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.app;
  assert.equal(record.pid, 77);
  assert.equal(record.children[0], 501);
  assert.match(record.script.replace(/\\/g, '/'), /scripts\/machine\/harness-verbs\.mjs$/);
  child.emit('exit', 9);
  assert.deepEqual(await resultPromise, { code: 1 });
  assert.deepEqual(closed, ['server']);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.app, undefined);
  assert.equal(output.value, 'StarCi harness: http://127.0.0.1:4547\n');
});

test('a stop signal closes the server, kills the child and clears the record', async (t) => {
  const dir = mkdtemp(t, 'starci-harness-signal-');
  const stateFile = path.join(dir, 'harness.json');
  const lifecycle = new EventEmitter();
  const child = childProcess(502);
  let closed = 0;
  const output = { value: '' };
  const resultPromise = harnessStartVerb(context(lifecycle, output, 2_000), {
    url: 'http://127.0.0.1:4547',
    startOptions: {
      stateFile,
      pid: 88,
      lifecycle,
      serverFactory: () => ({ server: {}, close: async () => { closed += 1; } }),
      spawnApp: () => child,
    },
  });
  lifecycle.emit('SIGTERM');
  assert.deepEqual(await resultPromise, { code: 0 });
  assert.equal(closed, 1);
  assert.equal(child.killed, true);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.app, undefined);
});

test('tunnel mode uses the named credential file, strips tokens and starts no server', async (t) => {
  const dir = mkdtemp(t, 'starci-harness-tunnel-');
  const stateFile = path.join(dir, 'harness.json');
  const lifecycle = new EventEmitter();
  const child = childProcess(504);
  const output = { value: '' };
  const ctx = context(lifecycle, output, 2_500);
  ctx.args.tunnel = true;
  ctx.env = { FIXTURE: 'yes', CF_TUNNEL_TOKEN: 'secret', CF_API_TOKEN: 'secret' };
  let call;
  const resultPromise = harnessStartVerb(ctx, {
    url: 'https://harness.example',
    startOptions: {
      stateFile,
      pid: 89,
      lifecycle,
      home: 'fixture-home',
      serverFactory: () => { throw new Error('tunnel mode must not start the API server'); },
      spawnTunnel: (args, options) => { call = { args, options }; return child; },
    },
  });
  assert.deepEqual(call.args, ['tunnel', '--config', path.join('fixture-home', '.cloudflared', 'harness.yml'), 'run', 'starci-harness']);
  assert.equal(call.options.env.FIXTURE, 'yes');
  assert.equal(Object.hasOwn(call.options.env, 'CF_TUNNEL_TOKEN'), false);
  assert.equal(Object.hasOwn(call.options.env, 'CF_API_TOKEN'), false);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.tunnel.pid, 89);
  child.emit('exit', 0);
  assert.deepEqual(await resultPromise, { code: 0 });
});

test('stop refuses a recorded PID that belongs to another process', (t) => {
  const dir = mkdtemp(t, 'starci-harness-stop-');
  const stateFile = path.join(dir, 'harness.json');
  fs.writeFileSync(stateFile, `${JSON.stringify({
    schema: 'starci/harness-processes@1',
    processes: { app: { pid: 99, mode: 'app', script: 'scripts/machine/harness-verbs.mjs', startedAt: 3_000, children: [503] } },
  })}\n`);
  const killed = [];
  const result = stopHarness({
    stateFile,
    processes: () => [{ pid: 99, created: 3_001, cmd: 'starci harness status' }],
    kill: (pid) => { killed.push(pid); return { ok: true }; },
  });
  assert.equal(result.ok, false);
  assert.deepEqual(killed, []);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).processes.app.pid, 99);
});

test('harness modules have no standalone entry and no server script is spawned', () => {
  const root = path.resolve(import.meta.dirname, '..', '..');
  for (const relative of ['scripts/machine/harness-process.mjs', 'scripts/machine/harness-verbs.mjs', 'ui/server.mjs']) {
    const source = fs.readFileSync(path.join(root, relative), 'utf8');
    assert.doesNotMatch(source, /\bisMain\b|process\.argv/);
    assert.ok(source.split(/\r?\n/).length <= 300, `${relative} stays at or below 300 lines`);
  }
  const files = [];
  const visit = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (/\.(?:mjs|cjs|js)$/.test(entry.name)) files.push(file);
    }
  };
  visit(path.join(root, 'scripts'));
  visit(path.join(root, 'ui'));
  const spawnedServer = /(?:spawnNode|nodeStart|spawn)\s*\(\s*\[[^\]]*["'`][^"'`]*server\.mjs/i;
  for (const file of files) assert.doesNotMatch(fs.readFileSync(file, 'utf8'), spawnedServer, path.relative(root, file));
});
