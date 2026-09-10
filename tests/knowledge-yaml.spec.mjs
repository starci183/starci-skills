import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const skillRoot = path.resolve(import.meta.dirname, '..');
const fixturesRoot = path.join(import.meta.dirname, 'fixtures', 'knowledge-yaml');
const compilerFile = path.join(skillRoot, 'scripts', 'compile-knowledge.mjs');
assert.ok(fs.existsSync(compilerFile), 'Knowledge compiler is required');
const skipReason = false;

function fixtureRoot(name) {
  return path.join(fixturesRoot, name);
}

function isolateFixture(t, name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `starci-ky-${name}-`));
  t.after(() => {
    assert.equal(path.dirname(dir), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('starci-ky-'));
    fs.rmSync(dir, {recursive: true, force: true});
  });
  fs.cpSync(fixtureRoot(name), dir, {recursive: true});
  return dir;
}

async function loadCompile() {
  assert.ok(fs.existsSync(compilerFile), skipReason || 'compiler missing');
  const mod = await import(pathToFileURL(compilerFile).href);
  assert.equal(typeof mod.compileKnowledge, 'function', 'compileKnowledge export is required');
  return mod.compileKnowledge;
}

test('invalid YAML is rejected by the knowledge compiler', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'invalid-yaml');
  assert.throws(
    () => compileKnowledge({root: dir, write: false, check: false}),
    /Invalid or unsupported YAML|invalid|parse|syntax/i,
  );
});

test('duplicate YAML keys are rejected by the knowledge compiler', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'duplicate-keys');
  assert.throws(
    () => compileKnowledge({root: dir, write: false, check: false}),
    /Invalid or unsupported YAML|duplicate|unique|key/i,
  );
});

test('duplicate rule IDs across topics are rejected', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'duplicate-rule-ids');
  assert.throws(
    () => compileKnowledge({root: dir, write: false, check: false}),
    /Duplicate rule id BE-CROSS-DUP-1/,
  );
});

test('missing example file referenced by manifest is rejected', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'missing-example-file');
  assert.throws(
    () => compileKnowledge({root: dir, write: false, check: false}),
    /Missing|not found|does-not-exist|ENOENT|no such file/i,
  );
});

test('path escape via ../ is rejected', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'path-escape');
  assert.throws(
    () => compileKnowledge({root: dir, write: false, check: false}),
    /Unsafe|escape|\.\./i,
  );
});

test('two compiles produce identical bytes', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'valid-minimal');
  const first = compileKnowledge({root: dir, write: false, check: false});
  const second = compileKnowledge({root: dir, write: false, check: false});
  assert.ok(first.files.size > 0, 'compile must emit outputs');
  assert.deepEqual([...first.files.keys()], [...second.files.keys()]);
  for (const [rel, bytes] of first.files) {
    assert.ok(bytes.equals(second.files.get(rel)), `deterministic bytes differ for ${rel}`);
  }
});

test('check mode detects stale output without writing', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'valid-minimal');
  const written = compileKnowledge({root: dir, write: true, check: false});
  assert.equal(written.ok, true);
  assert.deepEqual(compileKnowledge({root: dir, write: false, check: true}).stale, []);

  const targetRel = [...written.files.keys()][0];
  const targetPath = path.join(dir, '.dist', targetRel);
  const original = fs.readFileSync(targetPath);
  fs.writeFileSync(targetPath, Buffer.concat([original, Buffer.from('\n/* stale */\n')]));
  const tampered = fs.readFileSync(targetPath);

  const stale = compileKnowledge({root: dir, write: false, check: true});
  assert.equal(stale.ok, false);
  assert.ok(stale.stale.includes(targetRel), `expected stale entry ${targetRel}, got ${JSON.stringify(stale.stale)}`);
  assert.deepEqual(fs.readFileSync(targetPath), tampered, 'check mode must not rewrite stale files');
});

test('compatibility projection includes schema starci/knowledge@1 title and sections', {skip: skipReason}, async t => {
  const compileKnowledge = await loadCompile();
  const dir = isolateFixture(t, 'valid-minimal');
  const result = compileKnowledge({root: dir, write: false, check: false});
  const sample = result.files.get('knowledge/patterns/be/sample.json');
  assert.ok(sample, 'expected knowledge/patterns/be/sample.json in compile outputs');
  const doc = JSON.parse(sample.toString('utf8'));
  assert.equal(doc.schema, 'starci/knowledge@1');
  assert.equal(typeof doc.title, 'string');
  assert.ok(doc.title.length > 0);
  assert.ok(Array.isArray(doc.sections));
  assert.ok(doc.sections.length > 0);
  for (const section of doc.sections) {
    assert.equal(typeof section.title, 'string');
    assert.ok(Array.isArray(section.blocks));
  }
});
