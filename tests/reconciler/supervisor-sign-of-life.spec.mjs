// StarCi 2026-10-09: `starci debug digest` read "Supervisor last seen 270 minutes ago, last woken 6 minutes ago" while the seat had answered three
// Decision Items in the minute after that wake: seats.last_seen_at is written at boot and nothing refreshes it, so the digest judged a working seat by a dead column.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { machineFacts } from '../../scripts/reconciler/debug-digest-machine.mjs';
import { supervisorLastSeenAt } from '../../scripts/reconciler/supervisor-sign-of-life.mjs';

const NOW = Date.now();
const MIN = 60_000;

test('the newest of the boot stamp, the Supervisor decision and its logged action is when the seat was last seen', () => {
  const rows = (decided, logged) => (sql) => [{ at: sql.includes('sup_decisions') ? decided : logged }];
  assert.equal(supervisorLastSeenAt(NOW - 270 * MIN, rows(NOW - 5 * MIN, null)), NOW - 5 * MIN);
  assert.equal(supervisorLastSeenAt(NOW - 270 * MIN, rows(null, NOW - 2 * MIN)), NOW - 2 * MIN);
  assert.equal(supervisorLastSeenAt(NOW - 270 * MIN, rows(null, null)), NOW - 270 * MIN);
  assert.equal(supervisorLastSeenAt(null, rows(null, null)), null);
});

test('the digest facts of a seat booted long ago that decided a minute ago read the decision as the sign of life', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sign-of-life-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const env = { STARCI_TEST_MACHINE_FILE: path.join(dir, 'machine.sqlite') };
  const machine = openMachine({ env });
  try {
    machine.upsertSeat({ seatId: 'supervisor', role: 'supervisor', state: 'live', terminalHandle: 'term_s', lastSeenAt: NOW - 270 * MIN });
    machine.db.prepare("INSERT INTO sup_decisions(decision_id,decider,span_id,choice,decided_at) VALUES('sdec-1','supervisor','0123456789abcdef','starci supervisor decide',?)").run(NOW - MIN);
  } finally { machine.close(); }
  assert.equal(machineFacts({ env }).supervisor.seat.lastSeenAt, NOW - MIN);
});
