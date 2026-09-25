import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseYaml } from '../engine/yaml.mjs';
import { checkFamiliesDrift, checkWorkTree, FAMILIES } from '../scripts/checks/check-example-work.mjs';

// starci-next inc-46251d48106c: interface.audit reads and writes features/<feature>/operations/<audit>/index.yaml,
// while work-layout.yaml had no operations family, so the gate refused every work/ record there with
// "no record family in its path" and the audit's own starci validate check could not pass.
const ROOT = path.resolve(import.meta.dirname, '..');
const layout = parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout.yaml'), 'utf8'));

const gate = (t, records) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-operations-family-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, '.starciwork');
  const put = (rel, body) => { const file = path.join(work, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  for (const [rel, body] of Object.entries(records)) put(rel, body);
  const refused = []; const suspect = []; const info = [];
  checkWorkTree(work, refused, suspect, info);
  return { refused, suspect, info };
};
const place = (refused) => refused.filter((r) => /no record family|place says|PLACE_TOO_SHALLOW/.test(r));

test('operations is a layout family the gate recognises, and the two lists agree on the real layout', () => {
  assert.ok(layout.shape.families.includes('operations'));
  assert.ok(FAMILIES.has('operations'));
  assert.match(layout.shape.operations, /^features\/<feature>\/operations\/<name>\/index\.yaml/);
  assert.match(layout.shape.operations, /id operation\.<feature>\.<name>/);
  assert.doesNotMatch(layout.shape.setup, /no\s+operations family/);
  const drift = [];
  checkFamiliesDrift(drift);
  assert.deepEqual(drift, []);
});

test('a record under operations/ validates with id operation.<feature>.<name>', (t) => {
  const { refused, suspect } = gate(t, {
    'features/learning-paths/operations/audit-r1/index.yaml': 'schema: work/operations@1\nid: operation.learning-paths.audit-r1\ntitle: Audit round 1\nstate: todo\n',
  });
  assert.deepEqual(place(refused), []);
  assert.deepEqual(place(suspect), []);
});

test('a record under operations/ whose id is not operation.<feature>.<name> is still refused', (t) => {
  const { refused } = gate(t, {
    'features/learning-paths/operations/audit-r1/index.yaml': 'schema: work/operations@1\nid: operations.learning-paths.audit-r1\ntitle: Audit round 1\nstate: todo\n',
  });
  assert.equal(place(refused).length, 1, refused.join('\n'));
  assert.match(place(refused)[0], /id is operations\.learning-paths\.audit-r1, but its place says operation\.learning-paths\.audit-r1/);
});

test('the interface.audit record and its E/ manifest are op payloads, never refused', (t) => {
  const { refused, info } = gate(t, {
    'features/identity/operations/interface-audit-sign-in/index.yaml': 'schema: starci/interface-audit-operation@1\nid: operation.identity.interface-audit-sign-in\ntitle: Sign-in audit\nstate: blocked\n',
    'features/identity/operations/interface-audit-sign-in/E/manifest.yaml': 'schema: starci/interface-audit-evidence@1\nid: e\n',
  });
  assert.deepEqual(refused, []);
  assert.equal(info.filter((i) => i.includes('[PAYLOAD_SKIPPED]')).length, 2, info.join('\n'));
});

test('a feature named operations keeps its own family ids', (t) => {
  const { refused } = gate(t, {
    'features/operations/decision/release-scope/index.yaml': 'schema: work/policy-decision@1\nid: decision.operations.release-scope\ntitle: Release scope\nstate: todo\n',
  });
  assert.deepEqual(place(refused), []);
});
