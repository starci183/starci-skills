// report-evidence.mjs — what `api report` carries besides the envelope (alpha.3, ARCHITECTURE-DB §2.3 row 7, H10).
//
// A worker writes its report and every raw output under STARCI_JOB_SCRATCH (op_attempts.scratch_dir), a job-private
// OS-temp directory outside every repository. api report reads the envelope ONCE, stores it only in `reports`, puts
// each --attach file and each check's stdoutPath/stderrPath/outputPath in the blob store (redacted when text), indexes
// them as job_artifacts keyed (attempt_id, name) + report_attachments + check_runs(runner='op'), and then deletes the
// scratch. Nothing reads a report back from a file after that: the reports row is the only copy.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageBlob, putArtifact, linkReportAttachment, recordCheck, roleOf, kindOf } from '../evidence-store.mjs';
import { subkindOf } from '../artifact-subkind.mjs';

const refuse = (message, code, extra = {}) => Object.assign(new Error(message), { code, ...extra });
const slash = (s) => String(s).replace(/\\/g, '/');
const keyOf = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
const inside = (root, file) => {
  const rel = path.relative(keyOf(root), keyOf(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
export const CHECK_FILE_FIELDS = Object.freeze([['stdoutPath', 'check-stdout', 'stdout'], ['stderrPath', 'check-stderr', 'stderr'], ['outputPath', 'check-output', 'output']]);

/**
 * The attempt's scratch directory: op_attempts.scratch_dir, else STARCI_JOB_SCRATCH. It must be an existing directory
 * under the OS temp directory, never the temp directory itself, so the delete after filing can never widen.
 */
export function scratchOf(attempt, env = process.env) {
  const raw = attempt?.scratch_dir || env.STARCI_JOB_SCRATCH || null;
  if (!raw) throw refuse('this attempt has no scratch directory (op_attempts.scratch_dir / STARCI_JOB_SCRATCH); write the report under STARCI_JOB_SCRATCH', 'report-scratch-unbound');
  const dir = real(raw);
  if (!inside(real(os.tmpdir()), dir)) throw refuse(`scratch ${slash(dir)} is not under the OS temp directory`, 'report-scratch-invalid');
  let st = null;
  try { st = fs.statSync(dir); } catch { st = null; }
  if (!st?.isDirectory()) throw refuse(`scratch ${slash(dir)} does not exist`, 'report-scratch-missing');
  return dir;
}

/** `file` resolved against the scratch, refused unless it is a readable file inside it. */
export function scratchFile(given, scratch, what = 'report attachment') {
  if (typeof given !== 'string' || !given.trim()) throw refuse(`${what} path is empty`, 'report-attachment-invalid');
  const abs = path.isAbsolute(given) ? path.resolve(given) : path.resolve(scratch, given);
  let st = null;
  try { st = fs.statSync(abs); } catch { st = null; }
  if (!st?.isFile()) throw refuse(`${what} missing or unreadable: ${given}`, 'report-attachment-missing');
  if (!inside(scratch, real(abs))) throw refuse(`${what} is outside STARCI_JOB_SCRATCH (${slash(scratch)}): ${given}`, 'report-attachment-outside-scratch');
  return abs;
}

/** The repeatable --attach values of this verb's argv (the shared parser keeps one value per flag). */
export function attachedArgs(argv = process.argv.slice(2)) {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--attach') {
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw refuse('--attach needs a file path', 'report-attachment-invalid');
    out.push(value);
  }
  return out;
}

/**
 * Put every file the report carries in the blob store, BEFORE the report transaction: the --attach files as
 * attachments/<name>, each check's stdout/stderr/output as checks/<i>-<check>/<stream><ext>. Returns
 * [{name, role, kind, subkind, blob, checkIndex, stream}].
 */
export function stageReportEvidence({ report, scratch, attach = [], opId = null, repoRoots = [] }) {
  const staged = [], names = new Set();
  const add = ({ abs, name, role, checkIndex = null, stream = null }) => {
    let logical = slash(name).replace(/^\/+/, '');
    for (let n = 2; names.has(logical); n++) logical = slash(name).replace(/(\.[^./]*)?$/, (ext) => `-${n}${ext ?? ''}`);
    names.add(logical);
    const kind = kindOf(abs);
    staged.push({ name: logical, role, kind, subkind: subkindOf({ kind, path: slash(abs), opId }), blob: stageBlob(abs, { repoRoots }), checkIndex, stream });
  };
  for (const given of attach) {
    const abs = scratchFile(given, scratch);
    add({ abs, name: `attachments/${path.basename(abs)}`, role: roleOf(abs) });
  }
  (report.checks ?? []).forEach((check, index) => {
    for (const [field, role, stream] of CHECK_FILE_FIELDS) {
      if (check[field] === undefined) continue;
      const abs = scratchFile(check[field], scratch, `checks[${index}].${field}`);
      const slug = String(check.name).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'check';
      add({ abs, name: `checks/${index}-${slug}/${stream}${path.extname(abs) || '.txt'}`, role, checkIndex: index, stream });
    }
  });
  return staged;
}

/** The envelope as stored: check file paths (scratch paths that are gone after filing) replaced by artifact names. */
export function storedReportOf(report, staged) {
  if (!Array.isArray(report.checks)) return report;
  const checks = report.checks.map((check, index) => {
    const { stdoutPath: _o, stderrPath: _e, outputPath: _p, ...rest } = check;
    const files = Object.fromEntries(staged.filter((s) => s.checkIndex === index).map((s) => [s.stream, s.name]));
    return Object.keys(files).length ? { ...rest, artifacts: files } : rest;
  });
  return { ...report, checks };
}

/**
 * Inside the report transaction: the artifacts (+ report_attachments) and one check_runs row per declared check
 * (runner 'op', authority 'declared': the op's own exit code is declared_exit_code, never the runtime's exit_code).
 * Returns {artifacts:[{artifactId, name, sha256, role}], checks:[{checkId, name, status}]}.
 */
export function fileReportEvidence(db, { attempt, reportId, report, staged, now = Date.now() }) {
  const artifacts = [];
  for (const item of staged) {
    const { artifactId } = putArtifact(db, { workflowId: attempt.workflow_id, attemptId: attempt.attempt_id, role: item.role, kind: item.kind,
      subkind: item.subkind ?? null, name: item.name, blob: item.blob, origin: 'op', headSha: report.head ?? null, now });
    linkReportAttachment(db, { reportId, artifactId });
    artifacts.push({ artifactId, name: item.name, sha256: item.blob.sha, role: item.role });
  }
  const checks = (report.checks ?? []).map((check, index) => {
    const blobOf = (stream) => staged.find((s) => s.checkIndex === index && s.stream === stream)?.blob ?? null;
    const { name, command, exitCode, phase, cwd, startedAt, finishedAt, unavailable, stdoutPath: _o, stderrPath: _e, outputPath: _p, ...summary } = check;
    const r = recordCheck(db, { attemptId: attempt.attempt_id, name, phase: phase ?? 'after', runner: 'op', command, cwd: cwd ?? null,
      exitCode, unavailable: unavailable === true, startedAt: startedAt ?? null, finishedAt: finishedAt ?? null,
      stdout: blobOf('stdout'), stderr: blobOf('stderr'), output: blobOf('output'), summary: Object.keys(summary).length ? summary : null, now });
    return { checkId: r.checkId, name, status: r.status };
  });
  return { artifacts, checks };
}

/** Delete the scratch once the report is durable. Only a directory strictly inside the OS temp directory. */
export function removeScratch(scratch) {
  if (!scratch || !inside(real(os.tmpdir()), scratch)) return false;
  try { fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 3 }); return true; } catch { return false; }
}
