import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateInput } from './fe/direction-quality-screen/validate-input.mjs';
import { validateOutput } from './fe/direction-quality-screen/validate-output.mjs';

const raster = (char) => `raster://sha256:${char.repeat(64)}`;

const input = () => ({
  schemaVersion: 7,
  operatorId: 'fe/direction-quality-screen',
  context: {
    authorityRefs: ['authority://business/outcome'],
    evidenceRefs: [raster('a')],
    uiKnowledgeId: 'fe.ui',
    sourceFingerprint: `sha256:${'b'.repeat(64)}`,
    reviewerModel: 'gpt-5.6-sol',
    reviewerCount: 1,
    contextIsolation: 'fresh',
    forkTurns: 'none',
    reviewerExecutionRef: `execution://${'c'.repeat(64)}`,
    debug: true,
  },
  input: {
    targetRef: 'surface://playground',
    directionRef: 'direction://playground/01',
    representativeRasterRef: raster('a'),
    benchmarkRasterRefs: [raster('d')],
    attempt: 1,
    minimumScore: 9,
  },
});

const dimensions = (score) => [
  'composition',
  'hierarchy',
  'density-empty-space',
  'product-family-dna',
  'content-media-purpose',
  'action-clarity',
].map((dimension) => ({ dimension, score, observation: `${dimension} has direct visible evidence` }));

const output = ({ score = 9, attempt = 1, outcome = 'continue', ownerClass = 'none', handoff = null } = {}) => ({
  schemaVersion: 7,
  operatorId: 'fe/direction-quality-screen',
  output: {
    outcome,
    result: {
      summary: 'Fresh first-glance direction screen completed.',
      artifactRefs: [raster('a')],
      directionRef: 'direction://playground/01',
      representativeRasterRef: raster('a'),
      attempt,
      minimumScore: 9,
      overallScore: score,
      scaleBand: score <= 6 ? 'rejected' : score <= 8 ? 'promising' : score === 9 ? 'production' : 'exceptional',
      ownerClass,
      scoreDimensions: dimensions(score),
    },
    gaps: score >= 9 ? [] : ['gap://direction/quality'],
    evidenceRefs: [raster('a')],
    handoff,
  },
});

test('direction quality input freezes one fresh Sol screen and the 9 point threshold', () => {
  assert.deepEqual(validateInput(input()), { valid: true, errors: [] });
  const weakThreshold = input();
  weakThreshold.input.minimumScore = 8;
  assert.equal(validateInput(weakThreshold).valid, false);
});

test('only a 9+ first-glance score may continue to expensive proof', () => {
  assert.deepEqual(validateOutput(output()), { valid: true, errors: [] });
  const weakContinue = output({ score: 8 });
  assert.equal(validateOutput(weakContinue).valid, false);
  assert.deepEqual(validateOutput(output({ score: 8, outcome: 'rebrainstorm', ownerClass: 'direction' })), { valid: true, errors: [] });
});

test('third sub-9 attempt supplements the smallest authority instead of replacing Business', () => {
  assert.equal(validateOutput(output({ score: 8, attempt: 3, outcome: 'rebrainstorm', ownerClass: 'direction' })).valid, false);
  const businessSupplement = output({
    score: 8,
    attempt: 3,
    outcome: 'business-required',
    ownerClass: 'business',
    handoff: {
      skillId: 'starci-business-process',
      missionRef: 'mission://supplement-playground-content',
      resumeState: 'business-bind',
      inputRef: 'artifact://business/minimum-supplement.json',
    },
  });
  assert.deepEqual(validateOutput(businessSupplement), { valid: true, errors: [] });
});

test('frontend state machine screens applied, repaired, and accepted unchanged surfaces', () => {
  const machine = JSON.parse(readFileSync(new URL('../skills/starci-fe-process/machine.json', import.meta.url), 'utf8'));
  const targetFor = (state, outcome) => machine.states[state].on.find((edge) => edge.when?.outputEquals?.outcome === outcome)?.target;
  assert.equal(targetFor('apply', 'applied'), 'direction-quality-screen');
  assert.equal(targetFor('repair', 'repaired'), 'direction-quality-screen');
  assert.equal(targetFor('classify', 'no-change'), 'direction-quality-screen');
  assert.equal(targetFor('direction-quality-screen', 'continue'), 'capture-preflight');
  assert.equal(targetFor('direction-quality-screen', 'rebrainstorm'), 'generate');
  assert.equal(targetFor('direction-quality-screen', 'business-required'), 'business-handoff');
  assert.equal(targetFor('direction-quality-screen', 'backend-required'), 'backend-handoff');
});
