// A connector row that still owes the closure of its manager or its cloudflared child after the host restarted: neither recorded process
// object exists any more, so the debt is settled by the absence of the exact process (pid and birth), and the row is closed with that receipt.
// Without it the row blocks every later start (connector-child-custody-unreconciled) and nothing could close it: a manager whose launch
// custody was never captured has no identity `tunnel stop` could stop.
import { withMachine } from '../../engine/db/machine.mjs';
import { processList } from '../api/process/process-list.mjs';
import { connectorChildUnresolved, connectorState } from './lib.mjs';

const BIRTH_EPOCH = 116444736000000000n;
const birthMs = (identity) => { try { return Number((BigInt(identity.birth) - BIRTH_EPOCH) / 10000n); } catch { return null; } };
const BIRTH_SLACK_MS = 2000;

/** The recorded process objects of a row (manager and child) with the birth each carries. Pure. */
export const recordedObjects = (record) => [record?.processIdentity ?? record?.processCapture?.identity, record?.childIdentity].filter(Boolean);

/** Whether no process of `table` is the recorded object (same pid born at the recorded instant). A birth that cannot be read proves nothing. Pure. */
export function objectGone(identity, table) {
  const born = birthMs(identity);
  if (born === null || !Array.isArray(table)) return false;
  return !table.some((row) => row.pid === identity.pid && Number.isFinite(row.created) && Math.abs(row.created - born) <= BIRTH_SLACK_MS);
}

/**
 * Settle the closure a dead connector still owes: when every recorded process object is absent from a readable process table, the row is
 * stopped with the child closure. Returns the refreshed record, or null when nothing is owed or an object may still live. Never throws.
 * io seams: table, now.
 */
export function settleGoneCustody(name, { env = process.env, io = {} } = {}) {
  try {
    const record = connectorState(name, env);
    if (!connectorChildUnresolved(record)) return null;
    const objects = recordedObjects(record);
    const table = (io.table ?? (() => processList({ cmdMax: 40 })))();
    if (!objects.length || !objects.every((identity) => objectGone(identity, table))) return null;
    const at = (io.now ?? Date.now)();
    const closure = { ok: true, proof: 'owned-child-process-exit', pid: record.childIdentity?.pid ?? null, launchNonce: record.childLaunchNonce ?? null, reason: 'process-gone-after-restart' };
    withMachine((m) => m.transaction(() => {
      const row = m.connectorOf(name);
      m.upsert('connectors', { name, state: 'stopped', pid: null, public_url: null, updated_at: at,
        config_json: { ...row.config, pid: null, childPid: null, connected: false, stoppedAt: new Date(at).toISOString(), childClosure: closure } }, ['name']);
    }), { env });
    return connectorState(name, env);
  } catch { return null; }
}
