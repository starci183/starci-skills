// The retry moves the Job controller performs for the Kernel (scripts/reconciler/mechanical-moves.mjs): a retry whose gate resolved is a
// typed move on its next action, the controller runs it once, a refusal reaches the Kernel as a retry-decision item, and the Kernel's
// menu never holds it.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { mechanicalMovesOf, runMechanicalMoves } from '../../scripts/reconciler/mechanical-moves.mjs';
import { retryMoveOf } from '../../scripts/kernel/retry-move.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-moves';
const T0 = Date.now() - 3_600_000;
const JOB = 'op-work.author-move0001';

const job = { jobId: JOB, unitId: JOB, opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000,
  payload: { opId: 'work.author', records: ['.starciwork/r.yaml'], owned_paths: ['.starciwork/a', '.starciwork/b'], params: { maxFiles: 3 } },
  result: { verdict: 'fail', nextStep: { kind: 'owner-gate', incidentId: 'inc-resolved', reason: 'the owner step landed', jobs: [] } } };

const statusOf = (world) => {
  const env = { ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' };
  return JSON.parse(spawnSync(process.execPath, [CLI, 'status', '--repo', world.repoRoot, '--workflow', WF, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env }).stdout);
};

test('the retry of a job whose gate resolved is a mechanical next action with a typed move, and the Kernel\'s menu does not hold it', (t) => withLedger(t, (world) => {
  seedWorkflow(world.ledger, { id: WF, state: { phase: 'running', job: 'moves' }, goalIdentity: 'moves-goal', goal: { revision: 0, identity: 'moves-goal', markdown: '# goal', json: {} }, jobs: [job] });
  world.ledger.close();
  const status = statusOf(world);
  const retry = status.nextActions.find((action) => action.jobId === JOB);
  assert.equal(retry.origin, 'failed-step-open');
  assert.deepEqual(retry.move, { verb: 'enqueue', args: { workflow: WF, op: 'work.author', paths: '.starciwork/a,.starciwork/b', 'retry-of': JOB, records: '.starciwork/r.yaml', params: '{"maxFiles":3}' } });
  assert.deepEqual(status.menu, []);
  const [move] = mechanicalMovesOf(status);
  assert.equal(move.verb, 'enqueue');
  assert.deepEqual(move.argv.slice(0, 8), ['--workflow', WF, '--op', 'work.author', '--paths', '.starciwork/a,.starciwork/b', '--retry-of', JOB]);
}));

test('the controller runs each move once per engine process and hands a refused move to the Kernel as a retry-decision item', async () => {
  const status = { nextActions: [{ kind: 'retry', origin: 'answered-ask', op: 'x', jobId: 'op-x-1', move: { verb: 'enqueue', args: { workflow: WF, op: 'x', paths: 'p', 'retry-of': 'op-x-1' } } },
    { kind: 'retry', origin: 'unstepped-failure', op: 'x', jobId: 'op-x-2' },
    { kind: 'dispatch', origin: 'approved-leg-open', op: 'y', move: { verb: 'enqueue', args: { workflow: WF, op: 'y', paths: 'p' } } }] };
  assert.deepEqual(mechanicalMovesOf(status).map((move) => move.jobId), ['op-x-1'], 'only a mechanical origin with a move is the controller\'s');
  const calls = [], opened = [];
  const ctx = { api: async (_ledger, verb, argv) => { calls.push([verb, ...argv]); return { ok: false, error: 'unit-try-budget-spent' }; }, openDecision: async (di) => { opened.push(di); return { ok: true }; } };
  const deps = { facts: (jobId) => ({ jobId, workflowId: WF, op: 'x', status: 'failed', terminal: null }), refused: (facts, reason) => ({ kind: 'retry-decision', entity: facts.jobId, reason }) };
  const first = await runMechanicalMoves(ctx, 'ledger-moves', status, deps);
  assert.deepEqual(first, [{ jobId: 'op-x-1', origin: 'answered-ask', ok: false }]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 3), ['enqueue', '--workflow', WF]);
  assert.match(opened[0].reason, /answered-ask move was refused: unit-try-budget-spent/);
  assert.deepEqual(await runMechanicalMoves(ctx, 'ledger-moves', status, deps), [], 'a move made is not made again');
  assert.equal(calls.length, 1);
});

test('a retry move repeats the job\'s write set, records, cut, repository and params, and none for a job with no write set', () => {
  const row = { job_id: 'op-z-1', workflow_id: WF, op_id: 'z', payload_json: JSON.stringify({ owned_paths: ['a'], records: ['r'], cut: { id: 'c1', ordinal: 2, total: 3 }, repository: 'fe', displayWhat: 'the page' }) };
  assert.deepEqual(retryMoveOf(row).args, { workflow: WF, op: 'z', paths: 'a', 'retry-of': 'op-z-1', records: 'r', 'cut-id': 'c1', 'cut-ordinal': '2', 'cut-total': '3', repository: 'fe', what: 'the page' });
  assert.equal(retryMoveOf({ ...row, payload_json: '{}' }), null);
});
