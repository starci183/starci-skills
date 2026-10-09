// host-orphans.mjs - the Host controller's reap of orphan runtime loops (host.mjs findOrphans names them).
import { eachInOrder } from '../lib/in-order.mjs';

/**
 * Each orphan runs an ORPHAN_PROCESS clock and is killed; the clock of a process that is gone closes. `state.orphanClocks` holds the entities
 * of the last pass; `clock` and `clear` are the controller's own SLA calls.
 */
export async function reapOrphanProcesses(ctx, orphans, p, { state, clock, clear }) {
  const seen = new Set();
  await eachInOrder(orphans, async (o) => {
    const entity = `process:${o.pid}`;
    seen.add(entity);
    await clock(ctx, entity, 'ORPHAN_PROCESS', p.orphanSlaMs, { code: 'ORPHAN_PROCESS', owner: 'host-controller', ledgerId: 'supervisor', repo: o.repo, workflowId: o.workflowId, script: o.script });
    await ctx.run('taskkill.exe', ['/F', '/T', '/PID', String(o.pid)], { timeoutMs: 120_000 });
  });
  await eachInOrder(state.orphanClocks, async (entity) => { if (!seen.has(entity)) await clear(ctx, entity, 'ORPHAN_PROCESS'); });
  state.orphanClocks = seen;
}
