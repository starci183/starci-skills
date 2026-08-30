import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInput as validateIconInput } from './fe/iconography-resolve/validate-input.mjs';
import { validateOutput as validateIconOutput } from './fe/iconography-resolve/validate-output.mjs';
import { validateInput as validateMediaInput } from './fe/media-produce/validate-input.mjs';
import { validateOutput as validateMediaOutput } from './fe/media-produce/validate-output.mjs';

const context = { evidenceRefs: ['business://course-navigation'], authorityRevision: 'sha256:authority' };

test('iconography resolves business meaning through the approved catalog before custom drawing', () => {
  const input = { schemaVersion: 7, operatorId: 'fe/iconography-resolve', context, input: { targetRef: 'surface://learn-rail', uiLawBindingRef: 'ui-law-binding://learn-rail', semanticRoles: [{ roleRef: 'semantic-icon://course-content', meaning: 'Readable course curriculum', authorityRef: 'business://course-content', visualLayer: 'course-navigation' }], approvedCatalogRefs: ['icon-catalog://heroicons'], constraints: ['one outline family'] } };
  assert.deepEqual(validateIconInput(input), { valid: true, errors: [] });
  const output = { schemaVersion: 7, operatorId: 'fe/iconography-resolve', output: { outcome: 'resolved', result: { summary: 'Course content uses the exact upstream open-book glyph.', iconographyManifestRef: 'iconography://learn-rail', visualFamilyRef: 'icon-family://heroicons', decisions: [{ roleRef: 'semantic-icon://course-content', meaningAuthorityRef: 'business://course-content', source: 'heroicons', glyphRef: 'heroicons://BookOpenIcon', catalogSearchRefs: ['icon-catalog://heroicons'], customReason: null }] }, gaps: [], evidenceRefs: ['business://course-navigation'] } };
  assert.deepEqual(validateIconOutput(output), { valid: true, errors: [] });
  output.output.result.decisions[0].source = 'custom-svg';
  assert.equal(validateIconOutput(output).valid, false);
});

test('media production keeps reuse and generation separate from source composition', () => {
  const noMediaInput = { schemaVersion: 7, operatorId: 'fe/media-produce', context, input: { targetRef: 'surface://plain', mediaDecisionRef: 'media-decision://plain', mutationBoundaryRef: 'mutation-boundary://plain', mode: 'none', assetBriefRef: null, approvedReusableAssetRef: null, outputPath: null, constraints: [] } };
  assert.deepEqual(validateMediaInput(noMediaInput), { valid: true, errors: [] });
  const noMediaOutput = { schemaVersion: 7, operatorId: 'fe/media-produce', output: { outcome: 'ready', result: { summary: 'No purposeful media slot exists.', mode: 'none', mediaManifestRef: 'media-manifest://plain', assetRef: null, artifactRefs: [], provenanceRefs: [], responsiveTreatmentRef: null, altIntentRef: null, fallbackRef: null }, gaps: [], evidenceRefs: ['business://course-navigation'] } };
  assert.deepEqual(validateMediaOutput(noMediaOutput), { valid: true, errors: [] });

  const generated = structuredClone(noMediaOutput);
  generated.output.result = { summary: 'Purpose-built project orientation artwork generated.', mode: 'generate', mediaManifestRef: 'media-manifest://project-hero', assetRef: `asset://sha256-${'a'.repeat(64)}.webp`, artifactRefs: [`asset://sha256-${'a'.repeat(64)}.webp`], provenanceRefs: ['generation://imagegen/project-hero'], responsiveTreatmentRef: 'responsive-media://project-hero', altIntentRef: 'alt-intent://project-hero', fallbackRef: 'fallback://project-hero' };
  assert.deepEqual(validateMediaOutput(generated), { valid: true, errors: [] });
  generated.output.result.provenanceRefs = [];
  assert.equal(validateMediaOutput(generated).valid, false);
});
