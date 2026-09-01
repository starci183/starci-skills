import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutput as validateArchitectureAlternatives } from './architecture/alternatives/validate-output.mjs';
import { validateInput as validateDirectionGenerateInput } from './fe/direction-generate/validate-input.mjs';

const hash = (character) => `sha256:${character.repeat(64)}`;
const grammarBinding = {
  bindingRef: 'grammar-binding://starci/dashboard',
  packageRef: 'grammar-package://starci',
  manifestRef: 'grammar://workspace',
  exportRefs: ['grammar://surface-card'],
  contentSha256: hash('c'),
  authorityRevision: 'grammar-revision-1',
  decisionManifestFingerprint: hash('d'),
  auditPlanRef: 'grammar-audit://dashboard',
  auditPlanFingerprint: hash('e'),
  compositionOwners: [{
    ownerRef: 'owner://dashboard-card',
    ownerLayer: 'grammar',
    authorityRef: 'grammar://surface-card',
    patternRef: 'pattern://surface-card',
  }],
};
const iconographyManifest = {
  manifestRef: 'iconography://dashboard',
  manifestFingerprint: hash('f'),
  mode: 'none',
  visualFamilyRef: null,
  decisions: [],
};
const mediaManifest = {
  manifestRef: 'media-manifest://dashboard',
  manifestFingerprint: hash('1'),
  mode: 'none',
  assetRef: null,
  artifactRefs: [],
  provenanceRefs: [],
  responsiveTreatmentRef: null,
  altIntentRef: null,
  fallbackRef: null,
};
const productFamilyEvidence = {
  grammarBindingRef: grammarBinding.bindingRef,
  grammarCoreRef: 'grammar-core://starci',
  packagedContractRefs: ['grammar-package://starci'],
  visualDnaRef: 'visual-dna://starci',
  productFamilyRef: 'product-family://starci-academy',
  benchmarkRasterRefs: [`benchmark://sha256-${'2'.repeat(64)}.png`],
};

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
      evidenceRefs: [
        'compiled-request://workspace',
        grammarBinding.packageRef,
        grammarBinding.manifestRef,
        grammarBinding.auditPlanRef,
        iconographyManifest.manifestRef,
        mediaManifest.manifestRef,
        ...productFamilyEvidence.benchmarkRasterRefs,
      ],
      uiKnowledgeId: 'fe.ui',
    },
    input: {
      compiledRequestRef: 'compiled-request://workspace',
      compiledRequestFingerprint: `sha256:${'b'.repeat(64)}`,
      grammarBinding,
      iconographyManifest,
      mediaManifest,
      productFamilyEvidence,
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
  const compile = readFileSync(new URL('./fe/request-compile/execute.md', import.meta.url), 'utf8');
  const generate = readFileSync(new URL('./fe/direction-generate/execute.md', import.meta.url), 'utf8');
  const architecture = readFileSync(new URL('../skills/starci-architecture-design/SKILL.md', import.meta.url), 'utf8');
  assert.match(law, /three or four materially different/);
  assert.match(law, /realistic pages? or substantial surfaces?/);
  assert.match(law, /ownership boundaries, data\/control flow/);
  assert.match(index, /through `visualize`[\s\S]*Render three or four materially different[\s\S]*choices and wait for selection/);
  assert.match(frontend, /valid-Grammar visual ambiguity presents three or four rendered alternatives/);
  assert.match(architecture, /system\/ownership boundaries/);
  assert.match(law, /unfamiliar[\s\S]*bounded external reference research/i);
  assert.match(law, /exhausted search does not authorize subjective invention/i);
  assert.match(law, /evidence, never StarCi business[\s\S]*authority/i);
  assert.match(frontend, /never fills them in by taste/i);
  assert.match(compile, /research queries, source URLs, access date/i);
  assert.match(compile, /return `business-required` or `blocked`/i);
  assert.match(generate, /explicit reversible hypothesis/i);
});
