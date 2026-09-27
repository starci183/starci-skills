// job-artifacts.mjs — every output a job produced, kept as proof and linked to exactly that job: the ledger
// table job_artifacts (engine/schema.sql) holds one row per file — path, sha256, bytes, mime, label — never
// the bytes. indexJobArtifacts runs when a job settles, whatever its verdict, and in the backfill
// (scripts/work/backfill-job-artifacts.mjs). What a job owns:
//   - its report envelope (the reports row, written once to <job dir>/report-<report_id>.json) and the
//     report file it filed;
//   - every path its report names (report.files, rootCause.evidence) that is Work (<repo>/.starciwork),
//     media, a trace, a log or a report, and every file of the evidence directory holding one
//     (.starciwork/evidence/<dir>, an E/ or evidence/ directory, a uat runs/<run>);
//   - a .patch of its commits (writeJobPatch), so the diff outlives branch deletion and history rewrite.
// A named file outside <repo>/.starciwork (a temp report, a sibling checkout's test-results, a worktree
// about to be removed) is copied into the job dir and the copy is indexed with its `origin`.
// The job dir is kernel custody: <repo>/.starciwork/kernel-evidence/<workflow>/jobs/<job>/, never an op's
// write set, so nothing the kernel writes there dirties an owned path.
import fs from 'node:fs';
import path from 'node:path';
import { JOB_ARTIFACT_KINDS, hasLedgerTable } from '../../engine/ledger-db.mjs';
import { sha256, sha256File } from '../../engine/digest.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { parseJson } from '../lib/json.mjs';
import { gitResult, runGit } from '../lib/git.mjs';
import { landingRepos } from './settle-landed.mjs';
import { projectBinding } from './target-repo.mjs';

export const ARTIFACTS_INDEXED = 'artifacts-indexed';
export const PROOF_MEDIA_MISSING = 'PROOF_MEDIA_MISSING';
/** The contract change that made visual proof mandatory (modules/kernel/contract-changes.yaml, reach new-legs). */
export const PROOF_MEDIA_CHANGE = 'job-proof-media';

const SHA = /^[0-9a-f]{7,40}$/i;
// The runtime's own checkout: a Supervisor job lands its commits there (scripts/supervisor/land.mjs).
const RUNTIME_ROOT = path.resolve(import.meta.dirname, '..', '..');
const IMAGE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const VIDEO = { '.webm': 'video/webm', '.mp4': 'video/mp4', '.mov': 'video/quicktime' };
const OTHER = { '.json': 'application/json', '.md': 'text/markdown', '.yaml': 'text/yaml', '.yml': 'text/yaml', '.txt': 'text/plain',
  '.log': 'text/plain', '.out': 'text/plain', '.patch': 'text/x-diff', '.diff': 'text/x-diff', '.html': 'text/html', '.zip': 'application/zip',
  '.trace': 'application/octet-stream', '.csv': 'text/csv', '.xml': 'application/xml' };
const WALK_MAX = 5000;
const WALK_DEPTH = 8;
const SKIP_DIRS = new Set(['node_modules', '.git']);

const slashed = (p) => String(p).replace(/\\/g, '/');
const keyOf = (p) => (process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p));
const statOf = (p) => { try { return fs.statSync(p); } catch { return null; } };
const inside = (root, p) => { const rel = path.relative(path.resolve(root), path.resolve(p)); return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel); };
const arr = (v) => (Array.isArray(v) ? v : []);

export const jobDirOf = (repo, workflowId, jobId) => path.join(repo, '.starciwork', 'kernel-evidence', workflowId, 'jobs', jobId);
export const mimeOf = (file) => { const ext = path.extname(file).toLowerCase(); return IMAGE[ext] ?? VIDEO[ext] ?? OTHER[ext] ?? 'application/octet-stream'; };

/** The job_artifacts.kind of a file, from its name. */
export function kindOf(file) {
  const base = path.basename(String(file)).toLowerCase(), ext = path.extname(base);
  if (ext === '.patch') return 'patch';
  if (ext === '.diff') return 'diff';
  if (IMAGE[ext]) return 'image';
  if (VIDEO[ext]) return 'video';
  if (ext === '.trace' || (ext === '.zip' && base.includes('trace'))) return 'trace';
  if (/^(report|result)([.-].*)?\.(json|md|ya?ml)$/.test(base)) return 'report';
  if (['.log', '.txt', '.out'].includes(ext) && !base.endsWith('.prompt.txt')) return 'log';
  return 'file';
}

/**
 * The evidence directory (repo-relative) holding `rel`, or null: .starciwork/evidence/<dir>, the nearest E/, the
 * nearest evidence/ - its round subdirectory (evidence/<round>/) when the file sits in one - or a uat runs/<run>.
 */
export function evidenceDirOf(rel) {
  const segs = slashed(rel).split('/');
  if (segs[0] !== '.starciwork' || segs.length < 3) return null;
  if (segs[1] === 'evidence') return segs.length > 3 ? segs.slice(0, 3).join('/') : null;
  for (let i = segs.length - 2; i >= 2; i--) {
    if (segs[i] === 'E') return segs.slice(0, i + 1).join('/');
    if (segs[i] === 'evidence') return segs.slice(0, i < segs.length - 2 ? i + 2 : i + 1).join('/');
    if (segs[i - 1] === 'runs') return segs.slice(0, i + 1).join('/');
  }
  return null;
}

const VIEWPORT = /(?:^|[-_.@])((?:desktop|tablet|mobile)(?:-\d{3,4})?|\d{3,4}x\d{3,4})(?=$|[-_.@])/i;
const recordCache = new Map();
const recordOf = (dir) => {
  if (!recordCache.has(dir)) { let doc = null; try { doc = parseYaml(fs.readFileSync(path.join(dir, 'index.yaml'), 'utf8')); } catch { doc = null; } recordCache.set(dir, doc); }
  return recordCache.get(dir);
};
// The XBase#state@viewport a ui record declares for this asset (a shapes/direction entry naming it), else the
// viewport its file name carries.
function labelOf(abs, repo) {
  const rel = slashed(path.relative(repo, abs));
  if (kindOf(abs) === 'image' && /^\.starciwork\/features\/[^/]+\/ui\//.test(rel)) {
    let dir = path.dirname(abs);
    while (inside(repo, dir) && !fs.existsSync(path.join(dir, 'index.yaml'))) dir = path.dirname(dir);
    const doc = inside(repo, dir) ? recordOf(dir) : null;
    const own = slashed(path.relative(dir, abs));
    let found = null;
    const visit = (node) => {
      if (found || !node || typeof node !== 'object') return;
      if (!Array.isArray(node) && Object.values(node).some((v) => typeof v === 'string' && (slashed(v) === own || slashed(v) === rel))) {
        const shape = node.shape ?? (node.screen && node.state ? `${node.screen}#${node.state}` : node.state ?? null);
        if (shape || node.viewport) { found = [shape, node.viewport].filter(Boolean).join('@'); return; }
      }
      for (const v of Object.values(node)) visit(v);
    };
    visit(doc);
    if (found) return String(found);
  }
  const stem = path.basename(abs, path.extname(abs));
  const m = VIEWPORT.exec(stem);
  if (!m) return null;
  const before = stem.slice(0, m.index).replace(/[-_.@]+$/, '');
  return before ? `${before}@${m[1]}` : m[1];
}

const resolveNamed = (p, roots) => {
  if (typeof p !== 'string' || !p.trim() || p.includes('\0')) return null;
  const value = p.trim();
  if (path.isAbsolute(value)) return statOf(value) ? path.resolve(value) : null;
  for (const root of roots) { const abs = path.resolve(root, value); if (statOf(abs)) return abs; }
  return null;
};

function walk(dir, found, source, keep = () => true) {
  const visit = (d, depth) => {
    if (depth > WALK_DEPTH || found.size >= WALK_MAX) return;
    let list = [];
    try { list = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of list) {
      if (found.size >= WALK_MAX) return;
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (entry.isFile() && keep(full) && !found.has(keyOf(full))) found.set(keyOf(full), { abs: full, source });
    }
  };
  visit(dir, 0);
}

/** The report row a job filed (the report-filed event's dispatch, else its op+attempt), as {reportId, envelope, reportPath}. */
export function filedReportOf(db, job, { dispatchId = null } = {}) {
  const filed = db.prepare("SELECT payload_json FROM events WHERE kind='report-filed' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(job.job_id);
  const filedPayload = parseJson(filed?.payload_json, null);
  const dispatch = dispatchId ?? filedPayload?.dispatchId ?? null;
  const row = (dispatch && db.prepare('SELECT report_id,report_json FROM reports WHERE workflow_id=? AND dispatch_id=? ORDER BY report_id DESC LIMIT 1').get(job.workflow_id, dispatch))
    || (job.op_id && db.prepare('SELECT report_id,report_json FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? ORDER BY report_id DESC LIMIT 1').get(job.workflow_id, job.op_id, job.attempt))
    || null;
  const result = parseJson(job.result_json, null) ?? {};
  const payload = parseJson(job.payload_json, null) ?? {};
  const reportPath = [result.report, payload.report, filedPayload?.report].find((p) => typeof p === 'string' && p) ?? null;
  return { reportId: row?.report_id ?? null, envelope: parseJson(row?.report_json, null), reportPath };
}

const PROOF_DIR = /^(?:E|evidence|runs?|screens?|videos?|traces?|captures?|renders?|test-results|playwright-report|artifacts?)$/i;
// A directory a report names is walked only when it is (or sits in) an evidence directory: naming a feature
// or a checkout never links its whole tree to one job.
const walkable = (work, repo, dir) => (inside(work, dir) ? evidenceDirOf(`${slashed(path.relative(repo, dir))}/x`) !== null
  : slashed(dir).split('/').some((seg) => PROOF_DIR.test(seg)));

/**
 * The files a job owns as proof, read-only: [{abs, source, copyFrom?}] plus `missing` (named paths not on
 * disk). `roots` are the checkouts a relative report path may resolve in (the repo first).
 */
export function collectJobFiles({ repo, envelope = null, reportPath = null, roots = [] }) {
  const work = path.join(repo, '.starciwork');
  const searchRoots = [...new Set([repo, ...roots].filter(Boolean).map((r) => path.resolve(r)))];
  const found = new Map(), missing = [];
  const named = [reportPath, ...arr(envelope?.files), ...arr(envelope?.rootCause?.evidence)].filter((p) => typeof p === 'string' && p.trim());
  const dirs = new Map();
  for (const p of named) {
    const abs = resolveNamed(p, searchRoots);
    if (!abs) {
      if (/\.starciwork[\\/]/.test(p) || kindOf(p) !== 'file') missing.push(slashed(p));
      continue;
    }
    const st = statOf(abs);
    if (st.isDirectory()) { if (walkable(work, repo, abs)) dirs.set(keyOf(abs), abs); continue; }
    if (!st.isFile()) continue;
    const underWork = inside(work, abs);
    if (!underWork && kindOf(abs) === 'file' && p !== reportPath) continue;
    if (!found.has(keyOf(abs))) found.set(keyOf(abs), { abs, source: 'named' });
    const evidenceDir = underWork ? evidenceDirOf(slashed(path.relative(repo, abs))) : null;
    if (evidenceDir) dirs.set(keyOf(path.join(repo, evidenceDir)), path.join(repo, evidenceDir));
  }
  // A directory outside Work contributes its proof files (media, traces, logs, reports), never its source.
  for (const dir of dirs.values()) walk(dir, found, 'evidence-dir', inside(work, dir) ? () => true : (file) => kindOf(file) !== 'file');
  return { files: [...found.values()], missing: [...new Set(missing)] };
}

/** The shas a job's commits are known by: {head, landed, cherryPicked, base}. */
export function jobShasOf({ envelope = null, result = null, payload = null }) {
  const landedRaw = result?.landed;
  const cherryPicked = typeof landedRaw === 'string';
  const landed = cherryPicked ? landedRaw : (typeof landedRaw?.head === 'string' ? landedRaw.head : null);
  const claimed = [envelope?.head, envelope?.commit].find((s) => typeof s === 'string' && SHA.test(s.trim()));
  const evidenced = arr(result?.evidence).map((e) => /^commit:([0-9a-f]{7,40})$/i.exec(String(e))?.[1]).find(Boolean);
  const base = [envelope?.base, payload?.staging?.base].find((s) => typeof s === 'string' && SHA.test(s)) ?? null;
  return { head: claimed?.trim() ?? evidenced ?? null, landed: landed && SHA.test(landed) ? landed : null, cherryPicked, base };
}

const revParse = (root, ref, timeout) => { const r = gitResult(['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { dir: root, timeout }); return r.ok ? r.stdout.trim() : null; };

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
  const candidates = [result?.landed?.repo, ...landedRepos.map((r) => r?.repo), ...arr(placements).map((p) => p?.base), ...roots, repo, payload?.staging?.path, RUNTIME_ROOT]
    .filter((r) => typeof r === 'string' && r && statOf(r)?.isDirectory()).map((r) => path.resolve(r));
  const holder = [...new Set(candidates)].find((root) => revParse(root, target, timeout));
  if (!holder) return { missing: [target], head: shas.head, landed: shas.landed, state };
  const top = gitResult(['rev-parse', '--show-toplevel'], { dir: holder, timeout });
  const root = top.ok ? path.resolve(top.stdout.trim()) : holder;
  const full = revParse(root, target, timeout);
  let specs = landedRepos.find((r) => r?.repo && keyOf(r.repo) === keyOf(root))?.paths ?? null;
  if (!specs && !shas.cherryPicked) {
    const owned = arr(payload?.owned_paths).map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string' && p);
    const grouped = landingRepos({ base: repo, ownedPaths: owned, placements: placements ?? undefined, timeoutMs: timeout });
    specs = [...grouped].find(([r]) => keyOf(r) === keyOf(root))?.[1]?.specs ?? null;
  }
  specs = arr(specs).filter((s) => typeof s === 'string' && s && s !== '.');
  let base = null;
  if (shas.cherryPicked) base = revParse(root, `${full}^`, timeout);
  else if (specs.length && Number.isFinite(sinceMs)) {
    const since = `@${Math.floor(sinceMs / 1000)}`;
    const log = gitResult(['rev-list', `--since=${since}`, full, '--', ...specs.map((s) => `:(literal)${s}`)], { dir: root, timeout });
    const commits = log.ok ? log.stdout.split(/\s+/).filter(Boolean) : [];
    if (commits.length) base = revParse(root, `${commits.at(-1)}^`, timeout) ?? 'root';
  }
  if (!base) base = shas.base && revParse(root, shas.base, timeout) ? revParse(root, shas.base, timeout) : (revParse(root, `${full}^`, timeout) ?? 'root');
  const out = { file, state, head: shas.head, landed: shas.landed, base: base === 'root' ? null : base, repo: root, specs };
  if (fs.existsSync(file)) return { ...out, kept: true };
  if (dryRun) return { ...out, file: null, wouldWrite: true };
  const range = base === 'root' ? ['--root', full] : [`${base}..${full}`];
  const formatPatch = (revs, paths) => runGit(['format-patch', '--stdout', '--binary', '--full-index', ...revs, ...(paths.length ? ['--', ...paths.map((s) => `:(literal)${s}`)] : [])],
    { dir: root, timeout, encoding: 'buffer', maxBuffer: 1024 * 1024 * 1024 });
  let run = formatPatch(range, shas.cherryPicked ? [] : specs);
  // Commits that touch none of the owned paths: the patch is the named commit itself, never the whole range.
  if (run.status === 0 && !run.stdout?.length && specs.length) run = formatPatch(['-1', full], []);
  if (run.error || run.status !== 0 || !run.stdout?.length) return { ...out, error: String(run.stderr ?? run.error?.message ?? 'format-patch wrote nothing').trim() };
  fs.mkdirSync(jobDir, { recursive: true });
  fs.writeFileSync(file, run.stdout, { flag: 'wx' });
  return out;
}

/** Visual proof an op's manifest owes (policy.proofMedia {images, video: required|when-browser}); null when it owes none. */
export function proofMediaPolicyOf(skillRoot, op) {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
    const policy = doc?.policy?.proofMedia;
    return policy && typeof policy === 'object' ? policy : null;
  } catch { return null; }
}

const BROWSER = /playwright|chromium|puppeteer|webkit|firefox|browser/i;
/**
 * The PROOF_MEDIA_MISSING refusal a pass meets when its files lack the visual proof `policy` owes: at least
 * policy.images images, and a video when policy.video is `required` or a browser ran (a trace or a video was
 * produced, or a recorded check command drove a browser). Null when the proof is there.
 */
export function proofMediaGate({ policy, files, checks = [] }) {
  if (!policy) return null;
  const count = (kind) => files.filter((f) => kindOf(f.abs ?? f.path) === kind).length;
  const images = count('image'), videos = count('video'), traces = count('trace');
  const browserRan = policy.video === 'required' || videos > 0 || traces > 0 || arr(checks).some((c) => BROWSER.test(String(c?.command ?? '')));
  const minImages = Number.isInteger(policy.images) && policy.images > 0 ? policy.images : 1;
  const missing = [...(images < minImages ? [`image (${images}/${minImages})`] : []), ...(browserRan && videos < 1 ? ['video'] : [])];
  if (!missing.length) return null;
  return { code: PROOF_MEDIA_MISSING, missing, detail: { images, videos, traces, browserRan, owes: policy } };
}

const copyDest = (jobDir, abs) => path.join(jobDir, 'files', `${sha256(keyOf(abs)).slice(0, 8)}-${path.basename(abs)}`);
const copyInto = (jobDir, abs) => {
  const dest = copyDest(jobDir, abs);
  if (!fs.existsSync(dest)) { fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.copyFileSync(abs, dest); }
  return dest;
};

/**
 * Index everything job `jobId` produced into job_artifacts and append `artifacts-indexed`. `event`:
 * 'always' (settle) or 'on-change' (backfill: only when a row was added or changed, or the job has no
 * artifacts-indexed event yet). `dryRun` writes nothing and reports what it would index.
 * Returns {ok, jobId, indexed, added, updated, byKind, patch, missing, copied}.
 */
export function indexJobArtifacts(ledger, { repo, jobId, dispatchId = null, placements = null, roots = [], event = 'always', dryRun = false, now = Date.now() }) {
  const db = ledger.db;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) return { ok: false, jobId, error: 'unknown job' };
  if (!dryRun && !hasLedgerTable(db, 'job_artifacts')) return { ok: false, jobId, error: 'ledger has no job_artifacts table (open it read-write once to migrate)' };
  const payload = parseJson(job.payload_json, null) ?? {};
  const result = parseJson(job.result_json, null) ?? {};
  const { reportId, envelope, reportPath } = filedReportOf(db, job, { dispatchId });
  const jobDir = jobDirOf(repo, job.workflow_id, jobId);
  // The checkouts a job's paths and commits may live in: its placements, the caller's roots, the project's bound repositories.
  let bound = [];
  try { bound = projectBinding(repo)?.repos.map((r) => r.root) ?? []; } catch { bound = []; }
  const extraRoots = [...arr(placements).map((p) => p?.base), ...roots, ...bound].filter(Boolean);
  const { files, missing } = collectJobFiles({ repo, envelope, reportPath, roots: extraRoots });
  const contract = job.op_id ? db.prepare('SELECT created_at FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(job.workflow_id, job.op_id, job.attempt) : null;
  const sinceMs = contract?.created_at ?? job.created_at;
  const work = path.join(repo, '.starciwork');
  const rows = [];
  let copied = 0, patch = null;
  const add = (abs, extra = {}) => {
    const st = statOf(abs);
    if (!st?.isFile()) return;
    rows.push({ path: slashed(path.relative(repo, abs)), kind: kindOf(abs), sha256: sha256File(abs), bytes: st.size, mime: mimeOf(abs), label: labelOf(abs, repo), origin: null, head: null, landed: null, base: null, ...extra });
  };
  if (!dryRun) {
    if (envelope && reportId != null) {
      const file = path.join(jobDir, `report-${reportId}.json`);
      if (!fs.existsSync(file)) { fs.mkdirSync(jobDir, { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(envelope, null, 2)}\n`, { flag: 'wx' }); }
      files.push({ abs: file, source: 'envelope' });
    }
    try { patch = writeJobPatch({ repo, job, envelope, result, payload, placements, roots: extraRoots, sinceMs, jobDir }); }
    catch (error) { patch = { error: String(error?.message ?? error) }; }
    if (patch?.file && fs.existsSync(patch.file)) files.push({ abs: patch.file, source: 'patch', patch });
  } else {
    try { patch = writeJobPatch({ repo, job, envelope, result, payload, placements, roots: extraRoots, sinceMs, jobDir, dryRun: true }); }
    catch (error) { patch = { error: String(error?.message ?? error) }; }
    if (envelope && reportId != null) rows.push({ path: slashed(path.relative(repo, path.join(jobDir, `report-${reportId}.json`))), kind: 'report' });
    if (patch && !patch.missing && !patch.error) rows.push({ path: slashed(path.relative(repo, path.join(jobDir, `${jobId}.patch`))), kind: 'patch' });
  }
  const seen = new Set();
  for (const item of files) {
    if (seen.has(keyOf(item.abs))) continue;
    seen.add(keyOf(item.abs));
    if (dryRun) {
      if (!statOf(item.abs)?.isFile()) continue;
      const outside = !inside(work, item.abs);
      if (outside) copied += 1;
      rows.push({ path: slashed(path.relative(repo, outside ? copyDest(jobDir, item.abs) : item.abs)), kind: kindOf(item.abs) });
      continue;
    }
    if (!inside(work, item.abs)) {
      try { const copy = copyInto(jobDir, item.abs); copied += 1; add(copy, { origin: slashed(item.abs) }); } catch { missing.push(slashed(item.abs)); }
      continue;
    }
    if (item.patch) add(item.abs, { kind: 'patch', label: item.patch.state, head: item.patch.head ?? null, landed: item.patch.landed ?? null, base: item.patch.base ?? null });
    else add(item.abs);
  }
  const byKind = {};
  for (const row of rows) byKind[row.kind] = (byKind[row.kind] ?? 0) + 1;
  const patchView = patch ? { state: patch.state ?? null, head: patch.head ?? null, landed: patch.landed ?? null, base: patch.base ?? null,
    ...(patch.file ? { path: slashed(path.relative(repo, patch.file)) } : {}), ...(patch.missing ? { missing: patch.missing } : {}), ...(patch.error ? { error: patch.error } : {}), ...(patch.kept ? { kept: true } : {}), ...(patch.wouldWrite ? { wouldWrite: true } : {}) } : null;
  if (dryRun) {
    const known = hasLedgerTable(db, 'job_artifacts') ? new Set(db.prepare('SELECT path FROM job_artifacts WHERE workflow_id=? AND job_id=?').all(job.workflow_id, jobId).map((r) => r.path)) : new Set();
    return { ok: true, jobId, dryRun: true, indexed: rows.length, added: rows.filter((r) => !known.has(r.path)).length, updated: 0, byKind, patch: patchView, missing, copied };
  }
  const cut = payload.cut && typeof payload.cut === 'object' ? `${payload.cut.id ?? ''}#${payload.cut.ordinal ?? ''}/${payload.cut.total ?? ''}` : null;
  let added = 0, updated = 0;
  ledger.transaction(() => {
    const existing = db.prepare('SELECT sha256 FROM job_artifacts WHERE workflow_id=? AND job_id=? AND path=?');
    const upsert = db.prepare(`INSERT INTO job_artifacts(workflow_id,job_id,op_id,attempt,cut,kind,path,sha256,bytes,mime,label,origin,head_sha,landed_sha,base_sha,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workflow_id,job_id,path) DO UPDATE SET kind=excluded.kind,sha256=excluded.sha256,bytes=excluded.bytes,
      mime=excluded.mime,label=excluded.label,origin=COALESCE(excluded.origin,job_artifacts.origin),head_sha=excluded.head_sha,landed_sha=excluded.landed_sha,base_sha=excluded.base_sha
      WHERE job_artifacts.sha256 IS NOT excluded.sha256`);
    for (const row of rows) {
      const prior = existing.get(job.workflow_id, jobId, row.path);
      const changes = upsert.run(job.workflow_id, jobId, job.op_id, job.attempt, cut, row.kind, row.path, row.sha256, row.bytes, row.mime, row.label, row.origin, row.head, row.landed, row.base, now).changes;
      if (!prior) added += changes; else updated += changes;
    }
    const announced = db.prepare("SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1").get(ARTIFACTS_INDEXED, jobId);
    if (event === 'always' || added || updated || !announced) {
      ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: ARTIFACTS_INDEXED, createdAt: now,
        payload: { jobId, opId: job.op_id, attempt: job.attempt, status: job.status, indexed: rows.length, added, updated, byKind, copied, patch: patchView, ...(missing.length ? { missing: missing.slice(0, 50) } : {}) } });
    }
  });
  return { ok: true, jobId, indexed: rows.length, added, updated, byKind, patch: patchView, missing, copied };
}

/**
 * The indexed artifacts of a workflow (or one job, or one kind), read-only, grouped by job: what `api artifacts` prints
 * and what ui/server.mjs serves. `db` is any ledger handle's db; a ledger that predates the table has none.
 */
export function listJobArtifacts(db, { workflowId, jobId = null, kind = null }) {
  if (kind && !JOB_ARTIFACT_KINDS.includes(kind)) throw Object.assign(Error(`artifact kind must be ${JOB_ARTIFACT_KINDS.join('|')}, got '${kind}'`), { code: 'artifact-kind-unknown' });
  if (!hasLedgerTable(db, 'job_artifacts')) return { workflowId, jobs: [], total: 0 };
  const where = ['a.workflow_id=?', ...(jobId ? ['a.job_id=?'] : []), ...(kind ? ['a.kind=?'] : [])];
  const rows = db.prepare(`SELECT a.*, j.status AS job_status FROM job_artifacts a LEFT JOIN jobs j ON j.job_id=a.job_id
    WHERE ${where.join(' AND ')} ORDER BY a.created_at, a.job_id, a.kind, a.path`).all(workflowId, ...(jobId ? [jobId] : []), ...(kind ? [kind] : []));
  const jobs = new Map();
  for (const r of rows) {
    if (!jobs.has(r.job_id)) jobs.set(r.job_id, { jobId: r.job_id, opId: r.op_id, attempt: r.attempt, cut: r.cut, status: r.job_status ?? null, byKind: {}, artifacts: [] });
    const job = jobs.get(r.job_id);
    job.byKind[r.kind] = (job.byKind[r.kind] ?? 0) + 1;
    job.artifacts.push({ kind: r.kind, path: r.path, sha256: r.sha256, bytes: r.bytes, mime: r.mime, label: r.label, origin: r.origin,
      ...(r.kind === 'patch' ? { headSha: r.head_sha, landedSha: r.landed_sha, baseSha: r.base_sha } : {}), createdAt: r.created_at });
  }
  return { workflowId, jobs: [...jobs.values()], total: rows.length };
}
