import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { openSession, confirmSession, cleanupFixtureOwners } from './v23-test-fixture.mjs';
import { previewRevision, commitRevision, activePlanView, planHistoryErrors, retiredPlanCell, offsetForecast } from './plan-history.mjs';
import { validateSessionChain } from './validate-chain.mjs';
import { readContext } from './mission-history.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function fixture(t) {
  const owner = await mkdtemp(path.join(os.tmpdir(), 'starci-replan-'));
  t.after(async () => { cleanupFixtureOwners(owner); await rm(owner, { recursive: true, force: true }); });
  const opened = await openSession(path.join(owner, '.worktrees/sessions'), { project: 'replan', hostBinding: { kind: 'codex-task', hostId: `native-${path.basename(owner)}`, worktree: owner, sourcePromptRef: 'user:opening' }, mission: { language: 'en', goal: 'Establish declared environment readiness.', target: 'Declared environment', includes: ['Read-only readiness'], excludes: [], outputs: ['Readiness report'], doneWhen: [{ evidence: 'Readiness report records every required check.', producedBy: 'environment.preflight' }], verification: 'Validate the readiness report.', sourceRef: 'user:opening' } });
  await confirmSession(opened.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:approved' });
  const stateFile = path.join(opened.session, 'state.json');
  return { session: opened.session, stateFile, read: async () => JSON.parse(await readFile(stateFile)), write: state => writeFile(stateFile, JSON.stringify(state, null, 2) + '\n') };
}

test('standalone preview and commit finish dynamic imports and seal the reviewed forecast', async t => {
  const f = await fixture(t);
  const run = (...args) => execFileSync(process.execPath, [path.join(root, 'scripts/plan-history.mjs'), ...args], { encoding: 'utf8', windowsHide: true, timeout: 60000 });
  const preview = run('preview', f.session);
  assert.match(preview, /planned \(not executed or verified\)/);
  const previewHash = preview.match(/"previewHash": "(sha256:[a-f0-9]{64})"/)?.[1];
  assert.ok(previewHash);
  const reviewed = path.join(f.session, 'reviewed-plan.json');
  await writeFile(reviewed, JSON.stringify({ previewHash, reason: 'The complete subprocess forecast was reviewed.' }));
  const committed = JSON.parse(run('commit', f.session, reviewed));
  assert.ok(committed);
  const state = await f.read();
  assert.ok(state.planHistory.active);
  assert.deepEqual(planHistoryErrors(f.session, state), []);
});

test('a complete reviewed forecast is sealed before dispatch; replacing pending work retains every old byte and uses unused coordinates', async t => {
  const f = await fixture(t);
  const initial = await previewRevision(root, f.session);
  assert.match(initial.preview, /planned \(not executed or verified\)/);
  await commitRevision(root, f.session, { previewHash: initial.previewHash, reason: 'Initial complete mission-derived forecast.' });
  let state = await f.read(); const first = state.planHistory.active;
  assert.deepEqual(await validateSessionChain(root, f.session, state), []);
  const oldCell = state.chain[0][0], [n, m] = oldCell.split('/');
  const branch = path.join(f.session, `step-${n}`, `parallel-${m}`, 'request');
  await mkdir(branch, { recursive: true }); await writeFile(path.join(branch, 'request.json'), '{"draft":"not dispatched"}\n');
  const bytes = await readFile(path.join(branch, 'request.json'));
  const flags = { requirements: { 'environment.preflight': { project: state.project } } };
  const next = await previewRevision(root, f.session, flags);
  await commitRevision(root, f.session, { previewHash: next.previewHash, flags, reason: 'A changed prerequisite requires a new complete forecast.' });
  state = await f.read();
  assert.ok(retiredPlanCell(state, oldCell));
  assert.ok(Number(state.chain[0][0].split('/')[0]) > Number(oldCell.split('/')[0]));
  assert.deepEqual(await readFile(path.join(branch, 'request.json')), bytes);
  assert.deepEqual(state.planHistory.revisions[0], first);
  assert.equal(readContext(f.session, state.planHistory.active, 'plans').mappings[0].disposition, 'superseded-forecast');
  assert.deepEqual(planHistoryErrors(f.session, state), []);
  assert.deepEqual(await validateSessionChain(root, f.session, state), []);
  await writeFile(path.join(branch, 'request.json'), '{}');
  assert.match(planHistoryErrors(f.session, state).join(), /inventory changed/);
});

test('stale preview, invented active boundary and mutated active plan fail closed', async t => {
  const f = await fixture(t); const next = await previewRevision(root, f.session);
  await assert.rejects(commitRevision(root, f.session, { previewHash: `sha256:${'0'.repeat(64)}`, reason: 'Stale scope' }), /PLAN_PREVIEW_STALE/);
  await commitRevision(root, f.session, { previewHash: next.previewHash, reason: 'Complete forecast reviewed.' });
  const state = await f.read();
  const forged = structuredClone(state); forged.planHistory.active.hash = `sha256:${'0'.repeat(64)}`;
  assert.throws(() => activePlanView(f.session, forged), /PLAN_HISTORY_UNBOUND/);
  state.chain[0][0] = '999/1';
  assert.match(planHistoryErrors(f.session, state).join(), /active chain differs/);
});

test('active invocation cannot be hidden by a new forecast, and a corrected mission retains the prior confirmation', async t => {
  const f = await fixture(t); let state = await f.read();
  const prior = structuredClone(state.mission); const answer = structuredClone(state.choices[prior.confirmation.decisionId]);
  const next = await previewRevision(root, f.session);
  state.attempts['1/1'] = { status: 'running' }; await f.write(state);
  await assert.rejects(commitRevision(root, f.session, { previewHash: next.previewHash, reason: 'Cannot hide live work.' }), /PLAN_BUSY/);
  await assert.rejects(confirmSession(f.session, { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:correction', mission: { ...prior, goal: 'A corrected readiness scope' } }), /MISSION_BUSY/);
  state.attempts = {}; await f.write(state);
  await confirmSession(f.session, { selected: 'corrected', selectedBy: 'user', sourceRef: 'user:correction', mission: { ...prior, goal: 'A corrected readiness scope' } });
  state = await f.read();
  assert.deepEqual(state.choices[prior.confirmation.decisionId], answer);
  assert.equal(state.mission.version, 2); assert.equal(state.mission.confirmation.status, 'draft');
  await confirmSession(f.session, { selected: 'as-stated', selectedBy: 'user', sourceRef: 'user:corrected-scope-approved' });
  const corrected = await previewRevision(root, f.session);
  await commitRevision(root, f.session, { previewHash: corrected.previewHash, reason: 'Forecast derives from the newly confirmed corrected scope.' });
  state = await f.read(); assert.deepEqual(await validateSessionChain(root, f.session, state), []);
});

test('logical node identity survives remapping while physical prerequisite coordinates remain explicit in each sealed forecast', () => {
  const original = { chain: [['1/1'], ['2/1']], steps: { '1/1': 'data.plan', '2/1': 'data.seed' }, goals: { '1/1': { prerequisite: '2/1' }, '2/1': { doneWhen: 0 } }, nodes: { '1/1': 'data.plan', '2/1': 'data.seed:target:0' }, dependencies: { '2/1': ['1/1'] }, presets: {}, imports: {} };
  const next = offsetForecast(original, 12);
  assert.equal(next.nodes['14/1'], original.nodes['2/1']);
  assert.deepEqual(next.goals['13/1'], { prerequisite: '14/1' });
  assert.deepEqual(original.goals['1/1'], { prerequisite: '2/1' });
});
