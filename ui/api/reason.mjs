export function reason(code, params = {}, raw = undefined) {
  return raw === undefined ? { code, params } : { code, params, raw };
}
