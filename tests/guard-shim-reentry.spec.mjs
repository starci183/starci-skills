import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { realBinary } from '../scripts/guards/shim.mjs';
import { guardsRoot } from '../scripts/guards/install.mjs';
import { safeRemoveTree } from '../scripts/lib/safe-remove.mjs';

const shim = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'guards', 'shim.mjs');
const exe = process.platform === 'win32' ? '.exe' : '';

test('the built guard bin is never the real git, even without STARCI_GUARD_BIN', (t) => {
  const real = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-real-git-'));
  t.after(() => { safeRemoveTree(real); });
  fs.writeFileSync(path.join(real, `git${exe}`), '');
  const env = { PATH: [path.join(guardsRoot(), 'bin'), real].join(path.delimiter) };
  assert.equal(realBinary('git', env, [exe]), path.join(real, `git${exe}`));
});

test('a shim running inside a shim chain past its depth refuses instead of spawning again', () => {
  const r = spawnSync(process.execPath, [shim, 'git', '--version'], { env: { ...process.env, STARCI_SHIM_DEPTH: '3' }, encoding: 'utf8' });
  assert.equal(r.status, 127);
  assert.match(r.stderr, /re-entrant git/);
});
