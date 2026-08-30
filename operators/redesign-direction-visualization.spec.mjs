import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutput as validateArchitectureAlternatives } from './architecture/alternatives/validate-output.mjs';
import { validateInput as validateDirectionRankInput } from './fe/direction-rank/validate-input.mjs';

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

test('frontend ranking cannot begin without the rendered HTML comparison', () => {
  const valid = {
    schemaVersion: 7,
    operatorId: 'fe/direction-rank',
    context: { authorityRefs: ['authority://frozen'], evidenceRefs: ['artifact://workspace.html'], uiKnowledgeId: 'fe.ui' },
    input: { targetRef: 'surface://workspace', directionSetRef: 'direction-set://workspace', visualArtifactRefs: ['artifact://workspace.html'], constraints: ['recommend exactly one'] },
  };
  assert.deepEqual(validateDirectionRankInput(valid), { valid: true, errors: [] });
  const proseOnly = structuredClone(valid);
  proseOnly.input.visualArtifactRefs = [];
  assert.equal(validateDirectionRankInput(proseOnly).valid, false);
});

test('global redesign law assigns domain-specific visual effort before choice', () => {
  const law = readFileSync(new URL('../knowledge/direction-visualization.md', import.meta.url), 'utf8');
  const index = readFileSync(new URL('../INDEX.md', import.meta.url), 'utf8');
  const frontend = readFileSync(new URL('../skills/starci-fe-process/SKILL.md', import.meta.url), 'utf8');
  const architecture = readFileSync(new URL('../skills/starci-architecture-design/SKILL.md', import.meta.url), 'utf8');
  assert.match(law, /three or four materially different/);
  assert.match(law, /realistic page or substantial-surface mockups/);
  assert.match(law, /system and ownership boundaries/);
  assert.match(index, /render three or four materially\s+different choices\s+through `visualize`/);
  assert.match(frontend, /realistic representative page or substantial-surface mockups/);
  assert.match(architecture, /system\/ownership boundaries/);
});
