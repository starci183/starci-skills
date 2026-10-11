// host-slot-servers.mjs - the Host controller's collection of UAT slots whose lessee is gone (scripts/uat/slot-collect.mjs).
//
// A slot server (the app a UAT run started under a held slot) belongs to the attempt that asked for it. Every host:processes pass ends the slots
// whose attempt ended, whose launching process is gone, or that recorded no lessee and were held past allocation.uatSlot.unknownHoldMs; each
// stop appends a `uat-slot-collected` event. In shadow the pass lists what it would end and stops nothing.
import { collectSlots } from '../uat/slot-collect.mjs';

/** The slots this pass ended (or, in shadow, would end): [{slot, runId, state, why, pids, stopped, released}]. A failing read is recorded, never thrown. */
export async function reapSlotServers(ctx, procs, { collect = collectSlots } = {}) {
  let ends = [];
  try { ends = collect({ env: ctx.env ?? process.env, rows: procs, now: ctx.now(), dryRun: ctx.mode !== 'active' }); }
  catch (error) { await ctx.log('reconciler.host.slot-servers', `slot collection failed: ${String(error?.message ?? error).slice(0, 200)}`, {}); return []; }
  if (ends.length) await ctx.log(ctx.mode === 'active' ? 'reconciler.host.slot-servers' : 'reconciler.would', `${ends.length} UAT slot(s) with no lessee`, { ends });
  return ends;
}
