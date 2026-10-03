// Machine-owned closure of the provider slots bound to an exact worker terminal.
import { withMachine } from '../../engine/db/machine.mjs';

export const providerBudgetClock = (options) => typeof options.now === 'function' ? options.now : () => options.now ?? Date.now();
export const providerBudgetOptions = (options) => ({ env: options.env ?? process.env,
  ...(options.file ? { file: options.file } : {}), now: providerBudgetClock(options) });

/** The centralized closure owner supplies verified terminal AND process-tree exit evidence. */
export function releaseProviderBudgetByHandle(handle, proof, options = {}) {
  if (!handle || proof?.kind !== 'closed' || proof.confirmed !== true || proof.handle !== handle)
    return { ok: false, reason: 'exit-unproven', released: 0 };
  return withMachine((m) => {
    const rows = m.providerReservations({ activeOnly: true }).filter((row) => row.handle === handle);
    const results = rows.map((row) => m.releaseProviderReservation({ ...row, proof }));
    return { ok: results.every((result) => result.ok), released: results.filter((result) => result.ok && !result.reused).length, results };
  }, providerBudgetOptions(options));
}
