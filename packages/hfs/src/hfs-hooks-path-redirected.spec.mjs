// proves: HFS_HOOKS_PATH_REDIRECTED@lite
// proves: HFS_HOOKS_PATH_REDIRECTED@full
// proves: HFS_HOOKS_NOT_INSTALLED@lite
// proves: HFS_HOOKS_NOT_INSTALLED@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openHfs } from '../runtime/scripts/hfs/slots.mjs';
import { checkHfsWithoutConfig } from '../runtime/scripts/hfs/architecture/hfs.mjs';

const CODE = 'HFS_HOOKS_PATH_REDIRECTED';
const git = (root, ...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe', encoding: 'utf8' });

function fixture(t, edition) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-proof-hooks-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const declaration = { hfs: 3, kind: 'app', project: 'proof', edition, sides: { be: { apps: [{ name: 'api', kind: 'api' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } } };
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify(declaration));
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ private: true }));
  assert.equal(openHfs({ repoRoot: root }).repo.edition, edition);
  git(root, 'init', '-q');
  git(root, 'add', 'hfs.json', 'package.json');
  return root;
}

const findings = (root) => checkHfsWithoutConfig(root).violations.filter((finding) => finding.ruleId === CODE);

for (const edition of ['lite', 'full']) {
  test(`${CODE}@${edition}: a redirected clone reports its actual config and accepts the husky path`, (t) => {
    const root = fixture(t, edition);
    git(root, 'config', '--local', 'core.hooksPath', '.git/disabled-hooks');
    const found = findings(root);
    assert.equal(found.length, 1);
    assert.equal(found[0].path, '.git/config');
    assert.match(found[0].message, /\.git\/disabled-hooks/);
    git(root, 'config', '--local', 'core.hooksPath', '.husky/_');
    assert.deepEqual(findings(root), []);
    git(root, 'config', '--local', '--unset', 'core.hooksPath');
    assert.deepEqual(findings(root), []);
  });
}

const NOT_INSTALLED = 'HFS_HOOKS_NOT_INSTALLED';
const installFindings = (root) => checkHfsWithoutConfig(root).violations.filter((finding) => finding.ruleId === NOT_INSTALLED);

for (const edition of ['lite', 'full']) {
  test(`${NOT_INSTALLED}@${edition}: a husky path without installed hooks is a violation and an installed folder is a valid pass`, (t) => {
    const root = fixture(t, edition);
    assert.deepEqual(installFindings(root), [], 'an unset core.hooksPath is not judged');
    git(root, 'config', '--local', 'core.hooksPath', '.husky/_');
    const missing = installFindings(root);
    assert.equal(missing.length, 1);
    assert.match(missing[0].message, /does not exist/);
    fs.mkdirSync(path.join(root, '.husky', '_'), { recursive: true });
    fs.writeFileSync(path.join(root, '.husky', '_', 'pre-commit'), '#!/bin/sh\n');
    assert.match(installFindings(root)[0]?.message ?? '', /holds no installed hook/);
    fs.writeFileSync(path.join(root, '.husky', '_', 'h'), '#!/usr/bin/env sh\n');
    assert.deepEqual(installFindings(root), []);
  });
}
