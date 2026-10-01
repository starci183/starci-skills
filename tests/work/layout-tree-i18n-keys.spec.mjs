import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseYaml } from '../../engine/yaml.mjs';
import { checkShellConformance } from '../../scripts/work/ui/shell-conformance.mjs';
import { mergeScan, nodeById, scanAppDir, sourceDrift, treeOf, usedI18nKeys } from '../../scripts/work/layout-tree.mjs';
import { buildProduct, settledProduct } from '../fixtures/layout-tree.mjs';

// nivo inc-13f6af8494bf: the message catalogs are shared and hot - every workflow adds strings to them - so the
// layout tree records only the keys it USES (nav labels, layout titles, keys a capture names) and a digest of
// their values per locale. An unrelated key is never drift; a used key's edit or removal is.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const Ajv2020 = (() => { const loaded = createRequire(path.join(ROOT, 'package.json'))('ajv/dist/2020.js'); return loaded?.default ?? loaded; })();
const validateTree = new Ajv2020({ strict: false, allErrors: true, logger: false }).compile(parseYaml(fs.readFileSync(path.join(ROOT, 'modules/schemas/work-layout-tree.schema.yaml'), 'utf8')));
const CONSOLE = '/[locale]/(console)';
const appOf = (record) => treeOf(record, 'app');
const scanOf = (p) => scanAppDir(p.appDir, { repoRoot: p.app });
const catalogFile = (p, locale) => path.join(p.fe, 'apps', 'app', 'src', 'messages', `${locale}.json`);
const editCatalog = (p, locale, mutate) => {
  const doc = JSON.parse(fs.readFileSync(catalogFile(p, locale), 'utf8'));
  mutate(doc);
  fs.writeFileSync(catalogFile(p, locale), JSON.stringify(doc, null, 2));
};

/** The record without the keyed digest (no i18n.used): a whole-file catalog record is no longer read. */
function unkeyedOf(record) {
  const unkeyed = structuredClone(record);
  delete unkeyed.apps[0].i18n.used;
  return unkeyed;
}

test('the scan records the used keys and a digest of their values per locale, and keeps catalogs out of source.digest', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  assert.deepEqual(scan.i18n.used.keys, ['console.nav.billing', 'console.nav.help', 'console.nav.photos']);
  assert.deepEqual(scan.i18n.used.locales.map((l) => l.locale), ['en', 'vi']);
  const record = mergeScan(null, [scan], { at: '2026-09-25T00:00:00Z' }).record;
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));
  editCatalog(p, 'vi', (d) => { d.modules = { chatbot: { title: 'Trợ lý' } }; });
  assert.equal(scanOf(p).source.digest, scan.source.digest, 'a catalog edit does not move the code digest');
});

test('an unrelated key added is not stale; a nav label edit is; a used key removed is', (t) => {
  const p = buildProduct(t);
  const record = mergeScan(null, [scanOf(p)], { at: '2026-09-25T00:00:00Z' }).record;
  assert.equal(sourceDrift(appOf(record), scanOf(p)).stale, false, 'nothing moved');

  editCatalog(p, 'vi', (d) => { d.modules = { chatbot: { title: 'Trợ lý', send: 'Gửi' } }; });
  editCatalog(p, 'en', (d) => { d.modules = { chatbot: { title: 'Assistant', send: 'Send' } }; d.console.greeting = 'Hi'; });
  const unrelated = sourceDrift(appOf(record), scanOf(p));
  assert.equal(unrelated.stale, false, `an unrelated key is not drift: ${unrelated.changed.join('; ')}`);
  const rescan = mergeScan(record, [scanOf(p)], { at: '2026-09-25T00:00:01Z' });
  assert.equal(rescan.changed, false, 'a re-scan after an unrelated key does not bump the rev');
  assert.equal(rescan.record.rev, record.rev);

  editCatalog(p, 'vi', (d) => { d.console.nav.photos = 'Hình ảnh'; });
  const label = sourceDrift(appOf(record), scanOf(p));
  assert.equal(label.stale, true, 'a nav label edit is drift');
  assert.ok(label.changed.some((c) => /nav photos vi label/.test(c)), label.changed.join('; '));
  editCatalog(p, 'vi', (d) => { d.console.nav.photos = 'Ảnh'; });
  assert.equal(sourceDrift(appOf(record), scanOf(p)).stale, false, 'the label restored is clean again');

  editCatalog(p, 'en', (d) => { delete d.console.nav.billing; });
  const removed = sourceDrift(appOf(record), scanOf(p));
  assert.equal(removed.stale, true, 'a used key removed is drift');
  assert.ok(removed.changed.some((c) => /nav billing en label/.test(c)), removed.changed.join('; '));
  assert.ok(removed.changed.some((c) => /en used key values \(absent now: console\.nav\.billing\)/.test(c)), removed.changed.join('; '));
});

test('a layout title and a key a capture names are used keys too, and survive a re-scan', (t) => {
  const p = buildProduct(t);
  editCatalog(p, 'vi', (d) => { d.console.title = 'Bảng điều khiển'; d.console.empty = 'Trống'; });
  editCatalog(p, 'en', (d) => { d.console.title = 'Console'; d.console.empty = 'Empty'; });
  const first = mergeScan(null, [scanOf(p)], { at: '2026-09-25T00:00:00Z' }).record;
  const layout = nodeById(appOf(first), CONSOLE).layout;
  layout.titleKey = 'console.title';
  layout.captures = [{ breakpoint: 'desktop', theme: 'light', name: 'assets/layouts/x.png', sha256: 'a'.repeat(64), width: 40, height: 30, slot: { x: 1, y: 1, width: 5, height: 5 }, kind: 'render', i18nKeys: ['console.empty'] }];
  assert.deepEqual(usedI18nKeys(appOf(first)).filter((k) => !k.startsWith('console.nav.')), ['console.empty', 'console.title']);
  const record = mergeScan(first, [scanOf(p)], { at: '2026-09-25T00:00:01Z' }).record;
  assert.equal(nodeById(appOf(record), CONSOLE).layout.titleKey, 'console.title', 'a re-scan keeps the title key');
  assert.ok(record.apps[0].i18n.used.keys.includes('console.title') && record.apps[0].i18n.used.keys.includes('console.empty'));
  assert.equal(validateTree(record), true, JSON.stringify(validateTree.errors));

  editCatalog(p, 'en', (d) => { d.console.other = 'x'; });
  assert.equal(sourceDrift(appOf(record), scanOf(p)).stale, false);
  editCatalog(p, 'en', (d) => { d.console.title = 'Control panel'; });
  const title = sourceDrift(appOf(record), scanOf(p));
  assert.equal(title.stale, true, 'a layout title edit is drift');
  assert.ok(title.changed.includes('en used key values'), title.changed.join('; '));
  editCatalog(p, 'en', (d) => { d.console.title = 'Console'; });
  editCatalog(p, 'vi', (d) => { delete d.console.empty; });
  const gone = sourceDrift(appOf(record), scanOf(p));
  assert.equal(gone.stale, true, 'a key a capture names, removed, is drift');
  assert.ok(gone.changed.some((c) => /vi used key values \(absent now: console\.empty/.test(c)), gone.changed.join('; '));
});

test('a tree without the keyed i18n digest is stale until it is re-scanned', (t) => {
  const p = buildProduct(t);
  const scan = scanOf(p);
  const unkeyed = unkeyedOf(mergeScan(null, [scan], { at: '2026-09-25T00:00:00Z' }).record);
  const drift = sourceDrift(appOf(unkeyed), scanOf(p));
  assert.equal(drift.stale, true);
  assert.ok(drift.changed.some((c) => /no keyed i18n digest/.test(c)), drift.changed.join('; '));
  assert.equal('legacy' in drift, false, 'there is no legacy verdict any more');
  const rescan = mergeScan(unkeyed, [scanOf(p)], { at: '2026-09-25T00:00:01Z' });
  assert.ok(Array.isArray(rescan.record.apps[0].i18n.used.keys), 'the re-scan records the keyed digest');
  assert.equal(sourceDrift(appOf(rescan.record), scanOf(p)).stale, false);
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

  // A tree without the keyed digest is refused as stale: the re-scan writes it.
  editCatalog(p, 'en', (d) => { d.console.nav.photos = 'Photos'; });
  p.save(unkeyedOf(p.record));
  const result = checkShellConformance(shellDir);
  assert.ok(result.refused.some((s) => s.includes('[LAYOUT_TREE_STALE]') && /no keyed i18n digest/.test(s)), result.refused.join('\n'));
  assert.equal([...result.info, ...result.refused].some((s) => s.includes('LAYOUT_TREE_I18N_UNKEYED')), false);
});
