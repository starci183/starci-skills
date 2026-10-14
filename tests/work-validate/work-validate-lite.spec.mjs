import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateWork } from '../../scripts/work/validate/work-validate.mjs';
import { checkWorkTree, checkStarciworkBoundary, walk } from '../../scripts/work/validate/check-example-work.mjs';
import { checkWorkConsistencyTree } from '../../scripts/work/validate/check-work-consistency.mjs';
import { checkWorkArtifacts } from '../../scripts/work/validate/check-work-artifacts.mjs';
import { checkWorkFiles, WORK_SECRET_PATTERN, WORK_VALIDATE_REFUSED, WORK_YAML_UNPARSEABLE } from '../../scripts/work/validate/work-hygiene.mjs';

const brand = JSON.stringify({schema: 'work/brand@1', id: 'brand', kind: 'brand', state: 'todo', rev: 1,
  brand: {identity: {name: 'Fixture'}}, review: {reviewer: 'owner', authority: 'Fixture brand ruling', reviewedAt: '2026-10-14T00:00:00Z'}});
const workspace = JSON.stringify({schema: 'work/workspace@1', id: 'lite-app', project: 'lite-app', description: 'A lite fixture app.',
  repositories: [{name: 'be', role: 'be'}, {name: 'fe', role: 'fe'}]});

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

test('lite validation accepts its absent optional Work tree, workspace-only tree and references-only brand tree', t => {
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
  fs.writeFileSync(path.join(work, 'workspace.yaml'), workspace);
  const workspaceReport = validateWork(work, {strict: true});
  assert.equal(workspaceReport.ok, true, JSON.stringify(workspaceReport));
  assert.equal(workspaceReport.counts.schemaChecked, 1);
  fs.mkdirSync(path.join(work, 'brand', 'assets', 'refs'), {recursive: true});
  fs.writeFileSync(path.join(work, 'brand', 'assets', 'refs', 'reference.webp'), 'reference');
  assert.equal(validateWork(work, {strict: true}).ok, true);
});

test('lite workspace and brand records validate without catalog, shell or features records', t => {
  const work = app(t, {'.gitignore': '*\n!workspace.yaml\n!brand/\n', 'workspace.yaml': workspace, 'brand/index.yaml': brand});
  const report = validateWork(work, {strict: true});
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal(report.mode, 'tree');
  assert.equal(report.counts.records, 2);
  assert.equal(report.counts.yamlFiles, 2);
  assert.equal(report.counts.schemaChecked, 2);
  assert.equal(report.counts.schemaRejected, 0);
  const problems = [];
  assert.equal(checkWorkTree(work, problems).records, 2);
  assert.deepEqual(problems, []);
  assert.deepEqual(checkWorkConsistencyTree(work).refuse, []);
  assert.equal(validateWork(path.join(work, 'brand'), {strict: true}).ok, true);
});

test('Work hygiene accepts an arbitrary declared lite app with workspace and brand but no catalog', t => {
  const work = app(t, {'.gitignore': '*\n!workspace.yaml\n!brand/\n', 'workspace.yaml': workspace, 'brand/index.yaml': brand});
  const repo = path.dirname(work);
  assert.equal(fs.existsSync(path.join(work, 'index.yaml')), false);
  const files = ['.starciwork/.gitignore', '.starciwork/workspace.yaml', '.starciwork/brand/index.yaml'];
  for (const strict of [false, true]) {
    const report = checkWorkFiles({repo, files, strict});
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.deepEqual(report.findings, []);
    assert.equal(report.files, 3);
    assert.deepEqual(report.checked, {parse: 2, validate: 2, secrets: 3});
  }
});

test('full Work hygiene still refuses missing catalogs and invalid workspace ids', t => {
  const withoutCatalog = app(t, {'workspace.yaml': workspace, 'brand/index.yaml': brand}, 'full');
  const missing = checkWorkFiles({repo: path.dirname(withoutCatalog), files: ['.starciwork/workspace.yaml', '.starciwork/brand/index.yaml']});
  assert.equal(missing.ok, false, JSON.stringify(missing));
  assert.ok(missing.findings.some(finding => finding.code === WORK_VALIDATE_REFUSED && finding.detail.endsWith('[CATALOG_DIRTY]')), JSON.stringify(missing));
  const missingTree = validateWork(withoutCatalog, {strict: true});
  assert.equal(missingTree.ok, false);
  assert.ok(missingTree.refused.some(finding => finding.endsWith('[CATALOG_DIRTY]')), JSON.stringify(missingTree));

  const invalidWorkspace = app(t, {
    'index.yaml': 'schema: work/catalog@1\nid: fixture\nfeatures: []\n',
    'workspace.yaml': JSON.stringify({...JSON.parse(workspace), id: {project: null}}),
  }, 'full');
  const invalid = checkWorkFiles({repo: path.dirname(invalidWorkspace), files: ['.starciwork/workspace.yaml']});
  assert.equal(invalid.ok, false, JSON.stringify(invalid));
  assert.ok(invalid.findings.some(finding => finding.code === WORK_VALIDATE_REFUSED && finding.detail.endsWith('[ID_TYPE]')), JSON.stringify(invalid));
  const invalidTree = validateWork(invalidWorkspace, {strict: true});
  assert.equal(invalidTree.ok, false);
  assert.ok(invalidTree.refused.some(finding => finding.endsWith('[ID_TYPE]')), JSON.stringify(invalidTree));
});

test('full and lite scaffold placeholders skip app validation while hygiene still parses and scans them', () => {
  const repo = path.resolve(import.meta.dirname, '..', '..');
  for (const skeleton of ['skeleton', 'skeleton-lite']) {
    const file = `packages/hfs/templates/app/${skeleton}/.starciwork/workspace.yaml`;
    const clean = checkWorkFiles({repo, files: [file]});
    assert.equal(clean.ok, true, JSON.stringify(clean));
    assert.deepEqual(clean.findings, []);
    assert.deepEqual(clean.checked, {parse: 1, validate: 0, secrets: 1});

    const broken = checkWorkFiles({repo, files: [file], read: () => 'bad: [\n'});
    assert.equal(broken.ok, false);
    assert.deepEqual(broken.findings.map(finding => finding.code), [WORK_YAML_UNPARSEABLE]);
    assert.deepEqual(broken.checked, {parse: 1, validate: 0, secrets: 1});

    const secret = checkWorkFiles({repo, files: [file], read: () => `note: ghp_${'a1B2c3D4'.repeat(5)}\n`});
    assert.equal(secret.ok, false);
    assert.deepEqual(secret.findings.map(finding => finding.code), [WORK_SECRET_PATTERN]);
    assert.deepEqual(secret.checked, {parse: 1, validate: 0, secrets: 1});
  }
});

test('a foreign app under a scaffold-shaped path retains full validation', t => {
  const repo = path.dirname(app(t));
  const file = 'packages/hfs/templates/app/skeleton-lite/.starciwork/workspace.yaml';
  const target = path.join(repo, ...file.split('/'));
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.writeFileSync(target, JSON.stringify({...JSON.parse(workspace), id: {project: null}}));
  fs.writeFileSync(path.join(path.dirname(path.dirname(target)), 'hfs.json'), JSON.stringify({kind: 'app', edition: 'full'}));
  const report = checkWorkFiles({repo, files: [file]});
  assert.equal(report.ok, false, JSON.stringify(report));
  assert.deepEqual(report.checked, {parse: 1, validate: 1, secrets: 1});
  assert.ok(report.findings.some(finding => finding.code === WORK_VALIDATE_REFUSED && finding.detail.endsWith('[ID_TYPE]')), JSON.stringify(report));
  assert.ok(report.findings.some(finding => finding.code === WORK_VALIDATE_REFUSED && finding.detail.endsWith('[CATALOG_DIRTY]')), JSON.stringify(report));
});

test('lite validation refuses every forbidden root entry and skips its record bytes', t => {
  const forbidden = ['index.yaml', 'shell/index.yaml', 'features/task/index.yaml',
    '_resources/identities/demo/resource.yaml', 'uat/index.yaml', 'br/index.yaml', '.gitattributes', 'notes.txt'];
  const work = app(t, {'workspace.yaml': workspace, 'brand/index.yaml': brand,
    ...Object.fromEntries(forbidden.map(rel => [rel, 'bad: [\n']))});
  fs.mkdirSync(path.join(work, 'empty-forbidden'));
  const report = validateWork(work, {strict: true});
  assert.equal(report.ok, false);
  assert.equal(report.counts.records, 2);
  assert.equal(report.counts.yamlFiles, 2);
  assert.equal(report.counts.schemaChecked, 2);
  assert.equal(boundary(report).length, 9, JSON.stringify(report));
  assert.deepEqual(report.refused, boundary(report), 'forbidden records must not be parsed or schema-checked');
  assert.ok(boundary(report).every(line => line.includes(': lite .starciwork holds only workspace.yaml and brand/ (plus .gitignore) [')));
  assert.deepEqual(walk(work).map(file => path.relative(work, file)).sort(), [path.join('brand', 'index.yaml'), 'workspace.yaml'].sort());
  const out = {refuse: [], suspect: [], info: []};
  assert.equal(checkWorkArtifacts(work, out).records, 2);
  assert.deepEqual(out.refuse, []);
});

test('lite workspace bytes are validated normally rather than hidden by the edition boundary', t => {
  const work = app(t, {'workspace.yaml': 'bad: [\n', 'brand/index.yaml': brand});
  const report = validateWork(work, {strict: true});
  assert.equal(report.ok, false);
  assert.deepEqual(boundary(report), []);
  assert.ok(report.refused.some(line => line.includes('workspace.yaml: does not parse')), JSON.stringify(report));
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
