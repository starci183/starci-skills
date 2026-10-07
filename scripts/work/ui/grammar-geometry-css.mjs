import fs from 'node:fs';
import path from 'node:path';

// grammar-geometry-css.mjs - the CSS reading of grammar-geometry.mjs: parsing a sheet into style rules and loading
// sheets with their imports in cascade order.

function skipString(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) {
    if (s[j] === '\\') {
      j++;
      continue;
    }
    if (s[j] === q) return j + 1;
  }
  return s.length;
}

export function matchClose(s, i, open, close) {
  let depth = 0, j = i;
  while (j < s.length) {
    const c = s[j];
    j = c === '"' || c === "'" ? skipString(s, j) : j + 1;
    if (c === open) depth += 1;
    else if (c === close && --depth === 0) return j - 1;
  }
  return s.length;
}

/** Split on top-level commas (outside parentheses, brackets and strings). */
export function splitTop(text, sep = ',') {
  const out = [];
  let depth = 0, start = 0, i = 0;
  while (i < text.length) {
    const c = text[i];
    i = c === '"' || c === "'" ? skipString(text, i) : i + 1;
    if (c === '(' || c === '[') depth += 1;
    else if (c === ')' || c === ']') depth -= 1;
    else if (c === sep && depth === 0) { out.push(text.slice(start, i - 1).trim()); start = i; }
  }
  out.push(text.slice(start).trim());
  return out.filter(Boolean);
}

// After the whitespace collapse a run is one space, so a combinator takes at most one space on each side.
const normalizeSelector = (sel) => sel.replace(/\s+/g, ' ').replace(/ ?([>+~]) ?/g, ' $1 ').replace(/=\s*"([^"]*)"/g, '=$1').replace(/=\s*'([^']*)'/g, '=$1').trim();

// `@import url(x) layer(y)`; the whitespace after `@import` is one run, then an optional `url(` with its own.
const IMPORT_RULE = /^@import\s+(?:url\(\s*)?["']?([^"')\s]+)["']?\)?\s*(?:layer\(([^)]+)\))?/i;
const LAYER_LIST = /^@layer\s([^{]+)$/i;
const IMPORTANT = /!\s*important\s*$/i;
const TRANSPARENT_AT_RULES = new Set(['supports', 'container', 'scope']);

/** An `@import` or `@layer a, b;` statement: recorded in `st.out`. */
function atStatement(st, t, ctx) {
  const m = t.match(IMPORT_RULE);
  if (m) st.out.imports.push({ target: m[1], layer: m[2] ?? null, parentLayer: ctx.layer });
  const l = t.match(LAYER_LIST);
  if (!l) return;
  for (const name of splitTop(l[1])) {
    const full = ctx.layer ? `${ctx.layer}.${name}` : name;
    st.out.layers.push(full);
    if (!st.out.imports.length && !st.out.rules.length) st.out.early.push(full);
  }
}

/** A `prop: value` declaration of `rule`, its shorthands expanded to longhands. */
function declaration(rule, t) {
  const colon = t.indexOf(':');
  if (colon <= 0) return;
  const prop = t.slice(0, colon).trim();
  let value = t.slice(colon + 1).replace(/\s+/g, ' ').trim();
  const important = IMPORTANT.test(value);
  if (important) value = value.replace(IMPORTANT, '').trim();
  for (const [p, v] of expandShorthand(prop.startsWith('--') ? prop : prop.toLowerCase(), value)) rule.decls.push({ prop: p, value: v, important });
}

function statement(st, rule, ctx, raw) {
  const t = raw.trim();
  if (!t) return;
  if (t.startsWith('@')) {
    atStatement(st, t, ctx);
    return;
  }
  if (rule) declaration(rule, t);
}

/** The block of an at-rule (`@media`, `@layer`, `@theme`, ...): walked with the context it adds. */
function atBlock(st, p, body, ctx) {
  const name = p.match(/^@([\w-]+)/)?.[1]?.toLowerCase();
  const rest = p.slice(name.length + 1).trim();
  if (name === 'media') return walkCss(st, body, { ...ctx, media: [...ctx.media, rest] });
  if (TRANSPARENT_AT_RULES.has(name)) return walkCss(st, body, ctx);
  if (name === 'layer') {
    const layer = ctx.layer ? `${ctx.layer}.${rest || '<anonymous>'}` : (rest || '<anonymous>');
    st.out.layers.push(layer);
    return walkCss(st, body, { ...ctx, layer });
  }
  if (name === 'theme') return walkCss(st, body, { ...ctx, selectors: [':root'], theme: true });
  return undefined;
}

/** The selectors of a nested rule: each own selector under every parent (`&` is replaced by the parent). */
function nestedSelectors(own, parents) {
  if (!parents) return own;
  return parents.flatMap((parent) => own.map((sel) => (sel.includes('&') ? sel.replaceAll('&', parent) : `${parent} ${sel}`)));
}

function block(st, ctx, prelude, body) {
  const p = prelude.trim();
  if (p.startsWith('@')) return atBlock(st, p, body, ctx);
  const own = splitTop(p).map(normalizeSelector);
  return walkCss(st, body, { ...ctx, selectors: nestedSelectors(own, ctx.selectors) });
}

function walkCss(st, s, ctx) {
  const rule = ctx.selectors ? { selectors: ctx.selectors, decls: [], media: ctx.media, layer: ctx.layer, file: st.file } : null;
  if (rule) st.out.rules.push(rule);
  let i = 0, start = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '"' || c === "'") { i = skipString(s, i); continue; }
    if (c === '(') { i = matchClose(s, i, '(', ')') + 1; continue; }
    if (c === ';') { statement(st, rule, ctx, s.slice(start, i)); i += 1; start = i; continue; }
    if (c === '{') {
      const end = matchClose(s, i, '{', '}');
      block(st, ctx, s.slice(start, i), s.slice(i + 1, end));
      i = end + 1;
      start = i;
      continue;
    }
    if (c === '}') { i += 1; start = i; continue; }
    i += 1;
  }
  statement(st, rule, ctx, s.slice(start));
}

/**
 * Parse CSS text into style rules: {selectors, decls: [{prop, value, important}], media: [], layer, file}.
 * `@import` targets are returned in `imports`; `@layer a, b;` statements in `layers`.
 */
export function parseCss(text, { file = null } = {}) {
  const src = String(text).replace(/\/\*[\s\S]*?\*\//g, '');
  const st = { out: { rules: [], imports: [], layers: [], early: [] }, file };
  walkCss(st, src, { selectors: null, media: [], layer: null });
  st.out.rules = st.out.rules.filter((r) => r.decls.length);
  return st.out;
}

const LOGICAL_SIDE = /^(padding|margin)-(inline|block)-(start|end)$/;
const SIDES = ['top', 'right', 'bottom', 'left'];
const BORDER_STYLES = /^(none|hidden|solid|dashed|dotted|double|groove|ridge|inset|outset)$/i;
const fourSides = (tokens) => { const [t, r = t, b = t, l = r] = tokens; return [t, r, b, l]; };
const LENGTH_FUNCTIONS = ['calc', 'min', 'max', 'clamp'].map((name) => `${name}\\(.*\\)`).join('|');
const LENGTH_TOKEN = new RegExp(String.raw`^(0|-?[\d.]+[a-z%]*|${LENGTH_FUNCTIONS}|thin|medium|thick)$`, 'i');
const isLengthToken = (t) => LENGTH_TOKEN.test(t);

/** `padding`/`margin` on four sides. */
function expandBox(prop, value, tokens) {
  if (prop !== 'padding' && prop !== 'margin') return null;
  return fourSides(tokens).map((v, k) => [`${prop}-${SIDES[k]}`, v]);
}

/** `padding-inline`, `margin-block` and the like on two sides. */
function expandAxis(prop, value, tokens) {
  if (!/^(padding|margin)-(inline|block)$/.test(prop)) return null;
  const [base, axis] = prop.split('-');
  const [a, b = a] = tokens;
  return axis === 'inline' ? [[`${base}-left`, a], [`${base}-right`, b]] : [[`${base}-top`, a], [`${base}-bottom`, b]];
}

/** `padding-inline-start`, `margin-block-end` and the like on one side. */
function expandLogicalSide(prop, value) {
  const m = LOGICAL_SIDE.exec(prop);
  if (!m) return null;
  const [startSide, endSide] = m[2] === 'inline' ? ['left', 'right'] : ['top', 'bottom'];
  return [[`${m[1]}-${m[3] === 'start' ? startSide : endSide}`, value]];
}

/** `border-width`, `border-style` and `border-color` on four sides. */
function expandBorderKind(prop, value, tokens) {
  if (prop !== 'border-width' && prop !== 'border-style' && prop !== 'border-color') return null;
  const kind = prop.split('-')[1];
  return fourSides(tokens).map((v, k) => [`border-${SIDES[k]}-${kind}`, v]);
}

/** The width, style and colour a `border` value names. */
function borderParts(tokens) {
  let width = 'medium', style = 'none', color = 'currentcolor';
  if (tokens.length === 1 && tokens[0].startsWith('var(')) return { width: tokens[0], style: tokens[0], color: tokens[0] };
  for (const t of tokens) {
    if (BORDER_STYLES.test(t)) style = t;
    else if (isLengthToken(t)) width = t;
    else color = t;
  }
  if (tokens.length === 1 && (tokens[0] === '0' || /^none$/i.test(tokens[0]))) { width = '0'; style = 'none'; }
  return { width, style, color };
}

/** `border` and `border-<side>` as width, style and colour longhands. */
function expandBorder(prop, value, tokens) {
  if (prop !== 'border' && !/^border-(top|right|bottom|left)$/.test(prop)) return null;
  const sides = prop === 'border' ? SIDES : [prop.split('-')[1]];
  const { width, style, color } = borderParts(tokens);
  return sides.flatMap((side) => [[`border-${side}-width`, width], [`border-${side}-style`, style], [`border-${side}-color`, color]]);
}

const expandBackground = (prop, value, tokens) => (prop === 'background' && tokens.length === 1 && !/(url|gradient)\(/.test(value) ? [['background-color', value]] : null);

const expandRadius = (prop, value, tokens) => (prop === 'border-radius' && tokens.length === 1
  ? [['border-radius', value], ...['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((c) => [`border-${c}-radius`, value])]
  : null);

function expandGap(prop, value, tokens) {
  if (prop !== 'gap') return null;
  const [row, col = row] = tokens;
  return [['gap', value], ['row-gap', row], ['column-gap', col]];
}

const SHORTHANDS = [expandBox, expandAxis, expandLogicalSide, expandBorderKind, expandBorder, expandBackground, expandRadius, expandGap];

/** Longhands for the shorthands the geometry reads (padding, margin, border, background, logical sides). */
export function expandShorthand(prop, value) {
  const tokens = splitTop(String(value).replace(/\s+/g, ' '), ' ');
  for (const expand of SHORTHANDS) {
    const longhands = expand(prop, value, tokens);
    if (longhands) return longhands;
  }
  return [[prop, value]];
}

const RELATIVE_IMPORT = /^\.\.?\//;

function addLayer(sheet, name) {
  if (name && !sheet.layerOrder.includes(name)) sheet.layerOrder.push(name);
}

/** An import: a relative one loads its file, a bare one what `resolveBare` returns (files to load and layers to declare). */
function loadImport(ctx, imp, abs, source, layer) {
  if (RELATIVE_IMPORT.test(imp.target)) {
    loadFile(ctx, path.resolve(path.dirname(abs), imp.target), source, layer);
    return;
  }
  const bare = ctx.resolveBare(imp.target, abs);
  if (bare && !Array.isArray(bare)) {
    for (const l of bare.layers ?? []) addLayer(ctx.sheet, l);
    return;
  }
  for (const b of bare ?? []) {
    if (!b.layers) loadFile(ctx, b.file, b.source, layer);
    else for (const l of b.layers) addLayer(ctx.sheet, l);
  }
}

function loadFile(ctx, file, inherited, layerPrefix = null) {
  const { sheet } = ctx;
  const abs = path.resolve(file);
  if (ctx.seen.has(abs) || !fs.existsSync(abs)) return;
  ctx.seen.add(abs);
  const source = ctx.sourceOf(abs, inherited);
  const parsed = parseCss(fs.readFileSync(abs, 'utf8'), { file: abs });
  sheet.files.push({ file: abs, source });
  const prefixed = (layer) => {
    if (!layerPrefix) return layer;
    return layer ? `${layerPrefix}.${layer}` : layerPrefix;
  };
  for (const l of parsed.early) addLayer(sheet, prefixed(l));
  for (const imp of parsed.imports) loadImport(ctx, imp, abs, source, prefixed(imp.layer ?? imp.parentLayer));
  for (const l of parsed.layers) addLayer(sheet, prefixed(l));
  for (const r of parsed.rules) {
    const layer = prefixed(r.layer);
    addLayer(sheet, layer);
    sheet.rules.push({ ...r, layer, source, order: sheet.rules.length });
  }
}

/**
 * Load css entries into one sheet in cascade order: each file's relative @imports, and its bare package
 * imports through `resolveBare(spec, fromFile) -> [{file, source}] | {layers}`, before its own rules.
 */
export function loadSheet(entries, { resolveBare = () => [], sourceOf = (file, source) => source } = {}) {
  const sheet = { rules: [], layerOrder: [], files: [] };
  const ctx = { sheet, seen: new Set(), resolveBare, sourceOf };
  for (const e of entries) loadFile(ctx, e.file, e.source);
  return sheet;
}
