// clip.mjs — shortening text for a message, a log line or a finding.

/** `text` cut to at most `n` characters; a cut text ends in an ellipsis. */
export const clip = (text, n) => { const s = String(text ?? ''); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/** `text` squashed to one line: whitespace runs collapsed, ends trimmed. */
export const squash = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

/** `text` on one line (whitespace runs collapsed, ends trimmed), cut to at most `n` characters. */
export const clipLine = (text, n) => clip(squash(text), n);

/** `text` on one line (whitespace runs collapsed, ends trimmed), cut to at most `n` characters — a plain cut, no ellipsis. */
export const oneLine = (text, n = 380) => squash(text).slice(0, n);

/** The last `n` lines of `text` (ends trimmed) joined with `join`, cut to at most `max` characters. */
export const tailLines = (text, n = 30, { join = '\n', max = Infinity } = {}) => {
  const tail = String(text ?? '').trim().split(/\r?\n/).slice(-n).join(join);
  return Number.isFinite(max) ? tail.slice(0, max) : tail;
};
