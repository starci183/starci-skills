import { one, parse } from './query.mjs';
import { checkVerdictOf } from '../../scripts/kernel/settle/check-verdict.mjs';

/** Identity matches the runtime's latest-run selector (job-settle.mjs checkRunsOf), with authority explicit. */
export const checkKey = check => JSON.stringify([check.runner, check.authority, check.phase, check.name]);
export function checkObservation(check) {
  if (check.authority !== 'runtime') return 'unknown';
  if (check.status === 'skipped') return 'skipped';
  if (check.exitCode == null && check.status !== 'unavailable' && check.status !== 'error') return 'unknown';
  const verdict = checkVerdictOf({ status: check.status, exitCode: check.exitCode }).verdict;
  return verdict === 'red' ? 'fail' : verdict;
}
function selectedChecks(checks) {
  const latest = new Map();
  for (const check of checks) {
    const key = checkKey(check), previous = latest.get(key);
    if (!previous || check.runSeq > previous.runSeq || (check.runSeq === previous.runSeq && check.id > previous.id)) latest.set(key, check);
  }
  return [...latest.values()];
}
export function checkPairsOf(checks) {
  return selectedChecks(checks).map(check => ({ key: checkKey(check), name: check.name, phase: check.phase,
    runner: check.runner, authority: check.authority, op: check.authority === 'declared' ? check : null,
    runtime: check.authority === 'runtime' ? check : null }));
}

/** A passing check is measured runtime evidence, not an operation's declared result. */
export function checksPass(db, attemptId) {
  return one(db, "SELECT count(*) AS n FROM check_runs WHERE attempt_id=? AND authority='runtime' AND status='pass' AND exit_code=0", attemptId)?.n ?? 0;
}

function attemptObservation(db, attemptId) {
  return one(db, 'SELECT provider,request_model,attested_at,started_at,terminal_closed_at FROM op_attempts WHERE attempt_id=?', attemptId);
}

/** Shared list projector. Model authority comes from this dispatch, never the current job. */
export function attemptRow(row, project, db, ledgerId = null) {
  const observed = attemptObservation(db, row.attempt_id);
  return { project, ledgerId, id: row.attempt_id, wf: row.workflow_id, unit: row.unit_id, job: row.job_id, op: row.op_id,
    attempt: row.try_no, dispatchSeq: row.dispatch_seq, agent: row.agent, provider: observed?.provider ?? null,
    model: row.model, requestedModel: observed?.request_model ?? null, attestedAt: observed?.attested_at ?? null,
    modelAuthority: row.model != null && observed?.attested_at != null ? 'attested' : 'unobserved', pool: row.pool, effort: row.effort,
    startedAt: observed?.started_at ?? null, terminalEndedAt: observed?.terminal_closed_at ?? null,
    dispatchedAt: row.dispatched_at, reportedAt: row.reported_at, settledAt: row.settled_at, cycleMs: row.cycle_ms,
    reportOutcome: row.report_outcome, verdict: row.verdict, settledBy: row.settled_by,
    failureClass: row.failure_class, endState: row.end_state, ui: row.ui,
    checks: row.checks, checksRed: row.checks_red, checksPass: checksPass(db, row.attempt_id), artifacts: row.artifacts,
    tokensIn: row.tokens_in, tokensOut: row.tokens_out, costUsd: row.cost_usd,
    summary: row.report_summary, href: `#/a/${encodeURIComponent(project)}/${row.attempt_id}` };
}

const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : null;
const text = value => typeof value === 'string' ? value : null;
const strings = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
const revision = value => Number.isInteger(value) && value > 0 ? value : null;
export function currentInputOf(payload, job) {
  if (!obj(payload)) return null;
  return { source: 'current-job', sourceAt: job?.updated_at ?? null, what: text(payload.displayWhat) ?? text(payload.title), op: text(payload.opId) ?? job?.op_id ?? null,
    records: Array.isArray(payload.records) ? payload.records : [], recordsKnown: Array.isArray(payload.records),
    ownedPaths: strings(payload.owned_paths), writeScopeKnown: Array.isArray(payload.owned_paths), params: payload.params ?? null,
    goal: obj(payload.goal_binding) ? { revision: revision(payload.goal_binding.revision), identity: text(payload.goal_binding.identity) } : null,
    cut: payload.cut ?? null, after: payload.after ?? null, risk: payload.risk ?? null,
    model: text(payload.modelId), profile: text(payload.model), effort: text(payload.effort), difficulty: text(payload.difficulty),
    route: { chain: strings(payload.routeChain), rejected: Array.isArray(payload.routeRejected) ? payload.routeRejected : [],
      tier: text(payload.tier), pick: payload.pick ?? null, at: payload.routedAt ?? null } };
}
/** Dispatch-keyed capture. context.inputs is rebaselineable; packet/managed/hierarchy are not reconstructed. */
export function dispatchCapture(db, attemptId) {
  const record = one(db, 'SELECT context_json,contract_rev,created_at FROM contracts WHERE attempt_id=?', attemptId);
  if (!record) return { dispatchContext: null, input: null, capturedGoal: null, ownedPaths: null };
  const context = obj(parse(record.context_json)), packet = obj(context?.packet), pc = obj(packet?.context);
  const dispatchContext = { source: 'contract', contractRev: record.contract_rev ?? null, runtimeSha: text(context?.contract?.runtimeSha), createdAt: record.created_at,
    packet: packet ?? null, managed: obj(context?.managed), hierarchy: obj(context?.hierarchy) };
  const ownedPaths = Array.isArray(pc?.owned_paths) ? pc.owned_paths.flatMap(item => {
    const entry = typeof item === 'string' ? { path: item } : obj(item);
    return text(entry?.path) ? [{ rel: entry.path, root: text(entry.root), unresolved: entry.unresolved === true }] : [];
  }) : null;
  const workflow = obj(pc?.workflow), goal = obj(pc?.goal);
  const capturedGoal = pc && (goal || workflow?.goal_revision != null || workflow?.goal_identity != null)
    ? { source: 'contract', at: record.created_at, revision: revision(goal?.revision ?? workflow?.goal_revision),
      identity: text(workflow?.goal_identity), text: text(goal?.statement) } : null;
  const input = packet ? { source: 'contract', sourceAt: record.created_at, what: text(pc?.title), op: text(packet.op),
    records: Array.isArray(pc?.records) ? pc.records : [], recordsKnown: Array.isArray(pc?.records),
    ownedPaths: ownedPaths?.map(item => item.rel) ?? [], writeScopeKnown: ownedPaths != null, params: packet.params ?? null,
    goal: capturedGoal ? { revision: capturedGoal.revision, identity: capturedGoal.identity } : null,
    cut: pc?.cut ?? null, after: pc?.after ?? null, risk: pc?.risk ?? null,
    model: text(pc?.modelId), profile: text(packet.constraints?.model), effort: text(packet.constraints?.effort), difficulty: text(pc?.difficulty),
    route: { chain: [], rejected: [], tier: null, pick: null, at: null } } : null;
  return { dispatchContext, input, capturedGoal, ownedPaths };
}
