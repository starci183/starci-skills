// provider.mjs — the provider id spelling every quota/probe lookup shares: lowercase, trimmed, the
// '-agent' adapter suffix dropped ('claude-agent' and 'claude' name one provider).

/** The canonical provider id of `provider` (lower case, no '-agent' suffix). */
export const normalizeProvider = (provider) => String(provider ?? '').trim().toLowerCase().replace(/-agent$/, '');
