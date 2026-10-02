import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkHfsWithoutConfig } from '../../scripts/hfs/architecture/hfs.mjs';
import { appDeclarationText, DEFAULT_APPS } from '../helpers/hfs-arch-fixture.mjs';

// core.hooksPath is judged at the app root (checkAppRoot, reached through checkHfsWithoutConfig on a kind: app hfs.json).

const RULE = 'HFS_HOOKS_PATH_REDIRECTED';
const git = (root, ...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const repo = t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-hooks-path-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, 'init', '-q');
  fs.mkdirSync(path.join(root, '.husky'), { recursive: true });
  fs.writeFileSync(path.join(root, '.husky', 'pre-push'), 'npm run lint\n');
  fs.writeFileSync(path.join(root, 'hfs.json'), appDeclarationText('fe', { apps: DEFAULT_APPS.fe }));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', private: true }));
  return root;
};
const findings = root => checkHfsWithoutConfig(root).violations.filter(item => item.ruleId === RULE);

test('a clone with no core.hooksPath is clean', t => {
  assert.deepEqual(findings(repo(t)), []);
});

test('the husky directories are the only values a clone may set', t => {
  for (const value of ['.husky', '.husky/_', '.husky/']) {
    const root = repo(t);
    git(root, 'config', '--local', 'core.hooksPath', value);
    assert.deepEqual(findings(root), [], value);
  }
});

test('a hooks path that points anywhere else is refused and named', t => {
  for (const value of ['.git/no-hooks', path.join(os.tmpdir(), 'elsewhere', 'hooks'), '.husky-skip', 'hooks']) {
    const root = repo(t);
    git(root, 'config', '--local', 'core.hooksPath', value);
    const found = findings(root);
    assert.equal(found.length, 1, value);
    assert.equal(found[0].path, '.git/config');
    assert.ok(found[0].message.includes(value), `the message names ${value}`);
  }
});

test('a directory that is not a Git work tree has nothing to redirect', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hk-hooks-path-nogit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(findings(root), []);
});
