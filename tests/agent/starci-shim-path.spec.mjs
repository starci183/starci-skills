// starci-shim-path.spec.mjs - every agent the runtime launches can run `starci`: spawnAgent puts the per-user shim
// directory (<home>/.starci/bin, written by `starci runtime install`) first on PATH, once, however often it is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { spawnAgent } from '../../scripts/agent/lib.mjs';

const pathKey = () => Object.keys(process.env).find((name) => name.toLowerCase() === 'path') ?? 'PATH';

test('spawnAgent puts the starci shim directory first on PATH exactly once', (t) => {
  const key = pathKey();
  const saved = process.env[key];
  t.after(() => { if (saved === undefined) delete process.env[key]; else process.env[key] = saved; });
  const shim = path.join(os.homedir(), '.starci', 'bin');
  process.env[key] = ['/usr/bin', shim, '/bin'].join(path.delimiter);

  // An unknown provider stops at the card step, after the PATH is prepared and before anything is launched.
  const first = spawnAgent({ provider: 'no-such-provider', worktree: '/w', title: 't', spec: 's', run: 'r', request: 'q' });
  assert.equal(first.ok, false);
  assert.equal(first.step, 'card');
  const second = spawnAgent({ provider: 'no-such-provider', worktree: '/w', title: 't', spec: 's', run: 'r', request: 'q' });
  assert.equal(second.step, 'card');

  const entries = process.env[key].split(path.delimiter);
  assert.equal(entries[0], shim, 'the shim directory is first');
  assert.equal(entries.filter((entry) => entry === shim).length, 1, 'and appears once');
  assert.ok(entries.includes('/usr/bin') && entries.includes('/bin'), 'the rest of PATH is kept');
});
