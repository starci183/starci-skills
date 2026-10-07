// A Kernel-recorded op-override model (starci kernel op-override → kernel-op-override events, plus a job's own
// kernelModel/kernelOverride) is the Kernel's explicit pool decision for that op in that workflow — the same
// authority tier as route-model's explicit --agent over config > default. At route time it outranks the retry
// lineage's demotion of the pinned pool (lineage is evidence, the recorded decision is authority), while a hard
// ineligibility — the pinned pool is outside the op's order, excluded after two pool-attributable lineage
// failures, or behind a dead provider circuit — refuses typed with 'op-override-ineligible' and names why,
// never silently another pool.
//
// Live defect (kprop-3c575ffd11): job op-scope.define-f5c663aa85 carried a recorded op-override pinning
// claude-agent (ovr-202b55bccc), but route handed it to codex-agent because one lineage attempt's
// report-rejected had demoted claude-agent — and Codex launch trust was broken on that host
// (kprop-8eabd89d8c), so the unit only ran after a manual dispatch --model claude-agent (ctx_73f5b08a0c64).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { openMachine } from '../../engine/db/machine.mjs';
import { seedWorkflow as seedLedgerWorkflow } from '../helpers/ledger-fixture.mjs';
import { parseYaml, stringifyYaml } from '../../engine/yaml.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { fakeDevinQuotaEnv } from '../helpers/fake-devin-quota.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const json = (v) => JSON.stringify(v ?? null);
const WF = 'wf-override';
const OP = 'scope.define';
const JOB = 'op-scope.define-f5c663aa85';
const P1 = 'op-scope.define-a1a1a1a1a1';
const P2 = 'op-scope.define-b2b2b2b2b2';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const worldEnv = (repo) => ({ ...process.env,
  STARCI_PROJECTS_ROOT: path.join(repo,'.starciwork','projects'),
  STARCI_TEST_MACHINE_FILE: path.join(repo,'.starciwork','machine.sqlite'),
  STARCI_LOCAL_ROOT: path.join(repo,'.starciwork','localappdata') });
const seed = (repo, fn) => { const l = openLedger({ file: ledgerFileFor(repo,{env:worldEnv(repo)}) }); try { return fn(l); } finally { l.close(); } };
const read = (repo, fn) => { const l = inspectLedger({ file: ledgerFileFor(repo,{env:worldEnv(repo)}) }); try { return fn(l); } finally { l.close(); } };
const ownerRoot = (t) => {
  const dir = tmp(t, 'starci-owner-');
  const example = path.join(ROOT, 'config.example.yaml');
  fs.copyFileSync(example, path.join(dir, 'config.example.yaml'));
  const config = parseYaml(fs.readFileSync(example, 'utf8'));
  fs.writeFileSync(path.join(dir, 'config.yaml'), stringifyYaml({ ...config,
    allocation: { ...(config.allocation ?? {}) },
    budgets: { maxOps: null } }));
  return dir;
};
const env = (t, repo) => {
  const dir = tmp(t, 'starci-fake-orca-');
  const stub = path.join(dir, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  fs.writeFileSync(path.join(dir, 'state.json'), '{}');
  const e = { ...worldEnv(repo), STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(dir, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: path.join(dir, 'state.json'),
    STARCI_OWNER_ROOT: ownerRoot(t), ...fakeDevinQuotaEnv(t, dir) };
  openMachine({ env: e }).close();
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB']) delete e[key];
  return e;
};
const routeRaw = (t, repo, args = []) => {
  const r = spawnSync(process.execPath, [API, 'route', '--repo', repo, '--job', JOB, ...args, '--json'],
    { cwd: ROOT, env: env(t, repo), encoding: 'utf8', windowsHide: true, timeout: 120000 });
  let body = null;
  try { body = JSON.parse(r.stdout); } catch { try { body = JSON.parse(String(r.stderr).trim().split(/\r?\n/).pop()); } catch { body = null; } }
  return { status: r.status, body, stdout: r.stdout, stderr: r.stderr };
};
const route = (t, repo, args) => {
  const r = routeRaw(t, repo, args);
  assert.equal(r.status, 0, r.stderr || r.stdout);
  return r.body;
};
const routeDecided = (repo) => read(repo, (l) => l.db.prepare(
  "SELECT payload_json FROM events WHERE kind='route-decided' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(JOB)?.payload_json);

// The incident's fixture: a scope.define retry (think order claude-agent → codex-agent) whose earlier attempt
// failed pool-attributably on claude-agent, plus — when `override` is given — the Kernel-recorded op-override
// of that op (kernel-authority.mjs OVERRIDE_KIND, the shape op-override.mjs writes).
const seedWorkflow = (repo, { prior = [], override = null } = {}) => seed(repo, (l) => {
  const at = Date.now();
  const ids = [P1, P2];
  const payload = (extra = {}) => ({ opId: OP, owned_paths: ['docs/'], ...extra });
  const jobs = prior.map((p, i) => ({ jobId: ids[i], unitId: 'scope-unit', opId: OP, tryNo: i + 1,
    retryOf: i ? ids[i - 1] : null, status: p.status ?? 'failed', pool: p.pool, payload: payload({ model: p.pool }), result: p.result, createdAt: at + i }));
  jobs.push({ jobId: JOB, unitId: 'scope-unit', opId: OP, tryNo: prior.length + 1,
    retryOf: prior.length ? ids[prior.length - 1] : null, status: 'queued', payload: payload(), createdAt: at + prior.length });
  seedLedgerWorkflow(l, { id: WF, state: { phase: 'running', job: 'override routing' }, goalIdentity: 'overridegoal',
    goal: { revision: 0, identity: 'overridegoal', markdown: '# goal', json: {} }, jobs,
    events: override ? [{ kind: 'kernel-op-override', entityType: 'op-override', entityId: OP,
      payload: { id: 'ovr-202b55bccc', op: OP, override, cleared: false, decision: 'di-1' } }] : [] });
});

// report-rejected is pool-attributable: the worker's claim was overruled on that pool.
const overruled = { verdict: 'fail', claimOverruled: true };

test('control: without an override the lineage demotion still routes away from the failed pool', (t) => {
  const repo = tmp(t, 'starci-route-override-none-');
  seedWorkflow(repo, { prior: [{ pool: 'claude-agent', result: overruled }] });
  const r = route(t, repo);
  assert.equal(r.decision.model, 'codex-agent', 'claude-agent is demoted by the lineage, codex-agent takes the job');
  assert.deepEqual(r.lineageAdjust.demoted, ['claude-agent']);
});

test('a recorded op-override model wins over lineage demotion of the pinned pool', (t) => {
  const repo = tmp(t, 'starci-route-override-wins-');
  seedWorkflow(repo, { prior: [{ pool: 'claude-agent', result: overruled }], override: { model: 'claude-agent' } });
  const r = route(t, repo);
  assert.equal(r.decision.model, 'claude-agent', "the Kernel's recorded pin decides; the demotion is evidence, not authority");
  assert.deepEqual(r.lineageAdjust.demoted, ['claude-agent'], 'the demotion evidence still reports');
  assert.equal(r.lineageAdjust.demotedTaken, true, 'the demoted pool was taken — by the override, not by exhaustion');
  assert.deepEqual(r.opOverride, { op: OP, model: 'claude-agent' });
  const decided = JSON.parse(routeDecided(repo));
  assert.deepEqual(decided.routeOverride, { op: OP, model: 'claude-agent' });
  assert.equal(decided.model, 'claude-agent');
  assert.equal(decided.pick.by, 'bias', 'the pin is an only selector: the pick record says the bias chose');
  const notNamed = decided.pick.record.dropped.filter((row) => row.step === 'bias');
  assert.ok(notNamed.length > 0, 'every other member of the tier is dropped at the bias step');
  for (const row of notNamed) assert.equal(row.reason, 'not named by only', `a non-target drop reads as the only pin (${row.id})`);
  assert.ok(decided.pick.member.startsWith('claude/'), 'the chosen member is the pinned pool');
});

test('a recorded op-override never silently substitutes another pool: an excluded pin is a typed refusal', (t) => {
  const repo = tmp(t, 'starci-route-override-excluded-');
  seedWorkflow(repo, { prior: [{ pool: 'claude-agent', result: overruled }, { pool: 'claude-agent', result: overruled }],
    override: { model: 'claude-agent' } });
  const r = routeRaw(t, repo);
  assert.equal(r.status, 1, `an ineligible pin refuses, got: ${r.stdout}${r.stderr}`);
  assert.equal(r.body.reason, 'op-override-ineligible');
  assert.match(r.body.detail, /claude-agent/);
  assert.match(r.body.detail, /excluded for this retry lineage|ineligible/, 'the refusal names the actual ineligibility');
  assert.equal(routeDecided(repo) ?? null, null, 'a refused route writes no route-decided');
  assert.equal(read(repo, (l) => l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(JOB)?.status), 'queued',
    'the job stays queued for the Kernel to retarget or clear the override');
});

test("a pinned pool outside the op's tier chain refuses typed, naming the tier", (t) => {
  const repo = tmp(t, 'starci-route-override-order-');
  seedWorkflow(repo, { prior: [{ pool: 'claude-agent', result: overruled }], override: { model: 'devin-agent' } });
  const r = routeRaw(t, repo);
  assert.equal(r.status, 1, `an out-of-order pin refuses, got: ${r.stdout}${r.stderr}`);
  assert.equal(r.body.reason, 'op-override-ineligible');
  assert.match(r.body.detail, /devin-agent/);
  assert.match(r.body.detail, /outside scope\.define's tier \S+ at \S+ \[/, "the refusal names the op's tier chain the pin is absent from");
  assert.equal(routeDecided(repo) ?? null, null);
});
