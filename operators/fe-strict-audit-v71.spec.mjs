import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { canonicalMachine } from '../skills/route-machine.mjs';
import { fingerprintGrammarAudit, validateGrammarAudit } from '../runtime/contracts/grammar-audit.mjs';
import { createOperatorInvocationBindingRegistry } from './invocation-binding.mjs';
import { REQUIRED_PREFLIGHT_CHECKS } from './fe/strict-ui-validation.mjs';
import { validateOutput as validateVisualOutput } from './fe/visual-fidelity/validate-output.mjs';

const readSchema = (operator, kind) => JSON.parse(readFileSync(new URL(`./fe/${operator}/${kind}.schema.json`, import.meta.url), 'utf8'));
const resultSchema = (schema) => schema.properties.output.properties.result.anyOf[0];
const resolveSchema = (root, value) => {
  if (Array.isArray(value)) return value.map((entry) => resolveSchema(root, entry));
  if (value === null || typeof value !== 'object') return value;
  if (value.$ref?.startsWith('#/')) {
    const target = value.$ref.slice(2).split('/').reduce((node, key) => node[key], root);
    const siblings = Object.fromEntries(Object.entries(value).filter(([key]) => key !== '$ref' && key !== 'description'));
    return { ...resolveSchema(root, target), ...resolveSchema(root, siblings) };
  }
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'description')
    .map(([key, entry]) => [key, resolveSchema(root, entry)]));
};
const machine = canonicalMachine('starci-fe-process');
const governanceFields = ['grammarBinding', 'iconographyManifest', 'mediaManifest', 'productFamilyEvidence'];
const retainedOperators = [
  'authority-reconcile',
  'capture-preflight',
  'direction-generate',
  'progress-guard',
  'render-capture',
  'request-compile',
  'return-consume',
  'source-apply',
  'visual-fidelity',
];

const hash = (character) => `sha256:${character.repeat(64)}`;
const governance = {
  grammarBinding: {
    bindingRef: 'grammar-binding://dashboard',
    packageRef: 'grammar-package://starci',
    manifestRef: 'grammar://dashboard',
    exportRefs: ['grammar://surface-card'],
    contentSha256: hash('a'),
    authorityRevision: 'revision-1',
    decisionManifestFingerprint: hash('b'),
    auditPlanRef: 'grammar-audit://dashboard',
    auditPlanFingerprint: hash('c'),
    compositionOwners: [{ ownerRef: 'owner://dashboard', ownerLayer: 'grammar', authorityRef: 'grammar://dashboard', patternRef: 'pattern://dashboard' }],
  },
  iconographyManifest: {
    manifestRef: 'iconography://dashboard',
    manifestFingerprint: hash('d'),
    mode: 'none',
    visualFamilyRef: null,
    decisions: [],
  },
  mediaManifest: {
    manifestRef: 'media-manifest://dashboard',
    manifestFingerprint: hash('e'),
    mode: 'none',
    assetRef: null,
    artifactRefs: [],
    provenanceRefs: [],
    responsiveTreatmentRef: null,
    altIntentRef: null,
    fallbackRef: null,
  },
  productFamilyEvidence: {
    grammarBindingRef: 'grammar-binding://dashboard',
    grammarCoreRef: 'grammar-core://starci',
    packagedContractRefs: ['grammar-package://starci'],
    visualDnaRef: 'visual-dna://starci',
    productFamilyRef: 'product-family://starci-academy',
    benchmarkRasterRefs: [`benchmark://sha256-${'f'.repeat(64)}.png`],
  },
};

test('the physical frontend operator inventory is exactly the nine retained v7.6 owners', () => {
  const directories = readdirSync(new URL('./fe/', import.meta.url), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(directories, retainedOperators);
  const active = [...new Set(Object.values(machine.states).map(({ ref }) => ref?.replace(/^fe\//, '')).filter(Boolean))].sort();
  assert.deepEqual(active, retainedOperators);
});

test('the retained machine exposes no helper, suspense, debt, or fixture-pass route', () => {
  const serialized = JSON.stringify(machine);
  for (const forbidden of ['direction-quality-screen', 'iconography-resolve', 'media-produce', 'SUSPENSE', 'fixture-passed', 'debt-repay']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'), forbidden);
  }
});

test('Grammar audit rejects mixed icon provenance and duplicate visual owners', () => {
  const check = (viewport, index) => ({
    cellRef: `proof-cell-00${index}`,
    ownerRef: 'owner://dashboard',
    ownerLayer: 'grammar',
    authorityRef: 'grammar://dashboard',
    stateRef: `state://${viewport}`,
    viewport,
    boundaryOwnerRefs: ['owner://dashboard'],
    insetOwnerRefs: ['owner://dashboard'],
    minimumInlineClearancePx: 12,
    inlineStartPx: 12,
    inlineEndPx: 12,
    dividerCount: 1,
    iconFamilyRefs: ['icon-family://heroicons'],
    evidenceRefs: [`raster://${viewport}`],
  });
  const audit = {
    schemaVersion: 1,
    contractVersion: '7.6.0',
    auditRef: 'grammar-audit://dashboard',
    targetRef: 'surface://dashboard',
    grammarManifestRef: 'grammar://dashboard',
    grammarManifestFingerprint: `sha256:${'a'.repeat(64)}`,
    iconographyManifestRef: 'iconography://dashboard',
    iconographyManifestFingerprint: `sha256:${'b'.repeat(64)}`,
    mediaManifestRef: 'media-manifest://dashboard',
    mediaManifestFingerprint: `sha256:${'c'.repeat(64)}`,
    proofMatrixFingerprint: `sha256:${'d'.repeat(64)}`,
    status: 'passed',
    checks: ['wide', 'intermediate', 'compact'].map((viewport, index) => check(viewport, index + 1)),
    violations: [],
    evidenceRefs: ['raster://wide', 'raster://intermediate', 'raster://compact'],
    auditFingerprint: '',
  };
  audit.auditFingerprint = fingerprintGrammarAudit(audit);
  assert.deepEqual(validateGrammarAudit(audit), { valid: true, errors: [] });
  audit.checks[1].iconFamilyRefs.push('icon-family://custom');
  audit.checks[2].boundaryOwnerRefs.push('owner://nested-shell');
  audit.auditFingerprint = fingerprintGrammarAudit(audit);
  const errors = validateGrammarAudit(audit).errors.join('\n');
  assert.match(errors, /mixes icon families/i);
  assert.match(errors, /duplicate boundary owners/i);
  assert.match(errors, /cannot pass/i);
});

test('author-once governance remains a required full contract through render capture', () => {
  const carriers = [
    ['request-compile/output', readSchema('request-compile', 'output'), (schema) => resultSchema(schema)],
    ['direction-generate/input', readSchema('direction-generate', 'input'), (schema) => schema.properties.input],
    ['direction-generate/output', readSchema('direction-generate', 'output'), (schema) => resultSchema(schema)],
    ['source-apply/input', readSchema('source-apply', 'input'), (schema) => schema.properties.input],
    ['source-apply/output', readSchema('source-apply', 'output'), (schema) => resultSchema(schema)],
    ['capture-preflight/input', readSchema('capture-preflight', 'input'), (schema) => schema.properties.input],
    ['capture-preflight/output', readSchema('capture-preflight', 'output'), (schema) => resultSchema(schema)],
    ['render-capture/input', readSchema('render-capture', 'input'), (schema) => schema.properties.input],
    ['render-capture/output', readSchema('render-capture', 'output'), (schema) => resultSchema(schema)],
  ];
  const expectedGrammar = resolveSchema(carriers[0][1], carriers[0][2](carriers[0][1]).properties.grammarBinding);
  const expectedIconography = resolveSchema(carriers[0][1], carriers[0][2](carriers[0][1]).properties.iconographyManifest);
  const expectedMedia = resolveSchema(carriers[0][1], carriers[0][2](carriers[0][1]).properties.mediaManifest);
  for (const [label, schema, select] of carriers) {
    const contract = select(schema);
    for (const field of governanceFields) assert.ok(contract.required.includes(field), `${label}:${field}`);
    assert.deepEqual(resolveSchema(schema, contract.properties.grammarBinding), expectedGrammar, `${label}:grammarBinding`);
    assert.deepEqual(resolveSchema(schema, contract.properties.iconographyManifest), expectedIconography, `${label}:iconographyManifest`);
    assert.deepEqual(resolveSchema(schema, contract.properties.mediaManifest), expectedMedia, `${label}:mediaManifest`);
    const family = resolveSchema(schema, contract.properties.productFamilyEvidence);
    assert.deepEqual(family.required, ['grammarBindingRef', 'grammarCoreRef', 'packagedContractRefs', 'visualDnaRef', 'productFamilyRef', 'benchmarkRasterRefs'], `${label}:productFamilyEvidence`);
    assert.equal(family.properties.benchmarkRasterRefs.minItems, 1, `${label}:benchmarkRasterRefs`);
    assert.match(family.properties.benchmarkRasterRefs.items.pattern, /sha256/, `${label}:content-addressed benchmark`);
  }
  assert.deepEqual(expectedGrammar.properties.compositionOwners.items.required, ['ownerRef', 'ownerLayer', 'authorityRef', 'patternRef']);
  assert.deepEqual(expectedIconography.properties.decisions.items.required, ['roleRef', 'meaningAuthorityRef', 'source', 'glyphRef', 'catalogSearchRefs', 'customReason']);
  assert.deepEqual(expectedMedia.required, ['manifestRef', 'manifestFingerprint', 'mode', 'assetRef', 'artifactRefs', 'provenanceRefs', 'responsiveTreatmentRef', 'altIntentRef', 'fallbackRef']);
});

test('blind review receives only opaque governance projections and returns a typed Grammar audit', () => {
  const render = readSchema('render-capture', 'output');
  const visualInput = readSchema('visual-fidelity', 'input');
  const visualOutput = readSchema('visual-fidelity', 'output');
  const renderPacket = resultSchema(render).properties.blindReviewPacket;
  const inputPacket = visualInput.properties.input.properties.blindReviewPacket;
  const outputResult = resultSchema(visualOutput);
  for (const field of governanceFields) {
    assert.ok(renderPacket.required.includes(field), `render packet:${field}`);
    assert.ok(inputPacket.required.includes(field), `visual input:${field}`);
    assert.ok(outputResult.required.includes(field), `visual output:${field}`);
    const expected = resolveSchema(render, renderPacket.properties[field]);
    assert.deepEqual(resolveSchema(visualInput, inputPacket.properties[field]), expected, `visual input:${field}`);
    assert.deepEqual(resolveSchema(visualOutput, outputResult.properties[field]), expected, `visual output:${field}`);
  }
  const blindGrammar = resolveSchema(render, renderPacket.properties.grammarBinding);
  assert.deepEqual(blindGrammar.required, ['bindingRef', 'manifestRef', 'decisionManifestFingerprint', 'auditPlanRef', 'auditPlanFingerprint']);
  assert.equal(blindGrammar.properties.compositionOwners, undefined);
  const blindIcons = resolveSchema(render, renderPacket.properties.iconographyManifest);
  assert.equal(blindIcons.properties.decisions, undefined);
  const blindMedia = resolveSchema(render, renderPacket.properties.mediaManifest);
  assert.equal(blindMedia.properties.provenanceRefs, undefined);
  const grammarAudit = resolveSchema(visualOutput, outputResult.properties.grammarAudit);
  assert.deepEqual(grammarAudit.properties.status.enum, ['passed', 'failed']);
  assert.ok(grammarAudit.required.includes('proofMatrixFingerprint'));
  assert.deepEqual(visualOutput.properties.output.properties.outcome.enum, ['passed', 'repair', 'insufficient-evidence', 'blocked']);
});

test('the central registry rejects governance drift at compile, direction, and source boundaries', () => {
  const registry = createOperatorInvocationBindingRegistry();
  const missionId = 'mission://governance-chain';
  const compiledRequestRef = 'compiled-request://dashboard';
  const compiled = {
    compiledRequestRef,
    compiledRequestFingerprint: hash('1'),
    targetRef: 'surface://dashboard',
    uxUiChangeLevel: 'refine',
    directionMode: 'none',
    directionEvidence: { classification: 'not-applicable', approvedDirectionAuthority: null, evidenceRefs: ['request://dashboard'] },
    behaviorContractRef: 'behavior://dashboard',
    behaviorContractFingerprint: hash('2'),
    proofMatrix: { matrixRef: 'proof://dashboard' },
    proofMatrixFingerprint: hash('3'),
    constraints: ['preserve dashboard behavior'],
    sourceBoundary: { repositoryRef: 'repo://frontend' },
    sourceBoundaryFingerprint: hash('4'),
    ...structuredClone(governance),
  };
  registry.record('fe/request-compile', { output: { outcome: 'compiled', result: compiled } }, { receiptId: 'receipt:compile', missionId });
  const directionInput = {
    compiledRequestRef,
    compiledRequestFingerprint: compiled.compiledRequestFingerprint,
    targetRef: compiled.targetRef,
    mode: 'dominant',
    constraints: compiled.constraints,
    ...structuredClone(governance),
  };
  const directionOutput = {
    output: {
      outcome: 'generated',
      result: { mode: 'dominant', compiledRequestRef, compiledRequestFingerprint: compiled.compiledRequestFingerprint, ...structuredClone(governance) },
      evidenceRefs: [compiledRequestRef],
    },
  };
  const directionDocument = { context: { evidenceRefs: [compiledRequestRef] }, input: directionInput };
  assert.deepEqual(registry.validate('fe/direction-generate', directionDocument, directionOutput, { missionId }), []);
  for (const field of governanceFields) {
    const drifted = structuredClone(directionDocument);
    drifted.input[field].drift = field;
    assert.match(registry.validate('fe/direction-generate', drifted, directionOutput, { missionId }).join('\n'), new RegExp(field));
  }
  const sourceInput = {
    mode: 'apply',
    compiledRequestRef,
    compiledRequestFingerprint: compiled.compiledRequestFingerprint,
    targetRef: compiled.targetRef,
    uxUiChangeLevel: compiled.uxUiChangeLevel,
    directionMode: 'none',
    directionEvidence: structuredClone(compiled.directionEvidence),
    directionBinding: null,
    behaviorContractRef: compiled.behaviorContractRef,
    behaviorContractFingerprint: compiled.behaviorContractFingerprint,
    proofMatrix: compiled.proofMatrix,
    proofMatrixFingerprint: compiled.proofMatrixFingerprint,
    constraints: compiled.constraints,
    sourceBoundary: compiled.sourceBoundary,
    sourceBoundaryFingerprint: compiled.sourceBoundaryFingerprint,
    ...structuredClone(governance),
  };
  const sourceOutput = { output: { outcome: 'applied', result: structuredClone(sourceInput) } };
  const sourceDocument = { context: { resumeState: 'apply' }, input: sourceInput };
  assert.deepEqual(registry.validate('fe/source-apply', sourceDocument, sourceOutput, { missionId }), []);
  for (const field of governanceFields) {
    const drifted = structuredClone(sourceOutput);
    drifted.output.result[field].drift = field;
    assert.match(registry.validate('fe/source-apply', sourceDocument, drifted, { missionId }).join('\n'), new RegExp(field));
  }
  const directionInputDrift=structuredClone(sourceDocument);
  directionInputDrift.input.directionEvidence.evidenceRefs=['request://different'];
  assert.match(registry.validate('fe/source-apply', directionInputDrift, sourceOutput, { missionId }).join('\n'), /directionEvidence differs from the registered compiled request/);
  const directionResultDrift=structuredClone(sourceOutput);
  directionResultDrift.output.result.directionEvidence.evidenceRefs=['request://different'];
  assert.match(registry.validate('fe/source-apply', sourceDocument, directionResultDrift, { missionId }).join('\n'), /directionEvidence differs from invocation input/);
});

test('preflight consumes exact compile and registered mutation lineage', () => {
  const schema = readSchema('capture-preflight', 'input');
  const required = schema.properties.input.required;
  for (const field of ['compiledRequestRef', 'compiledRequestFingerprint', 'sourceApplyReturnReceiptRef', 'aggregateAfterFingerprint', 'matrix']) {
    assert.ok(required.includes(field), field);
  }
  assert.equal(schema.properties.context.properties.sourceFingerprint, undefined);
  assert.deepEqual(schema.properties.input.properties.matrix.properties.viewports.items.enum, ['wide', 'intermediate', 'compact']);
  assert.equal(schema.properties.input.properties.matrix.properties.probeRefs.minItems, 22);
  assert.equal(REQUIRED_PREFLIGHT_CHECKS.length, 14);
  assert.deepEqual(schema.properties.input.properties.readinessChecks.items.properties.check.enum, REQUIRED_PREFLIGHT_CHECKS);
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
