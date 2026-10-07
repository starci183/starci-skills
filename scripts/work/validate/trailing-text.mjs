// Trimming the end of a string for the Work validators: a run of characters at the end is cut by one scan from the
// end, not by a `[...]+$` pattern that rescans a long run from every start.

/** `text` without its trailing run of characters taken from `chars`. */
export const trimTrailing = (text, chars) => text.slice(0, text.split('').findLastIndex((unit) => !chars.includes(unit)) + 1);
