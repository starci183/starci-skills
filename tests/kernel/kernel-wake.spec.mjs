// The Kernel's wake: the prompt asks it to answer its menu and nothing else, a wake over the per-wake budget is a departure the digest
// reports, `--field` gives the read verbs the one value a seat needs, and a retry-decision item lives while its job has no later try.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { buildWakePrompt } from '../../scripts/kernel/kernel-watchdog.mjs';
import { exceededWakes, wakeBudget, wakeUsageOf } from '../../scripts/kernel/wake-budget.mjs';
import { liveFor } from '../../scripts/machine/decision-resolution.mjs';
import { analyze } from '../../scripts/reconciler/debug-digest-analyze.mjs';
import { digestNumbers } from '../../scripts/reconciler/debug-digest-numbers.mjs';
import { incidentPolicy, boundValue } from '../../scripts/kernel/op-incident-policy.mjs';
import { renderText } from '../../scripts/reconciler/debug-digest-render.mjs';
import { fieldEmit } from '../../scripts/kernel/verbs/shared/field-view.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-wake';
const NOW = 1_800_000_000_000;
const MIN = 60_000;

test('the wake prompt asks for the menu and a yield, and teaches no command to compose', () => {
  const prompt = buildWakePrompt('wf-wake', 3);
  assert.match(prompt, /Read starci kernel status: its menu lists what waits on you\. Answer each item with starci kernel decide\./);
  assert.match(prompt, /When the menu is empty, yield the model turn immediately/);
  for (const taught of [/dispatch-ready/, /enqueue/, /settle/, /reconcile/, /nextActions/, /ranked/, /--retry-of/]) assert.doesNotMatch(prompt, taught);
  assert.ok(prompt.length < 800);
});

test('the Kernel role declares a per-wake budget taken from the measured usage rows', () => {
  assert.deepEqual(wakeBudget(), { turns: 20, tokens: 6_000_000 });
  const over = exceededWakes([{ at: 1, turns: 20, tokens: 6_000_000 }, { at: 2, turns: 21, tokens: 1 }, { at: 3, turns: 1, tokens: 6_000_001 }], wakeBudget());
  assert.deepEqual(over.map((wake) => wake.at), [2, 3]);
});

test('a wake owns the usage rows recorded after it and up to the next wake', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'wake' }, goalIdentity: 'wake-goal', goal: { revision: 0, identity: 'wake-goal', markdown: '# goal', json: {} },
    events: [{ kind: 'kernel-woken', entityType: 'kernel', at: NOW, payload: { terminal: 't' } }, { kind: 'kernel-woken', entityType: 'kernel', at: NOW + 30 * MIN, payload: { terminal: 't' } }] });
  const usage = (at, turns, cacheRead) => ledger.db.prepare(`INSERT INTO llm_usage(workflow_id,subject_type,turn_ref,provider,input_tokens,output_tokens,cache_read_tokens,turns,source,at)
    VALUES(?,'kernel-turn',?,'claude',10,5,?,?,'cli-transcript',?)`).run(WF, `kernel:${WF}:s@${at}`, cacheRead, turns, at);
  usage(NOW + 5 * MIN, 12, 3_000_000);
  usage(NOW + 10 * MIN, 12, 4_000_000);
  usage(NOW + 40 * MIN, 3, 100_000);
  const wakes = wakeUsageOf(ledger.db, WF);
  assert.deepEqual(wakes, [{ at: NOW, turns: 24, tokens: 7_000_030 }, { at: NOW + 30 * MIN, turns: 3, tokens: 100_015 }]);
  assert.deepEqual(exceededWakes(wakes, wakeBudget()).map((wake) => wake.at), [NOW]);
}));

test('the digest reports a Kernel wake over its budget as a departure of the Kernel', () => {
  const policy = { ...incidentPolicy(), resolve: boundValue };
  const job = { jobId: `kernel-${WF}`, kind: 'kernel', opId: null, status: 'running', tryNo: 1, retryOf: null, workerId: 'w', deadline: null, createdAt: NOW - MIN, updatedAt: NOW - MIN };
  const workflow = { id: WF, name: 'Wake', ledger: 'wake', repo: 'work/wake', phase: 'running', jobs: [job], incidents: [], decisions: [], kernelJob: { status: 'running', updatedAt: NOW }, kernelSignal: { terminal: 'term_k' },
    lastKernelWakeAt: NOW - MIN, statusError: null, seatProbe: { action: 'idle-waiting' }, kernelWakes: [{ at: NOW - 40 * MIN, turns: 61, tokens: 9_000_000 }],
    status: { frontier: { state: 'idle', openOperations: 0, readyOperations: 0, queued: [] }, legs: [], awaitingOwner: [], menu: [], kernelRev: { current: 'a', acked: 'a', stale: false, fileCount: 0 }, usage: { byOp: [] } } };
  const digest = analyze({ now: NOW, liveRev: 'a', engine: { leader: { pid: 1, epoch: 1, heartbeatAt: NOW, rev: 'a' }, modes: {}, configured: {}, safe: [], failingQueue: [] },
    supervisor: { seat: null, enabled: false, lastWakeAt: null, decisions: [], health: { live: true } }, reservations: [], seats: [], supJobs: [], workflows: [workflow] }, policy, digestNumbers());
  const problem = digest.problems.find((p) => p.code === 'kernel-wake-budget');
  assert.deepEqual([problem.params.turns, problem.params.tokens, problem.params.budgetTurns, problem.params.budgetTokens], [61, 9_000_000, 20, 6_000_000]);
  assert.match(renderText(digest, { language: 'en' }), /spent 61 turns and 9000000 tokens in one wake, over its budget of 20 turns and 6000000 tokens/);
});

test('--field reduces an answer to the named paths', () => {
  const said = [];
  const emit = (out, human, asJson) => said.push({ out, human, asJson });
  fieldEmit(emit, { workflow: WF, field: 'frontier.state, jobs.failed ,menu.0.id,missing' })({ ok: true, frontier: { state: 'engaged' }, jobs: { failed: 2 }, menu: [{ id: 'a' }] }, 'text', false);
  assert.deepEqual(said[0], { out: { ok: true, workflowId: WF, fields: { 'frontier.state': 'engaged', 'jobs.failed': 2, 'menu.0.id': 'a', missing: null } }, human: '', asJson: true });
  fieldEmit(emit, { workflow: WF })({ ok: true }, 'text', false);
  assert.deepEqual(said[1], { out: { ok: true }, human: 'text', asJson: false });
});

test('status --field prints only the named fields as JSON', (t) => withLedger(t, (world) => {
  seedWorkflow(world.ledger, { id: WF, state: { phase: 'running', job: 'wake' }, goalIdentity: 'wake-goal', goal: { revision: 0, identity: 'wake-goal', markdown: '# goal', json: {} }, jobs: [] });
  world.ledger.close();
  const env = { ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' };
  const r = spawnSync(process.execPath, [CLI, 'status', '--repo', world.repoRoot, '--workflow', WF, '--field', 'phase,menu,frontier.actionable'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env });
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout).fields, { phase: 'running', menu: [], 'frontier.actionable': false });
}));

test('a retry-decision item lives while its job has no later try, and closes once one exists', (t) => withLedger(t, ({ ledger }) => {
  const at = NOW - 60 * MIN;
  const failed = { jobId: 'op-a-1', unitId: 'op-a-1', opId: 'work.author', status: 'failed', createdAt: at, dispatchedAt: at + 1, updatedAt: at + 2, payload: { opId: 'work.author', owned_paths: ['p'] }, result: { verdict: 'fail' } };
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'wake' }, goalIdentity: 'wake-goal', goal: { revision: 0, identity: 'wake-goal', markdown: '# goal', json: {} }, jobs: [failed] });
  const di = { kind: 'retry-decision', entity: { type: 'job', id: 'op-a-1' } };
  assert.equal(liveFor(di, new Map(), ledger.db), true, 'a settled failed job with no later try still waits on the Kernel');
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,unit_id,op_id,try_no,retry_of,generation,kind,role,payload_json,status,created_at,updated_at) SELECT 'op-a-2',workflow_id,unit_id,op_id,2,'op-a-1',generation,kind,role,payload_json,'queued',created_at,updated_at FROM jobs WHERE job_id='op-a-1'").run();
  assert.equal(liveFor(di, new Map(), ledger.db), false, 'a retry exists: the item owes nothing');
  assert.equal(liveFor({ kind: 'settle-nongreen', entity: { type: 'job', id: 'op-b' } }, new Map(), ledger.db), false, 'a reported item lives only while the settler hands the job over');
  assert.equal(liveFor({ kind: 'progress-stall', entity: { type: 'workflow', id: WF } }, new Map(), ledger.db), true);
}));
