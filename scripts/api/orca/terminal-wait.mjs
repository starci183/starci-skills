#!/usr/bin/env node
// Deep map WRAP T2 / alpha5 item 1.2: Orca proves a terminal's exit; the runtime does not poll `terminal show` for it.
// terminal-wait.mjs - the calls.yaml `terminal-wait` call as a callable function.
// Internal entry: spawned by scripts/machine/close-verify.mjs; not invoked directly.
// Args: --terminal <handle> --for exit|tui-idle [--timeout-ms <n>]
// Live (Orca 1.4.209, 2026-10-02): `--for exit` answers within a second for an exited OR closed handle
// ({wait: {condition, satisfied: true, status: 'exited', exitCode, exitCause}}) and times out (error.code timeout) for a live one.
// Returns {ok, satisfied, timedOut, status, exitCause, error, errorCode, hostUnavailable}. A timeout is a clean `satisfied: false`,
// never an error: the condition simply did not hold in time.
import { orcaCall } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Ask Orca to observe exit or tui-idle for the exact terminal within timeoutMs.
 * A host timeout is a completed read with timedOut true, not a failed call or proof of exit.
 * Closure callers require satisfied and an available host before releasing terminal custody.
 * @param {object} input - Required terminal; optional declared condition and wait duration.
 * @returns {object} Read status, satisfaction/timeout, observed state/exit cause, and host failure details.
 */
export function terminalWait({ terminal, for: condition = 'exit', timeoutMs = 10_000 }) {
  const r = orcaCall('terminal-wait', { terminal, for: condition, 'timeout-ms': String(timeoutMs) }, { timeout: timeoutMs + 15_000 });
  const wait = r.result?.wait ?? null;
  const code = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  const timedOut = code === 'timeout';
  return {
    ok: r.exitCode === 0 || timedOut,
    satisfied: wait?.satisfied === true,
    timedOut,
    status: wait?.status ?? null,
    exitCause: wait?.exitCause?.reason ?? wait?.exitCause ?? null,
    error: r.exitCode === 0 || timedOut ? null : r.error,
    errorCode: timedOut ? null : code,
    hostUnavailable: r.hostUnavailable === true,
  };
}

if (process.argv[1]?.endsWith('terminal-wait.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalWait({ terminal: arg(argv, 'terminal'), for: arg(argv, 'for') ?? 'exit', timeoutMs: Number(arg(argv, 'timeout-ms')) || 10_000 });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
