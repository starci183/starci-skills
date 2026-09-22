#!/usr/bin/env node
// terminal-list.mjs — the calls.yaml `terminal-list` call as a callable function.
//   node scripts/api/orca/terminal-list.mjs [--worktree <sel>]
import { orcaCall, arg } from './lib.mjs';

export function terminalList({ worktree } = {}) {
  const r = orcaCall('terminal-list', { worktree });
  return { ok: r.exitCode === 0, terminals: r.result?.terminals ?? [], error: r.error };
}

if (process.argv[1]?.endsWith('terminal-list.mjs')) {
  const out = terminalList({ worktree: arg(process.argv.slice(2), 'worktree') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
