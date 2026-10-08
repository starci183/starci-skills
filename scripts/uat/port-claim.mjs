// port-claim.mjs — the record of who asked for a local TCP port and who got it. A dev server of an environment (`starci gate env-health serve`
// or a restart by `check --restart`) claims the port its probe names. Each claim leaves one `signal.port-claim` row: the port, the claimant
// (<environment>/<service>), the outcome and the holder.
//   claimed   the port was free and the claimant's server now holds it
//   adopted   the port was held by the claimant's own server, which already answers; it keeps the port
//   replaced  the port was held by a stale server of this workspace; it was stopped for the claimant (`previous` names the claimant it belonged to)
//   refused   the port is held by a process that is not this workspace's server; the claimant does not get it
//   released  the claimant's server did not come up and gives the port back
// A port is observed twice, because the list of listeners and a bind each miss a holder on Windows (a bind succeeds on a taken 127.0.0.1 port
// when the holder bound another address): the listener the host lists, and whether a connect to 127.0.0.1:<port> is accepted. A port nobody lists
// but a connect reaches is held by a stranger, and the claim is refused.
import { probe as probeUrl } from '../api/http/probe.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import { SIGNAL, recordSignal } from '../machine/debug-signals.mjs';

const CONNECT_PROBE_MS = 2000;

/** The claimant name of an environment service. */
const claimantOf = (envId, service) => `${envId}/${service}`;

/** Whether something accepts a connection on 127.0.0.1:<port>: true, false, or null when the probe could not tell. */
export async function connectsTo(port, { probe = probeUrl } = {}) {
  if (!Number.isInteger(port)) return null;
  const answer = await probe(`http://127.0.0.1:${port}/`, { timeoutMs: CONNECT_PROBE_MS, follow: 0 });
  if (answer.state === 'answered' || answer.state === 'hung') return true;
  return answer.state === 'down' ? false : null;
}

/** The claimant whose live server row names `port`, other than `mine`, or null (the registry's last word on who held it). */
function registeredHolder(port, mine, env) {
  const row = readMachine((m) => m.envServers({ live: true }).find((r) => Number(r.port) === port && r.server_id !== mine), null, { env });
  return row ? claimantOf(row.env, row.service) : null;
}

/**
 * The recorder of one claimant's claim on `port`: `(outcome, holder) => Promise`. `holder` is the listener {pid} the host lists (or the pid of the
 * claimant's own new server). The row carries pids and names, never a command line.
 */
export function portClaimer({ port, envId, service, env = process.env, probe = probeUrl }) {
  const claimant = claimantOf(envId, service);
  return async (outcome, holder = null) => {
    if (!Number.isInteger(port)) return 0;
    const connects = ['adopted', 'replaced', 'refused'].includes(outcome) ? await connectsTo(port, { probe }) : null;
    const previous = outcome === 'replaced' || outcome === 'refused' ? registeredHolder(port, `${envId}__${service}`, env) : null;
    return recordSignal(SIGNAL.portClaim, `${claimant} ${outcome} port ${port}`, { port, claimant, outcome, holderPid: holder?.pid ?? null, connects, previous }, { env });
  };
}
