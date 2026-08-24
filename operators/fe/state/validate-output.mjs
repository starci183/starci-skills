import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  "state-model-ready": {
    "key": "state-model-ready",
    "stage": "layout.generate",
    "status": "ready",
    "operatorStatus": "completed",
    "code": "fe-state-state-model-ready",
    "retryable": false,
    "factsAdd": [
      "state-model-ready",
      "neutral-facts-ready"
    ],
    "factsRemove": []
  },
  "blocked": {
    "key": "blocked",
    "stage": "state.result",
    "status": "blocked",
    "operatorStatus": "blocked",
    "code": "fe-state-blocked",
    "retryable": false,
    "factsAdd": [
      "sensitive-state-unknown"
    ],
    "factsRemove": []
  }
};
const successfulDecisions = new Set(["state-model-ready"]);

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


  if (success && produced.artifactRefs.length === 0) errors.push('$.payload.produced.artifactRefs: successful analysis requires a session artifact reference');

  const taskMatch = payload.evidenceRefs[0]?.match(/^session:\/\/tasks\/([^/]+)\//);
  if (!taskMatch) errors.push('$.payload.evidenceRefs: cannot determine task ownership');
  else {
    const prefix = `session://tasks/${taskMatch[1]}/`;
    const refs = [...payload.evidenceRefs, ...payload.cleanup.scratchRefs, ...payload.produced.artifactRefs, ...payload.produced.externalEffects.map((item) => item.evidenceRef)];
    for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside output task: ${ref}`);
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
}
