// EFFECT_UNKNOWN_STUCK promises "starci kernel reconcile, then a Decision Item" (modules/reconciler/sla.yaml): after the SLA bound the Supervisor gets ONE item for the job.
import test from 'node:test';
import assert from 'node:assert/strict';
import { effectUnknownDecision, effectUnknownItem } from '../../scripts/reconciler/effect-unknown-item.mjs';

const settings = { decisionDueMs: 900_000, sla: { EFFECT_UNKNOWN_STUCK: 600_000 } };
const job = { jobId: 'op-x-1', op: 'x', workflowId: 'wf-1', updatedAt: 1_000_000 };
const ctxAt = (now, opened) => ({ now: () => now, openDecision: async (di) => { opened.push(di); return { ok: true }; } });
const step = { kind: 'effect-unknown', verb: 'reconcile' };

test('inside the SLA bound no item is opened (passing)', async () => {
  const opened = [];
  assert.deepEqual(await effectUnknownItem(ctxAt(job.updatedAt + 599_000, opened), 'shop', job, step, settings), {});
  assert.equal(opened.length, 0);
});

test('past the bound ONE Supervisor item per job is opened, idempotent by job (violating before this change: none)', async () => {
  const opened = [];
  const out = await effectUnknownItem(ctxAt(job.updatedAt + 601_000, opened), 'shop', job, step, settings);
  assert.equal(out.decision.ok, true);
  const [di] = opened;
  assert.deepEqual([di.kind, di.decider, di.idempotencyKey, di.entity.id, di.workflowId], ['runtime-defect', 'supervisor', 'effect-unknown:op-x-1', 'op-x-1', 'wf-1']);
  assert.equal(effectUnknownDecision(job, 'shop', { now: 5_000_000, settings }).idempotencyKey, di.idempotencyKey);
});

test('another step of the job never opens it', async () => {
  const opened = [];
  assert.deepEqual(await effectUnknownItem(ctxAt(job.updatedAt + 9_000_000, opened), 'shop', job, { kind: 'dead-worker' }, settings), {});
  assert.equal(opened.length, 0);
});
