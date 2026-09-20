import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateEvidence } from '../scripts/example/example-evidence.mjs';
import { parseYaml } from '../engine/yaml.mjs';

/** Fixtures live on the repo's own drive, matching tests/example-work-gate.spec.mjs's own reasoning. */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `evidence-fixture-${process.pid}-${counter}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function write(root, rel, content) {
  const file = path.join(root, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  return file;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

test('generateEvidence: a passing assertion writes outcome: pass with a matching recordDigest and truthful provenance', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  const recordFile = write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement\nid: fr.f.thing\ntitle: t\nstate: todo\n');

  const result = generateEvidence({
    workRoot,
    recordId: 'fr.f.thing',
    cwd: root,
    assertions: [{ id: 'ac.f.thing.works', command: process.platform === 'win32' ? 'exit 0' : 'true' }],
  });

  assert.equal(result.ok, true);
  assert.equal(result.evidence.outcome, 'pass');
  assert.equal(result.evidence.recordDigest, sha256File(recordFile));
  assert.equal(result.evidence.provenance.actor, 'example-evidence');
  assert.equal(result.evidence.provenance.tool, 'scripts/example-evidence.mjs');

  const written = parseYaml(fs.readFileSync(result.evidenceFile, 'utf8'));
  assert.equal(written.schema, 'work/evidence');
  assert.equal(written.record, 'fr.f.thing');
  assert.equal(written.assertions[0].outcome, 'pass');
});

test('generateEvidence: a failing command is recorded as outcome: fail and the script signals failure, never touching state', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement\nid: fr.f.thing\ntitle: t\nstate: todo\n');

  const result = generateEvidence({
    workRoot,
    recordId: 'fr.f.thing',
    cwd: root,
    assertions: [{ id: 'ac.f.thing.fails', command: process.platform === 'win32' ? 'exit 1' : 'false' }],
  });

  assert.equal(result.ok, false);
  assert.equal(result.evidence.outcome, 'fail');
  assert.equal(result.evidence.assertions[0].outcome, 'fail');

  const sibling = parseYaml(fs.readFileSync(path.join(workRoot, 'features/f/fr/thing/index.yaml'), 'utf8'));
  assert.equal(sibling.state, 'todo', 'the script must never edit the record\'s own state');
});

test('generateEvidence: assertions carry both command and exit alongside the human observation (concept 2: replayable evidence)', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement\nid: fr.f.thing\ntitle: t\nstate: todo\n');

  const passCommand = process.platform === 'win32' ? 'exit 0' : 'true';
  const result = generateEvidence({
    workRoot, recordId: 'fr.f.thing', cwd: root,
    assertions: [{ id: 'ac.f.thing.works', command: passCommand }],
  });
  assert.equal(result.evidence.assertions[0].command, passCommand);
  assert.equal(result.evidence.assertions[0].exit, 0);
  assert.equal(typeof result.evidence.assertions[0].observation, 'string');
});

test('generateEvidence: computes codeDigest over the sorted bytes of every file under the record\'s owned directories (concept 1)', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/impl/thing/index.yaml',
    'schema: work/implementation\nid: impl.f.thing\ntitle: t\nstate: todo\nrepository: r\nowners: [{role: module, path: src/f}]\n');
  write(root, 'src/f/a.ts', 'export const a = 1;\n');
  write(root, 'src/f/b.ts', 'export const b = 2;\n');

  const result = generateEvidence({
    workRoot, recordId: 'impl.f.thing', cwd: root,
    assertions: [{ id: 'ac.f.thing.works', command: process.platform === 'win32' ? 'exit 0' : 'true' }],
  });

  assert.ok(result.evidence.codeDigest, 'expected a codeDigest to be written');
  assert.equal(result.evidence.codeDigest.algorithm, 'sha256');
  assert.deepEqual(result.evidence.codeDigest.files.map(f => f.path), ['src/f/a.ts', 'src/f/b.ts']);

  // changing a file's bytes changes the digest - it is a real hash over real content, not a placeholder
  const before = result.evidence.codeDigest.digest;
  fs.writeFileSync(path.join(root, 'src/f/a.ts'), 'export const a = 999;\n', 'utf8');
  const result2 = generateEvidence({
    workRoot, recordId: 'impl.f.thing', cwd: root,
    assertions: [{ id: 'ac.f.thing.works', command: process.platform === 'win32' ? 'exit 0' : 'true' }],
  });
  assert.notEqual(result2.evidence.codeDigest.digest, before);
});

test('generateEvidence: omits codeDigest entirely when the record owns no resolvable directory', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement\nid: fr.f.thing\ntitle: t\nstate: todo\n');

  const result = generateEvidence({
    workRoot, recordId: 'fr.f.thing', cwd: root,
    assertions: [{ id: 'ac.f.thing.works', command: process.platform === 'win32' ? 'exit 0' : 'true' }],
  });
  assert.equal('codeDigest' in result.evidence, false);
});

test('generateEvidence: refuses when no record with the given id exists under --work', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog\nid: fixture\nfeatures: []\n');

  assert.throws(() => generateEvidence({
    workRoot,
    recordId: 'fr.f.ghost',
    cwd: root,
    assertions: [{ id: 'ac.x', command: process.platform === 'win32' ? 'exit 0' : 'true' }],
  }), /no record with id fr\.f\.ghost/);
});
