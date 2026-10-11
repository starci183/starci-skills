// 2026-10-09: `starci reconciler up --services` ran the harness UI dependency install as `npm ci`, which deletes ui/node_modules first and died EPERM on a native file a running
// dev server held, leaving 22 of 144 packages; and a dependency added on main (@heroui/react) was never installed because the tools were present. The UI installs with
// the non-destructive install, whenever the manifest is newer than the install, and a failure names what holds the file and says node_modules was not deleted.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildUi, manifestNewerThanInstall, installFailureLine } from '../../scripts/reconciler/ui-build.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';

function uiDir(t) {
  const root = makeTempDir('starci-ui-install-');
  t.after(() => fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }));
  const ui = path.join(root, 'ui');
  for (const tool of ['vite/bin/vite.js', 'typescript/bin/tsc', 'eslint/bin/eslint.js']) {
    fs.mkdirSync(path.dirname(path.join(ui, 'node_modules', tool)), { recursive: true });
    fs.writeFileSync(path.join(ui, 'node_modules', tool), '');
  }
  fs.writeFileSync(path.join(ui, 'package.json'), '{}');
  fs.writeFileSync(path.join(ui, 'package-lock.json'), '{}');
  return ui;
}
const at = (file, ms) => fs.utimesSync(file, new Date(ms), new Date(ms));

test('a manifest newer than the install asks for an install although every tool is there; an install newer than the manifest asks for none', async (t) => {
  const ui = uiDir(t);
  const hidden = path.join(ui, 'node_modules', '.package-lock.json');
  fs.writeFileSync(hidden, '{}');
  at(hidden, 2_000_000);
  at(path.join(ui, 'package.json'), 1_000_000);
  at(path.join(ui, 'package-lock.json'), 1_000_000);
  assert.equal(manifestNewerThanInstall(ui), false);
  at(path.join(ui, 'package.json'), 3_000_000);
  assert.equal(manifestNewerThanInstall(ui), true, 'a dependency added after the install');
  const calls = [];
  const hold = async (_options, fn) => ({ ok: true, value: await fn() });
  const out = await buildUi({ uiDir: ui }, { underHostLock: hold, install: (dir) => { calls.push('install'); return { ok: true, status: 0, dir }; }, npm: () => { calls.push('build'); return { status: 0, stdout: 'built' }; } });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.deepEqual(calls, ['install', 'build']);
});

test('a failed install keeps node_modules, and when a running process holds a file it says which file and who', () => {
  const stderr = ['npm error code EPERM', 'npm error syscall unlink', 'npm error path ui/node_modules/lightningcss-win32-x64-msvc/lightningcss.win32-x64-msvc.node', 'npm error errno -4048'].join('\n');
  const line = installFailureLine({ ok: false, status: 1, stderr }, 'ui', () => [{ pid: 7, name: 'vite' }]);
  assert.match(line, /a running process holds .*lightningcss\.win32-x64-msvc\.node/);
  assert.match(line, /"pid":7/);
  assert.match(line, /node_modules was not deleted/);
  assert.doesNotMatch(installFailureLine({ ok: false, status: 1, stderr: 'network down' }, 'ui', () => []), /holds/);
});
