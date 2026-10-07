// shell-conformance-geometry.mjs — every html direction of a ui record measured against the product's grammar
// geometry (shell-conformance.mjs, the owner of the findings).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../../api/node/run-node.mjs';
import { frontendOf, isLayoutTree } from '../layout-tree.mjs';
import { assetsOf, list } from '../work-io.mjs';
import { finding, shown } from './shell-findings.mjs';

const GEOMETRY_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'grammar-geometry.mjs');
const geometryViews = (named, breakpoints) => { if (named.length) { return named; } if (breakpoints.length) { return breakpoints; } return [{ name: 'default', width: 390, height: 844 }]; };

function appendGeometryViewFindings(out, a, view, file, repo, at, run) {
  const r = run([GEOMETRY_SCRIPT, '--check', file, '--repo', repo, '--viewport', `${view.width}x${view.height}`, '--json'], { timeout: 240000, maxBuffer: 32 * 1024 * 1024 });
  let parsed = null; try { parsed = JSON.parse(r.stdout ?? ''); } catch { parsed = null; }
  if (r.status === 0 && parsed?.ok) { return; }
  if (r.status === 1 && Array.isArray(parsed?.findings)) {
    for (const f of parsed.findings) { out.push(finding('refuse', 'GEOMETRY_OFF_GRAMMAR', at, `${a.path} at ${view.width}px: ${f.element} ${f.at} ${f.property} is ${f.got}, the product grammar renders ${f.expected}`)); }
    return;
  }
  out.push(finding('refuse', 'GEOMETRY_CHECK_FAILED', at, `${a.path} at ${view.width}px: grammar-geometry.mjs could not measure it (${parsed?.error ?? (r.error?.message || String(r.stderr ?? '').trim().split('\n').pop() || 'exit ' + r.status)})`));
}

/** The layout tree of the shell record and the fe side of the app it resolves to (`repo` null when there is none). */
function geometryTargetOf(workRoot, shell) {
  const tree = shell && !shell.error && isLayoutTree(shell.record) ? shell.record : null;
  const located = tree ? frontendOf(workRoot) : null;
  return { tree, repo: located && !located.error ? located.feRoot : null };
}

/** The viewports an html direction is measured at: the one its asset names, else its breakpoint, else every breakpoint. */
function viewsOfAsset(a, breakpoints) {
  const named = a.viewport?.width && a.viewport?.height ? [{ name: 'asset', width: a.viewport.width, height: a.viewport.height }] : breakpoints.filter((b) => b.name === (a.composite?.breakpoint ?? a.breakpoint));
  return geometryViews(named, breakpoints);
}

/**
 * Every html direction of a ui record measured against the product's grammar geometry (grammar-geometry.mjs
 * --check), at the breakpoint the asset names or at every breakpoint of the layout tree.
 */
export function checkDrawGeometry(workRoot, uiFile, record, shell, { run = runNode } = {}) {
  const htmls = assetsOf(record).filter((a) => /\.html?$/i.test(a.path));
  if (!htmls.length) return [];
  const at = shown(workRoot, uiFile);
  const { tree, repo } = geometryTargetOf(workRoot, shell);
  if (!repo || !fs.existsSync(repo)) return [finding('info', 'GEOMETRY_UNCHECKED', at, `no fe side of the app resolves from the layout tree, so ${htmls.map((a) => a.path).join(', ')} could not be measured against the product CSS`)];
  const breakpoints = list(tree.breakpoints).filter((b) => b?.name && b.width && b.height);
  const out = [];
  for (const a of htmls) {
    const file = path.join(path.dirname(uiFile), a.path);
    if (!fs.existsSync(file)) { out.push(finding('refuse', 'GEOMETRY_CHECK_FAILED', at, `${a.path} is not on disk`)); continue; }
    for (const view of viewsOfAsset(a, breakpoints)) appendGeometryViewFindings(out, a, view, file, repo, at, run);
  }
  return out;
}
