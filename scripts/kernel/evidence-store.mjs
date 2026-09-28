// evidence-store.mjs — agent output into runtime.sqlite + the blob store (alpha.3, ARCHITECTURE-DB §4.2, §4.9 H7/H8/H10).
//
// Bytes live in the content-addressed store (scripts/lib/artifact-store.mjs, ~/.starci/artifacts/<sha[0:2]>/<sha>);
// the ledger holds only the index rows that point at them:
//   blobs                         one row per sha this ledger references (media type, redaction, file uri)
//   job_artifacts                 every file output, keyed (attempt_id, name) — or (workflow_id, name) for the Kernel's
//                                 own outputs — immutable: a second put with other bytes is refused (H10)
//   check_runs                    every op / settler / parity / integrate check: the RAW exit the runner saw apart from
//                                 the exit the op DECLARED (H8); 'unavailable' is its own status and never red (H7)
//   attempt_transcript_snapshots  the redacted scrollback of a live op terminal, every 60 s
//   op_attempts.transcript_sha    the full redacted scrollback when the attempt ends
// Text bytes pass scripts/lib/redact.mjs before every put (blobs.redaction='v1'); media is stored as is ('binary').
// Every write here runs inside the caller's transaction on the ledger's single writer connection; the blob put
// happens BEFORE the transaction (stageBlob), so a rolled-back transaction leaves only an unreferenced blob for GC.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { putBlob, blobPath } from '../lib/artifact-store.mjs';
import { redactBytes } from '../lib/redact.mjs';

export const ARTIFACT_ROLES = Object.freeze(['check-output', 'check-stdout', 'check-stderr', 'patch', 'diff', 'report-attachment', 'log',
  'direction', 'prompt', 'render', 'redline', 'critique', 'capture', 'dom', 'screenshot', 'video', 'trace', 'uat-run', 'metrics', 'salvage', 'scan', 'other']);
export const ARTIFACT_KINDS = Object.freeze(['diff', 'patch', 'image', 'video', 'report', 'log', 'trace', 'file']);
export const ARTIFACT_SUBKINDS = Object.freeze(['draw-render', 'asset-gen', 'app-capture', 'e2e-capture', 'uat-capture', 'uat-video', 'e2e-video',
  'playwright-trace', 'patch', 'patch-json', 'diff', 'report', 'log', 'critique', 'metrics', 'grammar-proposal', 'asset-request',
  'terminal-transcript', 'cli-transcript']);
export const ARTIFACT_ORIGINS = Object.freeze(['op', 'settler', 'checker', 'kernel']);
export const CHECK_PHASES = Object.freeze(['before', 'after', 'verify', 'parity', 'integrate']);
export const CHECK_RUNNERS = Object.freeze(['op', 'settler', 'kernel', 'parity', 'integrate']);
export const CHECK_STATUSES = Object.freeze(['pass', 'fail', 'unavailable', 'error', 'skipped']);
/** A check whose status counts as red. 'unavailable' (the checker could not run: infra) and 'skipped' never do (H7). */
export const RED_CHECK_STATUSES = Object.freeze(['fail', 'error']);
export const TRANSCRIPT_SNAPSHOT_MS = 60_000;

const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const slash = (p) => String(p).replace(/\\/g, '/');
export const newSpanId = () => crypto.randomBytes(8).toString('hex');

const IMAGE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const VIDEO = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const OTHER = { '.json': 'application/json', '.md': 'text/markdown', '.yaml': 'text/yaml', '.yml': 'text/yaml', '.txt': 'text/plain',
  '.log': 'text/plain', '.jsonl': 'application/x-ndjson', '.out': 'text/plain', '.patch': 'text/x-diff', '.diff': 'text/x-diff', '.html': 'text/html',
  '.htm': 'text/html', '.mhtml': 'multipart/related', '.zip': 'application/zip', '.trace': 'application/octet-stream', '.csv': 'text/csv', '.xml': 'application/xml' };
/** The media type of a file, from its extension. */
export const mediaTypeOf = (file) => { const ext = path.extname(String(file)).toLowerCase(); return IMAGE[ext] ?? VIDEO[ext] ?? OTHER[ext] ?? 'application/octet-stream'; };

/** The job_artifacts.kind of a file, from its name. */
export function kindOf(file) {
  const base = path.basename(String(file)).toLowerCase(), ext = path.extname(base);
  if (ext === '.patch') return 'patch';
  if (ext === '.diff') return 'diff';
  if (IMAGE[ext]) return 'image';
  if (VIDEO[ext]) return 'video';
  if (ext === '.trace' || (ext === '.zip' && base.includes('trace'))) return 'trace';
  if (/^(report|result)([.-].*)?\.(json|md|ya?ml)$/.test(base)) return 'report';
  if (['.log', '.txt', '.out', '.jsonl'].includes(ext)) return 'log';
  return 'file';
}

/** The artifact role of an attached file, from its name. */
export function roleOf(file) {
  const kind = kindOf(file), ext = path.extname(String(file)).toLowerCase();
  if (kind === 'image') return 'screenshot';
  if (kind === 'video') return 'video';
  if (kind === 'trace') return 'trace';
  if (kind === 'patch') return 'patch';
  if (kind === 'diff') return 'diff';
  if (kind === 'log') return 'log';
  if (['.html', '.htm', '.mhtml'].includes(ext)) return 'dom';
  return 'report-attachment';
}

// --------------------------------------------------------------------------------------------- blobs
/**
 * Put bytes (a Buffer, a string, or a file path) in the blob store, redacted first when they are text. Runs OUTSIDE
 * the ledger transaction. Returns {sha, bytes, mediaType, redaction, fileUri} for registerBlob / putArtifact.
 */
export function stageBlob(source, { mediaType = null, file = null, repoRoots = [] } = {}) {
  const raw = Buffer.isBuffer(source) ? source : typeof source === 'string' && file === false ? Buffer.from(source, 'utf8')
    : typeof source === 'string' ? fs.readFileSync(source) : Buffer.from(source);
  const type = mediaType ?? (typeof source === 'string' && file !== false ? mediaTypeOf(source) : 'application/octet-stream');
  const { bytes, redaction } = redactBytes(raw, type, { repoRoots });
  const put = putBlob(bytes, { mediaType: type });
  return { sha: put.sha, bytes: put.size, mediaType: type, redaction, fileUri: slash(blobPath(put.sha)) };
}

/** Text as a staged blob (redacted), or null for empty text. */
export const stageText = (text, { mediaType = 'text/plain', repoRoots = [] } = {}) =>
  (typeof text === 'string' && text.length ? stageBlob(text, { mediaType, file: false, repoRoots }) : null);

/** The blobs row of one staged blob; a sha already known keeps its first row. Returns the sha. */
export function registerBlob(db, staged, { now = Date.now() } = {}) {
  if (!staged?.sha) return null;
  db.prepare(`INSERT INTO blobs(sha256,bytes,media_type,encoding,redaction,file_uri,created_at) VALUES(?,?,?,NULL,?,?,?)
    ON CONFLICT(sha256) DO NOTHING`).run(staged.sha, staged.bytes, staged.mediaType, staged.redaction ?? null, staged.fileUri, now);
  return staged.sha;
}

// ----------------------------------------------------------------------------------------- artifacts
const artifactKey = (db, { workflowId, attemptId, name }) => (attemptId != null
  ? db.prepare('SELECT artifact_id,sha256 FROM job_artifacts WHERE attempt_id=? AND name=?').get(attemptId, name)
  : db.prepare('SELECT artifact_id,sha256 FROM job_artifacts WHERE workflow_id=? AND attempt_id IS NULL AND name=?').get(workflowId, name));

/**
 * One job_artifacts row for a staged blob. `name` is the logical name, unique per attempt (per workflow for a
 * Kernel artifact, attemptId null). Filing the same name with the same bytes again returns the existing row;
 * other bytes under a filed name are refused `artifact-immutable` (H10). Returns {artifactId, created}.
 */
export function putArtifact(db, { workflowId, attemptId = null, jobId = null, opId = null, cut = null, role, kind = null, subkind = null,
  name, blob, label = null, scopeRef = null, round = null, runId = null, origin, baseSha = null, headSha = null, integratedSha = null, now = Date.now() }) {
  if (!ARTIFACT_ROLES.includes(role)) throw refuse(`artifact role must be ${ARTIFACT_ROLES.join('|')}, got '${role}'`, 'artifact-role-unknown');
  if (!ARTIFACT_ORIGINS.includes(origin)) throw refuse(`artifact origin must be ${ARTIFACT_ORIGINS.join('|')}, got '${origin}'`, 'artifact-origin-unknown');
  const logical = slash(name ?? '').replace(/^\/+/, '');
  if (!logical || logical.split('/').includes('..')) throw refuse(`unsafe artifact name: ${name}`, 'artifact-name-invalid');
  const k = kind ?? kindOf(logical);
  if (!ARTIFACT_KINDS.includes(k)) throw refuse(`artifact kind must be ${ARTIFACT_KINDS.join('|')}, got '${k}'`, 'artifact-kind-unknown');
  if (subkind != null && !ARTIFACT_SUBKINDS.includes(subkind)) throw refuse(`artifact subkind must be ${ARTIFACT_SUBKINDS.join('|')}, got '${subkind}'`, 'artifact-subkind-unknown');
  registerBlob(db, blob, { now });
  const prior = artifactKey(db, { workflowId, attemptId, name: logical });
  if (prior) {
    if (prior.sha256 === blob.sha) return { artifactId: prior.artifact_id, created: false };
    throw refuse(`artifact '${logical}' of attempt ${attemptId ?? '(kernel)'} is already filed with other bytes; artifacts are immutable, file a new name`, 'artifact-immutable', { name: logical });
  }
  const r = db.prepare(`INSERT INTO job_artifacts(workflow_id,attempt_id,job_id,op_id,cut,role,kind,subkind,name,sha256,bytes,media_type,label,scope_ref,
      round,run_id,origin,base_sha,head_sha,integrated_sha,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(workflowId, attemptId, jobId, opId, cut, role, k, subkind, logical, blob.sha, blob.bytes, blob.mediaType, label, scopeRef,
      round, runId, origin, baseSha, headSha, integratedSha, now);
  return { artifactId: Number(r.lastInsertRowid), created: true };
}

/** Link report → artifact (report_attachments). */
export const linkReportAttachment = (db, { reportId, artifactId }) =>
  db.prepare('INSERT OR IGNORE INTO report_attachments(report_id,artifact_id) VALUES(?,?)').run(reportId, artifactId);

// ------------------------------------------------------------------------------------------- attempts
/** The op_attempts row of a dispatch (workflow + dispatch id), else of the job's latest dispatch, else null. */
export function attemptOf(db, { workflowId = null, dispatchId = null, jobId = null, attemptId = null } = {}) {
  if (attemptId != null) return db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(attemptId) ?? null;
  if (workflowId && dispatchId) { const row = db.prepare('SELECT * FROM op_attempts WHERE workflow_id=? AND dispatch_id=?').get(workflowId, dispatchId); if (row) return row; }
  if (jobId) return db.prepare('SELECT * FROM op_attempts WHERE job_id=? ORDER BY dispatch_seq DESC LIMIT 1').get(jobId) ?? null;
  return null;
}

// ------------------------------------------------------------------------------------------- checks
/**
 * The status of one check run. `unavailable` (the checker could not run: missing tool, host down, spawn error)
 * is infra, never red (H7); a runner-observed non-zero exit is never 'pass' (H8).
 */
export function checkStatusOf({ exitCode = null, declaredExitCode = null, unavailable = false, error = false, skipped = false, status = null } = {}) {
  if (status && !CHECK_STATUSES.includes(status)) throw refuse(`check status must be ${CHECK_STATUSES.join('|')}, got '${status}'`, 'check-status-unknown');
  if (skipped || status === 'skipped') return 'skipped';
  if (unavailable || status === 'unavailable') return 'unavailable';
  if (error || status === 'error') return 'error';
  // The raw exit wins over the declared one; an explicit 'fail' (a green exit with red findings) stays fail.
  const exit = Number.isInteger(exitCode) ? exitCode : Number.isInteger(declaredExitCode) ? declaredExitCode : null;
  if (exit == null) return status === 'pass' || status === 'fail' ? status : 'error';
  return exit === 0 && status !== 'fail' ? 'pass' : 'fail';
}

/**
 * One check_runs row. `runner` 'op' is always authority 'declared' (the op's own claim: exitCode is stored as
 * declared_exit_code, exit_code stays NULL — the runtime did not observe it); the runtime's own runners store the
 * raw exit they observed in exit_code. stdout/stderr/output are staged blobs (stageBlob/stageText) or null.
 * run_seq numbers re-runs of the same (attempt, runner, phase, name). Returns {checkId, runSeq, status, red}.
 */
export function recordCheckRun(db, { workflowId, attemptId, jobId, opId, name, phase, runner, authority = null, command = null, cwd = null,
  inputDigest = null, exitCode = null, declaredExitCode = null, attribution = null, status = null, unavailable = false, error = false, skipped = false,
  startedAt = null, finishedAt = null, wallMs = null, stdout = null, stderr = null, output = null, summary = null, note = null,
  spanId = newSpanId(), parentSpanId = null, now = Date.now() }) {
  if (!CHECK_RUNNERS.includes(runner)) throw refuse(`check runner must be ${CHECK_RUNNERS.join('|')}, got '${runner}'`, 'check-runner-unknown');
  if (!CHECK_PHASES.includes(phase)) throw refuse(`check phase must be ${CHECK_PHASES.join('|')}, got '${phase}'`, 'check-phase-unknown');
  if (attemptId == null) throw refuse(`check '${name}' has no attempt`, 'check-attempt-missing');
  const auth = runner === 'op' ? 'declared' : authority ?? 'runtime';
  const raw = runner === 'op' ? null : (Number.isInteger(exitCode) ? exitCode : null);
  const declared = runner === 'op' ? (Number.isInteger(exitCode) ? exitCode : Number.isInteger(declaredExitCode) ? declaredExitCode : null)
    : (Number.isInteger(declaredExitCode) ? declaredExitCode : null);
  const st = checkStatusOf({ exitCode: raw, declaredExitCode: declared, unavailable, error, skipped, status });
  for (const b of [stdout, stderr, output]) if (b) registerBlob(db, b, { now });
  const parent = parentSpanId ?? db.prepare('SELECT span_id FROM op_attempts WHERE attempt_id=?').get(attemptId)?.span_id ?? null;
  const runSeq = (db.prepare('SELECT max(run_seq) AS n FROM check_runs WHERE attempt_id=? AND runner=? AND phase=? AND name=?').get(attemptId, runner, phase, name)?.n ?? 0) + 1;
  const wall = wallMs ?? (Number.isFinite(startedAt) && Number.isFinite(finishedAt) ? finishedAt - startedAt : null);
  const r = db.prepare(`INSERT INTO check_runs(workflow_id,attempt_id,job_id,op_id,span_id,parent_span_id,name,phase,runner,run_seq,command,cwd,input_digest,
      authority,exit_code,declared_exit_code,attribution_json,status,started_at,finished_at,wall_ms,stdout_sha,stderr_sha,output_sha,summary_json,note,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(workflowId, attemptId, jobId, opId, spanId, parent, name, phase, runner, runSeq, command, cwd, inputDigest, auth, raw, declared,
      attribution == null ? null : JSON.stringify(attribution), st, startedAt, finishedAt, wall, stdout?.sha ?? null, stderr?.sha ?? null, output?.sha ?? null,
      summary == null ? null : JSON.stringify(summary), note, now);
  return { checkId: Number(r.lastInsertRowid), runSeq, status: st, red: RED_CHECK_STATUSES.includes(st) };
}

/** The latest run of every check of an attempt (optionally one runner): [row] ordered by check_id. */
export const latestCheckRuns = (db, attemptId, { runner = null } = {}) => db.prepare(`SELECT c.* FROM check_runs c
  WHERE c.attempt_id=? ${runner ? 'AND c.runner=?' : ''} AND c.run_seq=(SELECT max(run_seq) FROM check_runs x
    WHERE x.attempt_id=c.attempt_id AND x.runner=c.runner AND x.phase=c.phase AND x.name=c.name) ORDER BY c.check_id`)
  .all(attemptId, ...(runner ? [runner] : []));

// ---------------------------------------------------------------------------------------- transcripts
const linesOf = (text) => (text ? text.split('\n').length : 0);

/** A periodic scrollback snapshot of a live attempt; an unchanged scrollback adds no row. Returns {snapshotId|null, sha}. */
export function recordAttemptSnapshot(db, { workflowId, attemptId, text, blob = null, at = Date.now() }) {
  const staged = blob ?? stageText(text);
  if (!staged) return { snapshotId: null, sha: null };
  registerBlob(db, staged, { now: at });
  const r = db.prepare(`INSERT INTO attempt_transcript_snapshots(workflow_id,attempt_id,at,lines,bytes,sha256) VALUES(?,?,?,?,?,?)
    ON CONFLICT(attempt_id,sha256) DO NOTHING`).run(workflowId, attemptId, at, linesOf(text ?? ''), staged.bytes, staged.sha);
  return { snapshotId: r.changes ? Number(r.lastInsertRowid) : null, sha: staged.sha };
}

/** The attempt's full redacted scrollback at its end: op_attempts.transcript_sha. Returns the sha or null. */
export function recordFinalTranscript(db, { attemptId, text = null, blob = null, at = Date.now() }) {
  const staged = blob ?? stageText(text);
  if (!staged || attemptId == null) return null;
  registerBlob(db, staged, { now: at });
  db.prepare('UPDATE op_attempts SET transcript_sha=? WHERE attempt_id=?').run(staged.sha, attemptId);
  return staged.sha;
}
