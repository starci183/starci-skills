// regex.mjs - building a RegExp from text.

/** `text` with every regular-expression metacharacter escaped, so it matches itself literally. */
export const escapeRegExp = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
