import test from 'node:test';
import assert from 'node:assert/strict';
import { validateInput } from './workspace/workflow-handoff/validate-input.mjs';
import { validateOutput } from './workspace/workflow-handoff/validate-output.mjs';

const taskRef = (name) => `session://tasks/task-1/${name}`;

function publishInput() {
  return {
    schemaVersion: 7,
    operatorId: 'workspace/workflow-handoff',
    context: { routeReceiptRef: taskRef('route'), approvalRef: taskRef('approval'), touchedCheckoutRefs: [taskRef('checkout-fe')] },
    input: {
      operation: 'publish', missionId: 'interview-redesign', checkpointTag: null,
      resumeCapability: 'starci-fe-process', resumePoint: 'direction-generate',
      durableArtifactRefs: ['request:starci-academy/interview-redesign']
    }
  };
}

function completedOutput(outcome = 'published') {
  return {
    schemaVersion: 7,
    operatorId: 'workspace/workflow-handoff',
    output: {
      outcome,
      resultKind: outcome === 'resumed' ? 'resumed-checkpoint' : 'published-checkpoint',
      checkpointTag: 'starci-workflow/interview-redesign/20260826-1',
      sourcePushRefs: ['git:abc1234'],
      resumeCapability: 'starci-fe-process',
      resumePoint: 'ui.direction.generate',
      receiptRef: taskRef('proof'), evidenceRefs: [taskRef('proof')], findings: [], reason: null
    }
  };
}

test('accepts a minimal publish checkpoint without conversational context', () => {
  assert.deepEqual(validateInput(publishInput()), { valid: true, errors: [] });
});

test('rejects session-only artifacts from the portable continuation manifest', () => {
  const value = publishInput();
  value.input.durableArtifactRefs = [taskRef('design')];
  assert.equal(validateInput(value).valid, false);
});

test('accepts published and resumed outcomes only when typed checkpoint result agrees', () => {
  assert.deepEqual(validateOutput(completedOutput('published')), { valid: true, errors: [] });
  assert.deepEqual(validateOutput(completedOutput('resumed')), { valid: true, errors: [] });
  const drifted = completedOutput('published');
  drifted.output.resultKind = 'resumed-checkpoint';
  assert.match(validateOutput(drifted).errors.join('\n'), /must agree/);
});
