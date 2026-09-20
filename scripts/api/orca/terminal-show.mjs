#!/usr/bin/env node
// terminal-show.mjs — `orca terminal show` as a callable function.
//   node scripts/api/orca/terminal-show.mjs --terminal <handle>
// Returns {ok, terminal, connected, writable} — the health primitives callers test.
import { orcaRun, terminalOf, arg } from './lib.mjs';

export function terminalShow({ terminal }) {
  const r = orcaRun(['terminal', 'show', '--terminal', terminal, '--json']);
  const t = terminalOf(r);
  return {
    ok: r.status === 0 && Boolean(t),
    terminal: t,
    connected: t?.connected === true,
    writable: t?.writable !== false,
    exitCause: t?.exitCause?.reason ?? null,
    error: r.error ?? r.stderr,
  };
}

if (process.argv[1]?.endsWith('terminal-show.mjs')) {
  const out = terminalShow({ terminal: arg(process.argv.slice(2), 'terminal') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
