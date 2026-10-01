// land-invariant-specs.spec.mjs — the land gate's touching selection includes tree-wide invariant specs, and the
// specs-red-on-main DI it opens carries a real due time.
//
// 2026-10 (DI sdi-dcbe55d2, "specs red on main"): a land edited scripts/supervisor/land.mjs with a raw recursive
// fs.rmSync; tests/api-fs/safe-remove.spec.mjs catches exactly that, but it scans scripts/ bin/ engine/ and never names
// land.mjs, so the touching selection skipped it and main went red. A spec that scans whole roots declares them once
// as `export const INVARIANT_ROOTS = [...]` (the list its own walk uses); the gate reads that declaration and runs the
// spec whenever a changed file lies under one of those roots. The DI the gate then opened had dueAt null (listed
// "due 1970-01-01"): it now gets the Supervisor decider's default due (decisions.mjs DEFAULT_DUE_MS.supervisor).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { specsTouching, invariantRootsOf, specsRedOnMainDecision } from '../../scripts/supervisor/land.mjs';
import { DEFAULT_DUE_MS } from '../../scripts/machine/decisions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const spec = (file) => ({ file, text: fs.readFileSync(path.join(root, file), 'utf8') });
const pool = () => [spec('tests/api-fs/safe-remove.spec.mjs'), spec('tests/repo/declared-deps.spec.mjs'), { file: 'tests/other.spec.mjs', text: 'nothing relevant' }];

test('the tree-wide invariant specs declare the roots they scan', () => {
  assert.deepEqual(invariantRootsOf(spec('tests/api-fs/safe-remove.spec.mjs').text), ['scripts', 'bin', 'engine']);
  assert.deepEqual(invariantRootsOf(spec('tests/repo/declared-deps.spec.mjs').text), ['scripts', 'engine', 'modules', 'bin', 'ext']);
  assert.deepEqual(invariantRootsOf('const x = 1;'), []);
});

test('a change under scripts/ selects the invariant specs that scan scripts/ though neither names the file', () => {
  const picked = specsTouching(['scripts/supervisor/land.mjs'], { specs: pool() });
  assert.ok(picked.includes('tests/api-fs/safe-remove.spec.mjs'), JSON.stringify(picked));
  assert.ok(picked.includes('tests/repo/declared-deps.spec.mjs'), JSON.stringify(picked));
  assert.ok(!picked.includes('tests/other.spec.mjs'));
});

test('a change under a root only one invariant spec scans selects only that spec', () => {
  assert.deepEqual(specsTouching(['modules/kernel/x.yaml'], { specs: pool() }), ['tests/repo/declared-deps.spec.mjs']);
});

test('a change only under docs/ selects no invariant spec', () => {
  assert.deepEqual(specsTouching(['docs/notes.md', 'scriptsy.md'], { specs: pool() }), []);
});

test('the specs-red-on-main DI has a due time in the future (the Supervisor decider default)', () => {
  const now = 1_790_000_000_000;
  const redOnMain = { name: 'specs', base: 'a'.repeat(40), inherited: [{ file: 'tests/api-fs/safe-remove.spec.mjs', name: 'no raw rm' }] };
  const di = specsRedOnMainDecision({ redOnMain, root: 'D:/x/.claude', commits: ['b'.repeat(40)], now });
  assert.equal(di.kind, 'runtime-defect');
  assert.equal(di.keyParts.kind, 'specs-red-on-main');
  assert.equal(di.dueAt, now + DEFAULT_DUE_MS.supervisor);
  assert.ok(di.dueAt > now);
});
