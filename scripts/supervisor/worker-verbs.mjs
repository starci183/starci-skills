// worker-verbs.mjs - thin lead-facing wrappers over Orca's supervised worker call files.
import { workerRead } from '../api/orca/worker-read.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';

export { workerCloseVerb } from './worker-verbs-close.mjs';
export { workerListVerb } from './worker-verbs-list.mjs';
export { workerStartVerb } from './worker-verbs-start.mjs';

const dispatchOf = (ctx) => String(ctx?.args?.dispatch ?? '').trim();
const needDispatch = (verb) => ({ code: 2, text: `starci worker ${verb}: --dispatch is required`,
  data: { schema: `starci/worker-${verb}@1`, ok: false } });

/** Show Orca's exact worker and liveness observation. */
export async function workerShowVerb(ctx, deps = {}) {
  const dispatch = dispatchOf(ctx);
  if (!dispatch) return needDispatch('show');
  const result = await (deps.workerShow ?? workerShow)({ dispatch });
  if (!result?.ok) return { code: 1, text: `starci worker show: ${result?.error ?? 'worker-show failed'}`,
    data: { schema: 'starci/worker-show@1', ok: false, dispatch } };
  const liveness = result?.result?.observation?.status ?? result?.result?.projection?.liveness?.verdict ?? null;
  return { code: 0, text: `${dispatch}\t${result.state ?? '-'}\t${liveness ?? '-'}`,
    data: { schema: 'starci/worker-show@1', ok: true, dispatch, state: result.state ?? null, liveness, result: result.result } };
}

/** Read a bounded tail from Orca's worker output source. */
export async function workerReadVerb(ctx, deps = {}) {
  const dispatch = dispatchOf(ctx);
  if (!dispatch) return needDispatch('read');
  const supplied = ctx?.args?.lines;
  const lines = supplied == null ? 80 : Number(supplied);
  if (!Number.isInteger(lines) || lines <= 0) return { code: 2, text: 'starci worker read: --lines must be a positive integer',
    data: { schema: 'starci/worker-read@1', ok: false, dispatch } };
  const result = await (deps.workerRead ?? workerRead)({ dispatch, source: 'auto', limit: lines });
  if (!result?.ok) return { code: 1, text: `starci worker read: ${result?.error ?? result?.errorCode ?? 'worker-read failed'}`,
    data: { schema: 'starci/worker-read@1', ok: false, dispatch } };
  const rows = result.rows.slice(-lines);
  return { code: 0, text: rows.join('\n'), data: { schema: 'starci/worker-read@1', ok: true, dispatch,
    source: result.source, rows, contentComplete: result.contentComplete, clipping: result.clipping } };
}

/** Stop a worker only while Orca still reports it as working. */
export async function workerStopVerb(ctx, deps = {}) {
  const dispatch = dispatchOf(ctx);
  if (!dispatch) return needDispatch('stop');
  const shown = await (deps.workerShow ?? workerShow)({ dispatch });
  if (!shown?.ok) return { code: 1, text: `starci worker stop: ${shown?.error ?? 'worker-show failed'}`,
    data: { schema: 'starci/worker-stop@1', ok: false, dispatch } };
  if (!['ready', 'starting', 'working', 'active', 'running'].includes(shown.state)) return { code: 2,
    text: `starci worker stop: ${dispatch} is not working (state ${shown.state ?? 'unknown'})`,
    data: { schema: 'starci/worker-stop@1', ok: false, dispatch, state: shown.state ?? null } };
  const result = await (deps.workerStop ?? workerStop)({ dispatch });
  return { code: result?.ok ? 0 : 1, text: result?.ok ? `stopped ${dispatch}` : `starci worker stop: ${result?.error ?? 'worker-stop failed'}`,
    data: { schema: 'starci/worker-stop@1', ok: result?.ok === true, dispatch, state: result?.state ?? null, result: result?.result ?? null } };
}

/** Release Orca accounting; callers normally use worker close for full cleanup. */
export async function workerReleaseVerb(ctx, deps = {}) {
  const dispatch = dispatchOf(ctx);
  if (!dispatch) return needDispatch('release');
  const result = await (deps.workerRelease ?? workerRelease)({ dispatch });
  return { code: result?.ok ? 0 : 1,
    text: result?.ok ? `released ${dispatch}; use starci worker close for normal full cleanup` : `starci worker release: ${result?.error ?? 'worker-release failed'}`,
    data: { schema: 'starci/worker-release@1', ok: result?.ok === true, dispatch, state: result?.state ?? null, result: result?.result ?? null } };
}
