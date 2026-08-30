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
        uiLawBindingRef: 'ui-law-binding://profile-v1',
        uiDetailBindingRef: 'ui-detail-binding://profile-v1',
        iconographyManifestRef: 'iconography://profile-v1',
        grammarBindingRef: 'grammar-binding://profile-v1',
        grammarCoreRef: 'grammar-core://starci-v1',
        packagedContractRefs: ['grammar-package://surface-list-card'],
        visualDnaRef: 'visual-dna://starci-v1',
        productFamilyEvidence: {
          productFamilyRef: 'product-family://starci-academy',
          benchmarkRasterRefs: [`benchmark://sha256-${'a'.repeat(64)}.png`],
        },
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
    fallbackTreatment: null,
    spaceIntent: 'no-media-space',
    purposeRole: 'none',
    layoutIntegrity: 'sound',
    contentCompleteness: 'complete',
    approvedReusableAssetRef: null,
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
    fallbackTreatment: 'Collapse the media frame and retain the complete ordered task copy.',
    spaceIntent: 'purposeful-media-space',
    purposeRole: 'orientation',
    layoutIntegrity: 'sound',
    contentCompleteness: 'complete',
    approvedReusableAssetRef: null,
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
    fallbackTreatment: null,
    spaceIntent: 'purposeful-media-space',
    purposeRole: 'orientation',
    layoutIntegrity: 'sound',
    contentCompleteness: 'complete',
    approvedReusableAssetRef: null,
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
    fallbackTreatment: null,
    spaceIntent: 'no-media-space',
    purposeRole: 'none',
    layoutIntegrity: 'sound',
    contentCompleteness: 'complete',
    approvedReusableAssetRef: null,
  });
  delete value.output.result.mediaDecision;
  const result = validateOutput(value);
  assert.equal(result.valid, false);
});

test('requires media fulfillment for purposeful space and generation when no reusable asset exists', () => {
  const value = output({
    mode: 'none',
    purpose: 'A visual orientation slot is intentionally reserved before the task flow.',
    placementRef: null,
    responsiveTreatment: 'No media rendered.',
    assetBriefRef: null,
    altIntent: null,
    fallbackTreatment: null,
    spaceIntent: 'purposeful-media-space',
    purposeRole: 'orientation',
    layoutIntegrity: 'sound',
    contentCompleteness: 'complete',
    approvedReusableAssetRef: null,
  });
  assert.equal(validateOutput(value).valid, false);
});

test('rejects generated decorative filler that conceals layout or content defects', () => {
  const value = output({
    mode: 'generate',
    purpose: 'Fill the awkward empty layout gap.',
    placementRef: 'surface://profile/dead-zone',
    responsiveTreatment: 'Crop it wherever space remains.',
    assetBriefRef: 'artifact://media-brief/filler',
    altIntent: 'Decorative abstract shapes.',
    fallbackTreatment: 'Leave the gap empty.',
    spaceIntent: 'layout-defect',
    purposeRole: 'orientation',
    layoutIntegrity: 'defective',
    contentCompleteness: 'missing',
    approvedReusableAssetRef: null,
  });
  assert.equal(validateOutput(value).valid, false);
});

test('reuses an approved asset for purposeful media space and rejects unnecessary generation', () => {
  const reusable = output({
    mode: 'reuse',
    purpose: 'Explain the three backend layers before the task flow.',
    placementRef: 'surface://personal-project/task-overview',
    responsiveTreatment: 'Contain on wide and crop to the approved focal region on compact.',
    assetBriefRef: 'asset://approved/backend-layers',
    altIntent: 'Three backend layers arranged in dependency order.',
    fallbackTreatment: 'Collapse the frame and retain complete explanatory copy.',
    spaceIntent: 'purposeful-media-space',
    purposeRole: 'explanation',
    layoutIntegrity: 'sound',
    contentCompleteness: 'complete',
    approvedReusableAssetRef: 'asset://approved/backend-layers',
  });
  assert.deepEqual(validateOutput(reusable), { valid: true, errors: [] });
  reusable.output.result.mediaDecision.mode = 'generate';
  assert.match(validateOutput(reusable).errors.join('\n'), /generate is forbidden|approvedReusableAssetRef|schema branch/);
});
