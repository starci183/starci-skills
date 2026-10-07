// report-evidence.mjs — what `starci kernel report` carries besides the envelope (docs/ledger-db.md).
//
// A worker writes its report and every raw output under its job scratch (op_attempts.scratch_dir), a job-private
// OS-temp directory outside every repository. starci kernel report reads the envelope ONCE, stores it only in `reports`, puts
// each --attach file and each check's stdoutPath/stderrPath/outputPath in the blob store (redacted when text), indexes
// them as job_artifacts keyed (attempt_id, name) + report_attachments + check_runs(runner='op'), and then deletes the
// scratch. Nothing reads a report back from a file after that: the reports row is the only copy.
import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { paramValueError } from '../../../lib/op-shared.mjs';
import { stageBlob, putArtifact, linkReportAttachment, recordCheck, roleOf, kindOf, mediaTypeOf } from '../../../machine/evidence-store.mjs';
import { isTextMedia } from '../../../lib/redact.mjs';
import { subkindOf } from '../../artifact-subkind.mjs';
import { safeRemove } from '../../../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../../../machine/artifact-hold.mjs';
import { refuse } from '../../../../engine/refuse.mjs';
import { resolvedKey } from '../../../lib/path-key.mjs';
import { tempRoot } from '../../../../engine/temp-root.mjs';


const slash = (s) => String(s).replaceAll('\\', '/');

const inside = (root, file) => {
  const rel = path.relative(resolvedKey(root), resolvedKey(file));
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};
const real = (p) => { try { return fs.realpathSync.native(p); } catch { return path.resolve(p); } };
const CHECK_FILE_FIELDS = Object.freeze([['stdoutPath', 'check-stdout', 'stdout'], ['stderrPath', 'check-stderr', 'stderr'], ['outputPath', 'check-output', 'output']]);

/**
 * The attempt's scratch directory: op_attempts.scratch_dir. It must be an existing directory
 * under the temp root (engine/temp-root.mjs), never the temp root itself, so the delete after filing can never widen.
 */
export function scratchOf(attempt) {
  const raw = attempt?.scratch_dir || null;
  if (!raw) throw refuse('this attempt has no scratch directory (op_attempts.scratch_dir); write the report under the job scratch your contract names', 'report-scratch-unbound');
  const dir = real(raw);
  if (!inside(real(tempRoot()), dir)) throw refuse(`scratch ${slash(dir)} is not under the temp root ${slash(real(tempRoot()))}`, 'report-scratch-invalid');
  let st = null;
  try { st = fs.statSync(dir); } catch { st = null; }
  if (!st?.isDirectory()) throw refuse(`scratch ${slash(dir)} does not exist`, 'report-scratch-missing');
  return dir;
}

/** `file` resolved against the scratch, refused unless it is a readable file (or, with `dirs`, a directory) inside it. */
export function scratchFile(given, scratch, what = 'report attachment', { dirs = false } = {}) {
  if (typeof given !== 'string' || !given.trim()) throw refuse(`${what} path is empty`, 'report-attachment-invalid');
  const abs = path.isAbsolute(given) ? path.resolve(given) : path.resolve(scratch, given);
  let st = null;
  try { st = fs.statSync(abs); } catch { st = null; }
  if (!st?.isFile() && !(dirs && st?.isDirectory())) throw refuse(`${what} missing or unreadable: ${given}`, 'report-attachment-missing');
  if (!inside(scratch, real(abs))) throw refuse(`${what} is outside the job scratch (${slash(scratch)}): ${given}`, 'report-attachment-outside-scratch');
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

const ATTACH_MAX_FILES = 2000;
const REPORT_MAX_BYTES = 4 * 1024 * 1024;
const ATTACH_MAX_BYTES = 512 * 1024 * 1024;
const ATTACH_FILE_MAX_BYTES = 256 * 1024 * 1024;
const ATTACH_TEXT_MAX_BYTES = 16 * 1024 * 1024;

/** Read a finite regular-file snapshot and refuse growth while it is being staged. */
function readEvidenceFile(file, limit, code) {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink()) throw refuse('evidence input must be a regular file', code);
  if (before.size > limit) throw refuse('evidence input exceeds its byte limit; scratch is retained', code);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.dev !== before.dev || stat.ino !== before.ino || stat.size > limit)
      throw refuse('evidence input changed or exceeds its byte limit; scratch is retained', code);
    const bytes = Buffer.alloc(stat.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const n = fs.readSync(fd, bytes, count, bytes.length - count, null);
      if (!n) break;
      count += n;
    }
    const after = fs.fstatSync(fd);
    if (count > stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs)
      throw refuse('evidence input changed during staging; scratch is retained', code);
    return bytes.subarray(0, count);
  } finally { fs.closeSync(fd); }
}

/** Refuse an oversized report before reading its payload into memory. */
export function readReportEnvelope(file) {
  return readEvidenceFile(file, REPORT_MAX_BYTES, 'report-invalid').toString('utf8');
}
/** Scratch folders starci kernel report attaches by itself when present. */
const AUTO_ATTACH = Object.freeze(['draw-loop', 'captures']);
/** Every file under a directory (bounded), sorted. */
function filesUnder(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { throw refuse(`report attachment directory is unreadable: ${slash(dir)}`, 'report-attachment-missing'); }
  for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) filesUnder(full, out);
    else if (e.isFile()) {
      if (out.length >= ATTACH_MAX_FILES) throw refuse('report attachment inventory exceeds its file limit; scratch is retained', 'report-attachment-invalid');
      out.push(full);
    } else throw refuse(`report attachment is not a regular file or directory: ${slash(full)}`, 'report-attachment-invalid');
  }
  return out;
}
/**
 * What an attached file is, from where it sits in the scratch (the op's layout is the contract, op-prompt.mjs):
 * runs/<runId>/** is a UAT run (role uat-run, run_id), captures/** an app capture (capture | dom), round-<n>/ a draw
 * or audit round (round n), interface-audit.json the audit verdict; anything else by its file kind (roleOf).
 */
function attachmentFacts(rel) {
  const parts = slash(rel).split('/');
  const run = parts.indexOf('runs');
  const runId = run >= 0 && parts.length > run + 2 ? parts[run + 1] : null;
  const roundSeg = parts.find((p) => /^round-\d+$/.test(p));
  const round = roundSeg ? Number(roundSeg.slice(6)) : null;
  let role = roleOf(rel);
  if (runId) role = 'uat-run';
  else if (parts.includes('captures')) role = /\.(html?|mhtml)$/i.test(rel) ? 'dom' : 'capture';
  return { role, runId, round };
}

/**
 * Put every file the report carries in the blob store, BEFORE the report transaction: each --attach file (or every
 * file of an --attach directory) as attachments/<its path in the scratch>, each check's stdout/stderr/output as
 * checks/<i>-<check>/<stream><ext>. Returns [{name, role, kind, subkind, blob, runId, round, checkIndex, stream}].
 */
export function stageReportEvidence({ report, scratch, attach = [], opId = null, repoRoots = [] }) {
  const staged = [], names = new Set(), inventory = [];
  let totalBytes = 0;
  const add = ({ abs, name, role, runId = null, round = null, checkIndex = null, stream = null }) => {
    let logical = slash(name).replace(/^\/+/, '');
    if (names.has(logical)) return;
    names.add(logical);
    const size = fs.statSync(abs).size;
    const mediaType = mediaTypeOf(abs), limit = isTextMedia(mediaType) ? ATTACH_TEXT_MAX_BYTES : ATTACH_FILE_MAX_BYTES;
    totalBytes += size;
    if (names.size > ATTACH_MAX_FILES || size > limit || totalBytes > ATTACH_MAX_BYTES)
      throw refuse('report attachments exceed their file or byte limit; scratch is retained', 'report-attachment-invalid');
    const kind = kindOf(abs);
    inventory.push({ abs, mediaType, limit, name: logical, role, kind, subkind: subkindOf({ kind, path: slash(logical), opId }), runId, round, checkIndex, stream });
  };
  // The runtime's own agent-data folders in the scratch ride along even when the op did not name them: a draw loop's
  // rounds and bundle (draw-loop.mjs) and its captures must be ledger artifacts, or the blob GC could sweep them.
  const auto = AUTO_ATTACH.map((d) => path.join(scratch, d)).filter((d) => fs.existsSync(d));
  for (const given of [...attach, ...auto]) {
    const target = scratchFile(given, scratch, 'report attachment', { dirs: true });
    for (const abs of fs.statSync(target).isDirectory() ? filesUnder(target) : [target]) {
      const rel = slash(path.relative(scratch, abs));
      add({ abs, name: `attachments/${rel}`, ...attachmentFacts(rel) });
    }
  }
  (report.checks ?? []).forEach((check, index) => {
    for (const [field, role, stream] of CHECK_FILE_FIELDS) {
      if (check[field] === undefined) continue;
      const abs = scratchFile(check[field], scratch, `checks[${index}].${field}`);
      const slug = String(check.name).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 60) || 'check';
      add({ abs, name: `checks/${index}-${slug}/${stream}${path.extname(abs) || '.txt'}`, role, checkIndex: index, stream });
    }
  });
  let stagedBytes = 0;
  for (const { abs, mediaType, limit, ...item } of inventory) {
    const bytes = readEvidenceFile(abs, limit, 'report-attachment-invalid');
    stagedBytes += bytes.length;
    if (stagedBytes > ATTACH_MAX_BYTES) throw refuse('report attachments exceed their aggregate byte limit; scratch is retained', 'report-attachment-invalid');
    staged.push({ ...item, blob: stageBlob(bytes, { mediaType, repoRoots }) });
  }
  return staged;
}

/** The envelope as stored: check file paths (scratch paths that are gone after filing) replaced by artifact names. */
export function storedReportOf(report, staged) {
  if (!Array.isArray(report.checks)) return report;
  const checks = report.checks.map((check, index) => {
    const rest = Object.fromEntries(Object.entries(check).filter(([key]) => !CHECK_FILE_FIELDS.some(([field]) => field === key)));
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
      subkind: item.subkind ?? null, name: item.name, blob: item.blob, origin: 'op', headSha: report.head ?? null, runId: item.runId ?? null, round: item.round ?? null, now });
    linkReportAttachment(db, { reportId, artifactId });
    artifacts.push({ artifactId, name: item.name, sha256: item.blob.sha, role: item.role });
  }
  const checks = (report.checks ?? []).map((check, index) => {
    const blobOf = (stream) => staged.find((s) => s.checkIndex === index && s.stream === stream)?.blob ?? null;
    const { name, command, exitCode, phase, cwd, startedAt, finishedAt, unavailable, ...summary } = Object.fromEntries(Object.entries(check).filter(([key]) => !CHECK_FILE_FIELDS.some(([field]) => field === key)));
    const r = recordCheck(db, { attemptId: attempt.attempt_id, name, phase: phase ?? 'after', runner: 'op', command, cwd: cwd ?? null,
      exitCode, unavailable: unavailable === true, startedAt: startedAt ?? null, finishedAt: finishedAt ?? null,
      stdout: blobOf('stdout'), stderr: blobOf('stderr'), output: blobOf('output'), summary: Object.keys(summary).length ? summary : null, now });
    return { checkId: r.checkId, name, status: r.status };
  });
  const audit = interfaceAuditOf(db, { attempt, staged, report, now });
  return { artifacts, checks, ...(audit ? { audit } : {}) };
}

const INTERFACE_AUDIT_FILE = 'interface-audit.json';
const INTERFACE_AUDIT_SCHEMA = 'starci/interface-audit-operation@1';
// Keep capture/proof annotations in the report, while comparing every declared
// scope field using the admitted shape rather than today's Source manifest.
function auditMatrixScope(value, shape) {
  if (shape?.type === 'array' && Array.isArray(value)) return value.map((item) => auditMatrixScope(item, shape.items));
  if (shape?.type === 'object' && value && typeof value === 'object' && !Array.isArray(value))
    return Object.fromEntries(Object.keys(shape.properties ?? {}).filter((key) => Object.hasOwn(value, key))
      .map((key) => [key, auditMatrixScope(value[key], shape.properties[key])]));
  return value;
}

/**
 * A typed audit's admitted scope, refused when the filed verdict does not match the admitted params.audit
 * (the same checks the inline block made).
 */
function admittedScopeOf({ packet, definition, doc, feature, attempt }) {
  const admitted = packet.params?.audit, error = paramValueError('audit', definition, admitted);
  const matrixShape = definition.valueSchema?.properties?.selectedMatrix;
  const measured = auditMatrixScope(doc.selectedMatrix, matrixShape);
  if (error || attempt.op_id !== 'interface.audit' || packet.context.selected_op.contract.id !== attempt.op_id
    || admitted.id !== doc.id || admitted.feature !== feature || feature !== String(doc.id).split('.')[1]
    || !isDeepStrictEqual(measured, admitted.selectedMatrix)
    || (Object.hasOwn(doc, 'scope') && !isDeepStrictEqual(doc.scope, admitted.selectedMatrix)))
    throw refuse('the audit verdict does not match its admitted params.audit scope', 'report-attachment-invalid');
  return admitted.selectedMatrix;
}

/**
 * interface.audit's verdict (docs/ledger-db.md: features/<f>/operations/** → interface_audits): an attached
 * interface-audit.json {schema starci/interface-audit-operation@1, id operation.<feature>.<name>, feature?, scope |
 * selectedMatrix, verdict?, findings?, routeTo?} becomes the interface_audits row of that audit, bound to this attempt.
 */
function interfaceAuditOf(db, { attempt, staged, report, now }) {
  let packet = null;
  try { packet = JSON.parse(db.prepare('SELECT context_json FROM contracts WHERE attempt_id=?').get(attempt.attempt_id)?.context_json ?? 'null')?.packet; }
  catch { packet = null; }
  const definition = packet?.context?.selected_op?.contract?.params?.audit;
  const typed = definition?.type === 'object' && definition.required === true;
  const items = staged.filter((s) => s.name.split('/').pop() === INTERFACE_AUDIT_FILE);
  if (items.length > 1 || (typed && report.outcome === 'done' && items.length !== 1))
    throw refuse('a completed typed audit needs exactly one interface-audit.json verdict', 'report-attachment-invalid');
  const item = items[0];
  if (!item) return null;
  if (!typed) throw refuse('an interface-audit.json verdict needs the typed params.audit definition of its attempt', 'report-attachment-invalid');
  let doc = null;
  try { doc = JSON.parse(fs.readFileSync(item.blob.fileUri, 'utf8')); } catch { doc = null; }
  if (doc?.schema !== INTERFACE_AUDIT_SCHEMA || !/^operation\.[a-z0-9-]+\.[a-z0-9-]+$/.test(String(doc.id ?? '')))
    throw refuse(`${item.name} is not a ${INTERFACE_AUDIT_SCHEMA} verdict with id operation.<feature>.<name>`, 'report-attachment-invalid');
  const feature = doc.feature ?? String(doc.id).split('.')[1];
  const scope = admittedScopeOf({ packet, definition, doc, feature, attempt });
  const prior = db.prepare('SELECT workflow_id,feature FROM interface_audits WHERE audit_id=?').get(doc.id);
  if (prior && (prior.workflow_id !== attempt.workflow_id || prior.feature !== feature))
    throw refuse('the audit identity is already owned by another workflow or feature', 'report-attachment-invalid');
  const verdict = ['pass', 'fail', 'partial'].includes(doc.verdict) ? doc.verdict : null;
  const routeTo = ['interface.implement', 'interface.draw'].includes(doc.routeTo) ? doc.routeTo : null;
  db.prepare(`INSERT INTO interface_audits(audit_id,workflow_id,attempt_id,feature,scope_json,verdict,findings_json,route_to,created_at,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(audit_id) DO UPDATE SET workflow_id=excluded.workflow_id,attempt_id=excluded.attempt_id,feature=excluded.feature,
      scope_json=excluded.scope_json,verdict=excluded.verdict,findings_json=excluded.findings_json,route_to=excluded.route_to,updated_at=excluded.updated_at`)
    .run(doc.id, attempt.workflow_id, attempt.attempt_id, feature, JSON.stringify(scope), verdict,
      doc.findings == null ? null : JSON.stringify(doc.findings), routeTo, now, now);
  return { auditId: doc.id, verdict };
}

/** Delete the scratch once the report is durable. Only a directory strictly inside the temp root. */
export function removeScratch(scratch) {
  if (!scratch || !inside(real(tempRoot()), scratch)) return false;
  return safeRemove(scratch, { hold: artifactHoldReason }).ok;
}
