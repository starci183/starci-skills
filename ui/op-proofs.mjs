// op-proofs.mjs — what one op's jobs produced, read-only: the report each job filed (reports table), the commit it
// landed (jobs.result_json landed.head / report.head) and the files its report names. A file is served only when it
// sits inside the repo's .starciwork and a job's report names it (or a folder holding it), so every artefact links to
// exactly the jobs asked for.
import { createHash } from 'node:crypto';
import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite'; // eslint-disable-line no-unused-vars
import { openLedgerReader } from '../engine/ledger-db.mjs';
import { shapeOfDrawing } from './evidence-gallery.mjs';
import { listJobArtifacts } from '../scripts/kernel/job-artifacts.mjs';

const IMAGE = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' };
const VIDEO = { '.webm': 'video/webm', '.mp4': 'video/mp4' };
const TEXT = { '.patch': 'text/plain; charset=utf-8', '.diff': 'text/plain; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.yaml': 'text/plain; charset=utf-8', '.yml': 'text/plain; charset=utf-8', '.log': 'text/plain; charset=utf-8', '.code': 'text/plain; charset=utf-8' };
const MAX_FILES = 160;
const MAX_JOBS = 16;
const parse = (value, fallback = {}) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const list = (value) => (Array.isArray(value) ? value : []);
const inside = (root, target) => {
  const base = path.resolve(root).toLowerCase();
  const value = path.resolve(target).toLowerCase();
  return value.startsWith(`${base}${path.sep}`);
};
const kindOf = (name) => {
  const ext = path.extname(name).toLowerCase();
  if (IMAGE[ext]) return 'image';
  if (VIDEO[ext]) return 'video';
  if (ext === '.patch' || ext === '.diff') return 'patch';
  return TEXT[ext] ? 'file' : null;
};
const mimeOf = (name) => { const ext = path.extname(name).toLowerCase(); return IMAGE[ext] || VIDEO[ext] || TEXT[ext] || 'application/octet-stream'; };
const fileId = (projectId, jobId, relative) => createHash('sha256').update(`${projectId}:${jobId}:${relative}`).digest('hex').slice(0, 24);
const JOB_ID = /^op-[a-z0-9._-]{1,120}$/i;
// Report fields the panel prints as text. rootCause is an object in starci/op-report@1 ({node, category, claim, ...});
// rendering the object crashed the whole panel (React #31), so it is flattened here.
const textOf = (value) => (value == null ? null : typeof value === 'string' ? value : JSON.stringify(value));
const rootCauseText = (value) => {
  if (value == null || typeof value === 'string') return value ?? null;
  if (typeof value !== 'object') return String(value);
  const head = [value.node, value.category].filter((v) => typeof v === 'string' && v).join(' · ');
  return [head ? `[${head}]` : null, typeof value.claim === 'string' ? value.claim : null, typeof value.expectedFix === 'string' ? `fix: ${value.expectedFix}` : null].filter(Boolean).join(' ') || JSON.stringify(value);
};

/** A path a report names, as an absolute path inside `<repo>/.starciwork`, or null. */
function underWork(repo, value) {
  if (typeof value !== 'string' || !value || value.includes('\0')) return null;
  const work = path.resolve(repo, '.starciwork');
  const absolute = path.isAbsolute(value) ? path.resolve(value) : path.resolve(repo, value);
  return inside(work, absolute) ? absolute : null;
}

/** Every file (kind known) under the paths a job's report names, capped; symlinks and paths escaping .starciwork are skipped. */
async function filesOf(project, jobId, named) {
  const work = path.resolve(project.repo, '.starciwork');
  const out = new Map();
  let visited = 0;
  const walk = async (absolute, depth) => {
    if (out.size >= MAX_FILES || visited++ > 3000 || depth > 5) return;
    const info = await lstat(absolute).catch(() => null);
    if (!info || info.isSymbolicLink()) return;
    if (info.isDirectory()) {
      for (const entry of await readdir(absolute, { withFileTypes: true }).catch(() => [])) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        await walk(path.join(absolute, entry.name), depth + 1);
      }
      return;
    }
    const kind = kindOf(absolute);
    if (!info.isFile() || !kind || !info.size || info.size > (kind === 'video' ? 300 : 25) * 1024 * 1024) return;
    const real = await realpath(absolute).catch(() => null);
    if (!real || !inside(work, real)) return;
    const relative = path.relative(project.repo, real).replaceAll('\\', '/');
    const shape = kind === 'image' ? await shapeOfDrawing(project.repo, path.relative(work, real)) : null;
    out.set(relative, { id: fileId(project.id, jobId, relative), kind, name: path.basename(real), path: relative, size: info.size, modifiedAt: info.mtimeMs, absolute: real, mime: mimeOf(real), shape });
  };
  for (const value of named) { const absolute = underWork(project.repo, value); if (absolute) await walk(absolute, 0); }
  return [...out.values()];
}

/** One job's proofs from an open read-only ledger. */
async function jobProofs(db, project, row) {
  const payload = parse(row.payload_json);
  const result = parse(row.result_json, null);
  const filed = db.prepare("SELECT payload_json, created_at FROM events WHERE kind='report-filed' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(row.job_id);
  const filedPayload = parse(filed?.payload_json, null);
  const stored = filedPayload?.dispatchId ? db.prepare('SELECT report_json FROM reports WHERE dispatch_id=? ORDER BY created_at DESC LIMIT 1').get(filedPayload.dispatchId) : null;
  const report = parse(stored?.report_json, null);
  const landed = result?.landed ?? null;
  const heads = [];
  const roleOf = (repo) => (String(repo?.role ?? '').toLowerCase() === 'fe' ? 'FE' : 'BE');
  if (/^[a-f0-9]{40}$/.test(landed?.head ?? '')) heads.push({ sha: landed.head, repository: roleOf(list(landed.repos)[0]), source: 'landed' });
  for (const repo of list(landed?.repos)) if (/^[a-f0-9]{40}$/.test(repo?.head ?? '') && !heads.some((h) => h.sha === repo.head)) heads.push({ sha: repo.head, repository: roleOf(repo), source: 'landed' });
  if (/^[a-f0-9]{40}$/.test(report?.head ?? '') && !heads.some((h) => h.sha === report.head)) heads.push({ sha: report.head, repository: 'BE', source: 'report' });
  // The job's indexed artifacts (job_artifacts: settle and the backfill) come first; the report's own names cover a job never indexed.
  const indexed = listJobArtifacts(db, { workflowId: row.workflow_id, jobId: row.job_id }).jobs[0]?.artifacts.map((item) => item.path) ?? [];
  const named = [...indexed, ...list(report?.files), ...list(report?.evidence), filedPayload?.report].filter((value) => typeof value === 'string');
  const files = await filesOf(project, row.job_id, named);
  return {
    jobId: row.job_id, op: row.op_id, status: row.status, attempt: row.attempt, model: payload.model ?? null, createdAt: row.created_at, updatedAt: row.updated_at,
    cut: payload.cut && typeof payload.cut === 'object' ? { id: String(payload.cut.id ?? ''), ordinal: Number(payload.cut.ordinal) || null, total: Number(payload.cut.total) || null } : null,
    title: payload.title ?? null,
    verdict: result?.verdict ?? null,
    report: report ? { outcome: report.outcome ?? null, summary: textOf(report.summary), rootCause: rootCauseText(report.rootCause), nextStep: textOf(report.nextStep), checks: list(report.checks).length, filedAt: filed?.created_at ?? null } : null,
    heads,
    files,
  };
}

function openLedger(project) { return openLedgerReader(path.join(project.repo, '.starciwork', 'runtime.sqlite')); }
const jobRows = (db, workflowId, op, jobIds) => {
  const rows = db.prepare("SELECT job_id, workflow_id, op_id, attempt, status, payload_json, result_json, created_at, updated_at FROM jobs WHERE workflow_id=? AND op_id=? AND kind<>'kernel' ORDER BY created_at DESC, job_id DESC").all(workflowId, op);
  return (jobIds?.length ? rows.filter((row) => jobIds.includes(row.job_id)) : rows).slice(0, MAX_JOBS);
};

/** The proofs of `op` in `workflowId`: its most recent jobs (or just `jobIds`), newest first. */
export async function readOpProofs(project, { workflowId, op, jobIds = null }) {
  if (!/^wf-[a-z0-9._-]{1,120}$/i.test(workflowId ?? '') || !/^[a-z][a-z0-9.-]{1,60}$/i.test(op ?? '')) throw new Error('Tham số không hợp lệ');
  const wanted = jobIds ? jobIds.filter((id) => JOB_ID.test(id)).slice(0, MAX_JOBS) : null;
  const db = openLedger(project);
  try {
    const jobs = [];
    for (const row of jobRows(db, workflowId, op, wanted)) {
      const proofs = await jobProofs(db, project, row);
      jobs.push({ ...proofs, files: proofs.files.map(({ absolute, mime, ...file }) => ({ ...file, url: `/api/proofs/${project.id}/${row.job_id}/${file.id}` })) });
    }
    return { projectId: project.id, workflowId, op, jobs };
  } finally { db.close(); }
}

/** The indexed artifacts (job_artifacts) of `workflowId`, or of one job, read-only: what /api/artifacts serves. */
export function readArtifacts(project, { workflowId, jobId = null, kind = null, subkind = null }) {
  if (!/^wf-[a-z0-9._-]{1,120}$/i.test(workflowId ?? '') || (jobId && !JOB_ID.test(jobId))) throw new Error('Tham số không hợp lệ');
  const db = openLedger(project);
  try { return { projectId: project.id, ...listJobArtifacts(db, { workflowId, jobId, kind, subkind }) }; } finally { db.close(); }
}

/** Resolve only a file recorded for this job, beneath its product repo. No caller supplied path is opened. */
export async function findIndexedArtifact(project, jobId, sha256) {
  if (!JOB_ID.test(jobId) || !/^[a-f0-9]{64}$/i.test(sha256 ?? '')) return null;
  const db = openLedger(project);
  let row;
  try { row = db.prepare('SELECT path, mime FROM job_artifacts WHERE job_id=? AND sha256=? LIMIT 1').get(jobId, sha256); }
  finally { db.close(); }
  if (!row) return null;
  const root = path.resolve(project.repo);
  const absolute = path.resolve(root, row.path);
  if (!inside(root, absolute)) return null;
  const real = await realpath(absolute).catch(() => null);
  if (!real || !inside(root, real)) return null;
  const info = await lstat(real).catch(() => null);
  if (!info?.isFile()) return null;
  return { absolute: real, size: info.size, mime: mimeOf(real), name: path.basename(real) };
}

/** The file `id` one job's report names, as {absolute, mime, size}; null when the job or file is unknown. */
export async function findProofFile(project, jobId, id) {
  if (!JOB_ID.test(jobId) || !/^[a-f0-9]{24}$/.test(id)) return null;
  const db = openLedger(project);
  let proofs;
  try {
    const row = db.prepare("SELECT job_id, workflow_id, op_id, attempt, status, payload_json, result_json, created_at, updated_at FROM jobs WHERE job_id=? AND kind<>'kernel'").get(jobId);
    if (!row) return null;
    proofs = await jobProofs(db, project, row);
  } finally { db.close(); }
  const file = proofs.files.find((item) => item.id === id);
  if (!file) return null;
  const info = await lstat(file.absolute).catch(() => null);
  return info?.isFile() ? { absolute: file.absolute, mime: file.mime, size: info.size, name: file.name } : null;
}
