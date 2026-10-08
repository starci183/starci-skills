// release-sonar-stack.spec.mjs - the local Sonar stack of the release flow: the start-up wait is read from the server's own status and container and ends in a result that names the real state
// (release-sonar-wait.mjs), a stale stack is put back before it is started, the proof is configured for the stack's LOCAL host even when the environment names the public tunnel, and the docker
// host is checked before the cut runs (release-sonar-host.mjs, release-cut-plan.mjs). Every docker call, status read and clock is injected; no container is touched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sonarState } from '../../scripts/gates/sonar-status.mjs';
import { awaitSonarUp, logHint } from '../../scripts/supervisor/release-sonar-wait.mjs';
import { sonarHostFindings } from '../../scripts/supervisor/release-sonar-host.mjs';
import { sonarHostRefusal } from '../../scripts/supervisor/release-cut-plan.mjs';
import { sonarSupplier } from '../../scripts/supervisor/release-l4-sonar.mjs';
import { localStackConfig } from '../../scripts/supervisor/release-sonar-stack.mjs';
import { removeLintReport, writeLintReport } from '../../scripts/supervisor/release-sonar-report.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';

const tmp = (t, label) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `starci-sonar-stack-${label}-`));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const CFG = { host: 'http://localhost:9010', container: 'starci-sonarqube', docker: 'docker' };
const clock = () => { let n = 0; return () => (n += 1000); };
/** The wait's seams: the server reports `states` in turn (the last one repeats), the container is `container`, the logs say `log`. */
const seams = ({ states, container = 'running', log = '', readyMs = 60_000 }) => {
  const reads = [];
  let i = 0;
  return {
    reads,
    deps: {
      state: async () => { reads.push('state'); return { state: states[Math.min(i++, states.length - 1)] }; },
      containerState: () => container,
      logs: () => ({ stdout: log, stderr: '' }),
      sleep: async () => {},
      now: clock(),
      readyMs,
      pollMs: 1000,
    },
  };
};

test('sonarState: the server\'s own word, an HTTP answer by its code, and an unreachable server with the reason', async () => {
  const cfg = (fetch) => ({ host: 'http://sonar.test', timeoutMs: 1000, fetch });
  const answer = (status, body) => async () => ({ status, json: async () => body });
  assert.deepEqual(await sonarState(cfg(answer(200, { status: 'STARTING' }))), { state: 'STARTING' });
  assert.deepEqual(await sonarState(cfg(answer(200, { status: 'DB_MIGRATION_NEEDED' }))), { state: 'DB_MIGRATION_NEEDED' });
  assert.deepEqual(await sonarState(cfg(answer(200, {}))), { state: 'unknown' });
  assert.deepEqual(await sonarState(cfg(answer(502, {}))), { state: 'http-502' });
  const refused = await sonarState(cfg(async () => { throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } }); }));
  assert.deepEqual(refused, { state: 'unreachable', detail: 'ECONNREFUSED' });
});

test('wait: STARTING then UP ends ok after the polls it needed', async () => {
  const s = seams({ states: ['unreachable', 'STARTING', 'STARTING', 'UP'] });
  const out = await awaitSonarUp(CFG, s.deps);
  assert.equal(out.ok, true);
  assert.equal(s.reads.length, 4);
});

test('wait: a server that stays STARTING past the bound fails naming STARTING, the bound and the container state, not "did not report UP"', async () => {
  const s = seams({ states: ['STARTING'], readyMs: 5000 });
  const out = await awaitSonarUp(CFG, s.deps);
  assert.equal(out.ok, false);
  assert.equal(out.state, 'STARTING');
  assert.match(out.reason, /SonarQube at http:\/\/localhost:9010 still reports STARTING after 5s although starci-sonarqube is running; the bound is 5s/);
});

test('wait: a server nothing answers names unreachable with the reason of the last probe', async () => {
  const deps = { ...seams({ states: ['unreachable'], readyMs: 3000 }).deps, state: async () => ({ state: 'unreachable', detail: 'ECONNREFUSED' }) };
  const out = await awaitSonarUp(CFG, deps);
  assert.match(out.reason, /still reports unreachable \(ECONNREFUSED\)/);
});

test('wait: DB_MIGRATION_NEEDED ends the wait at once, naming the volumes and the step the owner takes', async () => {
  const s = seams({ states: ['STARTING', 'DB_MIGRATION_NEEDED'] });
  const out = await awaitSonarUp(CFG, s.deps);
  assert.deepEqual([out.ok, out.state, s.reads.length], [false, 'DB_MIGRATION_NEEDED', 2]);
  assert.match(out.reason, /DB_MIGRATION_NEEDED.*older SonarQube.*\/setup/);
});

test('wait: a server container that stopped ends the wait at once with what its log says (max_map_count, migration, memory)', async () => {
  const mapCount = seams({ states: ['unreachable'], container: 'exited', log: 'ERROR: [1] bootstrap checks failed. max virtual memory areas vm.max_map_count [65530] is too low, increase to at least [262144]' });
  const a = await awaitSonarUp(CFG, mapCount.deps);
  assert.equal(mapCount.reads.length, 1);
  assert.match(a.reason, /starci-sonarqube is exited.*vm\.max_map_count is 65530.*262144/);
  const unknown = await awaitSonarUp(CFG, seams({ states: ['unreachable'], container: 'exited', log: 'nothing known' }).deps);
  assert.match(unknown.reason, /is exited while waiting for http:\/\/localhost:9010 \(docker logs shows no known cause\)/);
  assert.match(logHint('Database migration is required'), /needs its migration/);
  assert.match(logHint('java.lang.OutOfMemoryError: Java heap space'), /out of memory/);
  assert.equal(logHint('all good'), '');
});

test('wait: a container that is restarting is waited for (the server may still become UP); a missing one ends the wait', async () => {
  const restarting = await awaitSonarUp(CFG, seams({ states: ['unreachable', 'UP'], container: 'restarting' }).deps);
  assert.equal(restarting.ok, true);
  const gone = await awaitSonarUp(CFG, seams({ states: ['unreachable'], container: 'missing' }).deps);
  assert.match(gone.reason, /starci-sonarqube is missing/);
});

/** The supplier's docker fake: states by name; start brings every named container to running, stop to exited; the calls are logged. */
const dockerFake = (states) => {
  const calls = [];
  const state = { ...states };
  return {
    calls,
    state,
    docker: {
      inspect: (name) => ({ status: 0, stdout: state[name] }),
      start: (names) => { calls.push(['start', ...names]); for (const n of names) state[n] = 'running'; return { status: 0 }; },
      stop: (names) => { calls.push(['stop', ...names]); for (const n of names) state[n] = 'exited'; return { status: 0 }; },
    },
  };
};
const APP = { name: 'shop', dir: path.join(os.tmpdir(), 'x', 'examples', 'shop') };
const gateOf = (states, extra = {}) => ({ config: () => CFG, state: async () => ({ state: states.shift() ?? 'UP' }), scan: async () => ({ outcome: 'pass' }), dashboard: async () => ({ outcome: 'pass' }), ...extra });

test('supplier: a paused or restarting container is stopped before the stack is started, and what was started is put back', async (t) => {
  const fake = dockerFake({ 'starci-sonarqube-postgres': 'running', 'starci-sonarqube': 'paused' });
  const deps = { gate: gateOf(['STARTING']), lintReport: () => ({ ok: true }), docker: fake.docker, sleep: async () => {}, now: clock(), logDir: () => tmp(t, 'stale') };
  const { proofs, close } = sonarSupplier([APP], deps);
  assert.equal((await proofs['shop: sonar']()).ok, true);
  assert.deepEqual(fake.calls, [['stop', 'starci-sonarqube'], ['start', 'starci-sonarqube']]);
  assert.deepEqual(close().stopped, ['starci-sonarqube']);
});

test('supplier: a dead container refuses the proof naming it; a migration-needed server fails the proof naming DB_MIGRATION_NEEDED; the stack is stopped again', async (t) => {
  const dead = dockerFake({ 'starci-sonarqube-postgres': 'running', 'starci-sonarqube': 'dead' });
  const a = sonarSupplier([APP], { gate: gateOf([]), docker: dead.docker, logDir: () => tmp(t, 'dead') });
  const proof = await a.proofs['shop: sonar']();
  assert.equal(proof.ok, false);
  assert.match(fs.readFileSync(proof.log, 'utf8'), /starci-sonarqube is dead/);
  assert.deepEqual(dead.calls, []);
  const migrate = dockerFake({ 'starci-sonarqube-postgres': 'exited', 'starci-sonarqube': 'exited' });
  const b = sonarSupplier([APP], { gate: gateOf(['DB_MIGRATION_NEEDED']), lintReport: () => ({ ok: true }), docker: migrate.docker, sleep: async () => {}, now: clock(), logDir: () => tmp(t, 'migrate') });
  const failed = await b.proofs['shop: sonar']();
  assert.match(fs.readFileSync(failed.log, 'utf8'), /sonar stack: SonarQube at http:\/\/localhost:9010 reports DB_MIGRATION_NEEDED/);
  assert.deepEqual(b.close().stopped, ['starci-sonarqube', 'starci-sonarqube-postgres']);
});

test('config: the example is configured for its declared LOCAL host even when the environment names the public tunnel host', (t) => {
  const keep = process.env.SONAR_HOST_URL;
  t.after(() => { if (keep === undefined) delete process.env.SONAR_HOST_URL; else process.env.SONAR_HOST_URL = keep; });
  process.env.SONAR_HOST_URL = 'https://sonar.starci.org';
  const cfg = localStackConfig(path.join(skillRoot, 'examples', 'ecommerce-app'));
  assert.equal(cfg.host, 'http://localhost:9010');
  assert.equal(cfg.container, 'starci-sonarqube');
});

test('config: every request of the proof asks for its own connection, so a socket pooled before a long synchronous step is never reused', async (t) => {
  const real = globalThis.fetch;
  t.after(() => { globalThis.fetch = real; });
  const seen = [];
  globalThis.fetch = async (url, init) => { seen.push({ url, headers: init.headers }); return { status: 200 }; };
  const cfg = localStackConfig(path.join(skillRoot, 'examples', 'ecommerce-app'));
  await cfg.fetch('http://localhost:9010/api/system/status', { headers: { Accept: 'application/json' } });
  await cfg.fetch('http://localhost:9010/api/x');
  assert.deepEqual(seen.map((s) => s.headers), [{ Accept: 'application/json', Connection: 'close' }, { Connection: 'close' }]);
});

const READY_HOST = { config: () => CFG, version: () => ({ status: 0, stdout: '29.0.0' }), platform: 'win32' };
const stackStates = (states) => ({ inspect: (name) => (states[name] === 'missing' ? { status: 1, stderr: 'No such container' } : { status: 0, stdout: states[name] }) });
const BOTH = (server = 'exited') => stackStates({ 'starci-sonarqube-postgres': 'exited', 'starci-sonarqube': server });

test('host: a ready docker host and stack has no finding; no example means nothing to check', async () => {
  assert.deepEqual(await sonarHostFindings([APP], { ...READY_HOST, docker: BOTH() }), []);
  assert.deepEqual(await sonarHostFindings([], {}), []);
});

test('host: no docker binary, no daemon and a missing container each refuse, naming the fix', async () => {
  const noBinary = await sonarHostFindings([APP], { ...READY_HOST, version: () => ({ error: Object.assign(new Error('x'), { code: 'ENOENT' }) }) });
  assert.match(noBinary[0].what, /docker binary docker cannot be run \(ENOENT\)/);
  const noDaemon = await sonarHostFindings([APP], { ...READY_HOST, version: () => ({ status: 1 }) });
  assert.match(noDaemon[0].what, /no docker daemon answers/);
  const missing = await sonarHostFindings([APP], { ...READY_HOST, docker: stackStates({ 'starci-sonarqube-postgres': 'missing', 'starci-sonarqube': 'exited' }) });
  assert.match(missing[0].what, /container starci-sonarqube-postgres does not exist/);
});

test('host: a Linux host with a low vm.max_map_count refuses with the exact command; a high value passes; a host that cannot read it is not refused', async () => {
  const linux = { ...READY_HOST, platform: 'linux', docker: BOTH() };
  const low = await sonarHostFindings([APP], { ...linux, read: () => '65530\n' });
  assert.match(low[0].what, /vm\.max_map_count is 65530; SonarQube's Elasticsearch needs 262144/);
  assert.match(low[0].fix, /sysctl -w vm\.max_map_count=262144/);
  assert.deepEqual(await sonarHostFindings([APP], { ...linux, read: () => '1048576' }), []);
  assert.deepEqual(await sonarHostFindings([APP], { ...linux, read: () => { throw new Error('ENOENT'); } }), []);
});

test('host: a running server that reports DB_MIGRATION_NEEDED refuses; a disabled Sonar refuses', async () => {
  const migrate = await sonarHostFindings([APP], { ...READY_HOST, docker: BOTH('running'), state: async () => ({ state: 'DB_MIGRATION_NEEDED' }) });
  assert.match(migrate[0].what, /reports DB_MIGRATION_NEEDED/);
  const up = await sonarHostFindings([APP], { ...READY_HOST, docker: BOTH('running'), state: async () => ({ state: 'UP' }) });
  assert.deepEqual(up, []);
  const disabled = await sonarHostFindings([APP], { ...READY_HOST, config: () => ({ ...CFG, disabled: 'owner switched it off' }) });
  assert.match(disabled[0].what, /Sonar is disabled for shop/);
});

test('cut: a host finding becomes the sonar-host verdict naming every finding; no finding is no refusal', async () => {
  const refusal = await sonarHostRefusal({ repo: os.tmpdir(), deps: { sonarHost: async () => [{ what: 'no docker daemon answers', fix: 'start Docker Desktop' }] } });
  assert.equal(refusal.verdict, 'sonar-host');
  assert.match(refusal.why, /local Sonar stack cannot come up on this host: no docker daemon answers \(start Docker Desktop\)/);
  assert.equal(await sonarHostRefusal({ repo: os.tmpdir(), deps: { sonarHost: async () => [] } }), null);
});

test('report: the lint report is written before the scan; a lint run that writes none fails the proof before any scan; a stale report is never reused', async (t) => {
  const dir = tmp(t, 'report');
  const calls = [];
  const writes = (appDir) => { calls.push(appDir); fs.mkdirSync(path.join(appDir, 'reports'), { recursive: true }); fs.writeFileSync(path.join(appDir, 'reports', 'lint.sonar.json'), '{}'); return { status: 1 }; };
  fs.mkdirSync(path.join(dir, 'reports'));
  fs.writeFileSync(path.join(dir, 'reports', 'lint.sonar.json'), 'stale');
  let seen;
  const none = writeLintReport(dir, { run: (args, options) => { seen = { args, cwd: options.cwd, stale: fs.existsSync(path.join(dir, 'reports', 'lint.sonar.json')) }; return { status: 2, stderr: 'boom' }; } });
  assert.deepEqual(seen, { args: ['exec', '--no-install', '--', 'starci', 'app', 'lint', '--sonar', 'reports/lint.sonar.json'], cwd: dir, stale: false });
  assert.equal(none.ok, false);
  assert.match(none.reason, /wrote no report \(exit 2\): boom/);
  assert.deepEqual(writeLintReport(dir, { run: () => writes(dir) }), { ok: true }, 'findings (a non-zero lint exit) do not stop the report: the gate counts them');
  const fake = dockerFake({ 'starci-sonarqube-postgres': 'running', 'starci-sonarqube': 'running' });
  const scans = [];
  const gate = gateOf([], { scan: async () => { scans.push('scan'); return { outcome: 'pass' }; } });
  const proof = await sonarSupplier([APP], { gate, docker: fake.docker, lintReport: () => ({ ok: false, reason: 'no CLI installed' }), logDir: () => tmp(t, 'noreport') }).proofs['shop: sonar']();
  assert.equal(proof.ok, false);
  assert.match(fs.readFileSync(proof.log, 'utf8'), /sonar lint report: no CLI installed/);
  assert.deepEqual(scans, []);
  assert.deepEqual(calls, [dir]);
  assert.deepEqual(writeLintReport(dir, { run: () => writes(dir) }), { ok: true });
  removeLintReport(dir);
  assert.equal(fs.existsSync(path.join(dir, 'reports')), false, 'the report and its empty directory are gone after the proof');
  removeLintReport(dir);
});
