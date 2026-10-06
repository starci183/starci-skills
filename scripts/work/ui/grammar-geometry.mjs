#!/usr/bin/env node
// grammar-geometry.mjs — the control geometry a product actually renders, read from its CSS, and the check
// that a drawn render keeps it.
//
//   starci work grammar-geometry --prompt --repo <product repo> [--family <name>] [--json]
//   starci work grammar-geometry --check <html file | capture dir> --repo <product repo>
//        [--family <name>] [--viewport 390x844] [--json]
//
// Every value comes from the cascade of the product's installed CSS: HeroUI v3 (`@heroui/styles`
// dist/heroui.min.css plus its `@theme inline` tokens), `@starci/grammar` common (+ core for the runtime's
// own family) and the family sheet (the repo css that scopes `[data-grammar-family="<id>"]`). The
// cascade honours layers, importance, specificity, custom-property inheritance and media conditions at
// the viewport asked for. A brand token the family declares but no `var()` and no source file reads is
// reported as unbound: the CSS wins (owner ruling 2026-09-27), never the declared token.
//
// --check renders each html with the product's own Playwright and reports GEOMETRY_OFF_GRAMMAR for every
// button, input, card, badge and text run whose computed geometry leaves the resolved grammar.
// Exit 0 clean, 1 findings, 2 bad argument or an unavailable source (a missing HeroUI, Grammar, family
// sheet or Playwright fails closed).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { flag as argOf } from '../work-io.mjs';
import { walkFiles } from '../../lib/walk.mjs'; import { isMain } from '../../lib/is-main.mjs'; import { GRAMMAR_FAMILIES } from '../../lib/example-refs.mjs';
import { readEnv } from '../../lib/env.mjs';
import { readJsonFile } from '../../lib/json.mjs';
import { alphaOver } from '../../lib/color.mjs'; import { byCodeUnit } from '../../lib/list.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const GEOMETRY_CODE = 'GEOMETRY_OFF_GRAMMAR';
export const FAMILIES = GRAMMAR_FAMILIES;
export const DEFAULT_VIEWPORT = { width: 390, height: 844 };
const PROMPT_WIDTHS = [390, 1280];
const ROOT_FONT_PX = 16;
const PRUNE = new Set(['node_modules', '.next', 'dist', 'build', 'out', 'coverage', 'storybook-static', '.git', '.turbo', 'reference-renders', '.starciwork', '.claude', 'captures']);

// ---------------------------------------------------------------------------------------------------------
// CSS parsing
// ---------------------------------------------------------------------------------------------------------

function skipString(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === q) return j + 1; }
  return s.length;
}

function matchClose(s, i, open, close) {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") { j = skipString(s, j) - 1; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return j;
  }
  return s.length;
}

/** Split on top-level commas (outside parentheses, brackets and strings). */
function splitTop(text, sep = ',') {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") { i = skipString(text, i) - 1; continue; }
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) { out.push(text.slice(start, i).trim()); start = i + 1; }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

const normalizeSelector = (sel) => sel.replace(/\s+/g, ' ').replace(/\s*([>+~])\s*/g, ' $1 ').replace(/=\s*"([^"]*)"/g, '=$1').replace(/=\s*'([^']*)'/g, '=$1').trim();

/**
 * Parse CSS text into style rules: {selectors, decls: [{prop, value, important}], media: [], layer, file}.
 * `@import` targets are returned in `imports`; `@layer a, b;` statements in `layers`.
 */
export function parseCss(text, { file = null } = {}) {
  const src = String(text).replace(/\/\*[\s\S]*?\*\//g, '');
  const out = { rules: [], imports: [], layers: [], early: [] };
  const walk = (s, ctx) => {
    const rule = ctx.selectors ? { selectors: ctx.selectors, decls: [], media: ctx.media, layer: ctx.layer, file } : null;
    if (rule) out.rules.push(rule);
    let i = 0, start = 0;
    const statement = (raw) => {
      const t = raw.trim();
      if (!t) return;
      if (t.startsWith('@')) {
        const m = t.match(/^@import\s+(?:url\()?\s*["']?([^"')\s]+)["']?\)?\s*(?:layer\(([^)]+)\))?/i);
        if (m) out.imports.push({ target: m[1], layer: m[2] ?? null, parentLayer: ctx.layer });
        const l = t.match(/^@layer\s+([^{]+)$/i);
        if (l) for (const name of splitTop(l[1])) { const full = ctx.layer ? `${ctx.layer}.${name}` : name; out.layers.push(full); if (!out.imports.length && !out.rules.length) out.early.push(full); }
        return;
      }
      if (!rule) return;
      const colon = t.indexOf(':');
      if (colon <= 0) return;
      const prop = t.slice(0, colon).trim();
      let value = t.slice(colon + 1).replace(/\s+/g, ' ').trim();
      const important = /!\s*important\s*$/i.test(value);
      if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
      for (const [p, v] of expandShorthand(prop.startsWith('--') ? prop : prop.toLowerCase(), value)) rule.decls.push({ prop: p, value: v, important });
    };
    const block = (prelude, body) => {
      const p = prelude.trim();
      if (p.startsWith('@')) {
        const name = p.match(/^@([\w-]+)/)?.[1]?.toLowerCase();
        const rest = p.slice(name.length + 1).trim();
        if (name === 'media') return walk(body, { ...ctx, media: [...ctx.media, rest] });
        if (name === 'supports' || name === 'container' || name === 'scope' || name === 'starting-style') return name === 'starting-style' ? undefined : walk(body, ctx);
        if (name === 'layer') {
          const layer = ctx.layer ? `${ctx.layer}.${rest || '<anonymous>'}` : (rest || '<anonymous>');
          out.layers.push(layer);
          return walk(body, { ...ctx, layer });
        }
        if (name === 'theme') return walk(body, { ...ctx, selectors: [':root'], theme: true });
        return undefined;
      }
      const own = splitTop(p).map(normalizeSelector);
      const selectors = ctx.selectors
        ? ctx.selectors.flatMap((parent) => own.map((sel) => (sel.includes('&') ? sel.replaceAll('&', parent) : `${parent} ${sel}`)))
        : own;
      return walk(body, { ...ctx, selectors });
    };
    while (i < s.length) {
      const c = s[i];
      if (c === '"' || c === "'") { i = skipString(s, i); continue; }
      if (c === '(') { i = matchClose(s, i, '(', ')') + 1; continue; }
      if (c === ';') { statement(s.slice(start, i)); i += 1; start = i; continue; }
      if (c === '{') { const end = matchClose(s, i, '{', '}'); block(s.slice(start, i), s.slice(i + 1, end)); i = end + 1; start = i; continue; }
      if (c === '}') { i += 1; start = i; continue; }
      i += 1;
    }
    statement(s.slice(start));
  };
  walk(src, { selectors: null, media: [], layer: null });
  out.rules = out.rules.filter((r) => r.decls.length);
  return out;
}

const SIDES = ['top', 'right', 'bottom', 'left'];
const BORDER_STYLES = /^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/i;
const fourSides = (tokens) => { const [t, r = t, b = t, l = r] = tokens; return [t, r, b, l]; };
const isLengthToken = (t) => /^(0|-?[\d.]+[a-z%]*|calc\(.*\)|min\(.*\)|max\(.*\)|clamp\(.*\)|thin|medium|thick)$/i.test(t);

/** Longhands for the shorthands the geometry reads (padding, margin, border, background, logical sides). */
export function expandShorthand(prop, value) {
  const tokens = splitTop(String(value).replace(/\s+/g, ' '), ' ');
  if (prop === 'padding' || prop === 'margin') return fourSides(tokens).map((v, k) => [`${prop}-${SIDES[k]}`, v]);
  if (/^(padding|margin)-(inline|block)$/.test(prop)) { const [base, axis] = prop.split('-'); const [a, b = a] = tokens; return axis === 'inline' ? [[`${base}-left`, a], [`${base}-right`, b]] : [[`${base}-top`, a], [`${base}-bottom`, b]]; }
  if (/^(padding|margin)-inline-(start|end)$/.test(prop)) return [[`${prop.split('-')[0]}-${prop.endsWith('start') ? 'left' : 'right'}`, value]];
  if (/^(padding|margin)-block-(start|end)$/.test(prop)) return [[`${prop.split('-')[0]}-${prop.endsWith('start') ? 'top' : 'bottom'}`, value]];
  if (prop === 'border-width' || prop === 'border-style' || prop === 'border-color') { const kind = prop.split('-')[1]; return fourSides(tokens).map((v, k) => [`border-${SIDES[k]}-${kind}`, v]); }
  if (prop === 'border' || /^border-(top|right|bottom|left)$/.test(prop)) {
    const sides = prop === 'border' ? SIDES : [prop.split('-')[1]];
    let width = 'medium', style = 'none', color = 'currentcolor';
    if (tokens.length === 1 && /^var\(/.test(tokens[0])) width = style = color = tokens[0];
    else for (const t of tokens) { if (BORDER_STYLES.test(t)) style = t; else if (isLengthToken(t)) width = t; else color = t; }
    if (tokens.length === 1 && (tokens[0] === '0' || /^none$/i.test(tokens[0]))) { width = '0'; style = 'none'; }
    return sides.flatMap((side) => [[`border-${side}-width`, width], [`border-${side}-style`, style], [`border-${side}-color`, color]]);
  }
  if (prop === 'background' && tokens.length === 1 && !/(url|gradient)\(/.test(value)) return [['background-color', value]];
  if (prop === 'border-radius' && tokens.length === 1) return [['border-radius', value], ...['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => [`border-${c}-radius`, value])];
  if (prop === 'gap') { const [row, col = row] = tokens; return [['gap', value], ['row-gap', row], ['column-gap', col]]; }
  return [[prop, value]];
}

/**
 * Load css entries into one sheet in cascade order: each file's relative @imports, and its bare package
 * imports through `resolveBare(spec, fromFile) -> [{file, source}] | {layers}`, before its own rules.
 */
export function loadSheet(entries, { resolveBare = () => [], sourceOf = (file, source) => source } = {}) {
  const sheet = { rules: [], layerOrder: [], files: [] };
  const seen = new Set();
  const addLayer = (name) => { if (name && !sheet.layerOrder.includes(name)) sheet.layerOrder.push(name); };
  const load = (file, inherited, layerPrefix = null) => {
    const abs = path.resolve(file);
    if (seen.has(abs) || !fs.existsSync(abs)) return;
    seen.add(abs);
    const source = sourceOf(abs, inherited);
    const parsed = parseCss(fs.readFileSync(abs, 'utf8'), { file: abs });
    sheet.files.push({ file: abs, source });
    const prefixed = (layer) => (layerPrefix ? (layer ? `${layerPrefix}.${layer}` : layerPrefix) : layer);
    for (const l of parsed.early) addLayer(prefixed(l));
    for (const imp of parsed.imports) {
      const layer = prefixed(imp.layer ?? imp.parentLayer);
      if (/^\.\.?\//.test(imp.target)) { load(path.resolve(path.dirname(abs), imp.target), source, layer); continue; }
      const bare = resolveBare(imp.target, abs);
      if (bare && !Array.isArray(bare)) { for (const l of bare.layers ?? []) addLayer(l); continue; }
      for (const b of bare ?? []) load(b.file, b.source, layer);
    }
    for (const l of parsed.layers) addLayer(prefixed(l));
    for (const r of parsed.rules) { const layer = prefixed(r.layer); addLayer(layer); sheet.rules.push({ ...r, layer, source, order: sheet.rules.length }); }
  };
  for (const e of entries) load(e.file, e.source);
  return sheet;
}

// ---------------------------------------------------------------------------------------------------------
// Media, selectors and the cascade
// ---------------------------------------------------------------------------------------------------------

/** Whether one media query list holds in `env` ({width, height, scheme, pointer, hover, forcedColors, reducedMotion}). */
export function mediaMatches(query, env) {
  return splitTop(query).some((one) => {
    const q = one.trim().toLowerCase();
    if (/^not\b/.test(q)) return !mediaMatches(q.replace(/^not\s+/, ''), env);
    return q.split(/\s+and\s+/).every((part) => {
      const p = part.trim().replace(/^only\s+/, '');
      if (p === 'screen' || p === 'all') return true;
      if (p === 'print') return false;
      const m = p.match(/^\(\s*([\w-]+)\s*(?::\s*([^)]+))?\)$/);
      if (!m) return false;
      const [, feature, raw] = m;
      const value = raw?.trim();
      const px = (v) => evalLength(v, { vw: env.width });
      if (feature === 'min-width') return env.width >= px(value);
      if (feature === 'max-width') return env.width <= px(value);
      if (feature === 'min-height') return env.height >= px(value);
      if (feature === 'max-height') return env.height <= px(value);
      if (feature === 'prefers-color-scheme') return value === env.scheme;
      if (feature === 'forced-colors') return value === 'active' ? env.forcedColors : !env.forcedColors;
      if (feature === 'prefers-reduced-motion') return value === 'reduce' ? env.reducedMotion : !env.reducedMotion;
      if (feature === 'hover' || feature === 'any-hover') return value === env.hover;
      if (feature === 'pointer' || feature === 'any-pointer') return value === env.pointer;
      if (feature === 'prefers-contrast') return value === 'no-preference';
      return false;
    });
  });
}

const envOf = (width, height = 844) => ({ width, height, scheme: 'light', pointer: width < 768 ? 'coarse' : 'fine', hover: width < 768 ? 'none' : 'hover', forcedColors: false, reducedMotion: false });

/** A compound selector's simple parts: ['.a', '[x=y]', 'div', ':root', '*']; null when it holds a state pseudo-class. */
function simpleParts(compound) {
  const parts = [];
  const re = /(\*|[a-zA-Z][\w-]*|\.[\w-]+|#[\w-]+|\[[^\]]+\]|::?[\w-]+(?:\([^)]*\))?)/g;
  let m, consumed = 0;
  while ((m = re.exec(compound))) {
    if (m.index !== consumed) return null;
    consumed = m.index + m[0].length;
    const part = m[0];
    if (part.startsWith(':')) { if (part === ':root' || part === ':host') parts.push(':root'); else return null; continue; }
    parts.push(part.startsWith('[') ? `[${part.slice(1, -1).replace(/\s+/g, '')}]` : part);
  }
  return consumed === compound.length ? parts : null;
}

function specificity(parts) {
  return parts.reduce((n, p) => n + (p.startsWith('#') ? 100 : p === '*' ? 0 : /^[a-z]/i.test(p) ? 1 : 10), 0);
}

/**
 * Whether `selector` matches the last element of `chain` (each element a Set of simple parts); the
 * specificity when it does, else -1.
 */
export function selectorMatch(selector, chain) {
  const tokens = selector.split(/\s+/).filter(Boolean);
  const compounds = [];
  let combinator = ' ';
  for (const t of tokens) {
    if (t === '>' || t === '+' || t === '~') { combinator = t; continue; }
    const parts = simpleParts(t);
    if (!parts) return -1;
    compounds.push({ parts, combinator });
    combinator = ' ';
  }
  if (!compounds.length || compounds.some((c) => c.combinator === '+' || c.combinator === '~')) return -1;
  const holds = (parts, el) => parts.every((p) => p === '*' || el.has(p));
  let at = chain.length - 1;
  const last = compounds[compounds.length - 1];
  if (!holds(last.parts, chain[at])) return -1;
  for (let c = compounds.length - 2; c >= 0; c--) {
    const via = compounds[c + 1].combinator;
    if (via === '>') { at -= 1; if (at < 0 || !holds(compounds[c].parts, chain[at])) return -1; }
    else { let j = at - 1; while (j >= 0 && !holds(compounds[c].parts, chain[j])) j -= 1; if (j < 0) return -1; at = j; }
  }
  return compounds.reduce((n, c) => n + specificity(c.parts), 0);
}

/** The winning declarations for the last element of `chain`, at `env`. */
function cascadeAt(sheet, chain, env) {
  const rank = (layer) => (layer ? sheet.layerOrder.indexOf(layer) : Number.MAX_SAFE_INTEGER);
  const won = new Map();
  const beats = (a, b) => {
    if (a.important !== b.important) return a.important;
    if (a.layerRank !== b.layerRank) return a.important ? a.layerRank < b.layerRank : a.layerRank > b.layerRank;
    if (a.spec !== b.spec) return a.spec > b.spec;
    return a.order > b.order;
  };
  for (const rule of sheet.rules) {
    if (rule.media.length && !rule.media.every((q) => mediaMatches(q, env))) continue;
    let spec = -1;
    for (const sel of rule.selectors) spec = Math.max(spec, selectorMatch(sel, chain));
    if (spec < 0) continue;
    rule.decls.forEach((d, k) => {
      const cand = { ...d, spec, layerRank: rank(rule.layer), order: rule.order * 1000 + k, rule };
      const prev = won.get(d.prop);
      if (!prev || beats(cand, prev)) won.set(d.prop, cand);
    });
  }
  return won;
}

// ---------------------------------------------------------------------------------------------------------
// Values: var() substitution and length arithmetic
// ---------------------------------------------------------------------------------------------------------

/** Evaluate a length expression (px, rem, em, vw, calc/min/max/clamp) to CSS pixels; null when it cannot. */
export function evalLength(text, { vw = null, rootPx = ROOT_FONT_PX, unitless = false } = {}) {
  const src = String(text ?? '').trim();
  if (!src) return null;
  const tokens = [];
  const re = /\s*(-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?)([a-z%]*)|\s*([a-z-]+)\(|\s*([()+\-*/,])/iy;
  let m;
  while (re.lastIndex < src.length) {
    const at = re.lastIndex;
    m = re.exec(src);
    if (!m || m.index !== at) { if (/^\s*$/.test(src.slice(at))) break; return null; }
    if (m[1] !== undefined) tokens.push({ num: Number(m[1]), unit: m[2].toLowerCase() });
    else if (m[3] !== undefined) tokens.push({ fn: m[3].toLowerCase() });
    else tokens.push({ op: m[4] });
  }
  let i = 0;
  const toPx = ({ num, unit }) => {
    if (unit === 'px') return { v: num, len: true };
    if (unit === 'rem' || unit === 'em') return { v: num * rootPx, len: true };
    if (unit === 'vw') { if (vw == null) throw new Error('vw'); return { v: (num * vw) / 100, len: true }; }
    if (unit === '') return { v: num, len: false };
    throw new Error(`unit ${unit}`);
  };
  const expr = () => {
    let a = term();
    while (tokens[i]?.op === '+' || tokens[i]?.op === '-') { const op = tokens[i++].op; const b = term(); a = { v: op === '+' ? a.v + b.v : a.v - b.v, len: a.len || b.len }; }
    return a;
  };
  const term = () => {
    let a = factor();
    while (tokens[i]?.op === '*' || tokens[i]?.op === '/') { const op = tokens[i++].op; const b = factor(); a = { v: op === '*' ? a.v * b.v : a.v / b.v, len: a.len || b.len }; }
    return a;
  };
  const args = () => { const list = [expr()]; while (tokens[i]?.op === ',') { i++; list.push(expr()); } if (tokens[i++]?.op !== ')') throw new Error('paren'); return list; };
  const factor = () => {
    const t = tokens[i++];
    if (!t) throw new Error('end');
    if (t.num !== undefined) return toPx(t);
    if (t.op === '(') { const v = expr(); if (tokens[i++]?.op !== ')') throw new Error('paren'); return v; }
    if (t.op === '-') { const v = factor(); return { v: -v.v, len: v.len }; }
    if (t.fn === 'calc') { const [v] = args(); return v; }
    if (t.fn === 'min' || t.fn === 'max') { const list = args(); return { v: Math[t.fn](...list.map((x) => x.v)), len: list.some((x) => x.len) }; }
    if (t.fn === 'clamp') { const [lo, mid, hi] = args(); return { v: Math.min(Math.max(mid.v, lo.v), hi.v), len: true }; }
    throw new Error('token');
  };
  try {
    const v = expr();
    if (i !== tokens.length) return null;
    if (!v.len && !unitless && v.v !== 0) return null;
    return Math.round(v.v * 1000) / 1000;
  } catch { return null; }
}

/** Replace every var() in `value` through `lookup(name) -> {value, level} | null`; trace records each hop. */
function substitute(value, lookup, level, trace, depth = 0) {
  if (depth > 40) return null;
  let out = '', i = 0;
  const s = String(value);
  while (i < s.length) {
    const at = s.indexOf('var(', i);
    if (at < 0) { out += s.slice(i); break; }
    out += s.slice(i, at);
    const end = matchClose(s, at + 3, '(', ')');
    const inner = s.slice(at + 4, end);
    const comma = splitTop(inner);
    const name = comma[0].trim();
    const fallback = inner.includes(',') ? inner.slice(inner.indexOf(',') + 1).trim() : null;
    const hit = lookup(name, level);
    let resolved = null;
    if (hit && !/^(initial|unset)$/i.test(String(hit.value).trim())) {
      resolved = substitute(hit.value, lookup, hit.level, trace, depth + 1);
      if (resolved !== null) trace.push({ name, value: hit.value, file: hit.file ?? null, selector: hit.selector ?? null });
    }
    if (resolved === null && fallback !== null) resolved = substitute(fallback, lookup, level, trace, depth + 1);
    if (resolved === null) return null;
    out += resolved;
    i = end + 1;
  }
  return out.trim();
}

// ---------------------------------------------------------------------------------------------------------
// Source discovery
// ---------------------------------------------------------------------------------------------------------

const versionOf = (dir) => readJsonFile(path.join(dir, 'package.json'))?.version ?? '0.0.0';
const semverDesc = (a, b) => {
  const pa = String(a.version).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  const pb = String(b.version).split(/[.-]/).map((x) => Number.parseInt(x, 10) || 0);
  for (let k = 0; k < 3; k++) if (pa[k] !== pb[k]) return pb[k] - pa[k];
  return 0;
};

/** Installed copies of `name` at the repo root and its workspace members, highest version first. */
function installedPackages(repo, name) {
  const bases = [repo];
  for (const group of ['apps', 'packages']) {
    try { for (const e of fs.readdirSync(path.join(repo, group), { withFileTypes: true })) if (e.isDirectory()) bases.push(path.join(repo, group, e.name)); } catch { /* no workspace group */ }
  }
  const found = [];
  for (const b of bases) {
    const dir = path.join(b, 'node_modules', ...name.split('/'));
    if (fs.existsSync(path.join(dir, 'package.json'))) found.push({ dir: fs.realpathSync(dir), version: versionOf(dir) });
  }
  const unique = [...new Map(found.map((f) => [f.dir, f])).values()];
  return unique.sort(semverDesc);
}

/** Every css file of the repo's own source (build output and installed packages pruned). */
function repoCssFiles(repo, maxDepth = 8) {
  return walkFiles(repo, {maxDepth, ignoreReadErrors: true,
    exclude: (name, _full, entry) => entry.isDirectory() && (PRUNE.has(name) || name.startsWith('.')),
    filter: name => name.endsWith('.css')}).sort(byCodeUnit);
}

const familyScopeRe = (id) => new RegExp(`data-grammar-family\\s*=\\s*["']?${id}["']?\\s*\\]`);
const readText = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };
const scopesFamily = (file, id) => { const t = readText(file); return familyScopeRe(id).test(t) && /--[\w-]+\s*:/.test(t); };

/** The directory of package `name` as node resolves it from `fromDir` (nearest node_modules upward). */
function packageDirFrom(fromDir, name) {
  let dir = path.resolve(fromDir);
  for (;;) {
    const candidate = path.join(dir, 'node_modules', ...name.split('/'));
    if (fs.existsSync(path.join(candidate, 'package.json'))) return fs.realpathSync(candidate);
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

const splitSpecifier = (spec) => { const parts = spec.split('/'); const n = spec.startsWith('@') ? 2 : 1; return { name: parts.slice(0, n).join('/'), subpath: parts.slice(n).join('/') }; };

/** A package subpath through its `exports` map (style, then default, then import), else the plain path. */
function exportTarget(pkgDir, subpath) {
  let exp = null;
  try { exp = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')).exports ?? null; } catch { exp = null; }
  const key = subpath ? `./${subpath}` : '.';
  const pickTarget = (v) => (typeof v === 'string' ? v : v && typeof v === 'object' ? pickTarget(v.style ?? v.default ?? v.import ?? null) : null);
  if (exp && typeof exp === 'object') {
    if (exp[key] !== undefined) { const t = pickTarget(exp[key]); if (t) return path.join(pkgDir, t); }
    for (const [pattern, v] of Object.entries(exp)) {
      if (!pattern.includes('*')) continue;
      const [pre, post] = pattern.split('*');
      if (key.startsWith(pre) && key.endsWith(post) && key.length >= pre.length + post.length) { const t = pickTarget(v); if (t) return path.join(pkgDir, t.replace('*', key.slice(pre.length, key.length - post.length))); }
    }
  }
  return path.join(pkgDir, subpath);
}

const packageRootOf = (file, stop) => { let dir = path.dirname(file); while (dir.startsWith(stop) && dir !== stop) { if (fs.existsSync(path.join(dir, 'package.json'))) return dir; dir = path.dirname(dir); } return stop; };
const heroFilesOf = (dir) => [path.join(dir, 'dist', 'heroui.min.css'), path.join(dir, 'dist', 'themes', 'shared', 'theme.css')].filter((f) => fs.existsSync(f));

/**
 * The css sources of one product, resolved the way its app entry resolves them: the app css that imports
 * `@heroui/styles` (the one reaching the family sheet, highest Grammar first; `app` narrows the choice),
 * loaded with its imports in order - HeroUI (compiled heroui.min.css plus its @theme tokens),
 * @starci/grammar, the family sheet, the app's own css. A repo with no such entry falls back to the
 * installed packages (or this runtime's packages/grammar) and the css that scopes the family.
 * `errors` names every source that is missing.
 */
export function discoverSources(repo, family = null, { app = null, grammarDist = null, extraCss = [] } = {}) {
  // A real-component drawing renders against the grammar draw-grammar.mjs picked (grammarDist: a package root, the
  // claude-dist when the product's install does not type-check the draw) and the draw's extra stylesheets (a brand
  // direction token sheet): the expected geometry is resolved from exactly the cascade the render used.
  const errors = [];
  const repoAbs = repo ? path.resolve(repo) : null;
  if (!repoAbs || !fs.existsSync(repoAbs)) return { errors: [`repo ${repo ?? '(none)'} does not exist`], family, familyId: FAMILIES[family] ?? null, repo: repoAbs };
  if (family && !FAMILIES[family]) return { errors: [`family ${family} is not one of ${Object.keys(FAMILIES).join(', ')}`], family, familyId: null, repo: repoAbs };
  const css = repoCssFiles(repoAbs);
  const bareOf = (fromFile) => (spec) => {
    if (spec === 'tailwindcss') return { layers: ['properties', 'theme', 'base', 'components', 'utilities'] };
    const { name, subpath } = splitSpecifier(spec);
    const dir = name === '@starci/grammar' && grammarDist ? path.resolve(grammarDist) : packageDirFrom(path.dirname(fromFile), name);
    if (!dir) return [];
    if (name === '@heroui/styles') return heroFilesOf(dir).map((file) => ({ file, source: 'heroui' }));
    const file = exportTarget(dir, subpath);
    if (!fs.existsSync(file) || !file.endsWith('.css')) return [];
    return [{ file, source: name === '@starci/grammar' ? 'grammar' : 'app' }];
  };
  const graphOf = (entry) => {
    const files = [entry];
    const visit = (file, depth) => {
      if (depth > 3) return;
      for (const imp of parseCss(readText(file)).imports) {
        const hits = /^\.\.?\//.test(imp.target) ? [{ file: path.resolve(path.dirname(file), imp.target) }] : [bareOf(file)(imp.target)].flat().filter((t) => t && t.file);
        for (const t of hits) if (fs.existsSync(t.file) && !files.includes(t.file)) { files.push(t.file); visit(t.file, depth + 1); }
      }
    };
    visit(entry, 0);
    const grammarDir = grammarDist ? path.resolve(grammarDist) : packageDirFrom(path.dirname(entry), '@starci/grammar');
    return { entry, files, heroDir: packageDirFrom(path.dirname(entry), '@heroui/styles'), grammarDir, grammarVersion: grammarDir ? versionOf(grammarDir) : '0.0.0' };
  };
  const entries = css
    .filter((f) => /@import\s+(url\()?["']@heroui\/styles/.test(readText(f)))
    .filter((f) => !app || path.resolve(f).startsWith(path.resolve(app)))
    .map(graphOf);
  const fam = family ?? Object.keys(FAMILIES).find((k) => FAMILIES[k] !== FAMILIES.starci && (entries.some((e) => e.files.some((f) => scopesFamily(f, FAMILIES[k]))) || (!entries.length && css.some((f) => scopesFamily(f, FAMILIES[k]))))) ?? 'starci';
  const familyId = FAMILIES[fam];
  const reaches = (e) => e.files.some((f) => scopesFamily(f, familyId));
  const ranked = entries.slice().sort((a, b) => Number(reaches(b)) - Number(reaches(a)) || semverDesc({ version: a.grammarVersion }, { version: b.grammarVersion }) || a.entry.localeCompare(b.entry));
  const chosen = ranked[0] ?? null;
  let heroDir, grammarDir, grammarInstalled, familyFile, load;
  let resolveBare = () => [];
  if (chosen) {
    heroDir = chosen.heroDir;
    grammarDir = chosen.grammarDir ? path.join(chosen.grammarDir, 'dist') : path.join(ROOT, 'packages', 'grammar', 'src');
    grammarInstalled = Boolean(chosen.grammarDir);
    familyFile = chosen.files.find((f) => scopesFamily(f, familyId)) ?? null;
    resolveBare = (spec, from) => { const hits = bareOf(from)(spec); return Array.isArray(hits) ? hits.map((h) => (h.file === familyFile ? { ...h, source: 'family' } : h)) : hits; };
    const commonFile = path.join(grammarDir, 'common', 'styles.css');
    load = [];
    if (!chosen.files.includes(commonFile)) load.push({ file: commonFile, source: 'grammar' });
    load.push({ file: chosen.entry, source: familyFile === chosen.entry ? 'family' : 'app' });
    if (familyId === 'core' && !familyFile) { familyFile = path.join(grammarDir, 'core', 'styles.css'); load.push({ file: familyFile, source: 'family' }); }
    for (const file of extraCss) load.push({ file: path.resolve(file), source: 'app' });
  } else {
    const hero = installedPackages(repoAbs, '@heroui/styles')[0] ?? installedPackages(path.join(ROOT, 'packages', 'grammar'), '@heroui/styles')[0] ?? null;
    heroDir = hero?.dir ?? null;
    const g = grammarDist ? { dir: path.resolve(grammarDist) } : installedPackages(repoAbs, '@starci/grammar').find((x) => fs.existsSync(path.join(x.dir, 'dist', 'common', 'styles.css')));
    grammarDir = g ? path.join(g.dir, 'dist') : path.join(ROOT, 'packages', 'grammar', 'src');
    grammarInstalled = Boolean(g);
    const declCount = (file) => (readText(file).match(/--[\w-]+\s*:/g) ?? []).length;
    familyFile = familyId === 'core' ? path.join(grammarDir, 'core', 'styles.css') : css.filter((f) => scopesFamily(f, familyId)).sort((a, b) => declCount(b) - declCount(a))[0] ?? null;
    load = [...(heroDir ? heroFilesOf(heroDir) : []).map((file) => ({ file, source: 'heroui' })), { file: path.join(grammarDir, 'common', 'styles.css'), source: 'grammar' }, ...(familyFile ? [{ file: familyFile, source: 'family' }] : []),
      ...extraCss.map((file) => ({ file: path.resolve(file), source: 'app' }))];
  }
  const heroFiles = heroDir ? heroFilesOf(heroDir) : [];
  if (!heroFiles.length) errors.push(`no installed @heroui/styles (dist/heroui.min.css) resolvable from ${chosen ? chosen.entry : repoAbs}`);
  const common = path.join(grammarDir, 'common', 'styles.css');
  if (!fs.existsSync(common)) errors.push(`no Grammar common/styles.css at ${grammarDir}`);
  if (!familyFile || !fs.existsSync(familyFile)) errors.push(`no css ${chosen ? `reached from ${chosen.entry}` : `in ${repoAbs}`} scopes [data-grammar-family="${familyId}"]`);
  return {
    family: fam, familyId, repo: repoAbs, errors,
    entry: chosen?.entry ?? null, otherEntries: ranked.slice(1).map((e) => e.entry),
    heroui: heroDir ? { dir: heroDir, version: versionOf(heroDir), files: heroFiles } : null,
    grammar: { dir: grammarDir, version: versionOf(path.dirname(grammarDir)), installed: grammarInstalled, common: fs.existsSync(common) ? common : null },
    familyFile, load, resolveBare, drawCss: { grammarDist, extraCss },
    sourceRoots: chosen ? [packageRootOf(chosen.entry, repoAbs), path.join(repoAbs, 'packages')] : [repoAbs],
  };
}

// ---------------------------------------------------------------------------------------------------------
// The resolver: one product's cascade at one viewport
// ---------------------------------------------------------------------------------------------------------

/** The element chains the geometry reads (selectors only; every value comes out of the cascade). */
export const geometryChains = (familyId) => {
  const html = [':root', 'html', 'body'];
  const root = ['div', '.grammar-common-root', `[data-grammar-family=${familyId}]`, '[data-grammar-theme=light]'];
  const button = (variant, extra = []) => [...root.slice(0, 0), 'button', '.button', `.button--${variant}`, '.button--md', '.starci-core-button', '[data-width=hug]', ...extra];
  const input = (variant) => ['input', '.input', `.input--${variant}`, '.input--full-width', '.starci-core-input-field'];
  const cardRoot = (labelled) => ['section', '.card', '.card--transparent', '.starci-core-surface-card', '[data-grammar-frame=bounded]', '[data-grammar-surface-card=true]', `[data-grammar-surface-labelled=${labelled}]`, '[data-grammar-interaction=static]'];
  const surface = (depth) => ['div', '.card__content', '.starci-core-surface', '[data-grammar-frame=bounded]', `[data-grammar-surface-depth=${depth}]`];
  return {
    html, root,
    button: (variant, fill = false) => [html, root, ['div'], fill ? button(variant, ['[data-width=fill]', '.button--full-width']).filter((p) => p !== '[data-width=hug]') : button(variant)],
    input: (variant) => [html, root, ['div', '.starci-core-input'], ['div', '.starci-core-input-control'], input(variant)],
    cardRoot: (labelled) => [html, root, cardRoot(labelled)],
    surface: (labelled, depth) => [html, root, cardRoot(labelled), surface(depth)],
    surfaceContent: (composition) => [html, root, cardRoot(false), [...surface('top'), `[data-grammar-surface-composition=${composition}]`], ['div', '.starci-core-surface-content', '[data-grammar-surface-content=true]', `[data-grammar-surface-composition=${composition}]`]],
    badge: () => [html, root, ['div'], ['span', '.chip', '.chip--sm', '.chip--default', '.chip--soft', '[data-component=Badge]', '[data-tone=neutral]']],
    text: () => [html, root, ['p']],
  };
};

const BUTTON_VARIANTS = ['primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger'];

/** A resolver over one product's sheet: `element(chain).get(prop)` gives {value, px, trace, source}. */
function createResolver(sources) {
  const family = sources.familyFile ? path.resolve(sources.familyFile) : null;
  const sheet = loadSheet(sources.load, { resolveBare: sources.resolveBare, sourceOf: (file, source) => (file === family ? 'family' : source) });
  const cache = new Map();
  const element = (chain, width = DEFAULT_VIEWPORT.width) => {
    const env = envOf(width);
    const sets = chain.map((parts) => new Set(['*', ...parts]));
    const levels = sets.map((_, k) => cascadeAt(sheet, sets.slice(0, k + 1), env));
    const lookup = (name, level) => {
      for (let j = level; j >= 0; j--) {
        const d = levels[j].get(name);
        if (d) return { value: d.value, level: j, file: d.rule.file, selector: d.rule.selectors.join(', ') };
      }
      return null;
    };
    const last = levels.length - 1;
    const get = (prop) => {
      const d = levels[last].get(prop);
      if (!d) return null;
      const trace = [];
      const value = substitute(d.value, lookup, last, trace);
      const fontPx = prop === 'line-height' ? get('font-size')?.px ?? null : null;
      let px = value == null ? null : evalLength(value, { vw: width });
      if (px == null && fontPx != null && value != null) { const ratio = evalLength(value, { unitless: true }); if (ratio != null) px = Math.round(ratio * fontPx * 100) / 100; }
      return { prop, declared: d.value, value, px, trace: trace.reverse(), file: d.rule.file, selector: d.rule.selectors.join(', '), source: d.rule.source, important: d.important };
    };
    const variable = (name) => { const hit = lookup(name, last); if (!hit) return null; const trace = []; const value = substitute(hit.value, lookup, hit.level, trace); return { name, declared: hit.value, value, px: value == null ? null : evalLength(value, { vw: width }), trace: trace.reverse(), file: hit.file }; };
    return { get, variable, levels };
  };
  const memo = (key, chain, width) => { const k = `${key}@${width}`; if (!cache.has(k)) cache.set(k, element(chain, width)); return cache.get(k); };
  return { sheet, element, memo };
}

const pick = (el, props) => Object.fromEntries(props.map((p) => [p, el.get(p)]));

function heightOf(el) {
  const h = el.get('height');
  if (h?.px != null) return { px: h.px, from: h };
  const lh = el.get('line-height'), pt = el.get('padding-top'), bw = el.get('border-top-width');
  if (lh?.px == null || pt?.px == null) return { px: null, from: null };
  return { px: Math.round((lh.px + 2 * pt.px + 2 * (bw?.px ?? 0)) * 100) / 100, from: 'line-height + 2 x padding-block + 2 x border-width' };
}

/** Every custom property the family sheet declares that no var() of the loaded cascade and no source file of the app reads. */
function unboundFamilyTokens(sources, sheet) {
  if (!sources.familyFile) return [];
  const declared = new Map();
  for (const r of sheet.rules.filter((x) => x.source === 'family')) for (const d of r.decls) if (d.prop.startsWith('--') && !declared.has(d.prop)) declared.set(d.prop, d.value);
  const referenced = new Set();
  for (const r of sheet.rules) for (const d of r.decls) for (const m of String(d.value).matchAll(/var\(\s*(--[\w-]+)/g)) referenced.add(m[1]);
  const candidates = [...declared.keys()].filter((n) => !referenced.has(n));
  const inSource = new Set();
  const walk = (dir, depth) => {
    if (depth > 8 || inSource.size === candidates.length) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!PRUNE.has(e.name) && !e.name.startsWith('.')) walk(full, depth + 1); continue; }
      if (!/\.(tsx?|jsx?|mdx|mjs)$/.test(e.name) || /\.(spec|test|stories)\./.test(e.name)) continue;
      const text = readText(full);
      for (const n of candidates) if (!inSource.has(n) && text.includes(n)) inSource.add(n);
    }
  };
  if (candidates.length) for (const root of sources.sourceRoots ?? []) walk(root, 0);
  return candidates.filter((n) => !inSource.has(n)).map((name) => ({ name, value: declared.get(name) }));
}

/** The family's font: the root binding, every family font token, and each app css rule that binds a font. */
function fontOf(resolver, chains, width) {
  const root = resolver.memo('root', [chains.html, chains.root], width);
  const binding = root.get('font-family');
  const tokens = [];
  for (const r of resolver.sheet.rules.filter((x) => x.source === 'family')) for (const d of r.decls) if (/^--[\w-]*font[\w-]*$/.test(d.prop) && !tokens.some((t) => t.name === d.prop)) tokens.push({ name: d.prop, value: d.value, resolved: root.variable(d.prop)?.value ?? null });
  const surfaces = [];
  for (const r of resolver.sheet.rules.filter((x) => x.source === 'app')) for (const d of r.decls) if (d.prop === 'font-family') {
    const value = d.value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g, (all, name, fallback) => root.variable(name)?.value ?? (fallback?.trim() || `${name} (set at runtime)`));
    surfaces.push({ selector: r.selectors.join(', '), file: r.file, declared: d.value, value });
  }
  const families = new Set([binding?.value, ...tokens.map((t) => t.resolved), ...surfaces.map((s) => s.value)].filter(Boolean).map((v) => firstFamily(v)));
  return { binding, tokens, surfaces, allowed: [...families].filter(Boolean) };
}

export const firstFamily = (value) => String(value ?? '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).find((x) => x && !/\(set at runtime\)$/.test(x) && !/^--/.test(x))?.toLowerCase() ?? null;

/**
 * The resolved geometry of one product: button, input, card, badge and font, each value with the
 * declaration and var() chain it came from, at every width in `widths`.
 */
export function resolveGeometry({ repo, family = null, widths = PROMPT_WIDTHS, grammarDist = null, extraCss = [] } = {}) {
  const sources = discoverSources(repo, family, { grammarDist, extraCss });
  if (sources.errors.length) return { ok: false, errors: sources.errors, sources };
  const resolver = createResolver(sources);
  const chains = geometryChains(sources.familyId);
  const at = (width) => {
    const btn = (variant, fill = false) => resolver.memo(`button-${variant}-${fill}`, chains.button(variant, fill), width);
    const primary = btn('primary');
    const button = {
      ...pick(primary, ['border-radius', 'height', 'min-height', 'padding-left', 'font-size', 'font-weight', 'line-height', 'border-top-width']),
      heightPx: heightOf(primary).px,
      fill: pick(btn('primary', true), ['height', 'min-height', 'width', 'padding-left']),
      variants: Object.fromEntries(BUTTON_VARIANTS.map((v) => { const el = btn(v); return [v, pick(el, ['background-color', 'color', 'border-top-width', 'border-top-style', 'border-top-color'])]; })),
    };
    const inputs = Object.fromEntries(['primary', 'secondary'].map((v) => {
      const el = resolver.memo(`input-${v}`, chains.input(v), width);
      return [v, { ...pick(el, ['border-radius', 'border-top-width', 'border-top-color', 'background-color', 'box-shadow', 'padding-left', 'padding-top', 'font-size', 'line-height']), heightPx: heightOf(el).px }];
    }));
    const surfaceOf = (labelled, depth) => resolver.memo(`surface-${labelled}-${depth}`, chains.surface(labelled, depth), width);
    const rootOf = (labelled) => resolver.memo(`card-root-${labelled}`, chains.cardRoot(labelled), width);
    const paints = (el) => { const bg = el.get('background-color')?.value; const sh = el.get('box-shadow')?.value; return Boolean((bg && !isTransparentValue(bg)) || (sh && normalizeShadowText(sh) !== 'none')); };
    const cardFor = (labelled, depth) => {
      const r = rootOf(labelled), s = surfaceOf(labelled, depth);
      const painted = depth === 'top' && labelled && paints(r) ? { el: r, part: 'card root (labelled, bounded)' } : { el: s, part: 'surface (.starci-core-surface)' };
      return { part: painted.part, ...pick(painted.el, ['border-radius', 'border-top-width', 'border-top-style', 'border-top-color', 'box-shadow', 'background-color']) };
    };
    const content = resolver.memo('surface-content-stacked', chains.surfaceContent('stacked'), width);
    const joined = resolver.memo('surface-content-joined', chains.surfaceContent('joined'), width);
    const cardRootGap = rootOf(true).get('row-gap');
    const badgeEl = resolver.memo('badge', chains.badge(), width);
    return {
      width, button, input: inputs,
      card: { top: cardFor(false, 'top'), labelled: cardFor(true, 'top'), nested: cardFor(false, 'nested'), content: pick(content, ['padding-top', 'padding-left', 'row-gap']), joined: pick(joined, ['padding-top', 'padding-left', 'row-gap']), labelGap: cardRootGap },
      badge: { ...pick(badgeEl, ['border-radius', 'padding-left', 'padding-top', 'font-size', 'line-height', 'font-weight', 'background-color', 'color']), heightPx: heightOf(badgeEl).px },
    };
  };
  const perWidth = widths.map(at);
  const unbound = unboundFamilyTokens(sources, resolver.sheet);
  const font = fontOf(resolver, chains, widths[0]);
  const floor = resolver.memo('floor', [...chains.button('primary', true)], widths[0]).get('min-height');
  return { ok: true, family: sources.family, familyId: sources.familyId, sources, widths, at: perWidth, font, unbound, touchFloor: floor, resolver, chains };
}

// ---------------------------------------------------------------------------------------------------------
// The prompt block
// ---------------------------------------------------------------------------------------------------------

const shortFile = (file, repo) => {
  if (!file) return '?';
  const rel = repo && path.resolve(file).startsWith(path.resolve(repo)) ? path.relative(repo, file) : path.relative(ROOT, file);
  return rel.split(path.sep).join('/');
};
const px = (v) => (v?.px == null ? (v?.value ?? 'unset') : `${Math.round(v.px * 10) / 10}px`);
const chainText = (v) => (v?.trace?.length ? ` <- ${v.trace.map((t) => `${t.name}: ${t.value}`).join(' <- ')}` : '');
const filesOf = (v, repo) => [...new Set([v.file, ...(v.trace ?? []).map((t) => t.file)].filter(Boolean).map((f) => shortFile(f, repo)))].join('; ');
const declared = (v, repo) => (v ? `\`${v.declared}\`${chainText(v)} (${filesOf(v, repo)})` : 'undeclared');
const isPill = (radiusPx, heightPx) => radiusPx != null && heightPx != null && radiusPx >= heightPx / 2;
const noBorder = (v) => v == null || v.px === 0 || v.value === '0' || /^none$/i.test(String(v.value));

function byWidth(g, getter, fmt = px) {
  const values = g.at.map((w) => ({ width: w.width, text: fmt(getter(w)) }));
  if (values.every((v) => v.text === values[0].text)) return values[0].text;
  return values.map((v) => `${v.text} at ${v.width}px`).join(', ');
}

/** The mandatory geometry block a draw brief carries. */
export function geometryPrompt(g) {
  const repo = g.sources.repo;
  const a = g.at[0];
  const lines = [];
  const b = a.button;
  lines.push(`GEOMETRY - mandatory, resolved from the product CSS (family ${g.family}, widths ${g.widths.join(' and ')}px). Draw these values; never a token the CSS does not bind.`);
  lines.push(`Cascade: ${g.sources.entry ? `${shortFile(g.sources.entry, repo)} and its imports` : 'installed packages'} - ${[...(g.sources.heroui?.files ?? []), g.sources.grammar.common, g.sources.familyFile].filter(Boolean).map((f) => shortFile(f, repo)).join('; ')} (@heroui/styles ${g.sources.heroui?.version}, @starci/grammar ${g.sources.grammar.version}${g.sources.grammar.installed ? '' : ' source'}).`);
  lines.push('');
  lines.push('Button (HeroUI .button, Grammar Button)');
  lines.push(`- radius ${byWidth(g, (w) => w.button['border-radius'])} = ${declared(b['border-radius'], repo)}${isPill(b['border-radius']?.px, b.heightPx) ? ' - a pill (radius >= height/2)' : ''}.`);
  lines.push(`- height ${byWidth(g, (w) => ({ px: w.button.heightPx }))} (${declared(b.height, repo)}); full width (width="fill"): height auto, min-height ${px(b.fill['min-height'])} (${declared(b.fill['min-height'], repo)}).`);
  lines.push(`- padding-inline ${byWidth(g, (w) => w.button['padding-left'])}; font ${px(b['font-size'])} / weight ${b['font-weight']?.value ?? 'unset'}.`);
  for (const v of ['primary', 'secondary', 'outline']) {
    const s = b.variants[v];
    const border = noBorder(s['border-top-width']) ? ', no border' : `, border ${px(s['border-top-width'])} ${s['border-top-style']?.value ?? 'solid'} ${s['border-top-color']?.value ?? ''} (${s['border-top-color']?.declared ?? ''}${chainText(s['border-top-color'])})`;
    lines.push(`- ${v}: fill ${s['background-color']?.value ?? 'unset'} (${s['background-color']?.declared ?? ''}${chainText(s['background-color'])}), text ${s.color?.value ?? 'unset'}${border}.`);
  }
  const inp = a.input;
  lines.push('');
  lines.push('Input (HeroUI .input, Grammar Input)');
  lines.push(`- radius ${byWidth(g, (w) => w.input.primary['border-radius'])} = ${declared(inp.primary['border-radius'], repo)}.`);
  lines.push(`- border ${noBorder(inp.primary['border-top-width']) ? 'none' : px(inp.primary['border-top-width'])}: ${declared(inp.primary['border-top-width'], repo)}.`);
  lines.push(`- height ${byWidth(g, (w) => ({ px: w.input.primary.heightPx }))}; padding ${px(inp.primary['padding-top'])} ${px(inp.primary['padding-left'])}; font ${byWidth(g, (w) => w.input.primary['font-size'])}.`);
  lines.push(`- inside a surface (card, panel, band) the field is the \`secondary\` variant: fill ${inp.secondary['background-color']?.value} (${inp.secondary['background-color']?.declared}${chainText(inp.secondary['background-color'])}), shadow ${normalizeShadowText(inp.secondary['box-shadow']?.value)} - knowledge/ui/proof/anatomy-source.yaml ANATOMY-2 case-1. Its low fill contrast is accepted (owner ruling, knowledge/ui/proof/contrast.yaml COLOR-3 case-6).`);
  lines.push(`- on the page canvas the \`primary\` variant: fill ${inp.primary['background-color']?.value} (${inp.primary['background-color']?.declared}${chainText(inp.primary['background-color'])}), shadow ${normalizeShadowText(inp.primary['box-shadow']?.value)}.`);
  const c = a.card;
  lines.push('');
  lines.push('Card / SurfaceCard (Grammar SurfaceCard, SurfaceListCard)');
  lines.push(`- radius ${byWidth(g, (w) => w.card.top['border-radius'])} = ${declared(c.top['border-radius'], repo)}, painted by the ${c.top.part}${c.labelled.part !== c.top.part ? `; a labelled card paints its ${c.labelled.part}: radius ${px(c.labelled['border-radius'])}` : ''}.`);
  lines.push(`- border ${noBorder(c.top['border-top-width']) ? 'none' : px(c.top['border-top-width'])} (${declared(c.top['border-top-width'], repo)}); shadow ${normalizeShadowText(c.top['box-shadow']?.value)} (${c.top['box-shadow']?.declared}${chainText(c.top['box-shadow'])}); fill ${c.top['background-color']?.value}.`);
  lines.push(`- a surface nested inside another: border ${px(c.nested['border-top-width'])} ${c.nested['border-top-style']?.value ?? ''} ${c.nested['border-top-color']?.value ?? ''}, shadow ${normalizeShadowText(c.nested['box-shadow']?.value)}.`);
  lines.push(`- content inset ${px(c.content['padding-top'])} (${declared(c.content['padding-top'], repo)}); joined bands: card inset ${px(c.joined['padding-top'])}, gap ${px(c.joined['row-gap'])}; external label to card ${px(c.labelGap)}.`);
  const cardTokens = g.unbound.filter((t) => /radius|shadow|surface/.test(t.name));
  for (const t of cardTokens) lines.push(`- ${t.name}: ${t.value} is declared by the family and read by no var() and no source file - it does not render; the card draws ${px(c.top['border-radius'])} (owner ruling: follow the CSS).`);
  const bd = a.badge;
  lines.push('');
  lines.push('Badge (Grammar Badge = HeroUI Chip, size sm, soft)');
  lines.push(`- radius ${px(bd['border-radius'])} = ${declared(bd['border-radius'], repo)}, height ${bd.heightPx}px${isPill(bd['border-radius']?.px, bd.heightPx) ? ' - a pill' : ''}; padding ${px(bd['padding-top'])} ${px(bd['padding-left'])}; font ${px(bd['font-size'])} / ${bd['font-weight']?.value}; fill ${bd['background-color']?.value}.`);
  lines.push('');
  lines.push('Font');
  lines.push(`- the family root binds font-family ${declared(g.font.binding, repo)} = ${g.font.binding?.value}.`);
  for (const t of g.font.tokens) lines.push(`- family token ${t.name}: ${t.resolved ?? t.value}.`);
  for (const s of g.font.surfaces) lines.push(`- ${s.selector} (${shortFile(s.file, repo)}) binds ${s.value}.`);
  const others = g.unbound.filter((t) => !cardTokens.includes(t));
  if (others.length) { lines.push(''); lines.push(`Declared by the family, read by no var() and no source file (they do not render): ${others.map((t) => `${t.name} ${t.value}`).join('; ')}.`); }
  return `${lines.join('\n')}\n`;
}

const isTransparentValue = (v) => /^(transparent|#0000|#00000000|rgba?\([^)]*[,/]\s*0\s*\))$/i.test(String(v).trim());

export function normalizeShadowText(value) {
  if (value == null) return 'unset';
  const layers = splitTop(value).filter((l) => !/(#0000\b|#00000000\b|transparent|rgba?\([^)]*[,/]\s*0\s*\))/.test(l));
  return layers.length ? layers.join(', ') : 'none';
}

// ---------------------------------------------------------------------------------------------------------
// Rendering a page: the product's Playwright, one snapshot per html
// ---------------------------------------------------------------------------------------------------------

/** Playwright's chromium, resolved from the product repo first (the way .claude runs the project's own Playwright). */
export async function loadChromium(repo) {
  const bases = [repo, ROOT, readEnv('STARCI_PLAYWRIGHT_DIR')].filter(Boolean).map((d) => path.join(path.resolve(d), 'package.json'));
  for (const base of bases) for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    let resolved;
    try { resolved = createRequire(base).resolve(name); } catch { continue; }
    const mod = await import(pathToFileURL(resolved).href);
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (chromium) return { chromium, from: resolved };
  }
  return null;
}

/** The html files a --check or --score target names: the file itself, or every .html of a capture dir. */
function htmlTargets(target) {
  const abs = path.resolve(target);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return /\.html?$/i.test(abs) ? [abs] : [];
  return walkFiles(abs, {maxDepth: 2, filter: name => /\.html?$/i.test(name)}).sort(byCodeUnit);
}

/** In-page collector: every rendered element's box, computed geometry and colour (sRGB via canvas). */
function collectPage(probes) {
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => {
    if (!c) return null;
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#010203'; cx.fillStyle = c;
    if (cx.fillStyle === '#010203' && !/^#010203$/i.test(c)) return null;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], Math.round((d[3] / 255) * 1000) / 1000];
  };
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px';
  document.body.appendChild(probe);
  const probed = {};
  for (const [key, p] of Object.entries(probes || {})) {
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;width:10px;height:10px';
    probe.style.setProperty(p.prop, p.value);
    const v = getComputedStyle(probe).getPropertyValue(p.prop);
    probed[key] = { value: v, rgba: /color/.test(p.prop) ? rgba(v) : null };
  }
  probe.remove();
  const all = [...document.querySelectorAll('body *')].filter((e) => !['SCRIPT', 'STYLE', 'LINK', 'META', 'NOSCRIPT', 'TEMPLATE', 'BR'].includes(e.tagName));
  const index = new Map(all.map((e, i) => [e, i]));
  all.forEach((e, i) => e.setAttribute('data-gg-i', String(i)));
  const n = (v) => Number.parseFloat(v) || 0;
  const elements = all.slice(0, 5000).map((e, i) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    const own = [...e.childNodes].filter((c) => c.nodeType === 3).map((c) => c.textContent).join(' ').replace(/\s+/g, ' ').trim();
    let p = e.parentElement; while (p && !index.has(p)) p = p.parentElement;
    const radius = (v) => (String(v).endsWith('%') ? (n(v) * Math.min(r.width, r.height)) / 100 : n(v));
    const labelText = (() => {
      if (!/^(INPUT|TEXTAREA|SELECT)$/.test(e.tagName) && e.getAttribute('contenteditable') !== 'true') return null;
      const parts = [];
      if (e.labels) for (const l of e.labels) parts.push(l.innerText.trim());
      const lb = e.getAttribute('aria-labelledby');
      if (lb) for (const id of lb.split(/\s+/)) { const t = document.getElementById(id); if (t) parts.push(t.innerText.trim()); }
      if (e.getAttribute('aria-label')) parts.push(e.getAttribute('aria-label'));
      return parts.join(' ').trim() || null;
    })();
    const described = (e.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean).map((id) => document.getElementById(id)).filter(Boolean).map((t) => index.get(t)).filter((x) => x !== undefined);
    return {
      i, parent: p ? index.get(p) : null, tag: e.tagName.toLowerCase(), id: e.id || null, cls: typeof e.className === 'string' ? e.className : '',
      // A real grammar render (draw-render fixture mode of a <XBase>.draw.tsx): the component root it is, and whether it
      // is a layout element the drawing itself wrote (draw-source.mjs LAYOUT_ATTR).
      comp: e.getAttribute('data-component'), drawLayout: e.hasAttribute('data-draw-layout'), dataWidth: e.getAttribute('data-width'),
      role: e.getAttribute('role'), type: e.getAttribute('type'), href: e.getAttribute('href'),
      aria: { selected: e.getAttribute('aria-selected'), current: e.getAttribute('aria-current'), hidden: e.getAttribute('aria-hidden'), required: e.getAttribute('aria-required'), invalid: e.getAttribute('aria-invalid') },
      required: Boolean(e.required), disabled: Boolean(e.disabled), labelText, described, placeholder: e.getAttribute('placeholder'), value: 'value' in e && typeof e.value === 'string' ? e.value.slice(0, 80) : null,
      own: own.slice(0, 120), textLen: (e.innerText || '').length,
      rect: { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height },
      visible: s.visibility !== 'hidden' && s.display !== 'none' && n(s.opacity) > 0.01 && r.width > 0 && r.height > 0,
      style: {
        display: s.display, position: s.position, fontFamily: s.fontFamily, fontSize: n(s.fontSize), fontWeight: n(s.fontWeight), lineHeight: s.lineHeight === 'normal' ? null : n(s.lineHeight),
        color: rgba(s.color), bg: rgba(s.backgroundColor), bgImage: s.backgroundImage !== 'none',
        border: ['Top', 'Right', 'Bottom', 'Left'].map((k) => ({ w: n(s[`border${k}Width`]), style: s[`border${k}Style`], color: rgba(s[`border${k}Color`]) })),
        radius: radius(s.borderTopLeftRadius), shadow: s.boxShadow,
        padding: [n(s.paddingTop), n(s.paddingRight), n(s.paddingBottom), n(s.paddingLeft)],
        margin: [n(s.marginTop), n(s.marginRight), n(s.marginBottom), n(s.marginLeft)],
        rowGap: s.rowGap === 'normal' ? null : n(s.rowGap), columnGap: s.columnGap === 'normal' ? null : n(s.columnGap),
        outline: { style: s.outlineStyle, w: n(s.outlineWidth), color: rgba(s.outlineColor), offset: n(s.outlineOffset) },
        overflowX: s.overflowX, overflowY: s.overflowY, textAlign: s.textAlign,
      },
    };
  });
  const doc = document.documentElement;
  return {
    root: { fontPx: n(getComputedStyle(doc).fontSize), clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, scrollHeight: doc.scrollHeight, bodyBg: rgba(getComputedStyle(document.body).backgroundColor), htmlBg: rgba(getComputedStyle(doc).backgroundColor) },
    fonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')),
    probes: probed, elements,
  };
}

/** Render each html at `viewport` and return one snapshot per file (with a keyboard focus pass). */
export async function snapshotFiles(files, { repo = null, viewport = DEFAULT_VIEWPORT, probes = {}, focusStops = 40 } = {}) {
  const pw = await loadChromium(repo);
  if (!pw) return { ok: false, error: `Playwright is not installed in ${repo ?? '(no repo)'} or ${ROOT} (set STARCI_PLAYWRIGHT_DIR to a dir that has it)` };
  const browser = await pw.chromium.launch();
  try {
    const shots = [];
    for (const file of files) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1, colorScheme: 'light' });
      await page.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      const snap = await page.evaluate(collectPage, probes);
      const focus = [];
      const stops = Math.min(focusStops, snap.elements.filter((e) => /^(a|button|input|select|textarea)$/.test(e.tag) || e.role === 'tab').length + 2);
      for (let k = 0; k < stops; k++) {
        await page.keyboard.press('Tab');
        focus.push(await page.evaluate(() => {
          const e = document.activeElement;
          if (!e || e === document.body) return null;
          const s = getComputedStyle(e);
          return { i: Number(e.getAttribute('data-gg-i')), outline: { style: s.outlineStyle, w: Number.parseFloat(s.outlineWidth) || 0, offset: Number.parseFloat(s.outlineOffset) || 0 }, shadow: s.boxShadow, focusVisible: e.matches(':focus-visible') };
        }));
      }
      shots.push({ file, viewport, ...snap, focus });
      await page.close();
    }
    return { ok: true, snapshots: shots, playwright: pw.from };
  } finally { await browser.close(); }
}

// ---------------------------------------------------------------------------------------------------------
// Reading a snapshot: controls, surfaces, badges and text
// ---------------------------------------------------------------------------------------------------------

const CONTROL_TAGS = new Set(['button', 'input', 'select', 'textarea', 'a', 'label', 'summary']);
const INPUT_SKIP = new Set(['checkbox', 'radio', 'range', 'hidden', 'submit', 'button', 'reset', 'file', 'color', 'image']);
export const alphaOf = (c) => (c ? c[3] : 0);
export const sameColor = (a, b, tol = 3) => Boolean(a && b) && Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol && Math.abs(a[2] - b[2]) <= tol && Math.abs(a[3] - b[3]) <= 0.03;

/** Index a snapshot: children, ancestors, composed backgrounds and the classified elements. */
export function readSnapshot(snap) {
  const els = snap.elements;
  const byI = new Map(els.map((e) => [e.i, e]));
  const kids = new Map();
  for (const e of els) if (e.parent != null) { if (!kids.has(e.parent)) kids.set(e.parent, []); kids.get(e.parent).push(e); }
  const ancestors = (e) => { const out = []; let p = e.parent; while (p != null && byI.has(p)) { out.push(byI.get(p)); p = byI.get(p).parent; } return out; };
  const pageBg = [snap.root.bodyBg, snap.root.htmlBg].find((c) => c && c[3] > 0) ?? [255, 255, 255, 1];
  const composed = new Map();
  const bgOf = (e) => {
    if (!e) return alphaOf(pageBg) >= 1 ? pageBg : alphaOver(pageBg, [255, 255, 255, 1]);
    if (composed.has(e.i)) return composed.get(e.i);
    const under = bgOf(e.parent != null ? byI.get(e.parent) : null);
    const own = e.style.bg && alphaOf(e.style.bg) > 0 ? alphaOver(e.style.bg, under) : under;
    composed.set(e.i, own);
    return own;
  };
  const isControl = (e) => CONTROL_TAGS.has(e.tag) || ['button', 'tab', 'link', 'checkbox', 'switch', 'radio', 'menuitem', 'option'].includes(e.role);
  const inControl = (e) => isControl(e) || ancestors(e).some(isControl);
  const shadowOn = (e) => e.style.shadow && e.style.shadow !== 'none' && normalizeShadowText(e.style.shadow) !== 'none';
  const borderOn = (e) => e.style.border.some((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0);
  const vw = snap.viewport?.width ?? snap.root.clientWidth;
  const buttons = els.filter((e) => e.visible && e.role !== 'tab' && (e.tag === 'button' || e.role === 'button' || (e.tag === 'input' && ['submit', 'button', 'reset'].includes(e.type)) || (e.tag === 'a' && /\b(button|btn)\b/i.test(e.cls))));
  const inputs = els.filter((e) => e.visible && ((e.tag === 'input' && !INPUT_SKIP.has(e.type ?? 'text')) || e.tag === 'textarea' || e.tag === 'select'));
  const differsFromParent = (e) => { const parent = e.parent != null ? byI.get(e.parent) : null; return !sameColor(bgOf(e), bgOf(parent), 2); };
  const strip = (e) => ['nav', 'header', 'footer'].includes(e.tag) || ['tablist', 'navigation', 'banner', 'toolbar'].includes(e.role) || (e.style.radius < 1 && !shadowOn(e) && !borderOn(e));
  // A real grammar render (a .draw.tsx): the element sits inside a grammar component's own anatomy (a data-component root
  // is nearer than any layout element the drawing wrote). Its spacing, type and shape are the grammar's - judged by the
  // grammar's own conformance, not by the drawing that composed it. Never true for a hand-written html render (no
  // data-component there).
  const inGrammar = (e) => { if (e.comp) return true; for (const a of ancestors(e)) { if (a.drawLayout) return false; if (a.comp) return true; } return false; };
  // A notice (Alert: its own anatomy gate, DRAW_ALERT_ANATOMY, and the HeroUI radius) or a media box (Image/MediaFrame)
  // is never a card.
  // A cell or bar ruled on ONE edge only (square, no shadow) is a divided region - a stat-strip cell's inline-start
  // hairline, a pinned action bar's top hairline (grammar 0.6.0: DescriptionList stat-strip, PinnedActionBar) - never a
  // card, whatever ground it carries.
  const edgeRuled = (e) => e.style.radius < 1 && !shadowOn(e) && e.style.border.filter((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0).length === 1;
  const notCard = (e) => /(?:^|\s)(?:alert|starci-core-alert|starci-core-image|starci-core-media-frame|starci-core-media-viewport|starci-core-description-pair|starci-core-pinned-action-bar)(?:\s|$)/.test(e.cls) || ['img', 'picture', 'video'].includes(e.tag) || edgeRuled(e);
  const surfaceLike = (e) => e.visible && !inControl(e) && !notCard(e) && e.rect.h >= 40 && (shadowOn(e) || borderOn(e) || (alphaOf(e.style.bg) > 0 && differsFromParent(e)));
  const candidates = els.filter((e) => surfaceLike(e) && e.rect.w >= Math.min(240, vw * 0.5) && !(strip(e) && !ancestors(e).some((a) => surfaceLike(a) && !strip(a))));
  const candidateSet = new Set(candidates.map((e) => e.i));
  const cardOf = (e) => ancestors(e).find((a) => candidateSet.has(a.i)) ?? null;
  const isBand = (e) => { const host = cardOf(e); return Boolean(host) && e.style.radius < 1 && !shadowOn(e) && Math.abs(e.rect.w - host.rect.w) <= 1.5; };
  const cards = candidates.filter((e) => !isBand(e)).map((e) => ({ el: e, nested: Boolean(cardOf(e)) && !isBand(e) }));
  const cardSet = new Set(cards.map((c) => c.el.i));
  const bands = candidates.filter(isBand);
  const containerOf = (e) => ancestors(e).find((a) => cardSet.has(a.i)) ?? null;
  const badges = els.filter((e) => e.visible && !inControl(e) && !cardSet.has(e.i) && e.rect.h <= 32 && e.rect.h >= 12 && e.rect.w <= 260 && (e.own || (kids.get(e.i) ?? []).some((k) => k.own)) && alphaOf(e.style.bg) > 0 && differsFromParent(e));
  const texts = els.filter((e) => e.visible && e.own && e.style.fontSize > 0);
  return { snap, els, byI, kids, ancestors, bgOf, isControl, inControl, inGrammar, shadowOn, borderOn, buttons, inputs, cards, bands, badges, texts, containerOf, cardOf: containerOf, vw };
}

// ---------------------------------------------------------------------------------------------------------
// The check
// ---------------------------------------------------------------------------------------------------------

const describe = (e) => `${e.tag}${e.id ? `#${e.id}` : ''}${e.own ? ` "${e.own.slice(0, 40)}"` : e.value ? ` [${e.value.slice(0, 30)}]` : ''}`;
const near = (a, b, tol = 1) => a != null && b != null && Math.abs(a - b) <= tol;

/** Probes the page must normalise: every expected colour and shadow in computed form. */
export function geometryProbes(g) {
  const a = g.at[0];
  const out = {};
  for (const [v, s] of Object.entries(a.button.variants)) { out[`button.${v}.bg`] = { prop: 'background-color', value: s['background-color']?.value ?? 'transparent' }; out[`button.${v}.fg`] = { prop: 'color', value: s.color?.value ?? 'currentColor' }; if (s['border-top-color']?.value) out[`button.${v}.border`] = { prop: 'border-top-color', value: s['border-top-color'].value }; }
  for (const v of ['primary', 'secondary']) { out[`input.${v}.bg`] = { prop: 'background-color', value: a.input[v]['background-color']?.value ?? 'transparent' }; out[`input.${v}.shadow`] = { prop: 'box-shadow', value: a.input[v]['box-shadow']?.value ?? 'none' }; }
  out['card.top.shadow'] = { prop: 'box-shadow', value: a.card.top['box-shadow']?.value ?? 'none' };
  out['card.nested.border'] = { prop: 'border-top-color', value: a.card.nested['border-top-color']?.value ?? 'transparent' };
  return out;
}

/** GEOMETRY_OFF_GRAMMAR findings of one snapshot against the resolved geometry at the snapshot's width. */
export function geometryFindings(snap, g, { file = snap.file } = {}) {
  const view = readSnapshot(snap);
  const width = snap.viewport?.width ?? DEFAULT_VIEWPORT.width;
  const a = g.resolver ? resolveAt(g, width) : g.at[0];
  const P = snap.probes ?? {};
  const out = [];
  const off = (element, e, property, got, expected, source) => out.push({ level: 'refuse', code: GEOMETRY_CODE, file, element, at: describe(e), property, got, expected, source });
  const shadowNorm = (v) => normalizeShadowText(v);
  // Buttons
  const variantColors = BUTTON_VARIANTS.map((v) => ({ v, bg: P[`button.${v}.bg`]?.rgba, fg: P[`button.${v}.fg`]?.rgba, border: P[`button.${v}.border`]?.rgba }));
  for (const e of view.buttons) {
    const parent = e.parent != null ? view.byI.get(e.parent) : null;
    const parentContent = parent ? parent.rect.w - parent.style.padding[1] - parent.style.padding[3] : null;
    // A real grammar Button declares its width (data-width fill|content); only a hand-drawn one is judged by its box.
    const fill = e.comp === 'Button' && e.dataWidth ? e.dataWidth === 'fill' : parentContent != null && e.rect.w >= parentContent - 1.5 && e.rect.w > e.rect.h * 3;
    const iconOnly = e.rect.w <= e.rect.h + 2;
    // The resolved geometry is the default (md) Button's; a sm or lg one (the grammar Alert's action is sm) is judged on
    // its shape (the pill) only.
    const sized = /(?:^|\s)button--(?:sm|lg)(?:\s|$)/.test(e.cls);
    const r = a.button['border-radius']?.px;
    const expectedH = a.button.heightPx;
    const pill = isPill(r, expectedH);
    const gotR = Math.min(e.style.radius, e.rect.h / 2);
    if (pill ? gotR < e.rect.h / 2 - 0.75 : !near(gotR, r)) off('button', e, 'border-radius', `${e.style.radius}px`, pill ? `a pill: ${r}px = ${a.button['border-radius']?.declared} (radius >= height/2)` : `${r}px`, a.button['border-radius']?.file);
    if (sized) { /* shape only */ } else if (fill) { const floor = a.button.fill['min-height']?.px; if (floor != null && e.rect.h < floor - 0.75) off('button', e, 'min-height (full width)', `${e.rect.h}px`, `>= ${floor}px (${a.button.fill['min-height']?.declared})`, a.button.fill['min-height']?.file); }
    else if (!iconOnly && expectedH != null && !near(e.rect.h, expectedH)) off('button', e, 'height', `${e.rect.h}px`, `${expectedH}px (${a.button.height?.declared})`, a.button.height?.file);
    if (!sized && !iconOnly && !fill && a.button['padding-left']?.px != null && !near(e.style.padding[3], a.button['padding-left'].px)) off('button', e, 'padding-inline', `${e.style.padding[3]}px`, `${a.button['padding-left'].px}px`, a.button['padding-left'].file);
    const label = e.own ? e : (view.kids.get(e.i) ?? []).find((k) => k.own) ?? e;
    if (a.button['font-size']?.px != null && label.own && !near(label.style.fontSize, a.button['font-size'].px, 0.5)) off('button', e, 'font-size', `${label.style.fontSize}px`, `${a.button['font-size'].px}px`, a.button['font-size'].file);
    const bg = e.style.bg;
    const variant = variantColors.find((vc) => (alphaOf(bg) < 0.02 ? alphaOf(vc.bg) < 0.02 : sameColor(bg, vc.bg)));
    if (!variant) off('button', e, 'fill', bg ? `rgba(${bg.join(', ')})` : 'none', `one of the Button variants: ${variantColors.filter((x) => x.bg).map((x) => `${x.v} ${P[`button.${x.v}.bg`]?.value}`).join('; ')}`, a.button.variants.primary['background-color']?.file);
    else if (alphaOf(bg) < 0.02 && view.borderOn(e)) {
      const b = e.style.border[0];
      const ow = a.button.variants.outline;
      if (ow['border-top-width']?.px != null && !near(b.w, ow['border-top-width'].px, 0.25)) off('button', e, 'outline border width', `${b.w}px`, `${ow['border-top-width'].px}px`, ow['border-top-width'].file);
      if (P['button.outline.border']?.rgba && !sameColor(b.color, P['button.outline.border'].rgba)) off('button', e, 'outline border colour', `rgba(${(b.color ?? []).join(', ')})`, `${P['button.outline.border'].value} (${ow['border-top-color']?.declared})`, ow['border-top-color']?.file);
    }
  }
  // Inputs
  for (const e of view.inputs) {
    const inside = Boolean(view.containerOf(e)) || view.ancestors(e).some((x) => view.bands.some((b) => b.i === x.i));
    const spec = a.input[inside ? 'secondary' : 'primary'];
    const r = spec['border-radius']?.px;
    if (r != null && !near(e.style.radius, r)) off('input', e, 'border-radius', `${e.style.radius}px`, `${r}px (${spec['border-radius'].declared})`, spec['border-radius'].file);
    const drawnBorder = e.style.border.some((b) => b.w > 0 && b.style !== 'none' && alphaOf(b.color) > 0.02);
    if ((spec['border-top-width']?.px ?? 0) === 0 && drawnBorder) off('input', e, 'border', `${e.style.border[0].w}px ${e.style.border[0].style}`, `none (${spec['border-top-width']?.declared}${chainText(spec['border-top-width'])})`, spec['border-top-width']?.file);
    const wantBg = P[`input.${inside ? 'secondary' : 'primary'}.bg`]?.rgba;
    const wantShadow = shadowNorm(P[`input.${inside ? 'secondary' : 'primary'}.shadow`]?.value);
    if (inside) {
      if (wantBg && !sameColor(e.style.bg, wantBg)) off('input', e, 'fill (inside a surface: secondary variant)', `rgba(${(e.style.bg ?? []).join(', ')})`, `${P['input.secondary.bg'].value} (${a.input.secondary['background-color']?.declared}) - knowledge/ui/proof/anatomy-source.yaml ANATOMY-2 case-1`, a.input.secondary['background-color']?.file);
      if (shadowNorm(e.style.shadow) !== wantShadow) off('input', e, 'shadow (inside a surface: secondary variant)', shadowNorm(e.style.shadow), wantShadow, a.input.secondary['box-shadow']?.file);
    } else if (wantBg && !sameColor(e.style.bg, wantBg) && !sameColor(e.style.bg, P['input.secondary.bg']?.rgba)) off('input', e, 'fill', `rgba(${(e.style.bg ?? []).join(', ')})`, `${P['input.primary.bg'].value} (primary) or ${P['input.secondary.bg']?.value} (secondary)`, a.input.primary['background-color']?.file);
  }
  // Cards
  for (const { el: e, nested } of view.cards) {
    const spec = nested ? a.card.nested : a.card.top;
    const r = spec['border-radius']?.px;
    if (r != null && !near(Math.min(e.style.radius, e.rect.h / 2), Math.min(r, e.rect.h / 2))) off(nested ? 'nested card' : 'card', e, 'border-radius', `${e.style.radius}px`, `${r}px (${spec['border-radius'].declared}${chainText(spec['border-radius'])})`, spec['border-radius'].file);
    if (!nested) {
      if (view.borderOn(e)) off('card', e, 'border', `${e.style.border[0].w}px ${e.style.border[0].style}`, `none (${spec['border-top-width']?.declared})`, spec['border-top-width']?.file);
      const want = shadowNorm(P['card.top.shadow']?.value);
      if (shadowNorm(e.style.shadow) !== want) off('card', e, 'shadow', shadowNorm(e.style.shadow), `${want} (${spec['box-shadow']?.declared}${chainText(spec['box-shadow'])})`, spec['box-shadow']?.file);
    } else {
      const bw = spec['border-top-width']?.px;
      if (bw != null && !near(e.style.border[0].w, bw, 0.25)) off('nested card', e, 'border', `${e.style.border[0].w}px`, `${bw}px ${spec['border-top-color']?.value ?? ''}`, spec['border-top-width']?.file);
      if (shadowNorm(e.style.shadow) !== shadowNorm(spec['box-shadow']?.value)) off('nested card', e, 'shadow', shadowNorm(e.style.shadow), shadowNorm(spec['box-shadow']?.value), spec['box-shadow']?.file);
    }
  }
  // Badges
  for (const e of view.badges) {
    if (Math.min(e.style.radius, e.rect.h / 2) < e.rect.h / 2 - 0.75) off('badge', e, 'border-radius', `${e.style.radius}px`, `a pill (radius >= height/2; ${a.badge['border-radius']?.declared})`, a.badge['border-radius']?.file);
    const label = e.own ? e : (view.kids.get(e.i) ?? []).find((k) => k.own);
    if (label && a.badge['font-size']?.px != null && !near(label.style.fontSize, a.badge['font-size'].px, 0.5)) off('badge', e, 'font-size', `${label.style.fontSize}px`, `${a.badge['font-size'].px}px`, a.badge['font-size'].file);
  }
  // Page inset: a page-scoped render (a `<shape>--page--<breakpoint>--<theme>` part) keeps its top-level content -
  // text outside any card or control, and every top-level card - the page inset (--grammar-page-inset, PageContainer;
  // knowledge/ui/presentation/padding.yaml scale notes, measure.yaml MEASURE-1) from both viewport edges. A
  // module-ledger page on mobile: a page header flush with the left edge (0px) passed because nothing measured it.
  if (/--page--/.test(path.basename(String(file ?? ''))) && g.resolver && g.chains) {
    let inset = null;
    try { inset = g.resolver.memo(`inset-${width}`, [g.chains.html, g.chains.root], width).variable('--grammar-page-inset'); } catch { inset = null; }
    if (inset?.px != null) {
      const top = [...view.cards.filter((c) => !c.nested).map((c) => c.el), ...view.texts.filter((t) => !view.inControl(t) && !view.containerOf(t))]
        .filter((e) => e.rect.w > 0 && e.rect.h > 0);
      const leftMost = top.reduce((m, e) => (!m || e.rect.x < m.rect.x ? e : m), null);
      const rightMost = top.reduce((m, e) => (!m || e.rect.x + e.rect.w > m.rect.x + m.rect.w ? e : m), null);
      const want = `>= ${inset.px}px (--grammar-page-inset ${inset.declared ?? inset.value ?? ''} at ${width}px; PageContainer, measure.yaml MEASURE-1)`;
      if (leftMost && leftMost.rect.x < inset.px - 1) off('page', leftMost, 'inline inset (left)', `${Math.round(leftMost.rect.x * 10) / 10}px`, want, inset.file ?? null);
      const right = rightMost ? width - (rightMost.rect.x + rightMost.rect.w) : null;
      if (rightMost && right < inset.px - 1) off('page', rightMost, 'inline inset (right)', `${Math.round(right * 10) / 10}px`, want, inset.file ?? null);
    }
  }
  // Font
  const allowed = new Set(g.font.allowed);
  const offFamilies = new Map();
  for (const e of view.texts) { const fam = firstFamily(e.style.fontFamily); if (fam && !allowed.has(fam)) { if (!offFamilies.has(fam)) offFamilies.set(fam, []); offFamilies.get(fam).push(e); } }
  for (const [fam, list] of offFamilies) off('text', list[0], 'font-family', `${fam} (${list.length} text runs)`, `the family font: ${[...allowed].join(' or ')}`, g.font.binding?.file);
  return { findings: out, counts: { buttons: view.buttons.length, inputs: view.inputs.length, cards: view.cards.length, badges: view.badges.length, texts: view.texts.length } };
}

function resolveAt(g, width) {
  const hit = g.at.find((w) => w.width === width);
  if (hit) return hit;
  const again = resolveGeometry({ repo: g.sources.repo, family: g.family, widths: [width], ...(g.sources.drawCss ?? {}) });
  return again.ok ? again.at[0] : g.at[0];
}

export async function checkGeometry(target, { repo, family = null, viewport = DEFAULT_VIEWPORT, grammarDist = null, extraCss = [] } = {}) {
  const files = htmlTargets(target);
  if (!files.length) return { ok: false, exitCode: 2, error: `${target}: no .html file to check` };
  const g = resolveGeometry({ repo, family, widths: [viewport.width], grammarDist, extraCss });
  if (!g.ok) return { ok: false, exitCode: 2, error: g.errors.join('; ') };
  const shot = await snapshotFiles(files, { repo, viewport, probes: geometryProbes(g) });
  if (!shot.ok) return { ok: false, exitCode: 2, error: shot.error };
  const findings = [];
  const measured = [];
  for (const snap of shot.snapshots) { const r = geometryFindings(snap, g, { file: snap.file }); findings.push(...r.findings); measured.push({ file: snap.file, ...r.counts }); }
  return { schema: 'starci/grammar-geometry-check@1', ok: findings.length === 0, exitCode: findings.length ? 1 : 0, family: g.family, viewport, files, measured, findings };
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------

const USAGE = `Usage:
  starci work grammar-geometry --prompt --repo <product repo> [--family <name>] [--json]
  starci work grammar-geometry --check <html file | capture dir> --repo <product repo> [--family <name>] [--viewport 390x844] [--json]
`;

export function parseViewport(text) {
  const m = String(text ?? '').match(/^(\d+)x(\d+)$/);
  return m ? { width: Number(m[1]), height: Number(m[2]) } : null;
}

function plain(g) {
  const strip = (v) => (v && typeof v === 'object' && 'declared' in v ? { value: v.value, px: v.px, declared: v.declared, trace: v.trace, file: v.file } : v);
  const walk = (o) => (Array.isArray(o) ? o.map(walk) : o && typeof o === 'object' ? ('declared' in o ? strip(o) : Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]))) : o);
  return { schema: 'starci/grammar-geometry@1', ok: g.ok, family: g.family, sources: g.sources, widths: g.widths, at: walk(g.at), font: walk(g.font), unbound: g.unbound, touchFloor: walk(g.touchFloor) };
}

export async function grammarGeometryMain(argv = []) {
  const json = argv.includes('--json');
  const repo = argOf(argv, '--repo');
  const family = argOf(argv, '--family');
  if (argv.includes('--help') || argv.includes('-h')) return { exitCode: 0, text: USAGE };
  if (family && !FAMILIES[family]) return { exitCode: 2, text: `--family is one of ${Object.keys(FAMILIES).join(', ')}\n${USAGE}` };
  if (!repo) return { exitCode: 2, text: `--repo <product repo> is required\n${USAGE}` };
  if (argv.includes('--prompt')) {
    const g = resolveGeometry({ repo, family });
    if (!g.ok) return { exitCode: 2, text: `grammar-geometry: ${g.errors.join('; ')}\n` };
    return { exitCode: 0, text: json ? `${JSON.stringify(plain(g), null, 2)}\n` : geometryPrompt(g) };
  }
  const target = argOf(argv, '--check');
  if (target) {
    const viewport = argOf(argv, '--viewport') ? parseViewport(argOf(argv, '--viewport')) : DEFAULT_VIEWPORT;
    if (!viewport) return { exitCode: 2, text: '--viewport is <width>x<height>\n' };
    const r = await checkGeometry(target, { repo, family, viewport });
    if (r.error) return { exitCode: r.exitCode, text: json ? `${JSON.stringify({ schema: 'starci/grammar-geometry-check@1', ok: false, error: r.error }, null, 2)}\n` : `grammar-geometry: ${r.error}\n` };
    if (json) return { exitCode: r.exitCode, text: `${JSON.stringify(r, null, 2)}\n` };
    const lines = r.findings.map((f) => `  REFUSED ${shortFile(f.file, null)}: ${f.element} ${f.at} ${f.property} is ${f.got}, the grammar renders ${f.expected} [${f.code}]`);
    return { exitCode: r.exitCode, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${r.ok ? 'OK' : 'FAIL'}: grammar geometry (${r.family}, ${r.viewport.width}x${r.viewport.height}) - ${r.files.length} file(s), ${r.findings.length} finding(s).\n` };
  }
  return { exitCode: 2, text: USAGE };
}

if (isMain(import.meta.url)) {
  const result = await grammarGeometryMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
