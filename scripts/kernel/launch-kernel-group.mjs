// Kernel group launch: one admitted attempt, no-effect-only fallback and its ledger receipt.
import { startAgent } from '../agent/lib.mjs';
import { updateSignal } from '../../engine/db/ledger.mjs';
import { commitWorkflowStart } from './workflow-startup.mjs';

/** The failure record of one refused start: the selected member, the effect and every receipt field it left. */
const failureOf = (spawned, selected) => ({ agent: selected.provider, requestedModel: selected.model, effectState: spawned.effectState ?? 'unknown', admission: spawned.admission ?? null,
  ...(spawned.errorCode ? { errorCode: spawned.errorCode } : undefined), ...(spawned.dispatchId ? { dispatch: spawned.dispatchId } : undefined),
  ...(spawned.cleanup ? { cleanup: spawned.cleanup } : undefined), ...(spawned.observation ? { observation: spawned.observation } : undefined),
  ...(spawned.trust ? { trust: spawned.trust } : undefined) });

export function launchKernelGroup({ ledger, workflowId, token, expected, route, members, launch, reservationMs,
  hostUnavailableExit, memberLabel, failStart }, { start = startAgent, now = Date.now } = {}) {
  const fellThrough = [];
  let spawned = null;
  const remaining = [...members];
  while (remaining.length) {
    const member = remaining[0];
    const renewed = commitWorkflowStart(ledger, { workflowId, expected, token, holderPid: process.pid, now }, () => {
      const at = now();
      if (!updateSignal(ledger.db, { scope: 'kernel', key: workflowId, token, expiresAt: at + reservationMs }))
        throw new Error('kernel-start-reservation-lost');
    });
    if (!renewed.ok) {
      failStart(renewed.reason, 'Kernel group lost its accepted goal or starting reservation before launch', null,
        { effectState: 'none', authority: renewed.authority ?? null });
      throw new Error(renewed.reason);
    }
    spawned = start({ ...launch, provider: member.agent, model: member.model, effort: member.effort,
      allowGroup: remaining.map((m) => ({ provider: m.agent, model: m.model, effort: m.effort })) });
    if (spawned.ok) {
      route = { ...member, agent: spawned.provider, model: spawned.admission?.selected?.model ?? spawned.model,
        effort: spawned.effort, warnings: route.warnings, members: route.members, fallThrough: route.fallThrough };
      break;
    }
    const selected = spawned.admission?.selected ?? { provider: member.agent, model: member.model };
    const failure = failureOf(spawned, selected);
    // An Orca that stopped answering mid-boot proves nothing about any member: host-unavailable (exit 75), no fall-through.
    if (spawned.hostUnavailable) failStart('host-unavailable', spawned.error, spawned.terminal ?? null, { ...failure, launchStep: spawned.step }, hostUnavailableExit);
    const selectedIndex = remaining.findIndex((candidate) => candidate.agent === selected.provider && candidate.model === selected.model);
    remaining.splice(Math.max(selectedIndex, 0), 1);
    const next = remaining[0] ?? null;
    if (!route.fallThrough || !next || spawned.effectState !== 'none')
      failStart(spawned.step, spawned.error, spawned.terminal ?? null,
        { ...failure, ...(fellThrough.length ? { fellThrough } : undefined),
          ...(route.fallThrough && next ? { fallThroughRefused: `the start left effect '${spawned.effectState ?? 'unknown'}'` } : undefined) });
    const failedAt = now();
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
    ledger.transaction(() => {
      ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: workflow?.generation ?? 0,
        kind: 'kernel-start-failed', createdAt: failedAt,
        payload: { step: spawned.step, error: spawned.error, ...failure, fellThroughTo: { agent: next.agent, model: next.model ?? null } } });
    });
    fellThrough.push({ agent: selected.provider, model: selected.model ?? null, step: spawned.step, error: spawned.error });
    console.error(`start-workflow: warning: kernel member ${memberLabel(member)} refused at ${spawned.step} (${spawned.error}) — falling through to ${memberLabel(next)}`);
  }
  return { spawned, route, fellThrough };
}
