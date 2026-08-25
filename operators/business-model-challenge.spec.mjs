import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './business/model/validate-output.mjs';

const session = 'session://tasks/business-task/';

function challengeSummary(verdict = 'ready', unresolvedCriticalIds = []) {
  return {
    stance: 'falsification-first',
    verdict,
    assumptionIds: ['assumption.customer-repeats'],
    counterexampleIds: ['counterexample.refund-after-value'],
    alternativeIds: ['alternative.narrow-scope'],
    failureModeIds: ['failure.partial-fulfilment'],
    falsificationTestIds: ['test.retention-cohort'],
    stakeholderConflictIds: ['conflict.customer-support'],
    unresolvedCriticalIds,
    recommendationChanged: false
  };
}

function validOutput() {
  return {
    schemaVersion: 6,
    runId: 'business-run',
    stage: 'business.publish',
    status: 'ready',
    facts: ['business-model-ready'],
    payload: {
      decision: 'ready',
      challengeSummary: challengeSummary(),
      state: {
        operator: 'business/model',
        status: 'completed',
        code: 'business-model-ready',
        retryable: false,
        emits: {
          stage: 'business.publish',
          status: 'ready',
          factsAdd: ['business-model-ready']
        }
      },
      produced: {
        businessModelRef: `${session}business-model`,
        durableWrites: []
      },
      context: {
        used: [{ kind: 'session-artifact', ref: `${session}evidence-pack`, revision: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }]
      },
      cleanup: {
        scratchRefs: [`${session}business-model`],
        retention: 'until-skill-terminal',
        purgeAt: 'skill-terminal'
      },
      evidenceRefs: [`${session}challenge-evidence`],
      findings: []
    }
  };
}

test('accepts a business model only after structured falsification has no critical residual', () => {
  assert.deepEqual(validateOutput(validOutput()), { valid: true, errors: [] });
});

test('rejects a ready business model with an unresolved critical challenge', () => {
  const output = validOutput();
  output.payload.challengeSummary.unresolvedCriticalIds = ['critical.value-not-proven'];
  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unresolvedCriticalIds/);
});

test('accepts an evidence-linked revise route when critique defeats the candidate', () => {
  const output = validOutput();
  output.stage = 'business.model';
  output.facts = ['business-model-feedback'];
  output.payload.decision = 'revise';
  output.payload.challengeSummary = challengeSummary('revise', ['critical.incentive-conflict']);
  output.payload.state.status = 'replan';
  output.payload.state.code = 'business-model-revise';
  output.payload.state.emits.stage = 'business.model';
  output.payload.state.emits.factsAdd = ['business-model-feedback'];
  assert.deepEqual(validateOutput(output), { valid: true, errors: [] });
});
