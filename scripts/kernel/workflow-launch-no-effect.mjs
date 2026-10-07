// A Kernel launch whose custody never gained a terminal or Dispatch proves no effect from Orca's own typed refusal,
// the recorded run-create request and the Runs Orca lists; any gap in that evidence keeps the launch held.
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { orcaRequestIdOf } from '../lib/orca-request-id.mjs';
import { runList } from '../api/orca/run-list.mjs';
import { requestShow } from '../api/orca/request-show.mjs';
import { parseJsonOr } from '../lib/json.mjs';

const PRE_EFFECT_CODES = new Set(readModuleJson('modules', 'host', 'orca', 'calls.yaml').envelope?.preEffectCodes ?? []);
const ATTEMPT_SCOPE = /:kernel-attempt:(\d+)$/;
const ERROR_CODE = /^([a-z][a-z0-9_]*):/;

const MAX_RUN_PAGES = 20;
/** Every Run created at or after `since` (epoch ms; Orca lists newest first, a page at a time), or null when a page cannot be read. */
const listRuns = ({ since }) => {
  const runs = [];
  let cursor = null;
  for (let page = 0; page < MAX_RUN_PAGES; page += 1) {
    const listed = runList({ cursor });
    if (!listed.ok) return null;
    runs.push(...listed.runs);
    cursor = listed.nextCursor;
    const oldest = Date.parse(listed.runs.at(-1)?.created_at);
    if (!cursor || oldest < since) return runs;
  }
  return null;
};

/** The recorded failure of this reservation at run-create when Orca answered it with a typed pre-effect refusal, else null. */
function recordedRefusal(ledger, workflowId, token) {
  for (const row of ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-start-failed' ORDER BY seq DESC").all(workflowId)) {
    const payload = parseJsonOr(row.payload_json);
    if (payload?.reservation !== token) continue;
    const code = ERROR_CODE.exec(String(payload.error ?? ''))?.[1] ?? null;
    return payload.step === 'run-create' && !payload.terminal && !payload.dispatch && PRE_EFFECT_CODES.has(code) ? { step: payload.step, code } : null;
  }
  return null;
}

/** The run-create request id of the attempt: the one the failure stored, else the id its launch identity derives (no entry terminal, no replaced Run). */
const runCreateRequestId = (value, { workflowId, token, attempt }) => value.hostRequestId
  ?? orcaRequestIdOf('run-create', { workflow: workflowId, kernelAttempt: attempt, reservation: token, entry: null, replaces: null });

/**
 * Whether a launch-unknown signal without terminal and Dispatch left no effect.
 * Returns {ok:true, evidence} or {ok:false, reason, ...detail}; it only reads.
 */
export function kernelLaunchNoEffect(ledger, { workflowId, signal, value }, { requestState = (id) => requestShow({ request: id }).state, runs = listRuns } = {}) {
  const receipt = value.admission?.receipt, attempt = Number(ATTEMPT_SCOPE.exec(String(receipt?.scope?.scopeId ?? ''))?.[1]);
  const refusal = recordedRefusal(ledger, workflowId, signal.token);
  if (!Number.isInteger(attempt) || !refusal) return { ok: false, reason: 'kernel-launch-custody-incomplete' };
  const requestId = runCreateRequestId(value, { workflowId, token: signal.token, attempt });
  const state = requestState(requestId);
  if (state !== 'absent') return { ok: false, reason: state === 'completed' || state === 'pending' ? 'kernel-launch-effect-partial' : 'kernel-launch-request-unreadable',
    requestId, requestState: state ?? null };
  const since = Math.floor(Number(receipt.createdAt ?? 0) / 1000) * 1000;
  const listed = runs({ since });
  if (!listed) return { ok: false, reason: 'kernel-launch-runs-unreadable', requestId };
  // A Run without a readable creation time is never ruled out.
  const earlier = (run) => Date.parse(run.created_at) < since;
  const found = listed.filter((run) => String(run?.objective ?? '').startsWith('[Kernel]') && String(run.objective).endsWith(`— ${workflowId}`) && !earlier(run));
  if (found.length) return { ok: false, reason: 'kernel-launch-run-exists', requestId, runs: found.map((run) => run.id) };
  return { ok: true, evidence: { refusal, requestId, requestState: state, runs: listed.length } };
}
