// shell-conformance-composites.mjs — the composites of a ui record held to the layout tree: every direction placed
// into the exact layout capture (or host composite) of its breakpoint and theme (shell-conformance.mjs, the owner).
import fs from 'node:fs';
import path from 'node:path';
import { baseLayoutFor, appOfUi, capturesAt, directionAt, matrixOf, nodeById, requiredMatrixOf, surfaceAt, surfaceValues } from '../layout-tree.mjs';
import { decodePng } from '../png.mjs';
import { pixelSha256, recompose, resolveHost } from '../compose-direction.mjs';
import { generatedDrawingsOf } from './ui-shapes.mjs';
import { assetsOf, list, parseUiRef } from '../work-io.mjs';
import { byCodeUnit } from '../../lib/list.mjs';
import { finding, refuse, shown } from './shell-findings.mjs';

/** The route, breakpoint, theme, surface and files a composite declares against the record and the tree. */
function consistencyFindings(ctx, a, c, where) {
  const { record, tree, uiDir, at } = ctx;
  const { breakpoints, themes } = matrixOf(tree);
  const out = [];
  if (c.route !== record.route) out.push(refuse('COMPOSITE_INCONSISTENT', at, `${where} composes route ${c.route}, the record is ${record.route}`));
  if (!breakpoints.includes(c.breakpoint) || !themes.includes(c.theme)) out.push(refuse('COMPOSITE_INCONSISTENT', at, `${where} is not a breakpoint/theme of the layout tree`));
  if (c.surface !== surfaceAt(record, c.breakpoint)) out.push(refuse('COMPOSITE_INCONSISTENT', at, `${where} says surface ${c.surface}, the record is a ${surfaceAt(record, c.breakpoint) ?? '(none)'} at ${c.breakpoint}`));
  if (!fs.existsSync(path.join(uiDir, a.path))) out.push(refuse('COMPOSITE_FILE_MISSING', at, `${a.path} is not on disk`));
  if (!c.content?.path || !fs.existsSync(path.join(uiDir, c.content.path))) out.push(refuse('COMPOSITE_FILE_MISSING', at, `${where}: its content ${c.content?.path ?? '(none)'} is not on disk`));
  return out;
}

const sameBaseOf = (c, expected) => expected && !expected.missing && c.layout?.sha256 === expected.sha256 && (c.layout?.capture === expected.rel || list(expected.equivalents).includes(c.layout?.capture));

/** Another render of the expected layout node whose capture the composite was placed into. */
const otherRenderOf = (tree, c, expected) => (expected && !expected.missing && nodeById(tree, expected.node) ? capturesAt(tree, nodeById(tree, expected.node), c.breakpoint, c.theme).find((x) => x.rel === c.layout?.capture) : null);

function destinationMismatchFinding({ record, level, at }, c, where, expected, other) {
  const placed = other.destination ? 'destination ' + other.destination : 'the default render of ' + expected.node;
  return finding(level.stale, 'COMPOSITE_DESTINATION_MISMATCH', at, `${where} is composed into ${c.layout.capture} (${placed}), but ${record.route} shows destination ${expected.destination} active (by ${expected.by}) - recompose into ${expected.rel}`);
}

function staleLayoutFinding({ level, at }, c, where, expected) {
  const placed = `${c.layout?.capture ?? 'a blank canvas'}${c.layout?.sha256 ? ' (' + c.layout.sha256.slice(0, 12) + ')' : ''}`;
  const current = `${expected.node} capture ${expected.rel}${expected.destination ? ' (destination ' + expected.destination + ')' : ''} (${expected.sha256?.slice(0, 12)})`;
  return finding(level.stale, 'COMPOSITE_LAYOUT_MISMATCH', at, `${where} is composed into ${placed}, not the current ${current} - recompose`);
}

/** What is wrong with the layout capture a page composite was placed into, if anything. */
function layoutMismatchFinding(ctx, c, where, expected) {
  const { record, tree, mode, level, at } = ctx;
  if (expected?.missing) return finding(mode === 'op' ? 'refuse' : 'suspect', 'COMPOSITE_LAYOUT_MISMATCH', at, `${where}: ${expected.missing}`);
  if (!expected && c.layout) return finding(level.stale, 'COMPOSITE_LAYOUT_MISMATCH', at, `${where} is composed into ${c.layout.capture}, but no visible layout wraps ${record.route}`);
  if (!expected || sameBaseOf(c, expected)) return null;
  const other = otherRenderOf(tree, c, expected);
  if (expected.destination && other && other.sha256 === c.layout?.sha256) return destinationMismatchFinding(ctx, c, where, expected, other);
  return staleLayoutFinding(ctx, c, where, expected);
}

function pageFindings(ctx, c, where) {
  const { record, tree, anchor, shell, loader, drawingOwnLayout, overlay, at } = ctx;
  const out = [];
  if (overlay && record.routed !== true) out.push(refuse('OVERLAY_PAGE_FORBIDDEN', at, `${where}: a non-routed ${c.surface} has no URL and is drawn only over its host`));
  // The expected capture is selected exactly as the compositor selects it: the active destination's
  // render when the layout records destinations. The same bytes recorded under another path of the same
  // layout (the default capture and a destination capture of one render) are the same base.
  const expected = baseLayoutFor(tree, anchor, c.breakpoint, c.theme, { shellDir: shell.dir, uiLoader: loader, self: !drawingOwnLayout, ui: record });
  const mismatch = layoutMismatchFinding(ctx, c, where, expected);
  if (mismatch) out.push(mismatch);
  if (drawingOwnLayout && !c.childSlot) out.push(refuse('COMPOSITE_CHILD_SLOT_MISSING', at, `${where}: a layout drawing leaves its page slot keyed #FF00FF and records the measured childSlot`));
  return out;
}

/** The host asset an overlay is drawn over: still the recorded bytes, and a page composite of its own breakpoint and theme. */
function hostAssetFindings(ctx, c, where, hostAsset) {
  const { level, at } = ctx;
  const out = [];
  if (hostAsset.sha256 !== c.host.sha256) out.push(finding(level.stale, 'COMPOSITE_HOST_MISMATCH', at, `${where}: host ${c.host.asset} changed since this overlay was drawn over it - recompose`));
  if (hostAsset.composite?.breakpoint !== c.breakpoint || hostAsset.composite?.theme !== c.theme || hostAsset.composite?.presentation !== 'page') out.push(refuse('COMPOSITE_HOST_MISMATCH', at, `${where} is drawn over a host image of another breakpoint, theme or presentation`));
  return out;
}

function overlayFindings(ctx, c, where) {
  const { record, records, overlay, at } = ctx;
  const out = [];
  if (!overlay) out.push(refuse('COMPOSITE_INCONSISTENT', at, `${where}: only a modal or drawer has an overlay presentation`));
  const host = resolveHost(records, record.host);
  const hostRef = parseUiRef(c.host?.asset);
  const hostAsset = Boolean(host) && hostRef?.id === host?.id ? assetsOf(host.record).find((x) => x.path === hostRef.path) : null;
  if (!hostAsset) out.push(refuse('COMPOSITE_HOST_MISMATCH', at, `${where} is drawn over ${c.host?.asset ?? '(nothing)'}, which is not an asset of host ${record.host}`));
  else out.push(...hostAssetFindings(ctx, c, where, hostAsset));
  if (c.surface === 'drawer' && c.direction !== directionAt(record, c.breakpoint)) out.push(refuse('COMPOSITE_DIRECTION_MISMATCH', at, `${where} anchors the drawer ${c.direction ?? '(nowhere)'}, the record says ${directionAt(record, c.breakpoint) ?? '(none)'} at ${c.breakpoint}`));
  return out;
}

function presentationFindings(ctx, a, c, where) {
  if (c.presentation === 'page') return pageFindings(ctx, c, where);
  if (c.presentation === 'overlay') return overlayFindings(ctx, c, where);
  return [refuse('COMPOSITE_INCONSISTENT', ctx.at, `${a.path}: presentation ${c.presentation ?? '(none)'} is neither page nor overlay`)];
}

/** The op proof re-derives the composite from its recorded inputs and compares the pixels. */
function reproducibleFindings(ctx, a, c, where) {
  const { mode, workRoot, uiFile, uiDir, records, at } = ctx;
  if (mode !== 'op' || !fs.existsSync(path.join(uiDir, a.path))) return [];
  const out = [];
  const again = recompose(workRoot, uiFile, c, { uiRecords: records });
  let stored = null;
  try { stored = pixelSha256(decodePng(fs.readFileSync(path.join(uiDir, a.path)))); } catch (error) { out.push(refuse('COMPOSITE_NOT_REPRODUCIBLE', at, `${a.path} does not decode (${error.message})`)); }
  if (!again.ok) out.push(refuse('COMPOSITE_NOT_REPRODUCIBLE', at, `${where} cannot be re-derived: ${again.error}`));
  else if (stored && (again.pixelSha256 !== stored || c.pixelSha256 !== stored)) out.push(refuse('COMPOSITE_NOT_REPRODUCIBLE', at, `${where}: its pixels are not the recorded content placed into the recorded base - the image was edited or composed from other inputs`));
  return out;
}

function compositeFindings(ctx, a) {
  const c = a.composite;
  const where = `${a.path} (${c.breakpoint}/${c.theme} ${c.presentation})`;
  return [...consistencyFindings(ctx, a, c, where), ...presentationFindings(ctx, a, c, where), ...reproducibleFindings(ctx, a, c, where)];
}

// Every drawn state is drawn at desktop AND mobile in the light theme, in each presentation it has (owner
// ruling 2026-09-24); dark and any other breakpoint are optional extras, never demanded.
function drawMatrixFindings(tree, composites, mode, at) {
  const required = requiredMatrixOf(tree);
  const cells = new Map();
  for (const a of composites) {
    if (a.retired) continue;
    const k = `${a.composite.flowState ?? 'default'} ${a.composite.presentation}`;
    if (!cells.has(k)) cells.set(k, new Set());
    cells.get(k).add(`${a.composite.breakpoint}/${a.composite.theme}`);
  }
  const out = [];
  for (const [k, have] of cells) {
    const [state, presentation] = k.split(' ');
    const missing = required.breakpoints.flatMap((bp) => required.themes.map((th) => `${bp}/${th}`)).filter((cell) => !have.has(cell));
    if (missing.length) out.push(finding(mode === 'op' ? 'refuse' : 'suspect', 'DRAW_MATRIX_INCOMPLETE', at, `state ${state} (${presentation}) is drawn at ${[...have].sort(byCodeUnit).join(', ')} but not at ${missing.join(', ')} - every drawn state has its part at desktop and mobile in the light theme`));
  }
  return out;
}

// A routed overlay is drawn both ways - over its dimmed host and as the full page inside its layout chain.
function routedOverlayFindings(record, composites, mode, overlay, at) {
  if (!overlay || record.routed !== true || !composites.length) return [];
  const key = (c) => `${c.breakpoint}/${c.theme}`;
  const over = new Set(composites.filter((a) => a.composite.presentation === 'overlay').map((a) => key(a.composite)));
  const page = new Set(composites.filter((a) => a.composite.presentation === 'page').map((a) => key(a.composite)));
  const missing = [...[...over].filter((k) => !page.has(k)).map((k) => `${k} page`), ...[...page].filter((k) => !over.has(k)).map((k) => `${k} overlay`)];
  if (!over.size || !page.size) missing.push(!over.size ? 'every overlay presentation' : 'every page presentation');
  if (!missing.length) return [];
  return [finding(mode === 'op' ? 'refuse' : 'suspect', 'ROUTED_OVERLAY_PRESENTATION_MISSING', at, `a routed ${surfaceValues(record).join('/')} is drawn over its host AND as its full page - missing: ${missing.join(', ')}`)];
}

/** The composites of a ui record: every one placed, consistent with the record, reproducible, and the drawn matrix complete. */
export function checkComposites(workRoot, uiFile, record, shell, { mode, level, records, anchor, drawingOwnLayout, overlay }) {
  const at = shown(workRoot, uiFile);
  const resolved = appOfUi(shell.record, record);
  if (resolved.error) return [];
  const tree = resolved.tree;
  const assets = assetsOf(record);
  const composites = assets.filter((a) => a.composite && typeof a.composite === 'object');
  const generated = generatedDrawingsOf(assets).filter((a) => a.role !== 'direction-content' && !a.composite);
  const out = generated.map((a) => finding(level.missing, 'COMPOSITE_MISSING', at, `${a.path} is a generated direction with no composite block - a drawing is only the slot content; place it with starci work compose-direction`));
  const ctx = { workRoot, uiFile, record, shell, tree, mode, level, records, anchor, drawingOwnLayout, overlay, at, uiDir: path.dirname(uiFile), loader: (id) => records.get(id) ?? null };
  for (const a of composites) out.push(...compositeFindings(ctx, a));
  out.push(...drawMatrixFindings(tree, composites, mode, at), ...routedOverlayFindings(record, composites, mode, overlay, at));
  return out;
}
