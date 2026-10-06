// CLI fixtures mock the OS boundary of the real close lifecycle, never a production host's process table.
export * from '../../scripts/machine/worker-close.mjs?closure-fixture';
import { closeWorker as realCloseWorker } from '../../scripts/machine/worker-close.mjs?closure-fixture';
import { workerShow } from '../../scripts/api/orca/worker-show.mjs';
import { winPath } from '../fixtures/win-path.mjs';

export function closeWorker({ dispatch, handle = null, stopFirst = false, retryRelease = false, env = process.env, deps = {} } = {}) {
  const shown = (deps.show ?? workerShow)({ dispatch });
  const terminal = handle ?? shown?.agentTerminalHandle ?? shown?.dispatch?.assigneeHandle ?? shown?.result?.worker?.agentTerminalHandle;
  const object = { pid: 991, ppid: 0, name: 'fixture-agent', created: 1000, exe: winPath('C', 'fixture', 'agent.exe') };
  const identity = { pid: object.pid, birth: '116444736010000000', exe: object.exe };
  let reads = 0, table = [object];
  return realCloseWorker({ dispatch, handle: terminal, stopFirst, retryRelease, env, deps: {
    tableOf: () => { if (++reads > 1 && !env.STARCI_FAKE_CLOSURE_UNPROVEN) table = []; return table; },
    // Environment rows describe the same live census; old tags cannot invent an uncaptured process after closure.
    envOf: () => table.map(row => ({ pid: row.pid, values: { ORCA_TERMINAL_HANDLE: terminal } })),
    capture: pid => ({ schema: 'starci/owned-process@1', pid, ok: true, outcome: 'captured', proof: 'process-handle-live', identity }),
    stopProcess: () => ({ ok: false, outcome: 'unknown' }), sleep: () => {}, verifyMs: 0, stopVerifyMs: 0,
    ...deps,
  } });
}

export function stopAndRelease(dispatch, { handle = null, env = process.env, deps = {} } = {}) {
  const result = closeWorker({ dispatch, handle, stopFirst: true, env, deps });
  return { dispatch, ...result, stop: { ok: result.stop?.ok === true, error: result.stop?.error ?? null },
    release: { ok: result.ok, error: result.error ?? null } };
}
