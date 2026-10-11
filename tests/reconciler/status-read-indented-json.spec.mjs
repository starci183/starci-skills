// The engine reads `starci kernel status --json` through spawnJson. The verb prints its answer indented over many lines (1600 lines for a
// real workflow); the engine read only the last line of stdout, so every status read of the real workflows was "no JSON" (238 status-unreadable
// Decision Items since 2026-10-07) and the Job controller's dispatch push of a ready job (StarCi brand.decide, ready for 20 hours) never ran.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnJson, createCtx } from '../../scripts/reconciler/ctx.mjs';
import job from '../../scripts/reconciler/controllers/job.mjs';

const printing = (code) => ['-e', code];

test('a child that prints its answer indented over many lines is read whole; a log line before it, or a single-line answer, still read', async () => {
  const indented = await spawnJson(process.execPath, printing('console.log(JSON.stringify({ ok: true, progress: { readyJobs: ["j1"], running: 0 }, list: ["x", 7] }, null, 2))'));
  assert.deepEqual(indented.value.progress.readyJobs, ['j1']);
  assert.equal(indented.ok, true);
  const preceded = await spawnJson(process.execPath, printing('console.log("warn: something"); console.log(JSON.stringify({ ok: true, a: { b: 1 } }, null, 2))'));
  assert.equal(preceded.value.a.b, 1);
  const single = await spawnJson(process.execPath, printing('console.log("note"); console.log(JSON.stringify({ ok: false, error: "x" }))'));
  assert.equal(single.value.error, 'x');
  assert.equal(single.ok, false);
  const none = await spawnJson(process.execPath, printing('console.log("plain text")'));
  assert.equal(none.value, null);
});

test('the status read of the engine returns the indented answer of the status verb', async () => {
  const answer = { ok: true, workflowId: 'wf-1', phase: 'running', progress: { queuedReady: 1, readyJobs: ['op-x'], running: 0, allowedParallel: 1 } };
  const spawnChild = (cmd, args, options) => spawnJson(process.execPath, printing(`console.log(JSON.stringify(${JSON.stringify(answer)}, null, 2))`), options);
  const ctx = createCtx({ controller: 'job', mode: 'shadow', ledgers: [{ ledgerId: 'l', repo: 'repo', file: 'f' }], spawnChild });
  const read = await ctx.statusRead('l', 'wf-1');
  assert.equal(read.failure, null);
  assert.deepEqual(read.value.progress.readyJobs, ['op-x']);
});

test('the Job controller names an unreadable status instead of reporting the workflow ended', async () => {
  const ctx = { statusRead: async () => ({ value: null, failure: { cause: 'no-json', error: 'starci kernel status exited 0 with no JSON on stdout' } }) };
  const r = await job.reconcile('wf:l:wf-1', ctx);
  assert.equal(r.action, 'status-unreadable');
  assert.match(r.why, /no JSON/);
});
