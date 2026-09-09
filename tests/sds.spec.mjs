import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {documentSDS} from '../fixtures/sds.mjs';
import {validateSpecification} from '../specifications/validate.mjs';
import {validateWorkspace} from '../core/index.mjs';
import {parseYaml, stringifyYaml} from '../core/yaml.mjs';

test('source-independent SDS validates without code, symbols, copied SRS or a named pattern', () => {
  assert.deepEqual(validateSpecification(documentSDS()), {ok: true, errors: []});
});

test('SDS rejects missing design semantics, broken references and source-shaped payloads', () => {
  for (const mutate of [
    s => {s.sources = [];},
    s => {s.codeImpacts = [];},
    s => {s.requirements = [];},
    s => {s.views[3].content.timeout = '';},
    s => {s.views[3].content.receiver = 'missing';},
    s => {s.views[4].content.owner = 'update';},
    s => {s.views[5].content.steps[0].contractRefs = ['records'];},
    s => {s.views[5].content.steps[0].owner = 'client'; s.views[5].content.participants = ['documents'];},
    s => {s.views[5].content.steps[0].failures[0].recovery = '';},
    s => {s.views[5].content.businessFlowRefs = ['wrong#FLOW'];},
    s => {s.views[7].content.scenarios[0].checkIds = ['missing'];},
    s => {s.views[3].content.symbol = 'anImplementationFunction';},
    s => {s.checks[0].businessAcceptanceRefs = ['wrong#AC'];},
    s => {s.decisions[0].alternatives = [];},
    s => {s.decisions[0].referenceIds = ['imagined-source'];},
    s => {s.status = 'pass';},
    s => {s.views.push(structuredClone(s.views[0]));},
    s => {s.designRefs = [{nodeId: 'x', viewIds: ['a', 'a']}];},
    s => {s.views = [null];}
  ]) { const s = documentSDS(); mutate(s); assert.equal(validateSpecification(s).ok, false, mutate.toString()); }
});

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-sds-'));
  fs.cpSync(new URL('../examples/nested-business/', import.meta.url), root, {recursive: true});
  t.after(() => { assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('starci-sds-')); fs.rmSync(root, {recursive: true, force: true}); });
  const write = (relative, value) => {const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), {recursive: true}); fs.writeFileSync(file, stringifyYaml(value));};
  const node = (id, more = {}) => ({schema: 'work/node@2', id, kind: 'architecture', required: true, description: 'Synthetic owned design scope.', ...more});
  write('knowledge/architecture/index.yaml', node('example.architecture', {dependsOn: ['example.business.srs']}));
  write('knowledge/architecture/overview/index.yaml', node('example.architecture.overview', {state: 'todo', description: 'Source-independent example scope overview.'}));
  write('knowledge/architecture/sds/index.yaml', node('example.architecture.sds', {state: 'todo', extensions: {work3: {specification: documentSDS()}}}));
  return {root, write, node, run: () => validateWorkspace(root)};
}

test('nested SDS resolves canonical SRS IDs and imports shared views without copying', t => {
  const f = fixture(t), first = f.run();
  assert.equal(first.ok, true, JSON.stringify(first.errors));
  const s = documentSDS(), provider = documentSDS();
  provider.views = provider.views.filter(v => ['client', 'documents'].includes(v.id)); provider.views[0].content.dependencies = [];
  provider.decisions = [];
  f.write('knowledge/shared-design/index.yaml', f.node('shared-design', {state: 'todo', dependsOn: ['example.business.srs'], extensions: {work3: {specification: provider}}}));
  s.designRefs = [{nodeId: 'shared-design', viewIds: ['client']}];
  s.views.find(v => v.id === 'update').content.caller = 'shared-design#client';
  f.write('knowledge/architecture/sds/index.yaml', f.node('example.architecture.sds', {state: 'todo', refs: ['shared-design'], extensions: {work3: {specification: s}}}));
  assert.equal(f.run().ok, true, JSON.stringify(f.run().errors));
  s.businessRefs[0].requirementIds = ['missing'];
  f.write('knowledge/architecture/sds/index.yaml', f.node('example.architecture.sds', {state: 'todo', refs: ['shared-design'], extensions: {work3: {specification: s}}}));
  assert.ok(f.run().errors.some(e => e.code === 'SDS_BINDING'));
});

test('SDS rejects undeclared graph imports, legacy source mapping and false acceptance', t => {
  for (const mode of ['unbound', 'source', 'pass', 'wrong-kind']) {
    const f = fixture(t), s = documentSDS();
    const meta = f.node('example.architecture.sds', {state: 'todo', extensions: {work3: {specification: s}}});
    if (mode === 'unbound') {s.designRefs = [{nodeId: 'not-declared', viewIds: ['component']}];}
    if (mode === 'source') {meta.sourceRefs = [{repository: 'x', path: 'src/x.ts', revision: 'a'.repeat(40), symbol: 'x', observation: 'Not allowed in SDS.'}];}
    if (mode === 'pass') {s.status = 'pass'; s.decisions[0].status = 'accepted';}
    if (mode === 'wrong-kind') {
      const provider = documentSDS();
      f.write('knowledge/shared-design/index.yaml', f.node('shared-design', {state: 'todo', dependsOn: ['example.business.srs'], extensions: {work3: {specification: provider}}}));
      meta.refs = ['shared-design']; s.designRefs = [{nodeId: 'shared-design', viewIds: ['records']}];
      s.views.find(v => v.id === 'update').content.caller = 'shared-design#records';
    }
    f.write('knowledge/architecture/sds/index.yaml', meta);
    assert.ok(f.run().errors.some(e => e.code === (mode === 'source' ? 'SDS_SOURCE_MAPPING' : 'SDS_BINDING')), mode);
  }
});

test('SDS grows recursively without registry and refuses authored branch duplication', t => {
  const f = fixture(t);
  f.write('knowledge/architecture/sds/index.yaml', f.node('example.architecture.sds'));
  f.write('knowledge/architecture/sds/A/index.yaml', f.node('example.architecture.sds.A'));
  f.write('knowledge/architecture/sds/A/B/index.yaml', f.node('example.architecture.sds.A.B', {state: 'todo', extensions: {work3: {specification: documentSDS()}}}));
  assert.equal(f.run().ok, true, JSON.stringify(f.run().errors));
  f.write('knowledge/architecture/sds/A/index.yaml', f.node('example.architecture.sds.A', {extensions: {work3: {specification: documentSDS()}}}));
  assert.ok(f.run().errors.some(e => e.code === 'SDS_BRANCH_PAYLOAD'));
});
