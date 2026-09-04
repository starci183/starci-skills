import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateSession, missionHistoryErrors } from './validate-session.mjs';
import { sessionBudgetErrors, effectiveBudget, goalDecisionId } from './validate-request.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const brief = { proven: ['the outer surface is committed'], blocked: [{ what: 'sign-in for the flow account', owner: 'platform', since: '2026-09-04T01:00:00Z' }], next: 'serve the merged head, then audit', peers: { inner: { owns: 'the inner module surface', head: 'a'.repeat(40), wake: 'a committed head lands in the registry' } }, report: { shape: 'working', text: 'Outer surface committed; waiting on the sign-in wall.', at: '2026-09-04T01:00:00Z' } };
const budget = { maxSteps: 6, maxSameOperator: 2 };
// A confirmed mission: the goal block at version n and the goal-confirm choice the person answered on it.
const mission = (version = 1) => ({ version, language: 'vi', goal: 'the outer workspace surface recovers on its own', includes: ['the outer surface'], excludes: ['the inner module'], doneWhen: [{ evidence: 'the committed head passes the gates', producedBy: 'quality.verify' }], sourceRef: 'user-message:goal' });
const confirmed = (version = 1, selected = 'as-stated') => ({ [goalDecisionId('x', version)]: { selected, selectedBy: 'user', sourceRef: `user-message:goal-v${version}` } });

function session({ steps, current, transitions = [{ at: 'now', branch: '1/1', event: 'dispatched' }], withBrief = true, withBudget = true, receipts = {}, status = 'running', stoppedAt, choices, extensions, mission: m }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'session-'));
  const state = { id: 'x', project: 'p', startedAt: 'now', status, chain: [Object.keys(steps)], steps, current, requestHashes: {}, transitions };
  if (withBrief) state.brief = brief;
  if (withBudget) state.budget = { ...budget, ...(extensions ? { extensions } : {}) };
  if (stoppedAt) state.stoppedAt = stoppedAt;
  if (choices) state.choices = choices;
  if (m) state.mission = m;
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
const goalErrors = (errors) => errors.filter((e) => e.includes("the mission's goal is not confirmed"));

test('a live session with brief, budget, a confirmed mission and receipts on every passed branch is valid', async () => {
  const errors = await run(session({ steps: { '1/1': 'workspace.bind', '2/1': 'frontend.direction.decide' }, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(), choices: confirmed() }));
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
  const over = await run(session({ steps, current: '4/1', receipts, mission: mission(), choices: confirmed() }));
  assert.ok(over.some((e) => e.includes('maxSameOperator')));
  const extended = await run(session({ steps, current: '4/1', receipts, mission: mission(), extensions: [{ decisionId: 'budget:backend', maxSteps: 6, maxSameOperator: 4 }], choices: { ...confirmed(), 'budget:backend': { selected: 'continue', selectedBy: 'user', sourceRef: 'user-message:continue' } } }));
  assert.deepEqual(extended, []);
  const declined = await run(session({ steps, current: '4/1', receipts, mission: mission(), extensions: [{ decisionId: 'budget:backend', maxSteps: 6, maxSameOperator: 4 }], choices: { ...confirmed(), 'budget:backend': { selected: 'narrow', selectedBy: 'user', sourceRef: 'user-message:narrow' } } }));
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

// The mission's goal is confirmed by the person before anything runs.
const writing = { '1/1': 'workspace.bind', '2/1': 'frontend.source.apply' };
test('a source-writing session with a confirmed mission is valid', async () => {
  const errors = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(), choices: confirmed() }));
  assert.deepEqual(errors, []);
});
test('a source-writing session without a mission is refused, and the error names the goal', async () => {
  const errors = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' } })));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('no mission block'));
});
test('a mission whose latest version has no choice, or was corrected, runs nothing', async () => {
  const unanswered = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission() })));
  assert.ok(unanswered.some((e) => e.includes(`choices["${goalDecisionId('x', 1)}"]`)));
  const corrected = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(), choices: confirmed(1, 'corrected') })));
  assert.ok(corrected.some((e) => e.includes('was corrected') && e.includes('version 2')));
  const byAgent = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(), choices: { [goalDecisionId('x', 1)]: { selected: 'as-stated', selectedBy: 'agent', sourceRef: 'x' } } })));
  assert.ok(byAgent.some((e) => e.includes('never by an agent')));
});
test('a corrected version leaves its choice behind and the next version is confirmed', async () => {
  const errors = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(2), choices: { ...confirmed(1, 'corrected'), ...confirmed(2) } }));
  assert.deepEqual(errors, []);
  const lost = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(2), choices: confirmed(2) }));
  assert.ok(lost.some((e) => e.includes('mission version 1 left no choices')));
});
test('a read-only session (workspace.bind and quality.verify) needs no mission', async () => {
  const errors = await run(session({ steps: { '1/1': 'workspace.bind', '2/1': 'quality.verify' }, current: '2/1', receipts: { '1/1': 'done' } }));
  assert.deepEqual(errors, []);
});
test('a replanned transition carries a note and a goalVersion, and the new version is confirmed', async () => {
  const replan = (extra) => ({ at: 'later', branch: '2/1', event: 'replanned', ...extra });
  const bare = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }, replan()], mission: mission(2), choices: { ...confirmed(1), ...confirmed(2) } }));
  assert.ok(bare.some((e) => e.includes('transitions[1].note: required')));
  assert.ok(bare.some((e) => e.includes('transitions[1].goalVersion: required')));
  const onRecord = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }, replan({ note: 'the interview leaves the course', goalVersion: 2 })], mission: mission(2), choices: { ...confirmed(1), ...confirmed(2) } }));
  assert.deepEqual(onRecord, []);
  // Version 1 confirmed as-stated and then replaced with no replan on record is a silent rewrite.
  const silent = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, mission: mission(2), choices: { ...confirmed(1), ...confirmed(2) } }));
  assert.ok(silent.some((e) => e.includes('silent rewrite')));
});
test('the history check reads the ledger alone', () => {
  assert.deepEqual(missionHistoryErrors({ id: 'x', mission: mission(1), choices: confirmed() }), []);
  assert.ok(missionHistoryErrors({ id: 'x', transitions: [{ event: 'replanned', goalVersion: 2, note: 'n' }] }).some((e) => e.includes('carries no mission')));
  assert.ok(missionHistoryErrors({ id: 'x', mission: mission(1), choices: confirmed(), transitions: [{ event: 'replanned', goalVersion: 3, note: 'n' }] }).some((e) => e.includes('past mission.version')));
});
