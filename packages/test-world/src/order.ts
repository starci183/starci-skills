/** The order `Array.prototype.sort` gives without a compare function (UTF-16 code units), named: the signed strings and content hashes that depend on it stay byte-identical. */
export const byCodeUnit = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
