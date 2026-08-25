import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  "preflight-ready": {
    "key": "preflight-ready",
    "stage": "flow.generate",
    "status": "ready",
    "operatorStatus": "completed",
    "code": "fe-preflight-ready",
    "retryable": false,
    "factsAdd": [
      "preflight-complete",
      "business-fresh-receipt-ready"
    ],
    "factsRemove": []
  }
};
const successfulDecisions = new Set(["preflight-ready"]);

function sameStrings(left, right) {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function semanticErrors(value) {
  const errors = [];
  const payload = value.payload;
  const expected = outcomes[payload.decision];
  if (!expected) return ['$.payload.decision: unknown decision'];
  const state = payload.state;
  if (value.stage !== expected.stage || value.status !== expected.status) errors.push('$: decision does not match root emitted state');
  if (state.status !== expected.operatorStatus || state.code !== expected.code || state.retryable !== expected.retryable) errors.push('$.payload.state: status, code, or retryability does not match decision');
  if (state.emits.stage !== expected.stage || state.emits.status !== expected.status) errors.push('$.payload.state.emits: does not match root emitted state');
  if (!sameStrings(state.emits.factsAdd, expected.factsAdd) || !sameStrings(state.emits.factsRemove, expected.factsRemove)) errors.push('$.payload.state.emits: fact delta does not match decision');
  for (const fact of expected.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing emitted fact ${fact}`);
  for (const fact of expected.factsRemove) if (value.facts.includes(fact)) errors.push(`$.facts: retained removed fact ${fact}`);

  const produced = payload.produced;
  if (!successfulDecisions.has(payload.decision)) errors.push('$.payload.decision: output is not a successful preflight decision');

  const expectedKinds = ['business-freshness-receipt', 'request-receipt', 'workspace-route-receipt'];
  const actualKinds = payload.context.used.map((item) => item.kind);
  if (!sameStrings(actualKinds, expectedKinds)) errors.push('$.payload.context.used: exact receipt context set required');

  const taskMatch = payload.evidenceRefs[0]?.match(/^session:\/\/tasks\/([^/]+)\//);
  if (!taskMatch) errors.push('$.payload.evidenceRefs: cannot determine task ownership');
  else {
    const prefix = `session://tasks/${taskMatch[1]}/`;
    const refs = [...payload.evidenceRefs, ...payload.cleanup.scratchRefs, produced.preflightReceiptRef, produced.frozenScopeRef, ...payload.context.used.map((item) => item.ref)];
    for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside output task: ${ref}`);
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
