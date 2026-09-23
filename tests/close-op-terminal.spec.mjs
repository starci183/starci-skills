import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';

// A pane close left each settled op's tab in Orca's persisted layout, and Orca
// brought five nivo op sessions back in fresh tabs under new handles. A settled
// operation terminal that owns its tab is closed with the tab.
const withFakeOrca = (t, terminals) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-close-op-'));
  const stub = path.join(root, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const stateFile = path.join(root, 'state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ sends: 0, terminals }));
  const saved = { ...process.env };
  Object.assign(process.env, { STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_STATE: stateFile, STARCI_FAKE_ORCA_LOG: path.join(root, 'calls.jsonl') });
  t.after(() => { process.env = saved; fs.rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  return () => JSON.parse(fs.readFileSync(stateFile, 'utf8'));
};

test('an op terminal alone in its tab is closed with the tab; a shared tab keeps the pane close', async (t) => {
  const state = withFakeOrca(t, {
    'op-alone': { handle: 'op-alone', title: '[Op] architecture.decide' },
    'op-shared': { handle: 'op-shared', title: '[Op] business.decide', tabId: 'tab-k' },
    'kernel': { handle: 'kernel', title: '[Kernel] wf', tabId: 'tab-k', closed: false },
  });
  // The Orca wrappers resolve the host binary once per process: load them after the env points at the fake.
  const { closeOperationTerminal } = await import('../scripts/kernel/close-op-terminal.mjs');
  const alone = closeOperationTerminal('op-alone');
  assert.equal(alone.ok, true);
  assert.equal(alone.tab, 'tab-op-alone');
  assert.deepEqual(state().closedTabs, ['op-alone']);
  assert.equal(closeOperationTerminal('op-shared').ok, true);
  assert.deepEqual(state().closedTabs, ['op-alone'], 'the kernel sharing the tab is never closed with it');
  assert.equal(state().terminals.kernel.closed, false);
  assert.equal(closeOperationTerminal('op-shared', { tabOnly: true }), null, 'tabOnly never falls back to a pane close');
});
