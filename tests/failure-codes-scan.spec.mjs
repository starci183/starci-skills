// scripts/checks/failure-codes.mjs counts a bracketed UPPER_SNAKE name as an emitted code only in text (a message,
// a template, a comment), never where JavaScript code reads a constant: an element access, an array literal or a
// computed key holding one identifier.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emittedCodes } from '../scripts/checks/failure-codes.mjs';

// Each fixture is removed when its test ends: under the suite's isolated-temp preload a leftover temp dir fails the spec file.
function fixture(t, source) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-failure-codes-scan-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const write = (rel, text) => { fs.mkdirSync(path.dirname(path.join(base, rel)), { recursive: true }); fs.writeFileSync(path.join(base, rel), text); };
  write('scripts/checks/failure-codes.not-codes', '# none\n');
  write('scripts/land.mjs', source);
  write('modules/models/kinds.yaml', 'vocabularies: {}\n');
  write('engine/migrations/runtime/0001-init.sql', '');
  return base;
}
const codes = (t, lines) => emittedCodes(fixture(t, lines.join('\n'))).map((e) => e.code);

test('a computed member access with a constant key is not an emitted code', (t) => {
  const found = codes(t, [
    "export const MIRROR_CHECK = 'packages/hfs/scripts/sync-runtime.mjs';",
    'export function verdict(baseline, r) {',
    '  baseline[MIRROR_CHECK] = r;',
    '  return [baseline?.[MIRROR_CHECK], read()[MIRROR_CHECK], baseline[0][MIRROR_CHECK]];',
    '}',
  ]);
  assert.ok(!found.includes('MIRROR_CHECK'), found.join(', '));
});

test('an array literal or a computed key holding one constant is not an emitted code', (t) => {
  const found = codes(t, [
    "export const SKILL_ROOT = 'D:/runtime';",
    'export const plan = { repos: [SKILL_ROOT], byRoot: { [SKILL_ROOT]: true } };',
  ]);
  assert.ok(!found.includes('SKILL_ROOT'), found.join(', '));
});

test('a bracketed code in a message, a multi-line template or a comment is still an emitted code', (t) => {
  const found = codes(t, [
    'export const fail = (detail) => { throw new Error(`[TARGET_MISSING] ${detail}`); };',
    'export const explain = (n) => `refused because',
    '  the record is ${n} days old [PLAN_STALE]`;',
    '/** A JSDoc line naming [DOC_CODE] is text. */',
  ]);
  for (const code of ['TARGET_MISSING', 'PLAN_STALE', 'DOC_CODE']) assert.ok(found.includes(code), `${code} in ${found.join(', ')}`);
});
