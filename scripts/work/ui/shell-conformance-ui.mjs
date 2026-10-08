// shell-conformance-ui.mjs — the findings about one ui record held to the layout tree: its shell binding, route,
// surface, drawer direction, overlay, ancestor layouts, destinations, composites and prompt locale
// (shell-conformance.mjs, the owner of the findings).
import fs from 'node:fs';
import path from 'node:path';
import { escapeRegExp } from '../../lib/regex.mjs';
import {
  DRAWER_DIRECTIONS, OVERLAY_SURFACES, SURFACES, SURFACE_FILE, TREE_SCHEMA,
  appNamesOf, appOfUi, destinationFor, destinationsOf, directionAt, isLayoutTree, isOverlayRecord, layoutChainOf, layoutSettlement, loadUiRecords,
  matrixOf, nodeById, nodesOf, surfaceAt, surfaceValues,
} from '../layout-tree.mjs';
import { resolveHost } from '../compose-direction.mjs';
import { assetsOf, list } from '../work-io.mjs';
import { checkComposites } from './shell-conformance-composites.mjs';
import { checkDrawGeometry } from './shell-conformance-geometry.mjs';
import { finding, refuse, shown } from './shell-findings.mjs';

/** Levels for the two callers: the op proof (`op`) refuses what `validate` only lists. */
const LEVELS = {
  op: { missing: 'refuse', stale: 'refuse' },
  validate: { missing: 'suspect', stale: 'suspect' },
};

/** The binding half (lane S shape, kept): {ref: shell, rev, activeNav, layouts} or {chromeless, because}. */
function checkBinding(ctx, at, record) {
  const { shell, level } = ctx;
  const binding = record?.shell;
  if (!binding || typeof binding !== 'object') return [finding(level.missing, 'SHELL_BINDING_MISSING', at, `${record?.id ?? 'this ui record'} binds no shell - write shell: {ref: shell, rev, layouts: [{node, rev}]} (or {chromeless: true, because}) and redraw inside the layout tree`)];
  if (binding.chromeless === true) return typeof binding.because === 'string' && binding.because.trim() ? [] : [refuse('SHELL_BINDING_INVALID', at, 'chromeless without a because')];
  if (!shell) return [refuse('SHELL_REF_UNRESOLVED', at, `binds shell ${binding.ref ?? '(no ref)'} but the tree has no shell/index.yaml`)];
  if (shell.error) return [];
  if (binding.ref !== 'shell') return [refuse('SHELL_BINDING_INVALID', at, `shell.ref is ${binding.ref ?? '(none)'}, not shell`)];
  // A present `layouts` list (even empty - a planned layout's own drawing has no visible layout above it) binds
  // per layout, and the tree-wide rev is not compared (work/ui-screen@1 shell.layouts): a lockup crop or a
  // capture elsewhere in the tree never stales it.
  if (!Array.isArray(binding.layouts) && binding.rev !== shell.record.rev) return [finding(level.stale, 'SHELL_REV_STALE', at, `bound to shell rev ${binding.rev ?? '(none)'}, the shell record is at rev ${shell.record.rev ?? '(none)'} - redraw against the current layout tree`)];
  return [];
}

/** The file a surface needs at its route: its own surface file, else `page` for a routed overlay. */
function surfaceFileNeeded(record) {
  const surface = typeof record.surface === 'string' ? record.surface : null;
  if (surface && SURFACE_FILE[surface]) return SURFACE_FILE[surface];
  if (isOverlayRecord(record) && record.routed === true) return 'page';
  return null;
}

/** Route: in the tree, or declared new under an existing routeParent that is a prefix of it. */
function routeFindings({ record, route, tree, at, inApp }) {
  const node = nodeById(tree, route);
  const needsFile = surfaceFileNeeded(record);
  const declaredNew = !node || (needsFile && !node.files?.[needsFile]);
  if (!declaredNew) return { findings: [], anchor: route, declaredNew };
  const parent = record.routeParent;
  if (typeof parent !== 'string' || !nodeById(tree, parent)) return { findings: [refuse('UI_ROUTE_UNKNOWN', at, `${route} is not a node of the layout tree${inApp}${node ? ' with a ' + needsFile + ' file' : ''} and routeParent ${parent ?? '(none)'} names no existing node - declare the nearest existing parent it will sit under`)], anchor: route, declaredNew };
  if (!(route === parent || route.startsWith(parent === '/' ? '/' : `${parent}/`))) return { findings: [refuse('UI_ROUTE_UNKNOWN', at, `routeParent ${parent} is not an ancestor of ${route}`)], anchor: route, declaredNew };
  return { findings: [], anchor: node ? route : parent, declaredNew };
}

/** A surface keyed by breakpoint names only known breakpoints, and only a modal or drawer varies. */
function surfaceByBreakpointFindings(record, values, breakpoints, at) {
  const out = [];
  for (const key of Object.keys(record.surface)) if (key !== 'default' && !breakpoints.includes(key)) out.push(refuse('SURFACE_BREAKPOINT_UNKNOWN', at, `surface names breakpoint ${key}, not one of ${breakpoints.join(', ')}`));
  if (values.some((v) => !OVERLAY_SURFACES.has(v))) out.push(refuse('SURFACE_INCONSISTENT', at, 'only a modal or drawer varies by breakpoint - a layout, page, loading, error or not-found surface is one surface everywhere'));
  return out;
}

/** Surface: declared, one of the known surfaces, and varying by breakpoint only for a modal or drawer. */
function surfaceFindings({ record, values, breakpoints, route, at }) {
  const out = [];
  if (!values.length) out.push(refuse('UI_SURFACE_MISSING', at, `${route} declares no surface (${SURFACES.join(', ')})`));
  if (record.surface && typeof record.surface === 'object') out.push(...surfaceByBreakpointFindings(record, values, breakpoints, at));
  for (const v of values) if (!SURFACES.includes(v)) out.push(refuse('SURFACE_INVALID', at, `surface ${v} is not one of ${SURFACES.join(', ')} (a sheet is a drawer with direction bottom)`));
  return out;
}

/** A direction keyed by breakpoint belongs to a breakpoint where the surface is a drawer. */
function directionKeyFindings(record, at) {
  const out = [];
  for (const key of Object.keys(record.direction)) if (key !== 'default' && surfaceAt(record, key) !== 'drawer') out.push(refuse('DIRECTION_FORBIDDEN', at, `direction names ${key}, where the surface is ${surfaceAt(record, key) ?? '(none)'}, not a drawer`));
  return out;
}

/** Drawer direction: a drawer names one at each breakpoint it is a drawer, and nothing else has one. */
function drawerFindings({ record, breakpoints, at }) {
  const drawerAt = breakpoints.filter((bp) => surfaceAt(record, bp) === 'drawer');
  if (!drawerAt.length) return record.direction === undefined ? [] : [refuse('DIRECTION_FORBIDDEN', at, 'direction belongs to a drawer; this record is no drawer at any breakpoint')];
  const out = [];
  for (const bp of drawerAt) {
    const d = directionAt(record, bp);
    if (!d) out.push(refuse('DRAWER_DIRECTION_MISSING', at, `a drawer at ${bp} names no direction (${DRAWER_DIRECTIONS.join(', ')})`));
    else if (!DRAWER_DIRECTIONS.includes(d)) out.push(refuse('DRAWER_DIRECTION_MISSING', at, `direction ${d} at ${bp} is not one of ${DRAWER_DIRECTIONS.join(', ')}`));
  }
  if (record.direction && typeof record.direction === 'object') out.push(...directionKeyFindings(record, at));
  return out;
}

/** The host an overlay opens over: named, and a ui record or a route of the tree. */
function overlayHostFindings(record, tree, records, at) {
  if (typeof record.host !== 'string' || !record.host) return [refuse('OVERLAY_HOST_MISSING', at, 'an overlay names the host it opens over - a ui record id or a route')];
  if (!resolveHost(records, record.host) && !(record.host.startsWith('/') && nodeById(tree, record.host))) return [refuse('OVERLAY_HOST_UNRESOLVED', at, `host ${record.host} is neither a ui record nor a route of the layout tree`)];
  return [];
}

/** Routed and host: an overlay says both, anything else says neither. */
function overlayFindings({ record, overlay, tree, records, route, declaredNew, at }) {
  const out = [];
  if (!overlay) {
    if (record.routed !== undefined) out.push(refuse('ROUTED_FORBIDDEN', at, '`routed` belongs to a modal or drawer'));
    if (record.host !== undefined) out.push(refuse('HOST_FORBIDDEN', at, '`host` belongs to a modal or drawer'));
    return out;
  }
  if (typeof record.routed !== 'boolean') out.push(refuse('OVERLAY_ROUTED_MISSING', at, 'an overlay says routed: true (an intercepting @slot/(.)x route plus a full page x/page.tsx) or routed: false (component state, no URL)'));
  out.push(...overlayHostFindings(record, tree, records, at));
  if (record.routed === true && !declaredNew) {
    const intercept = nodesOf(tree).some((n) => n.intercepts === route);
    if (!intercept) out.push(refuse('ROUTED_INTERCEPT_MISSING', at, `${route} is a routed overlay but no intercepting route (@slot/(.)x) in app/ presents it - declare routeParent until interface.implement adds it`));
  }
  return out;
}

/** Ancestor layouts: settled, and bound at their current rev. */
function ancestorFindings({ record, tree, shell, chain, records, mode, level, route, at }) {
  const out = [];
  const loader = (id) => records.get(id) ?? null;
  const bound = new Map(list(record.shell?.layouts).map((b) => [b?.node, b?.rev]));
  for (const n of chain) {
    const { settled, reasons } = layoutSettlement(tree, n, { shellDir: shell.dir, uiLoader: loader });
    if (!settled) out.push(finding(mode === 'op' ? 'refuse' : 'suspect', 'LAYOUT_ANCESTOR_UNSETTLED', at, `${route} sits under ${n.id}, which is not settled: ${reasons.join('; ')}`));
    if (n.layout?.chrome !== 'visible' || record.shell?.chromeless === true) continue;
    if (!bound.has(n.id)) out.push(finding(level.missing, 'LAYOUT_BINDING_MISSING', at, `shell.layouts does not bind ${n.id} (rev ${n.layout.rev})`));
    else if (bound.get(n.id) !== n.layout.rev) out.push(finding(level.stale, 'LAYOUT_REV_STALE', at, `bound to ${n.id} rev ${bound.get(n.id)}, the layout is at rev ${n.layout.rev} - recompose into its current captures`));
  }
  return out;
}

/** Chromeless and activeNav against the visible layouts above the route. */
function chromeFindings({ record, chain, route, at }) {
  const out = [];
  if (record.shell?.chromeless === true && chain.some((n) => n.layout?.chrome === 'visible')) out.push(refuse('SHELL_BINDING_INVALID', at, `chromeless, but ${chain.filter((n) => n.layout?.chrome === 'visible').map((n) => n.id).join(', ')} wraps ${route} with visible chrome`));
  if (record.shell?.activeNav) {
    const keys = chain.flatMap((n) => list(n.layout?.nav?.items).map((i) => i?.key));
    if (!keys.includes(record.shell.activeNav)) out.push(refuse('SHELL_BINDING_INVALID', at, `activeNav ${record.shell.activeNav} is not a nav key of any layout above ${route}`));
  }
  return out;
}

// Destinations: a bound one exists on its layout, and activeNav never contradicts the destination the
// route makes active (the composite shows the route's; a different activeNav would claim another).
function destinationFindings({ record, tree, chain, route, level, at }) {
  const out = [];
  for (const n of chain.filter((x) => x.layout?.chrome === 'visible')) {
    const boundKey = list(record.shell?.layouts).find((b) => b?.node === n.id)?.destination ?? null;
    const dests = destinationsOf(tree, n);
    if (boundKey && !dests.some((d) => d.key === boundKey)) { out.push(refuse('SHELL_BINDING_INVALID', at, `shell.layouts binds ${n.id} destination ${boundKey}, which is not a destination of that layout (${dests.map((d) => d.key).join(', ') || 'none recorded'})`)); continue; }
    const byRoute = destinationFor(tree, n, { route });
    const nav = record.shell?.activeNav;
    if (nav && byRoute?.destination && dests.some((d) => d.key === nav) && byRoute.destination.key !== nav && !boundKey) out.push(finding(level.stale, 'ACTIVE_NAV_CONFLICT', at, `activeNav ${nav} names a destination of ${n.id}, but ${route} makes ${byRoute.destination.key} active there - fix activeNav, or bind shell.layouts[{node: ${n.id}}].destination`));
  }
  return out;
}

/** The one prompt-text rule kept: every generated content prompt states `Product locale: <default>`. */
function checkPromptLocale(workRoot, uiFile, record, shell) {
  const locale = shell && !shell.error ? shell.record.productLocale?.default : null;
  if (!locale) return [];
  const at = shown(workRoot, uiFile);
  const seen = new Set();
  const out = [];
  for (const asset of assetsOf(record)) {
    const promptPath = asset.generation?.promptPath;
    if (!promptPath || seen.has(promptPath)) continue;
    seen.add(promptPath);
    const file = path.join(path.dirname(uiFile), promptPath);
    if (!fs.existsSync(file)) { out.push(refuse('SHELL_PROMPT_UNREADABLE', at, `${asset.path}: its prompt ${promptPath} is not on disk`)); continue; }
    if (!new RegExp(String.raw`product[\s_-]?locale\s*[:=]\s*${escapeRegExp(locale)}(?![A-Za-z0-9-])`, 'i').test(fs.readFileSync(file, 'utf8'))) out.push(refuse('SHELL_LOCALE_DRIFT', at, `${promptPath} does not state "Product locale: ${locale}" - UI copy follows the layout tree's productLocale, not owner_language`));
  }
  return out;
}

/** Findings that end the check before the record is placed in the tree, or `null` when it is placed: {unplaced} | {resolved}. */
function placement({ raw, record, route, at, level, mode, workRoot, uiFile, shell }) {
  if (typeof route !== 'string' || !route) {
    const missing = [finding(level.missing, 'UI_ROUTE_MISSING', at, `${record?.id ?? 'this ui record'} declares no route/surface - a direction drawn before the layout tree; give it route, surface (and routed/host for an overlay) and recompose it into the layout chain`)];
    return { unplaced: mode === 'op' ? [...missing, ...checkPromptLocale(workRoot, uiFile, record, shell)] : missing };
  }
  if (!raw) return { unplaced: record?.shell?.chromeless === true ? [] : [refuse('SHELL_RECORD_MISSING', at, 'the Work tree has no layout tree to place this route in')] };
  // The app the route is in: `app:` names it; a tree of one app is that app; else the route decides when only one app holds it.
  const resolved = appOfUi(raw, record);
  if (resolved.error) return { unplaced: [refuse(resolved.error.code, at, `${record.id} ${resolved.error.message}`)] };
  return { resolved };
}

/** The findings about a placed ui record: route, surface, drawer, overlay, persona, ancestors, destinations, composites. */
function placedFindings({ raw, resolved, record, shell, records, mode, level, workRoot, uiFile, at }) {
  const route = record.route;
  const tree = resolved.tree;
  const inApp = appNamesOf(raw).length > 1 ? ` in app ${resolved.app}` : '';
  const { breakpoints } = matrixOf(tree);
  const values = surfaceValues(record);
  const placedRoute = routeFindings({ record, route, tree, at, inApp });
  const { anchor, declaredNew } = placedRoute;
  const overlay = isOverlayRecord(record);
  const out = [...placedRoute.findings, ...surfaceFindings({ record, values, breakpoints, route, at }), ...drawerFindings({ record, breakpoints, at }), ...overlayFindings({ record, overlay, tree, records, route, declaredNew, at })];
  if (record.persona !== undefined && !list(tree.personas).some((p) => p?.role === record.persona)) out.push(refuse('PERSONA_UNKNOWN', at, `persona ${record.persona} is not a role of the layout tree's personas`));
  const drawingOwnLayout = values.includes('layout') && anchor === route;
  const chain = layoutChainOf(tree, anchor, { self: !drawingOwnLayout }) ?? [];
  const scope = { record, tree, shell, chain, records, mode, level, route, at };
  out.push(...ancestorFindings(scope), ...chromeFindings(scope), ...destinationFindings(scope),
    ...checkComposites(workRoot, uiFile, record, shell, { mode, level, records, anchor, drawingOwnLayout, overlay }));
  return out;
}

/** Findings about one ui record. `mode` 'op' re-derives composite pixels and refuses; 'validate' lists. */
export function checkUiRecord(workRoot, uiFile, record, shell, { mode = 'op', uiRecords = null } = {}) {
  const level = LEVELS[mode];
  const at = shown(workRoot, uiFile);
  const out = checkBinding({ shell, level }, at, record);
  const bound = shell?.error ? null : shell;
  const raw = bound && isLayoutTree(bound.record) ? bound.record : null;
  if (bound && !raw && record?.shell?.chromeless !== true) {
    out.push(finding(level.missing, 'SHELL_RECORD_NOT_TREE', at, `the shell record names schema ${shell.record?.schema ?? '(none)'}, not ${TREE_SCHEMA}; the ui record cannot be placed in a layout tree`));
    return out;
  }
  const records = uiRecords ?? loadUiRecords(workRoot);
  const placed = placement({ raw, record, route: record?.route, at, level, mode, workRoot, uiFile, shell });
  if (placed.unplaced) return [...out, ...placed.unplaced];
  out.push(...placedFindings({ raw, resolved: placed.resolved, record, shell, records, mode, level, workRoot, uiFile, at }));
  if (mode === 'op') out.push(...checkPromptLocale(workRoot, uiFile, record, shell), ...checkDrawGeometry(workRoot, uiFile, record, shell));
  return out;
}
