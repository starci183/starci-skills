import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkApiSurface, checkApiSurfaceMain } from '../scripts/checks/check-api-surface.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..');
const MIRRORED = ['scripts/kernel/api.mjs', 'modules/kernel/api.yaml', 'bin/starci.mjs'];

const fixtureTree = (edit) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-api-surface-'));
  for (const file of MIRRORED) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, file), target);
  }
  edit?.(root);
  return root;
};

test('the real tree agrees on one verb surface across code, contract and CLI help', () => {
  const report = checkApiSurface(repoRoot);
  assert.deepEqual(report.drift, [], 'verb surface drift');
  assert.equal(report.ok, true);
  assert.ok(report.implemented.includes('estimate'), 'estimate is implemented and must be documented');
  const run = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/checks/check-api-surface.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.match(run.stdout, new RegExp(`${report.implementedCount} verbs`));
});

test('a verb dropped from the contract is reported against api.mjs and exits 1', () => {
  const root = fixtureTree((tree) => {
    const file = path.join(tree, 'modules/kernel/api.yaml');
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /^ {2}estimate:$/m);
    fs.writeFileSync(file, text.replace(/^ {2}estimate:$/m, '  estimate-renamed:'));
  });
  try {
    const result = checkApiSurfaceMain(['--root', root]);
    assert.equal(result.exitCode, 1);
    assert.match(result.text, /modules\/kernel\/api\.yaml: missing estimate/);
    assert.match(result.text, /undocumented-in-code estimate-renamed/);
    const run = spawnSync(process.execPath, [path.join(repoRoot, 'scripts/checks/check-api-surface.mjs'), '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 1, run.stdout + run.stderr);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a verb dropped from usage() or from the starci help line is drift too', () => {
  const root = fixtureTree((tree) => {
    const api = path.join(tree, 'scripts/kernel/api.mjs');
    const text = fs.readFileSync(api, 'utf8');
    assert.match(text, /^ {2}observe\s+--job <job_id> \[--lines <n>\]$/m);
    fs.writeFileSync(api, text.replace(/^ {2}observe(\s+--job <job_id> \[--lines <n>\])$/m, '  observed$1'));
    const bin = path.join(tree, 'bin/starci.mjs');
    fs.writeFileSync(bin, fs.readFileSync(bin, 'utf8').replace('|reconcile|nudge', '|nudge'));
  });
  try {
    const result = checkApiSurfaceMain(['--root', root, '--json']);
    assert.equal(result.exitCode, 1);
    const report = JSON.parse(result.text);
    const usage = report.drift.find((d) => d.source === 'scripts/kernel/api.mjs usage()');
    assert.deepEqual(usage.missing, ['observe']);
    assert.deepEqual(usage.extra, ['observed']);
    const help = report.drift.find((d) => d.source === 'bin/starci.mjs help');
    assert.deepEqual(help.missing, ['reconcile']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('an unreadable or shapeless source is a usage error, not a false pass', () => {
  const root = fixtureTree((tree) => fs.rmSync(path.join(tree, 'bin/starci.mjs')));
  try {
    const result = checkApiSurfaceMain(['--root', root]);
    assert.equal(result.exitCode, 2);
    assert.match(result.text, /unreadable source/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(checkApiSurfaceMain(['--nope']).exitCode, 2);
});
