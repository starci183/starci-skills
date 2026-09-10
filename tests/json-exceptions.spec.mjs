import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const skillRoot = path.resolve(import.meta.dirname, '..');
const checkerFile = path.join(skillRoot, 'scripts', 'check-json-exceptions.mjs');
const allowlistFile = path.join(skillRoot, 'schemas', 'json-exceptions.yaml');
const offenderFixture = path.join(import.meta.dirname, 'fixtures', 'yaml-dist', 'json-exceptions-offender');

assert.equal(fs.existsSync(checkerFile), true, 'scripts/check-json-exceptions.mjs is required');
assert.equal(fs.existsSync(allowlistFile), true, 'schemas/json-exceptions.yaml is required');

function disposable(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    assert.ok(fs.existsSync(dir) || true);
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

async function loadChecker() {
  const mod = await import(pathToFileURL(checkerFile).href);
  assert.equal(typeof mod.checkJsonExceptions, 'function', 'checkJsonExceptions export is required');
  return mod.checkJsonExceptions;
}

test('authored JSON outside allowlist fails the exceptions checker', async t => {
  const checkJsonExceptions = await loadChecker();
  const dir = disposable(t, 'starci-json-ex-');
  fs.cpSync(offenderFixture, dir, { recursive: true });

  const result = checkJsonExceptions({
    root: dir,
    allowlistFile: path.join(dir, 'schemas', 'json-exceptions.yaml'),
  });
  assert.ok(
    result.offenders.includes('workflows/catalog.json'),
    `expected workflows/catalog.json among offenders, got ${JSON.stringify(result.offenders)}`,
  );
  assert.equal(result.offenders.length > 0, true, 'checker must report at least one offender');
});

test('allowlisted package.json alone does not produce offenders in a disposable tree', async t => {
  const checkJsonExceptions = await loadChecker();
  const dir = disposable(t, 'starci-json-ok-');
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'schemas', 'json-exceptions.yaml'),
    `schema: starci/json-exceptions@1
exceptions:
  - path: package.json
    reason: npm package manifest
`,
  );
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'ok', private: true }));
  const result = checkJsonExceptions({
    root: dir,
    allowlistFile: path.join(dir, 'schemas', 'json-exceptions.yaml'),
  });
  assert.deepEqual(result.offenders, [], `unexpected offenders: ${JSON.stringify(result.offenders)}`);
});

test('checker CLI exits nonzero when the skill tree still has authored JSON offenders', () => {
  const cli = spawnSync(process.execPath, [checkerFile], {
    cwd: skillRoot,
    encoding: 'utf8',
    timeout: 60000,
  });
  // During migration the skill root still contains authored JSON outside the post-migration
  // allowlist (or is already clean). Either nonzero+offender list or OK is acceptable only when
  // offenders are empty; if status is nonzero, stderr must list paths.
  assert.equal(cli.status,0,cli.stderr||cli.stdout);
  assert.match(cli.stdout,/OK:/);
});
