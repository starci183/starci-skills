// What "loosens a gate" means is judged over the diff of one change (scripts/lib/gate-loosening.mjs, the runtime's land gate and its
// gate-loosening self-check). A change that renames a directory may move the allowlist and rule entries that name it: an entry moved with
// the rename, and nothing else, is no loosening; an entry that also widens, or an entry added beside the move, still is. A loosening is
// always red (owner ruling loosening-always-red): the library has no approval and the land gate step names none.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as gateLoosening from '../runtime/scripts/lib/gate-loosening.mjs';

const { looseningStep, looseningsOf, loosensReleased, movedLinesOf, renamedPrefixesOf } = gateLoosening;

const RULES = Object.freeze({
  gateFiles: ['knowledge/hfs/rules.yaml'],
  allowlistFiles: ['modules/kernel/allowlist.yaml'],
  thresholds: { floors: ['min'], ceilings: ['max'] },
  productPrefixes: ['scripts/'],
  specRoots: ['examples/'],
  skipMarkers: ['.skip('],
  assertionMarkers: ['expect('],
});

/** One rename line of `git diff --name-status -M`: R<similarity>, the old path and the new one, tab separated. */
const renameLine = (similarity, from, to) => [`R${similarity}`, from, to].join('\t');

/** The `git diff --name-status -M` lines of a change that renamed the example directory old-app to new-app. */
const EXAMPLE_RENAME = [
  renameLine(100, 'examples/old-app/be/contracts/billing/schema.graphql', 'examples/new-app/be/contracts/billing/schema.graphql'),
  renameLine(100, 'examples/old-app/be/tsconfig.json', 'examples/new-app/be/tsconfig.json'),
  renameLine(87, 'examples/old-app/package.json', 'examples/new-app/package.json'),
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
  const split = [EXAMPLE_RENAME, renameLine(100, 'examples/old-app/hfs.json', 'archive/elsewhere/hfs.json')].join('\n');
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

/** An allowlist line a removed owner approval once let through (2026-10-13): the lite example test tsconfig. */
const ONCE_APPROVED = { removed: [], added: ['    - path: examples/lite-app/be/src/tests/tsconfig.json'] };

test('a loosening an approval entry once let through is still a loosening: the library offers no approval', () => {
  const found = looseningsOf(diffOf({ allowlist: ONCE_APPROVED }), RULES);
  assert.deepEqual(found.map(({ kind }) => kind), ['allowlist-added']);
  assert.equal(gateLoosening.approved, undefined);
  assert.equal(gateLoosening.approvalIdOf, undefined);
});

test('the land gate step of a loosening is red and names no approval route, only restoring the gate', () => {
  const step = looseningStep(looseningsOf(diffOf({ allowlist: ONCE_APPROVED }), RULES));
  assert.equal(step.ok, false);
  assert.equal(step.name, 'gate-loosening');
  assert.equal(step.output, 'allowlist-added modules/kernel/allowlist.yaml: - path: examples/lite-app/be/src/tests/tsconfig.json');
  assert.match(step.hint, /restore every gate/);
  assert.doesNotMatch(`${step.hint} ${step.output}`, /approv|owner-rulings|fingerprint/i);
  assert.equal('approved' in step || 'advisory' in step || 'id' in step, false);
});

/** A reader of files at a revision, over a fixed history: the release tag and HEAD. */
const historyReader = (files) => (rev, file) => files[rev]?.[file] ?? null;
const RELEASE = 'v1.0.0-alpha.26';

test('released state: a check that the release shipped and the change removed is a loosening', () => {
  const read = historyReader({ [RELEASE]: { 'knowledge/hfs/rules.yaml': '    - {kind: hfs, id: shipped-check}\n' } });
  const finding = { kind: 'check-removed', file: 'knowledge/hfs/rules.yaml', detail: '- {kind: hfs, id: shipped-check}' };
  assert.equal(loosensReleased(finding, { base: RELEASE, read, rules: RULES }), true);
});

test('released state: a check added after the release and folded away before the next one never was a gate of a release', () => {
  const read = historyReader({ [RELEASE]: { 'knowledge/hfs/rules.yaml': '    - {kind: hfs, id: shipped-check}\n' } });
  const finding = { kind: 'check-removed', file: 'knowledge/hfs/rules.yaml', detail: '- {kind: hfs, id: added-after-release}' };
  assert.equal(loosensReleased(finding, { base: RELEASE, read, rules: RULES }), false);
});

test('released state: a clipped detail still matches the start of the released line', () => {
  const read = historyReader({ [RELEASE]: { 'knowledge/hfs/rules.yaml': '    - {kind: hfs, id: a-check-with-a-very-long-row}\n' } });
  const finding = { kind: 'check-removed', file: 'knowledge/hfs/rules.yaml', detail: '- {kind: hfs, id: a-check…' };
  assert.equal(loosensReleased(finding, { base: RELEASE, read, rules: RULES }), true);
});

test('released state: a file the release did not hold carries no released gate', () => {
  const finding = { kind: 'spec-deleted', file: 'examples/app/be/src/new.service.spec.ts', detail: 'deleted' };
  assert.equal(loosensReleased(finding, { base: RELEASE, read: historyReader({}), rules: RULES }), false);
});

test('released state: an added exception loosens whenever its file was released', () => {
  const read = historyReader({ [RELEASE]: { 'modules/kernel/allowlist.yaml': 'json-exceptions:\n' } });
  const finding = { kind: 'allowlist-added', file: 'modules/kernel/allowlist.yaml', detail: '- path: x.json' };
  assert.equal(loosensReleased(finding, { base: RELEASE, read, rules: RULES }), true);
});

test('released state: a spec weakened below what the release held loosens; one still above it does not', () => {
  const file = 'examples/app/be/src/a.service.spec.ts';
  const finding = { kind: 'assertion-weakened', file, detail: '1 assertion(s) fewer' };
  const released = { [file]: 'expect(1)\nexpect(2)\n' };
  const below = historyReader({ [RELEASE]: released, HEAD: { [file]: 'expect(1)\n' } });
  const above = historyReader({ [RELEASE]: released, HEAD: { [file]: 'expect(1)\nexpect(2)\nexpect(3)\n' } });
  assert.equal(loosensReleased(finding, { base: RELEASE, read: below, rules: RULES }), true);
  assert.equal(loosensReleased(finding, { base: RELEASE, read: above, rules: RULES }), false);
});
