import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { compileKnowledge } from '../scripts/compile-knowledge.mjs';

const runtime = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function temp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-knowledge-'));
  t.after(() => {
    assert.equal(path.dirname(dir), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('starci-knowledge-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return dir;
}

function skillFixture(t, { withSchemas = true } = {}) {
  const dir = temp(t);
  fs.mkdirSync(path.join(dir, 'knowledge'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'core'), { recursive: true });
  if (withSchemas) {
    fs.cpSync(path.join(runtime, 'schemas'), path.join(dir, 'schemas'), { recursive: true });
  }
  fs.cpSync(path.join(runtime, 'core/yaml.mjs'), path.join(dir, 'core/yaml.mjs'));
  fs.cpSync(path.join(runtime, 'scripts/compile-knowledge.mjs'), path.join(dir, 'scripts/compile-knowledge.mjs'));
  fs.cpSync(path.join(runtime, 'scripts/knowledge-compile'), path.join(dir, 'scripts/knowledge-compile'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ type: 'module' }));
  return dir;
}

function write(dir, relative, body) {
  const file = path.join(dir, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
}

const topicYaml = ({ id = 'demo.topic', ruleId = 'DEMO-1', relatedRules = [], relatedExamples = [] } = {}) => `schema: starci/knowledge-source@1
id: ${id}
title: Demo
purpose: |
  Demo purpose.
appliesTo: [backend]
rules:
  - id: ${ruleId}
    title: Demo rule
    kind: mandatory
    requirement: |
      Must hold.
    relatedRules: [${relatedRules.map(x => JSON.stringify(x)).join(', ')}]
    relatedExamples: [${relatedExamples.map(x => JSON.stringify(x)).join(', ')}]
`;

test('safe YAML rejects duplicate keys and aliases during knowledge compile', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/bad.yaml', 'schema: starci/knowledge-source@1\nid: one\nid: two\ntitle: X\npurpose: p\nappliesTo: [backend]\n');
  assert.throws(() => compileKnowledge({ root: dir, write: false, check: false }), /Invalid or unsupported YAML|duplicate/i);

  const dir2 = skillFixture(t);
  write(dir2, 'knowledge/alias.yaml', 'schema: starci/knowledge-source@1\nid: demo\ntitle: X\npurpose: p\nappliesTo: [backend]\nrules: &x []\nmore: *x\n');
  assert.throws(() => compileKnowledge({ root: dir2, write: false, check: false }));
});

test('unknown root fields and retired JSON knowledge fail closed', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/a.yaml', topicYaml() + 'rulse: []\n');
  assert.throws(() => compileKnowledge({ root: dir, write: false }), /Unknown field rulse/);
  const other = skillFixture(t);
  write(other, 'knowledge/legacy.json', '{}');
  assert.throws(() => compileKnowledge({ root: other, write: false }), /Authored JSON knowledge is retired/);
});

test('duplicate rule ids are rejected', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/a.yaml', topicYaml({ id: 'a', ruleId: 'SAME-1' }));
  write(dir, 'knowledge/b.yaml', topicYaml({ id: 'b', ruleId: 'SAME-1' }));
  assert.throws(() => compileKnowledge({ root: dir, write: false, check: false }), /Duplicate rule id SAME-1/);
});

test('missing rule refs are rejected', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/a.yaml', topicYaml({ id: 'a', ruleId: 'A-1', relatedRules: ['MISSING-RULE'] }));
  assert.throws(() => compileKnowledge({ root: dir, write: false, check: false }), /Missing rule ref MISSING-RULE/);
});

test('path escapes in example manifests are rejected', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/code-examples/backend/escape/index.yaml', `schema: starci/code-example@1
id: escape-demo
title: Escape
purpose: |
  demo
appliesTo: [backend]
relatedRules: []
files:
  - path: ../secret.ts
    role: bad
entrypoint: ../secret.ts
adapt:
  - replace names
dependencies:
  packages: []
  assumptions: |
    none
verification:
  syntax: true
  typecheck: false
  lint: false
  tests: []
  limitations: |
    none
provenance:
  sources: []
  simplifications: |
    none
`);
  write(dir, 'knowledge/code-examples/secret.ts', 'export const leak = 1\n');
  assert.throws(() => compileKnowledge({ root: dir, write: false, check: false }), /Unsafe|escape/i);
});

test('identical input yields identical bytes', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/demo.yaml', topicYaml({ id: 'demo.topic', ruleId: 'DEMO-1' }));
  const first = compileKnowledge({ root: dir, write: false, check: false });
  const second = compileKnowledge({ root: dir, write: false, check: false });
  assert.equal(first.files.size, 1);
  assert.deepEqual([...first.files.keys()], [...second.files.keys()]);
  for (const [key, bytes] of first.files) assert.ok(bytes.equals(second.files.get(key)));
  const again = compileKnowledge({ root: dir, write: false, check: false });
  assert.ok(again.files.get('knowledge/demo.json').equals(first.files.get('knowledge/demo.json')));
});

test('build:check / compile --check detects stale generated knowledge without writing', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/demo.yaml', topicYaml({ id: 'demo.topic', ruleId: 'DEMO-1' }));
  const written = compileKnowledge({ root: dir, write: true, check: false });
  assert.equal(written.ok, true);
  const fresh = compileKnowledge({ root: dir, write: false, check: true });
  assert.equal(fresh.ok, true);
  assert.deepEqual(fresh.stale, []);

  const out = path.join(dir, '.dist/knowledge/demo.json');
  const before = fs.readFileSync(out);
  fs.writeFileSync(out, `${before.toString().replace('Demo purpose.', 'Tampered purpose.')}`);
  const stale = compileKnowledge({ root: dir, write: false, check: true });
  assert.equal(stale.ok, false);
  assert.ok(stale.stale.includes('knowledge/demo.json'));
  assert.equal(fs.readFileSync(out, 'utf8').includes('Tampered purpose.'), true);

  fs.writeFileSync(path.join(dir, '.dist/knowledge/obsolete.json'), '{"schema":"starci/knowledge@1","title":"x","sections":[]}\n');
  const obsolete = compileKnowledge({ root: dir, write: false, check: true });
  assert.equal(obsolete.ok, false);
  assert.ok(obsolete.stale.includes('knowledge/obsolete.json'));
  assert.equal(fs.existsSync(path.join(dir, '.dist/knowledge/obsolete.json')), true);
});

test('index.yaml maps to INDEX.json and bundles example file text without executing it', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/patterns/be/function.yaml', topicYaml({ id: 'be.function', ruleId: 'BE-FUNCTION-1' }));
  write(dir, 'knowledge/code-examples/backend/sample/index.yaml', `schema: starci/code-example@1
id: sample-example
title: Sample
purpose: |
  Example purpose.
appliesTo: [backend]
relatedRules: ["BE-FUNCTION-1"]
files:
  - path: example.ts
    role: handler
    relations: []
entrypoint: example.ts
adapt:
  - Replace domain names
dependencies:
  packages: []
  assumptions: |
    none
verification:
  syntax: true
  typecheck: false
  lint: false
  tests: []
  limitations: |
    excerpt only
provenance:
  sources: []
  simplifications: |
    trimmed
`);
  write(dir, 'knowledge/code-examples/backend/sample/example.ts', 'export const value = 1\n');
  const result = compileKnowledge({ root: dir, write: true, check: false });
  assert.equal(result.ok, true);
  assert.ok(result.files.has('knowledge/code-examples/backend/sample/INDEX.json'));
  const doc = JSON.parse(result.files.get('knowledge/code-examples/backend/sample/INDEX.json').toString());
  assert.equal(doc.schema, 'starci/knowledge@1');
  assert.equal(doc.contents['example.ts'], 'export const value = 1\n');
  assert.ok(Array.isArray(doc.sections));
});

test('npm build:knowledge:check is read-only via CLI', t => {
  const dir = skillFixture(t);
  write(dir, 'knowledge/demo.yaml', topicYaml());
  compileKnowledge({ root: dir, write: true, check: false });
  const checked = spawnSync(process.execPath, ['scripts/compile-knowledge.mjs', '--check'], { cwd: dir, encoding: 'utf8' });
  assert.equal(checked.status, 0, checked.stderr);
  fs.writeFileSync(path.join(dir, '.dist/knowledge/demo.json'), '{}\n');
  const stale = spawnSync(process.execPath, ['scripts/compile-knowledge.mjs', '--check'], { cwd: dir, encoding: 'utf8' });
  assert.notEqual(stale.status, 0);
});
