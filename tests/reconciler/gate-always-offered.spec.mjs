// Nivo 2026-10-09: an open supervisor-gate (inc-7ef4863b69c7, ladder step 4 of 4, handler owner) had no Decision Item on the Supervisor's menu: the item is planned from
// `starci kernel status autopilot.supervisorGates`, and the engine could not read the status. The item exists for every open gate whatever the status read or the
// ladder step says, and is offered again, with the commits that may have fixed it, when the live runtime revision moves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { planWorkflow, workflowSettings } from '../../scripts/reconciler/controllers/workflow.mjs';
import { causeCodesOf, fixCandidatesOf } from '../../scripts/reconciler/gate-fix-candidates.mjs';
import { gateViewsFromLedger } from '../../scripts/kernel/gate-ladder.mjs';
import { menuItemOf } from '../../scripts/supervisor/supervisor-menu.mjs';
import { openIncident } from '../../engine/db/ledger.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const settings = workflowSettings();
const NOW = Date.parse('2026-10-09T03:25:00Z');
const RAISED = Date.parse('2026-10-08T05:32:15Z');
const REV = 'b'.repeat(40);
const gate = (over = {}) => ({ incidentId: 'inc-7ef4863b69c7', opId: 'architecture.decide', holds: ['op-architecture.decide-e78adc94cc'], since: RAISED, cause: 'runtime-defect', handler: 'owner', step: 4, steps: 4,
  workaround: { cause: 'runtime-defect', attempt: 'Retried settle --verdict pass; still refused op-gate-tool-failed.' }, detail: 'settle refused op-gate-tool-failed: owned slice cannot be bound',
  subject: 'gate-runtime-defect-op-architecture.decide-e78adc94cc-0', condition: null, conditionNote: 'none', ...over });
const plan = (over = {}) => planWorkflow({ ledgerId: 'nivo-monorepo', workflowId: 'wf-n', now: NOW, settings, ...over });
const gateDis = (out) => out.decisions.filter((d) => d.refs?.gateIncident);

test('an open gate has its Supervisor item when the status is unreadable, at the last ladder step, with the owner told', () => {
  const out = plan({ status: null, gates: [gate()], unreadable: { misses: 9, since: NOW - 60_000, error: 'no JSON', heldAt: null } });
  const [di] = gateDis(out);
  assert.equal(di.decider, 'supervisor');
  assert.equal(di.kind, 'runtime-defect');
  assert.deepEqual(di.options.map((o) => o.key), ['fixed', 'workaround', 'not-runtime-fault']);
  assert.ok(di.evidence.some((e) => /owner step 4 of 4/.test(e.ref)));
  const fromStatus = plan({ status: { ok: true, autopilot: { supervisorGates: [gate()] }, frontier: { state: 'supervisor-wait' } } });
  assert.equal(gateDis(fromStatus).length, 1, 'a readable status gives the same single item');
});

test('the item reaches the Supervisor menu as a gate ruling, also once the ladder escalated it', () => {
  const [di] = gateDis(plan({ gates: [gate()] }));
  const item = menuItemOf({ id: 'sdi-1', status: 'escalated', escalations: 2, ...di, dueAt: NOW - 1, refs: di.refs, workflowId: 'wf-n' }, { repoRoot: 'work/nivo' });
  assert.equal(item.kind, 'gate-ruling');
  assert.deepEqual(item.options.filter((o) => o.choice === 'fixed').map((o) => o.text), ['commit']);
});

test('a runtime-defect gate is offered again under every new runtime revision with the commits that may have fixed it', () => {
  const under = (rev) => gateDis(plan({ gates: [gate({ runtimeRev: rev, fixCandidates: [{ sha: 'abc1234', subject: 'fix(settle): the observations of a rebound attempt are one subject' }] })] }))[0];
  const a = under('a'.repeat(40)), b = under(REV);
  assert.notEqual(a.idempotencyKey, b.idempotencyKey, 'a new revision is a new item, which rings the Supervisor');
  assert.match(b.evidence.map((e) => e.ref).join('\n'), /the live runtime is bbbbbbbbbbbb; commits since the gate was raised that touch its cause: abc1234 fix\(settle\)/);
  assert.match(b.evidence.map((e) => e.ref).join('\n'), /answer fixed --text <commit>/);
  assert.equal(gateDis(plan({ gates: [gate()] }))[0].idempotencyKey.includes('@'), false, 'no revision known, no revision in the item');
});

test('the commits a gate offers are those since it was raised that touch the codes its cause names', (t) => {
  assert.deepEqual(causeCodesOf(gate()), ['op-gate-tool-failed']);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-gate-fix-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const identity = { GIT_AUTHOR_NAME: 'spec', GIT_AUTHOR_EMAIL: 's@s.test', GIT_COMMITTER_NAME: 'spec', GIT_COMMITTER_EMAIL: 's@s.test' };
  const git = (date, ...args) => execFileSync('git', args, { cwd: repo, env: { ...process.env, ...identity, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date }, encoding: 'utf8' });
  git('2026-10-07T00:00:00Z', 'init', '-q');
  fs.mkdirSync(path.join(repo, 'scripts'));
  const commit = (date, file, text, message) => { fs.writeFileSync(path.join(repo, 'scripts', file), text); git(date, 'add', '-A'); git(date, 'commit', '-q', '-m', message); };
  commit('2026-10-07T00:00:00Z', 'a.mjs', 'export const a = 1;\n', 'before the gate');
  commit('2026-10-08T09:00:00Z', 'a.mjs', 'export const a = "op-gate-tool-failed";\n', 'the cause named');
  commit('2026-10-08T10:00:00Z', 'b.mjs', 'export const b = 2;\n', 'unrelated');
  const found = fixCandidatesOf(gate(), 'c'.repeat(40), { root: repo });
  assert.deepEqual(found.map((c) => c.subject), ['the cause named']);
});

test('the open gates of a ledger are read for the plan when the status cannot be', (t) => withLedger(t, ({ ledger }) => {
  seedWorkflow(ledger, { id: 'wf-n', goal: { revision: 1, markdown: '# n' }, jobs: [{ jobId: 'op-h', opId: 'architecture.decide', status: 'reported', payload: { opId: 'architecture.decide', owned_paths: [] } }] });
  openIncident(ledger.db, { incidentId: 'inc-led', workflowId: 'wf-n', kind: 'supervisor-gate', opId: 'architecture.decide', detail: 'settle refused op-gate-tool-failed', lastProgress: '[supervisor-gate] settle refused op-gate-tool-failed', at: NOW - 40 * 3_600_000 });
  ledger.transaction(() => ledger.appendEvent({ workflowId: 'wf-n', entityType: 'incident', entityId: 'inc-led', kind: 'incident-raised',
    payload: { kind: 'supervisor-gate', opId: 'architecture.decide', holds: ['op-h'], workaround: { cause: 'runtime-defect', attempt: 'retried' } }, createdAt: NOW - 40 * 3_600_000 }));
  const [view] = gateViewsFromLedger(ledger.db, 'wf-n', { now: NOW, timeoutMs: 21_600_000 });
  assert.deepEqual([view.incidentId, view.cause, view.handler, view.holds], ['inc-led', 'runtime-defect', 'owner', ['op-h']]);
  assert.match(view.subject, /^gate-runtime-defect-op-h-/);
  assert.equal(gateDis(plan({ status: null, gates: [view] })).length, 1);
}));
