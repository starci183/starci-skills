#!/usr/bin/env node
// compose-direction.mjs — a direction is the generated slot content placed into the REAL layout chain.
//
//   node scripts/work/compose-direction.mjs --ui <ui-record-dir> --content <png> --breakpoint <bp> --theme <t>
//        [--state <flow-state>] [--presentation page|overlay] [--host-state <flow-state>] [--fit cover|stretch]
//        [--scrim 0.5] [--tool image_gen.imagegen] [--prompt <path>] [--out <png>] [--json]
//
// ImageGen never redraws chrome. It generates only what a page slot holds (or an overlay panel), and this
// script composites it - deterministically, pure arithmetic over PNG pixels (scripts/work/png.mjs) - into:
//   page presentation     the capture of the innermost visible layout above the ui record's route (a real
//                         render of the whole chain, work/layout-tree@1 at .starciwork/shell/index.yaml), at
//                         the capture's measured slot rectangle; a route no visible layout wraps is composited
//                         onto a blank viewport. A `surface: layout` drawing (a planned layout's chrome with
//                         its own slot keyed #FF00FF) is placed the same way and its child slot is measured.
//   overlay presentation  the host's page composite at the same breakpoint and theme, dimmed by a scrim, with
//                         the panel anchored - a modal centred, a drawer on its `direction` edge for that
//                         breakpoint (left/right: full height; top/bottom: full width).
// The output goes to <ui-dir>/assets/directions/<state>--<presentation>--<breakpoint>--<theme>.png and the
// script prints the ui asset entries to record: the content (role direction-content) and the composite
// (role direction) with its `composite` block - every input by path and digest, the rectangle, and the
// pixel digest scripts/checks/shell-conformance.mjs re-derives to prove the composite is exactly this.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import { blankImage, cropImage, decodePng, dimImage, drawOver, encodePng, keyRect, resizeImage } from './png.mjs';
import {
  OVERLAY_SURFACES, SLOT_KEY, baseLayoutFor, directionAt, isLayoutTree, isOverlayRecord, loadUiRecords, matrixOf, nearestExisting,
  nodeById, readShellRecord, surfaceAt,
} from './layout-tree.mjs';

export const COMPOSITOR = 'scripts/work/compose-direction.mjs';
export const DEFAULT_SCRIM = 0.5;
const CANVAS = { light: [255, 255, 255, 255], dark: [18, 18, 18, 255] };

const slash = (p) => String(p).split(path.sep).join('/');
const sha256Of = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const readYaml = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const list = (v) => (Array.isArray(v) ? v : []);

/** The digest of an image's pixels (dimensions + RGBA), independent of how the PNG was deflated. */
export const pixelSha256 = (image) => sha256Of(Buffer.concat([Buffer.from(`${image.width}x${image.height}\n`), Buffer.from(image.data.buffer, image.data.byteOffset, image.data.byteLength)]));

/** Fit `content` into a width x height box: cover (scale to fill, centre-crop) or stretch. */
export function fitInto(content, width, height, fit = 'cover') {
  if (fit === 'stretch') return resizeImage(content, width, height);
  const scale = Math.max(width / content.width, height / content.height);
  const w = Math.max(width, Math.ceil(content.width * scale)), h = Math.max(height, Math.ceil(content.height * scale));
  const scaled = resizeImage(content, w, h);
  return cropImage(scaled, { x: Math.floor((w - width) / 2), y: Math.floor((h - height) / 2), width, height });
}

/** Where an overlay panel sits on a W x H viewport for a content image of the given aspect. */
export function panelRect(W, H, content, surface, direction) {
  const aspect = content.width / content.height;
  if (surface === 'drawer') {
    if (direction === 'left' || direction === 'right') {
      const width = Math.min(W, Math.max(1, Math.round(H * aspect)));
      return { x: direction === 'left' ? 0 : W - width, y: 0, width, height: H };
    }
    const height = Math.min(H, Math.max(1, Math.round(W / aspect)));
    return { x: 0, y: direction === 'top' ? 0 : H - height, width: W, height };
  }
  const margin = Math.round(Math.min(W, H) * 0.05);
  const maxW = W - 2 * margin, maxH = H - 2 * margin;
  const scale = Math.min(1, maxW / content.width, maxH / content.height);
  const width = Math.max(1, Math.round(content.width * scale)), height = Math.max(1, Math.round(content.height * scale));
  return { x: Math.floor((W - width) / 2), y: Math.floor((H - height) / 2), width, height };
}

/** Pure composition: `content` fitted into `rect` of a copy of `base`, after an optional scrim. */
export function composeImages({ base, content, rect, fit = 'cover', scrim = null, clear = null }) {
  const out = { width: base.width, height: base.height, data: Uint8Array.from(base.data) };
  if (scrim) dimImage(out, scrim);
  // A page slot is replaced, never blended with the key colour under it: it is cleared to the theme canvas
  // first, so a transparent pixel of the content shows the page background rather than #FF00FF.
  if (clear) drawOver(out, blankImage(rect.width, rect.height, clear), rect.x, rect.y);
  drawOver(out, fitInto(content, rect.width, rect.height, fit), rect.x, rect.y);
  return out;
}

/** Resolve a composite's recorded image reference: shell/<path> (a layout capture) or <ui-id>:<path> (a ui asset). */
export function resolveImageRef(workRoot, ref, uiRecords = null) {
  const m = String(ref).match(/^(ui\.[^:]+):(.+)$/);
  if (m) {
    const ui = (uiRecords ?? loadUiRecords(workRoot)).get(m[1]);
    return ui ? path.join(path.dirname(ui.file), m[2]) : null;
  }
  return path.join(workRoot, ref);
}

/** The ui record an overlay opens over: `host` is a ui id, or a route whose page ui record is taken. */
export function resolveHost(uiRecords, host) {
  if (typeof host !== 'string' || !host) return null;
  if (host.startsWith('/')) {
    for (const [id, entry] of uiRecords) if (entry.record.route === host && !isOverlayRecord(entry.record)) return { id, ...entry };
    return null;
  }
  const entry = uiRecords.get(host);
  return entry ? { id: host, ...entry } : null;
}

const assetsOf = (record) => {
  const byPath = new Map();
  for (const a of [...list(record?.assets), ...list(record?.ui?.assets)]) if (a?.path && !byPath.has(a.path)) byPath.set(a.path, a);
  return [...byPath.values()];
};

/** The host's page composite at bp/theme (the named flow state, else the selected one, else the first). */
export function hostCompositeOf(host, bp, theme, state = null) {
  const pages = assetsOf(host.record).filter((a) => a.composite?.presentation === 'page' && a.composite.breakpoint === bp && a.composite.theme === theme);
  return (state ? pages.find((a) => a.composite.flowState === state) : null) ?? pages.find((a) => a.selected === true) ?? pages[0] ?? null;
}

const workRootOf = (dir) => {
  let at = path.resolve(dir);
  while (true) {
    if (path.basename(at) === '.starciwork' || fs.existsSync(path.join(at, 'workspace.yaml'))) return at;
    const parent = path.dirname(at);
    if (parent === at) return path.resolve(dir);
    at = parent;
  }
};

/**
 * Compose one direction for a ui record. Returns {ok, outFile, image, contentAsset, asset} or {ok:false, error}.
 * Nothing is written when `write` is false.
 */
export function composeDirection({ uiDir, content, breakpoint, theme, state = 'default', presentation = null, hostState = null, fit = 'cover', scrim = DEFAULT_SCRIM, tool = 'image_gen.imagegen', prompt = null, out = null, write = true }) {
  const uiAbs = path.resolve(uiDir);
  const uiFile = path.join(uiAbs, 'index.yaml');
  const ui = readYaml(uiFile);
  if (ui?.schema !== 'work/ui-screen@1') return { ok: false, error: `${slash(uiFile)} is not a work/ui-screen@1 record` };
  if (!ui.route) return { ok: false, error: `${ui.id} declares no route - write route and surface before composing` };
  const workRoot = workRootOf(uiAbs);
  const shell = readShellRecord(workRoot);
  if (!shell || shell.error || !isLayoutTree(shell.record)) return { ok: false, error: `${slash(workRoot)}/shell/index.yaml is not a work/layout-tree@1 record (run scripts/work/layout-tree.mjs scan or convert)` };
  const tree = shell.record;
  const bpEntry = list(tree.breakpoints).find((b) => b?.name === breakpoint);
  if (!bpEntry) return { ok: false, error: `${breakpoint} is not a breakpoint of the layout tree (${matrixOf(tree).breakpoints.join(', ')})` };
  if (!matrixOf(tree).themes.includes(theme)) return { ok: false, error: `${theme} is not a theme of the layout tree` };
  const surface = surfaceAt(ui, breakpoint);
  if (!surface) return { ok: false, error: `${ui.id} has no surface at ${breakpoint}` };
  const overlay = OVERLAY_SURFACES.has(surface);
  const pres = presentation ?? (overlay ? 'overlay' : 'page');
  if (pres === 'overlay' && !overlay) return { ok: false, error: `${ui.id} is a ${surface} at ${breakpoint}; only a modal or drawer has an overlay presentation` };
  if (pres === 'page' && overlay && ui.routed !== true) return { ok: false, error: `${ui.id} is a non-routed ${surface}; it has no URL and so no page presentation` };
  const contentAbs = path.resolve(content);
  if (!fs.existsSync(contentAbs)) return { ok: false, error: `${content} does not exist` };
  const contentBytes = fs.readFileSync(contentAbs);
  const contentImage = decodePng(contentBytes);
  const repoRoot = path.dirname(workRoot);
  const uiRecords = loadUiRecords(workRoot);
  const composite = { route: ui.route, surface, presentation: pres, breakpoint, theme, flowState: state };
  let base, rect, scrimUsed = null, fitUsed = fit;
  if (pres === 'page') {
    const anchor = nodeById(tree, ui.route) ? ui.route : (ui.routeParent ?? nearestExisting(tree, ui.route));
    const layout = baseLayoutFor(tree, anchor, breakpoint, theme, { shellDir: shell.dir, uiLoader: (id) => uiRecords.get(id) ?? null, self: !(surface === 'layout' && anchor === ui.route) });
    if (layout?.missing) return { ok: false, error: `no layout capture to compose into: ${layout.missing}` };
    if (layout) {
      if (!fs.existsSync(layout.file)) return { ok: false, error: `layout capture ${layout.rel} is not on disk` };
      base = decodePng(fs.readFileSync(layout.file));
      rect = layout.slot;
      composite.layout = { node: layout.node, capture: layout.rel, sha256: layout.sha256 };
    } else {
      base = blankImage(bpEntry.width, bpEntry.height, CANVAS[theme]);
      rect = { x: 0, y: 0, width: bpEntry.width, height: bpEntry.height };
      composite.layout = null;
      composite.canvas = { width: bpEntry.width, height: bpEntry.height, theme };
    }
  } else {
    const host = resolveHost(uiRecords, ui.host);
    if (!host) return { ok: false, error: `${ui.id} opens over ${ui.host ?? '(no host)'}, which resolves to no ui record` };
    const hostAsset = hostCompositeOf(host, breakpoint, theme, hostState);
    if (!hostAsset) return { ok: false, error: `host ${host.id} has no page composite at ${breakpoint}/${theme} - compose the host first` };
    const hostFile = path.join(path.dirname(host.file), hostAsset.path);
    base = decodePng(fs.readFileSync(hostFile));
    const direction = surface === 'drawer' ? directionAt(ui, breakpoint) : null;
    if (surface === 'drawer' && !direction) return { ok: false, error: `${ui.id} is a drawer at ${breakpoint} with no direction` };
    rect = panelRect(base.width, base.height, contentImage, surface, direction);
    scrimUsed = scrim;
    fitUsed = 'stretch';
    if (direction) composite.direction = direction;
    composite.host = { ui: host.id, asset: `${host.id}:${hostAsset.path}`, sha256: hostAsset.sha256, flowState: hostAsset.composite.flowState };
  }
  const image = composeImages({ base, content: contentImage, rect, fit: fitUsed, scrim: scrimUsed, clear: pres === 'page' ? CANVAS[theme] : null });
  const name = `${state}--${pres}--${breakpoint}--${theme}`;
  const outFile = path.resolve(out ?? path.join(uiAbs, 'assets', 'directions', `${name}.png`));
  const rel = (abs) => slash(path.relative(uiAbs, abs));
  const repoRel = (abs) => slash(path.relative(repoRoot, abs));
  composite.content = { path: rel(contentAbs), sha256: sha256Of(contentBytes) };
  composite.rect = rect;
  composite.fit = fitUsed;
  if (scrimUsed !== null) composite.scrim = scrimUsed;
  if (surface === 'layout') {
    const child = keyRect(cropImage(image, rect), SLOT_KEY);
    if (!child || child.fill < 0.98) return { ok: false, error: `a layout drawing must leave its page slot as a solid #FF00FF rectangle (found ${child ? `fill ${child.fill.toFixed(3)}` : 'none'})` };
    composite.childSlot = { x: rect.x + child.rect.x, y: rect.y + child.rect.y, width: child.rect.width, height: child.rect.height };
  }
  composite.pixelSha256 = pixelSha256(image);
  composite.compositor = COMPOSITOR;
  const bytes = encodePng(image);
  const promptPath = prompt ?? contentAbs.replace(/\.png$/i, '.prompt.txt');
  const contentAsset = { path: rel(contentAbs), role: 'direction-content', sha256: composite.content.sha256, width: contentImage.width, height: contentImage.height, breakpoint, theme, generation: { tool, promptPath: rel(path.resolve(promptPath)), mode: pres === 'overlay' ? 'panel' : 'slot' } };
  const baseRef = composite.layout ? resolveImageRef(workRoot, composite.layout.capture, uiRecords) : composite.host ? resolveImageRef(workRoot, composite.host.asset, uiRecords) : null;
  const asset = {
    path: rel(outFile), role: 'direction', sha256: sha256Of(bytes), width: image.width, height: image.height, breakpoint, theme,
    generation: { tool, promptPath: rel(path.resolve(promptPath)), mode: 'composite', inputRefs: [repoRel(contentAbs), ...(baseRef ? [repoRel(baseRef)] : [])] },
    composite,
  };
  if (write) { fs.mkdirSync(path.dirname(outFile), { recursive: true }); fs.writeFileSync(outFile, bytes); }
  return { ok: true, outFile, image, contentAsset, asset, promptExists: fs.existsSync(path.resolve(promptPath)) };
}

/**
 * Re-derive a recorded composite from its recorded inputs alone. Returns {ok, pixelSha256} or {ok:false, error}.
 * The check compares the result with the composite's recorded pixelSha256 and with the stored image's pixels.
 */
export function recompose(workRoot, uiFile, composite, { uiRecords = null } = {}) {
  try {
    const uiDir = path.dirname(uiFile);
    const content = decodePng(fs.readFileSync(path.join(uiDir, composite.content.path)));
    let base;
    if (composite.presentation === 'overlay') {
      const file = resolveImageRef(workRoot, composite.host?.asset ?? '', uiRecords);
      if (!file || !fs.existsSync(file)) return { ok: false, error: `host image ${composite.host?.asset} is not on disk` };
      base = decodePng(fs.readFileSync(file));
    } else if (composite.layout) {
      const file = resolveImageRef(workRoot, composite.layout.capture, uiRecords);
      if (!file || !fs.existsSync(file)) return { ok: false, error: `layout capture ${composite.layout.capture} is not on disk` };
      base = decodePng(fs.readFileSync(file));
    } else {
      base = blankImage(composite.canvas.width, composite.canvas.height, CANVAS[composite.canvas.theme] ?? CANVAS.light);
    }
    const image = composeImages({ base, content, rect: composite.rect, fit: composite.fit ?? 'cover', scrim: composite.scrim ?? null, clear: composite.presentation === 'overlay' ? null : CANVAS[composite.theme] ?? CANVAS.light });
    return { ok: true, pixelSha256: pixelSha256(image) };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error) };
  }
}

const flag = (args, name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };

export function composeDirectionMain(argv = []) {
  const need = ['--ui', '--content', '--breakpoint', '--theme'];
  if (argv.includes('--help') || need.some((n) => !flag(argv, n))) {
    return { exitCode: argv.includes('--help') ? 0 : 2, text: 'Usage: node scripts/work/compose-direction.mjs --ui <ui-record-dir> --content <png> --breakpoint <bp> --theme <light|dark> [--state <flow-state>] [--presentation page|overlay] [--host-state <s>] [--fit cover|stretch] [--scrim 0.5] [--tool <t>] [--prompt <path>] [--out <png>] [--json]\n' };
  }
  const result = composeDirection({
    uiDir: flag(argv, '--ui'), content: flag(argv, '--content'), breakpoint: flag(argv, '--breakpoint'), theme: flag(argv, '--theme'),
    state: flag(argv, '--state') ?? 'default', presentation: flag(argv, '--presentation'), hostState: flag(argv, '--host-state'),
    fit: flag(argv, '--fit') ?? 'cover', scrim: flag(argv, '--scrim') ? Number(flag(argv, '--scrim')) : DEFAULT_SCRIM,
    tool: flag(argv, '--tool') ?? 'image_gen.imagegen', prompt: flag(argv, '--prompt'), out: flag(argv, '--out'),
  });
  if (!result.ok) return { exitCode: 1, text: `compose-direction: ${result.error}\n` };
  const payload = { ok: true, wrote: slash(result.outFile), promptExists: result.promptExists, assets: [result.contentAsset, result.asset] };
  return { exitCode: 0, text: argv.includes('--json') ? `${JSON.stringify(payload, null, 2)}\n` : `wrote ${slash(result.outFile)}\nrecord these under the ui record's assets (and ui.assets):\n${JSON.stringify(payload.assets, null, 2)}\n${result.promptExists ? '' : 'WARNING: the content prompt file does not exist yet - keep the exact prompt beside the content image.\n'}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = composeDirectionMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
