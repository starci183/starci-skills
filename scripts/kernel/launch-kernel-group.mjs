// Kernel group launch: one admitted attempt, no-effect-only fallback and its ledger receipt.
import { startAgent } from '../agent/lib.mjs';
import { updateSignal } from '../../engine/db/ledger.mjs';

export function launchKernelGroup({ ledger, workflowId, token, route, members, launch, reservationMs,
  hostUnavailableExit, memberLabel, failStart }) {
  const fellThrough = [];
  let spawned = null;
  const remaining = [...members];
  for (let index = 0; remaining.length; index += 1) {
    const member = remaining[0];
    updateSignal(ledger.db, { scope: 'kernel', key: workflowId, token, expiresAt: Date.now() + reservationMs });
    spawned = startAgent({ ...launch, provider: member.agent, model: member.model, effort: member.effort,
      allowGroup: remaining.map((m) => ({ provider: m.agent, model: m.model, effort: m.effort })) });
    if (spawned.ok) {
      route = { ...member, agent: spawned.provider, model: spawned.admission?.selected?.model ?? spawned.model,
        effort: spawned.effort, warnings: route.warnings, members: route.members, fallThrough: route.fallThrough };
      break;
    }
    const selected = spawned.admission?.selected ?? { provider: member.agent, model: member.model };
    const failure = { agent: selected.provider, requestedModel: selected.model, effectState: spawned.effectState ?? 'unknown', admission: spawned.admission ?? null,
      ...(spawned.errorCode ? { errorCode: spawned.errorCode } : {}), ...(spawned.dispatchId ? { dispatch: spawned.dispatchId } : {}),
      ...(spawned.cleanup ? { cleanup: spawned.cleanup } : {}), ...(spawned.observation ? { observation: spawned.observation } : {}),
      ...(spawned.trust ? { trust: spawned.trust } : {}) };
    // An Orca that stopped answering mid-boot proves nothing about any member: host-unavailable (exit 75), no fall-through.
    if (spawned.hostUnavailable) failStart('host-unavailable', spawned.error, spawned.terminal ?? null, { ...failure, launchStep: spawned.step }, hostUnavailableExit);
    const selectedIndex = remaining.findIndex((candidate) => candidate.agent === selected.provider && candidate.model === selected.model);
    remaining.splice(selectedIndex >= 0 ? selectedIndex : 0, 1);
    const next = remaining[0] ?? null;
    if (!route.fallThrough || !next || spawned.effectState !== 'none')
      failStart(spawned.step, spawned.error, spawned.terminal ?? null,
        { ...failure, ...(fellThrough.length ? { fellThrough } : {}),
          ...(route.fallThrough && next ? { fallThroughRefused: `the start left effect '${spawned.effectState ?? 'unknown'}'` } : {}) });
    const at = Date.now();
    const workflow = ledger.db.prepare('SELECT generation FROM workflows WHERE workflow_id=?').get(workflowId);
    ledger.transaction(() => {
      ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: workflow?.generation ?? 0,
        kind: 'kernel-start-failed', createdAt: at,
        payload: { step: spawned.step, error: spawned.error, ...failure, fellThroughTo: { agent: next.agent, model: next.model ?? null } } });
    });
    fellThrough.push({ agent: selected.provider, model: selected.model ?? null, step: spawned.step, error: spawned.error });
    console.error(`start-workflow: warning: kernel member ${memberLabel(member)} refused at ${spawned.step} (${spawned.error}) — falling through to ${memberLabel(next)}`);
  }
  return { spawned, route, fellThrough };
}
