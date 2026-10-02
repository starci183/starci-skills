#!/usr/bin/env node
// Deep map WRAP T2, T6: the rendered frame (--screen) and its draft; only the frame shows turn-idle, a staged draft and rate-limit text, and proves a wake began a turn (worker output is read with worker-read).
// terminal-read.mjs — the calls.yaml `terminal-read` call as a callable function.
//   node scripts/api/orca/terminal-read.mjs --terminal <handle> [--screen] [--limit <n>]
// Returns {ok, screen, draft} — screen is the extracted frame text, ready to pattern-test; draft is
// the text sitting unsubmitted in the agent's input box (Orca's `draft`, which the frame leaves
// out), or null. A reader that ignores draft cannot see a send whose Enter never landed.
import { orcaCall, terminalOf } from './lib.mjs';
import { frameText, draftText } from '../../lib/orca-terminal.mjs';
import { arg, flag } from '../../lib/cli-arg.mjs';

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
