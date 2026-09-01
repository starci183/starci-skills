import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { loadRuntimeConfig } from './config.mjs';
import { createReceipt, assertProgress, MATERIAL_AI_OPERATORS } from './trace.mjs';
import { canonicalRoots, uatPair } from './topology.mjs';
import { validatorFor } from '../operators/validation.mjs';
import { loadScopePolicy } from './scope-policy.mjs';

const base = { receiptId:'receipt:r1', missionId:'m1', skillId:'starci-quality-assure', operatorId:'quality/lint', parentId:'call-parent', childId:'call-child', missionContext:{ project:'starci', objective:'assure' }, context:{ source:'be', invocationRef:'invocation://runtime-v7' }, input:{ exact:true }, expectedOutput:{ outcome:'pass' }, actualOutput:{ outcome:'pass' }, evidenceRefs:['git:abc'], sourceHeads:['git:abc'], transitionRule:{ outcome:'pass', target:'complete' }, resumeState:null, skip:null, error:null };
const lifecycleFields=(id,hex)=>({missionId:`mission:${id}`,context:{source:'be',invocationRef:`invocation://${id}`,executionRef:`execution://${hex.repeat(64)}`}});

test('sole YAML config is strict v7.6 with fresh Sol review and centralized runtime/session ownership', () => assert.deepEqual(loadRuntimeConfig(), {
  version:'7.6.0-beta.1',
  grammarContractVersion:'7.4.0',
  debug:true,
  aiBrainstormModel:'gpt-5.6-sol',
  aiBrainstormCount:1,
  aiBrainstormIsolation:'fresh',
  aiBrainstormForkTurns:'none',
  visualReviewModel:'gpt-5.6-sol',
  visualReviewCount:1,
  visualReviewIsolation:'fresh',
  visualReviewForkTurns:'none',
  visualReviewNoProgressLimit:3,
  localRuntimeOwnership:'centralized-task',
  localRuntimeControlPlane:'control-panel',
  localFrontendUrl:'http://localhost:3000',
  localApiUrl:'http://localhost:3001',
  localIdentityUrl:'http://localhost:8080',
  featureTaskRuntimeMutation:'forbidden',
  localRuntimeRegistry:'.worktrees/sessions/central-runtime/owner.json',
  localUatBrowserOwnership:'centralized-lease',
  localUatBrowserControlPlane:'control-panel',
  localUatBrowserLeaseRegistry:'.worktrees/sessions/central-uat-browser/leases',
  localUatBrowserDelivery:'materialize-or-broker-execute',
  crossTaskBrowserHandleAssumption:'forbidden',
  featureTaskCredentialHandling:'forbidden',
}));

test('local feature tasks consume one control-panel-owned runtime instead of owning ports',()=>{
  const runtime=loadRuntimeConfig();
  assert.equal(runtime.localRuntimeOwnership,'centralized-task');
  assert.equal(runtime.localRuntimeControlPlane,'control-panel');
  assert.equal(runtime.featureTaskRuntimeMutation,'forbidden');
  assert.equal(runtime.localRuntimeRegistry,'.worktrees/sessions/central-runtime/owner.json');
  assert.deepEqual(
    [runtime.localFrontendUrl,runtime.localApiUrl,runtime.localIdentityUrl],
    ['http://localhost:3000','http://localhost:3001','http://localhost:8080']
  );
});

test('UI-only fast lane preserves business authority and exact-file mutation boundaries',()=>{
  const auditLoop=fs.readFileSync(new URL('../knowledge/audit-loop-v75b.md',import.meta.url),'utf8');
  const skill=fs.readFileSync(new URL('../skills/starci-fe-process/SKILL.md',import.meta.url),'utf8');
  const apply=fs.readFileSync(new URL('../operators/fe/source-apply/execute.md',import.meta.url),'utf8');
  for(const text of [skill,apply]){
    assert.match(text,/ui-only-preserve-business/);
    assert.match(text,/GraphQL/);
    assert.match(text,/tracked and untracked/is);
    assert.match(text,/exact-file|exact allowed files|exact listed/is);
  }
  assert.match(auditLoop,/render-only contract preserves business behavior/);
  assert.match(auditLoop,/forbids new API operations/);
  assert.match(auditLoop,/tracked and untracked/);
  assert.match(auditLoop,/exact frozen write set/);
  assert.match(auditLoop,/badge or narrated\s+progress is insufficient/);
  assert.match(skill,/never let two tasks repair the same page group concurrently/);
});

test('central runtime registry binds one owner generation and canonical localhost endpoints',()=>{
  const validateOwner=validatorFor(new URL('../templates/runtime/owner.schema.json',import.meta.url));
  const owner=JSON.parse(fs.readFileSync(new URL('../templates/runtime/owner.template.json',import.meta.url)));
  assert.equal(validateOwner(owner).valid,true);
  assert.equal(validateOwner({...owner,endpoints:{...owner.endpoints,api:'http://127.0.0.1:3001'}}).valid,false);
  assert.equal(validateOwner({...owner,status:'ready',ownerThreadId:''}).valid,false);
});

test('authenticated Browser work requires materialization proof or broker execution',()=>{
  const validateLease=validatorFor(new URL('./contracts/browser-execution-lease.schema.json',import.meta.url));
  const base={schemaVersion:1,leaseRef:'browser-lease://mission-1',missionRef:'mission://dashboard',purpose:'product-uat',accountRef:'account://fresh/dashboard/run-1',reuseAttestations:null,principalFingerprint:`sha256:${'a'.repeat(64)}`,runtimeGeneration:1,origin:'http://localhost:3000',fixtureNamespace:'uat-dashboard-run-1',expiresAt:'2026-08-31T09:29:40.167Z',state:'authenticated'};
  const materialized={...base,executionMode:'consumer-materialized',executionOwnerRef:'thread://dashboard',browserContextRef:'browser-context://dashboard/1',consumerTabRef:'browser-tab://dashboard/4',evidenceBrokerRef:null,materializationStatus:'materialized',materializationEvidenceRefs:['browser-observation://dashboard/tab-4']};
  assert.equal(validateLease(materialized).valid,true);
  assert.equal(validateLease({...materialized,consumerTabRef:null,materializationEvidenceRefs:[]}).valid,false);
  const brokered={...base,executionMode:'broker-executed',executionOwnerRef:'thread://control-panel',browserContextRef:'browser-context://broker/1',consumerTabRef:null,evidenceBrokerRef:'browser-broker://control-panel/dashboard',materializationStatus:'not-applicable',materializationEvidenceRefs:['browser-observation://consumer/no-tabs']};
  assert.equal(validateLease(brokered).valid,true);
  assert.equal(validateLease({...brokered,evidenceBrokerRef:null}).valid,false);
  const reuseAttestations=['previous-lease-released','role-compatible','locale-resettable','fixture-readable','origin-matches','runtime-generation-matches'];
  const readOnlyReuse={...brokered,leaseRef:'browser-lease://profile-audit',missionRef:'mission://profile-audit',purpose:'read-only-visual-audit',accountRef:'account://uat-pool/learner/default',reuseAttestations,fixtureNamespace:'read-only-profile'};
  assert.equal(validateLease(readOnlyReuse).valid,true);
  assert.equal(validateLease({...readOnlyReuse,purpose:'product-uat'}).valid,false);
  assert.equal(validateLease({...readOnlyReuse,reuseAttestations:reuseAttestations.filter((item)=>item!=='fixture-readable')}).valid,false);
});

test('scope policy rejects unresolved mission scope before skill selection', () => {
  const policy=loadScopePolicy();
  assert.equal(policy.version,'7.6.0-beta.1');
  assert.equal(policy.unclearAction,'ask-before-skill-selection');
  assert.equal(policy.sourceInspectionWhileAmbiguous,'forbidden');
  assert.deepEqual(policy.registeredDimensions['frontend.ux-ui.change-level'],['refine','reconstruct','new']);
  assert.deepEqual(policy.registeredDimensions['frontend.layout.owner-ceiling'],['surface-only','surface-and-nested-layouts','ancestor-layouts-authorized']);
});

test('debug true renders the normalized execution contract', () => {
  const receipt = createReceipt('CALL', {...base,...lifecycleFields('debug-contract','1')}, { debug:true, now:()=> '2026-01-01T00:00:00.000Z' });
  for (const key of ['missionContext','context','input','expectedOutput','actualOutput','evidenceRefs','sourceHeads','transitionRule','resumeState','skip','error']) assert.ok(Object.hasOwn(receipt.trace,key), key);
});

test('debug true prints the visual phase, packet, round, partitions, and finding count', () => {
  const lines=[];
  const fields={...base,...lifecycleFields('visual-loop-debug','d'),operatorId:'fe/capture-preflight',actualOutput:{output:{outcome:'ready',result:{round:{number:2,purpose:'verification'},matrixFingerprint:`sha256:${'a'.repeat(64)}`,capturePartitionRefs:['partition://main','partition://shared'],reusedPartitionRefs:['partition://header'],findingLedger:[{findingRef:'finding://spacing'}]}}}};
  createReceipt('CALL',{...fields,receiptId:'receipt:visual-loop-debug-call'},{debug:true,writeDebug:(line)=>lines.push(line)});
  assert.ok(lines.some((line)=>line.includes('[VISUAL LOOP][CALL] operator=fe/capture-preflight round=2 purpose=verification')));
  assert.ok(lines.some((line)=>line.includes('capturePartitions=2 reusedPartitions=1 findings=1')));
});

test('debug false retains a typed receipt while reducing visibility', () => {
  const fields={...base,...lifecycleFields('debug-compact','2')};
  createReceipt('CALL',{...fields,receiptId:'receipt:r2-call'},{debug:false});
  const receipt = createReceipt('RETURN', { ...fields, receiptId:'receipt:r2' }, { debug:false });
  assert.equal(receipt.type,'RETURN'); assert.ok(receipt.progressFingerprint); assert.deepEqual(Object.keys(receipt.trace).sort(), ['authorityRefs','evidenceRefs','sourceHeads']);
});

test('debug true prints AI contracts and concrete per-raster inspection findings to terminal', () => {
  const lines=[];
  const fields={
    ...base,
    ...lifecycleFields('ai-debug-lines','5'),
    aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'a'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'},
    actualOutput:{outcome:'repair',result:{inspectionRecords:[{imageRef:'render://final.png',lensVerdicts:[{lens:'content-padding',verdict:'problem',observation:'Card content visibly touches the top and left frame edges.'}],challengeRecords:[],verdict:'repair'}]}},
  };
  createReceipt('CALL',{...fields,receiptId:'receipt:ai-review-call'},{debug:true,writeDebug:(line)=>lines.push(line)});
  createReceipt('RETURN',{...fields,receiptId:'receipt:ai-review-return'},{debug:true,writeDebug:(line)=>lines.push(line)});
  assert.ok(lines.some((line)=>line.startsWith('[AI REVIEW][RETURN]')));
  assert.ok(lines.some((line)=>line.includes('[AI REVIEW][image: render://final.png]')));
  assert.ok(lines.some((line)=>line.includes('[FINDING][content-padding][PROBLEM] Card content visibly touches')));
  assert.ok(lines.some((line)=>line === '[VERDICT] REPAIR'));
});

test('debug true prints concrete observations even when a raster passes',()=>{
  const lines=[];
  const fields={...base,...lifecycleFields('ai-debug-pass-lines','0'),aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'0'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'},actualOutput:{outcome:'passed',result:{inspectionRecords:[{imageRef:'render://final.png',lensVerdicts:[{lens:'content-padding',verdict:'passed',observation:'All four content edges retain visible breathing room.'}],challengeRecords:[],verdict:'passed'}]}}};
  createReceipt('CALL',{...fields,receiptId:'receipt:ai-review-pass-call'},{debug:true,writeDebug:(line)=>lines.push(line)});
  createReceipt('RETURN',{...fields,receiptId:'receipt:ai-review-pass-return'},{debug:true,writeDebug:(line)=>lines.push(line)});
  assert.ok(lines.some((line)=>line.includes('[FINDING][content-padding][PASSED] All four content edges retain visible breathing room.')));
});

test('debug true visibly blocks a visual review that omitted inspection records',()=>{
  const lines=[];
  const fields={...base,...lifecycleFields('ai-debug-missing-record','9'),operatorId:'fe/visual-fidelity',aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'9'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'},actualOutput:{outcome:'passed',result:{inspectionRecords:[]}}};
  createReceipt('CALL',{...fields,receiptId:'receipt:ai-review-missing-call'},{debug:true,writeDebug:(line)=>lines.push(line)});
  createReceipt('RETURN',{...fields,receiptId:'receipt:ai-review-missing-return'},{debug:true,writeDebug:(line)=>lines.push(line)});
  assert.ok(lines.some((line)=>line.includes('[FINDING][inspection][MISSING] No concrete raster inspection record was supplied.')));
  assert.ok(lines.some((line)=>line==='[VERDICT] BLOCKED'));
});

test('debug true prints the core direction-generation contract without a fake pixel verdict',()=>{
  const lines=[];
  const fields={...base,...lifecycleFields('direction-debug','c'),operatorId:'fe/direction-generate',aiActivity:{kind:'brainstorm',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'c'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'},actualOutput:{outcome:'generated',result:{mode:'dominant',requiresChoice:false,comparisonArtifactRef:'artifact://direction.html'}}};
  createReceipt('CALL',{...fields,receiptId:'receipt:direction-debug-call'},{debug:true,writeDebug:(line)=>lines.push(line)});
  createReceipt('RETURN',{...fields,receiptId:'receipt:direction-debug-return'},{debug:true,writeDebug:(line)=>lines.push(line)});
  assert.ok(lines.some((line)=>line.startsWith('[AI BRAINSTORM][RETURN]')));
  assert.ok(lines.some((line)=>line.includes('"requiresChoice":false')));
  assert.equal(lines.some((line)=>line.startsWith('[AI REVIEW][image:')),false);
});

test('material AI CALL RETURN and TRANSITION cannot execute silently or with a different model policy', () => {
  assert.deepEqual([...MATERIAL_AI_OPERATORS].filter((operatorId)=>operatorId.startsWith('fe/')).sort(),['fe/direction-generate','fe/visual-fidelity']);
  for (const type of ['CALL','RETURN','TRANSITION']) {
    assert.throws(() => createReceipt(type,{...base,receiptId:`receipt:missing-${type}`,operatorId:'fe/visual-fidelity'},{debug:true,writeDebug:()=>{}}),/AI activity is required/);
    const lines=[];
    createReceipt(type,{...base,receiptId:`receipt:bound-${type}`,operatorId:'fe/visual-fidelity',aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'b'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}},{debug:true,writeDebug:(line)=>lines.push(line)});
    assert.ok(lines.some((line)=>line.startsWith(`[AI REVIEW][${type}]`)), type);
  }
  assert.throws(() => createReceipt('CALL',{...base,missionId:'silent-ai',receiptId:'receipt:silent-ai',operatorId:'fe/visual-fidelity',aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'f'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}},{debug:false,writeDebug:()=>{}}),/debug=true/);
  assert.throws(() => createReceipt('RETURN',{...base,missionId:'return-only-ai',context:{...base.context,invocationRef:'invocation://return-only-ai'},receiptId:'receipt:return-only-ai',operatorId:'fe/visual-fidelity',aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'8'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}},{debug:true,writeDebug:()=>{}}),/requires CALL before RETURN/);
  const lifecycle = { ...base, missionId:'split-ai', operatorId:'fe/visual-fidelity', context:{...base.context,invocationRef:'invocation://split-ai'} };
  createReceipt('CALL',{...lifecycle,receiptId:'receipt:split-call',aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'f'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}},{debug:true,writeDebug:()=>{}});
  assert.throws(() => createReceipt('RETURN',{...lifecycle,receiptId:'receipt:split-return',aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'9'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}},{debug:true,writeDebug:()=>{}}),/executionRef changed/);
  assert.throws(() => createReceipt('CALL',{...base,receiptId:'receipt:wrong-model',operatorId:'fe/direction-generate',aiActivity:{kind:'brainstorm',model:'invalid-model',count:1,executionRef:`execution://${'c'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}},{debug:true,writeDebug:()=>{}}),/one fresh gpt-5.6-sol/);
});

test('all operator returns require CALL and invocation identity is globally unique', () => {
  assert.throws(()=>createReceipt('RETURN',{...base,...lifecycleFields('non-ai-return-only','6'),receiptId:'receipt:non-ai-return-only'},{debug:true}),/requires CALL before RETURN/);
  const first={...base,missionId:'mission:invocation-owner-a',operatorId:'fe/visual-fidelity',context:{...base.context,invocationRef:'invocation://globally-unique'},aiActivity:{kind:'review',model:'gpt-5.6-sol',count:1,executionRef:`execution://${'6'.repeat(64)}`,principalFingerprint:`sha256:${'d'.repeat(64)}`,contextFingerprint:`sha256:${'e'.repeat(64)}`,isolation:'fresh',forkTurns:'none'}};
  createReceipt('CALL',{...first,receiptId:'receipt:invocation-owner-a'},{debug:true,writeDebug:()=>{}});
  const second={...first,missionId:'mission:invocation-owner-b',aiActivity:{...first.aiActivity,executionRef:`execution://${'7'.repeat(64)}`}};
  assert.throws(()=>createReceipt('CALL',{...second,receiptId:'receipt:invocation-owner-b'},{debug:true,writeDebug:()=>{}}),/invocation identity is already bound/);
});

test('issued receipts are deeply immutable and retain their issuance digest', () => {
  const fields={...base,...lifecycleFields('immutable','3'),input:{revision:'issued'},actualOutput:{outcome:'issued'}};
  createReceipt('CALL',{...fields,receiptId:'receipt:immutable-call'},{debug:false});
  const receipt=createReceipt('RETURN',{...fields,receiptId:'receipt:immutable'},{debug:false});
  assert.equal(Object.isFrozen(receipt),true);
  assert.equal(Object.isFrozen(receipt.trace),true);
  assert.throws(()=>{ receipt.trace.evidenceRefs.push('git:retargeted'); },/read only|extensible|object is not extensible/i);
  assert.deepEqual(receipt.trace.evidenceRefs,['git:abc']);
});

test('secrets are redacted and chain-of-thought fields are omitted', () => {
  const receipt=createReceipt('ERROR',{...base,receiptId:'receipt:r3',input:{apiKey:'secret',nested:{password:'secret'}},missionContext:{chainOfThought:'never',objective:'safe'}},{debug:true});
  assert.equal(receipt.trace.input.apiKey,'[REDACTED]'); assert.equal(receipt.trace.input.nested.password,'[REDACTED]'); assert.equal(receipt.trace.missionContext.chainOfThought,undefined);
});

test('secrets embedded in headers, URLs, and generic strings are redacted', () => {
  const input={ note:'Authorization: Bearer abc.def', url:'https://user:pass@example.test/path?token=abc&safe=yes', header:'X-Api-Key: raw-secret' };
  const receipt=createReceipt('ERROR',{...base,receiptId:'receipt:strings',input},{debug:true});
  const rendered=JSON.stringify(receipt.trace.input); assert.doesNotMatch(rendered,/abc\.def|user:pass|token=abc|raw-secret/); assert.match(rendered,/REDACTED/);
});

test('nested calls return and resume with parent-child identity', () => {
  const fields={...base,...lifecycleFields('nested','4')};
  const call=createReceipt('CALL',{...fields,receiptId:'receipt:r4'},{debug:true});
  const ret=createReceipt('RETURN',{...fields,receiptId:'receipt:r5',parentId:call.childId,childId:null},{debug:true});
  const resume=createReceipt('RESUME',{...base,receiptId:'receipt:r6',parentId:ret.parentId,resumeState:{from:'wait-1'}},{debug:true});
  assert.equal(ret.parentId,call.childId); assert.deepEqual(resume.trace.resumeState,{from:'wait-1'});
});

test('progress allows legitimate repeated CALLs but rejects wording-only RETURN replay', () => {
  const common={...base,missionId:'mission:progress-guard',operatorId:'quality/readiness-inventory',input:{sourceFingerprint:`sha256:${'7'.repeat(64)}`},expectedOutput:{outcome:'green'}};
  const first={...common,context:{invocationRef:'invocation://progress-round-1',executionRef:`execution://${'7'.repeat(64)}`},actualOutput:{output:{outcome:'green',result:{findingRefs:[],summary:'First wording.'}}}};
  const second={...common,context:{invocationRef:'invocation://progress-round-2',executionRef:`execution://${'8'.repeat(64)}`},actualOutput:{output:{outcome:'green',result:{findingRefs:[],summary:'Different wording only.'}}}};
  const firstCall=createReceipt('CALL',{...first,receiptId:'receipt:progress-call-1'},{debug:true,writeDebug:()=>{}});
  const secondCall=createReceipt('CALL',{...second,receiptId:'receipt:progress-call-2'},{debug:true,writeDebug:()=>{}});
  assert.equal(assertProgress([firstCall,secondCall]),true);
  const firstReturn=createReceipt('RETURN',{...first,receiptId:'receipt:progress-return-1',parentId:firstCall.receiptId},{debug:true,writeDebug:()=>{}});
  const secondReturn=createReceipt('RETURN',{...second,receiptId:'receipt:progress-return-2',parentId:secondCall.receiptId},{debug:true,writeDebug:()=>{}});
  assert.equal(firstReturn.progressFingerprint,secondReturn.progressFingerprint);
  assert.throws(()=>assertProgress([firstReturn,secondReturn]),/no-progress cycle/);
});

test('topology is flat and excludes projects, coding-context, and Qdrant', () => {
  const roots=canonicalRoots(); assert.deepEqual(roots,['.worktrees/_templates','.worktrees/businesses','.worktrees/uat','.worktrees/sessions','.worktrees/debts']); assert.doesNotMatch(JSON.stringify(roots),/projects|coding-context|qdrant/i);
});

test('UAT snapshot and result form one canonical feature-flow pair', () => {
  assert.deepEqual(uatPair('.worktrees','authentication','sign-in'),{snapshot:'.worktrees/uat/authentication/sign-in/snapshot.json',result:'.worktrees/uat/authentication/sign-in/result.json'});
  const validateSnapshot=validatorFor(new URL('../templates/uat/snapshot.schema.json',import.meta.url));
  const template=JSON.parse(fs.readFileSync(new URL('../templates/uat/snapshot.template.json',import.meta.url))); assert.equal(validateSnapshot(template).valid,true);
});
