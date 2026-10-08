// Native mechanism observations use existing check_runs and verified output blobs.
import fs from 'node:fs';
import path from 'node:path';
import { sha256, sha256File } from '../../engine/digest.mjs';
import { getBlob } from '../../engine/db/blob.mjs';
import { latestCheckRuns, stageBlob } from '../machine/evidence-store.mjs';
import { admittedContractOf, latestContractOf } from '../machine/contract-version.mjs';
import { inputStamp } from '../gates/type-impact.mjs';
import { DIGEST_SCHEMA } from '../gates/read-digest.mjs';
import { isLinkLike } from '../api/fs/is-link-like.mjs';
import { insidePath, sameResolvedPath, normRel, normPath } from '../lib/path-key.mjs';
import { parseJson } from '../lib/json.mjs';
import { filedRequiredReads } from '../lib/filed-reads.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { mergeBaseQuery } from '../api/git/merge-base-query.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { show } from '../api/git/show.mjs';

const independent = new Set(['kernel', 'settler', 'parity', 'integrate']);
const unavailable = (detail) => ({ status: 'unavailable', code: 'op-gate-tool-failed', detail, findings: [] });
const plain = (file) => {
  let at = path.parse(path.resolve(file)).root;
  for (const segment of path.resolve(file).slice(at.length).split(path.sep).filter(Boolean)) {
    at = path.join(at, segment);
    if (isLinkLike(at)) throw new Error(`linked verification input: ${at}`);
  }
  return path.resolve(file);
};
/** The one value of a `--name value` or `--name=value` argument; null when absent, a throw when repeated or empty. */
export const flag = (args, name) => {
  const values = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === name) values.push(args[++i]);
    else if (args[i].startsWith(`${name}=`)) values.push(args[i].slice(name.length + 1));
  }
  if (values.length > 1 || values.some((value) => typeof value !== 'string' || !value)) throw new Error(`ambiguous verification ${name}`);
  return values[0] ?? null;
};

/** The immutable attempt's selected contract, placement and READ identity; missing snapshots refuse. */
export function observationContextOf(db, job, { repo, skillRoot }) {
  const admitted = admittedContractOf(db, job);
  const contract = latestContractOf(db, job.job_id), filed = parseJson(contract?.context_json);
  const context = filed?.packet?.context;
  const selected = context?.selected_op;
  if (!selected?.contract || !Array.isArray(context?.readRefs)) throw new Error('current mechanism proof has no filed selected contract or READ snapshot');
  const roots = [filed.worktree, context.workflow_worktree?.path, ...(context.owned_paths ?? []).map((row) => row.root)]
    .filter((value) => typeof value === 'string' && value).map((value) => path.resolve(repo, value));
  if (!roots.length) throw new Error('current mechanism proof has no filed target root');
  const attempt = db.prepare('SELECT * FROM op_attempts WHERE attempt_id=? AND job_id=?').get(contract.attempt_id, job.job_id);
  if (!attempt || attempt.try_no !== job.try_no) throw new Error('current mechanism proof has no exact active attempt');
  return { attemptId: attempt.attempt_id, admittedAt: admitted.at, admittedRuntimeSha: admitted.version?.runtimeSha ?? null,
    skillRoot, selected, readRefs: context.readRefs, ownedPaths: context.owned_paths ?? [],
    roots: [...new Set(roots)], primary: roots[0], reportAt: db.prepare('SELECT created_at FROM reports WHERE attempt_id=?').get(attempt.attempt_id)?.created_at ?? null };
}

const bindingOf = (check, context) => {
  const rootArg = flag(check.argv, '--root'), repoArg = flag(check.argv, '--repo');
  if (rootArg && repoArg && !sameResolvedPath(path.resolve(context.primary, rootArg), path.resolve(context.primary, repoArg))) throw new Error('verification root and repo disagree');
  const requested = rootArg ?? repoArg;
  const subject = plain(requested ? path.resolve(context.primary, requested) : context.primary);
  if (!context.roots.some((root) => sameResolvedPath(root, subject))) throw new Error('verification command names a foreign target');
  const scopes = ['.'], extra = [], tree = flag(check.argv, '--tree');
  if (tree) {
    const target = plain(path.resolve(subject, tree));
    if (insidePath(subject, target, { includeSelf: true })) scopes.push(normRel(path.relative(subject, target)) || '.');
    else {
      const allowed = [...context.roots, ...context.readRefs.filter((row) => row.rootKind === 'work').map((row) => row.root)];
      if (!allowed.some((root) => insidePath(path.resolve(root), target, { includeSelf: true }))) throw new Error('verification tree is outside the filed target/Work roots');
      extra.push({ root: target, scopes: ['.'], input: inputStamp(target, ['.']) });
    }
  }
  const workspace = flag(check.argv, '--workspace');
  if (workspace && !insidePath(subject, plain(path.resolve(subject, workspace)), { includeSelf: true })) throw new Error('verification workspace is outside the filed target');
  const input = inputStamp(subject, scopes), script = plain(check.script), tool = sha256File(script);
  return { subject, scopes, input, extra, script, tool, schema: check.schema, profile: flag(check.argv, '--scope') ?? 'code',
    project: flag(check.argv, '--project'), argv: [...check.argv] };
};
const digestOf = (binding) => sha256(JSON.stringify(binding));

/** Bind an actual canonical child before and after execution. A changing target,
 * signal, missing status or spawn error is unavailable even beside green JSON. */
export function observeCheck(check, context, run) {
  let before;
  try { before = bindingOf(check, context); }
  catch (error) { return { exitCode: null, status: 'unavailable', startedAt: Date.now(), finishedAt: Date.now(), error: error.message }; }
  const result = run(before.subject);
  let after;
  try { after = bindingOf(check, context); } catch (error) { result.error = error.message; }
  const stable = after && digestOf(before) === digestOf(after);
  const processOk = Number.isInteger(result.processStatus) && !result.processError && !result.processSignal;
  return { ...result, cwd: before.subject, inputDigest: digestOf(before),
    ...(!stable || !processOk || result.processStatus === 2 ? { status: 'unavailable' } : {}),
    native: { ...before, stable: Boolean(stable), process: { status: result.processStatus, signal: result.processSignal, error: result.processError },
      ...(!stable ? { detail: result.error ?? 'verification inputs changed during execution' } : {}) } };
}

/** Stage only locally observed child bytes, outside the ledger transaction. This
 * value is never accepted from the caller's checks JSON. */
export function stageObservation(run, roots) {
  const blob = (value, mediaType) => {
    if (value == null || value.length === 0) { return null; }
    let bytes = value;
    if (!Buffer.isBuffer(value)) {
      const text = typeof value === 'string' ? value : JSON.stringify(value);
      bytes = Buffer.from(text);
    }
    return stageBlob(bytes, { mediaType, repoRoots: roots });
  };
  return { cwd: run.cwd, inputDigest: run.inputDigest, exitCode: run.exitCode, status: run.status,
    startedAt: run.startedAt, finishedAt: run.finishedAt, wallMs: run.ms,
    stdout: blob(run.stdout, 'text/plain'), stderr: blob(run.stderr, 'text/plain'), output: blob(run.output, 'application/json'), native: run.native ?? null };
}

/** The process/target/time/input receipt gap of a retained native run, or null. */
const receiptGap = (row, native, context) => {
  if (row.authority !== 'runtime' || row.phase !== 'verify' || !['pass', 'fail'].includes(row.status) || !native.stable || native.process?.error || native.process?.signal
      || !Number.isInteger(row.exit_code) || native.process?.status !== row.exit_code || row.exit_code === 2
      || !Number.isFinite(row.started_at) || !Number.isFinite(row.finished_at) || row.started_at < context.admittedAt
      || row.finished_at < row.started_at || row.finished_at > Date.now() || !sameResolvedPath(row.cwd, native.subject)
      || !context.roots.some((root) => sameResolvedPath(root, native.subject)))
    return 'the native check has no complete process, target, time or input receipt';
  return null;
};

/** The current input identity of a retained native run, checked again under the
 * existing workflow lock before a fresh settlement can prepare any Git effect. */
export function requireObservationFresh(bindings) {
  for (const binding of bindings ?? []) {
    plain(binding.subject);
    if (inputStamp(binding.subject, binding.scopes) !== binding.input
        || (binding.extra ?? []).some((row) => inputStamp(plain(row.root), row.scopes) !== row.input))
      throw Object.assign(new Error('native mechanism verification inputs changed; rerun and record the checks'), { code: 'op-gate-tool-failed' });
  }
}

/** One retained native check's output and receipt verdict. */
const observationOf = (db, context, row, native) => {
  let doc = null;
  try {
    const gap = receiptGap(row, native, context);
    if (gap) throw new Error(gap);
    // Serialized native receipts add process fields after hashing the original binding.
    const binding = { ...native }; delete binding.stable; delete binding.process; delete binding.detail;
    if (row.input_digest !== digestOf(binding)) throw new Error('the native input receipt is not exact');
    requireObservationFresh([binding]);
    if (!row.output_sha || !db.prepare('SELECT 1 FROM blobs WHERE sha256=?').get(row.output_sha)) throw new Error('the native output blob is not indexed');
    doc = JSON.parse(getBlob(row.output_sha).toString('utf8'));
    if (doc?.schema !== native.schema) throw new Error('the native child did not return its declared proof schema');
    if (Number.isInteger(doc.exit) && doc.exit !== row.exit_code) throw new Error('the native JSON exit contradicts the observed process exit');
    if (row.exit_code !== 0 && !(row.exit_code === 1 && Array.isArray(doc.findings))) throw new Error(`native proof child exited ${row.exit_code}`);
    return { checkId: row.check_id, doc, native: binding, startedAt: row.started_at, finishedAt: row.finished_at, exitCode: row.exit_code };
  } catch (error) { return { checkId: row.check_id, doc, native, judged: unavailable(error.message) }; }
};

/** Read the latest native output per schema/profile/project from this exact
 * attempt. Raw process status, indexed blob bytes, time and target must agree. */
export function mechanismObservations(db, context) {
  const latest = new Map();
  for (const row of latestCheckRuns(db, context.attemptId).filter((row) => independent.has(row.runner))) {
    const native = parseJson(row.summary_json)?.native;
    if (native?.schema) latest.set(JSON.stringify([native.schema, native.profile, native.project, native.subject]), { row, native });
  }
  return [...latest.values()].map(({ row, native }) => observationOf(db, context, row, native));
}

/** A later runtime-main commit carrying these exact Source bytes, never an
 * unlanded branch, dirty file or an op-owned input. Admission evidence is immutable. */
const sourceReadRevision = (file, captured, context) => {
  const admitted = context.admittedRuntimeSha, root = path.resolve(context.skillRoot), absolute = plain(path.resolve(root, file.path));
  if (!/^[a-f0-9]{40,64}$/.test(admitted ?? '') || !sameResolvedPath(captured.root, root)
      || !sameResolvedPath(captured.absolute, absolute) || !insidePath(root, absolute)
      || (context.ownedPaths ?? []).some((owned) => insidePath(path.resolve(owned.abs ?? path.resolve(owned.root ?? context.primary, normPath(owned.path, { glob: 'star' }))), absolute, { includeSelf: true }))) return null;
  const options = { cwd: root, timeout: 10000, maxBuffer: 16 * 1024 * 1024 };
  const main = revParseQuery(['--verify', 'refs/heads/main'], options);
  const tip = main.status === 0 ? main.stdout.trim() : '';
  if (!/^[a-f0-9]{40,64}$/.test(tip) || mergeBaseQuery(['--is-ancestor', admitted, tip], options).status !== 0) return null;
  const later = revList(['--ancestry-path', `${admitted}..${tip}`, '--', file.path], options);
  if (later.status !== 0) return null;
  for (const revision of new Set([tip, ...later.stdout.trim().split(/\s+/)])) {
    if (revision === admitted || !/^[a-f0-9]{40,64}$/.test(revision)) continue;
    const blob = show([`${revision}:${file.path}`], { ...options, encoding: 'buffer' });
    if (blob.status === 0 && sha256(blob.stdout) === file.sha256) return revision;
  }
  return null;
};

/** The READ roles that name Source law rather than a target file. */
const CANONICAL_ROLES = new Set(['pattern', 'example', 'knowledge']);

/** The unusable detail of a READ entry whose path, digest, role or uniqueness is wrong, else null. */
const digestFileShape = (file, rel, named) => {
  if (!rel || path.isAbsolute(rel) || rel === '..' || rel.startsWith('../') || !/^[a-f0-9]{64}$/.test(String(file?.sha256 ?? '')) || named.has(rel)) return 'READ contains a malformed, foreign or duplicate input';
  if (!CANONICAL_ROLES.has(file.role) && file.role !== 'read') return `READ has an unsupported input role: ${rel}`;
  return null;
};

/** The unusable detail of a READ entry the admission captured; an admitted Source law can drift advisably (recorded in `sourceDrift`), the target's bytes cannot. */
const capturedVerdict = (file, rel, captured, context, sourceDrift) => {
  const canonical = CANONICAL_ROLES.has(file.role);
  if (captured.sha256 !== file.sha256) {
    const revision = canonical && captured.rootKind === 'source' ? sourceReadRevision({ ...file, path: rel }, captured, context) : null;
    if (!revision) return `READ differs from its filed input: ${rel}`;
    sourceDrift.push({ path: rel, admissionDigest: captured.sha256, readDigest: file.sha256, revision });
  }
  if (captured.rootKind !== 'source' && (!fs.lstatSync(plain(captured.absolute)).isFile() || sha256File(captured.absolute) !== file.sha256))
    return `READ target input changed or is missing: ${rel}`;
  return null;
};

/** The unusable detail of a READ entry the admission never captured: it must be a real file of the law root or the target root with the named digest. */
const uncapturedVerdict = (file, rel, context, digest) => {
  const root = CANONICAL_ROLES.has(file.role) ? context.skillRoot : digest.root, absolute = plain(path.resolve(root, rel));
  if (!insidePath(path.resolve(root), absolute, { includeSelf: true }) || !fs.lstatSync(absolute).isFile() || sha256File(absolute) !== file.sha256) return `READ input is foreign, missing or changed: ${rel}`;
  return null;
};

/** One READ-file's verdict detail (unusable), or null with any proven drift retained. */
const digestFileVerdict = (file, named, context, digest, sourceDrift) => {
  const rel = normRel(file?.path ?? '');
  const shape = digestFileShape(file, rel, named);
  if (shape) return shape;
  const canonical = CANONICAL_ROLES.has(file.role);
  const captured = context.readRefs.find((row) => row.path === rel && (canonical ? row.rootKind === 'source' : row.rootKind !== 'source'));
  try {
    const verdict = captured ? capturedVerdict(file, rel, captured, context, sourceDrift) : uncapturedVerdict(file, rel, context, digest);
    if (verdict) return verdict;
  } catch { return `READ input is unreadable: ${rel}`; }
  named.set(rel, file);
  return null;
};

/** Bind deciding-op READ claims to the filed canonical law and real target files.
 * Source changes after admission remain advisory; current target inputs do not. */
export function judgeFiledRead(digest, context, doc, observations) {
  const bad = (detail) => ({ status: 'red', code: 'op-read-digest-no-knowledge', detail, findings: [] });
  if (digest?.schema !== DIGEST_SCHEMA || !Array.isArray(digest.files)) return { status: 'missing', code: 'op-read-digest-missing', detail: 'the required READ digest is absent', findings: [] };
  const at = Date.parse(digest.at), firstCheck = observations.filter((row) => row.native.schema !== DIGEST_SCHEMA && !row.judged).reduce((earliest, row) => Math.min(earliest, row.startedAt), context.reportAt ?? Infinity);
  if (!Number.isFinite(at) || at < context.admittedAt || at > firstCheck) return bad('READ was not recorded after admission and before CHECK/REPORT');
  if (!context.roots.some((root) => sameResolvedPath(root, digest.root))) return bad('READ names a foreign target');
  const named = new Map(), sourceDrift = [];
  for (const file of digest.files) {
    const verdict = digestFileVerdict(file, named, context, digest, sourceDrift);
    if (verdict) return bad(verdict);
  }
  // Admission's concrete READ expansion owns these law identities. A later
  // Source law addition cannot retroactively enlarge this attempt's duties.
  const required = filedRequiredReads(context.readRefs, context.selected?.contract?.reads ?? []);
  if (!required.size || [...required].some((rel) => !named.has(rel) || named.get(rel).role === 'read')) return bad('READ omits required filed common law, knowledge or declared example inputs');
  return sourceDrift.length ? { status: 'pass', code: null, detail: null, findings: [], sourceDrift } : null;
}
