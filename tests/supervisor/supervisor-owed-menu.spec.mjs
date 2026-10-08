// supervisor-owed-menu.spec.mjs — every OWED class of the Supervisor (modules/supervisor/supervise.yaml mission.classes) reaches the Supervisor's
// menu as a Decision Item with typed choices (registry entry supervisor-owed-items-without-menu-kind), and the menu escape kernel-escape has its
// policy row and its place in the Supervisor's happy errors (entry supervisor-menu-escape-has-no-policy-row).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { DI_KINDS } from '../../scripts/machine/decisions.mjs';
import { menuItemOf } from '../../scripts/supervisor/supervisor-menu.mjs';
import { planWorkflow, workflowSettings } from '../../scripts/reconciler/controllers/workflow.mjs';
import { overdueOwedWaits } from '../../scripts/reconciler/owed-plan.mjs';
import { openDecision, listSupervisorDecisions } from '../../scripts/machine/decisions.mjs';
import { readSupervisorMenu } from '../../scripts/supervisor/supervisor-menu-sources.mjs';
import { decideItem } from '../../scripts/supervisor/decide.mjs';
import { rolesContract } from '../../scripts/machine/roles-contract.mjs';

const yaml = (...parts) => parseYaml(fs.readFileSync(path.join(skillRoot, ...parts), 'utf8'));
const menu = yaml('modules', 'supervisor', 'supervisor-menu.yaml');
const classes = Object.keys(yaml('modules', 'supervisor', 'supervise.yaml').mission.classes);
const MIN = 60_000;
const NOW = Date.now();
const WF = 'wf-owed-menu';
const REPO = { repoRoot: '/repo' };

const supervisorDi = (diKind, over = {}) => ({ id: `di-${diKind}`, kind: diKind, workflowId: WF, summary: `${diKind} stands`, evidence: [], ...over });
const menuKindOf = (di) => menuItemOf(di, REPO).kind;

test('every OWED class has a row that names a known Decision Item kind, and no row is left over', () => {
  assert.deepEqual(Object.keys(menu.owedClasses).sort(), [...classes].sort(), 'a class added to supervise.yaml needs its menu path');
  for (const [cls, row] of Object.entries(menu.owedClasses)) {
    assert.ok(['direct', 'ladder', 'gate'].includes(row.reaches), `${cls}: reaches`);
    assert.ok(DI_KINDS.includes(row.diKind), `${cls}: ${row.diKind} is a Decision Item kind`);
  }
});

test('every class reaches the menu as an item with a typed choice besides the escape', () => {
  for (const [cls, row] of Object.entries(menu.owedClasses)) {
    const di = supervisorDi(row.diKind, row.reaches === 'ladder' ? { idempotencyKey: `escalated:ledger:di-${row.diKind}` } : {});
    const item = menuItemOf(di, REPO);
    const choices = item.options.map((option) => option.choice);
    assert.ok(choices.length >= 2 && choices[0] !== 'none-fits' && choices.at(-1) === 'none-fits', `${cls} (${row.diKind}) as ${item.kind}: ${choices.join(',')}`);
    assert.ok(menu.kinds.some((kind) => kind.id === item.kind), `${cls}: the menu kind ${item.kind} exists`);
  }
});

test('the classes without a Decision Item of their own have a menu kind of their own', () => {
  assert.equal(menuKindOf(supervisorDi('retry-decision')), 'retry-cap');
  assert.equal(menuKindOf(supervisorDi('ready-undispatched')), 'undispatched');
  assert.equal(menuKindOf(supervisorDi('orphaned-frontier')), 'orphaned');
  assert.equal(menuKindOf(supervisorDi('retry-decision', { idempotencyKey: 'escalated:l:di-1' })), 'retry-cap', 'the Kernel retry-decision left past its bound arrives on the same kind');
  const ruling = menuItemOf(supervisorDi('ready-undispatched'), REPO).options.find((option) => option.choice === 'rule');
  assert.deepEqual(ruling.steps[0].args, { repo: '/repo', workflow: WF, text: '$text', item: 'di-ready-undispatched' }, 'the ruling is the supervisor notify of the item, its --text bound by decide');
});

const stuck = (kind, id, ageMin) => ({ key: `stuck:${WF}:${kind}:${id}`, kind, incidentId: kind === 'retry-cap' ? id : undefined, jobId: kind === 'queued-ready' ? id : undefined, since: NOW - ageMin * MIN, detail: 'fired 3 of 3 times' });
const plan = (status, extra = {}) => planWorkflow({ ledgerId: 'shop-be', workflowId: WF, now: NOW, settings: workflowSettings(), status: { ok: true, phase: 'running', stuck: [], frontier: { state: 'engaged', queued: [] }, ...status }, ...extra });
const supervisorOnes = (result, kind) => result.decisions.filter((d) => d.decider === 'supervisor' && (!kind || d.kind === kind));

test('a retry-cap or queued-ready wait past its critical bound opens one Supervisor Decision Item; inside the bound it opens none', () => {
  const s = workflowSettings();
  assert.deepEqual(s.supervisorOwed, { 'retry-cap': 'retry-decision', 'queued-ready': 'ready-undispatched' });
  const late = plan({ stuck: [stuck('retry-cap', 'inc-1', s.stuckSla['retry-cap'].criticalMs / MIN + 5), stuck('queued-ready', 'op-a-1', s.stuckSla['queued-ready'].criticalMs / MIN + 5)] });
  const opened = supervisorOnes(late);
  assert.deepEqual(opened.map((d) => d.kind).sort(), ['ready-undispatched', 'retry-decision']);
  for (const d of opened) {
    assert.equal(d.ledger, 'supervisor');
    assert.equal(d.refs.ledgerId, 'shop-be');
    assert.deepEqual(menuItemOf(d, REPO).options.map((option) => option.choice), ['rule', 'record-defect', 'none-fits']);
  }
  assert.equal(new Set(opened.map((d) => d.idempotencyKey)).size, 2, 'one key per wait');
  const young = plan({ stuck: [stuck('retry-cap', 'inc-1', s.stuckSla['retry-cap'].warnMs / MIN + 1)] });
  assert.equal(supervisorOnes(young).length, 0);
  assert.deepEqual(overdueOwedWaits({ stuck: [stuck('peer-wait', 'inc-2', 99999)], now: NOW, table: s.supervisorOwed, stuckSla: s.stuckSla }), [], 'a kind the table does not name opens nothing here');
});

test('a frontier orphaned past the Supervisor grace opens an orphaned-frontier Decision Item for the Supervisor', () => {
  const s = workflowSettings();
  const frontier = { state: 'orphaned-frontier', reason: 'no open work and no next step', queued: [] };
  const clocks = (ageMin) => [{ entity: `workflow:shop-be:${WF}`, state: 'ORPHANED_FRONTIER', enteredAt: NOW - ageMin * MIN }];
  const pastGrace = plan({ frontier }, { clocks: clocks(s.supervisorGraceMs / MIN + 5) });
  const owed = supervisorOnes(pastGrace, 'orphaned-frontier');
  assert.equal(owed.length, 1);
  assert.equal(menuKindOf(owed[0]), 'orphaned');
  const kernelOne = pastGrace.decisions.find((d) => d.kind === 'orphaned-frontier' && d.decider === 'kernel');
  assert.notEqual(kernelOne?.idempotencyKey, owed[0].idempotencyKey, 'the Kernel item and the Supervisor item are two keys');
  const inside = plan({ frontier }, { clocks: clocks(Math.max(1, s.supervisorGraceMs / MIN - 5)) });
  assert.equal(supervisorOnes(inside, 'orphaned-frontier').length, 0);
});

test('kernel-escape has its hold row, bound and chain, and the Supervisor names it among its happy errors', () => {
  const policy = yaml('modules', 'kernel', 'op-incident-policy.yaml');
  const row = policy.holds.find((hold) => hold.id === 'menu-escape');
  assert.equal(row.handler, 'supervisor');
  assert.ok(row.bound.deadlineMs.ref && row.chain.at(-1) === 'owner', 'a bound, then the next handler, ending at the owner');
  const supervisor = rolesContract(skillRoot).roles.find((role) => role.id === 'supervisor');
  assert.ok(supervisor.happyErrors.some((error) => error.row === 'menu-escape' && /kernel-escape/.test(error.what)));
  assert.equal(menuKindOf({ id: 'di-esc', kind: 'menu-escape', workflowId: WF, summary: 'x', evidence: [] }), 'kernel-escape');
});

test('an owed Decision Item of a new kind is listed by the menu and answered by decide', async () => {
  const opened = await openDecision(null, { ledger: 'supervisor', decider: 'supervisor', by: 'reconciler/spec', kind: 'ready-undispatched', workflowId: WF, idempotencyKey: `ready-undispatched:${WF}:queued-ready-op-a`,
    entity: { type: 'stuck', id: `${WF}:queued-ready:op-a` }, summary: 'queued-ready op-a stands 70m' });
  assert.equal(opened.ok, true, JSON.stringify(opened.json));
  const id = opened.json.decision.id;
  const item = readSupervisorMenu().find((entry) => entry.di === id);
  assert.equal(item.kind, 'undispatched');
  const { out } = await decideItem({ item: item.id, choice: 'record-defect', text: 'ready-work-undispatched', reason: 'the runtime did not dispatch the ready work after a delivered wake' });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.resolved, true);
  assert.equal(readSupervisorMenu().find((entry) => entry.di === id), undefined, 'the answered item left the menu');
  assert.equal((await listSupervisorDecisions({ all: true })).find((entry) => entry.id === id).resolution.verb, 'starci supervisor decide');
});
