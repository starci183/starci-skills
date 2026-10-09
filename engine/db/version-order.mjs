// version-order.mjs - dotted versions compared number by number.

const versionTuple = (v) => String(v).split('.').map(Number);

/** Whether dotted version `a` is older than `b` (missing parts count as 0). */
export function olderThan(a, b) {
  const x = versionTuple(a), y = versionTuple(b);
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  }
  return false;
}
