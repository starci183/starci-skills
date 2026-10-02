// number.mjs — the "a configured value is a usable number" coercion the settings readers share:
// finite, past the bound, else the caller's fallback.

/**
 * `value` as a number when `Number(value)` is finite and positive (`orZero: true` admits 0), else
 * `fallback`. `int: true` truncates first so a fractional setting reads as its whole part.
 */
export const positiveNumber = (value, fallback = null, { orZero = false, int = false } = {}) => {
  const n = int ? Math.trunc(Number(value)) : Number(value);
  return Number.isFinite(n) && (orZero ? n >= 0 : n > 0) ? n : fallback;
};
