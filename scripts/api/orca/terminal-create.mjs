#!/usr/bin/env node
// terminal-create.mjs — the calls.yaml `terminal-create` call as a callable function.
//   node scripts/api/orca/terminal-create.mjs --worktree <path|sel> --title <t> --command <cmd> [--json]
// Prints the create receipt; stdout JSON always carries {ok, handle, terminal}.
import { orcaCall, arg } from './lib.mjs';

export function terminalCreate({ worktree, title, command }) {
  const r = orcaCall('terminal-create', { worktree, title, command });
  const terminal = r.result?.terminal ?? null;
  return { ok: r.exitCode === 0 && Boolean(terminal?.handle), handle: terminal?.handle ?? null, terminal, error: r.error };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href || process.argv[1]?.endsWith('terminal-create.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalCreate({ worktree: arg(argv, 'worktree'), title: arg(argv, 'title'), command: arg(argv, 'command') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
