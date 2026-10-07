import { COMPONENT_ATTR, PART_ATTR, componentRootOf, parseHtml, visibleElement, walkElements, classesOf } from './draw-dna.mjs';
import { list } from '../../lib/list.mjs';
import { ancestorsOf } from '../../lib/dom-tree.mjs';

const PHRASING = new Set(['strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'abbr', 'mark', 'time', 'code', 'bdi', 'bdo', 'q', 'cite', 'dfn', 'var', 'data', 'kbd', 'br', 'wbr', 'span']);
const KINDS_OF_CLASS = Object.freeze({ spacing: ['spacing', 'layout'], radius: ['radius'], fontSize: ['type'], fontWeight: ['type'], lineHeight: ['type'] });
const CLASS_LABEL = Object.freeze({ spacing: 'gap/padding/inset', radius: 'radius', fontSize: 'font-size', fontWeight: 'font-weight', lineHeight: 'line-height' });

const describe = (el) => {
  const cls = classesOf(el).slice(0, 2).join('.');
  return '<' + el.tag + (el.attrs.id ? '#' + el.attrs.id : '') + (cls ? '.' + cls : '') + '>';
};
const whysOf = (el, whyAttr, str) => str(el?.attrs?.[whyAttr]).split(/\s+/).filter(Boolean);
const inRedline = (el, redlineAttr) => [el, ...ancestorsOf(el)].some((a) => a.attrs?.[redlineAttr] != null || a.attrs?.id === 'redlines');
const refsOf = (record) => list(record?.refs).map((r) => (typeof r === 'string' ? r : r?.id ?? r?.ref ?? null)).filter(Boolean).map(String);
const hexRgb = (hex) => { const h = String(hex).replace('#', ''); return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)); };
const colourClose = (a, b) => { const x = hexRgb(a), y = hexRgb(b); return x.every((v, i) => Math.abs(v - y[i]) <= 2); };

export function findRationaleIssues({ html, entries, errors, measures, resolve, record, dna, label, redlines }, { str, statesValue, round, statedValues, becauseCites, kebab, regionContainerOf, code, measureSchema, whyAttr, redlineAttr }) {
  const groups = new Map();
  const add = (kind, item) => {
    if (!groups.has(kind)) groups.set(kind, []);
    groups.get(kind).push(item);
  };
  for (const e of errors) add('rationale file', e);
  const byId = new Map(entries.filter((e) => e?.id != null).map((e) => [String(e.id), e]));

  const inspectDecisions = () => {
    const refs = refsOf(record);
    for (const e of entries) {
      for (const r of list(e.rules)) {
        const got = resolve(r);
        if (!got.ok) add('unresolvable rule id', `${e.id}: "${str(r).slice(0, 60)}" (${got.why})`);
      }
      if (!str(e.because).trim()) add('empty because', `${e.id}`);
      else if (!becauseCites(e.because, refs)) add('because cites no FR, content or user job', `${e.id}: "${str(e.because).slice(0, 60)}"`);
    }
  };
  inspectDecisions();

  const tree = parseHtml(html);
  const visible = walkElements(tree).filter((el) => visibleElement(el) && !inRedline(el, redlineAttr));
  const inspectVisibleElements = () => {
    for (const el of visible) {
      if (ancestorsOf(el).some((a) => a.tag === 'svg')) continue;
      const ids = whysOf(el, whyAttr, str);
      if (!ids.length) {
        if (PHRASING.has(el.tag) && (el.tag === 'br' || el.tag === 'wbr' || (!el.attrs.class && !el.attrs.style && !el.attrs.id)) && el.parent?.tag !== '#root') continue;
        add('element without data-why', describe(el));
        continue;
      }
      for (const id of ids) if (!byId.has(id)) add('data-why naming no decision', `${describe(el)} data-why="${id}"`);
    }
  };
  inspectVisibleElements();

  const container = regionContainerOf(tree);
  const regions = (container.children ?? []).filter((c) => c.tag && visibleElement(c) && !inRedline(c, redlineAttr) && !['script', 'style', 'template'].includes(c.tag));
  const inspectRegions = () => {
    for (const r of regions) {
      const kinds = whysOf(r, whyAttr, str).map((id) => byId.get(id)?.kind).filter(Boolean);
      if (kinds.length && !kinds.includes('layout')) add('region without a layout decision', `${describe(r)} (${whysOf(r, whyAttr, str).join(' ')} is ${kinds.join('/')})`);
    }
    const orderEntries = entries.filter((e) => e.kind === 'layout' && /order/i.test(`${e.id} ${e.selector} ${e.decision}`));
    const counts = new Set([regions.length, ...measures.map((m) => m?.regions?.count).filter(Number.isFinite)]);
    if (regions.length > 1 && !orderEntries.length) add('no region order decision', `${regions.length} regions and no layout decision states their order (id, selector or decision naming "order")`);
    else if (regions.length > 1 && !orderEntries.some((e) => [...counts].some((n) => statedValues(`${e.value} ${e.decision}`).nums.has(n)))) {
      add('region order without its count', `${orderEntries.map((e) => e.id).join(', ')} names no region count (${[...counts].join(' or ')})`);
    }
  };
  inspectRegions();

  const mentions = (needle) => {
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    return entries.some((e) => new RegExp(`(^|[^A-Za-z0-9])${escaped}([^A-Za-z0-9]|$)`).test(`${str(e.decision)} ${str(e.value)} ${list(e.rules).map(str).join(' ')}`));
  };
  const variantsOfElement = (el, spec) => {
    const variants = [];
    for (const [k, v] of Object.entries(el.attrs)) {
      if (!k.startsWith('data-') || [COMPONENT_ATTR, PART_ATTR, whyAttr, 'data-grammar-proposal'].includes(k) || !v) continue;
      const prop = k.replace(/^data-(grammar-)?/, '');
      const closed = spec ? [...spec.closed.keys()].find((p) => kebab(p) === prop) : null;
      if (closed || ['variant', 'size', 'tone', 'color'].includes(prop)) variants.push(`${prop}=${v}`);
    }
    return variants;
  };
  const collectUsedVariants = () => {
    const used = new Map();
    for (const el of visible) {
      const name = componentRootOf(el);
      if (!name) continue;
      if (!used.has(name)) used.set(name, new Set());
      const spec = dna?.components?.get(name);
      for (const variant of variantsOfElement(el, spec)) used.get(name).add(variant);
    }
    return used;
  };
  const inspectUsedVariants = (used) => {
    for (const [name, variants] of used) {
      if (!mentions(name)) { add('DNA component without a decision', name); continue; }
      for (const pv of variants) {
        const value = pv.split('=')[1];
        if (!entries.some((e) => {
          const text = `${str(e.decision)} ${str(e.value)} ${list(e.rules).map(str).join(' ')}`;
          return new RegExp(`(^|[^A-Za-z0-9])${name}([^A-Za-z0-9]|$)`).test(text) && text.toLowerCase().includes(value.toLowerCase());
        })) add('DNA variant without a decision', `${name} ${pv}`);
      }
    }
  };
  inspectUsedVariants(collectUsedVariants());

  const inspectArtSlots = () => {
    const artOf = (el) => whysOf(el, whyAttr, str).some((id) => byId.get(id)?.kind === 'art');
    for (const el of visible) {
      const slot = el.tag === 'img' || el.tag === 'picture' || el.attrs['data-asset-slot'] != null || el.attrs['data-artwork-slot'] != null;
      if (slot && whysOf(el, whyAttr, str).length && !artOf(el)) add('art slot without an art decision', describe(el));
    }
  };
  inspectArtSlots();

  let need;
  const inspectMeasuredValues = (m) => {
    for (const cls of Object.keys(need)) {
      for (const v of list(m.values?.[cls])) {
        const key = typeof v.value === 'number' ? round(v.value) : String(v.value);
        if (!need[cls].has(key)) need[cls].set(key, { value: key, at: new Set() });
        need[cls].get(key).at.add(`${m.viewport?.width ?? '?'}px ${list(v.at)[0] ?? ''}`.trim());
      }
    }
  };
  const inspectMeasuredGrids = (m) => {
    const gridsSeen = new Set();
    for (const g of list(m.grids)) {
      const gk = `${g.selector}|${g.columns}|${list(g.why).join(' ')}`;
      if (gridsSeen.has(gk)) continue;
      gridsSeen.add(gk);
      const own = list(g.why).map((id) => byId.get(id)).filter(Boolean);
      if (!own.some((e) => e.kind === 'layout' && statedValues(`${e.value} ${e.decision}`).nums.has(g.columns))) {
        add('grid without its column count', `${g.selector} at ${m.viewport?.width ?? '?'}px renders ${g.columns} column(s); its layout decision (${list(g.why).join(' ') || 'none'}) does not state ${g.columns}`);
      }
    }
  };
  const inspectMeasuredColours = (m) => {
    const tokens = m.tokenColours ?? {};
    const colourEntries = entries.filter((e) => e.kind === 'colour');
    const named = (hex) => colourEntries.some((e) => {
      const text = `${str(e.decision)} ${str(e.value)}`.toLowerCase();
      if (text.includes(hex.toLowerCase())) return true;
      for (const t of text.match(/--[a-z0-9-]+/g) ?? []) if (tokens[t] && colourClose(tokens[t], hex)) return true;
      return false;
    });
    for (const c of list(m.colours)) if (!named(c.hex)) add('colour without a decision', `${c.hex} (${c.use} at ${m.viewport?.width ?? '?'}px, ${list(c.at)[0] ?? ''})`);
  };
  const inspectMeasuredArt = (m) => {
    for (const a of list(m.art)) {
      const own = list(a.why).map((id) => byId.get(id)).filter(Boolean);
      if (!own.some((e) => e.kind === 'art')) add('art slot without an art decision', `${a.selector} at ${m.viewport?.width ?? '?'}px (a background image)`);
    }
  };
  const inspectMissingMeasuredValues = () => {
    for (const [cls, values] of Object.entries(need)) {
      const kinds = KINDS_OF_CLASS[cls];
      for (const { value, at } of values.values()) {
        if (!entries.some((e) => kinds.includes(e.kind) && statesValue(e, value))) {
          let displayValue = value;
          if (typeof value === 'number') {
            displayValue = String(value);
            if (cls !== 'fontWeight') displayValue += 'px';
          }
          add(`uncovered ${CLASS_LABEL[cls]} value`, `${displayValue} (${[...at].slice(0, 2).join('; ')}) - no ${kinds.join('/')} decision states it in its value`);
        }
      }
    }
  };
  const inspectMeasures = () => {
    if (!measures.length || measures.some((m) => m?.schema !== measureSchema)) {
      add('render not measured', `${label} has no measured render (draw-render records carry rationale measures): re-render it with starci work draw-render`);
    }
    need = { spacing: new Map(), radius: new Map(), fontSize: new Map(), fontWeight: new Map(), lineHeight: new Map() };
    for (const m of measures.filter((x) => x?.schema === measureSchema)) {
      inspectMeasuredValues(m);
      inspectMeasuredGrids(m);
      inspectMeasuredColours(m);
      inspectMeasuredArt(m);
    }
    inspectMissingMeasuredValues();
  };
  const inspectRedlines = () => {
    if (Array.isArray(redlines)) {
      for (const r of redlines) if (!r.ok) add('no redline render', `${r.part ?? label}: no annotated redline (<part>.redline.png) - draw-render captures it with the rationale beside the source`);
    }
  };
  const summarize = () => {
    const out = [];
    for (const [kind, items] of groups) {
      out.push({ code, kind, count: items.length, examples: items.slice(0, 8),
        detail: `${label}: ${kind} (${items.length}) - ${items.slice(0, 4).join('; ')}${items.length > 4 ? ' (+' + (items.length - 4) + ')' : ''}` });
    }
    return out;
  };

  inspectMeasures();
  inspectRedlines();
  return summarize();
}
