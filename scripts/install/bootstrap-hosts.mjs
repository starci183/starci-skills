// bootstrap-hosts.mjs - the one list of the host bootstrap files an install writes at the repository root: AGENTS.md always (the
// canonical write), CLAUDE.md and DEVIN.md only when the host names them (`--hosts claude,devin` or `all`), as byte-identical copies of
// init/AGENTS.md. The installer (install.mjs) writes from this list and `starci runtime check --only entry` (scripts/checks/check-entry.mjs) reads it.
export const HOST_BOOTSTRAP_FILES = { agents: 'AGENTS.md', claude: 'CLAUDE.md', devin: 'DEVIN.md' };

/** A `--hosts` value ("claude,devin", "all") as host names; throws on a name this list does not know. */
export function parseHosts(value) {
  const hosts = String(value ?? '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
  const known = new Set([...Object.keys(HOST_BOOTSTRAP_FILES), 'all']);
  const bad = hosts.filter((h) => !known.has(h));
  if (bad.length) throw new Error(`unknown --hosts value ${bad.join(', ')}; expected a comma list of ${[...known].join(', ')}`);
  if (hosts.includes('all')) return Object.keys(HOST_BOOTSTRAP_FILES);
  return hosts;
}
