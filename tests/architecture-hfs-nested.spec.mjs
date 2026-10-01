import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfsWithoutConfig } from '../scripts/checks/architecture/hfs.mjs';
import { appDeclarationText, DEFAULT_APPS } from './_hfs-arch-fixture.mjs';

// The hooks path and the root entries are the app root's (checkAppRoot, reached through checkHfsWithoutConfig on a root whose
// hfs.json declares kind: app). An app nested in another clone (an example under the runtime clone) is a directory of that
// clone, not a work tree of its own: HFS_HOOKS_PATH_REDIRECTED is not applicable there (the clone's hooks are not the directory's) and the root-entry
// check lists only the paths under the given root. No option, no environment variable, no allowlist decides this.

const git = (root, ...args) => execFileSync('git', ['-c', 'user.name=fixture', '-c', 'user.email=fixture@example.test', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const write = (root, relative, text = 'x\n') => {
  const target = path.join(root, ...relative.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
};

/** A clone holding a stray root file and an app at `nested/` (or the clone itself when `at` is empty) with one forbidden entry. */
function clone(t, at) {
  const top = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-nested-'));
  t.after(() => fs.rmSync(top, { recursive: true, force: true }));
  git(top, 'init', '-q');
  const root = at ? path.join(top, at) : top;
  write(top, 'stray.txt');
  write(root, 'hfs.json', appDeclarationText('be', { apps: DEFAULT_APPS.be }));
  write(root, 'package.json', JSON.stringify({ name: 'fixture', private: true }));
  write(root, 'forbidden-entry.txt');
  write(root, '.husky/pre-push', 'npm run lint\n');
  git(top, 'config', '--local', 'core.hooksPath', '.git/no-hooks');
  git(top, 'add', '-A');
  return { top, root };
}

const judge = root => checkHfsWithoutConfig(root);
const at = (report, ruleId) => report.violations.filter(item => item.ruleId === ruleId).map(item => item.path).sort();

test('a clone whose root is its Git top level judges its hooks path and its root entries', t => {
  const { root } = clone(t, '');
  const report = judge(root);
  assert.deepEqual(at(report, 'HFS_HOOKS_PATH_REDIRECTED'), ['.git/config']);
  assert.equal(report.coverage.hooksPath.status, 'checked');
  assert.ok(at(report, 'HFS_ROOT_ENTRY_FORBIDDEN').includes('forbidden-entry.txt'));
  assert.ok(at(report, 'HFS_ROOT_ENTRY_FORBIDDEN').includes('stray.txt'));
});

test('a directory of a clone has no hooks of its own: hooks path is not-applicable and the clone hooksPath is not reported', t => {
  const { root } = clone(t, 'nested');
  const report = judge(root);
  assert.deepEqual(at(report, 'HFS_HOOKS_PATH_REDIRECTED'), []);
  assert.equal(report.coverage.hooksPath.status, 'not-applicable');
  assert.match(report.coverage.hooksPath.reason, /top level/);
});

test('the root-entry check lists only the paths under the given root, never the enclosing clone', t => {
  const { root } = clone(t, 'nested');
  const forbidden = at(judge(root), 'HFS_ROOT_ENTRY_FORBIDDEN');
  assert.ok(forbidden.includes('forbidden-entry.txt'));
  assert.ok(!forbidden.includes('stray.txt'));
  assert.ok(!forbidden.includes('nested'));
});

test('a directory outside any work tree is not-applicable for hooks too', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-nogit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'hfs.json', appDeclarationText('be', { apps: DEFAULT_APPS.be }));
  write(root, 'package.json', JSON.stringify({ name: 'fixture', private: true }));
  const report = judge(root);
  assert.deepEqual(at(report, 'HFS_HOOKS_PATH_REDIRECTED'), []);
  assert.equal(report.coverage.hooksPath.status, 'not-applicable');
});
