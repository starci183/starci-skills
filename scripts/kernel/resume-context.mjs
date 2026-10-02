// resume-context.mjs — the retry of a worker that died without a report resumes from what it left.
//
// A failed-no-report settle queues ONE retry of the same op (modules/models/kinds.yaml route
// no-report-retries-on-another-pool), and the retry used to start cold: its prompt said nothing of the
// dead attempt, so it re-derived and re-ran every step, and sometimes re-did work already on disk
// (2026-09-27: a collab backend.implement a9 died with seven composition-r5 evidence files written;
// a10 began again from nothing). resumeContextOf(db, job) reads the attempt the retry continues
// (jobs.retry_of) and, when that attempt settled failed-no-report, returns the packet's
// context.resume_from: its liveness and environment, the effect evidence settle recorded (dirty files,
// commits), and the tail of its typed op log (the rows it wrote through api log).
// resumePromptLines renders it. Ledger reads only.
import { parseJsonOr } from '../lib/json.mjs';
import { jobResultSql } from '../machine/job-row.mjs';

const EVIDENCE_MAX = 25;
const LOG_TAIL = 12;

export function resumeContextOf(db, job) {
  const payload = parseJsonOr(job?.payload_json ?? '{}');
  const retryOf = 'retry_of' in (job ?? {}) ? job.retry_of : (job?.job_id ? db.prepare('SELECT retry_of FROM jobs WHERE job_id=?').get(job.job_id)?.retry_of : null);
  const of = retryOf ?? (payload.retryReason?.reason === 'failed-no-report' ? payload.retryReason.of : null);
  if (!of) return null;
  const dead = db.prepare(`SELECT job_id, try_no AS attempt, ${jobResultSql('jobs')} AS result_json, workflow_id FROM jobs WHERE job_id=?`).get(of);
  if (!dead) return null;
  const result = parseJsonOr(dead.result_json ?? '{}');
  if (result.reason !== 'failed-no-report') return null;
  const evidence = (Array.isArray(result.evidence) ? result.evidence : []).map(String);
  let log = [];
  try {
    log = db.prepare("SELECT kind, msg FROM logs WHERE workflow_id=? AND job_id=? AND actor='op' ORDER BY seq DESC LIMIT ?")
      .all(dead.workflow_id, of, LOG_TAIL).reverse().map((row) => ({ kind: row.kind, msg: String(row.msg).slice(0, 200) }));
  } catch { /* a ledger without the logs table: evidence alone */ }
  return {
    of, attempt: dead.attempt, liveness: result.worker?.liveness ?? null, environment: result.environment ?? null,
    effectState: result.effectState ?? null,
    evidence: evidence.slice(0, EVIDENCE_MAX), evidenceMore: Math.max(0, evidence.length - EVIDENCE_MAX),
    log,
  };
}

export function resumePromptLines(resume) {
  if (!resume) return [];
  return [
    `resume_from: attempt ${resume.attempt} (${resume.of}) died with no report (worker ${resume.liveness ?? 'dead'}${resume.environment ? `, a ${resume.environment} - the environment, not the op` : ''}; effect ${resume.effectState ?? 'unknown'}).`,
    `  What it left under your owned_paths is where you continue: re-verify each file below against your brief, keep what is correct, finish what is missing; do not restart finished steps or discard its work without a reason.`,
    ...resume.evidence.map((item) => `  - ${item}`),
    ...(resume.evidenceMore ? [`  - +${resume.evidenceMore} more (git status under your owned paths)`] : []),
    ...(resume.log.length ? [`  its last typed log rows: ${resume.log.map((row) => `[${row.kind}] ${row.msg}`).join(' | ')}`] : []),
  ];
}
