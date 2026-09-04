import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { validateSession, missionHistoryErrors, provenErrors, threeBranchStopErrors, loggedErrors } from './validate-session.mjs';
import { sessionBudgetErrors, effectiveBudget, goalDecisionId } from './validate-request.mjs';
import { fakeTree } from './chain-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The sessions below run on the synthetic operator tree of chain-fixture.mjs, so the chain gate judges
// tables the spec owns; the policy, the schemas and the orchestrator caps are the tree's own.
const packages = fakeTree();
// proven is empty here: on a mission session an entry may only cite a done-when line a receipt evidenced (see the proven tests).
const brief = { proven: [], blocked: [{ what: 'sign-in for the flow account', owner: 'platform', since: '2026-09-04T01:00:00Z' }], next: 'serve the merged head, then audit', peers: { inner: { owns: 'the inner module surface', head: 'a'.repeat(40), wake: 'a committed head lands in the registry' } }, report: { shape: 'working', text: 'Outer surface committed; waiting on the sign-in wall.', at: '2026-09-04T01:00:00Z' } };
const budget = { maxSteps: 6, maxSameOperator: 2 };
// A confirmed mission: the goal block at version n and the goal-confirm choice the person answered on it.
const mission = (version = 1, doneWhen = [{ evidence: 'the committed head passes the gates', producedBy: 'quality.verify' }]) => ({ version, language: 'vi', goal: 'the outer workspace surface recovers on its own', includes: ['the outer surface'], excludes: ['the inner module'], doneWhen, sourceRef: 'user-message:goal' });
const confirmed = (version = 1, selected = 'as-stated') => ({ [goalDecisionId('x', version)]: { selected, selectedBy: 'user', sourceRef: `user-message:goal-v${version}` } });
// Every transition of a mission session was printed as the two-line log and says so.
const dispatched = { at: 'now', branch: '1/1', event: 'dispatched', logged: true };
const stepOf = (b) => Number(b.split('/')[0]);
// The chain of a steps map: cells grouped by step number, in order.
const chainOf = (steps) => { const by = new Map(); for (const b of Object.keys(steps)) by.set(stepOf(b), [...(by.get(stepOf(b)) ?? []), b]); return [...by.keys()].sort((a, b) => a - b).map((n) => by.get(n)); };
// The requests a lawful chain carries: operatorId, the bind role, and on a mission its goal — the
// spec's own requests override or add to these.
const fe = { requirements: { role: 'fe' } };
const be = { requirements: { role: 'be' } };

// receipts[branch] is a status word or a whole response.json; requests[branch] is the request.json body (its goal is what the ledger reads); files[branch] are response-relative files to create.
function session({ steps, current, transitions = [dispatched], withBrief = true, withBudget = true, receipts = {}, requests = {}, files = {}, proven, status = 'running', stoppedAt, choices, extensions, mission: m }) {
  const dir = mkdtempSync(path.join(tmpdir(), 'session-'));
  const state = { id: 'x', project: 'p', startedAt: 'now', status, chain: chainOf(steps), steps, current, requestHashes: {}, transitions };
  if (withBrief) state.brief = proven ? { ...brief, proven } : brief;
  if (withBudget) state.budget = { ...budget, ...(extensions ? { extensions } : {}) };
  if (stoppedAt) state.stoppedAt = stoppedAt;
  if (choices) state.choices = choices;
  if (m) state.mission = m;
  writeFileSync(path.join(dir, 'state.json'), JSON.stringify(state));
  for (const branch of Object.keys(steps)) {
    const [n, m] = branch.split('/');
    const b = path.join(dir, `step-${n}`, `parallel-${m}`);
    mkdirSync(path.join(b, 'request'), { recursive: true });
    writeFileSync(path.join(b, 'request', 'request.json'), JSON.stringify({ operatorId: steps[branch], ...(requests[branch] ?? {}) }));
    const r = receipts[branch];
    if (r) { mkdirSync(path.join(b, 'response'), { recursive: true }); writeFileSync(path.join(b, 'response', 'response.json'), JSON.stringify(typeof r === 'string' ? { status: r } : r)); }
    for (const f of files[branch] ?? []) { mkdirSync(path.dirname(path.join(b, f)), { recursive: true }); writeFileSync(path.join(b, f), '{}'); }
  }
  return { dir, state };
}
const run = async (s) => { try { return (await validateSession(root, s.dir, { packages })).errors; } finally { rmSync(s.dir, { recursive: true, force: true }); } };
const goalErrors = (errors) => errors.filter((e) => e.includes("the mission's goal is not confirmed"));

// A read-only chain: bind, then the gates.
const readOnly = { '1/1': 'workspace.bind', '2/1': 'quality.verify' };
const readOnlyRequests = { '1/1': fe };
test('a live session with brief, budget and receipts on every passed branch is valid', async () => {
  const errors = await run(session({ steps: readOnly, current: '2/1', receipts: { '1/1': 'done' }, requests: readOnlyRequests }));
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
  const missing = await run(session({ steps: readOnly, current: '2/1', requests: readOnlyRequests }));
  assert.ok(missing.some((e) => e.includes('RECEIPT_MISSING') && e.includes('step-1/parallel-1')));
  const skeleton = await run(session({ steps: readOnly, current: '2/1', receipts: { '1/1': 'running' }, requests: readOnlyRequests }));
  assert.ok(skeleton.some((e) => e.includes('dispatch skeleton')));
});
// A backend chain that re-enters its generator: bind be, architecture, then the generator three times.
const backend = { '1/1': 'workspace.bind', '2/1': 'architecture.decide', '3/1': 'backend.generate', '4/1': 'backend.generate', '5/1': 'backend.generate' };
const backendMission = () => mission(1, [{ evidence: 'the contract is filled', producedBy: 'backend.generate' }]);
const backendRequests = { '1/1': { ...be, goal: { prerequisite: '2/1' } }, '2/1': { goal: { prerequisite: '3/1' } }, '3/1': { goal: { doneWhen: 0 } }, '4/1': { goal: { doneWhen: 0 } }, '5/1': { goal: { doneWhen: 0 } } };
test('the budget caps steps and same-operator re-entries unless a recorded continue extended it', async () => {
  const receipts = { '1/1': 'done', '2/1': 'done', '3/1': 'blocked', '4/1': 'blocked' };
  const over = await run(session({ steps: backend, current: '5/1', receipts, requests: backendRequests, mission: backendMission(), choices: confirmed() }));
  assert.ok(over.some((e) => e.includes('maxSameOperator')));
  const extended = await run(session({ steps: backend, current: '5/1', receipts, requests: backendRequests, mission: backendMission(), extensions: [{ decisionId: 'budget:backend', maxSteps: 6, maxSameOperator: 4 }], choices: { ...confirmed(), 'budget:backend': { selected: 'continue', selectedBy: 'user', sourceRef: 'user-message:continue' } } }));
  assert.deepEqual(extended, []);
  const declined = await run(session({ steps: backend, current: '5/1', receipts, requests: backendRequests, mission: backendMission(), extensions: [{ decisionId: 'budget:backend', maxSteps: 6, maxSameOperator: 4 }], choices: { ...confirmed(), 'budget:backend': { selected: 'narrow', selectedBy: 'user', sourceRef: 'user-message:narrow' } } }));
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

// The mission's goal is confirmed by the person before anything runs. A surface-writing chain: bind fe, then the generator.
const writing = { '1/1': 'workspace.bind', '2/1': 'interface.generate' };
const writingMission = () => mission(1, [{ evidence: 'the surface is committed', producedBy: 'interface.generate' }]);
const writingRequests = { '1/1': { ...fe, goal: { prerequisite: '2/1' } }, '2/1': { goal: { doneWhen: 0 } } };
test('a source-writing session with a confirmed mission is valid', async () => {
  const errors = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: writingMission(), choices: confirmed() }));
  assert.deepEqual(errors, []);
});
test('a source-writing session without a mission is refused, and the error names the goal', async () => {
  const errors = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests })));
  assert.equal(errors.length, 1);
  assert.ok(errors[0].includes('no mission block'));
});
test('a mission whose latest version has no choice, or was corrected, runs nothing', async () => {
  const unanswered = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: writingMission() })));
  assert.ok(unanswered.some((e) => e.includes(`choices["${goalDecisionId('x', 1)}"]`)));
  const corrected = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: writingMission(), choices: confirmed(1, 'corrected') })));
  assert.ok(corrected.some((e) => e.includes('was corrected') && e.includes('version 2')));
  const byAgent = goalErrors(await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: writingMission(), choices: { [goalDecisionId('x', 1)]: { selected: 'as-stated', selectedBy: 'agent', sourceRef: 'x' } } })));
  assert.ok(byAgent.some((e) => e.includes('never by an agent')));
});
test('a corrected version leaves its choice behind and the next version is confirmed', async () => {
  const errors = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: { ...writingMission(), version: 2 }, choices: { ...confirmed(1, 'corrected'), ...confirmed(2) } }));
  assert.deepEqual(errors, []);
  const lost = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: { ...writingMission(), version: 2 }, choices: confirmed(2) }));
  assert.ok(lost.some((e) => e.includes('mission version 1 left no choices')));
});
test('a read-only session (workspace.bind and quality.verify) needs no mission', async () => {
  const errors = await run(session({ steps: readOnly, current: '2/1', receipts: { '1/1': 'done' }, requests: readOnlyRequests }));
  assert.deepEqual(errors, []);
});
test('a replanned transition carries a note and a goalVersion, and the new version is confirmed', async () => {
  const replan = (extra) => ({ at: 'later', branch: '2/1', event: 'replanned', logged: true, ...extra });
  const v2 = { ...writingMission(), version: 2 };
  const bare = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, transitions: [dispatched, replan()], mission: v2, choices: { ...confirmed(1), ...confirmed(2) } }));
  assert.ok(bare.some((e) => e.includes('transitions[1].note: required')));
  assert.ok(bare.some((e) => e.includes('transitions[1].goalVersion: required')));
  const onRecord = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, transitions: [dispatched, replan({ note: 'the interview leaves the course', goalVersion: 2 })], mission: v2, choices: { ...confirmed(1), ...confirmed(2) } }));
  assert.deepEqual(onRecord, []);
  // Version 1 confirmed as-stated and then replaced with no replan on record is a silent rewrite.
  const silent = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: writingRequests, mission: v2, choices: { ...confirmed(1), ...confirmed(2) } }));
  assert.ok(silent.some((e) => e.includes('silent rewrite')));
});
// The chain gate reads the ledger: an unlawful chain is refused whether or not a mission is on record.
test('the chain is checked against the operator tables and the requests: adjacency, inputs, roles, goals', async () => {
  const unreached = await run(session({ steps: { '1/1': 'environment.preflight', '2/1': 'quality.verify' }, current: '2/1', receipts: { '1/1': 'done' } }));
  assert.ok(unreached.some((e) => e.includes('2/1: step 2 runs quality.verify, which no Next table of step 1')));
  const unfed = await run(session({ steps: { '1/1': 'workspace.bind', '2/1': 'git.publish' }, current: '2/1', receipts: { '1/1': 'done' }, requests: { '1/1': fe } }));
  assert.ok(unfed.some((e) => e.includes('git.publish requires input changes')));
  const unbound = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: { '1/1': { ...be, goal: { prerequisite: '2/1' } }, '2/1': { goal: { doneWhen: 0 } } }, mission: writingMission(), choices: confirmed() }));
  assert.ok(unbound.some((e) => e.includes('requires @workspaces/fe')));
  const goalless = await run(session({ steps: writing, current: '2/1', receipts: { '1/1': 'done' }, requests: { '1/1': fe, '2/1': { goal: { doneWhen: 0 } } }, mission: writingMission(), choices: confirmed() }));
  assert.ok(goalless.some((e) => e.includes('1/1: request.json names no goal')));
});
// The goal ledger: brief.proven cites only done-when lines a validator-accepted goalCheck evidenced.
const chain = { '1/1': 'workspace.bind', '2/1': 'quality.verify', '3/1': 'git.publish' };
const evidenced = (achieved = true, evidence = ['response/data/gates.json']) => ({ status: 'done', fields: { 'quality-verification': 'response/response.md', 'gate-result': ['response/data/gates.json'] }, goalCheck: { achieved, evidence } });
const served = { '1/1': { ...fe, goal: { prerequisite: '2/1' } }, '2/1': { goal: { doneWhen: 0 } }, '3/1': { goal: { prerequisite: '2/1' } } };
const gateFiles = { '2/1': ['response/response.md', 'response/data/gates.json'] };
const proving = (over = {}) => session({ steps: chain, current: '3/1', receipts: { '1/1': 'done', '2/1': evidenced() }, requests: served, files: gateFiles, mission: mission(), choices: confirmed(), proven: ['doneWhen:0 the committed head passes the gates'], ...over });
// git.publish at 3/1 requires changes no earlier branch produces, and its prerequisite points backwards: the chain gate names both, and the proven tests read past them.
const provenOnly = (errors) => errors.filter((e) => !e.includes('3/1'));
test('proven cites a done-when line whose branch carries a validator-accepted goalCheck with achieved true', async () => {
  assert.deepEqual(provenOnly(await run(proving())), []);
  const prose = await run(proving({ proven: ['the outer surface is committed'] }));
  assert.ok(prose.some((e) => e.includes('cites no done-when line')));
  const unknown = await run(proving({ proven: ['doneWhen:3 something else'] }));
  assert.ok(unknown.some((e) => e.includes('doneWhen:3') && e.includes('does not have')));
  const notAchieved = await run(proving({ receipts: { '1/1': 'done', '2/1': evidenced(false) } }));
  assert.ok(notAchieved.some((e) => e.includes('doneWhen:0') && e.includes('achieved true')));
  // A goalCheck the response gate refuses (evidence outside the declared fields) proves nothing.
  const invented = await run(proving({ receipts: { '1/1': 'done', '2/1': evidenced(true, ['response/data/invented.json']) } }));
  assert.ok(invented.some((e) => e.includes('doneWhen:0') && e.includes('validator-accepted')));
  // Without a mission, proven is free prose.
  const free = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', proven: ['the outer surface is committed'] }));
  assert.deepEqual(free, []);
});
test('three consecutive done branches that served a done-when line and evidenced none stop the chain; prerequisite branches are not counted', async () => {
  // Three gate runs, each serving the one done-when line, none evidencing it.
  const gates = { '1/1': 'workspace.bind', '2/1': 'quality.verify', '3/1': 'quality.verify', '4/1': 'quality.verify', '5/1': 'quality.verify' };
  const gateRequests = { '1/1': { ...fe, goal: { prerequisite: '2/1' } }, '2/1': { goal: { doneWhen: 0 } }, '3/1': { goal: { doneWhen: 0 } }, '4/1': { goal: { doneWhen: 0 } }, '5/1': { goal: { doneWhen: 0 } } };
  const busy = { '1/1': 'done', '2/1': { status: 'done', fields: {} }, '3/1': { status: 'done', fields: {} }, '4/1': { status: 'done', fields: {} } };
  const extended = { extensions: [{ decisionId: 'budget:gates', maxSteps: 6, maxSameOperator: 4 }], choices: { ...confirmed(), 'budget:gates': { selected: 'continue', selectedBy: 'user', sourceRef: 'user-message:continue' } } };
  const stalled = await run(session({ steps: gates, current: '5/1', receipts: busy, requests: gateRequests, mission: mission(), ...extended }));
  assert.ok(stalled.some((e) => e.includes('three consecutive done branches') && e.includes('2/1 quality.verify, 3/1 quality.verify, 4/1 quality.verify')));
  const advancing = await run(session({ steps: gates, current: '5/1', receipts: { ...busy, '4/1': evidenced() }, requests: gateRequests, files: { '4/1': gateFiles['2/1'] }, mission: mission(), ...extended }));
  assert.deepEqual(advancing, []);
  // A blocked branch between two done ones is not a done branch; two done branches are not three.
  const interrupted = await run(session({ steps: gates, current: '5/1', receipts: { ...busy, '3/1': 'blocked' }, requests: gateRequests, mission: mission(), ...extended }));
  assert.ok(!interrupted.some((e) => e.includes('three consecutive')));
  // Prerequisite branches never evidence a done-when line by design: a preflight, two binds and a serve
  // before the first done-when branch are four done branches and no stop.
  const prerequisites = { '1/1': 'environment.preflight', '2/1': 'workspace.bind', '2/2': 'workspace.bind', '3/1': 'interface.generate', '4/1': 'runtime.serve', '5/1': 'interface.audit' };
  const prerequisiteRequests = { '1/1': { goal: { prerequisite: '2/1' } }, '2/1': { ...be, goal: { prerequisite: '5/1' } }, '2/2': { ...fe, goal: { prerequisite: '3/1' } }, '3/1': { goal: { prerequisite: '5/1' } }, '4/1': { goal: { prerequisite: '5/1' } }, '5/1': { goal: { doneWhen: 0 } } };
  const auditMission = mission(1, [{ evidence: 'the served surface passes the audit', producedBy: 'interface.audit' }]);
  const enabling = await run(session({ steps: prerequisites, current: '5/1', receipts: { '1/1': 'done', '2/1': 'done', '2/2': 'done', '3/1': 'done', '4/1': 'done' }, requests: prerequisiteRequests, mission: auditMission, choices: confirmed() }));
  assert.deepEqual(enabling, []);
  // The check reads the ledger alone and applies only on a mission.
  const ledger = [{ branch: '1/1', operator: 'a.b', doneWhen: 0, done: true, achieved: false }, { branch: '2/1', operator: 'c.d', doneWhen: 0, done: true, achieved: false }, { branch: '3/1', operator: 'e.f', doneWhen: 0, done: true, achieved: false }];
  assert.equal(threeBranchStopErrors({ mission: mission() }, ledger).length, 1);
  assert.deepEqual(threeBranchStopErrors({}, ledger), []);
  assert.deepEqual(threeBranchStopErrors({ mission: mission() }, ledger.map((b) => ({ ...b, doneWhen: null }))), [], 'prerequisite branches are not counted');
  assert.deepEqual(threeBranchStopErrors({ mission: mission() }, [ledger[0], { ...ledger[1], doneWhen: null }, ledger[2]]), [], 'a prerequisite between two served branches neither counts nor breaks the run');
  assert.deepEqual(provenErrors({ mission: mission(), brief: { proven: ['doneWhen:0 x'] } }, [{ doneWhen: 0, done: true, achieved: true }]), []);
});
test('on a mission every transition is logged as the two-line log; without one, logged is optional', async () => {
  const unlogged = await run(proving({ transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }] }));
  assert.ok(unlogged.some((e) => e.includes('transitions[0]') && e.includes('not logged')));
  const free = await run(session({ steps: { '1/1': 'workspace.bind' }, current: '1/1', transitions: [{ at: 'now', branch: '1/1', event: 'dispatched' }] }));
  assert.deepEqual(free, []);
  assert.deepEqual(loggedErrors({ mission: mission(), transitions: [dispatched] }), []);
  assert.equal(loggedErrors({ mission: mission(), transitions: [dispatched, { at: 'x', branch: '2/1', event: 'done' }] }).length, 1);
});
test('the history check reads the ledger alone', () => {
  assert.deepEqual(missionHistoryErrors({ id: 'x', mission: mission(1), choices: confirmed() }), []);
  assert.ok(missionHistoryErrors({ id: 'x', transitions: [{ event: 'replanned', goalVersion: 2, note: 'n' }] }).some((e) => e.includes('carries no mission')));
  assert.ok(missionHistoryErrors({ id: 'x', mission: mission(1), choices: confirmed(), transitions: [{ event: 'replanned', goalVersion: 3, note: 'n' }] }).some((e) => e.includes('past mission.version')));
});

// The findings ledger: a done audit or walk whose verdicts carry a failure has its findings in the
// family's ledger (knowledge/findings/INDEX.md), or the session gate names the branch.
import { recordFindings } from './record-findings.mjs';
const AUDIT_VERDICTS = { auditScope: { mode: 'primary-surfaces', surfaces: [{ id: 'plan-picker', type: 'page', route: '/plans', matrixIds: ['wide'] }], deferredStates: [], coverageClaim: 'selected-surfaces' }, entries: [{ matrixId: 'wide', surfaceClass: 'console', results: [{ path: 'body>main', owner: 'app', rule: 'GAP-5', measured: '1rem', verdict: 'fail', routeTo: 'resolve' }] }] };
const auditChain = { '1/1': 'workspace.bind', '2/1': 'interface.audit' };
const auditRequests = (contexts) => ({ '1/1': fe, '2/1': { sessionId: 'x', contexts, inputs: {} } });
// An audit branch's chain errors (its required inputs have no producer here) are the chain gate's; the ledger tests read past them.
const ledgerOnly = (errors) => errors.filter((e) => e.includes('ledger') || e.includes('finding'));
async function auditSession({ contexts = [{ alias: '@knowledge/grammars/core', head: null }], verdicts = AUDIT_VERDICTS, record = false } = {}) {
  const ledger = mkdtempSync(path.join(tmpdir(), 'ledger-'));
  const s = session({ steps: auditChain, current: '2/1', receipts: { '1/1': 'done', '2/1': { status: 'done', fields: {} } }, requests: auditRequests(contexts) });
  const branch = path.join(s.dir, 'step-2', 'parallel-1');
  if (verdicts) { mkdirSync(path.join(branch, 'response', 'data'), { recursive: true }); writeFileSync(path.join(branch, 'response', 'data', 'verdicts.json'), JSON.stringify(verdicts)); }
  if (record) await recordFindings(branch, { root, ledgerDir: ledger, validate: false });
  try { return ledgerOnly((await validateSession(root, s.dir, { packages, ledgerDir: ledger })).errors); }
  finally { rmSync(s.dir, { recursive: true, force: true }); rmSync(ledger, { recursive: true, force: true }); }
}
test('a done audit with a failing verdict is refused until its findings are in the family ledger, and named by branch', async () => {
  const missing = await auditSession();
  assert.equal(missing.length, 1);
  assert.ok(missing[0].startsWith('step-2/parallel-1:') && missing[0].includes('knowledge/findings/core.jsonl does not hold'));
  assert.deepEqual(await auditSession({ record: true }), [], 'recorded, the same session is clean');
  assert.deepEqual(await auditSession({ verdicts: { ...AUDIT_VERDICTS, entries: [{ ...AUDIT_VERDICTS.entries[0], results: [{ ...AUDIT_VERDICTS.entries[0].results[0], measured: '1.5rem', verdict: 'pass', routeTo: 'none' }] }] } }), [], 'a done audit with no failure owes the ledger nothing');
  assert.deepEqual(await auditSession({ verdicts: null }), [], 'a done audit with no verdicts owes the ledger nothing');
  const orphan = await auditSession({ contexts: [] });
  assert.equal(orphan.length, 1);
  assert.ok(orphan[0].includes('no family to record them under'));
});
