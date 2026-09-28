// Files carried by a worker report are staged in the blob store before the
// report transaction. A failed transaction leaves only unreferenced blobs for
// GC; it never leaves a report pointing at missing bytes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { putBlob, blobPath } from '../../lib/artifact-store.mjs';
import { mimeOf, kindOf } from '../job-artifacts.mjs';

const inside = (root, file) => {
  const rel = path.relative(path.resolve(root), path.resolve(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
const refuse = (message, code) => Object.assign(new Error(message), { code });
const slash = (s) => String(s).replace(/\\/g, '/');
const named = (value, fallback) => typeof value === 'string' && value.trim() ? value.trim() : fallback;

export function reportScratch(reportAbs) {
  const raw = process.env.STARCI_JOB_SCRATCH;
  if (!raw) return null;
  const dir = path.resolve(raw);
  // Never let a malformed environment variable turn cleanup into a broad delete.
  if (!inside(os.tmpdir(), dir) || !inside(dir, reportAbs)) return null;
  return dir;
}

// api.mjs's generic parser keeps one value per flag. Read only this verb's
// repeatable --attach flags from its argv without changing the shared parser.
export function attachedArgs(argv = process.argv.slice(2)) {
  const result = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--attach') {
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw refuse('--attach needs a file path', 'report-attachment-invalid');
    result.push(value);
  }
  return result;
}

const resolveFile = (given, { repo, scratch }) => {
  if (typeof given !== 'string' || !given.trim()) throw refuse('report attachment path is empty', 'report-attachment-invalid');
  const candidates = path.isAbsolute(given) ? [path.resolve(given)] : [scratch && path.resolve(scratch, given), path.resolve(repo, given), path.resolve(given)].filter(Boolean);
  const file = candidates.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
  if (!file) throw refuse(`report attachment missing or unreadable: ${given}`, 'report-attachment-missing');
  if (scratch && !inside(fs.realpathSync(scratch), fs.realpathSync(file)))
    throw refuse(`report attachment is outside STARCI_JOB_SCRATCH: ${given}`, 'report-attachment-outside-scratch');
  return file;
};

const roleOf = (file) => {
  const ext = path.extname(file).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].includes(ext)) return 'screenshot';
  if (['.webm', '.mp4', '.mov'].includes(ext)) return 'video';
  if (['.html', '.htm', '.mhtml'].includes(ext)) return 'dom';
  if (['.patch', '.diff'].includes(ext)) return 'patch';
  return 'report-attachment';
};

export async function stageReportEvidence({ report, repo, scratch, attach = [] }) {
  const staged = [];
  const seenNames = new Set();
  const add = async ({ file, name, role, checkIndex = null, field = null }) => {
    const abs = resolveFile(file, { repo, scratch });
    const logical = slash(named(name, path.basename(abs))).replace(/^\/+/, '');
    if (!logical || logical.startsWith('../') || logical.includes('/../') || seenNames.has(logical))
      throw refuse(`duplicate or unsafe report attachment name: ${logical}`, 'report-attachment-invalid');
    seenNames.add(logical);
    const mediaType = mimeOf(abs);
    const blob = await putBlob(abs, { mediaType });
    staged.push({ abs, name: logical, role, kind: kindOf(abs), mediaType, sha: blob.sha, size: blob.size,
      checkIndex, field });
  };
  for (const [index, file] of attach.entries()) await add({ file, name: `attachments/${index}-${path.basename(file)}`, role: roleOf(file) });
  for (const [index, check] of (report.checks ?? []).entries()) {
    for (const [field, role] of [['stdoutPath', 'check-stdout'], ['stderrPath', 'check-stderr'], ['outputPath', 'check-output']]) {
      if (check[field] !== undefined) await add({ file: check[field], name: `checks/${index}-${check.name}/${field.slice(0, -4)}${path.extname(check[field]) || '.txt'}`, role, checkIndex: index, field });
    }
  }
  return staged;
}

export function insertReportEvidence(db, { job, op, report, reportId, staged, now }) {
  const putRegistry = db.prepare(`INSERT INTO blobs(sha256,bytes,media_type,encoding,file_uri,http_path,created_at) VALUES(?,?,?,NULL,?,?,?)
    ON CONFLICT(sha256) DO NOTHING`);
  const putArtifact = db.prepare(`INSERT INTO job_artifacts_v2
    (workflow_id,job_id,op_id,attempt,cut,role,kind,subkind,name,storage,sha256,bytes,media_type,repo_path,label,origin,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,'blob',?,?,?,NULL,?,'op',?)
    ON CONFLICT(workflow_id,job_id,attempt,name) DO UPDATE SET
      role=excluded.role,kind=excluded.kind,sha256=excluded.sha256,bytes=excluded.bytes,media_type=excluded.media_type,label=excluded.label,created_at=excluded.created_at`);
  const artifactId = db.prepare('SELECT artifact_id FROM job_artifacts_v2 WHERE workflow_id=? AND job_id=? AND attempt=? AND name=?');
  const link = db.prepare('INSERT OR IGNORE INTO report_attachments(report_id,artifact_id) VALUES(?,?)');
  const cut = (() => { try { const p = JSON.parse(job.payload_json ?? '{}'); return p.cut ? `${p.cut.id ?? ''}#${p.cut.ordinal ?? ''}/${p.cut.total ?? ''}` : null; } catch { return null; } })();
  for (const item of staged) {
    putRegistry.run(item.sha, item.size, item.mediaType, blobPath(item.sha), `/api/blob/${item.sha}`, now);
    putArtifact.run(job.workflow_id, job.job_id, op, job.attempt, cut, item.role, item.kind, null,
      item.name, item.sha, item.size, item.mediaType, item.name, now);
    link.run(reportId, artifactId.get(job.workflow_id, job.job_id, job.attempt, item.name).artifact_id);
  }
  // A re-file replaces this attempt's declared checks, just as reports has one
  // row per dispatch. The settler's independent checks have a different runner.
  db.prepare("DELETE FROM check_runs WHERE workflow_id=? AND job_id=? AND attempt=? AND runner='op'")
    .run(job.workflow_id, job.job_id, job.attempt);
  const putCheck = db.prepare(`INSERT INTO check_runs
    (workflow_id,job_id,op_id,attempt,name,phase,runner,command,cwd,exit_code,status,started_at,finished_at,stdout_sha,stderr_sha,output_sha,summary_json,created_at)
    VALUES(?,?,?,?,?,?,'op',?,?,?,?,?,?,?,?,?,?,?)`);
  for (const [index, check] of (report.checks ?? []).entries()) {
    const sha = (field) => staged.find((item) => item.checkIndex === index && item.field === field)?.sha ?? null;
    const { stdoutPath: _stdout, stderrPath: _stderr, outputPath: _output, ...summary } = check;
    putCheck.run(job.workflow_id, job.job_id, op, job.attempt, check.name, check.phase ?? null,
      check.command, check.cwd ?? null, check.exitCode, check.exitCode === 0 ? 'pass' : 'fail',
      check.startedAt ?? null, check.finishedAt ?? null, sha('stdoutPath'), sha('stderrPath'), sha('outputPath'),
      JSON.stringify(summary), now);
  }
}

export function markAttemptReported(db, { job, op, dispatchId, report, now }) {
  const update = db.prepare(`UPDATE op_attempts SET dispatch_id=?,reported_at=?,report_outcome=?,
    branch=COALESCE(?,branch),head_sha=COALESCE(?,head_sha),failure_class=COALESCE(?,failure_class)
    WHERE workflow_id=? AND job_id=? AND attempt=?`)
    .run(dispatchId, now, report.outcome, report.branch ?? null, report.head ?? null,
      report.failureClass ?? null, job.workflow_id, job.job_id, job.attempt);
  if (!update.changes) db.prepare(`INSERT INTO op_attempts
    (workflow_id,job_id,op_id,attempt,dispatch_id,reported_at,report_outcome,branch,head_sha,failure_class)
    VALUES(?,?,?,?,?,?,?,?,?,?)`)
    .run(job.workflow_id, job.job_id, op, job.attempt, dispatchId, now, report.outcome,
      report.branch ?? null, report.head ?? null, report.failureClass ?? null);
}

export function removeReportScratch(scratch) {
  if (scratch && inside(os.tmpdir(), scratch)) fs.rmSync(scratch, { recursive: true, force: true });
}
