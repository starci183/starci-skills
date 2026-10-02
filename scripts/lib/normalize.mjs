// normalize.mjs — text in compare form for matching (phrase hits, repeated questions).

/**
 * `s` normalized for a literal compare: Unicode `form`-normalized, lowercased, whitespace runs to a
 * single space, ends trimmed; `punct: true` also drops trailing sentence punctuation.
 */
export const normalizeText = (s, { form = 'NFC', punct = false } = {}) => {
  const out = String(s ?? '').normalize(form).toLowerCase().replace(/\s+/g, ' ').trim();
  return punct ? out.replace(/[\s.?!:;,]+$/, '') : out;
};
