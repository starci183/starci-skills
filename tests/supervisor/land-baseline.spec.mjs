// land-baseline-count-drift (land run 127, 2026-09-30 21:37Z): the "red on main too, unchanged by this land" baseline
// compared a tree check's tail text byte for byte, so check-contract-cites printing "11 dead cite(s) of 5368 checked"
// on main and "... of 5370 checked" on a candidate that only adds a contract-change file refused the land although the
// 11 dead cites were the same. The baseline compares finding lines: a candidate is unchanged-red when its findings are
// a subset of main's, and a refusal names the new ones.
import test from 'node:test';
import assert from 'node:assert/strict';
import { baselineVerdict, findingLines } from '../../scripts/supervisor/land.mjs';

const CITES = 'scripts/checks/check-contract-cites.mjs';
const DEAD = [
  'modules/kernel/contract-changes/e2e-manual-only.yaml:22  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/fe-no-tests.yaml:11  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/grammar-state-recipes-and-shape-slot-patterns.yaml:15  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/hfs-architecture-machine.yaml:68  scripts/hfs/architecture/size-growth.mjs — no such file (prose path)',
  'modules/kernel/contract-changes/hfs-patterns.yaml:47  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/hfs-secrets-guard-staged.yaml:4  scripts/old-secrets-guard.mjs — no such file (prose path)',
  'modules/kernel/contract-changes/next-spec-describe-module-and-default.yaml:8  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/shape-slot-hfs-app-tree.yaml:19  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/specs-policy-2026-09-29.yaml:29  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
  'modules/kernel/contract-changes/starci-link-removed.yaml:35  packages/hfs/templates/fe/ci-workflows/github/workflows/e2e-gone.yml — no such file (prose path)',
  'modules/kernel/contract-changes/test-kinds-unit-e2e.yaml:21  knowledge/patterns/fe/gone-test.yaml — no such file (prose path)',
];
const cites = (dead, checked) => ({ ok: false, full: [`check-contract-cites: ${dead.length} dead cite(s) of ${checked} checked`, ...dead.map((l) => `  ${l}`)].join('\n') + '\n' });

test('run-127 shape: the same 11 dead cites under a different "of N checked" count are unchanged-red', () => {
  const v = baselineVerdict(CITES, cites(DEAD, 5368), cites(DEAD, 5370));
  assert.equal(v.ok, true);
  assert.deepEqual(v.newFindings, []);
});

test('one added dead cite is red and the verdict names the new line', () => {
  const added = 'modules/kernel/contract-changes/land-live-deps-guard.yaml:9  scripts/nope.mjs — no such file (prose path)';
  const v = baselineVerdict(CITES, cites(DEAD, 5368), cites([...DEAD, added], 5370));
  assert.equal(v.ok, false);
  assert.deepEqual(v.newFindings, [added]);
});

test('a finding the land removed is fine', () => {
  const v = baselineVerdict(CITES, cites(DEAD, 5368), cites(DEAD.slice(1), 5367));
  assert.equal(v.ok, true);
  assert.deepEqual(v.newFindings, []);
});

test('main green, candidate red is red', () => {
  const v = baselineVerdict(CITES, { ok: true, full: 'check-contract-cites: 5368 cites in 900 files all resolve\n' }, cites(DEAD.slice(0, 1), 5370));
  assert.equal(v.ok, false);
  assert.deepEqual(v.newFindings, [DEAD[0]]);
});

test('no baseline, candidate red is red', () => {
  assert.equal(baselineVerdict(CITES, undefined, cites(DEAD, 5370)).ok, false);
});

test('a green candidate is ok whatever main said', () => {
  assert.equal(baselineVerdict(CITES, cites(DEAD, 5368), { ok: true, full: 'check-contract-cites: 1 cites in 1 files all resolve\n' }).ok, true);
});

test('each tree check has identifiable finding lines and its summary line is dropped', () => {
  assert.deepEqual(findingLines('scripts/checks/check-module-yaml.mjs', 'UNPARSEABLE knowledge/patterns/be/gone-cqrs.yaml: Invalid or unsupported YAML\n'), ['UNPARSEABLE knowledge/patterns/be/gone-cqrs.yaml: Invalid or unsupported YAML']);
  assert.deepEqual(findingLines('scripts/checks/check-api-surface.mjs', 'check-api-surface: verb surface drift (cli.mjs implements 57: a b)\n  modules/kernel/api-commands: missing c\n'), ['modules/kernel/api-commands: missing c']);
  assert.deepEqual(findingLines('scripts/checks/check-db-gone.mjs', '  packages/hfs/runtime/engine/db/machine.mjs:310  new DatabaseSync outside engine/db/machine.mjs\ncheck-db-gone: red\n'), ['packages/hfs/runtime/engine/db/machine.mjs:310  new DatabaseSync outside engine/db/machine.mjs']);
  assert.deepEqual(findingLines(CITES, cites(DEAD, 5368).full), DEAD);
});

test('a red run printing no finding line falls back to the exact text', () => {
  const pre = { ok: false, full: 'check-db-gone: red\n' };
  assert.equal(baselineVerdict('scripts/checks/check-db-gone.mjs', pre, { ok: false, full: 'check-db-gone: red\n' }).ok, true);
  assert.equal(baselineVerdict('scripts/checks/check-db-gone.mjs', pre, { ok: false, full: 'check-db-gone: red (2)\n' }).ok, false);
});

test('a baseline without full output (older rows) compares its output', () => {
  const pre = { ok: false, output: cites(DEAD, 5368).full };
  assert.equal(baselineVerdict(CITES, pre, cites(DEAD, 5370)).ok, true);
});
