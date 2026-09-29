import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, findings, runArch } from './_hfs-arch-fixture.mjs';

// HFS check 7 (HFS_DUPLICATE_BLOCK): ruleParams.<profile>.duplicateBlockLines is 25 in the shipped manifest.
const A = 'src/modules/domain/alpha/alpha.service.ts';
const B = 'src/modules/domain/beta/beta.service.ts';
const A2 = 'src/modules/domain/alpha/alpha.contracts.ts';

/** A function of `statements + 4` lines: signature, accumulator, the body statements, return and the closing brace. */
function helper(name, statements, { literal = 1, variable = 'value' } = {}) {
  // Eleven different line shapes: a block of one repeated shape is boilerplate and is deliberately ignored by the check.
  const patterns = [
    (i) => `  const ${variable}${i} = input.items[${i}] ?? ${literal};`,
    (i) => `  if (${variable}${i - 1} > ${literal + i}) total += ${variable}${i - 1};`,
    (i) => `  total = total * ${literal + 2} + ${i};`,
    (i) => `  for (const entry of input.items) { total += entry * ${literal + i}; }`,
    (i) => `  while (total > ${literal + i}) total -= ${i};`,
    (i) => `  total = Math.max(total, input.items.length + ${literal + i});`,
    (i) => `  input.items.push(total % ${literal + i + 1});`,
    (i) => `  total += input.items.reduce((sum, item) => sum + item * ${literal + i}, 0);`,
    (i) => `  if (!input.items.length) return ${literal + i};`,
    (i) => `  total = input.items.map((item) => item + ${literal + i}).length;`,
    (i) => `  try { total += JSON.parse(String(${i})); } catch { total = ${literal}; }`,
  ];
  const body = Array.from({ length: statements }, (_, i) => patterns[i % patterns.length](i));
  return `export function ${name}(input: { items: number[] }) {\n  let total = 0;\n${body.join('\n')}\n  return total;\n}\n`;
}
const lineCount = (text) => text.trimEnd().split('\n').length;
const cloneOf = (statements, options) => `import { z } from 'zod';\n\n${helper('compute', statements, options)}`;
const run = (root) => { const report = runArch(root); return { report, hits: findings(report, 'HFS_DUPLICATE_BLOCK'), coverage: report.coverage.hfsMachine.clones }; };

test('a 30-line body copied to another owner with renamed identifiers and changed literals is one finding naming both files', (t) => {
  assert.equal(lineCount(helper('x', 26)), 30);
  const root = archFixture(t, { files: {
    [A]: cloneOf(26, { literal: 1, variable: 'value' }),
    [B]: `import { other } from './other';\n\n${helper('calculate', 26, { literal: 9, variable: 'item' })}`,
  } });
  const { hits, coverage } = run(root);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, A);
  assert.equal(hits[0].twin.path, B);
  assert.ok(hits[0].lines >= 25);
  assert.ok(hits[0].message.includes(A) && hits[0].message.includes(B));
  assert.match(hits[0].message, /src\/modules\/platform\/primitives\//);
  assert.match(hits[0].message, /src\/modules\/domain\/<capability>\//);
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.minLines, 25);
  assert.equal(coverage.cloneBlocks, 1);
  assert.equal(coverage.ownersInvolved, 2);
  assert.ok(coverage.duplicatedLines >= 25);
});

test('the same block twice inside one owner is not a finding', (t) => {
  const root = archFixture(t, { files: { [A]: cloneOf(26), [A2]: helper('again', 26, { variable: 'item' }) } });
  const { hits, coverage } = run(root);
  assert.equal(hits.length, 0);
  assert.equal(coverage.cloneBlocks, 0);
});

test('a 24-line clone across owners is below the threshold', (t) => {
  assert.equal(lineCount(helper('x', 20)), 24);
  const root = archFixture(t, { files: { [A]: cloneOf(20), [B]: helper('calculate', 20, { variable: 'item' }) } });
  assert.equal(run(root).hits.length, 0);
});

test('a 25-line clone across owners is a finding', (t) => {
  assert.equal(lineCount(helper('x', 21)), 25);
  const root = archFixture(t, { files: { [A]: cloneOf(21), [B]: helper('calculate', 21, { variable: 'item' }) } });
  assert.equal(run(root).hits.length, 1);
});

test('different structure with the same size is not a clone', (t) => {
  const other = `export function shape(input: string[]) {\n${Array.from({ length: 30 }, (_, i) => `  for (const entry of input) { if (entry.length > ${i}) { console.log(entry); } }`).join('\n')}\n}\n`;
  const root = archFixture(t, { files: { [A]: cloneOf(26), [B]: other } });
  assert.equal(run(root).hits.length, 0);
});

test('the frontend message names the app modules and hooks homes', (t) => {
  const first = 'apps/web/src/modules/alpha/alpha.ts';
  const second = 'apps/web/src/modules/beta/beta.ts';
  const root = archFixture(t, { profile: 'fe', files: { [first]: cloneOf(26), [second]: helper('calculate', 26, { variable: 'item' }) } });
  const { hits } = run(root);
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /apps\/web\/src\/modules\/<capability>\/ \(pure\) or apps\/web\/src\/hooks\/<domain>\/ \(React hook\)/);
});
