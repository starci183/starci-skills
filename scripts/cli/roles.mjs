// The RIGHTS lane replaces currentRole's body with seat detection; keep role resolution behind this one function.
export const ROLES = ['worker', 'lead', 'coordinator', 'release', 'owner'];

/** Resolve the caller role, defaulting unknown and absent environment values to the unrestricted owner seat. */
export function currentRole({ env } = {}) {
  return ROLES.includes(env?.STARCI_ROLE) ? env.STARCI_ROLE : 'owner';
}

/** Return the stable role-refusal text, or null when this role may invoke the verb. */
export function requireRole({ role, group, verb, roles }) {
  if (role === 'owner' || roles.includes(role)) return null;
  return `starci ${group} ${verb}: role ${role} may not run this (allowed: ${roles.join(', ')})`;
}
