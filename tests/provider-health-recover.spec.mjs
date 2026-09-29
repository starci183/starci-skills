// Provider-health circuits: credential fingerprints and the Kernel's recover verb.
//
// Live defect (nivo-backend, 2026-09-24): a qwen auth circuit opened by a 401
// from a STALE key inherited from Orca's environment kept rejecting qwen-agent
// for 24h after the key was rotated, the launch path fixed and qwen verified
// end to end, because nothing but expiry cleared it. Now an auth circuit
// records the fingerprint of the credential it rejected and reads closed once
// the credential in effect differs, and `api provider-health --recover` lets
// the Kernel (only) clear it early, behind an optional live probe.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger, PROJECTS_ROOT_ENV } from '../engine/ledger-db.mjs';
import { openMachine, TEST_REGISTRY_ENV } from '../engine/machine-db.mjs';
import { parseYaml, stringifyYaml } from '../engine/yaml.mjs';
import { providerCircuitOf } from '../scripts/agent/models.mjs';
import { credentialFingerprintOf, fingerprintOf } from '../scripts/agent/credential-fingerprint.mjs';
import { writeProviderCircuit } from '../scripts/kernel/provider-circuit.mjs';
import { seedWorkflow } from './_ledger-fixture.mjs';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (v) => JSON.stringify(v ?? null);
const out = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
const errOf = (r) => { try { return JSON.parse(r.stderr.trim().split('\n').pop()); } catch { return null; } };
const sha12 = (v) => crypto.createHash('sha256').update(v, 'utf8').digest('hex').slice(0, 12);
const QWEN_MODEL = parseYaml(fs.readFileSync(path.join(ROOT, 'modules', 'models', 'agents', 'qwen.yaml'), 'utf8')).model;

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const seed = (repo, fn) => { const l = openLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
const read = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l); } finally { l.close(); } };
// The provider-health circuit is a machine.sqlite provider_health row now (scripts/kernel/provider-circuit.mjs):
// the runtime signals table only takes kernel|stop|launch|decision-doorbell. The kernel-facing value rides in
// detail_json and the cooldown in circuit_open_until; the spec pins one file through STARCI_TEST_MACHINE_FILE so
// seeding, the api subprocess and the spec's reads all share it.
const machineFileFor = (t) => path.join(tmp(t, 'starci-machine-'), 'machine.sqlite');
// A repo's runtime.sqlite resolves under STARCI_PROJECTS_ROOT (engine/ledger-db.mjs ledgerFileFor —
// projects/<ledgerId>/runtime.sqlite, never <repo>/.starciwork). Pin one per test so the spec's
// seed/read and every spawned api subprocess resolve the same file however LOCALAPPDATA is faked.
const projectsRoot = (t) => {
  const dir = path.join(tmp(t, 'starci-projects-'), 'projects');
  const saved = process.env[PROJECTS_ROOT_ENV];
  process.env[PROJECTS_ROOT_ENV] = dir;
  t.after(() => { if (saved === undefined) delete process.env[PROJECTS_ROOT_ENV]; else process.env[PROJECTS_ROOT_ENV] = saved; });
  return dir;
};
const putCircuit = (machineFile, provider, value, { ttl = 24 * 3600000 } = {}) => {
  const m = openMachine({ file: machineFile });
  try {
    writeProviderCircuit(provider, { machine: m, expiresAt: Date.now() + ttl,
      value: { schema: 'starci/provider-health@1', provider, status: 'unavailable', failureKind: 'auth', strikeLimit: 1,
        model: `${provider}-agent`, jobId: 'op-backend.implement-seeded', step: 'attestation', signal: "generic failure signature '401'",
        detail: "attestation rejected: generic failure signature '401'", failures: 1, trips: 1, cooldownMs: ttl, ...value } });
  } finally { m.close(); }
};
const circuitRow = (machineFile, provider) => {
  const m = openMachine({ file: machineFile });
  try {
    const row = m.db.prepare('SELECT * FROM provider_health WHERE provider=?').get(provider);
    return row ? { ...row, detail: JSON.parse(row.detail_json ?? 'null') } : null;
  } finally { m.close(); }
};

// A credential root whose .secrets/models.env holds `key` (the card's secretName), and a home
// whose ~/.qwen/settings.json points the card's model at `baseUrl`.
const credentialRoot = (t, key) => {
  const dir = tmp(t, 'starci-cred-');
  fs.mkdirSync(path.join(dir, '.secrets'));
  if (key != null) fs.writeFileSync(path.join(dir, '.secrets', 'models.env'), `OTHER=1\nQWENCLOUD_API_KEY = "${key}"\n`);
  return dir;
};
const qwenHome = (t, baseUrl) => {
  const home = tmp(t, 'starci-home-');
  fs.mkdirSync(path.join(home, '.qwen'));
  fs.writeFileSync(path.join(home, '.qwen', 'settings.json'), JSON.stringify({ modelProviders: { openai: [
    { id: 'other-model', baseUrl: 'http://127.0.0.1:9/never' },
    { id: QWEN_MODEL, baseUrl, envKey: 'BAILIAN_TOKEN_PLAN_API_KEY' }] } }));
  return home;
};
const ownerRoot = (t) => {
  const dir = tmp(t, 'starci-owner-');
  const example = path.join(ROOT, 'config.example.yaml');
  fs.copyFileSync(example, path.join(dir, 'config.example.yaml'));
  const config = parseYaml(fs.readFileSync(example, 'utf8'));
  fs.writeFileSync(path.join(dir, 'config.yaml'), stringifyYaml({ ...config, budgets: { maxOps: null } }));
  return dir;
};
const fakeOrcaEnv = (t) => {
  const dir = tmp(t, 'starci-fake-orca-');
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  fs.writeFileSync(path.join(dir, 'state.json'), '{}');
  return { STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(dir, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(dir, 'state.json'),
    LOCALAPPDATA: path.join(dir, 'localappdata') };
};
// The caller's identity comes only from what a test passes: an inherited Orca
// handle or role marker would make the spec depend on where it runs.
const baseEnv = () => {
  const env = { ...process.env };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB', 'STARCI_CREDENTIAL_ROOT']) delete env[key];
  return env;
};
// Async so an in-process HTTP server can answer the probe while the api runs.
const runApi = (env, ...args) => new Promise((resolve) => {
  const child = spawn(process.execPath, [API, ...args], { cwd: ROOT, env, windowsHide: true });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => { stdout += d; });
  child.stderr.on('data', (d) => { stderr += d; });
  const timer = setTimeout(() => child.kill(), 120000);
  child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
});
const modelsServer = async (t, goodKey) => {
  const seen = [];
  const server = http.createServer((req, res) => {
    seen.push({ method: req.method, url: req.url, auth: req.headers.authorization === `Bearer ${goodKey}` });
    const ok = req.method === 'GET' && req.url === '/v1/models' && req.headers.authorization === `Bearer ${goodKey}`;
    res.writeHead(ok ? 200 : 401, { 'content-type': 'application/json' });
    res.end(ok ? '{"data":[]}' : '{"code":"InvalidApiKey","message":"Invalid API-key provided."}');
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise((r) => server.close(r)));
  return { baseUrl: `http://127.0.0.1:${server.address().port}/v1`, seen };
};
const KERNEL_TERMINAL = 'term_kernel-provider-health';
const seedPhWorkflow = (repo, wf) => seed(repo, (l) => seedWorkflow(l, { id: wf,
  state: { job: 'provider health' },
  jobs: [
    { jobId: `kernel-${wf}`, kind: 'kernel', role: 'kernel', status: 'running', workerId: KERNEL_TERMINAL,
      payload: { hierarchy: { runtime: { terminalHandle: KERNEL_TERMINAL } } } },
    { jobId: 'op-docs-queued', opId: 'docs.author', payload: { opId: 'docs.author', owned_paths: ['docs/'] } },
    { jobId: 'op-docs-running', opId: 'docs.author', status: 'running', workerId: 'term_op-running', payload: { opId: 'docs.author' } },
  ] }));
const qwenRejection = (route) => (out(route)?.rejected ?? []).find((r) => r.target === 'qwen-agent');

test('an auth circuit reads closed once the credential in effect has a different fingerprint', (t) => {
  const machineFile = machineFileFor(t);
  const saved = process.env[TEST_REGISTRY_ENV];
  process.env[TEST_REGISTRY_ENV] = machineFile;
  t.after(() => { if (saved === undefined) delete process.env[TEST_REGISTRY_ENV]; else process.env[TEST_REGISTRY_ENV] = saved; });
  putCircuit(machineFile, 'qwen', { credentialFingerprint: sha12('old-key') });
  putCircuit(machineFile, 'codex', {});
  putCircuit(machineFile, 'claude', { credentialFingerprint: sha12('claude:acct-1'), failureKind: 'readiness' });
  // providerCircuitOf keeps its (db, ...) signature for callers but reads the machine row now.
  assert.equal(providerCircuitOf(null, 'qwen', Date.now(), { credential: { fingerprint: sha12('new-key') } }), null,
    'a rotated credential closes the auth circuit');
  assert.ok(providerCircuitOf(null, 'qwen-agent', Date.now(), { credential: { fingerprint: sha12('old-key') } }),
    'the same credential keeps it open');
  assert.ok(providerCircuitOf(null, 'qwen', Date.now(), { credential: { fingerprint: null } }),
    'an unresolvable current credential proves nothing and keeps it open');
  assert.equal(providerCircuitOf(null, 'qwen', Date.now(), { credential: () => ({ fingerprint: sha12('new-key') }) }), null,
    'a lazy resolver is honoured');
  assert.ok(providerCircuitOf(null, 'codex', Date.now(), { credential: { fingerprint: sha12('anything') } }),
    'a circuit that recorded no fingerprint (the live qwen row) waits for expiry or --recover');
  assert.ok(providerCircuitOf(null, 'claude', Date.now(), { credential: { fingerprint: sha12('claude:acct-2') } }),
    'only auth circuits are credential facts; a readiness circuit is not closed by a new account');
});

test('the qwen fingerprint follows the credentialRefresh resolution and never exposes the key', (t) => {
  const saved = { root: process.env.STARCI_CREDENTIAL_ROOT, profile: process.env.USERPROFILE, home: process.env.HOME };
  t.after(() => { for (const [k, v] of [['STARCI_CREDENTIAL_ROOT', saved.root], ['USERPROFILE', saved.profile], ['HOME', saved.home]]) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v; } });
  const home = tmp(t, 'starci-home-');
  fs.mkdirSync(path.join(home, '.qwen'));
  process.env.USERPROFILE = home; process.env.HOME = home;

  process.env.STARCI_CREDENTIAL_ROOT = credentialRoot(t, 'sk-rotated-value');
  const secret = credentialFingerprintOf('qwen-agent');
  assert.equal(secret.fingerprint, sha12('sk-rotated-value'), 'the quoted secrets-file value, cleaned like the card step');
  assert.equal(secret.source, '.secrets/models.env#QWENCLOUD_API_KEY'.replace(/^/, 'secrets-file:'));
  assert.doesNotMatch(JSON.stringify(secret), /sk-rotated-value/);
  assert.match(secret.fingerprint, /^[0-9a-f]{12}$/);

  // No secretName line: the step unsets envKey and Qwen reads its own env file.
  process.env.STARCI_CREDENTIAL_ROOT = credentialRoot(t, null);
  fs.writeFileSync(path.join(home, '.qwen', '.env'), 'BAILIAN_TOKEN_PLAN_API_KEY=sk-own-env\n');
  const own = credentialFingerprintOf('qwen');
  assert.equal(own.fingerprint, sha12('sk-own-env'));
  assert.match(own.source, /^provider-env-file:/);

  fs.rmSync(path.join(home, '.qwen', '.env'));
  assert.equal(credentialFingerprintOf('qwen').fingerprint, null, 'nothing resolvable is null, never a guess');
  assert.equal(fingerprintOf(''), null);
  assert.equal(credentialFingerprintOf('claude').resolved, false, 'an Orca-managed identity needs the account list');
  assert.equal(credentialFingerprintOf('claude', { accounts: { accounts: { claude: { activeAccountId: 'acct-1' } } } }).fingerprint,
    sha12('claude:acct-1'));
});

test('a rotated qwen key closes the circuit for route; the unchanged key keeps qwen-agent rejected', async (t) => {
  const repo = tmp(t, 'starci-ph-route-'), wf = 'wf-ph-rotation', machineFile = machineFileFor(t);
  projectsRoot(t);
  seedPhWorkflow(repo, wf);
  putCircuit(machineFile, 'qwen', { credentialFingerprint: sha12('sk-stale') });
  const env = (key) => ({ ...baseEnv(), ...fakeOrcaEnv(t), [TEST_REGISTRY_ENV]: machineFile, STARCI_OWNER_ROOT: ownerRoot(t), STARCI_CREDENTIAL_ROOT: credentialRoot(t, key),
    BAILIAN_TOKEN_PLAN_API_KEY: 'quota-presence-only' });

  const stale = await runApi(env('sk-stale'), 'route', '--repo', repo, '--job', 'op-docs-queued', '--prefer', 'qwen-agent', '--json');
  assert.equal(stale.status, 0, stale.stderr || stale.stdout);
  assert.notEqual(out(stale)?.decision?.model, 'qwen-agent', 'the rejected credential is still in effect');
  assert.match(qwenRejection(stale)?.reason ?? '', /provider auth is unavailable: .*api provider-health --provider qwen --recover/);
  const shown = await runApi(env('sk-stale'), 'provider-health', '--repo', repo, '--provider', 'qwen-agent', '--json');
  assert.equal(out(shown)?.open, true);
  assert.equal(out(shown)?.credential?.rotated, false);

  const rotated = await runApi(env('sk-rotated'), 'route', '--repo', repo, '--job', 'op-docs-queued', '--prefer', 'qwen-agent', '--json');
  assert.equal(rotated.status, 0, rotated.stderr || rotated.stdout);
  assert.equal(out(rotated)?.decision?.model, 'qwen-agent', 'a rotated key re-admits the pool without waiting out the cooldown');
  const after = await runApi(env('sk-rotated'), 'provider-health', '--repo', repo, '--provider', 'qwen', '--json');
  assert.equal(out(after)?.open, false);
  assert.deepEqual([out(after)?.credential?.recorded, out(after)?.credential?.rotated], [sha12('sk-stale'), true]);
  for (const r of [stale, shown, rotated, after]) assert.doesNotMatch(r.stdout + r.stderr, /sk-stale|sk-rotated/, 'no key value in any output');
});

test('provider-health --recover refuses an op and any caller not proven to be the Kernel', async (t) => {
  const repo = tmp(t, 'starci-ph-roles-'), wf = 'wf-ph-roles', machineFile = machineFileFor(t);
  projectsRoot(t);
  seedPhWorkflow(repo, wf);
  putCircuit(machineFile, 'qwen', {});
  const base = { ...baseEnv(), [TEST_REGISTRY_ENV]: machineFile, STARCI_CREDENTIAL_ROOT: credentialRoot(t, 'sk-any') };
  const recover = ['provider-health', '--repo', repo, '--provider', 'qwen', '--recover', '--reason', 'key rotated', '--json'];
  const cases = [
    [{ STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-docs-running' }, 'op-context-refused'],
    [{ ORCA_TERMINAL_HANDLE: 'term_op-running' }, 'op-context-refused'],
    [{ STARCI_ROLE: 'supervisor' }, 'kernel-proof-required'],
    [{}, 'kernel-proof-required'],
    [{ ORCA_TERMINAL_HANDLE: 'term_somebody-else' }, 'kernel-proof-required'],
  ];
  for (const [extra, code] of cases) {
    const r = await runApi({ ...base, ...extra }, ...recover);
    assert.equal(r.status, 1, `${JSON.stringify(extra)}: ${r.stdout}${r.stderr}`);
    assert.equal(errOf(r)?.code, code, `${JSON.stringify(extra)} → ${code}`);
  }
  const opRead = await runApi({ ...base, STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-docs-running' }, 'provider-health', '--repo', repo, '--provider', 'qwen', '--json');
  assert.equal(errOf(opRead)?.code, 'op-context-refused', 'provider-health is a kernel verb for an op, read or not');
  const supervisorRead = await runApi(base, 'provider-health', '--repo', repo, '--provider', 'qwen', '--json');
  assert.equal(supervisorRead.status, 0, 'a caller that is not the Kernel may read the row');
  assert.equal(out(supervisorRead)?.open, true);
  const noReason = await runApi({ ...base, ORCA_TERMINAL_HANDLE: KERNEL_TERMINAL }, 'provider-health', '--repo', repo, '--provider', 'qwen', '--recover', '--json');
  assert.equal(noReason.status, 2, '--recover without --reason is a usage error');
  const held = {
    row: circuitRow(machineFile, 'qwen'),
    recovered: read(repo, (l) => l.db.prepare("SELECT count(*) n FROM events WHERE kind='provider-health-recovered'").get().n),
  };
  assert.equal(held.row.status, 'unavailable', 'every refused caller left the circuit open');
  assert.equal(held.recovered, 0);
});

test('the Kernel recovers only behind a passing probe, and route then admits the pool', async (t) => {
  const repo = tmp(t, 'starci-ph-recover-'), wf = 'wf-ph-recover', machineFile = machineFileFor(t);
  projectsRoot(t);
  seedPhWorkflow(repo, wf);
  putCircuit(machineFile, 'qwen', {}); // the live shape: no recorded fingerprint
  const server = await modelsServer(t, 'sk-good');
  const home = qwenHome(t, server.baseUrl);
  const fake = fakeOrcaEnv(t), owner = ownerRoot(t);
  const env = (key, extra = {}) => ({ ...baseEnv(), ...fake, [TEST_REGISTRY_ENV]: machineFile, STARCI_OWNER_ROOT: owner, STARCI_CREDENTIAL_ROOT: credentialRoot(t, key),
    USERPROFILE: home, HOME: home, BAILIAN_TOKEN_PLAN_API_KEY: 'quota-presence-only', ...extra });
  const kernel = { ORCA_TERMINAL_HANDLE: KERNEL_TERMINAL };
  const recover = ['provider-health', '--repo', repo, '--provider', 'qwen', '--recover', '--reason', 'key rotated in .secrets/models.env', '--probe', '--json'];

  const before = await runApi(env('sk-good'), 'route', '--repo', repo, '--job', 'op-docs-queued', '--prefer', 'qwen-agent', '--json');
  assert.equal(before.status, 0, before.stderr || before.stdout);
  assert.ok(qwenRejection(before), 'a circuit without a fingerprint holds until recovered');

  const refused = await runApi(env('sk-bad', kernel), ...recover);
  assert.equal(refused.status, 1, refused.stdout + refused.stderr);
  assert.equal(errOf(refused)?.code, 'probe-failed');
  assert.equal(errOf(refused)?.probe?.status, 401);
  assert.equal(server.seen.at(-1)?.url, '/v1/models', 'the probe is GET <baseUrl>/models for the card model');
  const afterRefusal = {
    status: circuitRow(machineFile, 'qwen')?.status,
    refusedEvents: read(repo, (l) => l.db.prepare("SELECT workflow_id FROM events WHERE kind='provider-health-recover-refused'").all()),
  };
  assert.equal(afterRefusal.status, 'unavailable', 'a failed probe leaves the circuit open');
  assert.deepEqual(afterRefusal.refusedEvents.map((e) => e.workflow_id), [wf]);

  const recovered = await runApi(env('sk-good', kernel), ...recover);
  assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr);
  assert.equal(out(recovered)?.recovered, true);
  assert.equal(out(recovered)?.probe?.status, 200);
  assert.equal(server.seen.at(-1)?.auth, true, 'the probe presented the credentialRefresh key');
  const ledger = read(repo, (l) => ({
    event: l.db.prepare("SELECT workflow_id,payload_json FROM events WHERE kind='provider-health-recovered'").get(),
  }));
  // The recovered row: columns carry status/strikes/circuit_open_until; detail_json the kernel value
  // (reason, previous, credentialFingerprint) — the same shape the old provider-health signal held.
  const machineRow = circuitRow(machineFile, 'qwen');
  assert.equal(machineRow.status, 'recovered');
  assert.equal(machineRow.detail.reason, 'key rotated in .secrets/models.env');
  assert.equal(machineRow.detail.previous.jobId, 'op-backend.implement-seeded');
  assert.equal(machineRow.detail.credentialFingerprint, sha12('sk-good'));
  assert.ok(machineRow.circuit_open_until <= Date.now());
  assert.equal(ledger.event.workflow_id, wf, 'the recovery event lands on the proving Kernel workflow');
  assert.equal(JSON.parse(ledger.event.payload_json).reason, 'key rotated in .secrets/models.env');

  const again = await runApi(env('sk-good', kernel), ...recover);
  assert.equal(out(again)?.recovered, false, 'nothing open is nothing to recover');

  const admitted = await runApi(env('sk-good'), 'route', '--repo', repo, '--job', 'op-docs-queued', '--prefer', 'qwen-agent', '--json');
  assert.equal(admitted.status, 0, admitted.stderr || admitted.stdout);
  assert.equal(out(admitted)?.decision?.model, 'qwen-agent', 'route admits the recovered pool');
  assert.equal(qwenRejection(admitted), undefined);
  for (const r of [refused, recovered, again, admitted]) assert.doesNotMatch(r.stdout + r.stderr, /sk-good|sk-bad/, 'no key value in any output');
});
