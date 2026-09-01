import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutput } from './fe/direction-generate/validate-output.mjs';

const input = JSON.parse(readFileSync(new URL('./fe/direction-generate/input.schema.json', import.meta.url), 'utf8'));
const output = JSON.parse(readFileSync(new URL('./fe/direction-generate/output.schema.json', import.meta.url), 'utf8'));
const execute = readFileSync(new URL('./fe/direction-generate/execute.md', import.meta.url), 'utf8');

test('direction generation supports one dominant preview or authorized alternatives', () => {
  assert.deepEqual(input.properties.input.properties.mode.enum, ['dominant', 'alternatives']);
  assert.match(input.properties.input.properties.mode.description, /material ambiguity or the user explicitly requests comparison/i);
  assert.match(execute, /mode=dominant.*exactly one/is);
  assert.match(execute, /mode=alternatives.*no materially dominant direction.*or the user explicitly requests comparison/is);
});

test('generated direction output exposes exact candidate identities and visualize artifact', () => {
  const result = output.properties.output.properties.result.anyOf[0];
  for (const field of ['compiledRequestRef', 'compiledRequestFingerprint', 'comparisonArtifactRef', 'mode', 'requiresChoice', 'directionCount', 'directions', 'grammarFilterRecords']) {
    assert.ok(result.required.includes(field), field);
  }
  assert.deepEqual(result.properties.directions.items.required, [
    'id', 'title', 'visualPanelRef', 'wideStateRef', 'compactStateRef',
    'materialStateRef', 'grammarDecisionManifestRef', 'tradeoff',
  ]);
  assert.equal(result.properties.comparisonArtifactRef.pattern, '\\.html$');
});

test('a generated receipt with a fake local HTML artifact is rejected', () => {
  const missing = '.claude/operators/fe/direction-generate/not-produced.html';
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/direction-generate',
    output: {
      outcome: 'generated',
      aiExecution: { model: 'gpt-5.6-sol', count: 1, isolation: 'fresh', forkTurns: 'none', executionRef: `execution://${'a'.repeat(64)}` },
      result: {
        summary: 'One rendered dominant direction.',
        compiledRequestRef: 'compiled-request://dashboard',
        compiledRequestFingerprint: `sha256:${'b'.repeat(64)}`,
        artifactRefs: [missing, '#dashboard-dominant'],
        comparisonArtifactRef: missing,
        mode: 'dominant',
        requiresChoice: false,
        directionCount: 1,
        directions: [{ id: 'dashboard-dominant', title: 'Dashboard dominant', visualPanelRef: '#dashboard-dominant', wideStateRef: '#wide', compactStateRef: '#compact', materialStateRef: '#loading', grammarDecisionManifestRef: 'grammar://dashboard-dominant', tradeoff: 'Keeps one primary task.' }],
        grammarFilterRecords: [{ candidateRef: 'dashboard-dominant', decision: 'accepted', manifestRef: 'grammar://dashboard-dominant', reasonRefs: ['grammar://valid'] }],
        materialDifferences: [],
      },
      gaps: [],
      evidenceRefs: ['compiled-request://dashboard'],
      handoff: null,
    },
  };
  const validation = validateOutput(value);
  assert.equal(validation.valid, false);
  assert.match(validation.errors.join('\n'), /existing inspectable HTML file/i);
});
