#!/usr/bin/env node
// draw-rationale.mjs — owner ruling 2026-09-27 (draw-rationale-evidence): the owner critiques a drawing from
// EVIDENCE, never from taste. Every interface.draw shape ships, next to its render source, a rationale.json - an
// array of decisions
//
//   {id, selector, kind: element|layout|spacing|type|radius|colour|art, decision, value, because, rules[],
//    alternativesRejected[{option, why}], source}
//
// and every visible element and region of the render source carries data-why="<id>[ <id>...]" naming its
// decisions. draw-render.mjs measures the render itself (measureRationale: getComputedStyle over every visible
// element) and captures an annotated redline render beside each part (<base>.redline.png: spacing brackets with the
// value and the rule id, DNA labels at component roots). DRAW_RATIONALE_MISSING refuses, per render source:
//   - no rationale file (<source stem>.rationale.json, else rationale.json beside it), or an entry that is malformed
//     (a field missing, an unknown kind, a duplicate id);
//   - a visible element or region without data-why, or a data-why naming no entry; a region whose decision is not a
//     layout decision; no layout decision stating the region order (its value names the region count);
//   - a grid whose layout decision does not state its column count at a viewport;
//   - a distinct gap/padding/inset, radius, font-size, font-weight or line-height the RENDER uses (measured at every
//     viewport) that no decision of the matching kind states in its value (spacing|layout, radius, type);
//   - a colour the render paints (background, text, border) that no colour decision names (hex, or a --token that
//     resolves to it in the render);
//   - a DNA component or a closed variant value the render uses that no decision names;
//   - an art slot (img, picture, data-asset-slot, data-artwork-slot, a background image) whose decision is not art;
//   - a rules[] entry that resolves to nothing: its first token must be a knowledge id (knowledge/**: GAP-5,
//     PADDING-9 case-1, ui.presentation.gap), a DNA component or closed value (dna:Button.variant=secondary), a
//     brand.direction principle/rubric id (direction:P2, rubric:H3), or an owner ruling (owner:<id> of
//     modules/kernel/owner-rulings.yaml, a ui.review.feedback note id, an answer receipt);
//   - an empty `because`, or one that cites no FR, content or user job;
//   - a part with no measured render (re-render it with draw-render) or no redline render beside it.
//
//   starci work draw-rationale <render.html> [--rationale <file>] [--ui <ui-record-dir>]
//        [--records <draw-render.json>[,<...>]] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { COMPONENT_ATTR, loadDna, walkElements } from './draw-dna.mjs';
import { findRationaleIssues } from './rationale-findings.mjs';
import { list } from '../../lib/list.mjs';
import { isFile } from '../../lib/fs-kind.mjs'; import { isMain } from '../../lib/is-main.mjs';

export const DRAW_RATIONALE_MISSING = 'DRAW_RATIONALE_MISSING';
const RATIONALE_KINDS = Object.freeze(['element', 'layout', 'spacing', 'type', 'radius', 'colour', 'art']);
export const WHY_ATTR = 'data-why';
export const REDLINE_ATTR = 'data-draw-redline';
export const MEASURE_SCHEMA = 'starci/draw-rationale-measure@1';
const REQUIRED_FIELDS = Object.freeze(['id', 'selector', 'kind', 'decision', 'value', 'because', 'rules', 'alternativesRejected', 'source']);
/** Components too small to label in the redline (they are named by their region's label). */
export const REDLINE_LEAF_COMPONENTS = Object.freeze(['Text', 'Heading', 'Icon', 'Label', 'Description', 'Kbd', 'Badge', 'Chip', 'IconTile', 'TagGroup', 'Tag', 'StateMark', 'MediaFrame', 'Avatar']);

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const KNOWLEDGE = path.join(ROOT, 'knowledge');
const OWNER_RULINGS = path.join(ROOT, 'modules', 'kernel', 'owner-rulings.yaml');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return undefined; } };
const readYamlOr = (f) => { try { return parseYaml(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const str = (v) => { if (v == null) { return ''; } if (typeof v === 'string') { return v; } if (typeof v === 'number') { return String(v); } return JSON.stringify(v); };

// ---------------------------------------------------------------------------------------------------------
// The rationale file
// ---------------------------------------------------------------------------------------------------------

/** The rationale file of a render source: <stem>.rationale.json beside it, else rationale.json in its directory. */
export function rationaleFileOf(htmlFile) {
  if (!htmlFile) return null;
  const own = String(htmlFile).replace(/\.html?$/i, '.rationale.json');
  if (isFile(own)) return own;
  const shared = path.join(path.dirname(htmlFile), 'rationale.json');
  return isFile(shared) ? shared : null;
}

/** Read and validate a rationale file: {entries, errors:[string]}. A missing or unparseable file is one error. */
export function loadRationale(file) {
  if (!file || !isFile(file)) return { entries: [], errors: ['no rationale.json beside the render source'] };
  const doc = readJson(file);
  if (doc === undefined) return { entries: [], errors: [`${path.basename(file)} is not JSON`] };
  const entries = Array.isArray(doc) ? doc : null;
  if (!entries) return { entries: [], errors: [`${path.basename(file)} is not an array of decisions`] };
  if (!entries.length) return { entries: [], errors: [`${path.basename(file)} holds no decision`] };
  const errors = [];
  const seen = new Set();
  entries.forEach((e, i) => {
    const at = `decision ${e?.id ?? '#' + (i + 1)}`;
    if (!e || typeof e !== 'object' || Array.isArray(e)) { errors.push(`#${i + 1} is not an object`); return; }
    const missing = REQUIRED_FIELDS.filter((k) => e[k] == null || (typeof e[k] === 'string' && !e[k].trim()));
    if (missing.length) errors.push(`${at} lacks ${missing.join(', ')}`);
    if (e.id != null) { if (seen.has(String(e.id))) { errors.push(`${at}: the id is used twice`); } seen.add(String(e.id)); }
    if (e.kind != null && !RATIONALE_KINDS.includes(e.kind)) errors.push(`${at}: kind "${e.kind}" is none of ${RATIONALE_KINDS.join('|')}`);
    if (e.rules != null && (!Array.isArray(e.rules) || !e.rules.length)) errors.push(`${at}: rules[] must cite at least one rule id`);
    if (e.alternativesRejected != null && (!Array.isArray(e.alternativesRejected) || e.alternativesRejected.some((a) => !a || typeof a !== 'object' || !str(a.option).trim() || !str(a.why).trim()))) {
      errors.push(`${at}: alternativesRejected is [{option, why}]`);
    }
  });
  return { entries: entries.filter((e) => e && typeof e === 'object' && !Array.isArray(e)), errors };
}

/** The labels the redline shows per decision: {id: {kind, value, rule}} - rule is the first rule's id token. */
export function redlineLabelsOf(entries) {
  const out = {};
  for (const e of list(entries)) {
    if (e?.id == null) continue;
    out[String(e.id)] = { kind: e.kind ?? null, value: str(e.value).slice(0, 40), rule: ruleTokenOf(list(e.rules)[0]) };
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Rule id resolution
// ---------------------------------------------------------------------------------------------------------

const NAMESPACES = ['knowledge', 'dna', 'grammar', 'direction', 'rubric', 'owner'];
const REF_RX = /^\s*(?:([a-z]+):)?\s*([^\s,;()]+)(?:\s+(case-\d+))?/i;

/** The id token of a rules[] entry (namespace dropped), for labels. */
function ruleTokenOf(ref) {
  const m = REF_RX.exec(str(ref));
  if (!m) return '';
  return `${m[2]}${m[3] ? ' ' + m[3] : ''}`;
}

let knowledgeCache = null;
/** Every id knowledge/** declares: {ids:Set, cases:Map(ruleId -> Set(case ids))}. */
function addKnowledgeRecord(node, ids, cases) {
  if (typeof node.id !== 'string' || !node.id.trim()) return;
  const id = node.id.trim();
  if (!/^case-\d+$/i.test(id)) ids.add(id);
  if (!Array.isArray(node.cases)) return;
  const set = cases.get(id) ?? new Set();
  for (const item of node.cases) if (typeof item?.id === 'string') set.add(item.id.trim());
  cases.set(id, set);
}
function visitKnowledgeNode(node, ids, cases) {
  if (Array.isArray(node)) {
    for (const item of node) visitKnowledgeNode(item, ids, cases);
    return;
  }
  if (!node || typeof node !== 'object') return;
  addKnowledgeRecord(node, ids, cases);
  for (const value of Object.values(node)) if (value && typeof value === 'object') visitKnowledgeNode(value, ids, cases);
}
function knowledgeIndex(root = KNOWLEDGE) {
  if (knowledgeCache?.root === root) return knowledgeCache;
  const ids = new Set(), cases = new Map();
  const walk = (dir) => {
    let names = [];
    try { names = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const d of names) {
      if (d.name.startsWith('.')) continue;
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (/\.ya?ml$/i.test(d.name)) visitKnowledgeNode(readYamlOr(p), ids, cases);
    }
  };
  walk(root);
  knowledgeCache = { root, ids, cases };
  return knowledgeCache;
}

const idsUnder = (node, out = new Set()) => {
  if (Array.isArray(node)) { for (const n of node) { idsUnder(n, out); } return out; }
  if (!node || typeof node !== 'object') return out;
  if (typeof node.id === 'string' && node.id.trim()) out.add(node.id.trim());
  for (const v of Object.values(node)) if (v && typeof v === 'object') idsUnder(v, out);
  return out;
};

/** The product's brand.direction: {all:Set, rubric:Set} of its ids. */
function directionIds(workRoot) {
  const doc = workRoot ? readYamlOr(path.join(workRoot, 'brand', 'index.yaml')) : null;
  const direction = doc?.brand?.direction ?? doc?.direction ?? null;
  return { all: idsUnder(direction), rubric: new Set(list(direction?.rubric?.checks).map((c) => str(c?.id).trim()).filter(Boolean)) };
}

/** Current owner rulings, product feedback notes and actual receipts. */
export function ownerIds({ record = null, workRoot = null, rulingsFile = OWNER_RULINGS } = {}) {
  const ids = new Set();
  for (const r of list(readYamlOr(rulingsFile)?.rulings)) if (r?.id) ids.add(str(r.id).trim());
  const review = record?.ui?.review ?? {};
  for (const n of idsUnder(review.feedback)) ids.add(n);
  for (const r of list(review.feedback?.rounds)) if (r?.receipt) ids.add(str(r.receipt));
  if (review.owner?.receipt) ids.add(str(review.owner.receipt));
  if (review.owner?.dispatchId) ids.add(str(review.owner.dispatchId));
  const doc = workRoot ? readYamlOr(path.join(workRoot, 'brand', 'index.yaml')) : null;
  for (const l of list((doc?.brand?.direction ?? doc?.direction)?.learned)) if (l?.id) ids.add(str(l.id).trim());
  return ids;
}

const kebab = (s) => String(s).replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

/** Whether `token` names a DNA component, one of its parts, props or closed values (Button, Button.variant=secondary). */
function dnaResolves(dna, token) {
  if (!dna) return false;
  const [head, rest] = String(token).split(/\.(.+)/);
  const spec = dna.components.get(head);
  if (!spec) return false;
  if (!rest) return true;
  const [prop, value] = rest.split('=');
  if (spec.parts.has(prop) || spec.parts.has(kebab(prop))) return value == null;
  const closed = spec.closed.get(prop);
  if (!closed) return false;
  if (value == null) return true;
  return closed.values ? closed.values.includes(value) : true;
}

/**
 * A resolver of rules[] entries: (ref) -> {ok, via, id, why?}. Context: {workRoot, record, dna, knowledge,
 * rulingsFile, repoRoot}.
 */
export function ruleResolver({ workRoot = null, record = null, dna = loadDna(), knowledge = knowledgeIndex(), rulingsFile = OWNER_RULINGS, repoRoot = null } = {}) {
  const direction = directionIds(workRoot);
  const owner = ownerIds({ record, workRoot, rulingsFile });
  const receiptOk = (token) => {
    for (const base of [repoRoot, workRoot ? path.dirname(workRoot) : null, workRoot].filter(Boolean)) {
      const f = path.resolve(base, token);
      if (isFile(f) && readJson(f)?.schema === 'starci/ask-answer@1') return true;
    }
    return false;
  };
  const inKnowledge = (id, kase) => {
    if (!knowledge.ids.has(id)) return { ok: false, why: `${id} is no id in knowledge/` };
    if (kase && !(knowledge.cases.get(id)?.has(kase))) return { ok: false, why: `${id} has no ${kase}` };
    return { ok: true };
  };
  const resolveNamespace = (namespace, token, kase) => {
    if (namespace === 'knowledge') {
      const result = inKnowledge(token, kase);
      return result.ok ? { ok: true, via: 'knowledge', id: token } : { via: 'knowledge', why: result.why };
    }
    if (namespace === 'dna' && dnaResolves(dna, token)) return { ok: true, via: 'dna', id: token };
    if (namespace === 'direction' && direction.all.has(token)) return { ok: true, via: 'direction', id: token };
    if (namespace === 'rubric' && direction.rubric.has(token)) return { ok: true, via: 'rubric', id: token };
    if (namespace === 'owner' && (owner.has(token) || receiptOk(token))) return { ok: true, via: 'owner', id: token };
    return null;
  };
  return (ref) => {
    const text = str(ref);
    const m = REF_RX.exec(text);
    if (!m?.[2]) return { ok: false, id: text, why: 'empty rule reference' };
    const ns = m[1] ? m[1].toLowerCase() : null;
    const token = m[2].replace(/[.:]+$/, '');
    const kase = m[3] ?? null;
    if (ns && !NAMESPACES.includes(ns)) return { ok: false, id: token, why: `unknown namespace ${ns}: (one of ${NAMESPACES.join(', ')})` };
    const tries = ns ? [ns === 'grammar' ? 'dna' : ns] : ['knowledge', 'dna', 'direction', 'owner'];
    let why = null;
    for (const t of tries) {
      const result = resolveNamespace(t, token, kase);
      if (result?.ok) return result;
      if (result?.via === 'knowledge') why ??= result.why;
    }
    return { ok: false, id: token, why: ns ? `${ns}:${token} resolves to nothing` : (why ?? `${token} resolves to no knowledge id, DNA name, brand.direction id or owner ruling`) };
  };
}

// ---------------------------------------------------------------------------------------------------------
// Numbers stated in a decision
// ---------------------------------------------------------------------------------------------------------

/** The numbers a decision states, in px where a unit says so (1.5rem -> 24); pill/full/circle as words. */
export function statedValues(text) {
  const s = str(text);
  const nums = new Set();
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(rem|em|px|%)?/gi)) {
    const n = Number(m[1]);
    if (!Number.isFinite(n)) continue;
    const unit = (m[2] ?? '').toLowerCase();
    if (unit === 'rem' || unit === 'em') nums.add(round(n * 16));
    else nums.add(round(n));
  }
  return { nums, pill: /\b(pill|full|9999|rounded-full|capsule)\b/i.test(s), circle: /\b(circle|50%)\b/i.test(s) };
}
const round = (n) => Math.round(Number(n) * 100) / 100;

const statesValue = (entry, v) => {
  const st = statedValues(`${str(entry.value)}`);
  if (typeof v === 'string') {
    if (v === 'pill') return st.pill;
    if (v === 'circle') return st.circle;
    return str(entry.value).toLowerCase().includes(v.toLowerCase());
  }
  return [...st.nums].some((n) => Math.abs(n - v) < 0.26);
};

/** The id-and-reference test of `because`: a record ref, an FR/NFR/BR id, the content or a user job. */
export function becauseCites(because, refs = []) {
  const s = str(because);
  if (!s.trim()) return false;
  if (refs.some((r) => r && s.includes(r))) return true;
  return [
    /\b(?:N?FR|BR|UJ|JTBD|US)[-.]?[a-z0-9]*\d/i,
    /\bfr\.[a-z0-9][\w.-]*/i,
    /\b\d{2}-CONTENT\b/i,
    /\bcontent\b/i,
    /\buser(?:'s)? job\b/i,
    /\bjob[- ]to[- ]be[- ]done\b/i,
    /\bjob:/i,
  ].some((pattern) => pattern.test(s));
}

/** The region container of a render: the PageContainer root, else <main>, else <body>. */
export function regionContainerOf(tree) {
  const all = walkElements(tree);
  return all.find((e) => str(e.attrs[COMPONENT_ATTR]).trim() === 'PageContainer') ?? all.find((e) => e.tag === 'main') ?? all.find((e) => e.tag === 'body') ?? tree;
}

/**
 * DRAW_RATIONALE_MISSING findings of one render source. `html` its text; `entries`/`errors` from loadRationale;
 * `measures` the draw-render measurements (measureRationale) of every viewport it was rendered at; `resolve` a
 * ruleResolver; `record` the ui record (its refs); `redlines` [{viewport, ok}] when the caller checks the redline
 * renders. Returns [{code, kind, detail, count, examples}].
 */
export function rationaleFindings({ html, entries = [], errors = [], measures = [], resolve = ruleResolver(), record = null, dna = loadDna(), label = 'the render', redlines = null } = {}) {
  return findRationaleIssues({ html, entries, errors, measures, resolve, record, dna, label, redlines }, {
    str, statesValue, round, statedValues, becauseCites, kebab, regionContainerOf,
    code: DRAW_RATIONALE_MISSING, measureSchema: MEASURE_SCHEMA, whyAttr: WHY_ATTR, redlineAttr: REDLINE_ATTR,
  });
}
/** The measures of a render source's parts: the rationale block of each starci/draw-render@1 record given. */
export const measuresOf = (records) => list(records).map((r) => r?.rationale ?? null).filter(Boolean);

/** A one-line summary of a rationale file for the owner's ask: {decisions, byKind}. */
export function rationaleSummary(file) {
  const { entries } = loadRationale(file);
  const byKind = {};
  for (const e of entries) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  return { decisions: entries.length, byKind };
}

// ---------------------------------------------------------------------------------------------------------
// In the page (draw-render.mjs evaluates these; each is self-contained)
// ---------------------------------------------------------------------------------------------------------

/**
 * Measure what the render uses: every distinct gap/padding/inset, radius, font-size, font-weight and line-height of a
 * visible element (type values only where the element renders text), the colours it paints, its grids, its regions
 * and its background-image art. `arg` {tokens: ['--accent', ...], whyAttr, redlineAttr, schema}.
 */
export function measureRationale(arg) {
  const { tokens = [], whyAttr, redlineAttr, schema } = arg;
  const px = (s) => { const n = Number.parseFloat(s); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  // Any CSS colour (rgb, oklch, color-mix ...) to sRGB hex through a 1px canvas; transparent is null.
  const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const hexCache = new Map();
  const hexOf = (c) => {
    const key = String(c);
    if (hexCache.has(key)) return hexCache.get(key);
    let hex = null;
    try {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000'; ctx.fillStyle = key;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] > 5) hex = `#${[d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    } catch { hex = null; }
    hexCache.set(key, hex);
    return hex;
  };
  // The inset sides an author wrote (a used value is reported for every side of a positioned element, so only the
  // sides a matching rule or the inline style sets are the render's decisions).
  const insetRules = [];
  const collect = (rules) => {
    for (const r of rules ?? []) {
      if (r.cssRules && r.conditionText != null) { if (window.matchMedia(r.conditionText).matches) { collect(r.cssRules); } continue; }
      if (r.cssRules && !r.selectorText) { collect(r.cssRules); continue; }
      if (!r.selectorText || !r.style) continue;
      const sides = ['top', 'right', 'bottom', 'left'].filter((k) => { const v = r.style.getPropertyValue(k); return v && v !== 'auto'; });
      if (sides.length) insetRules.push({ selector: r.selectorText, sides });
    }
  };
  for (const sheet of document.styleSheets) { try { collect(sheet.cssRules); } catch { /* a cross-origin sheet */ } }
  const insetSides = (el) => {
    const sides = new Set(['top', 'right', 'bottom', 'left'].filter((k) => { const v = el.style?.getPropertyValue(k); return v && v !== 'auto'; }));
    for (const r of insetRules) { try { if (el.matches(r.selector)) for (const k of r.sides) sides.add(k); } catch { /* an unsupported selector */ } }
    return [...sides];
  };
  const sel = (el) => {
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.') : '';
    return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : '');
  };
  const whyOf = (el) => { const w = el.closest(`[${whyAttr}]`); return w ? w.getAttribute(whyAttr).split(/\s+/).filter(Boolean) : []; };
  const excluded = (el) => Boolean(el.closest(`[${redlineAttr}],#redlines`));
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const values = { spacing: new Map(), radius: new Map(), fontSize: new Map(), fontWeight: new Map(), lineHeight: new Map() };
  const put = (cls, value, el) => {
    if (value == null || value === 0) return;
    if (!values[cls].has(value)) values[cls].set(value, []);
    const at = values[cls].get(value);
    if (at.length < 3) at.push(sel(el));
  };
  const colours = new Map();
  const colour = (hex, use, el) => { if (!hex) { return; } const k = `${hex}|${use}`; if (!colours.has(k)) { colours.set(k, { hex, use, at: [] }); } const c = colours.get(k); if (c.at.length < 3) { c.at.push(sel(el)); } };
  const grids = [], art = [];
  const all = [...document.querySelectorAll('body *')].filter((el) => !excluded(el) && !(el instanceof SVGElement && el.tagName.toLowerCase() !== 'svg') && !['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT'].includes(el.tagName) && visible(el));
  const collectSpacing = (el, cs) => {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) put('spacing', px(cs[`padding${side}`]), el);
    if (/flex|grid/.test(cs.display)) { put('spacing', px(cs.rowGap), el); put('spacing', px(cs.columnGap), el); }
    if (cs.position !== 'static') {
      for (const side of insetSides(el)) { const v = px(cs[side]); if (v != null) put('spacing', Math.abs(v), el); }
    }
  };
  const collectRadii = (el, cs) => {
    for (const corner of ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius']) {
      const raw = String(cs[corner]).split(' ')[0];
      if (!raw || raw === '0px') continue;
      if (raw.endsWith('%')) put('radius', Number.parseFloat(raw) >= 50 ? 'circle' : raw, el);
      else { const v = px(raw); const r = el.getBoundingClientRect(); put('radius', v != null && (v >= 999 || v >= Math.min(r.width, r.height) / 2 - 0.5) && v > 8 ? 'pill' : v, el); }
    }
  };
  const collectText = (el, cs) => {
    const text = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (text) {
      put('fontSize', px(cs.fontSize), el);
      put('fontWeight', Number(cs.fontWeight) || null, el);
      if (cs.lineHeight !== 'normal') put('lineHeight', px(cs.lineHeight), el);
      colour(hexOf(cs.color), 'text', el);
    }
  };
  const collectBorders = (el, cs) => {
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) if (Number.parseFloat(cs[`border${side}Width`]) > 0 && cs[`border${side}Style`] !== 'none') colour(hexOf(cs[`border${side}Color`]), 'border', el);
  };
  const collectGrid = (el, cs) => {
    if (cs.display === 'grid') {
      const kids = [...el.children].filter((k) => visible(k) && !excluded(k));
      if (kids.length >= 2) grids.push({ selector: sel(el), why: whyOf(el), columns: cs.gridTemplateColumns.split(/\s+(?![^(]*\))/).filter(Boolean).length });
    }
  };
  const measureElement = (el) => {
    const cs = getComputedStyle(el);
    collectSpacing(el, cs);
    collectRadii(el, cs);
    collectText(el, cs);
    colour(hexOf(cs.backgroundColor), 'background', el);
    collectBorders(el, cs);
    collectGrid(el, cs);
    if (/url\(/.test(cs.backgroundImage)) art.push({ selector: sel(el), why: whyOf(el) });
  };
  for (const el of all) {
    measureElement(el);
  }
  const pick = (m) => [...m.entries()].map(([value, at]) => ({ value, at })).sort((a, b) => String(a.value).localeCompare(String(b.value), 'en', { numeric: true }));
  const probe = document.createElement('i');
  document.body.appendChild(probe);
  const tokenColours = {};
  const rootStyle = getComputedStyle(document.documentElement);
  for (const t of tokens) {
    if (!rootStyle.getPropertyValue(t).trim()) continue;
    probe.style.color = `var(${t})`;
    const hex = hexOf(getComputedStyle(probe).color);
    if (hex) tokenColours[t] = hex;
  }
  probe.remove();
  const container = document.querySelector('[data-grammar-component="PageContainer"]') ?? document.querySelector('main') ?? document.body;
  const regions = [...container.children].filter((k) => !excluded(k) && !['SCRIPT', 'STYLE', 'TEMPLATE'].includes(k.tagName) && visible(k));
  return { schema, viewport: { width: innerWidth, height: innerHeight }, values: Object.fromEntries(Object.entries(values).map(([k, m]) => [k, pick(m)])),
    colours: [...colours.values()], grids, art, tokenColours, regions: { count: regions.length, whys: regions.map(whyOf) } };
}

/**
 * Draw the redline overlay into the page (html.annotate): spacing brackets with the value and the decision's first
 * rule id for region gaps and card paddings, a DNA label at each component root, the labels kept apart (a label that
 * would overlap another is moved, else dropped). `arg` {labels: redlineLabelsOf(entries), whyAttr, redlineAttr,
 * leaf: REDLINE_LEAF_COMPONENTS}.
 */
export function drawRedlines(arg) {
  const { labels = {}, whyAttr, redlineAttr, leaf = [] } = arg;
  document.documentElement.classList.add('annotate');
  const W = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  const H = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
  const NS = 'http://www.w3.org/2000/svg';
  const host = document.createElement('div');
  host.setAttribute(redlineAttr, '');
  host.setAttribute('aria-hidden', 'true');
  host.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:2147483647;pointer-events:none`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.style.cssText = 'position:absolute;left:0;top:0;overflow:visible';
  host.appendChild(svg);
  document.body.appendChild(host);
  const RED = '#d4001a', BLUE = '#1d4ed8';
  const placed = [];
  const hits = (r) => placed.some((p) => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y);
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) { n.setAttribute(k, v); } svg.appendChild(n); return n; };
  const line = (x1, y1, x2, y2, c) => el('line', { x1, y1, x2, y2, stroke: c, 'stroke-width': 1 });
  const label = (x, y, text, c) => {
    const w = text.length * 6 + 6, h = 12;
    for (const dy of [0, 13, -13, 26, -26, 39]) {
      const r = { x: Math.min(Math.max(0, x), W - w), y: Math.max(0, y + dy - h), w, h };
      if (hits(r)) continue;
      placed.push(r);
      el('rect', { x: r.x, y: r.y, width: w, height: h, fill: 'rgba(255,255,255,0.92)', stroke: c, 'stroke-width': 0.5, rx: 2 });
      const t = el('text', { x: r.x + 3, y: r.y + 9, fill: c, 'font-size': 9, 'font-family': 'ui-monospace,Menlo,Consolas,monospace' });
      t.textContent = text;
      return true;
    }
    return false;
  };
  const box = (n) => { const b = n.getBoundingClientRect(); return { x: b.left + scrollX, y: b.top + scrollY, w: b.width, h: b.height }; };
  const visible = (n) => { const b = n.getBoundingClientRect(); const cs = getComputedStyle(n); return b.width > 1 && b.height > 1 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const whys = (n) => (n.getAttribute(whyAttr) ?? '').split(/\s+/).filter(Boolean);
  const labelOf = (n) => whys(n).map((id) => labels[id]).find(Boolean) ?? null;
  const round = (v) => Math.round(v * 10) / 10;
  const vtick = (x, y1, y2) => { line(x, y1, x, y2, RED); line(x - 3, y1, x + 3, y1, RED); line(x - 3, y2, x + 3, y2, RED); };
  const htick = (x1, x2, y) => { line(x1, y, x2, y, RED); line(x1, y - 3, x1, y + 3, RED); line(x2, y - 3, x2, y + 3, RED); };
  const all = [...document.querySelectorAll(`[${whyAttr}]`)].filter((n) => !n.closest(`[${redlineAttr}],#redlines`) && !(n instanceof SVGElement) && visible(n));
  // Spacing brackets: the gaps between the children of a layout/spacing decision's element, and its padding.
  const gapIsDecided = (ncs, gap) => gap <= 48 || [Number.parseFloat(ncs.rowGap), Number.parseFloat(ncs.columnGap)].some((d) => Number.isFinite(d) && Math.abs(d - gap) < 1);
  const drawGapForPair = (first, second, shown, ncs, tag) => {
    const a = box(first), b = box(second);
    const vgap = round(b.y - (a.y + a.h)), hgap = round(b.x - (a.x + a.w));
    if (vgap > 0.5 && gapIsDecided(ncs, vgap) && b.y >= a.y + a.h - 1) {
      const x = Math.max(2, a.x - 5);
      vtick(x, a.y + a.h, b.y);
      if (!shown.has(`v${vgap}`)) { shown.add(`v${vgap}`); label(x + 4, a.y + a.h + vgap / 2 + 6, tag(vgap), RED); }
    } else if (hgap > 0.5 && gapIsDecided(ncs, hgap) && Math.abs(a.y - b.y) < Math.max(a.h, b.h)) {
      const y = a.y + Math.min(a.h, b.h) / 2;
      htick(a.x + a.w, b.x, y);
      if (!shown.has(`h${hgap}`)) { shown.add(`h${hgap}`); label(a.x + a.w, y - 4, tag(hgap), RED); }
    }
  };
  const drawPadding = (n, tag) => {
    const cs = getComputedStyle(n), b = box(n);
    const pt = round(Number.parseFloat(cs.paddingTop) || 0), pl = round(Number.parseFloat(cs.paddingLeft) || 0);
    if (pl > 0.5 && b.h > 24) htick(b.x, b.x + pl, b.y + Math.min(b.h - 4, 12));
    if (pt > 0.5 && b.w > 24) vtick(b.x + Math.min(b.w - 4, 12), b.y, b.y + pt);
    if (pt > 0.5 || pl > 0.5) label(b.x + pl + 2, b.y + pt + 11, tag(pt === pl || !pt || !pl ? `p ${pt || pl}` : `p ${pt}/${pl}`), RED);
  };
  const drawSpacingForElement = (n) => {
    const l = labelOf(n);
    if (!l || !['layout', 'spacing'].includes(l.kind)) return;
    const tag = (v) => `${v}${l.rule ? ' · ' + l.rule : ''}`;
    const kids = [...n.children].filter((k) => !(k instanceof SVGElement) && visible(k));
    const shown = new Set();
    // A decided gap is the container's gap (or a small margin); the free space of space-between is no decision.
    const ncs = getComputedStyle(n);
    for (let i = 0; i < kids.length - 1; i += 1) drawGapForPair(kids[i], kids[i + 1], shown, ncs, tag);
    drawPadding(n, tag);
  };
  for (const n of all) drawSpacingForElement(n);
  // DNA labels at component roots, regions outlined.
  const drawComponentLabels = () => {
    for (const n of document.querySelectorAll('[data-grammar-component]')) {
      if (n.closest(`[${redlineAttr}],#redlines`) || !visible(n)) continue;
      const name = n.getAttribute('data-grammar-component');
      const upName = n.parentElement?.closest('[data-grammar-component]')?.getAttribute('data-grammar-component');
      if (leaf.includes(name) || (upName === name && n.hasAttribute('data-grammar-part'))) continue;
      const b = box(n);
      if (b.w < 48 || b.h < 24) continue;
      const l = labelOf(n);
      if (l?.kind === 'layout') el('rect', { x: b.x, y: b.y, width: b.w, height: b.h, fill: 'none', stroke: BLUE, 'stroke-width': 1, 'stroke-dasharray': '3 2' });
      const variant = n.getAttribute('data-variant') ?? n.getAttribute('data-tone');
      label(b.x + 2, b.y + 12, `${name}${variant ? ' ' + variant : ''}`, BLUE);
    }
  };
  drawComponentLabels();
  return { labels: placed.length };
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

async function main(argv) {
  const file = argv.find((a) => !a.startsWith('--') && /\.html?$/i.test(a));
  const at = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  if (!file) { process.stderr.write('use: starci work draw-rationale <render.html> [--rationale <file>] [--ui <ui-record-dir>] [--records <draw-render.json>[,...]] [--json]\n'); return 2; }
  const html = path.resolve(file);
  const rationale = at('--rationale') ? path.resolve(at('--rationale')) : rationaleFileOf(html);
  const { entries, errors } = loadRationale(rationale);
  const uiDir = at('--ui') ? path.resolve(at('--ui')) : null;
  const record = uiDir ? readYamlOr(path.join(uiDir, 'index.yaml')) : null;
  let workRoot = null;
  for (let d = uiDir ?? path.dirname(html); ; d = path.dirname(d)) { if (path.basename(d) === '.starciwork') { workRoot = d; break; } if (path.dirname(d) === d) break; }
  const records = (at('--records') ? at('--records').split(',') : []).map((f) => readJson(path.resolve(f)));
  const findings = rationaleFindings({ html: fs.readFileSync(html, 'utf8'), entries, errors, measures: measuresOf(records), resolve: ruleResolver({ workRoot, record, repoRoot: process.cwd() }), record, label: path.basename(html) });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ ok: !findings.length, rationale, decisions: entries.length, findings }, null, 2)}\n`);
  else process.stdout.write(`${findings.length ? 'REFUSED' : 'ok'}: ${entries.length} decision(s), ${findings.length} finding group(s)\n${findings.map((f) => '  [' + f.code + '] ' + f.detail).join('\n')}\n`);
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
