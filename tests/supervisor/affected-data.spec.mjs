// affected-data.spec.mjs - the precise rules for changed files that are not followable modules (scripts/supervisor/affected-data.mjs), on small fixture trees:
// a generated output maps to its generator, an added entry to the checks of the data file, a rewritten key to the specs that name it, and a generic key to nothing.
// The file-level rule would have selected every importer of every reader (hundreds of specs on the real tree); each case asserts the dropped specs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { affectedBySymbol } from '../../scripts/supervisor/affected-symbols.mjs';
import { affectedSelection } from '../../scripts/supervisor/affected-select.mjs';
import { keysOf } from '../../scripts/supervisor/affected-data.mjs';
import { readSpecs } from '../../scripts/lib/spec-pool.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const FILES = {
  'modules/kernel/registry.yaml': 'alpha-code:\n  title: a\nbeta-code:\n  title: b\n',
  'modules/models/pins.yaml': 'pin:\n  value: abc\n',
  'docs/cli.md': '# cli\n',
  'scripts/cli/gen-catalog.mjs': "export function gen() { return 'docs/cli.md'; }\n",
  'scripts/lib/registry-reader.mjs': "import fs from 'node:fs';\nexport function readRegistry() { return fs.readFileSync('modules/kernel/registry.yaml', 'utf8'); }\n",
  'scripts/lib/pin-reader.mjs': "import fs from 'node:fs';\nexport function readPins() { return fs.readFileSync('modules/models/pins.yaml', 'utf8'); }\n",
  'scripts/lib/consumer.mjs': "import { readRegistry } from './registry-reader.mjs';\nimport { readPins } from './pin-reader.mjs';\nexport const use = () => [readRegistry(), readPins()];\n",
  'tests/registry-reader.spec.mjs': "import { readRegistry } from '../scripts/lib/registry-reader.mjs';\n",
  'tests/pin-reader.spec.mjs': "import { readPins } from '../scripts/lib/pin-reader.mjs';\n",
  'tests/gen-catalog.spec.mjs': "import { gen } from '../scripts/cli/gen-catalog.mjs';\n",
  'tests/consumer-a.spec.mjs': "import { use } from '../scripts/lib/consumer.mjs';\n",
  'tests/consumer-b.spec.mjs': "import { use } from '../scripts/lib/consumer.mjs';\n",
  'tests/names-beta.spec.mjs': "const code = 'beta-code';\n",
  'tests/reads-registry.spec.mjs': "const file = 'modules/kernel/registry.yaml';\n",
};
const GENERATED = [{ output: 'docs/cli.md', generator: 'scripts/cli/gen-catalog.mjs' }];

function tree(t) {
  const root = mkdtemp(t, 'starci-affected-data-');
  for (const [rel, text] of Object.entries(FILES)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

function select(root, changed, diffs = {}) {
  const sources = Object.entries(FILES).filter(([rel]) => rel.startsWith('scripts/')).map(([file, text]) => ({ file, text }));
  return affectedBySymbol({
    root, changed, specs: readSpecs(root), sources, symbolsOf: () => null, exists: () => true, maxFiles: 100, dataRoots: ['modules', 'knowledge'], depth: 4,
    verbs: [], baseSource: () => null, generated: GENERATED, diffOf: (file) => diffs[file] ?? { added: [], removed: [] },
  });
}

const fileLevel = (root, changed) => affectedSelection({ root, changed, specs: readSpecs(root), sources: [], symbolsOf: () => null, exists: () => true, maxFiles: 100, dataRoots: ['modules'] });

test('a generated output selects the specs of its generator and the specs that read it, not the importers of its readers', (t) => {
  const root = tree(t);
  const picked = select(root, ['docs/cli.md']);
  assert.deepEqual(picked.files, ['tests/gen-catalog.spec.mjs']);
  assert.ok(picked.counts.reasons['generator-spec'] >= 1);
});

test('entries added to a registry select its own checks: the specs that read it and the specs named after its readers; the consumers of the readers are not selected', (t) => {
  const root = tree(t);
  const picked = select(root, ['modules/kernel/registry.yaml'], { 'modules/kernel/registry.yaml': { added: ['gamma-code:', '  title: c'], removed: [] } });
  assert.deepEqual([...picked.files].sort(), ['tests/reads-registry.spec.mjs', 'tests/registry-reader.spec.mjs']);
  assert.ok(fileLevel(root, ['modules/kernel/registry.yaml']).files.length >= picked.files.length);
});

test('a rewritten key selects the specs that name it; a generic key selects nothing by itself', (t) => {
  const root = tree(t);
  const named = select(root, ['modules/kernel/registry.yaml'], { 'modules/kernel/registry.yaml': { added: ['beta-code:'], removed: ['beta-code:'] } });
  assert.ok(named.files.includes('tests/names-beta.spec.mjs'), 'the spec that names beta-code');
  assert.ok(!named.files.includes('tests/consumer-a.spec.mjs'));
  const generic = select(root, ['modules/models/pins.yaml'], { 'modules/models/pins.yaml': { added: ['  value: def'], removed: ['  value: abc'] } });
  assert.deepEqual(generic.files, ['tests/pin-reader.spec.mjs'], 'value is generic; the reader spec stays');
});

test('the names on changed lines are the keys and the values of id, name, choice and kind', () => {
  assert.deepEqual(keysOf(['  - id: shape-refused', 'summary: x', '    {choice: widen}', 'a: b']).sort(), ['choice', 'id', 'shape-refused', 'summary']);
});

test('a module the CLI bin runs at load time is the verb rule\'s: the walk does not fall back to every spec that starts the bin', (t) => {
  const root = mkdtemp(t, 'starci-affected-bin-');
  const put = (rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
  put('packages/cli/src/main.mjs', 'export function main() { return 1; }\n');
  put('bin/starci.mjs', "import { main } from '../packages/cli/src/main.mjs';\nawait main();\n");
  put('tests/spawns-bin.spec.mjs', "import { spawnSync } from 'node:child_process';\nspawnSync('node', ['bin/starci.mjs']);\n");
  put('tests/imports-main.spec.mjs', "import { main } from '../packages/cli/src/main.mjs';\n");
  const run = (verbCovered) => affectedBySymbol({
    root, changed: ['packages/cli/src/main.mjs'], specs: readSpecs(root), sources: [], symbolsOf: () => null, exists: () => true, maxFiles: 100, dataRoots: [], depth: 4,
    verbs: [], baseSource: () => 'export function main() { return 0; }\n', generated: [], diffOf: () => ({ added: [], removed: [] }), verbCovered,
  });
  assert.ok(run([]).files.includes('tests/spawns-bin.spec.mjs'), 'without the policy the bin falls back to the file-level rule');
  const covered = run(['bin/starci.mjs']);
  assert.deepEqual(covered.files, ['tests/imports-main.spec.mjs']);
});
