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

// Root directories the layout declares a record index.yaml under (brand/, features/, _derived/). A write
// that puts an index.yaml in any other directory directly under .starciwork is a record outside the layout
// - the root-level operations record workspace.manage used to author, or an import-cv-* folder.
const catalogSchema = readYaml('modules/schemas/work-catalog.schema.yaml');
const layoutRoots = new Set(Object.values(layout.shape).filter(v => typeof v === 'string')
  .flatMap(v => [...v.matchAll(/(?:^|[\s"(,])(?:\.starciwork\/)?([a-z_][a-z0-9_-]*)\/[^\s,]*index\.yaml/g)].map(m => m[1])));
const writesOf = doc => [
  ...(doc.writes ?? []).map(w => ({ where: `writes.${w.id}`, w })),
  ...Object.entries(doc.policy?.executionModes ?? {}).flatMap(([mode, contract]) =>
    (contract.writes ?? []).map(w => ({ where: `executionModes.${mode}.writes.${w.id}`, w }))),
];
const rootRecordWrites = ({ file, doc }) => writesOf(doc).flatMap(({ where, w }) =>
  [...String(w.path ?? '').matchAll(/\.starciwork\/([^/\s+]+)\/index\.yaml/g)]
    .filter(m => !layoutRoots.has(m[1]))
    .map(m => `${file} ${where} writes .starciwork/${m[1]}/index.yaml`));

test('no op manifest writes a record at a root-level .starciwork/<name>/index.yaml outside the layout', () => {
  assert.deepEqual([...layoutRoots].sort(), ['_derived', 'brand', 'features', 'shell']);
  assert.deepEqual(ops.flatMap(rootRecordWrites), []);
  const synthetic = { file: 'synthetic.yaml', doc: { writes: [], policy: { executionModes: { import: { writes: [
    { id: 'node', path: '.starciwork/index.yaml + .starciwork/import-cv-seam/index.yaml' },
    { id: 'feature', path: '.starciwork/features/<feature>/index.yaml' }] } } } } };
  assert.deepEqual(rootRecordWrites(synthetic), ['synthetic.yaml executionModes.import.writes.node writes .starciwork/import-cv-seam/index.yaml']);
});

test('every workspace.manage mode writes its setup record onto the catalog the layout declares', () => {
  const op = ops.find(o => o.doc.id === 'workspace.manage').doc;
  assert.match(layout.shape.setup, /extensions\.work3\.setup\.<workflow>\.<mode>/);
  assert.match(layout.shape.featureCatalog, /^index\.yaml at the \.starciwork root, schema work\/catalog@1/);
  const nodes = [op.writes, ...Object.values(op.policy.executionModes).map(m => m.writes)].map(ws => ws.find(w => w.id === 'node'));
  assert.equal(nodes.length, 4);
  for (const node of nodes) {
    assert.match(node.path, /^\.starciwork\/index\.yaml /, node.path);
    assert.ok(node.fields.some(f => f.startsWith('extensions.work3.setup.<workflow>.')), JSON.stringify(node.fields));
    assert.ok(!node.fields.some(f => /^completion\b/.test(f)), 'a catalog entry binds no completion');
  }
  for (const id of ['workspace.manage', 'scope.finish']) {
    const kind = readYaml('modules/models/kinds.yaml').kinds[id];
    assert.ok(!kind.carries.includes('work/node@1'), `${id} carries no work/node`);
    assert.ok(kind.carries.includes('work/catalog@1') && kind.stacks.includes('modules/schemas/work-catalog.schema.yaml'));
  }
  const common = JSON.stringify(readYaml('modules/ops/_common.yaml'));
  assert.doesNotMatch(common, /work\/node@1`? for root-level|carry `work\/node@1`/);
});

test('work/catalog@1 types the setup entry with the scope field names and refuses state or a stray key', () => {
  const setup = catalogSchema.$defs.setup.properties;
  const scope = featureSchema.$defs.scope.properties;
  for (const field of ['nodes', 'deps', 'exclusions', 'openQuestions']) assert.deepEqual(setup[field], scope[field], `${field} drifted from $defs.scope`);
  assert.deepEqual(Object.keys(setup.request.properties), Object.keys(scope.request.properties).filter(k => k !== 'workflow'));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(catalogSchema);
  const catalog = { schema: 'work/catalog@1', id: 'miamia', description: 'Synthetic catalog for a layout test.',
    features: [{ id: 'repository-foundation', directory: 'features/repository-foundation', description: 'Baseline.' }] };
  const entry = {
    request: { goalIdentity: 'abc123', goalRevision: 0, outcome: 'Canonical Work, SRS, SDS and stacks.' },
    assertions: ['Every declared outcome maps to a required leaf, a deferred decision or a justified exclusion.'],
    nodes: [{ id: 'miamia.work', kind: 'business', purpose: 'Seed the SRS.' }], deps: [], exclusions: [],
    review: { outcome: 'pass', checks: ['starci validate'] },
  };
  const withSetup = setup => ({ ...catalog, extensions: { work3: { setup } } });
  assert.ok(validate(withSetup({ 'wf-miamia-work-and-stacks-mud7kjun': { prepare: entry, stacks: entry } })), JSON.stringify(validate.errors));
  assert.equal(validate(withSetup({ 'wf-x': { prepare: { ...entry, state: 'done' } } })), false, 'a catalog entry carries no state');
  assert.equal(validate(withSetup({ 'wf-x': { prepare: { ...entry, completion: { evidence: ['e'] } } } })), false);
  assert.equal(validate(withSetup({ 'import-cv-seam': { import: entry } })), false, 'entries are keyed by workflow id');
  assert.equal(validate(withSetup({ 'wf-x': { cleanup: entry } })), false, 'one entry per workspace.manage mode');
});

// A Mia Mia prepare cut set was structurally blocked after ordinal 1: full
// validation failed CATALOG_DIRTY on the catalog the final ordinal owned, and
// workspace.manage declared no cutSetAuthority to read that as sibling-owned.
test('workspace.manage declares cutSetAuthority for prepare/import cut sets', () => {
  const doc = parseYaml(fs.readFileSync(path.join(root, 'modules/ops/ops/workspace.manage.yaml'), 'utf8'));
  const authority = doc.policy?.cutSetAuthority;
  assert.ok(authority, 'workspace.manage has policy.cutSetAuthority');
  assert.match(authority.scope, /prepare/);
  assert.match(authority.permits, /cut-slice-postcondition/);
  assert.match(authority.permits, /full-regression-final/);
});

// StarCi Next backend.scaffold cut ordinals were refused on a repository-wide
// lint red that only a later sibling could fix (inc-751dd1ac4492).
test('the scaffold ops declare cutSetAuthority for their cut sets', () => {
  for (const op of ['backend.scaffold', 'interface.scaffold', 'package.scaffold']) {
    const doc = parseYaml(fs.readFileSync(path.join(root, `modules/ops/ops/${op}.yaml`), 'utf8'));
    assert.match(doc.policy?.cutSetAuthority?.permits ?? '', /full-regression-final/, `${op} declares cutSetAuthority`);
  }
});
