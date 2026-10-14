import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWork } from '../../scripts/work/validate/work-validate.mjs';
import { checkWorkTree, checkStarciworkBoundary, walk } from '../../scripts/work/validate/check-example-work.mjs';
import { checkWorkConsistencyTree } from '../../scripts/work/validate/check-work-consistency.mjs';
import { checkWorkArtifacts } from '../../scripts/work/validate/check-work-artifacts.mjs';

const brand = JSON.stringify({schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'todo', rev: 1,
  brand: {identity: {name: 'Fixture'}}, review: {reviewer: 'owner', authority: 'Fixture brand ruling', reviewedAt: '2026-10-14T00:00:00Z'}});

function app(t, files = {}, edition = 'lite') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'work-validate-lite-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.writeFileSync(path.join(root, 'hfs.json'), JSON.stringify({kind: 'app', edition}));
  const work = path.join(root, '.starciwork');
  for (const [rel, content] of Object.entries(files)) {
    const target = path.join(work, ...rel.split('/'));
    fs.mkdirSync(path.dirname(target), {recursive: true});
    fs.writeFileSync(target, content);
  }
  return work;
}

const boundary = report => report.refused.filter(line => line.endsWith('[HFS_STARCIWORK_LITE_FORBIDDEN]'));

test('lite validation accepts its absent optional Work tree and a references-only brand tree', t => {
  const work = app(t);
  for (const strict of [false, true]) {
    const report = validateWork(work, {strict});
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.equal(report.mode, 'tree');
    assert.equal(report.counts.records, 0);
    assert.equal(report.strict, strict);
  }
  fs.mkdirSync(work);
  assert.equal(validateWork(work, {strict: true}).ok, true);
  fs.mkdirSync(path.join(work, 'brand', 'assets', 'refs'), {recursive: true});
  fs.writeFileSync(path.join(work, 'brand', 'assets', 'refs', 'reference.webp'), 'reference');
  assert.equal(validateWork(work, {strict: true}).ok, true);
});

test('lite brand records validate without workspace, catalog, shell or features records', t => {
  const work = app(t, {'.gitignore': '*\n!brand/\n', 'brand/index.yaml': brand});
  const report = validateWork(work, {strict: true});
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal(report.mode, 'tree');
  assert.equal(report.counts.records, 1);
  assert.equal(report.counts.yamlFiles, 1);
  assert.equal(report.counts.schemaChecked, 1);
  assert.equal(report.counts.schemaRejected, 0);
  const problems = [];
  assert.equal(checkWorkTree(work, problems).records, 1);
  assert.deepEqual(problems, []);
  assert.deepEqual(checkWorkConsistencyTree(work).refuse, []);
  assert.equal(validateWork(path.join(work, 'brand'), {strict: true}).ok, true);
});

test('lite validation refuses every forbidden root entry and skips its record bytes', t => {
  const forbidden = ['workspace.yaml', 'index.yaml', 'shell/index.yaml', 'features/task/index.yaml',
    '_resources/identities/demo/resource.yaml', 'uat/index.yaml', 'br/index.yaml', '.gitattributes', 'notes.txt'];
  const work = app(t, {'brand/index.yaml': brand,
    ...Object.fromEntries(forbidden.map(rel => [rel, 'bad: [\n']))});
  fs.mkdirSync(path.join(work, 'empty-forbidden'));
  const report = validateWork(work, {strict: true});
  assert.equal(report.ok, false);
  assert.equal(report.counts.records, 1);
  assert.equal(report.counts.yamlFiles, 1);
  assert.equal(report.counts.schemaChecked, 1);
  assert.equal(boundary(report).length, 10, JSON.stringify(report));
  assert.deepEqual(report.refused, boundary(report), 'forbidden records must not be parsed or schema-checked');
  assert.ok(boundary(report).every(line => line.includes(': lite .starciwork holds only brand/ [')));
  assert.deepEqual(walk(work).map(file => path.relative(work, file)), [path.join('brand', 'index.yaml')]);
  const out = {refuse: [], suspect: [], info: []};
  assert.equal(checkWorkArtifacts(work, out).records, 1);
  assert.deepEqual(out.refuse, []);
});

test('a scoped forbidden lite record is refused before its index is read', t => {
  const work = app(t, {'features/task/index.yaml': 'bad: [\n', 'features/task/workspace.yaml': 'bad: [\n'});
  const report = validateWork(path.join(work, 'features', 'task'), {strict: true});
  assert.equal(report.ok, false);
  assert.equal(boundary(report).length, 1, JSON.stringify(report));
  assert.deepEqual(report.refused, boundary(report));
  assert.equal(report.counts.yamlFiles, 0);
  assert.equal(report.counts.schemaChecked, 0);
});

test('the full Work contract retains its catalog and feature records', t => {
  const work = app(t, {'index.yaml': 'schema: work/catalog@1\nid: fixture\nfeatures: []\n',
    'features/task/index.yaml': 'schema: work/feature@1\nid: task\ntitle: Task\ndescription: d\n'}, 'full');
  const report = validateWork(work);
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal(report.counts.records, 2);
  assert.deepEqual(boundary(report), []);
  const problems = [];
  checkStarciworkBoundary(work, problems);
  assert.deepEqual(problems, []);
  const absent = app(t, {}, 'full');
  assert.ok(validateWork(absent).refused.some(line => line.endsWith('[TARGET_MISSING]')));
});
