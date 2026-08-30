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
import { createOperatorInvocationBindingRegistry } from './invocation-binding.mjs';
import { fingerprint } from '../runtime/trace.mjs';

const responsiveStateInventory = [
  { viewport: 'wide', stateRef: 'state://wide', evidenceRef: 'render://wide.png' },
  { viewport: 'intermediate', stateRef: 'state://intermediate', evidenceRef: 'render://intermediate.png' },
  { viewport: 'compact', stateRef: 'state://compact', evidenceRef: 'render://compact.png' },
];
const invocationBindings = createOperatorInvocationBindingRegistry();
const raster = (label) => `render://${label}/sha256-${fingerprint(label).slice(7)}.png`;

const behaviorContract = () => ({
  observedInteractionRefs: ['interaction://roadmap-search', 'interaction://task-navigation'],
  interactionDecisions: [
    { interactionRef: 'interaction://roadmap-search', decision: 'preserve', authorityRef: null, rationale: null, replacementRef: null },
    { interactionRef: 'interaction://task-navigation', decision: 'preserve', authorityRef: null, rationale: null, replacementRef: null },
  ],
  surfaceOwnerRefs: ['surface://roadmap'],
  grammarBindingRefs: ['grammar://surface-list-card'],
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
const packetManifest=({packetRef,latestMutationFingerprint,capturedSourceFingerprint,latestMutationAt,capturedAt,rasterCells,probeCells,lastScreenshotRef})=>({packetRef,latestMutationFingerprint,capturedSourceFingerprint,latestMutationAt,capturedAt,rasterCells,probeCells,lastScreenshotRef});
const captureOutputDocument=(packet)=>({schemaVersion:7,operatorId:'fe/render-capture',output:{outcome:'captured',result:{summary:'Captured exact visual matrix and lifecycle packet.',artifactRefs:[packet.packetRef],sourceFingerprint:packet.capturedSourceFingerprint,latestMutationFingerprint:packet.latestMutationFingerprint,latestMutationAt:packet.latestMutationAt,capturedAt:packet.capturedAt,blindReviewPacketRef:packet.packetRef,blindReviewPacketFingerprint:fingerprint(packetManifest(packet)),blindReviewPacket:packetManifest(packet),renderMatrix:[
  {stateRef:'state://steady',viewport:'wide',imageRef:raster('wide'),handoffState:true},
  {stateRef:'state://steady',viewport:'intermediate',imageRef:raster('intermediate'),handoffState:true},
  {stateRef:'state://steady',viewport:'compact',imageRef:raster('final'),handoffState:true},
],adversarialProbeMatrix:probes().map((probe)=>({...probe,outcome:'survived',imageRef:raster(probe.probeId),reason:null})),handoffHostArtifact:{surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false,imageRef:raster('host')}},gaps:[],evidenceRefs:[raster('host')],handoff:null}});

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
});

test('visual verdict is bound to the exact supplied packet, rasters, final screenshot, and reviewer execution',()=>{
  const input={schemaVersion:7,operatorId:'fe/visual-fidelity',context:{implementerExecutionRef:`execution://${'a'.repeat(64)}`,reviewerExecutionRef:`execution://${'b'.repeat(64)}`,implementerPrincipalFingerprint:`sha256:${'c'.repeat(64)}`,reviewerPrincipalFingerprint:`sha256:${'d'.repeat(64)}`,reviewerContextFingerprint:null,reviewerModel:'gpt-5.6-sol',reviewerCount:1,contextIsolation:'fresh',forkTurns:'none',debug:true},input:{blindReviewPacket:blindPacket()}};
  input.context.reviewerContextFingerprint=fingerprint(input.input.blindReviewPacket);
  const packet=input.input.blindReviewPacket;
  const output={schemaVersion:7,operatorId:'fe/visual-fidelity',output:{result:{packetFingerprint:packet.packetFingerprint,packetRasterRefs:packet.rasterCells.map(({imageRef})=>imageRef),lastScreenshotRef:packet.lastScreenshotRef,reviewerExecutionRef:input.context.reviewerExecutionRef,reviewerModel:'gpt-5.6-sol',reviewerCount:1,contextIsolation:'fresh',forkTurns:'none',probeRecords:probeRecords()}}};
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
  const input={context:{sourceFingerprint:`sha256:${'a'.repeat(64)}`},input:{renderStates:['state://required'],viewports:['wide','intermediate','compact'],handoffStateRef:'state://required',handoffViewport:{surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false},adversarialProbes:probes()}};
  const output={output:{result:{sourceFingerprint:`sha256:${'b'.repeat(64)}`,renderMatrix:['wide','intermediate','compact'].map((viewport)=>({stateRef:'state://wrong',viewport,handoffState:false})),handoffHostArtifact:{surfaceRef:'browser://other',widthPx:900,heightPx:700,viewportOverride:false},adversarialProbeMatrix:probes().map((probe)=>({...probe,outcome:'survived',imageRef:`render://${probe.probeId}.png`,reason:null}))}}};
  const errors=invocationBindings.validate('fe/render-capture',input,output).join('\n');
  assert.match(errors,/source differs/);
  assert.match(errors,/matrix differs/);
  assert.match(errors,/handoff viewport differs/);
});

test('render capture cannot reorder requested state cells or adversarial probes',()=>{
  const requestedProbes=probes().slice(0,2);
  const input={context:{sourceFingerprint:`sha256:${'a'.repeat(64)}`},input:{renderStates:['state://one','state://two'],viewports:['wide','compact'],handoffStateRef:'state://two',handoffViewport:{surfaceRef:'browser://host',widthPx:1200,heightPx:800,viewportOverride:false},adversarialProbes:requestedProbes}};
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
        surfaceInventory: [{ surfaceRef: 'surface://overview', ownerRef: 'owner://page', purpose: 'Manage the project roadmap.', evidenceRef: 'render://overview.png' }],
        interactionInventory: [{ interactionRef: 'interaction://roadmap-search', kind: 'search', ownerRef: 'owner://roadmap', entryStateRef: 'state://overview', outcomeRef: 'state://filtered', evidenceRef: 'render://search.png' }],
        responsiveStateInventory,
      },
      gaps: [],
      evidenceRefs: ['render://overview.png'],
      handoff: null,
    },
  };
  assert.equal(validateObservation(value).valid, true);
  delete value.output.result.interactionInventory;
  assert.equal(validateObservation(value).valid, false);
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
        packetFingerprint: `sha256:${'a'.repeat(64)}`,
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
        packetFingerprint: `sha256:${'a'.repeat(64)}`,
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
