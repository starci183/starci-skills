// text-mask.mjs - preserve line positions while hiding a selected source range from scanners.

/** Replace every non-newline character in [from, to) with a space. */
export const maskTextRange = (text, from, to) =>
  `${text.slice(0, from)}${text.slice(from, to).replace(/[^\r\n]/g, ' ')}${text.slice(to)}`;

/** Blank a mutable source buffer in place, preserving newline offsets. */
export function maskSourceRange(buffer, from, to) {
  for (let at = from; at < to; at++) if (buffer[at] !== '\n' && buffer[at] !== '\r') buffer[at] = ' ';
}
