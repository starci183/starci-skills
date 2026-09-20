#!/usr/bin/env node
// terminal-create.mjs — `orca terminal create` as a callable function.
//   node scripts/api/orca/terminal-create.mjs --worktree <path|sel> --title <t> --command <cmd> [--json]
// Prints the create receipt; stdout JSON always carries {ok, handle, terminal}.
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function terminalCreate({ worktree, title, command }) {
  const argv = ['terminal', 'create', '--json'];
  if (worktree) argv.push('--worktree', worktree);
  if (title) argv.push('--title', title);
  if (command) argv.push('--command', command);
  const r = orcaRun(argv);
  const terminal = jsonOf(r.stdout)?.result?.terminal ?? null;
  return { ok: r.status === 0 && Boolean(terminal?.handle), handle: terminal?.handle ?? null, terminal, error: r.error ?? r.stderr };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('terminal-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalCreate({ worktree: arg(argv, 'worktree'), title: arg(argv, 'title'), command: arg(argv, 'command') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
