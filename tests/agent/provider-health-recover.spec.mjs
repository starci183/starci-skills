// Provider-health circuits: credential fingerprints and the Kernel's recover verb.
//
// Live defect (nivo-backend, 2026-09-24): an auth circuit opened by a 401 from a STALE key kept rejecting its pool
// for 24h after the key was rotated and the launch path fixed, because nothing but expiry cleared it. Now an auth
// circuit records the fingerprint of the credential it rejected and reads closed once the credential in effect
// differs, and `api provider-health --recover` lets the Kernel (only) clear it early.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger, PROJECTS_ROOT_ENV } from '../../engine/db/ledger.mjs';
import { openMachine, TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { providerCircuitOf } from '../../scripts/agent/models.mjs';
import { credentialFingerprintOf, fingerprintOf } from '../../scripts/agent/credential-fingerprint.mjs';
import { writeProviderCircuit } from '../../scripts/kernel/provider-circuit.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'api.mjs');
const json = (v) => JSON.stringify(v ?? null);
const out = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };
const errOf = (r) => { try { return JSON.parse(r.stderr.trim().split('\n').pop()); } catch { return null; } };
const sha12 = (v) => crypto.createHash('sha256').update(v, 'utf8').digest('hex').slice(0, 12);

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
// A repo's runtime.sqlite resolves under STARCI_PROJECTS_ROOT (engine/db/ledger.mjs ledgerFileFor —
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
const KERNEL_TERMINAL = 'term_kernel-provider-health';
const seedPhWorkflow = (repo, wf) => seed(repo, (l) => seedWorkflow(l, { id: wf,
  state: { job: 'provider health' },
  jobs: [
    { jobId: `kernel-${wf}`, kind: 'kernel', role: 'kernel', status: 'running', workerId: KERNEL_TERMINAL,
      payload: { hierarchy: { runtime: { terminalHandle: KERNEL_TERMINAL } } } },
    { jobId: 'op-docs-queued', opId: 'docs.author', payload: { opId: 'docs.author', owned_paths: ['docs/'] } },
    { jobId: 'op-docs-running', opId: 'docs.author', status: 'running', workerId: 'term_op-running', payload: { opId: 'docs.author' } },
  ] }));
const devinRejection = (route) => (out(route)?.rejected ?? []).find((r) => r.target === 'devin-agent');

test('an auth circuit reads closed once the credential in effect has a different fingerprint', (t) => {
  const machineFile = machineFileFor(t);
  const saved = process.env[TEST_REGISTRY_ENV];
  process.env[TEST_REGISTRY_ENV] = machineFile;
  t.after(() => { if (saved === undefined) delete process.env[TEST_REGISTRY_ENV]; else process.env[TEST_REGISTRY_ENV] = saved; });
  putCircuit(machineFile, 'devin', { credentialFingerprint: sha12('old-key') });
  putCircuit(machineFile, 'codex', {});
  putCircuit(machineFile, 'claude', { credentialFingerprint: sha12('claude:acct-1'), failureKind: 'readiness' });
  // providerCircuitOf keeps its (db, ...) signature for callers but reads the machine row now.
  assert.equal(providerCircuitOf(null, 'devin', Date.now(), { credential: { fingerprint: sha12('new-key') } }), null,
    'a rotated credential closes the auth circuit');
  assert.ok(providerCircuitOf(null, 'devin-agent', Date.now(), { credential: { fingerprint: sha12('old-key') } }),
    'the same credential keeps it open');
  assert.ok(providerCircuitOf(null, 'devin', Date.now(), { credential: { fingerprint: null } }),
    'an unresolvable current credential proves nothing and keeps it open');
  assert.equal(providerCircuitOf(null, 'devin', Date.now(), { credential: () => ({ fingerprint: sha12('new-key') }) }), null,
    'a lazy resolver is honoured');
  assert.ok(providerCircuitOf(null, 'codex', Date.now(), { credential: { fingerprint: sha12('anything') } }),
    'a circuit that recorded no fingerprint (the live row) waits for expiry or --recover');
  assert.ok(providerCircuitOf(null, 'claude', Date.now(), { credential: { fingerprint: sha12('claude:acct-2') } }),
    'only auth circuits are credential facts; a readiness circuit is not closed by a new account');
});

test('a fingerprint is a 12-hex digest, null for nothing, and an Orca-managed identity needs the account list',() => {
  assert.equal(fingerprintOf(''), null);
  assert.match(fingerprintOf('sk-some-value'), /^[0-9a-f]{12}$/);
  assert.doesNotMatch(String(fingerprintOf('sk-some-value')), /sk-some-value/);
  assert.equal(credentialFingerprintOf('claude').resolved, false, 'an Orca-managed identity needs the account list');
  assert.equal(credentialFingerprintOf('claude', { accounts: { accounts: { claude: { activeAccountId: 'acct-1' } } } }).fingerprint,
    sha12('claude:acct-1'));
  assert.deepEqual(credentialFingerprintOf('devin'), { fingerprint: null, source: null, resolved: true }, 'a card with no credential step has no fingerprint');
});

test('provider-health --recover refuses an op and any caller not proven to be the Kernel', async (t) => {
  const repo = tmp(t, 'starci-ph-roles-'), wf = 'wf-ph-roles', machineFile = machineFileFor(t);
  projectsRoot(t);
  seedPhWorkflow(repo, wf);
  putCircuit(machineFile, 'devin', {});
  const base = { ...baseEnv(), [TEST_REGISTRY_ENV]: machineFile };
  const recover = ['provider-health', '--repo', repo, '--provider', 'devin', '--recover', '--reason', 'key rotated', '--json'];
  const cases = [
    [{ ORCA_TERMINAL_HANDLE: 'term_op-running' }, 'op-context-refused'],
    [{ STARCI_ROLE: 'op', STARCI_OP_JOB: 'op-docs-running' }, 'kernel-proof-required'],
    [{ STARCI_ROLE: 'supervisor' }, 'kernel-proof-required'],
    [{}, 'kernel-proof-required'],
    [{ ORCA_TERMINAL_HANDLE: 'term_somebody-else' }, 'kernel-proof-required'],
  ];
  for (const [extra, code] of cases) {
    const r = await runApi({ ...base, ...extra }, ...recover);
    assert.equal(r.status, 1, `${JSON.stringify(extra)}: ${r.stdout}${r.stderr}`);
    assert.equal(errOf(r)?.code, code, `${JSON.stringify(extra)} → ${code}`);
  }
  const opRead = await runApi({ ...base, ORCA_TERMINAL_HANDLE: 'term_op-running' }, 'provider-health', '--repo', repo, '--provider', 'devin', '--json');
  assert.equal(errOf(opRead)?.code, 'op-context-refused', 'provider-health is a kernel verb for an op, read or not');
  const supervisorRead = await runApi(base, 'provider-health', '--repo', repo, '--provider', 'devin', '--json');
  assert.equal(supervisorRead.status, 0, 'a caller that is not the Kernel may read the row');
  assert.equal(out(supervisorRead)?.open, true);
  const noReason = await runApi({ ...base, ORCA_TERMINAL_HANDLE: KERNEL_TERMINAL }, 'provider-health', '--repo', repo, '--provider', 'devin', '--recover', '--json');
  assert.equal(noReason.status, 2, '--recover without --reason is a usage error');
  const held = {
    row: circuitRow(machineFile, 'devin'),
    recovered: read(repo, (l) => l.db.prepare("SELECT count(*) n FROM events WHERE kind='provider-health-recovered'").get().n),
  };
  assert.equal(held.row.status, 'unavailable', 'every refused caller left the circuit open');
  assert.equal(held.recovered, 0);
});

test('the Kernel recovers an open circuit, and route then admits the pool', async (t) => {
  const repo = tmp(t, 'starci-ph-recover-'), wf = 'wf-ph-recover', machineFile = machineFileFor(t);
  projectsRoot(t);
  seedPhWorkflow(repo, wf);
  putCircuit(machineFile, 'devin', {}); // the live shape: no recorded fingerprint
  const fake = fakeOrcaEnv(t), owner = ownerRoot(t);
  const env = (extra = {}) => ({ ...baseEnv(), ...fake, [TEST_REGISTRY_ENV]: machineFile, STARCI_OWNER_ROOT: owner, ...extra });
  const kernel = { ORCA_TERMINAL_HANDLE: KERNEL_TERMINAL };
  const recover = ['provider-health', '--repo', repo, '--provider', 'devin', '--recover', '--reason', 'auth restored', '--json'];

  const before = await runApi(env(), 'route', '--repo', repo, '--job', 'op-docs-queued', '--json');
  assert.equal(before.status, 0, before.stderr || before.stdout);
  assert.ok(devinRejection(before), 'a circuit without a fingerprint holds until recovered');

  const recovered = await runApi(env(kernel), ...recover);
  assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr);
  assert.equal(out(recovered)?.recovered, true);
  const ledger = read(repo, (l) => ({
    event: l.db.prepare("SELECT workflow_id,payload_json FROM events WHERE kind='provider-health-recovered'").get(),
  }));
  // The recovered row: columns carry status/strikes/circuit_open_until; detail_json the kernel value
  // (reason, previous, credentialFingerprint) — the same shape the old provider-health signal held.
  const machineRow = circuitRow(machineFile, 'devin');
  assert.equal(machineRow.status, 'recovered');
  assert.equal(machineRow.detail.reason, 'auth restored');
  assert.equal(machineRow.detail.previous.jobId, 'op-backend.implement-seeded');
  assert.ok(machineRow.circuit_open_until <= Date.now());
  assert.equal(ledger.event.workflow_id, wf, 'the recovery event lands on the proving Kernel workflow');
  assert.equal(JSON.parse(ledger.event.payload_json).reason, 'auth restored');

  const again = await runApi(env(kernel), ...recover);
  assert.equal(out(again)?.recovered, false, 'nothing open is nothing to recover');

  const admitted = await runApi(env(), 'route', '--repo', repo, '--job', 'op-docs-queued', '--json');
  assert.equal(admitted.status, 0, admitted.stderr || admitted.stdout);
  assert.equal(out(admitted)?.decision?.model, 'devin-agent', 'route admits the recovered pool');
  assert.equal(devinRejection(admitted), undefined);
});
