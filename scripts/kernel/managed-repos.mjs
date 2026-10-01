// managed-repos.mjs — which product ledgers this host manages, and their running workflows.
//
// The ledgers are exactly config.yaml supervisor.repos (relative entries resolve against the source root) plus any
// explicit extra paths, each kept only when it holds a ledger. Nothing is discovered: a ledger nobody listed (an old
// test workflow in the skill's own checkout) is never managed. The reconciler reads the same list
// (scripts/reconciler/services.mjs --dedupe); it replaced resume-all.mjs, whose loop duties were deleted on
// 2026-09-28 (owner ruling "có lỗi xóa luôn": the reconciler is the only loop).
import fs from 'node:fs';
import path from 'node:path';
import { isRuntimeRoot, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { loadConfig } from '../../engine/config.mjs';
import { withLedgerRead } from '../connectors/lib.mjs';
import { starciSourceRoot } from '../housekeeping/hk-orphan-ledgers.mjs';

/**
 * The managed product ledgers: {repos, missing, configError?}. `missing` names listed paths that hold no ledger;
 * `configError` says why config.yaml could not be read.
 */
export function resumeRepos({ config = null, env = process.env, extra = [] } = {}) {
  let listed = [], configError = null;
  try { listed = (config ?? loadConfig())?.supervisor?.repos ?? []; } catch (error) { configError = String(error?.message ?? error); }
  const source = starciSourceRoot(env);
  const seen = new Set(), repos = [], missing = [];
  for (const repo of [...(listed ?? []).map((r) => path.resolve(source, r)), ...extra.map((r) => path.resolve(r))]) {
    const key = process.platform === 'win32' ? repo.toLowerCase() : repo;
    if (seen.has(key)) continue;
    seen.add(key);
    let ledger = false;
    try { ledger = !isRuntimeRoot(repo) && fs.existsSync(ledgerFileFor(repo)); } catch { ledger = false; }
    (ledger ? repos : missing).push(repo);
  }
  return { repos, missing, ...(configError ? { configError } : {}) };
}

/** Running, unarchived workflows of one ledger, read-only. */
export function runningWorkflows(repo) {
  return withLedgerRead(repo, (db) => db.prepare(
    "SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id",
  ).all().map((row) => ({ workflowId: row.workflow_id, repo })), []);
}
