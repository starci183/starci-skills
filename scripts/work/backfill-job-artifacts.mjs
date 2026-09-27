#!/usr/bin/env node
// backfill-job-artifacts.mjs — index what every settled job of a repository already produced, the way settle now
// does for each new one (scripts/kernel/job-artifacts.mjs indexJobArtifacts): report envelopes, named Work and
// media files, their evidence directories, and a .patch for each job whose commits still exist. Every workflow is
// covered - running, finished and archived. Idempotent: a file already indexed with the same sha256 is not
// rewritten, a patch or copy already on disk is kept, and a job whose rows did not change gets no second
// `artifacts-indexed` event. Default is --dry-run, which writes nothing.
//
//   node scripts/work/backfill-job-artifacts.mjs --repo <repo> [--dry-run|--apply] [--workflow <id>] [--json]
//
// The receipt counts rows by kind and patches by state, lists every job whose commits are gone (its patch cannot
// be made), and lists each .starciwork/evidence directory no job's report names (kept, unattributed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JOB_STATUSES, inspectLedger, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';
import { parseJson } from '../lib/json.mjs';
import { indexJobArtifacts } from '../kernel/job-artifacts.mjs';

const USAGE = 'use: node scripts/work/backfill-job-artifacts.mjs --repo <repo> [--dry-run|--apply] [--workflow <id>] [--json]';

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

// The checkouts a job's relative report paths may resolve in besides the repo: the ones its landed proof read.
const rootsOf = (job) => {
  const landed = parseJson(job.result_json, null)?.landed;
  return landed && typeof landed === 'object' ? [landed.repo, ...(Array.isArray(landed.repos) ? landed.repos.map((r) => r?.repo) : [])].filter((r) => typeof r === 'string') : [];
};

/** Backfill one repository; `apply` false reports without writing. */
export function backfillJobArtifacts({ repo, apply = false, workflow = null, now = Date.now() }) {
  const file = ledgerFileFor(repo);
  if (!fs.existsSync(file)) throw Object.assign(Error(`no ledger at ${file}`), { code: 'ledger-missing' });
  const ledger = apply ? openLedger({ file }) : inspectLedger({ file });
  const counts = { jobs: 0, jobsWithArtifacts: 0, rows: 0, added: 0, updated: 0, copied: 0, missingFiles: 0, errors: 0 };
  const byKind = {}, patches = {}, commitsGone = [], errors = [], namedDirs = new Set();
  try {
    const settled = JOB_STATUSES.settled;
    const jobs = ledger.db.prepare(`SELECT * FROM jobs WHERE kind<>'kernel' AND status IN (${settled.map(() => '?').join(',')}) ${workflow ? 'AND workflow_id=?' : ''} ORDER BY created_at, job_id`)
      .all(...settled, ...(workflow ? [workflow] : []));
    for (const job of jobs) {
      counts.jobs += 1;
      let r;
      try { r = indexJobArtifacts(ledger, { repo, jobId: job.job_id, roots: rootsOf(job), event: 'on-change', dryRun: !apply, now }); }
      catch (error) { r = { ok: false, error: String(error?.message ?? error) }; }
      if (!r.ok) { counts.errors += 1; errors.push({ jobId: job.job_id, error: r.error }); continue; }
      if (r.indexed) counts.jobsWithArtifacts += 1;
      counts.rows += r.indexed; counts.added += r.added; counts.updated += r.updated; counts.copied += r.copied; counts.missingFiles += r.missing.length;
      for (const [kind, n] of Object.entries(r.byKind)) byKind[kind] = (byKind[kind] ?? 0) + n;
      if (r.patch) {
        const state = r.patch.missing ? 'commits-gone' : r.patch.error ? 'error' : r.patch.kept ? `${r.patch.state}-kept` : r.patch.state;
        patches[state] = (patches[state] ?? 0) + 1;
        if (r.patch.missing) commitsGone.push({ workflowId: job.workflow_id, jobId: job.job_id, opId: job.op_id, status: job.status, missing: r.patch.missing });
        if (r.patch.error) errors.push({ jobId: job.job_id, error: `patch: ${r.patch.error}` });
      }
    }
    if (apply) for (const row of ledger.db.prepare("SELECT DISTINCT path FROM job_artifacts WHERE path LIKE '.starciwork/evidence/%'").all()) namedDirs.add(row.path.split('/').slice(0, 3).join('/').toLowerCase());
  } finally { ledger.close(); }
  const evidenceRoot = path.join(repo, '.starciwork', 'evidence');
  let unattributed = null;
  if (apply && fs.existsSync(evidenceRoot)) {
    unattributed = fs.readdirSync(evidenceRoot, { withFileTypes: true }).filter((e) => e.isDirectory())
      .map((e) => `.starciwork/evidence/${e.name}`).filter((dir) => !namedDirs.has(dir.toLowerCase()));
  }
  return { ok: true, repo, ledger: file, mode: apply ? 'apply' : 'dry-run', counts, byKind, patches, commitsGone, ...(unattributed ? { unattributedEvidenceDirs: unattributed } : {}), errors };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args) { console.error(USAGE); process.exit(2); }
  let out;
  try { out = backfillJobArtifacts({ repo: path.resolve(args.repo), apply: args.apply, workflow: args.workflow }); }
  catch (error) { console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code })); process.exit(error?.code === 'ledger-missing' ? 2 : 1); }
  if (args.json) { console.log(JSON.stringify(out, null, 2)); return; }
  const c = out.counts;
  console.log(`${out.mode} ${out.repo}: ${c.jobs} settled jobs, ${c.jobsWithArtifacts} with artifacts; rows ${c.rows} (added ${c.added}, updated ${c.updated}), copied ${c.copied}, named-but-missing files ${c.missingFiles}, errors ${c.errors}`);
  console.log(`  by kind: ${Object.entries(out.byKind).map(([k, v]) => `${k}:${v}`).join(' ') || '-'}`);
  console.log(`  patches: ${Object.entries(out.patches).map(([k, v]) => `${k}:${v}`).join(' ') || '-'}`);
  for (const g of out.commitsGone) console.log(`  commits gone: ${g.jobId} (${g.opId}, ${g.status}) ${g.missing.join(',')}`);
  if (out.unattributedEvidenceDirs?.length) console.log(`  evidence dirs no report names: ${out.unattributedEvidenceDirs.join(', ')}`);
  for (const e of out.errors.slice(0, 20)) console.log(`  error ${e.jobId}: ${e.error}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
