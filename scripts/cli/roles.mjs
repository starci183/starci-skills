// roles.mjs - who is calling a verb. The rights role of the caller comes from scripts/guards/rights.mjs (the bound job or
// seat guard of its Orca terminal, or STARCI_ROLE); this module only maps it onto the roles a verb declares.
import { boundGuard, boundSeat, rightsRoleOf } from '../guards/rights.mjs';
import { hostLockOwner } from '../machine/host-lock.mjs';
import { rolesContract } from '../machine/roles-contract.mjs';
import { runtimeChangeRefusal } from '../machine/runtime-change.mjs';

export const ROLES = ['worker', 'lead', 'coordinator', 'release', 'owner'];

// The rights vocabulary (op, supervisor, lead, coordinator, release) onto the verb vocabulary: an op is a worker, the
// supervisor and the kernel act as leads, and no rights role at all is the unrestricted owner.
const VERB_ROLE = Object.freeze({ op: 'worker', supervisor: 'lead', lead: 'lead', coordinator: 'coordinator', release: 'release', critic: 'critic' });

/** Resolve the caller role; an absent or unknown rights role is the unrestricted owner seat. */
export function currentRole({ env = process.env, root } = {}) {
  const handle = env.ORCA_TERMINAL_HANDLE;
  const guard = boundGuard(handle, { root, env });
  const seat = guard ? null : boundSeat(handle, { root, env });
  const claimsRelease = String(env.STARCI_ROLE ?? '').toLowerCase() === 'release';
  const lockOwner = claimsRelease ? hostLockOwner({ env }) : null;
  return VERB_ROLE[rightsRoleOf({ guard, seat, env, lockOwner })] ?? 'owner';
}

/** The refusal an Op gets for a verb that addresses a role above its Kernel: a typed code that names the Kernel as the addressee. */
const OP_ADDRESS_CODE = 'OP_REPORTS_TO_KERNEL';
function opAddressRefusal(group, verb) {
  const { chain } = rolesContract();
  if (!chain.opMayNotAddress.includes(group)) return null;
  return `starci ${group} ${verb}: ${OP_ADDRESS_CODE}: an Op reports only to its Kernel, never to the ${group}; use ${chain.opRefusal.use}`;
}

/** Return the stable role-refusal text, or null when this role may invoke the verb. */
export function requireRole({ role, group, verb, roles }) {
  if (role === 'owner' || roles.includes(role)) return null;
  const change = role === 'lead' ? runtimeChangeRefusal([group, verb]) : null;
  if (change) return `starci ${group} ${verb}: ${change.code}: ${change.reason}; ${change.remedy}`;
  if (role === 'worker') return opAddressRefusal(group, verb) ?? `starci ${group} ${verb}: role ${role} may not run this (allowed: ${roles.join(', ')})`;
  return `starci ${group} ${verb}: role ${role} may not run this (allowed: ${roles.join(', ')})`;
}
