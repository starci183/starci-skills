// lane-owner.mjs — the ONE rule for whether a lane worktree may be removed (coordinator 2026-09-28: GC removed the
// rc-job and rc-cleanup worktrees right after they landed, while their agents still worked in them). Both removers
// use it: the Supervisor GC (scripts/supervisor/gc.mjs collectLanes) and housekeeping (scripts/lib/hk-lanes.mjs
// sweepLanes). A lane worktree qualifies only when it is merged, clean, had no git activity for LANE_IDLE_MS (60 min)
// AND has no live owner (laneOwnerOf):
//   - a connected Orca terminal titled "[Worker] <lane> ..." (the lane name: the branch without lane/, or the folder
//     name; matched exactly, so "[Worker] slim-api" does not own lane "slim"), or working inside the lane folder;
//   - a Supervisor job that is not final registered for it (its staging branch or path).
// When Orca does not answer, nobody can rule an owner out: nothing is removed.
import path from 'node:path';
import { pathKey } from './path-key.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { readSupervisor, FIX_KIND } from '../supervisor/home.mjs';

export const LANE_IDLE_MS = 3_600_000;
const SUP_FINAL = new Set(['succeeded', 'failed', 'cancelled']);
const under = (child, root) => { const a = pathKey(child), b = pathKey(root); return a === b || a.startsWith(`${b}/`); };

/** Tab titles by handle from terminal-list visualLayouts (the title the runtime gave the tab, which agents never rewrite). */
export function tabTitles(visualLayouts = []) {
  const out = new Map();
  const panes = (p, tab) => {
    if (!p) return;
    if (p.type === 'terminal' && p.handle) out.set(p.handle, tab);
    for (const c of p.children ?? []) panes(c, tab);
    if (p.first) panes(p.first, tab);
    if (p.second) panes(p.second, tab);
  };
  const walk = (n) => {
    if (!n) return;
    for (const t of n.tabs ?? []) panes(t.panes, t.title ?? null);
    for (const c of n.children ?? []) walk(c);
    if (n.first) walk(n.first);
    if (n.second) walk(n.second);
  };
  for (const l of visualLayouts ?? []) walk(l.root);
  return out;
}

/**
 * The live owner of a lane worktree (a reason string), or null. Pure. `terminals`: terminal-list rows, or null when
 * Orca did not answer; `titles`: handle -> tab title; `sup`: {jobs: [{jobId, status, branch, stagingPath}]}.
 */
export function laneOwnerOf({ lanePath, branch = null, terminals, titles = new Map(), sup = { jobs: [] } }) {
  if (!Array.isArray(terminals)) return 'the Orca terminal list is unavailable: a live owner cannot be ruled out';
  const short = String(branch ?? '').replace(/^refs\/heads\//, '');
  const names = [...new Set([short.replace(/^lane\//, ''), path.basename(String(lanePath ?? ''))].filter(Boolean))];
  const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const named = names.map((n) => new RegExp(`^\\[Worker\\]\\s+${esc(n)}(?![\\w.-])`, 'i'));
  for (const t of terminals) {
    if (t.connected === false) continue;
    const title = String(titles.get(t.handle) ?? t.title ?? '').trim();
    if (named.some((re) => re.test(title) || re.test(String(t.title ?? '').trim()))) return `live terminal ${t.handle} "${title.slice(0, 60)}"`;
    if (t.worktreePath && under(t.worktreePath, lanePath)) return `live terminal ${t.handle} works in it (${t.worktreePath})`;
  }
  for (const j of sup?.jobs ?? []) {
    if (SUP_FINAL.has(j.status)) continue;
    if ((short && j.branch === short) || (j.stagingPath && under(j.stagingPath, lanePath))) return `Supervisor job ${j.jobId} (${j.status}) is registered for it`;
  }
  return null;
}

/**
 * The live owner evidence, read once: {terminals (null when Orca did not answer or machine.sqlite is unreadable),
 * titles, sup}. Synchronous, as sweepLanes is.
 */
export function liveLaneOwners({ env = process.env, list = () => terminalList({ includeVisualLayouts: true }) } = {}) {
  let terminals = null, titles = new Map();
  try {
    const listed = list();
    if (listed?.ok) { terminals = listed.terminals ?? []; titles = tabTitles(listed.visualLayouts); }
  } catch { terminals = null; }
  let sup = { jobs: [] };
  try {
    // machine.sqlite sup_jobs (the Supervisor's runtime.fix jobs); null when the store cannot be read.
    sup = { jobs: readSupervisor((m) => m.listSupJobs({ kind: FIX_KIND }).map((r) => {
      const p = r.payload ?? {};
      return { jobId: r.job_id, status: r.status, branch: p.staging?.branch ?? null, stagingPath: p.staging?.path ?? null };
    }), null, { env }) };
    if (!Array.isArray(sup.jobs)) sup = null;
  } catch { sup = null; }
  // An unreadable machine.sqlite is an owner nobody can rule out either.
  if (!sup) terminals = null;
  return { terminals, titles, sup: sup ?? { jobs: [] } };
}
