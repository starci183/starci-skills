// normalize.mjs — text in compare form for matching (phrase hits, repeated questions).

const SENTENCE_TRAILING_CHAR = /[\s.?!:;,]/;

/** `text` without its trailing run of characters that `chars` (a one-character pattern) matches; a loop, not a trailing-run regex. */
export const trimTrailingChars = (text, chars) => {
  let end = text.length;
  while (end > 0 && chars.test(text[end - 1])) end -= 1;
  return text.slice(0, end);
};

/** `text` without the run of `ch` (one character) at each end; loops, not an anchored-run regex. */
export const trimEdgeChar = (text, ch) => {
  let start = 0, end = text.length;
  while (start < end && text[start] === ch) start += 1;
  while (end > start && text[end - 1] === ch) end -= 1;
  return text.slice(start, end);
};

/**
 * `s` normalized for a literal compare: Unicode `form`-normalized, lowercased, whitespace runs to a
 * single space, ends trimmed; `punct: true` also drops trailing sentence punctuation.
 */
export const normalizeText = (s, { form = 'NFC', punct = false } = {}) => {
  const out = String(s ?? '').normalize(form).toLowerCase().replace(/\s+/g, ' ').trim();
  return punct ? trimTrailingChars(out, SENTENCE_TRAILING_CHAR) : out;
};
