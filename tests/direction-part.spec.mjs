import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../engine/yaml.mjs';
import { blankImage, drawOver, encodePng } from '../scripts/work/png.mjs';
import { drawImageRefs, isPartName, ownerImages, partNameOf, partOf } from '../scripts/work/direction-part.mjs';
import { drawUi, settledProduct, uiSkeleton } from './fixtures/layout-tree.mjs';

// Owner ruling 2026-09-24 ("thầy nghĩ in ra không phải bản ghép, là bản cho phần đó thôi"): what the owner
// reviews for a drawing is the drawn PART - a page's slot content, an overlay's panel alone, a layout's own
// drawing - never the composite placed into the layout capture, which stays evidence for implement/audit.
const CONSOLE = '/[locale]/(console)';
const bound = (p) => ({ ref: 'shell', rev: p.tree.rev, layouts: [{ node: CONSOLE, rev: 1 }] });
const both = [{ breakpoint: 'desktop', theme: 'light' }, { breakpoint: 'mobile', theme: 'light' }];
const composites = (record, presentation) => record.assets.filter((a) => a.composite?.presentation === presentation);
const partPath = (record, composite) => composite.composite.content.path;

test('a page composite resolves to its slot content, found through the ui record', async (t) => {
  const p = await settledProduct(t);
  const board = await drawUi(p, 'reports/ui/board', uiSkeleton('ui.reports.board', { route: `${CONSOLE}/reports`, surface: 'page', shell: bound(p) }), both);
  const pages = composites(board.record, 'page');
  assert.equal(pages.length, 2, 'desktop and mobile');
  for (const c of pages) {
    const hit = partOf(path.join(board.dir, c.path));
    assert.equal(hit.kind, 'composite');
    assert.equal(hit.file, path.join(board.dir, partPath(board.record, c)), 'the page part, not the page placed into the layout capture');
    assert.equal(hit.composite, path.join(board.dir, c.path));
  }
  const content = board.record.assets.find((a) => a.role === 'direction-content');
  assert.equal(partOf(path.join(board.dir, content.path)).kind, 'part', 'a part is its own owner image');
});

test('an overlay composite resolves to the panel alone, never the dimmed host', async (t) => {
  const p = await settledProduct(t);
  await drawUi(p, 'photos/ui/list', uiSkeleton('ui.photos.list', { route: `${CONSOLE}/photos`, surface: 'page', shell: bound(p) }), both);
  const detail = await drawUi(p, 'photos/ui/detail', uiSkeleton('ui.photos.detail', { route: `${CONSOLE}/photos/[id]`, surface: { desktop: 'modal', mobile: 'drawer' }, direction: { mobile: 'bottom' }, routed: true, host: 'ui.photos.list', shell: bound(p) }), [
    ...both.map((d) => ({ ...d, presentation: 'overlay', size: [10, 10] })), ...both.map((d) => ({ ...d, presentation: 'page' })),
  ]);
  const overlays = composites(detail.record, 'overlay');
  assert.equal(overlays.length, 2);
  for (const c of overlays) {
    const hit = partOf(path.join(detail.dir, c.path));
    assert.equal(hit.file, path.join(detail.dir, c.composite.content.path));
    assert.match(path.basename(hit.file), /--overlay--.*\.content\.png$/, 'the panel content');
    assert.ok(!hit.file.includes(`${path.sep}list${path.sep}`), 'never the host page');
  }
});

test('a layout drawing composite resolves to the layout drawing itself', async (t) => {
  const p = await settledProduct(t);
  const dir = path.join(p.work, 'features', 'photos', 'ui', 'frame');
  fs.mkdirSync(path.join(dir, 'assets', 'directions'), { recursive: true });
  const record = uiSkeleton('ui.photos.frame', { route: `${CONSOLE}/photos`, surface: 'layout', shell: bound(p) });
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml(record));
  const tabs = blankImage(28, 22, [90, 90, 90, 255]);
  drawOver(tabs, blankImage(28, 16, [255, 0, 255, 255]), 0, 6);
  const content = path.join(dir, 'assets', 'directions', 'default--page--desktop--light.content.png');
  fs.writeFileSync(content, encodePng(tabs));
  const { composeDirection } = await import('../scripts/work/compose-direction.mjs');
  const result = composeDirection({ uiDir: dir, content, breakpoint: 'desktop', theme: 'light' });
  assert.equal(result.ok, true, result.error);
  fs.writeFileSync(path.join(dir, 'index.yaml'), stringifyYaml({ ...record, assets: [result.contentAsset, result.asset] }));
  const hit = partOf(result.outFile);
  assert.equal(hit.kind, 'composite');
  assert.equal(hit.file, content, 'the layout part the owner reviews, not the layout placed into its parent capture');
});

test('records drawn before the rule: the .content sibling is found; an image with no part is shown as it is', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'direction-part-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const put = (rel) => { const f = path.join(base, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, rel); return f; };
  const composite = put('ui/pay/assets/directions/pending--page--desktop--light.png');
  const part = put('ui/pay/assets/directions/pending--page--desktop--light.content.png');
  const legacy = put('ui/pay/assets/checkout.png');
  assert.deepEqual(partOf(composite), { file: part, composite, kind: 'composite' });
  assert.deepEqual(partOf(legacy), { file: legacy, composite: null, kind: 'plain' }, 'backward compatible: a legacy direction stays');
  assert.equal(isPartName(part), true);
  assert.equal(partNameOf(composite), part);
  assert.equal(partNameOf(part), null);
  const shown = ownerImages([composite, part, legacy]);
  assert.deepEqual(shown.map((s) => s.file), [part, legacy], 'a composite listed beside its own part collapses into the part');
  assert.deepEqual(shown[0].aliases, [composite, part]);
  const objects = ownerImages([{ label: 'pending', abs: composite }]);
  assert.deepEqual([objects[0].label, objects[0].abs, objects[0].composite], ['pending', part, composite], 'object entries keep their fields');
});

test('a draws.yaml entry names its owner image part first, then content, then image; strings or {path}', () => {
  assert.deepEqual(drawImageRefs({ image: { path: 'c.png', sha256: 'x' }, content: { path: 'c.content.png' }, part: 'p.png' }), ['p.png', 'c.content.png', 'c.png']);
  assert.deepEqual(drawImageRefs({ image: 'legacy.png' }), ['legacy.png']);
  assert.deepEqual(drawImageRefs({}), []);
});
