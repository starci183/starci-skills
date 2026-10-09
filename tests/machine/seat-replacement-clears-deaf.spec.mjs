// A seat replaced by a new one starts with no refused input: the run of failures belongs to the seat it replaced (Nivo/StarCi live
// 2026-10-09: a fresh Supervisor seat read live while the digest still called the seat deaf from the dead seat's four refused wakes).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openMachine } from '../../engine/db/machine.mjs';
import { writeSeat } from '../../scripts/machine/home.mjs';

test('writing the Supervisor seat clears the failure run of the seat it replaces', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-seat-deaf-'));
  const machine = openMachine({ file: path.join(root, 'machine.sqlite') });
  t.after(() => { machine.close(); fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); });
  writeSeat(machine, { token: 't1', value: { terminal: 'term_old', agent: 'claude' } });
  for (let i = 0; i < 4; i += 1) machine.recordSeatInput({ seatId: 'supervisor', terminal: 'term_old', action: 'kernel-unwritable' });
  const deaf = () => machine.db.prepare('SELECT seat_id FROM v_deaf_seats').all().map((row) => row.seat_id);
  assert.deepEqual(deaf(), ['supervisor'], 'four refused inputs in a row make the seat deaf');
  writeSeat(machine, { token: 't2', value: { terminal: 'term_new', agent: 'claude' } });
  assert.deepEqual(deaf(), [], 'the replacement seat is not deaf');
  const seat = machine.seatOf('supervisor');
  assert.equal(seat.terminal_handle, 'term_new');
  assert.equal(seat.input_failures_consecutive, 0);
  assert.equal(seat.last_input_failure_at, null);
});
