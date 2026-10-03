// CLI fixtures mock the OS boundary of the real close lifecycle, never a production host's process table.
export * from '../../scripts/machine/worker-close.mjs?closure-fixture';
import { closeWorker as realCloseWorker } from '../../scripts/machine/worker-close.mjs?closure-fixture';
import { workerShow } from '../../scripts/api/orca/worker-show.mjs';

export function closeWorker({ dispatch, handle = null, stopFirst = false, retryRelease = false, env = process.env, deps = {} } = {}) {
  const shown = (deps.show ?? workerShow)({ dispatch });
  const terminal = handle ?? shown?.agentTerminalHandle ?? shown?.dispatch?.assigneeHandle ?? shown?.result?.worker?.agentTerminalHandle;
  let reads = 0;
  return realCloseWorker({ dispatch, handle: terminal, stopFirst, retryRelease, env, deps: {
    tableOf: () => ++reads === 1 || env.STARCI_FAKE_CLOSURE_UNPROVEN ? [{ pid: 991, ppid: 0, name: 'fixture-agent', created: 'fixture' }] : [],
    envOf: () => [{ pid: 991, values: { ORCA_TERMINAL_HANDLE: terminal } }],
    kill: () => ({ ok: false }), sleep: () => {}, verifyMs: 0, stopVerifyMs: 0,
    ...deps,
  } });
}

export function stopAndRelease(dispatch, { handle = null, env = process.env, deps = {} } = {}) {
  const result = closeWorker({ dispatch, handle, stopFirst: true, env, deps });
  return { dispatch, ...result, stop: { ok: result.stop?.ok === true, error: result.stop?.error ?? null },
    release: { ok: result.ok, error: result.error ?? null } };
}
