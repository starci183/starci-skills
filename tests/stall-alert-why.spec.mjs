// stall-alert escalationWhy: a GATE finding routed to the supervisor is a justified gate, never an unreadable frontier
// (2026-09-28: every supervisor-gate hold was reported 'runtime: the frontier is unreadable' although api status
// answered in 1-3 s - GATE findings carry no frontierState).
import test from 'node:test';
import assert from 'node:assert/strict';
import { escalationWhy } from '../scripts/supervisor/stall-alert.mjs';

const SUPERVISOR = 'supervisor';

test('a supervisor-routed GATE finding reads as a justified gate, not an unreadable frontier', () => {
  assert.equal(escalationWhy({ type: 'GATE', route: SUPERVISOR }), 'held by a justified gate only a peer or the supervisor can move');
});

test('a supervisor-routed STALLED finding without a frontier state still reads as unreadable', () => {
  assert.equal(escalationWhy({ type: 'STALLED', route: SUPERVISOR, frontierState: null }), 'runtime: the frontier is unreadable');
  assert.equal(escalationWhy({ type: 'STALLED', route: SUPERVISOR, frontierState: 'peer-wait' }), 'held by a justified gate only a peer or the supervisor can move');
});
