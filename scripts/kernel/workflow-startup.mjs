import { loadConfig } from '../../engine/config.mjs';
import { ensureHostRuntime } from '../reconciler/start.mjs';
import { npmCi } from '../machine/npm-ci.mjs';
import { parseJsonOr } from '../lib/json.mjs';

export function workflowStartAuthority({ workflow, goal } = {}) {
  if (!workflow || !goal || goal.approved_by !== 'owner')
    return { ok: false, reason: 'workflow-approval-required' };
  if (!['queued', 'running'].includes(workflow.phase) || workflow.archived_at != null)
    return { ok: false, reason: 'workflow-not-startable', phase: workflow.phase };
  if (!String(goal.markdown ?? '').trim() || !String(goal.goal_identity ?? '').trim()
      || goal.goal_identity !== workflow.goal_identity || !Number.isInteger(goal.revision))
    return { ok: false, reason: 'workflow-goal-unverified' };
  if (parseJsonOr(goal.json)?.provisional === true)
    return { ok: false, reason: 'workflow-approval-required' };
  return { ok: true, workflowId: workflow.workflow_id, goalIdentity: goal.goal_identity, goalRevision: goal.revision };
}

export async function ensureWorkflowHost({ workflow, goal, caller = null, env = process.env, plan = false } = {}, deps = {}) {
  const authority = workflowStartAuthority({ workflow, goal });
  if (!authority.ok) return { ...authority, ready: false };
  if (plan) return { ...authority, planned: true, ready: false };
  let config, host;
  try { config = deps.config ?? (deps.loadConfig ?? loadConfig)(); }
  catch (error) { return { ok: false, ready: false, reason: 'workflow-host-not-ready', error: String(error?.message ?? error) }; }
  try { host = await (deps.ensureHost ?? ensureHostRuntime)({ env, workflowSeats: false }); }
  catch (error) { return { ok: false, ready: false, reason: 'workflow-host-not-ready', authority,
    host: { ok: false, effectState: 'unknown', error: String(error?.message ?? error) } }; }
  if (host?.ok !== true) return { ok: false, ready: false, reason: 'workflow-host-not-ready', authority, host };
  let maintenance = { ok: true, ready: true, action: 'disabled' };
  if (config?.debug === true) {
    const ensureDebug = deps.ensureDebug ?? (await import('../reconciler/core-debug.mjs')).ensureCoreDebug;
    try { maintenance = await ensureDebug({ caller, env, plan: false }); }
    catch (error) { maintenance = { ok: false, ready: false, effectState: 'unknown', error: String(error?.message ?? error) }; }
    if (maintenance?.ok !== true || maintenance?.ready !== true)
      return { ok: false, ready: false, reason: 'workflow-debug-not-ready', authority, host, maintenance };
  }
  return { ok: true, ready: true, authority, host, maintenance };
}

export async function installWorkflowTree({ record, env = process.env } = {}, deps = {}) {
  if (!record?.path) return { ok: false, reason: 'workflow-worktree-missing' };
  let result;
  try { result = await (deps.npmCi ?? npmCi)({ cwd: record.path, role: 'coordinator', env, args: {} }); }
  catch (error) { return { ok: false, installed: false, reason: 'workflow-worktree-install-failed', path: record.path,
    receipt: null, error: String(error?.message ?? error) }; }
  const ok = result?.code === 0 && result?.data?.ok === true;
  return { ok, installed: ok, path: record.path, receipt: result?.data ?? null,
    ...(ok ? {} : { reason: 'workflow-worktree-install-failed', error: result?.text ?? 'npm ci did not return a successful receipt' }) };
}
