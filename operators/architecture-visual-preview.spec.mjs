import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './architecture/decision-challenge/validate-output.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;
const session = 'session://tasks/architecture-task/';

function validOutput() {
  const previewRef = `${session}architecture-review.html`;
  const optionSetSha256 = hash('a');
  const optionSetRevision = optionSetSha256.slice('sha256:'.length);
  return {
    schemaVersion: 6,
    runId: 'architecture-run',
    stage: 'architecture.decision.handoff',
    status: 'ready',
    facts: ['architecture-challenge-ready', 'architecture-visual-preview-ready'],
    payload: {
      decision: 'ready',
      challengeSummary: {
        stance: 'falsification-first',
        verdict: 'ready',
        assumptionIds: ['assumption.single-writer'],
        counterexampleIds: ['counterexample.duplicate-delivery'],
        rejectedOptionIds: ['event-ledger'],
        failureModeIds: ['failure.partial-commit'],
        falsificationTestIds: ['test.outbox-loss'],
        operationalSurpriseIds: ['surprise.green-health-backlog'],
        unresolvedCriticalIds: [],
        recommendationChanged: false
      },
      reviewPreview: {
        renderer: 'visualize',
        mediaType: 'text/html',
        artifactRef: previewRef,
        contentSha256: hash('b'),
        optionSetSha256,
        optionIds: ['postgres-outbox', 'event-ledger'],
        recommendedOptionId: 'postgres-outbox',
        scenarioIds: ['normal', 'retry', 'concurrency', 'outage', 'rollback'],
        approvalCommands: [
          { decisionId: 'postgres-outbox', command: `OK ARCHITECTURE postgres-outbox@${optionSetRevision}` },
          { decisionId: 'event-ledger', command: `OK ARCHITECTURE event-ledger@${optionSetRevision}` }
        ],
        interactive: true
      },
      state: {
        operator: 'architecture/decision-challenge',
        status: 'completed',
        code: 'architecture-decision-challenge-ready',
        retryable: false,
        emits: {
          stage: 'architecture.decision.handoff',
          status: 'ready',
          factsAdd: ['architecture-challenge-ready', 'architecture-visual-preview-ready']
        }
      },
      produced: {
        challengeReceiptRef: `${session}challenge-receipt`,
        reviewArtifactRef: previewRef,
        durableWrites: []
      },
      context: {
        used: [{ kind: 'session-artifact', ref: `${session}option-set`, revision: optionSetSha256 }]
      },
      cleanup: {
        scratchRefs: [previewRef],
        retention: 'until-skill-terminal',
        purgeAt: 'skill-terminal'
      },
      evidenceRefs: [previewRef],
      findings: []
    }
  };
}

test('accepts an architecture approval result only with a complete visualize review binding', () => {
  assert.deepEqual(validateOutput(validOutput()), { valid: true, errors: [] });
});

test('rejects a ready architecture decision without a visualize preview', () => {
  const output = validOutput();
  delete output.payload.reviewPreview;
  assert.equal(validateOutput(output).valid, false);
});

test('rejects missing failure scenarios and approval command drift', () => {
  const output = validOutput();
  output.payload.reviewPreview.scenarioIds = ['normal', 'retry', 'outage', 'rollback', 'rollback'];
  output.payload.reviewPreview.approvalCommands[0].command = `OK ARCHITECTURE another-option@${'a'.repeat(64)}`;
  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /scenarioIds|approval command/);
});

test('rejects a preview that is not registered as produced evidence and scratch', () => {
  const output = validOutput();
  output.payload.produced.reviewArtifactRef = `${session}another-review.html`;
  output.payload.evidenceRefs = [`${session}challenge-receipt`];
  output.payload.cleanup.scratchRefs = [`${session}challenge-receipt`];
  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /reviewArtifactRef|artifactRef/);
});

test('rejects agreement-first architecture evidence', () => {
  const output = validOutput();
  output.payload.challengeSummary.unresolvedCriticalIds = ['critical.data-loss'];
  output.payload.challengeSummary.rejectedOptionIds = ['postgres-outbox'];
  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /unresolvedCriticalIds|rejectedOptionIds/);
});
