// Synchronous workflow lifecycle operations use one authoritative ledger/workflow lock.
import crypto from 'node:crypto';
import { claimManager } from '../connectors/lib.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';

const WORKFLOW_LOCK = Symbol('workflow-checkpoint-lock');

/** Hold the existing host lock through one synchronous operation. */
export function withLock(name, fn, { waitMs = 600_000, pollMs = 1000, env = process.env } = {}) {
  const end = Date.now() + waitMs;
  for (;;) {
    const held = claimManager(name, { env });
    if (held.ok) { try { return fn(); } finally { held.release(); } }
    if (Date.now() >= end) return { ok: false, reason: 'lock-busy', lock: name, holder: held.holder ?? null };
    sleepSync(pollMs);
  }
}
/** Native acceptance and direct primitives share the authoritative ledger/workflow lock. */
export function withWorkflowLock(ctx, { workflowId }, fn) {
  const identity = ctx?.ledger?.ledgerId ?? ctx?.ledger?.path ?? ctx?.repo ?? '';
  const name = `workflow-checkpoint-${crypto.createHash('sha1').update(`${identity}:${workflowId}`).digest('hex').slice(0, 16)}`;
  if (ctx?.[WORKFLOW_LOCK] === name) return fn(ctx);
  const out = withLock(name, () => fn({ ...ctx, [WORKFLOW_LOCK]: name }), { waitMs: ctx?.lockWaitMs, env: ctx?.env ?? process.env });
  if (out?.reason === 'lock-busy') throw Object.assign(new Error(`another checkpoint holds ${name}`), { code: 'workflow-checkpoint-lock-busy' });
  return out;
}
