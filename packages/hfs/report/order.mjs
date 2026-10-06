// order.mjs - the one code-unit comparator of @starci/hfs: the order Array.prototype.sort gives without a compare function (UTF-16 code units), named so the digests, emitted files and reports that depend on it stay byte-identical.
export const byCodeUnit = (a, b) => { const l = String(a), r = String(b); return l < r ? -1 : l > r ? 1 : 0; };
