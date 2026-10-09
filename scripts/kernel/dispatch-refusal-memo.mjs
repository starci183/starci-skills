// dispatch-refusal-memo.mjs - the same dispatch refusal of the same ready job is recorded once, not every push.
// The Workflow controller pushes `dispatch-ready` about once a minute. A ready job whose route or dispatch is refused for a cause that did not change was routed and refused
// again every time (live, 2026-10-09: about fifty route-decided events between the enqueue and the dispatch of one job, grammar-context-missing every minute before that).
// The refusal is kept on the job (payload.dispatchRefusal: {code, step, fingerprint, firstAt, lastAt, count, nextAt}) and the job is left alone until nextAt, which doubles
// with every repeat (declared: modules/models/runtimes.yaml allocation.dispatchRefusal). It is tried at once when the fingerprint changed: another runtime revision, a
// ruling the Kernel or the owner gave, or one of the resources the refusal names (its `watch` files) appeared, vanished or changed.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { allocationSettings } from '../../engine/config.mjs';
import { retryAfterFailure } from '../lib/retry-budget.mjs';

const VOLATILE = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b|\b(?:push|term|ctx|run|req)[-_][0-9a-f]{6,}\b/gi;
const RULING_EVENTS = ['kernel-decision', 'gate-answered', 'owner-answered', 'supervisor-ruling-applied'];

/** The declared growth as a retry budget (scripts/lib/retry-budget.mjs doubles the interval per repeat): {baseMs, capMs}. */
const refusalBudget = () => { const { baseMs, capMs } = allocationSettings().dispatchRefusal; return { intervalMs: baseMs, maxIntervalMs: capMs }; };

/** The state of the files a refusal names: 'absent' or their mtime, in order. */
const watchedState = (watch) => (watch ?? []).map((file) => { try { return String(fs.statSync(file).mtimeMs); } catch { return 'absent'; } }).join(',');

/** The latest ruling the ledger holds for the workflow (the seq of its newest ruling event), or 0. */
const rulingSeq = (db, workflowId) => Number(db.prepare(`SELECT max(seq) AS seq FROM events WHERE workflow_id=? AND kind IN (${RULING_EVENTS.map(() => '?').join(',')})`).get(workflowId, ...RULING_EVENTS)?.seq ?? 0);

const reasonOf = (refusal) => String(refusal.reason ?? refusal.detail ?? '').slice(0, 300);

/** What a refusal depends on: its code and step, the detail with ids removed, the runtime revision, the newest ruling and the state of its watched files. */
export function fingerprintOf({ db, workflowId, refusal, rev }) {
  const detail = reasonOf(refusal).replace(VOLATILE, '#');
  return crypto.createHash('sha256').update(JSON.stringify([refusal.code, refusal.step ?? null, detail, rev ?? null, rulingSeq(db, workflowId), watchedState(refusal.watch)])).digest('hex').slice(0, 16);
}

/** The memo on a job payload, or null. */
export const memoOf = (payload) => payload?.dispatchRefusal ?? null;

/** Whether the job is left alone now: the memo stands for the same fingerprint and its interval has not run out. */
export const isHeld = (memo, { fingerprint, now }) => Boolean(memo) && memo.fingerprint === fingerprint && now < memo.nextAt;

/** The memo after one more refusal: a new cause starts at the base interval, the same cause waits twice as long, up to the cap. */
export function nextMemo(prev, { refusal, fingerprint, now }) {
  const same = prev && prev.fingerprint === fingerprint;
  const step = retryAfterFailure(refusalBudget(), same ? { attempts: prev.count, firstAt: prev.firstAt } : null, { now, reason: String(refusal.code) });
  return { code: refusal.code, step: refusal.step ?? null, reason: reasonOf(refusal), fingerprint, firstAt: step.firstAt, lastAt: now, count: step.attempts, nextAt: step.dueAt,
    ...(refusal.cause ? { cause: refusal.cause } : {}), ...(refusal.watch?.length ? { watch: refusal.watch } : {}) };
}
