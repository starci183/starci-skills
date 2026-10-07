// orca-listing.mjs — the pure comparison of an `orca agent-context` command listing with a calls.yaml entry
// (modules/host/orca/calls.yaml liveSchema): scripts/api/orca/lib.mjs refuses a mutation the live host does not offer,
// scripts/api/orca/agent-context.mjs answers the listing, scripts/checks/check-providers.mjs --live compares every entry. Pure.

const USAGE_FLAG_BREAK = new RegExp([
  String.raw`\s+-`,
  '-?',
].join(''));
const commandName = (c) => {
  if (typeof c === 'string') return c;
  if (typeof c?.command === 'string') return c.command;
  if (typeof c?.name === 'string') return c.name;
  if (typeof c?.usage === 'string') return c.usage.split(USAGE_FLAG_BREAK)[0].trim();
  return null;
};

function liveFlags(c) {
  const out = new Set();
  if (!c || typeof c !== 'object') return out;
  const raw = c.flags ?? c.options ?? c.arguments ?? [];
  for (const f of Array.isArray(raw) ? raw : Object.keys(raw)) {
    const name = typeof f === 'string' ? f : (f?.flag ?? f?.name ?? f?.long ?? null);
    if (typeof name === 'string') out.add(name.replace(/^--?/, '').split(/[\s=,]/)[0]);
  }
  return out;
}

/** An agent-context `commands` array as Map<command, Set<flag>>, or null. */
export function listingOf(commands) {
  if (!Array.isArray(commands)) return null;
  const listing = new Map();
  for (const c of commands) {
    const name = commandName(c);
    if (name) listing.set(name, liveFlags(c));
  }
  return listing.size ? listing : null;
}

/** The commands a calls.yaml `entry` requires of `listing`, or null when it satisfies them. `jsonFlag` is never required. */
export function missingFrom(listing, entry, jsonFlag = 'json') {
  if (!listing) return { listing: 'unreadable' };
  const flags = listing.get(entry?.command);
  if (!flags) return { command: entry?.command ?? null };
  const missing = (entry.flags ?? []).filter((f) => f !== jsonFlag && !flags.has(f));
  return missing.length ? { command: entry.command, flags: missing } : null;
}
