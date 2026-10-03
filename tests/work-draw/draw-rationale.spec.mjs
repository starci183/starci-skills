// DRAW_RATIONALE_MISSING (scripts/work/draw/draw-rationale.mjs; owner ruling 2026-09-27 draw-rationale-evidence): every
// interface.draw shape ships rationale.json and data-why on every element; every value the render measured is
// covered; every rule id resolves. Fixtures: good, missing data-why, uncovered gap value, fake rule id - judged with a
// measured render record, then through the draw loop's metrics and draw-quality at settle.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stringifyYaml } from '../../engine/yaml.mjs';
import {
  DRAW_RATIONALE_MISSING, MEASURE_SCHEMA, becauseCites, loadRationale, rationaleFileOf, rationaleFindings, redlineLabelsOf, ruleResolver, statedValues,
} from '../../scripts/work/draw/draw-rationale.mjs';
import { DRAW_QUALITY_CODES } from '../../scripts/work/draw/draw-quality.mjs';
import { machineMetrics } from '../../scripts/work/draw-loop.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-rationale-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };

const GOOD_HTML = `<!doctype html><html><head><style>
main{display:flex;flex-direction:column;gap:24px;padding:24px}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card{padding:16px;border-radius:16px;background:#ffffff}
h1{font-size:30px;font-weight:600;line-height:36px}
p{font-size:14px;font-weight:400;line-height:20px;margin:0;color:#000000}
h1{margin:0;color:#000000}
button{padding:8px 16px;border:0;border-radius:9999px;background:#ffffff;font-family:inherit;font-size:14px;font-weight:400;line-height:20px;color:#000000}
body{margin:0;background:#ffffff;color:#000000}
</style></head><body>
<main data-grammar-component="PageContainer" data-why="L-page">
  <header data-grammar-component="SectionHeader" data-why="L-header"><h1 data-grammar-component="Heading" data-why="T-h1">M\u00f4-\u0111un \u0111\u00e3 c\u00e0i</h1></header>
  <section class="cards" data-why="L-cards">
    <article class="card" data-grammar-component="SurfaceCard" data-why="K-card"><p data-grammar-component="Text" data-why="T-body">Chatbot Sales</p>
      <button data-grammar-component="Button" data-variant="secondary" data-why="K-open">M\u1edf</button></article>
    <article class="card" data-grammar-component="SurfaceCard" data-why="K-card"><p data-grammar-component="Text" data-why="T-body">Sales Copilot</p>
      <button data-grammar-component="Button" data-variant="secondary" data-why="K-open">M\u1edf</button></article>
  </section>
</main></body></html>`;

const base = { alternativesRejected: [{ option: 'a table', why: 'two entities read better as cards' }], source: 'devin r6' };
const GOOD_RATIONALE = [
  { id: 'L-page', selector: 'main', kind: 'layout', decision: 'PageContainer, region order: header then the installed cards', value: '2 regions, gap 24, pad 24', because: 'FR-1: the owner sees which modules are installed first', rules: ['GAP-5 case-1', 'owner:draw-content-region-only'], ...base },
  { id: 'L-header', selector: 'header', kind: 'layout', decision: 'SectionHeader holding the page title', value: 'one line', because: 'FR-1 names the page', rules: ['HIERARCHY-3', 'dna:SectionHeader'], ...base },
  { id: 'L-cards', selector: '.cards', kind: 'layout', decision: 'two-up grid of installed modules', value: '2 columns at 1280, 2 columns at 390, gap 16', because: 'FR-1 lists two installed modules (01-CONTENT)', rules: ['GAP-4'], ...base },
  { id: 'K-card', selector: '.card', kind: 'element', decision: 'SurfaceCard per installed module', value: 'SurfaceCard', because: 'FR-1: one card per installed module', rules: ['dna:SurfaceCard'], ...base },
  { id: 'K-open', selector: 'button', kind: 'element', decision: 'Button secondary opens the module', value: 'Button variant secondary', because: 'FR-2: the owner opens a module', rules: ['dna:Button.variant=secondary', 'owner:alert-white-surface'], ...base },
  { id: 'S-card-pad', selector: '.card', kind: 'spacing', decision: 'card inset', value: 'padding 16px; button padding 8px 16px', because: 'FR-1 card content', rules: ['PADDING-4'], ...base },
  { id: 'R-card', selector: '.card', kind: 'radius', decision: 'the surface radius the grammar binds; buttons are pills', value: '16px; buttons pill', because: 'FR-1 cards are grammar surfaces', rules: ['owner:card-radius-bound'], ...base },
  { id: 'T-h1', selector: 'h1', kind: 'type', decision: 'Heading page title', value: '30px / 600 / 36px', because: 'FR-1 page title', rules: ['FONT-4'], ...base },
  { id: 'T-body', selector: 'p', kind: 'type', decision: 'Text module name', value: '14px / 400 / 20px', because: 'FR-1 module names (01-CONTENT)', rules: ['FONT-2'], ...base },
  { id: 'C-surface', selector: '.card', kind: 'colour', decision: 'white surface, ink text', value: '#ffffff surface, #000000 text', because: 'FR-1 content reads on the grammar surface', rules: ['ACCENT-6'], ...base },
];
/** What draw-render measures for GOOD_HTML at one viewport (the real measure is covered by the render test below). */
const measure = (width, extra = {}) => ({ schema: MEASURE_SCHEMA, viewport: { width, height: 800 },
  values: { spacing: [{ value: 24, at: ['main'] }, { value: 16, at: ['section.cards'] }], radius: [{ value: 16, at: ['article.card'] }],
    fontSize: [{ value: 30, at: ['h1'] }, { value: 14, at: ['p'] }], fontWeight: [{ value: 600, at: ['h1'] }, { value: 400, at: ['p'] }], lineHeight: [{ value: 36, at: ['h1'] }, { value: 20, at: ['p'] }], ...extra.values },
  colours: [{ hex: '#ffffff', use: 'background', at: ['article.card'] }, { hex: '#000000', use: 'text', at: ['p'] }], grids: [{ selector: 'section.cards', why: ['L-cards'], columns: 2 }], art: [], tokenColours: {}, regions: { count: 2, whys: [] } });

const judge = (html, entries, measures = [measure(1280), measure(390)], opts = {}) => rationaleFindings({ html, entries, errors: [], measures, resolve: ruleResolver({}), label: 'screen.html', redlines: [{ part: 'desktop', ok: true }], ...opts });
const kinds = (findings) => findings.map((f) => f.kind).sort();

test('good: every element says why, every measured value and rule id is covered', () => {
  assert.deepEqual(judge(GOOD_HTML, GOOD_RATIONALE), []);
});

test('missing data-why: an element without it, and a data-why naming no decision, are refused', () => {
  const html = GOOD_HTML.replace(' data-why="T-h1"', '').replace('data-why="K-open">M\u1edf</button></article>\n    <article', 'data-why="K-ghost">M\u1edf</button></article>\n    <article');
  const f = judge(html, GOOD_RATIONALE);
  assert.ok(f.every((x) => x.code === DRAW_RATIONALE_MISSING));
  assert.deepEqual(kinds(f), ['data-why naming no decision', 'element without data-why']);
  assert.match(f.find((x) => x.kind === 'element without data-why').detail, /<h1>/);
});

test('uncovered gap value: a gap the render uses that no spacing/layout decision states is refused', () => {
  const f = judge(GOOD_HTML, GOOD_RATIONALE, [measure(1280, { values: { spacing: [{ value: 24, at: ['main'] }, { value: 16, at: ['section.cards'] }, { value: 12, at: ['section.cards'] }] } }), measure(390)]);
  assert.deepEqual(kinds(f), ['uncovered gap/padding/inset value']);
  assert.match(f[0].detail, /12px \(1280px section\.cards\)/);
  // A value stated by a decision of another kind does not cover it: 16 is stated by R-card (radius) and S-card-pad.
  const noPad = GOOD_RATIONALE.filter((e) => !['S-card-pad', 'L-cards'].includes(e.id)).concat({ ...GOOD_RATIONALE[2], value: '2 columns at 1280 and at 390', decision: 'two-up grid' });
  assert.deepEqual(kinds(judge(GOOD_HTML, noPad)), ['uncovered gap/padding/inset value']);
});

test('fake rule id: a rules[] entry that resolves to no knowledge id, DNA name, direction id or owner ruling is refused', () => {
  const fake = GOOD_RATIONALE.map((e) => (e.id === 'L-cards' ? { ...e, rules: ['GAP-99', 'owner:made-up-ruling', 'dna:Button.variant=neon', 'GAP-4 case-9'] } : e));
  const f = judge(GOOD_HTML, fake);
  assert.deepEqual(kinds(f), ['unresolvable rule id']);
  assert.equal(f[0].count, 4);
  const resolve = ruleResolver({});
  for (const ok of ['GAP-4', 'GAP-4 case-2', 'ui.presentation.gap', 'dna:Button', 'Button.variant=secondary', 'owner:draw-devin-brand-claude', 'owner:work-hygiene-gate']) assert.ok(resolve(ok).ok, ok);
  for (const bad of ['padding.yaml page-inset', '07-DIRECTION §3.2', 'direction:P2', 'rubric:H3']) assert.equal(resolve(bad).ok, false, bad);
});

test('brand.direction ids resolve from the product brand record; an empty because and an uncited one are refused', (t) => {
  const work = path.join(tmp(t), '.starciwork');
  fs.mkdirSync(path.join(work, 'brand'), { recursive: true });
  fs.writeFileSync(path.join(work, 'brand', 'index.yaml'), stringifyYaml({ schema: 'work/brand@1', kind: 'brand', brand: { direction: { principles: [{ id: 'P2', name: 'Summary first' }], rubric: { checks: [{ id: 'H3', test: 'Region order' }] } } } }));
  const resolve = ruleResolver({ workRoot: work });
  assert.ok(resolve('direction:P2').ok && resolve('rubric:H3').ok && resolve('P2').ok);
  assert.equal(resolve('rubric:P2').ok, false, 'a principle is no rubric check');
  const f = judge(GOOD_HTML, GOOD_RATIONALE.map((e) => (e.id === 'T-h1' ? { ...e, because: '' } : e.id === 'T-body' ? { ...e, because: 'looks nicer' } : e)));
  assert.deepEqual(kinds(f), ['because cites no FR, content or user job', 'empty because']);
  assert.ok(becauseCites('the user job is to find the broken module') && becauseCites('see fr.modules.list') && !becauseCites('it is prettier'));
});

test('regions, grids, DNA variants, colours, measure and redline are all evidence', () => {
  const noOrder = GOOD_RATIONALE.map((e) => (e.id === 'L-page' ? { ...e, decision: 'PageContainer', value: 'gap 24, pad 24' } : e));
  assert.deepEqual(kinds(judge(GOOD_HTML, noOrder)), ['no region order decision']);
  const grid = judge(GOOD_HTML, GOOD_RATIONALE, [measure(1280), { ...measure(390), grids: [{ selector: 'section.cards', why: ['L-cards'], columns: 1 }] }]);
  assert.deepEqual(kinds(grid), ['grid without its column count']);
  const variant = judge(GOOD_HTML.replaceAll('data-variant="secondary"', 'data-variant="outline"'), GOOD_RATIONALE);
  assert.deepEqual(kinds(variant), ['DNA variant without a decision']);
  const colour = judge(GOOD_HTML, GOOD_RATIONALE, [{ ...measure(1280), colours: [{ hex: '#e3001f', use: 'background', at: ['button'] }] }]);
  assert.deepEqual(kinds(colour), ['colour without a decision']);
  const token = judge(GOOD_HTML, GOOD_RATIONALE.map((e) => (e.id === 'C-surface' ? { ...e, value: 'var(--danger) fill' } : e)), [{ ...measure(1280), colours: [{ hex: '#e3001f', use: 'background', at: ['button'] }], tokenColours: { '--danger': '#e3001f' } }]);
  assert.deepEqual(token, [], 'a --token that resolves to the colour in the render names it');
  assert.deepEqual(kinds(judge(GOOD_HTML, GOOD_RATIONALE, [])), ['render not measured']);
  assert.deepEqual(kinds(judge(GOOD_HTML, GOOD_RATIONALE, undefined, { redlines: [{ part: 'mobile', ok: false }] })), ['no redline render']);
  const region = judge(GOOD_HTML, GOOD_RATIONALE.map((e) => (e.id === 'L-cards' ? { ...e, kind: 'element' } : e)));
  assert.ok(kinds(region).includes('region without a layout decision'));
});

test('the rationale file: beside the source, validated field by field; redline labels carry the first rule id', (t) => {
  const dir = tmp(t);
  const html = path.join(dir, 'LedgerBase#installed--1280x800--light.html');
  fs.writeFileSync(html, GOOD_HTML);
  assert.equal(rationaleFileOf(html), null);
  assert.deepEqual(loadRationale(null).errors, ['no rationale.json beside the render source']);
  fs.writeFileSync(path.join(dir, 'rationale.json'), JSON.stringify([{ id: 'x', kind: 'mood', rules: [] }, { id: 'x' }]));
  assert.equal(rationaleFileOf(html), path.join(dir, 'rationale.json'));
  const bad = loadRationale(rationaleFileOf(html));
  assert.ok(bad.errors.some((e) => /kind "mood"/.test(e)) && bad.errors.some((e) => /used twice/.test(e)) && bad.errors.some((e) => /lacks selector/.test(e)));
  fs.writeFileSync(html.replace(/\.html$/, '.rationale.json'), JSON.stringify(GOOD_RATIONALE));
  assert.equal(rationaleFileOf(html), html.replace(/\.html$/, '.rationale.json'), 'the part\'s own rationale wins');
  assert.deepEqual(loadRationale(rationaleFileOf(html)).errors, []);
  assert.deepEqual(redlineLabelsOf(GOOD_RATIONALE)['L-page'], { kind: 'layout', value: '2 regions, gap 24, pad 24', rule: 'GAP-5 case-1' });
  assert.deepEqual([...statedValues('pad 1.5rem, gap 16px; 2×2').nums].sort((a, b) => a - b), [2, 16, 24]);
});

test('the draw loop metric and draw-quality carry DRAW_RATIONALE_MISSING', async (t) => {
  const dir = tmp(t);
  const html = path.join(dir, 'screen.html');
  fs.writeFileSync(html, GOOD_HTML);
  const captures = [1280, 390].map((w) => ({ png: path.join(dir, `s--${w}x800--light.png`), viewport: { width: w, height: 800 }, record: { ok: true, rationale: measure(w), redline: { path: html } } }));
  const probes = { geometry: async () => ({ findings: [] }), score: async () => ({ summary: { pass: 1, fail: 0 }, cases: [], spacing: [] }) };
  const run = async () => (await machineMetrics({ html, captures: captures.map((c) => ({ ...c, png: html })), repo: dir, probes })).doc.metrics.find((m) => m.id === 'rationale');
  const missing = await run();
  assert.equal(missing.ok, false);
  assert.match(missing.findings[0].detail, /no rationale\.json/);
  fs.writeFileSync(path.join(dir, 'screen.rationale.json'), JSON.stringify(GOOD_RATIONALE));
  assert.deepEqual((await run()).findings, []);
  assert.ok(DRAW_QUALITY_CODES.includes(DRAW_RATIONALE_MISSING), 'draw-quality (so draw-acceptance at starci kernel settle) refuses it');
});

test('a real render: draw-render measures the values and captures the redline (skipped without Playwright)', async (t) => {
  const { loadPlaywright, captureHtml } = await import('../../scripts/work/draw-render.mjs');
  let playwright = null;
  try { playwright = loadPlaywright([process.env.STARCI_PLAYWRIGHT_DIR, ROOT].filter(Boolean)); } catch { playwright = null; }
  if (!playwright) { t.skip('no playwright install resolvable (set STARCI_PLAYWRIGHT_DIR)'); return; }
  const dir = tmp(t);
  const html = path.join(dir, 'screen.html');
  fs.writeFileSync(html, GOOD_HTML);
  fs.writeFileSync(path.join(dir, 'screen.rationale.json'), JSON.stringify(GOOD_RATIONALE));
  const records = await captureHtml({ html, out: path.join(dir, 'out'), viewports: [{ width: 1280, height: 800 }, { width: 390, height: 800 }], theme: 'light', fullPage: true, name: 'screen', source: { mode: 'html' }, playwright });
  for (const r of records) {
    assert.equal(r.rationale.schema, MEASURE_SCHEMA);
    assert.ok(fs.existsSync(r.redline.path), 'the redline is captured beside the part');
    assert.deepEqual(r.rationale.values.spacing.map((v) => v.value), [8, 16, 24]);
  }
  assert.deepEqual(judge(GOOD_HTML, GOOD_RATIONALE, records.map((r) => r.rationale)).map((f) => f.kind), []);
});
