import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutput as validateArchitectureAlternatives } from './architecture/alternatives/validate-output.mjs';
import { validateInput as validateDirectionGenerateInput } from './fe/direction-generate/validate-input.mjs';

const architectureOutput = () => ({
  schemaVersion: 7,
  operatorId: 'architecture/alternatives',
  output: {
    outcome: 'ready',
    aiExecution: { model: 'gpt-5.6-sol', count: 1, isolation: 'fresh', forkTurns: 'none', executionRef: `execution://${'a'.repeat(64)}` },
    resultRef: 'artifact://architecture/redesign-comparison.html',
    directionCount: 3,
    visualPanelRefs: ['#modular-monolith', '#event-driven', '#workflow-engine'],
    evidenceRefs: ['artifact://architecture/redesign-comparison.html', 'authority://architecture'],
    findings: ['renderer:visualize', 'normal-flow:rendered', 'outage-recovery:rendered'],
    reason: null,
  },
});

test('architecture redesign accepts only a three-or-four direction visualize comparison', () => {
  assert.deepEqual(validateArchitectureAlternatives(architectureOutput()), { valid: true, errors: [] });
  const proseOnly = architectureOutput();
  proseOnly.output.resultRef = 'artifact://architecture/options.md';
  proseOnly.output.evidenceRefs = ['artifact://architecture/options.md'];
  proseOnly.output.findings = ['three options described'];
  assert.equal(validateArchitectureAlternatives(proseOnly).valid, false);
});

test('frontend alternatives cannot begin without an author-once request and exact Grammar identity', () => {
  const valid = {
    schemaVersion: 7,
    operatorId: 'fe/direction-generate',
    context: {
      authorityRefs: ['authority://frozen'],
      evidenceRefs: ['compiled-request://workspace', 'grammar-package://starci', 'grammar://workspace'],
      uiKnowledgeId: 'fe.ui',
    },
    input: {
      compiledRequestRef: 'compiled-request://workspace',
      compiledRequestFingerprint: `sha256:${'b'.repeat(64)}`,
      grammarBinding: { packageRef: 'grammar-package://starci', manifestRef: 'grammar://workspace', exportRefs: ['grammar://surface-card'], contentSha256: `sha256:${'c'.repeat(64)}`, authorityRevision: 'grammar-revision-1' },
      targetRef: 'surface://workspace',
      mode: 'alternatives',
      constraints: ['material ambiguity remains after Grammar validation'],
    },
  };
  assert.deepEqual(validateDirectionGenerateInput(valid), { valid: true, errors: [] });
  const substituted = structuredClone(valid);
  substituted.input.compiledRequestRef = 'compiled-request://other';
  assert.equal(validateDirectionGenerateInput(substituted).valid, false);
});

test('global redesign law assigns domain-specific visual effort before choice', () => {
  const law = readFileSync(new URL('../knowledge/direction-visualization.md', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../INDEX.md', import.meta.url), 'utf8');
  const frontend = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const architecture = readFileSync(new URL('../skills/starci-architecture-design/SKILL.md', import.meta.url), 'utf8');
  assert.match(law, /three or four materially different/);
  assert.match(law, /realistic pages? or substantial surfaces?/);
  assert.match(law, /ownership boundaries, data\/control flow/);
  assert.match(index, /through `visualize`[\s\S]*Render three or four materially different[\s\S]*choices and wait for selection/);
  assert.match(frontend, /valid-Grammar visual ambiguity presents three or four rendered alternatives/);
  assert.match(architecture, /system\/ownership boundaries/);
});
