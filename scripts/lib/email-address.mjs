/** Validate a declared email's basic shape without changing its bytes or accepting a leading domain dot. */
export function emailAddress(value) {
  if (typeof value !== 'string' || /\s/u.test(value)) return false;
  const parts = value.split('@');
  if (parts.length !== 2 || !parts[0]) return false;
  const dot = parts[1].indexOf('.');
  return dot > 0 && dot < parts[1].length - 1;
}
