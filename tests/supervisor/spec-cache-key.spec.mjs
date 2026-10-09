// spec-cache-key.spec.mjs - the key of a reused spec result moves with every input class the affected selector knows, and a key that is blind to one is caught.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { inputClasses, keyCoverageFindings } from '../../scripts/checks/check-spec-cache-key.mjs';
import { createKeyer } from '../../scripts/supervisor/spec-cache-key.mjs';
import { literalsOf, fileIndex, readsOf } from '../../scripts/supervisor/spec-cache-reads.mjs';
import { TIERS, tierOfText, widest } from '../../scripts/supervisor/spec-cache-markers.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const POLICY = { dataRoots: ['modules', 'knowledge'], generated: [{ output: 'docs/cli.md', generator: 'scripts/cli/gen-catalog.mjs' }, { output: 'packages/cli/completions/', generator: 'scripts/cli/gen-catalog.mjs' }] };

test('the real key moves with every input class: imports, data readers, generated outputs, data roots, the widened tiers and the runner', () => {
  assert.deepEqual(keyCoverageFindings({ policy: POLICY }), []);
  const names = inputClasses({ generated: POLICY.generated, dataRoots: POLICY.dataRoots }).map((entry) => entry.name);
  for (const wanted of ['a static import, three deep', 'a literal dynamic import', 'a literal require', 'a runtime entry the spec spawns', 'a data file named by its path', 'a sibling folder', 'a named tree of data',
    'the generated output docs/cli.md of scripts/cli/gen-catalog.mjs', 'a data file under the data root knowledge/']) assert.ok(names.includes(wanted), wanted);
});

test('a key blind to one class is caught by name (the check is not vacuous)', () => {
  const hashOf = (text) => crypto.createHash('sha256').update(text).digest('hex');
  const specOnly = ({ root }) => ({ keyOf: (spec) => ({ key: hashOf(fs.readFileSync(path.join(root, spec), 'utf8')) }) });
  const blind = keyCoverageFindings({ policy: POLICY, makeKeyer: specOnly });
  assert.ok(blind.length >= 15, `${blind.length} blind classes`);
  assert.ok(blind.some((f) => /static import/.test(f.message)));
  assert.ok(blind.some((f) => /node version/.test(f.message)));
  // A keyer that is the real one except that it forgets the data files its modules name.
  const noReads = (options) => {
    const real = createKeyer({ ...options, ids: new Map([...options.ids].filter(([rel]) => /\.(?:mjs|cjs)$/.test(rel) || rel === 'package.json')) });
    return real;
  };
  const noData = keyCoverageFindings({ policy: POLICY, makeKeyer: noReads }).map((f) => f.message);
  assert.ok(noData.some((m) => /data file named by its path/.test(m)), noData.join('\n'));
  assert.ok(!noData.some((m) => /static import/.test(m)), 'imports are still covered');
});

test('the tier a module asks for widens only on a marker, and the widest wins', () => {
  assert.equal(tierOfText("import { x } from './x.mjs';\nexport const y = x;\n"), TIERS.narrow);
  assert.equal(tierOfText("spawn(process.execPath, ['packages/cli/bin/starci.mjs', 'x']);"), TIERS.runtime);
  assert.equal(tierOfText('const m = await import(name);'), TIERS.runtime);
  assert.equal(tierOfText("const m = await import('./fixed.mjs');"), TIERS.narrow);
  assert.equal(tierOfText("fs.readdirSync(path.join(root, 'modules'));"), TIERS.runtime);
  assert.equal(tierOfText("fs.readdirSync(path.join(root, 'tests'));"), TIERS.tree);
  assert.equal(widest([TIERS.narrow, TIERS.tree, TIERS.runtime]), TIERS.tree);
  assert.equal(widest([]), TIERS.narrow);
});

test('what a module reads as data: a file by path or beside its folder, a sibling folder, a named folder, a named tree', () => {
  const index = fileIndex(['modules/a/rows.yaml', 'tests/x/fixtures/f.json', 'tests/x/fixtures/g.json', 'modules/cli/commands/a.yaml', 'packages/tree/be/x.ts', 'scripts/m.mjs']);
  const reads = (file, text) => readsOf({ file, text, index }).sort();
  assert.deepEqual(reads('scripts/m.mjs', "read('modules/a/rows.yaml')"), ['modules/a/rows.yaml']);
  assert.deepEqual(reads('scripts/m.mjs', "read('modules', 'a', 'rows.yaml')"), ['modules/a/rows.yaml']);
  assert.deepEqual(reads('tests/x/s.spec.mjs', "read('./fixtures')"), ['tests/x/fixtures/f.json', 'tests/x/fixtures/g.json']);
  assert.deepEqual(reads('tests/x/s.spec.mjs', "read('./fixtures/f.json')"), ['tests/x/fixtures/f.json']);
  assert.deepEqual(reads('scripts/m.mjs', "dir('modules/cli/commands')"), ['modules/cli/commands/a.yaml']);
  assert.deepEqual(reads('tests/s.spec.mjs', "tree('packages/tree/be')"), ['packages/tree/be/x.ts']);
  assert.deepEqual(reads('scripts/m.mjs', "const modules = 'modules';"), [], 'a bare top-level folder word names no file');
  assert.deepEqual(literalsOf('a(`xx/${y}/z.yaml`, "q")'), ['xx/', '/z.yaml']);
});

test('an unrelated change leaves a narrow key alone, and the order of the files does not matter', (t) => {
  const root = mkdtemp(t, 'starci-spec-key-');
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put('tests/s.spec.mjs', "import '../scripts/a.mjs';\n");
  put('scripts/a.mjs', 'export const a = 1;\n');
  const ids = (extra = {}) => new Map(Object.entries({ 'tests/s.spec.mjs': 'one', 'scripts/a.mjs': 'two', ...extra }));
  const keyOf = (idMap) => createKeyer({ root, preloads: [], ids: idMap, nodeVersion: 'v1' }).keyOf('tests/s.spec.mjs');
  const first = keyOf(ids());
  assert.equal(first.tier, TIERS.narrow);
  assert.equal(keyOf(new Map([...ids()].reverse())).key, first.key);
  assert.equal(keyOf(ids({ 'scripts/unrelated.mjs': 'x' })).key, first.key);
  assert.notEqual(keyOf(ids({ 'scripts/a.mjs': 'changed' })).key, first.key);
});
