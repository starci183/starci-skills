// imagegen-codes.mjs — the typed refusals of `starci work imagegen` (catalogued in modules/kernel/failure-codes.yaml). A refusal
// is a result the op reports, never a thrown error; the kernel's incident policy decides any retry.

export const IMAGEGEN_CODES = Object.freeze({
  badInput: 'IMAGEGEN_BAD_INPUT',
  outsideWorktree: 'IMAGEGEN_OUT_OF_WORKTREE',
  quota: 'IMAGEGEN_QUOTA',
  capacity: 'IMAGEGEN_CAPACITY',
  unavailable: 'IMAGEGEN_UNAVAILABLE',
  runnerFailed: 'IMAGEGEN_RUNNER_FAILED',
  timeout: 'IMAGEGEN_TIMEOUT',
  noOutput: 'IMAGEGEN_NO_OUTPUT',
});

const BY_KIND = { quota: IMAGEGEN_CODES.quota, capacity: IMAGEGEN_CODES.capacity };

/** The code of an admission refusal kind (call-admission.mjs refusalKind): quota, capacity, else unavailable. */
export const codeOfAdmissionKind = (kind) => BY_KIND[kind] ?? IMAGEGEN_CODES.unavailable;

/** The code of a runner failure class (codex-exec-events.mjs failureClass): a usage limit is quota, a missing login is unavailable. */
export const codeOfFailureClass = (failureClass) => {
  if (failureClass === 'quota') return IMAGEGEN_CODES.quota;
  return failureClass === 'auth' ? IMAGEGEN_CODES.unavailable : IMAGEGEN_CODES.runnerFailed;
};

/** A refusal result: {ok:false, code, detail, ...extra}. */
export const refusal = (code, detail, extra = {}) => ({ ok: false, code, detail, ...extra });
