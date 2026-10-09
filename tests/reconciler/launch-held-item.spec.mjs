// A refused launch recovery opens its own Supervisor item (workflow-launch-custody.mjs); the seat quarantine for the same refusal opens no second one while it stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seatQuarantine } from '../../scripts/reconciler/host-seats.mjs';
import { recoveryItemOpen } from '../../scripts/kernel/launch-held-item.mjs';

const db = (rows) => {
  const d = new DatabaseSync(':memory:');
  d.exec('CREATE TABLE sup_decision_items(workflow_id TEXT, status TEXT, idempotency_key TEXT)');
  for (const r of rows) d.prepare('INSERT INTO sup_decision_items VALUES(?,?,?)').run(...r);
  return d;
};
const quarantine = async (stateDb, step) => {
  const opened = [];
  await seatQuarantine({ stateDb, openDecision: async (di) => { opened.push(di); } },
    { key: 'seat:kernel:l:wf-1', rec: { state: 'replacing' }, next: { restarts: [] }, ledgerId: 'l', workflowId: 'wf-1', action: 'start-held', now: 1, hold: { step, count: 3, state: 'held' } }, { di: (x) => x });
  return opened;
};

test('the recovery item for the workflow is detected only while live', () => {
  assert.equal(recoveryItemOpen(db([['wf-1', 'open', 'kernel-launch-held:abc:def:0']]), 'wf-1'), true);
  assert.equal(recoveryItemOpen(db([['wf-1', 'resolved', 'kernel-launch-held:abc:def:0']]), 'wf-1'), false);
  assert.equal(recoveryItemOpen(db([['wf-2', 'open', 'kernel-launch-held:abc:def:0']]), 'wf-1'), false);
});

test('a hold on kernel-launch-unreconciled opens no second item while the recovery item stands (violating before)', async () => {
  assert.equal((await quarantine(db([['wf-1', 'open', 'kernel-launch-held:abc:def:0']]), 'kernel-launch-unreconciled')).length, 0);
});

test('without the recovery item, or for another cause, the quarantine item is opened (passing)', async () => {
  assert.equal((await quarantine(db([]), 'kernel-launch-unreconciled')).length, 1);
  assert.equal((await quarantine(db([['wf-1', 'open', 'kernel-launch-held:abc:def:0']]), 'kernel-terminal-unverified')).length, 1);
});
