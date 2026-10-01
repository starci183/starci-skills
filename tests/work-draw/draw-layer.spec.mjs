import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DRAW_MEASURE_UNCAPPED, DRAW_NESTED_VARIANT, FORM_MEASURE_CAP_PX, layerFindings, measureFindings, nestedVariantFindings, variantOfControl,
} from '../../scripts/work/draw/draw-layer.mjs';
import { parseHtml, walkElements } from '../../scripts/work/draw/draw-dna.mjs';
import { machineMetrics } from '../../scripts/work/draw-loop.mjs';
import { loadContractChanges } from '../../scripts/machine/contract-version.mjs';

// Owner, 2026-09-28, StarCi Next SignInBase#signed-out round 2 (D:/starci-tmp/starci-draw10/loop/SignInBase/round-2):
// the sign-in card stretched the whole 1184px content region, and on that Surface the "Remember me" Checkbox kept
// the default primary variant while the two Inputs were secondary. "This is KNOWLEDGE, not golden rules": the
// runtime catches both from knowledge/ui (MEASURE-4, ANATOMY-2) and these gates. The fixture is that round's
// rendered DOM snapshot, byte for byte.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SIGN_IN_DOM = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'draw-layer', 'sign-in-signed-out.dom.html'), 'utf8');
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'draw-layer-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

/** The round-2 DOM with the Checkbox nested as ANATOMY-2 case-1 requires. */
const fixedCheckbox = (html) => html.replace('class="checkbox checkbox--primary', 'data-grammar-variant="secondary" class="checkbox checkbox--secondary');

test('reproduces round 2: the Checkbox on the sign-in Surface is not nested; the secondary Inputs pass', () => {
  const f = nestedVariantFindings(SIGN_IN_DOM, { label: 'SignInBase#signed-out--1184x900' });
  assert.equal(f.length, 1, JSON.stringify(f));
  assert.equal(f[0].code, DRAW_NESTED_VARIANT);
  assert.equal(f[0].count, 1);
  assert.match(f[0].detail, /Checkbox "remember" \(primary\)/);
  assert.doesNotMatch(f[0].detail, /Input/);
  assert.match(f[0].detail, /ANATOMY-2 case-1/);
  assert.deepEqual(nestedVariantFindings(fixedCheckbox(SIGN_IN_DOM)), [], 'the redraw with Checkbox variant="secondary" is green');
});

test('the variant is read from data-grammar-variant, else the vendor class; exempt controls and frameless surfaces pass', () => {
  const roots = walkElements(parseHtml(SIGN_IN_DOM)).filter((e) => ['Input', 'Checkbox'].includes(e.attrs['data-component']));
  assert.deepEqual(roots.map(variantOfControl), ['secondary', 'secondary', 'primary'], 'Input reads input--secondary on its field, Checkbox its root class');
  const card = (inner, frame = 'bounded') => `<section data-component="SurfaceCard" data-grammar-frame="${frame}" class="card"><div class="card__content" data-grammar-surface-depth="top" data-grammar-frame="${frame}">${inner}</div></section>`;
  const box = (variant) => `<div data-component="Checkbox" ${variant ? `data-grammar-variant="${variant}"` : ''} class="checkbox"><input type="checkbox" name="agree"></div>`;
  assert.equal(nestedVariantFindings(card(box('secondary'))).length, 0);
  assert.match(nestedVariantFindings(card(box(null)))[0].detail, /no layer variant/, 'a control that states no variant on a surface fails');
  assert.equal(nestedVariantFindings(card(box('primary'), 'frameless')).length, 0, 'a frameless surface paints no ground: the control is on the page');
  assert.equal(nestedVariantFindings(card('<div data-component="Switch" class="switch"><input type="checkbox"></div>')).length, 0, 'Switch has no vendor variant');
  const group = card('<div data-component="RadioGroup" class="radio-group radio-group--primary"><label class="radio"><input type="radio"></label></div>');
  assert.match(nestedVariantFindings(group)[0].detail, /RadioGroup \(primary\)/, 'choice controls are form controls too');
  assert.match(nestedVariantFindings('<div role="dialog"><div data-component="Select" class="select select--primary"></div></div>')[0].detail, /Select/, 'a dialog is a surface');
});

test('ANATOMY-2 case-3: a form region on the bare page Background belongs in a Surface', () => {
  const loose = `<main data-component="PageContainer"><div class="grid"><div data-component="Input" class="textfield"><input class="input input--primary" name="email"></div>
    <button data-component="Button" class="button button--primary">Sign in</button></div></main>`;
  const f = nestedVariantFindings(loose);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'form on the page background');
  assert.match(f[0].detail, /ANATOMY-2 case-3/);
  assert.deepEqual(nestedVariantFindings(SIGN_IN_DOM.replace('class="checkbox checkbox--primary', 'class="checkbox checkbox--secondary')), [], 'the sign-in form stands in its SurfaceCard');
  assert.deepEqual(nestedVariantFindings('<main><div data-component="SearchField" class="search-field search-field--primary"></div><button data-component="Button" class="button button--outline">Go</button></main>'), [],
    'a lone field without a primary submit is not a form region');
});

test('reproduces round 2: a form region measured 1084px at 1184 is DRAW_MEASURE_UNCAPPED; the capped card passes', () => {
  // The round-2 card rendered from x=27 to x=973 of a 1000-wide screenshot of 1184 CSS px: ~1116px card, ~1084px content.
  const wide = { viewport: { width: 1184, height: 900 }, forms: [{ desc: '<div.grid.gap-6>', width: 1084, fields: ['Input', 'Input', 'Checkbox'] }] };
  const f = measureFindings(wide, { label: 'SignInBase#signed-out--1184x900--light' });
  assert.equal(f.length, 1);
  assert.equal(f[0].code, DRAW_MEASURE_UNCAPPED);
  assert.match(f[0].detail, /1084px wide at 1184px, past the 768px \(W-3xl\) form cap/);
  assert.match(f[0].detail, /MEASURE-4 case-3\/case-4/);
  assert.deepEqual(measureFindings({ viewport: { width: 1184, height: 900 }, forms: [{ width: 448, fields: ['Input'] }] }), [], 'SurfaceCard measure="form" (30rem less its inset)');
  assert.deepEqual(measureFindings({ viewport: { width: 390, height: 844 }, forms: [{ width: 342, fields: ['Input'] }] }), []);
  assert.deepEqual(measureFindings(null), [], 'no measured layer, nothing to judge');
  assert.equal(FORM_MEASURE_CAP_PX, 768);
  assert.equal(layerFindings({ html: SIGN_IN_DOM, layer: wide }).map((x) => x.code).join(','), `${DRAW_NESTED_VARIANT},${DRAW_MEASURE_UNCAPPED}`);
});

test('the draw loop carries a `layer` metric: round 2 is red on both codes, the redraw is green', async (t) => {
  const dir = tmp(t);
  const html = path.join(dir, 'index.html');
  fs.writeFileSync(html, '<!doctype html><div id="root"></div>');
  const probes = { geometry: async () => ({ findings: [] }), score: async () => ({ summary: { pass: 1, fail: 0 }, cases: [], spacing: [] }) };
  const capture = (width) => ({ png: path.join(dir, `SignInBase#signed-out--1184x900--light.png`), viewport: { width: 1184, height: 900 }, record: { ok: true, layer: { viewport: { width: 1184, height: 900 }, forms: [{ desc: '<div.grid>', width, fields: ['Input'] }] } } });
  const layerOf = async (dom, width) => (await machineMetrics({ html, domHtml: dom, captures: [capture(width)], repo: dir, probes })).doc.metrics.find((m) => m.id === 'layer');
  const red = await layerOf(SIGN_IN_DOM, 1084);
  assert.equal(red.ok, false);
  assert.deepEqual(red.findings.map((f) => f.code).sort(), [DRAW_MEASURE_UNCAPPED, DRAW_NESTED_VARIANT]);
  assert.deepEqual(red.measured, [{ part: 'SignInBase#signed-out--1184x900--light', forms: [{ desc: '<div.grid>', width: 1084 }] }]);
  const green = await layerOf(fixedCheckbox(SIGN_IN_DOM), 448);
  assert.equal(green.ok, true, JSON.stringify(green.findings));
  const unread = (await machineMetrics({ html, domHtml: fixedCheckbox(SIGN_IN_DOM), captures: [{ ...capture(0), record: { ok: true, layer: { error: 'boom' } } }], repo: dir, probes })).doc.metrics.find((m) => m.id === 'layer');
  assert.equal(unread.findings[0].code, 'DRAW_METRICS_UNVERIFIED', 'a measure that could not run fails, never passes');
});

test('the contract change registers both codes with a follow-up interface.draw', () => {
  const change = loadContractChanges(ROOT).changes.find((c) => c.id === 'draw-layer-measure');
  assert.ok(change, 'modules/kernel/contract-changes.yaml draw-layer-measure');
  assert.deepEqual([...change.adds.codes].sort(), [DRAW_MEASURE_UNCAPPED, DRAW_NESTED_VARIANT]);
  assert.equal(change.reach, 'follow-up');
  assert.equal(change.followUp.op, 'interface.draw');
  for (const p of ['knowledge/ui/presentation/measure.yaml', 'knowledge/ui/proof/anatomy-source.yaml', 'knowledge/grammars/starci/DNA.yaml']) assert.ok(change.paths.includes(p), p);
});

test('a real render measures the form region (skipped without Playwright)', async (t) => {
  const { loadPlaywright, captureHtml } = await import('../../scripts/work/draw-render.mjs');
  let playwright = null;
  try { playwright = loadPlaywright([process.env.STARCI_PLAYWRIGHT_DIR, ROOT].filter(Boolean)); } catch { playwright = null; }
  if (!playwright) { t.skip('no playwright install resolvable (set STARCI_PLAYWRIGHT_DIR)'); return; }
  const dir = tmp(t);
  // The round-2 DOM without the product CSS: every block takes its column, as the card did when its form measure lost.
  const stretched = path.join(dir, 'stretched.html');
  fs.writeFileSync(stretched, SIGN_IN_DOM.replace('<link rel="stylesheet" href="global.css">', '<style>body{margin:0;padding:0 32px}</style>'));
  const capped = path.join(dir, 'capped.html');
  fs.writeFileSync(capped, SIGN_IN_DOM.replace('<link rel="stylesheet" href="global.css">', '<style>body{margin:0;padding:0 32px}.starci-core-surface-card.starci-core-form-surface{width:min(100%,30rem);margin-inline:auto}</style>'));
  const shoot = async (html, name) => (await captureHtml({ html, out: path.join(dir, name), viewports: [{ width: 1184, height: 900 }], theme: 'light', fullPage: true, name, source: { mode: 'html' }, playwright }))[0];
  const wide = await shoot(stretched, 'stretched');
  assert.equal(wide.layer.forms.length, 1, JSON.stringify(wide.layer));
  assert.ok(wide.layer.forms[0].width > FORM_MEASURE_CAP_PX, `stretched form is ${wide.layer.forms[0].width}px`);
  assert.deepEqual(wide.layer.forms[0].fields, ['Input', 'Input', 'Checkbox']);
  assert.equal(measureFindings(wide.layer)[0].code, DRAW_MEASURE_UNCAPPED);
  const narrow = await shoot(capped, 'capped');
  assert.ok(narrow.layer.forms[0].width <= 480, `capped form is ${narrow.layer.forms[0].width}px`);
  assert.deepEqual(measureFindings(narrow.layer), []);
});
