#!/usr/bin/env node
// Deep map WRAP T5: tab ids and titles for closing tabs Orca restored that no ledger binds; ownership of worker terminals is worker-list's.
// terminal-list.mjs — the calls.yaml `terminal-list` call as a callable function.
//   node scripts/api/orca/terminal-list.mjs [--worktree <sel>] [--include-visual-layouts]
// `visualLayouts` (with includeVisualLayouts) carries each tab's own title: a
// provider TUI rewrites the pane title (Codex sets it to the cwd name), while
// the tab keeps the title `terminal create --title` gave it.
import { orcaCall } from './lib.mjs';
import { arg, flag } from '../../lib/cli-arg.mjs';

export function terminalList({ worktree, includeVisualLayouts = false } = {}) {
  const r = orcaCall('terminal-list', { worktree, 'include-visual-layouts': includeVisualLayouts === true });
  return { ok: r.exitCode === 0, terminals: r.result?.terminals ?? [],
    visualLayouts: r.result?.visualLayouts ?? [], error: r.error, hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('terminal-list.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalList({ worktree: arg(argv, 'worktree'), includeVisualLayouts: flag(argv, 'include-visual-layouts') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
