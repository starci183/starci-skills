#!/usr/bin/env node
// draw-taste.mjs — the taste metrics a machine can measure on a drawing (owner r5 ruling 2026-09-27: "correct is not
// beautiful" - too many hairline bands per card, red everywhere, badges on every fact). Thresholds are
// modules/models/runtimes.yaml allocation.drawLoop (accentBudget, bandsPerCardMax, badgesPerEntityMax):
//
//   DRAW_ACCENT_BUDGET   the accent colour fills more than `accentBudget` of the render's area. Measured on the PNG:
//                        a pixel within deltaE ACCENT_TOLERANCE (OKLab x100) of the accent token counts only where
//                        it belongs to a solid ACCENT_BLOCK x ACCENT_BLOCK block of accent (a fill - a button, a meter,
//                        a band - never a text stroke or a hairline), and the brand art band is excluded: the rects
//                        draw-render.mjs records under layout.accentExempt ([data-brand-art], data-grammar-part
//                        artwork-band, a data-grammar-proposal naming Artwork). The accent is the render's own
//                        `--accent` custom property (resolved through var()), else the brand primary;
//   DRAW_TOO_MANY_BANDS  a card (SurfaceCard, SurfaceListCard, SurfaceAccordionCard) splits into more than
//                        `bandsPerCardMax` bands: hairline-separated sections (Divider, <hr>, separator/divider/
//                        hairline classes - bands = separators + 1) or children marked band;
//   DRAW_TOO_MANY_BADGES an entity (a card, a static state row, a list/table row) carries more than
//                        `badgesPerEntityMax` badges (Badge, StateMark, badge/chip/pill classes) of its own.
//
//   starci work draw-taste --html <render.html> [--png <part.png>]... [--json]
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../../lib/is-main.mjs';
import { ancestorsOf } from '../../lib/dom-tree.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { decodePng } from '../png.mjs';
import { parseColor, parseCssCustomProperties } from '../brand/brand.mjs';
import { COMPONENT_ATTR, PART_ATTR, classesOf, elementsOf, parseHtml, visibleElement, walkElements } from './draw-dna.mjs';

export const DRAW_ACCENT_BUDGET = 'DRAW_ACCENT_BUDGET';
export const DRAW_TOO_MANY_BANDS = 'DRAW_TOO_MANY_BANDS';
export const DRAW_TOO_MANY_BADGES = 'DRAW_TOO_MANY_BADGES';
export const DRAW_TASTE_CODES = Object.freeze([DRAW_ACCENT_BUDGET, DRAW_TOO_MANY_BANDS, DRAW_TOO_MANY_BADGES]);
/** How close (OKLab deltaE x100) a pixel is to the accent to count as accent. */
const ACCENT_TOLERANCE = 8;
/** The side of the solid block (device pixels) an accent pixel must belong to: fills count, strokes do not. */
const ACCENT_BLOCK = 5;
/** The selector draw-render.mjs measures as the brand art band (exempt from the accent budget). */
export const ACCENT_EXEMPT_SELECTOR = '[data-brand-art], [data-accent-exempt], [data-grammar-part="artwork-band"], [data-grammar-proposal*="Artwork"], [data-grammar-proposal*="artwork"]';

/** modules/models/runtimes.yaml allocation.drawLoop - the draw loop's and the taste metrics' numbers. Throws when absent. */
export function drawLoopSettings() {
  const s = allocationSettings().drawLoop;
  if (!s || typeof s !== 'object') throw Error('modules/models/runtimes.yaml allocation.drawLoop must declare the draw loop settings');
  for (const k of ['maxRounds', 'stallRounds', 'beautyMin', 'accentBudget', 'bandsPerCardMax', 'badgesPerEntityMax']) {
    if (!Number.isFinite(Number(s[k]))) throw Error(`modules/models/runtimes.yaml allocation.drawLoop.${k} must be a number`);
  }
  return s;
}

const CARDS = new Set(['SurfaceCard', 'SurfaceListCard', 'SurfaceAccordionCard']);
const ENTITY_PARTS = /(^|-)(surface-fact|list-box-item|list-box-row|data-table-row|accordion-row|timeline-item|static-row)$/;
const SEPARATOR_CLASS = /(^|[-_])(separator|divider|hairline|rule)($|[-_])/i;
const BAND_CLASS = /(^|[-_])band($|[-_]|s$)/i;
const BADGE_CLASS = /(^|[-_])(badge|chip|pill|status-pill)($|[-_]{2}|$)/i;
const nameOf = (el) => String(el?.attrs?.[COMPONENT_ATTR] ?? '').trim();
const partOf = (el) => String(el?.attrs?.[PART_ATTR] ?? '').trim();
/** A component root (not one of its own parts that repeats the component attribute). */
const rootOf = (el, names) => names.has(nameOf(el)) && !(partOf(el) && ancestorsOf(el).find((a) => nameOf(a)) && nameOf(ancestorsOf(el).find((a) => nameOf(a))) === nameOf(el));
const isSeparator = (el) => nameOf(el) === 'Divider' || el.tag === 'hr' || /divider/.test(partOf(el)) || classesOf(el).some((c) => SEPARATOR_CLASS.test(c));
const isBandMarked = (el) => /(^|-)band$/.test(partOf(el)) || classesOf(el).some((c) => BAND_CLASS.test(c) && !/(badge|brand)/i.test(c));
const isBadge = (el) => ['Badge', 'StateMark'].includes(nameOf(el)) && !(partOf(el) && nameOf(el.parent ?? {}) === nameOf(el))
  || (!nameOf(el) && classesOf(el).some((c) => BADGE_CLASS.test(c) && !/(dot|icon|label|text)$/i.test(c)));

/** The bands of one card: separators + 1 when it has hairlines, else its children marked band, else 1. */
function bandsOfCard(card) {
  let level = elementsOf(card).filter(visibleElement);
  // Unwrap single content wrappers (surface-content, a lone div) to reach the band level.
  while (level.length === 1 && !isBandMarked(level[0]) && !isSeparator(level[0]) && elementsOf(level[0]).length) level = elementsOf(level[0]).filter(visibleElement);
  const separators = level.filter(isSeparator).length;
  const marked = level.filter(isBandMarked).length;
  return Math.max(separators ? separators + 1 : 0, marked, 1);
}

const isEntity = (el) => rootOf(el, CARDS) || nameOf(el) === 'StaticStateRow' || ENTITY_PARTS.test(partOf(el))
  || ((el.tag === 'li' || el.tag === 'tr') && ancestorsOf(el).some((a) => CARDS.has(nameOf(a)) || nameOf(a) === 'DataTable'));

/** The badges an entity carries itself (a nested entity's badges are its own). */
function badgesOfEntity(entity) {
  let n = 0;
  const visit = (el) => {
    for (const c of elementsOf(el)) {
      if (!visibleElement(c)) continue;
      if (isEntity(c)) continue;
      if (isBadge(c)) { n += 1; continue; }
      visit(c);
    }
  };
  visit(entity);
  return n;
}

const describe = (el) => `<${el.tag}${classesOf(el).length ? `.${classesOf(el).slice(0, 2).join('.')}` : ''}>${nameOf(el) ? ` ${nameOf(el)}` : ''}`;

/** The html taste findings (bands, badges) of one render source: [{code, detail, count, examples}]. */
export function htmlTasteFindings(html, { settings = drawLoopSettings(), label = 'the render' } = {}) {
  const tree = parseHtml(html);
  const all = walkElements(tree).filter(visibleElement);
  const out = [];
  const bandMax = Number(settings.bandsPerCardMax), badgeMax = Number(settings.badgesPerEntityMax);
  const heavy = all.filter((el) => rootOf(el, CARDS)).map((el) => ({ el, bands: bandsOfCard(el) })).filter((c) => c.bands > bandMax);
  if (heavy.length) {
    const ex = heavy.map((c) => `${describe(c.el)} ${c.bands} bands`);
    out.push({ code: DRAW_TOO_MANY_BANDS, count: heavy.length, examples: ex.slice(0, 8), detail: `${label}: ${heavy.length} card(s) split into more than ${bandMax} bands - ${ex.slice(0, 4).join('; ')}: merge bands (identity+status, capabilities, numbers+actions)` });
  }
  const loud = all.filter(isEntity).map((el) => ({ el, badges: badgesOfEntity(el) })).filter((e) => e.badges > badgeMax);
  if (loud.length) {
    const ex = loud.map((e) => `${describe(e.el)} ${e.badges} badges`);
    out.push({ code: DRAW_TOO_MANY_BADGES, count: loud.length, examples: ex.slice(0, 8), detail: `${label}: ${loud.length} entit${loud.length > 1 ? 'ies carry' : 'y carries'} more than ${badgeMax} badges - ${ex.slice(0, 4).join('; ')}: a status is one toned word, facts stay plain text` });
  }
  return out;
}

/** The accent colour a render declares: its `--accent` (var() chains resolved within the same scope), else null. */
export function accentOf(html, { name = '--accent' } = {}) {
  const css = [...String(html).matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const { base } = parseCssCustomProperties(css);
  let value = base.get(name)?.value ?? null;
  for (let hop = 0; value && hop < 8; hop += 1) {
    const ref = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/.exec(value.trim());
    if (!ref) break;
    value = base.get(ref[1])?.value ?? ref[2] ?? null;
  }
  return value ? parseColor(value) : null;
}

/**
 * The accent share of a decoded RGBA image: {share, accentPixels, measuredPixels}. `exempt` rects are in image pixels.
 * A pixel counts only inside a solid `block` x `block` square of accent pixels (a morphological opening).
 */
export function accentShareOf(img, accent, { exempt = [], tolerance = ACCENT_TOLERANCE, block = ACCENT_BLOCK } = {}) {
  const { width: W, height: H, data } = img;
  const mask = new Uint8Array(W * H);
  const cache = new Map();
  const L = accent.oklab;
  for (let y = 0, i = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1, i += 1) {
      const o = i * 4;
      if (data[o + 3] < 128) continue;
      const key = (data[o] << 16) | (data[o + 1] << 8) | data[o + 2];
      let hit = cache.get(key);
      if (hit === undefined) {
        const c = parseColor(`rgb(${data[o]} ${data[o + 1]} ${data[o + 2]})`);
        hit = c ? 100 * Math.hypot(c.oklab.L - L.L, c.oklab.a - L.a, c.oklab.b - L.b) <= tolerance : false;
        cache.set(key, hit);
      }
      if (hit) mask[i] = 1;
    }
  }
  const excluded = new Uint8Array(W * H);
  let excludedCount = 0;
  for (const r of exempt) {
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y)), x1 = Math.min(W, Math.ceil(r.x + r.width)), y1 = Math.min(H, Math.ceil(r.y + r.height));
    for (let y = y0; y < y1; y += 1) for (let x = x0; x < x1; x += 1) { const i = y * W + x; if (!excluded[i]) { excluded[i] = 1; excludedCount += 1; } mask[i] = 0; }
  }
  // Summed-area table of the mask: a block is solid when its sum is block*block.
  const S = new Uint32Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y += 1) {
    let row = 0;
    for (let x = 1; x <= W; x += 1) { row += mask[(y - 1) * W + (x - 1)]; S[y * (W + 1) + x] = S[(y - 1) * (W + 1) + x] + row; }
  }
  const sum = (x0, y0, x1, y1) => S[y1 * (W + 1) + x1] - S[y0 * (W + 1) + x1] - S[y1 * (W + 1) + x0] + S[y0 * (W + 1) + x0];
  const full = block * block;
  // eroded[i] = the block whose top-left is i is solid; a pixel counts when any solid block covers it.
  const eroded = new Uint8Array(W * H);
  for (let y = 0; y + block <= H; y += 1) for (let x = 0; x + block <= W; x += 1) if (sum(x, y, x + block, y + block) === full) eroded[y * W + x] = 1;
  const E = new Uint32Array((W + 1) * (H + 1));
  for (let y = 1; y <= H; y += 1) {
    let row = 0;
    for (let x = 1; x <= W; x += 1) { row += eroded[(y - 1) * W + (x - 1)]; E[y * (W + 1) + x] = E[(y - 1) * (W + 1) + x] + row; }
  }
  const esum = (x0, y0, x1, y1) => E[y1 * (W + 1) + x1] - E[y0 * (W + 1) + x1] - E[y1 * (W + 1) + x0] + E[y0 * (W + 1) + x0];
  let count = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (!mask[y * W + x]) continue;
      if (esum(Math.max(0, x - block + 1), Math.max(0, y - block + 1), x + 1, y + 1) > 0) count += 1;
    }
  }
  const measured = W * H - excludedCount;
  return { share: measured > 0 ? count / measured : 0, accentPixels: count, measuredPixels: measured };
}

/** The accent-exempt rects of a part in image pixels, from its draw-render record (layout.accentExempt, CSS px). */
function exemptRectsOf(record) {
  const dpr = Number(record?.viewport?.deviceScaleFactor ?? 1) || 1;
  return (Array.isArray(record?.layout?.accentExempt) ? record.layout.accentExempt : [])
    .map((r) => ({ x: r.x * dpr, y: r.y * dpr, width: r.width * dpr, height: r.height * dpr }))
    .filter((r) => [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0);
}

/** The draw-render record beside a part PNG (same stem .json, schema starci/draw-render@1), or null. */
function renderRecordOf(png) {
  try {
    const doc = JSON.parse(fs.readFileSync(png.replace(/\.png$/i, '.json'), 'utf8'));
    return doc?.schema === 'starci/draw-render@1' ? doc : null;
  } catch { return null; }
}

/** The accent-budget finding of one part PNG, or null. {finding|null, share, accent} */
export function accentBudgetOf(png, { html = null, accent = null, settings = drawLoopSettings(), label = null } = {}) {
  const colour = accent ?? (html ? accentOf(html) : null);
  if (!colour) return { finding: null, share: null, accent: null, why: 'no --accent in the render source and no brand primary' };
  let img = null;
  try { img = decodePng(fs.readFileSync(png)); } catch { img = null; }
  if (!img?.data) return { finding: null, share: null, accent: colour.hex, why: 'image unreadable' };
  const r = accentShareOf(img, colour, { exempt: exemptRectsOf(renderRecordOf(png)) });
  const budget = Number(settings.accentBudget);
  const finding = r.share > budget ? { code: DRAW_ACCENT_BUDGET, count: 1, examples: [], detail: `${label ?? path.basename(png)}: the accent ${colour.hex} fills ${(r.share * 100).toFixed(1)}% of the render (budget ${(budget * 100).toFixed(0)}%, the brand art band excluded): spend the accent on the one primary action and the meters, keep surfaces neutral` } : null;
  return { finding, share: r.share, accent: colour.hex };
}

async function main(argv) {
  const at = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
  const html = at('--html');
  if (!html) { process.stderr.write('use: starci work draw-taste --html <render.html> [--png <part.png>]... [--json]\n'); return 2; }
  const text = fs.readFileSync(html, 'utf8');
  const findings = htmlTasteFindings(text, { label: path.basename(html) });
  const accents = [];
  argv.forEach((a, i) => { if (a === '--png' && argv[i + 1]) { const r = accentBudgetOf(argv[i + 1], { html: text }); accents.push({ png: argv[i + 1], share: r.share, accent: r.accent }); if (r.finding) findings.push(r.finding); } });
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify({ ok: !findings.length, findings, accents }, null, 2)}\n`);
  else process.stdout.write(`${findings.length ? 'REFUSED' : 'ok'}: ${findings.length} finding(s)\n${findings.map((f) => `  [${f.code}] ${f.detail}`).join('\n')}\n${accents.map((a) => `  accent ${a.accent ?? '-'} ${a.share == null ? 'unmeasured' : `${(a.share * 100).toFixed(1)}%`} ${a.png}`).join('\n')}\n`);
  return findings.length ? 1 : 0;
}

if (isMain(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
