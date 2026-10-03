#!/usr/bin/env node
// worker-output.mjs — every page of one supervised worker's output, read by its Dispatch through Orca's
// `worker-read --source auto` (scripts/api/orca/worker-read.mjs workerRead reads one page).
// Internal entry: spawned by scripts/kernel/transcripts.mjs; not invoked directly.
// Args: --dispatch <dispatch_id> [--source <auto|transcript|terminal>] [--limit <n>].
//
// workerOutput follows the top-level cursor (pinned to its source) until a page returns no rows, the cursor stops
// moving or MAX_PAGES; a `source_changed` answer restarts it once without the cursor. Its contentComplete is true
// only when every page said so: a bounded tail, a clipped buffer or a terminal fallback reads false, and callers
// keep that flag with what they store instead of claiming a complete transcript.
import { workerRead } from '../api/orca/worker-read.mjs';
import { arg } from '../lib/cli-arg.mjs';
import { isMain } from '../lib/is-main.mjs';

const PAGE_LIMIT = 500;
/** A runaway cursor never loops forever: 200 pages of 500 rows. */
const MAX_PAGES = 200;

const pagesFrom = ({ dispatch, source, limit, maxPages, read }) => {
  const pages = [];
  let cursor = null;
  for (let i = 0; i < maxPages; i += 1) {
    const page = read({ dispatch, source, cursor, limit });
    if (!page?.ok) return { pages, failed: page ?? { ok: false, error: 'no answer' } };
    pages.push(page);
    if (!page.rows.length || !page.cursor || page.cursor === cursor) return { pages, failed: null };
    cursor = page.cursor;
  }
  return { pages, failed: null, capped: true };
};

/**
 * Every page of one worker's output, oldest page first. Returns {ok, dispatch, source, rows, text, contentComplete,
 * clipping, warnings, fallbackReason, archived, pages, restarted, capped, cursor, errorCode, error, hostUnavailable}.
 * A first page that fails is the failure; a later page that fails (other than source_changed) keeps what was read
 * and marks contentComplete false with clipping `read_failed`.
 */
export function workerOutput({ dispatch, source = 'auto', limit = PAGE_LIMIT, maxPages = MAX_PAGES, read = workerRead }) {
  let run = pagesFrom({ dispatch, source, limit, maxPages, read });
  let restarted = false;
  if (run.failed?.sourceChanged) { restarted = true; run = pagesFrom({ dispatch, source, limit, maxPages, read }); }
  const { pages, failed, capped = false } = run;
  if (!pages.length || failed?.sourceChanged) {
    const f = failed ?? {};
    return { ok: false, dispatch, source: null, rows: [], text: '', contentComplete: false, clipping: [], warnings: [], pages: pages.length, restarted,
      errorCode: f.errorCode ?? null, error: f.error ?? null, hostUnavailable: f.hostUnavailable === true };
  }
  const rows = pages.flatMap((p) => p.rows);
  const last = pages.at(-1);
  if (last.draft) rows.push(last.draft);
  const clipping = [...new Set([...pages.flatMap((p) => p.clipping), ...(failed ? ['read_failed'] : []), ...(capped ? ['page_cap'] : [])])];
  return {
    ok: true, dispatch, source: pages[0].source, rows, text: rows.join(pages[0].source === 'transcript' ? '\n\n' : '\n'),
    contentComplete: pages.every((p) => p.contentComplete) && !failed && !capped,
    clipping, warnings: [...new Set(pages.flatMap((p) => p.warnings))],
    fallbackReason: pages[0].fallbackReason, archived: pages[0].archived, pages: pages.length, restarted, capped, cursor: last.cursor,
    errorCode: failed?.errorCode ?? null, error: failed?.error ?? null, hostUnavailable: false,
  };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const out = workerOutput({ dispatch: arg(argv, 'dispatch'), source: arg(argv, 'source') ?? 'auto', limit: arg(argv, 'limit') ?? PAGE_LIMIT });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
