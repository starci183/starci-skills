import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { osTempDir, tempRoot, TEMP_ROOT_ENV } from '../../engine/temp-root.mjs';
import { makeTempDir } from '../../scripts/api/fs/make-temp-dir.mjs';
import { tempPath } from '../../scripts/api/fs/temp-path.mjs';
import { ensureTempRoot } from '../../scripts/api/fs/ensure-temp-root.mjs';
import { withTempEnv } from '../../scripts/api/fs/with-temp-env.mjs';
import { validateConfig } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';

// The one temp root: env STARCI_TEMP_ROOT, then config.yaml roots.temp, else the OS temp directory.
const ABS = (name) => path.resolve(os.tmpdir(), `starci-temp-root-spec-${name}`);
const EXAMPLE = () => parseYaml(fs.readFileSync(new URL('../../config.example.yaml', import.meta.url), 'utf8'));

test('tempRoot: the environment wins over config.yaml roots.temp, which wins over the OS temp directory', () => {
  const env = { TEMP: ABS('os'), [TEMP_ROOT_ENV]: ABS('env') };
  const config = { roots: { temp: ABS('config') } };
  assert.equal(tempRoot({ env, config }), ABS('env'));
  assert.equal(tempRoot({ env: { TEMP: ABS('os') }, config }), ABS('config'));
  assert.equal(tempRoot({ env: { TEMP: ABS('os') }, config: null }), ABS('os'));
  assert.equal(tempRoot({ env: { TEMP: ABS('os') }, config: { roots: { temp: null } } }), ABS('os'), 'a null key is unset');
  assert.equal(tempRoot({ env: { [TEMP_ROOT_ENV]: '', TEMP: ABS('os') }, config: null }), ABS('os'), 'an empty variable is unset');
});

test('osTempDir follows TEMP, then TMP, then TMPDIR, then os.tmpdir()', () => {
  assert.equal(osTempDir({ TEMP: ABS('a'), TMP: ABS('b'), TMPDIR: ABS('c') }), ABS('a'));
  assert.equal(osTempDir({ TMP: ABS('b'), TMPDIR: ABS('c') }), ABS('b'));
  assert.equal(osTempDir({ TMPDIR: ABS('c') }), ABS('c'));
  assert.equal(osTempDir({}), path.resolve(os.tmpdir()));
});

test('makeTempDir creates the missing root and places the entry in it', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-temp-root-spec-make-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'not', 'made', 'yet');
  const dir = makeTempDir('starci-spec-', { env: { [TEMP_ROOT_ENV]: root } });
  assert.equal(path.dirname(dir), root);
  assert.equal(fs.statSync(dir).isDirectory(), true);
  assert.match(path.basename(dir), /^starci-spec-/);
  const other = makeTempDir('x-', { parent: path.join(base, 'parent') });
  assert.equal(path.dirname(other), path.join(base, 'parent'));
});

test('tempPath reads the process environment: a file path under the temp root whose directory exists', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-temp-root-spec-path-'));
  const previous = process.env[TEMP_ROOT_ENV];
  t.after(() => {
    if (previous === undefined) delete process.env[TEMP_ROOT_ENV]; else process.env[TEMP_ROOT_ENV] = previous;
    fs.rmSync(base, { recursive: true, force: true });
  });
  const root = path.join(base, 'fresh');
  process.env[TEMP_ROOT_ENV] = root;
  assert.equal(tempPath('a.index'), path.join(root, 'a.index'));
  assert.equal(fs.existsSync(root), true);
});

test('ensureTempRoot makes the configured root and answers it', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-temp-root-spec-ensure-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'a', 'b');
  assert.equal(ensureTempRoot({ env: { [TEMP_ROOT_ENV]: root } }), path.resolve(root));
  assert.equal(fs.statSync(root).isDirectory(), true);
});

test('a root that cannot be created or written is refused with TEMP_ROOT_UNUSABLE, never replaced by the OS directory', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-temp-root-spec-refuse-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const file = path.join(base, 'a-file');
  fs.writeFileSync(file, 'x');
  for (const root of [file, path.join(file, 'below')]) {
    const env = { [TEMP_ROOT_ENV]: root, TEMP: os.tmpdir() };
    assert.throws(() => ensureTempRoot({ env }), (error) => error.code === 'TEMP_ROOT_UNUSABLE' && error.message.includes('roots.temp') && error.message.includes(path.resolve(root)));
    assert.throws(() => makeTempDir('x-', { env }), { code: 'TEMP_ROOT_UNUSABLE' });
    assert.throws(() => withTempEnv({ env }), { code: 'TEMP_ROOT_UNUSABLE' });
  }
});

test('config.yaml accepts roots.temp as an absolute directory and refuses anything else', () => {
  const base = EXAMPLE();
  assert.doesNotThrow(() => validateConfig({ ...base, roots: { temp: ABS('ok') } }));
  assert.doesNotThrow(() => validateConfig({ ...base, roots: { temp: null } }));
  assert.throws(() => validateConfig({ ...base, roots: { temp: 'relative/dir' } }), /roots\.temp must be an absolute directory path or null/);
  assert.throws(() => validateConfig({ ...base, roots: { tmp: ABS('x') } }), /roots has unknown key tmp \(allowed: archive, lanes, temp\)/);
});

test('config.yaml validates the resources floors: positive numbers or null, percentages at most 100, no unknown key', () => {
  const base = EXAMPLE();
  assert.doesNotThrow(() => validateConfig({ ...base, resources: { minFreeDiskGb: 5, minFreeDiskPct: 1, minFreeRamPct: 10 } }));
  assert.doesNotThrow(() => validateConfig({ ...base, resources: null }));
  assert.doesNotThrow(() => validateConfig({ ...base, resources: { minFreeDiskGb: null } }));
  for (const [resources, message] of [
    [{ minFreeDiskGb: 0 }, /resources\.minFreeDiskGb must be a number above 0/],
    [{ minFreeDiskGb: '5' }, /resources\.minFreeDiskGb/],
    [{ minFreeDiskPct: 100.5 }, /resources\.minFreeDiskPct must be a number above 0 and at most 100/],
    [{ minFreeRamPct: -1 }, /resources\.minFreeRamPct/],
    [{ free: 5 }, /resources has unknown key free \(allowed: minFreeDiskGb, minFreeDiskPct, minFreeRamPct\)/],
    [[], /resources must be \{minFreeDiskGb\?, minFreeDiskPct\?, minFreeRamPct\?\} or null/],
  ]) assert.throws(() => validateConfig({ ...base, resources }), message);
});

test('the shipped example config sets neither roots.temp nor resources: the policy file owns the defaults', () => {
  const example = EXAMPLE();
  assert.equal(example.roots?.temp ?? null, null);
  assert.equal(example.resources ?? null, null);
});

test('the suite preload roots a spec process in STARCI_TEMP_ROOT and never reads config.yaml', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-temp-root-spec-preload-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const preload = new URL('../setup/isolated-temp.mjs', import.meta.url).href;
  const env = { ...process.env, [TEMP_ROOT_ENV]: base };
  delete env.STARCI_TEST_TEMP_DIR;
  const script = 'const os=require("os");console.log(JSON.stringify({root:process.env.STARCI_TEMP_ROOT,temp:process.env.TEMP,tmp:process.env.TMP,tmpdir:process.env.TMPDIR,os:os.tmpdir()}))';
  const r = spawnSync(process.execPath, ['--import', preload, '-e', script], { encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  const seen = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(path.dirname(seen.root), fs.realpathSync.native(base), 'the per-run root is created inside STARCI_TEMP_ROOT');
  assert.match(path.basename(seen.root), /^starci-test-tmp-/);
  assert.deepEqual([seen.temp, seen.tmp, seen.tmpdir, path.resolve(seen.os)], [seen.root, seen.root, seen.root, seen.root]);
  assert.deepEqual(fs.readdirSync(base), [], 'the root is removed when the process ends');
});
