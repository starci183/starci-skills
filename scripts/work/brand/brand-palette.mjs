#!/usr/bin/env node
// brand-palette.mjs — a drawn part, a composite or a capture is painted in the brand's colours and no other hue.
//
//   starci work brand-palette --prompt <work-root>            the colour block every draw prompt carries
//   starci work brand-palette --check <png> --brand <work-root> [--json]
//   starci work brand-palette --scan <work-root> [--json]     every part, composite and capture, read-only
//
// Owner, 2026-09-24 ("why is it red one time and green the next??"): one product drawing painted its primary button, links and selection in
// the image model's default blue while the brand has ONE accent, Unicorn red. scripts/work/ui/render.mjs already read
// pixels against the brand (`palette-off-brand`, `primary-absent`), but only the example render proof ran it, so
// nothing on the draw, brand or implement path ever looked at a colour. This module is the drawn-image form of those
// two rules, run by scripts/work/ui/shell-conformance.mjs for every part and composite a ui record declares, every
// layout capture of the shell record and every running-page capture of an implementation record.
//
// An image model does not paint tokens: it paints a red that is a few steps off the token, antialiases it into
// pinks over white, and shades a status green darker than the success token. The exact-match rule of render.mjs
// (every dominant bucket within deltaE 6 of a token) fails every such drawing, so a pixel here is judged by hue:
//   ink        L under 0.30 or OKLCH chroma under 0.08 - text, hairlines, greys, slate-tinted muted copy and
//              near-black navies. Never judged.
//   token      within deltaE 6 (OKLab x100) of a colour the brand declares (tokens, scales, dark answers).
//   family     a tint or shade of one chromatic token: hue within 18 degrees and no more saturated than the token
//              (+0.012). A status token (success, warning, info - not the primary's colour) drawn at its own
//              strength may drift up to 30 degrees: lightness within 0.12 of the token and no more saturated, so a
//              mint success dot drawn green or an amber warning icon drawn orange passes, while a darker blue
//              text 19 degrees off an info token does not. Mixing a colour with white, black or a grey keeps its hue and lowers its chroma, so this
//              is what an antialiased edge, a soft fill or a darker status text is made of.
//   coherence  a colour counts only where it fills a 2x2 block of one class, so a browser's subpixel text fringes
//              and the antialiased rim of the keyed #FF00FF slot are never a palette.
//   slot       the #FF00FF page slot a capture or a layout drawing measures is skipped whole, with its one-pixel
//              rim (slotExclusion), so the noise an image model leaves inside its own slot is not a colour.
//   off-brand  anything else. Offenders are grouped by hue name (blue, purple, orange, ...); a group is refused
//              when it covers at least 3% of the coloured pixels and 0.005% of the image (60 pixels at the least):
//              one blue text link on an otherwise neutral part is refused, a speck of model noise is not. Under
//              3% a group is refused from 150 pixels when it is strong (chroma 0.12 and up) and the brand owns no
//              colour within 30 degrees of its hue at that strength: a blue back link on a red page is still a
//              blue link, a slightly orange warning icon is not a second palette.
// The status colours the brand declares (success, warning, info, danger) are tokens like any other, so a green
// status dot passes where the brand declares a green. A blue declared only as `info` does not license a blue
// primary: a primary-strength blue is more saturated than a lighter info token and lands off-brand.
//
// Registered artwork: a raster master the brand registers in brand.artworkSlots (an Academy illustration, the
// mascot, a logo) is the brand's own bytes, not a palette. Where a token-rendered drawing embeds one as an <img>,
// draw-render.mjs measures that element's painted box and the sha256 of the bytes it shows (record
// layout.artwork); the box of an image whose bytes are a registered master (the slot's declared sha256 or its
// master file's) is skipped whole, as the keyed slot is - for a composite, mapped through its recorded rect and
// fit. Only those pixels: no colour allowlist is derived from the artwork, an unregistered or altered image is
// judged like any other paint, and the master checked on its own still reads its own colours.
//
// PRIMARY_ABSENT: the brand primary (and every token of the same colour) appears nowhere while an off-brand hue
// does - the off-brand colour stands in for the primary action. A part with only neutrals and status colours
// draws no primary action and is not judged for one.
import fs from 'node:fs';
import { capturesOf } from '../impl-captures.mjs';
import path from 'node:path';
import { isMain } from '../../lib/is-main.mjs';
import { deltaEOk, oklabToOklch, oklabToRgb, formatHex, readBrandRecord, rgbToOklab } from './brand.mjs';
import { brandColours } from '../ui/render.mjs';
import { hueName } from './brand-hue.mjs';
import { decodePng, keyRect } from '../png.mjs';
import { sha256File } from '../../../engine/digest.mjs';
import { isPartName } from '../direction-part.mjs';
import { appNamesOf, captureFileOf, capturesAt, matrixOf, nodesOf, treeOf } from '../layout-tree.mjs';
import { assetsOf, indexFilesUnder, list, readYamlOrNull, slash } from '../work-io.mjs';

const PALETTE_CODES = { offBrand: 'PALETTE_OFF_BRAND', primaryAbsent: 'PRIMARY_ABSENT', unavailable: 'BRAND_PALETTE_UNAVAILABLE', unreadable: 'PALETTE_IMAGE_UNREADABLE' };
export const TOKEN_TOLERANCE = 6;
const HUE_TOLERANCE = 18;
const CHROMA_SLACK = 0.012;
const VIVID_CHROMA = 0.08;
const INK_LIGHTNESS = 0.3;
export const MAX_LIGHTNESS = 0.97;
const MIN_GROUP_SHARE = 0.03;
const MIN_AREA_SHARE = 0.00005;
const MIN_PIXELS = 60;
const STATUS_HUE_TOLERANCE = 30;
const STATUS_LIGHTNESS_BAND = 0.12;
const STRONG_CHROMA = 0.12;
const STRONG_PIXELS = 150;
const CHROMATIC_TOKEN = 0.04;
const SAMPLE_BUDGET = 4000000;
const ALPHA_FLOOR = 128;
const STATUS_ROLES = new Set(['success', 'warning', 'info', 'danger']);

const round = (v, places = 4) => Number.parseFloat(Number(v).toFixed(places));
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/**
 * The brand's palette as the checks read it: every declared colour (tokens with their roles, scale steps, the
 * dark answers), the chromatic ones marked, the primary picked out, and which tokens carry the primary's colour
 * (a product whose danger and focus are its accent counts them as the primary too).
 */
export function brandPalette(brand, { brandDir = null } = {}) {
  const entries = brandColours(brand).map((entry) => ({ ...entry, oklch: entry.color.oklch, chromatic: entry.color.oklch.C >= CHROMATIC_TOKEN }));
  const primary = entries.find((e) => e.role === 'primary' && e.scope === 'base') ?? entries.find((e) => e.role === 'primary') ?? null;
  for (const e of entries) e.isPrimary = Boolean(primary && deltaEOk(e.color, primary.color) <= TOKEN_TOLERANCE);
  return { entries, primary, chromatic: entries.filter((e) => e.chromatic), artwork: registeredArtwork(brand, brandDir) };
}

/**
 * The raster masters the brand registers (brand.artworkSlots): Map(sha256 -> slot id), from each slot's declared
 * sha256 and the bytes of its `master` file (relative to the brand record's directory).
 */
export function registeredArtwork(brand, brandDir = null) {
  const out = new Map();
  for (const slot of list(brand?.artworkSlots)) {
    if (!slot || typeof slot !== 'object') continue;
    const id = String(slot.id ?? slot.master ?? 'artwork');
    if (typeof slot.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(slot.sha256)) out.set(slot.sha256.toLowerCase(), id);
    if (brandDir && typeof slot.master === 'string') { try { out.set(sha256File(path.resolve(brandDir, slot.master)), id); } catch { /* the declared digest stands alone */ } }
  }
  return out;
}

const shaOf = (file) => { try { return sha256File(file); } catch { return null; } };
const RENDER_SCHEMA = 'starci/draw-render@1';

/** The draw-render capture record of an image: the same-stem .json, else any record in its directory whose image sha256 is the file's. */
function renderRecordFor(file) {
  const sha = shaOf(file);
  if (!sha) return null;
  const read = (f) => { try { const d = JSON.parse(fs.readFileSync(f, 'utf8')); return d?.schema === RENDER_SCHEMA && d.image?.sha256 === sha ? d : null; } catch { return null; } };
  const own = read(file.replace(/\.png$/i, '.json'));
  if (own) return own;
  let names = [];
  try { names = fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.json')); } catch { return null; }
  for (const n of names) { const d = read(path.join(path.dirname(file), n)); if (d) return d; }
  return null;
}

const pngSize = (file) => {
  try {
    const b = fs.readFileSync(file);
    return b.length > 24 && b.toString('ascii', 12, 16) === 'IHDR' ? { width: b.readUInt32BE(16), height: b.readUInt32BE(20) } : null;
  } catch { return null; }
};

/** The registered-artwork boxes of one capture record, in the capture's image pixels (grown by one pixel for the antialiased edge). */
function artworkRectsOf(record, palette) {
  if (!palette?.artwork?.size || !Array.isArray(record?.layout?.artwork)) return [];
  const dpr = Number(record?.viewport?.deviceScaleFactor ?? 1) || 1;
  return record.layout.artwork
    .filter((a) => typeof a?.sha256 === 'string' && palette.artwork.has(a.sha256.toLowerCase()))
    .map((a) => {
      const x = Math.floor(a.x * dpr) - 1, y = Math.floor(a.y * dpr) - 1;
      return { x, y, width: Math.ceil((a.x + a.width) * dpr) + 1 - x, height: Math.ceil((a.y + a.height) * dpr) + 1 - y, slot: palette.artwork.get(a.sha256.toLowerCase()) };
    })
    .filter((r) => [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0);
}

/** A content-image rectangle placed into a composite (compose-direction.mjs fitInto: cover centre-crops, stretch scales), clipped to the placed rect. */
export function mapIntoComposite(r, content, rect, fit = 'cover') {
  let sx, sy, ox = 0, oy = 0;
  if (fit === 'stretch') { sx = rect.width / content.width; sy = rect.height / content.height; }
  else {
    const scale = Math.max(rect.width / content.width, rect.height / content.height);
    const w = Math.max(rect.width, Math.ceil(content.width * scale)), h = Math.max(rect.height, Math.ceil(content.height * scale));
    sx = w / content.width; sy = h / content.height; ox = Math.floor((w - rect.width) / 2); oy = Math.floor((h - rect.height) / 2);
  }
  const x0 = Math.max(rect.x, Math.floor(rect.x + r.x * sx - ox)), y0 = Math.max(rect.y, Math.floor(rect.y + r.y * sy - oy));
  const x1 = Math.min(rect.x + rect.width, Math.ceil(rect.x + (r.x + r.width) * sx - ox)), y1 = Math.min(rect.y + rect.height, Math.ceil(rect.y + (r.y + r.height) * sy - oy));
  return x1 > x0 && y1 > y0 ? { x: x0, y: y0, width: x1 - x0, height: y1 - y0, slot: r.slot } : null;
}

/**
 * The boxes of `file` that show a registered brand artwork master: from its own draw-render record (`record`, or
 * the one beside it), or, for a composite (`composite` block of a ui asset, `uiDir` its record directory), from
 * its content part's record mapped through the composite's rect and fit.
 */
export function artworkExclusions({ file, palette, record = undefined, composite = null, uiDir = null }) {
  if (!palette?.artwork?.size) return [];
  const own = artworkRectsOf(record === undefined ? renderRecordFor(file) : record, palette);
  if (own.length || !composite?.content?.path || !composite.rect || !uiDir) return own;
  const contentFile = path.join(uiDir, composite.content.path);
  if (composite.content.sha256 && shaOf(contentFile) !== composite.content.sha256) return own;
  const size = pngSize(contentFile);
  if (!size) return own;
  return artworkRectsOf(renderRecordFor(contentFile), palette).map((r) => mapIntoComposite(r, size, composite.rect, composite.fit ?? 'cover')).filter(Boolean);
}

/** The colour block a draw prompt carries: every chromatic token by role with its hex, and the refusal rule. */
export function promptPaletteBlock(brand, { name = null } = {}) {
  const { entries, primary } = brandPalette(brand);
  const seen = new Set();
  const lines = [];
  for (const e of entries.filter((x) => x.scope === 'base' && (x.chromatic || ['surface', 'canvas', 'foreground'].includes(x.role)))) {
    const key = `${e.role ?? 'other'} ${e.hex}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`- ${e.role ?? 'other'}: ${e.label} ${e.hex}${e.isPrimary && e.role !== 'primary' ? ' (the primary colour)' : ''}`);
  }
  const label = name ? ` (${name})` : '';
  const head = `Brand colours${label} - use exactly these; every other saturated hue is refused (PALETTE_OFF_BRAND):`;
  const rule = primary
    ? `Primary buttons, links, selected rows, focus rings, active tabs and every call to action are ${primary.hex} (${primary.label}). Never a default blue or any colour not listed; status colours only for their status.`
    : 'The brand declares no primary colour: use only the listed colours.';
  return [head, ...lines, rule].join('\n');
}

/** The image as {width, height, data RGBA}; `png.mjs` reads every bit depth and colour type a model returns. */
export function readImage(file) {
  return decodePng(fs.readFileSync(file));
}

/** The palette entry a colour matches within the token tolerance: {e, d} or null. */
function nearestPaletteEntry(palette, colour) {
  let best = null;
  for (const e of palette.entries) {
    const d = deltaEOk(colour, e.color);
    if (d <= TOKEN_TOLERANCE && (!best || d < best.d)) best = { e, d };
  }
  return best;
}

/** The chromatic entry whose hue family a colour falls in: {e, d, family: true} or null. */
function paletteFamilyEntry(palette, L, C, h) {
  let best = null;
  for (const e of palette.chromatic) {
    const gap = hueGap(h, e.oklch.h);
    if (C > e.oklch.C + CHROMA_SLACK || (best && gap >= best.d)) continue;
    const status = STATUS_ROLES.has(e.role) && !e.isPrimary;
    if (gap <= HUE_TOLERANCE || (status && gap <= STATUS_HUE_TOLERANCE && Math.abs(L - e.oklch.L) <= STATUS_LIGHTNESS_BAND)) best = { e, d: gap, family: true };
  }
  return best;
}

/** One sRGB colour judged against a palette: {kind: 'ink'} | {kind: 'brand', entry, family} | {kind: 'off', name, oklab}. */
function paletteVerdictOf(palette, r, g, b) {
  const oklab = rgbToOklab([r, g, b]);
  const { L, C, h } = oklabToOklch(oklab);
  if (L < INK_LIGHTNESS || L > MAX_LIGHTNESS || C < VIVID_CHROMA) return { kind: 'ink' };
  const best = nearestPaletteEntry(palette, { oklab }) ?? paletteFamilyEntry(palette, L, C, h);
  return best ? { kind: 'brand', entry: best.e, family: Boolean(best.family) } : { kind: 'off', name: hueName(h), oklab };
}

/**
 * Judge one decoded image against one brand palette. Returns {offenders, primary, counts} - no findings yet, so
 * the CLI, the specs and shell-conformance read the same measurement. `exclude` is a rectangle no pixel of
 * which belongs to the palette (the page slot a capture or a drawing keys with #FF00FF), or a list of them (with
 * the boxes of registered brand artwork, artworkExclusions).
 */
export function measurePalette(image, palette, { exclude = null } = {}) {
  const { width, height, data } = image;
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / SAMPLE_BUDGET)));
  const cache = new Map();
  const rects = (Array.isArray(exclude) ? exclude : [exclude]).filter(Boolean);
  const excluded = (x, y) => rects.some((r) => x >= r.x && y >= r.y && x < r.x + r.width && y < r.y + r.height);
  const classify = (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    if (cache.has(key)) return cache.get(key);
    const verdict = paletteVerdictOf(palette, r, g, b);
    cache.set(key, verdict);
    return verdict;
  };
  const classAt = (x, y) => {
    if (excluded(x, y)) return 'ink';
    const at = (y * width + x) * 4;
    if (data[at + 3] < ALPHA_FLOOR) return 'ink';
    const v = classify(data[at], data[at + 1], data[at + 2]);
    if (v.kind === 'ink') return 'ink';
    if (v.kind === 'brand') return 'brand';
    return v.name;
  };
  const coherent = (x, y, v) => {
    const own = v.kind === 'brand' ? 'brand' : v.name;
    const nx = x + 1 < width ? x + 1 : x - 1, ny = y + 1 < height ? y + 1 : y - 1;
    if (nx < 0 || ny < 0) return true;
    return classAt(nx, y) === own && classAt(x, ny) === own && classAt(nx, ny) === own;
  };
  const { groups, tokens, opaque, vivid, primaryPixels, statusPixels } = collectPaletteSamples({ image, step, excluded, classify, coherent });
  const offenders = [...groups.values()].map((g) => {
    const oklab = { L: g.L / g.count, a: g.a / g.count, b: g.b / g.count };
    const hex = formatHex(oklabToRgb(oklab).rgb);
    const chromaticNearest = palette.chromatic.length ? palette.chromatic : palette.entries;
    const near = chromaticNearest.reduce((best, e) => { const d = deltaEOk({ oklab }, e.color); return !best || d < best.d ? { e, d } : best; }, null);
    return {
      name: g.name, hex, pixels: g.count, chroma: round(Math.hypot(oklab.a, oklab.b)), hue: round(oklabToOklch(oklab).h, 1),
      share: vivid ? round(g.count / vivid) : 0,
      area: opaque ? round(g.count / opaque) : 0,
      nearest: near ? { token: near.e.label, hex: near.e.hex, role: near.e.role ?? null, deltaE: round(near.d, 1) } : null,
    };
  }).sort((a, b) => b.pixels - a.pixels);
  // A small group is still refused when the brand owns no colour of that hue at that strength: a thin
  // primary-strength blue link beside a lighter info token, a purple icon in a brand without purple.
  const unowned = (o) => !palette.chromatic.some((e) => hueGap(o.hue, e.oklch.h) <= STATUS_HUE_TOLERANCE && e.oklch.C + CHROMA_SLACK >= o.chroma);
  const refused = offenders.filter((o) => o.area >= MIN_AREA_SHARE && (o.share >= MIN_GROUP_SHARE
    ? o.pixels * step * step >= MIN_PIXELS
    : o.chroma >= STRONG_CHROMA && o.pixels * step * step >= STRONG_PIXELS && unowned(o)));
  return {
    width, height, sampleStep: step, opaque, vivid,
    offenders, refused,
    primary: palette.primary ? { token: palette.primary.label, hex: palette.primary.hex, pixels: primaryPixels, share: vivid ? round(primaryPixels / vivid) : 0, present: primaryPixels > 0 && primaryPixels >= Math.min(40, opaque * 0.0002) } : null,
    statusPixels,
    tokens: Object.fromEntries([...tokens.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)),
  };
}
function collectPaletteSamples({ image, step, excluded, classify, coherent }) {
  const { width, height } = image;
  const samples = { groups: new Map(), tokens: new Map(), opaque: 0, vivid: 0, primaryPixels: 0, statusPixels: 0 };
  const judge = { excluded, classify, coherent };
  for (let y = 0; y < height; y += step) for (let x = 0; x < width; x += step) recordPaletteSample(samples, image, x, y, judge);
  return samples;
}
function recordPaletteSample(samples, { data, width }, x, y, { excluded, classify, coherent }) {
  if (excluded(x, y)) return;
  const at = (y * width + x) * 4;
  if (data[at + 3] < ALPHA_FLOOR) return;
  const r = data[at], g = data[at + 1], b = data[at + 2];
  if (r >= 247 && g <= 8 && b >= 247) return;
  samples.opaque += 1;
  const verdict = classify(r, g, b);
  if (verdict.kind === 'ink' || !coherent(x, y, verdict)) return;
  samples.vivid += 1;
  if (verdict.kind === 'brand') {
    samples.tokens.set(verdict.entry.label, (samples.tokens.get(verdict.entry.label) ?? 0) + 1);
    if (verdict.entry.isPrimary) samples.primaryPixels += 1;
    else if (STATUS_ROLES.has(verdict.entry.role)) samples.statusPixels += 1;
    return;
  }
  const group = samples.groups.get(verdict.name) ?? { name: verdict.name, count: 0, L: 0, a: 0, b: 0 };
  group.count += 1; group.L += verdict.oklab.L; group.a += verdict.oklab.a; group.b += verdict.oklab.b;
  samples.groups.set(verdict.name, group);
}
/**
 * The keyed #FF00FF page slot an image carries, as the rectangle `measurePalette` must skip: the measured
 * bounding rectangle of its key pixels grown by `grow`, so the one-pixel rim an image model blends around the
 * slot and the noise it leaves inside it are skipped with it. Null when the image carries no solid slot (a
 * drawn part, a composite whose content already filled the slot).
 */
function slotExclusion(image, { key = [255, 0, 255], tolerance = 8, minFill = 0.9, grow = 2 } = {}) {
  const found = keyRect(image, key, tolerance);
  if (!found || found.fill < minFill) return null;
  const { x, y, width, height } = found.rect;
  return { x: x - grow, y: y - grow, width: width + grow * 2, height: height + grow * 2 };
}

/** `measurePalette` over an image with its keyed page slot (and any registered-artwork boxes) excluded: what the gate measures, findings or scan. */
const measureImage = (image, palette, artwork = []) => measurePalette(image, palette, { exclude: [slotExclusion(image), ...artwork].filter(Boolean) });

const pct = (v) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1).replace(/\.0$/, '')}%`;

/** One offender, as the finding names it: colour, hue, area share and the nearest brand token. */
const describeOffender = (o) => {
  let nearest = '(none)';
  if (o.nearest) {
    const role = o.nearest.role ? ` (${o.nearest.role})` : '';
    nearest = `${o.nearest.token} ${o.nearest.hex}${role} at deltaE ${o.nearest.deltaE}`;
  }
  return `${o.name} ${o.hex} on ${pct(o.share)} of the coloured area (${pct(o.area)} of the image), nearest brand token ${nearest}`;
};

/**
 * shell-conformance findings for one image. `subject` says what the image is (a drawn part, a composite, a layout
 * capture, a running-page capture) so the refusal tells the worker what to redraw or re-capture.
 */
export function paletteFindings({ file, shownAs, brand, palette = null, subject = 'image', at, level = 'refuse', record = undefined, composite = null, uiDir = null }) {
  const finding = (lvl, code, message) => ({ level: lvl, code, file: at, message });
  if (!brand) return [];
  const pal = palette ?? brandPalette(brand);
  if (!pal.chromatic.length) return [finding('info', PALETTE_CODES.unavailable, `${shownAs}: the brand record declares no chromatic colour this runtime can parse, so the ${subject}'s palette was compared against nothing`)];
  let image;
  try { image = readImage(file); } catch (error) { return [finding('suspect', PALETTE_CODES.unreadable, `${shownAs}: the ${subject} does not decode (${error.message}), so its colours were not read`)]; }
  const m = measureImage(image, pal, artworkExclusions({ file, palette: pal, record, composite, uiDir }));
  const out = [];
  if (m.refused.length) {
    const primary = pal.primary ? ` The brand's primary is ${pal.primary.label} ${pal.primary.hex}: redraw every button, link, selection and accent in it.` : '';
    const colours = m.refused.length === 1 ? 'a colour' : `${m.refused.length} colours`;
    out.push(finding(level, PALETTE_CODES.offBrand, `${shownAs}: the ${subject} is painted in ${colours} the brand does not declare - ${m.refused.map(describeOffender).join('; ')}.${primary}`));
  }
  if (pal.primary?.color.oklch.C >= CHROMATIC_TOKEN && !m.primary.present && m.refused.length) {
    out.push(finding(level, PALETTE_CODES.primaryAbsent, `${shownAs}: the brand primary ${pal.primary.label} ${pal.primary.hex} appears nowhere in the ${subject}, while ${m.refused[0].name} ${m.refused[0].hex} covers ${pct(m.refused[0].share)} of its coloured area - the off-brand colour stands in for the primary action`));
  }
  return out;
}

/** The brand of a Work tree, or null with the reason (a tree drawn before its brand record has nothing to check). */
export function brandOf(workRoot) {
  try { const b = readBrandRecord(workRoot); return { brand: b.brand, file: b.file, dir: b.dir, rev: b.rev }; } catch (error) { return { brand: null, error: error.message }; }
}

// ---------------------------------------------------------------------------------------------------------
// Read-only scan of a whole Work tree: every ui record's parts and composites, every layout capture, every
// implementation capture. What the supervisor ran over the product repositories on 2026-09-24.
// ---------------------------------------------------------------------------------------------------------

const walkFiles = (dir, keep, skip = new Set(['node_modules', 'kernel-evidence', 'kernel-strays', 'runs', '_derived'])) => {
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return skip.has(e.name) ? [] : walkFiles(full, keep, skip);
    return keep(full) ? [full] : [];
  });
};

/** Every image the gate judges under `workRoot`, with what it is and the record that owns it. */
export async function scanTargets(workRoot) {
  const targets = [];
  for (const index of indexFilesUnder(path.join(workRoot, 'features'))) appendRecordTargets(index, targets);
  appendShellTargets(workRoot, targets);
  return targets;
}
function appendRecordTargets(index, targets) {
  const record = readYamlOrNull(index);
  const dir = path.dirname(index);
  if (record?.schema === 'work/ui-screen@1') appendUiTargets(index, dir, record, targets);
  else if (record?.schema === 'work/implementation@1') appendImplementationTargets(index, dir, record, targets);
}
function appendUiTargets(index, dir, record, targets) {
  const seen = new Set();
  for (const asset of assetsOf(record)) {
    let kind = null;
    if (asset.composite) kind = 'composite';
    else if (asset.role === 'direction-content' || isPartName(asset.path)) kind = 'part';
    if (!kind || seen.has(asset.path)) continue;
    seen.add(asset.path);
    targets.push({ record: record.id, recordFile: index, kind, file: path.join(dir, asset.path), declared: true, ...(asset.composite ? { composite: asset.composite, uiDir: dir } : {}) });
  }
  for (const file of walkFiles(path.join(dir, 'assets'), isPartName)) {
    const rel = slash(path.relative(dir, file));
    if (!seen.has(rel)) { seen.add(rel); targets.push({ record: record.id, recordFile: index, kind: 'part', file, declared: false }); }
  }
}
function appendImplementationTargets(index, dir, record, targets) {
  for (const capture of capturesOf(dir, record)) if (capture.png) targets.push({ record: record.id, recordFile: index, kind: 'implementation capture', file: capture.png, declared: true });
}
function appendShellTargets(workRoot, targets) {
  const shellFile = path.join(workRoot, 'shell', 'index.yaml');
  const shell = readYamlOrNull(shellFile);
  if (shell?.schema === 'work/layout-tree@1') {
    const { breakpoints, themes } = matrixOf(shell);
    const seen = new Set();
    for (const node of appNamesOf(shell).flatMap((name) => nodesOf(treeOf(shell, name)))) for (const bp of breakpoints) for (const th of themes) for (const capture of capturesAt(shell, node, bp, th)) {
      addShellCapture(workRoot, shellFile, node, capture, seen, targets);
    }
  }
}
function addShellCapture(workRoot, shellFile, node, capture, seen, targets) {
  if (seen.has(capture.rel)) return;
  seen.add(capture.rel);
  targets.push({ record: 'shell ' + node.id + (capture.destination ? ' (' + capture.destination + ')' : ''), recordFile: shellFile, kind: 'layout capture', file: captureFileOf(path.join(workRoot, 'shell'), capture), declared: true });
}
async function scanWork(workRoot) {
  const b = brandOf(workRoot);
  if (!b.brand) return { workRoot: slash(workRoot), brand: null, error: b.error, results: [] };
  const palette = brandPalette(b.brand, { brandDir: b.dir });
  const results = [];
  for (const target of await scanTargets(workRoot)) results.push(scanTarget(workRoot, b.brand, palette, target));
  return { workRoot: slash(workRoot), brand: { file: slash(b.file), rev: b.rev, primary: palette.primary ? { token: palette.primary.label, hex: palette.primary.hex } : null }, results };
}
function scanTarget(workRoot, brand, palette, target) {
  const { composite = null, uiDir = null, ...record } = target;
  if (!fs.existsSync(record.file)) return { ...record, file: slash(path.relative(workRoot, record.file)), missing: true, findings: [] };
  const shownAs = slash(path.relative(workRoot, record.file));
  const findings = paletteFindings({ file: record.file, shownAs, brand, palette, subject: record.kind, at: slash(path.relative(workRoot, record.recordFile)), composite, uiDir });
  let measure = null;
  try { measure = measureImage(readImage(record.file), palette, artworkExclusions({ file: record.file, palette, composite, uiDir })); } catch { /* reported as a finding */ }
  return { ...record, file: shownAs, recordFile: slash(path.relative(workRoot, record.recordFile)), findings, refused: measure?.refused ?? [], primary: measure?.primary ?? null };
}
async function main(argv) {
  const json = argv.includes('--json');
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  if (arg('--prompt')) return promptResult(arg('--prompt'));
  if (arg('--check')) return checkResult(arg, json);
  if (arg('--scan')) return scanResult(arg('--scan'), json);
  return { exitCode: 2, text: 'Usage: starci work brand-palette --prompt <work-root> | --check <png> --brand <work-root> [--json] | --scan <work-root> [--json]\n' };
}
function promptResult(promptPath) {
  const b = brandOf(path.resolve(promptPath));
  if (!b.brand) return { exitCode: 2, text: `${b.error}\n` };
  return { exitCode: 0, text: `${promptPaletteBlock(b.brand, { name: b.brand?.identity?.name ?? b.brand?.identity?.product ?? null })}\n` };
}

function checkResult(arg, json) {
  const b = brandOf(path.resolve(arg('--brand') ?? '.'));
  if (!b.brand) return { exitCode: 2, text: `${b.error}\n` };
  const file = path.resolve(arg('--check'));
  const palette = brandPalette(b.brand, { brandDir: b.dir });
  const findings = paletteFindings({ file, shownAs: slash(file), brand: b.brand, palette, subject: 'image', at: slash(file) });
  const refused = findings.filter((f) => f.level === 'refuse');
  if (json) return { exitCode: refused.length ? 1 : 0, text: `${JSON.stringify({ file: slash(file), findings, measure: measureImage(readImage(file), palette, artworkExclusions({ file, palette })) }, null, 2)}\n` };
  return { exitCode: refused.length ? 1 : 0, text: `${findings.map((f) => '  ' + f.level.toUpperCase() + ' ' + f.message + ' [' + f.code + ']').join('\n')}${findings.length ? '\n' : ''}${refused.length ? 'FAIL' : 'OK'}: brand palette\n` };
}
async function scanResult(scanPath, json) {
  const result = await scanWork(path.resolve(scanPath));
  if (json) return { exitCode: 0, text: `${JSON.stringify(result, null, 2)}\n` };
  if (!result.brand) return { exitCode: 2, text: `${result.error}\n` };
  const bad = result.results.filter((r) => r.findings.some((f) => f.level === 'refuse'));
  const lines = bad.map((r) => `${r.record}  ${r.file}  [${r.kind}${r.declared ? '' : ', undeclared'}]\n    ${r.refused.map(describeOffender).join('\n    ')}${r.findings.some((f) => f.code === PALETTE_CODES.primaryAbsent) ? '\n    primary ' + r.primary.token + ' ' + r.primary.hex + ' absent' : ''}`);
  return { exitCode: 0, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${bad.length} of ${result.results.length} images off-brand (brand ${result.brand.file} rev ${result.brand.rev}, primary ${result.brand.primary?.hex ?? 'none'})\n` };
}

if (isMain(import.meta.url)) {
  const result = await main(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
