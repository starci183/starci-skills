import assert from 'node:assert/strict';
import test from 'node:test';
import { operatorV7Issues } from './contract-v7.mjs';

const manifest = {
  schemaVersion: 7,
  id: 'test/example',
  domain: 'test',
  job: 'Compare one observed value with one approved expectation.',
  inputSchema: 'input.schema.json',
  outputSchema: 'output.schema.json',
  sourceReferenceRefs: [],
  sideEffects: [],
  stopConditions: []
};

const inputSchema = {
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'operatorId', 'context', 'input'],
  properties: {
    schemaVersion: { const: 7 },
    operatorId: { const: 'test/example' },
    context: {
      type: 'object', additionalProperties: false, required: ['authority'],
      properties: { authority: { type: 'string', minLength: 1, description: 'Revision-bound authority used for comparison.' } }
    },
    input: {
      type: 'object', additionalProperties: false, required: ['observedValue'],
      properties: { observedValue: { type: 'string', minLength: 1, description: 'The single observed value to compare.' } }
    }
  }
};

const outputSchema = {
  type: 'object', additionalProperties: false,
  required: ['schemaVersion', 'operatorId', 'output'],
  properties: {
    schemaVersion: { const: 7 },
    operatorId: { const: 'test/example' },
    output: {
      type: 'object', additionalProperties: false, required: ['matches', 'evidenceRef'],
      properties: {
        matches: { type: 'boolean', description: 'Whether the observed value matches the approved expectation.' },
        evidenceRef: { type: 'string', minLength: 1, description: 'Revision-bound evidence for the comparison.' }
      }
    }
  }
};

test('accepts one-job context plus input to output contract', () => {
  assert.deepEqual(operatorV7Issues({ manifest, inputSchema, outputSchema }), []);
});

test('rejects operator-owned routing and legacy envelopes', () => {
  const legacyManifest = { ...manifest, accepts: [], emits: [] };
  const legacyInput = structuredClone(inputSchema);
  legacyInput.required = ['schemaVersion', 'runId', 'stage', 'status', 'facts', 'payload'];
  legacyInput.properties = { schemaVersion: { const: 6 }, runId: {}, stage: {}, status: {}, facts: {}, payload: {} };
  const issues = operatorV7Issues({ manifest: legacyManifest, inputSchema: legacyInput, outputSchema });
  assert.ok(issues.some((issue) => issue.includes('accepts/emits')));
  assert.ok(issues.some((issue) => issue.includes('input root')));
});

test('rejects untyped objects and routing fields hidden in output', () => {
  const unclearOutput = structuredClone(outputSchema);
  unclearOutput.properties.output.properties.state = { type: 'object' };
  unclearOutput.properties.output.required.push('state');
  delete unclearOutput.properties.output.properties.evidenceRef.description;
  const issues = operatorV7Issues({ manifest, inputSchema, outputSchema: unclearOutput });
  assert.ok(issues.some((issue) => issue.includes('semantic description')));
  assert.ok(issues.some((issue) => issue.includes('routing field leaked')));
});

test('rejects Qdrant bindings from the v7 operator boundary', () => {
  const indexedManifest = { ...manifest, knowledgeRefs: ['quality.source-gates'] };
  const indexedInput = structuredClone(inputSchema);
  indexedInput.properties.context.properties.knowledge = {
    type: 'object', additionalProperties: false, description: 'qdrant-exact binding'
  };
  const issues = operatorV7Issues({ manifest: indexedManifest, inputSchema: indexedInput, outputSchema });
  assert.ok(issues.some((issue) => issue.includes('knowledgeRefs')));
  assert.ok(issues.some((issue) => issue.includes('Qdrant')));
});
