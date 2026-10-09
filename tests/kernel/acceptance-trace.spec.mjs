// acceptance-trace (owner ruling acceptance-trace-report-mode): the tests an op wrote trace to acceptance records it did not write; REPORT mode records the result and fails nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { acceptanceIdsOf, acceptanceTraceOf, recordTrace, traceLine, traceOf, traceOpsOf, tracesOf } from '../../scripts/kernel/acceptance-trace.mjs';
import { settlePreflight } from '../../scripts/kernel/verbs/shared/settle-preflight.mjs';
import { judgeRegistry } from '../../scripts/kernel/op-judge.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { buildContext } from '../../scripts/context/pack.mjs';
import { seedWorkflow, withLedger } from '../helpers/ledger-fixture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const AC1 = 'ac.task.title.required.refuses-empty';
const AC2 = 'ac.task.title.required.trims-spaces';
const AC3 = 'ac.task.owner.assigned.defaults-to-creator';

const tmp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-acceptance-trace-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const put = (root, rel, body) => { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
const record = (root, rel, fields) => put(root, `.starciwork/features/task/${rel}/index.yaml`, Object.entries(fields).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n'));

function seedTree(root) {
  record(root, 'br/title-required', { id: 'br.task.title-required' });
  record(root, 'br/title-required/ac/refuses-empty', { id: AC1, rule: 'br.task.title-required' });
  record(root, 'br/title-required/ac/trims-spaces', { id: AC2, rule: 'br.task.title-required' });
  record(root, 'br/owner', { id: 'br.task.owner' });
  record(root, 'br/owner/ac/defaults', { id: AC3, rule: 'br.task.owner' });
  record(root, 'fr/create', { id: 'fr.task.create', refs: ['br.task.title-required'] });
  record(root, 'impl/be/tasks', { id: 'impl.task.be.tasks', proves: ['fr.task.create', AC3] });
}

test('the trace counts the acceptance ids the tests cite and the tests that cite none (passing)', () => {
  const trace = traceOf([AC1, AC2, AC3], [
    { path: 'a.spec.ts', text: `it("${AC1} refuses an empty title")` },
    { path: 'b.spec.ts', text: `// covers ${AC1} and ${AC3}\nit("x")` },
    { path: 'c.spec.ts', text: 'it("cites nothing")' },
    { path: 'd.spec.ts', text: 'it("cites an id outside the scope: ac.other.thing.not.here")' },
  ]);
  assert.deepEqual({ total: trace.total, cited: trace.cited, missing: trace.missing, tests: trace.tests, uncited: trace.uncitedTests }, { total: 3, cited: 2, missing: [AC2], tests: 4, uncited: ['c.spec.ts', 'd.spec.ts'] });
  assert.equal(traceLine(trace), 'acceptance-trace: 2 of 3 cited, 2 tests uncited');
});

test('a trace with no acceptance and no test reads 0 of 0 (violating the premise: nothing to trace is not a pass claim)', () => {
  assert.equal(traceLine(traceOf([], [])), 'acceptance-trace: 0 of 0 cited, 0 tests uncited');
});

test('the scope is what the bound record proves: an ac id itself, or the criteria of a rule it proves directly or through a requirement (passing)', (t) => {
  const root = tmp(t);
  seedTree(root);
  put(root, 'tests/tasks.spec.ts', `it("${AC1}")`);
  put(root, 'tests/other.spec.ts', 'it("nothing")');
  const trace = acceptanceTraceOf({ roots: [root], owned: ['.starciwork/features/task/impl/be/tasks/index.yaml'], reportFiles: ['tests/tasks.spec.ts', 'tests/other.spec.ts', 'src/not-a-test.ts'] });
  assert.equal(trace.total, 3, 'AC3 proved directly, AC1 and AC2 through fr.task.create -> br.task.title-required');
  assert.deepEqual(trace.missing, [AC3, AC2]);
  assert.deepEqual(trace.uncitedTests, ['tests/other.spec.ts']);
  assert.deepEqual(acceptanceIdsOf(['br.task.owner'], new Map()), []);
});

test('a job that binds no work record measures nothing and does not throw (violating)', (t) => {
  const trace = acceptanceTraceOf({ roots: [tmp(t)], owned: ['src/'], reportFiles: [] });
  assert.equal(traceLine(trace), 'acceptance-trace: 0 of 0 cited, 0 tests uncited');
});

test('the measure is declared in report mode for the five ops, and the op prompt tells the op to cite the id (passing)', () => {
  const measure = judgeRegistry(ROOT).measures['acceptance-trace'];
  assert.equal(measure.mode, 'report');
  assert.deepEqual(traceOpsOf(ROOT).sort(), ['backend.implement', 'e2e.verify', 'integration.verify', 'interface.implement', 'test.author']);
  const prompt = (op) => buildOpPrompt({ skillRoot: ROOT, contextPack: buildContext({ op, root: ROOT }), packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } } });
  assert.equal(prompt('backend.implement').split('\n').filter((line) => line.startsWith('acceptance_trace:')).length, 1);
  assert.equal(prompt('scope.define').includes('acceptance_trace:'), false);
});

test('the settle records the trace as evidence on the attempt and a miss refuses nothing; status reads it back (report mode)', (t) => withLedger(t, async ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-trace', state: { phase: 'running', job: 'impl' }, jobs: [{ jobId: 'op-backend.implement-1', opId: 'backend.implement', dispatchId: 'ctx-1', status: 'reported', payload: { opId: 'backend.implement' } }] });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-backend.implement-1').attempt_id;
  const none = () => null;
  const trace = traceOf([AC1, AC2], [{ path: 'a.spec.ts', text: AC1 }, { path: 'b.spec.ts', text: 'nothing' }]);
  const internals = { settleProofMedia: none, settleSonarGate: none, settleOpGate: none, settleOpProofs: none, settleCriticVerdict: none, settleDrawAcceptance: none,
    settleDrawMetrics: none, settleWorkHygiene: none, settleAcceptanceTrace: () => ({ op: 'backend.implement', attemptId, trace }) };
  const out = await settlePreflight({ ledger, args: {}, repo: ROOT, emit() {}, internals, replay: false, verdict: 'pass', jobId: 'op-backend.implement-1' });
  assert.ok(out, 'the preflight returns instead of refusing');
  const [row] = tracesOf(ledger.db, 'wf-trace');
  assert.equal(row.line, 'acceptance-trace: 1 of 2 cited, 1 tests uncited');
  assert.deepEqual(row.missing, [AC2]);
  const check = ledger.db.prepare("SELECT exit_code FROM check_runs WHERE attempt_id=? AND name='acceptance-trace'").get(attemptId);
  assert.equal(check.exit_code, 0, 'evidence only: exit 0 whatever the result');
  assert.equal(recordTrace(ledger, { attemptId, trace }), 'acceptance-trace: 1 of 2 cited, 1 tests uncited');
}));
