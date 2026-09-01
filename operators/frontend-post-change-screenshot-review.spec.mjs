import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const capture = readFileSync(new URL('./fe/render-capture/execute.md', import.meta.url), 'utf8');
const review = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
const reviewInput = JSON.parse(readFileSync(new URL('./fe/visual-fidelity/input.schema.json', import.meta.url), 'utf8'));
const reviewOutput = JSON.parse(readFileSync(new URL('./fe/visual-fidelity/output.schema.json', import.meta.url), 'utf8'));

test('post-change proof is captured as real pixels after the registered mutation', () => {
  assert.match(capture, /registered source-apply RETURN/i);
  assert.match(capture, /content-addressed raster files/i);
  assert.match(capture, /uncropped real host-context handoff raster/i);
  assert.match(capture, /after the latest mutation/i);
});

test('capture packet order and the final host screenshot are immutable', () => {
  assert.match(capture, /ordered exactly as host artifact, render matrix,\s*then applicable probe rasters/is);
  assert.match(capture, /sole final screenshot is the host\s+handoff raster/i);
  const cells = reviewInput.properties.input.properties.blindReviewPacket.properties.rasterCells;
  assert.equal(cells.allOf.find(({ maxContains }) => maxContains === 1).maxContains, 1);
});

test('visual review is blind, adversarial, and cannot substitute implementation evidence', () => {
  assert.match(review, /raster-only/i);
  assert.match(review, /Do not inspect\s+source, DOM, tests, measurements, producer rationale/i);
  assert.match(review, /falsif/i);
  assert.match(review, /one fresh `gpt-5\.6-sol`/i);
});

test('visual outputs expose passed, repair, insufficient-evidence, and pre-review blocked only', () => {
  assert.deepEqual(reviewOutput.properties.output.properties.outcome.enum, ['passed', 'repair', 'insufficient-evidence', 'blocked']);
  assert.match(reviewOutput.properties.output.properties.result.description, /null when blocked or when the raster packet cannot support a verdict/i);
});
