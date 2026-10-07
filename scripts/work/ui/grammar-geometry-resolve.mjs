import fs from 'node:fs';
import path from 'node:path';
import { cascadeAt } from './grammar-geometry-cascade.mjs';
import { loadSheet, splitTop } from './grammar-geometry-css.mjs';
import { evalLength, substitute } from './grammar-geometry-values.mjs';
import { PRUNE, discoverSources, readText } from './grammar-geometry-sources.mjs';

// grammar-geometry-resolve.mjs - the resolver of grammar-geometry.mjs: one product's cascade at one viewport,
// and the geometry (button, input, card, badge, font) read out of it.

export const DEFAULT_VIEWPORT = { width: 390, height: 844 };
const PROMPT_WIDTHS = [390, 1280];
export const BUTTON_VARIANTS = ['primary', 'secondary', 'tertiary', 'outline', 'ghost', 'danger'];

const envOf = (width, height = 844) => ({ width, height, scheme: 'light', pointer: width < 768 ? 'coarse' : 'fine', hover: width < 768 ? 'none' : 'hover', forcedColors: false, reducedMotion: false });

/** The element chains the geometry reads (selectors only; every value comes out of the cascade). */
const geometryChains = (familyId) => {
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
      if (px == null && fontPx != null && value != null) {
        const ratio = evalLength(value, { unitless: true });
        if (ratio != null) px = Math.round(ratio * fontPx * 100) / 100;
      }
      return { prop, declared: d.value, value, px, trace: trace.toReversed(), file: d.rule.file, selector: d.rule.selectors.join(', '), source: d.rule.source, important: d.important };
    };
    const variable = (name) => {
      const hit = lookup(name, last);
      if (!hit) return null;
      const trace = [];
      const value = substitute(hit.value, lookup, hit.level, trace);
      return { name, declared: hit.value, value, px: value == null ? null : evalLength(value, { vw: width }), trace: trace.toReversed(), file: hit.file };
    };
    return { get, variable, levels };
  };
  const memo = (key, chain, width) => {
    const k = `${key}@${width}`;
    if (!cache.has(k)) cache.set(k, element(chain, width));
    return cache.get(k);
  };
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

const SOURCE_FILE = /\.(tsx?|jsx?|mdx|mjs)$/;
const TEST_FILE = /\.(spec|test|stories)\./;

/** Record in `found` every candidate name `text` mentions. */
function noteMentions(text, candidates, found) {
  for (const n of candidates) {
    if (!found.has(n) && text.includes(n)) found.add(n);
  }
}

/** Walk the source files under `dir` (eight levels deep, build output and dot directories pruned) for the candidate names. */
function mentionedIn(dir, depth, candidates, found) {
  if (depth > 8 || found.size === candidates.length) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!PRUNE.has(e.name) && !e.name.startsWith('.')) mentionedIn(full, depth + 1, candidates, found);
      continue;
    }
    if (!SOURCE_FILE.test(e.name) || TEST_FILE.test(e.name)) continue;
    noteMentions(readText(full), candidates, found);
  }
}

/** The custom properties the family sheet declares, name to first value. */
function declaredFamilyTokens(sheet) {
  const declared = new Map();
  for (const r of sheet.rules.filter((x) => x.source === 'family')) {
    for (const d of r.decls) {
      if (d.prop.startsWith('--') && !declared.has(d.prop)) declared.set(d.prop, d.value);
    }
  }
  return declared;
}

/** The custom properties some var() of the loaded cascade reads. */
function referencedVars(sheet) {
  const referenced = new Set();
  for (const r of sheet.rules) {
    for (const d of r.decls) {
      for (const m of String(d.value).matchAll(/var\(\s*(--[\w-]+)/g)) referenced.add(m[1]);
    }
  }
  return referenced;
}

/** Every custom property the family sheet declares that no var() of the loaded cascade and no source file of the app reads. */
function unboundFamilyTokens(sources, sheet) {
  if (!sources.familyFile) return [];
  const declared = declaredFamilyTokens(sheet);
  const referenced = referencedVars(sheet);
  const candidates = [...declared.keys()].filter((n) => !referenced.has(n));
  const inSource = new Set();
  if (candidates.length) {
    for (const root of sources.sourceRoots ?? []) mentionedIn(root, 0, candidates, inSource);
  }
  return candidates.filter((n) => !inSource.has(n)).map((name) => ({ name, value: declared.get(name) }));
}

export const firstFamily = (value) => String(value ?? '').split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).find((x) => x && !x.endsWith('(set at runtime)') && !x.startsWith('--'))?.toLowerCase() ?? null;

/** The family's font: the root binding, every family font token, and each app css rule that binds a font. */
function fontOf(resolver, chains, width) {
  const root = resolver.memo('root', [chains.html, chains.root], width);
  const binding = root.get('font-family');
  const tokens = [];
  for (const r of resolver.sheet.rules.filter((x) => x.source === 'family')) {
    for (const d of r.decls) {
      if (/^--[\w-]*font[\w-]*$/.test(d.prop) && !tokens.some((t) => t.name === d.prop)) tokens.push({ name: d.prop, value: d.value, resolved: root.variable(d.prop)?.value ?? null });
    }
  }
  const surfaces = [];
  for (const r of resolver.sheet.rules.filter((x) => x.source === 'app')) {
    for (const d of r.decls) {
      if (d.prop !== 'font-family') continue;
      const value = d.value.replace(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g, (all, name, fallback) => root.variable(name)?.value ?? (fallback?.trim() || `${name} (set at runtime)`));
      surfaces.push({ selector: r.selectors.join(', '), file: r.file, declared: d.value, value });
    }
  }
  const families = new Set([binding?.value, ...tokens.map((t) => t.resolved), ...surfaces.map((s) => s.value)].filter(Boolean).map((v) => firstFamily(v)));
  return { binding, tokens, surfaces, allowed: [...families].filter(Boolean) };
}

const isTransparentValue = (v) => /^(transparent|#0000|#00000000|rgba?\([^)]*[,/]\s*0\s*\))$/i.test(String(v).trim());

export function normalizeShadowText(value) {
  if (value == null) return 'unset';
  const layers = splitTop(value).filter((l) => !/(#0000\b|#00000000\b|transparent|rgba?\([^)]*[,/]\s*0\s*\))/.test(l));
  return layers.length ? layers.join(', ') : 'none';
}

export const isPill = (radiusPx, heightPx) => radiusPx != null && heightPx != null && radiusPx >= heightPx / 2;
export const chainText = (v) => v?.trace?.length ? ' <- ' + v.trace.map((t) => t.name + ': ' + t.value).join(' <- ') : '';

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
