import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateSession } from './validate-session.mjs';
import { sessionBudgetErrors, effectiveBudget } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brief = { proven: ['the outer surface is committed'], blocked: [{ what: 'sign-in for the flow account', owner: 'platform', since: '2026-09-04T01:00:00Z' }], next: 'serve the merged head, then audit', peers: { inner: { owns: 'the inner module surface', head: 'a'.repeat(40), wake: 'a committed head lands in the registry' } }, report: { shape: 'working', text: 'Outer surface committed; waiting on the sign-in wall.', at: '2026-09-04T01:00:00Z' } };
const budget = { maxSteps: 6, maxSameOperator: 2 };

function session({ steps, current, transitions = [{ at: 'now', branch: '1/1', event: 'dispatched' }], withBrief = true, withBudget = true, receipts = {}, status = 'running', stoppedAt, choices, extensions }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'session-'));
  const state = { id: 'x', project: 'p', startedAt: 'now', status, chain: [Object.keys(steps)], steps, current, requestHashes: {}, transitions };
  if (withBrief) state.brief = brief;
  if (withBudget) state.budget = { ...budget, ...(extensions ? { extensions } : {}) };
  if (stoppedAt) state.stoppedAt = stoppedAt;
  if (choices) state.choices = choices;
  writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
  for (const branch of Object.keys(steps)) {
    const [n, m] = branch.split('/');
    const b = path.join(dir, `step-${n}`, `parallel-${m}`);
    mkdirSync(path.join(b, 'request'), { recursive: true });
    writeFileSync(path.join(b, 'request', 'request.json'), '{}');
    const r = receipts[branch];
    if (r) { mkdirSync(path.join(b, 'response'), { recursive: true }); writeFileSync(path.join(b, 'response', 'response.json'), JSON.stringify({ status: r })); }
  }
  return { dir, state };
}
const run = async (s) => { try { return (await validateSession(root, s.dir)).errors; } finally { rmSync(s.dir, { recursive: true, force: true }); } };

test('a live session with brief, budget and receipts on every passed branch is valid', async () => {
  const errors = await run(session({ steps: { '1/1': 'workspace.bind', '2/1': 'frontend.direction.decide' }, current: '2/1', receipts: { '1/1': 'done' } }));
  assert.deepEqual(errors, []);
});
test('brief and budget are required from the first transition on, and the report shape is declared', async () => {
  const noBrief = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', withBrief: false }));
  assert.ok(noBrief.some((e) => e.includes('carries brief')));
  const noBudget = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', withBudget: false }));
  assert.ok(noBudget.some((e) => e.includes('carries budget')));
  const fresh = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', transitions: [], withBrief: false, withBudget: false }));
  assert.deepEqual(fresh, []);
});
test('a branch the chain moved past owes a receipt that is not the dispatch skeleton', async () => {
  const missing = await run(session({ steps: { '1/1': 'workspace.bind', '2/1': 'quality.verify' }, current: '2/1' }));
  assert.ok(missing.some((e) => e.includes('RECEIPT_MISSING') && e.includes('step-1/parallel-1')));
  const skeleton = await run(session({ steps: { '1/1': 'workspace.bind', '2/1': 'quality.verify' }, current: '2/1', receipts: { '1/1': 'running' } }));
  assert.ok(skeleton.some((e) => e.includes('dispatch skeleton')));
});
test('the budget caps steps and same-operator re-entries unless a recorded continue extended it', async () => {
  const steps = { '1/1': 'workspace.bind', '2/1': 'backend.source.apply', '3/1': 'backend.source.apply', '4/1': 'backend.source.apply' };
  const receipts = { '1/1': 'done', '2/1': 'blocked', '3/1': 'blocked' };
  const over = await run(session({ steps, current: '4/1', receipts }));
  assert.ok(over.some((e) => e.includes('maxSameOperator')));
  const extended = await run(session({ steps, current: '4/1', receipts, extensions: [{ decisionId: 'budget:backend', maxSteps: 6, maxSameOperator: 4 }], choices: { 'budget:backend': { selected: 'continue', selectedBy: 'user', sourceRef: 'user-message:continue' } } }));
  assert.deepEqual(extended, []);
  const declined = await run(session({ steps, current: '4/1', receipts, extensions: [{ decisionId: 'budget:backend', maxSteps: 6, maxSameOperator: 4 }], choices: { 'budget:backend': { selected: 'narrow', selectedBy: 'user', sourceRef: 'user-message:narrow' } } }));
  assert.ok(declined.some((e) => e.includes('maxSameOperator')));
});
test('the request gate refuses the request that would pass a cap', () => {
  const state = { transitions: [{}], brief, budget, steps: { '1/1': 'workspace.bind', '2/1': 'workspace.bind' } };
  assert.ok(sessionBudgetErrors(state, { step: 3, parallel: 1, operatorId: 'workspace.bind' }).some((e) => e.includes('maxSameOperator')));
  assert.ok(sessionBudgetErrors(state, { step: 7, parallel: 1, operatorId: 'quality.verify' }).some((e) => e.includes('maxSteps')));
  assert.deepEqual(sessionBudgetErrors(state, { step: 3, parallel: 1, operatorId: 'quality.verify' }), []);
  assert.deepEqual(sessionBudgetErrors({ transitions: [], steps: {} }, { step: 3, parallel: 1, operatorId: 'quality.verify' }), []);
  assert.equal(effectiveBudget({ budget, choices: { 'budget:a': { selected: 'continue' } }, }).maxSteps, 6);
});
test('a stopped session names where it stopped and a running one does not', async () => {
  const stopped = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', status: 'stopped' }));
  assert.ok(stopped.some((e) => e.includes('stoppedAt')));
  const running = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', stoppedAt: { branch: '1/1', operator: 'workspace.bind', stop: null, why: 'x' } }));
  assert.ok(running.some((e) => e.includes('no stoppedAt')));
});
