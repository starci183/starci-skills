// terminal-identity.mjs — which agent provider a terminal runs, read from the terminal's own metadata, its title and its frame.

const TERMINAL_PROVIDERS = Object.freeze(['claude', 'codex', 'devin', 'cursor']);
const identityText = (value) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const namedProviders = (text) => TERMINAL_PROVIDERS.filter((provider) => new RegExp(String.raw`\b${provider}\b`, 'i').test(text));

// The identity fields of a terminal entry: [{source, text}] over its agentIdentity/agent/provider/agentType metadata.
function identityFieldsOf(entry) {
  const fields = [];
  for (const key of ['agentIdentity', 'agent', 'provider', 'agentType']) {
    const value = entry?.[key];
    if (value && typeof value === 'object') {
      for (const field of ['agent', 'provider', 'agentType', 'type', 'id']) {
        const text = identityText(value[field]);
        if (text) fields.push({ source: `${key}.${field}`, text });
      }
    } else {
      const text = identityText(value);
      if (text) fields.push({ source: key, text });
    }
  }
  return fields;
}

// The provider the metadata fields name outright: a conflict, one attested provider, or null.
function attestedIdentity(fields, raw) {
  const explicit = fields.filter(({ text }) => TERMINAL_PROVIDERS.includes(text));
  const providers = [...new Set(explicit.map(({ text }) => text))];
  if (providers.length > 1) return { provider: null, proof: 'unknown', source: 'metadata', raw, reason: 'identity-conflict' };
  if (providers.length === 1) return { provider: providers[0], proof: 'attested', source: explicit[0].source, raw, reason: null };
  return null;
}

// The provider a label hints at: ambiguous (more than one named), heuristic (one named) or null.
function hintedIdentity(text, { source, raw }, { ambiguous, hinted: hintedAs }) {
  const hinted = namedProviders(text);
  if (hinted.length > 1) return { provider: null, proof: 'unknown', source, raw, ...ambiguous };
  if (hinted.length === 1) return { provider: hinted[0], proof: 'heuristic', source, raw, ...hintedAs };
  return null;
}

/**
 * Pure terminal provider facts from explicit metadata, then title/frame cues.
 * attested means a recognized explicit metadata field, not cryptographic or
 * authorization proof; consumers separately decide which evidence may act.
 */
export function terminalIdentityOf(entry, { screen = '' } = {}) {
  const fields = identityFieldsOf(entry);
  const raw = fields[0]?.text ?? '';
  const attested = attestedIdentity(fields, raw);
  if (attested) return attested;
  for (const field of fields) {
    const hint = hintedIdentity(field.text, { source: field.source, raw }, { ambiguous: { reason: 'identity-ambiguous' }, hinted: { reason: 'metadata-label' } });
    if (hint) return hint;
  }
  const title = [entry?.title, entry?.tabTitle, entry?.paneTitle].map(identityText).filter(Boolean).join(' ');
  const titled = hintedIdentity(title, { source: 'title', raw }, { ambiguous: { reason: 'title-ambiguous' }, hinted: { reason: 'title-label' } });
  if (titled) return titled;
  if (/esc\s+twice\s+to\s+interrupt|Ask Devin\b/i.test(String(screen ?? ''))) {
    return { provider: 'devin', proof: 'heuristic', source: 'screen', raw, reason: 'frame-cue' };
  }
  return { provider: null, proof: 'unknown', source: null, raw, reason: 'provider-unresolved' };
}
