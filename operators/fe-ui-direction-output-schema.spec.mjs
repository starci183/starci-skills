import assert from 'node:assert/strict';
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
  facts: ['ui-directions-ready'],
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
        factsAdd: ['ui-directions-ready'],
        factsRemove: [],
      },
    },
    produced: {
      artifactRefs: ['session://tasks/ui-direction-schema/artifacts/directions'],
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
    evidenceRefs: ['business://course-learning/challenge'],
    findings: [],
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
