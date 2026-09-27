#!/usr/bin/env node
// backfill-artifact-subkind.mjs — derive job_artifacts.subkind (what produced each indexed file: draw-render,
// asset-gen, app-capture, uat-video, playwright-trace, critique, ...) for rows indexed before the column existed,
// with the same rule settle now applies to each new row (scripts/kernel/artifact-subkind.mjs subkindOf). Every
// workflow is covered - running, finished and archived. Default is --dry-run, which opens the ledger read-only and
// writes nothing; --apply opens it read-write (migrateLedger adds the column) and updates only rows whose derived
// subkind differs from the stored one. A row whose rule proves nothing keeps what it has (null stays null, a stored
// value is never cleared), so a second --apply changes nothing.
//
//   node scripts/work/backfill-artifact-subkind.mjs --repo <repo> [--dry-run|--apply] [--workflow <id>] [--json]
//
// The receipt counts rows by kind and subkind after the run (dry run: as they would be), how many change, and
// samples the rows no rule proves (unknown) per kind so a missing convention is visible.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasLedgerColumn, hasLedgerTable, inspectLedger, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';
import { clearManifestCache, subkindOf } from '../kernel/artifact-subkind.mjs';

const USAGE = 'use: node scripts/work/backfill-artifact-subkind.mjs --repo <repo> [--dry-run|--apply] [--workflow <id>] [--json]';

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

/** Backfill one repository; `apply` false reports without writing. */
export function backfillArtifactSubkind({ repo, apply = false, workflow = null }) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) throw Object.assign(Error(`no ledger at ${file}`), { code: 'ledger-missing' });
  const ledger = apply ? openLedger({ file }) : inspectLedger({ file });
  clearManifestCache();
  const counts = { rows: 0, changed: 0, unchanged: 0, derived: 0, unknown: 0 };
  const byKindSubkind = {}, unknownSamples = {};
  try {
    const db = ledger.db;
    if (!hasLedgerTable(db, 'job_artifacts')) return { ok: true, repo, ledger: file, mode: apply ? 'apply' : 'dry-run', counts, byKindSubkind, unknownSamples, note: 'ledger has no job_artifacts table' };
    const hasColumn = hasLedgerColumn(db, 'job_artifacts', 'subkind');
    const rows = db.prepare(`SELECT workflow_id, job_id, op_id, kind, path, origin${hasColumn ? ', subkind' : ''} FROM job_artifacts${workflow ? ' WHERE workflow_id=?' : ''} ORDER BY workflow_id, job_id, path`)
      .all(...(workflow ? [workflow] : []));
    const updates = [];
    for (const row of rows) {
      counts.rows += 1;
      const stored = hasColumn ? (row.subkind ?? null) : null;
      const derived = subkindOf({ kind: row.kind, path: row.path, opId: row.op_id, origin: row.origin, repo });
      const next = derived ?? stored;
      if (derived) counts.derived += 1;
      if (next !== stored) { counts.changed += 1; updates.push([next, row.workflow_id, row.job_id, row.path]); } else counts.unchanged += 1;
      const key = next ?? 'unknown';
      byKindSubkind[row.kind] ??= {};
      byKindSubkind[row.kind][key] = (byKindSubkind[row.kind][key] ?? 0) + 1;
      if (!next) {
        counts.unknown += 1;
        const samples = (unknownSamples[row.kind] ??= []);
        if (samples.length < 8) samples.push({ op: row.op_id, path: row.path });
      }
    }
    if (apply && updates.length) {
      ledger.transaction(() => {
        const set = db.prepare('UPDATE job_artifacts SET subkind=? WHERE workflow_id=? AND job_id=? AND path=? AND subkind IS NOT ?');
        for (const [next, wf, job, p] of updates) set.run(next, wf, job, p, next);
      });
    }
  } finally { ledger.close(); }
  return { ok: true, repo, ledger: file, mode: apply ? 'apply' : 'dry-run', counts, byKindSubkind, unknownSamples };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) { console.error(USAGE); process.exit(2); }
  let out;
  try { out = backfillArtifactSubkind({ repo: path.resolve(args.repo), apply: args.apply, workflow: args.workflow }); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(error?.code === 'ledger-missing' ? 2 : 1); }
  if (args.json) { console.log(JSON.stringify(out, null, 2)); return; }
  const c = out.counts;
  console.log(`${out.mode} ${out.repo}: ${c.rows} artifact rows; ${c.changed} ${out.mode === 'apply' ? 'updated' : 'would change'}, ${c.unchanged} unchanged; ${c.unknown} unknown`);
  for (const [kind, subs] of Object.entries(out.byKindSubkind)) console.log(`  ${kind}: ${Object.entries(subs).map(([k, v]) => `${k}:${v}`).join(' ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
