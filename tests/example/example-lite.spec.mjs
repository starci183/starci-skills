import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readWorkTree, findRecordFile } from '../../scripts/lib/work-tree.mjs';
import { computeDerived, runDerive } from '../../scripts/example/example-derive.mjs';
import { computeCritique, runCritique } from '../../scripts/example/example-critique.mjs';
import { checkExampleDerived } from '../../scripts/checks/check-example-derived.mjs';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'example-lite-'));
test.after(() => fs.rmSync(TMP_ROOT, {recursive: true, force: true, maxRetries: 10, retryDelay: 50}));
let counter = 0;
function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
  return file;
}
function liteTree() {
  const app = path.join(TMP_ROOT, `fixture-${++counter}`);
  write(app, 'hfs.json', JSON.stringify({kind: 'app', edition: 'lite'}));
  return path.join(app, '.starciwork');
}

test('Work record discovery keeps lite brand records and ignores forbidden migration leftovers', t => {
  const work = liteTree();
  const workspace = write(work, 'workspace.yaml', 'schema: work/workspace@1\nid: lite-app\nproject: lite-app\nrepositories: [{name: fe, role: fe}]\n');
  const brand = write(work, 'brand/index.yaml', 'schema: work/brand@1\nid: brand.demo\n');
  write(work, 'brand/evidence.yaml', 'schema: work/evidence@1\nrecord: brand.demo\noutcome: pass\n');
  for (const relative of ['index.yaml', 'shell/index.yaml', 'features/legacy/index.yaml', '_resources/index.yaml', 'uat/index.yaml', 'br/index.yaml']) {
    write(work, relative, 'schema: work/feature@1\nid: legacy\nstate: todo\n');
  }
  const readFile = fs.readFileSync;
  const forbiddenReads = [];
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (typeof file === 'string') {
      const relative = path.relative(work, file).replaceAll('\\', '/');
      if (relative && !relative.startsWith('../') && relative !== 'workspace.yaml' && !relative.startsWith('brand/')) forbiddenReads.push(relative);
    }
    return readFile(file, ...args);
  });
  const {records, evidenceByDir} = readWorkTree(work);
  assert.deepEqual([...records.keys()].sort(), ['brand.demo', 'lite-app']);
  assert.equal(records.get('lite-app').file, workspace);
  assert.equal(records.get('lite-app').data.project, 'lite-app');
  assert.deepEqual([...evidenceByDir.keys()], ['brand']);
  assert.equal(findRecordFile(work, 'brand.demo'), brand);
  assert.equal(findRecordFile(work, 'legacy'), null);
  assert.deepEqual([...computeDerived(work).records.keys()].sort(), ['brand.demo', 'lite-app']);
  assert.deepEqual(computeCritique(work).findings, []);
  assert.deepEqual(forbiddenReads, [], 'forbidden migration leftovers are never opened by readers');
});

test('optional absent lite Work roots supply no records and generated Work tools skip cleanly', () => {
  const work = liteTree();
  assert.equal(readWorkTree(work).records.size, 0);
  assert.equal(findRecordFile(work, 'brand.demo'), null);
  for (const run of [runDerive, runCritique]) {
    for (const write of [false, true]) assert.deepEqual(run(work, {write}), {ok: true, wrote: false, skipped: true});
  }
  assert.equal(fs.existsSync(work), false);
});

test('lite generated Work tools neither demand nor write _derived, even with old derived vocabulary', () => {
  const work = liteTree();
  write(work, 'brand/index.yaml', 'schema: work/brand@1\nid: brand.demo\n');
  write(work, 'features/legacy/index.yaml', 'schema: work/feature@1\nid: legacy\nusedBy: []\n');
  const problems = [];
  assert.deepEqual(checkExampleDerived(work, problems), {checked: false, skipped: true});
  assert.deepEqual(problems, []);
  for (const run of [runDerive, runCritique]) assert.equal(run(work, {write: true}).skipped, true);
  assert.equal(fs.existsSync(path.join(work, '_derived')), false);
});

test('generated Work CLIs report a successful lite skip without claiming generated files', () => {
  const work = liteTree();
  for (const filename of ['example-derive.mjs', 'example-critique.mjs']) {
    const script = fileURLToPath(new URL(`../../scripts/example/${filename}`, import.meta.url));
    for (const args of [[], ['--write']]) {
      const output = execFileSync(process.execPath, [script, '--work', work, ...args], {encoding: 'utf8'});
      assert.match(output, /SKIP lite \.starciwork holds only workspace\.yaml and brand\/ \(plus \.gitignore\)/);
      assert.doesNotMatch(output, /wrote |REFUSED/);
    }
  }
  assert.equal(fs.existsSync(work), false);
});

test('full Work roots keep feature discovery and generated artifacts', () => {
  const app = path.join(TMP_ROOT, `fixture-${++counter}`), work = path.join(app, '.starciwork');
  write(app, 'hfs.json', JSON.stringify({kind: 'app', edition: 'full'}));
  write(work, 'workspace.yaml', 'schema: work/workspace@1\nid: full\n');
  write(work, 'index.yaml', 'schema: work/catalog@1\nid: full\nfeatures: [demo]\n');
  write(work, 'features/demo/index.yaml', 'schema: work/feature@1\nid: demo\nstate: todo\n');
  assert.equal(readWorkTree(work).records.has('demo'), true);
  assert.equal(runDerive(work, {write: true}).wrote, true);
  assert.equal(runCritique(work, {write: true}).wrote, true);
  assert.equal(runDerive(work).ok, true);
  assert.equal(runCritique(work).ok, true);
  assert.equal(fs.existsSync(path.join(work, '_derived', 'index.yaml')), true);
  assert.equal(fs.existsSync(path.join(work, '_derived', 'critique.yaml')), true);
});
