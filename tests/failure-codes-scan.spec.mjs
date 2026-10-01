// scripts/checks/failure-codes.mjs counts a bracketed UPPER_SNAKE name as an emitted code only in text (a message
// prefix or a flow list), never in a computed member access that reads a constant.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { emittedCodes } from '../scripts/checks/failure-codes.mjs';

function fixture(source) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'failure-codes-scan-'));
  fs.mkdirSync(path.join(base, 'scripts/checks'), { recursive: true });
  fs.writeFileSync(path.join(base, 'scripts/checks/failure-codes.not-codes'), '# none\n');
  fs.writeFileSync(path.join(base, 'scripts/land.mjs'), source);
  fs.mkdirSync(path.join(base, 'modules/models'), { recursive: true });
  fs.writeFileSync(path.join(base, 'modules/models/kinds.yaml'), 'vocabularies: {}\n');
  fs.mkdirSync(path.join(base, 'engine/migrations/runtime'), { recursive: true });
  fs.writeFileSync(path.join(base, 'engine/migrations/runtime/0001-init.sql'), '');
  return base;
}
const codes = (source) => emittedCodes(fixture(source)).map((e) => e.code);

test('a computed member access with a constant key is not an emitted code', () => {
  const found = codes([
    "export const MIRROR_CHECK = 'packages/hfs/scripts/sync-runtime.mjs';",
    'export function verdict(baseline, r) {',
    '  baseline[MIRROR_CHECK] = r;',
    '  return [baseline?.[MIRROR_CHECK], read()[MIRROR_CHECK], baseline[0][MIRROR_CHECK]];',
    '}',
  ].join('\n'));
  assert.ok(!found.includes('MIRROR_CHECK'), found.join(', '));
});

test('a bracketed code in a message or a flow list is still an emitted code', () => {
  const found = codes([
    "export const fail = (detail) => { throw new Error(`[TARGET_MISSING] ${detail}`); };",
    'export const listed = [PLAN_STALE];',
  ].join('\n'));
  assert.ok(found.includes('TARGET_MISSING'), found.join(', '));
  assert.ok(found.includes('PLAN_STALE'), found.join(', '));
});
