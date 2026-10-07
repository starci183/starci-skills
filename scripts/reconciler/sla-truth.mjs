// sla-truth.mjs — whether the condition of one open SLA clock still holds, read from the ledger, the machine state or a
// service probe (reconciler/sla.mjs truthPass clears the clock once it does not).
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { repeatInOrder } from '../lib/in-order.mjs';

const SETTLED_JOB = new Set(SETTLED_JOB_LIST);
const LIVE_DECISION = new Set(['open', 'claimed', 'escalated']);
/** The clock code of a closed op attempt or an ended seat turn whose transcript never became a blob. */
export const TRANSCRIPT_CODE = 'TRANSCRIPT_MISSING';
/** job clock code -> the job statuses in which its condition can still hold (null: any unsettled status). */
const JOB_TRUTH = Object.freeze({
  LEASE_STUCK: ['leased'], QUESTION_OVERDUE: ['answering'], EFFECT_UNKNOWN_STUCK: ['effect_unknown'],
  DEAD_WORKER_UNRECONCILED: ['running', 'answering', 'effect_unknown'], SETTLE_OVERDUE: null, DECISION_OVERDUE: null,
});

/** SERVICE_DOWN of a service clock: the service's own probe, tried twice. */
async function serviceTruth(p, src) {
  const entry = (await src.registry())?.find((e) => e.name === p.slice(1).join(':'));
  if (typeof entry?.probe !== 'function') return null;
  // Two tries: the first request after idle can miss a short probe timeout while the service is up.
  return repeatInOrder(async (i) => {
    if (i >= 2) return { holds: true };
    const r = await entry.probe();
    if (r?.ok === true || r?.unmanaged === true) return { holds: false, why: 'probe ok' + (r?.status ? ' (http ' + r.status + ')' : '') + (i ? ' on the second try' : '') };
    return undefined;
  });
}

/** The truth of a job clock: the job's status in its ledger, and for DECISION_OVERDUE the decisions opened for it. */
async function jobTruth(p, code, src, now) {
  const db = src.ledgerOf(p[1]);
  if (!db) return null;
  const jobId = p.slice(2).join(':');
  const job = db.prepare('SELECT status, workflow_id FROM jobs WHERE job_id=?').get(jobId);
  if (!job) return { holds: false, why: 'job gone' };
  if (SETTLED_JOB.has(job.status)) return { holds: false, why: `job ${job.status}` };
  const allowed = JOB_TRUTH[code];
  if (allowed && !allowed.includes(job.status)) return { holds: false, why: `job ${job.status}` };
  if (code === 'DECISION_OVERDUE') {
    const mod = await src.decisions();
    if (typeof mod?.listDecisions !== 'function') return null;
    const mine = mod.listDecisions(db, { workflowId: job.workflow_id, all: true, now }).filter((d) => d?.entity?.id === jobId);
    // Only a decision that existed and is no longer live clears it: before its DI opens, the clock is the job controller's.
    if (mine.length && !mine.some((d) => LIVE_DECISION.has(d.status))) {
      const last = mine[mine.length - 1];
      return { holds: false, why: `decision ${last.id ?? last.idempotencyKey ?? ''} ${last.status}` };
    }
  }
  return { holds: true };
}

/** The truth of a TRANSCRIPT_MISSING clock of an attempt: whether the attempt's transcript blob exists. */
function attemptTruth(p, src) {
  const db = src.ledgerOf(p[1]);
  if (!db) return null;
  const a = db.prepare('SELECT transcript_sha FROM op_attempts WHERE attempt_id=?').get(p.slice(2).join(':'));
  if (!a) return { holds: false, why: 'attempt gone' };
  return a.transcript_sha ? { holds: false, why: 'transcript captured' } : { holds: true };
}

/** The truth of a TRANSCRIPT_MISSING clock of a seat turn: whether a snapshot at or after its end exists. */
function seatTurnTruth(p, src) {
  const t = src.state?.((db) => db.prepare('SELECT t.seat_id, t.ended_at, EXISTS(SELECT 1 FROM seat_transcript_snapshots s WHERE s.seat_id=t.seat_id AND s.at >= t.ended_at) AS captured FROM seat_turns t WHERE t.turn_id=?').get(Number(p[1])));
  if (t == null) return null;
  return t.captured ? { holds: false, why: 'transcript captured' } : { holds: true };
}

/** The truth of a seat, stuck or workflow clock: it holds only while its workflow is running. */
function workflowTruth(p, src) {
  const db = src.ledgerOf(p[0] === 'seat' ? p[2] : p[1]);
  if (!db) return null;
  let wf = p[2]; if (p[0] === 'workflow') wf = p.slice(2).join(':'); else if (p[0] === 'seat') wf = p.slice(3).join(':');
  const w = db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(wf);
  if (w?.phase !== 'running' || w?.archived_at != null) return { holds: false, why: `workflow ${(w?.archived_at != null && 'archived') || (w?.phase ?? (w ? 'not running' : 'gone'))}` };
  return { holds: true };
}

/** Whether one clock's condition still holds: {holds, why?} or null (unknown). Never throws. */
export async function clockTruth(row, code, src, { now = Date.now() } = {}) {
  try {
    const p = String(row.entity ?? '').split(':');
    if (code === 'SERVICE_DOWN' && p[0] === 'service') return await serviceTruth(p, src);
    if (p[0] === 'job' && p.length >= 3 && Object.hasOwn(JOB_TRUTH, code)) return await jobTruth(p, code, src, now);
    if (code === TRANSCRIPT_CODE && p[0] === 'attempt' && p.length >= 3) return attemptTruth(p, src);
    if (code === TRANSCRIPT_CODE && p[0] === 'seat-turn' && p.length >= 2) return seatTurnTruth(p, src);
    // MB-08 / Q14: a seat or workflow clock of a workflow that is no longer running (paused, stopped, finished,
    // archived) is gone: a stopped workflow's seat is not vacant, and no controller ever brings it back.
    if ((p[0] === 'workflow' && p.length >= 3) || (p[0] === 'stuck' && p.length >= 4) || (p[0] === 'seat' && p[1] === 'kernel' && p.length >= 4)) return workflowTruth(p, src);
    return null;
  } catch { return null; }
}
