// supervisor-menu.spec.mjs — the Supervisor's menu and its one decision verb (scripts/supervisor/supervisor-menu.mjs, decide.mjs,
// modules/supervisor/supervisor-menu.yaml): every Decision Item the Supervisor decides is one menu item with typed options, a choice
// off the menu is refused with the menu, and a chosen option runs as the starci verb it names and closes the item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDecision, listSupervisorDecisions } from '../../scripts/machine/decisions.mjs';
import { readSupervisorMenu } from '../../scripts/supervisor/supervisor-menu-sources.mjs';
import { menuItemOf, supervisorMenuLines } from '../../scripts/supervisor/supervisor-menu.mjs';
import { decideItem, stepArgv } from '../../scripts/supervisor/decide.mjs';

let counter = 0;
const open = async (spec) => {
  counter += 1;
  const opened = await openDecision(null, { ledger: 'supervisor', decider: 'supervisor', by: 'reconciler/spec', idempotencyKey: `${spec.kind}:spec:${counter}`, entity: { type: 'workflow', id: spec.workflowId ?? 'wf-menu' }, ...spec });
  assert.equal(opened.ok, true, JSON.stringify(opened.json));
  return opened.json.decision.id;
};
const menuOf = () => readSupervisorMenu();
const itemFor = (id) => menuOf().find((entry) => entry.di === id);

test('every Decision Item of the Supervisor is one menu item of its kind, with the typed escape last', async () => {
  const gate = await open({ kind: 'runtime-defect', workflowId: 'wf-gate', summary: 'supervisor-gate inc-1 (retry-cap) holds op-a', refs: { gateIncident: 'inc-1', ledgerId: 'none', cause: 'retry-cap' } });
  const conflict = await open({ kind: 'cross-workflow', workflowId: 'wf-a', summary: 'two workflows share a seam' });
  const starved = await open({ kind: 'cap-starved', workflowId: 'wf-b', summary: 'priority workflow starved' });
  const defect = await open({ kind: 'push-refused', workflowId: 'wf-d', summary: 'a push was refused' });
  const kinds = Object.fromEntries([gate, conflict, starved, defect].map((id) => [id, itemFor(id)?.kind]));
  assert.deepEqual(kinds, { [gate]: 'gate-ruling', [conflict]: 'workflow-conflict', [starved]: 'resource-division', [defect]: 'runtime-defect' });
  assert.deepEqual(itemFor(gate).options.map((option) => option.choice), ['fixed', 'workaround', 'not-runtime-fault', 'record-defect', 'none-fits']);
  assert.deepEqual(itemFor(conflict).options.map((option) => option.choice), ['rule', 'prioritize', 'none-fits']);
  assert.deepEqual(itemFor(starved).options.map((option) => option.choice), ['prioritize', 'rule', 'none-fits']);
  assert.deepEqual(itemFor(defect).options.map((option) => option.choice), ['record-defect', 'none-fits']);
  assert.equal(itemFor(gate).subject.incident, 'inc-1');
  const lines = supervisorMenuLines(menuOf()).join('\n');
  assert.match(lines, /starci supervisor decide --item <id> --choice <choice> --reason <why>/);
  assert.match(lines, new RegExp(`gate-ruling:${gate}`));
});

test('a Kernel escape is its own kind: a ruling to the Kernel or a recorded defect', () => {
  const item = menuItemOf({ id: 'di-esc', kind: 'menu-escape', workflowId: 'wf-c', summary: 'Kernel: no option fits', evidence: [] }, { repoRoot: '/repo' });
  assert.equal(item.kind, 'kernel-escape');
  assert.deepEqual(item.options.map((option) => option.choice), ['rule', 'record-defect', 'none-fits']);
  assert.equal(item.options[0].steps[0].args.repo, '/repo');
});

test('an owner Decision Item is not on the Supervisor menu', async () => {
  const owner = await open({ kind: 'runtime-defect', decider: 'owner', summary: 'an owner-class matter' });
  assert.equal(itemFor(owner), undefined);
});

test('a gate option binds the incident, the workflow and the caller input into the kernel incident call', async () => {
  const id = await open({ kind: 'runtime-defect', workflowId: 'wf-gate2', summary: 'supervisor-gate inc-9', refs: { gateIncident: 'inc-9', ledgerId: 'none', cause: 'budget' } });
  const option = itemFor(id).options.find((entry) => entry.choice === 'workaround');
  const argv = stepArgv(option.steps[0], { text: 'pool-b', reason: 'pool-a is over its quota' }).slice(1);
  assert.deepEqual(argv.slice(0, 2), ['kernel', 'incident']);
  const flag = (name) => argv[argv.indexOf(`--${name}`) + 1];
  assert.deepEqual({ workflow: flag('workflow'), resolve: flag('resolve'), by: flag('by'), resolution: flag('resolution'), route: flag('route'), detail: flag('detail') },
    { workflow: 'wf-gate2', resolve: 'inc-9', by: 'supervisor', resolution: 'workaround', route: 'pool-b', detail: 'pool-a is over its quota' });
});

test('decide refuses an unknown item, an unknown choice and a missing input, each with the menu', async () => {
  const id = await open({ kind: 'push-refused', workflowId: 'wf-r', summary: 'a push was refused' });
  const item = itemFor(id).id;
  for (const [args, code] of [[{ item: 'runtime-defect:nope', choice: 'record-defect', reason: 'why' }, 'menu-item-unknown'],
    [{ item, choice: 'land-it', reason: 'why' }, 'menu-choice-unknown'], [{ item, choice: 'record-defect', reason: 'why' }, 'menu-text-missing'], [{ item, reason: 'why' }, 'decide-answer-incomplete']]) {
    const { out, line } = await decideItem(args);
    assert.equal(out.ok, false, code);
    assert.equal(out.code, code);
    assert.ok(out.menu.some((entry) => entry.id === item), 'the refusal carries the menu');
    assert.match(line, /starci supervisor decide --item <id> --choice <choice>/);
  }
});

test('record-defect runs the defect record, closes the item and leaves a supervisor-action', async () => {
  const id = await open({ kind: 'push-refused', workflowId: 'wf-rec', summary: 'a push was refused' });
  const { out } = await decideItem({ item: itemFor(id).id, choice: 'record-defect', text: 'push-hook-secret', reason: 'the hook refused a tracked secret path' });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.steps[0].out.item, 'runtime-defect:push-hook-secret');
  assert.equal(out.resolved, true);
  assert.equal(itemFor(id), undefined, 'the closed item left the menu');
  const all = await listSupervisorDecisions({ all: true });
  assert.equal(all.find((entry) => entry.id === id).resolution.verb, 'starci supervisor decide');
});

test('prioritize gives the workflow the weight and reserve of the table', async () => {
  const id = await open({ kind: 'cap-starved', workflowId: 'wf-prio', summary: 'priority workflow starved' });
  const { out } = await decideItem({ item: itemFor(id).id, choice: 'prioritize', reason: 'it holds none of its reserve' });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.steps[0].run, 'supervisor ram-cap');
  assert.equal(out.resolved, true);
});

test('none-fits records the reason and hands the item to the owner', async () => {
  const id = await open({ kind: 'cross-workflow', workflowId: 'wf-none', summary: 'a conflict nobody can rule on' });
  const { out } = await decideItem({ item: itemFor(id).id, choice: 'none-fits', reason: 'the ruling would spend money' });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.match(out.owner.owner, /^s?di-/);
  assert.equal(itemFor(id), undefined);
  const owned = (await listSupervisorDecisions({ all: true })).find((entry) => entry.id === out.owner.owner);
  assert.equal(owned.decider, 'owner');
  assert.match(owned.summary, /no option of workflow-conflict/);
});

test('a step that fails keeps the item open and reports the failing verb', async () => {
  const id = await open({ kind: 'runtime-defect', workflowId: 'wf-fail', summary: 'supervisor-gate inc-x', refs: { gateIncident: 'inc-x', ledgerId: 'missing', cause: 'budget' } });
  const { out } = await decideItem({ item: itemFor(id).id, choice: 'not-runtime-fault', reason: 'the cause is a failing check of the product' });
  assert.equal(out.ok, false);
  assert.equal(out.code, 'SUPERVISOR_MENU_STEP_FAILED');
  assert.ok(itemFor(id), 'the item stays on the menu');
});
