import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../engine/yaml.mjs';
import { checkWorkTree } from '../scripts/checks/check-example-work.mjs';

// mia inc-96ff77d86a77: architecture.decide listed `owners` as an SDS field while forbidding repository
// roles and paths in an SDS; the checker then refused a done component without owners even though no
// implementation had run to own anything. One lifecycle now: architecture.decide leaves owners absent,
// review.verify's final reconciliation writes the module roots of the done implementation records that
// prove the component, and only then is a missing owners list a refusal.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const readYaml = (rel) => parseYaml(fs.readFileSync(path.join(ROOT, rel), 'utf8'));

const run = (t, records) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sds-owners-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const work = path.join(base, '.starciwork');
  const put = (rel, body) => { const file = path.join(work, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, body); };
  put('index.yaml', 'schema: work/catalog@1\nid: fixture\nfeatures: []\n');
  fs.mkdirSync(path.join(base, 'src', 'chat'), { recursive: true });
  for (const [rel, body] of Object.entries(records)) put(rel, body);
  const refused = []; const suspect = []; const info = [];
  checkWorkTree(work, refused, suspect, info);
  const about = (list) => list.filter((line) => line.includes('sds/chat/') && /SDS_OWNERS/.test(line));
  return { refused: about(refused), suspect: about(suspect), info: about(info) };
};
const sds = (state, owners = '') => `schema: work/sds-component@1\nid: sds.f.chat\ntitle: Chat\nstate: ${state}\nresponsibility: Deliver messages.\nrefs: [fr.f.send]\n${owners}${state === 'done' ? 'verificationSource: authored-claim\nbecause: reconciled\n' : ''}`;
const fr = 'schema: work/functional-requirement@1\nid: fr.f.send\ntitle: Send\nstate: todo\n';
const impl = (state) => `schema: work/implementation@1\nid: impl.f.api.chat\ntitle: Chat module\nstate: ${state}\nrepository: api\nowners: [{role: module, path: src/chat}]\nproves: [sds.f.chat]\n${state === 'done' ? 'verificationSource: authored-claim\nbecause: built\n' : ''}`;
const codes = (lines) => lines.map((line) => /\[([A-Z_]+)\]$/.exec(line)?.[1] ?? line);

test('architecture.decide output: a component with no owners and no implementation is pending, never warned or refused', (t) => {
  for (const state of ['todo', 'done']) {
    const r = run(t, { 'features/f/sds/chat/index.yaml': sds(state), 'features/f/fr/send/index.yaml': fr });
    assert.deepEqual(r.refused, [], state);
    assert.deepEqual(r.suspect, [], state);
    assert.deepEqual(codes(r.info), ['SDS_OWNERS_PENDING'], state);
  }
});

test('a todo implementation has not run yet: the component stays pending', (t) => {
  const r = run(t, { 'features/f/sds/chat/index.yaml': sds('done'), 'features/f/fr/send/index.yaml': fr, 'features/f/impl/api/chat/index.yaml': impl('todo') });
  assert.deepEqual([...codes(r.refused), ...codes(r.suspect)], []);
  assert.deepEqual(codes(r.info), ['SDS_OWNERS_PENDING']);
});

test('after a done implementation proves it, the reconciliation owes owners: done refused, todo warned', (t) => {
  const done = run(t, { 'features/f/sds/chat/index.yaml': sds('done'), 'features/f/fr/send/index.yaml': fr, 'features/f/impl/api/chat/index.yaml': impl('done') });
  assert.deepEqual(codes(done.refused), ['SDS_OWNERS_MISSING']);
  assert.match(done.refused[0], /impl\.f\.api\.chat implemented it/);
  const todo = run(t, { 'features/f/sds/chat/index.yaml': sds('todo'), 'features/f/fr/send/index.yaml': fr, 'features/f/impl/api/chat/index.yaml': impl('done') });
  assert.deepEqual(codes(todo.refused), []);
  assert.deepEqual(codes(todo.suspect), ['SDS_OWNERS_MISSING']);
  const reconciled = run(t, { 'features/f/sds/chat/index.yaml': sds('done', 'owners: [{role: module, path: src/chat}]\n'), 'features/f/fr/send/index.yaml': fr, 'features/f/impl/api/chat/index.yaml': impl('done') });
  assert.deepEqual([...codes(reconciled.refused), ...codes(reconciled.suspect), ...codes(reconciled.info)], []);
});

test('the schema admits a component without owners, and the ops agree on who writes them', () => {
  const schema = readYaml('modules/schemas/work-sds-component.schema.yaml');
  assert.ok(!schema.required.includes('owners'));
  const validate = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(schema);
  assert.equal(validate(parseYaml(sds('todo'))), true, JSON.stringify(validate.errors));
  const decide = readYaml('modules/ops/ops/architecture.decide.yaml');
  const designWrite = decide.writes.find((w) => /sds\/\*\*\/index\.yaml/.test(w.path));
  assert.ok(!designWrite.fields.includes('owners'), 'architecture.decide does not write owners');
  assert.match(designWrite.content.en, /leave owners absent/);
  assert.match(JSON.stringify(readYaml('modules/ops/ops/review.verify.yaml')), /sds-component owners/);
});
