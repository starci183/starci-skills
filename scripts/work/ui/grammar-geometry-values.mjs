import { matchClose, splitTop } from './grammar-geometry-css.mjs';

// grammar-geometry-values.mjs - the values of grammar-geometry.mjs: length arithmetic and var() substitution.

const ROOT_FONT_PX = 16;

const LENGTH_NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?`;
const LENGTH_TOKEN_SOURCE = [String.raw`\s*(${LENGTH_NUMBER})([a-z%]*)`, String.raw`\s*([a-z-]+)\(`, String.raw`\s*([()+\-*/,])`].join('|');

/** Evaluate a length expression (px, rem, em, vw, calc/min/max/clamp) to CSS pixels; null when it cannot. */
export function evalLength(text, { vw = null, rootPx = ROOT_FONT_PX, unitless = false } = {}) {
  const src = String(text ?? '').trim();
  if (!src) return null;
  const tokens = [];
  const re = new RegExp(LENGTH_TOKEN_SOURCE, 'iy');
  let m;
  while (re.lastIndex < src.length) {
    const at = re.lastIndex;
    m = re.exec(src);
    if (m?.index !== at) {
      if (/^\s*$/.test(src.slice(at))) break;
      return null;
    }
    if (m[1] !== undefined) tokens.push({ num: Number(m[1]), unit: m[2].toLowerCase() });
    else if (m[3] !== undefined) tokens.push({ fn: m[3].toLowerCase() });
    else tokens.push({ op: m[4] });
  }
  let i = 0;
  const toPx = ({ num, unit }) => {
    if (unit === 'px') return { v: num, len: true };
    if (unit === 'rem' || unit === 'em') return { v: num * rootPx, len: true };
    if (unit === 'vw') {
      if (vw == null) throw new Error('vw');
      return { v: (num * vw) / 100, len: true };
    }
    if (unit === '') return { v: num, len: false };
    throw new Error(`unit ${unit}`);
  };
  const expr = () => {
    let a = term();
    while (tokens[i]?.op === '+' || tokens[i]?.op === '-') {
      const op = tokens[i++].op;
      const b = term();
      a = { v: op === '+' ? a.v + b.v : a.v - b.v, len: a.len || b.len };
    }
    return a;
  };
  const term = () => {
    let a = factor();
    while (tokens[i]?.op === '*' || tokens[i]?.op === '/') {
      const op = tokens[i++].op;
      const b = factor();
      a = { v: op === '*' ? a.v * b.v : a.v / b.v, len: a.len || b.len };
    }
    return a;
  };
  const args = () => {
    const list = [expr()];
    while (tokens[i]?.op === ',') { i++; list.push(expr()); }
    if (tokens[i++]?.op !== ')') throw new Error('paren');
    return list;
  };
  const factor = () => {
    const t = tokens[i++];
    if (!t) throw new Error('end');
    if (t.num !== undefined) return toPx(t);
    if (t.op === '(') {
      const v = expr();
      if (tokens[i++]?.op !== ')') throw new Error('paren');
      return v;
    }
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

/** The text a `var(inner)` reference resolves to: the variable's value, else its fallback; null when neither does. */
function resolveVar(inner, lookup, level, trace, depth) {
  const name = splitTop(inner)[0].trim();
  const fallback = inner.includes(',') ? inner.slice(inner.indexOf(',') + 1).trim() : null;
  const hit = lookup(name, level);
  let resolved = null;
  if (hit && !/^(initial|unset)$/i.test(String(hit.value).trim())) {
    resolved = substitute(hit.value, lookup, hit.level, trace, depth + 1);
    if (resolved !== null) trace.push({ name, value: hit.value, file: hit.file ?? null, selector: hit.selector ?? null });
  }
  if (resolved === null && fallback !== null) resolved = substitute(fallback, lookup, level, trace, depth + 1);
  return resolved;
}

/** Replace every var() in `value` through `lookup(name) -> {value, level} | null`; trace records each hop. */
export function substitute(value, lookup, level, trace, depth = 0) {
  if (depth > 40) return null;
  let out = '', i = 0;
  const s = String(value);
  while (i < s.length) {
    const at = s.indexOf('var(', i);
    if (at < 0) {
      out += s.slice(i);
      break;
    }
    out += s.slice(i, at);
    const end = matchClose(s, at + 3, '(', ')');
    const resolved = resolveVar(s.slice(at + 4, end), lookup, level, trace, depth);
    if (resolved === null) return null;
    out += resolved;
    i = end + 1;
  }
  return out.trim();
}
