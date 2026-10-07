import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chainText, isPill, normalizeShadowText } from './grammar-geometry-resolve.mjs';

// grammar-geometry-prompt.mjs - the mandatory geometry block a draw brief carries: every resolved value with the declaration
// and var() chain it came from.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export const shortFile = (file, repo) => {
  if (!file) return '?';
  const rel = repo && path.resolve(file).startsWith(path.resolve(repo)) ? path.relative(repo, file) : path.relative(ROOT, file);
  return rel.split(path.sep).join('/');
};
const px = (v) => (v?.px == null ? (v?.value ?? 'unset') : `${Math.round(v.px * 10) / 10}px`);
const filesOf = (v, repo) => [...new Set([v.file, ...(v.trace ?? []).map((t) => t.file)].filter(Boolean).map((f) => shortFile(f, repo)))].join('; ');
const declared = (v, repo) => (v ? `\`${v.declared}\`${chainText(v)} (${filesOf(v, repo)})` : 'undeclared');
const isCardToken = (t) => /radius|shadow|surface/.test(t.name);
const noBorder = (v) => v == null || v.px === 0 || v.value === '0' || /^none$/i.test(String(v.value));

function byWidth(g, getter, fmt = px) {
  const values = g.at.map((w) => ({ width: w.width, text: fmt(getter(w)) }));
  if (values.every((v) => v.text === values[0].text)) return values[0].text;
  return values.map((v) => `${v.text} at ${v.width}px`).join(', ');
}

/** The title, the cascade sources and the Button section. */
function headerLines(g, repo) {
  const a = g.at[0];
  const b = a.button;
  const lines = [];
  lines.push(`GEOMETRY - mandatory, resolved from the product CSS (family ${g.family}, widths ${g.widths.join(' and ')}px). Draw these values; never a token the CSS does not bind.`,
    `Cascade: ${g.sources.entry ? shortFile(g.sources.entry, repo) + ' and its imports' : 'installed packages'} - ${[...(g.sources.heroui?.files ?? []), g.sources.grammar.common, g.sources.familyFile].filter(Boolean).map((f) => shortFile(f, repo)).join('; ')} (@heroui/styles ${g.sources.heroui?.version}, @starci/grammar ${g.sources.grammar.version}${g.sources.grammar.installed ? '' : ' source'}).`,
    '',
    'Button (HeroUI .button, Grammar Button)',
    `- radius ${byWidth(g, (w) => w.button['border-radius'])} = ${declared(b['border-radius'], repo)}${isPill(b['border-radius']?.px, b.heightPx) ? ' - a pill (radius >= height/2)' : ''}.`,
    `- height ${byWidth(g, (w) => ({ px: w.button.heightPx }))} (${declared(b.height, repo)}); full width (width="fill"): height auto, min-height ${px(b.fill['min-height'])} (${declared(b.fill['min-height'], repo)}).`,
    `- padding-inline ${byWidth(g, (w) => w.button['padding-left'])}; font ${px(b['font-size'])} / weight ${b['font-weight']?.value ?? 'unset'}.`);
  return lines;
}

/** The primary, secondary and outline Button variants. */
function variantLines(g, repo) {
  const a = g.at[0];
  const b = a.button;
  const lines = [];
  for (const v of ['primary', 'secondary', 'outline']) {
    const s = b.variants[v];
    const border = noBorder(s['border-top-width']) ? ', no border' : `, border ${px(s['border-top-width'])} ${s['border-top-style']?.value ?? 'solid'} ${s['border-top-color']?.value ?? ''} (${s['border-top-color']?.declared ?? ''}${chainText(s['border-top-color'])})`;
    lines.push(`- ${v}: fill ${s['background-color']?.value ?? 'unset'} (${s['background-color']?.declared ?? ''}${chainText(s['background-color'])}), text ${s.color?.value ?? 'unset'}${border}.`);
  }
  return lines;
}

/** The Input section. */
function inputLines(g, repo) {
  const a = g.at[0];
  const inp = a.input;
  const lines = [];
  lines.push('',
    'Input (HeroUI .input, Grammar Input)',
    `- radius ${byWidth(g, (w) => w.input.primary['border-radius'])} = ${declared(inp.primary['border-radius'], repo)}.`,
    `- border ${noBorder(inp.primary['border-top-width']) ? 'none' : px(inp.primary['border-top-width'])}: ${declared(inp.primary['border-top-width'], repo)}.`,
    `- height ${byWidth(g, (w) => ({ px: w.input.primary.heightPx }))}; padding ${px(inp.primary['padding-top'])} ${px(inp.primary['padding-left'])}; font ${byWidth(g, (w) => w.input.primary['font-size'])}.`,
    `- inside a surface (card, panel, band) the field is the \`secondary\` variant: fill ${inp.secondary['background-color']?.value} (${inp.secondary['background-color']?.declared}${chainText(inp.secondary['background-color'])}), shadow ${normalizeShadowText(inp.secondary['box-shadow']?.value)} - knowledge/ui/proof/anatomy-source.yaml ANATOMY-2 case-1. Its low fill contrast is accepted (owner ruling, knowledge/ui/proof/contrast.yaml COLOR-3 case-6).`,
    `- on the page canvas the \`primary\` variant: fill ${inp.primary['background-color']?.value} (${inp.primary['background-color']?.declared}${chainText(inp.primary['background-color'])}), shadow ${normalizeShadowText(inp.primary['box-shadow']?.value)}.`);
  return lines;
}

/** The Card section. */
function cardLines(g, repo) {
  const a = g.at[0];
  const c = a.card;
  const lines = [];
  lines.push('',
    'Card / SurfaceCard (Grammar SurfaceCard, SurfaceListCard)',
    `- radius ${byWidth(g, (w) => w.card.top['border-radius'])} = ${declared(c.top['border-radius'], repo)}, painted by the ${c.top.part}${c.labelled.part !== c.top.part ? '; a labelled card paints its ' + c.labelled.part + ': radius ' + px(c.labelled['border-radius']) : ''}.`,
    `- border ${noBorder(c.top['border-top-width']) ? 'none' : px(c.top['border-top-width'])} (${declared(c.top['border-top-width'], repo)}); shadow ${normalizeShadowText(c.top['box-shadow']?.value)} (${c.top['box-shadow']?.declared}${chainText(c.top['box-shadow'])}); fill ${c.top['background-color']?.value}.`,
    `- a surface nested inside another: border ${px(c.nested['border-top-width'])} ${c.nested['border-top-style']?.value ?? ''} ${c.nested['border-top-color']?.value ?? ''}, shadow ${normalizeShadowText(c.nested['box-shadow']?.value)}.`,
    `- content inset ${px(c.content['padding-top'])} (${declared(c.content['padding-top'], repo)}); joined bands: card inset ${px(c.joined['padding-top'])}, gap ${px(c.joined['row-gap'])}; external label to card ${px(c.labelGap)}.`);
  return lines;
}

/** The family tokens that style a card, which the card section names when no var() or source file reads them. */
function cardTokenLines(g) {
  const c = g.at[0].card;
  const lines = [];
  const cardTokens = g.unbound.filter(isCardToken);
  for (const t of cardTokens) lines.push(`- ${t.name}: ${t.value} is declared by the family and read by no var() and no source file - it does not render; the card draws ${px(c.top['border-radius'])} (owner ruling: follow the CSS).`);
  return lines;
}

/** The Badge section and the Font heading. */
function badgeLines(g, repo) {
  const a = g.at[0];
  const bd = a.badge;
  const lines = [];
  lines.push('',
    'Badge (Grammar Badge = HeroUI Chip, size sm, soft)',
    `- radius ${px(bd['border-radius'])} = ${declared(bd['border-radius'], repo)}, height ${bd.heightPx}px${isPill(bd['border-radius']?.px, bd.heightPx) ? ' - a pill' : ''}; padding ${px(bd['padding-top'])} ${px(bd['padding-left'])}; font ${px(bd['font-size'])} / ${bd['font-weight']?.value}; fill ${bd['background-color']?.value}.`,
    '',
    'Font',
    `- the family root binds font-family ${declared(g.font.binding, repo)} = ${g.font.binding?.value}.`);
  return lines;
}

/** The family font tokens and surfaces, then the tokens nothing reads that the card section did not name. */
function fontTailLines(g, repo) {
  const lines = [];
  for (const t of g.font.tokens) lines.push(`- family token ${t.name}: ${t.resolved ?? t.value}.`);
  for (const s of g.font.surfaces) lines.push(`- ${s.selector} (${shortFile(s.file, repo)}) binds ${s.value}.`);
  const others = g.unbound.filter((t) => !isCardToken(t));
  if (others.length) lines.push('', `Declared by the family, read by no var() and no source file (they do not render): ${others.map((t) => String(t.name) + ' ' + String(t.value)).join('; ')}.`);
  return lines;
}

/** The mandatory geometry block a draw brief carries. */
export function geometryPrompt(g) {
  const repo = g.sources.repo;
  const lines = [...headerLines(g, repo), ...variantLines(g, repo), ...inputLines(g, repo), ...cardLines(g, repo), ...cardTokenLines(g), ...badgeLines(g, repo), ...fontTailLines(g, repo)];
  return `${lines.join('\n')}\n`;
}
