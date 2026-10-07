import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ledgerFileFor, openLedger, ensureWorkflow, changeWorkflowPhase, insertGoal } from '../../engine/db/ledger.mjs';
import { proofRepo } from '../helpers/sonar-scan.mjs';
import { externalOpsOf } from '../../scripts/kernel/leg-status-view.mjs';

// An external leg (request.analyze, run by the chat intake) is never dispatched: status shows it as `external` and the leg progress
// counts only the legs the workflow can run, so a workflow is not "legs 0/N" forever for a leg nothing will ever fill.
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');

test('the catalog names request.analyze as the external op', () => {
  assert.deepEqual([...externalOpsOf(ROOT)], ['request.analyze']);
});

test('status shows an undispatched external leg as external and leaves it out of the leg count', (t) => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-external-leg-'));
  t.after(() => fs.rmSync(repo, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  proofRepo(t, repo);
  const wf = 'wf-external-leg';
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.transaction((db) => {
      const at = Date.now(), legs = [{ op: 'request.analyze' }, { op: 'docs.author' }];
      ensureWorkflow(db, { workflowId: wf, phase: 'queued', title: 'external leg', by: 'test-fixture', reason: 'seed', at });
      insertGoal(db, { workflowId: wf, revision: 0, goalIdentity: 'g', markdown: '# goal', goal: { opChain: { legs }, derivedPlan: { legs, edges: [['request.analyze', 'docs.author']] } }, createdAt: at });
      changeWorkflowPhase(db, { workflowId: wf, to: 'running', by: 'test-fixture', reason: 'seed', at });
    });
  } finally { ledger.close(); }
  const r = spawnSync(process.execPath, [API, 'status', '--repo', repo, '--workflow', wf, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env: { ...process.env, ORCA_TERMINAL_HANDLE: '', STARCI_ROLE: '' } });
  assert.equal(r.status, 0, r.stderr);
  const status = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
  const colors = Object.fromEntries(status.legs.map((leg) => [leg.op, leg.color]));
  assert.deepEqual(colors, { 'request.analyze': 'external', 'docs.author': 'gray' });
  assert.deepEqual(status.progress?.legs, { done: 0, total: 1 });
});
