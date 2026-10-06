// evidence-store.mjs — agent output into runtime.sqlite + the blob store (alpha.3, ARCHITECTURE-DB §4.2, §4.9 H7/H8/H10).
//
// Bytes live in the content-addressed store (engine/db/blob.mjs, <runtime root>/.runtime/artifacts/<sha[0:2]>/<sha>);
// the ledger holds only the index rows that point at them:
//   blobs                         one row per sha this ledger references (media type, redaction, file uri)
//   job_artifacts                 every file output, keyed (attempt_id, name) — or (workflow_id, name) for the Kernel's
//                                 own outputs — immutable: a second put with other bytes is refused (H10)
//   check_runs                    every op / settler / parity / integrate check: the RAW exit the runner saw apart from
//                                 the exit the op DECLARED (H8); 'unavailable' is its own status and never red (H7)
//   attempt_transcript_snapshots  the redacted scrollback of a live op terminal, every 60 s
//   op_attempts.transcript_sha    the full redacted scrollback when the attempt ends
// Text bytes pass scripts/lib/redact.mjs before every put (blobs.redaction='v1'); media is stored as is ('binary').
// The rows go through the runtime writer (engine/db/ledger.mjs recordBlob, recordArtifact, recordCheckRun,
// recordTranscriptSnapshot, setAttemptTranscript); this module is the evidence policy on top of it: redaction,
// naming, kinds and roles, the H7/H8 status rules. Every write runs inside the caller's ledger.transaction; the blob
// put happens BEFORE the transaction (stageBlob), so a rolled-back transaction leaves only an unreferenced blob for GC.
import fs from 'node:fs';
import path from 'node:path';
import { putBlob, blobPath } from '../../engine/db/blob.mjs';
import { redactBytes } from '../lib/redact.mjs';
import { recordBlob, recordArtifact, recordCheckRun as writeCheckRun, recordTranscriptSnapshot, attachToReport, setAttemptTranscript,
  JOB_ARTIFACT_KINDS, JOB_ARTIFACT_SUBKINDS, JOB_ARTIFACT_ROLES } from '../../engine/db/ledger.mjs';
import { newSpanId } from '../../engine/db/machine.mjs';
import { refuse } from '../../engine/refuse.mjs';

const ARTIFACT_ROLES = JOB_ARTIFACT_ROLES;
export const ARTIFACT_KINDS = JOB_ARTIFACT_KINDS;
export const ARTIFACT_SUBKINDS = JOB_ARTIFACT_SUBKINDS;
const ARTIFACT_ORIGINS = Object.freeze(['op', 'settler', 'checker', 'kernel']);
const CHECK_PHASES = Object.freeze(['before', 'after', 'verify', 'parity', 'integrate']);
const CHECK_RUNNERS = Object.freeze(['op', 'settler', 'kernel', 'parity', 'integrate']);
export const CHECK_STATUSES = Object.freeze(['pass', 'fail', 'unavailable', 'error', 'skipped']);
/** A check whose status counts as red. 'unavailable' (the checker could not run: infra) and 'skipped' never do (H7). */
const RED_CHECK_STATUSES = Object.freeze(['fail', 'error']);
export const TRANSCRIPT_SNAPSHOT_MS = 60_000;


const slash = (p) => String(p).replace(/\\/g, '/');

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
  recordBlob(db, { sha256: staged.sha, bytes: staged.bytes, mediaType: staged.mediaType, fileUri: staged.fileUri, redaction: staged.redaction ?? null, createdAt: now });
  return staged.sha;
}

// ----------------------------------------------------------------------------------------- artifacts
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
  const before = attemptId != null ? db.prepare('SELECT artifact_id FROM job_artifacts WHERE attempt_id=? AND name=?').get(attemptId, logical)
    : db.prepare('SELECT artifact_id FROM job_artifacts WHERE workflow_id=? AND attempt_id IS NULL AND name=?').get(workflowId, logical);
  let row;
  try {
    row = recordArtifact(db, { workflowId, attemptId, name: logical, sha256: blob.sha, role, kind: k, origin, subkind, label, scopeRef, round, runId, cut,
      baseSha, headSha, integratedSha, createdAt: now, ...(attemptId == null ? { jobId, opId } : {}) });
  } catch (error) {
    if (error?.code === 'STARCI_ARTIFACT_IMMUTABLE') throw refuse(`artifact '${logical}' of attempt ${attemptId ?? '(kernel)'} is already filed with other bytes; artifacts are immutable, file a new name`, 'artifact-immutable', { name: logical });
    throw error;
  }
  return { artifactId: row.artifact_id, created: !before };
}

/** Link report → artifact (report_attachments). */
export const linkReportAttachment = (db, { reportId, artifactId }) => attachToReport(db, { reportId, artifactId });

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
function checkStatusOf({ exitCode = null, declaredExitCode = null, unavailable = false, error = false, skipped = false, status = null } = {}) {
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
 * One check_runs row (engine/db/ledger.mjs recordCheckRun). `runner` 'op' is always authority 'declared' (the op's own claim: exitCode is stored as
 * declared_exit_code, exit_code stays NULL — the runtime did not observe it); the runtime's own runners store the
 * raw exit they observed in exit_code. stdout/stderr/output are staged blobs (stageBlob/stageText) or null.
 * run_seq numbers re-runs of the same (attempt, runner, phase, name). Returns {checkId, runSeq, status, red}.
 */
export function recordCheck(db, { attemptId, name, phase, runner, authority = null, command = null, cwd = null,
  inputDigest = null, exitCode = null, declaredExitCode = null, attribution = null, status = null, unavailable = false, error = false, skipped = false,
  startedAt = null, finishedAt = null, wallMs = null, stdout = null, stderr = null, output = null, summary = null, note = null,
  spanId = newSpanId(), now = Date.now() }) {
  if (!CHECK_RUNNERS.includes(runner)) throw refuse(`check runner must be ${CHECK_RUNNERS.join('|')}, got '${runner}'`, 'check-runner-unknown');
  if (!CHECK_PHASES.includes(phase)) throw refuse(`check phase must be ${CHECK_PHASES.join('|')}, got '${phase}'`, 'check-phase-unknown');
  if (attemptId == null) throw refuse(`check '${name}' has no attempt`, 'check-attempt-missing');
  const auth = runner === 'op' ? 'declared' : authority ?? 'runtime';
  const raw = runner === 'op' ? null : (Number.isInteger(exitCode) ? exitCode : null);
  const declared = runner === 'op' ? (Number.isInteger(exitCode) ? exitCode : Number.isInteger(declaredExitCode) ? declaredExitCode : null)
    : (Number.isInteger(declaredExitCode) ? declaredExitCode : null);
  const st = checkStatusOf({ exitCode: raw, declaredExitCode: declared, unavailable, error, skipped, status });
  for (const b of [stdout, stderr, output]) if (b) registerBlob(db, b, { now });
  const wall = wallMs ?? (Number.isFinite(startedAt) && Number.isFinite(finishedAt) ? finishedAt - startedAt : null);
  const row = writeCheckRun(db, { attemptId, name, phase, runner, authority: auth, status: st, spanId, createdAt: now, command, cwd, inputDigest,
    exitCode: raw, declaredExitCode: declared, attributionJson: attribution == null ? null : JSON.stringify(attribution), startedAt, finishedAt, wallMs: wall,
    stdoutSha: stdout?.sha ?? null, stderrSha: stderr?.sha ?? null, outputSha: output?.sha ?? null,
    summaryJson: summary == null ? null : JSON.stringify(summary), note });
  return { checkId: row.check_id, runSeq: row.run_seq, status: st, red: RED_CHECK_STATUSES.includes(st) };
}

/** The latest run of every check of an attempt (optionally one runner): [row] ordered by check_id. */
export const latestCheckRuns = (db, attemptId, { runner = null } = {}) => db.prepare(`SELECT c.* FROM check_runs c
  WHERE c.attempt_id=? ${runner ? 'AND c.runner=?' : ''} AND c.run_seq=(SELECT max(run_seq) FROM check_runs x
    WHERE x.attempt_id=c.attempt_id AND x.runner=c.runner AND x.phase=c.phase AND x.name=c.name) ORDER BY c.check_id`)
  .all(attemptId, ...(runner ? [runner] : []));

// ---------------------------------------------------------------------------------------- transcripts
const linesOf = (text) => (text ? text.split('\n').length : 0);

/** A periodic scrollback snapshot of a live attempt; an unchanged scrollback adds no row. Returns {written, sha}. */
export function recordAttemptSnapshot(db, { attemptId, text, blob = null, at = Date.now() }) {
  const staged = blob ?? stageText(text);
  if (!staged) return { written: false, sha: null };
  registerBlob(db, staged, { now: at });
  const written = recordTranscriptSnapshot(db, { attemptId, sha256: staged.sha, lines: linesOf(text ?? ''), bytes: staged.bytes, at });
  return { written, sha: staged.sha };
}

/** The attempt's full redacted scrollback at its end: op_attempts.transcript_sha. Returns the sha or null. */
export function recordFinalTranscript(db, { attemptId, text = null, blob = null, at = Date.now() }) {
  const staged = blob ?? stageText(text);
  if (!staged || attemptId == null) return null;
  registerBlob(db, staged, { now: at });
  setAttemptTranscript(db, { attemptId, transcriptSha: staged.sha, at });
  return staged.sha;
}
