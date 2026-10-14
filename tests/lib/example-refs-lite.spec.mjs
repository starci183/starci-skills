import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { exampleWorkRoots, exampleArtifactReadOptions } from '../../scripts/lib/example-refs.mjs';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'example-refs-lite-'));
test.after(() => fs.rmSync(TMP_ROOT, {recursive: true, force: true, maxRetries: 10, retryDelay: 50}));
let counter = 0;
const fresh = () => path.join(TMP_ROOT, `fixture-${++counter}`);
function write(root, relative, content) {
  const file = path.join(root, relative);
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, content);
}

test('a lite example can have no Work root or workspace and brand without a catalog index', () => {
  const runtime = fresh(), app = path.join(runtime, 'examples', 'brand-app'), work = path.join(app, '.starciwork');
  write(app, 'hfs.json', JSON.stringify({kind: 'app', edition: 'lite'}));
  assert.deepEqual(exampleWorkRoots(runtime), []);
  write(work, '.gitignore', '# workspace and brand assets\n');
  write(work, 'workspace.yaml', 'schema: work/workspace@1\nid: brand-app\nproject: brand-app\nrepositories: [{name: fe, role: fe}]\n');
  assert.deepEqual(exampleWorkRoots(runtime), [work], 'workspace-only Work trees are legal');
  write(work, 'brand/index.yaml', 'schema: work/brand@1\nid: brand.demo\n');
  assert.deepEqual(exampleWorkRoots(runtime), [work]);
  assert.equal(fs.existsSync(path.join(work, 'index.yaml')), false);
});

test('the full example contract still requires its own catalog index', () => {
  const runtime = fresh(), app = path.join(runtime, 'examples', 'full-app'), work = path.join(app, '.starciwork');
  write(app, 'hfs.json', JSON.stringify({kind: 'app', edition: 'full'}));
  write(work, 'brand/index.yaml', 'schema: work/brand@1\nid: brand.demo\n');
  assert.throws(() => exampleWorkRoots(runtime), /index\.yaml|ENOENT/);
  write(work, 'index.yaml', 'schema: work/catalog@1\nid: full-app\nfeatures: []\n');
  assert.deepEqual(exampleWorkRoots(runtime), [work]);
});

test('lite brand artifact context retains its example CAS without requiring forbidden Work files', () => {
  const runtime = fresh(), app = path.join(runtime, 'examples', 'brand-app'), work = path.join(app, '.starciwork');
  write(app, 'hfs.json', JSON.stringify({kind: 'app', edition: 'lite'}));
  write(work, 'workspace.yaml', 'schema: work/workspace@1\nid: brand-app\nproject: brand-app\nrepositories: [{name: fe, role: fe}]\n');
  write(work, 'brand/index.yaml', 'schema: work/brand@1\nid: brand.demo\n');
  const expected = {root: path.join(runtime, 'examples', '.runtimes', 'brand-app', 'artifacts')};
  assert.deepEqual(exampleArtifactReadOptions(runtime, work), expected);
  assert.deepEqual(exampleArtifactReadOptions(runtime, path.join(work, 'brand'), {resolveRoot: work}), expected);
  write(work, 'features/legacy/index.yaml', 'schema: work/feature@1\nid: legacy\n');
  assert.throws(() => exampleArtifactReadOptions(runtime, path.join(work, 'features', 'legacy'), {resolveRoot: work}), /lite \.starciwork holds only workspace\.yaml and brand\/ \(plus \.gitignore\)/);
});
