import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import { parseYaml } from '../engine/yaml.mjs';

const root = path.resolve(import.meta.dirname, '..');
const readYaml = rel => parseYaml(fs.readFileSync(path.join(root, rel), 'utf8'));
const layout = readYaml('modules/schemas/work-layout.yaml');
const featureSchema = readYaml('modules/schemas/work-feature.schema.yaml');
const opsDir = path.join(root, 'modules/ops/ops');
const ops = fs.readdirSync(opsDir).filter(f => f.endsWith('.yaml'))
  .map(f => ({ file: `modules/ops/ops/${f}`, doc: readYaml(`modules/ops/ops/${f}`) }));
const scopeDefine = ops.find(op => op.doc.id === 'scope.define').doc;
const scopeWrite = scopeDefine.writes.find(w => w.id === 'scope');

test('work-layout forbids authoring work/node records, and no op manifest declares one as its output', () => {
  assert.match(layout.shape.familiesNote, /ops must never author new work\/node records/);
  const offenders = ops.flatMap(({ file, doc }) => (doc.writes ?? [])
    .filter(w => /work\/node@\d/.test(JSON.stringify([w.path, w.fields, w.content])))
    .map(w => `${file} writes.${w.id}`));
  assert.deepEqual(offenders, []);
});

test('scope.define writes its scope record onto the feature record the layout declares', () => {
  assert.equal(`.starciwork/${layout.shape.feature}`, scopeWrite.path);
  assert.ok(!layout.shape.families.includes('scope'), 'the layout has no scope family');
  const declared = new Set(Object.keys(featureSchema.properties));
  for (const field of scopeWrite.fields) {
    const [top] = field.split('.');
    assert.ok(declared.has(top), `${field} is not a work/feature@1 property`);
  }
  assert.ok(scopeWrite.fields.includes('extensions.work3.scope'));
  assert.ok(!scopeWrite.fields.some(f => ['state', 'kind', 'required'].includes(f)), 'a feature record carries no lifecycle');
  assert.ok(featureSchema.properties.extensions.properties.work3.properties.scope);
});

test('the scope.define kind carries the feature record, not work/node', () => {
  const kind = readYaml('modules/models/kinds.yaml').kinds['scope.define'];
  assert.deepEqual(kind.carries, ['work/feature@1', 'work/catalog@1']);
  assert.ok(kind.stacks.includes('modules/schemas/work-feature.schema.yaml'));
});

test('work/feature@1 accepts a bounded scope under extensions.work3.scope and still refuses state', () => {
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(featureSchema);
  const feature = {
    schema: 'work/feature@1', id: 'collab', title: 'Collab coordinates people and modules in one conversation.',
    description: 'Synthetic feature record for a layout test.',
  };
  const scope = {
    request: { workflow: 'wf-synthetic', goalIdentity: 'abc123', goalRevision: 0, outcome: 'Working group chat.' },
    nodes: [{ id: 'nivo.collab.business', kind: 'business', purpose: 'Resolve the SRS.', grounding: ['owner-approved-goal'], dependsOn: [] }],
    deps: [{ from: 'nivo.collab.architecture', to: 'nivo.collab.business', reason: 'Design realizes behavior.' }],
    exclusions: [{ subject: 'Deployment', reason: 'The goal grants no deployment effect.' }],
    openQuestions: [],
  };
  assert.ok(validate(feature), JSON.stringify(validate.errors));
  assert.ok(validate({ ...feature, extensions: { work3: { scope } } }), JSON.stringify(validate.errors));
  assert.equal(validate({ ...feature, extensions: { work3: { scope: { nodes: [] } } } }), false, 'deps and exclusions are required');
  assert.equal(validate({ ...feature, state: 'todo' }), false);
});
