import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  "directions-ready": {
    "key": "directions-ready",
    "stage": "flow.review",
    "status": "pending",
    "operatorStatus": "pending",
    "code": "fe-customer-journey-directions-ready",
    "retryable": false,
    "factsAdd": [
      "flow-directions-ready"
    ],
    "factsRemove": [
      "flow-feedback-recorded"
    ]
  },
  "recommended-selected": {
    "key": "recommended-selected",
    "stage": "flow.review",
    "status": "approved",
    "operatorStatus": "completed",
    "code": "fe-customer-journey-recommended-selected",
    "retryable": false,
    "factsAdd": [
      "flow-directions-ready",
      "flow-approved",
      "recommended-flow-auto-selected"
    ],
    "factsRemove": [
      "flow-feedback-recorded"
    ]
  }
};
const successfulDecisions = new Set(["directions-ready", "recommended-selected"]);

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

  const success = successfulDecisions.has(payload.decision);
  const produced = payload.produced;
  if (!success && (produced.mutations.length || produced.externalEffects.length)) errors.push('$.payload.produced: non-success output cannot claim a durable effect');
  if (payload.decision === 'directions-ready' && produced.selectedJourneyRef !== null) errors.push('$.payload.produced.selectedJourneyRef: manual selection must remain null');
  if (payload.decision === 'recommended-selected' && !produced.selectedJourneyRef) errors.push('$.payload.produced.selectedJourneyRef: auto selection requires a selected journey ref');
  if (payload.decision === 'directions-ready' && produced.selectionPolicy !== 'manual') errors.push('$.payload.produced.selectionPolicy: pending output requires manual policy');
  if (payload.decision === 'recommended-selected' && produced.selectionPolicy !== 'auto-recommended') errors.push('$.payload.produced.selectionPolicy: approved output requires auto-recommended policy');

  const taskMatch = payload.evidenceRefs[0]?.match(/^session:\/\/tasks\/([^/]+)\//);
  if (!taskMatch) errors.push('$.payload.evidenceRefs: cannot determine task ownership');
  else {
    const prefix = `session://tasks/${taskMatch[1]}/`;
    const refs = [...payload.evidenceRefs, ...payload.cleanup.scratchRefs, payload.produced.journeyBatchRef, payload.produced.selectedJourneyRef].filter(Boolean);
    for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside output task: ${ref}`);
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
