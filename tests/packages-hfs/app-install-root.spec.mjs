// app-install-root.spec.mjs - the installs a scaffold spec may borrow packages from (tests/helpers/hfs-app-install.mjs): STARCI_APP_INSTALLS names installs under the checkout only, because the
// scaffold build widens Turbopack's root to the checkout and an install elsewhere panics the fe build; an install outside is refused with a message that says why, never left to that panic.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { RUNTIME, runtimeInstalls } from '../helpers/hfs-app-install.mjs';

/** Run `work` with STARCI_APP_INSTALLS set to `value`, the variable put back as found. */
function withInstalls(value, work) {
  const before = process.env.STARCI_APP_INSTALLS;
  process.env.STARCI_APP_INSTALLS = value;
  try { return work(); } finally { if (before === undefined) delete process.env.STARCI_APP_INSTALLS; else process.env.STARCI_APP_INSTALLS = before; }
}

test('an install outside the checkout is refused by name with the reason; an install under it is accepted', () => {
  const outside = path.join(os.tmpdir(), 'elsewhere', 'node_modules');
  assert.throws(() => withInstalls(outside, runtimeInstalls), (error) => error.message.includes('under the checkout') && error.message.includes(outside) && error.message.includes('Turbopack'));
  assert.throws(() => withInstalls([path.join(RUNTIME, 'ex-testing', 'app', 'node_modules'), outside].join(path.delimiter), runtimeInstalls), /lies outside it/, 'one outside entry among several refuses');
  assert.doesNotThrow(() => withInstalls(path.join(RUNTIME, 'ex-testing', 'release-app-x', 'node_modules'), runtimeInstalls));
  assert.doesNotThrow(() => withInstalls('', runtimeInstalls), 'unset or empty borrows only the checkout\'s own installs');
  assert.throws(() => withInstalls(RUNTIME, runtimeInstalls), /under the checkout/, 'the checkout itself is not an install under it');
});
