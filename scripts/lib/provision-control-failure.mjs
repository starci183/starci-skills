// provision-control-failure.mjs - why `starci provision <plan|show|accept>` could not read or accept a prepared operation, as one public code and one
// value-free detail line. Pure: the caller (scripts/gates/provision-operation.mjs runProvisionControl) names the stage that failed and passes the error;
// this never serializes an error message, which may quote a provider body or a value, only the error's own identifier.
// The case that motivated it: an operation prepared by a lane runtime keeps its plan blob in THAT runtime's blob store, and the published CLI reading it
// from another runtime found the ledger row but not the blob; a blanket `provision-control-unavailable` hid that.

/** The stages of the control verb, in the order it runs them. */
export const PROVISION_CONTROL_STAGES = Object.freeze(['ledger', 'plan', 'target', 'accept']);

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/u;
const SHA = /^[a-f0-9]{64}$/u;

/** The error's own code (ERR_SQLITE_ERROR, ENOENT) or class name, never its message; null when it has neither. */
export function errorIdentifier(error) {
  return [error?.code, error?.name].find((value) => typeof value === 'string' && IDENTIFIER.test(value)) ?? null;
}

/**
 * {code, detail} for a failure of the control verb at `stage`. A plan blob the ledger names but this runtime's blob store does not hold is
 * `provision-plan-blob-missing`; every other failure stays `provision-control-unavailable` with the stage and the error's identifier.
 */
export function provisionControlFailure(error, { stage, planSha = null, operationId = null } = {}) {
  if (!PROVISION_CONTROL_STAGES.includes(stage)) throw new TypeError(`unknown provision control stage: ${String(stage)}`);
  const id = errorIdentifier(error);
  if (stage === 'plan' && id === 'ENOENT') {
    const blob = typeof planSha === 'string' && SHA.test(planSha) ? `the plan blob ${planSha.slice(0, 12)}` : 'the plan blob';
    const operation = typeof operationId === 'string' && IDENTIFIER.test(operationId) ? ` of operation ${operationId}` : '';
    return { code: 'provision-plan-blob-missing', detail: `${blob}${operation} is not in this runtime's blob store: the operation was prepared by another runtime; run the control with the runtime that prepared it, or prepare the operation again with this one` };
  }
  const named = id ? ' (' + id + ')' : '';
  return { code: 'provision-control-unavailable', detail: `the ${stage} stage failed${named}; the operation journal holds its state` };
}
