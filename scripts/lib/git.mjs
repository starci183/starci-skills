// git.mjs — pure helpers over git's text output. The git spawn itself lives in scripts/api/git/lib.mjs.

/**
 * git's C-quoted diff path decoded - `"b\303\251"` a `+++ ` header line prints when core.quotePath
 * covers the name. Octal escapes become \u00XX for JSON.parse (which answers \n, \t, \" and \\);
 * a value not wrapped in quotes passes through unchanged.
 */
export const unquoteDiffPath = (value) =>
  /^".*"$/.test(value)
    ? JSON.parse(value.replace(/\\([0-7]{3})/g, (_, octal) => `\\u00${Number.parseInt(octal, 8).toString(16).padStart(2, '0')}`))
    : value;
