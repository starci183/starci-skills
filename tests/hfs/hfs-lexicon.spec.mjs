// proves: HFS_APP_LEXICON@lite HFS_APP_LEXICON@full
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { lexiconFindings } from '../../scripts/hfs/rules/lexicon.mjs';
import { declarationShapeProblems } from '../../scripts/hfs/declaration-shape.mjs';
import { checkRepo } from '../../scripts/hfs/check.mjs';

const declaration = (edition, extra = {}) => ({
  hfs: 3, kind: 'app', project: 'demo', edition,
  sides: { be: { apps: [{ name: 'api', kind: 'api' }, { name: 'cli', kind: 'cli' }] }, fe: { apps: [{ name: 'web', kind: 'next' }] } },
  ...extra,
});

function tree(t, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-lexicon-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, value] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value));
  }
  return root;
}

for (const edition of ['lite', 'full']) {
  test(`HFS_APP_LEXICON ${edition}: removed words in source, copy and docs are refused`, (t) => {
    const files = {
      'hfs.json': declaration(edition, { lexicon: { removed: ['cart', 'legacy offer'] } }),
      'README.md': 'The cart holds a legacy offer.\nCart cart\n',
      'be/src/modules/domain/orders/orders.service.ts': '// CART is removed\nexport const cartService = "current";\n',
      'fe/apps/web/src/messages/en.json': { title: 'Open cart' },
      'fe/apps/web/src/app/page.tsx': 'export const AddToCart = () => <p>legacy offer</p>;',
    };
    const root = tree(t, files);
    const findings = lexiconFindings({ repoRoot: root, files: Object.keys(files), repo: { profile: 'app', edition } });
    assert.equal(findings.length, 8);
    assert.ok(findings.every((item) => item.code === 'HFS_APP_LEXICON' && item.level === 'error'));
    assert.ok(findings.some((item) => item.path.endsWith('orders.service.ts') && item.line === 2 && item.column === 14));
    assert.ok(findings.some((item) => item.path.endsWith('en.json')));
    assert.equal(findings.filter((item) => item.path === 'README.md' && item.line === 2).length, 1, 'one finding per word and line');
    assert.ok(!findings.some((item) => item.path === 'hfs.json'), 'declaring a removed word is legal');
  });

  test(`HFS_APP_LEXICON ${edition}: current vocabulary and words containing a removed token pass`, (t) => {
    const files = {
      'hfs.json': declaration(edition, { lexicon: { removed: ['cart'] }, observe: { reporter: 'sentry' } }),
      'README.md': 'The basket holds the order. Discard the discarded item. A cartography guide.',
      'be/src/modules/domain/orders/orders.service.ts': 'export const discard = (item: unknown) => item;',
      'fe/apps/web/src/messages/en.json': { title: 'Open basket' },
    };
    assert.deepEqual(lexiconFindings({ repoRoot: tree(t, files), files: Object.keys(files), repo: { profile: 'app', edition } }), []);
    assert.deepEqual(declarationShapeProblems(files['hfs.json'], ['be', 'fe']), []);
  });

  test(`HFS_APP_LEXICON ${edition}: starci app check wires the root and side scans once with Vietnamese findings`, (t) => {
    const app = declaration(edition, { lexicon: { removed: ['cart'] } });
    const files = {
      'hfs.json': app,
      'README.md': 'cart',
      'be/src/modules/domain/orders/orders.service.ts': 'export const cart = true;',
      'fe/apps/web/src/app/page.tsx': 'export default function Page() { return <p>cart</p>; }',
    };
    const result = checkRepo({ repoRoot: tree(t, files), files: Object.keys(files), tree: false });
    const findings = result.findings.filter((item) => item.code === 'HFS_APP_LEXICON');
    assert.deepEqual(findings.map((item) => item.path), Object.keys(files).slice(1));
    assert.ok(findings.every((item) => item.titleVi && item.whyVi));
    assert.ok(!result.findings.some((item) => item.code === 'HFS_DECLARATION_INVALID'));
  });

  test(`HFS_APP_LEXICON ${edition}: starci app check passes current words and an undeclared optional reporter`, (t) => {
    const files = { 'hfs.json': declaration(edition, { lexicon: { removed: ['cart'] } }), 'README.md': 'basket', 'be/src/modules/domain/orders/orders.service.ts': 'export const basket = true;' };
    const result = checkRepo({ repoRoot: tree(t, files), files: Object.keys(files), tree: false });
    assert.equal(result.findings.filter((item) => item.code === 'HFS_APP_LEXICON').length, 0);
    assert.equal(result.findings.filter((item) => item.code === 'HFS_DECLARATION_INVALID').length, 0);
  });
}

test('HFS_APP_LEXICON: literal punctuation, Unicode words and identifier separators use exact vocabulary boundaries', (t) => {
  const files = { 'README.md': 'C++ is removed. C+++ also names C++.\nĐƠN CŨ and đơn cũ.\n', 'src/old.ts': 'const OLD_CART = true; const shoppingCart = true; const Cartesian = true;' };
  const repo = { profile: 'be', edition: 'full', lexicon: { removed: ['C++', 'đơn cũ', 'cart'] } };
  const findings = lexiconFindings({ repoRoot: tree(t, files), files: Object.keys(files), repo });
  assert.deepEqual(findings.map((item) => [item.path, item.word, item.line]), [['README.md', 'C++', 1], ['README.md', 'đơn cũ', 2], ['src/old.ts', 'cart', 1]]);
});

test('HFS_APP_LEXICON: acronym boundaries are identifier segments and longer all-caps words pass', (t) => {
  const files = { 'src/old.ts': 'const XMLCart = true;\nconst CARTService = true;\nconst CARTS = true;\nconst DISCARDED = true;' };
  const findings = lexiconFindings({ repoRoot: tree(t, files), files: Object.keys(files), repo: { profile: 'be', edition: 'full', lexicon: { removed: ['cart'] } } });
  assert.deepEqual(findings.map((item) => item.line), [1, 2]);
});

test('HFS_APP_LEXICON: scoped side checks read the parent declaration and ignore untracked, binary and out-of-scope files', (t) => {
  const root = tree(t, {
    'hfs.json': declaration('lite', { lexicon: { removed: ['cart'] } }),
    'be/src/a.ts': 'cart', 'be/src/b.ts': 'cart', 'be/src/untracked.ts': 'cart',
    'be/docs/data.txt': Buffer.from('cart\0binary'), 'be/docs/image.png': 'cart',
  });
  const findings = lexiconFindings({ repoRoot: path.join(root, 'be'), files: ['src/a.ts', 'src/b.ts', 'docs/data.txt', 'docs/image.png'], repo: { profile: 'be', edition: 'lite' }, inScope: (file) => file !== 'src/b.ts' });
  assert.deepEqual(findings.map((item) => item.path), ['src/a.ts']);
});

test('HFS_APP_LEXICON: no removed words means no scan; the runtime has no product lexicon', (t) => {
  const root = tree(t, { 'README.md': 'cart' });
  assert.deepEqual(lexiconFindings({ repoRoot: root, files: ['README.md'], repo: { profile: 'app', edition: 'full' } }), []);
  assert.deepEqual(lexiconFindings({ repoRoot: root, files: ['README.md'], repo: { kind: 'runtime', lexicon: { removed: ['cart'] } } }), []);
});

test('hfs.json lexicon and observe: shape accepts optional declarations in both editions and preserves unknown-key refusals', () => {
  for (const edition of ['lite', 'full']) {
    for (const extra of [{}, { lexicon: {} }, { lexicon: { removed: [] }, observe: {} }, { lexicon: { removed: ['old name'] }, observe: { reporter: '@sentry/nextjs' } }]) assert.deepEqual(declarationShapeProblems(declaration(edition, extra), ['be', 'fe']), []);
    for (const lexicon of [null, [], 'old', { removed: 'old' }, { removed: [''] }, { removed: [' '] }, { removed: [12] }, { removed: ['old', 'old'] }, { removed: [], allowed: ['old'] }]) assert.ok(declarationShapeProblems(declaration(edition, { lexicon }), ['be', 'fe']).some((item) => item.startsWith('lexicon')));
    for (const observe of [null, [], 'sentry', { reporter: false }, { reporter: '' }, { reporter: ' ' }, { reporter: {} }, { enabled: false }]) assert.ok(declarationShapeProblems(declaration(edition, { observe }), ['be', 'fe']).some((item) => item.startsWith('observe')));
    assert.ok(declarationShapeProblems(declaration(edition, { arbitrary: true }), ['be', 'fe']).includes('unknown key arbitrary'));
  }
  assert.ok(declarationShapeProblems({ hfs: 3, kind: 'runtime', project: 'demo', lexicon: { removed: [] } }, ['be', 'fe']).some((item) => item.startsWith('unknown key lexicon')));
});
