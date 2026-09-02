import assert from 'node:assert/strict';
import { validateInput } from './validate-input.mjs';
import { validateOutput } from './validate-output.mjs';

const hash = `sha256:${'a'.repeat(64)}`;
const sourceHead = 'b'.repeat(40);
const observedAt = '2026-09-02T00:00:00.000Z';
const contextRef = (ref, head = null) => ({ ref, fingerprint: hash, sourceHead: head, observedAt });

const validInput = {
  schemaVersion: 8,
  operatorId: 'fe.direction.decide',
  context: {
    requestRefs: [contextRef('request://create-page-a')],
    business: {
      receiptRef: 'business://page-a',
      fingerprint: hash,
      status: 'accepted',
      projectId: 'starci-academy',
      scopeRef: 'scope://page-a',
    },
    backend: null,
    architecture: null,
    grammar: {
      packageRef: 'grammar-package://starci-core',
      manifestRef: 'grammar://starci-core',
      fingerprint: hash,
      status: 'published',
      exportRefs: ['grammar://starci-core/page'],
    },
    knowledgeRefs: [contextRef('knowledge://fe-ui')],
    sourceRefs: [contextRef('source://starci-academy-fe', sourceHead)],
    uatRefs: [],
    auditRefs: [],
    visualRefs: [],
    previousDirectionRefs: [],
    externalReferenceRefs: [],
  },
  input: {
    invocationId: 'invocation-page-a-1',
    missionId: 'mission-page-a',
    objectiveRef: 'request://create-page-a',
    project: {
      id: 'starci-academy',
      frontendSourceRef: 'source://starci-academy-fe',
      repository: 'https://github.com/starci-lab/starci-academy',
      branch: 'mtp',
      sourceHead,
      artifactRootRef: '.v8/artifacts/invocation-page-a-1',
    },
    target: { id: 'page-a', kind: 'page', ownerRef: 'owner://page-a' },
    intent: 'create',
    changeLevel: 'new',
    scope: {
      inclusionRefs: ['surface://page-a'],
      exclusionRefs: ['owner://global-shell'],
      ownerCeiling: {
        kind: 'surface-only',
        mutableOwnerRefs: ['owner://page-a'],
        observationOnlyOwnerRefs: ['owner://global-shell'],
      },
    },
    approvedDirection: null,
    decisionPolicy: { mode: 'dominant', alternativeCount: null, comparisonAuthorityRef: null },
    constraints: ['preserve accepted business and backend behavior'],
    resume: null,
  },
};

const artifactRoot = validInput.input.project.artifactRootRef;
const visualRef = `${artifactRoot}/page-a-direction.html`;
const evidenceRefs = ['request://create-page-a', 'business://page-a', 'grammar://starci-core'];

const validDecidedOutput = {
  schemaVersion: 8,
  operatorId: 'fe.direction.decide',
  output: {
    outcome: 'decided',
    receipt: {
      receiptType: 'fe-direction-decision',
      receiptId: 'receipt:page-a-direction',
      invocationId: validInput.input.invocationId,
      missionId: validInput.input.missionId,
      status: 'decided',
      binding: {
        projectId: validInput.input.project.id,
        frontendSourceRef: validInput.input.project.frontendSourceRef,
        sourceHead,
        artifactRootRef: artifactRoot,
        targetId: validInput.input.target.id,
        targetKind: validInput.input.target.kind,
        intent: validInput.input.intent,
        changeLevel: validInput.input.changeLevel,
        ownerCeilingFingerprint: hash,
        businessFingerprint: hash,
        backendFingerprint: null,
        architectureFingerprint: null,
        grammarFingerprint: hash,
        contextFingerprint: hash,
        inputFingerprint: hash,
        progressFingerprint: hash,
      },
      decision: {
        classification: 'dominant',
        directionId: 'page-a-primary',
        directionRef: 'direction://page-a-primary',
        directionFingerprint: hash,
        selectedAlternativeId: null,
        visualArtifactRefs: [visualRef],
        purpose: 'Help the learner complete the approved page-A task.',
        actorTasks: ['Understand the offer', 'Complete the primary action'],
        regionModel: [
          { id: 'orientation', responsibility: 'Explain the page purpose', order: 1 },
          { id: 'task', responsibility: 'Own the primary task', order: 2 },
        ],
        actionModel: [{ action: 'Submit', feedback: 'Show pending and result', recovery: 'Keep input and retry' }],
        stateMatrix: [
          { state: 'steady', entry: 'Data ready', presentation: 'Show the complete task', exit: 'Submit' },
          { state: 'error', entry: 'Request failed', presentation: 'Show bounded error', exit: 'Retry' },
        ],
        responsiveModel: [{ condition: 'constrained', transformation: 'Stack task regions', invariant: 'Preserve action order' }],
        accessibilityModel: ['Logical heading and focus order'],
        contentModel: ['Representative populated content and long-label stress'],
        mediaDecisions: [],
        grammarBindings: ['grammar://starci-core/page'],
        preservedDecisions: ['Accepted business behavior'],
        changedDecisions: ['New frontend composition'],
        implementationConstraints: ['Write only the page-A owner during implementation'],
        downstreamProofRefs: ['proof-plan://page-a'],
      },
      alternatives: [],
      challenge: {
        add: [{ code: 'ADD_RECOVERY', severity: 'info', statement: 'Represent retry explicitly.', evidenceRefs: ['business://page-a'] }],
        change: [],
        remove: [],
        contradictions: [],
      },
      evidenceRefs,
      failure: null,
      resume: null,
      createdAt: observedAt,
    },
    evidenceRefs,
    artifactRefs: [visualRef],
    handoff: null,
  },
};

const alternative = (id) => ({
  id,
  directionRef: `direction://${id}`,
  fingerprint: hash,
  visualArtifactRefs: [`${artifactRoot}/${id}.html`],
  materialDifference: `${id} changes the interaction responsibility.`,
  tradeoffs: [`${id} favors one authorized task sequence.`],
});
const alternatives = ['direction-a', 'direction-b', 'direction-c'].map(alternative);

const validBlockedChoiceOutput = structuredClone(validDecidedOutput);
validBlockedChoiceOutput.output.outcome = 'blocked';
validBlockedChoiceOutput.output.receipt.status = 'blocked';
validBlockedChoiceOutput.output.receipt.decision = null;
validBlockedChoiceOutput.output.receipt.alternatives = alternatives;
validBlockedChoiceOutput.output.receipt.failure = {
  code: 'DIRECTION_CHOICE_REQUIRED',
  message: 'Three material directions remain.',
  missingRefs: [],
  retryable: true,
  owningDomain: 'frontend',
};
validBlockedChoiceOutput.output.receipt.resume = {
  resumeToken: 'resume-page-a-choice',
  requiredDelta: ['Select one listed direction with exact product authority.'],
  candidateAlternativeIds: alternatives.map((item) => item.id),
};
validBlockedChoiceOutput.output.artifactRefs = alternatives.flatMap((item) => item.visualArtifactRefs);

assert.deepEqual(validateInput(validInput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validDecidedOutput), { valid: true, errors: [] });
assert.deepEqual(validateOutput(validBlockedChoiceOutput), { valid: true, errors: [] });

const invalidInput = structuredClone(validInput);
invalidInput.input.scope.ownerCeiling.observationOnlyOwnerRefs.push('owner://page-a');
assert.equal(validateInput(invalidInput).valid, false);

const invalidOutput = structuredClone(validDecidedOutput);
invalidOutput.output.artifactRefs = [];
assert.equal(validateOutput(invalidOutput).valid, false);

const invalidChoice = structuredClone(validBlockedChoiceOutput);
invalidChoice.output.receipt.resume.candidateAlternativeIds.pop();
assert.equal(validateOutput(invalidChoice).valid, false);

console.log('fe.direction.decide self-test passed');

