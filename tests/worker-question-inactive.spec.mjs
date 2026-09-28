import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FAKE_ORCA } from './helpers/fake-orca.mjs';
import { openLedger, inspectLedger, ledgerFileFor } from '../engine/ledger-db.mjs';

const root = path.resolve(import.meta.dirname, '..');
const apiFile = path.join(root, 'scripts', 'kernel', 'api.mjs');
test('a filed report makes its worker question inactive before job settlement', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-question-inactive-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
  const stub = path.join(tmp, 'fake-orca.mjs'); fs.writeFileSync(stub, FAKE_ORCA);
  const state = path.join(tmp, 'state.json');
  const env = { ...process.env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG: path.join(tmp, 'calls.jsonl'), STARCI_FAKE_ORCA_STATE: state };
  const api = (...args) => {
    const run = spawnSync(process.execPath, [apiFile, ...args, '--repo', repo, '--json'],
      { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000, env });
    return { run, body: JSON.parse(run.stdout || 'null') };
  };
  const workflowId = 'wf-question-inactive', jobId = 'job-question-inactive';
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.enqueueJob({ jobId: `kernel-${workflowId}`, workflowId, kind: 'kernel', role: 'kernel', payload: {} });
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({ jobId, workflowId, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', owned_paths: ['docs/'], model: 'codex-agent' } });
  } finally { ledger.close(); }
  const dispatched = api('dispatch', '--job', jobId, '--model', 'codex-agent', '--spawn');
  assert.equal(dispatched.run.status, 0, dispatched.run.stderr || dispatched.run.stdout);
  const dispatchId = dispatched.body.dispatchId;
  const message = { id: 'msg_dead', run_id: 'run-fake-1', from_handle: `dispatch:${dispatchId}`, to_handle: 'run:run-fake-1',
    type: 'question', subject: 'Question', body: 'Still waiting?', thread_id: 'msg_dead',
    payload: JSON.stringify({ dispatchId, question: 'Still waiting?' }), created_at: new Date().toISOString() };
  fs.writeFileSync(state, JSON.stringify({ messages: [message] }));
  assert.deepEqual(api('status', '--workflow', workflowId).body.frontier.workerQuestionJobs, [jobId]);
  assert.equal(api('questions', '--workflow', workflowId).body.bridged, 1);
  const read = (fn) => { const l = inspectLedger({ file: ledgerFileFor(repo) }); try { return fn(l.db); } finally { l.close(); } };
  const write = openLedger({ file: ledgerFileFor(repo) });
  try { write.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)")
    .run(workflowId, dispatchId, 'code.refactor', 1, 0, 'done', JSON.stringify({ outcome: 'done', summary: 'finished' }), null, Date.now()); }
  finally { write.close(); }
  assert.equal(read(db => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status), 'running');
  const status = api('status', '--workflow', workflowId).body;
  assert.deepEqual(status.workerQuestions, []);
  assert.deepEqual(status.frontier.workerQuestionJobs, []);
  const questions = api('questions', '--workflow', workflowId).body;
  assert.equal(questions.closed, 1);
  assert.deepEqual(questions.pending, []);
  assert.equal(read(db => JSON.parse(db.prepare("SELECT disposition_json FROM inbox WHERE key='msg_dead'").get().disposition_json).reason), 'dispatch-inactive');
});

test('ledger-only status excludes a bridged question after its dispatch reports', (t) => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-question-ledger-only-'));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const repo = path.join(tmp, 'repo'); fs.mkdirSync(repo);
  const workflowId = 'wf-question-ledger-only', jobId = 'job-ledger-only', dispatchId = 'dispatch-ledger-only';
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.enqueueJob({ jobId: `kernel-${workflowId}`, workflowId, kind: 'kernel', role: 'kernel', payload: {} });
    ledger.enqueueJob({ jobId, workflowId, opId: 'code.refactor', kind: 'op', payload: { opId: 'code.refactor', owned_paths: ['docs/'], orca: { dispatchId } } });
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)")
      .run(workflowId, 'worker-question', 'msg_ledger', JSON.stringify({ jobId, dispatchId, opId: 'code.refactor', question: 'Done?' }), 'pending', Date.now());
    ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)")
      .run(workflowId, dispatchId, 'code.refactor', 1, 0, 'done', JSON.stringify({ outcome: 'done', summary: 'finished' }), null, Date.now());
  } finally { ledger.close(); }
  const run = spawnSync(process.execPath, [apiFile, 'status', '--workflow', workflowId, '--repo', repo, '--json'],
    { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120000 });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const status = JSON.parse(run.stdout);
  assert.deepEqual(status.workerQuestions, []);
  assert.deepEqual(status.frontier.workerQuestionJobs, []);
});
