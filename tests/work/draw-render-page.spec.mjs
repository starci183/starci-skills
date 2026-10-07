import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { findPackage } from '../../scripts/lib/package-at.mjs';
import { chromiumGap } from '../helpers/chromium-gap.mjs';
import { loadPlaywright } from '../../scripts/work/draw-render.mjs';
import { measureInPage } from '../../scripts/work/draw-render-page.mjs';

// measureInPage is the in-page half of draw-render: the page runs one script assembled from top-level function
// sources, so every helper must be in it. These specs run it in Chromium over a component-harness page (the page the
// fixture capture renders) and read the data-* hooks the way the page's own dataset sees them.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const PW_DIR = [process.env.STARCI_PLAYWRIGHT_DIR, ROOT].find((d) => d && findPackage([d], ['playwright', '@playwright/test']));
const NO_BROWSER = PW_DIR ? chromiumGap(loadPlaywright([PW_DIR]).chromium) : 'no project-local playwright (set STARCI_PLAYWRIGHT_DIR)';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const ARG = { generic: ['serif', 'sans-serif', 'monospace'], exemptSelector: '[data-accent-exempt]', layoutAttr: 'data-draw-layout' };

const pageOf = (attr, body) => `<!doctype html><html ${attr}><head><meta charset="utf-8"><style>
body{margin:0;font-family:serif} .alert{padding:8px;background:#fee} .alert__indicator{display:block;width:20px;height:20px;color:#c00}
.band{padding:0 10px} .track{height:8px;background:#ccc} .clip{overflow:hidden;width:50px;height:30px} .hid{display:none} .wide{width:3000px;height:4px}
</style></head><body><div id="root">${body}</div><script>window.x = 1</script></body></html>`;
const BODY = `
<div class="band"><div data-component="Meter" id="m1"><div data-grammar-part="meter-track" class="track"></div><span data-grammar-part="meter-segment" style="display:inline-block;width:6px;height:3px;background:#000"></span><span data-grammar-part="meter-segment" style="display:inline-block;width:6px;height:3px;background:#000"></span></div></div>
<div class="band"><div data-grammar-component="Meter" data-segments="2" id="m2"><div class="meter__track track"></div></div></div>
<div class="band"><div data-grammar-component="Meter" id="m3" data-grammar-part="meter-root"><div class="meter__track"></div></div></div>
<div data-component="Alert" class="alert" id="a1"><span data-grammar-part="alert-indicator" class="alert__indicator"></span><span data-grammar-part="title" style="color:#900">T</span></div>
<div data-grammar-component="Alert" class="alert" id="a2" data-grammar-part="alert-part">skipped as a part</div>
<p data-component="Text">owned by data-component</p><p data-grammar-x="1">owned by a data-grammar- attribute</p>
<div data-draw-layout="stack"><span>owned by layout</span></div><div class="starci-core-card"><span>owned by class</span></div>
<div id="stray">no owner at all</div>
<div class="clip"><img src="${PNG}" data-artwork-slot="hero" width="200" height="100" style="display:block"></div><img src="${PNG}" width="8" height="8">
<div class="hid">hidden</div><div class="wide"></div>`;

const measure = async (t, html) => {
  const { chromium } = loadPlaywright([PW_DIR]);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(html);
  return measureInPage(page, ARG);
};

test('the component harness page: ownership reads data-component, data-grammar-* and the layout attribute', { skip: NO_BROWSER }, async (t) => {
  const raw = await measure(t, pageOf('data-draw-harness="component"', BODY));
  assert.equal(raw.rendered, true);
  assert.deepEqual(raw.ownership.components, ['Alert', 'Meter', 'Text']);
  assert.equal(raw.ownership.layoutElements, 1);
  assert.deepEqual(raw.ownership.unowned.filter((label) => /owned by|no owner at all/.test(label)), ['span "owned by layout" (layout)', 'div "no owner at all" (no owner)']);
  assert.equal(raw.ownership.unownedCount, raw.ownership.unowned.length);
  assert.match(raw.dom, /^<!doctype html>\n<html/);
  assert.match(raw.dom, /data-component="Text"[^>]*data-grammar-component="Text"|data-grammar-component="Text"[^>]*data-component="Text"/, 'the dom copy names each component for the html-reading gates');
  assert.doesNotMatch(raw.dom, /<script/);
});

test('anatomy: a part is no component root, a segment count or a segments flag makes a meter segmented', { skip: NO_BROWSER }, async (t) => {
  const raw = await measure(t, pageOf('data-draw-harness="component"', BODY));
  assert.deepEqual(raw.anatomy.meters.map((m) => [m.desc, m.segmented, m.segments.length]), [['div#m1', true, 2], ['div#m2', true, 0]]);
  assert.deepEqual(raw.anatomy.alerts.map((a) => a.desc), ['div#a1']);
  assert.deepEqual(raw.anatomy.alerts[0].indicator, { width: 20, height: 20 });
  assert.equal(raw.anatomy.alerts[0].titleColor, 'rgb(153, 0, 0)');
  assert.equal(raw.anatomy.alerts[0].tile, false);
});

test('artwork: the slot comes from data-artwork-slot (null without one) and is clipped by its overflow ancestor', { skip: NO_BROWSER }, async (t) => {
  const raw = await measure(t, pageOf('', BODY));
  assert.deepEqual(raw.artwork.map((a) => [a.slot, a.width, a.height]), [['hero', 50, 30], [null, 8, 8]]);
  assert.equal(raw.ownership, null, 'outside the component harness nothing is measured for ownership');
  assert.equal(raw.dom, null);
  assert.equal(raw.rendered, null);
  assert.ok(raw.overflowing.some((tag) => tag.startsWith('div.wide')), JSON.stringify(raw.overflowing));
});

test('the exempt selector is measured and an invalid one measures nothing', { skip: NO_BROWSER }, async (t) => {
  const html = pageOf('', '<div data-accent-exempt style="width:40px;height:10px"></div>');
  assert.deepEqual((await measure(t, html)).accentExempt.map((r) => [r.width, r.height]), [[40, 10]]);
  const { chromium } = loadPlaywright([PW_DIR]);
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.setContent(html);
  assert.deepEqual(await measureInPage(page, { ...ARG, exemptSelector: '[[' }).then((r) => r.accentExempt), []);
});
