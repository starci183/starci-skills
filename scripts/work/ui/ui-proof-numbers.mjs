// ui-proof-numbers.mjs — the numbers of a ui proof brief: rem values, Tailwind utility classes and CSS tokens
// resolved through the product cascade (see ui-proof-brief.mjs, the owner).

const REM_PX = 16;
const NUMBER = String.raw`\d+(?:\.\d+)?`;
const SPACING_PREFIXES = 'p|px|py|pt|pb|ps|pe|pl|pr|m|mx|my|mt|mb|ms|me|ml|mr|gap|gap-x|gap-y|space-x|space-y|size|min-h|min-w|w|h';
const SPACING = new RegExp(String.raw`^(-?)(${SPACING_PREFIXES})-(${NUMBER})$`);
const RADIUS = /^rounded(?:-([trbl]{1,2}))?(?:-(none|xs|sm|md|lg|xl|2xl|3xl|4xl|full))?$/;
const TEXT_SIZE = /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl)$/;
const LEADING = new RegExp(String.raw`^leading-(${NUMBER})$`);
const FONT_WEIGHT = /^font-(normal|medium|semibold|bold)$/;
const BORDER = /^border(?:-([trblxy]))?(?:-(\d+))?$/;
const VARIANT_PREFIX = /^([a-z0-9-]+:)+/;

export const remPx = (v) => { const m = /^(-?(?:\d+(?:\.\d+)?|\.\d+))(rem|px)?$/.exec(String(v ?? '').trim()); if (!m) { return null; } return Number(m[1]) * (m[2] === 'px' ? 1 : REM_PX); };
export const fmtPx = (n) => (n == null ? '?' : `${Math.round(n * 10) / 10}px`);

/** A token lookup over the family root at one width: `variable(name)` -> {value, px}. */
export function tokenScope(g, width) {
  if (!g?.ok) return null;
  const el = g.resolver.memo(`root-${width}`, [g.chains.html, g.chains.root], width);
  return { variable: (name) => el.variable(name), width };
}

const evalRatio = (v) => { const m = /^calc\(([\d.]+)\/([\d.]+)\)$/.exec(String(v).replace(/\s+/g, '')); if (m) { return Number(m[1]) / Number(m[2]); } const n = Number(v); return Number.isFinite(n) ? n : null; };

// Each class parser answers `undefined` when the class is not its kind, else the resolved value (or null).
const spacingClass = (bare, { cls, variant, spacing, spacingVar }) => {
  const m = bare.match(SPACING);
  if (!m) return undefined;
  const n = Number(m[3]) * (m[1] ? -1 : 1);
  return spacing == null ? null : { cls, variant, px: n * spacing, how: `${m[3]} x --spacing (${spacingVar.value})` };
};

const radiusClass = (bare, { cls, variant, scope }) => {
  const m = bare.match(RADIUS);
  if (!m) return undefined;
  const size = m[2] ?? null;
  if (size === 'none') return { cls, variant, px: 0, how: 'none' };
  if (size === 'full') return { cls, variant, px: Infinity, how: 'a corner larger than the box (pill)' };
  const v = size ? scope?.variable(`--radius-${size}`) : scope?.variable('--radius');
  if (v?.px != null) return { cls, variant, px: v.px, how: '--radius' + (size ? '-' + size : '') + ': ' + v.value };
  return { cls, variant, px: null, how: `--radius-${size} is not bound by the cascade` };
};

const textSizeClass = (bare, { cls, variant, scope }) => {
  const m = bare.match(TEXT_SIZE);
  if (!m) return undefined;
  const size = scope?.variable(`--text-${m[1]}`);
  const lh = scope?.variable(`--text-${m[1]}--line-height`);
  const ratio = lh?.value != null ? Number(evalRatio(lh.value)) : null;
  return size?.px != null ? { cls, variant, px: size.px, lineHeight: ratio ? Math.round(size.px * ratio * 10) / 10 : null, how: `--text-${m[1]}: ${size.value}` } : null;
};

const leadingClass = (bare, { cls, variant, spacing }) => {
  const m = bare.match(LEADING);
  if (!m || spacing == null) return undefined;
  return { cls, variant, px: Number(m[1]) * spacing, how: `line-height ${m[1]} x --spacing` };
};

const fontWeightClass = (bare, { cls, variant, scope }) => {
  const m = bare.match(FONT_WEIGHT);
  if (!m) return undefined;
  const w = scope?.variable(`--font-weight-${m[1]}`);
  return w ? { cls, variant, weight: Number(w.value), how: `--font-weight-${m[1]}: ${w.value}` } : null;
};

const borderClass = (bare, { cls, variant }) => {
  const m = bare.match(BORDER);
  return m ? { cls, variant, px: m[2] ? Number(m[2]) : 1, how: 'border width' } : undefined;
};

const CLASS_PARSERS = [spacingClass, radiusClass, textSizeClass, leadingClass, fontWeightClass, borderClass];

/** The px a single utility class resolves to under the family, or null when it carries no number. */
export function classValue(cls, scope) {
  const bare = cls.replace(VARIANT_PREFIX, '');
  const variant = cls.slice(0, cls.length - bare.length).replace(/:$/, '') || null;
  const spacingVar = scope?.variable('--spacing');
  const at = { cls, variant, scope, spacingVar, spacing: spacingVar?.px ?? null };
  for (const parse of CLASS_PARSERS) {
    const value = parse(bare, at);
    if (value !== undefined) return value;
  }
  return null;
}

/** Every utility class spelled in a render/title string, with its resolved value. */
export function classesIn(text, scope) {
  const out = [];
  const seen = new Set();
  for (const m of String(text ?? '').matchAll(/`([^`]+)`|className="([^"]+)"/g)) {
    for (const raw of (m[1] ?? m[2]).split(/[\s"'<>{}=]+/)) {
      const cls = raw.replace(/^\[|\]$/g, '').trim();
      if (!cls || seen.has(cls)) continue;
      const v = classValue(cls, scope);
      if (v) { seen.add(cls); out.push(v); }
    }
  }
  return out;
}

export const describeClass = (v) => { let size; if (v.px === Infinity) { size = 'pill'; } else if (v.px != null) { size = fmtPx(v.px); } else { size = v.weight ?? '?'; } return v.cls + ' = ' + size + (v.lineHeight ? '/' + fmtPx(v.lineHeight) : '') + (v.variant ? ' (at ' + v.variant + ')' : ''); };

export const withPx = (text) => String(text ?? '').replace(/(^|[^\w.])((?:\d+(?:\.\d+)?|\.\d+))rem\b/g, (all, pre, n) => pre + n + 'rem (' + fmtPx(Number(n) * REM_PX) + ')');
