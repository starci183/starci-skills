#!/usr/bin/env node
// Deep map WRAP T2: the PTY's connected/writable state; the death verdict belongs to worker-list, this read stays for the frame classifier and bare shells.
// terminal-show.mjs — the calls.yaml `terminal-show` call as a callable function.
// Internal entry: spawned by scripts/kernel/close-op-terminal.mjs; not invoked directly.
// Args: --terminal <handle>
// Returns {ok, terminal, connected, writable} — the health primitives callers test.
// errorCode is Orca's typed refusal (receipt error.code) when it answered one:
// a running Orca that no longer knows a handle — every terminal after a host
// reboot — answers terminal_handle_stale, which is not the same as Orca being
// unreachable. hostUnavailable marks that second case (runtime_unavailable,
// orca.exe ENOENT while an update replaces it, a timed-out call): it says
// nothing about the terminal, so no caller may read it as a dead one.
import { orcaCall, runAsCli, terminalOf } from './lib.mjs';
import { arg } from '../../lib/cli-arg.mjs';

/**
 * Read an exact terminal's health and typed refusal without deciding worker liveness or ownership.
 * hostUnavailable proves nothing about the terminal. When ok is false, normalized connected and
 * writable defaults must not be treated as death or permission to send, close, or replace a seat.
 * @param {object} input - Required terminal handle.
 * @returns {object} ok, terminal, connected/writable/exitCause, typed error, and hostUnavailable.
 */
export function terminalShow({ terminal }) {
  const r = orcaCall('terminal-show', { terminal });
  const t = terminalOf(r);
  const code = r.receipt?.error?.code;
  return {
    ok: r.exitCode === 0 && Boolean(t),
    terminal: t,
    connected: t?.connected === true,
    writable: t?.writable !== false,
    exitCause: t?.exitCause?.reason ?? null,
    error: r.error || (typeof r.receipt?.error === 'string' ? r.receipt.error : r.receipt?.error?.message) || null,
    errorCode: typeof code === 'string' && code ? code : null,
    hostUnavailable: r.hostUnavailable === true,
  };
}

runAsCli('terminal-show.mjs', (argv) => terminalShow({ terminal: arg(argv, 'terminal') }));
