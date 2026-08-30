import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createReceipt } from '../../runtime/trace.mjs';
import { nextState, routeIssuedTransitionFor, validatedOperatorReturn } from '../route-machine.mjs';
import { validateOutput as validateIntegrationOutput } from '../../operators/quality/integration/validate-output.mjs';
import { validateOutput as validateDiagnoseOutput } from '../../operators/quality/workflow-diagnose/validate-output.mjs';
import { validateOutput as validateRepairOutput } from '../../operators/quality/finding-repair/validate-output.mjs';
import { validateOutput as validateDeliveryOutput } from '../../operators/quality/delivery-proof/validate-output.mjs';
import { validateOutput as validateSkillOutput } from './validate-output.mjs';

const machine = JSON.parse(fs.readFileSync(new URL('./machine.json', import.meta.url), 'utf8'));
const blockedResult = JSON.parse(fs.readFileSync(new URL('../../upgrades/self-upgrade-20260830-personal-project-cv.result.json', import.meta.url), 'utf8'));
const hash = (character) => `sha256:${character.repeat(64)}`;
const machineInput = {
  options: { intentMode: 'calibrate', observationMode: 'single' },
  neutralAdversarialDecision: {
    add: { disposition: 'adopt', rationale: 'Add output stability proof.', evidenceRefs: ['evidence://output'] },
    change: { disposition: 'adopt', rationale: 'Change premature terminal routing.', evidenceRefs: ['evidence://machine'] },
    remove: { disposition: 'adopt', rationale: 'Remove procedural-only completion.', evidenceRefs: ['evidence://terminal'] },
  },
};

let sequence = 0;
async function routeOperator({ missionId, stateId, operatorId, outcome, parentId }) {
  sequence += 1;
  const executionRef = `execution://${sequence.toString(16).padStart(64, '0')}`;
  const invocationRef = `invocation://self-upgrade-${sequence}`;
  const inputDocument = {
    schemaVersion: 7,
    operatorId,
    context: { contextRefs: ['evidence://fixture', 'acceptance://unchanged'], sourceRefs: [] },
    input: { project: 'starci-academy', objectiveRef: 'objective://self-upgrade-output', sourceFingerprint: hash('a') },
  };
  const outputDocument = {
    schemaVersion: 7,
    operatorId,
    output: {
      outcome,
      resultRef: `artifact://self-upgrade/${stateId}`,
      evidenceRefs: ['evidence://fixture', 'acceptance://unchanged'],
      findings: outcome === 'pass' ? [] : ['The produced output contradicts the frozen acceptance contract.'],
      reason: null,
    },
  };
  if (operatorId === 'quality/delivery-proof') {
    outputDocument.output.evidenceRefs.push(outputDocument.output.resultRef);
    outputDocument.output.adversarialDecision = {
      add: { disposition: 'reject', rationale: 'No additional capability is required for the frozen objective.', evidenceRefs: [outputDocument.output.resultRef] },
      change: { disposition: 'adopt', rationale: 'Keep the repaired output-first route that passed both stability checks.', evidenceRefs: [outputDocument.output.resultRef] },
      remove: { disposition: 'reject', rationale: 'No proven redundant capability remains in the exercised route.', evidenceRefs: [outputDocument.output.resultRef] },
    };
  }
  const validators = {
    'quality/integration': validateIntegrationOutput,
    'quality/workflow-diagnose': validateDiagnoseOutput,
    'quality/finding-repair': validateRepairOutput,
    'quality/delivery-proof': validateDeliveryOutput,
  };
  const validateOutput = validators[operatorId];
  const common = {
    missionId,
    skillId: 'starci-self-upgrade',
    operatorId,
    context: { invocationRef, executionRef },
    input: inputDocument,
    expectedOutput: { outcome },
    actualOutput: outputDocument,
    evidenceRefs: ['evidence://fixture', 'acceptance://unchanged'],
    sourceHeads: [{ ref: 'source://runtime', head: '2c84dd1e7a64b1665ff8534fecf51dda0977839c' }],
  };
  const callReceipt = createReceipt('CALL', { ...common, receiptId: `receipt:self-call-${sequence}`, parentId }, { debug: true });
  const returnReceipt = createReceipt('RETURN', { ...common, receiptId: `receipt:self-return-${sequence}`, parentId: callReceipt.receiptId }, { debug: true });
  const envelope = await validatedOperatorReturn({ machineId: machine.id, stateId, operatorId, input: inputDocument, outputDocument, validateOutput, returnReceipt });
  const target = nextState(machine, stateId, envelope, inputDocument, envelope.invocationRef, missionId);
  return { target, transitionReceipt: routeIssuedTransitionFor(returnReceipt) };
}

test('wrong calibration output follows canonical ERROR→RESUME and ends blocked after layer diagnosis', async () => {
  const missionId = 'mission://self-upgrade-output-correctness';
  const errorReceipt = createReceipt('ERROR', {
    receiptId: 'receipt:self-error', missionId, skillId: machine.id,
    error: { claim: 'Prior COMPLETE accepted an incorrect output.' },
  }, { debug: true });
  const resumeReceipt = createReceipt('RESUME', {
    receiptId: 'receipt:self-resume', missionId, skillId: machine.id,
    parentId: errorReceipt.receiptId, resumeState: { from: 'analyze-input' },
  }, { debug: true });

  assert.equal(nextState(machine, 'analyze-input', {}, machineInput), 'calibrate-baseline');
  const baseline = await routeOperator({ missionId, stateId: 'calibrate-baseline', operatorId: 'quality/integration', outcome: 'in-boundary', parentId: resumeReceipt.receiptId });
  assert.equal(baseline.target, 'calibrate-diagnose');
  assert.equal(baseline.transitionReceipt.type, 'TRANSITION');
  const diagnosis = await routeOperator({ missionId, stateId: 'calibrate-diagnose', operatorId: 'quality/workflow-diagnose', outcome: 'diagnosed', parentId: baseline.transitionReceipt.receiptId });
  assert.equal(diagnosis.target, 'blocked');
  assert.equal(diagnosis.transitionReceipt.trace.transitionRule.target, 'blocked');
});

test('upgrade repairs then requires two fresh consecutive correct outputs before complete', async () => {
  const missionId = 'mission://self-upgrade-repeated-correctness';
  const upgradeInput = structuredClone(machineInput);
  upgradeInput.options.intentMode = 'upgrade';
  assert.equal(nextState(machine, 'analyze-input', {}, upgradeInput), 'upgrade-baseline');

  const baseline = await routeOperator({ missionId, stateId: 'upgrade-baseline', operatorId: 'quality/integration', outcome: 'in-boundary', parentId: null });
  assert.equal(baseline.target, 'diagnose-1');
  const diagnosis = await routeOperator({ missionId, stateId: 'diagnose-1', operatorId: 'quality/workflow-diagnose', outcome: 'diagnosed', parentId: baseline.transitionReceipt.receiptId });
  assert.equal(diagnosis.target, 'repair-1');
  const repair = await routeOperator({ missionId, stateId: 'repair-1', operatorId: 'quality/finding-repair', outcome: 'repaired', parentId: diagnosis.transitionReceipt.receiptId });
  assert.equal(repair.target, 'repair-1-route');
  assert.equal(nextState(machine, 'repair-1-route', {}, upgradeInput), 'retry-1');
  const firstPass = await routeOperator({ missionId, stateId: 'retry-1', operatorId: 'quality/integration', outcome: 'pass', parentId: repair.transitionReceipt.receiptId });
  assert.equal(firstPass.target, 'retry-1-pass-route');
  assert.equal(nextState(machine, 'retry-1-pass-route', {}, upgradeInput), 'stability-1');
  const secondPass = await routeOperator({ missionId, stateId: 'stability-1', operatorId: 'quality/integration', outcome: 'pass', parentId: firstPass.transitionReceipt.receiptId });
  assert.equal(secondPass.target, 'prove');
  const proof = await routeOperator({ missionId, stateId: 'prove', operatorId: 'quality/delivery-proof', outcome: 'pass', parentId: secondPass.transitionReceipt.receiptId });
  assert.equal(proof.target, 'upgrade-complete');
  assert.equal(proof.transitionReceipt.trace.transitionRule.target, 'upgrade-complete');
});

test('output validator rejects procedural completion when the produced output is wrong', () => {
  const falseComplete = structuredClone(blockedResult);
  falseComplete.result = 'complete';
  falseComplete.finalState = 'complete';
  falseComplete.reason = null;
  const validation = validateSkillOutput(falseComplete);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /failed calibration output|successful terminal requires two consecutive correct outputs|diagnostic finding/i);
});

function stableResult() {
  const value = structuredClone(blockedResult);
  value.result = 'complete';
  value.finalState = 'complete';
  value.reason = null;
  value.metrics.visualVerdict = 'pass';
  value.attempts = [
    { attempt: 1, phase: 'baseline', outputRef: 'output://one', fingerprint: hash('b'), verdict: 'pass', evidenceRefs: ['evidence://one'] },
    { attempt: 2, phase: 'stability', outputRef: 'output://two', fingerprint: hash('c'), verdict: 'pass', evidenceRefs: ['evidence://two'] },
  ];
  value.correctness = {
    initialVerdict: 'pass', finalVerdict: 'pass', requiredConsecutivePasses: 2,
    achievedConsecutivePasses: 2, repairAttempts: 0, repeatedFingerprint: false,
  };
  value.layerChecks = value.layerChecks.map((check) => ({
    ...check,
    status: check.layer === 'grammar-ui' ? 'not-applicable' : 'passed',
    evidenceRefs: [`evidence://${check.layer}`],
    finding: check.layer === 'grammar-ui' ? 'The generic workflow output has no UI or Grammar ownership.' : null,
    ownerRef: null,
  }));
  return value;
}

test('output validator accepts only repeated fresh correctness with every layer closed', () => {
  assert.equal(validateSkillOutput(stableResult()).valid, true);
  const repeated = stableResult();
  repeated.attempts[1].fingerprint = repeated.attempts[0].fingerprint;
  repeated.correctness.repeatedFingerprint = true;
  const validation = validateSkillOutput(repeated);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /cannot reuse an output fingerprint/i);
});

test('multi-task mode waits for independent Codex actor results before integration', () => {
  const multi = structuredClone(machineInput);
  multi.options.intentMode = 'upgrade';
  multi.options.observationMode = 'multi-task';
  assert.equal(nextState(machine, 'analyze-input', {}, multi), 'upgrade-actors-wait');
});

test('multi-task output cannot assemble success from different actor streaks', () => {
  const value = stableResult();
  value.observationMode = 'multi-task';
  value.actorResults = [
    {
      actorId: 'personal-project', role: 'primary', taskRef: 'thread://personal', actionRef: 'action://reconstruct',
      runtimeFingerprint: hash('d'), sourceFingerprint: hash('e'), status: 'complete', resultRef: 'result://personal',
      verdict: 'pass', requiredConsecutivePasses: 2, achievedConsecutivePasses: 2,
      attemptFingerprints: [hash('f'), hash('1')], evidenceRefs: ['evidence://personal'],
    },
    {
      actorId: 'cv', role: 'primary', taskRef: 'thread://cv', actionRef: 'action://new',
      runtimeFingerprint: hash('d'), sourceFingerprint: hash('2'), status: 'complete', resultRef: 'result://cv',
      verdict: 'pass', requiredConsecutivePasses: 2, achievedConsecutivePasses: 1,
      attemptFingerprints: [hash('3')], evidenceRefs: ['evidence://cv'],
    },
  ];
  value.crossCaseDecision = {
    classification: 'systemic', discriminatorRequired: false, sharedOwnerRef: 'runtime://output-proof',
    knowledgeStatus: 'sufficient', evidenceRefs: ['evidence://personal', 'evidence://cv'], reason: 'Both actor results are evaluated independently.',
  };
  value.runtimeTransition = {
    beforeFingerprint: hash('d'), afterFingerprint: null, proofsInvalidated: false, reloadRequired: false,
    actorNotificationRefs: [], resumeRefs: [],
  };
  const validation = validateSkillOutput(value);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /cv: passing actor requires its own consecutive passes/i);
});
