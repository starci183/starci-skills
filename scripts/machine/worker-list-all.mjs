#!/usr/bin/env node
// worker-list-all.mjs — every page of Orca's supervised worker listing (scripts/api/orca/worker-list.mjs workerList,
// one page of at most 100 rows, newest first), and the active workers over every Run.
// Internal entry: spawned by scripts/checks/check-orca-tree.mjs; not invoked directly.
// Args: [--run <run_id>] [--terminal-state <state>].
//
// workerListAll follows page.nextCursor unchanged until hasMore is false. Without `run` Orca scopes the list to the Run
// bound to the calling terminal, or to every Run when there is no binding; `scope.source` (flag | bound | all) says
// which, and callers that need every Run check it (activeWorkersAllRuns).
import { workerList } from '../api/orca/worker-list.mjs';
import { arg } from '../lib/cli-arg.mjs';
import { isMain } from '../lib/is-main.mjs';

/** A runaway cursor never loops forever: 50 pages are 5000 rows. */
const MAX_PAGES = 50;

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

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = workerListAll({ run: arg(argv, 'run'), terminalState: arg(argv, 'terminal-state') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
