#!/usr/bin/env node
// terminal-close.mjs — the calls.yaml `terminal-close` call as a callable function.
//   node scripts/api/orca/terminal-close.mjs --terminal <handle> [--tab]
import { orcaCall, arg, flag } from './lib.mjs';

export function terminalClose({ terminal, tab = false }) {
  const r = orcaCall('terminal-close', { terminal, tab });
  return { ok: r.exitCode === 0, error: r.error };
}

if (process.argv[1]?.endsWith('terminal-close.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalClose({ terminal: arg(argv, 'terminal'), tab: flag(argv, 'tab') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
