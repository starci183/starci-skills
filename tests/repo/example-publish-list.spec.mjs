// example-publish-list.spec.mjs - what `npm pack` ships of examples/: every tracked example file except the declared private or generated ones, and no sealed credential.
// npm reads the nearest ignore file in a folder instead of the root `files` negations, and every example app has a .gitignore, so each app carries a .npmignore naming the credential folders (.starcistacks/<env>/secrets):
// this spec holds the tarball free of them and complete otherwise.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..', '..');
const run = (command, args) => spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
const NOT_SHIPPED = (file) => /(^|\/)\.(git|npm)ignore$/.test(file) || file.includes('/.starciwork/') || file.startsWith('examples/.runtimes/') || /\/\.starcistacks\/[^/]+\/secrets\//.test(file);

test('npm pack ships every tracked example file except the private, generated and ignore files, and no sealed credential', () => {
  const tracked = run('git', ['ls-files', 'examples']);
  assert.equal(tracked.status, 0, tracked.stderr);
  const files = tracked.stdout.split(/\r?\n/).filter(Boolean);
  const local = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  const cli = process.env.npm_execpath ?? (fs.existsSync(local) ? local : null);
  const args = ['pack', '--dry-run', '--json', '--ignore-scripts'];
  const packed = cli ? run(process.execPath, [cli, ...args]) : run('npm', args);
  assert.equal(packed.status, 0, packed.stderr);
  const shipped = new Set(JSON.parse(packed.stdout)[0].files.map((file) => file.path));
  assert.deepEqual([...shipped].filter((file) => /^examples\/.*\/secrets\//.test(file)), [], 'no example credential folder ships');
  assert.deepEqual(files.filter((file) => !NOT_SHIPPED(file) && !shipped.has(file)), [], 'every tracked example file the package should carry is listed in `files`');
});
