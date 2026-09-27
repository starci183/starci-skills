#!/usr/bin/env node
// backfill-patch-json.mjs — write <patch>.json (scripts/kernel/patch-json.mjs writePatchJson) beside every job
// .patch a repository's ledger already indexed, the way artifact indexing now does for each new one. Reads the
// ledger read-only (job_artifacts rows of kind patch, with their base/head/landed shas) and writes only files in
// the job's kernel-evidence directory (<patch>.json, <patch>.assets/): never the ledger. Idempotent: a json already
// on disk is kept. Default is a dry run, which writes nothing.
//
//   node scripts/work/backfill-patch-json.mjs --repo <repo> [--dry-run|--apply] [--workflow <id>] [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasLedgerTable, inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { writePatchJson } from '../kernel/patch-json.mjs';

const USAGE = 'use: node scripts/work/backfill-patch-json.mjs --repo <repo> [--dry-run|--apply] [--workflow <id>] [--json]';

function parseArgs(argv) {
  const a = { apply: false, json: false, repo: null, workflow: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--repo') a.repo = argv[++i];
    else if (k === '--workflow') a.workflow = argv[++i];
    else if (k === '--apply') a.apply = true;
    else if (k === '--dry-run') a.apply = false;
    else if (k === '--json') a.json = true;
    else return null;
  }
  return a.repo ? a : null;
}

/** Every indexed patch of the repository (or one workflow): {written, kept, wouldWrite, missing, errors[]}. */
export function backfillPatchJson({ repo, workflowId = null, dryRun = true }) {
  const ledger = inspectLedger({ file: ledgerFileFor(repo) });
  const out = { repo, dryRun, patches: 0, written: 0, kept: 0, wouldWrite: 0, missing: 0, truncated: 0, assets: 0, errors: [] };
  try {
    if (!hasLedgerTable(ledger.db, 'job_artifacts')) return out;
    const rows = ledger.db.prepare(`SELECT job_id, workflow_id, path, head_sha, landed_sha, base_sha, label FROM job_artifacts WHERE kind='patch'${workflowId ? ' AND workflow_id=?' : ''} ORDER BY created_at`)
      .all(...(workflowId ? [workflowId] : []));
    for (const row of rows) {
      out.patches += 1;
      const file = path.join(repo, row.path);
      if (!fs.existsSync(file)) { out.missing += 1; continue; }
      try {
        const r = writePatchJson(file, { base: row.base_sha, head: row.head_sha, landed: row.landed_sha, state: row.label }, { dryRun });
        if (r.kept) out.kept += 1;
        else if (r.wouldWrite) out.wouldWrite += 1;
        else if (r.written) { out.written += 1; if (r.truncated) out.truncated += 1; out.assets += r.assets ?? 0; }
        else if (r.error) out.errors.push({ jobId: row.job_id, error: r.error });
      } catch (error) { out.errors.push({ jobId: row.job_id, error: String(error?.message ?? error) }); }
    }
    return out;
  } finally { ledger.close(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args) { console.error(USAGE); process.exit(2); }
  const out = backfillPatchJson({ repo: path.resolve(args.repo), workflowId: args.workflow, dryRun: !args.apply });
  if (args.json) console.log(JSON.stringify(out, null, 2));
  else console.log(`${out.dryRun ? 'dry run: ' : ''}${out.patches} patch(es): ${out.dryRun ? `${out.wouldWrite} would be written` : `${out.written} written (${out.truncated} truncated, ${out.assets} image asset(s))`}, ${out.kept} kept, ${out.missing} missing, ${out.errors.length} error(s)`);
  if (out.errors.length) process.exitCode = 1;
}
