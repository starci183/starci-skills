// work.author dispatched before the leg its records prove against (StarCi 2026-10-08: work.author reported blocked on a missing design
// input and the block stood 13 to 15 hours). The plan law orders the legs; `starci kernel dispatch` now also refuses the job itself, typed
// prerequisite-unmet WORK_AUTHOR_PREREQUISITE_UNSETTLED, until every named plan ancestor has a succeeded job.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { unsettledPlanPrerequisites, authorPrerequisiteLegs, WORK_AUTHOR_PREREQUISITE_UNSETTLED } from '../../scripts/kernel/plan-prerequisites.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-author-prereq';
const AUTHOR = 'job-author';
const PLAN = { derivedPlan: { legs: ['business.decide', 'architecture.decide', 'work.author'],
  edges: [['business.decide', 'architecture.decide'], ['architecture.decide', 'work.author']] } };

const tmpRepo = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-author-prereq-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  return dir;
};
const jobRow = (jobId, opId, status, createdAt) => ({ jobId, unitId: `unit-${jobId}`, opId, status, createdAt, payload: { opId, owned_paths: [`.starciwork/features/f/${opId}`], model: 'devin-agent' } });
const seed = (ledger, { business, architecture }) => seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: WF }, goalIdentity: 'authorgoal',
  goal: { revision: 0, identity: 'authorgoal', markdown: '# goal', json: PLAN },
  jobs: [...(business ? [jobRow('job-business', 'business.decide', business, 1)] : []), ...(architecture ? [jobRow('job-architecture', 'architecture.decide', architecture, 2)] : []),
    jobRow(AUTHOR, 'work.author', 'queued', 3)] });

test('the plan ancestors of work.author named by the legality law are its prerequisites', () => {
  assert.deepEqual(authorPrerequisiteLegs(PLAN), ['business.decide', 'architecture.decide']);
  assert.deepEqual(authorPrerequisiteLegs({ derivedPlan: { legs: ['work.author'], edges: [] } }), [], 'a plan without those legs has nothing to wait for');
});

const unmetFor = (t, jobs, op = 'work.author') => {
  const repo = tmpRepo(t);
  const ledger = openLedger({ file: ledgerFileFor(repo, { env: { ...process.env, STARCI_LOCAL_ROOT: path.join(repo, 'localappdata') } }) });
  try {
    seed(ledger, jobs);
    return unsettledPlanPrerequisites(ledger.db, { workflowId: WF, op }).map((item) => [item.op, item.state]);
  } finally { ledger.close(); }
};

test('a leg with no job, a failed job or a running job is unsettled; a succeeded job settles it; other ops are never held', (t) => {
  assert.deepEqual(unmetFor(t, { business: 'failed', architecture: null }), [['business.decide', 'failed'], ['architecture.decide', 'no-job']]);
  assert.deepEqual(unmetFor(t, { business: 'succeeded', architecture: 'running' }), [['architecture.decide', 'running']]);
  assert.deepEqual(unmetFor(t, { business: 'succeeded', architecture: 'succeeded' }), []);
  assert.deepEqual(unmetFor(t, { business: null, architecture: null }, 'interface.implement'), []);
});

test('starci kernel dispatch refuses work.author before its prerequisite settled, before any reservation or Orca call', (t) => {
  const root = tmpRepo(t);
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo, { recursive: true });
  const stub = path.join(root, 'fake-orca.mjs');
  fs.writeFileSync(stub, FAKE_ORCA);
  const log = path.join(root, 'calls.jsonl');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]), STARCI_FAKE_ORCA_MODE: 'healthy',
    STARCI_FAKE_ORCA_LOG: log, STARCI_FAKE_ORCA_STATE: path.join(root, 'state.json'), STARCI_LOCAL_ROOT: path.join(root, 'localappdata') };
  fs.mkdirSync(path.join(repo, '.starciwork'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.starciwork', 'workspace.yaml'), 'schema: work/workspace@1\nid: t\n');
  const ledgerFile = ledgerFileFor(repo, { env });
  const ledger = openLedger({ file: ledgerFile });
  try { seed(ledger, { business: 'succeeded', architecture: 'failed' }); } finally { ledger.close(); }
  for (const spawn of [[], ['--spawn']]) {
    const r = spawnSync(process.execPath, [API, 'dispatch', '--repo', repo, '--job', AUTHOR, ...spawn, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
    assert.equal(r.status, 1, `${spawn.join(' ') || 'dry'}: ${r.stdout}${r.stderr}`);
    const out = JSON.parse(r.stdout);
    assert.equal(out.reason, 'prerequisite-unmet');
    assert.equal(out.code, WORK_AUTHOR_PREREQUISITE_UNSETTLED);
    assert.deepEqual(out.unmet.map((item) => [item.kind, item.op, item.state]), [['plan-prerequisite-unsettled', 'architecture.decide', 'failed']]);
    assert.match(out.detail, /the plan leg architecture\.decide has not settled green \(job job-architecture is failed\)/);
  }
  assert.equal(fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim() : '', '', 'nothing reached the host');
  const inspect = inspectLedger({ file: ledgerFile });
  try {
    assert.equal(inspect.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(AUTHOR).status, 'queued');
    assert.equal(inspect.db.prepare('SELECT count(*) n FROM leases').get().n, 0);
  } finally { inspect.close(); }
});
