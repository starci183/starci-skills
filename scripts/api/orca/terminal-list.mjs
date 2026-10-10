#!/usr/bin/env node
// Deep map WRAP T5: tab ids and titles for closing tabs Orca restored that no ledger binds; ownership of worker terminals is worker-list's.
// terminal-list.mjs — the calls.yaml `terminal-list` call as a callable function.
// Internal entry: spawned by scripts/checks/check-orca-tree.mjs; not invoked directly.
// Args: [--worktree <sel>] [--include-visual-layouts]
// `visualLayouts` (with includeVisualLayouts) carries each tab's own title: a
// provider TUI rewrites the pane title (Codex sets it to the cwd name), while
// the tab keeps the title `terminal create --title` gave it.
import { orcaCall } from './lib.mjs';
import { arg, flag } from '../../lib/cli-arg.mjs';
import { terminalInventoryOf } from '../../lib/orca-terminal.mjs';

/**
 * Read the host's terminal inventory, optionally scoped to one worktree, without claiming ownership.
 * includeVisualLayouts preserves tab layout/title details independently of provider pane titles.
 * Empty fallback arrays on a failed or unavailable-host read do not prove that no terminal exists.
 * @param {object} [input] - Optional worktree selector and visual-layout inclusion flag.
 * @returns {object} ok, terminals, visualLayouts, error, and hostUnavailable for caller verification.
 */
export function terminalList({ worktree, includeVisualLayouts = false } = {}) {
  const r = orcaCall('terminal-list', { worktree, 'include-visual-layouts': includeVisualLayouts === true });
  const inventory = terminalInventoryOf({ ok: r.exitCode === 0 && r.receipt?.ok === true, terminals: r.result?.terminals, hostUnavailable: r.hostUnavailable });
  return { ok: inventory !== null, terminals: inventory ?? [],
    visualLayouts: r.result?.visualLayouts ?? [], error: r.error || (inventory === null ? 'terminal inventory is unreadable' : null), hostUnavailable: r.hostUnavailable === true };
}

if (process.argv[1]?.endsWith('terminal-list.mjs')) {
  const argv = process.argv.slice(2);
  const out = terminalList({ worktree: arg(argv, 'worktree'), includeVisualLayouts: flag(argv, 'include-visual-layouts') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
