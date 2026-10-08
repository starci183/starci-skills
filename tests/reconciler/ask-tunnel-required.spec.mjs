// A down ask tunnel gates a workflow start only when something pushes its public link to the owner. Live shape (2026-10-08): the
// tunnel was blocked after the reboot, connectors.telegram.enabled was false, and the required row refused `workflow start`
// with workflow-host-not-ready for a channel no one was notified through.
import test from 'node:test';
import assert from 'node:assert/strict';
import { serviceItems } from '../../scripts/reconciler/start-items.mjs';

const down = (name) => ({ name, ok: false, detail: { error: 'connector-child-custody-unreconciled' } });
const rowOf = (name, config) => serviceItems([down(name)], { config })[0];

test('with Telegram off the down tunnel is a warning that says why it is not required', () => {
  const row = rowOf('ask-tunnel', { connectors: { cloudflare: { mode: 'named' }, telegram: { enabled: false } } });
  assert.deepEqual([row.status, row.required], ['warn', false]);
  assert.match(row.detail, /connector-child-custody-unreconciled/);
  assert.match(row.detail, /serve-ask starts the tunnel/);
});

test('with Telegram on the down tunnel stays required', () => {
  const row = rowOf('ask-tunnel', { connectors: { cloudflare: { mode: 'named' }, telegram: { enabled: true } } });
  assert.deepEqual([row.status, row.required], ['red', true]);
});

test('the other services keep their requirement', () => {
  assert.equal(rowOf('ask-gateway', { connectors: { cloudflare: { mode: 'named' }, telegram: { enabled: false } } }).status, 'red');
});
