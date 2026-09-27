// typed-logs.mjs (ui) — what /api/logs, /api/logs/stream and /api/diff serve: a project's typed log rows
// (scripts/kernel/typed-logs.mjs: the logs table of <repo>/.starciwork/runtime.sqlite) and a job's pre-structured diff
// (scripts/kernel/patch-json.mjs, <patch>.json). A read syncs the logs first - ledger events derived, job sidecars
// ingested (idempotent, append-only) - so a running op's rows show while it works. The ONLY write the ui server makes
// is that sync: logs and log_cursors rows, through the process's one buffered log writer (scripts/kernel/log-writer.mjs,
// whose connection an SQLite authorizer limits to those tables); every other ui handle opens the ledger read-only
// (engine/ledger-db.mjs openLedgerReader). A diff whose json the backfill has not written yet is parsed in memory and
// never written here.
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite'; // eslint-disable-line no-unused-vars
import { openLedgerReader } from '../engine/ledger-db.mjs';
import { openLogs, readLogs, syncLogs, LOG_KINDS } from '../scripts/kernel/typed-logs.mjs';
import { patchJsonFileOf, patchAssetsDirOf, patchParser } from '../scripts/kernel/patch-json.mjs';
import { projectBinding } from '../scripts/kernel/target-repo.mjs';

const run = promisify(execFile);
const WORKFLOW = /^wf-[a-z0-9._-]{1,120}$/i;
const JOB = /^op-[a-z0-9._-]{1,120}$/i;
const BLOB = /^[0-9a-f]{7,64}$/;
const IMAGE_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.avif': 'image/avif' };
const SYNC_EVERY_MS = 2500;
const lastSync = new Map();
/** Kept for callers that closed a long-lived handle: every read now opens and releases its own. */
export function closeProjectLogs() {}

const ledgerOf = (project) => openLedgerReader(path.join(project.repo, '.starciwork', 'runtime.sqlite'));

/** Parse the query of /api/logs: {workflowId, jobIds, after, kinds, limit}; throws on a bad parameter. */
export function logQueryOf(params) {
  const workflowId = params.get('workflow') ?? '';
  if (!WORKFLOW.test(workflowId)) throw new Error('Tham số workflow không hợp lệ');
  const jobs = (params.get('job') ?? params.get('jobs') ?? '').split(',').map((j) => j.trim()).filter(Boolean);
  if (jobs.some((j) => !JOB.test(j)) || jobs.length > 40) throw new Error('Tham số job không hợp lệ');
  const kinds = (params.get('kinds') ?? '').split(',').map((k) => k.trim()).filter(Boolean);
  if (kinds.some((k) => !LOG_KINDS[k])) throw new Error('Tham số kinds không hợp lệ');
  const after = Number(params.get('after') ?? 0);
  return { workflowId, jobIds: jobs.length ? jobs : null, kinds: kinds.length ? kinds : null, after: Number.isSafeInteger(after) && after > 0 ? after : 0, limit: Math.min(5000, Math.max(1, Number(params.get('limit')) || 3000)) };
}

/** The rows of one workflow (or its jobs), synced first at most every SYNC_EVERY_MS per project. */
export function readProjectLogs(project, query, { now = Date.now() } = {}) {
  const ledger = ledgerOf(project);
  let logs = null;
  try {
    if (!ledger.prepare('SELECT 1 FROM workflows WHERE workflow_id=? LIMIT 1').get(query.workflowId)) return null;
    // The process's one writer (log-writer.mjs), released after the read: the ui holds no ledger file open between polls.
    logs = openLogs(project.repo);
    const key = `${project.id}:${query.workflowId}`;
    let synced = null;
    // STARCI_STATUS_LOG_SYNC=0: read what is stored, sync nothing (a read-only capture: ui/contract-capture.mjs).
    if (process.env.STARCI_STATUS_LOG_SYNC !== '0' && now - (lastSync.get(key) ?? 0) >= SYNC_EVERY_MS) {
      lastSync.set(key, now);
      try { const r = syncLogs(logs, ledger, { repo: project.repo, workflowId: query.workflowId }); synced = { derived: r.derived.inserted, sidecar: r.sidecars.inserted, ...(r.deferred ? { deferred: r.deferred } : {}) }; }
      catch (error) { synced = { error: String(error?.message ?? error).slice(0, 200) }; }
    }
    return { projectId: project.id, workflowId: query.workflowId, ...readLogs(logs, query), synced };
  } finally { try { logs?.close(); } catch { /* closing */ } ledger.close(); }
}

/** The indexed patch of `jobId` (job_artifacts kind patch), as {abs, row} or null. */
function patchOf(project, jobId) {
  const db = ledgerOf(project);
  try {
    const has = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='job_artifacts'").get();
    if (!has) return null;
    const row = db.prepare("SELECT path, head_sha, landed_sha, base_sha, label, workflow_id FROM job_artifacts WHERE job_id=? AND kind='patch' ORDER BY created_at DESC LIMIT 1").get(jobId);
    if (!row) return null;
    const abs = path.resolve(project.repo, row.path);
    const work = path.resolve(project.repo, '.starciwork');
    if (!abs.toLowerCase().startsWith(`${work.toLowerCase()}${path.sep}`)) return null;
    // A job that landed after its patch was cut: the landed head its settle recorded.
    let landedLater = null;
    try { const landed = JSON.parse(db.prepare('SELECT result_json FROM jobs WHERE job_id=?').get(jobId)?.result_json ?? 'null')?.landed; landedLater = typeof landed === 'string' ? landed : landed?.head ?? null; } catch { landedLater = null; }
    return { abs, row, landedLater: /^[0-9a-f]{7,40}$/.test(landedLater ?? '') ? landedLater : null };
  } finally { db.close(); }
}

/** A job's diff document: the stored <patch>.json, else the patch parsed in memory. Null when the job has no patch. */
export function readJobDiff(project, jobId) {
  if (!JOB.test(jobId ?? '')) throw new Error('Tham số job không hợp lệ');
  const patch = patchOf(project, jobId);
  if (!patch || !fs.existsSync(patch.abs)) return null;
  const jsonFile = patchJsonFileOf(patch.abs);
  let doc;
  if (fs.existsSync(jsonFile)) doc = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  else {
    const st = fs.statSync(patch.abs);
    const parser = patchParser();
    if (st.size > 64 * 1024 * 1024) return { projectId: project.id, jobId, stored: false, tooLarge: true, bytes: st.size, files: [], commits: [], totals: { files: 0, added: 0, removed: 0 } };
    for (const l of fs.readFileSync(patch.abs, 'utf8').split('\n')) parser.line(l);
    doc = { base: patch.row.base_sha, head: patch.row.head_sha, landed: patch.row.landed_sha, unlanded: patch.row.label !== 'landed', ...parser.finish() };
  }
  return { projectId: project.id, jobId, stored: fs.existsSync(jsonFile), patchPath: path.relative(project.repo, patch.abs).replaceAll('\\', '/'), ...doc, landedLater: doc.landed ? null : patch.landedLater };
}

/**
 * One image side of a job's diff ({body, mime}) or null: the blob must be a before/after blob of an image file in
 * that job's diff. The decoded literal in <patch>.assets comes first, else `git cat-file` in the project repo.
 */
export async function readDiffAsset(project, jobId, blob, { filePath = null } = {}) {
  if (!JOB.test(jobId ?? '') || (!BLOB.test(blob ?? '') && !filePath)) return null;
  const diff = readJobDiff(project, jobId);
  // By path (a log row's render ref): the image's after side, matched on its repo-relative path.
  const wanted = filePath ? String(filePath).replaceAll('\\', '/').toLowerCase() : null;
  const byPath = wanted ? diff?.files?.find((f) => f.image && f.after && (f.path.toLowerCase() === wanted || wanted.endsWith(`/${f.path.toLowerCase()}`))) : null;
  if (byPath) blob = byPath.after.blob;
  const file = byPath ?? diff?.files?.find((f) => f.image && (f.before?.blob === blob || f.after?.blob === blob));
  if (!file) return null;
  const side = file.after?.blob === blob ? file.after : file.before;
  const mime = IMAGE_MIME[path.extname(file.path).toLowerCase()] ?? 'application/octet-stream';
  const patch = patchOf(project, jobId);
  if (side.asset && patch) {
    const abs = path.resolve(path.dirname(patch.abs), side.asset);
    if (abs.startsWith(patchAssetsDirOf(patch.abs)) && fs.existsSync(abs)) return { body: fs.readFileSync(abs), mime };
  }
  let roots = [project.repo];
  try { roots = [...new Set([project.repo, ...(projectBinding(project.repo)?.repos ?? []).map((r) => r.root)])]; } catch { /* the repo alone */ }
  for (const root of roots) {
    try {
      const { stdout } = await run('git', ['-C', root, 'cat-file', 'blob', blob], { encoding: 'buffer', maxBuffer: 25 * 1024 * 1024, windowsHide: true, timeout: 10_000 });
      return { body: stdout, mime };
    } catch { /* not in this checkout */ }
  }
  return null;
}
