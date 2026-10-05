// The exact-identity stop call; never infer custody from a PID alone.
import { ownedProcess as call } from './owned-process.mjs';
import { OWNED_PROCESS_SCHEMA, validProcessIdentity as validIdentity } from '../../lib/process-identity.mjs';

/** Stop only the process object whose immutable birth and executable were captured by its owner; a signaled handle proves closure, not descendant closure. */
export function stopOwnedProcess(identity, options = {}) {
  if (!validIdentity(identity)) return { schema: OWNED_PROCESS_SCHEMA, pid: identity?.pid ?? null, ok: false, outcome: 'refused', reason: 'process-custody-required', identity: identity ?? null };
  return call(identity.pid, { ...options, identity });
}
