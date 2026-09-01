import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalMachine } from '../skills/route-machine.mjs';
import { validateOutput as validateVisualOutput } from './fe/visual-fidelity/validate-output.mjs';

const readSchema = (operator, kind) => JSON.parse(readFileSync(new URL(`./fe/${operator}/${kind}.schema.json`, import.meta.url), 'utf8'));
const machine = canonicalMachine('starci-fe-process');

test('preflight consumes exact compile and registered mutation lineage', () => {
  const schema = readSchema('capture-preflight', 'input');
  const required = schema.properties.input.required;
  for (const field of ['compiledRequestRef', 'compiledRequestFingerprint', 'sourceApplyReturnReceiptRef', 'aggregateAfterFingerprint', 'matrix']) {
    assert.ok(required.includes(field), field);
  }
  assert.equal(schema.properties.context.properties.sourceFingerprint, undefined);
  assert.deepEqual(schema.properties.input.properties.matrix.properties.viewports.items.enum, ['wide', 'intermediate', 'compact']);
  assert.equal(schema.properties.input.properties.matrix.properties.probeRefs.minItems, 22);
});

test('render capture descends from preflight and never accepts a free source fingerprint', () => {
  const schema = readSchema('render-capture', 'input');
  const preflight = schema.properties.input.properties.preflight;
  for (const field of ['preflightRef', 'compiledRequestRef', 'compiledRequestFingerprint', 'sourceApplyReturnReceiptRef', 'aggregateAfterFingerprint', 'matrixFingerprint']) {
    assert.ok(preflight.required.includes(field), field);
  }
  assert.equal(schema.properties.context.properties.sourceFingerprint, undefined);
});

test('capture output binds content-addressed rasters and the aggregate mutation identity', () => {
  const schema = readSchema('render-capture', 'output');
  const result = schema.properties.output.properties.result.anyOf[0];
  for (const field of ['sourceApplyReturnReceiptRef', 'aggregateAfterFingerprint', 'sourceFingerprint', 'latestMutationFingerprint', 'blindReviewPacketFingerprint', 'renderMatrix', 'adversarialProbeMatrix']) {
    assert.ok(result.required.includes(field), field);
  }
  assert.match(result.properties.renderMatrix.items.properties.imageRef.pattern, /png/);
  assert.equal(result.properties.handoffHostArtifact.properties.viewportOverride.const, false);
});

test('blind review is one fresh Sol over a raster-only packet', () => {
  const schema = readSchema('visual-fidelity', 'input');
  const context = schema.properties.context;
  assert.equal(context.properties.reviewerModel.const, 'gpt-5.6-sol');
  assert.equal(context.properties.reviewerCount.const, 1);
  assert.equal(context.properties.contextIsolation.const, 'fresh');
  assert.equal(context.properties.forkTurns.const, 'none');
  const packet = schema.properties.input.properties.blindReviewPacket;
  assert.ok(packet.required.includes('captureReceiptId'));
  assert.ok(packet.required.includes('packetFingerprint'));
  assert.equal(packet.properties.rasterCells.allOf.find(({ maxContains }) => maxContains === 1).maxContains, 1);
});

test('insufficient visual evidence returns no verdict product and recaptures once', () => {
  const output = { schemaVersion: 7, operatorId: 'fe/visual-fidelity', output: { outcome: 'insufficient-evidence', result: null, gaps: ['Compact happy-case raster cuts off the primary task and cannot support a verdict.'], evidenceRefs: ['packet://evidence-gap'] } };
  assert.deepEqual(validateVisualOutput(output), { valid: true, errors: [] });
  const edge = machine.states['visual-fidelity'].on.find(({ when }) => when.outputEquals?.outcome === 'insufficient-evidence');
  assert.equal(edge.target, 'recapture-preflight');
  const finalEdge = machine.states['final-visual-fidelity'].on.find(({ when }) => when.outputEquals?.outcome === 'insufficient-evidence');
  assert.equal(finalEdge.target, 'blocked');
});
