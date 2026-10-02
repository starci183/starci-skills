// report-salvage.mjs — a dead worker's report that was written but never filed is filed on its behalf.
//
// A worker's last two steps are "write report.json" and "api report --report <it>". A worker that dies
// between them (a host terminal disconnect, a context limit, a killed agent) leaves a complete verdict
// on disk while api reconcile --dead-worker sees no reports row, settles the attempt failed-no-report,
// spends a business attempt and re-runs the whole op (once, 5 such deaths across two product
// ledgers in one 10-minute host disconnect). Before a dead worker is fenced or settled failed,
// unfiledReportCandidates lists the op-report@1 files in its STARCI_JOB_SCRATCH (alpha.3: a report is written
// only there - op_attempts.scratch_dir, else op-prompt.mjs jobScratchDirOf) written since its dispatch (newest
// first, stamped for this job or not stamped at all), and the caller files the first one that api report accepts -
// through `api report` itself, so every report guard (the scratch boundary, validation, draw review, ask guards)
// still applies. Nothing is salvaged that api report would refuse; a report file anywhere else never is.
import fs from 'node:fs';
import path from 'node:path';
import { readJsonFile } from '../lib/json.mjs';

const REPORT_FILE = /^report(?:\.[A-Za-z0-9._-]+)?\.json$/;
const MAX_ENTRIES = 4000;
const SLACK_MS = 5_000;

/** Every file under `dir` (bounded), skipping node_modules and .git. */
function walkFiles(dir, out, budget) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (budget.left-- <= 0) return;
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(abs, out, budget);
    else if (entry.isFile() && REPORT_FILE.test(entry.name)) out.push(abs);
  }
}

/**
 * unfiledReportCandidates({scratch, sinceMs, jobId, dispatchId}) -> [{file, mtimeMs, outcome}] newest first:
 * op-report@1 files under the job's scratch modified since the dispatch, whose stamped `from`/`dispatch`, when
 * present, name this job and dispatch. `roots` is ignored: a report outside the scratch is never filed (H10).
 */
export function unfiledReportCandidates({ scratch = null, sinceMs = 0, jobId = null, dispatchId = null } = {}) {
  const files = [], budget = { left: MAX_ENTRIES };
  for (const root of scratch ? [scratch] : []) {
    let stat;
    try { stat = fs.statSync(root); } catch { continue; }
    if (stat.isDirectory()) walkFiles(root, files, budget);
    else if (REPORT_FILE.test(path.basename(root))) files.push(root);
  }
  const out = [];
  for (const file of [...new Set(files)]) {
    let mtimeMs;
    try { mtimeMs = fs.statSync(file).mtimeMs; } catch { continue; }
    if (Number.isFinite(sinceMs) && mtimeMs < sinceMs - SLACK_MS) continue;
    const doc = readJsonFile(file);
    if (doc?.schema !== 'starci/op-report@1' || typeof doc.outcome !== 'string') continue;
    if (doc.from && jobId && doc.from !== jobId) continue;
    if (doc.dispatch && dispatchId && doc.dispatch !== dispatchId) continue;
    // A report named for another job (report.<otherJob>.json) is that job's.
    const named = /^report\.(op-[A-Za-z0-9._-]+)\.json$/.exec(path.basename(file))?.[1];
    if (named && jobId && named !== jobId) continue;
    out.push({ file, mtimeMs, outcome: doc.outcome });
  }
  return out.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

/**
 * salvageUnfiledReport({candidates, fileReport}) -> {salvaged:{file, outcome}, tried[]} | {salvaged:null, tried[]}
 * `fileReport(file)` runs api report for the job and returns {ok, error?}; the first accepted candidate wins.
 */
export function salvageUnfiledReport({ candidates = [], fileReport }) {
  const tried = [];
  for (const candidate of candidates) {
    const filed = fileReport(candidate.file);
    tried.push({ file: candidate.file, ok: Boolean(filed?.ok), ...(filed?.ok ? {} : { error: String(filed?.error ?? 'refused').slice(0, 300) }) });
    if (filed?.ok) return { salvaged: { file: candidate.file, outcome: candidate.outcome }, tried };
  }
  return { salvaged: null, tried };
}
