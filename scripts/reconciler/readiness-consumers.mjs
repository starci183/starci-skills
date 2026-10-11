// readiness-consumers.mjs - which consumer a readiness row of `starci reconciler up` gates (modules/reconciler/readiness.yaml). A Kernel start is blocked by a red
// required row that a Kernel needs, never by one only the harness UI needs: a UI build that fails to install must not leave a running workflow without a Kernel.
import { readModuleJson } from '../../engine/runtime-root.mjs';

/** The consumer of a start that is not told one: the full host (every row gates). */
export const DEFAULT_CONSUMER = 'harness';

/** The rows of `items` that gate `consumer`. Pure over the table. */
export function forConsumer(items, consumer = DEFAULT_CONSUMER, table = readModuleJson('modules', 'reconciler', 'readiness.yaml')) {
  const gates = new Map((table?.rows ?? []).map((row) => [row.id, row.gates]));
  return items.filter((item) => !gates.has(item.id) || gates.get(item.id).includes(consumer));
}
