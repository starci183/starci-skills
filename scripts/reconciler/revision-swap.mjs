// revision-swap.mjs — what the runtime records when the revision under a running system changes. Two moments name it: a new engine process starts
// on a revision other than the one the previous engine booted on (engine-process.mjs startRecovery), and a land moves main so every running
// workflow is looked at again (controllers/workflow.mjs reconcileAfterLand). Each writes one `signal.runtime-change-applied` row: the two
// revisions, the actions the swap performed (a closed vocabulary of what the swap code does to anything outside the engine) and the schema
// identity of the two stores. `starci debug digest` answers "did a source change touch live state" from these rows and nothing else.
//
// A store is never migrated by a swap: a file at another schema version is refused on open (engine/db/ledger.mjs, machine.mjs). The schema
// identity is recorded so that a swap that ever did change one is visible as a difference between two rows.
import { LEDGER_SCHEMA, LEDGER_VERSION } from '../../engine/db/ledger.mjs';
import { MACHINE_SCHEMA, MACHINE_VERSION } from '../../engine/db/machine.mjs';
import { SIGNAL, signalRow } from '../machine/debug-signals.mjs';

/** The actions that rewrite or close something live. The swap code performs none of them; a row that lists one is a departure. */
export const LIVE_TOUCH = Object.freeze(['terminal-closed', 'terminal-restarted', 'ledger-written', 'product-file-written', 'store-migrated']);

/** The schema identity of the two stores this revision opens. */
const schemaIdentity = () => ({ machine: `${MACHINE_SCHEMA}#${MACHINE_VERSION}`, ledger: `${LEDGER_SCHEMA}#${LEDGER_VERSION}` });

/** The revision the newest `reconciler.boot` row of the machine names, or null; read before the new engine writes its own row. */
export function previousBootRev(machine) {
  try {
    const row = machine.db.prepare("SELECT data_json FROM machine_logs WHERE kind='reconciler.event' AND data_json LIKE '%reconciler.boot%' ORDER BY seq DESC LIMIT 1").get();
    return JSON.parse(row?.data_json ?? '{}').rev ?? null;
  } catch { return null; }
}

/** The machine_logs row of one swap: cause 'engine-start' | 'land', both revisions, the actions performed. */
export function swapRow({ cause, fromRev = null, toRev = null, applied = [], at = undefined }) {
  const short = (rev) => (rev ? String(rev).slice(0, 9) : 'unknown');
  const did = applied.map((a) => a.action + ' ' + (a.count ?? 1)).join(', ') || 'nothing';
  return signalRow(SIGNAL.runtimeChange, `runtime revision ${short(fromRev)} to ${short(toRev)} applied (${cause}): ${did}`,
    { cause, fromRev, toRev, applied, schemas: schemaIdentity() }, { at });
}

/** Write one swap row through the engine's own machine handle; false when there is no handle or the write fails (a signal is evidence, never a precondition). */
export function recordSwap(machine, swap) {
  try { return Boolean(machine?.log?.(swapRow(swap))); } catch { return false; }
}
