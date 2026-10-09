// The draft item: the digest names a draft with no Supervisor item, the mirror closes the item when the draft is gone, and the menu offers wait and record-defect.
import test from 'node:test';
import assert from 'node:assert/strict';
import { draftProblems } from '../../scripts/reconciler/debug-digest-silent.mjs';
import { mirrorPlan } from '../../scripts/reconciler/supervisor-mirror.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { parseYaml } from '../../engine/yaml.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { NOW, MIN, numbers, digest, snapshot, workflow } from '../helpers/debug-digest-fixture.mjs';

const draft = { since: NOW - 7 * MIN, lastAt: NOW - MIN, refusals: 3, terminal: 'term_k', delivery: 'foreign-input', draft: 'x' };

test('a draft past the bound with no open Supervisor item is a problem line of the runtime (violating); with the item, or inside the bound, none (passing)', () => {
  const [p] = draftProblems({ id: 'wf-1', name: 'Shop', draft, decisions: [] }, NOW, numbers);
  assert.deepEqual([p.code, p.params.min, p.params.refusals], ['draft-unowned', 7, 3]);
  assert.deepEqual(draftProblems({ id: 'wf-1', draft, decisions: [{ kind: 'seat-draft-held', status: 'open' }] }, NOW, numbers), []);
  assert.deepEqual(draftProblems({ id: 'wf-1', draft: { ...draft, since: NOW - MIN }, decisions: [] }, NOW, numbers), []);
  assert.equal(numbers.draftHeldMs, 300_000, 'the bound is the seat wake-repeat time');
  const d = digest(snapshot({ workflows: [workflow({ draft })] }));
  assert.ok(d.problems.some((x) => x.key.startsWith('draft-unowned')), 'the digest carries it');
  assert.equal(d.problems.find((x) => x.key.startsWith('draft-unowned')).role, 'runtime');
});

test('the mirror closes the Supervisor item once the draft is gone, and keeps it while the draft stands', (t) => withLedger(t, ({ ledger }) => {
  const wf = 'wf-1';
  seedWorkflow(ledger, { id: wf });
  openDecisionRow(ledger, { workflowId: wf, kind: 'seat-draft-held', decider: 'supervisor', entity: { type: 'workflow', id: wf }, summary: 'a draft has stood', idempotencyKey: `seat-draft-held:${wf}:1:0` });
  const plan = () => mirrorPlan(ledger.db, { ledgerId: 'l', ledgerName: 'shop', workflowId: wf, now: Date.now() });
  assert.equal(plan().closures.length, 1, 'no draft episode: the item is stale');
  assert.equal(plan().closures[0].verb, 'supervisor-item-stale');
  ledger.transaction(() => ledger.appendEvent({ workflowId: wf, entityType: 'kernel', entityId: wf, kind: 'kernel-wake-draft-held', payload: { terminal: 't', delivery: 'foreign-input' } }));
  assert.deepEqual([plan().closures.length, plan().twins.length], [0, 1], 'the draft stands: the item is mirrored to the Supervisor');
}));

test('the Supervisor menu offers wait and record-defect for the draft, leave and record-defect for the trees', () => {
  const kinds = parseYaml(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'modules', 'supervisor', 'supervisor-menu.yaml'), 'utf8')).kinds;
  assert.deepEqual(kinds.find((k) => k.id === 'seat-draft').options.map((o) => o.choice), ['wait', 'record-defect']);
  assert.deepEqual(kinds.find((k) => k.id === 'untied-trees').options.map((o) => o.choice), ['leave', 'record-defect']);
});
