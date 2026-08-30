import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOutput } from './fe/contract-freeze/validate-output.mjs';

const output = (mediaDecision) => ({
  schemaVersion: 7,
  operatorId: 'fe/contract-freeze',
  output: {
    outcome: 'frozen',
    result: {
      summary: 'One executable frontend contract is frozen.',
      artifactRefs: ['artifact://frontend-contract'],
      mediaDecision,
      behaviorContract: {
        observedInteractionRefs: ['interaction://search'],
        interactionDecisions: [{
          interactionRef: 'interaction://search',
          decision: 'preserve',
          authorityRef: null,
          rationale: null,
          replacementRef: null,
        }],
        surfaceOwnerRefs: ['surface://profile'],
        grammarBindingRefs: ['grammar://surface-list-card'],
        responsiveStates: [
          { viewport: 'wide', stateRef: 'state://wide' },
          { viewport: 'intermediate', stateRef: 'state://intermediate' },
          { viewport: 'compact', stateRef: 'state://compact' },
        ],
      },
    },
    gaps: [],
    evidenceRefs: ['authority://ui', 'grammar://selected'],
    handoff: null,
  },
});

test('accepts an explicit no-media decision after content structure is sufficient', () => {
  const result = validateOutput(output({
    mode: 'none',
    purpose: 'Edited headings and steps communicate the task without a visual asset.',
    placementRef: null,
    responsiveTreatment: 'No media slot is rendered at any viewport.',
    assetBriefRef: null,
    altIntent: null,
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('accepts a purpose-built generated-media contract with complete implementation intent', () => {
  const result = validateOutput(output({
    mode: 'generate',
    purpose: 'Orient the learner to the three-layer backend architecture before the ordered task.',
    placementRef: 'surface://personal-project/task-overview',
    responsiveTreatment: 'Use a 16:9 contain frame on wide and a 4:3 focal crop on compact.',
    assetBriefRef: 'artifact://media-brief/backend-layers',
    altIntent: 'Diagram showing HTTP, domain, and data layers in one-way dependency order.',
  }));
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('rejects generated media without a frozen brief, placement, and alternative intent', () => {
  const result = validateOutput(output({
    mode: 'generate',
    purpose: 'Make the page less text-heavy.',
    placementRef: null,
    responsiveTreatment: 'Responsive.',
    assetBriefRef: null,
    altIntent: null,
  }));
  assert.equal(result.valid, false);
});

test('rejects a frozen frontend contract that silently omits the media decision', () => {
  const value = output({
    mode: 'none',
    purpose: 'No media needed.',
    placementRef: null,
    responsiveTreatment: 'No media rendered.',
    assetBriefRef: null,
    altIntent: null,
  });
  delete value.output.result.mediaDecision;
  const result = validateOutput(value);
  assert.equal(result.valid, false);
});
