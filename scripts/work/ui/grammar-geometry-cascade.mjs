import { splitTop } from './grammar-geometry-css.mjs';
import { evalLength } from './grammar-geometry-values.mjs';

// grammar-geometry-cascade.mjs - media queries, selector matching and the cascade of grammar-geometry.mjs: which
// declarations win for an element chain at one viewport.

const MEDIA_AND = /(?<!\s)\s+and\s+/;
// `(feature)` or `(feature: value)`; the value keeps any whitespace before it and is trimmed by the caller.
const MEDIA_FEATURE = /^\(\s*([\w-]+)\s*(?::([^)]+))?\)$/;
const lengthAt = (v, env) => evalLength(v, { vw: env.width });
const MEDIA_FEATURES = new Map([
  ['min-width', (value, env) => env.width >= lengthAt(value, env)],
  ['max-width', (value, env) => env.width <= lengthAt(value, env)],
  ['min-height', (value, env) => env.height >= lengthAt(value, env)],
  ['max-height', (value, env) => env.height <= lengthAt(value, env)],
  ['prefers-color-scheme', (value, env) => value === env.scheme],
  ['forced-colors', (value, env) => (value === 'active' ? env.forcedColors : !env.forcedColors)],
  ['prefers-reduced-motion', (value, env) => (value === 'reduce' ? env.reducedMotion : !env.reducedMotion)],
  ['hover', (value, env) => value === env.hover],
  ['any-hover', (value, env) => value === env.hover],
  ['pointer', (value, env) => value === env.pointer],
  ['any-pointer', (value, env) => value === env.pointer],
  ['prefers-contrast', (value) => value === 'no-preference'],
]);

/** Whether one `and`-joined part of a media query holds in `env`. */
function mediaPartMatches(part, env) {
  const p = part.trim().replace(/^only\s+/, '');
  if (p === 'screen' || p === 'all') return true;
  if (p === 'print') return false;
  const m = p.match(MEDIA_FEATURE);
  if (!m) return false;
  const [, feature, raw] = m;
  const test = MEDIA_FEATURES.get(feature);
  return test ? test(raw?.trim(), env) : false;
}

/** Whether one media query list holds in `env` ({width, height, scheme, pointer, hover, forcedColors, reducedMotion}). */
export function mediaMatches(query, env) {
  return splitTop(query).some((one) => {
    const q = one.trim().toLowerCase();
    if (/^not\b/.test(q)) return !mediaMatches(q.replace(/^not\s+/, ''), env);
    return q.split(MEDIA_AND).every((part) => mediaPartMatches(part, env));
  });
}

// A compound selector's simple parts, one at a time from where the last one ended.
const SIMPLE_PART_SOURCE = ([String.raw`\*`, String.raw`[a-zA-Z][\w-]*`, String.raw`\.[\w-]+`, String.raw`#[\w-]+`, String.raw`\[[^\]]+\]`, String.raw`::?[\w-]+(?:\([^)]*\))?`].join('|'));

/** A compound selector's simple parts: ['.a', '[x=y]', 'div', ':root', '*']; null when it holds a state pseudo-class. */
function simpleParts(compound) {
  const parts = [];
  const re = new RegExp(SIMPLE_PART_SOURCE, 'y');
  let m, consumed = 0;
  while ((m = re.exec(compound))) {
    consumed = m.index + m[0].length;
    const part = m[0];
    if (part.startsWith(':')) {
      if (part !== ':root' && part !== ':host') return null;
      parts.push(':root');
      continue;
    }
    parts.push(part.startsWith('[') ? `[${part.slice(1, -1).replace(/\s+/g, '')}]` : part);
  }
  return consumed === compound.length ? parts : null;
}

function specificity(parts) {
  return parts.reduce((n, p) => {
    if (p.startsWith('#')) return n + 100;
    if (p === '*') return n;
    return /^[a-z]/i.test(p) ? n + 1 : n + 10;
  }, 0);
}

/** The compounds of a selector with the combinator that leads each; null when a part is a state pseudo-class or a sibling combinator. */
function selectorCompounds(selector) {
  const compounds = [];
  let combinator = ' ';
  for (const t of selector.split(/\s+/).filter(Boolean)) {
    if (t === '>' || t === '+' || t === '~') { combinator = t; continue; }
    const parts = simpleParts(t);
    if (!parts) return null;
    compounds.push({ parts, combinator });
    combinator = ' ';
  }
  if (!compounds.length || compounds.some((c) => c.combinator === '+' || c.combinator === '~')) return null;
  return compounds;
}

const holds = (parts, el) => parts.every((p) => p === '*' || el.has(p));

/** The chain index of the ancestor `compound` matches from `at`, or -1: the parent for `>`, else the nearest. */
function ancestorOf(compound, via, chain, at) {
  if (via === '>') {
    const parent = at - 1;
    return parent >= 0 && holds(compound.parts, chain[parent]) ? parent : -1;
  }
  let j = at - 1;
  while (j >= 0 && !holds(compound.parts, chain[j])) j -= 1;
  return j;
}

/**
 * Whether `selector` matches the last element of `chain` (each element a Set of simple parts); the
 * specificity when it does, else -1.
 */
export function selectorMatch(selector, chain) {
  const compounds = selectorCompounds(selector);
  if (!compounds) return -1;
  let at = chain.length - 1;
  if (!holds(compounds.at(-1).parts, chain[at])) return -1;
  for (let c = compounds.length - 2; c >= 0; c--) {
    at = ancestorOf(compounds[c], compounds[c + 1].combinator, chain, at);
    if (at < 0) return -1;
  }
  return compounds.reduce((n, c) => n + specificity(c.parts), 0);
}

/** The winning declarations for the last element of `chain`, at `env`. */
export function cascadeAt(sheet, chain, env) {
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
