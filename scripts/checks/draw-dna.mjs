#!/usr/bin/env node
// draw-dna.mjs — owner ruling 2026-09-27: interface.draw composes ONLY the Grammar's DNA components
// (knowledge/grammars/<family>/DNA.yaml renderers[]: 95 components, each with its anatomy classes and closed prop
// values). A drawing is a real HTML render, so the render source says what each visible element IS:
//
//   data-grammar-component="<DNA name>"   the component the element renders (Alert, Meter, SurfaceCard, Button ...)
//   data-grammar-part="<part>"            the anatomy part of the enclosing component (alert-actions, meter-fill ...;
//                                         the DNA class minus `starci-core-`, or minus the component slug too)
//   data-grammar-proposal="<name>"        a gap DNA cannot express: the closest DNA composition stands in, and the
//                                         proposal has an entry in grammar-proposal.md/.yaml (scripts/work/
//                                         grammar-proposal.mjs) the owner is asked about - never invented inline
//   data-<prop>="<value>"                 a closed prop value (data-tone, data-variant, data-size ...), judged against
//                                         the DNA closedValues
//
// Refused per render source:
//   DRAW_OFF_GRAMMAR_COMPONENT  an element with none of the three attributes (pure phrasing - strong, em, br ... -
//                               inherits its parent's; an svg's inner shapes inherit the svg's); a component name DNA
//                               does not publish; a part none of the enclosing components publishes; a closed prop
//                               value outside its DNA values; a proposal with no entry in a grammar-proposal file;
//   DRAW_NOTICE_NOT_ALERT       a notice that is not DNA `Alert` with a tone: an Alert without a tone in the
//                               PresentationState vocabulary, or a container (SurfaceCard, a bare div ...) posing as a
//                               notice - role alert/status or aria-live, notice/callout/banner vocabulary in its
//                               class, a non-neutral tone on the surface, or an outcome-toned IconTile beside an
//                               action (the r4 "white card + IconTile" notice);
//   DRAW_RATIO_NOT_METER        a ratio that is not one DNA `Meter`: role meter/progressbar or <meter>/<progress>
//                               outside Meter/Progress, a Progress or a hand-made bar/track/segment beside an "n/m"
//                               ratio, a segmented Meter with no `Meter.segments` proposal, a Meter with no
//                               role=meter + aria-valuenow/aria-valuemax (DNA claims A11Y-3).
//
//   node scripts/checks/draw-dna.mjs <render.html> [--family starci] [--proposals <file>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { PROPOSAL_FILE_NAMES, readProposals } from '../work/grammar-proposal.mjs';

export const DRAW_OFF_GRAMMAR_COMPONENT = 'DRAW_OFF_GRAMMAR_COMPONENT';
export const DRAW_NOTICE_NOT_ALERT = 'DRAW_NOTICE_NOT_ALERT';
export const DRAW_RATIO_NOT_METER = 'DRAW_RATIO_NOT_METER';
export const DRAW_DNA_CODES = Object.freeze([DRAW_OFF_GRAMMAR_COMPONENT, DRAW_NOTICE_NOT_ALERT, DRAW_RATIO_NOT_METER]);
export const COMPONENT_ATTR = 'data-grammar-component';
export const PART_ATTR = 'data-grammar-part';
export const PROPOSAL_ATTR = 'data-grammar-proposal';
/** The segmented-meter variant the owner asked for (r5 ruling 3): DNA Meter has none, so it is a proposal. */
export const METER_SEGMENTS_PROPOSAL = 'Meter.segments';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAMMARS = path.join(ROOT, 'knowledge', 'grammars');
export const DEFAULT_FAMILY = 'starci';

/**
 * The Grammar's PresentationState vocabulary (knowledge/ui/composition/state.yaml: neutral, informative,
 * affirmative, cautionary, negative, pending, unavailable) and the HeroUI tone names a drawing spells them with.
 */
export const PRESENTATION_STATES = Object.freeze(['neutral', 'informative', 'affirmative', 'cautionary', 'negative', 'pending', 'unavailable']);
export const TONE_ALIASES = Object.freeze({ default: 'neutral', muted: 'neutral', info: 'informative', accent: 'informative', primary: 'informative',
  success: 'affirmative', warning: 'cautionary', danger: 'negative', error: 'negative' });
/** The tone of `value` in the PresentationState vocabulary, or null. */
export const presentationStateOf = (value) => {
  const v = String(value ?? '').trim().toLowerCase();
  return PRESENTATION_STATES.includes(v) ? v : (TONE_ALIASES[v] ?? null);
};
const OUTCOME_STATES = new Set(['affirmative', 'cautionary', 'negative']);

// ---------------------------------------------------------------------------------------------------------
// A tolerant HTML reader: enough of the tree to know every element, its attributes, ancestry and text.
// ---------------------------------------------------------------------------------------------------------

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'template', 'textarea', 'title', 'noscript', 'xmp']);
const TAG_RX = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<![^>]*>|<\?[^>]*>|<\/([a-zA-Z][\w:-]*)\s*>|<([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/g;
const ATTR_RX = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
const decode = (s) => String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");

export function parseAttrs(text) {
  const out = {};
  for (const m of String(text ?? '').matchAll(ATTR_RX)) {
    const name = m[1].toLowerCase();
    if (!Object.hasOwn(out, name)) out[name] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

/** Parse html into {tag:'#root', children:[...]}; an element is {tag, attrs, children, parent, raw?}, a text {text}. */
export function parseHtml(html) {
  const s = String(html ?? '');
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root, i = 0;
  TAG_RX.lastIndex = 0;
  for (let m = TAG_RX.exec(s); m; m = TAG_RX.exec(s)) {
    const text = s.slice(i, m.index);
    if (text.trim()) cur.children.push({ text: decode(text) });
    i = TAG_RX.lastIndex;
    if (m[1]) {
      const tag = m[1].toLowerCase();
      let at = cur;
      while (at && at.tag !== tag) at = at.parent;
      if (at && at.parent) cur = at.parent;
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    const el = { tag, attrs: parseAttrs(m[3]), children: [], parent: cur };
    cur.children.push(el);
    if (RAW.has(tag)) {
      const close = s.toLowerCase().indexOf(`</${tag}`, i);
      const end = close < 0 ? s.length : close;
      el.raw = s.slice(i, end);
      const gt = close < 0 ? s.length : s.indexOf('>', close);
      i = gt < 0 ? s.length : gt + 1;
      TAG_RX.lastIndex = i;
      continue;
    }
    if (!VOID.has(tag) && !m[4]) cur = el;
  }
  const tail = s.slice(i);
  if (tail.trim()) cur.children.push({ text: decode(tail) });
  return root;
}

export const elementsOf = (node) => (node?.children ?? []).filter((c) => c.tag);
/** Every element under `node` in document order. */
export function walkElements(node, out = []) {
  for (const c of elementsOf(node)) { out.push(c); walkElements(c, out); }
  return out;
}
/** The visible text under an element (raw-text elements excluded). */
export function textOf(node) {
  if (!node) return '';
  if (node.text != null) return node.text;
  if (RAW.has(node.tag) || node.tag === 'svg') return '';
  return node.children.map(textOf).join(' ').replace(/\s+/g, ' ').trim();
}
export const classesOf = (el) => String(el?.attrs?.class ?? '').split(/\s+/).filter(Boolean);
const ancestors = (el) => { const out = []; for (let p = el.parent; p && p.tag !== '#root'; p = p.parent) out.push(p); return out; };
const describe = (el) => {
  const cls = classesOf(el).slice(0, 3).join('.');
  const text = textOf(el).slice(0, 40);
  return `<${el.tag}${el.attrs.id ? `#${el.attrs.id}` : ''}${cls ? `.${cls}` : ''}>${text ? ` "${text}"` : ''}`;
};

// ---------------------------------------------------------------------------------------------------------
// DNA
// ---------------------------------------------------------------------------------------------------------

const dnaCache = new Map();
/** The DNA file of a Grammar family: knowledge/grammars/<family>/DNA.yaml, else the starci family's. */
export function dnaFileOf(family = DEFAULT_FAMILY, root = GRAMMARS) {
  for (const f of [family, DEFAULT_FAMILY]) {
    const file = path.join(root, String(f ?? DEFAULT_FAMILY), 'DNA.yaml');
    if (fs.existsSync(file)) return file;
  }
  return null;
}

const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

/**
 * The DNA as the gate reads it: Map(component -> {name, kind, parts:Set, closed:Map(prop -> {values|null, type})}).
 * Parts are the component's anatomy classes minus `starci-core-` (alert-actions), also minus a leading `generic-`
 * and minus the component's own slug (actions), so either spelling names the part.
 */
export function loadDna({ family = DEFAULT_FAMILY, file = null } = {}) {
  const at = file ?? dnaFileOf(family);
  if (!at) return null;
  if (dnaCache.has(at)) return dnaCache.get(at);
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(at, 'utf8')); } catch { doc = null; }
  if (!doc || !Array.isArray(doc.renderers)) { dnaCache.set(at, null); return null; }
  const components = new Map();
  for (const r of doc.renderers) {
    if (!r?.component) continue;
    const slug = kebab(r.component);
    const parts = new Set();
    for (const cls of Array.isArray(r.classes) ? r.classes : []) {
      const bare = String(cls).replace(/^starci-core-/, '');
      const plain = bare.replace(/^generic-/, '');
      for (const p of [bare, plain, plain.startsWith(`${slug}-`) ? plain.slice(slug.length + 1) : null]) if (p) parts.add(p);
    }
    // The root spelled as a part (<slug>, <slug>-root, root) is the component itself.
    if (parts.size) for (const p of [slug, `${slug}-root`, 'root']) parts.add(p);
    const closed = new Map();
    for (const c of Array.isArray(r.closedValues) ? r.closedValues : []) {
      if (!c?.prop) continue;
      closed.set(String(c.prop), { values: Array.isArray(c.values) ? c.values.map(String) : null, type: c.type ?? null });
    }
    components.set(r.component, { name: r.component, kind: r.kind ?? null, slug, parts, closed, classes: Array.isArray(r.classes) ? r.classes : [] });
  }
  const dna = { file: at, family: doc.family ?? family, components };
  dnaCache.set(at, dna);
  return dna;
}

// ---------------------------------------------------------------------------------------------------------
// What is visible and what maps it
// ---------------------------------------------------------------------------------------------------------

const NOT_RENDERED = new Set(['#root', 'html', 'head', 'body', 'script', 'style', 'template', 'noscript', 'meta', 'link', 'title', 'base', 'xmp']);
/** Phrasing that inherits the mapping of its parent when it carries no class, style or id of its own. */
const PHRASING = new Set(['strong', 'em', 'b', 'i', 'u', 's', 'small', 'sub', 'sup', 'abbr', 'mark', 'time', 'code', 'bdi', 'bdo', 'q', 'cite', 'dfn', 'var', 'data', 'kbd', 'br', 'wbr', 'span']);
const hiddenEl = (el) => el.attrs.hidden != null || /display\s*:\s*none/i.test(el.attrs.style ?? '') || el.attrs.type === 'hidden';
const insideSvg = (el) => ancestors(el).some((a) => a.tag === 'svg');
const inHead = (el) => ancestors(el).some((a) => a.tag === 'head' || NOT_RENDERED.has(a.tag) && a.tag !== 'html' && a.tag !== 'body');
const mappedSelf = (el) => el.attrs[COMPONENT_ATTR] != null || el.attrs[PART_ATTR] != null || el.attrs[PROPOSAL_ATTR] != null;
const plainPhrasing = (el) => PHRASING.has(el.tag) && (el.tag === 'br' || el.tag === 'wbr' || (!el.attrs.class && !el.attrs.style && !el.attrs.id));

/** Whether an element renders and so must say what it is. */
export function visibleElement(el) {
  if (NOT_RENDERED.has(el.tag) || inHead(el)) return false;
  if (hiddenEl(el) || ancestors(el).some(hiddenEl)) return false;
  return true;
}

/** The component element that owns `el` (itself or its nearest ancestor with a component), or null. */
export const componentOwnerOf = (el) => [el, ...ancestors(el)].find((a) => a.attrs?.[COMPONENT_ATTR]) ?? null;
const componentNameOf = (el) => (el?.attrs?.[COMPONENT_ATTR] ?? '').trim();
/** The component name when `el` is that component's root (no nearest enclosing element names the same component). */
export const componentRootOf = (el) => {
  const name = componentNameOf(el);
  if (!name) return '';
  const up = ancestors(el).find((a) => a.attrs?.[COMPONENT_ATTR]);
  return up && componentNameOf(up) === name && el.attrs[PART_ATTR] ? '' : name;
};
const proposalOf = (el) => [el, ...ancestors(el)].map((a) => a.attrs?.[PROPOSAL_ATTR]).find((p) => p && p.trim()) ?? null;
const inComponent = (el, names) => [el, ...ancestors(el)].some((a) => names.includes(componentNameOf(a)));

/** The tone an element declares: data-tone / data-grammar-tone / tone / data-state / data-status, else a tone class. */
export function toneOf(el) {
  for (const k of ['data-tone', 'data-grammar-tone', 'tone', 'data-state', 'data-color', 'color']) {
    const t = presentationStateOf(el.attrs?.[k]);
    if (t) return { tone: t, raw: el.attrs[k], via: k };
  }
  for (const cls of classesOf(el)) {
    const m = /(?:^|--|-|_|\b)(neutral|informative|affirmative|cautionary|negative|pending|unavailable|default|info|accent|primary|success|warning|danger|error)$/.exec(cls);
    if (m && (cls === m[1] || /(--|-|_)/.test(cls))) { const t = presentationStateOf(m[1]); if (t) return { tone: t, raw: m[1], via: `class ${cls}` }; }
  }
  return null;
}

/**
 * The proposal names the given grammar-proposal files declare COMPLETE (scripts/work/grammar-proposal.mjs: name, gap,
 * anatomy, tokens, claims, isolated render): Set of names. An incomplete entry is no entry.
 */
export function proposalNamesIn(files) {
  const names = new Set();
  for (const p of readProposals(files)) if (p.complete) for (const n of p.names) names.add(n);
  return names;
}

const RATIO_RX = /(?<![\d./])(\d{1,4})\s*\/\s*(\d{1,4})(?![\d./])/;
const BAR_CLASS = /(?:^|[-_])(bar|bars|track|fill|segment|segments|progress|meter|gauge)(?:$|[-_])/i;
const NOTICE_CLASS = /(?:^|[-_])(notice|callout|banner|attention|alert|toast|announcement)(?:$|[-_])/i;
const CONTAINERS = new Set(['SurfaceCard', 'SurfaceListCard', 'SurfaceAccordionCard', 'SurfaceCopyGroup', 'PageContainer', 'EmptyNotice', 'Fieldset']);
const ACTION_COMPONENTS = new Set(['Button', 'IconButton', 'TextAction', 'Link', 'ButtonGroup']);
const isAction = (el) => ACTION_COMPONENTS.has(componentNameOf(el)) || el.tag === 'button' || (el.tag === 'a' && el.attrs.href != null);

/**
 * The DNA findings of one render source: [{code, detail, count, examples}]. `proposals` is the Set of proposal names
 * the drawing's grammar-proposal file(s) declare; `dna` the loaded DNA (loadDna).
 */
export function dnaFindings(html, { dna = loadDna(), proposals = new Set(), label = 'the render' } = {}) {
  const out = [];
  if (!dna) return [{ code: DRAW_OFF_GRAMMAR_COMPONENT, detail: `${label}: no Grammar DNA (knowledge/grammars/<family>/DNA.yaml) to judge it against`, count: 1, examples: [] }];
  const tree = parseHtml(html);
  const all = walkElements(tree).filter(visibleElement);
  const groups = new Map();
  const add = (code, kind, el, why) => {
    const key = `${code}|${kind}`;
    if (!groups.has(key)) groups.set(key, { code, kind, items: [] });
    groups.get(key).items.push(`${describe(el)}${why ? ` (${why})` : ''}`);
  };

  // 1. Mapping, names, parts, closed values, proposals.
  for (const el of all) {
    if (insideSvg(el)) continue;
    const name = componentNameOf(el);
    const part = (el.attrs[PART_ATTR] ?? '').trim();
    const proposal = (el.attrs[PROPOSAL_ATTR] ?? '').trim();
    if (!mappedSelf(el)) {
      if (plainPhrasing(el) && el.parent && el.parent.tag !== '#root') continue;
      add(DRAW_OFF_GRAMMAR_COMPONENT, 'unmapped element', el, 'no data-grammar-component, data-grammar-part or data-grammar-proposal');
      continue;
    }
    if (name && !dna.components.has(name)) add(DRAW_OFF_GRAMMAR_COMPONENT, 'unknown DNA component', el, `"${name}" is not one of the ${dna.components.size} DNA components`);
    if (proposal && !proposals.has(proposal) && !proposals.has(proposal.split('.')[0]) && ![...proposals].some((p) => p.toLowerCase() === proposal.toLowerCase())) {
      add(DRAW_OFF_GRAMMAR_COMPONENT, 'proposal without an entry', el, `data-grammar-proposal="${proposal}" has no complete entry (name, gap, anatomy, tokens, claims, isolated render) in grammar-proposal.md/.yaml`);
    }
    if (part && !proposalOf(el)) {
      const owners = [el, ...ancestors(el)].map(componentNameOf).filter(Boolean).map((n) => dna.components.get(n)).filter(Boolean);
      const judged = owners.filter((c) => c.parts.size);
      if (judged.length && judged.length === owners.length && !judged.some((c) => c.parts.has(part))) {
        add(DRAW_OFF_GRAMMAR_COMPONENT, 'unknown anatomy part', el, `part "${part}" is none of ${[...new Set(judged.map((c) => c.name))].slice(0, 3).join('/')}'s anatomy`);
      }
    }
    const spec = name ? dna.components.get(name) : null;
    if (spec) {
      for (const [prop, c] of spec.closed) {
        const raw = el.attrs[`data-${kebab(prop)}`] ?? el.attrs[`data-grammar-${kebab(prop)}`];
        if (raw == null || raw === '') continue;
        const ok = c.values ? c.values.includes(raw) : c.type === 'PresentationState' ? Boolean(presentationStateOf(raw)) : true;
        if (!ok) add(DRAW_OFF_GRAMMAR_COMPONENT, 'closed value off DNA', el, `${name} ${prop}="${raw}" is not one of ${c.values ? c.values.join('|') : 'the PresentationState values'}`);
      }
    }
  }

  // 2. Alert: every notice is an Alert with a tone.
  for (const el of all.filter((e) => componentRootOf(e) === 'Alert')) {
    const tone = toneOf(el);
    if (!tone) add(DRAW_NOTICE_NOT_ALERT, 'Alert without a tone', el, 'DNA Alert carries tone (PresentationState): data-tone="warning|success|danger|info|neutral"');
  }
  for (const el of all) {
    if (insideSvg(el)) continue;
    const name = componentNameOf(el);
    if (inComponent(el, ['Alert', 'AlertDialog', 'Toast', 'Toaster'])) continue;
    // A leaf component (Text, Badge, Button ...) is never a notice; a container or a bare box can pose as one.
    const container = CONTAINERS.has(name);
    if (!container && !(!name && ['div', 'section', 'aside', 'article'].includes(el.tag))) continue;
    // A grid or section that holds real Alerts is their wrapper, not a notice of its own.
    if (walkElements(el).some((d) => componentRootOf(d) === 'Alert')) continue;
    const role = String(el.attrs.role ?? '').toLowerCase();
    const reasons = [];
    if (['alert', 'status', 'alertdialog'].includes(role)) reasons.push(`role=${role}`);
    if (el.attrs['aria-live'] && el.attrs['aria-live'] !== 'off') reasons.push(`aria-live=${el.attrs['aria-live']}`);
    const noticeClass = classesOf(el).find((c) => NOTICE_CLASS.test(c));
    if (noticeClass) reasons.push(`class ${noticeClass}`);
    const tone = container ? toneOf(el) : null;
    if (tone && tone.tone !== 'neutral') reasons.push(`a ${tone.raw}-toned ${name}`);
    if (container) {
      const tiles = walkElements(el).filter((d) => componentNameOf(d) === 'IconTile' && ancestors(d).find((a) => CONTAINERS.has(componentNameOf(a))) === el);
      const outcomeTile = tiles.find((t) => OUTCOME_STATES.has(toneOf(t)?.tone));
      if (outcomeTile && walkElements(el).some(isAction)) reasons.push(`an ${toneOf(outcomeTile).raw}-toned IconTile beside an action`);
    }
    if (reasons.length) add(DRAW_NOTICE_NOT_ALERT, 'notice posing as another component', el, `${reasons.join(', ')}: a notice is DNA Alert with tone + alert-actions, never ${name || 'a hand-built box'}`);
  }

  // 3. Meter: every ratio is one Meter.
  for (const el of all) {
    if (insideSvg(el)) continue;
    const name = componentNameOf(el);
    const role = String(el.attrs.role ?? '').toLowerCase();
    const inMeter = inComponent(el, ['Meter']);
    if ((el.tag === 'meter' || role === 'meter') && !inMeter) add(DRAW_RATIO_NOT_METER, 'meter outside Meter', el, 'a measured ratio renders through DNA Meter');
    if ((el.tag === 'progress' || role === 'progressbar') && !inMeter && !inComponent(el, ['Progress', 'ProgressCircle', 'Slider'])) add(DRAW_RATIO_NOT_METER, 'hand-made progress', el, 'a hand-built progress bar; a ratio is DNA Meter');
    if (name === 'Progress' || name === 'ProgressCircle') {
      const scope = el.parent ?? el;
      if (RATIO_RX.test(textOf(scope))) add(DRAW_RATIO_NOT_METER, 'ratio as Progress', el, `"${RATIO_RX.exec(textOf(scope))[0]}" is a ratio: Meter, never Progress`);
    }
    if (!name && !inMeter && !inComponent(el, ['Progress', 'ProgressCircle', 'Slider', 'Rating']) && classesOf(el).some((c) => BAR_CLASS.test(c))) {
      const scope = el.parent?.parent ?? el.parent ?? el;
      if (RATIO_RX.test(textOf(scope))) add(DRAW_RATIO_NOT_METER, 'hand-made bar', el, `a bar beside the ratio "${RATIO_RX.exec(textOf(scope))[0]}": one DNA Meter`);
    }
    if (componentRootOf(el) === 'Meter') {
      const segments = walkElements(el).filter((d) => /segment/i.test(`${d.attrs[PART_ATTR] ?? ''} ${classesOf(d).join(' ')}`));
      const proposed = [el, ...segments].some((d) => (d.attrs[PROPOSAL_ATTR] ?? '').trim() === METER_SEGMENTS_PROPOSAL);
      if (segments.length && !proposed) add(DRAW_RATIO_NOT_METER, 'segmented Meter without its proposal', el, `DNA Meter has no segmented variant: mark it data-grammar-proposal="${METER_SEGMENTS_PROPOSAL}" with an entry in grammar-proposal`);
      const meterEl = [el, ...walkElements(el)].find((d) => d.tag === 'meter' || String(d.attrs.role ?? '').toLowerCase() === 'meter');
      if (!meterEl) add(DRAW_RATIO_NOT_METER, 'Meter without role=meter', el, 'one role=meter (or <meter>) carries the value (DNA claims A11Y-3)');
      else if (meterEl.tag !== 'meter' && (meterEl.attrs['aria-valuenow'] == null || meterEl.attrs['aria-valuemax'] == null)) add(DRAW_RATIO_NOT_METER, 'Meter without its value', meterEl, 'role=meter needs aria-valuenow and aria-valuemax');
    }
  }

  for (const g of groups.values()) {
    out.push({ code: g.code, kind: g.kind, count: g.items.length, examples: g.items.slice(0, 8),
      detail: `${label}: ${g.items.length} ${g.kind}${g.items.length > 1 ? 's' : ''} - ${g.items.slice(0, 4).join('; ')}${g.items.length > 4 ? ` (+${g.items.length - 4})` : ''}` });
  }
  return out;
}

/** The grammar-proposal files that belong to a render source: grammar-proposal.{md,yaml,yml} beside it and in `dirs`. */
export function proposalFilesFor(htmlFile, dirs = []) {
  const out = [];
  for (const dir of [path.dirname(htmlFile), ...dirs]) {
    for (const name of PROPOSAL_FILE_NAMES) {
      const f = path.join(dir, name);
      if (fs.existsSync(f) && !out.includes(f)) out.push(f);
    }
  }
  return out;
}

/** Judge one render source file. */
export function dnaFindingsOfFile(file, { family = DEFAULT_FAMILY, proposalFiles = null, dirs = [] } = {}) {
  const html = fs.readFileSync(file, 'utf8');
  const files = proposalFiles ?? proposalFilesFor(file, dirs);
  return dnaFindings(html, { dna: loadDna({ family }), proposals: proposalNamesIn(files), label: path.basename(file) });
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith('--') && /\.html?$/i.test(a));
  if (!file) { process.stderr.write('use: node scripts/checks/draw-dna.mjs <render.html> [--family starci] [--proposals <file>] [--json]\n'); return 2; }
  const at = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const findings = dnaFindingsOfFile(path.resolve(file), { family: at('--family') ?? DEFAULT_FAMILY, proposalFiles: at('--proposals') ? [path.resolve(at('--proposals'))] : null });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ ok: !findings.length, findings }, null, 2)}\n`);
  else process.stdout.write(`${findings.length ? 'REFUSED' : 'ok'}: ${findings.length} finding group(s)\n${findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}\n`);
  return findings.length ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; });
}
