import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  approved: { stage: 'fe.request.review.result', status: 'complete', operatorStatus: 'completed', code: 'fe-request-review-approved', factsAdd: ['feedback-request-reviewed'] },
  rejected: { stage: 'fe.request.review.result', status: 'complete', operatorStatus: 'completed', code: 'fe-request-review-rejected', factsAdd: ['feedback-request-reviewed'] },
  blocked: { stage: 'fe.request.review.blocked', status: 'blocked', operatorStatus: 'blocked', code: 'fe-request-review-blocked', factsAdd: ['feedback-request-review-blocked'] }
};

const sameStrings = (left, right) => {
  const a = [...left].sort();
  const b = [...right].sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
};

function semanticErrors(value) {
  const errors = [];
  const expected = outcomes[value.payload.decision];
  if (!expected) return ['$.payload.decision: unknown decision'];
  const { state, produced } = value.payload;
  if (value.stage !== expected.stage || value.status !== expected.status) errors.push('$: root state does not match decision');
  if (state.status !== expected.operatorStatus || state.code !== expected.code) errors.push('$.payload.state: status or code does not match decision');
  if (state.emits.stage !== expected.stage || state.emits.status !== expected.status) errors.push('$.payload.state.emits: route does not match decision');
  if (!sameStrings(state.emits.factsAdd, expected.factsAdd) || state.emits.factsRemove.length) errors.push('$.payload.state.emits: fact delta does not match decision');
  for (const fact of expected.factsAdd) if (!value.facts.includes(fact)) errors.push(`$.facts: missing emitted fact ${fact}`);
  if (value.payload.decision === 'blocked' && produced.mutations.length) errors.push('$.payload.produced.mutations: blocked cannot claim a mutation');
  if (value.payload.decision !== 'blocked' && produced.mutations.length !== 1) errors.push('$.payload.produced.mutations: completed review requires exactly one request upsert');
  for (const mutation of produced.mutations) {
    if (!mutation.path.startsWith('.claude/requests/')) errors.push('$.payload.produced.mutations: path escaped .claude/requests');
    if (mutation.reviewDecision !== value.payload.decision) errors.push('$.payload.produced.mutations: review decision mismatch');
  }
  const taskMatch = value.payload.evidenceRefs[0]?.match(/^session:\/\/tasks\/([^/]+)\//);
  if (!taskMatch) errors.push('$.payload.evidenceRefs: cannot determine task ownership');
  else {
    const prefix = `session://tasks/${taskMatch[1]}/`;
    const refs = [...value.payload.evidenceRefs, ...value.payload.cleanup.scratchRefs, ...produced.artifactRefs, ...value.payload.context.used.map((item) => item.ref)];
    for (const ref of refs) if (!ref.startsWith(prefix)) errors.push(`$: session ref is outside output task: ${ref}`);
  }
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semanticErrors);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
