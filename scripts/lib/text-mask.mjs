// text-mask.mjs - preserve line positions while hiding a selected source range from scanners.

/** Replace every non-newline character in [from, to) with a space. */
export const maskTextRange = (text, from, to) =>
  `${text.slice(0, from)}${text.slice(from, to).replace(/[^\r\n]/g, ' ')}${text.slice(to)}`;
