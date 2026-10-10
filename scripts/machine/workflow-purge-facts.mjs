// workflow-purge-facts.mjs - everything a purge reads about one archived workflow, in one place, read only: the ledger (workflow-purge-ledger.mjs),
// the machine registry (worktree rows, seats, Decision Items, the journal), the git refs (workflow-purge-refs.mjs), Orca (its worktree
// ps, terminals and the workers of the workflow's Runs), and the files the runtime wrote for it (job guards, dispatch prompts).
// Nothing here changes anything. The plan (workflow-purge-plan.mjs) judges these facts; the apply (workflow-purge-apply.mjs) acts on the plan.
import fs from 'node:fs';
import path from 'node:path';
import { starciLocalRoot } from '../../engine/runtime-root.mjs';
import { artifactRoot } from '../../engine/db/blob.mjs';
import { eventPayloadOf } from '../../engine/db/event-payload.mjs';
import { parseJson } from '../lib/json.mjs';
import { parseRuntimeStamp, psCoverage } from '../lib/orca-orphans.mjs';
import { worktreePs } from '../api/orca/worktree-ps.mjs';
import { terminalList } from '../api/orca/terminal-list.mjs';
import { workerListAll } from './worker-list-all.mjs';
import { hostLockOwner } from './host-lock.mjs';
import { mainRootOf } from './worktree-git.mjs';
import { treeKey, withRegistry } from './worktree-registry.mjs';
import { purgeLedgerFacts } from './workflow-purge-ledger.mjs';
import { workflowRefsOf } from './workflow-purge-refs.mjs';

/** The Orca reads a purge makes, one seam: ps (worktrees), terminals, workers(run). A spec replaces it with a fake. */
const orcaReads = Object.freeze({ ps: () => worktreePs(), terminals: () => terminalList(), workers: (run) => workerListAll({ run }) });

/** The key of a purge in progress in machine_meta: its plan, so a crashed apply resumes and its event counts the whole run. */
export const purgeMetaKey = (workflowId) => `workflow-purge:${workflowId}`;

const OPEN_DECISION = "('open','claimed','escalated')";

// The registry side: every worktree row the workflow ever had, the seats and open Decision Items that name it, its journal event and a
// purge in progress.
function machineFactsOf(workflowId, env) {
  return withRegistry((m) => ({
    rows: m.db.prepare('SELECT * FROM worktrees WHERE workflow_id=? ORDER BY created_at, path').all(workflowId),
    seats: m.db.prepare('SELECT seat_id, state FROM seats WHERE workflow_id=?').all(workflowId).map((seat) => ({ seatId: seat.seat_id, state: seat.state })),
    decisions: m.db.prepare(`SELECT di_id, kind, status FROM sup_decision_items WHERE workflow_id=? AND status IN ${OPEN_DECISION} ORDER BY opened_at`).all(workflowId)
      .map((di) => ({ diId: di.di_id, kind: di.kind, status: di.status })),
    purgedAt: m.db.prepare("SELECT created_at FROM sup_events WHERE kind='workflow-purged' AND entity_type='workflow' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(workflowId)?.created_at ?? null,
    // A launch that failed after the stop is journalled here, not in the archived ledger (an archived ledger takes no event).
    launchFailures: m.db.prepare("SELECT CASE WHEN payload_sha IS NULL THEN payload_json END AS payload_json, payload_sha FROM sup_events WHERE kind='kernel-start-failed' AND entity_id=? ORDER BY seq").all(workflowId).map((row) => eventPayloadOf(row, { root: artifactRoot(env) }) ?? {}),
    inProgress: parseJson(m.db.prepare('SELECT value FROM machine_meta WHERE key=?').get(purgeMetaKey(workflowId))?.value, null),
  }), env);
}

// The trees of the workflow: its live registry rows, its closed rows whose directory still stands (a removal that failed), and the trees Orca
// lists with the runtime's stamp for it and no row (a crash between Orca's create and the bind). One entry per directory.
function treesOf({ rows, orcaPs, workflowId }) {
  const trees = new Map();
  const add = (tree) => { const key = treeKey(tree.path); if (!trees.has(key)) trees.set(key, { ...tree, path: path.resolve(tree.path), exists: fs.existsSync(tree.path) }); };
  for (const row of rows) {
    if (row.removed_at == null || fs.existsSync(row.path)) {
      add({ path: row.path, repoRoot: row.repo_root, kind: row.kind, orcaId: row.orca_id ?? null, branch: row.branch ?? null, registered: true, pending: row.kind === 'workflow' && !row.orca_id });
    }
  }
  for (const w of orcaPs.ok ? orcaPs.worktrees : []) {
    const stamp = parseRuntimeStamp(w.comment);
    if (!w.path || w.isMainWorktree || stamp?.workflowId !== workflowId) continue;
    const mains = orcaPs.worktrees.filter((x) => x.isMainWorktree && x.repoId === w.repoId);
    add({ path: w.path, repoRoot: mains[0]?.path ?? null, kind: stamp.kind, orcaId: w.id, branch: w.branch ?? null, registered: false, pending: false });
  }
  return [...trees.values()].filter((tree) => tree.repoRoot);
}

// The files whose JSON names the workflow: the job guards (jobs/) and the terminal bindings (terminals/) under the guards root the caller names.
function guardFilesOf(workflowId, root) {
  const out = [];
  for (const sub of ['jobs', 'terminals']) {
    const dir = path.join(root, sub);
    let names = [];
    try { names = fs.readdirSync(dir); } catch { names = []; }
    for (const name of names.filter((n) => n.endsWith('.json'))) {
      const file = path.join(dir, name);
      if (parseJson(fs.readFileSync(file, 'utf8'), null)?.workflowId === workflowId) out.push(file);
    }
  }
  return out;
}

const PROMPT_READ_BYTES = 1_048_576;

// The prompt files the runtime spilled to <state>/dispatch-prompts that name the workflow: a file is named by a hash of its launch, so only its text can tie it.
function promptFilesOf(workflowId, env) {
  const dir = path.join(starciLocalRoot(env), 'dispatch-prompts'), out = [];
  let names = [];
  try { names = fs.readdirSync(dir); } catch { names = []; }
  for (const name of names.filter((n) => n.endsWith('.md'))) {
    const file = path.join(dir, name);
    try {
      const stat = fs.statSync(file);
      if (stat.isFile() && stat.size <= PROMPT_READ_BYTES && fs.readFileSync(file, 'utf8').includes(workflowId)) out.push(file);
    } catch { /* a file another launch removed first */ }
  }
  return out;
}

// The workers of every Run the ledger names, per Run: a Run whose listing failed contributes no row and is reported, so it proves nothing.
function workersOf(runIds, orca) {
  const rows = [], unreadable = [];
  for (const run of runIds) {
    let listed;
    try { listed = orca.workers(run); } catch (error) { listed = { ok: false, error: String(error?.message ?? error) }; }
    if (listed?.ok && Array.isArray(listed.workers) && listed.scope?.source === 'flag' && listed.scope.run === run
      && listed.workers.every(worker => worker.runId === run)) rows.push(...listed.workers);
    else unreadable.push({ run, error: String(listed?.error ?? 'worker-list did not answer the requested Run').slice(0, 200) });
  }
  // Every Run's workers: an unreadable global listing cannot prove the workflow's trees have no unknown custody.
  let others = [];
  try {
    const all = orca.workers(undefined);
    if (all?.ok && Array.isArray(all.workers) && all.scope?.source === 'all' && all.scope.run == null) others = all.workers.filter((w) => !runIds.includes(w.runId));
    else unreadable.push({ run: null, error: String(all?.error ?? 'worker-list did not cover every Run').slice(0, 200) });
  } catch (error) { unreadable.push({ run: null, error: String(error?.message ?? error).slice(0, 200) }); }
  return { rows, unreadable, others };
}

// The ledger's evidence plus the failed launches the machine journal holds.
const withLaunchFailures = (base, failures) => {
  const more = (key) => failures.map((failure) => failure[key]).filter((value) => typeof value === 'string' && value);
  return { handles: [...new Set([...base.handles, ...more('terminal')])], runIds: [...new Set([...base.runIds, ...more('runId')])],
    dispatchIds: [...new Set([...base.dispatchIds, ...more('dispatch')])], preservedRefs: base.preservedRefs };
};

const reposOf = (trees, rows) => [...new Map([...trees.map((t) => t.repoRoot), ...rows.map((r) => r.repo_root)].filter((r) => r && fs.existsSync(r)).map((r) => [treeKey(r), mainRootOf(r)])).values()];

/**
 * The facts of a purge: {ledger, machine, trees, refs, workers: {rows, unreadable}, terminals, orca: {readable, complete}, guards, prompts, hostLock}.
 * ledger.found false when the workflow is unknown. guardsDir: the guards root, read by the caller (scripts/guards/guards-root.mjs). Seams (deps): orca (orcaReads' shape), lockOwner.
 */
export function purgeFactsOf({ repo, workflowId, guardsDir, env = process.env, deps = {} }) {
  const orca = deps.orca ?? orcaReads;
  const ledger = purgeLedgerFacts({ repo, workflowId, env });
  const machine = machineFactsOf(workflowId, env);
  let ps;
  try { ps = orca.ps(); } catch (error) { ps = { ok: false, worktrees: [], error: String(error?.message ?? error) }; }
  let terminals;
  try { terminals = orca.terminals(); } catch (error) { terminals = { ok: false, terminals: [], error: String(error?.message ?? error) }; }
  const trees = treesOf({ rows: machine.rows, orcaPs: ps, workflowId });
  const evidence = withLaunchFailures(ledger.evidence ?? { handles: [], runIds: [], dispatchIds: [], preservedRefs: [] }, machine.launchFailures);
  const jobIds = (ledger.jobs ?? []).map((job) => job.jobId);
  const rowBranches = machine.rows.filter((row) => row.kind === 'workflow' && row.branch).map((row) => row.branch);
  const refs = reposOf(trees, machine.rows).flatMap((repoRoot) => workflowRefsOf({ repoRoot, workflowId, rowBranches, jobIds, preservedRefs: evidence.preservedRefs, trees: trees.map((tree) => tree.path) }));
  const owner = (deps.lockOwner ?? hostLockOwner)({ env });
  return { ledger, machine, trees, refs, evidence, workers: workersOf(evidence.runIds, orca), terminals: terminals.ok ? terminals.terminals : [],
    orca: { readable: ps.ok === true && terminals.ok === true, complete: psCoverage(ps).complete, error: ps.ok ? terminals.error ?? null : ps.error ?? null },
    guards: guardFilesOf(workflowId, guardsDir), prompts: promptFilesOf(workflowId, env), hostLock: owner && !owner.stale ? { role: owner.role, purpose: owner.purpose, pid: owner.pid } : null };
}
