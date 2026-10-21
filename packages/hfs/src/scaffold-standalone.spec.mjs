// scaffold-standalone.spec.mjs - `npx @starci/cli app scaffold` works from the published packages alone: the Sonar exclusions come from the
// jest preset copy @starci/hfs ships (bundledPresets), and a new path is git-initialised with an unborn main before any file is written.
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundledPresets } from '../sync/index.mjs';
import { scaffoldApp } from '../scaffold/app.mjs';
import { init } from '../runtime/scripts/api/git/init.mjs';

const BUNDLED = new URL('../runtime/packages/jest-preset/sonar-exclusions.cjs', import.meta.url);
const tempRoot = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-scaffold-standalone-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
const lockedOk = (root) => {
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  return { ok: true };
};

test('bundledPresets answers the jest preset exclusions @starci/hfs ships', () => {
  const list = createRequire(import.meta.url)(fileURLToPath(BUNDLED));
  assert.ok(list.length > 0 && list.every((glob) => typeof glob === 'string'));
  assert.deepEqual(bundledPresets(), { sonarExclusions: list.join(',') });
});

test('a new path is git-initialised with an unborn main before the app files are written', (t) => {
  const into = tempRoot(t);
  const calls = [];
  const initGit = (root, options) => {
    calls.push({ root, options, hadFiles: fs.readdirSync(root).length });
    return init(root, options);
  };
  const { root, files } = scaffoldApp({ name: 'demo', into, edition: 'full', presets: bundledPresets(), lock: lockedOk, initGit });
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { root, options: { branch: 'main' }, hadFiles: 0 });
  assert.equal(fs.readFileSync(path.join(root, '.git', 'HEAD'), 'utf8').trim(), 'ref: refs/heads/main');
  assert.ok(files.includes('hfs.json') && fs.existsSync(path.join(root, 'hfs.json')));
  assert.match(fs.readFileSync(path.join(root, 'sonar-project.properties'), 'utf8'), /\*\*\/\*\.spec\.ts/);
});

test('a failed git init refuses before any app file is written', (t) => {
  const into = tempRoot(t);
  const initGit = () => ({ ok: false, stderr: 'git: not found' });
  assert.throws(
    () => scaffoldApp({ name: 'demo', into, edition: 'full', presets: bundledPresets(), lock: lockedOk, initGit }),
    (error) => error.code === 'HFS_SCAFFOLD_GIT_INIT_FAILED' && /git: not found/.test(error.message),
  );
  assert.equal(fs.existsSync(path.join(into, 'demo', 'hfs.json')), false);
});

test('an existing empty unborn main repository is scaffolded without a second git init', (t) => {
  const into = tempRoot(t);
  const root = path.join(into, 'demo');
  fs.mkdirSync(root);
  assert.equal(init(root, { branch: 'main' }).ok, true);
  const initGit = () => assert.fail('an existing repository must not be initialised again');
  scaffoldApp({ name: 'demo', into, edition: 'full', presets: bundledPresets(), lock: lockedOk, initGit });
  assert.ok(fs.existsSync(path.join(root, 'hfs.json')));
});
