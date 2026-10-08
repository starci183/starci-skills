// Own-seat lifecycle admission for R223; the policy table owns the verbs, roles, types and options.
const optionsOf = (args, entry) => {
  const values = new Set(entry.values ?? []), flags = new Set(entry.flags ?? []);
  const options = new Map();
  for (let i = 0; i < args.length; i += 1) {
    const word = args[i], at = word.indexOf('=');
    const name = at < 0 ? word : word.slice(0, at);
    if (options.has(name)) return null; // Ambiguous identities/types never qualify, even if repeated identically.
    if (flags.has(name) && at < 0) { options.set(name, true); continue; }
    if (!values.has(name)) return null; // No positionals, terminators or unknown identity-changing options.
    const value = at < 0 ? args[++i] : word.slice(at + 1);
    if (value == null || (at < 0 && value.startsWith('--'))) return null;
    options.set(name, value);
  }
  return options;
};

/** True only for a policy-listed lifecycle call whose explicit identity equals the trusted caller handle. */
export function orcaSelfLifecycleAllowed({ role, args, handle, policy }) {
  const lifecycle = policy.orca?.['self-lifecycle'];
  if (!handle || args[0] !== lifecycle?.group || !lifecycle.roles?.includes(role)) return false;
  const entry = lifecycle.verbs?.[args[1]];
  if (!entry || (entry.roles && !entry.roles.includes(role))) return false;
  const options = optionsOf(args.slice(2), entry);
  if (!options || options.get(entry.identity) !== handle) return false;
  const types = entry.typesByRole?.[role] ?? entry.types;
  return !types || types.includes(options.get('--type'));
}

/**
 * The option a role may not use on a policy-listed lifecycle call ('refuse-for' in the policy entry), or null: an Op that names
 * a recipient (--to) or another Run (--run) addresses someone other than its own Kernel.
 */
export function orcaAddressedOption({ role, args, policy }) {
  const lifecycle = policy.orca?.['self-lifecycle'];
  if (args[0] !== lifecycle?.group) return null;
  const refused = lifecycle.verbs?.[args[1]]?.['refuse-for']?.[role] ?? [];
  return args.slice(2).map((word) => String(word).split('=', 1)[0]).find((name) => refused.includes(name)) ?? null;
}
