// The sonar row's quality-gate wait: the compute-engine task is polled to its end, then the quality gate of that analysis
// decides; a deadline, a failed task and a missing scanner report are typed refusals.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempRoot } from '../runtime/engine/temp-root.mjs';
import { sonarQualityGate } from '../release/sonar-quality-gate.mjs';

/** A scanner working directory holding report-task.txt (or none when `task` is null). */
function scanned(t, task = 'ceTaskId=AX-1\nprojectKey=product\n') {
  const root = fs.mkdtempSync(path.join(tempRoot(), 'hfs-sonar-qg-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  if (task !== null) {
    fs.mkdirSync(path.join(root, '.scannerwork'));
    fs.writeFileSync(path.join(root, '.scannerwork', 'report-task.txt'), task);
  }
  return root;
}

/** A clock that advances by each sleep, and a fetch answering from `answer(url)`; every request is recorded. */
function server(answer) {
  const calls = [];
  let clock = 0;
  return { calls, ctx: { now: () => clock, sleep: async (ms) => { clock += ms; },
    fetch: async (url, init) => { calls.push({ url, auth: init?.headers?.Authorization }); return { ok: true, json: async () => answer(url, calls.length) }; } } };
}

test('a pending task is polled until SUCCESS and an OK quality gate passes, with the scanner token on every request', async (t) => {
  const { ctx, calls } = server((url, n) => url.includes('/api/ce/task') ? { task: n < 3 ? { status: 'IN_PROGRESS' } : { status: 'SUCCESS', analysisId: 'AN-9' } } : { projectStatus: { status: 'OK' } });
  const verdict = await sonarQualityGate(ctx, { cwd: scanned(t), host: 'https://q.example.invalid/', token: 'tok' });
  assert.deepEqual(verdict, { pass: true, detail: 'exit 0, quality gate OK' });
  assert.equal(calls.filter((call) => call.url.includes('/api/ce/task?id=AX-1')).length, 3);
  assert.equal(calls.at(-1).url, 'https://q.example.invalid/api/qualitygates/project_status?analysisId=AN-9');
  assert.ok(calls.every((call) => call.auth === `Basic ${Buffer.from('tok:').toString('base64')}`));
});

test('a task that never ends is a typed timeout refusal', async (t) => {
  const { ctx } = server(() => ({ task: { status: 'PENDING' } }));
  const verdict = await sonarQualityGate(ctx, { cwd: scanned(t), host: 'https://q.example.invalid', token: 'tok', wait: { deadline: 20_000, interval: 5_000 } });
  assert.equal(verdict.pass, false);
  assert.match(verdict.detail, /^RELEASE_SONAR_GATE_TIMEOUT: compute-engine task AX-1 is still PENDING after 20s$/u);
});

test('a failed compute-engine task fails the row with its error', async (t) => {
  const { ctx } = server(() => ({ task: { status: 'FAILED', errorMessage: 'report rejected' } }));
  const verdict = await sonarQualityGate(ctx, { cwd: scanned(t), host: 'https://q.example.invalid', token: 'tok' });
  assert.deepEqual(verdict, { pass: false, detail: 'RELEASE_SONAR_GATE_FAILED: compute-engine task AX-1 ended FAILED: report rejected' });
});

test('a missing scanner report or an HTTP error is an unreadable refusal, never a pass', async (t) => {
  const { ctx } = server(() => ({}));
  const none = await sonarQualityGate(ctx, { cwd: scanned(t, null), host: 'https://q.example.invalid', token: 'tok' });
  assert.match(none.detail, /^RELEASE_SONAR_GATE_UNREADABLE: the scanner wrote no \.scannerwork\/report-task\.txt/u);
  const denied = await sonarQualityGate({ ...ctx, fetch: async () => ({ ok: false, status: 403 }) }, { cwd: scanned(t), host: 'https://q.example.invalid', token: 'tok' });
  assert.deepEqual(denied, { pass: false, detail: 'RELEASE_SONAR_GATE_UNREADABLE: HTTP 403 from https://q.example.invalid/api/ce/task' });
});
