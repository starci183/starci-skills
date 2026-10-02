// verb-call.mjs - shared normalization for external-call results returned to function-backed verbs.

/** Whether a spawn-style result succeeded, with opt-ins for the few legacy result shapes. */
export const resultOk = (result, { acceptOk = true, codeFallback = false } = {}) => {
  if (!result) return false;
  const status = result.status ?? (codeFallback ? result.code : undefined);
  return Boolean(acceptOk && result.ok !== undefined ? result.ok : !result.error && status === 0);
};

/** Trimmed stdout or stderr from either the standard or compact call-result shape. */
export const resultOutput = (result, key = 'stdout') =>
  String(result?.[key] ?? (key === 'stdout' ? result?.out : result?.err) ?? '').trim();

/** A bounded diagnostic from stderr or the call error, optionally reduced to its final line. */
export const resultDetail = (result, { limit = 500, lastLine = false } = {}) => {
  const value = String(result?.stderr ?? result?.error?.message ?? '').trim();
  const detail = lastLine ? (value.split(/\r?\n/).at(-1) ?? '') : value;
  return limit == null ? detail : detail.slice(0, limit);
};

/** Build a typed verb refusal with its command prefix and machine payload. */
export const refusal = (prefix, text, code = 2, data = {}) => ({
  code,
  text: `${prefix}: ${text}`,
  data,
});

/** Trimmed non-empty lines of text. */
export const lines = (text) => String(text ?? '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

/** A failed command result represented as a ladder finding. */
export const failedRunFinding = (kind, subject, run, { limit = 2000 } = {}) => ({
  kind,
  ...subject,
  status: run.status,
  message: (run.stderr || run.stdout || `${Object.values(subject)[0]} exited ${run.status}`).trim().slice(-limit),
});
