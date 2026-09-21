#!/usr/bin/env node
// terminal-rename.mjs — `orca terminal rename` as a callable function.
//   node scripts/api/orca/terminal-rename.mjs --terminal <handle> --title <text>
// Used after managed worker-start because creation display-name flags are not
// applicable to a fresh agent terminal inside an existing worktree.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function terminalRename({ terminal, title }) {
  if (!terminal) throw new Error('terminalRename: missing required --terminal');
  if (!title) throw new Error('terminalRename: missing required --title');
  const r = orcaRun(['terminal', 'rename', '--terminal', terminal, '--title', title, '--json']);
  const result = jsonOf(r.stdout)?.result ?? null;
  return { ok: r.status === 0 && Boolean(result), terminal, title, result, error: r.error ?? r.stderr };
}

if (process.argv[1]?.endsWith('terminal-rename.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalRename({ terminal: arg(argv, 'terminal'), title: arg(argv, 'title') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
