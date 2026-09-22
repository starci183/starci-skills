#!/usr/bin/env node
// terminal-read.mjs — the calls.yaml `terminal-read` call as a callable function.
//   node scripts/api/orca/terminal-read.mjs --terminal <handle> [--screen] [--limit <n>]
// Returns {ok, screen} — screen is the extracted frame text, ready to pattern-test.
import { orcaCall, terminalOf, frameText, arg, flag } from './lib.mjs';

export function terminalRead({ terminal, screen = true, limit }) {
  const r = orcaCall('terminal-read', { terminal, screen: Boolean(screen), limit });
  const t = terminalOf(r);
  return { ok: r.exitCode === 0, terminal: t, screen: frameText(t), error: r.error };
}

if (process.argv[1]?.endsWith('terminal-read.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalRead({ terminal: arg(argv, 'terminal'), screen: !flag(argv, 'tail'), limit: arg(argv, 'limit') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
