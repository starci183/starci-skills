#!/usr/bin/env node
// shell-conformance.mjs — every drawn and built screen sits inside the product's REAL layout tree.
//
//   starci work shell-conformance <work-root | shell-dir | ui-record-dir | impl-record-dir> [--json]
//
// The shell record (.starciwork/shell/index.yaml) is the layout tree, work/layout-tree@1: the frontend's
// Next.js app/ directory scanned into one node per segment (scripts/work/layout-tree.mjs), each layout with
// its chrome decision, its navigation (labels out of the i18n catalogs) and real captures per breakpoint and
// theme with the page slot measured. Directions are the generated slot content composited into those
// captures (scripts/work/compose-direction.mjs), so this check is STRUCTURAL - it reads records, digests and
// pixels, never the wording of a prompt, with one exception kept on purpose: a content prompt states
// `Product locale: <default>`, because UI copy follows productLocale and not owner_language.
//
//   shell record   a layout tree (any other schema is SHELL_RECORD_NOT_TREE), nodes whole,
//                  lockups and captures on disk with their digests, every visible layout settled, nav
//                  labels in the default locale and nav routes that land on a page, and (origin repository)
//                  a re-scan of app/ that still matches the recorded source digest (message catalogs judged
//                  only by the keys the tree uses, i18n.used).
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
//   geometry       every html direction a ui record declares is rendered at its breakpoint (or at every
//                  breakpoint of the tree) and measured by scripts/work/ui/grammar-geometry.mjs --check against
//                  the app's fe side's own HeroUI + Grammar + family CSS: GEOMETRY_OFF_GRAMMAR names each
//                  button, input, card, badge or text run off the grammar; GEOMETRY_CHECK_FAILED when the check
//                  could not run (fails closed); GEOMETRY_UNCHECKED (info) when the app has no fe side yet.
//   brand palette  every drawn part and composite a ui record declares, every layout capture of the tree and
//                  every running-page capture of an implementation record is painted in the brand record's
//                  colours (scripts/work/brand/brand-palette.mjs): PALETTE_OFF_BRAND names each foreign colour, its
//                  area share and the nearest brand token; PRIMARY_ABSENT when that colour stands in for the
//                  brand primary. Owner 2026-09-24: a product part drew its primary in blue, the brand is red.
//
// Exit 0 clean, 1 lists refusals, 2 is a bad argument. `starci runtime validate` runs the ui half through
// shellBindingFindings() without the pixel re-derivation, and reports what records drawn before this model
// lack (no binding, no route, a stale rev) as suspects, never refusals.
import fs from 'node:fs';
import { capturesOf } from '../impl-captures.mjs';
import path from 'node:path';
import {
  SURFACE_FILE, TREE_SCHEMA,
  captureFileOf, capturesAt, destinationsOf, isLayoutTree, lockupSourceOf, isOverlayRecord, layoutSettlement, loadUiRecords, frontendOf, appOfUi, appsOf, appNamesOf, treeOf, matrixOf,
  nodeById, nodesOf, readShellRecord as readShell, requiredMatrixOf, resolveNavRoute, scanAppDir, sourceDrift, surfaceValues,
} from '../layout-tree.mjs';
import { brandOf, brandPalette, paletteFindings } from '../brand/brand-palette.mjs';
import { isPartName } from '../direction-part.mjs';
import { assetsOf, indexFilesUnder, list, readYamlOrNull as readRecord, sha256File, slash, workRootOf as enclosingWorkRoot } from '../work-io.mjs'; import { isMain } from '../../lib/is-main.mjs';
import { checkUiRecord } from './shell-conformance-ui.mjs';
import { finding, shown } from './shell-findings.mjs';

export { checkDrawGeometry } from './shell-conformance-geometry.mjs';

const UI_SCHEMA = 'work/ui-screen@1';
const IMPL_SCHEMA = 'work/implementation@1';
const SOURCE_EXT = ['.tsx', '.ts', '.jsx', '.js', '.mdx'];


/** The Work root enclosing `dir` (work-io.mjs workRootOf), else `dir` itself. */
const workRootOf = (dir) => enclosingWorkRoot(dir) ?? path.resolve(dir);

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


/**
 * Whether a ui record is the drawing of a planned visible layout - `surface: layout` at a planned node whose
 * layout.design names it. That draw is the one a greenfield lockup is cropped from, so it cannot wait for one.
 */
export function isPlannedLayoutDrawing(tree, record) {
  if (!isLayoutTree(tree) || record?.surface !== 'layout' || typeof record.route !== 'string') return false;
  const resolved = appOfUi(tree, record);
  if (resolved.error) return false;
  const node = nodeById(resolved.tree, record.route);
  return Boolean(node?.origin === 'planned' && node.layout?.chrome === 'visible' && node.layout.design === record.id);
}

// ---------------------------------------------------------------------------------------------------------
// The tree record
// ---------------------------------------------------------------------------------------------------------

function shellNodeFindings(r, appNames, at, inApp, out) {
  for (const name of appNames) {
    const tree = treeOf(r, name), nodes = nodesOf(tree), ids = new Set();
    for (const node of nodes) {
      if (ids.has(node.id)) out.push(finding('refuse', 'LAYOUT_TREE_INVALID', at, inApp(name, `node ${node.id} appears twice`)));
      ids.add(node.id);
      if (node.parent !== null && !nodes.some((parent) => parent.id === node.parent)) out.push(finding('refuse', 'LAYOUT_TREE_INVALID', at, inApp(name, `node ${node.id} names parent ${node.parent}, which is not a node`)));
    }
    if (!nodes.some((node) => node.id === '/')) out.push(finding('refuse', 'LAYOUT_TREE_INVALID', at, inApp(name, 'the tree has no root node /')));
  }
}

/** The one finding of a tree with no brand lockup: deferred while the planned layout is drawn, else missing. */
function lockupAbsentFinding(lockupDeferredFor, at) {
  if (lockupDeferredFor) return finding('info', 'SHELL_LOCKUP_DEFERRED', at, `no brand lockup yet: ${lockupDeferredFor} draws the planned layout it will be cropped from (layout-tree.mjs lockup --from ${lockupDeferredFor}:<layout composite>)`);
  return finding('refuse', 'SHELL_LOCKUP_MISSING', at, 'no brand lockup: the rendered lockup is what every direction is handed instead of an invented logo');
}

/** The ui record `id`, loading the work tree's ui records into `state` on first use; null when it has none. */
function cachedUiRecord(state, workRoot, id) {
  state.uiRecords ??= loadUiRecords(workRoot);
  return state.uiRecords.get(id) ?? null;
}

/** One lockup image: on disk with its digest, and (cropped from a layout drawing) from a drawing that has not moved. */
function lockupImageFindings(workRoot, r, image, at, loader) {
  const out = [];
  const file = captureFileOf(image), named = image.name ?? '(no name)';
  if (!file || !fs.existsSync(file)) out.push(finding('refuse', 'SHELL_CAPTURE_MISSING', at, `lockup ${named} is not in the blob store`));
  else if (image.sha256 && sha256File(file) !== image.sha256) out.push(finding('refuse', 'SHELL_CAPTURE_DIGEST', at, `lockup ${named} no longer hashes to its recorded sha256`));
  if (image.source?.kind !== 'layout-drawing') return out;
  const src = lockupSourceOf(r, workRoot, image.source.ref, loader);
  if (src.error) out.push(finding('suspect', 'SHELL_LOCKUP_SOURCE_STALE', at, `lockup ${image.path} was cropped from ${image.source.ref}: ${src.error} - brand.decide re-crops it`));
  else if (src.sha256 !== image.source.sha256) out.push(finding('suspect', 'SHELL_LOCKUP_SOURCE_STALE', at, `lockup ${image.path} was cropped from ${image.source.ref}, which was redrawn since - brand.decide re-crops it`));
  if (r.origin === 'repository') out.push(finding('suspect', 'SHELL_LOCKUP_FROM_DRAWING', at, `lockup ${image.path} is cropped from the layout drawing ${image.source.ref}; the frontend exists now - re-crop it from a real render (layout-tree.mjs lockup --from shell/<capture>)`));
  return out;
}

function shellLockupFindings(workRoot, r, lockups, lockupDeferredFor, at, loader, out) {
  if (!lockups.length) out.push(lockupAbsentFinding(lockupDeferredFor, at));
  for (const image of lockups) out.push(...lockupImageFindings(workRoot, r, image, at, loader));
}

function shellMetadataFindings(r, at, out) {
  const declared = matrixOf(r), required = requiredMatrixOf(r);
  for (const bp of required.breakpoints) if (!declared.breakpoints.includes(bp)) out.push(finding('refuse', 'SHELL_BREAKPOINT_MISSING', at, `the tree declares no ${bp} breakpoint - every drawing set covers ${required.breakpoints.join(' and ')}`));
  for (const theme of required.themes) if (!declared.themes.includes(theme)) out.push(finding('refuse', 'SHELL_THEME_MISSING', at, `the tree declares no ${theme} theme - every drawing set covers ${required.themes.join(', ')} (dark is optional)`));
  const personas = list(r.personas);
  if (!personas.length) out.push(finding('refuse', 'SHELL_PERSONA_INVALID', at, 'no demo persona - a drawing may not invent a tenant'));
  const roles = personas.map((persona) => persona?.role);
  if (new Set(roles).size !== roles.length) out.push(finding('refuse', 'SHELL_PERSONA_INVALID', at, 'two personas share a role'));
  if (personas.length > 1 && personas.filter((persona) => persona?.default === true).length !== 1) out.push(finding('refuse', 'SHELL_PERSONA_INVALID', at, 'more than one persona and not exactly one marked default'));
}

function shellLocaleFindings(locale, at, out) {
  const locales = list(locale.locales);
  if (locale.default && locales.length && !locales.includes(locale.default)) out.push(finding('refuse', 'SHELL_LOCALE_INVALID', at, `productLocale.default ${locale.default} is not one of productLocale.locales`));
  if (locale.fallback && locales.length && !locales.includes(locale.fallback)) out.push(finding('refuse', 'SHELL_LOCALE_INVALID', at, `productLocale.fallback ${locale.fallback} is not one of productLocale.locales`));
}

/** Whether a route is the layout's own or one below it, and a node of the tree. */
const routeAtOrBelow = (tree, node, route) => Boolean(nodeById(tree, route)) && (route === node.id || String(route).startsWith(node.id === '/' ? '/' : `${node.id}/`));

/** One destination of a layout: recorded once, active for at least one route at or below the layout, on a visible layout. */
function destinationFindings(tree, node, destination, seenKeys, at, out) {
  if (seenKeys.has(destination.key)) out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} records destination ${destination.key} twice`));
  seenKeys.add(destination.key);
  if (!destination.routes.length) out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} destination ${destination.key} names no route it is active for`));
  for (const route of destination.routes) if (!routeAtOrBelow(tree, node, route)) out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} destination ${destination.key} is active for ${route}, which is not a node at or below the layout`));
  if (node.layout.chrome !== 'visible') out.push(finding('refuse', 'LAYOUT_DESTINATION_INVALID', at, `${node.id} is ${node.layout.chrome}, and only a visible layout has destinations`));
}

function shellDestinationFindings(tree, node, at, out) {
  const seenKeys = new Set();
  for (const destination of destinationsOf(tree, node)) destinationFindings(tree, node, destination, seenKeys, at, out);
}

function shellNavigationFindings(tree, nodes, node, locale, at, out) {
  for (const item of list(node.layout.nav?.items)) {
    const label = item?.labels?.[locale.default];
    if (!(typeof label === 'string' && label.trim())) out.push(finding('suspect', 'SHELL_NAV_LABEL_MISSING', at, `${node.id} nav item ${item?.key ?? '(unnamed)'} has no ${locale.default ?? '(unset)'} label in the catalogs`));
    if (typeof item?.route === 'string' && !resolveNavRoute(nodes, item.route, tree.app?.localeParam ?? null)) out.push(finding('suspect', 'NAV_ROUTE_MISSING', at, `${node.id} nav item ${item.key} navigates to ${item.route}, which no page of the tree answers`));
  }
  for (const item of list(node.layout.nav?.findings)) {
    if (item.code === 'ROUTE_NOT_IN_NAV' || item.code === 'NAV_REGISTRY_UNREAD') out.push(finding('suspect', item.code, at, `${node.id}: ${item.detail}`));
    else if (item.code === 'NAV_ROUTE_NULL') out.push(finding('info', item.code, at, `${node.id}: ${item.detail}`));
  }
}

function shellLayoutFindings({shell,locale,at,requireAll,loader,out},tree,nodes,node){
  if(requireAll){
    const {settled,reasons}=layoutSettlement(tree,node,{shellDir:shell.dir,uiLoader:loader});
    if(!settled)out.push(finding('refuse','LAYOUT_UNSETTLED',at,reasons.join('; ')));
  }
  shellDestinationFindings(tree,node,at,out);
  shellNavigationFindings(tree,nodes,node,locale,at,out);
}

function shellSourceFindings({workRoot,r,at,inApp,driftLevel,out},tree,name){
  if(r.origin!=='repository'||!tree.source?.digest)return;
  const located=frontendOf(workRoot),appDirOf=tree.app?.appDir?path.join(located.repoRoot,tree.app.appDir):null;
  if(!appDirOf||!fs.existsSync(appDirOf))out.push(finding('info','SHELL_SOURCE_UNAVAILABLE',at,inApp(name,`${tree.app?.appDir??'app/'} is not readable here; the recorded digests could not be compared`)));
  else{let scan=null;
    try{scan=scanAppDir(appDirOf,{repoRoot:located.repoRoot,name});}catch(error){out.push(finding('info','SHELL_SOURCE_UNAVAILABLE',at,inApp(name,`app/ could not be scanned (${error.message})`)));}
    const drift=scan?sourceDrift(tree,scan):null;if(drift?.stale)out.push(finding(driftLevel,'LAYOUT_TREE_STALE',at,inApp(name,`app/ changed since the scan (${drift.changed.slice(0,6).join(', ')})`)+` - brand.decide re-runs starci work layout-tree scan --work <.starciwork> --write and re-captures what moved`));
  }
}

/** One app of the shell record: its layouts, and (when `verifySource`) its scanned source. `scope` is the record's checking context. */
function shellAppFindings(scope,name){
  const {r,verifySource}=scope;
  const tree=treeOf(r,name),nodes=nodesOf(tree);
  for(const node of nodes.filter(entry=>entry.layout))shellLayoutFindings(scope,tree,nodes,node);
  if(verifySource&&r.origin==='repository'&&tree.source?.digest)shellSourceFindings(scope,tree,name);
}

/** Findings about the shell record itself. `verifySource` re-scans app/ and compares the recorded digest. */
function checkShellRecord(workRoot,shell,{verifySource=true,driftLevel='refuse',uiRecords=null,requireAll=true,lockupDeferredFor=null}={}){
  const out=[],at=shown(workRoot,shell.file);
  if(shell.error)return [finding('refuse','SHELL_RECORD_INVALID',at,`the shell record ${shell.error}`)];
  const r=shell.record;
  if(r.schema!==TREE_SCHEMA)return [finding('refuse','SHELL_RECORD_NOT_TREE',at,`names schema ${r.schema??'(none)'}, not ${TREE_SCHEMA} - the shell record is a layout tree`)];
  if(requireAll&&r.state!=='done')out.push(finding('refuse','SHELL_UNSETTLED',at,`the layout tree is ${r.state??'stateless'}, not done`));
  if(!appsOf(r).length)out.push(finding('refuse','LAYOUT_TREE_INVALID',at,'the tree declares no app'));
  const appNames=appNamesOf(r),inApp=(name,text)=>appNames.length>1?`app ${name}: ${text}`:text;
  shellNodeFindings(r,appNames,at,inApp,out);
  const uiRecordsState={uiRecords},lockups=list(r.brand?.lockups);
  const loader=id=>cachedUiRecord(uiRecordsState,workRoot,id);
  shellLockupFindings(workRoot,r,lockups,lockupDeferredFor,at,loader,out);
  shellMetadataFindings(r,at,out);
  const locale=r.productLocale??{};
  shellLocaleFindings(locale,at,out);
  const scope={workRoot,r,shell,locale,at,requireAll,loader,inApp,verifySource,driftLevel,out};
  for(const name of appNames)shellAppFindings(scope,name);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// An implementation record
// ---------------------------------------------------------------------------------------------------------

function checkImplementationUiFiles(ui,appDir,repoRoot,at,scan,fileAt,out){
  const values=surfaceValues(ui),wants=[];for(const value of new Set(values))if(SURFACE_FILE[value])wants.push(SURFACE_FILE[value]);
  if(isOverlayRecord(ui)&&ui.routed===true)wants.push('page');
  for(const kind of new Set(wants))if(!fileAt(ui.route,kind))out.push(finding('refuse','IMPL_ROUTE_FILE_MISSING',at,`${ui.id} is a ${values.join('/')} at ${ui.route}, but ${slash(path.relative(repoRoot,appDir))}${ui.route==='/'?'':ui.route}/${kind}.tsx does not exist`));
  if(isOverlayRecord(ui)&&ui.routed===true&&!scan.nodes.some(node=>node.intercepts===ui.route))out.push(finding('refuse','IMPL_INTERCEPT_MISSING',at,`${ui.id} is a routed overlay: an intercepting route (@slot/(.)segment/page.tsx) presenting ${ui.route} must exist beside its full page`));
}

/** Findings about one implementation record: each routed ui record it builds has its app/ files. */
function checkImplementationApp(raw,name,tree,uis,located,at,out){
  const appDir=tree.app?.appDir?path.join(located.repoRoot,tree.app.appDir):null;
  const inApp=(text)=>(appNamesOf(raw).length>1?`app ${name}: ${text}`:text);
  if(!appDir||!fs.existsSync(appDir)){out.push(finding('refuse','IMPL_APP_DIR_UNREADABLE',at,inApp(`${tree.app?.appDir??'app/'} is not readable, so the created route files cannot be verified`)));return;}
  const scan=scanAppDir(appDir,{repoRoot:located.repoRoot,name}),fileAt=(id,kind)=>{const dir=path.join(appDir,...id.split('/').filter(Boolean));return SOURCE_EXT.some(ext=>fs.existsSync(path.join(dir,`${kind}${ext}`)));};
  for(const ui of uis)checkImplementationUiFiles(ui,appDir,located.repoRoot,at,scan,fileAt,out);
  const fresh=new Map(scan.nodes.map(n=>[n.id,n]));
  for(const n of nodesOf(tree).filter(x=>x.files?.layout?.sha256)){if(fresh.get(n.id)?.files?.layout?.sha256&&fresh.get(n.id).files.layout.sha256!==n.files.layout.sha256)out.push(finding('suspect','LAYOUT_SOURCE_DRIFT',at,inApp(`${n.id} layout changed since the tree recorded it - brand.decide re-scans and re-captures`)));}
}

function checkImplementationRecord(workRoot, implFile, record, shell) {
  const at = shown(workRoot, implFile);
  if (!shell) return [finding('refuse', 'SHELL_RECORD_MISSING', at, 'the tree has no shell/index.yaml layout tree to build routes into')];
  if (shell.error) return [];
  if (!isLayoutTree(shell.record)) return [finding('refuse', 'SHELL_RECORD_NOT_TREE', at, `the shell record is not a layout tree (${TREE_SCHEMA})`)];
  const raw = shell.record,records = loadUiRecords(workRoot);
  const ids = [...new Set([...list(record.proves), ...list(record.refs), ...list(record.dependsOn)].filter((id) => typeof id === 'string' && id.startsWith('ui.')))];
  const routed = ids.map((id) => records.get(id)).filter((e) => typeof e?.record?.route === 'string');
  if (!routed.length) return [finding('info', 'IMPL_NO_ROUTED_UI', at, `builds no ui record with a route (${ids.join(', ') || 'none named'}); no app/ path to verify`)];
  const located = frontendOf(workRoot);
  const out = [];
  // Each routed ui record is built in its own app: its app/ directory is where the route files must be.
  const byApp = new Map();
  for (const { record: ui } of routed) {
    const resolved = appOfUi(raw, ui);
    if (resolved.error) { out.push(finding('refuse', resolved.error.code, at, `${ui.id} ${resolved.error.message}`)); continue; }
    if (!byApp.has(resolved.app)) byApp.set(resolved.app, { tree: resolved.tree, uis: [] });
    byApp.get(resolved.app).uis.push(ui);
  }
  for(const [name,{tree,uis}] of byApp)checkImplementationApp(raw,name,tree,uis,located,at,out);
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------------
// Brand palette (scripts/work/brand/brand-palette.mjs): pixels against the brand record, per image
// ---------------------------------------------------------------------------------------------------------

/** The brand and its parsed palette once per run; null (with one info finding) when the tree has no brand record. */
function paletteContext(workRoot) {
  const b = brandOf(workRoot);
  if (!b.brand) return { brand: null, palette: null, note: finding('info', 'BRAND_PALETTE_UNAVAILABLE', shown(workRoot, path.join(workRoot, 'brand', 'index.yaml')), `no readable brand record (${b.error}), so no image was checked against the brand's colours`) };
  return { brand: b.brand, palette: brandPalette(b.brand, { brandDir: b.dir }), note: null };
}

const imageFindings = (workRoot, ctx, at, file, subject, extra = {}) => (fs.existsSync(file)
  ? paletteFindings({ file, shownAs: shown(workRoot, file), brand: ctx.brand, palette: ctx.palette, subject, at, ...extra })
  : []);

/** Every drawn part and composite a ui record declares. */
function uiPaletteFindings(workRoot, uiFile, record, ctx = paletteContext(workRoot)) {
  if (!ctx.brand) return ctx.note ? [ctx.note] : [];
  const at = shown(workRoot, uiFile);
  return assetsOf(record).flatMap((a) => {
    const subject = (()=>{if(a.composite){return 'composite';}if(a.role==='direction-content'||isPartName(a.path)){return 'drawn part';}return null;})();
    return (()=>{if(!subject){return [];}return imageFindings(workRoot,ctx,at,path.join(path.dirname(uiFile),a.path),subject,a.composite?{composite:a.composite,uiDir:path.dirname(uiFile)}:{});})();
  });
}

/** Every layout capture (and destination render) the shell record holds - what brand.decide captured. */
function shellPaletteFindings(workRoot, shell, ctx = paletteContext(workRoot)) {
  if (!shell || shell.error || !isLayoutTree(shell.record)) return [];
  if (!ctx.brand) return ctx.note ? [ctx.note] : [];
  const at = shown(workRoot, shell.file);
  const { breakpoints, themes } = matrixOf(shell.record);
  const seen = new Set();
  const out = [];
  for (const {node,c} of layoutCapturesOf(shell.record,breakpoints,themes)) {
    if (seen.has(c.rel)) continue;
    seen.add(c.rel);
    out.push(...imageFindings(workRoot, ctx, at, captureFileOf(c), `layout capture of ${node.id}${c.destination ? ' (' + c.destination + ')' : ''}`));
  }
  return out;
}

function* layoutCapturesOf(tree,breakpoints,themes){
  for(const node of nodesOf(tree)){for(const bp of breakpoints){for(const theme of themes){for(const capture of capturesAt(tree,node,bp,theme)){yield {node,c:capture};}}}}
}

/** Every running-page capture an implementation record cites (blobs, scripts/work/impl-captures.mjs). */
function implementationPaletteFindings(workRoot, implFile, ctx = paletteContext(workRoot)) {
  if (!ctx.brand) return ctx.note ? [ctx.note] : [];
  const at = shown(workRoot, implFile);
  return capturesOf(path.dirname(implFile), readRecord(implFile)).filter((c) => c.png).flatMap((c) => imageFindings(workRoot, ctx, at, c.png, `running-page capture ${c.name}`));
}

const uiRecordsUnder = (root) => indexFilesUnder(root).map((file) => ({ file, record: readRecord(file) })).filter(({ record }) => record?.schema === UI_SCHEMA);

/**
 * What `starci runtime validate` reports for every ui record under `root`: records drawn before the layout tree (no
 * binding, no route, a stale rev) are suspects; a declared route/surface/overlay that does not
 * hold together is refused. Composite pixels are not re-derived here - that is the op proof's.
 */
export function shellBindingFindings(root, workRoot = workRootOf(root)) {
  const shell = readShell(workRoot);
  const uiRecords = loadUiRecords(workRoot);
  const out = uiRecordsUnder(root).flatMap(({ file, record }) => checkUiRecord(workRoot, file, record, shell, { mode: 'validate', uiRecords }));
  const shellInScope = shell && path.resolve(shell.file).startsWith(path.resolve(root));
  if (shellInScope && shell.record && !shell.error && !isLayoutTree(shell.record)) out.push(finding('refuse', 'SHELL_RECORD_NOT_TREE', shown(workRoot, shell.file), `the shell record names schema ${shell.record.schema ?? '(none)'}, not ${TREE_SCHEMA}`));
  return out;
}

/** A ui record: the shell record it is bound to (its ROUTE_NOT_IN_NAV info omitted), the record itself, its images. */
function uiTargetFindings(workRoot, indexFile, own, shell, uiRecords) {
  const findings = [];
  const lockupDeferredFor = shell && !shell.error && isPlannedLayoutDrawing(shell.record, own) ? own.id : null;
  if (shell && own.shell?.chromeless !== true) findings.push(...checkShellRecord(workRoot, shell, { requireAll: false, uiRecords, lockupDeferredFor }).filter((f) => f.code !== 'ROUTE_NOT_IN_NAV'));
  findings.push(...checkUiRecord(workRoot, indexFile, own, shell, { mode: 'op', uiRecords }), ...uiPaletteFindings(workRoot, indexFile, own));
  return findings;
}

/** A work root or any other directory: the shell record, its images, and every ui record below the directory. */
function treeTargetFindings(workRoot, dir, shell, uiRecords) {
  const findings = [];
  if (shell) findings.push(...checkShellRecord(workRoot, shell, { uiRecords }));
  else findings.push(finding('refuse', 'SHELL_RECORD_MISSING', shown(workRoot, path.join(workRoot, 'shell', 'index.yaml')), 'the tree has no layout tree record'));
  const palette = paletteContext(workRoot);
  if (shell) findings.push(...shellPaletteFindings(workRoot, shell, palette));
  for (const { file, record } of uiRecordsUnder(dir)) findings.push(...checkUiRecord(workRoot, file, record, shell, { mode: 'op', uiRecords }), ...uiPaletteFindings(workRoot, file, record, palette));
  return findings;
}

function targetFindings(workRoot, dir, indexFile, own, shell, uiRecords) {
  switch (own?.schema) {
    case UI_SCHEMA: return { mode: 'ui', findings: uiTargetFindings(workRoot, indexFile, own, shell, uiRecords) };
    case IMPL_SCHEMA: return { mode: 'implementation', findings: [...checkImplementationRecord(workRoot, indexFile, own, shell), ...implementationPaletteFindings(workRoot, indexFile)] };
    case TREE_SCHEMA: return { mode: 'shell', findings: [...checkShellRecord(workRoot, shell, { uiRecords }), ...shellPaletteFindings(workRoot, shell)] };
    default: return { mode: 'tree', findings: treeTargetFindings(workRoot, dir, shell, uiRecords) };
  }
}

/** Check the actual tree, shell, UI or implementation record under current structural rules. */
export function checkShellConformance(target) {
  const resolved = path.resolve(target);
  const dir = fs.existsSync(resolved) && fs.statSync(resolved).isFile() ? path.dirname(resolved) : resolved;
  const workRoot = workRootOf(dir);
  const shell = readShell(workRoot);
  const indexFile = path.join(dir, 'index.yaml');
  const own = fs.existsSync(indexFile) ? readRecord(indexFile) : null;
  const uiRecords = loadUiRecords(workRoot);
  const {mode,findings}=targetFindings(workRoot,dir,indexFile,own,shell,uiRecords);
  const pick = (level) => findings.filter((f) => f.level === level).map((f) => `${f.file}: ${f.message} [${f.code}]`);
  const refused = pick('refuse');
  return { schema: 'starci/shell-conformance@2', ok: refused.length === 0, mode, target: slash(dir), workRoot: slash(workRoot), refused, suspect: pick('suspect'), info: pick('info'), findings };
}

export function shellConformanceMain(argv = []) {
  const args = argv.filter((a) => a !== '--json');
  if (args.includes('--help') || args.includes('-h') || args.length !== 1) {
    return { exitCode: args.length === 1 ? 0 : 2, text: 'Usage: starci work shell-conformance <work-root | shell-dir | ui-record-dir | impl-record-dir> [--json]\n\nHolds the layout tree (.starciwork/shell/index.yaml, work/layout-tree@1), every ui record\'s route, surface, ancestors and composites, and an implementation\'s app/ files to the real frontend. Exit 0 is clean, 1 lists refusals, 2 is a bad argument.\n' };
  }
  if (!fs.existsSync(args[0])) return { exitCode: 2, text: `${args[0]}: target does not exist\n` };
  const result = checkShellConformance(args[0]);
  if (argv.includes('--json')) return { exitCode: result.ok ? 0 : 1, text: `${JSON.stringify(result, null, 2)}\n` };
  const lines = [...result.refused.map((l) => `  REFUSED ${l}`), ...result.suspect.map((l) => `  SUSPECT ${l}`), ...result.info.map((l) => `  info    ${l}`)];
  return { exitCode: result.ok ? 0 : 1, text: `${lines.join('\n')}${lines.length ? '\n' : ''}${result.ok ? 'OK' : 'FAIL'}: shell conformance (${result.mode}) - ${result.refused.length} refused, ${result.suspect.length} suspect.\n` };
}

if (isMain(import.meta.url)) {
  const result = shellConformanceMain(process.argv.slice(2));
  process.stdout.write(result.text);
  process.exitCode = result.exitCode;
}
