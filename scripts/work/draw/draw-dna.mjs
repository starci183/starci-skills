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
//                               a status dot that is not the DNA Badge isDot dot (grammar 0.5.3: HeroUI's
//                               <CircleFill width={6} />, part badge-dot / class starci-core-badge-dot inside a Badge) -
//                               a hand-made dot span, a dot with a box-shadow/ring/outline halo, or a dot not 6px;
//   DRAW_NOTICE_NOT_ALERT       a notice that is not DNA `Alert` with a tone: an Alert without a tone in the
//                               PresentationState vocabulary, or a container (SurfaceCard, a bare div ...) posing as a
//                               notice - role alert/status or aria-live, notice/callout/banner vocabulary in its
//                               class, a non-neutral tone on the surface, or an outcome-toned IconTile beside an
//                               action (the r4 "white card + IconTile" notice);
//   DRAW_RATIO_NOT_METER        a ratio that is not one DNA `Meter`: role meter/progressbar or <meter>/<progress>
//                               outside Meter/Progress, a Progress or a hand-made bar/track/segment beside an "n/m"
//                               ratio, a hand-segmented Meter (segments without the DNA meter-segment anatomy), a Meter with no
//                               role=meter + aria-valuenow/aria-valuemax (DNA claims A11Y-3).
//   DRAW_ALERT_ANATOMY          (owner ruling 2026-09-27: the Alert is the REAL HeroUI Alert - @heroui/styles
//                               alert.css: `.alert` bg-surface + shadow-surface, a flex row; `.alert__indicator` a
//                               size-4 glyph with p-1 in the tone's soft-foreground; `.alert__title` text-sm/6 medium
//                               in the tone's soft-foreground; `.alert__description` muted; its action the grammar's
//                               Button in the variant the grammar Alert (0.5.3) gives its tone, as HeroUI's own Alert
//                               examples pair them: informative/accent -> primary, negative/danger -> danger, every
//                               other tone -> secondary) an Alert whose declared or computed background is a tone
//                               or any colour other than --surface; an IconTile, or an indicator 32px or larger,
//                               inside it; its indicator after its title rather than on the left; a hand-made (non-DNA)
//                               action inside it, a Button variant outside the DNA closedValues, or a DNA variant other
//                               than its tone's (a primary action on a warning Alert, a danger one on a non-danger Alert).
//   DRAW_METER_TRACK            (owner ruling 2026-09-27) a Meter track that is not the HeroUI h-2 (8px) track - h-1
//                               (4px) when segmented (DNA `Meter segments`, grammar 0.5.2) - spanning the full width
//                               of its band: a declared height other than that, a fixed pixel width
//                               (a stub), and - measured on the capture (draw-render `anatomy`) - a track narrower
//                               than its band's content box or segments of unequal width / wide gaps.
//   DRAW_ASSET_SLOT_UNDECLARED  (owner ruling 2026-09-27: artwork comes from interface.asset, never reused ad hoc)
//                               raster artwork (Image, MediaFrame, RankArtwork, a bare img) with no
//                               data-asset-slot="<id>", or a slot the drawing's asset-request.md does not request
//                               (scripts/work/asset-slot.mjs).
//
//   starci work draw-dna <render.html> [--family starci] [--proposals <file>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { PROPOSAL_FILE_NAMES, readProposals } from '../grammar-proposal.mjs'; import { isMain } from '../../lib/is-main.mjs';
import { ancestorsOf } from '../../lib/dom-tree.mjs';
import { appendDnaFindings } from './draw-dna-findings.mjs';

export const DRAW_OFF_GRAMMAR_COMPONENT = 'DRAW_OFF_GRAMMAR_COMPONENT';
export const DRAW_NOTICE_NOT_ALERT = 'DRAW_NOTICE_NOT_ALERT';
export const DRAW_RATIO_NOT_METER = 'DRAW_RATIO_NOT_METER';
export const DRAW_ALERT_ANATOMY = 'DRAW_ALERT_ANATOMY';
/** Grammar 0.5.3 Badge isDot: the dot's class and its one size (HeroUI's <CircleFill width={6} />). */
const BADGE_DOT_CLASS = 'starci-core-badge-dot';
const BADGE_DOT_PX = 6;
const DOT_CLASS = /(?:^|[-_])(dot|status-dot|dot-indicator)(?:$|[-_])/i;
/**
 * The grammar Alert's action Button variant for a PresentationState tone (@starci/grammar 0.5.3 Alert, after HeroUI v3's
 * Alert examples: accent Alert -> primary "Refresh", danger Alert -> danger "Retry"; HeroUI has no success or warning
 * Button variant, so every other tone keeps secondary).
 */
export const alertActionVariantFor = (tone) => tone === 'informative' && 'primary' || tone === 'negative' && 'danger' || 'secondary';
export const DRAW_METER_TRACK = 'DRAW_METER_TRACK';
export const DRAW_ASSET_SLOT_UNDECLARED = 'DRAW_ASSET_SLOT_UNDECLARED';
export const DRAW_DNA_CODES = Object.freeze([DRAW_OFF_GRAMMAR_COMPONENT, DRAW_NOTICE_NOT_ALERT, DRAW_RATIO_NOT_METER, DRAW_ALERT_ANATOMY, DRAW_METER_TRACK, DRAW_ASSET_SLOT_UNDECLARED]);
/** The attribute a drawing marks an artwork slot with; interface.asset fills it (scripts/work/asset-slot.mjs). */
export const ASSET_SLOT_ATTR = 'data-asset-slot';
/** The HeroUI Meter/Progress track height (meter.css `.meter__track` h-2), in CSS px. */
const METER_TRACK_PX = 8;
/** The segmented Meter track height (grammar 0.5.2 `.starci-core-meter-segments` h-1), in CSS px. */
const METER_SEGMENTED_TRACK_PX = 4;
/** The widest gap between two segments that still reads as one track (the grammar sets 0.25rem). */
const METER_SEGMENT_GAP_MAX_PX = 8;
/** The indicator size at which an Alert glyph has become a tile (IconTile sm is 32px; HeroUI's glyph is size-4 + p-1). */
const ALERT_INDICATOR_MAX_PX = 32;
/** A track at least this share of its band's content width spans it (sub-pixel rounding, borders). */
const METER_FULL_WIDTH_SHARE = 0.95;
export const COMPONENT_ATTR = 'data-grammar-component';
export const PART_ATTR = 'data-grammar-part';
const PROPOSAL_ATTR = 'data-grammar-proposal';
/** The segmented-meter proposal the owner accepted; since grammar 0.5.2 it is DNA `Meter segments` (2..12). */
const METER_SEGMENTS_PROPOSAL = 'Meter.segments';
/** A segment of a Meter spelled with the DNA anatomy (part / class / grammar hook), not a hand-cut bar. */
const dnaSegment = (d) => /^(meter-)?segments?$/.test((d.attrs?.[PART_ATTR] ?? '').trim()) || classesOf(d).some((c) => /^starci-core-meter-segments?$/.test(c))
  || d.attrs?.['data-grammar-meter-segment'] != null || d.attrs?.['data-grammar-meter-segments'] != null;
/** Whether a Meter root draws segments (DNA `segments`, its hooks, or segment anatomy under it). */
const segmentedMeter = (el) => el.attrs?.['data-segments'] != null || el.attrs?.['data-grammar-meter-segments'] != null
  || walkElements(el).some((d) => dnaSegment(d) || /segment/i.test(`${d.attrs?.[PART_ATTR] ?? ''} ${classesOf(d).join(' ')}`));

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GRAMMARS = path.join(ROOT, 'knowledge', 'grammars');
const DEFAULT_FAMILY = 'starci';

/**
 * The Grammar's PresentationState vocabulary (knowledge/ui/composition/state.yaml: neutral, informative,
 * affirmative, cautionary, negative, pending, unavailable) and the HeroUI tone names a drawing spells them with.
 */
const PRESENTATION_STATES = Object.freeze(['neutral', 'informative', 'affirmative', 'cautionary', 'negative', 'pending', 'unavailable']);
const TONE_ALIASES = Object.freeze({ default: 'neutral', muted: 'neutral', info: 'informative', accent: 'informative', primary: 'informative',
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
const MARKUP_TAG_PATTERN = '<!--[\\s\\S]*?-->|<!\\[CDATA\\[[\\s\\S]*?\\]\\]>|<![^>]*>|<\\?[^>]*>';
const END_TAG_PATTERN = '<\\/([a-zA-Z][\\w:-]*)\\s*>';
const START_TAG_NAME_PATTERN = '<([a-zA-Z][\\w:-]*)';
const START_TAG_ATTRIBUTES_PATTERN = "((?:\\s+[^\\s\"'>/=]+(?:\\s*=\\s*(?:\"[^\"]*\"|'[^']*'|[^\\s\"'=<>`]+))?)*)\\s*(\\/?)>";
const TAG_RX = new RegExp(`${MARKUP_TAG_PATTERN}|${END_TAG_PATTERN}|${START_TAG_NAME_PATTERN}${START_TAG_ATTRIBUTES_PATTERN}`, 'g');
const ATTR_NAME_PATTERN = "([^\\s\"'>/=]+)";
const ATTR_VALUE_PATTERN = "(?:\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+)))?";
const ATTR_RX = new RegExp(`${ATTR_NAME_PATTERN}${ATTR_VALUE_PATTERN}`, 'g');
const decode = (s) => String(s).replaceAll('&nbsp;', ' ').replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll(/&#39;|&apos;/g, "'");

function parseAttrs(text) {
  const out = {};
  for (const m of String(text ?? '').matchAll(ATTR_RX)) {
    const name = m[1].toLowerCase();
    if (!Object.hasOwn(out, name)) out[name] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

const appendParsedText = (node, text) => { if (text.trim()) node.children.push({ text: decode(text) }); };

function closeHtmlTag(current, tag) {
  let at = current;
  while (at && at.tag !== tag) at = at.parent;
  return at?.parent ? at.parent : current;
}

function appendHtmlTag(s, match, current, index) {
  if (match[1]) return { current: closeHtmlTag(current, match[1].toLowerCase()), index: null };
  if (!match[2]) return { current, index: null };
  const tag = match[2].toLowerCase();
  const el = { tag, attrs: parseAttrs(match[3]), children: [], parent: current };
  current.children.push(el);
  if (RAW.has(tag)) {
    const close = s.toLowerCase().indexOf(`</${tag}`, index);
    const end = close < 0 ? s.length : close;
    el.raw = s.slice(index, end);
    const gt = close < 0 ? s.length : s.indexOf('>', close);
    const nextIndex = gt < 0 ? s.length : gt + 1;
    TAG_RX.lastIndex = nextIndex;
    return { current, index: nextIndex };
  }
  return { current: !VOID.has(tag) && !match[4] ? el : current, index: null };
}

/** Parse html into {tag:'#root', children:[...]}; an element is {tag, attrs, children, parent, raw?}, a text {text}. */
export function parseHtml(html) {
  const s = String(html ?? '');
  const root = { tag: '#root', attrs: {}, children: [], parent: null };
  let cur = root, i = 0;
  TAG_RX.lastIndex = 0;
  for (let m = TAG_RX.exec(s); m; m = TAG_RX.exec(s)) {
    appendParsedText(cur, s.slice(i, m.index));
    i = TAG_RX.lastIndex;
    const result = appendHtmlTag(s, m, cur, i);
    cur = result.current;
    if (result.index !== null) i = result.index;
  }
  appendParsedText(cur, s.slice(i));
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
const describe = (el) => {
  const cls = classesOf(el).slice(0, 3).join('.');
  const text = textOf(el).slice(0, 40);
  return '<' + el.tag + (el.attrs.id ? '#' + el.attrs.id : '') + (cls ? '.' + cls : '') + '>' + (text ? ' "' + text + '"' : '');
};

// ---------------------------------------------------------------------------------------------------------
// DNA
// ---------------------------------------------------------------------------------------------------------

const dnaCache = new Map();
/** The DNA file of a Grammar family: knowledge/grammars/<family>/DNA.yaml, else the starci family's. */
function dnaFileOf(family = DEFAULT_FAMILY, root = GRAMMARS) {
  for (const f of [family, DEFAULT_FAMILY]) {
    const file = path.join(root, String(f ?? DEFAULT_FAMILY), 'DNA.yaml');
    if (fs.existsSync(file)) return file;
  }
  return null;
}

const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

const arrayOf = (value) => Array.isArray(value) ? value : [];

function partsOfRenderer(slug, classes) {
  const parts = new Set();
  for (const cls of classes) {
    const bare = String(cls).replace(/^starci-core-/, '');
    const plain = bare.replace(/^generic-/, '');
    for (const p of [bare, plain, plain.startsWith(`${slug}-`) ? plain.slice(slug.length + 1) : null]) if (p) parts.add(p);
  }
  // The root spelled as a part (<slug>, <slug>-root, root) is the component itself.
  if (parts.size) for (const p of [slug, `${slug}-root`, 'root']) parts.add(p);
  return parts;
}

function closedValuesOfRenderer(closedValues) {
  const closed = new Map();
  for (const c of arrayOf(closedValues)) {
    if (!c?.prop) continue;
    closed.set(String(c.prop), { values: Array.isArray(c.values) ? c.values.map(String) : null, type: c.type ?? null });
  }
  return closed;
}

function componentFromRenderer(r) {
  const slug = kebab(r.component);
  const classes = arrayOf(r.classes);
  return { name: r.component, kind: r.kind ?? null, slug, parts: partsOfRenderer(slug, classes), closed: closedValuesOfRenderer(r.closedValues), classes };
}

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
    components.set(r.component, componentFromRenderer(r));
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
const insideSvg = (el) => ancestorsOf(el).some((a) => a.tag === 'svg');
const inHead = (el) => ancestorsOf(el).some((a) => a.tag === 'head' || NOT_RENDERED.has(a.tag) && a.tag !== 'html' && a.tag !== 'body');
const mappedSelf = (el) => el.attrs[COMPONENT_ATTR] != null || el.attrs[PART_ATTR] != null || el.attrs[PROPOSAL_ATTR] != null;
const plainPhrasing = (el) => PHRASING.has(el.tag) && (el.tag === 'br' || el.tag === 'wbr' || (!el.attrs.class && !el.attrs.style && !el.attrs.id));

/** Whether an element renders and so must say what it is. */
export function visibleElement(el) {
  if (NOT_RENDERED.has(el.tag) || inHead(el)) return false;
  if (hiddenEl(el) || ancestorsOf(el).some(hiddenEl)) return false;
  return true;
}

const componentNameOf = (el) => (el?.attrs?.[COMPONENT_ATTR] ?? '').trim();
/** The component name when `el` is that component's root (no nearest enclosing element names the same component). */
export const componentRootOf = (el) => {
  const name = componentNameOf(el);
  if (!name) return '';
  const up = ancestorsOf(el).find((a) => a.attrs?.[COMPONENT_ATTR]);
  return up && componentNameOf(up) === name && el.attrs[PART_ATTR] ? '' : name;
};
const proposalOf = (el) => [el, ...ancestorsOf(el)].map((a) => a.attrs?.[PROPOSAL_ATTR]).find((p) => p?.trim()) ?? null;
const inComponent = (el, names) => [el, ...ancestorsOf(el)].some((a) => names.includes(componentNameOf(a)));

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

// ---------------------------------------------------------------------------------------------------------
// Declared style: inline style, utility classes and the render's own <style> rules
// ---------------------------------------------------------------------------------------------------------

const declsOf = (text) => {
  const out = {};
  for (const part of String(text ?? '').split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).replace(/!important/i, '').trim();
  }
  return out;
};
const STYLE_RULE_PATTERN = '([^{}]+)\\{([^{}]*)\\}';
const STYLE_RULE_RX = new RegExp(STYLE_RULE_PATTERN, 'g');
const SELECTOR_COMBINATOR_PATTERN = '\\s*[>+~]\\s*|\\s+';
const SELECTOR_COMBINATOR_RX = new RegExp(SELECTOR_COMBINATOR_PATTERN);
const ATTRIBUTE_BLOCK_PATTERN = '\\[[^\\]]*\\]';
const ATTRIBUTE_BLOCK_RX = new RegExp(ATTRIBUTE_BLOCK_PATTERN, 'g');
const ATTRIBUTE_SELECTOR_PATTERN = "\\[([\\w:-]+)(?:\\s*[~|^$*]?=\\s*[\"']?([^\"'\\]]*)[\"']?)?\\]";
const ATTRIBUTE_SELECTOR_RX = new RegExp(ATTRIBUTE_SELECTOR_PATTERN, 'g');

/** The flat rules of the render's <style> blocks: [{selector, decls}] (innermost blocks of an @media included). */
function styleRulesOf(tree) {
  const out = [];
  for (const el of walkElements(tree).filter((e) => e.tag === 'style')) {
    const css = String(el.raw ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(STYLE_RULE_RX)) {
      const decls = declsOf(m[2]);
      for (const selector of m[1].split(',').map((s) => s.trim()).filter((s) => s && !s.startsWith('@'))) out.push({ selector, decls });
    }
  }
  return out;
}

/** Whether a selector's last compound (no pseudo-class) matches `el` by tag, id, classes and attributes. */
function selectorMatches(selector, el) {
  const last = selector.split(SELECTOR_COMBINATOR_RX).findLast(Boolean) ?? '';
  if (!last || /:/.test(last.replace(ATTRIBUTE_BLOCK_RX, ''))) return false;
  const tag = /^[a-zA-Z][\w-]*/.exec(last)?.[0];
  if (tag && tag.toLowerCase() !== el.tag) return false;
  const classes = [...last.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  if (!tag && !classes.length && !/[#[]/.test(last)) return false;
  if (classes.some((c) => !classesOf(el).includes(c))) return false;
  const id = /#([\w-]+)/.exec(last)?.[1];
  if (id && el.attrs.id !== id) return false;
  for (const m of last.matchAll(ATTRIBUTE_SELECTOR_RX)) {
    const v = el.attrs[m[1].toLowerCase()];
    if (v == null || (m[2] != null && v !== m[2])) return false;
  }
  return true;
}

/** Every background an element declares: [{value, via}] from its style, a bg-* utility class, and matching <style> rules. */
function declaredBackgroundsOf(el, rules = []) {
  const out = [];
  const inline = declsOf(el.attrs.style);
  for (const k of ['background', 'background-color']) if (inline[k]) out.push({ value: inline[k], via: `style ${k}` });
  for (const c of classesOf(el)) if (c.startsWith('bg-')) out.push({ value: c.slice(3), via: `class ${c}` });
  for (const r of rules) {
    if (!selectorMatches(r.selector, el)) continue;
    for (const k of ['background', 'background-color']) if (r.decls[k]) out.push({ value: r.decls[k], via: `${r.selector} {${k}}` });
  }
  return out;
}

/** Whether a declared background keeps the HeroUI surface: --surface, white, transparent or no colour. */
export function surfaceBackground(value) {
  const v = String(value ?? '').trim().toLowerCase();
  if (!v) return true;
  if (/var\(\s*--(surface|color-surface|heroui-surface)\b/.test(v) || /^(surface|white|transparent|none|inherit|initial|unset)\b/.test(v)) return true;
  if (/^#(fff|ffff|ffffff|ffffffff)\b/.test(v) || /^rgba?\(\s*255\s*,\s*255\s*,\s*255\b/.test(v) || /^rgba?\([^)]*,\s*0\s*\)$/.test(v)) return true;
  return false;
}

/** The pixel size an element declares for `prop` (inline style, then matching <style> rules), px or rem; else null. */
function declaredPx(el, prop, rules = []) {
  const read = (v) => {
    const m = /^(-?\d+(?:\.\d+)?)(px|rem)$/.exec(String(v ?? '').trim());
    if (!m) { return null; }
    return Number(m[1]) * (m[2] === 'rem' ? 16 : 1);
  };
  const inline = read(declsOf(el.attrs.style)[prop]);
  if (inline != null) return inline;
  for (const r of rules) if (selectorMatches(r.selector, el) && read(r.decls[prop]) != null) return read(r.decls[prop]);
  return null;
}

const ARTWORK_COMPONENTS = new Set(['Image', 'MediaFrame', 'RankArtwork']);
const RASTER_SRC = /\.(png|jpe?g|webp|gif|avif)(?:[?#]|$)|^data:image\/(png|jpe?g|webp|gif|avif)/i;
/** Raster artwork: an Image/MediaFrame/RankArtwork root, or an img of a raster file outside Avatar/Icon/IconTile. */
function isArtwork(el) {
  const name = componentRootOf(el);
  if (ARTWORK_COMPONENTS.has(name) && !ancestorsOf(el).some((a) => ARTWORK_COMPONENTS.has(componentNameOf(a)))) return true;
  if (el.tag !== 'img' || inComponent(el, ['Avatar', 'AvatarGroup', 'Icon', 'IconTile', ...ARTWORK_COMPONENTS])) return false;
  return RASTER_SRC.test(String(el.attrs.src ?? '').trim());
}

/**
 * The anatomy a capture measured (draw-render record `anatomy`: {alerts:[{desc, background, surface, indicator,
 * indicatorColor, titleColor}], meters:[{desc, track, band, segments}]}) judged: [{code, kind, detail}].
 */
export function anatomyFindings(anatomy, { label = 'the capture' } = {}) {
  const out = [];
  const same = (a, b) => String(a ?? '').replace(/\s+/g, '') === String(b ?? '').replace(/\s+/g, '');
  const clear = (c) => /^rgba\([^)]*,\s*0\)$/.test(String(c ?? '').replace(/\s+/g, '')) || c === 'transparent';
  alertAnatomyFindings(Array.isArray(anatomy?.alerts) ? anatomy.alerts : [], label, out, same, clear);
  meterAnatomyFindings(Array.isArray(anatomy?.meters) ? anatomy.meters : [], label, out);
  return out;
}

function alertAnatomyFindings(alerts, label, out, same, clear) {
  for (const a of alerts) {
    const surface = a.surface && !clear(a.surface) ? a.surface : 'rgb(255, 255, 255)';
    if (a.background && !clear(a.background) && !same(a.background, surface)) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'tone-filled Alert', detail: `${label}: ${a.desc ?? 'an Alert'} renders background ${a.background}, not the surface ${surface}` });
    const size = Math.max(Number(a.indicator?.width) || 0, Number(a.indicator?.height) || 0);
    if (size >= ALERT_INDICATOR_MAX_PX) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'Alert indicator as a tile', detail: `${label}: ${a.desc ?? 'an Alert'} indicator renders ${Math.round(size)}px (HeroUI: a size-4 glyph with p-1)` });
    if (a.tile) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'IconTile in an Alert', detail: `${label}: ${a.desc ?? 'an Alert'} renders an IconTile` });
    if (a.indicatorColor && a.titleColor && !same(a.indicatorColor, a.titleColor)) out.push({ code: DRAW_ALERT_ANATOMY, kind: 'indicator and title in different tones', detail: `${label}: ${a.desc ?? 'an Alert'} indicator ${a.indicatorColor} vs title ${a.titleColor} - both are the tone's soft-foreground` });
  }
}

function meterSegmentFindings(m, t, label, out) {
  const segs = Array.isArray(m.segments) ? m.segments.filter((s) => Number(s.width) > 0).sort((x, y) => x.x - y.x) : [];
  if (segs.length <= 1) return;
  const widths = segs.map((s) => Number(s.width));
  const gaps = segs.slice(1).map((s, i) => s.x - (segs[i].x + segs[i].width));
  const covered = segs.at(-1).x + segs.at(-1).width - segs[0].x;
  if (Math.max(...widths) - Math.min(...widths) > 2) out.push({ code: DRAW_METER_TRACK, kind: 'unequal Meter segments', detail: `${label}: ${m.desc ?? 'a Meter'} segments are ${widths.map(Math.round).join('/')}px - they divide the track equally` });
  if (Math.max(...gaps) > METER_SEGMENT_GAP_MAX_PX || covered < Number(t.width) * METER_FULL_WIDTH_SHARE) out.push({ code: DRAW_METER_TRACK, kind: 'Meter segments do not fill the track', detail: `${label}: ${m.desc ?? 'a Meter'} segments cover ${Math.round(covered)}px of ${Math.round(t.width)}px with gaps up to ${Math.round(Math.max(...gaps))}px - small gaps, the full width` });
}

function meterAnatomyFindings(meters, label, out) {
  for (const m of meters) {
    const t = m.track;
    if (!t) continue;
    const want = m.segmented || (Array.isArray(m.segments) && m.segments.length > 1) ? METER_SEGMENTED_TRACK_PX : METER_TRACK_PX;
    if (Math.abs(Number(t.height) - want) > 0.5) out.push({ code: DRAW_METER_TRACK, kind: 'Meter track off its height', detail: label + ': ' + (m.desc ?? 'a Meter') + ' track renders ' + t.height + 'px tall (' + (want === METER_TRACK_PX ? 'HeroUI h-2 = ' + METER_TRACK_PX + 'px' : 'segmented h-1 = ' + METER_SEGMENTED_TRACK_PX + 'px') + ')' });
    const band = Number(m.band?.width) || 0;
    if (band > 0 && Number(t.width) < band * METER_FULL_WIDTH_SHARE) out.push({ code: DRAW_METER_TRACK, kind: 'Meter as a stub', detail: `${label}: ${m.desc ?? 'a Meter'} track is ${Math.round(t.width)}px of its band's ${Math.round(band)}px - it spans the full width` });
    meterSegmentFindings(m, t, label, out);
  }
}

/**
 * The DNA findings of one render source: [{code, detail, count, examples}]. `proposals` is the Set of proposal names
 * the drawing's grammar-proposal file(s) declare; `dna` the loaded DNA (loadDna); `assetRequests` the Set of slot ids
 * its asset-request.md requests (null: not judged).
 */
const DNA_FINDING_HELPERS = {
  ACTION_COMPONENTS, ALERT_INDICATOR_MAX_PX, ASSET_SLOT_ATTR, BADGE_DOT_CLASS, BADGE_DOT_PX, BAR_CLASS, CONTAINERS,
  DOT_CLASS, DRAW_ALERT_ANATOMY, DRAW_ASSET_SLOT_UNDECLARED, DRAW_METER_TRACK, DRAW_NOTICE_NOT_ALERT, DRAW_OFF_GRAMMAR_COMPONENT, DRAW_RATIO_NOT_METER,
  METER_FULL_WIDTH_SHARE, METER_SEGMENTED_TRACK_PX, METER_SEGMENTS_PROPOSAL, METER_TRACK_PX, METER_SEGMENT_GAP_MAX_PX, NOTICE_CLASS, OUTCOME_STATES,
  PART_ATTR, PROPOSAL_ATTR, RATIO_RX, alertActionVariantFor, ancestorsOf, classesOf, componentNameOf, componentRootOf,
  declaredBackgroundsOf, declaredPx, declsOf, describe, dnaSegment, inComponent, insideSvg, isAction, isArtwork, kebab,
  mappedSelf, plainPhrasing, presentationStateOf, proposalOf, selectorMatches, segmentedMeter, styleRulesOf,
  surfaceBackground, textOf, toneOf, walkElements
};

/**
 * The DNA findings of one render source: [{code, detail, count, examples}]. `proposals` is the Set of proposal names
 * the drawing's grammar-proposal file(s) declare; `dna` the loaded DNA (loadDna); `assetRequests` the Set of slot ids
 * its asset-request.md requests (null: not judged).
 */
export function dnaFindings(html, { dna = loadDna(), proposals = new Set(), label = 'the render', assetRequests = null } = {}) {
  const out = [];
  if (!dna) return [{ code: DRAW_OFF_GRAMMAR_COMPONENT, detail: `${label}: no Grammar DNA (knowledge/grammars/<family>/DNA.yaml) to judge it against`, count: 1, examples: [] }];
  const tree = parseHtml(html);
  const all = walkElements(tree).filter(visibleElement);
  out.push(...appendDnaFindings({ all, dna, proposals, label, assetRequests, tree, helpers: DNA_FINDING_HELPERS }));
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
function dnaFindingsOfFile(file, { family = DEFAULT_FAMILY, proposalFiles = null, dirs = [], assetRequests = null } = {}) {
  const html = fs.readFileSync(file, 'utf8');
  const files = proposalFiles ?? proposalFilesFor(file, dirs);
  return dnaFindings(html, { dna: loadDna({ family }), proposals: proposalNamesIn(files), label: path.basename(file), assetRequests });
}

async function main(argv) {
  const file = argv.find((a) => !a.startsWith('--') && /\.html?$/i.test(a));
  if (!file) { process.stderr.write('use: starci work draw-dna <render.html> [--family starci] [--proposals <file>] [--json]\n'); return 2; }
  const at = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const { assetRequestIdsFor } = await import('../asset-slot.mjs');
  const findings = dnaFindingsOfFile(path.resolve(file), { family: at('--family') ?? DEFAULT_FAMILY, proposalFiles: at('--proposals') ? [path.resolve(at('--proposals'))] : null,
    assetRequests: assetRequestIdsFor(path.resolve(file)) });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ ok: !findings.length, findings }, null, 2)}\n`);
  else process.stdout.write(`${findings.length ? 'REFUSED' : 'ok'}: ${findings.length} finding group(s)\n${findings.map((f) => '  [' + f.code + '] ' + f.detail).join('\n')}\n`);
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
