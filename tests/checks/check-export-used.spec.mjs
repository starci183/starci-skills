import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { exportUsedFindings, exportedNames, publicEntries, checkExportUsed } from '../../scripts/checks/check-export-used.mjs';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

// RT_EXPORT_UNUSED: an export that no other tracked text file mentions is dead surface.
const names = (files) => exportUsedFindings(files).map((f) => [f.code, f.path, f.name]);

test('an export no other file mentions is flagged; one an importer, a spec or a manifest mentions is not', () => {
  assert.deepEqual(names([
    { rel: 'scripts/lib/a.mjs', text: 'export const used = 1;\nexport function spare() {}\nexport const viaSpec = 2;\nexport const viaYaml = 3;\n' },
    { rel: 'scripts/kernel/b.mjs', text: "import { used } from '../lib/a.mjs';\nexport default used;\n" },
    { rel: 'tests/a.spec.mjs', text: "import { viaSpec } from '../scripts/lib/a.mjs';\nviaSpec;\n" },
    { rel: 'modules/ops/x.yaml', text: 'handler: viaYaml\n' },
  ]), [['RT_EXPORT_UNUSED', 'scripts/lib/a.mjs', 'spare']]);
});

test('a mention in the exporting file itself does not count', () => {
  assert.deepEqual(names([{ rel: 'scripts/lib/a.mjs', text: 'export const twice = 1;\nexport const user = () => twice;\n' }]),
    [['RT_EXPORT_UNUSED', 'scripts/lib/a.mjs', 'twice'], ['RT_EXPORT_UNUSED', 'scripts/lib/a.mjs', 'user']]);
});

test('an export list is judged name by name', () => {
  assert.deepEqual(names([
    { rel: 'scripts/lib/a.mjs', text: 'const one = 1;\nconst two = 2;\nexport { one, two as second };\n' },
    { rel: 'scripts/lib/b.mjs', text: "import { one } from './a.mjs';\none;\n" },
  ]), [['RT_EXPORT_UNUSED', 'scripts/lib/a.mjs', 'second']]);
});

test("a package's public entry (main, exports, bin) is API for consumers, not dead surface", () => {
  assert.deepEqual(names([
    { rel: 'packages/p/package.json', text: JSON.stringify({ main: './index.mjs', exports: { '.': './index.mjs', './lint': { default: './lint/run.mjs' } }, bin: { p: 'bin/p.mjs' } }) },
    { rel: 'packages/p/index.mjs', text: 'export const plugin = {};\n' },
    { rel: 'packages/p/lint/run.mjs', text: 'export const run = () => 1;\n' },
    { rel: 'packages/p/bin/p.mjs', text: 'export const main = () => 1;\n' },
    { rel: 'packages/p/other.mjs', text: 'export const hidden = 1;\n' },
  ]), [['RT_EXPORT_UNUSED', 'packages/p/other.mjs', 'hidden']]);
  assert.deepEqual(publicEntries('packages/p/package.json', JSON.stringify({ main: './index.mjs', bin: { p: 'bin/p.mjs' } })), ['packages/p/index.mjs', 'packages/p/bin/p.mjs']);
});

test('specs and files outside the runtime roots are not judged; destructured exports are names', () => {
  assert.deepEqual(names([
    { rel: 'tests/a.spec.mjs', text: 'export const fixture = 1;\n' },
    { rel: 'docs/a.mjs', text: 'export const doc = 1;\n' },
  ]), []);
  assert.deepEqual(exportedNames('export const { a, b: [c] } = source;\nexport class K {}\nexport default 1;\nexport * from "./x.mjs";\n').map((e) => e.name), ['a', 'c', 'K']);
});

test('the one call function an api call file exports (named after the file) is its contract, not dead surface', () => {
  assert.deepEqual(names([
    { rel: 'scripts/api/process/hide-child-windows.mjs', text: 'export function hideChildWindows() {}\nexport const extra = 1;\n' },
    { rel: 'scripts/api/process/lib.mjs', text: 'export const spare = 1;\n' },
  ]), [['RT_EXPORT_UNUSED', 'scripts/api/process/hide-child-windows.mjs', 'extra'], ['RT_EXPORT_UNUSED', 'scripts/api/process/lib.mjs', 'spare']]);
});

test('the real working-tree export check admits a new reader, excludes an ignored reader, and retains unused exports', t => {
  const root = mkdtemp(t, 'starci-export-current-');
  const git = args => {
    const result = runGit(args, {cwd: root});
    assert.equal(result.status, 0, String(result.stderr ?? result.error));
  };
  git(['init', '--quiet']);
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'tests'));
  const source = path.join(root, 'scripts/source.mjs');
  fs.writeFileSync(source, 'export const used = 1;\nexport const ignoredOnly = 2;\nexport const orphan = 3;\n');
  fs.writeFileSync(path.join(root, 'scripts/gone.mjs'), 'export const removed = 1;\n');
  fs.writeFileSync(path.join(root, '.gitignore'), '/tests/ignored-reader.spec.mjs\n');
  git(['add', '--', '.gitignore', 'scripts']);
  fs.unlinkSync(path.join(root, 'scripts/gone.mjs'));
  const reader = path.join(root, 'tests/new-reader.spec.mjs');
  fs.writeFileSync(reader, "import {used} from '../scripts/source.mjs';\nused;\n");
  fs.writeFileSync(path.join(root, 'tests/ignored-reader.spec.mjs'), "import {ignoredOnly} from '../scripts/source.mjs';\nignoredOnly;\n");
  assert.deepEqual(checkExportUsed(root).map(f => [f.code, f.path, f.name]), [
    ['RT_EXPORT_UNUSED', 'scripts/source.mjs', 'ignoredOnly'],
    ['RT_EXPORT_UNUSED', 'scripts/source.mjs', 'orphan'],
  ]);

  const stat = fs.statSync;
  const denied = Object.assign(new Error('fixture export stat denied'), {code: 'EACCES'});
  const statMock = t.mock.method(fs, 'statSync', (file, ...args) => {
    if (path.resolve(file) === source) throw denied;
    return stat(file, ...args);
  });
  assert.throws(() => checkExportUsed(root), error => error === denied);
  statMock.mock.restore();
  const read = fs.readFileSync;
  const ioFailure = Object.assign(new Error('fixture reader I/O failure'), {code: 'EIO'});
  t.mock.method(fs, 'readFileSync', (file, ...args) => {
    if (path.resolve(file) === reader) throw ioFailure;
    return read(file, ...args);
  });
  assert.throws(() => checkExportUsed(root), error => error === ioFailure);
});
