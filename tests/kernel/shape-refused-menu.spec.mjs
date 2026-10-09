// StarCi 2026-10-09: op-work.author-ab81f9802d (try 2) sat ready for 25 minutes: the dispatch push skipped it every minute as "same-failing-shape as
// op-work.author-c10c110700 (grant-too-narrow)", a skip inside a successful push, and no Kernel menu item, no Decision Item and no wait named an owner for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { buildMenu } from '../../scripts/kernel/kernel-menu.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-shape';
const T0 = Date.now() - 3_600_000;
const payload = { opId: 'work.author', records: [], owned_paths: ['.starciwork/features/auth/impl'], params: { maxFiles: 12 } };

const status = (world) => JSON.parse(spawnSync(process.execPath, [CLI, 'status', '--repo', world.repoRoot, '--workflow', WF, '--json'], { cwd: ROOT, encoding: 'utf8', timeout: 180_000,
  env: { ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' } }).stdout);

test('a ready job with the shape of a failed job of its unit is a Kernel menu item with a widen choice, not a silent skip', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'shape' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} }, jobs: [
    { jobId: 'op-work.author-failed1', unitId: 'op-work.author-failed1', opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000, payload, result: { verdict: 'fail' } },
    { jobId: 'op-work.author-retry02', unitId: 'op-work.author-failed1', opId: 'work.author', status: 'queued', tryNo: 2, retryOf: 'op-work.author-failed1', createdAt: T0 + 200_000, payload }] });
  const attempt = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get('op-work.author-failed1');
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,?,?,'m',?)").run(attempt.attempt_id, WF, 'op-work.author-failed1', T0);
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(WF, attempt.attempt_id, attempt.dispatch_id, 'op-work.author-failed1', 'blocked', JSON.stringify({ outcome: 'blocked', summary: 'needs a shared file', blocker: { kind: 'shared-change', detail: 'the fix needs files outside the owned paths' } }), T0 + 60_000, T0 + 30_000);
  ledger.close();
  const out = status(world);
  const item = out.menu.find((entry) => entry.kind === 'shape-refused');
  assert.ok(item, JSON.stringify(out.menu.map((entry) => entry.id)));
  assert.equal(item.subject.job, 'op-work.author-retry02');
  assert.match(item.question, /shape of op-work.author-failed1.*grant-too-narrow/);
  const widen = item.options.find((option) => option.choice === 'widen');
  assert.deepEqual([widen.steps[0].verb, widen.steps[0].args.edit, widen.steps[0].args.job], ['graph-edit', 'widen', 'op-work.author-retry02']);
  assert.equal(widen.text, 'paths');
  assert.equal(out.frontier.actionable, true, 'the Kernel is woken for it');
}));

test('the shape item is built from its sources and carries the failed job as evidence', () => {
  const menu = buildMenu({ workflow: WF, rev: null, jobDecisions: [], shapeRefused: [{ jobId: 'j2', op: 'work.author', failedJobId: 'j1', situation: 'j2 is ready but has the shape of j1' }], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [], handover: null, snoozed: new Set() });
  assert.deepEqual(menu.map((item) => item.id), ['shape-refused:j2']);
  assert.deepEqual(menu[0].evidence.map((entry) => entry.ref), ['job:j2', 'job:j1']);
  assert.equal(menu[0].options.at(-1).choice, 'none-fits', 'the escape stays last');
});
