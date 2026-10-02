#!/usr/bin/env node
// purge-workflow.mjs — the ONE sanctioned delete of a finished workflow's record (owner rulings 2026-09-27). Proofs,
// artifacts and logs are never deleted by housekeeping or any other writer; a finished workflow is deleted as a unit,
// only with the owner's approval, and only after its evidence is archived and the archive verified.
//
//   node scripts/work/purge-workflow.mjs --repo <repo> --workflow <id> [--archive-root <dir>] [--json]
//       dry run (the default): what would be archived and deleted, per table, and whether the workflow may be purged
//   node scripts/work/purge-workflow.mjs --repo <repo> --workflow <id> --apply --approved-by <owner> --approval-ref <ask/inbox id or message>
//
// --apply, in order (each step recorded in workflow_purges, engine/db/migrations/runtime/0001-init.sql; a re-run resumes):
//   1. refuse unless the workflow is finished (phase 'finished') or archived (archived_at set) and no job of it is queued/leased/running/answering/
//      effect_unknown;
//   2. ARCHIVE to <archive-root>/<product>/<workflowId>-<YYYYMMDD>.zip (product = the repo's folder name): ledger/<table>.ndjson
//      for every table row of the workflow (events, jobs, reports, checks, incidents, contracts, goals, inbox, job_artifacts,
//      artifact_proofs, logs, work_graph_versions, leases, signals, ...), the workflows row, blobs/<sha256> for every blob an
//      artifact of the workflow indexes (patches, images, videos, traces, reports, draw rounds), and manifest.json (sha256 +
//      bytes of every other entry, the row counts, and the events digest-chain head);
//   3. VERIFY: the ZIP is re-opened from disk, every entry inflated, its CRC and its sha256 checked against the manifest,
//      and the manifest's own sha256 recorded; state 'archived', verified_at set. No delete happens before this;
//   4. DELETE: state 'deleting' (the table CHECK refuses it without the approval and a verified archive; the events and
//      logs delete guards open only now), one DELETE of the workflows row that cascades to every workflow table
//      (engine/db/ledger.mjs deleteWorkflowRows); state 'purged'. The workflow_purges row stays as the tombstone that
//      names the archive (path, sha256, bytes, manifest sha256, events head, counts).
// Blobs are archived but never deleted here: the blob GC (mark and sweep over every ledger) owns their lifetime.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isMain } from '../lib/is-main.mjs';
import { JOB_STATUSES, deleteWorkflowRows, eventsHead, ledgerFileFor, openLedger, recordPurge } from '../../engine/db/ledger.mjs';
import { zipWrite } from '../api/fs/zip-write.mjs';
import { zipRead } from '../api/fs/zip-read.mjs';
import { archiveRoot as archiveRootOf } from '../machine/home.mjs';

const USAGE = 'use: node scripts/work/purge-workflow.mjs --repo <repo> --workflow <id> [--archive-root <dir>] [--apply --approved-by <who> --approval-ref <ref>] [--json]';
export const PURGE_MANIFEST_SCHEMA = 'starci/workflow-archive@1';
const LIVE = new Set([...JOB_STATUSES.dispatchable, ...JOB_STATUSES.fenced]);
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const today = () => new Date().toISOString().slice(0, 10).replace(/-/g, '');
const refuse = (code, message) => Object.assign(new Error(message), { code });

/** Every table of the ledger with a workflow_id column (never workflow_purges, the tombstone). */
export function workflowTables(db) {
  return db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((r) => r.name)
    .filter((t) => t !== 'workflow_purges' && db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'workflow_id'));
}

/** Rows of the workflow per table, for the dry run and the archive. */
function rowCounts(db, workflowId) {
  const counts = {};
  for (const t of workflowTables(db)) counts[t] = Number(db.prepare(`SELECT count(*) n FROM ${t} WHERE workflow_id=?`).get(workflowId).n);
  return counts;
}

/** The blobs the archive carries: every blob an artifact of the workflow indexes. [{rel: blobs/<sha>, abs, bytes}] and the missing ones. */
function evidenceFiles(db, repo, workflowId) {
  const files = [], missing = [];
  for (const r of db.prepare('SELECT DISTINCT b.sha256, b.file_uri FROM job_artifacts x JOIN blobs b ON b.sha256=x.sha256 WHERE x.workflow_id=? ORDER BY b.sha256').all(workflowId)) {
    try { const st = fs.statSync(r.file_uri); if (st.isFile()) files.push({ rel: `blobs/${r.sha256}`, abs: r.file_uri, bytes: st.size }); else missing.push(r.sha256); } catch { missing.push(r.sha256); }
  }
  return { files, missing };
}

function purgeRow(db, workflowId) { return db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get(workflowId) ?? null; }

/** Plan (and with `apply`, run) the purge of one finished workflow. */
export function purgeWorkflow({ repo, workflowId, apply = false, approvedBy = null, approvalRef = null, archiveRoot = archiveRootOf(), date = today(), now = Date.now }) {
  const root = path.resolve(repo);
  const ledger = openLedger({ file: ledgerFileFor(root) });
  try {
    const db = ledger.db;
    const prior = purgeRow(db, workflowId);
    if (prior?.state === 'purged') return { ok: true, repo: root, workflowId, already: true, purge: prior };
    const wf = db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
    if (!wf) throw refuse('workflow-unknown', `unknown workflow ${workflowId}`);
    const liveJobs = db.prepare('SELECT job_id, status FROM jobs WHERE workflow_id=?').all(workflowId).filter((j) => LIVE.has(j.status));
    // An archived workflow (starci kernel archive: owner or supervisor stop) is ended like a finished one (gc.mjs, owner 2026-09-28).
    const blockers = [...(wf.phase !== 'finished' && wf.archived_at == null ? [`phase is ${wf.phase ?? 'unset'}, not finished or archived`] : []), ...(liveJobs.length ? [`${liveJobs.length} job(s) still ${[...new Set(liveJobs.map((j) => j.status))].join('/')}`] : [])];
    const counts = rowCounts(db, workflowId);
    const { files, missing } = evidenceFiles(db, root, workflowId);
    const archive = prior?.archive_path ?? path.join(archiveRoot, path.basename(root), `${workflowId}-${date}.zip`);
    const plan = { ok: blockers.length === 0, repo: root, workflowId, dryRun: !apply, blockers, counts, files: files.length, fileBytes: files.reduce((n, f) => n + f.bytes, 0), missingFiles: missing.slice(0, 50), archive, purge: prior };
    if (!apply) return plan;
    if (blockers.length) throw refuse('purge-refused', `${workflowId} may not be purged: ${blockers.join('; ')}`);
    if (!approvedBy || !approvalRef) throw refuse('purge-approval-missing', 'the purge deletes a workflow record: --approved-by <owner> and --approval-ref <the ask/inbox id or message> are required');

    ledger.transaction(() => recordPurge(db, { workflowId, state: prior?.state ?? 'planned', approvedBy, approvalRef, at: now() }));

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
      for (const f of files) entries.push({ name: `files/${f.rel}`, file: f.abs });
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      const tmp = `${archive}.partial-${process.pid}`;
      // The manifest needs every entry's sha256 first: hash, then write the ZIP with the manifest as its last entry.
      const described = entries.map((e) => { const data = e.data != null ? Buffer.from(e.data) : fs.readFileSync(e.file); return { name: e.name, sha256: sha256(data), bytes: data.length }; });
      const manifest = { schema: PURGE_MANIFEST_SCHEMA, workflowId, repo: root, product: path.basename(root), createdAt: new Date(now()).toISOString(),
        approvedBy, approvalRef, eventsHead: head, counts, entries: described, missingFiles: missing };
      const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2));
      if (fs.existsSync(archive)) fs.renameSync(archive, `${archive}.stale-${Date.now()}`);
      zipWrite(tmp, [...entries, { name: 'manifest.json', data: manifestBuf }]);
      fs.renameSync(tmp, archive);
      // Verify from disk: every entry inflates, its CRC holds and its sha256 is the manifest's.
      const read = zipRead(archive);
      const byName = new Map(read.map((e) => [e.name, e]));
      const onDisk = byName.get('manifest.json');
      if (!onDisk || sha256(onDisk.data) !== sha256(manifestBuf)) throw refuse('archive-verify-failed', `${archive}: manifest.json does not read back`);
      const bad = described.filter((d) => { const e = byName.get(d.name); return !e || !e.crcOk || sha256(e.data) !== d.sha256 || e.data.length !== d.bytes; });
      if (bad.length || read.length !== described.length + 1) throw refuse('archive-verify-failed', `${archive}: ${bad.length} entr(ies) do not match the manifest (${bad.slice(0, 5).map((b) => b.name).join(', ')})`);
      const archiveBuf = fs.readFileSync(archive);
      ledger.transaction(() => recordPurge(db, { workflowId, state: 'archived', archivePath: archive, archiveSha256: sha256(archiveBuf), archiveBytes: archiveBuf.length,
        manifestSha256: sha256(manifestBuf), eventsHead: head, countsJson: JSON.stringify(counts), archivedAt: now(), verifiedAt: now() }));
      row = purgeRow(db, workflowId);
    }

    // 4. Delete: the guard opens for this workflow only while its row says 'deleting'.
    const deleted = ledger.transaction(() => { recordPurge(db, { workflowId, state: 'deleting' }); return deleteWorkflowRows(db, { workflowId }); });
    ledger.transaction(() => recordPurge(db, { workflowId, state: 'purged', purgedAt: now(), countsJson: JSON.stringify({ archived: counts, deleted }) }));
    return { ...plan, ok: true, dryRun: false, deleted, purge: purgeRow(db, workflowId) };
  } finally { ledger.close(); }
}

function main() {
  const argv = process.argv.slice(2), a = {};
  for (let i = 0; i < argv.length; i++) { const k = argv[i]; if (!k.startsWith('--')) continue; const n = k.slice(2); if (['apply', 'json'].includes(n)) a[n] = true; else a[n] = argv[++i]; }
  if (!a.repo || !a.workflow) { console.error(USAGE); process.exit(2); }
  const out = purgeWorkflow({ repo: a.repo, workflowId: a.workflow, apply: Boolean(a.apply), approvedBy: a['approved-by'] ?? null, approvalRef: a['approval-ref'] ?? null, archiveRoot: a['archive-root'] ?? archiveRootOf() });
  if (a.json) console.log(JSON.stringify(out, null, 2));
  else if (out.already) console.log(`${a.workflow}: already purged; archive ${out.purge.archive_path} (sha256 ${out.purge.archive_sha256})`);
  else if (out.dryRun) console.log(`${a.workflow}: dry run - ${out.ok ? 'may be purged' : `REFUSED: ${out.blockers.join('; ')}`}; ${Object.entries(out.counts).filter(([, n]) => n).map(([t, n]) => `${t}:${n}`).join(' ')}; ${out.files} file(s) ${out.fileBytes} bytes -> ${out.archive}`);
  else console.log(`${a.workflow}: purged; archive ${out.purge.archive_path} sha256 ${out.purge.archive_sha256}; deleted ${Object.entries(out.deleted).filter(([, n]) => n).map(([t, n]) => `${t}:${n}`).join(' ')}`);
  if (!out.ok) process.exitCode = 1;
}

if (isMain(import.meta.url)) {
  try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(1); }
}
