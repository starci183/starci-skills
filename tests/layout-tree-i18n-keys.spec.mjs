import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../engine/yaml.mjs';
import { checkShellConformance } from '../scripts/checks/shell-conformance.mjs';
import { mergeScan, nodeById, scanAppDir, sourceDrift, usedI18nKeys } from '../scripts/work/layout-tree.mjs';
import { buildProduct, settledProduct } from './fixtures/layout-tree.mjs';

// nivo inc-13f6af8494bf: the message catalogs are shared and hot - every workflow adds strings to them - so the
// layout tree records only the keys it USES (nav labels, layout titles, keys a capture names) and a digest of
// their values per locale. An unrelated key is never drift; a used key's edit or removal is.
const ROOT = path.resolve(import.meta.dirname, '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const CONSOLE = '/[locale]/(console)';
const scanOf = (p) => scanAppDir(p.appDir, { repoRoot: p.web, repository: 'web' });
const catalogFile = (p, locale) => path.join(p.web, 'apps', 'app', 'src', 'messages', `${locale}.json`);
const editCatalog = (p, locale, mutate) => {
  const doc = JSON.parse(fs.readFileSync(catalogFile(p, locale), 'utf8'));
  mutate(doc);
  fs.writeFileSync(catalogFile(p, locale), JSON.stringify(doc, null, 2));
};
const sha = (text) => crypto.createHash('sha256').update(text).digest('hex');

/** The record as the pre-keyed scanner wrote it: catalogs folded into source.digest, no i18n.used. */
function legacyOf(record, scan) {
  const parts = [...scan.codeParts, ...record.i18n.catalogs.map((c) => [c.path, c.sha256])].sort((a, b) => a[0].localeCompare(b[0]));
  const legacy = structuredClone(record);
  legacy.source.digest = sha(parts.map(([p, s]) => `${p}\0${s}`).join('\n'));
  delete legacy.i18n.used;
  return legacy;
}

test('the scan records the used keys and a digest of their values per locale, and keeps catalogs out of source.digest', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  assert.deepEqual(scan.i18n.used.keys, ['console.nav.billing', 'console.nav.help', 'console.nav.photos']);
  assert.deepEqual(scan.i18n.used.locales.map((l) => l.locale), ['en', 'vi']);
  const record = mergeScan(null, scan, { at: '2026-09-25T00:00:00Z' }).record;
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));
  editCatalog(p, 'vi', (d) => { d.modules = { chatbot: { title: 'Trợ lý' } }; });
  assert.equal(scanOf(p).source.digest, scan.source.digest, 'a catalog edit does not move the code digest');
});

test('an unrelated key added is not stale; a nav label edit is; a used key removed is', (t) => {
  const p = buildProduct(t);
  const record = mergeScan(null, scanOf(p), { at: '2026-09-25T00:00:00Z' }).record;
  assert.equal(sourceDrift(record, scanOf(p)).stale, false, 'nothing moved');

  editCatalog(p, 'vi', (d) => { d.modules = { chatbot: { title: 'Trợ lý', send: 'Gửi' } }; });
  editCatalog(p, 'en', (d) => { d.modules = { chatbot: { title: 'Assistant', send: 'Send' } }; d.console.greeting = 'Hi'; });
  const unrelated = sourceDrift(record, scanOf(p));
  assert.equal(unrelated.stale, false, `an unrelated key is not drift: ${unrelated.changed.join('; ')}`);
  const rescan = mergeScan(record, scanOf(p), { at: '2026-09-25T00:00:01Z' });
  assert.equal(rescan.changed, false, 'a re-scan after an unrelated key does not bump the rev');
  assert.equal(rescan.record.rev, record.rev);

  editCatalog(p, 'vi', (d) => { d.console.nav.photos = 'Hình ảnh'; });
  const label = sourceDrift(record, scanOf(p));
  assert.equal(label.stale, true, 'a nav label edit is drift');
  assert.ok(label.changed.some((c) => /nav photos vi label/.test(c)), label.changed.join('; '));
  editCatalog(p, 'vi', (d) => { d.console.nav.photos = 'Ảnh'; });
  assert.equal(sourceDrift(record, scanOf(p)).stale, false, 'the label restored is clean again');

  editCatalog(p, 'en', (d) => { delete d.console.nav.billing; });
  const removed = sourceDrift(record, scanOf(p));
  assert.equal(removed.stale, true, 'a used key removed is drift');
  assert.ok(removed.changed.some((c) => /nav billing en label/.test(c)), removed.changed.join('; '));
  assert.ok(removed.changed.some((c) => /en used key values \(absent now: console\.nav\.billing\)/.test(c)), removed.changed.join('; '));
});

test('a layout title and a key a capture names are used keys too, and survive a re-scan', (t) => {
  const p = buildProduct(t);
  editCatalog(p, 'vi', (d) => { d.console.title = 'Bảng điều khiển'; d.console.empty = 'Trống'; });
  editCatalog(p, 'en', (d) => { d.console.title = 'Console'; d.console.empty = 'Empty'; });
  const first = mergeScan(null, scanOf(p), { at: '2026-09-25T00:00:00Z' }).record;
  const layout = nodeById(first, CONSOLE).layout;
  layout.titleKey = 'console.title';
  layout.captures = [{ breakpoint: 'desktop', theme: 'light', path: 'assets/layouts/x.png', sha256: 'a'.repeat(64), width: 40, height: 30, slot: { x: 1, y: 1, width: 5, height: 5 }, kind: 'render', i18nKeys: ['console.empty'] }];
  assert.deepEqual(usedI18nKeys(first).filter((k) => !k.startsWith('console.nav.')), ['console.empty', 'console.title']);
  const record = mergeScan(first, scanOf(p), { at: '2026-09-25T00:00:01Z' }).record;
  assert.equal(nodeById(record, CONSOLE).layout.titleKey, 'console.title', 'a re-scan keeps the title key');
  assert.ok(record.i18n.used.keys.includes('console.title') && record.i18n.used.keys.includes('console.empty'));
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));

  editCatalog(p, 'en', (d) => { d.console.other = 'x'; });
  assert.equal(sourceDrift(record, scanOf(p)).stale, false);
  editCatalog(p, 'en', (d) => { d.console.title = 'Control panel'; });
  const title = sourceDrift(record, scanOf(p));
  assert.equal(title.stale, true, 'a layout title edit is drift');
  assert.ok(title.changed.includes('en used key values'), title.changed.join('; '));
  editCatalog(p, 'en', (d) => { d.console.title = 'Console'; });
  editCatalog(p, 'vi', (d) => { delete d.console.empty; });
  const gone = sourceDrift(record, scanOf(p));
  assert.equal(gone.stale, true, 'a key a capture names, removed, is drift');
  assert.ok(gone.changed.some((c) => /vi used key values \(absent now: console\.empty/.test(c)), gone.changed.join('; '));
});

test('a pre-keyed whole-file digest stays valid until the next re-scan, judged by the keys the tree uses', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  const legacy = legacyOf(mergeScan(null, scan, { at: '2026-09-25T00:00:00Z' }).record, scan);
  const clean = sourceDrift(legacy, scanOf(p));
  assert.deepEqual([clean.stale, clean.legacy], [false, true], clean.changed.join('; '));

  editCatalog(p, 'vi', (d) => { d.modules = { chatbot: { title: 'Trợ lý' } }; });
  assert.equal(sourceDrift(legacy, scanOf(p)).stale, false, 'an unrelated key does not stale a pre-keyed tree');
  const rescan = mergeScan(legacy, scanOf(p), { at: '2026-09-25T00:00:01Z' });
  assert.equal(rescan.changed, false, 'recording the keyed digest does not bump the rev every binding names');
  assert.equal(rescan.record.rev, legacy.rev);
  assert.ok(Array.isArray(rescan.record.i18n.used.keys), 'the re-scan records the keyed digest');
  assert.equal(sourceDrift(rescan.record, scanOf(p)).legacy, false);

  editCatalog(p, 'en', (d) => { d.console.nav.photos = 'Pictures'; });
  assert.equal(sourceDrift(legacy, scanOf(p)).stale, true, 'a nav label edit stales a pre-keyed tree');
  editCatalog(p, 'en', (d) => { d.console.nav.photos = 'Photos'; delete d.console.nav.help; });
  assert.equal(sourceDrift(legacy, scanOf(p)).stale, true, 'a used key removed stales a pre-keyed tree');
  editCatalog(p, 'en', (d) => { d.console.nav.help = 'Help'; });
  assert.equal(sourceDrift(legacy, scanOf(p)).stale, false);
  fs.appendFileSync(path.join(p.appDir, '[locale]', '(console)', 'layout.tsx'), '// edited\n');
  const code = sourceDrift(legacy, scanOf(p));
  assert.equal(code.stale, true, 'a code change still stales a pre-keyed tree');
  assert.ok(code.changed.includes(`${CONSOLE} layout`), code.changed.join('; '));
});

test('shell-conformance: LAYOUT_TREE_STALE only for a used key, never for an unrelated catalog key', async (t) => {
  const p = await settledProduct(t);
  const shellDir = path.join(p.work, 'shell');
  const stale = () => checkShellConformance(shellDir).refused.filter((s) => s.includes('[LAYOUT_TREE_STALE]'));
  assert.deepEqual(stale(), []);
  editCatalog(p, 'vi', (d) => { d.modules = { chatbot: { title: 'Trợ lý' } }; });
  editCatalog(p, 'en', (d) => { d.modules = { chatbot: { title: 'Assistant' } }; });
  assert.deepEqual(stale(), [], 'an unrelated key added is not stale');
  editCatalog(p, 'vi', (d) => { d.console.nav.help = 'Hỗ trợ'; });
  assert.equal(stale().length, 1, 'a nav label edit is stale');
  assert.match(stale()[0], /nav help vi label/);
  editCatalog(p, 'vi', (d) => { d.console.nav.help = 'Trợ giúp'; });
  assert.deepEqual(stale(), []);
  editCatalog(p, 'en', (d) => { delete d.console.nav.photos; });
  assert.equal(stale().length, 1, 'a used key removed is stale');

  // A tree written by the pre-keyed scanner: info, not stale, while no used key moved.
  editCatalog(p, 'en', (d) => { d.console.nav.photos = 'Photos'; });
  p.save(legacyOf(p.tree, scanOf(p)));
  const result = checkShellConformance(shellDir);
  assert.deepEqual(result.refused.filter((s) => s.includes('[LAYOUT_TREE_STALE]')), []);
  assert.ok(result.info.some((s) => s.includes('[LAYOUT_TREE_I18N_UNKEYED]')), result.info.join('\n'));
});
