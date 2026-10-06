// by-code-unit.mjs - the comparator of a bare `Array.prototype.sort()`, owned beside the engine files that digest and canonicalize (scripts/lib/list.mjs re-exports it).

/**
 * The comparator of a bare `Array.prototype.sort()`: values compared as strings by UTF-16 code unit. Pass it to `sort` and
 * `toSorted` so the order is stated, and stays byte-identical to the default order that digests and canonical output depend on.
 */
export const byCodeUnit = (a, b) => {
  const left = String(a);
  const right = String(b);
  if (left < right) return -1;
  return left > right ? 1 : 0;
};
