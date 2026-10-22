// What "loosens a gate" means is judged over the diff of one change (scripts/lib/gate-loosening.mjs, the runtime's land gate and its
// gate-loosening self-check). A change that renames a directory may move the allowlist and rule entries that name it: an entry moved with
// the rename, and nothing else, is no loosening; an entry that also widens, or an entry added beside the move, still is.
import test from 'node:test';
import assert from 'node:assert/strict';
import { looseningsOf, movedLinesOf, renamedPrefixesOf } from '../runtime/scripts/lib/gate-loosening.mjs';

const RULES = Object.freeze({
  gateFiles: ['knowledge/hfs/rules.yaml'],
  allowlistFiles: ['modules/kernel/allowlist.yaml'],
  thresholds: { floors: ['min'], ceilings: ['max'] },
  productPrefixes: ['scripts/'],
  specRoots: ['examples/'],
  skipMarkers: ['.skip('],
  assertionMarkers: ['expect('],
});

/** The `git diff --name-status -M` lines of a change that renamed the example directory old-app to new-app. */
const EXAMPLE_RENAME = [
  'R100\texamples/old-app/be/contracts/billing/schema.graphql\texamples/new-app/be/contracts/billing/schema.graphql',
  'R100\texamples/old-app/be/tsconfig.json\texamples/new-app/be/tsconfig.json',
  'R087\texamples/old-app/package.json\texamples/new-app/package.json',
].join('\n');

/** A unified diff (`--no-renames -U0`) of the two gate files, from the removed and added lines of each. */
function diffOf({ allowlist = { removed: [], added: [] }, rules = { removed: [], added: [] } }) {
  const file = (name, { removed, added }) => [
    `diff --git a/${name} b/${name}`, `--- a/${name}`, `+++ b/${name}`, '@@ -1 +1 @@',
    ...removed.map((line) => `-${line}`), ...added.map((line) => `+${line}`),
  ];
  return [...file('modules/kernel/allowlist.yaml', allowlist), ...file('knowledge/hfs/rules.yaml', rules)].join('\n');
}

const MOVED_ALLOWLIST = {
  removed: ['    - path: examples/old-app/be/contracts/billing', '    - path: examples/old-app/be/tsconfig.json'],
  added: ['    - path: examples/new-app/be/contracts/billing', '    - path: examples/new-app/be/tsconfig.json'],
};
const MOVED_RULES = {
  removed: ['      - {path: examples/old-app/be/tsconfig.json, edition: full}'],
  added: ['      - {path: examples/new-app/be/tsconfig.json, edition: full}'],
};

test('the renamed prefix of a directory rename is its old and new directory', () => {
  assert.deepEqual(renamedPrefixesOf(EXAMPLE_RENAME), [{ from: 'examples/old-app', to: 'examples/new-app' }]);
});

test('an old prefix whose files moved two ways names no single move and is dropped', () => {
  const split = [EXAMPLE_RENAME, 'R100\texamples/old-app/hfs.json\tarchive/elsewhere/hfs.json'].join('\n');
  assert.deepEqual(renamedPrefixesOf(split), []);
});

test('only rename lines count: an added, modified or deleted file names no move', () => {
  assert.deepEqual(renamedPrefixesOf('A\texamples/new-app/x.ts\nM\texamples/old-app/y.ts\nD\texamples/old-app/z.ts'), []);
});

test('a pure rename of the example directory moves its allowlist and rule entries: no loosening', () => {
  const renamed = renamedPrefixesOf(EXAMPLE_RENAME);
  assert.deepEqual(looseningsOf(diffOf({ allowlist: MOVED_ALLOWLIST, rules: MOVED_RULES }), RULES, { renamed }), []);
});

test('without the rename the same diff is a removed check and two added exceptions', () => {
  const kinds = looseningsOf(diffOf({ allowlist: MOVED_ALLOWLIST, rules: MOVED_RULES }), RULES).map((finding) => finding.kind);
  assert.deepEqual(kinds, ['allowlist-added', 'allowlist-added', 'check-removed']);
});

test('a rename that also widens an entry to a glob is still an added exception', () => {
  const widened = {
    removed: ['    - path: examples/old-app/be/contracts/billing'],
    added: ['    - path: examples/new-app/be/**'],
  };
  const found = looseningsOf(diffOf({ allowlist: widened }), RULES, { renamed: renamedPrefixesOf(EXAMPLE_RENAME) });
  assert.deepEqual(found.map(({ kind, detail }) => ({ kind, detail })), [{ kind: 'allowlist-added', detail: '- path: examples/new-app/be/**' }]);
});

test('an entry added beside a pure move is still an added exception', () => {
  const extra = { removed: MOVED_ALLOWLIST.removed, added: [...MOVED_ALLOWLIST.added, '    - path: examples/new-app/fe/tsconfig.json'] };
  const found = looseningsOf(diffOf({ allowlist: extra }), RULES, { renamed: renamedPrefixesOf(EXAMPLE_RENAME) });
  assert.deepEqual(found.map(({ kind, detail }) => ({ kind, detail })), [{ kind: 'allowlist-added', detail: '- path: examples/new-app/fe/tsconfig.json' }]);
});

test('a rule removed during a rename, with no moved counterpart, is still a removed check', () => {
  const dropped = { removed: MOVED_RULES.removed, added: [] };
  const found = looseningsOf(diffOf({ rules: dropped }), RULES, { renamed: renamedPrefixesOf(EXAMPLE_RENAME) });
  assert.deepEqual(found.map(({ kind }) => kind), ['check-removed']);
});

test('a prefix is rewritten only as a whole path, never inside a longer name', () => {
  const entry = { file: 'modules/kernel/allowlist.yaml', removed: ['- path: examples/old-app-v2/x'], added: ['- path: examples/new-app-v2/x'] };
  assert.deepEqual(movedLinesOf(entry, [{ from: 'examples/old-app', to: 'examples/new-app' }]), entry);
});
