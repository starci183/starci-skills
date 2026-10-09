// scripts/reconciler/supervisor-mirror-apply.mjs — what the Workflow controller does with a mirror plan (supervisor-mirror.mjs) and the rulings the runtime contradicts
// (supervisor-ruling-withdraw.mjs): the Supervisor's twins open, the answered and stale product items close, the Kernel is told what became of an escape the Supervisor
// did not rule on, and a contradicted ruling is withdrawn with its reason. Every close is a typed verb of the product ledger and a controller log row.
import { eachInOrder } from '../lib/in-order.mjs';
import { recordAction } from '../supervisor/actions.mjs';
import { withSupervisor } from '../machine/home.mjs';
import { supervisorDecisions } from '../machine/decisions.mjs';

const resolveArgs = (closure) => ['--resolve', closure.id, '--by', closure.by, '--verb', closure.verb, '--note', closure.note];

/** A stale product item also ends its live Supervisor twin after its ledger closure succeeds. */
function closeTwin(ctx, closure) {
  if (ctx.mode !== 'active' || !closure.twinKey) return;
  withSupervisor((m) => {
    const twin = supervisorDecisions(m).find((di) => di.idempotencyKey === closure.twinKey);
    if (twin) m.setSupDecision(twin.id, { status: 'resolved', by: 'reconciler/mirror', verb: closure.verb, rationale: closure.note });
  }, { env: ctx.env ?? process.env });
}

async function closeItems(ctx, { ledgerId, workflowId, closures, lines }) {
  await eachInOrder(closures, async (closure) => {
    const done = await ctx.api(ledgerId, 'decisions', resolveArgs(closure));
    ctx.log?.('reconciler.event', `supervisor item ${closure.id} closed (${closure.verb}): ${closure.note}`, { kind: 'reconciler.supervisor-item-closed', workflowId, item: closure.id, verb: closure.verb, ok: done?.ok !== false });
    if (done?.ok === false) lines.push(`close of ${closure.id} failed: ${String(done.error ?? done.stderr ?? '').slice(0, 120)}`);
    else if (done?.ok === true) closeTwin(ctx, closure);
  });
}

async function withdrawRulings(ctx, { ledgerId, workflowId, rulings, now, env }) {
  await eachInOrder(rulings, async (ruling) => {
    await ctx.api(ledgerId, 'decisions', resolveArgs({ id: ruling.id, by: 'runtime', verb: 'ruling-withdrawn', note: ruling.reason.slice(0, 400) }));
    ctx.log?.('reconciler.event', `supervisor ruling ${ruling.id} withdrawn: ${ruling.reason}`, { kind: 'reconciler.supervisor-ruling-withdrawn', workflowId, ruling: ruling.id, job: ruling.job });
    recordAction({ item: `ruling-withdrawn:${ruling.id}`, action: 'withdrawn', reason: ruling.reason, workflowId, refs: [`di:${ruling.id}`, `job:${ruling.job}`], by: 'runtime', env, now });
  });
}

/**
 * Applies one workflow's mirror plan. `openDecisions(specs)` opens specs through the controller and returns the ones it opened (the Kernel notices ring the Kernel).
 * Returns the notices opened. Nothing is written in a shadow controller: ctx.api and ctx.openDecision answer would-rows there.
 */
export async function applyMirror(ctx, { ledgerId, workflowId, mirror, rulings, lines, now, openDecisions }) {
  await openDecisions(mirror.twins);
  await closeItems(ctx, { ledgerId, workflowId, closures: mirror.closures, lines });
  const notices = await openDecisions(mirror.notices);
  if (ctx.mode === 'active') await withdrawRulings(ctx, { ledgerId, workflowId, rulings, now, env: ctx.env ?? process.env });
  return notices;
}
