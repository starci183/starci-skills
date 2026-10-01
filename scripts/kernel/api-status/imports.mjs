// importsBroken — the IMPORTS_BROKEN_AFTER_MOVE invariant (DESIGN §16.7, FMEA #20): after a wave's slices land, the
// workflow's code must import only paths that exist before the next wave dispatches. fe-canon 2026-09-28: 26 files
// still imported the old `@/i18n` paths after slice 1 moved them, and the breakage read as "checker unavailable".
//
// Scanned tree: the workflow's own worktree (part A's registry, scripts/kernel/workflow-worktree.mjs): every slice's
// green work is checkpointed there, so a move one slice made is what the next wave's slices build on. A workflow with no
// open worktree scans nothing. Value, when broken:
//   {code: 'IMPORTS_BROKEN_AFTER_MOVE', rcaCause: 'broken-import', count, files, sample, trees, repointQueued,
//    blocksNextWave}
// blocksNextWave is true while imports are broken and no repoint (canon-wire) unit is queued or running: the Job
// controller does not dispatch the next wave then (lane B reads it; lane F's SLA clocks it). A checker failure caused
// by an unresolved import is RCA cause `broken-import`, never `checker-unavailable`. Cached per tree state.
import fs from 'node:fs';
import path from 'node:path';
import { brokenImports } from '../import-scan.mjs';
import { fileURLToPath } from 'node:url';
import { runGit } from '../../lib/git.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { workflowWorktreeOf } from '../workflow-worktree.mjs';

const cache = new Map();
const LIVE = ['queued', 'leased', 'running', 'answering', 'effect_unknown'];

const SETTINGS_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'modules', 'kernel', 'product-land.yaml');
/** modules/kernel/product-land.yaml invariant.importsCacheMs (default 5 min): one scan per tree state within it. */
const importsCacheMs = () => {
  let doc = null;
  try { doc = parseYaml(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { doc = null; }
  const n = Number(doc?.invariant?.importsCacheMs);
  return Number.isFinite(n) && n > 0 ? n : 300_000;
};

/** The trees to scan for one workflow: its open workflow worktree from part A's registry ([] when it has none). */
export function importTreesOf(db, { workflowId, worktreeOf = (id) => workflowWorktreeOf({ env: process.env }, id) }) {
  const rec = worktreeOf(workflowId);
  return rec?.path && fs.existsSync(rec.path) ? [{ path: path.resolve(rec.path), kind: 'workflow', repoRoot: rec.repoRoot ? path.resolve(rec.repoRoot) : null }] : [];
}

const stateKey = (tree) => {
  const r = runGit(['rev-parse', 'HEAD'], { cwd: tree.path, timeout: 60_000 });
  return `${tree.path}\0${String(r.stdout ?? '').trim()}`;
};

/**
 * The invariant value for one workflow, or null when nothing is broken (also read by progress-rca.mjs, which ranks
 * the repoint unit): brokenFiles are the importers to own, repository-qualified (<repo name>/<path>) as owned paths.
 */
export function importsBrokenOf({ db, workflowId, repo, now = Date.now(), worktreeOf }) {
  const trees = importTreesOf(db, { workflowId, ...(worktreeOf ? { worktreeOf } : {}) });
  if (!trees.length) return null;
  const ttl = importsCacheMs();
  let count = 0, files = 0;
  const sample = [], scanned = [], brokenFiles = new Set();
  for (const tree of trees) {
    const key = stateKey(tree);
    let hit = cache.get(key);
    if (!hit || now - hit.at > ttl) { hit = { at: now, value: brokenImports(tree.path, { limit: 400 }) }; cache.set(key, hit); }
    count += hit.value.count; files += hit.value.files;
    sample.push(...hit.value.broken.slice(0, 5).map((b) => ({ ...b, tree: tree.path })));
    const name = tree.repoRoot ? path.basename(tree.repoRoot) : null;
    for (const b of hit.value.broken) brokenFiles.add(name ? `${name}/${b.from}` : b.from);
    scanned.push({ path: tree.path, kind: tree.kind, count: hit.value.count });
  }
  if (!count) return null;
  const repointQueued = Boolean(db.prepare(`SELECT 1 FROM jobs WHERE workflow_id=? AND op_id='code.refactor'
    AND (json_extract(payload_json,'$.params.canonWire')=1 OR json_extract(payload_json,'$.kernelEdit.wire')=1)
    AND status IN (${LIVE.map(() => '?').join(',')}) LIMIT 1`).get(workflowId, ...LIVE));
  return { code: 'IMPORTS_BROKEN_AFTER_MOVE', rcaCause: 'broken-import', count, files, sample: sample.slice(0, 10), brokenFiles: [...brokenFiles].sort().slice(0, 200),
    trees: scanned, repointQueued, blocksNextWave: !repointQueued };
}

export default {
  key: 'importsBroken',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    return importsBrokenOf({ db: ctx.db, workflowId: ctx.workflowId, repo: ctx.repo, now: ctx.now ?? Date.now() });
  },
  lines: (v) => [`IMPORTS_BROKEN_AFTER_MOVE ${v.count} import(s) in ${v.files} file(s) resolve to nothing (${v.trees.map((t) => `${t.kind} ${t.path}`).join('; ')})`
    + `${v.repointQueued ? ' - a repoint unit is queued' : ' - NO repoint unit queued: enqueue one wave canon-wire unit owning the importers before the next wave'}; e.g. ${v.sample.slice(0, 3).map((s) => `${s.from} -> ${s.spec}`).join('; ')}`],
};
