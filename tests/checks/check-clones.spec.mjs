import test from 'node:test';
import assert from 'node:assert/strict';
import { cloneFindings } from '../../scripts/checks/check-clones.mjs';

// RT_DUPLICATE_CODE: a token-normalised block of 8+ lines and 60+ tokens appearing twice is code copied instead of shared.
const BLOCK = (name, literal) => `export function ${name}(rows) {
  const out = [];
  for (const row of rows) {
    if (row.kind !== '${literal}') continue;
    const label = String(row.label ?? '').trim();
    if (!label) continue;
    out.push({ id: row.id, label, size: label.length });
  }
  return out.sort((a, b) => a.size - b.size || a.id - b.id);
}
`;

test('a block copied into another file under other names and literals is flagged on the later file', () => {
  const findings = cloneFindings([
    { rel: 'scripts/a/first.mjs', text: BLOCK('pickA', 'a') },
    { rel: 'scripts/b/second.mjs', text: BLOCK('pickB', 'b') },
  ]);
  assert.deepEqual(findings.map((f) => [f.code, f.path]), [['RT_DUPLICATE_CODE', 'scripts/b/second.mjs']]);
  assert.match(findings[0].message, /also at scripts\/a\/first\.mjs:1/);
});

test('two different blocks and short repeats are not clones', () => {
  assert.deepEqual(cloneFindings([
    { rel: 'scripts/a/first.mjs', text: BLOCK('pickA', 'a') },
    { rel: 'scripts/b/second.mjs', text: 'export const total = (rows) => rows.reduce((sum, row) => sum + row.amount, 0);\nexport const count = (rows) => rows.length;\n' },
  ]), []);
});

test('a table of one repeated row shape is not a clone', () => {
  const table = (name) => `export const ${name} = {\n${Array.from({ length: 12 }, (_, i) => `  "key-${i}": "error",`).join('\n')}\n};\n`;
  assert.deepEqual(cloneFindings([
    { rel: 'packages/x/a.mjs', text: table('one') },
    { rel: 'packages/x/b.mjs', text: table('two') },
  ]), []);
});

test('tests are not scanned', () => {
  assert.deepEqual(cloneFindings([
    { rel: 'scripts/a/first.mjs', text: BLOCK('pickA', 'a') },
    { rel: 'tests/copy.spec.mjs', text: BLOCK('pickB', 'b') },
  ]), []);
});
