import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput } from './fe/ux-ui-resolve/validate-input.mjs';
import { validateOutput } from './fe/ux-ui-resolve/validate-output.mjs';

const task = 'session://tasks/uat-1/';
const hash = `sha256:${'a'.repeat(64)}`;
const requestPath = '.claude/requests/flashcard-state.request.json';

const knowledge = ['fe.product-proof', 'fe.ui-quality-review', 'fe.request-lifecycle', 'fe.grammar-common-states-accessibility']
  .map((id) => ({ id, generation: 'v6.1', contentSha256: hash }));

function input(phase = 'plan') {
  const close = phase === 'close';
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'product.uat.ux-ui-resolution',
    status: close ? 'verify' : 'ready',
    facts: close ? ['product-uat-passed', 'ux-ui-resolution-close-required'] : ['product-uat-failed', 'ux-ui-repair-required'],
    payload: {
      provided: {
        phase,
        uatReportRef: `${task}uat-report`,
        uatReportSha256: hash,
        requestRefs: [requestPath],
        priorResolutionRef: close ? `${task}prior-resolution` : null,
        repairReceiptRefs: close ? [`${task}repair-receipt`] : []
      },
      loads: {
        upstream: [{ role: 'uat-report', ref: `${task}uat-report`, revision: hash }],
        knowledge,
        exactTargets: [{ path: requestPath, expectedSha256: hash, currentStatus: close ? 'approved' : 'proven', access: 'read-write' }],
        orchestration: { mode: 'balanced', profileRef: 'orchestration/modes/balanced.json', providerRef: 'orchestration/providers/openai.json' }
      },
      session: { taskId: 'uat-1', inputRef: `${task}input`, outputRef: `${task}output`, scratchPrefix: `${task}scratch`, retention: 'until-skill-terminal' }
    }
  };
}

function output(decision = 'repair-ready') {
  const close = decision === 'resolved';
  return {
    schemaVersion: 6,
    runId: 'run-1',
    stage: 'product.uat.ux-ui-resolution.result',
    status: decision,
    facts: close ? ['ux-ui-feedback-resolved'] : ['ux-ui-repair-contract-ready', 'feedback-requests-approved'],
    payload: {
      decision,
      state: {
        operator: 'fe/ux-ui-resolve',
        status: decision,
        code: close ? 'ux-ui-feedback-resolved' : 'ux-ui-repair-ready',
        retryable: false,
        emits: { stage: 'product.uat.ux-ui-resolution.result', status: decision, factsAdd: close ? ['ux-ui-feedback-resolved'] : ['ux-ui-repair-contract-ready'], factsRemove: close ? ['ux-ui-repair-required'] : [] }
      },
      produced: {
        artifactRefs: [`${task}resolution`],
        mutations: [{ path: requestPath, operation: 'upsert', contentSha256: hash, requestStatus: close ? 'resolved' : 'approved' }],
        externalEffects: []
      },
      context: { used: [{ kind: 'uat-report', ref: `${task}uat-report`, revision: hash }] },
      cleanup: { scratchRefs: [`${task}scratch/evidence`], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [`${task}evidence/viewport`],
      findings: [],
      artifact: {
        artifactType: 'ux-ui-resolution',
        phase: close ? 'close' : 'plan',
        repairClass: 'implementation-drift',
        targetCapability: 'frontend.implementation',
        requestActions: [{ path: requestPath, action: close ? 'resolve' : 'approve', evidenceRef: `${task}evidence/viewport` }],
        assertions: [{ id: 'state.legend.match', category: 'state-semantics', defect: 'Legend treatment differs from the control state.', requiredChange: 'Render the same treatment in map and key.', acceptanceClaim: 'Every key sample matches its controlled state.', ownerCapability: 'frontend.implementation', evidenceRefs: [`${task}evidence/viewport`] }],
        proof: { uatPassed: close, sameRequestSet: close, grammarObjectPassed: close, stateMappingPassed: close, noHardIssues: close },
        handoffRef: close ? null : `${task}handoff/frontend-implementation`
      }
    }
  };
}

test('UX/UI resolution accepts an exact failed-UAT planning envelope', () => {
  assert.deepEqual(validateInput(input()), { valid: true, errors: [] });
  assert.deepEqual(validateOutput(output()), { valid: true, errors: [] });
});

test('UX/UI resolution rejects closure without passing proof', () => {
  const value = output('resolved');
  value.payload.artifact.proof.stateMappingPassed = false;
  assert.equal(validateOutput(value).valid, false);
});

test('UX/UI resolution rejects a request set that drifts from exact targets', () => {
  const value = input();
  value.payload.provided.requestRefs = ['.claude/requests/another.request.json'];
  assert.equal(validateInput(value).valid, false);
});
