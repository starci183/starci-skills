// acceptance-trace (owner ruling acceptance-trace-report-mode): the tests an op wrote trace to acceptance records it did not write; REPORT mode records the result and fails nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { acceptanceIdsOf, acceptanceTraceOf, recordTrace, traceLine, traceOf, traceOpsOf, tracesOf, traceRunsOf } from '../../scripts/kernel/acceptance-trace.mjs';
import { settlePreflight } from '../../scripts/kernel/verbs/shared/settle-preflight.mjs';
import { judgeRegistry } from '../../scripts/kernel/op-judge.mjs';
import { buildOpPrompt } from '../../scripts/kernel/op-prompt.mjs';
import { buildContext } from '../../scripts/context/pack.mjs';
import { seedWorkflow, withLedger } from '../helpers/ledger-fixture.mjs';
import { GATE_SCHEMA } from '../../scripts/gates/gate.mjs';
import { UNIT_RUN_SCHEMA } from '../../scripts/gates/unit-run.mjs';
import { TEST_WORLD_RUN_SCHEMA, reduceJest } from '../../scripts/gates/test-world-run.mjs';

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
  const trace = acceptanceTraceOf({ roots: [root], owned: ['.starciwork/features/task/impl/be/tasks/index.yaml'], testRuns: [{ root, files: ['tests/tasks.spec.ts', 'tests/other.spec.ts'] }] });
  assert.equal(trace.total, 3, 'AC3 proved directly, AC1 and AC2 through fr.task.create -> br.task.title-required');
  assert.deepEqual(trace.missing, [AC3, AC2]);
  assert.deepEqual(trace.uncitedTests, ['tests/other.spec.ts']);
  assert.deepEqual(acceptanceIdsOf(['br.task.owner'], new Map()), []);
});

test('a job that binds no work record measures nothing and does not throw (violating)', (t) => {
  const trace = acceptanceTraceOf({ roots: [tmp(t)], owned: ['src/'], testRuns: [] });
  assert.equal(traceLine(trace), 'acceptance-trace: 0 of 0 cited, 0 tests uncited');
});

test('only files actually executed in verified receipts contribute; selected, changed, pending and foreign files do not', (t) => {
  const root = tmp(t);
  seedTree(root);
  const executed = 'be/src/tests/contract/tasks.contract-spec.ts';
  const merelyChanged = 'be/src/tests/integration/tasks.integration-spec.ts';
  put(root, executed, AC1);
  put(root, merelyChanged, AC2);
  const totals = reduceJest({ testResults: [{ name: path.join(root, executed), assertionResults: [{ status: 'passed' }] },
    { name: path.join(root, merelyChanged), assertionResults: [{ status: 'pending' }] }] }, root);
  assert.deepEqual(totals.testFiles, [executed]);
  const native = { subject: root };
  const run = { native, doc: { schema: TEST_WORLD_RUN_SCHEMA, run: totals } };
  const testRuns = traceRunsOf([run, { ...run, judged: { status: 'unavailable' } }, { doc: run.doc },
    { native, doc: { schema: GATE_SCHEMA, changed: [merelyChanged], steps: { tests: { pattern: 'tasks' } } } }]);
  const trace = acceptanceTraceOf({ roots: [root], owned: ['.starciwork/features/task/impl/**'], testRuns });
  assert.equal(trace.total, 3, 'a bound directory has no index of its own; all selected implementation records are read');
  assert.equal(trace.tests, 1);
  assert.equal(trace.cited, 1);
  assert.ok(trace.missing.includes(AC2), 'the uncaptured file cannot supply its citation');
  assert.deepEqual(traceRunsOf([{ native, doc: { schema: UNIT_RUN_SCHEMA, run: totals } }]), [{ root, files: [executed] }]);
  assert.equal(acceptanceTraceOf({ roots: [root], owned: [], testRuns: [{ root, files: ['../outside.spec.ts'] }] }).tests, 0);
});

test('scope follows design and requirement links, cycles terminate, and compact criteria use the shared record resolution', () => {
  const index = new Map([
    ['impl.task.be.module', { id: 'impl.task.be.module', proves: ['sds.task.module'] }],
    ['sds.task.module', { id: 'sds.task.module', refs: ['fr.task.create'] }],
    ['fr.task.create', { id: 'fr.task.create', refs: ['br.task.required', 'impl.task.be.module'] }],
    ['br.task.required', { id: 'br.task.required', acceptance: [{ id: AC1 }, { id: AC2 }] }],
  ]);
  assert.deepEqual(acceptanceIdsOf(['impl.task.be.module'], index), [AC1, AC2]);
  assert.deepEqual(acceptanceIdsOf(['br.task.required#trims-spaces'], index), [AC2]);
});

test('the measure is declared in report mode for the four ops, and the op prompt tells the op to cite the id (passing)', () => {
  const measure = judgeRegistry(ROOT).measures['acceptance-trace'];
  assert.equal(measure.mode, 'report');
  assert.deepEqual(traceOpsOf(ROOT).sort(), ['backend.implement', 'e2e.verify', 'integration.verify', 'interface.implement']);
  const prompt = (op) => buildOpPrompt({ skillRoot: ROOT, contextPack: buildContext({ op, root: ROOT }), packet: { op, brief: `modules/ops/ops/${op}.yaml`, context: { records: [], owned_paths: [], attempt: 1 }, constraints: { model: 'm' } } });
  assert.equal(prompt('backend.implement').split('\n').filter((line) => line.startsWith('acceptance_trace:')).length, 1);
  assert.equal(prompt('scope.define').includes('acceptance_trace:'), false);
});

test('the settle records the trace as evidence on the attempt and a miss refuses nothing; full status reads it back (report mode)', (t) => withLedger(t, async ({ ledger, repoRoot }) => {
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
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM incidents WHERE workflow_id='wf-trace'").get().n, 0);
  assert.equal(ledger.db.prepare("SELECT count(*) n FROM decision_items WHERE workflow_id='wf-trace'").get().n, 0);
  assert.equal(recordTrace(ledger, { attemptId, trace }), 'acceptance-trace: 1 of 2 cited, 1 tests uncited');
  const statusArgs = [path.join(ROOT, 'packages/cli/bin/starci.mjs'), 'kernel', 'status', '--repo', repoRoot, '--workflow', 'wf-trace', '--full'];
  const options = { cwd: ROOT, encoding: 'utf8', windowsHide: true, env: { ...process.env, STARCI_RUNTIME: ROOT } };
  const json = spawnSync(process.execPath, [...statusArgs, '--json'], options);
  assert.equal(json.status, 0, json.stderr);
  assert.equal(JSON.parse(json.stdout).acceptanceTraces[0].line, row.line);
  const text = spawnSync(process.execPath, statusArgs, options);
  assert.equal(text.status, 0, text.stderr);
  assert.ok(text.stdout.includes(row.line));
}));
