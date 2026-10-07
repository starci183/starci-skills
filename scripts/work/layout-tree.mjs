#!/usr/bin/env node
// layout-tree.mjs — the product's layout tree, scanned out of the frontend's Next.js `app/` directory.
//
//   starci work layout-tree scan    --work <.starciwork> [--app-dir <dir>]... [--write] [--json]   (every fe app hfs.json declares)
//   starci work layout-tree scan    --app-dir <dir> [--app <name>] [--repo-root <dir>] [--json]
//   starci work layout-tree capture --work <.starciwork> [--app <name>] --node <id> --breakpoint <bp> --theme <t> --file <png> [--url <u>] [--provenance <text>] --write
//   starci work layout-tree capture --work <.starciwork> [--app <name>] --node <id> --destination <key> [--route <node-id>]... --breakpoint <bp> --theme <t> --file <png> --write
//   starci work layout-tree lockup  --work <.starciwork> --from <shell/<capture> | <ui-id>:<layout composite>> --rect x,y,w,h [--theme t] --write
//   starci work layout-tree destinations --work <.starciwork> [--app <name>] [--route <node-id> [--active-nav <key>]] [--write] [--json]
//   starci work layout-tree plan    --work <.starciwork> [--app <name>] --node <id> [--files layout,page] [--design <ui-id>] --write
//   starci work layout-tree slot    <png> [--key ff00ff] [--tolerance 8]
//
// The source of truth for what wraps a screen is the App Router's own file convention, not a sentence in a
// prompt and not a hand-kept list: one node per segment directory under app/ with its special files
// (layout, template, page, loading, error, not-found, default, route) and their digests, route groups
// (x), parallel slots @x and intercepting routes (.)x as nodes of their own. The app's fe side is
// only ever READ, and every path the record holds is app-relative (fe/apps/<name>/src/app/...); `--write` writes the one record .starciwork/shell/index.yaml (work/layout-tree@1) and,
// for `capture`, the capture bytes under .starciwork/shell/assets/. A re-scan keeps what the owning op
// decided (chrome, captures, personas, lockups, planned nodes) and marks a layout whose file changed as
// needing a re-capture, so the record is regenerated rather than hand-maintained.
//
// Navigation labels come from the route tree plus the i18n message catalogs: the destination registry is
// read out of the source a layout imports (objects with a key and a route), each destination's label is
// looked up in every catalog, and each route is resolved against the scanned pages. A destination with no
// route, a route no page answers, a label a catalog lacks and a top-level route no destination reaches are
// each written into the layout's nav.findings - reported, never papered over.
import { opContextOf } from '../guards/op-context.mjs';
import { loadSlotManifest, readRepoDeclaration } from '../hfs/slots.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { isMain } from '../lib/is-main.mjs';
import { stringifyYaml } from '../../engine/yaml.mjs';
import { putBlob, blobAsFile } from '../../engine/db/blob.mjs';
import { cropImage, decodePng, encodePng, keyRect } from './png.mjs';
import { REQUIRED_BREAKPOINTS, REQUIRED_THEMES, drawingAcceptance } from './direction-part.mjs';
import { scanTools } from './layout-tree-scan.mjs';
import { driftChanges, keyedI18n, usedI18nKeys } from './layout-tree-drift.mjs';
import {
  SLOT_FILL_MIN, assetsOf, flag, flags, indexFilesUnder, list, parseUiRef, readYamlOrNull, sha256File, sha256Of, slash, writeRecordFile,
} from './work-io.mjs';

export { REQUIRED_BREAKPOINTS, REQUIRED_THEMES };

export const TREE_SCHEMA = 'work/layout-tree@1';
const DEFAULT_BREAKPOINTS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
export const THEMES = ['light', 'dark'];
export const SLOT_KEY = [255, 0, 255];
// How a planned layout's drawing gets accepted (inc-a4b5b1abdd90): nothing else writes its ui record done
// before the final reconciliation, so interface.draw parks one owner draw-review ask of its parts and applies the
// accept answer onto the record - the owner's, or auto-accepted when the owner did not ask for the drawing
// (scripts/work/draw-review.mjs).
const ACCEPT_PATH = 'interface.draw parks the owner draw-review ask of its drawn parts (scripts/work/draw-review.mjs question) and, on its accept answer (the owner answer, or an auto-accept when the owner did not ask for the drawing), writes the record done (draw-review.mjs apply --receipt <answer receipt> --write)';

const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// ---------------------------------------------------------------------------------------------------------
const SCANNER = scanTools.SCANNER;
const readText = scanTools.readText;
const nodeUrlOf = scanTools.nodeUrlOf;
export { usedI18nKeys };
export const segmentKindOf = scanTools.segmentKindOf;
export const isLocaleSegment = scanTools.isLocaleSegment;
export const resolveNavRoute = scanTools.resolveNavRoute;

export function scanAppDir(appDir, options = {}) {
  return scanTools.scanAppDir(appDir, options, { appNameOf, digestOfParts, keyedI18n, usedI18nKeys });
}

const appNameOf = (root) => {
  const last = String(root ?? '').split('/').findLast((p) => p && p !== '.');
  return (last ?? 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
};

const digestOfParts = (parts) => sha256Of([...parts].sort((a, b) => a[0].localeCompare(b[0])).map(([p, s]) => `${p}\0${s}`).join('\n'));

/**
 * Whether app/ drifted from what the tree recorded, judged against a fresh scan. Returns {stale, changed}:
 * `changed` names what moved. A record with catalogs but no keyed digest (`i18n.used.keys`) is stale until
 * re-scanned.
 */
export function sourceDrift(record, scan) {
  const changed = driftChanges(record, scan, nodesOf(record));
  return { stale: changed.length > 0, changed: [...new Set(changed)] };
}

// ---------------------------------------------------------------------------------------------------------
// Reading the record, resolving routes and layout chains
// ---------------------------------------------------------------------------------------------------------

const shellFileOf = (workRoot) => path.join(workRoot, 'shell', 'index.yaml');

/** The tree's shell record: {file, dir, record} when it exists, {error} when it does not parse, null when absent. */
export function readShellRecord(workRoot) {
  const file = shellFileOf(workRoot);
  if (!fs.existsSync(file)) return null;
  const record = readYamlOrNull(file);
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { file, dir: path.dirname(file), error: 'does not parse as a YAML object' };
  return { file, dir: path.dirname(file), record };
}

export const isLayoutTree = (record) => record?.schema === TREE_SCHEMA;

// ---------------------------------------------------------------------------------------------------------
// Apps: one tree per app of the frontend (a monorepo may hold several - apps/app, apps/landing)
// ---------------------------------------------------------------------------------------------------------
//
// The record holds `apps[]`: {name, root, appDir, framework, localeParam?, source, i18n?, nodes}. A node
// id is a route within its app, so the same id (`/`) may exist in two apps. Everything below that reads nodes -
// nodeById, chainOf, baseLayoutFor, layoutSettlement, sourceDrift - works on ONE app's tree: `treeOf(record, name)`,
// a live view whose app/source/i18n/nodes are that app's and whose other fields (brand, personas, themes, rev...)
// are the record's, so a write through the view lands in the record.

const APP_OWN = new Set(['app', 'source', 'i18n', 'nodes']);
const recordKey = Symbol('layout-tree.record');

/** The whole record behind an app view (the record itself when given one): what is written to shell/index.yaml. */
export const recordOf = (tree) => tree?.[recordKey] ?? tree;

/** The apps the record declares. */
export const appsOf = (record) => list(record?.apps).filter((a) => a && typeof a.name === 'string');
export const appNamesOf = (record) => appsOf(record).map((a) => a.name);

/** One app's tree as a live view of the record, or null when the record declares no such app. */
export function treeOf(record, name) {
  const entry = appsOf(record).find((a) => a.name === name);
  if (!entry) return null;
  if (!entry.nodes) entry.nodes = [];
  const { source, i18n, nodes, ...app } = entry;
  const own = { app, source, i18n, nodes };
  return new Proxy(record, {
    get: (target, key) => {
      if (key === recordKey) { return target; }
      if (typeof key === 'string' && APP_OWN.has(key)) { return own[key]; }
      return target[key];
    },
    set: (target, key, value) => {
      if (typeof key === 'string' && APP_OWN.has(key)) { own[key] = value; if (key !== 'app') entry[key] = value; } else target[key] = value;
      return true;
    },
    has: (target, key) => (typeof key === 'string' && APP_OWN.has(key) ? own[key] !== undefined : key in target),
    ownKeys: (target) => [...new Set([...Reflect.ownKeys(target).filter((k) => k !== 'apps'), ...APP_OWN])],
    getOwnPropertyDescriptor: (target, key) => (typeof key === 'string' && APP_OWN.has(key) ? { value: own[key], enumerable: true, configurable: true, writable: true } : Reflect.getOwnPropertyDescriptor(target, key)),
  });
}

/**
 * The app a ui record is drawn in and that app's tree: {app, tree}, or {error: {code, message}}.
 *   - `ui.app` names it (UI_APP_UNKNOWN when the tree declares no such app);
 *   - else, when the tree declares exactly one app, that app;
 *   - else the one app whose tree holds the record's route (or its routeParent);
 *   - else the record must say (UI_APP_MISSING: no app or several hold the route).
 */
export function appOfUi(record, ui) {
  const apps = appNamesOf(record);
  if (!apps.length) return { error: { code: 'UI_APP_UNKNOWN', message: 'the layout tree declares no app' } };
  if (ui?.app !== undefined && ui?.app !== null) {
    if (typeof ui.app !== 'string' || !apps.includes(ui.app)) return { error: { code: 'UI_APP_UNKNOWN', message: `app ${JSON.stringify(ui.app)} is not an app of the layout tree (${apps.join(', ')})` } };
    return { app: ui.app, tree: treeOf(record, ui.app) };
  }
  if (apps.length === 1) return { app: apps[0], tree: treeOf(record, apps[0]) };
  const wants = [ui?.route, ui?.routeParent].filter((r) => typeof r === 'string' && r);
  const holders = apps.filter((name) => wants.some((r) => nodeById(treeOf(record, name), r)));
  if (holders.length === 1) return { app: holders[0], tree: treeOf(record, holders[0]) };
  const why = holders.length ? `the route ${wants[0]} exists in ${holders.join(' and ')}` : `no app holds the route ${wants[0] ?? '(none)'}`;
  return { error: { code: 'UI_APP_MISSING', message: `the layout tree declares ${apps.length} apps (${apps.join(', ')}) and ${why} - name the app with \`app:\`` } };
}

/** Every node of every app (a lookup by capture or design id, never by route: ids repeat across apps). */
export const allNodesOf = (record) => appsOf(record).flatMap((a) => list(a.nodes).filter((n) => n && typeof n.id === 'string'));
export const nodesOf = (record) => list(record?.nodes).filter((n) => n && typeof n.id === 'string');
export const nodeById = (record, id) => nodesOf(record).find((n) => n.id === id) ?? null;

/** The node chain from the root to `id` (inclusive), or null when `id` is not in the tree. */
export function chainOf(record, id) {
  const byId = new Map(nodesOf(record).map((n) => [n.id, n]));
  if (!byId.has(id)) return null;
  const chain = [];
  for (let at = byId.get(id), guard = 0; at && guard < 200; at = byId.get(at.parent), guard += 1) chain.unshift(at);
  return chain;
}

/** The layout nodes wrapping `id`, outermost first. `self` includes the node's own layout (a layout drawing excludes it). */
export function layoutChainOf(record, id, { self = true } = {}) {
  const chain = chainOf(record, id);
  if (!chain) return null;
  return chain.filter((n) => (n.files?.layout || n.layout) && (self || n.id !== id));
}

/** The nearest existing ancestor id of a route path that is not (yet) in the tree, walking up by segment. */
function nearestExisting(record, route) {
  const parts = String(route).split('/').filter(Boolean);
  for (let n = parts.length; n >= 0; n -= 1) {
    const id = n ? `/${parts.slice(0, n).join('/')}` : '/';
    if (nodeById(record, id)) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// A ui record's place in the tree: route, surface (per breakpoint), drawer direction, routed, host
// ---------------------------------------------------------------------------------------------------------

export const SURFACES = ['layout', 'page', 'modal', 'drawer', 'loading', 'error', 'not-found'];
export const OVERLAY_SURFACES = new Set(['modal', 'drawer']);
export const DRAWER_DIRECTIONS = ['left', 'right', 'top', 'bottom'];
/** The file an App Router segment must carry for a surface drawn at that route. */
export const SURFACE_FILE = { layout: 'layout', page: 'page', loading: 'loading', error: 'error', 'not-found': 'not-found' };

const perBreakpoint = (value, bp) => {
  if (typeof value === 'string') { return value; }
  if (value && typeof value === 'object') { return value[bp] ?? value.default ?? null; }
  return null;
};
/** The surface a ui record presents at breakpoint `bp` ({desktop: drawer, mobile: modal} overrides). */
export const surfaceAt = (ui, bp) => perBreakpoint(ui?.surface, bp);
/** The edge a drawer is anchored to at `bp` ({desktop: right, mobile: bottom} overrides). */
export const directionAt = (ui, bp) => perBreakpoint(ui?.direction, bp);
/** Every surface value a ui record names, across breakpoints. */
export const surfaceValues = (ui) => {
  if (typeof ui?.surface === 'string') { return [ui.surface]; }
  if (ui?.surface && typeof ui.surface === 'object') { return Object.values(ui.surface); }
  return [];
};
export const isOverlayRecord = (ui) => surfaceValues(ui).some((s) => OVERLAY_SURFACES.has(s));

/** Every work/ui-screen@1 record under the Work root's features/: Map id -> {file, record}. */
export function loadUiRecords(workRoot) {
  const found = new Map();
  for (const file of indexFilesUnder(path.join(workRoot, 'features'))) {
    const record = readYamlOrNull(file);
    if (record?.schema === 'work/ui-screen@1' && typeof record.id === 'string') found.set(record.id, { file, record });
  }
  return found;
}

/** Breakpoint names and themes the tree declares (what a layout may be captured and a draw composed at). */
export const matrixOf = (record) => ({
  breakpoints: list(record?.breakpoints).map((b) => b?.name).filter(Boolean),
  themes: list(record?.themes).filter(Boolean),
});

/** The cells that are required, not just allowed: desktop and mobile, light (REQUIRED_BREAKPOINTS/THEMES). */
export const requiredMatrixOf = () => ({ breakpoints: [...REQUIRED_BREAKPOINTS], themes: [...REQUIRED_THEMES] });

function captureStatusReasons(reasons, capture, shellDir, messages) {
  if (!capture) { reasons.push(messages.missing()); return; }
  if (!capture.slot) reasons.push(messages.slot());
  if (!shellDir) return;
  const file = captureFileOf(capture);
  if (!file || !fs.existsSync(file)) reasons.push(messages.absent());
  else if (capture.sha256 && sha256File(file) !== capture.sha256) reasons.push(messages.changed());
}

function designSettlementReasons(node, layout, uiLoader, reasons) {
  if (!layout.design) { reasons.push(`${node.id} is planned with no design ui record to draw it`); return; }
  const design = uiLoader?.(layout.design);
  if (!design) { reasons.push(`${node.id} is drawn by ${layout.design}, which does not exist`); return; }
  const acceptance = drawingAcceptance(design.record, path.dirname(design.file));
  if (!acceptance.accepted) reasons.push(node.id + ' is drawn by ' + layout.design + ', which is ' + acceptance.reason + (design.record.state !== 'done' ? ' - ' + ACCEPT_PATH : ''));
  const { breakpoints, themes } = requiredMatrixOf();
  for (const bp of breakpoints) {
    for (const theme of themes) {
      if (!designCaptureOf(design, bp, theme)) reasons.push(`${layout.design} has no accepted layout composite at ${bp}/${theme} with a measured childSlot`);
    }
  }
}

function storedLayoutReasons(record, node, shellDir, breakpoints, themes, reasons) {
  for (const bp of breakpoints) {
    for (const theme of themes) {
      const capture = list(node.layout.captures).find((item) => item?.breakpoint === bp && item?.theme === theme);
      captureStatusReasons(reasons, capture, shellDir, {
        missing: () => `${node.id} has no capture at ${bp}/${theme}`,
        slot: () => `${node.id} capture ${captureRelOf(capture)} has no measured slot`,
        absent: () => `${node.id} capture ${captureRelOf(capture)} is not in the blob store`,
        changed: () => `${node.id} capture ${captureRelOf(capture)} no longer hashes to its recorded sha256`,
      });
    }
  }
  for (const destination of destinationsOf(record, node)) {
    for (const bp of breakpoints) {
      for (const theme of themes) {
        const capture = destination.captures.find((item) => item?.breakpoint === bp && item?.theme === theme);
        captureStatusReasons(reasons, capture, shellDir, {
          missing: () => `${node.id} destination ${destination.key} has no capture at ${bp}/${theme}`,
          slot: () => `${node.id} destination ${destination.key} capture ${captureRelOf(capture)} has no measured slot`,
          absent: () => `${node.id} destination ${destination.key} capture ${captureRelOf(capture)} is not in the blob store`,
          changed: () => `${node.id} destination ${destination.key} capture ${captureRelOf(capture)} no longer hashes to its recorded sha256`,
        });
      }
    }
  }
}

/**
 * Whether one layout node is settled for drawing under it, with the reasons it is not.
 * `uiLoader(id)` returns {file, record} for a ui record id (for a planned layout's design), or null.
 */
export function layoutSettlement(record, node, { shellDir = null, uiLoader = null } = {}) {
  const reasons = [];
  const layout = node.layout;
  if (!layout) return { settled: false, reasons: [`${node.id} has a layout file but no layout block - re-run the scan`] };
  if (layout.chrome === 'unknown') reasons.push(`${node.id} chrome is unknown - brand.decide decides visible or passthrough`);
  if (layout.state !== 'done') reasons.push(`${node.id} layout is ${layout.state ?? 'stateless'}, not done`);
  if (layout.chrome === 'visible') {
    const { breakpoints, themes } = requiredMatrixOf();
    if (node.origin === 'planned' || (!list(layout.captures).length && layout.design)) {
      designSettlementReasons(node, layout, uiLoader, reasons);
    } else {
      storedLayoutReasons(record, node, shellDir, breakpoints, themes, reasons);
    }
  }
  return { settled: reasons.length === 0, reasons };
}

/** A design ui record's accepted layout composite at bp/theme: {path (relative to the ui dir), sha256, slot}. */
function designCaptureOf(design, bp, theme) {
  const assets = [...list(design?.record?.assets), ...list(design?.record?.ui?.assets)];
  const hit = assets.find((a) => a?.composite?.breakpoint === bp && a.composite.theme === theme && a.composite.presentation === 'page' && a.composite.childSlot && a.selected !== false);
  return hit ? { path: hit.path, sha256: hit.sha256, slot: hit.composite.childSlot, width: hit.width, height: hit.height, dir: path.dirname(design.file) } : null;
}

// ---------------------------------------------------------------------------------------------------------
// Destinations: one layout, several active states (inc-8b2e1cb6fbbf, inc-41db3976f275)
// ---------------------------------------------------------------------------------------------------------
//
// A layout whose chrome marks where the user is - a sidebar with the active destination, a tab strip with the
// active tab - renders differently under each of its routes. `layout.captures` is the layout's default render;
// `layout.destinations` holds one entry per active state: {key, routes: [node ids under the layout], captures}.
// A page composite takes the destination whose route is the ui record's route or its nearest ancestor (the
// longest match); an explicit `shell.layouts[].destination` binding overrides the route, and `shell.activeNav`
// decides when no route matches.

/** Whether node id `route` is `base` or sits below it. */
const underNode = (route, base) => route === base || String(route).startsWith(base === '/' ? '/' : `${base}/`);

/** The destinations of one layout node: `layout.destinations`. */
export function destinationsOf(record, node) {
  return list(node?.layout?.destinations).filter((d) => d && typeof d.key === 'string').map((d) => ({ ...d, routes: list(d.routes), captures: list(d.captures) }));
}

function destinationForRoute(dests, route) {
  let best = null;
  let length = -1;
  for (const destination of dests) {
    for (const routeId of destination.routes) {
      if (typeof routeId === 'string' && underNode(route, routeId) && routeId.length > length) {
        best = destination;
        length = routeId.length;
      }
    }
  }
  return best;
}

/**
 * The destination of `node` a ui record at `route` shows active: the binding's explicit
 * `shell.layouts[{node}].destination`, else the destination with the longest route at or above `route`, else
 * the one keyed by `shell.activeNav`. Returns {destination, by: binding|route|activeNav} | {unknown: key} | null.
 */
export function destinationFor(record, node, { route = null, activeNav = null, key = null } = {}) {
  const dests = destinationsOf(record, node);
  if (key) { const hit = dests.find((d) => d.key === key); return hit ? { destination: hit, by: 'binding' } : { unknown: key }; }
  if (!dests.length) return null;
  const best = typeof route === 'string' ? destinationForRoute(dests, route) : null;
  if (best) return { destination: best, by: 'route' };
  const byNav = activeNav ? dests.find((d) => d.key === activeNav) : null;
  return byNav ? { destination: byNav, by: 'activeNav' } : null;
}

// a layout capture is agent data - a blob the layout tree cites {name, sha256, ...},
// never a file under .starciwork/shell/assets. addCapture puts the bytes in the blob store (and a copy in the job's
// scratch/captures/layouts, which starci kernel report attaches by itself).
/** The readable PNG of one recorded capture: the blob it cites; null when it has none. */
export function captureFileOf(capture) {
  if (!capture) return null;
  return blobAsFile({ sha256: capture.sha256 }, { ext: '.png' });
}
/** The name a capture is known by in composites and findings: shell/<name>. */
export const captureRelOf = (capture) => `shell/${slash(capture?.name ?? '')}`;
/** Put a capture's bytes in the blob store (and the job scratch); returns the logical name recorded as `name`. */
function storeCapture(bytes, name) {
  putBlob(bytes, { mediaType: 'image/png' });
  const scratch = opContextOf()?.scratchDir;
  if (scratch) {
    const copy = path.join(path.resolve(scratch), 'captures', 'layouts', path.basename(name));
    fs.mkdirSync(path.dirname(copy), { recursive: true });
    fs.writeFileSync(copy, bytes);
  }
  return name;
}

/** Every recorded capture of a layout node (default and per destination) at bp/theme: [{rel, sha256, name|null, destination|null}]. */
export function capturesAt(record, node, bp, theme) {
  const out = [];
  for (const c of list(node?.layout?.captures)) if (c?.breakpoint === bp && c?.theme === theme) out.push({ rel: captureRelOf(c), sha256: c.sha256, name: c.name ?? null, destination: null });
  for (const d of destinationsOf(record, node)) for (const c of d.captures) if (c?.breakpoint === bp && c?.theme === theme) out.push({ rel: captureRelOf(c), sha256: c.sha256, name: c.name ?? null, destination: d.key });
  return out;
}

/** A capture's slot and size: as recorded, else measured from the PNG on disk. */
function measuredCapture(shellDir, capture) {
  if (capture.slot && capture.width && capture.height) return capture;
  const file = captureFileOf(capture);
  if (!file || !fs.existsSync(file)) return capture;
  const image = decodePng(fs.readFileSync(file));
  const key = keyRect(image, SLOT_KEY);
  return { ...capture, width: capture.width ?? image.width, height: capture.height ?? image.height, ...(!capture.slot && key && key.fill >= SLOT_FILL_MIN ? { slot: key.rect } : null) };
}

function destinationCaptureOf(picked, node, { route, bp, theme, shellDir, ui }, sameCapture) {
  if (!picked) return { result: null, fallback: null };
  const hit = picked.destination.captures.find((capture) => capture?.breakpoint === bp && capture?.theme === theme);
  if (hit) {
    const capture = measuredCapture(shellDir, hit);
    if (!capture.slot) return { result: { missing: `${node.id} destination ${picked.destination.key} capture ${captureRelOf(hit)} has no measured #FF00FF slot` }, fallback: null };
    return { result: { node: node.id, file: captureFileOf(capture), rel: captureRelOf(capture), sha256: capture.sha256, slot: capture.slot, width: capture.width, height: capture.height, destination: picked.destination.key, by: picked.by, equivalents: sameCapture(capture.sha256) }, fallback: null };
  }
  if (REQUIRED_BREAKPOINTS.includes(bp) && REQUIRED_THEMES.includes(theme)) {
    return { result: { missing: `${node.id} destination ${picked.destination.key} (active for ${ui?.route ?? route}) has no capture at ${bp}/${theme}` }, fallback: null };
  }
  return { result: null, fallback: picked.destination.key };
}

function recordedLayoutCapture(node, bp, theme, destination, sameCapture) {
  const capture = list(node.layout.captures).find((item) => item?.breakpoint === bp && item?.theme === theme);
  if (!capture) return null;
  return { node: node.id, file: captureFileOf(capture), rel: captureRelOf(capture), sha256: capture.sha256, slot: capture.slot, width: capture.width, height: capture.height, destination: null, ...(destination ? { destinationFallback: destination } : {}), equivalents: sameCapture(capture.sha256) };
}

function designLayoutCapture(node, bp, theme, uiLoader) {
  if (!node.layout.design || !uiLoader) return null;
  const design = uiLoader(node.layout.design);
  const hit = design && designCaptureOf(design, bp, theme);
  if (!hit) return null;
  return { node: node.id, file: path.join(hit.dir, hit.path), rel: `${node.layout.design}:${slash(hit.path)}`, sha256: hit.sha256, slot: hit.slot, width: hit.width, height: hit.height, destination: null, equivalents: [] };
}

/**
 * The image a page composite at bp/theme is placed into: the innermost visible layout's capture (a real render
 * of the whole chain down to it) with its slot, or null when no layout above the route draws chrome. When that
 * layout records destinations, the capture is the one of the destination the ui record shows active
 * (destinationFor over `ui`: {route, activeNav, layouts}); an optional cell (dark) the destination lacks falls
 * back to the default capture, a required one is missing.
 * Returns {node, file (absolute), rel (as a composite records it), sha256, slot, width, height, destination,
 * equivalents} | {missing} | null. `equivalents` are the node's recorded captures with the same bytes.
 */
export function baseLayoutFor(record, route, bp, theme, { shellDir, uiLoader = null, self = true, ui = null } = {}) {
  const chain = layoutChainOf(record, route, { self });
  if (!chain) return { missing: `${route} is not a node of the layout tree` };
  const visible = chain.filter((n) => n.layout?.chrome === 'visible');
  const node = visible.at(-1);
  if (!node) return null;
  const bound = list(ui?.shell?.layouts).find((b) => b?.node === node.id)?.destination ?? null;
  const picked = destinationFor(record, node, { route: ui?.route ?? route, activeNav: ui?.shell?.activeNav ?? null, key: bound });
  if (picked?.unknown) return { missing: `shell.layouts binds ${node.id} destination ${picked.unknown}, which is not a destination of that layout (${destinationsOf(record, node).map((d) => d.key).join(', ') || 'none recorded'})` };
  const same = (sha) => capturesAt(record, node, bp, theme).filter((c) => c.sha256 === sha).map((c) => c.rel);
  const destinationCapture = destinationCaptureOf(picked, node, { route, bp, theme, shellDir, ui }, same);
  if (destinationCapture.result) return destinationCapture.result;
  const capture = recordedLayoutCapture(node, bp, theme, destinationCapture.fallback, same);
  if (capture) return capture;
  const designCapture = designLayoutCapture(node, bp, theme, uiLoader);
  if (designCapture) return designCapture;
  return { missing: `${node.id} has no capture at ${bp}/${theme}` };
}

// ---------------------------------------------------------------------------------------------------------
// Writing: merge a scan into the record, add captures and planned nodes
// ---------------------------------------------------------------------------------------------------------

/**
 * The fe side of the app a Work tree belongs to: .starciwork sits at the app root beside hfs.json, whose `sides.fe.apps`
 * names the front-end apps (fe/apps/<name>). {appRoot, repoRoot (the app root every recorded path is relative to),
 * feRoot (the fe side folder), apps: [{name, root (app-relative, fe/apps/<name>)}], error?}.
 */
export function frontendOf(workRoot) {
  const appRoot = path.dirname(path.resolve(workRoot));
  const feRoot = path.join(appRoot, 'fe');
  let declaration;
  try { declaration = readRepoDeclaration(loadSlotManifest(), appRoot); } catch (error) { return { appRoot, repoRoot: appRoot, feRoot, apps: [], error: `${slash(appRoot)} has no readable app declaration (${error.message})` }; }
  return { appRoot, repoRoot: appRoot, feRoot, apps: declaration.sides.fe.apps.map((app) => ({ name: app.name, root: `fe/apps/${app.name}` })) };
}

/**
 * Where the fe side's App Router directories are for a Work tree: [{name, root, appDir (absolute)}], root app-relative.
 * hfs.json declares them (sides.fe.apps, each at fe/apps/<name>, its App Router directory <root>/src/app or <root>/app) and
 * nothing else names them. `explicit` (--app-dir, repeatable) names directories for a scan outside the declaration.
 */
export function locateApps(workRoot, explicit = []) {
  const located = frontendOf(workRoot);
  const { repoRoot } = located;
  const rootOfAppDir = (d) => { const abs = path.resolve(d); return path.basename(path.dirname(abs)) === 'src' ? path.dirname(path.dirname(abs)) : path.dirname(abs); };
  if (list(explicit).length) return { repoRoot, apps: list(explicit).map((d) => { const root = slash(path.relative(repoRoot, rootOfAppDir(d))) || '.'; return { name: appNameOf(root), root, appDir: path.resolve(d) }; }) };
  if (located.error) return { repoRoot, apps: [], error: located.error };
  const appDirOf = (root) => [path.join(repoRoot, root, 'src', 'app'), path.join(repoRoot, root, 'app')].find((d) => fs.existsSync(d) && fs.statSync(d).isDirectory()) ?? null;
  return { repoRoot, apps: located.apps.map((app) => ({ ...app, appDir: appDirOf(app.root) })) };
}

const carryLayout = (scanned, previous, notes) => {
  if (!previous?.layout) return scanned.layout;
  const prev = previous.layout;
  const fileChanged = previous.files?.layout?.sha256 && scanned.files?.layout?.sha256 && previous.files.layout.sha256 !== scanned.files.layout.sha256;
  const navChanged = !same(prev.nav?.items, scanned.layout?.nav?.items);
  const layout = {
    ...scanned.layout,
    chrome: prev.chrome && prev.chrome !== 'unknown' ? prev.chrome : scanned.layout.chrome,
    state: prev.state ?? scanned.layout.state,
    rev: prev.rev ?? 1,
    ...(prev.design ? { design: prev.design } : {}),
    ...(prev.titleKey ? { titleKey: prev.titleKey } : {}),
    ...(list(prev.captures).length ? { captures: prev.captures } : {}),
    ...(list(prev.destinations).length ? { destinations: prev.destinations } : {}),
    ...(list(prev.blockers).length ? { blockers: prev.blockers } : {}),
  };
  noteLayoutChange(scanned, prev, layout, fileChanged, navChanged, notes);
  return layout;
};

function noteLayoutChange(scanned, previous, layout, fileChanged, navChanged, notes) {
  if (!fileChanged && !navChanged) return;
  layout.rev = (previous.rev ?? 1) + 1;
  if (layout.chrome === 'visible') {
    layout.state = 'todo';
    layout.blockers = [...new Set([...list(layout.blockers), `${fileChanged ? 'The layout file' : 'The navigation'} changed since the captures were taken - brand.decide re-captures it (rev ${layout.rev}).`])];
  }
  notes.push(`${scanned.id}: ${fileChanged ? 'layout file' : 'navigation'} changed; layout rev ${previous.rev ?? 1} -> ${layout.rev}`);
}

function mergeScannedApp(scan, base, at, several, notes) {
  const name = scan.app.name;
  const before = appsOf(base).find((app) => app.name === name);
  const previous = new Map(list(before?.nodes).filter((node) => node && typeof node.id === 'string').map((node) => [node.id, node]));
  const appNotes = [];
  const nodes = scan.nodes.map((scanned) => {
    const prev = previous.get(scanned.id);
    const node = { ...scanned };
    if (scanned.layout) node.layout = carryLayout(scanned, prev, appNotes);
    else if (prev?.layout && prev.origin === 'planned') node.layout = prev.layout;
    return node;
  });
  appendUnscannedNodes(nodes, previous, appNotes);
  for (const node of nodes) { if (!previous.has(node.id)) appNotes.push(`${node.id}: new ${node.segmentKind} segment`); }
  notes.push(...appNotes.map((text) => (several ? name + ': ' : '') + text));
  const entry = {
    ...scan.app,
    source: { ...scan.source, scannedAt: at },
    ...(scan.i18n ? { i18n: scan.i18n } : {}),
    nodes: orderNodes(nodes),
  };
  return { entry, scan };
}

function appendUnscannedNodes(nodes, previous, notes) {
  const scannedIds = new Set(nodes.map((node) => node.id));
  for (const node of previous.values()) {
    if (scannedIds.has(node.id)) continue;
    if (node.origin === 'planned') { nodes.push(node); continue; }
    notes.push(`${node.id}: no longer in app/ - dropped`);
  }
}

function mergedRecordOf(base, entries, scanList) {
  return {
    schema: TREE_SCHEMA, id: 'shell', kind: 'shell',
    state: base?.state ?? 'todo',
    ...(base?.activity ? { activity: base.activity } : {}),
    rev: base?.rev ?? 1,
    origin: 'repository',
    productLocale: base?.productLocale ?? scanList[0]?.productLocale ?? { default: 'en', fallback: 'en', locales: ['en'], source: 'no locale configuration found - brand.decide settles it' },
    ...(base?.brand ? { brand: base.brand } : {}),
    ...(base?.personas ? { personas: base.personas } : {}),
    breakpoints: base?.breakpoints ?? DEFAULT_BREAKPOINTS,
    themes: base?.themes ?? [...REQUIRED_THEMES],
    apps: entries.map((item) => item.entry),
    ...(base?.review ? { review: base.review } : {}),
    ...(base?.refs ? { refs: base.refs } : {}),
    ...(base?.blockers ? { blockers: base.blockers } : {}),
    ...(base?.change ? { change: base.change } : {}),
    ...(base?.extensions ? { extensions: base.extensions } : {}),
  };
}

function updateMergedI18n(record, entries) {
  for (const { entry, scan } of entries) {
    if (entry.i18n && scan.catalogs) entry.i18n = { ...entry.i18n, used: keyedI18n(scan.catalogs, usedI18nKeys({ nodes: entry.nodes, brand: record.brand })) };
  }
}

function mergedStructure(record) {
  const i18nShape = (entry) => ({ catalogs: list(entry?.i18n?.catalogs).map((catalog) => [catalog.locale, catalog.path]), used: entry?.i18n?.used ?? null });
  return JSON.stringify(appsOf(record).map((entry) => ({ name: entry.name, appDir: entry.appDir, nodes: entry.nodes, source: entry.source?.digest, i18n: i18nShape(entry) })));
}

function updateMergedChange(record, base, entries, notes, at, changed) {
  if (changed && base) {
    record.rev = (base.rev ?? 1) + 1;
    record.change = { rev: record.rev, kind: 'clarifying', at, reason: `Re-scanned app/ (${notes.length ? notes.slice(0, 6).join('; ') : 'source digests changed'}).` };
    const nodes = entries.flatMap((entry) => entry.entry.nodes);
    if (nodes.some((node) => node.layout?.chrome === 'visible' && node.layout.state !== 'done') || nodes.some((node) => node.layout?.chrome === 'unknown')) record.state = 'todo';
  } else if (!base) {
    record.change = { rev: 1, kind: 'initial', at, reason: `First scan of the frontend app/ ${entries.length > 1 ? 'directories' : 'directory'} into the layout tree.` };
  }
}

/**
 * Merge fresh scans (an array, one per app) into an existing layout-tree record (or start one). Returns {record, notes,
 * changed}. An app the scans no longer name is dropped with a note; what the owner decided per node (chrome,
 * captures, planned nodes) is carried per app.
 */
export function mergeScan(existing, scans, { at = now() } = {}) {
  const notes = [];
  const base = isLayoutTree(existing) ? existing : null;
  const scanList = scans;
  const several = scanList.length > 1 || appsOf(base).length > 1;
  const entries = scanList.map((scan) => mergeScannedApp(scan, base, at, several, notes));
  for (const gone of appsOf(base)) { if (!scanList.some((scan) => scan.app.name === gone.name)) notes.push(`app ${gone.name}: no longer declared - dropped`); }
  const record = mergedRecordOf(base, entries, scanList);
  updateMergedI18n(record, entries);
  const changed = !base || mergedStructure(base) !== mergedStructure(record);
  updateMergedChange(record, base, entries, notes, at, changed);
  return { record, notes, changed };
}

/** Parents before children, siblings in id order. */
function orderNodes(nodes) {
  const children = new Map();
  for (const n of nodes) { const k = n.parent ?? ''; if (!children.has(k)) { children.set(k, []); } children.get(k).push(n); }
  const out = [];
  const visit = (id) => { for (const n of (children.get(id) ?? []).sort((a, b) => a.id.localeCompare(b.id))) { out.push(n); visit(n.id); } };
  visit('');
  const placed = new Set(out.map((n) => n.id));
  return [...out, ...nodes.filter((n) => !placed.has(n.id))];
}

/** Upsert one capture for a layout node from a PNG (slot measured from the key colour). Mutates `record`. */
export function addCapture(record, shellDir, { node: id, breakpoint, theme, file, url = null, provenance = null, locale = null, destination = null, routes = [] }) {
  if (destination) return addDestinationCapture(record, shellDir, { node: id, destination, routes, breakpoint, theme, file, url, provenance, locale });
  const node = nodeById(record, id);
  if (!node?.layout) throw new Error(`${id}: not a layout node of the tree`);
  if (!matrixOf(record).breakpoints.includes(breakpoint)) throw new Error(`${breakpoint}: not one of the tree's breakpoints`);
  // An optional theme (dark) joins the tree's themes with its first capture; it is never required.
  if (!matrixOf(record).themes.includes(theme)) {
    if (!THEMES.includes(theme)) throw new Error(`${theme}: not a theme (${THEMES.join(', ')})`);
    record.themes = [...matrixOf(record).themes, theme];
  }
  const bytes = fs.readFileSync(file);
  const image = decodePng(bytes);
  const key = keyRect(image, SLOT_KEY);
  if (!key || key.fill < SLOT_FILL_MIN) throw new Error(`${file}: no solid #FF00FF slot found (fill ${key ? key.fill.toFixed(3) : 0}) - capture with the page slot emptied and keyed`);
  const name = storeCapture(bytes, `assets/layouts/${record.app.name}--${nodeSlug(id)}--${breakpoint}--${theme}.png`);
  const capture = { breakpoint, theme, ...(locale ? { locale } : {}), name, sha256: sha256Of(bytes), width: image.width, height: image.height, slot: key.rect, kind: 'render', ...(url ? { url } : {}), ...(provenance ? { provenance } : {}) };
  const cell = (c) => c.breakpoint === breakpoint && c.theme === theme;
  const prior = list(node.layout.captures).find(cell);
  node.layout.captures = [...list(node.layout.captures).filter((c) => !cell(c)), capture].sort((a, b) => `${a.breakpoint}/${a.theme}`.localeCompare(`${b.breakpoint}/${b.theme}`));
  node.layout.chrome = 'visible';
  if (prior && prior.sha256 !== capture.sha256) node.layout.rev = (node.layout.rev ?? 1) + 1;
  return capture;
}

/** A PNG measured as a capture: {bytes, capture fields} or a thrown refusal when the slot is not keyed. */
function readCaptureFile(file) {
  const bytes = fs.readFileSync(file);
  const image = decodePng(bytes);
  const key = keyRect(image, SLOT_KEY);
  if (!key || key.fill < SLOT_FILL_MIN) throw new Error(`${file}: no solid #FF00FF slot found (fill ${key ? key.fill.toFixed(3) : 0}) - capture with the page slot emptied and keyed`);
  return { bytes, sha256: sha256Of(bytes), width: image.width, height: image.height, slot: key.rect };
}

function routesForDestination(routes, entry, navTarget) {
  if (list(routes).length) { return [...new Set(routes)]; }
  if (entry) { return entry.routes; }
  if (navTarget) { return [navTarget]; }
  return [];
}

function assertDestinationTarget(record, node, id, { destination, breakpoint, theme }) {
  if (!node?.layout) throw new Error(`${id}: not a layout node of the tree`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(destination))) throw new Error(`${destination}: a destination key is a slug`);
  if (!matrixOf(record).breakpoints.includes(breakpoint)) throw new Error(`${breakpoint}: not one of the tree's breakpoints`);
  if (!matrixOf(record).themes.includes(theme)) {
    if (!THEMES.includes(theme)) throw new Error(`${theme}: not a theme (${THEMES.join(', ')})`);
    record.themes = [...matrixOf(record).themes, theme];
  }
}

/**
 * Upsert one destination capture: the layout rendered with destination `destination` active (a nav key of the
 * layout, or a tab key), active for the node ids in `routes` (required when the destination is new and is not
 * a nav item with a target). Mutates `record`; a changed capture bumps the layout rev.
 */
function addDestinationCapture(record, shellDir, { node: id, destination, routes = [], breakpoint, theme, file, url = null, provenance = null, locale = null }) {
  const node = nodeById(record, id);
  assertDestinationTarget(record, node, id, { destination, breakpoint, theme });
  const dests = list(node.layout.destinations);
  let entry = dests.find((d) => d.key === destination);
  const navTarget = list(node.layout.nav?.items).find((i) => i?.key === destination)?.target ?? null;
  const wanted = routesForDestination(routes, entry, navTarget);
  if (!wanted.length) throw new Error(`${destination}: name the node ids it is active for with --route (it is not a nav item of ${id} with a target)`);
  for (const route of wanted) {
    if (!nodeById(record, route) || !underNode(route, id)) throw new Error(`${route}: not a node at or below ${id}`);
  }
  const measured = readCaptureFile(file);
  const name = storeCapture(measured.bytes, `assets/layouts/${record.app.name}--${nodeSlug(id)}--${destination}--${breakpoint}--${theme}.png`);
  const capture = { breakpoint, theme, ...(locale ? { locale } : {}), name, sha256: measured.sha256, width: measured.width, height: measured.height, slot: measured.slot, kind: 'render', ...(url ? { url } : {}), ...(provenance ? { provenance } : {}) };
  if (!entry) { entry = { key: destination, routes: wanted, captures: [] }; dests.push(entry); } else { entry.routes = wanted; }
  const prior = list(entry.captures).find((c) => c.breakpoint === breakpoint && c.theme === theme);
  entry.captures = [...list(entry.captures).filter((c) => !(c.breakpoint === breakpoint && c.theme === theme)), capture].sort((a, b) => `${a.breakpoint}/${a.theme}`.localeCompare(`${b.breakpoint}/${b.theme}`));
  node.layout.destinations = dests.toSorted((a, b) => a.key.localeCompare(b.key));
  node.layout.chrome = 'visible';
  if (prior && prior.sha256 !== capture.sha256) { node.layout.rev = (node.layout.rev ?? 1) + 1; }
  return { destination, ...capture };
}

// ---------------------------------------------------------------------------------------------------------
// The brand lockup: cropped from a real render, or - on a greenfield product - from the accepted drawing
// ---------------------------------------------------------------------------------------------------------

/**
 * Where a lockup may be cropped from (inc-1649b9490cb5): `shell/<path>` - a recorded capture (a real render)
 * of a layout of this tree; `ui.<id>:<path>` - the ACCEPTED layout composite of a planned visible layout's
 * design record (the record is done, the asset is its selected page composite with a measured childSlot, and
 * the record is the layout.design of a planned node). Returns {file, ref, kind, sha256, node} | {error}.
 */
export function lockupSourceOf(record, workRoot, ref, uiLoader = null) {
  const text = String(ref ?? '');
  const ui = parseUiRef(text);
  if (ui) { return uiLockupSourceOf(record, workRoot, ui, uiLoader); }
  return shellLockupSourceOf(record, text);
}

function uiLockupSourceOf(record, workRoot, ui, uiLoader) {
  const { id, path: rel } = ui;
  const node = allNodesOf(record).find((item) => item.layout?.design === id && item.layout.chrome === 'visible');
  if (node?.origin !== 'planned') return { error: `${id} is not the design record of a planned visible layout of this tree - a lockup is cropped from a real render once the frontend renders it` };
  const design = (uiLoader ?? ((key) => loadUiRecords(workRoot).get(key) ?? null))(id);
  if (!design) return { error: `${id} does not exist - interface.draw draws the planned layout first` };
  const acceptance = drawingAcceptance(design.record, path.dirname(design.file));
  if (!acceptance.accepted) return { error: `${id} is ${acceptance.reason} - the layout drawing is accepted before its lockup is taken: ${ACCEPT_PATH}` };
  const asset = assetsOf(design.record).find((item) => item.path === rel);
  const composite = asset?.composite;
  if (composite?.surface !== 'layout' || composite?.presentation !== 'page' || !composite?.childSlot || asset.selected === false) return { error: `${rel} is not an accepted layout composite of ${id} (a selected page composite of the layout with a measured childSlot)` };
  const file = path.join(path.dirname(design.file), rel);
  if (!fs.existsSync(file)) return { error: `${rel} is not on disk` };
  const sha256 = sha256File(file);
  if (asset.sha256 && asset.sha256 !== sha256) return { error: `${rel} no longer hashes to its recorded sha256` };
  return { file, ref: `${id}:${slash(rel)}`, kind: 'layout-drawing', sha256, node: node.id, theme: composite.theme ?? null };
}

function shellLockupSourceOf(record, text) {
  const shell = /^shell\/(.+)$/.exec(text);
  if (!shell) return { error: `--from names shell/<capture path> or <ui-id>:<layout composite path>, not ${text || '(nothing)'}` };
  const rel = shell[1];
  for (const node of allNodesOf(record).filter((item) => item.layout)) {
    const captures = [...list(node.layout.captures), ...destinationsOf(record, node).flatMap((d) => d.captures)];
    const hit = captures.find((c) => slash(c.path ?? c.name ?? '') === rel);
    if (!hit) continue;
    const file = captureFileOf(hit);
    if (!file || !fs.existsSync(file)) return { error: `${rel} is not in the blob store` };
    const sha256 = sha256File(file);
    if (hit.sha256 && hit.sha256 !== sha256) return { error: `${rel} no longer hashes to its recorded sha256` };
    return { file, ref: `shell/${rel}`, kind: 'render', sha256, node: node.id, theme: hit.theme ?? null };
  }
  return { error: `${rel} is not a recorded capture of any layout of this tree - record the render with layout-tree.mjs capture first` };
}

/**
 * Crop the lockup out of a source image (lockupSourceOf) at `rect` and upsert it into brand.lockups for its
 * theme, with `source` naming the image, its digest and the rectangle so the crop is re-derivable. Mutates
 * `record`; the crop is a blob (+ the job scratch copy) the lockup cites as name assets/lockups/lockup--<theme>.png.
 */
function addLockup(record, workRoot, { from, rect, theme = null, provenance = null, uiLoader = null }) {
  const source = lockupSourceOf(record, workRoot, from, uiLoader);
  if (source.error) throw new Error(source.error);
  const r = typeof rect === 'string' ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, Number(rect.split(',')[i])])) : rect;
  if (!r || ['x', 'y', 'width', 'height'].some((k) => !Number.isInteger(r[k]) || r[k] < 0) || r.width < 1 || r.height < 1) throw new Error('--rect is x,y,width,height in whole pixels');
  const image = decodePng(fs.readFileSync(source.file));
  if (r.x + r.width > image.width || r.y + r.height > image.height) throw new Error(`--rect ${r.x},${r.y},${r.width},${r.height} leaves the ${image.width}x${image.height} source`);
  const th = theme ?? source.theme ?? 'light';
  if (!THEMES.includes(th)) throw new Error(`${th}: not a theme (${THEMES.join(', ')})`);
  const bytes = encodePng(cropImage(image, r));
  const name = storeCapture(bytes, `assets/lockups/lockup--${th}.png`);
  const lockup = {
    name, sha256: sha256Of(bytes), theme: th, width: r.width, height: r.height,
    provenance: provenance ?? `cropped by ${SCANNER} lockup from ${source.kind === 'render' ? 'the real render' : 'the accepted layout drawing'} ${source.ref}`,
    source: { ref: source.ref, kind: source.kind, sha256: source.sha256, rect: r },
  };
  record.brand = { ...record.brand, lockups: [...list(record.brand?.lockups).filter((l) => (l.theme ?? 'light') !== th), lockup].sort((a, b) => String(a.theme).localeCompare(String(b.theme))) };
  return lockup;
}

const nodeSlug = (id) => (id === '/' ? 'root' : id.replace(/^\//, '').replace(/[()[\]@.]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'root');

function addPlannedNode(record, parts, position, files, design) {
  const id = `/${parts.slice(0, position).join('/')}`;
  const parentId = position === 1 ? '/' : `/${parts.slice(0, position - 1).join('/')}`;
  let node = nodeById(record, id);
  if (!node) {
    const parent = nodeById(record, parentId);
    const name = parts[position - 1];
    const kind = segmentKindOf(name);
    node = { id, parent: parentId, segment: name, segmentKind: kind, url: nodeUrlOf(name, parent, kind), origin: 'planned' };
    record.nodes.push(node);
  }
  if (position !== parts.length) return;
  if (files.length) node.files = { ...node.files, ...Object.fromEntries(files.map((file) => [file, node.files?.[file] ?? { path: `${record.app?.appDir ?? 'app'}${id === '/' ? '' : id}/${file}.tsx` }])) };
  if (files.includes('layout') && !node.layout) { node.layout = { chrome: 'visible', state: 'todo', rev: 1, ...(design ? { design } : {}) }; }
  else if (design && node.layout) { node.layout.design = design; }
}

/** Add a planned node (and any missing planned ancestors). Mutates `record`. */
export function addPlanned(record, { node: id, files = [], design = null }) {
  const parts = String(id).split('/').filter(Boolean);
  if (!record.nodes) { record.nodes = []; }
  if (!nodeById(record, '/')) { record.nodes.unshift({ id: '/', parent: null, segment: '/', segmentKind: 'root', url: '/', origin: 'planned' }); }
  for (let position = 1; position <= parts.length; position += 1) {
    addPlannedNode(record, parts, position, files, design);
  }
  record.nodes = orderNodes(record.nodes);
  return nodeById(record, id);
}

// ---------------------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------------------


/** One-screen summary of a record: every app's tree, layouts with chrome and captures, nav with findings, special files. */
export function summarize(record) {
  const lines = [`layout tree (origin ${record.origin}, rev ${record.rev}, state ${record.state}) - ${appsOf(record).length} app${appsOf(record).length === 1 ? '' : 's'}`];
  lines.push(`productLocale ${record.productLocale?.default} (fallback ${record.productLocale?.fallback}; locales ${list(record.productLocale?.locales).join(', ')})`);
  for (const name of appNamesOf(record)) lines.push(...summarizeApp(treeOf(record, name)));
  return lines.join('\n');
}

function summarizeApp(record) {
  const lines = [`app ${record.app.name} ${record.app.appDir ?? ''} - ${nodesOf(record).length} nodes`];
  for (const n of nodesOf(record)) {
    const depth = (chainOf(record, n.id)?.length ?? 1) - 1;
    const files = Object.keys(n.files ?? {}).join(',');
    const dests = n.layout ? destinationsOf(record, n) : [];
    const extra = n.layout ? ' LAYOUT ' + (n.layout.component ?? '(no component)') + ' chrome=' + n.layout.chrome + ' state=' + n.layout.state + ' rev=' + n.layout.rev + ' captures=' + list(n.layout.captures).length + layoutDestinationsSuffix(dests) : '';
    lines.push('  '.repeat(depth) + n.segment + ' [' + n.segmentKind + '] url=' + n.url + (files ? ' {' + files + '}' : '') + (n.intercepts ? ' intercepts=' + n.intercepts : '') + extra);
    for (const item of list(n.layout?.nav?.items)) { lines.push('  '.repeat(depth + 2) + 'nav ' + item.key + ' -> ' + (item.route ?? 'null') + ' target=' + (item.target ?? 'NONE') + ' ' + Object.entries(item.labels ?? {}).map(([l, v]) => l + ':"' + v + '"').join(' ')); }
    for (const finding of list(n.layout?.nav?.findings)) { lines.push(`${'  '.repeat(depth + 2)}! ${finding.code} ${finding.detail}`); }
  }
  return lines;
}

function layoutDestinationsSuffix(destinations) {
  if (!destinations.length) { return ''; }
  return ' destinations=' + destinations.map((destination) => destination.key).join(',');
}

function appTreeFor(record, args) {
  const names = appNamesOf(record);
  const asked = flag(args, '--app');
  if (asked) return names.includes(asked) ? { tree: treeOf(record, asked) } : { error: `--app ${asked} is not an app of the layout tree (${names.join(', ') || 'none'})` };
  if (names.length === 1) return { tree: treeOf(record, names[0]) };
  return { error: `the layout tree declares ${names.length} apps (${names.join(', ')}) - name one with --app` };
}

function slotCommand(args) {
  const file = args.find((arg) => !arg.startsWith('--') && arg !== flag(args, '--key') && arg !== flag(args, '--tolerance'));
  if (!file) return { exitCode: 2, text: 'Usage: starci work layout-tree slot <png> [--key ff00ff] [--tolerance 8]\n' };
  const hex = (flag(args, '--key') ?? 'ff00ff').replace(/^#/, '');
  const key = [0, 2, 4].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
  const found = keyRect(decodePng(fs.readFileSync(file)), key, Number(flag(args, '--tolerance') ?? 8));
  if (!found || found.fill < SLOT_FILL_MIN) return { exitCode: 1, text: `${JSON.stringify({ ok: false, found })}\n` };
  return { exitCode: 0, text: `${JSON.stringify({ ok: true, slot: found.rect, fill: Number(found.fill.toFixed(4)) })}\n` };
}

function scanWithoutWork(command, work, args, out) {
  if (command !== 'scan' || work) return null;
  const appDir = flag(args, '--app-dir');
  if (!appDir) return { exitCode: 2, text: 'scan needs --work <.starciwork> or --app-dir <dir>\n' };
  const scan = scanAppDir(appDir, { repoRoot: flag(args, '--repo-root'), name: flag(args, '--app') });
  const { record } = mergeScan(null, [scan]);
  return out(record, summarize(record));
}

function destinationPick(base, breakpoint, theme) {
  if (!base) { return { breakpoint, theme, canvas: true }; }
  if (base.missing) { return { breakpoint, theme, missing: base.missing }; }
  return { breakpoint, theme, node: base.node, capture: base.rel, destination: base.destination, by: base.by ?? null, slot: base.slot };
}

function destinationPickText(pick) {
  if (pick.missing) { return 'MISSING ' + pick.missing; }
  if (pick.canvas) { return 'blank canvas (no visible layout)'; }
  return pick.capture + ' (' + pick.node + (pick.destination ? ' destination ' + pick.destination + ' by ' + pick.by : ' default') + ')';
}

function routeDestinations(record, shellDir, route, args, out) {
  const picked = appTreeFor(record, args);
  if (picked.error) return { exitCode: 2, text: `layout-tree: ${picked.error}\n` };
  const tree = picked.tree;
  const ui = { route, shell: { activeNav: flag(args, '--active-nav') } };
  const anchor = nodeById(tree, route) ? route : nearestExisting(tree, route);
  const picks = matrixOf(record).breakpoints.flatMap((breakpoint) => matrixOf(record).themes.map((theme) => {
    const base = baseLayoutFor(tree, anchor, breakpoint, theme, { shellDir, ui });
    return destinationPick(base, breakpoint, theme);
  }));
  return out({ ok: true, route, picks }, picks.map((pick) => pick.breakpoint + '/' + pick.theme + ': ' + destinationPickText(pick)).join('\n'));
}

function destinationRows(record) {
  return appNamesOf(record).flatMap((name) => nodesOf(treeOf(record, name)).filter((node) => node.layout).map((node) => ({ name, node }))).flatMap(({ name, node }) => destinationsOf(record, node).map((destination) => ({ ...(appsOf(record).length > 1 ? { app: name } : {}), node: node.id, key: destination.key, routes: destination.routes, cells: destination.captures.map((capture) => `${capture.breakpoint}/${capture.theme}`) })));
}

function destinationsCommand(command, existing, shellDir, args, out) {
  if (command !== 'destinations') return null;
  if (!isLayoutTree(existing)) return { exitCode: 1, text: 'destinations needs a work/layout-tree@1 record\n' };
  const route = flag(args, '--route');
  if (route) return routeDestinations(existing, shellDir, route, args, out);
  const rows = destinationRows(existing);
  return out({ ok: true, destinations: rows }, rows.length ? rows.map((row) => `${row.node} ${row.key} routes=${row.routes.join(',')} cells=${row.cells.join(',')}`).join('\n') : 'no layout records destinations');
}

function changeReasonForPlan(command, args) {
  if (command !== 'capture') return `Planned ${flags(args, '--node').join(', ')}.`;
  return `Captured ${flag(args, '--node')}` + (flag(args, '--destination') ? ` destination ${flag(args, '--destination')}` : '') + ` at ${flag(args, '--breakpoint')}/${flag(args, '--theme')}.`;
}

function captureOrPlanCommand(command, context) {
  if (command !== 'capture' && command !== 'plan') return null;
  const { args, existing, shellDir, workRoot, write, save, out } = context;
  if (!isLayoutTree(existing) && command === 'capture') return { exitCode: 1, text: 'capture needs a work/layout-tree@1 record - scan first\n' };
  if (command === 'plan' && !flags(args, '--node').length) return { exitCode: 2, text: 'Usage: starci work layout-tree plan --work <.starciwork> --node <id> [--node <id>]... [--files layout,page] [--design <ui-id>] --write\n' };
  const record = isLayoutTree(existing) ? existing : { schema: TREE_SCHEMA, id: 'shell', kind: 'shell', state: 'todo', rev: 1, origin: 'planned', productLocale: { default: 'en', fallback: 'en', locales: ['en'] }, breakpoints: DEFAULT_BREAKPOINTS, themes: [...REQUIRED_THEMES], apps: [{ name: flag(args, '--app') ?? 'app', root: '.', appDir: 'app', framework: 'next-app-router', nodes: [] }] };
  const picked = appTreeFor(record, args);
  if (picked.error) return { exitCode: 2, text: `layout-tree: ${picked.error}\n` };
  const tree = picked.tree;
  let result;
  if (command === 'capture') {
    result = addCapture(tree, shellDir, { node: flag(args, '--node'), breakpoint: flag(args, '--breakpoint'), theme: flag(args, '--theme'), file: flag(args, '--file'), url: flag(args, '--url'), provenance: flag(args, '--provenance'), locale: flag(args, '--locale'), destination: flag(args, '--destination'), routes: flags(args, '--route') });
  } else {
    for (const id of flags(args, '--node')) { result = addPlanned(tree, { node: id, files: (flag(args, '--files') ?? '').split(',').filter(Boolean), design: flag(args, '--design') }); }
  }
  record.rev = (record.rev ?? 1) + (isLayoutTree(existing) ? 1 : 0);
  record.change = { rev: record.rev, kind: 'clarifying', at: now(), reason: changeReasonForPlan(command, args) };
  if (write) save(record);
  return out({ ok: true, written: write, result }, `${write ? 'wrote' : 'would write'} ${slash(shellFileOf(workRoot))}: ${JSON.stringify(result)}`);
}

function lockupCommand(command, context) {
  if (command !== 'lockup') return null;
  const { args, existing, workRoot, write, save, out } = context;
  if (!isLayoutTree(existing)) return { exitCode: 1, text: 'lockup needs a work/layout-tree@1 record\n' };
  if (!flag(args, '--from') || !flag(args, '--rect')) return { exitCode: 2, text: 'Usage: starci work layout-tree lockup --work <.starciwork> --from <shell/<capture> | <ui-id>:<layout composite>> --rect x,y,w,h [--theme light] [--provenance <text>] --write\n' };
  const record = existing;
  if (!write) {
    const source = lockupSourceOf(record, workRoot, flag(args, '--from'));
    return source.error ? { exitCode: 1, text: `layout-tree: ${source.error}\n` } : out({ ok: true, written: false, source }, `would crop ${flag(args, '--rect')} of ${source.ref} (${source.kind}) into brand.lockups (dry run - pass --write)`);
  }
  const lockup = addLockup(record, workRoot, { from: flag(args, '--from'), rect: flag(args, '--rect'), theme: flag(args, '--theme'), provenance: flag(args, '--provenance') });
  record.rev = (record.rev ?? 1) + 1;
  record.change = { rev: record.rev, kind: 'clarifying', at: now(), reason: `Brand lockup (${lockup.theme}) cropped from ${lockup.source.ref}.` };
  save(record);
  return out({ ok: true, written: true, lockup }, `wrote ${slash(shellFileOf(workRoot))}: lockup ${lockup.name} from ${lockup.source.ref}`);
}

function scanWorkCommand(existing, workRoot, args, write, save, out) {
  if (existing && !isLayoutTree(existing)) { return { exitCode: 1, text: `${slash(shellFileOf(workRoot))} names schema ${existing.schema}, not ${TREE_SCHEMA}; SHELL_RECORD_NOT_TREE - remove the record and scan again\n` }; }
  const located = locateApps(workRoot, flags(args, '--app-dir'));
  if (located.error) return { exitCode: 1, text: `layout-tree: ${located.error}\n` };
  if (!located.apps.length) return { exitCode: 1, text: `no fe app is declared for ${slash(workRoot)} - hfs.json sides.fe.apps names them, or pass --app-dir\n` };
  const unreadable = located.apps.filter((app) => !app.appDir);
  if (unreadable.length) return { exitCode: 1, text: `layout-tree: app ${unreadable.map((app) => app.name + ' (' + app.root + ')').join(', ')} has no app/ or src/app/ directory under ${slash(located.repoRoot)}\n` };
  const scans = located.apps.map((app) => scanAppDir(app.appDir, { repoRoot: located.repoRoot, name: app.name }));
  const { record, notes } = mergeScan(existing, scans);
  if (write) save(record);
  return out({ ok: true, written: write, notes, record }, `${summarize(record)}\n${notes.map((note) => '- ' + note).join('\n')}\n${write ? 'wrote ' + slash(shellFileOf(workRoot)) : '(dry run - pass --write to write the record)'}`);
}

export function layoutTreeMain(argv = []) {
  const [command, ...args] = argv;
  const json = args.includes('--json');
  const write = args.includes('--write');
  const out = (value, text) => ({ exitCode: 0, text: json ? `${JSON.stringify(value, null, 2)}\n` : `${text}\n` });
  try {
    if (command === 'slot') { return slotCommand(args); }
    const work = flag(args, '--work');
    const withoutWork = scanWithoutWork(command, work, args, out);
    if (withoutWork) { return withoutWork; }
    if (!['scan', 'capture', 'plan', 'destinations', 'lockup'].includes(command) || !work) {
      return { exitCode: 2, text: 'Usage: starci work layout-tree <scan|capture|plan|destinations|lockup|slot> --work <.starciwork> [...] [--write] [--json]\n' };
    }
    const workRoot = path.resolve(work);
    const shell = readShellRecord(workRoot);
    if (shell?.error) { return { exitCode: 1, text: `${shell.file}: ${shell.error}\n` }; }
    const existing = shell?.record ?? null;
    const shellDir = path.join(workRoot, 'shell');
    const save = (record) => writeRecordFile(shellFileOf(workRoot), stringifyYaml(record, { lineWidth: 110 }));
    const context = { args, existing, shellDir, workRoot, write, save, out };
    const lockup = lockupCommand(command, context);
    if (lockup) { return lockup; }
    const destinations = destinationsCommand(command, existing, shellDir, args, out);
    if (destinations) { return destinations; }
    const captureOrPlan = captureOrPlanCommand(command, context);
    if (captureOrPlan) { return captureOrPlan; }
    return scanWorkCommand(existing, workRoot, args, write, save, out);
  } catch (error) {
    return { exitCode: 1, text: `layout-tree: ${error.message}\n` };
  }
}

if (isMain(import.meta.url)) {
  const result = layoutTreeMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
