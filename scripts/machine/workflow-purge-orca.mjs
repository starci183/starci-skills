// workflow-purge-orca.mjs - which Orca workers and terminals belong to an archived workflow, by evidence only. A worker belongs to it when its
// Run is one the ledger names for the workflow (a job's Run, or the Run of a failed Kernel launch). A terminal belongs to it when the ledger
// names its handle (a job, the Kernel signal, a launch or a failed launch) AND Orca places it inside one of the workflow's trees. Anything
// that only looks like it belongs - a terminal in the tree the ledger never named, a named terminal elsewhere - is listed and never touched.
// Pure over Orca's rows: the reads are workflow-purge-facts.mjs, the closing is workflow-purge-apply.mjs through worker-close.mjs.
import { untiedWhy } from './untied-tree.mjs';
import { releasePlan, terminalHandleOf, worktreePathOf } from '../lib/worker-accounting.mjs';
import { insideTree, sameTree } from './worktree-registry.mjs';

const HELD_STATES = new Set(['active', 'reclaimable', 'retained', 'release_pending', 'release_unknown']);

const workerRow = (plan) => ({ dispatchId: plan.dispatchId, runId: plan.runId, terminal: plan.terminalHandle, state: plan.terminalState, liveness: plan.liveness, reason: plan.reason });

// Context-only Dispatches have a retained projection but no supervised resource. Only Orca's explicit absence
// qualifies: an omitted resource, a workspace or conflicting lifecycle fields keeps custody unknown.
const resourceAbsent = (row) => row?.workerState === 'unsupervised' && row?.terminalState === 'retained'
  && Object.hasOwn(row, 'resource') && row.resource === null
  && row.projection?.resource?.state === 'absent' && row.projection.resource.reason === 'unsupervised'
  && row.projection.workspace === null && row.projection.liveness?.verdict === 'unverifiable'
  && row.projection.liveness.reason === 'unsupervised_settled'
  && row.projection.nextAction?.kind === 'none' && Array.isArray(row.projection.nextAction.argv)
  && row.projection.nextAction.argv.length === 0;

/**
 * The workers of the workflow's Runs: {close: [worker], live: [worker]}. A worker Orca holds (any held state) is closed, except one that is
 * still active and not exited: that one is live, and a purge refuses while it exists.
 */
export function classifyWorkers(rows) {
  const plans = releasePlan(rows);
  const close = [], live = [];
  rows.forEach((row, index) => {
    const plan = plans[index];
    if (plan.terminalState === 'released' || resourceAbsent(row)) return;
    const worker = workerRow(plan);
    if (!HELD_STATES.has(plan.terminalState) || !plan.liveness || (plan.terminalState === 'active' && plan.liveness !== 'exited')) live.push(worker);
    else close.push(worker);
  });
  return { close, live };
}

const cwdOf = (terminal) => terminal.worktreePath ?? terminal.cwd ?? null;

function terminalVerdict(terminal, { named, treePaths, handledByWorker }) {
  const handle = terminal.handle, cwd = cwdOf(terminal);
  const inTree = Boolean(cwd) && treePaths.some((tree) => sameTree(cwd, tree) || insideTree(cwd, tree));
  if (handledByWorker.has(handle)) return null;
  if (named.has(handle) && inTree) return { close: { handle, cwd, title: terminal.title ?? null, connected: terminal.connected !== false } };
  if (named.has(handle)) return { listed: { kind: 'terminal', id: handle, why: `the ledger names it but Orca places it in ${cwd ?? 'no worktree'}, outside the trees of the workflow` } };
  if (inTree) return { listed: { kind: 'terminal', id: handle, holdsTree: true, why: untiedWhy(`it sits in ${cwd}, a tree of the workflow, but no ledger row names its handle`) } };
  return null;
}

/**
 * The terminals to close and the terminals listed: {close: [{handle, cwd, title, connected}], listed: [{kind, id, why}]}.
 * evidence: the ledger's {handles}; treePaths: the workflow's trees; workerClose: the workers being closed (their terminals close with them).
 */
export function classifyTerminals({ terminals, evidence, treePaths, workerClose }) {
  const named = new Set(evidence.handles);
  const handledByWorker = new Set(workerClose.map((worker) => worker.terminal).filter(Boolean));
  const close = [], listed = [];
  for (const terminal of terminals) {
    const verdict = terminalVerdict(terminal, { named, treePaths, handledByWorker });
    if (verdict?.close) close.push(verdict.close);
    if (verdict?.listed) listed.push(verdict.listed);
  }
  return { close, listed };
}


/** The workers of other Runs that Orca holds inside a tree of the workflow: listed, never touched (no ledger row ties their Run to it). [{kind, id, why}] */
export function listStrangerWorkers({ rows, treePaths, terminals = [] }) {
  const held = rows.filter((row) => row?.terminalState !== 'released' && !resourceAbsent(row));
  return held.filter((row) => {
    const terminal = terminals.find((item) => item.handle === terminalHandleOf(row));
    const where = worktreePathOf(row) ?? cwdOf(terminal ?? {});
    if (!where) return treePaths.length > 0 && row?.projection?.liveness?.verdict !== 'exited';
    return Boolean(where) && treePaths.some((tree) => sameTree(where, tree) || insideTree(where, tree));
  }).map((row) => ({ kind: 'worker', id: row.dispatchId, holdsTree: true, why: untiedWhy('Orca has not proved it outside the workflow trees, and its Run ' + row.runId + ' is not one the ledger names (terminal ' + (terminalHandleOf(row) ?? 'none') + ')') }));
}
