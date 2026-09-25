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

test('closing a terminal unbinds its guard file; a close that failed or never ran keeps it', async (t) => {
  const { closeOperationTerminal } = await import('../scripts/kernel/close-op-terminal.mjs');
  const { bindGuardTerminal, unbindGuardTerminal, writeJobGuard, terminalsDir } = await import('../scripts/guards/install.mjs');
  const skillRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-unbind-'));
  t.after(() => fs.rmSync(skillRoot, { recursive: true, force: true }));
  const jobFile = writeJobGuard({ skillRoot, jobId: 'op-x', workflowId: 'wf', ledgerRepo: skillRoot, owned: [] });
  const bound = bindGuardTerminal({ skillRoot, handle: 'term_x', jobFile });
  assert.ok(fs.existsSync(bound));
  const unbind = ({ handle }) => unbindGuardTerminal({ skillRoot, handle });
  const list = () => ({ ok: true, terminals: [{ handle: 'term_x', tabId: 'tab-x' }] });
  const refused = closeOperationTerminal('term_x', { list, close: () => ({ ok: false, error: 'refused' }), unbind });
  assert.equal(refused.ok, false);
  assert.ok(fs.existsSync(bound), 'a terminal still open keeps its guard');
  assert.equal(closeOperationTerminal('term_x', { tabOnly: true, list: () => ({ ok: true, terminals: [] }), close: () => assert.fail('no close'), unbind }), null);
  assert.ok(fs.existsSync(bound));
  const closes = [];
  const done = closeOperationTerminal('term_x', { list, close: (args) => { closes.push(args); return { ok: true }; }, unbind });
  assert.deepEqual([done.ok, done.tab, closes], [true, 'tab-x', [{ terminal: 'term_x', tab: true }]]);
  assert.equal(fs.existsSync(bound), false, 'the closed terminal\'s guard binding is gone');
  assert.deepEqual(fs.readdirSync(terminalsDir(skillRoot)), []);
  assert.equal(unbindGuardTerminal({ skillRoot, handle: 'term_x' }), false, 'nothing left to unbind');
});
