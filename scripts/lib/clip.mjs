// clip.mjs — shortening text for a message, a log line or a finding.

/** `text` cut to at most `n` characters; a cut text ends in an ellipsis. */
export const clip = (text, n) => { const s = String(text ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** `text` on one line (whitespace runs collapsed, ends trimmed), cut to at most `n` characters. */
export const clipLine = (text, n) => clip(String(text ?? '').replace(/\s+/g, ' ').trim(), n);
