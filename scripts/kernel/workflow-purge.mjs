// workflow-purge.mjs - `starci workflow purge`: remove what an archived workflow left on the host so a run from scratch starts clean.
// The plan is the default (it changes nothing); --apply acts, owner role only, under the host lock and the gc lock. What it judges and removes is
// scripts/machine/workflow-purge-*.mjs; this file reads the flags, takes the locks, asks for the ledger purge (--ledger: scripts/work/purge-workflow.mjs, which
// archives the rows to a verified zip before it drops them) and prints.
import { invocationDir } from '../lib/roots.mjs';
import path from 'node:path';
import { purgeFactsOf } from '../machine/workflow-purge-facts.mjs';
import { buildPurgePlan } from '../machine/workflow-purge-plan.mjs';
import { applyPurgePlan } from '../machine/workflow-purge-apply.mjs';
import { renderApply, renderPlan } from '../machine/workflow-purge-render.mjs';
import { underHostLock } from '../machine/verb-lock.mjs';
import { acquireGcLock } from '../machine/gc-lock.mjs';
import { purgeWorkflow } from '../work/purge-workflow.mjs';
import { workflowArchiveEvidence, workflowPurgeDependencies } from '../work/workflow-archive-evidence.mjs';
import { openLedgerReader } from '../../engine/db/ledger.mjs';
import { artifactRoot } from '../../engine/db/blob.mjs';
import { guardsRoot } from '../guards/guards-root.mjs';

const MIN_EXPECT = 12;
const refusal = ({ code, detail }) => ({ code: 1, text: `${code}: ${detail}`, data: { schema: 'starci/workflow-purge-refusal@1', ok: false, refusal: { code, detail } } });
const usage = (detail) => ({ code: 2, stderr: `starci workflow purge: ${detail}\n` });

// The default ledger purge: the housekeeping purge archives every row of the workflow to a verified zip, then drops them. The owner's own --apply --ledger is the approval.
function purgeLedgerRows({ plan }) {
  try {
    const out = purgeWorkflow({ repo: plan.repo, workflowId: plan.workflowId, apply: true, approvedBy: 'owner', approvalRef: `starci workflow purge --apply --ledger (plan ${plan.sha})` });
    return { ok: out.ok === true, archive: out.purge?.archive_path ?? null, archiveSha256: out.purge?.archive_sha256 ?? null, deleted: out.deleted ?? null };
  } catch (error) { return { ok: false, error: `${error?.code ?? 'purge-failed'}: ${String(error?.message ?? error).slice(0, 300)}` }; }
}

// --ledger cannot start host effects when the native archive cannot retain all referenced bytes.
function archiveBlockersOf(facts, workflowId, env, ledgerMode) {
  if (!ledgerMode || !facts.ledger.found) return [];
  let db;
  try {
    db = openLedgerReader(facts.ledger.file);
    const dependencies = workflowPurgeDependencies(db, workflowId);
    if (dependencies.length) return dependencies;
    workflowArchiveEvidence(db, workflowId, { root: artifactRoot(env) });
    return [];
  } catch (error) {
    return [{ code: 'workflow-purge-archive-incomplete', detail: `archive evidence cannot be verified: ${String(error?.message ?? error).slice(0, 300)}; no purge effect is authorized` }];
  } finally { db?.close(); }
}

function planOf({ repo, workflowId, env, ledgerMode, deps }) {
  const facts = purgeFactsOf({ repo, workflowId, env, guardsDir: guardsRoot(undefined, env), deps });
  return buildPurgePlan({ facts, workflowId, repo, ledgerMode, archiveBlockers: archiveBlockersOf(facts, workflowId, env, ledgerMode) });
}

// The apply under the host lock and the gc lock, with the plan read again once the locks are ours (the plan shown may be old).
async function applyLocked({ shown, args, env, deps }) {
  const gc = (deps.acquireGcLock ?? acquireGcLock)({ env, holder: 'workflow-purge' });
  if (!gc.ok) return refusal({ code: 'workflow-purge-host-busy', detail: `the gc lock is held by ${gc.holder?.holder ?? 'another run'} (pid ${gc.holder?.pid ?? '?'})` });
  try {
    const fresh = planOf({ repo: shown.repo, workflowId: shown.workflowId, env, ledgerMode: args.ledger === true, deps: { ...deps, lockOwner: () => null } });
    if (!fresh.ok) return { code: 1, text: renderPlan(fresh), data: fresh };
    if (args.expect && !fresh.sha.startsWith(String(args.expect))) return refusal({ code: 'workflow-purge-plan-changed', detail: `the plan is now ${fresh.sha.slice(0, MIN_EXPECT)}, not ${args.expect}: read it again with --plan` });
    const applied = applyPurgePlan({ plan: fresh, env, deps: { purgeLedger: purgeLedgerRows, ...deps } });
    return { code: applied.ok ? 0 : 1, text: renderApply(fresh, applied), data: { schema: 'starci/workflow-purge-result@1', plan: fresh, ...applied } };
  } finally { gc.release(); }
}

/** `starci workflow purge --workflow <id> [--repo <repo>] [--plan | --apply [--ledger] [--expect <sha>]]` */
export async function workflowPurge(ctx, deps = {}) {
  const args = ctx.args ?? {};
  const env = ctx.env ?? process.env;
  if (!args.workflow) return usage('--workflow <id> is required');
  if (args.plan === true && args.apply === true) return usage('--plan and --apply are exclusive; the plan is the default');
  if (args.expect && String(args.expect).length < MIN_EXPECT) return usage(`--expect needs at least ${MIN_EXPECT} characters of the plan sha`);
  const repo = path.resolve(invocationDir(ctx), args.repo ?? '.');
  const plan = planOf({ repo, workflowId: args.workflow, env, ledgerMode: args.ledger === true, deps });
  if (args.apply !== true) return { code: plan.ok ? 0 : 1, text: renderPlan(plan), data: plan };
  if (!plan.ok) return { code: 1, text: renderPlan(plan), data: plan };
  if (plan.already) return { code: 0, text: renderPlan(plan), data: plan };
  const locked = await underHostLock({ role: 'owner', purpose: 'workflow-purge', env }, () => applyLocked({ shown: plan, args, env, deps }), deps);
  if (locked.ok === false) return refusal({ code: 'workflow-purge-host-busy', detail: `the host lock is held (${locked.owner?.purpose ?? locked.owner?.role ?? 'another run'}); a purge waits for it` });
  return locked.value;
}
