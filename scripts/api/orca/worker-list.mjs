#!/usr/bin/env node
// Deep map WRAP A2, W7: the live-worker count and the exited verdict are Orca's; admission policy and seat replacement stay the runtime's.
// worker-list.mjs — the calls.yaml `worker-list` call as a callable function: Orca's supervised worker
// terminal resource accounting (orchestration worker-list), the authority on which worker terminal is
// active, reclaimable, retained or released, and on each worker's liveness and next action.
//   node scripts/api/orca/worker-list.mjs [--run <run_id>] [--terminal-state <state>] [--all-pages]
//
// workerList reads one page ({ok, workers, counts, scope, page, error, hostUnavailable}); workerListAll follows
// page.nextCursor unchanged until hasMore is false (Orca returns at most 100 rows a page, newest first).
// Without `run` Orca scopes the list to the Run bound to the calling terminal, or to every Run when there is no
// binding; `scope.source` (flag | bound | all) says which, and callers that need every Run check it.
import { orcaCall, arg, flag } from './lib.mjs';

export const PAGE_LIMIT = 100;
/** A runaway cursor never loops forever: 50 pages are 5000 rows. */
export const MAX_PAGES = 50;

export function workerList({ run, terminalState, cursor, limit = PAGE_LIMIT } = {}) {
  const r = orcaCall('worker-list', { run, 'terminal-state': terminalState, cursor, limit: limit == null ? undefined : String(limit) });
  const result = r.result;
  return {
    ok: r.exitCode === 0 && Array.isArray(result?.workers),
    workers: result?.workers ?? [],
    counts: result?.counts ?? null,
    scope: result?.scope ?? null,
    page: result?.page ?? null,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

/** Every page of one listing, the cursor passed back unchanged. {ok, workers, counts, scope, pages, error, hostUnavailable}. */
export function workerListAll({ run, terminalState, maxPages = MAX_PAGES, list = workerList } = {}) {
  const workers = [];
  let cursor, first = null, pages = 0;
  for (;;) {
    const page = list({ run, terminalState, cursor });
    pages += 1;
    if (!page?.ok) return { ok: false, workers, counts: first?.counts ?? null, scope: first?.scope ?? null, pages, error: page?.error ?? 'worker-list failed', hostUnavailable: page?.hostUnavailable === true };
    first ??= page;
    workers.push(...page.workers);
    const next = page.page?.hasMore ? page.page.nextCursor : null;
    if (!next) break;
    if (pages >= maxPages) return { ok: false, workers, counts: first.counts, scope: first.scope, pages, error: `worker-list still had more rows after ${pages} pages`, hostUnavailable: false };
    cursor = next;
  }
  return { ok: true, workers, counts: first.counts, scope: first.scope, pages, error: null, hostUnavailable: false };
}

/**
 * Orca's active workers over every Run, or null: a failed read, or a listing Orca scoped to the caller's bound Run
 * (scope.source bound) instead of every Run, proves nothing about the host.
 */
export function activeWorkersAllRuns({ list = () => workerListAll({ terminalState: 'active' }) } = {}) {
  try {
    const listed = list();
    if (!listed?.ok || listed.scope?.source !== 'all') return null;
    return listed.workers ?? [];
  } catch { return null; }
}

if (process.argv[1]?.endsWith('worker-list.mjs')) {
  const argv = process.argv.slice(2);
  const params = { run: arg(argv, 'run'), terminalState: arg(argv, 'terminal-state') };
  const out = flag(argv, 'all-pages') ? workerListAll(params) : workerList({ ...params, cursor: arg(argv, 'cursor') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
