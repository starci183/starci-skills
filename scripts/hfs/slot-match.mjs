// slot-match.mjs - the slot path patterns of the HFS manifest compiled to regular expressions, and the matching of a path against them:
// the variants that match it, the most specific one, and the nearest slot of an unknown path. Pure; slot-classify.mjs asks it.
import path from 'node:path';
import { braceVariants } from '../lib/glob.mjs';
import { captureNames } from '../lib/i18n.mjs';

const VAR = /<([A-Za-z][A-Za-z0-9-]*)>/g;
export const varsOf = (text) => captureNames(text, VAR);
const hasWildcard = (segment) => /[*?]/.test(segment);

/** `text` with the `<name>` variables filled from `bindings` (an unbound one stays as written). */
export function fillVars(text, bindings) {
  const bound = (whole, name) => bindings[name] ?? whole;
  return `${text}`.replace(VAR, bound);
}

/** Weight of one pattern segment: literal 4, literal mixed with a variable 3, a bare variable 2, a wildcard 1, `**` 0. */
function segmentWeight(segment) {
  if (segment === '**') return 0;
  if (hasWildcard(segment)) return 1;
  if (/^<[^>]+>$/.test(segment)) return 2;
  if (segment.includes('<')) return 3;
  return 4;
}

/** The RegExp source of one pattern segment (no separators); variables capture, and are listed in `names`. */
function segmentSource(segment, names) {
  let source = '', variableEnd = -1;
  for (let i = 0; i < segment.length; i += 1) {
    const c = segment[i];
    if (i <= variableEnd) continue;
    if (c === '<') {
      variableEnd = segment.indexOf('>', i);
      names.push(segment.slice(i + 1, variableEnd));
      source += '([^/]+?)';
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += /[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c;
  }
  return source;
}

/** One brace-free pattern compiled: `dir` patterns (trailing /) own everything below their root. */
export function compileVariant(slot, pattern) {
  const dir = pattern.endsWith('/');
  const body = dir ? pattern.slice(0, -1) : pattern;
  const segments = body.split('/');
  const names = [];
  let source = '';
  segments.forEach((segment, index) => {
    const last = index === segments.length - 1;
    if (segment === '**') source += last ? '.*' : '(?:.*/)?';
    else source += segmentSource(segment, names) + (last ? '' : '/');
  });
  return {
    slot,
    pattern,
    dir,
    segments,
    names,
    score: segments.reduce((sum, s) => sum + segmentWeight(s), 0),
    wildcards: segments.filter(hasWildcard).length,
    regex: new RegExp(`^(${source})${dir ? '(?:/.*)?' : ''}$`),
    segmentRegexes: segments.map((s) => (s === '**' ? null : new RegExp(`^${segmentSource(s, [])}$`))),
  };
}

export const variantsOf = (slot) => braceVariants(slot.path).map((pattern) => compileVariant(slot, pattern));

const levenshtein = (a, b) => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const held = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = held;
    }
  }
  return row[b.length];
};

/** The match of `p` against one variant: its slot, root and bindings, or null (not matching, filtered out, or an app-kind slot of another kind). */
function matchVariant(variant, p, only, appKind) {
  if (only && !only(variant.slot)) return null;
  const m = variant.regex.exec(p);
  if (!m) return null;
  const bindings = {};
  variant.names.forEach((name, i) => { bindings[name] = m[i + 2]; });
  if (variant.slot.appKind !== undefined && appKind.get(bindings.app) !== variant.slot.appKind) return null;
  const root = variant.dir ? m[1] : path.posix.dirname(m[1]);
  return { variant, slot: variant.slot, root: root === '.' ? '' : root, bindings };
}

/** Every variant matching `p`, with its root and bindings, minus app-kind slots of another kind, the most specific first. */
export function matchVariants({ variants, appKind }, p, only) {
  const found = [];
  for (const variant of variants) {
    const hit = matchVariant(variant, p, only, appKind);
    if (hit) found.push(hit);
  }
  return found.sort((a, b) => b.variant.score - a.variant.score || a.variant.wildcards - b.variant.wildcards);
}

/** The single most specific match of a sorted list: {hit, ambiguous}; two slots of equal specificity are ambiguous. */
export function bestMatch(found) {
  if (!found.length) return { hit: null, ambiguous: [] };
  const top = found.filter((f) => f.variant.score === found[0].variant.score && f.variant.wildcards === found[0].variant.wildcards);
  const distinct = [...new Set(top.map((f) => f.slot.id))];
  return distinct.length > 1 ? { hit: null, ambiguous: distinct } : { hit: top[0], ambiguous: [] };
}

/** How many leading segments of `parts` a variant accepts. */
function acceptedDepth(variant, parts) {
  let depth = 0;
  while (depth < parts.length && depth < variant.segments.length) {
    const rx = variant.segmentRegexes[depth];
    if (rx === null || !rx.test(parts[depth])) break;
    depth += 1;
  }
  return depth;
}

/** Whether `cand` is nearer to the path than `winner`: deeper, then closer in shape, then in spelling, then more specific. */
function nearerCandidate(cand, winner) {
  if (!winner) return true;
  if (cand.depth !== winner.depth) return cand.depth > winner.depth;
  if (cand.shape !== winner.shape) return cand.shape < winner.shape;
  if (cand.distance !== winner.distance) return cand.distance < winner.distance;
  return cand.variant.score > winner.variant.score;
}

/** The leading segments of `p` a variant accepts, and how far it got; how the nearest slot of an unknown path is found. */
export function nearestSlot(variants, p) {
  const parts = p.split('/');
  let winner = null;
  for (const variant of variants) {
    const depth = acceptedDepth(variant, parts);
    const expected = variant.segments[depth] ?? '';
    const distance = levenshtein(parts[depth] ?? '', expected.replace(VAR, ''));
    const cand = { variant, depth, shape: Math.abs(variant.segments.length - parts.length), distance };
    if (nearerCandidate(cand, winner)) winner = cand;
  }
  if (!winner) return null;
  return {
    slot: winner.variant.slot.id,
    pattern: winner.variant.pattern,
    matchedDepth: winner.depth,
    matchedPrefix: parts.slice(0, winner.depth).join('/'),
    expectedNext: winner.variant.segments[winner.depth] ?? null,
  };
}
