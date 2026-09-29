import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseYaml } from '../engine/yaml.mjs';
import { checkCanonPins, checkRepoPins, loadPins, PINS_FILE, SCHEMA_FILE } from '../scripts/checks/check-canon-pins.mjs';
import { validateAgainstSchema } from '../scripts/checks/check-op-manifest.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const schema = () => parseYaml(fs.readFileSync(path.join(ROOT, SCHEMA_FILE), 'utf8'));

// A runtime tree with one package and a pins document, so a test can break either.
function runtime(t, mutate = (doc) => doc) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pins-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const doc = structuredClone(loadPins(ROOT));
  mutate(doc);
  fs.mkdirSync(path.join(dir, 'knowledge', 'hfs'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'modules', 'schemas'), { recursive: true });
  fs.copyFileSync(path.join(ROOT, SCHEMA_FILE), path.join(dir, SCHEMA_FILE));
  fs.writeFileSync(path.join(dir, PINS_FILE), JSON.stringify(doc));
  for (const pin of Object.values(doc.pins)) {
    if (!pin.source || fs.existsSync(path.join(dir, pin.source))) continue;
    fs.mkdirSync(path.dirname(path.join(dir, pin.source)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, pin.source), path.join(dir, pin.source));
  }
  return dir;
}

test('the shipped pins document is valid and every @starci pin equals its package in this runtime', () => {
  const result = checkCanonPins({ root: ROOT });
  assert.deepEqual(result.errors, []);
  assert.ok(result.pins >= 30);
});

test('the brief\'s dependencies are all pinned, one version each', () => {
  const pins = loadPins(ROOT).pins;
  for (const name of ['@starci/grammar', '@starci/eslint-canon-be', '@starci/eslint-canon-fe', '@starci/tsconfig', '@starci/prettier-config',
    'jest', 'vitest', '@playwright/test', 'next', '@nestjs/core', '@heroui/react', 'prettier', 'typescript']) {
    assert.ok(pins[name], `${name} is pinned`);
  }
});

test('a range, a tag or a wildcard is not a pin', (t) => {
  for (const bad of ['^5.9.3', '~5.9.3', '>=5', 'latest', '5.x', '5.9', '']) {
    const dir = runtime(t, (doc) => { doc.pins.typescript.version = bad; });
    const result = checkCanonPins({ root: dir });
    assert.equal(result.ok, false, `"${bad}" must be refused`);
    assert.match(result.errors.join('\n'), /CANON_PINS_INVALID .*typescript\.version/);
  }
});

test('a missing required pin, an unknown key and an unknown group are refused', (t) => {
  const missing = checkCanonPins({ root: runtime(t, (doc) => { delete doc.pins.jest; }) });
  assert.match(missing.errors.join('\n'), /missing jest/);
  const unknownKey = checkCanonPins({ root: runtime(t, (doc) => { doc.pins.next.range = '^16'; }) });
  assert.match(unknownKey.errors.join('\n'), /pins\.next\.range: unknown key/);
  const group = checkCanonPins({ root: runtime(t, (doc) => { doc.pins.next.group = 'misc'; }) });
  assert.match(group.errors.join('\n'), /pins\.next\.group/);
});

test('a @starci pin that differs from its package, or names no source, is refused', (t) => {
  const drift = checkCanonPins({ root: runtime(t, (doc) => { doc.pins['@starci/tsconfig'].version = '1.0.1'; }) });
  assert.match(drift.errors.join('\n'), /CANON_PIN_SOURCE @starci\/tsconfig: pinned 1\.0\.1 but packages\/tsconfig\/package\.json is 1\.0\.0/);
  const noSource = checkCanonPins({ root: runtime(t, (doc) => { delete doc.pins['@starci/grammar'].source; }) });
  assert.match(noSource.errors.join('\n'), /CANON_PIN_NO_SOURCE @starci\/grammar/);
  const registrySource = checkCanonPins({ root: runtime(t, (doc) => { doc.pins.jest.source = 'packages/tsconfig/package.json'; }) });
  assert.match(registrySource.errors.join('\n'), /CANON_PIN_NO_SOURCE jest: only a starci pin carries a source/);
});

test('the schema itself accepts a minimal valid document and pins the required names', () => {
  const doc = loadPins(ROOT);
  assert.deepEqual(validateAgainstSchema(doc, schema()), []);
  assert.ok(schema().properties.pins.required.includes('@heroui/react'));
});

test('checkRepoPins judges a repository: registry pins by declared spec, @starci pins by the linked copy', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pins-repo-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({
    devDependencies: { typescript: '^5.7.3', jest: '29.7.0', vitest: '3.2.7', '@starci/tsconfig': 'file:.starci/packages/tsconfig' },
  }));
  const before = checkRepoPins({ repo, side: 'be', root: ROOT });
  assert.equal(before.ok, false);
  assert.match(before.errors.join('\n'), /typescript: declared \^5\.7\.3, pinned 5\.9\.3/);
  assert.match(before.errors.join('\n'), /@starci\/tsconfig: pinned 1\.0\.0, linked copy is missing/);
  assert.doesNotMatch(before.errors.join('\n'), /vitest/, 'a front-end pin is not judged on a back-end repository');
  assert.doesNotMatch(before.errors.join('\n'), /jest:/, 'an exact declared pin passes');
  fs.mkdirSync(path.join(repo, '.starci', 'packages', 'tsconfig'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starci', 'packages', 'tsconfig', 'package.json'), JSON.stringify({ version: '1.0.0' }));
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ devDependencies: { typescript: '5.9.3', '@starci/tsconfig': 'file:.starci/packages/tsconfig' } }));
  assert.deepEqual(checkRepoPins({ repo, side: 'be', root: ROOT }).errors, []);
});

test('the checker CLI exits 0 on the shipped pins and 1 with a code on a broken tree', (t) => {
  const script = path.join(ROOT, 'scripts', 'checks', 'check-canon-pins.mjs');
  assert.equal(spawnSync(process.execPath, [script], { encoding: 'utf8' }).status, 0);
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-pins-cli-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true }));
  fs.writeFileSync(path.join(repo, 'package.json'), JSON.stringify({ devDependencies: { react: '^19' } }));
  const drift = spawnSync(process.execPath, [script, '--repo', repo], { encoding: 'utf8' });
  assert.equal(drift.status, 1);
  assert.match(drift.stderr, /CANON_PIN_DRIFT react: declared \^19, pinned 19\.2\.3/);
});
