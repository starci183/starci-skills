// roles.mjs - who is calling a verb. The rights role of the caller comes from scripts/guards/rights.mjs (the bound job or
// seat guard of its Orca terminal, or STARCI_ROLE); this module only maps it onto the roles a verb declares.
import { boundGuard, boundSeat, rightsRoleOf } from '../guards/rights.mjs';
import { hostLockOwner } from '../machine/host-lock.mjs';

export const ROLES = ['worker', 'lead', 'coordinator', 'release', 'owner'];

// The rights vocabulary (op, supervisor, lead, coordinator, release) onto the verb vocabulary: an op is a worker, the
// supervisor and the kernel act as leads, and no rights role at all is the unrestricted owner.
const VERB_ROLE = Object.freeze({ op: 'worker', supervisor: 'lead', lead: 'lead', coordinator: 'coordinator', release: 'release' });

/** Resolve the caller role; an absent or unknown rights role is the unrestricted owner seat. */
export function currentRole({ env = process.env, root } = {}) {
  const handle = env.ORCA_TERMINAL_HANDLE;
  const guard = boundGuard(handle, { root, env });
  const seat = guard ? null : boundSeat(handle, { root, env });
  const claimsRelease = String(env.STARCI_ROLE ?? '').toLowerCase() === 'release';
  const lockOwner = claimsRelease ? hostLockOwner({ env }) : null;
  return VERB_ROLE[rightsRoleOf({ guard, seat, env, lockOwner })] ?? 'owner';
}

/** Return the stable role-refusal text, or null when this role may invoke the verb. */
export function requireRole({ role, group, verb, roles }) {
  if (role === 'owner' || roles.includes(role)) return null;
  return `starci ${group} ${verb}: role ${role} may not run this (allowed: ${roles.join(', ')})`;
}
