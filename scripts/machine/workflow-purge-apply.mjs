// workflow-purge-apply.mjs - carries out a purge plan (workflow-purge-plan.mjs) through the house mechanics only, in an order that makes every step
// safe to repeat: workers and terminals first (a live terminal keeps Orca from removing its tree), then the trees (Orca's removal with its
// held-file retry, or the git home's link-safe removal; the registry row closed by the same call), then the refs (each deleted only when it still
// names the tip the plan printed), then the files, the machine Decision Items, and last the one journal event. The plan is stored in machine_meta before
// the first effect, so a crashed apply is resumed by the next one and the event counts the whole run. Nothing here deletes recursively on its own:
// no main checkout and no history is touched, and no branch is deleted that the plan did not list as the workflow's.
import fs from 'node:fs';
import { branchDelete } from '../api/git/branch-delete.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { closeAndVerify } from './close-verify.mjs';
import { closeWorker } from './worker-close.mjs';
import { releaseOrcaSlot, markRemoved, withRegistry } from './worktree-registry.mjs';
import { removeOrcaWorktree, orcaWorktreeClient } from './worktree-orca.mjs';
import { removeScratchWorktree } from './worktree-git.mjs';
import { purgeMetaKey } from './workflow-purge-facts.mjs';

const MAIN = 'main';

const failure = (error) => String(error?.message ?? error).slice(0, 300);

function closeOneWorker(worker, { env, deps }) {
  let r;
  try { r = (deps.closeWorker ?? closeWorker)({ dispatch: worker.dispatchId, handle: worker.terminal, retryRelease: true, env }); } catch (error) { r = { ok: false, error: failure(error) }; }
  const ok = r?.ok === true && !r.hygiene;
  return { dispatchId: worker.dispatchId, terminal: worker.terminal, ok, ...(ok ? { closure: r.processes?.verdict ?? null } : { error: r?.hygiene ? 'a process of the worker survived release and close' : r?.error ?? r?.outcome ?? 'release failed' }) };
}

function closeOneTerminal(terminal, { deps }) {
  let r;
  try { r = (deps.closeTerminal ?? closeAndVerify)(terminal.handle); } catch (error) { r = { ok: false, reason: failure(error) }; }
  return { handle: terminal.handle, ok: r?.ok === true, proof: r?.proof ?? null, ...(r?.ok ? {} : { error: r?.reason ?? r?.error ?? 'close failed' }) };
}

// One tree through the home that made it: Orca (removeOrcaWorktree: links first, `orca worktree rm` with the held-file retry), git, or just its registry row.
function removeOneTree(tree, { env, deps }) {
  const base = { path: tree.path, action: tree.action };
  if (tree.action === 'release-slot') return { ...base, ok: releaseOrcaSlot(tree.path, { env }) };
  if (tree.action === 'unregister') return { ...base, ok: markRemoved(tree.path, { env }) || !fs.existsSync(tree.path) };
  const r = tree.action === 'remove-orca'
    ? removeOrcaWorktree({ repoRoot: tree.repoRoot, orcaId: tree.orcaId, dir: tree.path, branch: tree.branch, deleteBranch: null, preserve: null, env, orca: deps.orcaTree ?? orcaWorktreeClient })
    : removeScratchWorktree({ repoRoot: tree.repoRoot, dir: tree.path, branch: null, deleteBranch: null, preserve: null, env });
  return { ...base, ok: r.ok === true, links: r.links ?? 0, ...(r.ok ? {} : { error: r.reason ?? 'remove-failed', detail: r.detail ?? null }), ...(r.fatal ? { fatal: true, damage: r.damage } : {}) };
}

// One ref: deleted only when it still names the tip the plan printed (a moved ref is the operator's or another run's, and is left).
function deleteOneRef(ref) {
  const base = { repoRoot: ref.repoRoot, name: ref.name, tip: ref.tip };
  const now = revParse(ref.repoRoot, `refs/heads/${ref.name}`);
  if (!now) return { ...base, ok: true, gone: true };
  if (now !== ref.tip) return { ...base, ok: false, error: `the ref moved since the plan: it names ${now}` };
  if (ref.name === MAIN) return { ...base, ok: false, error: 'the main branch is never deleted' };
  const deleted = branchDelete({ repoRoot: ref.repoRoot, branch: ref.name, mode: 'force', main: MAIN });
  return { ...base, ok: deleted.ok, ...(deleted.ok ? {} : { error: deleted.detail ?? 'branch delete failed' }) };
}

function removeOneFile(file) {
  try { fs.rmSync(file, { force: true }); return { file, ok: true }; } catch (error) { return { file, ok: false, error: failure(error) }; }
}

function resolveDecisions(diIds, env) {
  return withRegistry((m) => diIds.map((diId) => ({ diId, ok: m.setSupDecision(diId, { status: 'resolved', by: 'runtime', verb: 'workflow-purged', rationale: 'the workflow was purged: its host leftovers are closed' }).changed })), env);
}

/** The plan as it is stored while a purge runs: enough to resume it and to journal the whole run. */
const storedPlanOf = (plan, now) => ({ planSha: plan.sha, startedAt: now, counts: plan.counts, refs: plan.refs.filter((ref) => ref.action === 'delete').map((ref) => ({ repoRoot: ref.repoRoot, name: ref.name, tip: ref.tip })),
  trees: plan.trees.map((tree) => ({ path: tree.path, branch: tree.branch })), ledger: plan.ledger.mode });

// machine_meta holds the first plan of an unfinished purge; an existing one is kept (the resumed run's smaller plan must not replace the whole run's counts).
function beginPurge(plan, { env, now }) {
  return withRegistry((m) => m.transaction((db) => {
    const key = purgeMetaKey(plan.workflowId);
    const held = db.prepare('SELECT value FROM machine_meta WHERE key=?').get(key)?.value;
    if (held) return { resumed: true, stored: JSON.parse(held) };
    const stored = storedPlanOf(plan, now);
    db.prepare('INSERT INTO machine_meta(key, value) VALUES(?, ?)').run(key, JSON.stringify(stored));
    return { resumed: false, stored };
  }), env);
}

// The one journal event of the purge and the end of its stored plan, in one transaction.
function journalPurge({ plan, stored, resumed, results, env }) {
  return withRegistry((m) => m.transaction((db) => {
    const event = m.supEvent({ entityType: 'workflow', entityId: plan.workflowId, kind: 'workflow-purged',
      payload: { workflowId: plan.workflowId, repo: plan.repo, planSha: stored.planSha, resumed, counts: stored.counts, refs: stored.refs, trees: stored.trees, ledger: stored.ledger,
        workers: results.workers.length, terminals: results.terminals.length } });
    db.prepare('DELETE FROM machine_meta WHERE key=?').run(purgeMetaKey(plan.workflowId));
    return event;
  }), env);
}

/**
 * Apply `plan`. {ok, resumed, results: {workers, terminals, trees, refs, guards, prompts, decisions, ledger}, errors, event}. A step that fails does not stop the
 * next ones (each is independent and safe to repeat), except a removal that touched a main checkout (fatal): everything stops. With errors the journal
 * event is not written and the stored plan stays, so the next apply resumes. Seams (deps): closeWorker, closeTerminal, orcaTree, purgeLedger, now.
 */
export function applyPurgePlan({ plan, env = process.env, deps = {} }) {
  const now = (deps.now ?? Date.now)();
  const { resumed, stored } = beginPurge(plan, { env, now });
  const results = { workers: plan.workers.map((worker) => closeOneWorker(worker, { env, deps })), terminals: plan.terminals.map((terminal) => closeOneTerminal(terminal, { deps })),
    trees: [], refs: [], guards: [], prompts: [], decisions: [], ledger: null };
  for (const tree of plan.trees) {
    const done = removeOneTree(tree, { env, deps });
    results.trees.push(done);
    if (done.fatal) return { ok: false, resumed, results, errors: [`main checkout damaged while removing ${tree.path}: ${(done.damage ?? []).join('; ')}`], event: null };
  }
  results.refs = plan.refs.filter((ref) => ref.action === 'delete').map((ref) => deleteOneRef(ref));
  results.guards = plan.guards.map((file) => removeOneFile(file));
  results.prompts = plan.prompts.map((file) => removeOneFile(file));
  results.decisions = resolveDecisions(plan.decisions, env);
  const errors = [...results.workers, ...results.terminals, ...results.trees, ...results.refs, ...results.guards, ...results.prompts].filter((item) => item.ok === false).map((item) => `${item.dispatchId ?? item.handle ?? item.path ?? item.name ?? item.file}: ${item.error ?? 'failed'}`);
  if (!errors.length && plan.ledger.mode === 'purge') results.ledger = deps.purgeLedger({ plan });
  if (results.ledger && results.ledger.ok === false) errors.push(`ledger: ${results.ledger.error}`);
  const event = errors.length ? null : journalPurge({ plan, stored, resumed, results, env });
  return { ok: errors.length === 0, resumed, results, errors, event };
}
