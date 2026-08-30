import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { validateOutput as validateLawOutput } from './fe/principle-compile/validate-output.mjs';
import { validateOutput as validateGrammarOutput } from './fe/grammar-convergence/validate-output.mjs';
import { validateInput as validateSourceApplyInput } from './fe/source-apply/validate-input.mjs';

const machine = JSON.parse(readFileSync(new URL('../skills/starci-fe-process/machine.json', import.meta.url)));
const grammarOutput = () => ({
  schemaVersion: 7,
  operatorId: 'fe/grammar-convergence',
  output: {
    outcome: 'converged',
    result: {
      summary: 'Grammar Core compiled before source mutation.',
      artifactRefs: ['artifact://grammar-binding'],
      layoutCompilationRef: 'layout-compile://profile-v1',
      uiLawBindingRef: 'ui-law-binding://profile-v1',
      uiDetailBindingRef: 'ui-detail-binding://profile-v1',
      grammarBindingRef: 'grammar-binding://profile-v1',
      grammarCoreRef: 'grammar-core://starci-v1',
      packagedContractRefs: ['grammar-package://surface-card'],
      visualDnaRef: 'visual-dna://starci-v1',
      productFamilyEvidence: {
        productFamilyRef: 'product-family://starci-academy',
        benchmarkRasterRefs: [`benchmark://sha256-${'a'.repeat(64)}.png`],
      },
      applicationStage: 'before-source-mutation',
    },
    gaps: [],
    evidenceRefs: ['grammar://routed-v1', 'layout-compile://profile-v1'],
  },
});

test('mandatory UI-law binding cannot be omitted or replaced by Grammar/DNA ownership', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/principle-compile',
    output: {
      outcome: 'compiled',
      result: {
        summary: 'Selected direction satisfies every mandatory UI law.',
        artifactRefs: ['artifact://ui-law-binding'],
        directionRef: 'direction://focused',
        uiLawAuthorityRef: 'knowledge://ui-laws/v1',
        uiLawBindingRef: 'ui-law-binding://profile-v1',
        lawChecks: [{ lawRef: 'ui-law://hierarchy', verdict: 'satisfied', evidenceRefs: ['evidence://direction'] }],
      },
      gaps: [],
      evidenceRefs: ['evidence://direction'],
    },
  };
  assert.deepEqual(validateLawOutput(value), { valid: true, errors: [] });
  value.output.result.lawChecks = [];
  assert.equal(validateLawOutput(value).valid, false);
  value.output.result.lawChecks = [{ lawRef: 'ui-law://visual-dna-package', verdict: 'satisfied', evidenceRefs: ['evidence://direction'] }];
  assert.match(validateLawOutput(value).errors.join('\n'), /cannot own Grammar packages|pattern/);
});

test('Grammar Core requires packaged contracts plus visual DNA and rejects token-only or post-source treatment', () => {
  assert.deepEqual(validateGrammarOutput(grammarOutput()), { valid: true, errors: [] });
  const tokenOnly = grammarOutput();
  tokenOnly.output.result.packagedContractRefs = [];
  assert.equal(validateGrammarOutput(tokenOnly).valid, false);
  const postSource = grammarOutput();
  postSource.output.result.applicationStage = 'after-source-mutation';
  assert.equal(validateGrammarOutput(postSource).valid, false);
});

test('frontend machine freezes law-governed semantic detail before layout and Grammar Core, all before source apply', () => {
  assert.equal(machine.states.classify.on.find((edge) => edge.when?.outputEquals?.outcome === 'dominant').target, 'principle-compile');
  assert.equal(machine.states['principle-compile'].on.find((edge) => edge.when.outputEquals.outcome === 'compiled').target, 'ui-detail-freeze');
  assert.equal(machine.states['ui-detail-freeze'].on.find((edge) => edge.when.outputEquals.outcome === 'detail-frozen').target, 'layout-compile');
  assert.equal(machine.states['layout-compile'].on.find((edge) => edge.when.outputEquals.outcome === 'compiled').target, 'grammar-core-compile');
  assert.equal(machine.states['grammar-core-compile'].on.find((edge) => edge.when.outputEquals.outcome === 'converged').target, 'freeze');
  assert.equal(machine.states.freeze.on.find((edge) => edge.when.outputEquals.outcome === 'frozen').target, 'mutation-freeze');
  assert.equal(machine.states['mutation-freeze'].on.find((edge) => edge.when.outputEquals.outcome === 'frozen').target, 'apply');
  assert.equal(machine.states['choice-resume-route'].on.find((edge) => edge.when.inputEquals['resume.resumeState'] === 'direction-choice').target, 'principle-compile');
});

test('layout and Grammar schemas reject an omitted semantic-detail binding', () => {
  const layoutInput = JSON.parse(readFileSync(new URL('./fe/layout/input.schema.json', import.meta.url)));
  const layoutResult = JSON.parse(readFileSync(new URL('./fe/layout/output.schema.json', import.meta.url))).properties.output.properties.result.anyOf[0];
  const grammarInput = JSON.parse(readFileSync(new URL('./fe/grammar-convergence/input.schema.json', import.meta.url)));
  const grammarResult = JSON.parse(readFileSync(new URL('./fe/grammar-convergence/output.schema.json', import.meta.url))).properties.output.properties.result.anyOf[0];
  assert.ok(layoutInput.properties.input.required.includes('uiDetailBindingRef'));
  assert.ok(layoutResult.required.includes('uiDetailBindingRef'));
  assert.ok(grammarInput.properties.input.required.includes('uiDetailBindingRef'));
  assert.ok(grammarResult.required.includes('uiDetailBindingRef'));
});

test('source apply fails closed without law and packaged Grammar/DNA bindings', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/source-apply',
    context: { authorityRefs: ['authority://frontend'], evidenceRefs: ['contract://profile'], uiKnowledgeId: 'fe.ui' },
    input: {
      targetRef: 'surface://profile',
      constraints: [],
      behaviorContractRef: 'contract://profile',
      behaviorContractFingerprint: `sha256:${'b'.repeat(64)}`,
      uiLawBindingRef: 'ui-law-binding://profile-v1',
      uiDetailBindingRef: 'ui-detail-binding://profile-v1',
      grammarBindingRef: 'grammar-binding://profile-v1',
      grammarCoreRef: 'grammar-core://starci-v1',
      packagedContractRefs: ['grammar-package://surface-card'],
      visualDnaRef: 'visual-dna://starci-v1',
      mediaDecisionRef: 'media-decision://profile-v1',
    },
  };
  assert.deepEqual(validateSourceApplyInput(value), { valid: true, errors: [] });
  delete value.input.uiDetailBindingRef;
  assert.equal(validateSourceApplyInput(value).valid, false);
  value.input.uiDetailBindingRef = 'ui-detail-binding://profile-v1';
  delete value.input.packagedContractRefs;
  assert.equal(validateSourceApplyInput(value).valid, false);
});

test('blind review contract requires benchmark rasters and opaque Grammar identity without source rationale', () => {
  const schema = JSON.parse(readFileSync(new URL('./fe/visual-fidelity/input.schema.json', import.meta.url)));
  const packet = schema.properties.input.properties.blindReviewPacket;
  assert.ok(packet.required.includes('productFamilyEvidence'));
  const family = packet.properties.productFamilyEvidence;
  assert.deepEqual(family.required, ['grammarBindingRef', 'grammarCoreRef', 'packagedContractRefs', 'visualDnaRef', 'productFamilyRef', 'benchmarkRasterRefs']);
  assert.equal(family.properties.benchmarkRasterRefs.minItems, 1);
  assert.equal(packet.additionalProperties, false);
  const execute = readFileSync(new URL('./fe/visual-fidelity/execute.md', import.meta.url), 'utf8');
  assert.match(execute, /without the benchmark; then compare product-family quality/i);
  assert.match(execute, /Source code, DOM,[\s\S]*producer rationale[\s\S]*are absent/i);
});
