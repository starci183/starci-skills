import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, findings, runArch } from './_hfs-arch-fixture.mjs';

// HFS check 7 (R21 HFS_DUPLICATE_CODE): ruleParams.<profile>.duplicateBlock is {lines: 8, tokens: 60} in the shipped manifest,
// the one definition of the threshold; a copy inside one owner counts like a copy across owners.
const A = 'src/modules/domain/alpha/alpha.service.ts';
const B = 'src/modules/domain/beta/beta.service.ts';
const A2 = 'src/modules/domain/alpha/alpha.contracts.ts';

/** A function of `statements + 4` lines: signature, accumulator, the body statements, return and the closing brace. */
function helper(name, statements, { literal = 1, variable = 'value' } = {}) {
  // Eleven line shapes, each lengthened by a chain of 0-6 operands chosen by the statement index: the shape sequence never repeats
  // inside a body of up to 77 statements, so a body is one block. A run that repeated would be a clone of the file with itself.
  const chain = (i) => ` + ${literal}`.repeat(i % 7);
  const patterns = [
    (i) => `  const ${variable}${i} = input.items[${i}] ?? ${literal}${chain(i)};`,
    (i) => `  if (${variable}${i - 1} > ${literal + i}${chain(i)}) total += ${variable}${i - 1};`,
    (i) => `  total = total * ${literal + 2} + ${i}${chain(i)};`,
    (i) => `  for (const entry of input.items) { total += entry * ${literal + i}${chain(i)}; }`,
    (i) => `  while (total > ${literal + i}${chain(i)}) total -= ${i};`,
    (i) => `  total = Math.max(total, input.items.length + ${literal + i}${chain(i)});`,
    (i) => `  input.items.push(total % ${literal + i + 1}${chain(i)});`,
    (i) => `  total += input.items.reduce((sum, item) => sum + item * ${literal + i}${chain(i)}, 0);`,
    (i) => `  if (!input.items.length) return ${literal + i}${chain(i)};`,
    (i) => `  total = input.items.map((item) => item + ${literal + i}${chain(i)}).length;`,
    (i) => `  try { total += JSON.parse(String(${i}${chain(i)})); } catch { total = ${literal}; }`,
  ];
  const body = Array.from({ length: statements }, (_, i) => patterns[i % patterns.length](i));
  return `export function ${name}(input: { items: number[] }) {\n  let total = 0;\n${body.join('\n')}\n  return total;\n}\n`;
}
const lineCount = (text) => text.trimEnd().split('\n').length;
const cloneOf = (statements, options) => `import { z } from 'zod';\n\n${helper('compute', statements, options)}`;
const run = (root) => { const report = runArch(root); return { report, hits: findings(report, 'HFS_DUPLICATE_CODE'), coverage: report.coverage.hfsMachine.clones }; };

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
  assert.ok(hits[0].lines >= 8);
  assert.ok(hits[0].message.includes(A) && hits[0].message.includes(B));
  assert.match(hits[0].message, /threshold 8 lines \/ 60 tokens/);
  assert.match(hits[0].message, /src\/modules\/platform\/primitives\//);
  assert.match(hits[0].message, /src\/modules\/domain\/<capability>\//);
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.minLines, 8);
  assert.equal(coverage.minTokens, 60);
  assert.equal(coverage.cloneBlocks, 1);
  assert.equal(coverage.ownersInvolved, 2);
  assert.ok(coverage.duplicatedLines >= 8);
});

test('the same block twice inside one owner is a finding that says to extract it inside the owner', (t) => {
  const root = archFixture(t, { files: { [A]: cloneOf(26), [A2]: helper('again', 26, { variable: 'item' }) } });
  const { hits, coverage } = run(root);
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /extract it once inside the owner/);
  assert.equal(coverage.cloneBlocks, 1);
  assert.equal(coverage.ownersInvolved, 1);
});

test('a 7-line clone across owners is below the line threshold', (t) => {
  assert.equal(lineCount(helper('x', 3)), 7);
  const root = archFixture(t, { files: { [A]: cloneOf(3), [B]: helper('calculate', 3, { variable: 'item' }) } });
  assert.equal(run(root).hits.length, 0);
});

test('a 12-line clone across owners is a finding', (t) => {
  assert.equal(lineCount(helper('x', 8)), 12);
  const root = archFixture(t, { files: { [A]: cloneOf(8), [B]: helper('calculate', 8, { variable: 'item' }) } });
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
  assert.match(hits[0].message, /apps\/<app>\/src\/modules\/<capability>\/ when pure, apps\/<app>\/src\/hooks\/<domain>\/ for a React hook/);
});

const FE_APPS = [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }];

test('a block copied between two apps of a front end says to move it to a package; between two owners of one app it says to extract inside the app', (t) => {
  const across = runArch(archFixture(t, { profile: 'fe', apps: FE_APPS, files: {
    'apps/web/src/hooks/cart/cart.shared.ts': helper('computeCart', 26),
    'apps/admin/src/hooks/cart/cart.shared.ts': helper('computeOrders', 26, { variable: 'item' }),
  } }));
  const between = findings(across, 'HFS_DUPLICATE_CODE').filter((hit) => hit.twin.path !== hit.path);
  assert.ok(between.length >= 1, JSON.stringify(between, null, 1));
  for (const hit of between) {
    assert.match(hit.message, /move it to a package \(packages\/<pkg>/);
    assert.doesNotMatch(hit.message, /extract it once/);
  }
  const within = runArch(archFixture(t, { profile: 'fe', apps: FE_APPS, files: {
    'apps/web/src/hooks/cart/cart.shared.ts': helper('computeCart', 26),
    'apps/web/src/hooks/order/order.shared.ts': helper('computeOrders', 26, { variable: 'item' }),
  } }));
  const inside = findings(within, 'HFS_DUPLICATE_CODE').filter((hit) => hit.twin.path !== hit.path);
  assert.ok(inside.length >= 1, JSON.stringify(inside, null, 1));
  for (const hit of inside) {
    assert.match(hit.message, /extract it once inside the app/);
    assert.doesNotMatch(hit.message, /package/);
  }
});

const API_APPS = [{ name: 'core', kind: 'api' }, { name: 'other', kind: 'api' }];

test('the main.ts of two api apps and thin resolvers of two features are uniform by design: not compared; the same bodies in app.module.ts and mappers are still a clone', (t) => {
  const entries = runArch(archFixture(t, { apps: API_APPS, files: {
    'apps/core/src/main.ts': helper('boot', 26),
    'apps/other/src/main.ts': helper('start', 26, { variable: 'item' }),
    'src/features/a/transport/graphql/a.resolver.ts': helper('resolveA', 26),
    'src/features/b/transport/graphql/b.resolver.ts': helper('resolveB', 26, { variable: 'item' }),
  } }));
  assert.deepEqual(findings(entries, 'HFS_DUPLICATE_CODE'), []);
  assert.equal(entries.coverage.hfsMachine.clones.cloneBlocks, 0);
  const shared = runArch(archFixture(t, { apps: API_APPS, files: {
    'apps/core/src/app.module.ts': helper('composeCore', 26),
    'apps/other/src/app.module.ts': helper('composeOther', 26, { variable: 'item' }),
    'src/features/a/transport/graphql/a.mapper.ts': helper('mapA', 26),
    'src/features/b/transport/graphql/b.mapper.ts': helper('mapB', 26, { variable: 'item' }),
  } }));
  const paths = findings(shared, 'HFS_DUPLICATE_CODE').flatMap((hit) => [hit.path, hit.twin.path]);
  assert.ok(paths.includes('apps/core/src/app.module.ts'), paths.join(', '));
  assert.ok(paths.includes('src/features/a/transport/graphql/a.mapper.ts'), paths.join(', '));
});
