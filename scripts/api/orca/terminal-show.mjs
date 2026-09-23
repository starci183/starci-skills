#!/usr/bin/env node
// terminal-show.mjs — the calls.yaml `terminal-show` call as a callable function.
//   node scripts/api/orca/terminal-show.mjs --terminal <handle>
// Returns {ok, terminal, connected, writable} — the health primitives callers test.
// errorCode is Orca's typed refusal (receipt error.code) when it answered one:
// a running Orca that no longer knows a handle — every terminal after a host
// reboot — answers terminal_handle_stale, which is not the same as Orca being
// unreachable (no receipt, errorCode null).
import { orcaCall, terminalOf, arg } from './lib.mjs';

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
    error: r.error,
    errorCode: typeof code === 'string' && code ? code : null,
  };
}

// The typed Orca refusals that prove a handle names no terminal on a running
// host: the terminal is gone, not merely unreadable. Only codes observed from
// a live Orca belong here (terminal_handle_stale, 2026-09-23).
export const TERMINAL_GONE_CODES = new Set(['terminal_handle_stale']);

if (process.argv[1]?.endsWith('terminal-show.mjs')) {
  const out = terminalShow({ terminal: arg(process.argv.slice(2), 'terminal') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
