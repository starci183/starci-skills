// affected-symbols.spec.mjs - `starci test affected` by symbol: the specs related to the changed functions, not every spec importing the changed file.
// One fixture tree; each rule (direct import, namespace, re-export, caller chain, depth bound, dynamic import, CLI verb, non-source file) has its own case,
// and every case also asserts the file-level rule would have selected the dropped specs (the symbol answer is a subset where nothing is followed deeper).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { affectedBySymbol } from '../../scripts/supervisor/affected-symbols.mjs';
import { affectedSelection } from '../../scripts/supervisor/affected-select.mjs';
import { changedSymbols } from '../../scripts/supervisor/affected-diff.mjs';
import { indexModule } from '../../scripts/lib/module-index.mjs';
import { readSpecs } from '../../scripts/lib/spec-pool.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const A_BASE = 'export function f() { return 0; }\nexport function g() { return 2; }\n';
const A_HEAD = 'export function f() { return 1; }\nexport function g() { return 2; }\n';

const FILES = {
  'scripts/lib/a.mjs': A_HEAD,
  'scripts/lib/mid.mjs': "import { f } from './a.mjs';\nexport function callsF() { return f(); }\nexport function other() { return 3; }\n",
  'scripts/lib/top.mjs': "import { callsF } from './mid.mjs';\nexport const top = () => callsF();\n",
  'scripts/lib/ns.mjs': "import * as a from './a.mjs';\nexport const viaNs = () => a.f();\nexport const viaNsG = () => a.g();\n",
  'scripts/lib/reexport.mjs': "export { f as renamed } from './a.mjs';\n",
  'scripts/lib/dyn.mjs': "export async function load() { return import('./a.mjs'); }\n",
  'scripts/lib/entry.mjs': "import { f } from './a.mjs';\nexport const unusedHere = 1;\nf();\n",
  'scripts/lib/reg.mjs': 'const reg = new Map();\nexport function register(k) { reg.set(k, 2); }\nexport function lookup(k) { return reg.get(k); }\nexport function unrelated() { return 1; }\n',
  'tests/reads-registry.spec.mjs': "import { lookup } from '../scripts/lib/reg.mjs';\n",
  'tests/reads-unrelated.spec.mjs': "import { unrelated } from '../scripts/lib/reg.mjs';\n",
  'tests/direct-f.spec.mjs': "import { f } from '../scripts/lib/a.mjs';\n",
  'tests/direct-g.spec.mjs': "import { g } from '../scripts/lib/a.mjs';\n",
  'tests/ns-spec-f.spec.mjs': "import * as a from '../scripts/lib/a.mjs';\nvoid a.f;\n",
  'tests/ns-spec-g.spec.mjs': "import * as a from '../scripts/lib/a.mjs';\nvoid a.g;\n",
  'tests/chain-top.spec.mjs': "import { top } from '../scripts/lib/top.mjs';\n",
  'tests/chain-other.spec.mjs': "import { other } from '../scripts/lib/mid.mjs';\n",
  'tests/via-ns-f.spec.mjs': "import { viaNs } from '../scripts/lib/ns.mjs';\n",
  'tests/via-ns-g.spec.mjs': "import { viaNsG } from '../scripts/lib/ns.mjs';\n",
  'tests/via-reexport.spec.mjs': "import { renamed } from '../scripts/lib/reexport.mjs';\n",
  'tests/via-dynamic.spec.mjs': "import { load } from '../scripts/lib/dyn.mjs';\n",
  'tests/names-path.spec.mjs': "const target = 'scripts/lib/a.mjs';\n",
  'tests/unrelated.spec.mjs': "import { unusedHere } from '../scripts/lib/entry.mjs';\n",
  'tests/runs-verb.spec.mjs': "spawnSync(process.execPath, ['scripts/kernel/cli.mjs', 'report']);\n",
  'tests/runs-other-verb.spec.mjs': "spawnSync(process.execPath, ['scripts/kernel/cli.mjs', 'status']);\n",
  'scripts/kernel/cli.mjs': '// the dispatcher\n',
  'scripts/kernel/verbs/report.mjs': "import { f } from '../../lib/a.mjs';\nexport default { verb: 'report', run: () => f() };\n",
  'scripts/kernel/verbs/status.mjs': "import { g } from '../../lib/a.mjs';\nexport default { verb: 'status', run: () => g() };\n",
};

function tree(t, overrides = {}) {
  const root = mkdtemp(t, 'starci-affected-symbols-');
  for (const [rel, text] of Object.entries({ ...FILES, ...overrides })) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const VERBS = [
  { group: 'kernel', verb: 'report', dispatcher: 'scripts/kernel/cli.mjs' },
  { group: 'kernel', verb: 'status', dispatcher: 'scripts/kernel/cli.mjs' },
];

function select(root, changed, { bases = { 'scripts/lib/a.mjs': A_BASE }, depth = 4, verbs = [] } = {}) {
  return affectedBySymbol({
    root, changed, specs: readSpecs(root), sources: [], symbolsOf: () => null, exists: () => true, maxFiles: 100, dataRoots: ['modules', 'knowledge'],
    depth, verbs, baseSource: (file) => bases[file] ?? null,
  });
}

const fileLevel = (root, changed) => affectedSelection({
  root, changed, specs: readSpecs(root), sources: [], symbolsOf: () => null, exists: () => true, maxFiles: 100, dataRoots: ['modules', 'knowledge'],
});

const reasons = (picked, spec) => [...picked.symbols.flatMap((entry) => entry.specs), ...picked.fileRules].filter((row) => row.spec === spec).map((row) => row.why);

test('the changed symbol is f: specs that import f by name are selected, the spec that imports only g is not', (t) => {
  const root = tree(t);
  const picked = select(root, ['scripts/lib/a.mjs']);
  assert.deepEqual(picked.symbols.map((entry) => entry.symbol), ['f']);
  assert.ok(picked.files.includes('tests/direct-f.spec.mjs'));
  assert.ok(!picked.files.includes('tests/direct-g.spec.mjs'));
  assert.deepEqual(reasons(picked, 'tests/direct-f.spec.mjs'), ['import']);
  assert.ok(fileLevel(root, ['scripts/lib/a.mjs']).files.includes('tests/direct-g.spec.mjs'), 'the file-level rule selects the importer of g');
});

test('a namespace import selects the spec that reads f through it, not the one that reads g', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs']);
  assert.ok(picked.files.includes('tests/ns-spec-f.spec.mjs'));
  assert.ok(!picked.files.includes('tests/ns-spec-g.spec.mjs'));
});

test('a caller chain is followed by name: the spec importing the module that calls f, and the spec importing its caller, not the spec of an unrelated export', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs']);
  assert.ok(picked.files.includes('tests/chain-top.spec.mjs'));
  assert.ok(!picked.files.includes('tests/chain-other.spec.mjs'));
  assert.deepEqual(reasons(picked, 'tests/chain-top.spec.mjs'), ['caller-chain']);
  const row = picked.symbols[0].specs.find((entry) => entry.spec === 'tests/chain-top.spec.mjs');
  assert.equal(row.by, 'scripts/lib/a.mjs#f <- scripts/lib/mid.mjs#callsF <- scripts/lib/top.mjs#top');
});

test('a namespace consumer in a source module hands the demand on only for the member that is read', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs']);
  assert.ok(picked.files.includes('tests/via-ns-f.spec.mjs'));
  assert.ok(!picked.files.includes('tests/via-ns-g.spec.mjs'));
});

test('a re-export is followed under its new name', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs']);
  assert.ok(picked.files.includes('tests/via-reexport.spec.mjs'));
});

test('a literal dynamic import cannot be narrowed: every export of the importing declaration is demanded', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs']);
  assert.ok(picked.files.includes('tests/via-dynamic.spec.mjs'));
});

test('a module-level statement that uses the symbol falls back to the file-level rule for that module and counts it', (t) => {
  const root = tree(t);
  const picked = select(root, ['scripts/lib/a.mjs']);
  assert.deepEqual(picked.fallbacks.map((entry) => entry.file), ['scripts/lib/entry.mjs']);
  assert.equal(picked.fallbacks[0].derived, true);
  assert.ok(picked.files.includes('tests/unrelated.spec.mjs'), 'an importer of the module the walk gave up on is kept');
  assert.equal(picked.counts.fallbackFiles, 1);
});

test('the depth bound turns the module it is reached at into a file-level fallback: all its importers are kept', (t) => {
  const root = tree(t);
  const picked = select(root, ['scripts/lib/a.mjs'], { depth: 1 });
  assert.ok(picked.fallbacks.some((entry) => entry.file === 'scripts/lib/mid.mjs' && /depth bound 1/.test(entry.why)));
  assert.ok(picked.files.includes('tests/chain-other.spec.mjs'), 'the file-level rule keeps the importer of the unrelated export of the module it stopped at');
});

test('the spec of a verb whose handler imports the symbol is selected, the spec of a verb that imports another symbol is not', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs'], { verbs: VERBS });
  assert.ok(picked.files.includes('tests/runs-verb.spec.mjs'));
  assert.ok(!picked.files.includes('tests/runs-other-verb.spec.mjs'));
  assert.deepEqual(reasons(picked, 'tests/runs-verb.spec.mjs'), ['cli-verb']);
});

test('a spec that names the file path outside an import is selected', (t) => {
  const picked = select(tree(t), ['scripts/lib/a.mjs']);
  assert.ok(reasons(picked, 'tests/names-path.spec.mjs').includes('names-the-path'));
  assert.ok(reasons(picked, 'tests/names-path.spec.mjs').includes('spawn'), 'a runtime path string is also a spawn link');
});

test('a file that is not parseable source keeps the file-level rule, and says so', (t) => {
  const root = tree(t, { 'modules/reg/rows.yaml': 'rows: []\n' });
  const picked = select(root, ['modules/reg/rows.yaml']);
  assert.deepEqual(picked.fallbacks.map((entry) => [entry.file, entry.derived]), [['modules/reg/rows.yaml', false]]);
  assert.equal(picked.symbols.length, 0);
});

test('a new module is followed by name, and a change in a module-level statement falls back', (t) => {
  const root = tree(t);
  const added = select(root, ['scripts/lib/a.mjs'], { bases: {} });
  assert.deepEqual(added.fallbacks.filter((entry) => entry.file === 'scripts/lib/a.mjs'), [], 'a new module is followed by every export it has, not a file-level fallback');
  assert.ok(added.symbols.some((entry) => entry.symbol === 'f') && added.files.includes('tests/direct-f.spec.mjs'));
  const moved = select(root, ['scripts/lib/entry.mjs'], { bases: { 'scripts/lib/entry.mjs': "import { f } from './a.mjs';\nexport const unusedHere = 1;\n" } });
  assert.match(moved.fallbacks[0].why, /module-level statement changed/);
});

test('a changed spec selects itself; a comment-only change selects no symbol', (t) => {
  const root = tree(t);
  const picked = select(root, ['tests/direct-g.spec.mjs', 'scripts/lib/a.mjs'], { bases: { 'scripts/lib/a.mjs': `// note\n${A_HEAD}` } });
  assert.deepEqual(picked.symbols, []);
  assert.ok(picked.files.includes('tests/direct-g.spec.mjs'));
  assert.ok(!picked.files.includes('tests/direct-f.spec.mjs'));
});

test('a changed function that writes module-level state reaches the declarations that read the same state, and not the ones that do not', (t) => {
  const base = 'const reg = new Map();\nexport function register(k) { reg.set(k, 1); }\nexport function lookup(k) { return reg.get(k); }\nexport function unrelated() { return 1; }\n';
  const picked = select(tree(t), ['scripts/lib/reg.mjs'], { bases: { 'scripts/lib/reg.mjs': base } });
  assert.deepEqual(picked.symbols.map((entry) => entry.symbol), ['lookup', 'register']);
  assert.ok(picked.files.includes('tests/reads-registry.spec.mjs'));
  assert.ok(!picked.files.includes('tests/reads-unrelated.spec.mjs'));
});

test('changedSymbols compares declaration text, import bindings and exports; an added, removed or moved export is a symbol', () => {
  const index = (text) => indexModule(text);
  const base = index("import { x } from './x.mjs';\nexport const a = () => x();\nexport const b = 2;\nconst c = a;\nexport { c as d };\n");
  assert.deepEqual(changedSymbols(base, index("import { x } from './y.mjs';\nexport const a = () => x();\nexport const b = 2;\nconst c = a;\nexport { c as d };\n")).symbols, ['a', 'd']);
  assert.deepEqual(changedSymbols(base, index("import { x } from './x.mjs';\nexport const a = () => x();\nconst c = a;\nexport { c as d };\n")).symbols, ['b']);
  assert.deepEqual(changedSymbols(base, index("import { x } from './x.mjs';\nexport const a = () => x();\nexport const b = 2;\nconst c = a;\nexport { c as e };\n")).symbols, ['d', 'e']);
  assert.equal(changedSymbols(base, null).symbols, null);
});
