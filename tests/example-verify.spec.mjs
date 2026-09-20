import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verifyRecord } from '../scripts/example/example-verify.mjs';
import { generateEvidence } from '../scripts/example/example-evidence.mjs';

/** Fixtures live on the repo's own drive, matching the other example-*.spec.mjs files' own reasoning. */
const TMP_ROOT = path.join(path.parse(process.cwd()).root, 'starci-tmp');

let counter = 0;
function freshDir() {
  counter += 1;
  const dir = path.join(TMP_ROOT, `verify-fixture-${process.pid}-${counter}`);
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

const PASS = process.platform === 'win32' ? 'exit 0' : 'true';
const FAIL = process.platform === 'win32' ? 'exit 1' : 'false';

test('verifyRecord: a passing assertion whose command still passes verifies clean', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement@1\nid: fr.f.thing\ntitle: t\nstate: todo\n');
  generateEvidence({ workRoot, recordId: 'fr.f.thing', cwd: root, assertions: [{ id: 'ac.f.thing.works', command: PASS }] });

  const result = verifyRecord({ workRoot, recordId: 'fr.f.thing', cwd: root });
  assert.equal(result.ok, true);
  assert.equal(result.results[0].replayedOutcome, 'pass');
});

test('verifyRecord: PROOF_STALE when the claimed outcome no longer matches what replaying the command produces', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement@1\nid: fr.f.thing\ntitle: t\nstate: todo\n');
  // captured while it passed...
  generateEvidence({ workRoot, recordId: 'fr.f.thing', cwd: root, assertions: [{ id: 'ac.f.thing.works', command: PASS }] });
  // ...but the evidence on disk is hand-edited afterwards to claim a command that now fails (simulating
  // code that regressed since the evidence was captured, without anyone re-running example-evidence.mjs).
  const evidenceFile = path.join(workRoot, 'features/f/fr/thing/evidence.yaml');
  const current = fs.readFileSync(evidenceFile, 'utf8');
  fs.writeFileSync(evidenceFile, current.replace(PASS, FAIL), 'utf8');

  const result = verifyRecord({ workRoot, recordId: 'fr.f.thing', cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.results[0].claimedOutcome, 'pass');
  assert.equal(result.results[0].replayedOutcome, 'fail');
});

test('verifyRecord: an assertion with no command is reported as not replayable rather than skipped', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement@1\nid: fr.f.thing\ntitle: t\nstate: done\nverificationSource: authored-claim\nbecause: c\n');
  write(workRoot, 'features/f/fr/thing/evidence.yaml',
    'schema: work/evidence@1\nrecord: fr.f.thing\noutcome: pass\nassertions:\n  - {id: ac.f.thing.works, outcome: pass, observation: "trust me"}\n');

  const result = verifyRecord({ workRoot, recordId: 'fr.f.thing', cwd: root });
  assert.equal(result.ok, false);
  assert.equal(result.results[0].ok, false);
  assert.match(result.results[0].reason, /not replayable/);
});

test('verifyRecord: throws when no record with the given id exists under --work', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  assert.throws(() => verifyRecord({ workRoot, recordId: 'fr.f.ghost', cwd: root }), /no record with id fr\.f\.ghost/);
});

test('verifyRecord: throws when the record exists but has no evidence.yaml beside it', () => {
  const root = freshDir();
  const workRoot = path.join(root, '.starciwork');
  write(workRoot, 'features/f/fr/thing/index.yaml', 'schema: work/functional-requirement@1\nid: fr.f.thing\ntitle: t\nstate: todo\n');
  assert.throws(() => verifyRecord({ workRoot, recordId: 'fr.f.thing', cwd: root }), /no evidence\.yaml/);
});
