// same-text.mjs - text equality that ignores the line-ending form and a trailing blank tail (a git runner may trim stdout, a work tree may
// carry CRLF): the one comparison the database rules use for a committed file against its base or against a regenerated one.

/** True when both texts exist and are equal once CRLF is folded to LF and trailing whitespace at the end is dropped. */
export const sameText = (a, b) => a !== null && b !== null && a.replace(/\r\n/g, '\n').trimEnd() === b.replace(/\r\n/g, '\n').trimEnd();
