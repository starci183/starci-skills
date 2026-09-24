#!/usr/bin/env node
// terminal-read.mjs — the calls.yaml `terminal-read` call as a callable function.
//   node scripts/api/orca/terminal-read.mjs --terminal <handle> [--screen] [--limit <n>]
// Returns {ok, screen, draft} — screen is the extracted frame text, ready to pattern-test; draft is
// the text sitting unsubmitted in the agent's input box (Orca's `draft`, which the frame leaves
// out), or null. A reader that ignores draft cannot see a send whose Enter never landed.
import { orcaCall, terminalOf, frameText, draftText, arg, flag } from './lib.mjs';

export function terminalRead({ terminal, screen = true, limit }) {
  const r = orcaCall('terminal-read', { terminal, screen: Boolean(screen), limit });
  const t = terminalOf(r);
  return { ok: r.exitCode === 0, terminal: t, screen: frameText(t), draft: draftText(t), error: r.error };
}

if (process.argv[1]?.endsWith('terminal-read.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalRead({ terminal: arg(argv, 'terminal'), screen: !flag(argv, 'tail'), limit: arg(argv, 'limit') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
