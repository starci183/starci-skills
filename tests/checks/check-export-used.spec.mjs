import test from 'node:test';
import assert from 'node:assert/strict';
import { exportUsedFindings, exportedNames, publicEntries } from '../../scripts/checks/check-export-used.mjs';

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
