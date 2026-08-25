import assert from 'node:assert/strict';
import test from 'node:test';
import { validateOutput } from './fe/layout/validate-output.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;
const session = 'session://tasks/layout-task/';

function validOutput() {
  const previewRef = `${session}layout-review.html`;
  return {
    schemaVersion: 6,
    runId: 'layout-run',
    stage: 'layout.review',
    status: 'pending',
    facts: ['layout-directions-ready', 'layout-visual-preview-ready'],
    payload: {
      decision: 'directions-ready',
      state: {
        operator: 'fe/layout',
        status: 'pending',
        code: 'fe-layout-directions-ready',
        retryable: false,
        emits: {
          stage: 'layout.review',
          status: 'pending',
          factsAdd: ['layout-directions-ready', 'layout-visual-preview-ready'],
          factsRemove: ['layout-feedback-recorded']
        }
      },
      reviewPreview: {
        renderer: 'visualize',
        mediaType: 'text/html',
        artifactRef: previewRef,
        contentSha256: hash('a'),
        directionIds: ['LAYOUT-02A', 'LAYOUT-02B'],
        recommendedDirectionId: 'LAYOUT-02A',
        viewports: ['wide', 'intermediate', 'compact'],
        approvalCommands: [
          { directionId: 'LAYOUT-02A', command: 'OK LAYOUT LAYOUT-02A' },
          { directionId: 'LAYOUT-02B', command: 'OK LAYOUT LAYOUT-02B' }
        ],
        interactive: true
      },
      produced: { artifactRefs: [previewRef], mutations: [], externalEffects: [] },
      context: { used: [{ kind: 'session-upstream', ref: `${session}page-model`, revision: hash('b') }] },
      cleanup: { scratchRefs: [`${session}scratch/layout-draft`], retention: 'until-skill-terminal', purgeAt: 'skill-terminal' },
      evidenceRefs: [previewRef],
      findings: []
    }
  };
}

test('accepts a layout review only when its visualize preview is fully bound', () => {
  assert.deepEqual(validateOutput(validOutput()), { valid: true, errors: [] });
});

test('rejects a layout review without the visualize preview contract', () => {
  const output = validOutput();
  delete output.payload.reviewPreview;
  assert.equal(validateOutput(output).valid, false);
});

test('rejects incomplete responsive coverage and approval-command drift', () => {
  const output = validOutput();
  output.payload.reviewPreview.viewports = ['wide', 'intermediate', 'wide'];
  output.payload.reviewPreview.approvalCommands[0].command = 'OK LAYOUT another-id';
  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /viewports|approval command/);
});

test('rejects a preview that is not registered as produced evidence', () => {
  const output = validOutput();
  output.payload.produced.artifactRefs = [`${session}directions`];
  output.payload.evidenceRefs = [`${session}directions`];
  const result = validateOutput(output);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /artifactRef/);
});
