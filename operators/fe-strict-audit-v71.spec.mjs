import assert from 'node:assert/strict';
import test from 'node:test';
import { REQUIRED_CHALLENGE_FAMILIES, REQUIRED_PROBE_CATEGORIES, REQUIRED_VISUAL_LENSES } from './fe/strict-ui-validation.mjs';
import { validateOutput as validateObservation } from './fe/runtime-observe/validate-output.mjs';
import { validateOutput as validateSemanticAudit } from './fe/semantic-audit/validate-output.mjs';
import { validateInput as validateContractInput } from './fe/contract-freeze/validate-input.mjs';
import { validateInput as validateCaptureInput } from './fe/render-capture/validate-input.mjs';
import { validateOutput as validateCaptureOutput } from './fe/render-capture/validate-output.mjs';
import { validateInput as validateVisualInput } from './fe/visual-fidelity/validate-input.mjs';
import { validateOutput as validateVisualOutput } from './fe/visual-fidelity/validate-output.mjs';
import { validateOutput as validateIndependentOutput } from './fe/independent-review/validate-output.mjs';
import { validateInput as validatePreflightInput } from './fe/capture-preflight/validate-input.mjs';
import { validateOutput as validatePreflightOutput } from './fe/capture-preflight/validate-output.mjs';
import { validateOutput as validateFindingOutput } from './fe/finding-classify/validate-output.mjs';
import { createOperatorInvocationBindingRegistry } from './invocation-binding.mjs';
import { fingerprint } from '../runtime/trace.mjs';

const responsiveStateInventory = [
  { viewport: 'wide', stateRef: 'state://wide', requestedWidthPx: 1440, requestedHeightPx: 900, observedWidthPx: 1440, observedHeightPx: 900, rasterFingerprint: `sha256:${'a'.repeat(64)}`, evidenceRef: 'render://wide.png' },
  { viewport: 'intermediate', stateRef: 'state://intermediate', requestedWidthPx: 1024, requestedHeightPx: 800, observedWidthPx: 1024, observedHeightPx: 800, rasterFingerprint: `sha256:${'b'.repeat(64)}`, evidenceRef: 'render://intermediate.png' },
  { viewport: 'compact', stateRef: 'state://compact', requestedWidthPx: 390, requestedHeightPx: 844, observedWidthPx: 390, observedHeightPx: 844, rasterFingerprint: `sha256:${'c'.repeat(64)}`, evidenceRef: 'render://compact.png' },
];
const invocationBindings = createOperatorInvocationBindingRegistry();
const raster = (label) => `render://${label}/sha256-${fingerprint(label).slice(7)}.png`;
const visualRound = { number: 1, purpose: 'discovery' };
const liveDataEvidence = () => ({ mode: 'live', contractRef: null, fixtureFingerprint: null, backendGapRef: null, backendProofReceiptRef: null, fixtureScope: 'not-applicable', productMutation: false });
const fixtureDataEvidence = () => ({ mode: 'contract-fixture', contractRef: 'contract://profile-v1', fixtureFingerprint: `sha256:${'f'.repeat(64)}`, backendGapRef: 'backend-gap://missing-profile', backendProofReceiptRef: 'receipt:backend-profile-prove', fixtureScope: 'visual-evidence-only', productMutation: false });
const productFamilyEvidence = () => ({
  grammarBindingRef: 'grammar-binding://profile-v1',
  grammarCoreRef: 'grammar-core://starci-v1',
  packagedContractRefs: ['grammar-package://surface-list-card'],
  visualDnaRef: 'visual-dna://starci-v1',
  productFamilyRef: 'product-family://starci-academy',
  benchmarkRasterRefs: [raster('benchmark-course')],
});
const capturePreflight = () => ({
  preflightRef: `preflight://${'3'.repeat(64)}`,
  matrixRef: 'matrix://profile-v1',
  matrixFingerprint: `sha256:${'4'.repeat(64)}`,
  partitionFingerprint: `sha256:${'5'.repeat(64)}`,
  round: { ...visualRound },
  capturePartitionRefs: ['partition://profile-main'],
  reusedPartitionRefs: [],
  dataEvidence: liveDataEvidence(),
});
const readinessChecks = () => [
  'runtime-origin-valid', 'dependency-graph-ready', 'repository-reproducibility-recorded', 'viewport-controls-effective',
  'data-ready', 'steady-not-skeleton', 'state-content-valid', 'controls-effective',
  'page-scroll-restored', 'bounded-scroll-restored', 'zoom-restored', 'probe-complete',
  'raster-unique', 'handoff-host-valid',
].map((check) => ({ check, verdict: 'passed', evidenceRef: `evidence://${check}`, observation: `Deterministic ${check} check passed on the frozen target.` }));

const behaviorContract = () => ({
  observedInteractionRefs: ['interaction://roadmap-search', 'interaction://task-navigation'],
  interactionDecisions: [
    { interactionRef: 'interaction://roadmap-search', decision: 'preserve', authorityRef: null, rationale: null, replacementRef: null },
    { interactionRef: 'interaction://task-navigation', decision: 'preserve', authorityRef: null, rationale: null, replacementRef: null },
  ],
  surfaceOwnerRefs: ['surface://roadmap'],
  uiLawBindingRef: 'ui-law-binding://profile-v1',
  uiDetailBindingRef: 'ui-detail-binding://profile-v1',
  grammarBindingRef: 'grammar-binding://profile-v1',
  grammarCoreRef: 'grammar-core://starci-v1',
  packagedContractRefs: ['grammar-package://surface-list-card'],
  visualDnaRef: 'visual-dna://starci-v1',
  productFamilyEvidence: {
    productFamilyRef: 'product-family://starci-academy',
    benchmarkRasterRefs: [raster('benchmark-course')],
  },
  responsiveStates: responsiveStateInventory.map(({ viewport, stateRef }) => ({ viewport, stateRef })),
});

const lifecyclePhases = {
  viewport: ['baseline', 'breakpoint-edge'],
  zoom: ['zoom-in', 'zoom-out', 'restored'],
  'page-scroll': ['start', 'middle', 'end', 'restored'],
  'bounded-scroll': ['start', 'end', 'restored'],
  'content-stress': ['content-long', 'content-short'],
  'state-transition': ['skeleton', 'loading', 'steady'],
  'sticky-fixed-overlay': ['baseline', 'overlay-open'],
  drag: ['drag-limit'],
  'keyboard-focus': ['focus'],
  'composition-neighbors': ['baseline'],
};
const probes = () => REQUIRED_PROBE_CATEGORIES.flatMap((category) =>
  (lifecyclePhases[category] ?? ['baseline']).map((phase) => ({
    probeId: `probe-${category}-${phase}`,
    category,
    phase,
    stateRef: `state://${phase}`,
    attempt: `Attack ${category} at ${phase}`,
    expectedFailure: `Expose ${category} regression at ${phase}`,
  })));
const probeRecords = (contradictionIndex = -1) => probes().map((probe, index) => ({
  probeId: probe.probeId,
  category: probe.category,
  phase: probe.phase,
  imageRef: raster(probe.probeId),
  verdict: index === contradictionIndex ? 'contradiction' : 'survived',
  observation: 'Observed the complete lifecycle attack result in fresh pixels.',
}));

const blindPacket = () => {
 const probeCells=probes().map(({probeId,category,stateRef})=>({probeId,category,phase:stateRef.replace('state://',''),applicable:true,imageRef:raster(probeId),reason:null}));
 return ({
  packetRef:`packet://${'9'.repeat(64)}`,
  packetFingerprint:`sha256:${'1'.repeat(64)}`,
  captureReceiptId:'receipt:capture-001',
  preflightRef:capturePreflight().preflightRef,
  matrixRef:capturePreflight().matrixRef,
  matrixFingerprint:capturePreflight().matrixFingerprint,
  partitionFingerprint:capturePreflight().partitionFingerprint,
  visualRound:{...visualRound},
  capturePartitionRefs:[...capturePreflight().capturePartitionRefs],
  reusedPartitionRefs:[],
  dataEvidence:liveDataEvidence(),
  productFamilyEvidence:productFamilyEvidence(),
  latestMutationFingerprint:`sha256:${'2'.repeat(64)}`,
  capturedSourceFingerprint:`sha256:${'2'.repeat(64)}`,
  latestMutationAt:'2026-08-30T01:00:00.000Z',
  capturedAt:'2026-08-30T01:01:00.000Z',
  rasterCells:[
    {cellRef:'cell-001',imageRef:raster('host'),viewKind:'host-context',viewport:'host',lastScreenshot:true},
    {cellRef:'cell-002',imageRef:raster('wide'),viewKind:'surface-focus',viewport:'wide',lastScreenshot:false},
    {cellRef:'cell-003',imageRef:raster('intermediate'),viewKind:'viewport',viewport:'intermediate',lastScreenshot:false},
    {cellRef:'cell-004',imageRef:raster('final'),viewKind:'viewport',viewport:'compact',lastScreenshot:false},
    ...probeCells.map((probe,index)=>({cellRef:`cell-${String(index+5).padStart(3,'0')}`,imageRef:probe.imageRef,viewKind:'lifecycle',viewport:'wide',lastScreenshot:false})),
  ],
  probeCells,
  lastScreenshotRef:raster('host'),
 });
};
const unsupportedZoomPacket = () => {
  const packet = blindPacket();
  const zoomRasterRefs = new Set(packet.probeCells.filter(({ category }) => category === 'zoom').map(({ imageRef }) => imageRef));
  packet.probeCells = packet.probeCells.map((probe) => probe.category === 'zoom'
    ? { ...probe, applicable: false, imageRef: null, reason: 'tool-capability-unavailable' }
    : probe);
  packet.rasterCells = packet.rasterCells.filter(({ imageRef }) => !zoomRasterRefs.has(imageRef));
  return packet;
};
const packetManifest=({packetRef,preflightRef,matrixRef,matrixFingerprint,partitionFingerprint,visualRound,capturePartitionRefs,reusedPartitionRefs,dataEvidence,productFamilyEvidence,latestMutationFingerprint,capturedSourceFingerprint,latestMutationAt,capturedAt,rasterCells,probeCells,lastScreenshotRef})=>({packetRef,preflightRef,matrixRef,matrixFingerprint,partitionFingerprint,visualRound,capturePartitionRefs,reusedPartitionRefs,dataEvidence,productFamilyEvidence,latestMutationFingerprint,capturedSourceFingerprint,latestMutationAt,capturedAt,rasterCells,probeCells,lastScreenshotRef});
const captureOutputDocument=(packet)=>({schemaVersion:7,operatorId:'fe/render-capture',output:{outcome:'captured',result:{summary:'Captured exact visual matrix and lifecycle packet.',artifactRefs:[packet.packetRef],preflightRef:packet.preflightRef,matrixRef:packet.matrixRef,matrixFingerprint:packet.matrixFingerprint,partitionFingerprint:packet.partitionFingerprint,visualRound:packet.visualRound,capturePartitionRefs:packet.capturePartitionRefs,reusedPartitionRefs:packet.reusedPartitionRefs,dataEvidence:packet.dataEvidence,productFamilyEvidence:packet.productFamilyEvidence,sourceFingerprint:packet.capturedSourceFingerprint,latestMutationFingerprint:packet.latestMutationFingerprint,latestMutationAt:packet.latestMutationAt,capturedAt:packet.capturedAt,blindReviewPacketRef:packet.packetRef,blindReviewPacketFingerprint:fingerprint(packetManifest(packet)),blindReviewPacket:packetManifest(packet),renderMatrix:[
  {stateRef:'state://steady',viewport:'wide',imageRef:raster('wide'),handoffState:true},
  {stateRef:'state://steady',viewport:'intermediate',imageRef:raster('intermediate'),handoffState:true},
  {stateRef:'state://steady',viewport:'compact',imageRef:raster('final'),handoffState:true},
],adversarialProbeMatrix:probes().map((probe)=>({...probe,outcome:'survived',imageRef:raster(probe.probeId),reason:null})),handoffHostArtifact:{surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false,imageRef:raster('host')}},gaps:[],evidenceRefs:[raster('host')],handoff:null}});

test('capture preflight freezes a deterministic owner-partitioned matrix before Sol review',()=>{
  const matrixBody={renderStates:['state://steady'],viewports:['wide','intermediate','compact'],probeRefs:probes().map(({probeId})=>probeId)};
  const partitions=[
    {partitionRef:'partition://profile-main',ownerRef:'surface://profile',stateRefs:['state://steady'],probeRefs:matrixBody.probeRefs,disposition:'capture',dependencyProofRefs:[]},
    {partitionRef:'partition://shared-header',ownerRef:'surface://header',stateRefs:['state://steady'],probeRefs:[],disposition:'reuse',dependencyProofRefs:['dependency://header-unchanged']},
  ];
  const input={schemaVersion:7,operatorId:'fe/capture-preflight',context:{authorityRefs:['contract://profile'],evidenceRefs:['runtime://profile'],uiKnowledgeId:'fe.ui',runtimeReadinessKnowledgeId:'fe.runtime-capture-readiness',sourceFingerprint:`sha256:${'2'.repeat(64)}`,debug:true},input:{targetRef:'surface://profile',round:{...visualRound},matrix:{matrixRef:'matrix://profile-v1',matrixFingerprint:fingerprint(matrixBody),...matrixBody},partitions,dataEvidence:liveDataEvidence(),readinessChecks:readinessChecks()}};
  assert.deepEqual(validatePreflightInput(input),{valid:true,errors:[]});
  const result={summary:'Capture mechanics are ready.',artifactRefs:['preflight://artifact'],preflightRef:`preflight://${'3'.repeat(64)}`,sourceFingerprint:input.context.sourceFingerprint,round:{...visualRound},matrixRef:input.input.matrix.matrixRef,matrixFingerprint:input.input.matrix.matrixFingerprint,partitionFingerprint:fingerprint(partitions),capturePartitionRefs:['partition://profile-main'],reusedPartitionRefs:['partition://shared-header'],dataEvidence:liveDataEvidence(),readinessChecks:readinessChecks()};
  const output={schemaVersion:7,operatorId:'fe/capture-preflight',output:{outcome:'ready',result,gaps:[],evidenceRefs:['runtime://profile'],handoff:null}};
  assert.deepEqual(validatePreflightOutput(output),{valid:true,errors:[]});
  assert.deepEqual(invocationBindings.validate('fe/capture-preflight',input,output),[]);
  const unproved=structuredClone(input); unproved.input.partitions[1].dependencyProofRefs=[];
  assert.match(validatePreflightInput(unproved).errors.join('\n'),/reuse requires exact dependency proof/);
  const changedMatrix=structuredClone(input); changedMatrix.input.matrix.renderStates.push('state://loading');
  assert.match(validatePreflightInput(changedMatrix).errors.join('\n'),/must hash the exact immutable matrix body/);
  const legacyChecks=structuredClone(input); legacyChecks.input.readinessChecks=legacyChecks.input.readinessChecks.slice(3);
  assert.equal(validatePreflightInput(legacyChecks).valid,false);
  const fixture=structuredClone(input); fixture.input.dataEvidence=fixtureDataEvidence();
  assert.equal(validatePreflightInput(fixture).valid,true);
  const invalidFixture=structuredClone(fixture); invalidFixture.input.dataEvidence.backendGapRef=null;
  assert.match(validatePreflightInput(invalidFixture).errors.join('\n'),/contract-fixture mode requires/);
  const unroutedFixture=structuredClone(fixture); unroutedFixture.input.dataEvidence.backendProofReceiptRef=null;
  assert.match(validatePreflightInput(unroutedFixture).errors.join('\n'),/consumed backend prove RETURN/);
  const backendRequired={schemaVersion:7,operatorId:'fe/capture-preflight',output:{outcome:'backend-required',result:null,gaps:['Routed live playground data is unavailable.'],evidenceRefs:['runtime://playground-empty'],handoff:{skillId:'starci-backend-process',intentMode:'prove',missionRef:'mission-playground-data',resumeState:'apply',inputRef:'backend-input://playground-data-proof'}}};
  assert.deepEqual(validatePreflightOutput(backendRequired),{valid:true,errors:[]});
  const missingBackendCall=structuredClone(backendRequired); missingBackendCall.output.handoff=null;
  assert.match(validatePreflightOutput(missingBackendCall).errors.join('\n'),/must emit a starci-backend-process prove handoff/);
  const capabilityInput=structuredClone(input);
  const zoomCheck=capabilityInput.input.readinessChecks.find(({check})=>check==='zoom-restored');
  Object.assign(zoomCheck,{verdict:'not-applicable',evidenceRef:'capability://zoom/native-and-fresh-context-inert',observation:'Native zoom and one fresh-context confirmation were both unavailable to the capture tool.'});
  assert.deepEqual(validatePreflightInput(capabilityInput),{valid:true,errors:[]});
  const capabilityResult={...structuredClone(result),readinessChecks:structuredClone(capabilityInput.input.readinessChecks)};
  const capabilityOutput={schemaVersion:7,operatorId:'fe/capture-preflight',output:{outcome:'ready',result:capabilityResult,gaps:[],evidenceRefs:['runtime://profile','capability://zoom/native-and-fresh-context-inert'],handoff:null}};
  assert.deepEqual(validatePreflightOutput(capabilityOutput),{valid:true,errors:[]});
  assert.deepEqual(invocationBindings.validate('fe/capture-preflight',capabilityInput,capabilityOutput),[]);
  const wrongCheck=structuredClone(capabilityInput); Object.assign(wrongCheck.input.readinessChecks.find(({check})=>check==='controls-effective'),{verdict:'not-applicable',evidenceRef:'capability://zoom/forged'});
  assert.match(validatePreflightInput(wrongCheck).errors.join('\n'),/only for zoom-restored/);
  const missingReceipt=structuredClone(capabilityInput); missingReceipt.input.readinessChecks.find(({check})=>check==='zoom-restored').evidenceRef='evidence://zoom-missing';
  assert.match(validatePreflightInput(missingReceipt).errors.join('\n'),/capability:\/\/zoom/);
});

test('finding classification batches every finding and round three cannot reopen repair',()=>{
  const ledger=['finding://spacing','finding://scroll'].map((findingRef,index)=>({findingRef,findingFingerprint:`sha256:${String(index+7).repeat(64)}`,disposition:'new',affectedPartitionRefs:['partition://profile-main']}));
  const value={schemaVersion:7,operatorId:'fe/finding-classify',output:{outcome:'repair',result:{summary:'Two implementation findings form one repair batch.',artifactRefs:['artifact://batch'],reviewStage:'visual-fidelity',batchRef:`batch://${'8'.repeat(64)}`,visualRound:{number:2,purpose:'verification'},findingLedger:ledger,ownerAssessments:ledger.map(({findingRef})=>({findingRef,owner:'implementation',counterevidenceRef:'raster://counterevidence',authorityRef:null,rationale:'The pixels demonstrate an implementation-owned regression.'}))},gaps:[],evidenceRefs:['visual://round-2'],handoff:null}};
  assert.deepEqual(validateFindingOutput(value),{valid:true,errors:[]});
  value.output.result.ownerAssessments.pop();
  assert.match(validateFindingOutput(value).errors.join('\n'),/complete finding ledger/);
  value.output.result.ownerAssessments=ledger.map(({findingRef})=>({findingRef,owner:'implementation',counterevidenceRef:'raster://counterevidence',authorityRef:null,rationale:'The pixels demonstrate an implementation-owned regression.'}));
  value.output.result.visualRound={number:3,purpose:'regression'};
  assert.match(validateFindingOutput(value).errors.join('\n'),/round 3 findings must trip the circuit breaker/);
});

test('blind visual input is one fresh Sol raster packet and rejects stale or self review',()=>{
  const value={schemaVersion:7,operatorId:'fe/visual-fidelity',context:{implementerExecutionRef:`execution://${'a'.repeat(64)}`,reviewerExecutionRef:`execution://${'b'.repeat(64)}`,implementerPrincipalFingerprint:`sha256:${'c'.repeat(64)}`,reviewerPrincipalFingerprint:`sha256:${'d'.repeat(64)}`,reviewerContextFingerprint:null,reviewerModel:'gpt-5.6-sol',reviewerCount:1,contextIsolation:'fresh',forkTurns:'none',debug:true},input:{blindReviewPacket:blindPacket()}};
  value.context.reviewerContextFingerprint=fingerprint(value.input.blindReviewPacket);
  assert.deepEqual(validateVisualInput(value),{valid:true,errors:[]});
  value.context.reviewerExecutionRef=value.context.implementerExecutionRef;
  assert.match(validateVisualInput(value).errors.join('\n'),/must differ/);
  value.context.reviewerExecutionRef=`execution://${'b'.repeat(64)}`;
  value.context.reviewerPrincipalFingerprint=value.context.implementerPrincipalFingerprint;
  assert.match(validateVisualInput(value).errors.join('\n'),/principal must differ/);
  value.context.reviewerPrincipalFingerprint=`sha256:${'d'.repeat(64)}`;
  value.input.blindReviewPacket.capturedSourceFingerprint=`sha256:${'3'.repeat(64)}`;
  assert.match(validateVisualInput(value).errors.join('\n'),/stale/);
  const missingIntermediate={...value,input:{blindReviewPacket:blindPacket()}};
  missingIntermediate.context={...value.context,reviewerContextFingerprint:fingerprint(missingIntermediate.input.blindReviewPacket)};
  missingIntermediate.input.blindReviewPacket.rasterCells=missingIntermediate.input.blindReviewPacket.rasterCells.filter(({viewport})=>viewport!=='intermediate');
  missingIntermediate.context.reviewerContextFingerprint=fingerprint(missingIntermediate.input.blindReviewPacket);
  assert.match(validateVisualInput(missingIntermediate).errors.join('\n'),/contains|schema branch|intermediate/i);
  const noLifecycle={...value,input:{blindReviewPacket:blindPacket()}};
  for(const probe of noLifecycle.input.blindReviewPacket.probeCells){ if(['zoom','page-scroll','bounded-scroll','state-transition'].includes(probe.category)){ probe.applicable=false; probe.imageRef=null; probe.reason='lifecycle-not-present'; } }
  noLifecycle.input.blindReviewPacket.rasterCells=noLifecycle.input.blindReviewPacket.rasterCells.filter(({imageRef})=>imageRef && !noLifecycle.input.blindReviewPacket.probeCells.some((probe)=>probe.imageRef===imageRef));
  noLifecycle.context={...value.context,reviewerContextFingerprint:fingerprint(noLifecycle.input.blindReviewPacket)};
  assert.match(validateVisualInput(noLifecycle).errors.join('\n'),/requires .* applicable raster phases/);
  const unsupportedZoom={...value,input:{blindReviewPacket:unsupportedZoomPacket()}};
  unsupportedZoom.context={...value.context,reviewerExecutionRef:`execution://${'b'.repeat(64)}`,reviewerPrincipalFingerprint:`sha256:${'d'.repeat(64)}`,reviewerContextFingerprint:fingerprint(unsupportedZoom.input.blindReviewPacket)};
  assert.deepEqual(validateVisualInput(unsupportedZoom),{valid:true,errors:[]});
  const partialUnsupported=structuredClone(unsupportedZoom);
  partialUnsupported.input.blindReviewPacket.probeCells.find(({category})=>category==='zoom').reason='lifecycle-not-present';
  partialUnsupported.context.reviewerContextFingerprint=fingerprint(partialUnsupported.input.blindReviewPacket);
  assert.match(validateVisualInput(partialUnsupported).errors.join('\n'),/unsupported zoom must cover all three canonical phases|requires 3 applicable raster phases/);
});

test('visual verdict is bound to the exact supplied packet, rasters, final screenshot, and reviewer execution',()=>{
  const input={schemaVersion:7,operatorId:'fe/visual-fidelity',context:{implementerExecutionRef:`execution://${'a'.repeat(64)}`,reviewerExecutionRef:`execution://${'b'.repeat(64)}`,implementerPrincipalFingerprint:`sha256:${'c'.repeat(64)}`,reviewerPrincipalFingerprint:`sha256:${'d'.repeat(64)}`,reviewerContextFingerprint:null,reviewerModel:'gpt-5.6-sol',reviewerCount:1,contextIsolation:'fresh',forkTurns:'none',debug:true},input:{blindReviewPacket:blindPacket()}};
  input.context.reviewerContextFingerprint=fingerprint(input.input.blindReviewPacket);
  const packet=input.input.blindReviewPacket;
  const output={schemaVersion:7,operatorId:'fe/visual-fidelity',output:{result:{dataEvidence:packet.dataEvidence,productFamilyEvidence:packet.productFamilyEvidence,packetFingerprint:packet.packetFingerprint,matrixFingerprint:packet.matrixFingerprint,partitionFingerprint:packet.partitionFingerprint,visualRound:packet.visualRound,packetRasterRefs:packet.rasterCells.map(({imageRef})=>imageRef),lastScreenshotRef:packet.lastScreenshotRef,reviewerExecutionRef:input.context.reviewerExecutionRef,reviewerModel:'gpt-5.6-sol',reviewerCount:1,contextIsolation:'fresh',forkTurns:'none',probeRecords:probeRecords()}}};
  assert.match(invocationBindings.validate('fe/visual-fidelity',input,output).join('\n'),/not bound to a validated render-capture RETURN/);
  invocationBindings.record('fe/render-capture',{output:{outcome:'captured',result:{blindReviewPacketRef:packet.packetRef,blindReviewPacketFingerprint:packet.packetFingerprint,blindReviewPacket:packetManifest(packet),sourceFingerprint:packet.capturedSourceFingerprint,renderMatrix:[
    {stateRef:'state://steady',viewport:'wide',imageRef:raster('wide'),handoffState:false},
    {stateRef:'state://steady',viewport:'intermediate',imageRef:raster('intermediate'),handoffState:false},
    {stateRef:'state://steady',viewport:'compact',imageRef:raster('final'),handoffState:true},
  ],adversarialProbeMatrix:packet.probeCells.map(({probeId,category,phase,imageRef})=>({probeId,category,phase,outcome:'survived',imageRef})),handoffHostArtifact:{imageRef:raster('host')}}}},{receiptId:packet.captureReceiptId});
  assert.deepEqual(invocationBindings.validate('fe/visual-fidelity',input,output),[]);
  output.output.result.probeRecords=[...output.output.result.probeRecords].reverse();
  assert.match(invocationBindings.validate('fe/visual-fidelity',input,output).join('\n'),/supplied blind packet order/);
  output.output.result.probeRecords.reverse();
  output.output.result.packetRasterRefs=['render://other-a.png','render://other-b.png','render://other-final.png'];
  assert.match(invocationBindings.validate('fe/visual-fidelity',input,output).join('\n'),/packet raster refs differ/);
  output.output.result.packetRasterRefs=packet.rasterCells.map(({imageRef})=>imageRef);
  output.output.result.lastScreenshotRef='render://other-final.png';
  assert.match(invocationBindings.validate('fe/visual-fidelity',input,output).join('\n'),/last screenshot differs/);
  output.output.result.lastScreenshotRef=packet.lastScreenshotRef;
  output.output.outcome='passed';
  output.output.result.lastScreenshotVerdict='passed';
  output.output.result.uncertainty=false;
  output.output.result.inspectionRecords=[{verdict:'repair',lensVerdicts:[{verdict:'problem'}],challengeRecords:[]}];
  output.output.result.probeRecords=[];
  assert.match(invocationBindings.validate('fe/visual-fidelity',input,output).join('\n'),/visual problem.*forbids aggregate passed/);

  const forgedInput=structuredClone(input);
  forgedInput.input.blindReviewPacket.rasterCells[0].lastScreenshot=false;
  forgedInput.input.blindReviewPacket.rasterCells.push({cellRef:'cell-099',imageRef:'render://forged-final.png',viewKind:'surface-focus',viewport:'wide',lastScreenshot:true});
  forgedInput.input.blindReviewPacket.lastScreenshotRef='render://forged-final.png';
  forgedInput.context.reviewerContextFingerprint=fingerprint(forgedInput.input.blindReviewPacket);
  const forgedOutput=structuredClone(output);
  forgedOutput.output.result.packetRasterRefs=forgedInput.input.blindReviewPacket.rasterCells.map(({imageRef})=>imageRef);
  forgedOutput.output.result.lastScreenshotRef='render://forged-final.png';
  assert.match(invocationBindings.validate('fe/visual-fidelity',forgedInput,forgedOutput).join('\n'),/differs from the exact validated render-capture manifest/);
});

test('render capture output is cross-bound to requested source, state matrix, handoff, and probes',()=>{
  assert.deepEqual(validateCaptureOutput(captureOutputDocument(blindPacket())),{valid:true,errors:[]});
  const unsupportedPacket=unsupportedZoomPacket();
  const unsupportedCapture=captureOutputDocument(unsupportedPacket);
  unsupportedCapture.output.result.adversarialProbeMatrix=unsupportedCapture.output.result.adversarialProbeMatrix.map((probe)=>probe.category==='zoom'?{...probe,outcome:'not-applicable',imageRef:null,reason:'tool-capability-unavailable'}:probe);
  assert.deepEqual(validateCaptureOutput(unsupportedCapture),{valid:true,errors:[]});
  const input={context:{sourceFingerprint:`sha256:${'a'.repeat(64)}`},input:{renderStates:['state://required'],viewports:['wide','intermediate','compact'],handoffStateRef:'state://required',handoffViewport:{surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false},adversarialProbes:probes(),productFamilyEvidence:productFamilyEvidence(),preflight:capturePreflight()}};
  const output={output:{result:{sourceFingerprint:`sha256:${'b'.repeat(64)}`,renderMatrix:['wide','intermediate','compact'].map((viewport)=>({stateRef:'state://wrong',viewport,handoffState:false})),handoffHostArtifact:{surfaceRef:'browser://other',widthPx:900,heightPx:700,viewportOverride:false},adversarialProbeMatrix:probes().map((probe)=>({...probe,outcome:'survived',imageRef:`render://${probe.probeId}.png`,reason:null}))}}};
  const errors=invocationBindings.validate('fe/render-capture',input,output).join('\n');
  assert.match(errors,/source differs/);
  assert.match(errors,/matrix differs/);
  assert.match(errors,/handoff viewport differs/);
});

test('render capture cannot reorder requested state cells or adversarial probes',()=>{
  const requestedProbes=probes().slice(0,2);
  const input={context:{sourceFingerprint:`sha256:${'a'.repeat(64)}`},input:{renderStates:['state://one','state://two'],viewports:['wide','compact'],handoffStateRef:'state://two',handoffViewport:{surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false},adversarialProbes:requestedProbes,productFamilyEvidence:productFamilyEvidence(),preflight:capturePreflight()}};
  const renderMatrix=[
    {stateRef:'state://two',viewport:'wide',imageRef:raster('two-wide'),handoffState:true},
    {stateRef:'state://two',viewport:'compact',imageRef:raster('two-compact'),handoffState:true},
    {stateRef:'state://one',viewport:'wide',imageRef:raster('one-wide'),handoffState:false},
    {stateRef:'state://one',viewport:'compact',imageRef:raster('one-compact'),handoffState:false},
  ];
  const adversarialProbeMatrix=requestedProbes.toReversed().map((probe)=>({...probe,outcome:'survived',imageRef:raster(probe.probeId),reason:null}));
  const host={surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false,imageRef:raster('host-order')};
  const output={output:{result:{sourceFingerprint:input.context.sourceFingerprint,renderMatrix,adversarialProbeMatrix,handoffHostArtifact:host,blindReviewPacket:{rasterCells:[host,...renderMatrix,...adversarialProbeMatrix].map((item)=>({imageRef:item.imageRef}))}}}};
  const errors=invocationBindings.validate('fe/render-capture',input,output).join('\n');
  assert.match(errors,/state and viewport order/);
  assert.match(errors,/probe at index 0 probeId differs from invocation input order/);
});

test('capture packet cannot substitute, reorder, or use mutable raster path evidence',()=>{
  const substituted=captureOutputDocument(blindPacket());
  substituted.output.result.blindReviewPacket.rasterCells[1].imageRef=raster('forged-wide');
  substituted.output.result.blindReviewPacketFingerprint=fingerprint(substituted.output.result.blindReviewPacket);
  assert.match(validateCaptureOutput(substituted).errors.join('\n'),/must exactly equal host \+ render matrix/);
  const reordered=captureOutputDocument(blindPacket());
  [reordered.output.result.blindReviewPacket.rasterCells[1],reordered.output.result.blindReviewPacket.rasterCells[2]]=[reordered.output.result.blindReviewPacket.rasterCells[2],reordered.output.result.blindReviewPacket.rasterCells[1]];
  reordered.output.result.blindReviewPacketFingerprint=fingerprint(reordered.output.result.blindReviewPacket);
  assert.match(validateCaptureOutput(reordered).errors.join('\n'),/must exactly equal host \+ render matrix/);
  const mutable=captureOutputDocument(blindPacket());
  mutable.output.result.renderMatrix[0].imageRef='render://wide.png';
  assert.match(validateCaptureOutput(mutable).errors.join('\n'),/not content-addressed/);
});

test('runtime observation cannot pass with prose while interaction and responsive inventories are missing', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/runtime-observe',
    output: {
      outcome: 'observed',
      result: {
        summary: 'Looks correct.',
        artifactRefs: ['render://overview.png'],
        runtimeReadiness: { worktreeRef: 'worktree://profile', workingDirectoryRef: 'path://profile', dependencyMode: 'worktree-local-install', dependencyRootRef: 'path://profile/node_modules', dependencyContained: true, manifestLockStatus: 'reproducible', manifestLockEvidenceRef: 'evidence://lock-reproducible', runtimeBuildStatus: 'passed', runtimeLoadStatus: 'passed', runtimeOriginRef: 'runtime://localhost-3000', targetLoadEvidenceRef: 'render://overview.png' },
        surfaceInventory: [{ surfaceRef: 'surface://overview', ownerRef: 'owner://page', purpose: 'Manage the project roadmap.', evidenceRef: 'render://overview.png' }],
        interactionInventory: [{ interactionRef: 'interaction://roadmap-search', kind: 'search', ownerRef: 'owner://roadmap', entryStateRef: 'state://overview', outcomeRef: 'state://filtered', evidenceRef: 'render://search.png' }],
        responsiveStateInventory,
      },
      gaps: [],
      evidenceRefs: ['render://overview.png', 'evidence://lock-reproducible'],
      handoff: null,
    },
  };
  assert.equal(validateObservation(value).valid, true);
  delete value.output.result.interactionInventory;
  assert.equal(validateObservation(value).valid, false);
});

test('runtime observation rejects escaped dependencies, ineffective viewport controls, and duplicate rasters', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/runtime-observe',
    output: {
      outcome: 'observed',
      result: {
        summary: 'Runtime observation.',
        artifactRefs: ['render://overview.png'],
        runtimeReadiness: { worktreeRef: 'worktree://profile', workingDirectoryRef: 'path://profile', dependencyMode: 'worktree-local-install', dependencyRootRef: 'path://profile/node_modules', dependencyContained: true, manifestLockStatus: 'reproducible', manifestLockEvidenceRef: 'evidence://lock-reproducible', runtimeBuildStatus: 'passed', runtimeLoadStatus: 'passed', runtimeOriginRef: 'runtime://localhost-3000', targetLoadEvidenceRef: 'render://overview.png' },
        surfaceInventory: [{ surfaceRef: 'surface://overview', ownerRef: 'owner://page', purpose: 'Manage the project roadmap.', evidenceRef: 'render://overview.png' }],
        interactionInventory: [],
        responsiveStateInventory: structuredClone(responsiveStateInventory),
      },
      gaps: [], evidenceRefs: ['render://overview.png', 'evidence://lock-reproducible'], handoff: null,
    },
  };
  assert.equal(validateObservation(value).valid, true);
  const escaped = structuredClone(value); escaped.output.result.runtimeReadiness.dependencyContained = false;
  assert.equal(validateObservation(escaped).valid, false);
  const ineffective = structuredClone(value); ineffective.output.result.responsiveStateInventory[2].observedWidthPx = 1024;
  assert.match(validateObservation(ineffective).errors.join('\n'), /requested and observed viewport dimensions must match/);
  const duplicate = structuredClone(value); duplicate.output.result.responsiveStateInventory[2].rasterFingerprint = duplicate.output.result.responsiveStateInventory[1].rasterFingerprint;
  assert.match(validateObservation(duplicate).errors.join('\n'), /duplicate responsive rasters are forbidden/);
  const driftRecorded = structuredClone(value); driftRecorded.output.result.runtimeReadiness.manifestLockStatus = 'drift-recorded'; driftRecorded.output.result.runtimeReadiness.manifestLockEvidenceRef = 'evidence://lock-drift'; driftRecorded.output.evidenceRefs = ['render://overview.png', 'evidence://lock-drift'];
  assert.equal(validateObservation(driftRecorded).valid, true);
});

test('aggregate audit passed is rejected when any structured check is a finding', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/semantic-audit',
    output: {
      outcome: 'passed',
      result: {
        summary: 'One business-semantic check.',
        artifactRefs: ['render://overview.png'],
        checks: [{ checkRef: 'check://search', subjectRef: 'interaction://roadmap-search', verdict: 'finding', observation: 'Search disappeared.', authorityRef: 'business://project-roadmap', evidenceRef: 'render://overview.png' }],
      },
      gaps: [],
      evidenceRefs: ['render://overview.png'],
      handoff: null,
    },
  };
  assert.match(validateSemanticAudit(value).errors.join('\n'), /forbids|must pass/);
  value.output.outcome = 'findings';
  assert.equal(validateSemanticAudit(value).valid, true);
});

test('contract freeze rejects silent deletion of an observed interaction', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/contract-freeze',
    context: { authorityRefs: ['business://project-roadmap'], evidenceRefs: ['render://overview.png'], uiKnowledgeId: 'fe.ui' },
    input: { targetRef: 'surface://overview', uxUiChangeLevel: 'reconstruct', constraints: [], preservationContract: behaviorContract() },
  };
  assert.equal(validateContractInput(value).valid, true);
  value.input.preservationContract.interactionDecisions.pop();
  assert.match(validateContractInput(value).errors.join('\n'), /missing decision/);
});

test('capture rejects ten repeated viewport probes and requires all adversarial categories', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/render-capture',
    context: { authorityRefs: ['contract://overview'], evidenceRefs: [], uiKnowledgeId: 'fe.ui', sourceFingerprint: `sha256:${'a'.repeat(64)}` },
    input: {
      targetRef: 'surface://overview',
      constraints: [],
      adversarialProbes: probes(),
      renderStates: ['state://overview'],
      viewports: ['wide', 'intermediate', 'compact'],
      handoffStateRef: 'state://overview',
      handoffViewport: { surfaceRef: 'browser://in-app', widthPx: 1200, heightPx: 800, viewportOverride: false },
      productFamilyEvidence: productFamilyEvidence(),
      preflight: capturePreflight(),
    },
  };
  assert.equal(validateCaptureInput(value).valid, true);
  value.input.viewports=['compact','wide','intermediate'];
  assert.match(validateCaptureInput(value).errors.join('\n'),/must be ordered wide, intermediate, compact/);
  value.input.viewports=['wide','intermediate','compact'];
  value.input.adversarialProbes=probes().toReversed();
  assert.match(validateCaptureInput(value).errors.join('\n'),/canonical category and phase order/);
  value.input.adversarialProbes=probes();
  value.input.adversarialProbes = probes().filter(({ probeId }) => probeId !== 'probe-zoom-zoom-out');
  assert.match(validateCaptureInput(value).errors.join('\n'), /zoom requires at least 3 lifecycle phases/);
  value.input.adversarialProbes = Array.from({ length: 10 }, (_, index) => ({ ...probes()[0], probeId: `viewport-${index}` }));
  assert.match(validateCaptureInput(value).errors.join('\n'), /missing zoom/);
  value.input.adversarialProbes=probes().filter(({probeId})=>probeId!=='probe-keyboard-focus-focus');
  assert.match(validateCaptureInput(value).errors.join('\n'),/keyboard-focus missing focus/);
  value.input.adversarialProbes=probes().map((probe)=>probe.category==='sticky-fixed-overlay'?{...probe,phase:'baseline'}:probe);
  assert.match(validateCaptureInput(value).errors.join('\n'),/sticky-fixed-overlay missing overlay-open/);
});

const inspection = (imageRef, verdict = 'passed') => ({
  imageRef,
  pageInset: 'Observed.',
  surfaceOpacity: 'Observed.',
  contentPadding: 'Observed.',
  alignment: 'Observed.',
  verticalRhythm: 'Observed.',
  hierarchy: 'Observed.',
  visualOwnership: 'Observed.',
  pinnedBoundaryClearance: 'Observed.',
  wrapping: 'Observed.',
  clipping: 'Observed.',
  occlusion: 'Observed.',
  semanticUtility: 'Observed.',
  contentCoherence: 'Observed.',
  affordance: 'Observed.',
  responsiveComposition: 'Observed.',
  visualConsistency: 'Observed.',
  emptySpaceBalance: 'Observed.',
  lensVerdicts: REQUIRED_VISUAL_LENSES.map((lens) => ({
    lens,
    verdict: verdict === 'repair' && lens === 'task-scanability' ? 'problem' : 'passed',
    observation: verdict === 'repair' && lens === 'task-scanability'
      ? 'Dense undifferentiated paragraphs prevent fast task scanning.'
      : `The raster was challenged for ${lens} and no visible contradiction remained.`,
  })),
  challengeRecords: REQUIRED_CHALLENGE_FAMILIES.map((family, index) => ({
    challengeRef: `challenge://${family}`,
    family,
    suspectedProblem: `Potential ${family} contradiction`,
    pixelObservation: verdict === 'repair' && index === 0
      ? 'The visible content is a wall of text with no usable scan path.'
      : `The ${family} candidate was attacked in the raster and was not observed.`,
    disposition: verdict === 'repair' && index === 0 ? 'confirmed' : 'not-observed',
  })),
  verdict,
});

test('visual fidelity cannot aggregate passed over a repair verdict or probe contradiction', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/visual-fidelity',
    output: {
      outcome: 'passed',
      result: {
        summary: 'Reviewed all cells.',
        artifactRefs: [raster('wide'), raster('intermediate'), raster('compact')],
        reviewMode: 'ai-adversarial-pixel',
        dataEvidence: liveDataEvidence(),
        productFamilyEvidence: productFamilyEvidence(),
        packetFingerprint: `sha256:${'a'.repeat(64)}`,
        matrixFingerprint: capturePreflight().matrixFingerprint,
        partitionFingerprint: capturePreflight().partitionFingerprint,
        visualRound: { ...visualRound },
        packetRasterRefs: [raster('wide'), raster('intermediate'), raster('compact')],
        reviewerExecutionRef: 'agent://blind-sol',
        reviewerModel: 'gpt-5.6-sol',
        reviewerCount: 1,
        contextIsolation: 'fresh',
        forkTurns: 'none',
        lastScreenshotRef: raster('compact'),
        lastScreenshotVerdict: 'passed',
        uncertainty: false,
        inspectionRecords: [inspection(raster('wide')), inspection(raster('intermediate'), 'repair'), inspection(raster('compact'))],
        probeRecords: probeRecords(1),
      },
      gaps: [],
      evidenceRefs: [raster('wide')],
    },
  };
  const errors = validateVisualOutput(value).errors.join('\n');
  assert.match(errors, /repair verdict forbids aggregate passed/);
  assert.match(errors, /contradiction forbids aggregate passed/);
});

test('visual fidelity rejects a shallow AI pass that did not challenge every image', () => {
  const shallow = inspection(raster('wide'));
  shallow.challengeRecords = shallow.challengeRecords.slice(0, 1);
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/visual-fidelity',
    output: {
      outcome: 'passed',
      result: {
        summary: 'Looks good.',
        artifactRefs: [raster('wide')],
        reviewMode: 'ai-adversarial-pixel',
        dataEvidence: liveDataEvidence(),
        productFamilyEvidence: productFamilyEvidence(),
        packetFingerprint: `sha256:${'a'.repeat(64)}`,
        matrixFingerprint: capturePreflight().matrixFingerprint,
        partitionFingerprint: capturePreflight().partitionFingerprint,
        visualRound: { ...visualRound },
        packetRasterRefs: [raster('wide'), raster('intermediate'), raster('compact')],
        reviewerExecutionRef: 'agent://blind-sol',
        reviewerModel: 'gpt-5.6-sol',
        reviewerCount: 1,
        contextIsolation: 'fresh',
        forkTurns: 'none',
        lastScreenshotRef: raster('compact'),
        lastScreenshotVerdict: 'passed',
        uncertainty: false,
        inspectionRecords: [shallow, inspection(raster('intermediate')), inspection(raster('compact'))],
        probeRecords: probeRecords(),
      },
      gaps: [],
      evidenceRefs: [raster('wide')],
    },
  };
  assert.equal(validateVisualOutput(value).valid, false);

  const missingInspection = structuredClone(value);
  missingInspection.output.result.inspectionRecords[0] = inspection(raster('wide'));
  missingInspection.output.result.packetRasterRefs.push(raster('missing-focus'));
  assert.match(
    validateVisualOutput(missingInspection).errors.join('\n'),
    /missing inspection record for render:\/\/missing-focus\/sha256-/,
  );
});

test('independent review cannot aggregate passed over any finding', () => {
  const value = {
    schemaVersion: 7,
    operatorId: 'fe/independent-review',
    output: {
      outcome: 'passed',
      aiExecution: { model: 'gpt-5.6-sol', count: 1, isolation: 'fresh', forkTurns: 'none', executionRef: `execution://${'f'.repeat(64)}` },
      result: {
        summary: 'Independent review.',
        artifactRefs: ['review://overview'],
        reviewerExecutionRef: 'agent://reviewer',
        inspectionRefs: ['inspection://wide'],
        inspectionVerdicts: [{ inspectionRef: 'inspection://wide', verdict: 'finding', observation: 'Large dead zone remains.' }],
        probeVerdicts: probeRecords().map(({ probeId, category, phase, verdict, observation }) => ({ probeId, category, phase, verdict, observation })),
      },
      gaps: [],
      evidenceRefs: ['review://overview'],
      handoff: null,
    },
  };
  assert.match(validateIndependentOutput(value).errors.join('\n'), /finding forbids aggregate passed/);
});
