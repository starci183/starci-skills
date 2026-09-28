// importsBroken — the IMPORTS_BROKEN_AFTER_MOVE invariant (DESIGN §16.7, FMEA #20): after a wave's slices land, the
// workflow's code must import only paths that exist before the next wave dispatches. fe-canon 2026-09-28: 26 files
// still imported the old `@/i18n` paths after slice 1 moved them, and the breakage read as "checker unavailable".
//
// Scanned tree: each of the workflow's integration worktrees (<repo>/.starciwork/worktrees/<wf>/_wf); a workflow that
// never isolated (a legacy shared-tree cut still running) scans the live checkout its cut targets. Value, when broken:
//   {code: 'IMPORTS_BROKEN_AFTER_MOVE', rcaCause: 'broken-import', count, files, sample, trees, repointQueued,
//    blocksNextWave}
// blocksNextWave is true while imports are broken and no repoint (canon-wire) unit is queued or running: the Job
// controller does not dispatch the next wave then (lane B reads it; lane F's SLA clocks it). A checker failure caused
// by an unresolved import is RCA cause `broken-import`, never `checker-unavailable`. Cached per tree state.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { brokenImports } from '../import-scan.mjs';
import { isolatedJobs, layoutOf, productSettings, git } from '../product-worktree.mjs';
import { ownedPathPlacements, projectBinding } from '../target-repo.mjs';

const cache = new Map();
const LIVE = ['queued', 'leased', 'running', 'answering', 'effect_unknown'];
const parse = (t) => { try { return JSON.parse(t); } catch { return {}; } };

/** The trees to scan for one workflow: its _wf worktrees, else the live checkout a legacy running cut edits. */
export function importTreesOf(db, { workflowId, repo }) {
  const trees = [...new Set(isolatedJobs(db, { workflowId }).map((j) => layoutOf({ repoRoot: j.record.repoRoot, workflowId }).workflow.path))].filter((p) => fs.existsSync(p));
  if (trees.length) return trees.map((p) => ({ path: p, kind: 'workflow' }));
  const cut = db.prepare(`SELECT op_id, payload_json FROM jobs WHERE workflow_id=? AND op_id='code.refactor' AND json_extract(payload_json,'$.cut.id') IS NOT NULL
    AND status IN (${LIVE.map(() => '?').join(',')}) LIMIT 1`).get(workflowId, ...LIVE);
  if (!cut) return [];
  const binding = projectBinding(repo);
  const payload = parse(cut.payload_json);
  const owned = (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean).slice(0, 3);
  let placements = [];
  try { placements = ownedPathPlacements({ op: cut.op_id, payload, ownedPaths: owned, repo, worktree: null, timeoutMs: 20_000 }); } catch { placements = []; }
  const roots = [...new Set(placements.filter((p) => !p.unresolved && p.role && p.role !== binding?.ownerRole).map((p) => binding?.repos.find((r) => r.role === p.role)?.root).filter(Boolean))];
  return roots.map((p) => ({ path: path.resolve(p), kind: 'live' }));
}

const stateKey = (tree) => {
  const head = git(tree.path, ['rev-parse', 'HEAD']).stdout;
  const dirty = tree.kind === 'live' ? crypto.createHash('sha1').update(git(tree.path, ['status', '--porcelain', '--untracked-files=no']).stdout).digest('hex').slice(0, 12) : '';
  return `${tree.path}\0${head}\0${dirty}`;
};

export default {
  key: 'importsBroken',
  compute(ctx) {
    if (ctx.wf?.phase === 'finished' || ctx.wf?.archived_at) return null;
    const trees = importTreesOf(ctx.db, { workflowId: ctx.workflowId, repo: ctx.repo });
    if (!trees.length) return null;
    const ttl = productSettings().invariant.importsCacheMs;
    const now = ctx.now ?? Date.now();
    let count = 0, files = 0;
    const sample = [], scanned = [];
    for (const tree of trees) {
      const key = stateKey(tree);
      let hit = cache.get(key);
      if (!hit || now - hit.at > ttl) { hit = { at: now, value: brokenImports(tree.path, { limit: 10 }) }; cache.set(key, hit); }
      count += hit.value.count; files += hit.value.files;
      sample.push(...hit.value.broken.slice(0, 5).map((b) => ({ ...b, tree: tree.path })));
      scanned.push({ path: tree.path, kind: tree.kind, count: hit.value.count });
    }
    if (!count) return null;
    const repointQueued = Boolean(ctx.db.prepare(`SELECT 1 FROM jobs WHERE workflow_id=? AND op_id='code.refactor' AND json_extract(payload_json,'$.params.canonWire')=1
      AND status IN (${LIVE.map(() => '?').join(',')}) LIMIT 1`).get(ctx.workflowId, ...LIVE));
    return { code: 'IMPORTS_BROKEN_AFTER_MOVE', rcaCause: 'broken-import', count, files, sample: sample.slice(0, 10), trees: scanned, repointQueued, blocksNextWave: !repointQueued };
  },
  lines: (v) => [`IMPORTS_BROKEN_AFTER_MOVE ${v.count} import(s) in ${v.files} file(s) resolve to nothing (${v.trees.map((t) => `${t.kind} ${t.path}`).join('; ')})`
    + `${v.repointQueued ? ' - a repoint unit is queued' : ' - NO repoint unit queued: enqueue one wave canon-wire unit owning the importers before the next wave'}; e.g. ${v.sample.slice(0, 3).map((s) => `${s.from} -> ${s.spec}`).join('; ')}`],
};
