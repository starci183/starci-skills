import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const skillRoot = path.resolve(import.meta.dirname, '..');
const checkerFile = path.join(skillRoot, 'scripts', 'checks', 'check-json-exceptions.mjs');
const allowlistFile = path.join(skillRoot, 'schemas', 'json-exceptions.yaml');
const offenderFixture = path.join(import.meta.dirname, 'fixtures', 'yaml-dist', 'json-exceptions-offender');

assert.equal(fs.existsSync(checkerFile), true, 'scripts/checks/check-json-exceptions.mjs is required');
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

test('root-local runtime JSON is excluded without hiding authored JSON or nested lookalikes', async t => {
  const checkJsonExceptions = await loadChecker();
  const dir = disposable(t, 'starci-json-local-');
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'schemas', 'json-exceptions.yaml'),
    'schema: starci/json-exceptions@1\nexceptions: []\n',
  );
  const localFiles = [
    '.starciwork/_local/workflows/wf/state.json',
    'runtime/engine/builds/digest/runtime-pin.json',
    'settings.local.json',
  ];
  const authoredFiles = [
    'packages/app/.starciwork/state.json',
    'packages/app/runtime/runtime-pin.json',
    'packages/app/settings.local.json',
    'unexpected.json',
  ];
  for (const relative of [...localFiles, ...authoredFiles]) {
    const file = path.join(dir, ...relative.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, '{}\n');
  }

  const result = checkJsonExceptions({
    root: dir,
    allowlistFile: path.join(dir, 'schemas', 'json-exceptions.yaml'),
  });
  assert.deepEqual(result.offenders, authoredFiles, 'only exact root-local storage is excluded');
  assert.equal(result.ok, false, 'unexpected authored JSON still fails the checker');
  for (const relative of localFiles) {
    assert.equal(fs.existsSync(path.join(dir, ...relative.split('/'))), true, `${relative} is preserved`);
  }
});

test('a missing allowlisted authored source still fails the checker', async t => {
  const checkJsonExceptions = await loadChecker();
  const dir = disposable(t, 'starci-json-missing-');
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'schemas', 'json-exceptions.yaml'),
    `schema: starci/json-exceptions@1
exceptions:
  - path: package.json
    reason: npm package manifest
`,
  );
  const result = checkJsonExceptions({
    root: dir,
    allowlistFile: path.join(dir, 'schemas', 'json-exceptions.yaml'),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(result.offenders, []);
  assert.deepEqual(result.missingAllowlist, ['package.json']);
});

test('checker CLI succeeds only when the installed authored source is clean', () => {
  const cli = spawnSync(process.execPath, [checkerFile], {
    cwd: skillRoot,
    encoding: 'utf8',
    timeout: 60000,
  });
  // Root-local workflow state, sealed packets and settings are not authored source. Everything
  // that remains in the authored inventory must be declared before this installed tree is clean.
  assert.equal(cli.status,0,cli.stderr||cli.stdout);
  assert.match(cli.stdout,/OK:/);
});
