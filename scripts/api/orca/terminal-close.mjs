#!/usr/bin/env node
// terminal-close.mjs — `orca terminal close` as a callable function.
//   node scripts/api/orca/terminal-close.mjs --terminal <handle> [--tab]
import { orcaRun, arg, flag } from './lib.mjs';

export function terminalClose({ terminal, tab = false }) {
  const argv = ['terminal', 'close', '--terminal', terminal, '--json'];
  if (tab) argv.push('--tab');
  const r = orcaRun(argv);
  return { ok: r.status === 0, error: r.error ?? r.stderr };
}

if (process.argv[1]?.endsWith('terminal-close.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalClose({ terminal: arg(argv, 'terminal'), tab: flag(argv, 'tab') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
