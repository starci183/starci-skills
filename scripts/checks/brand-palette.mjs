#!/usr/bin/env node
// brand-palette.mjs — a drawn part, a composite or a capture is painted in the brand's colours and no other hue.
//
//   node scripts/checks/brand-palette.mjs --prompt <work-root>            the colour block every draw prompt carries
//   node scripts/checks/brand-palette.mjs --check <png> --brand <work-root> [--json]
//   node scripts/checks/brand-palette.mjs --scan <work-root> [--json]     every part, composite and capture, read-only
//
// Owner, 2026-09-24 ("sao lúc đỏ lúc xanh??"): one nivo drawing painted its primary button, links and selection in
// the image model's default blue while the brand has ONE accent, Unicorn red. scripts/checks/render.mjs already read
// pixels against the brand (`palette-off-brand`, `primary-absent`), but only the example render proof ran it, so
// nothing on the draw, brand or implement path ever looked at a colour. This module is the drawn-image form of those
// two rules, run by scripts/checks/shell-conformance.mjs for every part and composite a ui record declares, every
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
// PRIMARY_ABSENT: the brand primary (and every token of the same colour) appears nowhere while an off-brand hue
// does - the off-brand colour stands in for the primary action. A part with only neutrals and status colours
// draws no primary action and is not judged for one.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deltaEOk, oklabToOklch, oklabToRgb, formatHex, readBrandRecord, rgbToOklab } from './brand.mjs';
import { brandColours } from './render.mjs';
import { decodePng, keyRect } from '../work/png.mjs';

export const PALETTE_CODES = { offBrand: 'PALETTE_OFF_BRAND', primaryAbsent: 'PRIMARY_ABSENT', unavailable: 'BRAND_PALETTE_UNAVAILABLE', unreadable: 'PALETTE_IMAGE_UNREADABLE' };
export const TOKEN_TOLERANCE = 6;
export const HUE_TOLERANCE = 18;
export const CHROMA_SLACK = 0.012;
export const VIVID_CHROMA = 0.08;
export const INK_LIGHTNESS = 0.3;
export const MAX_LIGHTNESS = 0.97;
export const MIN_GROUP_SHARE = 0.03;
export const MIN_AREA_SHARE = 0.00005;
export const MIN_PIXELS = 60;
export const STATUS_HUE_TOLERANCE = 30;
export const STATUS_LIGHTNESS_BAND = 0.12;
export const STRONG_CHROMA = 0.12;
export const STRONG_PIXELS = 150;
const CHROMATIC_TOKEN = 0.04;
const SAMPLE_BUDGET = 4000000;
const ALPHA_FLOOR = 128;
const STATUS_ROLES = new Set(['success', 'warning', 'info', 'danger']);

const slash = (p) => String(p).split(path.sep).join('/');
const list = (v) => (Array.isArray(v) ? v : []);
const round = (v, places = 4) => Number.parseFloat(Number(v).toFixed(places));
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

/** A readable name for an OKLCH hue, so a finding says "blue" and not "259 degrees". */
export function hueName(h) {
  const x = ((h % 360) + 360) % 360;
  if (x < 12 || x >= 345) return 'pink-red';
  if (x < 45) return 'red';
  if (x < 70) return 'orange';
  if (x < 110) return 'amber-yellow';
  if (x < 135) return 'lime';
  if (x < 175) return 'green';
  if (x < 225) return 'teal-cyan';
  if (x < 275) return 'blue';
  if (x < 305) return 'violet';
  return 'purple-magenta';
}

/**
 * The brand's palette as the checks read it: every declared colour (tokens with their roles, scale steps, the
 * dark answers), the chromatic ones marked, the primary picked out, and which tokens carry the primary's colour
 * (nivo's danger and focus are its accent, so they count as the primary too).
 */
export function brandPalette(brand) {
  const entries = brandColours(brand).map((entry) => ({ ...entry, oklch: entry.color.oklch, chromatic: entry.color.oklch.C >= CHROMATIC_TOKEN }));
  const primary = entries.find((e) => e.role === 'primary' && e.scope === 'base') ?? entries.find((e) => e.role === 'primary') ?? null;
  for (const e of entries) e.isPrimary = Boolean(primary && deltaEOk(e.color, primary.color) <= TOKEN_TOLERANCE);
  return { entries, primary, chromatic: entries.filter((e) => e.chromatic) };
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
  const head = `Brand colours${name ? ` (${name})` : ''} - use exactly these; every other saturated hue is refused (PALETTE_OFF_BRAND):`;
  const rule = primary
    ? `Primary buttons, links, selected rows, focus rings, active tabs and every call to action are ${primary.hex} (${primary.label}). Never a default blue or any colour not listed; status colours only for their status.`
    : 'The brand declares no primary colour: use only the listed colours.';
  return [head, ...lines, rule].join('\n');
}

/** The image as {width, height, data RGBA}; `png.mjs` reads every bit depth and colour type a model returns. */
export function readImage(file) {
  return decodePng(fs.readFileSync(file));
}

/**
 * Judge one decoded image against one brand palette. Returns {offenders, primary, counts} - no findings yet, so
 * the CLI, the specs and shell-conformance read the same measurement. `exclude` is a rectangle no pixel of
 * which belongs to the palette (the page slot a capture or a drawing keys with #FF00FF).
 */
export function measurePalette(image, palette, { exclude = null } = {}) {
  const { width, height, data } = image;
  const step = Math.max(1, Math.ceil(Math.sqrt((width * height) / SAMPLE_BUDGET)));
  const cache = new Map();
  const groups = new Map();
  const tokens = new Map();
  let opaque = 0, vivid = 0, primaryPixels = 0, statusPixels = 0;
  const excluded = (x, y) => Boolean(exclude) && x >= exclude.x && y >= exclude.y && x < exclude.x + exclude.width && y < exclude.y + exclude.height;
  const classify = (r, g, b) => {
    const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2);
    if (cache.has(key)) return cache.get(key);
    const oklab = rgbToOklab([r, g, b]);
    const { L, C, h } = oklabToOklch(oklab);
    let verdict;
    if (L < INK_LIGHTNESS || L > MAX_LIGHTNESS || C < VIVID_CHROMA) verdict = { kind: 'ink' };
    else {
      const colour = { oklab };
      let best = null;
      for (const e of palette.entries) {
        const d = deltaEOk(colour, e.color);
        if (d <= TOKEN_TOLERANCE && (!best || d < best.d)) best = { e, d };
      }
      if (!best) {
        for (const e of palette.chromatic) {
          const gap = hueGap(h, e.oklch.h);
          if (C > e.oklch.C + CHROMA_SLACK || (best && gap >= best.d)) continue;
          const status = STATUS_ROLES.has(e.role) && !e.isPrimary;
          if (gap <= HUE_TOLERANCE || (status && gap <= STATUS_HUE_TOLERANCE && Math.abs(L - e.oklch.L) <= STATUS_LIGHTNESS_BAND)) best = { e, d: gap, family: true };
        }
      }
      verdict = best ? { kind: 'brand', entry: best.e, family: Boolean(best.family) } : { kind: 'off', name: hueName(h), oklab };
    }
    cache.set(key, verdict);
    return verdict;
  };
  const classAt = (x, y) => {
    if (excluded(x, y)) return 'ink';
    const at = (y * width + x) * 4;
    if (data[at + 3] < ALPHA_FLOOR) return 'ink';
    const v = classify(data[at], data[at + 1], data[at + 2]);
    return v.kind === 'ink' ? 'ink' : v.kind === 'brand' ? 'brand' : v.name;
  };
  const coherent = (x, y, v) => {
    const own = v.kind === 'brand' ? 'brand' : v.name;
    const nx = x + 1 < width ? x + 1 : x - 1, ny = y + 1 < height ? y + 1 : y - 1;
    if (nx < 0 || ny < 0) return true;
    return classAt(nx, y) === own && classAt(x, ny) === own && classAt(nx, ny) === own;
  };
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (excluded(x, y)) continue;
      const at = (y * width + x) * 4;
      if (data[at + 3] < ALPHA_FLOOR) continue;
      const r = data[at], g = data[at + 1], b = data[at + 2];
      // The page slot of a layout capture or drawing is keyed #FF00FF: the compositor's hole, never a colour.
      // A measured slot is skipped whole (slotExclusion below); this keeps a pixel the key misses out of it.
      if (r >= 247 && g <= 8 && b >= 247) continue;
      opaque += 1;
      const v = classify(r, g, b);
      if (v.kind === 'ink') continue;
      // A colour counts only where it fills a 2x2 block: a browser's subpixel text fringes (orange and blue
      // beside every dark glyph), the antialiased rim of the keyed slot and model noise are one pixel wide.
      if (!coherent(x, y, v)) continue;
      vivid += 1;
      if (v.kind === 'brand') {
        tokens.set(v.entry.label, (tokens.get(v.entry.label) ?? 0) + 1);
        if (v.entry.isPrimary) primaryPixels += 1;
        else if (STATUS_ROLES.has(v.entry.role)) statusPixels += 1;
        continue;
      }
      const group = groups.get(v.name) ?? { name: v.name, count: 0, L: 0, a: 0, b: 0 };
      group.count += 1; group.L += v.oklab.L; group.a += v.oklab.a; group.b += v.oklab.b;
      groups.set(v.name, group);
    }
  }
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

/**
 * The keyed #FF00FF page slot an image carries, as the rectangle `measurePalette` must skip: the measured
 * bounding rectangle of its key pixels grown by `grow`, so the one-pixel rim an image model blends around the
 * slot and the noise it leaves inside it are skipped with it. Null when the image carries no solid slot (a
 * drawn part, a composite whose content already filled the slot).
 */
export function slotExclusion(image, { key = [255, 0, 255], tolerance = 8, minFill = 0.9, grow = 2 } = {}) {
  const found = keyRect(image, key, tolerance);
  if (!found || found.fill < minFill) return null;
  const { x, y, width, height } = found.rect;
  return { x: x - grow, y: y - grow, width: width + grow * 2, height: height + grow * 2 };
}

/** `measurePalette` over an image with its keyed page slot excluded: what the gate measures, findings or scan. */
export const measureImage = (image, palette) => measurePalette(image, palette, { exclude: slotExclusion(image) });

const pct = (v) => `${(v * 100).toFixed(v < 0.01 ? 2 : 1).replace(/\.0$/, '')}%`;

/** One offender, as the finding names it: colour, hue, area share and the nearest brand token. */
export const describeOffender = (o) => `${o.name} ${o.hex} on ${pct(o.share)} of the coloured area (${pct(o.area)} of the image), nearest brand token ${o.nearest ? `${o.nearest.token} ${o.nearest.hex}${o.nearest.role ? ` (${o.nearest.role})` : ''} at deltaE ${o.nearest.deltaE}` : '(none)'}`;

/**
 * shell-conformance findings for one image. `subject` says what the image is (a drawn part, a composite, a layout
 * capture, a running-page capture) so the refusal tells the worker what to redraw or re-capture.
 */
export function paletteFindings({ file, shownAs, brand, palette = null, subject = 'image', at, level = 'refuse' }) {
  const finding = (lvl, code, message) => ({ level: lvl, code, file: at, message });
  if (!brand) return [];
  const pal = palette ?? brandPalette(brand);
  if (!pal.chromatic.length) return [finding('info', PALETTE_CODES.unavailable, `${shownAs}: the brand record declares no chromatic colour this runtime can parse, so the ${subject}'s palette was compared against nothing`)];
  let image;
  try { image = readImage(file); } catch (error) { return [finding('suspect', PALETTE_CODES.unreadable, `${shownAs}: the ${subject} does not decode (${error.message}), so its colours were not read`)]; }
  const m = measureImage(image, pal);
  const out = [];
  if (m.refused.length) {
    const primary = pal.primary ? ` The brand's primary is ${pal.primary.label} ${pal.primary.hex}: redraw every button, link, selection and accent in it.` : '';
    out.push(finding(level, PALETTE_CODES.offBrand, `${shownAs}: the ${subject} is painted in ${m.refused.length === 1 ? 'a colour' : `${m.refused.length} colours`} the brand does not declare - ${m.refused.map(describeOffender).join('; ')}.${primary}`));
  }
  if (pal.primary && pal.primary.color.oklch.C >= CHROMATIC_TOKEN && !m.primary.present && m.refused.length) {
    out.push(finding(level, PALETTE_CODES.primaryAbsent, `${shownAs}: the brand primary ${pal.primary.label} ${pal.primary.hex} appears nowhere in the ${subject}, while ${m.refused[0].name} ${m.refused[0].hex} covers ${pct(m.refused[0].share)} of its coloured area - the off-brand colour stands in for the primary action`));
  }
  return out;
}

/** The brand of a Work tree, or null with the reason (a tree drawn before its brand record has nothing to check). */
export function brandOf(workRoot) {
  try { const b = readBrandRecord(workRoot); return { brand: b.brand, file: b.file, rev: b.rev }; } catch (error) { return { brand: null, error: error.message }; }
}

// ---------------------------------------------------------------------------------------------------------
// Read-only scan of a whole Work tree: every ui record's parts and composites, every layout capture, every
// implementation capture. What the supervisor ran over nivo, starci-next and mia-mia on 2026-09-24.
// ---------------------------------------------------------------------------------------------------------

const readYaml = async (file) => { const { parseYaml } = await import('../../engine/yaml.mjs'); try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
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
  for (const index of walkFiles(path.join(workRoot, 'features'), (f) => path.basename(f) === 'index.yaml')) {
    const record = await readYaml(index);
    const dir = path.dirname(index);
    if (record?.schema === 'work/ui-screen@1') {
      const assets = [...list(record.assets), ...list(record.ui?.assets)].filter((a) => typeof a?.path === 'string' && /\.png$/i.test(a.path));
      const seen = new Set();
      for (const a of assets) {
        const kind = a.composite ? 'composite' : a.role === 'direction-content' || /\.content\.png$/i.test(a.path) ? 'part' : null;
        if (!kind || seen.has(a.path)) continue;
        seen.add(a.path);
        targets.push({ record: record.id, recordFile: index, kind, file: path.join(dir, a.path), declared: true });
      }
      // Parts on disk the record does not (or no longer) declares are still what an owner may have been shown.
      for (const f of walkFiles(path.join(dir, 'assets'), (x) => /\.content\.png$/i.test(x))) {
        const rel = slash(path.relative(dir, f));
        if (!seen.has(rel)) { seen.add(rel); targets.push({ record: record.id, recordFile: index, kind: 'part', file: f, declared: false }); }
      }
    } else if (record?.schema === 'work/implementation@1') {
      for (const f of walkFiles(path.join(dir, 'assets'), (x) => /\.png$/i.test(x))) targets.push({ record: record.id, recordFile: index, kind: 'implementation capture', file: f, declared: true });
    }
  }
  const shellFile = path.join(workRoot, 'shell', 'index.yaml');
  const shell = fs.existsSync(shellFile) ? await readYaml(shellFile) : null;
  if (shell?.schema === 'work/layout-tree@1') {
    const { capturesAt, matrixOf, nodesOf } = await import('../work/layout-tree.mjs');
    const { breakpoints, themes } = matrixOf(shell);
    const seen = new Set();
    for (const node of nodesOf(shell)) for (const bp of breakpoints) for (const th of themes) for (const c of capturesAt(shell, node, bp, th)) {
      if (seen.has(c.rel)) continue;
      seen.add(c.rel);
      targets.push({ record: `shell ${node.id}${c.destination ? ` (${c.destination})` : ''}`, recordFile: shellFile, kind: 'layout capture', file: path.join(workRoot, ...c.rel.split('/')), declared: true });
    }
  }
  return targets;
}

export async function scanWork(workRoot) {
  const b = brandOf(workRoot);
  if (!b.brand) return { workRoot: slash(workRoot), brand: null, error: b.error, results: [] };
  const palette = brandPalette(b.brand);
  const results = [];
  for (const t of await scanTargets(workRoot)) {
    if (!fs.existsSync(t.file)) { results.push({ ...t, file: slash(path.relative(workRoot, t.file)), missing: true, findings: [] }); continue; }
    const shownAs = slash(path.relative(workRoot, t.file));
    const findings = paletteFindings({ file: t.file, shownAs, brand: b.brand, palette, subject: t.kind, at: slash(path.relative(workRoot, t.recordFile)) });
    let measure = null;
    try { measure = measureImage(readImage(t.file), palette); } catch { /* reported as a finding */ }
    results.push({ ...t, file: shownAs, recordFile: slash(path.relative(workRoot, t.recordFile)), findings, refused: measure?.refused ?? [], primary: measure?.primary ?? null });
  }
  return { workRoot: slash(workRoot), brand: { file: slash(b.file), rev: b.rev, primary: palette.primary ? { token: palette.primary.label, hex: palette.primary.hex } : null }, results };
}

async function main(argv) {
  const json = argv.includes('--json');
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  if (arg('--prompt')) {
    const b = brandOf(path.resolve(arg('--prompt')));
    if (!b.brand) return { exitCode: 2, text: `${b.error}\n` };
    return { exitCode: 0, text: `${promptPaletteBlock(b.brand, { name: b.brand?.identity?.name ?? b.brand?.identity?.product ?? null })}\n` };
  }
  if (arg('--check')) {
    const b = brandOf(path.resolve(arg('--brand') ?? '.'));
    if (!b.brand) return { exitCode: 2, text: `${b.error}\n` };
    const file = path.resolve(arg('--check'));
    const findings = paletteFindings({ file, shownAs: slash(file), brand: b.brand, subject: 'image', at: slash(file) });
    const refused = findings.filter((f) => f.level === 'refuse');
    if (json) return { exitCode: refused.length ? 1 : 0, text: `${JSON.stringify({ file: slash(file), findings, measure: measureImage(readImage(file), brandPalette(b.brand)) }, null, 2)}\n` };
    return { exitCode: refused.length ? 1 : 0, text: `${findings.map((f) => `  ${f.level.toUpperCase()} ${f.message} [${f.code}]`).join('\n')}${findings.length ? '\n' : ''}${refused.length ? 'FAIL' : 'OK'}: brand palette\n` };
  }
  if (arg('--scan')) {
    const result = await scanWork(path.resolve(arg('--scan')));
    if (json) return { exitCode: 0, text: `${JSON.stringify(result, null, 2)}\n` };
    if (!result.brand) return { exitCode: 2, text: `${result.error}\n` };
    const bad = result.results.filter((r) => r.findings.some((f) => f.level === 'refuse'));
    const lines = bad.map((r) => `${r.record}  ${r.file}  [${r.kind}${r.declared ? '' : ', undeclared'}]\n    ${r.refused.map(describeOffender).join('\n    ')}${r.findings.some((f) => f.code === PALETTE_CODES.primaryAbsent) ? `\n    primary ${r.primary.token} ${r.primary.hex} absent` : ''}`);
    return { exitCode: 0, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${bad.length} of ${result.results.length} images off-brand (brand ${result.brand.file} rev ${result.brand.rev}, primary ${result.brand.primary?.hex ?? 'none'})\n` };
  }
  return { exitCode: 2, text: 'Usage: node scripts/checks/brand-palette.mjs --prompt <work-root> | --check <png> --brand <work-root> [--json] | --scan <work-root> [--json]\n' };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await main(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
