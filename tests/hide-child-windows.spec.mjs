import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { withWindowsHide } from '../scripts/lib/hide-child-windows.mjs';

// The owner saw black console windows flash on every watchdog tick: detached
// runtime processes have no console, so each orca/powershell/node child they
// ran without windowsHide opened a new one.
const hide = { windowsHide: true };

test('windowsHide lands in the options slot of every call shape', () => {
  const cb = () => {};
  assert.deepEqual(withWindowsHide(['orca'], true), ['orca', hide]);
  assert.deepEqual(withWindowsHide(['orca', ['a']], true), ['orca', ['a'], hide]);
  assert.deepEqual(withWindowsHide(['orca', ['a'], { cwd: 'x' }], true), ['orca', ['a'], { cwd: 'x', windowsHide: true }]);
  assert.deepEqual(withWindowsHide(['orca', { cwd: 'x' }], true), ['orca', { cwd: 'x', windowsHide: true }]);
  assert.deepEqual(withWindowsHide(['orca', undefined, { cwd: 'x' }], true), ['orca', undefined, { cwd: 'x', windowsHide: true }]);
  assert.deepEqual(withWindowsHide(['orca', ['a'], cb], true), ['orca', ['a'], hide, cb]);
  assert.deepEqual(withWindowsHide(['orca', cb], true), ['orca', hide, cb]);
  assert.deepEqual(withWindowsHide(['dir', cb], false), ['dir', hide, cb]);
  assert.deepEqual(withWindowsHide(['dir', { cwd: 'x' }], false), ['dir', { cwd: 'x', windowsHide: true }]);
  assert.deepEqual(withWindowsHide(['orca', ['a'], { windowsHide: false }], true), ['orca', ['a'], { windowsHide: false }], 'an explicit choice is kept');
});

test('every detached runtime entry point imports the patch first', () => {
  for (const file of ['scripts/kernel/watchdog.mjs', 'scripts/connectors/ask-gateway.mjs', 'scripts/connectors/tunnel.mjs', 'scripts/kernel/serve-ask.mjs', 'scripts/connectors/telegram-bridge.mjs']) {
    const first = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').split('\n').find((l) => l.startsWith('import '));
    assert.equal(first?.trim(), "import '../lib/hide-child-windows.mjs';", file);
  }
});
