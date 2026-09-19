// v7-5 lane fixer: (1) relink directions.md after its move out of the tree root,
// (2) point direction-check.yaml at the new location, (3) strip the fake record ids from the
// starci/* asset payloads so they stop posing as Work records. Deterministic + asserted.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const ASSETS = 'examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets';
const doc = path.join(root, ASSETS, 'directions.md');

const L = '](';
const rules = [
  [L + 'features/checkout/ui/landing-home/assets/', '](./'],
  [L + 'features/checkout/ui/shop-browse/assets/', '](../../shop-browse/assets/'],
  [L + 'features/checkout/ui/cart/assets/', '](../../cart/assets/'],
  [L + 'features/checkout/ui/stock-refused/assets/', '](../../stock-refused/assets/'],
  [L + 'features/identity/ui/sign-in/assets/', '](../../../../identity/ui/sign-in/assets/'],
  [L + 'features/checkout/ui/landing-home/index.yaml)', '](../index.yaml)'],
  [L + 'features/checkout/ui/shop-browse/index.yaml)', '](../../shop-browse/index.yaml)'],
  [L + 'features/checkout/ui/cart/index.yaml)', '](../../cart/index.yaml)'],
  [L + 'features/checkout/ui/stock-refused/index.yaml)', '](../../stock-refused/index.yaml)'],
  [L + 'features/identity/ui/sign-in/index.yaml)', '](../../../../identity/ui/sign-in/index.yaml)'],
  [L + 'brand/index.yaml)', '](../../../../../brand/index.yaml)'],
];

let text = fs.readFileSync(doc, 'utf8');
const before = text;
let applied = 0;
for (const rule of rules) {
  const hits = text.split(rule[0]).length - 1;
  if (hits) { text = text.split(rule[0]).join(rule[1]); applied += hits; }
}
if (text === before) throw new Error('no relink applied - link text did not match expectations');
const targets = [...text.matchAll(/\]\(([^)#][^)]*)\)/g)].map(m => m[1]);
for (const t of targets) {
  const abs = path.resolve(path.dirname(doc), t);
  if (!fs.existsSync(abs)) throw new Error(`broken link after relink: ${t} -> ${abs}`);
}
fs.writeFileSync(doc, text);
console.log(`directions.md: ${applied} link prefixes rewritten; ${targets.length} relative links checked, all resolve on disk.`);

const dcPath = path.join(root, ASSETS, 'direction-check.yaml');
let dc = fs.readFileSync(dcPath, 'utf8');
if (!/^id: ui\.checkout\.landing-home\.assets\r?\n/m.test(dc)) throw new Error('direction-check.yaml: fake id line not found');
dc = dc.replace(/^id: ui\.checkout\.landing-home\.assets\r?\n/m, '');
const refs = [...dc.matchAll(/DIRECTIONS\.md/g)];
if (refs.length !== 2) throw new Error(`direction-check.yaml: expected 2 DIRECTIONS.md refs, found ${refs.length}`);
dc = dc.replace(/DIRECTIONS\.md/g, 'assets/directions.md');
fs.writeFileSync(dcPath, dc);
console.log('direction-check.yaml: fake id removed, 2 references repointed at assets/directions.md.');

const payloads = [
  'examples/ecommerce-app-be/.starciwork/features/checkout/ui/cart/assets/generation-receipts.yaml',
  'examples/ecommerce-app-be/.starciwork/features/checkout/ui/landing-home/assets/generation-receipts.yaml',
  'examples/ecommerce-app-be/.starciwork/features/checkout/ui/shop-browse/assets/generation-receipts.yaml',
  'examples/ecommerce-app-be/.starciwork/features/checkout/ui/stock-refused/assets/generation-receipts.yaml',
  'examples/ecommerce-app-be/.starciwork/features/identity/ui/sign-in/assets/generation-receipts.yaml',
];
const FAKE = /^id: ui\.[a-z0-9-]+\.[a-z0-9-]+\.assets$/;
for (const rel of payloads) {
  const file = path.join(root, rel);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const idx = lines.findIndex(l => FAKE.test(l.trim()));
  if (idx === -1) throw new Error(`${rel}: no fake id line found`);
  if (!/^schema: starci\//.test(lines[0])) throw new Error(`${rel}: line 1 is not a starci/ schema; refusing to edit`);
  if (lines.slice(1).filter(l => /^id: /.test(l.trim())).length !== 1) throw new Error(`${rel}: more than one id line`);
  const removed = lines[idx].trim();
  lines.splice(idx, 1);
  fs.writeFileSync(file, lines.join('\n'));
  console.log(`${rel}: removed "${removed}" (schema kept: ${lines[0].trim()}).`);
}
