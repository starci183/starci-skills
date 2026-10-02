// worker-verbs-close.mjs - expose the one full worker close path and require every cleanup proof.
import { closeWorker } from './worker-close.mjs';

/** Release, close and prove the process tree gone through closeWorker. */
export async function workerCloseVerb(ctx, deps = {}) {
  const dispatch = String(ctx?.args?.dispatch ?? '').trim();
  if (!dispatch) return { code: 2, text: 'starci worker close: --dispatch is required',
    data: { schema: 'starci/worker-close@1', ok: false } };
  let result;
  try {
    result = await (deps.closeWorker ?? closeWorker)({ dispatch, stopFirst: ctx?.args?.['stop-first'] === true,
      retryRelease: ctx?.args?.['retry-release'] === true, env: ctx?.env ?? process.env });
  } catch (error) {
    return { code: 1, text: `starci worker close: ${error.message}`,
      data: { schema: 'starci/worker-close@1', ok: false, released: false, terminalClosed: false, processGone: false } };
  }
  const released = result?.ok === true;
  const terminalClosed = result?.closed?.ok === true;
  const processGone = ['none', 'stopped'].includes(result?.processes?.verdict);
  const ok = released && terminalClosed && processGone;
  const data = { schema: 'starci/worker-close@1', ok, dispatch, released, terminalClosed, processGone,
    handle: result?.handle ?? null, processVerdict: result?.processes?.verdict ?? null, result };
  const missing = [!released && 'release', !terminalClosed && 'terminal close', !processGone && 'process exit'].filter(Boolean);
  return { code: ok ? 0 : 1, text: ok ? `closed ${dispatch}; terminal and process are gone` : `starci worker close: missing proof: ${missing.join(', ')}`, data };
}
