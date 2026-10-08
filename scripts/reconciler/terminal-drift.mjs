// terminal-drift.mjs — INV-H2: the StarCi terminals Orca holds against the workers Orca itself holds active.
//
// Only a terminal the runtime opened is the runtime's to count and to close: a tab titled [Kernel], [Op], [Worker] or [Supervisor]. The
// owner's own shells, coordinators and per-worktree terminals are never counted, so the clock can clear by closing the runtime's
// leftovers. On 2026-10-07 the clock counted every Orca terminal (41 against 8 workers), stayed open for twenty hours and named an
// auto-action that nothing performed. A violated clock now runs the dedupe pass (services --dedupe: the StarCi terminals no ledger binds),
// at most once per SLA window; shadow mode records the run and executes nothing.
import { tabTitlesOf } from '../kernel/terminal-dedupe.mjs';

const RUNTIME_TITLE = /\[(?:Kernel|Op|Worker|Supervisor)\]/;

/** The number of runtime-titled tabs in one `terminal list --include-visual-layouts` answer, or null when Orca does not answer. */
export function runtimeTerminalCount(listed) {
  if (listed?.ok !== true) return null;
  const titles = tabTitlesOf(listed.visualLayouts ?? [], listed.terminals ?? []);
  return [...titles.values()].filter((title) => RUNTIME_TITLE.test(String(title ?? ''))).length;
}

/**
 * One drift pass: the count against the active workers plus terminalSlack. Returns {count, expected, workers}, or null when Orca does
 * not answer for every Run (that proves nothing: no count, no clock).
 */
export async function runTerminalDrift({ ctx, p, state, orcaTerminals, activeWorkers, clock, clear, dedupeArgs }) {
  const terminals = await orcaTerminals();
  const active = terminals == null ? null : await activeWorkers();
  if (terminals == null || !Array.isArray(active)) return null;
  const expected = active.length + p.terminalSlack;
  const drift = { count: terminals, expected, workers: active.length };
  if (terminals <= expected) {
    await clear(ctx, 'host:terminals', 'TERMINAL_COUNT_DRIFT');
    return drift;
  }
  await clock(ctx, 'host:terminals', 'TERMINAL_COUNT_DRIFT', p.terminalDriftSlaMs, { code: 'TERMINAL_COUNT_DRIFT', owner: 'host-controller', ledgerId: 'supervisor', count: terminals, expected });
  if (ctx.now() - (state.lastDriftDedupeAt ?? 0) >= p.terminalDriftSlaMs) {
    state.lastDriftDedupeAt = ctx.now();
    await ctx.run('node', dedupeArgs, { timeoutMs: 600_000 });
  }
  return drift;
}
