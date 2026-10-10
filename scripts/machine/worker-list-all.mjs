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

// A cursor is meaningful only within its original scope. Missing scope or pagination metadata cannot prove absence.
function pageProblem(page, run, first) {
  const scope = page?.scope, meta = page?.page;
  if (!Array.isArray(page?.workers) || !['flag', 'bound', 'all'].includes(scope?.source)) return 'worker-list scope or rows are unreadable';
  if (scope.source === 'all' ? scope.run != null : typeof scope.run !== 'string' || !scope.run) return 'worker-list Run scope is unreadable';
  if (run != null && (scope.source !== 'flag' || scope.run !== run)) return 'worker-list did not answer the requested Run';
  if (first && (scope.source !== first.scope.source || (scope.run ?? null) !== (first.scope.run ?? null))) return 'worker-list scope changed between pages';
  if (!meta || typeof meta.hasMore !== 'boolean' || !Number.isSafeInteger(meta.total) || meta.total < 0) return 'worker-list pagination is unreadable';
  if (first && meta.total !== first.page.total) return 'worker-list total changed between pages';
  if (meta.hasMore ? typeof meta.nextCursor !== 'string' || !meta.nextCursor : meta.nextCursor != null) return 'worker-list cursor contradicts pagination';
  if (page.workers.some(row => typeof row?.dispatchId !== 'string' || !row.dispatchId || typeof row.runId !== 'string' || !row.runId
    || (scope.source !== 'all' && row.runId !== scope.run))) return 'worker-list rows contradict their Run scope';
  return null;
}

// A page is appended only after all Dispatch identities are unique, keeping partial failure rows unchanged.
function appendPage(page, workers, dispatches) {
  for (const row of page.workers) {
    if (dispatches.has(row.dispatchId)) return 'worker-list repeated a Dispatch across pages';
    dispatches.add(row.dispatchId);
  }
  workers.push(...page.workers);
  return null;
}

function cursorProblem(next, cursors, pages, maxPages) {
  if (cursors.has(next)) return 'worker-list repeated a cursor';
  cursors.add(next);
  return pages >= maxPages ? `worker-list still had more rows after ${pages} pages` : null;
}

/** Every page of one listing, the cursor passed back unchanged. {ok, workers, counts, scope, pages, error, hostUnavailable}. */
export function workerListAll({ run, terminalState, maxPages = MAX_PAGES, list = workerList } = {}) {
  const workers = [];
  const cursors = new Set(), dispatches = new Set();
  let cursor, first = null, pages = 0;
  for (;;) {
    const page = list({ run, terminalState, cursor });
    pages += 1;
    if (!page?.ok) return { ok: false, workers, counts: first?.counts ?? null, scope: first?.scope ?? null, pages, error: page?.error ?? 'worker-list failed', hostUnavailable: page?.hostUnavailable === true };
    const problem = pageProblem(page, run, first);
    if (problem) return { ok: false, workers, counts: first?.counts ?? null, scope: first?.scope ?? page.scope ?? null, pages, error: problem, hostUnavailable: false };
    first ??= page;
    const appendProblem = appendPage(page, workers, dispatches);
    if (appendProblem) return { ok: false, workers, counts: first.counts, scope: first.scope, pages, error: appendProblem, hostUnavailable: false };
    const next = page.page?.hasMore ? page.page.nextCursor : null;
    if (!next) break;
    const cursorIssue = cursorProblem(next, cursors, pages, maxPages);
    if (cursorIssue) return { ok: false, workers, counts: first.counts, scope: first.scope, pages, error: cursorIssue, hostUnavailable: false };
    cursor = next;
  }
  if (workers.length !== first.page.total) return { ok: false, workers, counts: first.counts, scope: first.scope, pages, error: 'worker-list ended before its total was covered', hostUnavailable: false };
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
