import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { validateOutput } from './fe/ui-direction/validate-output.mjs';

const direction = (id) => ({
  id,
  thesis: `${id} thesis`,
  hierarchy: `${id} hierarchy`,
  interactionCharacter: `${id} interaction`,
  tradeoffs: [`${id} tradeoff`],
  visualRef: `session://tasks/ui-direction-schema/visuals/${id}`,
  materialDifferenceRefs: [
    `session://tasks/ui-direction-schema/comparisons/${id}-one`,
    `session://tasks/ui-direction-schema/comparisons/${id}-two`,
  ],
});

const output = (recommendedId = 'focused-split') => ({
  schemaVersion: 6,
  runId: 'ui-direction-schema',
  stage: 'ui.direction.review',
  status: 'pending',
  facts: ['ui-directions-ready', 'ui-direction-visual-preview-ready'],
  payload: {
    decision: 'directions-ready',
    state: {
      operator: 'fe/ui-direction',
      status: 'pending',
      code: 'ui-directions-ready',
      retryable: false,
      emits: {
        stage: 'ui.direction.review',
        status: 'pending',
        factsAdd: ['ui-directions-ready', 'ui-direction-visual-preview-ready'],
        factsRemove: [],
      },
    },
    produced: {
      artifactRefs: [
        'session://tasks/ui-direction-schema/artifacts/directions',
        'session://tasks/ui-direction-schema/reviews/ui-directions.html',
      ],
      mutations: [],
      externalEffects: [],
    },
    context: {
      used: [{
        kind: 'business',
        ref: 'business://course-learning/challenge',
        revision: 'sha256:4ec13502d10b87242c6d9cc983e2a6ae2d205f9650bc7323c4dcb80acfdf2e00',
      }],
    },
    cleanup: {
      scratchRefs: [],
      retention: 'until-skill-terminal',
      purgeAt: 'skill-terminal',
    },
    evidenceRefs: [
      'business://course-learning/challenge',
      'session://tasks/ui-direction-schema/reviews/ui-directions.html',
    ],
    findings: [],
    reviewPreview: {
      renderer: 'visualize',
      mediaType: 'text/html',
      artifactRef: 'session://tasks/ui-direction-schema/reviews/ui-directions.html',
      contentSha256: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      directionIds: ['focused-split', 'guided-journey', 'evidence-board'],
      recommendedDirectionId: recommendedId,
      surfaceRefs: ['lesson-entry', 'challenge-task', 'evaluation-recovery', 'result', 'history-retry', 'course-exit'],
      viewports: ['wide', 'intermediate', 'compact'],
      approvalCommands: [
        { directionId: 'focused-split', command: `OK UI DIRECTION focused-split@${'a'.repeat(64)}` },
        { directionId: 'guided-journey', command: `OK UI DIRECTION guided-journey@${'a'.repeat(64)}` },
        { directionId: 'evidence-board', command: `OK UI DIRECTION evidence-board@${'a'.repeat(64)}` },
      ],
      interactive: true,
    },
    artifact: {
      artifactType: 'frontend-ui-directions',
      directions: [direction('focused-split'), direction('guided-journey'), direction('evidence-board')],
      recommendedId,
      comparisonAxes: ['navigation cost', 'recovery clarity', 'responsive persistence'],
    },
  },
});

test('accepts recommendedId and comparisonAxes on the direction artifact', () => {
  assert.deepEqual(validateOutput(output()), { valid: true, errors: [] });
});

test('rejects a recommendation that does not identify a generated direction', () => {
  const result = validateOutput(output('missing-direction'));
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /must identify one direction/);
});

test('rejects a ready direction handoff without a visible-review binding', () => {
  const value = output();
  delete value.payload.reviewPreview;
  assert.equal(validateOutput(value).valid, false);
});

test('rejects preview identity, viewport, evidence, and approval-command drift', () => {
  const value = output();
  value.payload.reviewPreview.directionIds = ['focused-split', 'guided-journey', 'other'];
  value.payload.reviewPreview.viewports = ['wide', 'intermediate', 'wide'];
  value.payload.reviewPreview.approvalCommands[0].command = `OK UI DIRECTION focused-split@${'b'.repeat(64)}`;
  value.payload.produced.artifactRefs = ['session://tasks/ui-direction-schema/artifacts/directions'];
  const result = validateOutput(value);
  assert.equal(result.valid, false);
  assert.match(result.errors.join('\n'), /directionIds|viewports|artifactRef|approval command/);
});

test('binds UI-direction review delivery to the portable directive helper', () => {
  const skill = readFileSync(new URL('../skills/starci-frontend-ui-direction/SKILL.md', import.meta.url), 'utf8');
  const execute = readFileSync(new URL('../skills/starci-frontend-ui-direction/execute.md', import.meta.url), 'utf8');
  const operatorExecute = readFileSync(new URL('./fe/ui-direction/execute.md', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../INDEX.md', import.meta.url), 'utf8');
  for (const source of [skill, execute, operatorExecute, index]) {
    assert.match(source, /scripts\/visualize-directive\.mjs/);
    assert.match(source, /Never handwrite or interpolate/);
    assert.match(source, /visibly rendered/);
  }
});
