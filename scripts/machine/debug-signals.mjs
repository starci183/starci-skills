// debug-signals.mjs — the machine-level events `starci debug digest` answers its questions from. A signal is one machine_logs row whose kind is
// `signal.<name>`, written where the fact occurs by the code that observes it and read back here, never re-derived:
//   runtime-change-applied  the engine runs a new revision: what the swap did to live things (reconciler start, land re-look)
//   host-ledger-drift       the host and the ledger disagree past the declared bound of an SLA clock (episode open or cleared)
//   port-claim              a claimant asks for a local TCP port: the outcome and the holder
// The writer never throws (a signal is evidence, not a precondition); a row carries ids, counts and rule names, never a secret's text.
import { machineLog } from '../../engine/db/machine.mjs';

export const SIGNAL = Object.freeze({
  runtimeChange: 'signal.runtime-change-applied',
  hostDrift: 'signal.host-ledger-drift',
  portClaim: 'signal.port-claim',
});

const ACTORS = Object.freeze({ [SIGNAL.runtimeChange]: 'reconciler', [SIGNAL.hostDrift]: 'reconciler', [SIGNAL.portClaim]: 'runtime' });

/** The machine_logs row of one signal ({actor, kind, level, msg, data, at?}); a kind that is not a signal is refused. */
export function signalRow(kind, msg, data, { at = undefined, workflowId = null } = {}) {
  if (!ACTORS[kind]) throw new Error(`debug-signals: ${kind} is not a signal kind`);
  return { actor: ACTORS[kind], kind, level: 'info', msg, data, ...(at === undefined ? {} : { at }), workflowId };
}

/** Write one signal through its own short-lived machine handle; the number of rows written (0 when the store refuses). */
export function recordSignal(kind, msg, data, { env = process.env, at = undefined, workflowId = null } = {}) {
  try { return machineLog(signalRow(kind, msg, data, { at, workflowId }), { env }); } catch { return 0; }
}

/** The newest `limit` rows of one signal on a machine handle, oldest first: [{seq, at, ...data}]. A reader that cannot ask gets []. */
export function signalRows(m, kind, { limit = 500 } = {}) {
  try {
    return m.db.prepare('SELECT seq, at, data_json FROM machine_logs WHERE kind=? ORDER BY seq DESC LIMIT ?').all(kind, limit).reverse()
      .map((r) => ({ seq: Number(r.seq), at: Number(r.at), ...JSON.parse(r.data_json ?? '{}') }));
  } catch { return []; }
}
