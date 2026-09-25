// report-owner.mjs - who owns a filed report path (nivo Collab inc-b915b61d8f9e).
//
// A report path belongs to the op lineage that first filed it (report-filed
// events, every workflow of the ledger): a later attempt of the same op
// supersedes it in place, as before. A job of another op never takes it over:
// api report files that job's report at a job-scoped sibling,
// <stem>.<jobId><ext> (report.<jobId>.json), and puts the owner's latest filed
// report back at the path, so the node's report stays the owning verdict.
// Example: work.author committed an interface.audit node's evidence after the
// audit was blocked by a hook, filed its done report at the node's
// report.json, and a reader of the node saw done instead of the audit's
// blocked verdict.
import fs from 'node:fs';
import path from 'node:path';

export const reportPathKey = (p) => {
  const n = path.resolve(p).replace(/\\/g, '/');
  return process.platform === 'win32' ? n.toLowerCase() : n;
};

export const jobScopedReportPath = (reportAbs, jobId) => {
  const ext = path.extname(reportAbs);
  return path.join(path.dirname(reportAbs), `${path.basename(reportAbs, ext)}.${jobId}${ext || '.json'}`);
};

const parse = (s) => { try { return JSON.parse(s); } catch { return null; } };

const filingsOf = (db) => db
  .prepare("SELECT workflow_id, entity_id, payload_json FROM events WHERE kind='report-filed' ORDER BY seq")
  .all()
  .map((row) => {
    const p = parse(row.payload_json);
    if (!p || typeof p.report !== 'string' || !p.report) return null;
    return { workflowId: row.workflow_id, jobId: row.entity_id, op: p.op ?? null, dispatchId: p.dispatchId ?? null,
      report: p.report, key: reportPathKey(p.report) };
  })
  .filter(Boolean);

// The owner of a report path: the latest filing of the op lineage that filed it
// first ({workflowId, jobId, op, dispatchId, report}), or null when unfiled.
export function reportPathOwner(db, reportAbs) {
  const key = reportPathKey(reportAbs);
  const at = filingsOf(db).filter((f) => f.key === key);
  if (!at.length) return null;
  const op = at[0].op;
  return at.filter((f) => f.op === op).at(-1);
}

// The owner when it is another op than `op`; null when the path is free or
// the job's own op lineage owns it.
export function foreignReportOwner(db, reportAbs, op) {
  const owner = reportPathOwner(db, reportAbs);
  return owner && owner.op !== op ? owner : null;
}

// The path the job last filed its own report at, or null.
export function ownFiledReportOf(db, jobId) {
  const row = db.prepare("SELECT payload_json FROM events WHERE kind='report-filed' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(jobId);
  const p = parse(row?.payload_json);
  return typeof p?.report === 'string' && p.report ? p.report : null;
}

// Report paths under `roots` (absolute) that another op than `op` owns: the
// packet names them so the worker writes its own job-scoped report instead.
export function reservedReportPaths(db, { op, roots }) {
  const rootKeys = roots.map(reportPathKey);
  const first = new Map();
  for (const f of filingsOf(db)) if (!first.has(f.key)) first.set(f.key, f);
  return [...first.values()]
    .filter((f) => f.op !== op && rootKeys.some((r) => f.key === r || f.key.startsWith(`${r}/`)))
    .map((f) => ({ path: f.report, op: f.op }));
}

// api report for a path another op owns: the incoming bytes go to the job's
// scoped path, and the owner's filed report (its reports row) is written back
// at the path. Returns what the report-filed event records.
export function relocateForeignReport(db, { reportAbs, raw, jobId, owner }) {
  const own = jobScopedReportPath(reportAbs, jobId);
  fs.writeFileSync(own, raw);
  const row = db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=?').get(owner.workflowId, owner.dispatchId);
  const kept = row ? parse(row.report_json) : null;
  if (kept) fs.writeFileSync(reportAbs, `${JSON.stringify(kept, null, 2)}\n`, 'utf8');
  return { report: own, relocatedFrom: reportAbs, owner: { jobId: owner.jobId, op: owner.op, dispatchId: owner.dispatchId }, restored: Boolean(kept) };
}
