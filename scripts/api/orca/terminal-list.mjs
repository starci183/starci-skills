#!/usr/bin/env node
// terminal-list.mjs — `orca terminal list` as a callable function.
//   node scripts/api/orca/terminal-list.mjs [--worktree <sel>]
import { orcaRun, jsonOf, arg } from './lib.mjs';

export function terminalList({ worktree } = {}) {
  const argv = ['terminal', 'list', '--json'];
  if (worktree) argv.push('--worktree', worktree);
  const r = orcaRun(argv);
  const terminals = jsonOf(r.stdout)?.result?.terminals ?? [];
  return { ok: r.status === 0, terminals, error: r.error ?? r.stderr };
}

if (process.argv[1]?.endsWith('terminal-list.mjs')) {
  const out = terminalList({ worktree: arg(process.argv.slice(2), 'worktree') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
