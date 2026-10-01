import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { checkApiSurface, checkApiSurfaceMain } from '../../scripts/checks/check-api-surface.mjs';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1')), '..', '..');
const MIRRORED = ['scripts/kernel/cli.mjs', 'modules/kernel/api.yaml', 'bin/starci.mjs'];
// Extension verbs and their contracts live in directories (scripts/kernel/api-extensions.mjs): the
// fixture mirrors them too or the copied cli.mjs switch is not the whole implemented surface.
const MIRRORED_DIRS = ['scripts/kernel/verbs', 'modules/kernel/api-commands'];

const fixtureTree = (edit) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-api-surface-'));
  for (const file of MIRRORED) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repoRoot, file), target);
  }
  for (const dir of MIRRORED_DIRS) {
    const source = path.join(repoRoot, dir);
    if (!fs.existsSync(source)) continue;
    fs.cpSync(source, path.join(root, dir), { recursive: true });
  }
  try { edit?.(root); } catch (error) { fs.rmSync(root, { recursive: true, force: true }); throw error; }
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

test('a verb dropped from the contract is reported against cli.mjs and exits 1', () => {
  const root = fixtureTree((tree) => {
    // Every verb's contract is its own file under modules/kernel/api-commands (api.yaml keeps `commands: {}`).
    const file = path.join(tree, 'modules/kernel/api-commands/estimate.yaml');
    const text = fs.readFileSync(file, 'utf8');
    assert.match(text, /^estimate:$/m);
    fs.writeFileSync(path.join(tree, 'modules/kernel/api-commands/estimate-renamed.yaml'), text.replace(/^estimate:$/m, 'estimate-renamed:'));
    fs.rmSync(file);
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
    const api = path.join(tree, 'scripts/kernel/cli.mjs');
    const text = fs.readFileSync(api, 'utf8');
    assert.match(text, /^ {2}observe\s+--job <job_id> \[--lines <n>\]$/m);
    fs.writeFileSync(api, text.replace(/^ {2}observe(\s+--job <job_id> \[--lines <n>\])$/m, '  observed$1'));
    const bin = path.join(tree, 'bin/starci.mjs');
    // An extension verb is listed on the help line by its api-verbs file, so a verb the help names that no code
    // implements is the help-line drift.
    fs.writeFileSync(bin, fs.readFileSync(bin, 'utf8').replace('|reconcile|nudge', '|reconcile|ghost|nudge'));
  });
  try {
    const result = checkApiSurfaceMain(['--root', root, '--json']);
    assert.equal(result.exitCode, 1);
    const report = JSON.parse(result.text);
    const usage = report.drift.find((d) => d.source === 'scripts/kernel/cli.mjs usage()');
    assert.deepEqual(usage.missing, ['observe']);
    assert.deepEqual(usage.extra, ['observed']);
    const help = report.drift.find((d) => d.source === 'bin/starci.mjs help');
    assert.deepEqual(help.extra, ['ghost']);
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
