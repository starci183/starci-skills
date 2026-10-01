// A drawing's decision evidence for specs that exercise other gates (draw loop, quality, review): every element of
// the html carries data-why, the rationale covers its DNA components and variants, its region order and the values a
// stub render "measured" (scripts/work/draw/draw-rationale.mjs). tests/work-draw/draw-rationale.spec.mjs judges the gate itself.
import fs from 'node:fs';
import { MEASURE_SCHEMA, regionContainerOf } from '../../scripts/work/draw/draw-rationale.mjs';
import { componentRootOf, parseHtml, visibleElement, walkElements } from '../../scripts/work/draw/draw-dna.mjs';

/** {html, entries, measure(viewport)} for `html`: data-why on every body element, decisions covering it. */
export function withRationale(html) {
  const at = String(html).search(/<body/i);
  const [head, body] = at < 0 ? ['', String(html)] : [String(html).slice(0, at), String(html).slice(at)];
  const tagged = `${head}${body.replace(/<([a-zA-Z][\w-]*)([^>]*?)(\/?)>/g, (m, tag, attrs, close) => (tag.toLowerCase() === 'body' || /data-why=/.test(attrs) ? m : `<${tag}${attrs} data-why="E-el L-all"${close}>`))}`;
  const tree = parseHtml(tagged);
  const used = new Map();
  for (const el of walkElements(tree).filter(visibleElement)) {
    const name = componentRootOf(el);
    if (!name) continue;
    if (!used.has(name)) used.set(name, new Set());
    for (const k of ['data-variant', 'data-tone', 'data-size']) if (el.attrs[k]) used.get(name).add(el.attrs[k]);
  }
  const regions = (regionContainerOf(tree).children ?? []).filter((c) => c.tag && visibleElement(c)).length;
  const dnaLine = [...used].map(([n, v]) => `${n}${v.size ? ` ${[...v].join('/')}` : ''}`).join(', ');
  const base = { because: 'FR-1: the owner reads the installed modules first (01-CONTENT)', rules: ['GAP-4'], alternativesRejected: [{ option: 'a bare list', why: 'no hierarchy' }], source: 'spec fixture' };
  const entries = [
    { id: 'L-all', selector: 'body *', kind: 'layout', decision: 'one column', value: '1 column, gap 16', ...base },
    { id: 'L-order', selector: 'main children order', kind: 'layout', decision: 'region order: header first, then notices, then the collection', value: `${regions} regions`, ...base },
    { id: 'E-el', selector: '[data-grammar-component]', kind: 'element', decision: `DNA components: ${dnaLine}`, value: dnaLine, ...base },
    { id: 'R-card', selector: '.card', kind: 'radius', decision: 'the grammar surface radius', value: '16px', ...base },
    { id: 'T-body', selector: 'body', kind: 'type', decision: 'body type', value: '16px / weight 400 / line-height 24px', ...base },
    { id: 'C-surface', selector: 'body', kind: 'colour', decision: 'white surface', value: '#ffffff', ...base },
  ];
  const measure = (viewport) => ({ schema: MEASURE_SCHEMA, viewport, values: { spacing: [{ value: 16, at: ['main'] }], radius: [{ value: 16, at: ['article'] }], fontSize: [{ value: 16, at: ['p'] }],
    fontWeight: [{ value: 400, at: ['p'] }], lineHeight: [{ value: 24, at: ['p'] }] }, colours: [{ hex: '#ffffff', use: 'background', at: ['main'] }], grids: [], art: [], tokenColours: {}, regions: { count: regions, whys: [] } });
  return { html: tagged, entries, measure };
}

/** Write <file stem>.rationale.json beside an html file from its withRationale entries. */
export function writeRationale(htmlFile, entries) {
  fs.writeFileSync(htmlFile.replace(/\.html?$/i, '.rationale.json'), `${JSON.stringify(entries, null, 2)}\n`);
}
