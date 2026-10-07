// job-artifacts.mjs — every output a job produced, kept as proof and linked to exactly its attempt
// (docs/ledger-db.md). The bytes are blobs (engine/db/blob.mjs), the index is job_artifacts keyed
// (attempt_id, name), and nothing is copied into the repository.
//   - starci kernel report files the op's own outputs (report attachments and check outputs, api-lib/report-evidence.mjs);
//   - indexJobArtifacts, when the job settles, adds what the settler owns: the job's commits as a patch (patch.diff)
//     and the same diff pre-structured for the status console (patch.json + patch.assets/*, patch-json.mjs), and the
//     Playwright recordings its uat-slots runs wrote outside the repo (recordings/*: video, trace, screenshots);
//   - every new artifact gets its artifact_proofs row (proof-integrity.mjs) and the event artifacts-indexed carries
//     {id, name, sha256} of each, so the events digest chain covers them.
// A Work record cites an artifact by id + sha256 (docs/ledger-db.md, work-citations.mjs), never by a path.
import fs from 'node:fs';
import path from 'node:path';
import { appendEvent } from '../../engine/db/ledger.mjs';
import { subkindOf } from './artifact-subkind.mjs';
import { recordingsRootOf } from '../uat/playwright-recording.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { resolvedKey } from '../lib/path-key.mjs';
import { parseJson } from '../lib/json.mjs';
import { list as arr } from '../lib/list.mjs';
import { hostPathHits } from '../lib/host-path.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs';
import { revList } from '../api/git/rev-list.mjs';
import { formatPatch as gitFormatPatch } from '../api/git/format-patch.mjs';
import { gitResultOf } from '../lib/git.mjs';
import { isInside } from '../lib/walk.mjs';
import { landingRepos, specBatches } from './owned-path-effects.mjs';
import { projectBinding } from './target-repo.mjs';
import { recordArtifactProofs } from './proof-integrity.mjs';
import { writePatchJson, patchJsonFileOf, patchAssetsDirOf } from './patch-json.mjs';
import { kindOf, mediaTypeOf, roleOf, stageBlob, putArtifact, attemptOf, ARTIFACT_KINDS, ARTIFACT_SUBKINDS } from '../machine/evidence-store.mjs';
import { jobScratchDirOf } from './op-prompt.mjs';
import { safeRemove } from '../api/fs/safe-remove.mjs';
import { artifactHoldReason } from '../machine/artifact-hold.mjs';
import { makeTempDir } from '../api/fs/make-temp-dir.mjs';

/** One git call (a scripts/api/git call file) as {ok, stdout, error}. */
const gitResult = (call, args, options) => gitResultOf(call(args, options));

export { kindOf };
export const ARTIFACTS_INDEXED = 'artifacts-indexed';
export const PROOF_MEDIA_MISSING = 'PROOF_MEDIA_MISSING';
export const EVIDENCE_HOST_PATH = 'EVIDENCE_HOST_PATH';

const SHA = /^[0-9a-f]{7,40}$/i;
// The runtime's own checkout: a Supervisor job lands its commits there (scripts/supervisor/land.mjs).
const RUNTIME_ROOT = path.resolve(import.meta.dirname, '..', '..');
const WALK_MAX = 2000;
const WALK_DEPTH = 6;
const slashed = (p) => String(p).replaceAll('\\', '/');

const statOf = (p) => { try { return fs.statSync(p); } catch { return null; } };
const inside = (root, p) => isInside(path.resolve(root), path.resolve(p), { includeSelf: false });

/** The job's working directory outside the repository: its STARCI_JOB_SCRATCH (dispatch writes the packet file there). */
export const jobDirOf = (repo, workflowId, jobId) => jobScratchDirOf(repo, workflowId, jobId);

const collectNamedFile = (p, searchRoots, missing, push) => {
  const abs = resolveNamedFile(p, searchRoots);
  if (!abs) {
    if (/\.starciwork[\\/]/.test(p)) missing.push(slashed(p));
    return;
  }
  if (statOf(abs).isFile()) push({ abs, source: 'named' });
};

const resolveNamedFile = (p, searchRoots) => {
  if (path.isAbsolute(p)) return statOf(p) ? path.resolve(p) : null;
  return searchRoots.map((r) => path.resolve(r, p)).find((c) => statOf(c));
};

/**
 * The report a job filed and the artifacts of that attempt: {reportId, envelope, attemptId, reportPath: null,
 * artifacts: [{artifactId, name, role, kind, subkind, sha256, mediaType, label, abs}]}. `dispatchId` names the
 * attempt; without it the job's latest attempt answers. The reports row is the only copy of a report.
 */
export function filedReportOf(db, job, { dispatchId = null } = {}) {
  const attempt = attemptOf(db, { workflowId: job.workflow_id, dispatchId, jobId: job.job_id });
  if (!attempt) return { reportId: null, envelope: null, attemptId: null, reportPath: null, artifacts: [] };
  const row = db.prepare('SELECT report_id,report_json FROM reports WHERE attempt_id=?').get(attempt.attempt_id);
  return { reportId: row?.report_id ?? null, envelope: parseJson(row?.report_json, null), attemptId: attempt.attempt_id, reportPath: null,
    artifacts: attemptArtifactsOf(db, attempt.attempt_id) };
}

/** The artifacts of one attempt, with the blob file each one reads from. */
const attemptArtifactsOf = (db, attemptId) => db.prepare(`SELECT a.artifact_id,a.name,a.role,a.kind,a.subkind,a.sha256,a.media_type,a.label,b.file_uri
  FROM job_artifacts a JOIN blobs b ON b.sha256=a.sha256 WHERE a.attempt_id=? ORDER BY a.artifact_id`).all(attemptId)
  .map((r) => ({ artifactId: r.artifact_id, name: r.name, role: r.role, kind: r.kind, subkind: r.subkind, sha256: r.sha256, mediaType: r.media_type, label: r.label, abs: r.file_uri }));

function walk(dir, found, keep = () => true) {
  const visit = (d, depth) => {
    if (depth > WALK_DEPTH || found.length >= WALK_MAX) return;
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (found.length >= WALK_MAX) return;
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (entry.isFile() && keep(full)) found.push(full);
    }
  };
  visit(dir, 0);
}

/**
 * The files a job's pass is judged on, read-only: the Work files its report names (report.files that exist; a
 * named .starciwork path that does not is `missing`), its attempt's artifacts (`artifacts`, from filedReportOf: the
 * blob file, with its kind) and, with `jobId`, the Playwright recordings its uat-slots runs wrote outside the repo.
 * Returns {files: [{abs, source, kind?, name?}], missing}.
 */
export function collectJobFiles({ repo, envelope = null, roots = [], jobId = null, artifacts = [] }) {
  const searchRoots = [...new Set([repo, ...roots].filter(Boolean).map((r) => path.resolve(r)))];
  const files = [], missing = [], seen = new Set();
  const push = (entry) => { const k = resolvedKey(entry.abs); if (!seen.has(k)) { seen.add(k); files.push(entry); } };
  for (const p of [...arr(envelope?.files), ...arr(envelope?.rootCause?.evidence)].filter((v) => typeof v === 'string' && v.trim())) {
    collectNamedFile(p, searchRoots, missing, push);
  }
  for (const a of artifacts) if (a?.abs) push({ abs: a.abs, source: 'artifact', kind: a.kind, name: a.name, artifactId: a.artifactId });
  const recordings = jobId ? recordingsRootOf(jobId) : null;
  if (recordings && statOf(recordings)?.isDirectory()) {
    const found = [];
    walk(recordings, found, (file) => kindOf(file) !== 'file');
    for (const abs of found) push({ abs, source: 'recording' });
  }
  return { files, missing: [...new Set(missing)] };
}

/** The shas a job's commits are known by: {head, landed, cherryPicked, base}. */
export function jobShasOf({ envelope = null, result = null, payload = null }) {
  const landedRaw = result?.landed;
  const cherryPicked = typeof landedRaw === 'string';
  let landed = null;
  if (cherryPicked) landed = landedRaw;
  else if (typeof landedRaw?.head === 'string') landed = landedRaw.head;
  const claimed = [envelope?.head, envelope?.commit].find((s) => typeof s === 'string' && SHA.test(s.trim()));
  const evidenced = arr(result?.evidence).map((e) => /^commit:([0-9a-f]{7,40})$/i.exec(String(e))?.[1]).find(Boolean);
  const base = [envelope?.base, payload?.staging?.base].find((s) => typeof s === 'string' && SHA.test(s)) ?? null;
  return { head: claimed?.trim() ?? evidenced ?? null, landed: landed && SHA.test(landed) ? landed : null, cherryPicked, base };
}

const revParse = (root, ref, timeout) => { const r = gitResult(revParseQuery, ['--verify', '--quiet', `${ref}^{commit}`], { dir: root, timeout }); return r.ok ? r.stdout.trim() : null; };

const patchBaseOf = (root, full, specs, shas, sinceMs, timeout) => {
  let base = null;
  if (shas.cherryPicked) base = revParse(root, `${full}^`, timeout);
  else if (specs.length && Number.isFinite(sinceMs)) base = recentOwnedBaseOf(root, full, specs, sinceMs, timeout);
  if (!base) base = fallbackPatchBase(root, full, shas, timeout);
  return base;
};

const recentOwnedBaseOf = (root, full, specs, sinceMs, timeout) => {
  const since = `@${Math.floor(sinceMs / 1000)}`;
  const commits = new Set();
  for (const batch of specBatches(specs)) {
    const log = gitResult(revList, [`--since=${since}`, full, '--', ...batch.map((s) => `:(literal)${s}`)], { dir: root, timeout });
    if (!log.ok) { commits.clear(); break; }
    for (const sha of log.stdout.split(/\s+/).filter(Boolean)) commits.add(sha);
  }
  // A batch's last commit need not be the oldest across the whole owned set.
  if (!commits.size) return null;
  const history = gitResult(revList, [`--since=${since}`, full], { dir: root, timeout, maxBuffer: 64 * 1024 * 1024 });
  const oldest = history.ok ? history.stdout.split(/\s+/).findLast((sha) => commits.has(sha)) : null;
  return oldest ? revParse(root, `${oldest}^`, timeout) ?? 'root' : null;
};

const fallbackPatchBase = (root, full, shas, timeout) => shas.base && revParse(root, shas.base, timeout)
  ? revParse(root, shas.base, timeout)
  : (revParse(root, `${full}^`, timeout) ?? 'root');

const formatPatch = (root, timeout, revs, paths) => {
  const parts = [];
  for (const batch of paths.length ? specBatches(paths) : [[]]) {
    const run = gitFormatPatch(['--stdout', '--binary', '--full-index', ...revs, ...(batch.length ? ['--', ...batch.map((s) => `:(literal)${s}`)] : [])],
      { dir: root, timeout, encoding: null, maxBuffer: 1024 * 1024 * 1024 });
    if (run.error || run.status !== 0) return run;
    if (run.stdout?.length) parts.push(run.stdout);
  }
  return { status: 0, stdout: Buffer.concat(parts) };
};

/**
 * Write the job's commits as <job dir>/<job>.patch (git format-patch over its owned paths), once: an existing
 * patch is kept as it was written. The patch covers what reached the branch - the landed sha (a cherry-pick
 * by land.mjs: landed^..landed; an op's verified head: its commits since admission) - else the report's own
 * head, marked unlanded. Returns null (no commits), {missing:[sha]} (commits gone), or the patch row fields.
 */
export function writeJobPatch({ repo, job, envelope, result, payload, placements = null, roots = [], sinceMs = null, jobDir, dryRun = false }) {
  const shas = jobShasOf({ envelope, result, payload });
  const target = shas.landed ?? shas.head;
  if (!target) return null;
  const file = path.join(jobDir, `${job.job_id}.patch`);
  const state = shas.landed ? 'landed' : 'unlanded';
  const timeout = allocationMs('settleGit.commandMs');
  const landedRepos = typeof result?.landed === 'object' && result.landed ? arr(result.landed.repos) : [];
  const candidates = candidateRootsOf({ result, landedRepos, placements, roots, repo, payload });
  const holder = [...new Set(candidates)].find((root) => revParse(root, target, timeout));
  if (!holder) return { missing: [target], head: shas.head, landed: shas.landed, state };
  const top = gitResult(revParseQuery, ['--show-toplevel'], { dir: holder, timeout });
  const root = top.ok ? path.resolve(top.stdout.trim()) : holder;
  const full = revParse(root, target, timeout);
  const specs = patchSpecsOf({ landedRepos, root, shas, payload, repo, placements, timeout });
  const base = patchBaseOf(root, full, specs, shas, sinceMs, timeout);
  const out = { file, state, head: shas.head, landed: shas.landed, base: base === 'root' ? null : base, repo: root, specs };
  return writePatchFile({ out, file, root, timeout, base, full, shas, specs, dryRun, jobDir });
}

const candidateRootsOf = ({ result, landedRepos, placements, roots, repo, payload }) =>
  [result?.landed?.repo, ...landedRepos.map((r) => r?.repo), ...arr(placements).map((p) => p?.base), ...roots, repo, payload?.staging?.path, RUNTIME_ROOT]
    .filter((r) => typeof r === 'string' && r && statOf(r)?.isDirectory()).map((r) => path.resolve(r));

const patchSpecsOf = ({ landedRepos, root, shas, payload, repo, placements, timeout }) => {
  let specs = landedRepos.find((r) => r?.repo && resolvedKey(r.repo) === resolvedKey(root))?.paths ?? null;
  if (!specs && !shas.cherryPicked) {
    const owned = arr(payload?.owned_paths).map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string' && p);
    const grouped = landingRepos({ base: repo, ownedPaths: owned, placements: placements ?? undefined, timeoutMs: timeout });
    specs = [...grouped].find(([r]) => resolvedKey(r) === resolvedKey(root))?.[1]?.specs ?? null;
  }
  return arr(specs).filter((s) => typeof s === 'string' && s && s !== '.');
};

const writePatchFile = ({ out, file, root, timeout, base, full, shas, specs, dryRun, jobDir }) => {
  if (fs.existsSync(file)) return { ...out, kept: true };
  if (dryRun) return { ...out, file: null, wouldWrite: true };
  const range = base === 'root' ? ['--root', full] : [`${base}..${full}`];
  let run = formatPatch(root, timeout, range, shas.cherryPicked ? [] : specs);
  // Commits that touch none of the owned paths: the patch is the named commit itself, never the whole range.
  if (run.status === 0 && !run.stdout?.length && specs.length) run = formatPatch(root, timeout, ['-1', full], []);
  if (run.error || run.status !== 0 || !run.stdout?.length) return { ...out, error: String(run.stderr ?? run.error?.message ?? 'format-patch wrote nothing').trim() };
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(file, run.stdout, { flag: 'wx' });
  return out;
};

/** Visual proof an op's manifest owes (policy.proofMedia {images, video: required|when-browser}); null when it owes none. */
export function proofMediaPolicyOf(skillRoot, op) {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
    const policy = doc?.policy?.proofMedia;
    return policy && typeof policy === 'object' ? policy : null;
  } catch { return null; }
}

// EVIDENCE_HOST_PATH, the settle refusal for evidence that still names a host path: a pass whose Work evidence files (text under a
// .starciwork tree that the report names or the attempt filed: a record's evidence.yaml, a draw prompt, a visual review, an assets
// JSON) hold a hard-coded absolute host path - a drive path, a user-profile path or an expanded AppData path - is refused; the op
// rewrites the evidence with repo-relative paths or the placeholders <worktree>, <runtime>, <tmp>, <home> (scripts/lib/host-path.mjs
// normalizeHostPaths) and settles again. The matcher is the one the runtime HFS rule RT_ABSOLUTE_PATH uses (hostPathHits).
const EVIDENCE_TEXT = /\.(?:ya?ml|json|md|txt)$/i;
const WORK_TREE = /(?:^|[\\/])\.starciwork[\\/]/;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_OFFENDERS = 20;

const readText = (abs) => { try { const stat = fs.statSync(abs); return stat.isFile() && stat.size <= MAX_BYTES ? fs.readFileSync(abs, 'utf8') : null; } catch { return null; } };

/**
 * The EVIDENCE_HOST_PATH refusal over a job's files ([{abs, name?}] from job-artifacts.mjs collectJobFiles), or null when no
 * evidence file holds a host path. `read(abs)` returns a file's text or null (default: the file system). Returns
 * {code, missing: ['<file>:<line> <sample>', ...], detail: {files, hits}}.
 */
export function evidenceHostPathGate({ files, read = readText }) {
  const offenders = [];
  let hits = 0, filesWith = 0;
  for (const file of files ?? []) {
    const abs = file?.abs;
    if (typeof abs !== 'string' || !EVIDENCE_TEXT.test(abs) || !WORK_TREE.test(abs)) continue;
    const text = read(abs);
    if (typeof text !== 'string') continue;
    const found = hostPathHits(text);
    if (!found.length) continue;
    filesWith += 1;
    hits += found.length;
    for (const hit of found) {
      if (offenders.length >= MAX_OFFENDERS) break;
      const line = text.slice(0, hit.offset).split('\n').length;
      offenders.push(`${String(file.name ?? abs).replaceAll('\\', '/')}:${line} ${hit.sample}`);
    }
  }
  if (!offenders.length) return null;
  return { code: EVIDENCE_HOST_PATH, missing: offenders, detail: { files: filesWith, hits, advice: 'write evidence with repo-relative paths or the placeholders <worktree>, <runtime>, <tmp>, <home>' } };
}

const BROWSER = /playwright|chromium|puppeteer|webkit|firefox|browser/i;
/**
 * The PROOF_MEDIA_MISSING refusal a pass meets when its files lack the visual proof `policy` owes: at least
 * policy.images images, and a video when policy.video is `required` or a browser ran (a trace or a video was
 * produced, or a recorded check command drove a browser). Null when the proof is there.
 */
export function proofMediaGate({ policy, files, checks = [] }) {
  if (!policy) return null;
  const count = (kind) => files.filter((f) => (f.kind ?? kindOf(f.name ?? f.abs ?? f.path)) === kind).length;
  const images = count('image'), videos = count('video'), traces = count('trace');
  const browserRan = policy.video === 'required' || videos > 0 || traces > 0 || arr(checks).some((c) => BROWSER.test(String(c?.command ?? '')));
  const minImages = Number.isInteger(policy.images) && policy.images > 0 ? policy.images : 1;
  const missing = [...(images < minImages ? [`image (${images}/${minImages})`] : []), ...(browserRan && videos < 1 ? ['video'] : [])];
  if (!missing.length) return null;
  return { code: PROOF_MEDIA_MISSING, missing, detail: { images, videos, traces, browserRan, owes: policy } };
}

const stagePatchArtifacts = (patch, stage) => {
  if (!patch?.file || !fs.existsSync(patch.file)) return null;
  const shas = { baseSha: patch.base ?? null, headSha: patch.head ?? null, integratedSha: patch.landed ?? null };
  stage(patch.file, { name: 'patch.diff', role: 'patch', kind: 'patch', mediaType: 'text/x-diff', label: patch.state, extra: shas });
  let patchJson = null;
  try { patchJson = writePatchJson(patch.file, { base: patch.base, head: patch.head, landed: patch.landed, state: patch.state }); }
  catch (error) { patchJson = { error: String(error?.message ?? error) }; }
  if (patchJson?.file && fs.existsSync(patchJson.file)) {
    stage(patchJsonFileOf(patch.file), { name: 'patch.json', role: 'diff', kind: 'diff', subkind: 'patch-json', mediaType: 'application/json', extra: shas });
    const assets = patchAssetsDirOf(patch.file);
    for (const file of statOf(assets)?.isDirectory() ? fs.readdirSync(assets) : []) stage(path.join(assets, file), { name: `patch.assets/${file}`, role: 'diff', extra: shas });
  }
  return patchJson;
};

const stageRecordings = (jobId, stage) => {
  const recordings = recordingsRootOf(jobId);
  if (!statOf(recordings)?.isDirectory()) return;
  const found = [];
  walk(recordings, found, (file) => kindOf(file) !== 'file');
  for (const abs of found) stage(abs, { name: `recordings/${slashed(path.relative(recordings, abs))}`, role: roleOf(abs) });
};

const indexStagedArtifacts = (ledger, { staged, repo, job, payload, envelope, reportArtifacts, attempt, patch, now, jobId }) => {
  const byKind = {}, bySubkind = {};
  for (const item of staged) {
    byKind[item.kind] = (byKind[item.kind] ?? 0) + 1;
    const sk = item.subkind ?? 'unknown';
    bySubkind[sk] = (bySubkind[sk] ?? 0) + 1;
  }
  let added = 0, proofs = 0;
  const indexed = [];
  ledger.transaction((tx) => {
    for (const item of staged) {
      const r = putArtifact(tx, { workflowId: job.workflow_id, attemptId: attempt.attempt_id, role: item.role, kind: item.kind, subkind: item.subkind,
        name: item.name, blob: item.blob, label: item.label, origin: 'settler', now, ...item.extra });
      if (r.created) added += 1;
      indexed.push({ id: r.artifactId, name: item.name, sha256: item.blob.sha });
    }
    const all = attemptArtifactsOf(tx, attempt.attempt_id);
    proofs = recordArtifactProofs(tx, { repo, job, payload, envelope, artifacts: all, headSha: patch?.landed ?? patch?.head ?? null, now });
    if (added || proofs) appendEvent(tx, { workflowId: job.workflow_id, entityType: 'job', entityId: jobId, attemptId: attempt.attempt_id, spanId: attempt.span_id, kind: ARTIFACTS_INDEXED, createdAt: now,
      payload: { jobId, opId: job.op_id, attemptId: attempt.attempt_id, tryNo: job.try_no, status: job.status, indexed: indexed.length, added, proofs, byKind, bySubkind,
        artifacts: indexed, reportArtifacts } });
  });
  return { byKind, bySubkind, added, proofs, indexed };
};

/**
 * Index what the settler owns of job `jobId` into job_artifacts (blobs first, then one transaction): the patch, the
 * pre-structured diff and its image assets, and the job's Playwright recordings; then the artifact_proofs rows of
 * every new artifact of the attempt (report attachments included) and one artifacts-indexed event. Idempotent: an
 * artifact already filed under its name with the same bytes is kept. Returns {ok, jobId, attemptId, indexed, added,
 * proofs, byKind, bySubkind, patch, patchJson?, missing}.
 */
export function indexJobArtifacts(ledger, { repo, jobId, dispatchId = null, placements = null, roots = [], now = Date.now() }) {
  const db = ledger.db;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) return { ok: false, jobId, error: 'unknown job' };
  const attempt = attemptOf(db, { workflowId: job.workflow_id, dispatchId, jobId });
  if (!attempt) return { ok: false, jobId, error: 'job has no attempt' };
  const payload = parseJson(job.payload_json, null) ?? {};
  const { envelope, artifacts: filed } = filedReportOf(db, job, { dispatchId: attempt.dispatch_id });
  let bound = [];
  try { bound = projectBinding(repo)?.repos.map((r) => r.root) ?? []; } catch { bound = []; }
  const extraRoots = [...arr(placements).map((p) => p?.base), ...roots, ...bound].filter(Boolean);
  const repoRoots = [repo, attempt.worktree_path].filter(Boolean);
  const staged = [];
  const stage = (abs, { name, role, kind = kindOf(abs), subkind = undefined, mediaType = mediaTypeOf(abs), label = null, extra = {} }) => {
    staged.push({ name, role, kind, subkind: subkind !== undefined ? subkind : subkindOf({ kind, path: slashed(name), opId: job.op_id }), label, extra, blob: stageBlob(abs, { mediaType, repoRoots }) });
  };
  // The patch is written to a private temp directory, put in the blob store and the directory removed.
  const tmp = makeTempDir('starci-patch-');
  let patch = null, patchJson = null;
  try {
    const contract = db.prepare('SELECT created_at FROM contracts WHERE attempt_id=?').get(attempt.attempt_id);
    try { patch = writeJobPatch({ repo, job, envelope, result: parseJson(attempt.settle_json, null), payload, placements, roots: extraRoots, sinceMs: contract?.created_at ?? job.created_at, jobDir: tmp }); }
    catch (error) { patch = { error: String(error?.message ?? error) }; }
    patchJson = stagePatchArtifacts(patch, stage);
    stageRecordings(jobId, stage);
  } finally { safeRemove(tmp, { hold: artifactHoldReason }); }
  const indexed = indexStagedArtifacts(ledger, { staged, repo, job, payload, envelope, reportArtifacts: filed.length, attempt, patch, now, jobId });
  const patchView = patch ? { state: patch.state ?? null, head: patch.head ?? null, landed: patch.landed ?? null, base: patch.base ?? null,
    ...(patch.missing ? { missing: patch.missing } : {}), ...(patch.error ? { error: patch.error } : {}) } : null;
  let patchJsonView = null;
  if (patchJson?.error) patchJsonView = { error: patchJson.error };
  else if (patchJson) patchJsonView = { files: patchJson.files, truncated: patchJson.truncated };
  return { ok: true, jobId, attemptId: attempt.attempt_id, indexed: indexed.indexed.length, added: indexed.added, proofs: indexed.proofs,
    byKind: indexed.byKind, bySubkind: indexed.bySubkind, patch: patchView, ...(patchJsonView ? { patchJson: patchJsonView } : {}), missing: [] };
}

/**
 * The indexed artifacts of a workflow (or one job, or one kind/subkind), read-only, grouped by job: what `starci kernel artifacts`
 * prints and what ui/server.mjs serves. Each artifact carries its id and sha256 (what a Work record cites) and the
 * harness path of its bytes (/api/blob/<sha256>).
 */
export function listJobArtifacts(db, { workflowId, jobId = null, kind = null, subkind = null }) {
  if (kind && !ARTIFACT_KINDS.includes(kind)) throw Object.assign(new Error(`artifact kind must be ${ARTIFACT_KINDS.join('|')}, got '${kind}'`), { code: 'artifact-kind-unknown' });
  if (subkind && !ARTIFACT_SUBKINDS.includes(subkind)) throw Object.assign(new Error(`artifact subkind must be ${ARTIFACT_SUBKINDS.join('|')}, got '${subkind}'`), { code: 'artifact-subkind-unknown' });
  const where = ['a.workflow_id=?', ...(jobId ? ['a.job_id=?'] : []), ...(kind ? ['a.kind=?'] : []), ...(subkind ? ['a.subkind=?'] : [])];
  const rows = db.prepare(`SELECT a.*, b.http_path, j.status AS job_status, j.try_no FROM job_artifacts a JOIN blobs b ON b.sha256=a.sha256
    LEFT JOIN jobs j ON j.job_id=a.job_id WHERE ${where.join(' AND ')} ORDER BY a.artifact_id`)
    .all(workflowId, ...(jobId ? [jobId] : []), ...(kind ? [kind] : []), ...(subkind ? [subkind] : []));
  const jobs = new Map();
  for (const r of rows) {
    const key = r.job_id ?? '(kernel)';
    if (!jobs.has(key)) jobs.set(key, { jobId: r.job_id, opId: r.op_id, tryNo: r.try_no ?? null, cut: r.cut, status: r.job_status ?? null, byKind: {}, bySubkind: {}, artifacts: [] });
    const job = jobs.get(key);
    job.byKind[r.kind] = (job.byKind[r.kind] ?? 0) + 1;
    job.bySubkind[r.subkind ?? 'unknown'] = (job.bySubkind[r.subkind ?? 'unknown'] ?? 0) + 1;
    job.artifacts.push({ artifactId: r.artifact_id, attemptId: r.attempt_id, role: r.role, kind: r.kind, subkind: r.subkind ?? null, name: r.name, sha256: r.sha256,
      bytes: r.bytes, mediaType: r.media_type, label: r.label, origin: r.origin, httpPath: r.http_path, round: r.round, runId: r.run_id,
      ...(r.kind === 'patch' || r.kind === 'diff' ? { baseSha: r.base_sha, headSha: r.head_sha, integratedSha: r.integrated_sha } : {}), createdAt: r.created_at });
  }
  return { workflowId, jobs: [...jobs.values()], total: rows.length };
}
