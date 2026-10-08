// After a reboot the tunnel row still owed the closure of a manager and a cloudflared child that no longer exist, and its manager launch
// custody had never been captured, so no stop could close it: every start refused connector-child-custody-unreconciled with an empty
// reason in the checklist ("ask-tunnel: start FAILED"). The absence of the exact recorded processes settles the debt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger } from '../helpers/ledger-fixture.mjs';
import { connectorState, connectorManagerBlocked } from '../../scripts/connectors/lib.mjs';
import { managerAlive } from '../../scripts/connectors/tunnel.mjs';
import { settleGoneCustody, objectGone } from '../../scripts/connectors/custody-gone.mjs';
import { withMachine } from '../../engine/db/machine.mjs';
import { winPath, slashPath } from '../fixtures/win-path.mjs';

const source = slashPath('D', 'fixture-runtime', 'scripts', 'connectors', 'tunnel.mjs');
// FILETIME births: 2026-10-07T06:27:09Z
const MANAGER = { pid: 49236, birth: '134358280285709320', exe: winPath('C', 'fixture', 'node.exe') };
const CHILD = { pid: 62044, birth: '134358280293315172', exe: winPath('C', 'fixture', 'cloudflared.exe') };
const bornMs = (identity) => Number((BigInt(identity.birth) - 116444736000000000n) / 10000n);
// The real shape: the manager's launch custody was never verified (processIdentity null, only a failed capture), the child's was.
const put = () => withMachine((m) => m.upsert('connectors', { name: 'tunnel', kind: 'tunnel', pid: MANAGER.pid, state: 'connected', port: 7070, public_url: 'https://response.starci.org',
  updated_at: m.now(), config_json: { source, startedAt: '2026-10-07T06:27:09.327Z', processIdentity: null,
    processCapture: { pid: MANAGER.pid, ok: false, outcome: 'unknown', proof: 'process-launch-custody-unverified', identity: MANAGER },
    childPid: CHILD.pid, childIdentity: CHILD, childLaunchNonce: 'nonce-a', childClosure: null, connected: true } }, ['name']));

test('the real post-reboot row is blocked until its recorded processes are shown absent', (t) => withLedger(t, () => {
  put();
  assert.equal(connectorManagerBlocked(connectorState('tunnel')), true);
  assert.equal(managerAlive()?.blocked, true);
  const alive = [{ pid: CHILD.pid, created: bornMs(CHILD) }];
  assert.equal(settleGoneCustody('tunnel', { io: { table: () => alive } }), null, 'the child still runs');
  assert.equal(connectorManagerBlocked(connectorState('tunnel')), true);
  assert.equal(settleGoneCustody('tunnel', { io: { table: () => null } }), null, 'an unreadable table proves nothing');
  assert.equal(connectorManagerBlocked(connectorState('tunnel')), true);
}));

test('absent processes settle the row: stopped, closure recorded, the next start is no longer blocked', (t) => withLedger(t, () => {
  put();
  const reused = [{ pid: MANAGER.pid, created: bornMs(MANAGER) + 5_000_000 }, { pid: CHILD.pid, created: bornMs(CHILD) + 5_000_000 }];
  const settled = settleGoneCustody('tunnel', { io: { table: () => reused, now: () => 1_791_435_000_000 } });
  assert.equal(settled.state, 'stopped');
  assert.equal(settled.childClosure.reason, 'process-gone-after-restart');
  assert.equal(connectorManagerBlocked(settled), false);
  assert.equal(managerAlive(), null);
  assert.deepEqual([settled.childIdentity, settled.childLaunchNonce], [CHILD, 'nonce-a'], 'the original custody stays in the row');
}));

test('a pid that is reused by a process born later is not the recorded object', () => {
  assert.equal(objectGone(CHILD, [{ pid: CHILD.pid, created: bornMs(CHILD) }]), false);
  assert.equal(objectGone(CHILD, [{ pid: CHILD.pid, created: bornMs(CHILD) + 3_600_000 }]), true);
  assert.equal(objectGone({ pid: 1, birth: 'x' }, []), false, 'an unreadable birth proves nothing');
});
