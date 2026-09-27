#!/usr/bin/env node
// purge-workflow.mjs — the ONE sanctioned delete of a finished workflow's record (owner rulings 2026-09-27). Proofs,
// artifacts and logs are never deleted by housekeeping or any other writer; a finished workflow is deleted as a unit,
// only with the owner's approval, and only after its evidence is archived and the archive verified.
//
//   node scripts/work/purge-workflow.mjs --repo <repo> --workflow <id> [--archive-root D:/starci-archive] [--json]
//       dry run (the default): what would be archived and deleted, per table, and whether the workflow may be purged
//   node scripts/work/purge-workflow.mjs --repo <repo> --workflow <id> --apply --approved-by <owner> --approval-ref <ask/inbox id or message>
//
// --apply, in order (each step recorded in workflow_purges, engine/schema.sql; a re-run resumes):
//   1. refuse unless the workflow is finished (phase 'finished') and no job of it is queued/leased/running/answering/
//      effect_unknown;
//   2. ARCHIVE to <archive-root>/<product>/<workflowId>-<YYYYMMDD>.zip (product = the repo's folder name): ledger/<table>.ndjson
//      for every table row of the workflow (events, jobs, reports, checks, incidents, contracts, goals, inbox, job_artifacts,
//      artifact_proofs, logs, work_graph_versions, leases, signals, ...), the workflows row, files/<path> for every indexed
//      artifact file (job_artifacts: patches, images, videos, traces, reports, draw rounds) and every file under
//      .starciwork/kernel-evidence/<workflowId>/, and manifest.json (sha256 + bytes of every other entry, the row counts,
//      and the events digest-chain head);
//   3. VERIFY: the ZIP is re-opened from disk, every entry inflated, its CRC and its sha256 checked against the manifest,
//      and the manifest's own sha256 recorded; state 'archived', verified_at set. No delete happens before this;
//   4. DELETE: state 'deleting' (the table CHECK refuses it without the approval and a verified archive; the logs delete
//      guard opens only now), the workflow's rows deleted table by table in short batches, the workflows row last, then
//      the workflow's own kernel-evidence directory; state 'purged'. The workflow_purges row stays as the tombstone that
//      names the archive (path, sha256, bytes, manifest sha256, events head, counts).
// Indexed files outside the workflow's kernel-evidence directory (Work records under .starciwork/features, product repo
// files) are archived but never deleted here: other workflows and the product may still read them.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JOB_STATUSES, eventsHead, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';
import { readZip, writeZip } from '../lib/zip-archive.mjs';

const USAGE = 'use: node scripts/work/purge-workflow.mjs --repo <repo> --workflow <id> [--archive-root <dir>] [--apply --approved-by <who> --approval-ref <ref>] [--json]';
export const DEFAULT_ARCHIVE_ROOT = 'D:/starci-archive';
export const PURGE_MANIFEST_SCHEMA = 'starci/workflow-archive@1';
const LIVE = new Set([...JOB_STATUSES.dispatchable, ...JOB_STATUSES.fenced]);
const DELETE_BATCH = 2000;
// Deleted after every other table of the workflow (jobs are referenced by leases; workflows by everything).
const LAST = ['jobs', 'workflows'];
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const slash = (p) => p.replace(/\\/g, '/');
const refuse = (code, message) => Object.assign(new Error(message), { code });

/** Every table of the ledger with a workflow_id column (never workflow_purges, the tombstone). */
export function workflowTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name)
    .filter((t) => t !== 'workflow_purges' && db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'workflow_id'));
}

/** Rows of the workflow per table (signals by scope), for the dry run and the archive. */
function rowCounts(db, workflowId) {
  const counts = {};
  for (const t of workflowTables(db)) counts[t] = Number(db.prepare(`SELECT count(*) n FROM ${t} WHERE workflow_id=?`).get(workflowId).n);
  counts.signals = Number(db.prepare('SELECT count(*) n FROM signals WHERE scope=? OR key=?').get(workflowId, workflowId).n);
  return counts;
}

/** The files the archive carries: indexed artifacts + the workflow's kernel-evidence tree. [{rel, abs, bytes}] and the missing ones. */
function evidenceFiles(db, repo, workflowId) {
  const seen = new Map(), missing = [];
  const add = (rel) => {
    const abs = path.resolve(repo, rel);
    const key = slash(path.relative(repo, abs));
    if (key.startsWith('..') || seen.has(key)) return;
    try { const st = fs.statSync(abs); if (st.isFile()) seen.set(key, { rel: key, abs, bytes: st.size }); } catch { missing.push(key); }
  };
  for (const r of db.prepare('SELECT DISTINCT path FROM job_artifacts WHERE workflow_id=? ORDER BY path').all(workflowId)) add(r.path);
  const evidenceDir = path.join(repo, '.starciwork', 'kernel-evidence', workflowId);
  const walk = (dir) => { let list = []; try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } for (const e of list) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else if (e.isFile()) add(path.relative(repo, p)); } };
  walk(evidenceDir);
  return { files: [...seen.values()].sort((a, b) => a.rel.localeCompare(b.rel)), missing, evidenceDir };
}

function purgeRow(db, workflowId) { return db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get(workflowId) ?? null; }

/** Plan (and with `apply`, run) the purge of one finished workflow. */
export function purgeWorkflow({ repo, workflowId, apply = false, approvedBy = null, approvalRef = null, archiveRoot = DEFAULT_ARCHIVE_ROOT, date = today(), now = Date.now }) {
  const root = path.resolve(repo);
  const ledger = openLedger({ file: ledgerFileFor(root) });
  try {
    const db = ledger.db;
    const prior = purgeRow(db, workflowId);
    if (prior?.state === 'purged') return { ok: true, repo: root, workflowId, already: true, purge: prior };
    const wf = db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
    if (!wf) throw refuse('workflow-unknown', `unknown workflow ${workflowId}`);
    const liveJobs = db.prepare('SELECT job_id, status FROM jobs WHERE workflow_id=?').all(workflowId).filter((j) => LIVE.has(j.status));
    const blockers = [...(wf.phase !== 'finished' ? [`phase is ${wf.phase ?? 'unset'}, not finished`] : []), ...(liveJobs.length ? [`${liveJobs.length} job(s) still ${[...new Set(liveJobs.map((j) => j.status))].join('/')}`] : [])];
    const counts = rowCounts(db, workflowId);
    const { files, missing, evidenceDir } = evidenceFiles(db, root, workflowId);
    const archive = prior?.archive_path ?? path.join(archiveRoot, path.basename(root), `${workflowId}-${date}.zip`);
    const plan = { ok: blockers.length === 0, repo: root, workflowId, dryRun: !apply, blockers, counts, files: files.length, fileBytes: files.reduce((n, f) => n + f.bytes, 0), missingFiles: missing.slice(0, 50), archive, purge: prior };
    if (!apply) return plan;
    if (blockers.length) throw refuse('purge-refused', `${workflowId} may not be purged: ${blockers.join('; ')}`);
    if (!approvedBy || !approvalRef) throw refuse('purge-approval-missing', 'the purge deletes a workflow record: --approved-by <owner> and --approval-ref <the ask/inbox id or message> are required');

    ledger.transaction(() => db.prepare('INSERT INTO workflow_purges(workflow_id,state,approved_by,approval_ref,created_at) VALUES(?,?,?,?,?) ON CONFLICT(workflow_id) DO UPDATE SET approved_by=excluded.approved_by,approval_ref=excluded.approval_ref')
      .run(workflowId, 'planned', approvedBy, approvalRef, now()));

    // 2-3. Archive and verify (skipped only when an earlier run already verified this archive and it still matches).
    let row = purgeRow(db, workflowId);
    const stillGood = row.verified_at && fs.existsSync(row.archive_path) && sha256(fs.readFileSync(row.archive_path)) === row.archive_sha256;
    if (!stillGood) {
      const head = eventsHead(db, workflowId);
      const entries = [{ name: 'ledger/workflows.ndjson', data: `${JSON.stringify(wf)}\n` }];
      for (const t of workflowTables(db).filter((t) => t !== 'workflows')) {
        const rows = db.prepare(`SELECT * FROM ${t} WHERE workflow_id=?`).all(workflowId);
        entries.push({ name: `ledger/${t}.ndjson`, data: rows.map((r) => JSON.stringify(r, (k, v) => (v instanceof Uint8Array ? { base64: Buffer.from(v).toString('base64') } : v))).join('\n') + (rows.length ? '\n' : '') });
      }
      entries.push({ name: 'ledger/signals.ndjson', data: db.prepare('SELECT * FROM signals WHERE scope=? OR key=?').all(workflowId, workflowId).map((r) => JSON.stringify(r)).join('\n') });
      for (const f of files) entries.push({ name: `files/${f.rel}`, file: f.abs });
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      const tmp = `${archive}.partial-${process.pid}`;
      // The manifest needs every entry's sha256 first: hash, then write the ZIP with the manifest as its last entry.
      const described = entries.map((e) => { const data = e.data != null ? Buffer.from(e.data) : fs.readFileSync(e.file); return { name: e.name, sha256: sha256(data), bytes: data.length }; });
      const manifest = { schema: PURGE_MANIFEST_SCHEMA, workflowId, repo: root, product: path.basename(root), createdAt: new Date(now()).toISOString(),
        approvedBy, approvalRef, eventsHead: head, counts, entries: described, missingFiles: missing };
      const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2));
      if (fs.existsSync(archive)) fs.renameSync(archive, `${archive}.stale-${Date.now()}`);
      writeZip(tmp, [...entries, { name: 'manifest.json', data: manifestBuf }]);
      fs.renameSync(tmp, archive);
      // Verify from disk: every entry inflates, its CRC holds and its sha256 is the manifest's.
      const read = readZip(archive);
      const byName = new Map(read.map((e) => [e.name, e]));
      const onDisk = byName.get('manifest.json');
      if (!onDisk || sha256(onDisk.data) !== sha256(manifestBuf)) throw refuse('archive-verify-failed', `${archive}: manifest.json does not read back`);
      const bad = described.filter((d) => { const e = byName.get(d.name); return !e || !e.crcOk || sha256(e.data) !== d.sha256 || e.data.length !== d.bytes; });
      if (bad.length || read.length !== described.length + 1) throw refuse('archive-verify-failed', `${archive}: ${bad.length} entr(ies) do not match the manifest (${bad.slice(0, 5).map((b) => b.name).join(', ')})`);
      const archiveBuf = fs.readFileSync(archive);
      ledger.transaction(() => db.prepare(`UPDATE workflow_purges SET state='archived',archive_path=?,archive_sha256=?,archive_bytes=?,manifest_sha256=?,events_head=?,counts_json=?,archived_at=?,verified_at=? WHERE workflow_id=?`)
        .run(archive, sha256(archiveBuf), archiveBuf.length, sha256(manifestBuf), head, JSON.stringify(counts), now(), now(), workflowId));
      row = purgeRow(db, workflowId);
    }

    // 4. Delete: the guard opens for this workflow only while its row says 'deleting'.
    ledger.transaction(() => db.prepare("UPDATE workflow_purges SET state='deleting' WHERE workflow_id=?").run(workflowId));
    const deleted = {};
    const tables = workflowTables(db);
    for (const t of [...tables.filter((t) => !LAST.includes(t)), ...LAST.filter((t) => tables.includes(t))]) {
      deleted[t] = 0;
      for (;;) {
        const n = ledger.transaction(() => db.prepare(`DELETE FROM ${t} WHERE rowid IN (SELECT rowid FROM ${t} WHERE workflow_id=? LIMIT ${DELETE_BATCH})`).run(workflowId).changes);
        deleted[t] += n;
        if (n < DELETE_BATCH) break;
      }
    }
    deleted.signals = ledger.transaction(() => db.prepare('DELETE FROM signals WHERE scope=? OR key=?').run(workflowId, workflowId).changes);
    let evidenceRemoved = false;
    if (fs.existsSync(evidenceDir)) { fs.rmSync(evidenceDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); evidenceRemoved = !fs.existsSync(evidenceDir); }
    ledger.transaction(() => db.prepare("UPDATE workflow_purges SET state='purged',purged_at=?,counts_json=? WHERE workflow_id=?").run(now(), JSON.stringify({ archived: counts, deleted }), workflowId));
    return { ...plan, ok: true, dryRun: false, deleted, evidenceRemoved, purge: purgeRow(db, workflowId) };
  } finally { ledger.close(); }
}

function main() {
  const argv = process.argv.slice(2), a = {};
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const n = k.slice(2); if (['apply', 'json'].includes(n)) a[n] = true; else a[n] = argv[++i]; }
  if (!a.repo || !a.workflow) { console.error(USAGE); process.exit(2); }
  const out = purgeWorkflow({ repo: a.repo, workflowId: a.workflow, apply: Boolean(a.apply), approvedBy: a['approved-by'] ?? null, approvalRef: a['approval-ref'] ?? null, archiveRoot: a['archive-root'] ?? DEFAULT_ARCHIVE_ROOT });
  if (a.json) console.log(JSON.stringify(out, null, 2));
  else if (out.already) console.log(`${a.workflow}: already purged; archive ${out.purge.archive_path} (sha256 ${out.purge.archive_sha256})`);
  else if (out.dryRun) console.log(`${a.workflow}: dry run - ${out.ok ? 'may be purged' : `REFUSED: ${out.blockers.join('; ')}`}; ${Object.entries(out.counts).filter(([, n]) => n).map(([t, n]) => `${t}:${n}`).join(' ')}; ${out.files} file(s) ${out.fileBytes} bytes -> ${out.archive}`);
  else console.log(`${a.workflow}: purged; archive ${out.purge.archive_path} sha256 ${out.purge.archive_sha256}; deleted ${Object.entries(out.deleted).filter(([, n]) => n).map(([t, n]) => `${t}:${n}`).join(' ')}`);
  if (!out.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(1); }
}
