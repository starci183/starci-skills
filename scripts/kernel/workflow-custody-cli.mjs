#!/usr/bin/env node
// workflow-custody-cli.mjs - executable half of modules/cli/commands/workflow/custody.yaml.
//
//   starci workflow custody --workflow <id> [--repo <path>] [--apply] [--json]
//
// Reads what the workflow owns in its app repository (scripts/kernel/workflow-custody.mjs) and where its registered tree
// stands against it. Without --apply nothing is written. --apply runs the same repair `starci workflow start` runs before it
// launches a Kernel (ensureWorkflowWorktree): a tree behind the branch is moved onto it with its own work preserved, a missing
// tree is made at the branch; it is refused while an op of the workflow has a live worker. Every admitted, unsettled attempt whose
// recorded tree path is lost is then settled against the registered tree: rebound (a placement-rebound event) or ended (placement-lost).
import fs from 'node:fs';
import { arg, flag } from '../lib/cli-arg.mjs';
import { openLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { inFlightOps } from './workflow-in-flight.mjs';
import { workflowWorktreeOf } from '../machine/workflow-tree.mjs';
import { ensureWorkflowWorktree, workflowAppRepo } from './workflow-worktree.mjs';
import { workflowCustody, treeStateOf } from './workflow-custody.mjs';
import { isMain } from '../lib/is-main.mjs';

const liveOps = (busy) => busy.map((op) => op.jobId + ' (' + op.status + ', worker ' + op.state + ')').join(', ');
const textOf = (out) => [out.ok ? 'ok' : 'refused', out.reason ?? out.state].join(': ') + (out.detail ? ' - ' + out.detail : '');
const done = (out, asJson, code) => {
  console.log(asJson ? JSON.stringify(out) : textOf(out));
  process.exit(code);
};
const refuse = (reason, detail, asJson, extra = {}) => done({ ok: false, reason, detail, ...extra }, asJson, 1);

function report({ workflowId, appRepo, custody, record }) {
  const present = Boolean(record) && fs.existsSync(record.path);
  const tree = record ? { path: record.path, branch: record.branch, checkpoint: record.checkpoint, ...(custody.none || !present ? {} : treeStateOf({ dir: record.path, custody })) } : null;
  const view = custody.none ? { none: true } : { branchTip: custody.branchTip, tip: custody.tip, restore: custody.restore };
  const state = tree?.state ?? (present ? 'attached' : 'tree-missing');
  return { ok: true, workflowId, appRepo, custody: view, tree, state };
}

export function main(argv = process.argv.slice(2)) {
  const asJson = flag(argv, 'json');
  const workflowId = arg(argv, 'workflow');
  const repo = arg(argv, 'repo') ?? process.cwd();
  if (!workflowId) refuse('bad-usage', '--workflow <id> is required', asJson);
  const appRepo = workflowAppRepo(repo);
  if (!appRepo) refuse('workflow-worktree-missing', `${repo} is in no git checkout`, asJson);
  const custody = workflowCustody({ appRepo, workflowId });
  if (custody.fault) refuse(custody.fault.code, custody.fault.detail, asJson);
  const planned = report({ workflowId, appRepo, custody, record: workflowWorktreeOf({ env: process.env }, workflowId) });
  if (!flag(argv, 'apply')) done(planned, asJson, 0);
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  const busy = planned.state === 'attached' ? [] : inFlightOps(ledger.db, workflowId);
  if (busy.length) {
    ledger.close();
    done({ ...planned, ok: false, reason: 'workflow-custody-busy', detail: `ops with a live worker: ${liveOps(busy)}; apply once they settle` }, asJson, 1);
  }
  const ensured = ensureWorkflowWorktree({ env: process.env }, { workflowId, appRepo, ledger });
  ledger.close();
  if (!ensured.ok) refuse(ensured.reason, ensured.detail, asJson, planned);
  done({ ...planned, applied: true, created: ensured.created, repaired: ensured.repaired ?? null, placements: ensured.placements ?? null, tree: { path: ensured.record.path, branch: ensured.record.branch, checkpoint: ensured.record.checkpoint }, state: 'attached' }, asJson, 0);
}

if (isMain(import.meta.url)) main();
