// workflow-purge-plan.mjs - the plan of a workflow purge: the preconditions judged from the facts (each a catalogued refusal), and the exact set the
// apply removes. Pure over workflow-purge-facts.mjs; the plan carries a sha so an apply names the plan it was shown (`--expect`), and the
// journal event records it.
import path from 'node:path';
import { canonicalJSON } from '../../engine/canonical-json.mjs';
import { sha256 } from '../../engine/digest.mjs';
import { classifyTerminals, classifyWorkers, listStrangerWorkers } from './workflow-purge-orca.mjs';

const PURGE_PLAN_SCHEMA = 'starci/workflow-purge-plan@1';
const LIVE_SEATS = new Set(['booting', 'live', 'busy', 'replacing']);

// The refusals of the ledger and registry side: the workflow is known, archived, and nothing live names it.
function ledgerBlockers(facts, workflowId) {
  const { ledger, machine } = facts;
  if (!ledger.found) return [{ code: 'workflow-purge-unknown', detail: `${workflowId} is in no ledger of this repository` }];
  const out = [];
  if (ledger.phase !== 'archived' || ledger.archivedAt == null) out.push({ code: 'workflow-purge-not-archived', detail: `${workflowId} is ${ledger.phase}: only an archived workflow is purged (starci workflow stop first)` });
  const liveJobs = ledger.jobs.filter((job) => job.live);
  if (liveJobs.length) out.push({ code: 'workflow-purge-live-job', detail: `${liveJobs.length} job(s) still ${[...new Set(liveJobs.map((job) => job.status))].join('/')}: ${liveJobs.slice(0, 5).map((job) => job.jobId).join(', ')}` });
  if (ledger.leases > 0) out.push({ code: 'workflow-purge-live-job', detail: `${ledger.leases} lease row(s) still name the workflow` });
  if (ledger.signal.held) out.push({ code: 'workflow-purge-live-job', detail: 'the Kernel singleton signal is still held' });
  const seats = machine.seats.filter((seat) => LIVE_SEATS.has(seat.state));
  const named = seats.map((seat) => seat.seatId + ' (' + seat.state + ')').join(', ');
  if (seats.length) out.push({ code: 'workflow-purge-live-seat', detail: named + ' is a live seat of the workflow' });
  return out;
}

// The refusals of the host side: Orca must be readable (nothing is proven from a silent Orca), no worker may be live, the host lock must be free.
function hostBlockers(facts, live) {
  const out = [];
  if (!facts.orca.readable) out.push({ code: 'workflow-purge-orca-unreadable', detail: `Orca did not answer: ${facts.orca.error ?? 'no detail'}; no leftover can be proven or closed` });
  for (const run of facts.workers.unreadable) out.push({ code: 'workflow-purge-orca-unreadable', detail: `worker-list for Run ${run.run} failed: ${run.error}` });
  if (live.length) out.push({ code: 'workflow-purge-worker-live', detail: `${live.length} worker(s) of the workflow's Runs are active: ${live.map((w) => w.dispatchId).join(', ')}` });
  const held = facts.hostLock;
  if (held) out.push({ code: 'workflow-purge-host-busy', detail: 'the host lock is held (' + [held.role, held.purpose].filter(Boolean).join(', ') + ', pid ' + held.pid + '); a purge waits for it' });
  return out;
}

const treeAction = (tree) => {
  if (tree.pending) return 'release-slot';
  if (!tree.exists && tree.registered) return 'unregister';
  return tree.orcaId ? 'remove-orca' : 'remove-git';
};

const treeItem = (tree) => ({ path: tree.path, repoRoot: tree.repoRoot, kind: tree.kind, orcaId: tree.orcaId, branch: tree.branch, registered: tree.registered, action: treeAction(tree) });

/** The `ledger` part of the plan: kept by default; with --ledger, archived and dropped through the housekeeping purge (verified zip first). */
const ledgerPart = (facts, ledgerMode) => ({ mode: ledgerMode ? 'purge' : 'keep', phase: facts.ledger.phase ?? null, openRows: facts.ledger.openRows ?? null, purgeState: facts.ledger.purgeState ?? null });

function counts(plan) {
  return { trees: plan.trees.length, refsDeleted: plan.refs.filter((ref) => ref.action === 'delete').length, refsKept: plan.refs.filter((ref) => ref.action === 'keep').length,
    workers: plan.workers.length, terminals: plan.terminals.length, listed: plan.listed.length, guards: plan.guards.length, prompts: plan.prompts.length, decisions: plan.decisions.length };
}

/**
 * The plan of a purge: {schema, workflowId, repo, blockers, trees, refs, workers, terminals, listed, guards, prompts, decisions, ledger, counts, already, sha}.
 * `ok` is true when blockers is empty. `already`: the journal holds the purge and nothing of it remains. facts: purgeFactsOf; ledgerMode: --ledger.
 */
export function buildPurgePlan({ facts, workflowId, repo, ledgerMode = false }) {
  const workers = classifyWorkers(facts.workers.rows);
  const treePaths = facts.trees.map((tree) => tree.path);
  const terminals = classifyTerminals({ terminals: facts.terminals, evidence: facts.evidence, treePaths, workerClose: workers.close });
  // A workflow whose ledger rows are gone after a journalled purge is purged, not unknown.
  const gone = !facts.ledger.found && facts.machine.purgedAt != null;
  const blockers = gone ? [] : [...ledgerBlockers(facts, workflowId), ...(facts.ledger.found ? hostBlockers(facts, workers.live) : [])];
  const plan = { schema: PURGE_PLAN_SCHEMA, workflowId, repo: path.resolve(repo), blockers, trees: facts.trees.map((tree) => treeItem(tree)),
    refs: facts.refs.map((ref) => ({ repoRoot: ref.repoRoot, name: ref.name, kind: ref.kind, tip: ref.tip, proof: ref.proof, action: ref.action, why: ref.why })),
    workers: workers.close.map((worker) => ({ dispatchId: worker.dispatchId, runId: worker.runId, terminal: worker.terminal, state: worker.state, liveness: worker.liveness })),
    terminals: terminals.close.map((terminal) => ({ handle: terminal.handle, cwd: terminal.cwd, title: terminal.title })),
    listed: [...terminals.listed, ...listStrangerWorkers({ rows: facts.workers.others ?? [], treePaths })],
    guards: facts.guards.map((file) => path.resolve(file)), prompts: facts.prompts.map((file) => path.resolve(file)),
    decisions: facts.machine.decisions.map((di) => di.diId), ledger: ledgerPart(facts, ledgerMode) };
  const nothingLeft = !plan.trees.length && !plan.workers.length && !plan.terminals.length && !plan.refs.some((ref) => ref.action === 'delete');
  const already = facts.machine.purgedAt != null && nothingLeft && (gone || !ledgerMode || facts.ledger.purgeState === 'purged');
  return { ...plan, ok: blockers.length === 0, already, counts: counts(plan), sha: sha256(canonicalJSON(plan)) };
}
