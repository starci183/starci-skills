import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// Public API projection: only explicit ledger transitions, never raw payloads, report paths or terminal output.
const KINDS = [
  'job-enqueued', 'op-dispatched', 'report-filed', 'kernel-transition-woken',
  'report-consumed', 'checks-recorded', 'op-settled', 'job-dropped', 'work-graph-version',
];
const placeholders = KINDS.map(() => '?').join(',');
const limited = (value, max = 120) => typeof value === 'string' ? value.slice(0, max) : null;
const payloadOf = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };

export function readWorkflowEvents(project, workflowId, { after = 0, limit = 80 } = {}) {
  const db = new DatabaseSync(path.join(project.repo, '.starciwork', 'runtime.sqlite'), { readOnly: true });
  try {
    if (!db.prepare('SELECT 1 FROM workflows WHERE workflow_id=? LIMIT 1').get(workflowId)) return null;
    const cursor = Number.isSafeInteger(after) && after > 0 ? after : 0;
    const take = Math.min(120, Math.max(1, Number(limit) || 80));
    const sql = cursor
      ? `SELECT seq, kind, entity_id, created_at, payload_json FROM events WHERE workflow_id=? AND seq>? AND kind IN (${placeholders}) ORDER BY seq ASC LIMIT ?`
      : `SELECT seq, kind, entity_id, created_at, payload_json FROM events WHERE workflow_id=? AND kind IN (${placeholders}) ORDER BY seq DESC LIMIT ?`;
    const rows = db.prepare(sql).all(workflowId, ...(cursor ? [cursor] : []), ...KINDS, take);
    const raw = cursor ? rows : rows.reverse();
    const jobIds = [...new Set(raw.flatMap((row) => {
      const payload = payloadOf(row.payload_json);
      return [row.entity_id?.startsWith('op-') ? row.entity_id : null, payload.jobId].filter(Boolean);
    }))];
    const jobs = new Map();
    const jobById = db.prepare('SELECT job_id, op_id, attempt FROM jobs WHERE job_id=? AND workflow_id=?');
    for (const jobId of jobIds) {
      const job = jobById.get(jobId, workflowId);
      if (job) jobs.set(jobId, job);
    }
    const events = raw.map((row) => {
      const payload = payloadOf(row.payload_json);
      const jobId = row.entity_id?.startsWith('op-') ? row.entity_id : limited(payload.jobId || payload.authorJob);
      const job = jobs.get(jobId);
      const op = limited(job?.op_id || payload.op || payload.opId || payload.authorOp);
      const from = row.kind === 'kernel-transition-woken' && !jobId ? (payload.transition === 'ask-answered' ? 'Owner' : 'Runtime')
        : ['report-filed', 'kernel-transition-woken', 'report-consumed', 'checks-recorded', 'work-graph-version'].includes(row.kind) ? (op || 'Runtime') : 'Kernel';
      const to = row.kind === 'work-graph-version' ? 'Work Graph'
        : ['report-filed', 'kernel-transition-woken', 'report-consumed', 'checks-recorded'].includes(row.kind) ? 'Kernel' : (op || 'op chưa rõ');
      return {
        seq: row.seq, kind: row.kind, at: row.created_at, jobId: limited(jobId), op,
        from, to, attempt: job?.attempt ?? (Number.isInteger(payload.attempt) ? payload.attempt : null),
        outcome: limited(payload.outcome), verdict: limited(payload.verdict),
        transition: limited(payload.transition), delivery: limited(payload.delivery),
        model: limited(payload.modelId || payload.model), version: Number.isInteger(payload.version) ? payload.version : null,
      };
    });
    return { workflowId, projectId: project.id, events, cursor: events.at(-1)?.seq ?? cursor };
  } finally { db.close(); }
}
