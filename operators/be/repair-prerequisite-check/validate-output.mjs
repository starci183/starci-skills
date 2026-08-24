import { runValidatorCli, validatorFor } from '../../validation.mjs';

const outcomes = {
  ready: ['be.coding-scope', 'ready', 'completed', 'repair-prerequisites-ready', 'backend-repair-prerequisites-ready', false],
  'route-required': ['request.received', 'ready', 'replan', 'repair-route-required', 'workspace-route-required', true],
  'business-refresh-required': ['business.freshness', 'ready', 'replan', 'repair-business-refresh-required', 'business-refresh-required', true],
  'replan-required': ['architecture.boundary', 'ready', 'replan', 'repair-boundary-replan-required', 'repair-approval-stale', true],
  blocked: ['be.blocked', 'blocked', 'blocked', 'repair-prerequisites-blocked', 'backend-repair-prerequisite-blocked', false]
};

function semantic(value) {
  const errors = [];
  const expected = outcomes[value.payload.decision];
  if (!expected) return ['$.payload.decision: undeclared decision'];
  const [stage, status, state, code, fact, retryable] = expected;
  if (value.stage !== stage || value.status !== status) errors.push('$: decision route mismatch');
  if (value.payload.state.status !== state || value.payload.state.code !== code || value.payload.state.retryable !== retryable) errors.push('$.payload.state: decision semantics mismatch');
  if (value.payload.state.emits.stage !== stage || value.payload.state.emits.status !== status) errors.push('$.payload.state.emits: root route mismatch');
  if (!value.facts.includes(fact) || !value.payload.state.emits.factsAdd.includes(fact)) errors.push(`$.facts: missing ${fact}`);
  const receipt = value.payload.produced.prerequisiteReceiptRef;
  if (value.payload.decision === 'ready' && receipt === null) errors.push('$.payload.produced.prerequisiteReceiptRef: ready requires receipt');
  if (value.payload.decision !== 'ready' && receipt !== null) errors.push('$.payload.produced.prerequisiteReceiptRef: non-ready cannot claim receipt');
  return errors;
}

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
