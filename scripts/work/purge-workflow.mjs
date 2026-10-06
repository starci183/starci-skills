#!/usr/bin/env node
// purge-workflow.mjs — the ONE sanctioned delete of a finished workflow's record (owner rulings 2026-09-27). Proofs,
// artifacts and logs are never deleted by housekeeping or any other writer; a finished workflow is deleted as a unit,
// only with the owner's approval, and only after its evidence is archived and the archive verified.
//
// Internal entry: spawned by scripts/housekeeping/hk-ledger.mjs; not invoked directly.
// Args: --repo <repo> --workflow <id> [--archive-root <dir>] [--json]
//       dry run (the default): what would be archived and deleted, per table, and whether the workflow may be purged
//       --repo <repo> --workflow <id> --apply --approved-by <owner> --approval-ref <ask/inbox id or message>
//
// --apply, in order (each step recorded in workflow_purges, engine/db/schema/runtime.sql; a re-run resumes):
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
//      (engine/db/ledger.mjs deleteWorkflowRows); state 'purged'. The workflow_purges row stays as the record that
//      names the archive (path, sha256, bytes, manifest sha256, events head, counts).
// Blobs are archived but never deleted here: the blob GC (mark and sweep over every ledger) owns their lifetime.
import fs from 'node:fs';
import path from 'node:path';
import {sha256,sha256File} from '../../engine/digest.mjs';
import { isMain } from '../lib/is-main.mjs';
import { JOB_STATUSES, deleteWorkflowRows, eventsHead, ledgerFileFor, openLedger, recordPurge } from '../../engine/db/ledger.mjs';
import { zipWrite } from '../api/fs/zip-write.mjs';
import { zipVisit } from '../api/fs/zip-visit.mjs';
import { zipLimits } from '../api/fs/zip-limits.mjs';
import { archiveRoot as archiveRootOf } from '../machine/home.mjs';

const USAGE = 'Internal entry: spawned by scripts/housekeeping/hk-ledger.mjs; not invoked directly.\nargs: --repo <repo> --workflow <id> [--archive-root <dir>] [--apply --approved-by <who> --approval-ref <ref>] [--json]';
const PURGE_MANIFEST_SCHEMA = 'starci/workflow-archive@1';
const ZIP_RESOURCE_LIMITS = Object.freeze(zipLimits());
const LIVE = new Set([...JOB_STATUSES.dispatchable, ...JOB_STATUSES.fenced]);
const today = () => new Date().toISOString().slice(0, 10).replaceAll('-', '');
const refuse = (code, message) => Object.assign(new Error(message), { code });

/** Every table of the ledger with a workflow_id column (never workflow_purges, the purge record). */
function workflowTables(db) {
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

/** Exact row bytes used for both publication and the final writer-locked comparison. */
function workflowEntries(db, workflowId) {
  const entries=[];let total=0;
  for(const table of ['workflows',...workflowTables(db).filter(t=>t!=='workflows')]){
    const lines=[];let bytes=0;
    for(const row of db.prepare(`SELECT * FROM ${table} WHERE workflow_id=? ORDER BY rowid`).iterate(workflowId)){
      const line=JSON.stringify(row,(key,value)=>value instanceof Uint8Array?{base64:Buffer.from(value).toString('base64')}:value)+'\n';bytes+=Buffer.byteLength(line);
      if(bytes>ZIP_RESOURCE_LIMITS.maxEntryBytes)throw refuse('zip-limit',`ledger/${table}.ndjson exceeds the supported archive entry budget; workflow rows remain`);
      lines.push(line);
    }
    if((total+=bytes)>ZIP_RESOURCE_LIMITS.maxTotalBytes)throw refuse('zip-limit','workflow row archive exceeds supported total byte budget; rows remain');
    entries.push({name:`ledger/${table}.ndjson`,data:lines.join('')});
  }
  return entries;
}

/** A verified archive is reusable only while its entire workflow projection is still current. */
function assertCurrentArchive(db, root, workflowId) {
  const wf=db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
  const live=db.prepare('SELECT status FROM jobs WHERE workflow_id=?').all(workflowId).filter(job=>LIVE.has(job.status));
  if(!wf||(wf.phase!=='finished'&&wf.archived_at==null)||live.length)throw refuse('purge-refused',`${workflowId} is no longer ended and quiescent; workflow rows remain`);
  const row=purgeRow(db,workflowId);let manifest=null;
  const checked=zipVisit(row.archive_path,entry=>{if(entry.name==='manifest.json')manifest=JSON.parse(entry.data.toString('utf8'));});
  const manifestEntry=checked.entries.find(entry=>entry.name==='manifest.json');
  if(!row.verified_at||checked.sha256!==row.archive_sha256||checked.bytes!==row.archive_bytes||!checked.entries.every(entry=>entry.crcOk)||manifestEntry?.sha256!==row.manifest_sha256||manifest?.schema!==PURGE_MANIFEST_SCHEMA||manifest.workflowId!==workflowId||manifest.repo!==root||!Array.isArray(manifest.entries))
    throw refuse('archive-verify-failed',`${row.archive_path}: verified archive identity does not read back; workflow rows remain`);
  const archived=new Map(manifest.entries.map(entry=>[entry.name,entry]));
  const current=workflowEntries(db,workflowId).map(entry=>({name:entry.name,sha256:sha256(entry.data),bytes:Buffer.byteLength(entry.data)}));
  const evidence=evidenceFiles(db,root,workflowId);
  for(const file of evidence.files)current.push({name:`files/${file.rel}`,sha256:sha256File(file.abs),bytes:file.bytes});
  const counts=rowCounts(db,workflowId),head=eventsHead(db,workflowId);
  if(manifest.eventsHead!==head||manifest.eventsHead!==row.events_head||JSON.stringify(manifest.counts)!==JSON.stringify(counts)||JSON.stringify(manifest.counts)!==row.counts_json||JSON.stringify(manifest.missingFiles)!==JSON.stringify(evidence.missing)||archived.size!==manifest.entries.length||current.length!==archived.size||current.some(entry=>{const saved=archived.get(entry.name),actual=checked.entries.find(item=>item.name===entry.name);return !saved||!actual||saved.sha256!==actual.sha256||saved.bytes!==actual.bytes||entry.sha256!==saved.sha256||entry.bytes!==saved.bytes;})||checked.entries.length!==archived.size+1)
    throw refuse('archive-verify-failed',`${workflowId}: workflow changed after archive verification; current rows and archive are retained`);
}


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
    let stillGood=false;
    if(row.verified_at&&fs.existsSync(row.archive_path))try{const checked=zipVisit(row.archive_path,()=>{});stillGood=checked.sha256===row.archive_sha256&&checked.entries.every(e=>e.crcOk)&&checked.entries.find(e=>e.name==='manifest.json')?.sha256===row.manifest_sha256;}catch{/* retain rows; rebuild through the normal verified path */}
    if (!stillGood) {
      const head = eventsHead(db, workflowId);
      const entries = workflowEntries(db,workflowId);
      for (const f of files) entries.push({ name: `files/${f.rel}`, file: f.abs });
      fs.mkdirSync(path.dirname(archive), { recursive: true });
      const tmp = `${archive}.partial-${process.pid}`;
      // The manifest needs every entry's sha256 first: hash, then write the ZIP with the manifest as its last entry.
      let total=0;if(entries.length+1>ZIP_RESOURCE_LIMITS.maxEntries)throw refuse('zip-limit','workflow archive has too many entries; workflow rows remain');
      const described = entries.map(e=>{const bytes=e.data!=null?Buffer.byteLength(e.data):fs.statSync(e.file).size;if(bytes>ZIP_RESOURCE_LIMITS.maxEntryBytes||(total+=bytes)>ZIP_RESOURCE_LIMITS.maxTotalBytes)throw refuse('zip-limit','workflow archive exceeds the supported byte budget; workflow rows remain');return {name:e.name,sha256:e.data!=null?sha256(e.data):sha256File(e.file),bytes};});
      const manifest = { schema: PURGE_MANIFEST_SCHEMA, workflowId, repo: root, product: path.basename(root), createdAt: new Date(now()).toISOString(),
        approvedBy, approvalRef, eventsHead: head, counts, entries: described, missingFiles: missing };
      const manifestBuf = Buffer.from(JSON.stringify(manifest, null, 2));
      if (fs.existsSync(archive)) fs.renameSync(archive, `${archive}.stale-${Date.now()}`);
      zipWrite(tmp, [...entries, { name: 'manifest.json', data: manifestBuf }]);
      fs.renameSync(tmp, archive);
      // Verify from disk: every entry inflates, its CRC holds and its sha256 is the manifest's.
      const checked = zipVisit(archive,()=>{});
      const byName = new Map(checked.entries.map((e) => [e.name, e]));
      const onDisk = byName.get('manifest.json');
      if (!onDisk || !onDisk.crcOk || onDisk.sha256 !== sha256(manifestBuf)) throw refuse('archive-verify-failed', `${archive}: manifest.json does not read back`);
      const bad = described.filter((d) => { const e = byName.get(d.name); return !e || !e.crcOk || e.sha256 !== d.sha256 || e.bytes !== d.bytes; });
      if (bad.length || checked.entries.length !== described.length + 1) throw refuse('archive-verify-failed', `${archive}: ${bad.length} entr(ies) do not match the manifest (${bad.slice(0, 5).map((b) => b.name).join(', ')})`);
      ledger.transaction(() => recordPurge(db, { workflowId, state: 'archived', archivePath: archive, archiveSha256: checked.sha256, archiveBytes: checked.bytes,
        manifestSha256: sha256(manifestBuf), eventsHead: head, countsJson: JSON.stringify(counts), archivedAt: now(), verifiedAt: now() }));
    }

    // 4. Delete: the guard opens for this workflow only while its row says 'deleting'.
    const deleted = ledger.transaction(() => { assertCurrentArchive(db,root,workflowId); recordPurge(db, { workflowId, state: 'deleting' }); return deleteWorkflowRows(db, { workflowId }); });
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
