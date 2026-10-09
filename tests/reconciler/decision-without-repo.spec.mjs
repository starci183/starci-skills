// Nivo 2026-10-09: the Supervisor's item for a gate carried a ledger reference that resolved to no repository; its verbs then ran against the runtime root
// (ledger-root-is-runtime) and a reader found the defect long after the item was opened. An item planned without a repository behind its ledger is refused
// where it is applied (ctx.openDecision, the one place every controller's item passes), with decision-item-without-repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { createCtx } from '../../scripts/reconciler/ctx.mjs';
import { DECISION_WITHOUT_REPO, decisionRepoRefusal } from '../../scripts/reconciler/decision-repo.mjs';
import { planSupervisorGates } from '../../scripts/reconciler/gate-plan.mjs';

const LEDGERS = [{ ledgerId: 'led-1111', name: 'nivo-monorepo', repo: '/work/nivo-monorepo', file: path.join(os.tmpdir(), 'starci-decision-without-repo', 'runtime.sqlite') }, { ledgerId: 'led-2222', name: 'no-repo', repo: null, file: path.join(os.tmpdir(), 'starci-decision-without-repo', 'second.sqlite') }];
const GATE = { incidentId: 'inc-1', subject: 'gate-op', cause: 'op-gate-tool-failed', holds: ['op-1'], handler: 'supervisor', step: 1, steps: 3 };

/** The items planSupervisorGates plans for a ledger id, through the planner's own `di` seam shaped like the workflow planner's. */
function plannedGateItems(ledgerId) {
  const items = [];
  planSupervisorGates({ workflowId: 'wf-1', ledgerId, gates: [GATE], di: (args) => items.push({ productLedger: ledgerId, workflowId: 'wf-1', idempotencyKey: `runtime-defect:wf-1:${args.subject}`, ...args }) });
  return items;
}

test('an item names a ledger that resolves, by id or by registered name, to a repository; anything else is refused with the code', () => {
  const product = { kind: 'settle-nongreen', ledger: 'led-1111', productLedger: 'led-1111', idempotencyKey: 'k1' };
  assert.equal(decisionRepoRefusal(product, LEDGERS), null);
  assert.equal(decisionRepoRefusal({ ...product, ledger: 'nivo-monorepo' }, LEDGERS), null, 'the registered name is a name of the ledger');
  assert.equal(decisionRepoRefusal({ ...product, ledger: 'ghost' }, LEDGERS).code, DECISION_WITHOUT_REPO);
  assert.equal(decisionRepoRefusal({ ...product, ledger: 'led-2222' }, LEDGERS).code, DECISION_WITHOUT_REPO, 'a registered ledger row with no repository');
  assert.equal(decisionRepoRefusal({ kind: 'x', idempotencyKey: 'k2' }, LEDGERS).code, DECISION_WITHOUT_REPO, 'an item that names no ledger at all');
  const host = { kind: 'runtime-defect', ledger: 'supervisor', idempotencyKey: 'host:1' };
  assert.equal(decisionRepoRefusal(host, LEDGERS), null, 'a host-level Supervisor item names no product ledger and needs no repository');
});

test('the gate item the planner writes is refused when its ledger has no repository, and opens when it has one', () => {
  const known = plannedGateItems('led-1111');
  assert.equal(known.length, 1);
  assert.equal(known[0].ledger, 'supervisor');
  assert.equal(known[0].refs.ledgerId, 'led-1111');
  assert.equal(decisionRepoRefusal(known[0], LEDGERS), null);
  const lost = plannedGateItems('ghost-ledger')[0];
  assert.equal(lost.refs.ledgerId, 'ghost-ledger');
  const refusal = decisionRepoRefusal(lost, LEDGERS);
  assert.equal(refusal.code, DECISION_WITHOUT_REPO);
  assert.match(refusal.error, /ghost-ledger resolves to no registered repository/);
  assert.equal(decisionRepoRefusal({ ...lost, refs: { ...lost.refs, ledgerId: 'nivo-monorepo' } }, LEDGERS), null, 'the registered name the planner wrote resolves');
});

test('ctx.openDecision refuses an item without a repository before any verb runs, in every mode, and logs it', async () => {
  for (const mode of ['active', 'shadow']) {
    const opened = [];
    const logs = [];
    const ctx = createCtx({ controller: 'workflow', mode, ledgers: LEDGERS, now: () => 1_000, writeLog: (row) => { logs.push(row); return { ok: true }; },
      loadDecisions: async () => ({ openDecision: async (repo, di) => { opened.push([repo, di.idempotencyKey]); return { ok: true, json: { created: true } }; } }) });
    const lost = await ctx.openDecision({ kind: 'settle-nongreen', ledger: 'ghost-ledger', idempotencyKey: 'k-lost', workflowId: 'wf-1', decider: 'kernel' });
    assert.deepEqual([lost.ok, lost.refused, lost.code], [false, true, DECISION_WITHOUT_REPO], mode);
    assert.deepEqual(opened, [], 'no verb ran');
    assert.ok(logs.some((row) => JSON.stringify(row).includes('reconciler.decision-refused')), 'the refusal is on the log');
    const fine = await ctx.openDecision({ kind: 'settle-nongreen', ledger: 'led-1111', idempotencyKey: 'k-ok', workflowId: 'wf-1', decider: 'kernel' });
    assert.notEqual(fine.refused, true);
  }
});
