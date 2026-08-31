import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { nextState, validatedOperatorReturn, validatedWaitResume } from '../skills/route-machine.mjs';
import { validateInput as validateFeInput } from '../skills/starci-fe-process/validate-input.mjs';
import { validateInput as validateUatInput } from '../skills/starci-uat-verify/validate-input.mjs';
import { validateInput as validateFeatureInput } from '../skills/starci-feature-deliver/validate-input.mjs';
import { validateInput as validateReviewInput } from './fe/independent-review/validate-input.mjs';
import { validateOutput as validateDirectionOutput } from './fe/direction-generate/validate-output.mjs';
import { validateInput as validateAuditRouteInput } from './fe/audit-route/validate-input.mjs';
import { validateOutput as validateAuditRouteOutput } from './fe/audit-route/validate-output.mjs';
import { validateOutput as validateDominantDirectionOutput } from './fe/dominant-direction-generate/validate-output.mjs';
import { validateInput as validatePotentialInput } from './fe/product-potential/validate-input.mjs';
import { validateOutput as validatePotentialOutput } from './fe/product-potential/validate-output.mjs';
import { validateOutput as validateUatPublishOutput } from './test/uat-result-publish/validate-output.mjs';
import { validateInput as validateUatCaseInput } from './test/uat-case-freeze/validate-input.mjs';
import { createReceipt, fingerprint } from '../runtime/trace.mjs';
import { REQUIRED_PROBE_CATEGORIES, REQUIRED_PROBE_PHASES } from './fe/strict-ui-validation.mjs';
import { createOperatorInvocationBindingRegistry } from './invocation-binding.mjs';

const machine = JSON.parse(readFileSync(new URL('../skills/starci-fe-process/machine.json', import.meta.url)));
const uatMachine = JSON.parse(readFileSync(new URL('../skills/starci-uat-verify/machine.json', import.meta.url)));
const selection=(skillId)=>({analyzerVersion:2,skillId,confidence:'exact',interactionPolicy:'ask-only-when-stuck',activeInputRefs:['request://current'],passiveContextRefs:[]});
const scope=(unit='surface',dimensions=[])=>({status:'frozen',unit,targetRefs:['surface://Profile'],inclusionRefs:['state://default'],exclusionRefs:['layout://AppShell'],writeRoots:['src/Profile.tsx'],externalMutation:false,approvalRef:null,completionProofRefs:['proof://render-review'],dimensions,ambiguityRefs:[]});
const changeLevel=(value)=>({key:'frontend.ux-ui.change-level',value,authorityRef:'request://current'});
const ownerCeilingLevel=(value)=>({key:'frontend.layout.owner-ceiling',value,authorityRef:'request://current'});
const layoutOwnerCeiling=()=>({targetOwnerRef:'surface://Profile',directInteractionOwnerRefs:[],mutableNestedLayoutRefs:[],mutableAncestorLayoutRefs:[],immutableAncestorLayoutRefs:['layout://AppShell']});
const neutralAdversarialDecision={add:{disposition:'reject',rationale:'No missing capability is evidenced.',evidenceRefs:['evidence://mission']},change:{disposition:'adopt',rationale:'The requested outcome requires bounded change.',evidenceRefs:['evidence://mission']},remove:{disposition:'reject',rationale:'No removal is supported by evidence.',evidenceRefs:['evidence://mission']}};
const independentProbeSequence=()=>REQUIRED_PROBE_CATEGORIES.flatMap((category)=>REQUIRED_PROBE_PHASES[category].map((phase,index)=>({probeId:`${category}-${index}`,category,phase})));
const feInput = (intent, objective, level='refine') => ({ schemaVersion:7, runId:'mission-1', project:'academy', selection:selection('starci-fe-process'), intent, objective, auditTargetScore:null, auditScoreHistory:[], targetHints:['route://academy/fe','surface://Profile'], authorityRefs:['business://profile'], scope:scope('surface',[changeLevel(level),ownerCeilingLevel('surface-only')]), resume:null, receiptType:'NONE', returnReceipt:null, progressHistory:[], mutationAuthorizationRef:null, verifiedFrontendRoute:'.workspaces/projects/academy/fe.json', exactFiles:[{path:'src/Profile.tsx',beforeSha256:`sha256:${'a'.repeat(64)}`,ownerRef:'surface://Profile'}], layoutOwnerCeiling:layoutOwnerCeiling(), approvedContractFingerprint:null });
const routed = (outcome, stateId = null) => {
  const state = stateId ?? Object.entries(machine.states).find(([, value]) => value.ref && value.on?.some((edge) => edge.when?.outputEquals?.outcome === outcome))?.[0];
  const matches = machine.states[state].on.filter((edge) => edge.when?.outputEquals?.outcome === outcome);
  assert.equal(matches.length, 1);
  return matches[0].target;
};

test('audit Profile compiles as one frontend mission and traverses all three independent audit lenses', () => {
  assert.deepEqual(validateFeInput(feInput('audit','Audit Profile')), {valid:true,errors:[]});
  assert.equal(routed('compiled','compile'),'resolve');
  assert.equal(routed('observed','observe'),'product-potential');
  assert.equal(routed('assessed','product-potential'),'semantic-audit');
  assert.equal(routed('passed','semantic-audit'),'ux-audit');
  assert.equal(routed('passed','ux-audit'),'grammar-audit');
  assert.equal(routed('converged','grammar-audit'),'ui-audit');
  assert.equal(routed('findings','ui-audit'),'classify');
});

test('numeric audit target preserves an ordered evidence-bound progress history',()=>{
  const value=feInput('audit','Audit Personal Project to 9/10');
  value.auditTargetScore=9;
  value.auditScoreHistory=[
    {round:1,score:6,delta:null,typedVerdict:'FAIL',sourceFingerprint:`sha256:${'1'.repeat(64)}`,evidenceFingerprint:`sha256:${'2'.repeat(64)}`,findingBatchFingerprint:`sha256:${'3'.repeat(64)}`},
    {round:2,score:8,delta:2,typedVerdict:'FAIL',sourceFingerprint:`sha256:${'4'.repeat(64)}`,evidenceFingerprint:`sha256:${'5'.repeat(64)}`,findingBatchFingerprint:`sha256:${'6'.repeat(64)}`},
    {round:3,score:9,delta:1,typedVerdict:'PASS',sourceFingerprint:`sha256:${'7'.repeat(64)}`,evidenceFingerprint:`sha256:${'8'.repeat(64)}`,findingBatchFingerprint:null},
  ];
  assert.deepEqual(validateFeInput(value),{valid:true,errors:[]});
  value.auditScoreHistory[1].delta=3;
  assert.match(validateFeInput(value).errors.join('\n'),/delta must equal score movement/);
});

test('v7.5-alpha routes only direct structural scores below 7 to one dominant reconstruction without WAIT',()=>{
  assert.equal(routed('repair','visual-fidelity'),'score-route');
  const input={schemaVersion:7,operatorId:'fe/audit-route',context:{sourceFingerprint:`sha256:${'1'.repeat(64)}`,evidenceFingerprint:`sha256:${'2'.repeat(64)}`,findingBatchFingerprint:`sha256:${'3'.repeat(64)}`},input:{typedVerdict:'FAIL',score:3,changeLevel:'reconstruct',comparisonRequested:false,structuralFindingRefs:['finding://compact-composition'],findingOwnerClasses:['direct-implementation']}};
  assert.deepEqual(validateAuditRouteInput(input),{valid:true,errors:[]});
  const output={schemaVersion:7,operatorId:'fe/audit-route',output:{outcome:'reconstruct',result:{score:3,route:'reconstruct',directionMode:'dominant',reason:'Direct-owner structural composition failed on current evidence.'},gaps:[],evidenceRefs:['visual://round-1']}};
  assert.deepEqual(validateAuditRouteOutput(output),{valid:true,errors:[]});
  assert.equal(routed('reconstruct','score-route'),'dominant-generate');
  const dominant={schemaVersion:7,operatorId:'fe/dominant-direction-generate',output:{outcome:'generated',aiExecution:{model:'gpt-5.6-sol',count:1,isolation:'fresh',forkTurns:'none',executionRef:`execution://${'4'.repeat(64)}`},result:{summary:'One coherent direct-owner replacement composition is ready.',artifactRefs:['artifact://dominant.html'],directionCount:1,directionRef:'direction://dominant',visualizeArtifactRef:'artifact://dominant.html',wideStateRef:'panel://wide',compactStateRef:'panel://compact',materialStateRef:'panel://recovery',familySignatureManifestRef:'family://academy',grammarDecisionManifestRef:'grammar://dominant',constructionContractRef:'contract://dominant'},gaps:[],evidenceRefs:['visual://round-1']}};
  assert.deepEqual(validateDominantDirectionOutput(dominant),{valid:true,errors:[]});
  assert.equal(routed('generated','dominant-generate'),'grammar-bind');
  assert.notEqual(routed('generated','dominant-generate'),'direction-choice');
});

test('v7.5-alpha keeps a low nonstructural score on the current owner repair route',()=>{
  const input={schemaVersion:7,operatorId:'fe/audit-route',context:{sourceFingerprint:`sha256:${'1'.repeat(64)}`,evidenceFingerprint:`sha256:${'2'.repeat(64)}`,findingBatchFingerprint:`sha256:${'3'.repeat(64)}`},input:{typedVerdict:'FAIL',score:6,changeLevel:'reconstruct',comparisonRequested:false,structuralFindingRefs:[],findingOwnerClasses:['direct-implementation']}};
  assert.deepEqual(validateAuditRouteInput(input),{valid:true,errors:[]});
  const output={schemaVersion:7,operatorId:'fe/audit-route',output:{outcome:'repair',result:{score:6,route:'repair',directionMode:'none',reason:'The failure is semantic and local; composition itself remains coherent.'},gaps:[],evidenceRefs:['visual://round-1']}};
  assert.deepEqual(validateAuditRouteOutput(output),{valid:true,errors:[]});
  assert.equal(routed('repair','score-route'),'finding-classify');
});

test('neutral product potential requires an exhaustive typed capability delta before visual audit', () => {
  const input={schemaVersion:7,operatorId:'fe/product-potential',context:{evidenceRefs:['business://project','runtime://project-manager'],authorityRevision:'sha256:project'},input:{targetRef:'surface://personal-project-manager',constraints:['one closed project-management outcome'],requiredOutcomeRefs:['outcome://plan-execute-submit-review-continue'],observedCapabilityRefs:['capability://roadmap','capability://next-task','capability://repository-link']}};
  assert.deepEqual(validatePotentialInput(input),{valid:true,errors:[]});
  const value={schemaVersion:7,operatorId:'fe/product-potential',output:{outcome:'assessed',result:{summary:'The current manager exposes planning but lacks closure from task evidence to feedback and next decision.',artifactRefs:['artifact://personal-project-capability-delta'],capabilityDecisions:[
    {capabilityRef:'capability://roadmap',decision:'KEEP',userOutcomeRef:'outcome://plan',owner:'frontend',rationale:'The roadmap supports orientation.',evidenceRefs:['runtime://project-manager']},
    {capabilityRef:'capability://submission-feedback',decision:'ADD',userOutcomeRef:'outcome://review-continue',owner:'cross-domain',rationale:'The required execution loop has no evidence and feedback closure.',evidenceRefs:['business://project','runtime://project-manager']}
  ],flowRelations:[
    {fromRef:'capability://roadmap',toRef:'capability://next-task',status:'present',owner:'frontend',userOutcomeRef:'outcome://plan-execute',evidenceRefs:['runtime://project-manager']},
    {fromRef:'capability://task-evidence',toRef:'capability://submission-feedback',status:'missing',owner:'cross-domain',userOutcomeRef:'outcome://review-continue',evidenceRefs:['business://project','runtime://project-manager']}
  ]},gaps:[],evidenceRefs:['business://project','runtime://project-manager']}};
  assert.deepEqual(validatePotentialOutput(value),{valid:true,errors:[]});
  value.output.result.capabilityDecisions[1].decision='POLISH';
  assert.equal(validatePotentialOutput(value).valid,false);
});

test('create page X auto-selects a dominant action without generating choices', () => {
  assert.deepEqual(validateFeInput(feInput('create','Create page X','new')), {valid:true,errors:[]});
  assert.equal(routed('dominant','classify'),'grammar-bind');
  assert.equal(routed('converged','grammar-bind'),'freeze');
});

test('a true authority choice generates and ranks 3-4 directions before WAIT', async () => {
  assert.equal(routed('choice-required','classify'),'generate');
  const directions=['split-workbench','guided-pipeline','submission-drawer','review-canvas'].map((id)=>({id,title:id,visualPanelRef:`#${id}`,wideStateRef:`#${id}-wide`,compactStateRef:`#${id}-compact`,materialStateRef:`#${id}-recovery`,grammarDecisionManifestRef:`grammar://${id}`,tradeoff:`${id} trade-off`}));
  const grammarFilterRecords=directions.map((direction)=>({candidateRef:direction.id,decision:'accepted',manifestRef:direction.grammarDecisionManifestRef,reasonRefs:['grammar://validated']}));
  const value={schemaVersion:7,operatorId:'fe/direction-generate',output:{outcome:'generated',aiExecution:{model:'gpt-5.6-sol',count:1,isolation:'fresh',forkTurns:'none',executionRef:`execution://${'e'.repeat(64)}`},result:{summary:'Four distinct directions.',artifactRefs:['artifact://directions.html'],comparisonArtifactRef:'artifact://directions.html',directionCount:4,directions,grammarFilterRecords,materialDifferences:['navigation model','information hierarchy','interaction character','responsive composition']},gaps:[],evidenceRefs:['authority://frozen'],handoff:null}};
  assert.deepEqual(validateDirectionOutput(value),{valid:true,errors:[]});
  const directionInput={schemaVersion:7,operatorId:'fe/direction-generate',context:{authorityRefs:['authority://frozen'],evidenceRefs:[],uiKnowledgeId:'fe.ui'},input:{targetRef:'surface://profile',constraints:[]}};
  const receiptFields={missionId:'mission-1',skillId:'starci-fe-process',operatorId:'fe/direction-generate',parentId:'invocation://generate',childId:null,context:{executionRef:`execution://${'e'.repeat(64)}`,invocationRef:'invocation://generate'},input:directionInput,expectedOutput:{outcome:'generated'},actualOutput:value,aiActivity:{kind:'brainstorm',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'e'.repeat(64)}`,principalFingerprint:`sha256:${'a'.repeat(64)}`,contextFingerprint:`sha256:${'b'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}};
  createReceipt('CALL',{...receiptFields,receiptId:'receipt:direction-generate-call'},{debug:true,writeDebug:()=>{},now:()=> '2026-08-30T00:00:00.000Z'});
  const receipt=createReceipt('RETURN',{...receiptFields,receiptId:'receipt:direction-generate-return'},{debug:true,writeDebug:()=>{},now:()=> '2026-08-30T00:00:00.000Z'});
  const generated=await validatedOperatorReturn({machineId:machine.id,stateId:'generate',operatorId:'fe/direction-generate',input:directionInput,outputDocument:value,validateOutput:validateDirectionOutput,returnReceipt:receipt});
  assert.equal(nextState(machine,'generate',generated,directionInput,'invocation://generate',generated.missionId),'rank');
  assert.equal(routed('ranked','rank'),'direction-choice');
  assert.equal(machine.states['direction-choice'].kind,'wait');
  assert.equal(machine.states['direction-choice'].approval.resumeTarget,'analyze-input');
  assert.deepEqual(Object.keys(machine.states['direction-choice'].approval).sort(),['approve','prompt','reject','resumeTarget']);
  assert.match(machine.states['direction-choice'].approval.prompt,/rendered visualize comparison/);
  assert.deepEqual(machine.states['direction-choice'].on[0].when.allFacts,['frontend-direction-visual-preview-ready']);
  assert.throws(()=>nextState(machine,'direction-choice',{type:'RESUME',facts:[]},{}),/validator-issued canonical RESUME/);
  const resolution={facts:['frontend-direction-visual-preview-ready']};
  const resumeReceipt=createReceipt('RESUME',{receiptId:'receipt:direction-wait-resume',missionId:'mission-1',skillId:'starci-fe-process',parentId:'receipt:direction-wait',context:{waitState:'direction-choice',invocationRef:'invocation://direction-wait',resolvedInputFingerprint:fingerprint(resolution)},resumeState:'direction-choice',actualOutput:resolution},{debug:true});
  const resumeEnvelope=validatedWaitResume({machineId:machine.id,stateId:'direction-choice',missionId:'mission-1',resumeReceipt,resolution});
  assert.equal(nextState(machine,'direction-choice',resumeEnvelope,{},null,'mission-1'),'analyze-input');
});

test('selected user direction resumes only through a typed RESUME receipt', () => {
  const value=feInput('redesign','Redesign Profile','reconstruct');
  value.receiptType='RESUME';
  value.resume={missionRef:'mission-1',fromSkillId:'user-choice',receiptRef:'receipt:direction-choice',resumeState:'direction-choice'};
  value.returnReceipt=createReceipt('RESUME',{receiptId:'receipt:direction-choice',missionId:'mission-1',skillId:'starci-fe-process',parentId:'wait-direction',resumeState:'direction-choice',actualOutput:{selectedDirectionRef:'direction://focused'}},{debug:true,now:()=> '2026-01-01T00:00:00.000Z'});
  assert.deepEqual(validateFeInput(value),{valid:true,errors:[]});
  assert.equal(nextState(machine,'analyze-input',null,{...value,neutralAdversarialDecision}),'consume-choice-resume');
  assert.equal(routed('consumed','consume-choice-resume'),'choice-resume-route');
  assert.equal(nextState(machine,'choice-resume-route',null,value),'grammar-bind');
});

test('independent review cannot receive implementer rationale', () => {
  const value={schemaVersion:7,operatorId:'fe/independent-review',context:{frozenAuthority:['business://profile','grammar://project'],frozenEvidence:['render://profile'],uiKnowledgeId:'fe.ui',implementerExecutionRef:`execution://${'a'.repeat(64)}`,reviewerExecutionRef:`execution://${'b'.repeat(64)}`,implementerPrincipalFingerprint:`sha256:${'c'.repeat(64)}`,reviewerPrincipalFingerprint:`sha256:${'d'.repeat(64)}`,reviewerModel:'gpt-5.6-sol',reviewerCount:1,contextIsolation:'fresh',forkTurns:'none',reviewMode:'blind-pixel'},input:{reviewTarget:'surface://Profile',reviewLenses:['semantic','ux','ui'],rasterRefs:['render://sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png','render://sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png','render://sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.png'],probeSequence:independentProbeSequence(),adversarialProbeRecordsRef:'review://profile/adversarial-probes',handoffHostArtifactRef:'render://profile/handoff-host.png'}};
  assert.deepEqual(validateReviewInput(value),{valid:true,errors:[]});
  value.context.implementerRationale='I chose cards because...';
  assert.equal(validateReviewInput(value).valid,false);
  delete value.context.implementerRationale;
  value.context.reviewerExecutionRef=value.context.implementerExecutionRef;
  assert.match(validateReviewInput(value).errors.join('\n'),/must differ/);
});

test('independent review binds every supplied raster and probe in exact order',()=>{
  const rasterRefs=['render://sha256-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.png','render://sha256-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.png','render://sha256-cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc.png'];
  const probeSequence=independentProbeSequence();
  const output={output:{result:{inspectionRefs:[...rasterRefs],inspectionVerdicts:rasterRefs.map((inspectionRef)=>({inspectionRef,verdict:'passed',observation:'No visible contradiction was found.'})),probeVerdicts:probeSequence.map((probe)=>({...probe,verdict:'survived',observation:'The probe survived.'}))}}};
  const registry=createOperatorInvocationBindingRegistry();
  assert.deepEqual(registry.validate('fe/independent-review',{input:{rasterRefs,probeSequence}},output),[]);
  const missing=structuredClone(output); missing.output.result.inspectionRefs.pop(); missing.output.result.inspectionVerdicts.pop();
  assert.match(registry.validate('fe/independent-review',{input:{rasterRefs,probeSequence}},missing).join('\n'),/raster/);
  const reordered=structuredClone(output); reordered.output.result.probeVerdicts.reverse();
  assert.match(registry.validate('fe/independent-review',{input:{rasterRefs,probeSequence}},reordered).join('\n'),/probe at index/);
});

test('frontend public input rejects fabricated and replayed return receipts',()=>{
  const value=feInput('repair','Repair Profile');
  value.receiptType='RETURN';
  value.resume={missionRef:'mission-1',fromSkillId:'starci-backend-process',receiptRef:'receipt:fe-public',resumeState:'apply'};
  value.returnReceipt={version:'7.5.0-alpha.1',receiptId:'receipt:fe-public',type:'RETURN',missionId:'mission-1',skillId:'starci-backend-process',operatorId:null,parentId:'receipt:call',childId:null,timestamp:'2026-08-30T00:00:00.000Z',progressFingerprint:`sha256:${'a'.repeat(64)}`,trace:{resumeState:'apply'}};
  assert.match(validateFeInput(value).errors.join('\n'),/not a runtime-issued immutable receipt/);
  value.returnReceipt=createReceipt('RETURN',{receiptId:'receipt:fe-public-canonical',missionId:'mission-1',skillId:'starci-backend-process',parentId:'receipt:call',resumeState:'apply'},{debug:true});
  value.resume.receiptRef=value.returnReceipt.receiptId;
  assert.deepEqual(validateFeInput(value),{valid:true,errors:[]});
  assert.match(validateFeInput(value).errors.join('\n'),/already consumed/);
});

test('public FE and Feature receipts are bound to active runId rather than caller resume metadata',()=>{
  const foreign=createReceipt('RETURN',{receiptId:'receipt:foreign-mission',missionId:'mission-foreign',skillId:'starci-backend-process',parentId:'receipt:foreign-call',resumeState:'apply'},{debug:true});
  const fe=feInput('repair','Repair Profile');
  fe.receiptType='RETURN'; fe.returnReceipt=foreign;
  fe.resume={missionRef:fe.runId,fromSkillId:'starci-backend-process',receiptRef:foreign.receiptId,resumeState:'apply'};
  assert.match(validateFeInput(fe).errors.join('\n'),/mission identity mismatch/);
  const feature={schemaVersion:7,runId:'mission-1',project:'academy',selection:selection('starci-feature-deliver'),objective:'Deliver profile',domainOrder:['frontend','backend'],resume:{missionRef:'mission-1',skillId:'starci-backend-process',receiptRef:foreign.receiptId,resumeState:'backend-return'},returnReceipt:foreign,progressHistory:[],receiptType:'RETURN',scope:scope('feature')};
  assert.match(validateFeatureInput(feature).errors.join('\n'),/mission identity mismatch/);
});

test('UAT rejects unrelated receipts until its machine declares a resume route',()=>{
  const unrelated=createReceipt('RESUME',{receiptId:'receipt:uat-unrelated',missionId:'mission-foreign',skillId:'starci-git-publish',parentId:'receipt:git-wait',resumeState:'publish'},{debug:true});
  const value={schemaVersion:7,runId:'uat-1',project:'academy',selection:selection('starci-uat-verify'),feature:'profile',flow:'edit-profile',authorityRefs:['business://profile'],runtimeEvidenceRefs:[],scope:scope('flow'),returnReceipt:unrelated,progressHistory:[]};
  assert.match(validateUatInput(value).errors.join('\n'),/cannot consume returnReceipt/);
});

test('FE uat-return requires UAT final route-issued transition evidence',async()=>{
  const inputDocument={schemaVersion:7,operatorId:'test/uat-result-publish',context:{snapshotRef:'uat://profile/edit/snapshot'},input:{evidenceRefs:['render://uat'],browserSessionRef:'browser://uat',accountRef:'account://fresh'}};
  const outputDocument={schemaVersion:7,operatorId:'test/uat-result-publish',output:{outcome:'passed',result:{summary:'Canonical UAT passed.',artifactRefs:['uat://profile/edit/result']},gaps:[],evidenceRefs:['render://uat']}};
  const executionRef=`execution://${'9'.repeat(64)}`;
  const fields={missionId:'mission-1',skillId:'starci-uat-verify',operatorId:'test/uat-result-publish',parentId:'invocation://uat-publish',context:{executionRef,invocationRef:'invocation://uat-publish'},input:inputDocument,expectedOutput:{outcome:'passed'},actualOutput:outputDocument,resumeState:'uat-return'};
  createReceipt('CALL',{...fields,receiptId:'receipt:uat-publish-call'},{debug:true,now:()=> '2026-08-30T00:00:00.000Z'});
  const returnReceipt=createReceipt('RETURN',{...fields,receiptId:'receipt:uat-publish-return'},{debug:true,now:()=> '2026-08-30T00:00:01.000Z'});
  const feBeforeRoute=feInput('repair','Close repaired Profile'); feBeforeRoute.receiptType='RETURN'; feBeforeRoute.returnReceipt=returnReceipt; feBeforeRoute.resume={missionRef:'mission-1',fromSkillId:'starci-uat-verify',receiptRef:returnReceipt.receiptId,resumeState:'uat-return'};
  assert.match(validateFeInput(feBeforeRoute).errors.join('\n'),/route-issued final transition/);
  const envelope=await validatedOperatorReturn({machineId:uatMachine.id,stateId:'publish',operatorId:'test/uat-result-publish',input:inputDocument,outputDocument,validateOutput:validateUatPublishOutput,returnReceipt});
  assert.equal(nextState(uatMachine,'publish',envelope,inputDocument,envelope.invocationRef,envelope.missionId),'complete');
  const feAfterRoute=feInput('repair','Close repaired Profile'); feAfterRoute.receiptType='RETURN'; feAfterRoute.returnReceipt=returnReceipt; feAfterRoute.resume={missionRef:'mission-1',fromSkillId:'starci-uat-verify',receiptRef:returnReceipt.receiptId,resumeState:'uat-return'};
  assert.deepEqual(validateFeInput(feAfterRoute),{valid:true,errors:[]});
});

test('FE to backend handoff resumes the exact same FE mission', () => {
  const original=feInput('create','Create page X','new');
  original.resume={missionRef:'mission-1',fromSkillId:'starci-backend-process',receiptRef:'receipt:api-ready',resumeState:'apply'};
  original.receiptType='RETURN'; original.returnReceipt=createReceipt('RETURN',{receiptId:'receipt:api-ready',missionId:'mission-1',skillId:'starci-backend-process',parentId:'call-fe-be',resumeState:'apply',authorityRefs:['business://profile'],sourceHeads:['git:backend']},{debug:true,now:()=> '2026-01-01T00:00:00.000Z'});
  assert.deepEqual(validateFeInput(original),{valid:true,errors:[]});
  assert.equal(nextState(machine,'analyze-input',null,{...original,neutralAdversarialDecision}),'consume-return');
  assert.equal(routed('consumed','consume-return'),'peer-guard');
  assert.equal(routed('progress','peer-guard'),'resume-route');
  assert.equal(nextState(machine,'resume-route',null,original),'apply');
  assert.equal(routed('applied','apply'),'capture-preflight');
  assert.equal(routed('ready','capture-preflight'),'capture');
  assert.equal(routed('passed','visual-fidelity'),'quality-handoff');
});

test('UAT verification binds canonical backend-owned feature/flow authority', () => {
  const value={schemaVersion:7,runId:'uat-1',project:'academy',selection:selection('starci-uat-verify'),feature:'profile',flow:'edit-profile',authorityRefs:['business://profile','source://revision'],runtimeEvidenceRefs:['runtime://capture'],scope:scope('flow'),returnReceipt:null,progressHistory:[]};
  assert.deepEqual(validateUatInput(value),{valid:true,errors:[]});
});

test('authenticated UAT accepts only a fresh run-scoped account with a mission Browser lease', () => {
  const sessionLease={leaseRef:'browser-lease://mission-1',missionRef:'mission-1',browserContextRef:'browser://in-app/run-1',principalFingerprint:`sha256:${'a'.repeat(64)}`,runtimeGeneration:1,origin:'http://localhost:3000',fixtureNamespace:'uat-personal-project-run-1',state:'authenticated'};
  const value={schemaVersion:7,operatorId:'test/uat-case-freeze',context:{snapshotRef:'uat://personal-project/core/snapshot'},input:{evidenceRefs:['runtime://personal-project'],browserSessionRef:'browser://in-app/run-1',accountRef:'account://fresh/personal-project/run-1',sessionLease}};
  assert.deepEqual(validateUatCaseInput(value),{valid:true,errors:[]});
  value.input.accountRef='account://personal/teacher';
  assert.equal(validateUatCaseInput(value).valid,false);
  value.input.accountRef='account://reused/test-at-starci';
  assert.equal(validateUatCaseInput(value).valid,false);
  value.input.accountRef='anonymous://explicit/personal-project-entry';
  assert.deepEqual(validateUatCaseInput(value),{valid:true,errors:[]});
});

test('frontend completion is reachable only after quality and UAT returns', () => {
  assert.equal(nextState(machine,'resume-route',null,{resume:{resumeState:'quality-return'}}),'uat-handoff');
  assert.equal(nextState(machine,'resume-route',null,{resume:{resumeState:'uat-return'}}),'complete');
  const directCompleteEdges=Object.entries(machine.states).flatMap(([state,value]) =>
    (value.on ?? []).filter((edge) => edge.target === 'complete').map(() => state));
  assert.deepEqual(directCompleteEdges,['resume-route']);
  assert.equal(machine.states['quality-handoff'].result,'handoff');
  assert.equal(machine.states['uat-handoff'].result,'handoff');
});

test('frontend scope rejects missing, duplicate, or unknown UX/UI change levels',()=>{
  const missing=feInput('audit','Audit Profile'); missing.scope.dimensions=[];
  assert.match(validateFeInput(missing).errors.join('\n'),/exactly one frontend\.ux-ui\.change-level/);
  const duplicate=feInput('audit','Audit Profile'); duplicate.scope.dimensions.push(changeLevel('reconstruct'));
  assert.match(validateFeInput(duplicate).errors.join('\n'),/exactly one frontend\.ux-ui\.change-level/);
  const unknown=feInput('audit','Audit Profile'); unknown.scope.dimensions[0].value='layout';
  assert.match(validateFeInput(unknown).errors.join('\n'),/refine, reconstruct, or new/);
});

test('frontend layout owner ceiling permits nested page layouts and rejects higher ancestors',()=>{
  const nested=feInput('audit','Audit Profile page and its nested layout');
  nested.scope.dimensions=nested.scope.dimensions.map((dimension)=>dimension.key==='frontend.layout.owner-ceiling'?ownerCeilingLevel('surface-and-nested-layouts'):dimension);
  nested.scope.inclusionRefs.push('layout://ProfileNested');
  nested.layoutOwnerCeiling.mutableNestedLayoutRefs.push('layout://ProfileNested');
  nested.exactFiles.push({path:'src/layouts/ProfileNested.tsx',beforeSha256:`sha256:${'b'.repeat(64)}`,ownerRef:'layout://ProfileNested'});
  assert.deepEqual(validateFeInput(nested),{valid:true,errors:[]});
  const escaped=structuredClone(nested);
  escaped.exactFiles.push({path:'src/layouts/AppShell.tsx',beforeSha256:`sha256:${'c'.repeat(64)}`,ownerRef:'layout://AppShell'});
  assert.match(validateFeInput(escaped).errors.join('\n'),/owned above the mutable layout ceiling/);
});

test('feature audit mutates directly owned modal and drawer owners without widening to a shared branch',()=>{
  const grouped=feInput('audit','Audit the complete Profile feature owner group');
  grouped.scope.inclusionRefs.push('modal://ProfileEdit','drawer://ProfileHistory');
  grouped.scope.exclusionRefs.push('modal://SharedModalBranch');
  grouped.layoutOwnerCeiling.directInteractionOwnerRefs.push('modal://ProfileEdit','drawer://ProfileHistory');
  grouped.exactFiles.push(
    {path:'src/ProfileEditModal.tsx',beforeSha256:`sha256:${'b'.repeat(64)}`,ownerRef:'modal://ProfileEdit'},
    {path:'src/ProfileHistoryDrawer.tsx',beforeSha256:`sha256:${'c'.repeat(64)}`,ownerRef:'drawer://ProfileHistory'}
  );
  assert.deepEqual(validateFeInput(grouped),{valid:true,errors:[]});
  const escaped=structuredClone(grouped);
  escaped.exactFiles.push({path:'src/SharedModalBranch.tsx',beforeSha256:`sha256:${'d'.repeat(64)}`,ownerRef:'modal://SharedModalBranch'});
  assert.match(validateFeInput(escaped).errors.join('\n'),/owned above the mutable layout ceiling/);
});
