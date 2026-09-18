import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { generateEvidence } from '../scripts/example-evidence.mjs';
import { parseYaml } from '../core/yaml.mjs';

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
