// The .claude/node_modules wipe (2026-09-28): npm reifies through a linked node_modules and empties its target, and
// no delete may ever resolve outside the tree it removes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { linkedNodeModulesOf, classifyInstall } from '../../scripts/guards/deps-guard.mjs';
import { safeRemoveTree } from '../../scripts/api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../../scripts/machine/artifact-hold.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nm-link-'));
const link = (target, at) => fs.symlinkSync(target, at, process.platform === 'win32' ? 'junction' : 'dir');

test('an install in a checkout whose node_modules is a link is detected, a real node_modules is not', () => {
  const base = tmp();
  try {
    const live = path.join(base, 'live', 'node_modules'); fs.mkdirSync(path.join(live, 'dep'), { recursive: true });
    const scratch = path.join(base, 'scratch'); fs.mkdirSync(path.join(scratch, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(scratch, 'package.json'), '{}');
    link(live, path.join(scratch, 'node_modules'));
    const hit = linkedNodeModulesOf('npm', ['ci'], path.join(scratch, 'sub'));
    assert.ok(hit, 'the nearest package root holds a linked node_modules');
    assert.equal(path.resolve(hit.target).toLowerCase(), fs.realpathSync.native(live).toLowerCase());
    assert.ok(linkedNodeModulesOf('npm', ['install', '--prefix', scratch], base));
    const own = path.join(base, 'own'); fs.mkdirSync(path.join(own, 'node_modules'), { recursive: true }); fs.writeFileSync(path.join(own, 'package.json'), '{}');
    assert.equal(linkedNodeModulesOf('npm', ['ci'], own), null);
    assert.equal(classifyInstall('npm', ['ci']).kind, 'clean-install');
    fs.unlinkSync(path.join(scratch, 'node_modules'));
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});

test('safeRemoveTree removes a tree holding a node_modules junction and leaves the target whole', () => {
  const base = tmp();
  try {
    const live = path.join(base, 'live-nm'); fs.mkdirSync(path.join(live, 'ajv'), { recursive: true }); fs.writeFileSync(path.join(live, 'ajv', 'index.js'), 'x');
    const tree = path.join(base, 'scratch'); fs.mkdirSync(path.join(tree, 'a'), { recursive: true }); fs.writeFileSync(path.join(tree, 'a', 'f.txt'), 'y');
    link(live, path.join(tree, 'node_modules'));
    const r = safeRemoveTree(tree, { hold: artifactHoldReason });
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.removed.links, 1);
    assert.equal(fs.readFileSync(path.join(live, 'ajv', 'index.js'), 'utf8'), 'x', 'the junction target is untouched');
  } finally { fs.rmSync(base, { recursive: true, force: true }); }
});
