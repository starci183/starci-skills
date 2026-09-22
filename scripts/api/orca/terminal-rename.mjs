#!/usr/bin/env node
// terminal-rename.mjs — the calls.yaml `terminal-rename` call as a callable function.
//   node scripts/api/orca/terminal-rename.mjs --terminal <handle> --title <text>
// Used after managed worker-start because creation display-name flags are not
// applicable to a fresh agent terminal inside an existing worktree.
import { orcaCall, arg } from './lib.mjs';

export function terminalRename({ terminal, title }) {
  const r = orcaCall('terminal-rename', { terminal, title });
  return { ok: r.exitCode === 0 && Boolean(r.result), terminal, title, result: r.result, error: r.error };
}

if (process.argv[1]?.endsWith('terminal-rename.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalRename({ terminal: arg(argv, 'terminal'), title: arg(argv, 'title') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
