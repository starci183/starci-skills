import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {checkExampleYaml, exampleYamlFiles} from '../scripts/checks/check-example-yaml.mjs';

/** Remove a link (symlink or junction) as a link, never through it. */
function unlinkLink(link) {
  try { fs.unlinkSync(link); } catch { fs.rmdirSync(link); }
}

test('check-example-yaml never enters node_modules or a junctioned/symlinked directory', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-yaml-'));
  const examples = path.join(dir, 'examples');
  const outside = path.join(dir, 'outside');
  const link = path.join(examples, 'app', 'linked');
  t.after(() => {
    if (fs.existsSync(link) || fs.lstatSync(link, {throwIfNoEntry: false})) unlinkLink(link);
    fs.rmSync(dir, {recursive: true, force: true});
  });
  fs.mkdirSync(path.join(examples, 'app', 'node_modules', 'pkg'), {recursive: true});
  fs.mkdirSync(path.join(examples, 'app', 'packages', 'node_modules'), {recursive: true});
  fs.mkdirSync(outside, {recursive: true});
  fs.writeFileSync(path.join(examples, 'app', 'workspace.yaml'), 'name: app\n');
  const broken = 'a: b: c\n';
  fs.writeFileSync(path.join(examples, 'app', 'node_modules', 'pkg', 'broken.yaml'), broken);
  fs.writeFileSync(path.join(examples, 'app', 'packages', 'node_modules', 'broken.yml'), broken);
  fs.writeFileSync(path.join(outside, 'broken.yaml'), broken);
  fs.symlinkSync(outside, link, 'junction');

  const files = exampleYamlFiles(examples).map(file => path.relative(examples, file).replaceAll(path.sep, '/'));
  assert.deepEqual(files, ['app/workspace.yaml']);
  assert.deepEqual(checkExampleYaml(examples, {base: dir}).refused, []);
});

test('check-example-yaml still refuses a broken authored example yaml', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-example-yaml-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.mkdirSync(path.join(dir, 'examples', 'app'), {recursive: true});
  fs.writeFileSync(path.join(dir, 'examples', 'app', 'broken.yaml'), 'a: b: c\n');
  const {refused} = checkExampleYaml(path.join(dir, 'examples'), {base: dir});
  assert.deepEqual(refused.map(item => item.file), ['examples/app/broken.yaml']);
});
