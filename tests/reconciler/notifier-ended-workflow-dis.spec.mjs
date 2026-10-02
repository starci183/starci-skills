// notifier-ended-workflow-dis.spec.mjs — the owner digest's ownerWaits never lists an owner Decision Item of an
// ended workflow (cluster notifier-ended-workflow-dis, follow-up of decisions-archived-workflow 38071f3a2).
// A live owner DI (decider 'owner') sat on an archived workflow; the raw `decision_items` read in
// notifier.mjs digestInputs kept pushing it to Telegram.
//   1. An owner DI left open on an archived|finished workflow yields no ownerWaits line.
//   2. An owner DI on a running workflow still does (and a kernel-decider DI never did).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { changeWorkflowPhase, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
import { digestInputs } from '../../scripts/reconciler/notifier.mjs';

const WF_ARCH = 'wf-owner-di-archived', WF_FIN = 'wf-owner-di-finished', WF_RUN = 'wf-owner-di-running';

const repoWithLedger = (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-notifier-ended-'));
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-notifier-ended-sup-'));
  // digestInputs reads the one ledger ledgerFileFor resolves for the repo (the projects root; no in-repo store).
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(home, 'machine.sqlite'), STARCI_PROJECTS_ROOT: path.join(home, 'projects'), NODE_NO_WARNINGS: '1' };
  const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
  t.after(() => {
    try { ledger.close(); } catch { /* closed */ }
    fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    fs.rmSync(home, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
  });
  for (const id of [WF_ARCH, WF_FIN, WF_RUN]) ledger.ensureWorkflow({ workflowId: id, title: 'owner-di' });
  return { repo, ledger, env };
};

/** Walk phase along workflow_transitions the way the verbs do (lifecycle row, then the update). */
const toPhase = (ledger, workflowId, chain) => {
  for (const to of chain) changeWorkflowPhase(ledger.db, { workflowId, to, by: 'test', reason: `seed-${to}`, at: Date.now() });
};
const ownerDi = (ledger, workflowId, key, extra = {}) => openDecisionRow(ledger, {
  workflowId, kind: 'worker-question', decider: 'owner', entity: { type: 'workflow', id: workflowId },
  summary: `owner must pick an option for ${workflowId}`, by: 'kernel', idempotencyKey: key, ...extra,
}, { now: 0 }).di;

test('an owner DI on an ended workflow yields no ownerWaits line; one on a running workflow still does', async (t) => {
  const { repo, ledger, env } = repoWithLedger(t);
  // The pre-close shape: the phase flips with the owner DI still open, locked forever (events_refuse_archived).
  ownerDi(ledger, WF_ARCH, 'worker-question:wf-owner-arch');
  ownerDi(ledger, WF_FIN, 'worker-question:wf-owner-fin');
  const run = ownerDi(ledger, WF_RUN, 'worker-question:wf-owner-run');
  openDecisionRow(ledger, { workflowId: WF_RUN, kind: 'progress-stall', entity: { type: 'workflow', id: WF_RUN },
    summary: 'kernel-side stall, not the owner\'s', by: 'reconciler/workflow', idempotencyKey: 'progress-stall:wf-owner-run' }, { now: 0 });
  toPhase(ledger, WF_ARCH, ['stopped', 'archived']);
  toPhase(ledger, WF_FIN, ['running', 'finished']);
  toPhase(ledger, WF_RUN, ['running']);

  const inputs = await digestInputs({ env, now: 120_000, repos: [repo] });
  assert.equal(inputs.ownerWaits.some((l) => l.startsWith(`${WF_ARCH}:`)), false, 'no line for an archived workflow');
  assert.equal(inputs.ownerWaits.some((l) => l.startsWith(`${WF_FIN}:`)), false, 'no line for a finished workflow');
  assert.deepEqual(inputs.ownerWaits, [`${WF_RUN}: owner must pick an option for ${WF_RUN}`],
    `the running workflow's owner DI (${run.id}) still waits on the owner, alone`);
});
