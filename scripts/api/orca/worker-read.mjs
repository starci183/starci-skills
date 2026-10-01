#!/usr/bin/env node
// Deep map WRAP RR5, RR6: Orca's archive is unredacted and on Orca's retention, so the blob store plus redact.mjs stay the sink.
// worker-read.mjs — the calls.yaml `worker-read` call as a callable function: Orca's bounded output of one
// supervised worker, read by its Dispatch (deep map T1, REPLACE: the one read of a worker's output).
//   node scripts/api/orca/worker-read.mjs --dispatch <dispatch_id> [--source <auto|transcript|terminal>] [--cursor <c>] [--limit <n>] [--all-pages]
//
// Every worker is read by Dispatch, never by terminal handle: Orca 1.4.209 states that not every worker has a
// terminal and that `orca terminal` verbs do not accept every worker handle, while `worker-read --source auto`
// always works (it serves the exact hook-reported transcript when there is one, else labelled terminal output
// with a typed fallbackReason). Reads still work after worker-release, from Orca's archive.
//
// workerRead reads ONE page: {ok, source, status, rows, draft, cursor, contentComplete, clipping, warnings,
//   fallbackReason, archived, sourceChanged, errorCode, error, hostUnavailable, result}.
//   rows are plain text: terminal tail lines, or transcript messages rendered `[role] text` (Orca's own text form).
// workerOutput follows the top-level cursor (pinned to its source) until a page returns no rows, the cursor stops
// moving or MAX_PAGES; a `source_changed` answer restarts it once without the cursor. Its contentComplete is true
// only when every page said so: a bounded tail, a clipped buffer or a terminal fallback reads false, and callers
// keep that flag with what they store instead of claiming a complete transcript.
import { orcaCall, arg, flag } from './lib.mjs';

export const SOURCES = Object.freeze(['auto', 'transcript', 'terminal']);
export const PAGE_LIMIT = 500;
/** A runaway cursor never loops forever: 200 pages of 500 rows. */
export const MAX_PAGES = 200;
export const SOURCE_CHANGED = 'source_changed';

const blockText = (block) => {
  if (!block || typeof block !== 'object') return null;
  if (block.type === 'text') return typeof block.text === 'string' ? block.text : null;
  if (block.type === 'tool-call') { let input; try { input = JSON.stringify(block.input); } catch { input = String(block.input); } return `[tool ${block.name}] ${input}`; }
  if (block.type === 'tool-result') return `[tool result${block.isError ? ' error' : ''}] ${block.output ?? ''}`;
  if (block.type === 'image-ref') return block.url ? `[image] ${block.url}` : '[image omitted]';
  return null;
};
/** One transcript message as Orca's CLI prints it: `[role] <blocks joined by newlines>`. */
export const messageText = (message) => {
  if (typeof message === 'string') return message;
  const blocks = Array.isArray(message?.blocks) ? message.blocks.map(blockText).filter((t) => t != null) : [];
  return `[${message?.role ?? 'unknown'}] ${blocks.join('\n')}`.trimEnd();
};

export function workerRead({ dispatch, source = null, cursor = null, limit = null }) {
  const r = orcaCall('worker-read', { dispatch, source, cursor, limit: limit == null ? undefined : String(limit) });
  const result = r.result;
  const errorCode = typeof r.receipt?.error?.code === 'string' ? r.receipt.error.code : null;
  const kind = result?.source ?? null;
  const rows = kind === 'transcript'
    ? (Array.isArray(result?.transcript?.messages) ? result.transcript.messages.map(messageText) : [])
    : (Array.isArray(result?.terminal?.tail) ? result.terminal.tail.map((l) => String(l ?? '')) : []);
  return {
    ok: r.exitCode === 0 && Boolean(result) && (kind === 'transcript' || kind === 'terminal'),
    source: kind,
    status: result?.status ?? null,
    rows,
    draft: typeof result?.terminal?.draft === 'string' && result.terminal.draft.trim() ? result.terminal.draft : null,
    cursor: result?.cursor ?? null,
    contentComplete: result?.contentComplete === true,
    clipping: Array.isArray(result?.clipping) ? result.clipping.map(String) : [],
    warnings: Array.isArray(result?.warnings) ? result.warnings.map(String) : [],
    fallbackReason: result?.fallbackReason ?? null,
    archived: result?.archived === true,
    sourceChanged: errorCode === SOURCE_CHANGED,
    errorCode,
    result,
    error: r.error,
    hostUnavailable: r.hostUnavailable === true,
  };
}

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

if (process.argv[1]?.endsWith('worker-read.mjs')) {
  const argv = process.argv.slice(2);
  const params = { dispatch: arg(argv, 'dispatch'), source: arg(argv, 'source'), limit: arg(argv, 'limit') };
  const out = flag(argv, 'all-pages') ? workerOutput({ ...params, source: params.source ?? 'auto', limit: params.limit ?? PAGE_LIMIT })
    : workerRead({ ...params, cursor: arg(argv, 'cursor') });
  console.log(JSON.stringify(out, null, 2));
  process.exit(out.ok ? 0 : 1);
}
