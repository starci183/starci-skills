// Trimming the end of a string for the Work validators: a run of characters at the end is cut by one scan from the
// end, not by a `[...]+$` pattern that rescans a long run from every start.

/** `text` without its trailing run of characters taken from `chars`. */
export const trimTrailing = (text, chars) => {
  let end = text.length;
  while (end > 0 && chars.includes(text[end - 1])) end -= 1;
  return text.slice(0, end);
};
