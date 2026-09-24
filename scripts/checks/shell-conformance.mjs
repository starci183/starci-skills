#!/usr/bin/env node
// shell-conformance.mjs — every drawn and built screen sits inside the product's REAL layout tree.
//
//   node scripts/checks/shell-conformance.mjs <work-root | shell-dir | ui-record-dir | impl-record-dir> [--json]
//
// The shell record (.starciwork/shell/index.yaml) is the layout tree, work/layout-tree@1: the frontend's
// Next.js app/ directory scanned into one node per segment (scripts/work/layout-tree.mjs), each layout with
// its chrome decision, its navigation (labels out of the i18n catalogs) and real captures per breakpoint and
// theme with the page slot measured. Directions are the generated slot content composited into those
// captures (scripts/work/compose-direction.mjs), so this check is STRUCTURAL - it reads records, digests and
// pixels, never the wording of a prompt, with one exception kept on purpose: a content prompt states
// `Product locale: <default>`, because UI copy follows productLocale and not owner_language.
//
//   shell record   a layout tree (an app-shell@1 record is SHELL_RECORD_LEGACY: convert it), nodes whole,
//                  lockups and captures on disk with their digests, every visible layout settled, nav
//                  labels in the default locale and nav routes that land on a page, and (origin repository)
//                  a re-scan of app/ that still matches the recorded source digest.
//   ui record      route in the tree (or declared new under an existing routeParent), surface/direction/
//                  routed/host consistent per breakpoint, every ancestor layout settled and bound at its
//                  current rev, a routed overlay drawn in both presentations (overlay and full page), and
//                  every composite referencing the exact layout capture (or host composite) for its
//                  breakpoint and theme - and re-deriving to the same pixels. When the layout records
//                  destinations (one render per active nav destination or tab), the exact capture is the
//                  one of the destination the record's route (or bound destination, or activeNav) makes
//                  active; a composite in another render of that layout is COMPOSITE_DESTINATION_MISMATCH.
//   implementation every routed ui record it builds has its files at the matching app/ paths in the real
//                  frontend tree - layout.tsx, page.tsx, loading/error/not-found, and for a routed overlay
//                  the @slot/(.)x intercept beside the full page.
//
// Exit 0 clean, 1 lists refusals, 2 is a bad argument. `starci validate` runs the ui half through
// shellBindingFindings() without the pixel re-derivation, and reports what records drawn before this model
// lack (no binding, no route, a stale rev, a legacy shell) as suspects, never refusals.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../engine/yaml.mjs';
import {
  DRAWER_DIRECTIONS, LEGACY_SHELL_SCHEMA, OVERLAY_SURFACES, SURFACES, SURFACE_FILE, TREE_SCHEMA, baseLayoutFor,
  capturesAt, destinationFor, destinationsOf, directionAt, isLayoutTree, isOverlayRecord, layoutChainOf, layoutSettlement, loadUiRecords, locateAppDir, matrixOf,
  nodeById, nodesOf, readShellRecord as readShell, requiredMatrixOf, resolveNavRoute, scanAppDir, surfaceAt, surfaceValues,
} from '../work/layout-tree.mjs';
import { decodePng } from '../work/png.mjs';
import { pixelSha256, recompose, resolveHost } from '../work/compose-direction.mjs';
import { advisoryCodesFor, loadContractChanges } from '../kernel/contract-version.mjs';

export const SHELL_SCHEMA = TREE_SCHEMA;
const UI_SCHEMA = 'work/ui-screen@1';
const IMPL_SCHEMA = 'work/implementation@1';
const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mdx'];

const slash = (p) => String(p).split(path.sep).join('/');
const sha256Of = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readRecord = (file) => { try { return parseYaml(fs.readFileSync(file, 'utf8')); } catch { return null; } };
const escapeRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const list = (v) => (Array.isArray(v) ? v : []);

/** The Work root enclosing `dir`: the nearest `.starciwork`, or the nearest directory with a workspace.yaml. */
export function workRootOf(dir) {
  let at = path.resolve(dir);
  while (true) {
    if (path.basename(at) === '.starciwork' || fs.existsSync(path.join(at, 'workspace.yaml'))) return at;
    const parent = path.dirname(at);
    if (parent === at) return path.resolve(dir);
    at = parent;
  }
}

export const readShellRecord = readShell;

/** The product locale a packet or a prompt uses: the shell's productLocale.default, else the brand voice default. */
export function productLocaleOf(workRoot) {
  const shell = readShell(workRoot);
  const fromShell = shell?.record?.productLocale?.default;
  if (typeof fromShell === 'string' && fromShell.trim()) return { locale: fromShell.trim(), source: 'shell/index.yaml productLocale.default' };
  const brand = readRecord(path.join(workRoot, 'brand', 'index.yaml'));
  const locales = list(brand?.brand?.voice?.locales ?? brand?.voice?.locales);
  const tagOf = (entry) => (typeof entry === 'string' ? entry : entry?.locale ?? entry?.tag ?? null);
  const flagged = locales.find((entry) => entry && typeof entry === 'object' && entry.default === true);
  const chosen = tagOf(flagged ?? locales[0]);
  if (typeof chosen === 'string' && chosen.trim()) return { locale: chosen.trim(), source: `brand/index.yaml voice.locales ${flagged ? 'default' : 'first entry'}` };
  return null;
}

const finding = (level, code, file, message) => ({ level, code, file, message });
const shown = (workRoot, file) => slash(path.relative(path.dirname(workRoot), file)) || slash(file);
const CONVERT_HINT = 'convert it: node scripts/work/layout-tree.mjs convert --work <.starciwork> --write';

// ---------------------------------------------------------------------------------------------------------
// The tree record
// ---------------------------------------------------------------------------------------------------------

/** Findings about the shell record itself. `verifySource` re-scans app/ and compares the recorded digest. */
export function checkShellRecord(workRoot, shell, { verifySource = true, driftLevel = 'refuse', uiRecords = null, requireAll = true } = {}) {
  const out = [];
  const at = shown(workRoot, shell.file);
  if (shell.error) return [finding('refuse', 'SHELL_RECORD_INVALID', at, `the shell record ${shell.error}`)];
  const r = shell.record;
  if (r.schema === LEGACY_SHELL_SCHEMA) return [finding('refuse', 'SHELL_RECORD_LEGACY', at, `the shell record is ${LEGACY_SHELL_SCHEMA}, a single hand-written shell - the layout tree (${TREE_SCHEMA}) replaces it; ${CONVERT_HINT}`)];
  if (r.schema !== TREE_SCHEMA) return [finding('refuse', 'SHELL_RECORD_INVALID', at, `names schema ${r.schema ?? '(none)'}, not ${TREE_SCHEMA}`)];
  if (requireAll && r.state !== 'done') out.push(finding('refuse', 'SHELL_UNSETTLED', at, `the layout tree is ${r.state ?? 'stateless'}, not done`));
  const nodes = nodesOf(r);
  const ids = new Set();
  for (const n of nodes) {
    if (ids.has(n.id)) out.push(finding('refuse', 'LAYOUT_TREE_INVALID', at, `node ${n.id} appears twice`));
    ids.add(n.id);
    if (n.parent !== null && !nodes.some((p) => p.id === n.parent)) out.push(finding('refuse', 'LAYOUT_TREE_INVALID', at, `node ${n.id} names parent ${n.parent}, which is not a node`));
  }
  if (!nodes.some((n) => n.id === '/')) out.push(finding('refuse', 'LAYOUT_TREE_INVALID', at, 'the tree has no root node /'));
  const lockups = list(r.brand?.lockups);
  if (!lockups.length) out.push(finding('refuse', 'SHELL_LOCKUP_MISSING', at, 'no brand lockup: the rendered lockup is what every direction is handed instead of an invented logo'));
  for (const image of lockups) {
    const file = path.join(shell.dir, image.path ?? '');
    if (!image.path || !fs.existsSync(file)) out.push(finding('refuse', 'SHELL_CAPTURE_MISSING', at, `lockup ${image.path ?? '(no path)'} is not on disk`));
    else if (image.sha256 && sha256Of(file) !== image.sha256) out.push(finding('refuse', 'SHELL_CAPTURE_DIGEST', at, `lockup ${image.path} no longer hashes to its recorded sha256`));
  }
  // Every drawing set is desktop and mobile in the light theme (owner ruling 2026-09-24); dark is optional.
  const declared = matrixOf(r), required = requiredMatrixOf(r);
  for (const bp of required.breakpoints) if (!declared.breakpoints.includes(bp)) out.push(finding('refuse', 'SHELL_BREAKPOINT_MISSING', at, `the tree declares no ${bp} breakpoint - every drawing set covers ${required.breakpoints.join(' and ')}`));
  for (const theme of required.themes) if (!declared.themes.includes(theme)) out.push(finding('refuse', 'SHELL_THEME_MISSING', at, `the tree declares no ${theme} theme - every drawing set covers ${required.themes.join(', ')} (dark is optional)`));
  const personas = list(r.personas);
  if (!personas.length) out.push(finding('refuse', 'SHELL_PERSONA_INVALID', at, 'no demo persona - a drawing may not invent a tenant'));
  const roles = personas.map((p) => p?.role);
  if (new Set(roles).size !== roles.length) out.push(finding('refuse', 'SHELL_PERSONA_INVALID', at, 'two personas share a role'));
  if (personas.length > 1 && personas.filter((p) => p?.default === true).length !== 1) out.push(finding('refuse', 'SHELL_PERSONA_INVALID', at, 'more than one persona and not exactly one marked default'));
  const locale = r.productLocale ?? {};
  const locales = list(locale.locales);
  if (locale.default && locales.length && !locales.includes(locale.default)) out.push(finding('refuse', 'SHELL_LOCALE_INVALID', at, `productLocale.default ${locale.default} is not one of productLocale.locales`));
  if (locale.fallback && locales.length && !locales.includes(locale.fallback)) out.push(finding('refuse', 'SHELL_LOCALE_INVALID', at, `productLocale.fallback ${locale.fallback} is not one of productLocale.locales`));
  const loader = (id) => (uiRecords ?? (uiRecords = loadUiRecords(workRoot))).get(id) ?? null;
  for (const node of nodes.filter((n) => n.layout)) {
    if (requireAll) {
      const { settled, reasons } = layoutSettlement(r, node, { shellDir: shell.dir, uiLoader: loader });
      if (!settled) out.push(finding('refuse', 'LAYOUT_UNSETTLED', at, reasons.join('; ')));
    }
    // Destinations: one key each, active for nodes at or below the layout; a legacy extension block is read
    // until promoted, and says so.
    const dests = destinationsOf(r, node);
    const seenKeys = new Set();
    for (const d of dests) {
      if (seenKeys.has(d.key)) out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} records destination ${d.key} twice`));
      seenKeys.add(d.key);
      if (!d.routes.length) out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} destination ${d.key} names no route it is active for`));
      for (const route of d.routes) if (!nodeById(r, route) || !(route === node.id || String(route).startsWith(node.id === '/' ? '/' : `${node.id}/`))) out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} destination ${d.key} is active for ${route}, which is not a node at or below the layout`));
      if (node.layout.chrome !== 'visible') out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} is ${node.layout.chrome}, and only a visible layout has destinations`));
    }
    if (dests.some((d) => d.legacy)) out.push(finding('suspect', 'LAYOUT_DESTINATIONS_LEGACY', at, `${node.id} destinations (${dests.map((d) => d.key).join(', ')}) are read from extensions.destinationCaptures - promote them into layout.destinations: node scripts/work/layout-tree.mjs destinations --work <.starciwork> --promote --write`));
    // Navigation mismatches are the frontend's own defects: reported on every run for the owner (the
    // capture shows exactly what the product renders), never refused here and never patched in the record.
    for (const item of list(node.layout.nav?.items)) {
      const label = item?.labels?.[locale.default];
      if (!(typeof label === 'string' && label.trim())) out.push(finding('suspect', 'SHELL_NAV_LABEL_MISSING', at, `${node.id} nav item ${item?.key ?? '(unnamed)'} has no ${locale.default ?? '(unset)'} label in the catalogs`));
      if (typeof item?.route === 'string' && !resolveNavRoute(nodes, item.route, r.app?.localeParam ?? null)) out.push(finding('suspect', 'NAV_ROUTE_MISSING', at, `${node.id} nav item ${item.key} navigates to ${item.route}, which no page of the tree answers`));
    }
    for (const f of list(node.layout.nav?.findings)) {
      if (f.code === 'ROUTE_NOT_IN_NAV' || f.code === 'NAV_REGISTRY_UNREAD') out.push(finding('suspect', f.code, at, `${node.id}: ${f.detail}`));
      else if (f.code === 'NAV_ROUTE_NULL') out.push(finding('info', f.code, at, `${node.id}: ${f.detail}`));
    }
  }
  if (verifySource && r.origin === 'repository' && r.source?.digest) {
    const located = locateAppDir(workRoot, r);
    if (!located.appDir || !fs.existsSync(located.appDir)) out.push(finding('info', 'SHELL_SOURCE_UNAVAILABLE', at, `${r.app?.appDir ?? 'app/'} is not readable here; the recorded digests could not be compared`));
    else {
      let scan = null;
      try { scan = scanAppDir(located.appDir, { repoRoot: located.repoRoot, repository: located.repository }); } catch (error) { out.push(finding('info', 'SHELL_SOURCE_UNAVAILABLE', at, `app/ could not be scanned (${error.message})`)); }
      if (scan && scan.source.digest !== r.source.digest) {
        const now = new Map(scan.nodes.map((n) => [n.id, n]));
        const changed = [];
        for (const n of nodes.filter((x) => x.origin !== 'planned')) {
          const fresh = now.get(n.id);
          if (!fresh) { changed.push(`${n.id} removed`); continue; }
          for (const [kind, file] of Object.entries(n.files ?? {})) if (file?.sha256 && fresh.files?.[kind]?.sha256 !== file.sha256) changed.push(`${n.id} ${kind}`);
        }
        for (const id of now.keys()) if (!ids.has(id)) changed.push(`${id} added`);
        out.push(finding(driftLevel, 'LAYOUT_TREE_STALE', at, `app/ changed since the scan (${changed.slice(0, 6).join(', ') || 'navigation or catalogs'}) - brand.decide re-runs node scripts/work/layout-tree.mjs scan --work <.starciwork> --write and re-captures what moved`));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// A ui record
// ---------------------------------------------------------------------------------------------------------

const assetsOf = (record) => {
  const byPath = new Map();
  for (const a of [...list(record?.assets), ...list(record?.ui?.assets)]) if (a?.path && !byPath.has(a.path)) byPath.set(a.path, a);
  return [...byPath.values()];
};

/** Levels for the two callers: the op proof (`op`) refuses what `validate` only lists. */
const LEVELS = {
  op: { missing: 'refuse', stale: 'refuse', legacy: 'refuse' },
  validate: { missing: 'suspect', stale: 'suspect', legacy: 'suspect' },
};

/** The binding half (lane S shape, kept): {ref: shell, rev, activeNav, layouts} or {chromeless, because}. */
function checkBinding(ctx, at, record) {
  const { shell, level } = ctx;
  const binding = record?.shell;
  if (!binding || typeof binding !== 'object') return [finding(level.missing, 'SHELL_BINDING_MISSING', at, `${record?.id ?? 'this ui record'} binds no shell - write shell: {ref: shell, rev, layouts: [{node, rev}]} (or {chromeless: true, because}) and redraw inside the layout tree`)];
  if (binding.chromeless === true) return typeof binding.because === 'string' && binding.because.trim() ? [] : [finding('refuse', 'SHELL_BINDING_INVALID', at, 'chromeless without a because')];
  if (!shell) return [finding('refuse', 'SHELL_REF_UNRESOLVED', at, `binds shell ${binding.ref ?? '(no ref)'} but the tree has no shell/index.yaml`)];
  if (shell.error) return [];
  if (binding.ref !== 'shell') return [finding('refuse', 'SHELL_BINDING_INVALID', at, `shell.ref is ${binding.ref ?? '(none)'}, not shell`)];
  if (!list(binding.layouts).length && binding.rev !== shell.record.rev) return [finding(level.stale, 'SHELL_REV_STALE', at, `bound to shell rev ${binding.rev ?? '(none)'}, the shell record is at rev ${shell.record.rev ?? '(none)'} - redraw against the current layout tree`)];
  return [];
}

/** Findings about one ui record. `mode` 'op' re-derives composite pixels and refuses; 'validate' lists. */
export function checkUiRecord(workRoot, uiFile, record, shell, { mode = 'op', uiRecords = null } = {}) {
  const level = LEVELS[mode];
  const at = shown(workRoot, uiFile);
  const ctx = { shell, level };
  const out = checkBinding(ctx, at, record);
  const tree = shell && !shell.error && isLayoutTree(shell.record) ? shell.record : null;
  if (shell && !shell.error && !tree && record?.shell?.chromeless !== true) {
    if (shell.record.schema === LEGACY_SHELL_SCHEMA) out.push(finding(level.legacy, 'SHELL_RECORD_LEGACY', at, `the shell record is still ${LEGACY_SHELL_SCHEMA}; the ui record cannot be placed in a layout tree until it is converted`));
    return out;
  }
  const records = uiRecords ?? loadUiRecords(workRoot);
  const route = record?.route;
  if (typeof route !== 'string' || !route) {
    out.push(finding(level.missing, 'UI_ROUTE_MISSING', at, `${record?.id ?? 'this ui record'} declares no route/surface - a direction drawn before the layout tree; give it route, surface (and routed/host for an overlay) and recompose it into the layout chain`));
    if (mode === 'op') out.push(...checkPromptLocale(workRoot, uiFile, record, shell));
    return out;
  }
  if (!tree) { if (record?.shell?.chromeless !== true) out.push(finding('refuse', 'SHELL_RECORD_MISSING', at, 'the Work tree has no layout tree to place this route in')); return out; }
  const { breakpoints } = matrixOf(tree);
  // Route: in the tree, or declared new under an existing routeParent that is a prefix of it.
  const node = nodeById(tree, route);
  const values = surfaceValues(record);
  const surfaceDefault = typeof record.surface === 'string' ? record.surface : null;
  const needsFile = surfaceDefault && SURFACE_FILE[surfaceDefault] ? SURFACE_FILE[surfaceDefault] : isOverlayRecord(record) && record.routed === true ? 'page' : null;
  const declaredNew = !node || (needsFile && !node.files?.[needsFile]);
  let anchor = route;
  if (declaredNew) {
    const parent = record.routeParent;
    if (typeof parent !== 'string' || !nodeById(tree, parent)) out.push(finding('refuse', 'UI_ROUTE_UNKNOWN', at, `${route} is not a node of the layout tree${node ? ` with a ${needsFile} file` : ''} and routeParent ${parent ?? '(none)'} names no existing node - declare the nearest existing parent it will sit under`));
    else if (!(route === parent || route.startsWith(parent === '/' ? '/' : `${parent}/`))) out.push(finding('refuse', 'UI_ROUTE_UNKNOWN', at, `routeParent ${parent} is not an ancestor of ${route}`));
    else anchor = node ? route : parent;
  }
  // Surface, drawer direction, routed and host - per breakpoint.
  if (!values.length) out.push(finding('refuse', 'UI_SURFACE_MISSING', at, `${route} declares no surface (${SURFACES.join(', ')})`));
  if (record.surface && typeof record.surface === 'object') {
    for (const key of Object.keys(record.surface)) if (key !== 'default' && !breakpoints.includes(key)) out.push(finding('refuse', 'SURFACE_BREAKPOINT_UNKNOWN', at, `surface names breakpoint ${key}, not one of ${breakpoints.join(', ')}`));
    if (values.some((v) => !OVERLAY_SURFACES.has(v))) out.push(finding('refuse', 'SURFACE_INCONSISTENT', at, 'only a modal or drawer varies by breakpoint - a layout, page, loading, error or not-found surface is one surface everywhere'));
  }
  for (const v of values) if (!SURFACES.includes(v)) out.push(finding('refuse', 'SURFACE_INVALID', at, `surface ${v} is not one of ${SURFACES.join(', ')} (a sheet is a drawer with direction bottom)`));
  const drawerAt = breakpoints.filter((bp) => surfaceAt(record, bp) === 'drawer');
  if (drawerAt.length) {
    for (const bp of drawerAt) {
      const d = directionAt(record, bp);
      if (!d) out.push(finding('refuse', 'DRAWER_DIRECTION_MISSING', at, `a drawer at ${bp} names no direction (${DRAWER_DIRECTIONS.join(', ')})`));
      else if (!DRAWER_DIRECTIONS.includes(d)) out.push(finding('refuse', 'DRAWER_DIRECTION_MISSING', at, `direction ${d} at ${bp} is not one of ${DRAWER_DIRECTIONS.join(', ')}`));
    }
    if (record.direction && typeof record.direction === 'object') for (const key of Object.keys(record.direction)) if (key !== 'default' && surfaceAt(record, key) !== 'drawer') out.push(finding('refuse', 'DIRECTION_FORBIDDEN', at, `direction names ${key}, where the surface is ${surfaceAt(record, key) ?? '(none)'}, not a drawer`));
  } else if (record.direction !== undefined) out.push(finding('refuse', 'DIRECTION_FORBIDDEN', at, 'direction belongs to a drawer; this record is no drawer at any breakpoint'));
  const overlay = isOverlayRecord(record);
  if (overlay) {
    if (typeof record.routed !== 'boolean') out.push(finding('refuse', 'OVERLAY_ROUTED_MISSING', at, 'an overlay says routed: true (an intercepting @slot/(.)x route plus a full page x/page.tsx) or routed: false (component state, no URL)'));
    if (typeof record.host !== 'string' || !record.host) out.push(finding('refuse', 'OVERLAY_HOST_MISSING', at, 'an overlay names the host it opens over - a ui record id or a route'));
    else if (!resolveHost(records, record.host) && !(record.host.startsWith('/') && nodeById(tree, record.host))) out.push(finding('refuse', 'OVERLAY_HOST_UNRESOLVED', at, `host ${record.host} is neither a ui record nor a route of the layout tree`));
    if (record.routed === true && !declaredNew) {
      const intercept = nodesOf(tree).find((n) => n.intercepts === route);
      if (!intercept) out.push(finding('refuse', 'ROUTED_INTERCEPT_MISSING', at, `${route} is a routed overlay but no intercepting route (@slot/(.)x) in app/ presents it - declare routeParent until interface.implement adds it`));
    }
  } else {
    if (record.routed !== undefined) out.push(finding('refuse', 'ROUTED_FORBIDDEN', at, '`routed` belongs to a modal or drawer'));
    if (record.host !== undefined) out.push(finding('refuse', 'HOST_FORBIDDEN', at, '`host` belongs to a modal or drawer'));
  }
  if (record.persona !== undefined && !list(tree.personas).some((p) => p?.role === record.persona)) out.push(finding('refuse', 'PERSONA_UNKNOWN', at, `persona ${record.persona} is not a role of the layout tree's personas`));
  // Ancestor layouts: settled, and bound at their current rev.
  const loader = (id) => records.get(id) ?? null;
  const drawingOwnLayout = values.includes('layout') && anchor === route;
  const chain = layoutChainOf(tree, anchor, { self: !drawingOwnLayout }) ?? [];
  const bound = new Map(list(record.shell?.layouts).map((b) => [b?.node, b?.rev]));
  for (const n of chain) {
    const { settled, reasons } = layoutSettlement(tree, n, { shellDir: shell.dir, uiLoader: loader });
    if (!settled) out.push(finding(mode === 'op' ? 'refuse' : 'suspect', 'LAYOUT_ANCESTOR_UNSETTLED', at, `${route} sits under ${n.id}, which is not settled: ${reasons.join('; ')}`));
    if (n.layout?.chrome !== 'visible' || record.shell?.chromeless === true) continue;
    if (!bound.has(n.id)) out.push(finding(level.missing, 'LAYOUT_BINDING_MISSING', at, `shell.layouts does not bind ${n.id} (rev ${n.layout.rev})`));
    else if (bound.get(n.id) !== n.layout.rev) out.push(finding(level.stale, 'LAYOUT_REV_STALE', at, `bound to ${n.id} rev ${bound.get(n.id)}, the layout is at rev ${n.layout.rev} - recompose into its current captures`));
  }
  if (record.shell?.chromeless === true && chain.some((n) => n.layout?.chrome === 'visible')) out.push(finding('refuse', 'SHELL_BINDING_INVALID', at, `chromeless, but ${chain.filter((n) => n.layout?.chrome === 'visible').map((n) => n.id).join(', ')} wraps ${route} with visible chrome`));
  if (record.shell?.activeNav) {
    const keys = chain.flatMap((n) => list(n.layout?.nav?.items).map((i) => i?.key));
    if (!keys.includes(record.shell.activeNav)) out.push(finding('refuse', 'SHELL_BINDING_INVALID', at, `activeNav ${record.shell.activeNav} is not a nav key of any layout above ${route}`));
  }
  // Destinations: a bound one exists on its layout, and activeNav never contradicts the destination the
  // route makes active (the composite shows the route's; a different activeNav would claim another).
  for (const n of chain.filter((x) => x.layout?.chrome === 'visible')) {
    const boundKey = list(record.shell?.layouts).find((b) => b?.node === n.id)?.destination ?? null;
    const dests = destinationsOf(tree, n);
    if (boundKey && !dests.some((d) => d.key === boundKey)) { out.push(finding('refuse', 'SHELL_BINDING_INVALID', at, `shell.layouts binds ${n.id} destination ${boundKey}, which is not a destination of that layout (${dests.map((d) => d.key).join(', ') || 'none recorded'})`)); continue; }
    const byRoute = destinationFor(tree, n, { route });
    const nav = record.shell?.activeNav;
    if (nav && byRoute?.destination && dests.some((d) => d.key === nav) && byRoute.destination.key !== nav && !boundKey) out.push(finding(level.stale, 'ACTIVE_NAV_CONFLICT', at, `activeNav ${nav} names a destination of ${n.id}, but ${route} makes ${byRoute.destination.key} active there - fix activeNav, or bind shell.layouts[{node: ${n.id}}].destination`));
  }
  out.push(...checkComposites(workRoot, uiFile, record, shell, { mode, level, records, anchor, drawingOwnLayout, overlay }));
  if (mode === 'op') out.push(...checkPromptLocale(workRoot, uiFile, record, shell));
  return out;
}

function checkComposites(workRoot, uiFile, record, shell, { mode, level, records, anchor, drawingOwnLayout, overlay }) {
  const out = [];
  const at = shown(workRoot, uiFile);
  const tree = shell.record;
  const { breakpoints, themes } = matrixOf(tree);
  const uiDir = path.dirname(uiFile);
  const assets = assetsOf(record);
  const composites = assets.filter((a) => a.composite && typeof a.composite === 'object');
  const generated = assets.filter((a) => a.generation && a.role !== 'direction-content' && !a.composite);
  for (const a of generated) out.push(finding(level.missing, 'COMPOSITE_MISSING', at, `${a.path} is a generated direction with no composite block - ImageGen draws only the slot content; place it with node scripts/work/compose-direction.mjs`));
  const loader = (id) => records.get(id) ?? null;
  for (const a of composites) {
    const c = a.composite;
    const where = `${a.path} (${c.breakpoint}/${c.theme} ${c.presentation})`;
    if (c.route !== record.route) out.push(finding('refuse', 'COMPOSITE_INCONSISTENT', at, `${where} composes route ${c.route}, the record is ${record.route}`));
    if (!breakpoints.includes(c.breakpoint) || !themes.includes(c.theme)) out.push(finding('refuse', 'COMPOSITE_INCONSISTENT', at, `${where} is not a breakpoint/theme of the layout tree`));
    if (c.surface !== surfaceAt(record, c.breakpoint)) out.push(finding('refuse', 'COMPOSITE_INCONSISTENT', at, `${where} says surface ${c.surface}, the record is a ${surfaceAt(record, c.breakpoint) ?? '(none)'} at ${c.breakpoint}`));
    if (!fs.existsSync(path.join(uiDir, a.path))) out.push(finding('refuse', 'COMPOSITE_FILE_MISSING', at, `${a.path} is not on disk`));
    if (!c.content?.path || !fs.existsSync(path.join(uiDir, c.content.path))) out.push(finding('refuse', 'COMPOSITE_FILE_MISSING', at, `${where}: its content ${c.content?.path ?? '(none)'} is not on disk`));
    if (c.presentation === 'page') {
      if (overlay && record.routed !== true) out.push(finding('refuse', 'OVERLAY_PAGE_FORBIDDEN', at, `${where}: a non-routed ${c.surface} has no URL and is drawn only over its host`));
      // The expected capture is selected exactly as the compositor selects it: the active destination's
      // render when the layout records destinations. The same bytes recorded under another path of the same
      // layout (the default capture and a destination capture of one render) are the same base.
      const expected = baseLayoutFor(tree, anchor, c.breakpoint, c.theme, { shellDir: shell.dir, uiLoader: loader, self: !drawingOwnLayout, ui: record });
      const sameBase = expected && !expected.missing && c.layout?.sha256 === expected.sha256 && (c.layout?.capture === expected.rel || list(expected.equivalents).includes(c.layout?.capture));
      const otherRenderOfNode = expected && !expected.missing && nodeById(tree, expected.node) ? capturesAt(tree, nodeById(tree, expected.node), c.breakpoint, c.theme).find((x) => x.rel === c.layout?.capture) : null;
      if (expected?.missing) out.push(finding(mode === 'op' ? 'refuse' : 'suspect', 'COMPOSITE_LAYOUT_MISMATCH', at, `${where}: ${expected.missing}`));
      else if (!expected && c.layout) out.push(finding(level.stale, 'COMPOSITE_LAYOUT_MISMATCH', at, `${where} is composed into ${c.layout.capture}, but no visible layout wraps ${record.route}`));
      else if (expected && !sameBase && expected.destination && otherRenderOfNode && otherRenderOfNode.sha256 === c.layout?.sha256) out.push(finding(level.stale, 'COMPOSITE_DESTINATION_MISMATCH', at, `${where} is composed into ${c.layout.capture} (${otherRenderOfNode.destination ? `destination ${otherRenderOfNode.destination}` : `the default render of ${expected.node}`}), but ${record.route} shows destination ${expected.destination} active (by ${expected.by}) - recompose into ${expected.rel}`));
      else if (expected && !sameBase) out.push(finding(level.stale, 'COMPOSITE_LAYOUT_MISMATCH', at, `${where} is composed into ${c.layout?.capture ?? 'a blank canvas'}${c.layout?.sha256 ? ` (${c.layout.sha256.slice(0, 12)})` : ''}, not the current ${expected.node} capture ${expected.rel}${expected.destination ? ` (destination ${expected.destination})` : ''} (${expected.sha256?.slice(0, 12)}) - recompose`));
      if (drawingOwnLayout && !c.childSlot) out.push(finding('refuse', 'COMPOSITE_CHILD_SLOT_MISSING', at, `${where}: a layout drawing leaves its page slot keyed #FF00FF and records the measured childSlot`));
    } else if (c.presentation === 'overlay') {
      if (!overlay) out.push(finding('refuse', 'COMPOSITE_INCONSISTENT', at, `${where}: only a modal or drawer has an overlay presentation`));
      const host = resolveHost(records, record.host);
      const [hostId, hostPath] = String(c.host?.asset ?? '').split(/:(.+)/);
      const hostAsset = host && hostId === host.id ? assetsOf(host.record).find((x) => x.path === hostPath) : null;
      if (!hostAsset) out.push(finding('refuse', 'COMPOSITE_HOST_MISMATCH', at, `${where} is drawn over ${c.host?.asset ?? '(nothing)'}, which is not an asset of host ${record.host}`));
      else {
        if (hostAsset.sha256 !== c.host.sha256) out.push(finding(level.stale, 'COMPOSITE_HOST_MISMATCH', at, `${where}: host ${c.host.asset} changed since this overlay was drawn over it - recompose`));
        if (hostAsset.composite?.breakpoint !== c.breakpoint || hostAsset.composite?.theme !== c.theme || hostAsset.composite?.presentation !== 'page') out.push(finding('refuse', 'COMPOSITE_HOST_MISMATCH', at, `${where} is drawn over a host image of another breakpoint, theme or presentation`));
      }
      if (c.surface === 'drawer' && c.direction !== directionAt(record, c.breakpoint)) out.push(finding('refuse', 'COMPOSITE_DIRECTION_MISMATCH', at, `${where} anchors the drawer ${c.direction ?? '(nowhere)'}, the record says ${directionAt(record, c.breakpoint) ?? '(none)'} at ${c.breakpoint}`));
    } else out.push(finding('refuse', 'COMPOSITE_INCONSISTENT', at, `${a.path}: presentation ${c.presentation ?? '(none)'} is neither page nor overlay`));
    if (mode === 'op' && fs.existsSync(path.join(uiDir, a.path))) {
      const again = recompose(workRoot, uiFile, c, { uiRecords: records });
      let stored = null;
      try { stored = pixelSha256(decodePng(fs.readFileSync(path.join(uiDir, a.path)))); } catch (error) { out.push(finding('refuse', 'COMPOSITE_NOT_REPRODUCIBLE', at, `${a.path} does not decode (${error.message})`)); }
      if (!again.ok) out.push(finding('refuse', 'COMPOSITE_NOT_REPRODUCIBLE', at, `${where} cannot be re-derived: ${again.error}`));
      else if (stored && (again.pixelSha256 !== stored || c.pixelSha256 !== stored)) out.push(finding('refuse', 'COMPOSITE_NOT_REPRODUCIBLE', at, `${where}: its pixels are not the recorded content placed into the recorded base - the image was edited or composed from other inputs`));
    }
  }
  // Every drawn state is drawn at desktop AND mobile in the light theme, in each presentation it has (owner
  // ruling 2026-09-24); dark and any other breakpoint are optional extras, never demanded.
  const required = requiredMatrixOf(tree);
  const cells = new Map();
  for (const a of composites) {
    const k = `${a.composite.flowState ?? 'default'} ${a.composite.presentation}`;
    if (!cells.has(k)) cells.set(k, new Set());
    cells.get(k).add(`${a.composite.breakpoint}/${a.composite.theme}`);
  }
  for (const [k, have] of cells) {
    const [state, presentation] = k.split(' ');
    const missing = required.breakpoints.flatMap((bp) => required.themes.map((th) => `${bp}/${th}`)).filter((cell) => !have.has(cell));
    if (missing.length) out.push(finding(mode === 'op' ? 'refuse' : 'suspect', 'DRAW_MATRIX_INCOMPLETE', at, `state ${state} (${presentation}) is drawn at ${[...have].sort().join(', ')} but not at ${missing.join(', ')} - every drawn state has its part at desktop and mobile in the light theme`));
  }
  // A routed overlay is drawn both ways - over its dimmed host and as the full page inside its layout chain.
  if (overlay && record.routed === true && composites.length) {
    const key = (c) => `${c.breakpoint}/${c.theme}`;
    const over = new Set(composites.filter((a) => a.composite.presentation === 'overlay').map((a) => key(a.composite)));
    const page = new Set(composites.filter((a) => a.composite.presentation === 'page').map((a) => key(a.composite)));
    const missing = [...[...over].filter((k) => !page.has(k)).map((k) => `${k} page`), ...[...page].filter((k) => !over.has(k)).map((k) => `${k} overlay`)];
    if (!over.size || !page.size) missing.push(!over.size ? 'every overlay presentation' : 'every page presentation');
    if (missing.length) out.push(finding(mode === 'op' ? 'refuse' : 'suspect', 'ROUTED_OVERLAY_PRESENTATION_MISSING', at, `a routed ${surfaceValues(record).join('/')} is drawn over its host AND as its full page - missing: ${missing.join(', ')}`));
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
    if (!fs.existsSync(file)) { out.push(finding('refuse', 'SHELL_PROMPT_UNREADABLE', at, `${asset.path}: its prompt ${promptPath} is not on disk`)); continue; }
    if (!new RegExp(`product[\\s_-]?locale\\s*[:=]\\s*${escapeRe(locale)}(?![A-Za-z0-9-])`, 'i').test(fs.readFileSync(file, 'utf8'))) out.push(finding('refuse', 'SHELL_LOCALE_DRIFT', at, `${promptPath} does not state "Product locale: ${locale}" - UI copy follows the layout tree's productLocale, not owner_language`));
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// An implementation record
// ---------------------------------------------------------------------------------------------------------

/** Findings about one implementation record: each routed ui record it builds has its app/ files. */
export function checkImplementationRecord(workRoot, implFile, record, shell) {
  const at = shown(workRoot, implFile);
  if (!shell) return [finding('refuse', 'SHELL_RECORD_MISSING', at, 'the tree has no shell/index.yaml layout tree to build routes into')];
  if (shell.error) return [];
  if (!isLayoutTree(shell.record)) return [finding('refuse', 'SHELL_RECORD_LEGACY', at, `the shell record is not a layout tree - ${CONVERT_HINT}`)];
  const tree = shell.record;
  const records = loadUiRecords(workRoot);
  const ids = [...new Set([...list(record.proves), ...list(record.refs), ...list(record.dependsOn)].filter((id) => typeof id === 'string' && id.startsWith('ui.')))];
  const routed = ids.map((id) => records.get(id)).filter((e) => typeof e?.record?.route === 'string');
  if (!routed.length) return [finding('info', 'IMPL_NO_ROUTED_UI', at, `builds no ui record with a route (${ids.join(', ') || 'none named'}); no app/ path to verify`)];
  const located = locateAppDir(workRoot, tree);
  if (!located.appDir || !fs.existsSync(located.appDir)) return [finding('refuse', 'IMPL_APP_DIR_UNREADABLE', at, `${tree.app?.appDir ?? 'app/'} is not readable, so the created route files cannot be verified`)];
  const scan = scanAppDir(located.appDir, { repoRoot: located.repoRoot });
  const fileAt = (id, kind) => {
    const dir = path.join(located.appDir, ...id.split('/').filter(Boolean));
    return SOURCE_EXT.some((ext) => fs.existsSync(path.join(dir, `${kind}${ext}`)));
  };
  const out = [];
  for (const { record: ui } of routed) {
    const values = surfaceValues(ui);
    const wants = [];
    for (const v of new Set(values)) if (SURFACE_FILE[v]) wants.push(SURFACE_FILE[v]);
    if (isOverlayRecord(ui) && ui.routed === true) wants.push('page');
    for (const kind of new Set(wants)) if (!fileAt(ui.route, kind)) out.push(finding('refuse', 'IMPL_ROUTE_FILE_MISSING', at, `${ui.id} is a ${values.join('/')} at ${ui.route}, but ${slash(path.relative(located.repoRoot, located.appDir))}${ui.route === '/' ? '' : ui.route}/${kind}.tsx does not exist`));
    if (isOverlayRecord(ui) && ui.routed === true && !scan.nodes.some((n) => n.intercepts === ui.route)) out.push(finding('refuse', 'IMPL_INTERCEPT_MISSING', at, `${ui.id} is a routed overlay: an intercepting route (@slot/(.)segment/page.tsx) presenting ${ui.route} must exist beside its full page`));
  }
  // A build that changed a recorded layout file leaves the tree stale for its owner to re-capture.
  const fresh = new Map(scan.nodes.map((n) => [n.id, n]));
  for (const n of nodesOf(tree).filter((x) => x.files?.layout?.sha256)) if (fresh.get(n.id)?.files?.layout?.sha256 && fresh.get(n.id).files.layout.sha256 !== n.files.layout.sha256) out.push(finding('suspect', 'LAYOUT_SOURCE_DRIFT', at, `${n.id} layout changed since the tree recorded it - brand.decide re-scans and re-captures`));
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------------------

const listYaml = (dir) => {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ['node_modules', 'assets', 'evidence', 'runs', '_derived', 'kernel-evidence', 'kernel-strays', 'kernel-approvals'].includes(entry.name) ? [] : listYaml(full);
    return entry.name === 'index.yaml' ? [full] : [];
  });
};

const uiRecordsUnder = (root) => listYaml(root).map((file) => ({ file, record: readRecord(file) })).filter(({ record }) => record?.schema === UI_SCHEMA);

/**
 * What `starci validate` reports for every ui record under `root`: records drawn before the layout tree (no
 * binding, no route, a stale rev, a legacy shell) are suspects; a declared route/surface/overlay that does not
 * hold together is refused. Composite pixels are not re-derived here - that is the op proof's.
 */
export function shellBindingFindings(root, workRoot = workRootOf(root)) {
  const shell = readShell(workRoot);
  const uiRecords = loadUiRecords(workRoot);
  const out = uiRecordsUnder(root).flatMap(({ file, record }) => checkUiRecord(workRoot, file, record, shell, { mode: 'validate', uiRecords }));
  const shellInScope = shell && path.resolve(shell.file).startsWith(path.resolve(root));
  if (shellInScope && shell.record?.schema === LEGACY_SHELL_SCHEMA) out.push(finding('suspect', 'SHELL_RECORD_LEGACY', shown(workRoot, shell.file), `${LEGACY_SHELL_SCHEMA} is superseded by the layout tree (${TREE_SCHEMA}); ${CONVERT_HINT}`));
  return out;
}

/**
 * The whole check for one target: a work tree, the shell dir, a ui record dir or an implementation record dir.
 * `advisoryCodes`: finding codes a contract change added after the checked leg was admitted
 * (--admitted-at, modules/kernel/contract-changes.yaml) - suspects for that leg, never refusals.
 */
export function checkShellConformance(target, { advisoryCodes = [] } = {}) {
  const resolved = path.resolve(target);
  const dir = fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
  const workRoot = workRootOf(dir);
  const shell = readShell(workRoot);
  const indexFile = path.join(dir, 'index.yaml');
  const own = fs.existsSync(indexFile) ? readRecord(indexFile) : null;
  const findings = [];
  const uiRecords = loadUiRecords(workRoot);
  let mode;
  if (own?.schema === UI_SCHEMA) {
    mode = 'ui';
    // A ui record needs the tree whole and its own ancestors settled - not every layout of the product.
    if (shell && own.shell?.chromeless !== true) findings.push(...checkShellRecord(workRoot, shell, { requireAll: false, uiRecords }).filter((f) => f.code !== 'ROUTE_NOT_IN_NAV'));
    findings.push(...checkUiRecord(workRoot, indexFile, own, shell, { mode: 'op', uiRecords }));
  } else if (own?.schema === IMPL_SCHEMA) {
    mode = 'implementation';
    findings.push(...checkImplementationRecord(workRoot, indexFile, own, shell));
  } else if (own?.schema === TREE_SCHEMA || own?.schema === LEGACY_SHELL_SCHEMA) {
    mode = 'shell';
    findings.push(...checkShellRecord(workRoot, shell, { uiRecords }));
  } else {
    mode = 'tree';
    if (shell) findings.push(...checkShellRecord(workRoot, shell, { uiRecords }));
    else findings.push(finding('refuse', 'SHELL_RECORD_MISSING', shown(workRoot, path.join(workRoot, 'shell', 'index.yaml')), 'the tree has no layout tree record'));
    for (const { file, record } of uiRecordsUnder(dir)) findings.push(...checkUiRecord(workRoot, file, record, shell, { mode: 'op', uiRecords }));
  }
  const advisory = new Set(advisoryCodes);
  for (const f of findings) if (f.level === 'refuse' && advisory.has(f.code)) Object.assign(f, { level: 'suspect', advisory: true });
  const pick = (level) => findings.filter((f) => f.level === level).map((f) => `${f.file}: ${f.message} [${f.code}]${f.advisory ? ' (added after this leg was admitted)' : ''}`);
  const refused = pick('refuse');
  return { schema: 'starci/shell-conformance@2', ok: refused.length === 0, mode, target: slash(dir), workRoot: slash(workRoot), refused, suspect: pick('suspect'), info: pick('info'), findings };
}

/** --admitted-at <ISO | epoch ms> [--op <op>]: the finding codes contract changes added after that admission. */
function admittedAdvisory(argv) {
  const at = argv.indexOf('--admitted-at');
  if (at < 0) return { ok: true, codes: [], rest: argv };
  const raw = argv[at + 1];
  const admittedAt = /^\d+$/.test(String(raw)) ? Number(raw) : Date.parse(String(raw));
  if (!Number.isFinite(admittedAt)) return { ok: false };
  const opAt = argv.indexOf('--op');
  const op = opAt >= 0 ? argv[opAt + 1] : null;
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const { codes } = advisoryCodesFor(loadContractChanges(root), { admittedAt, op });
  const drop = new Set([at, at + 1, ...(opAt >= 0 ? [opAt, opAt + 1] : [])]);
  return { ok: true, codes, rest: argv.filter((_, index) => !drop.has(index)) };
}

export function shellConformanceMain(argv = []) {
  const admitted = admittedAdvisory(argv);
  if (!admitted.ok) return { exitCode: 2, text: '--admitted-at takes an ISO date-time or epoch milliseconds (api op-contract --json admission.admittedAt)\n' };
  argv = admitted.rest;
  const args = argv.filter((a) => a !== '--json');
  if (args.includes('--help') || args.includes('-h') || args.length !== 1) {
    return { exitCode: args.length === 1 ? 0 : 2, text: 'Usage: node scripts/checks/shell-conformance.mjs <work-root | shell-dir | ui-record-dir | impl-record-dir> [--json]\n\nHolds the layout tree (.starciwork/shell/index.yaml, work/layout-tree@1), every ui record\'s route, surface, ancestors and composites, and an implementation\'s app/ files to the real frontend. Exit 0 is clean, 1 lists refusals, 2 is a bad argument.\n' };
  }
  if (!fs.existsSync(args[0])) return { exitCode: 2, text: `${args[0]}: target does not exist\n` };
  const result = checkShellConformance(args[0], { advisoryCodes: admitted.codes });
  if (argv.includes('--json')) return { exitCode: result.ok ? 0 : 1, text: `${JSON.stringify(result, null, 2)}\n` };
  const lines = [...result.refused.map((l) => `  REFUSED ${l}`), ...result.suspect.map((l) => `  SUSPECT ${l}`), ...result.info.map((l) => `  info    ${l}`)];
  return { exitCode: result.ok ? 0 : 1, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${result.ok ? 'OK' : 'FAIL'}: shell conformance (${result.mode}) - ${result.refused.length} refused, ${result.suspect.length} suspect.\n` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = shellConformanceMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
