// Current verifier fixture helpers. Successful receipts pass the copied runtime's open/accept
// lifecycle; HTTP calls and browser records are measured locally, never stamped accepted.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFileSync,copyFileSync,existsSync,appendFileSync} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {sha,put,table,git,branch,current,actual,planCells,open,accept} from './workflow-source-fixture.mjs';

const q=value=>'`'+value+'`';
const ref=step=>`step-${step}/parallel-1/response/response.md`;

export async function startFixtureApi(t,f,{writerRef='src/modules/fixture/worker.mjs',writerRefs=[writerRef]}={}){
 const workers=await Promise.all(writerRefs.map(async ref=>(await import(pathToFileURL(path.join(f.worktree,ref)).href)).runFixtureWorker));
 const runFixtureWorker=value=>{const results=workers.map(worker=>worker(value));assert.ok(results.length);assert.ok(results.every(result=>result===results[0]),'integrated consumer outputs agree');return results[0];};
 const observed=[];
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname!=='/api'){res.writeHead(404);res.end();return;}
  const value=url.searchParams.get('value');
  observed.push({method:req.method,value,writers:writerRefs,at:new Date().toISOString()});
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({value:value===null?'ready':runFixtureWorker(value)}));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 return{server,endpoint:`http://127.0.0.1:${server.address().port}/api`,observed};
}

export async function acceptRuntimeObservation(f,runtime,{step,goal={doneWhen:2},role='be',worktree=f.worktree,wantedCommit=null,coordination=null}={}){
 assert.equal(typeof f.source,'string','fixture source is the immutable host path, never an accepted source receipt');
 assert.equal(typeof worktree,'string','runtime observation requires the actual serving checkout path');
 const {stackDeclaration}=await f.load('scripts/validate-request.mjs');
 const {NOOP_CHECKS}=await f.load('operators/runtime-serve/validate.mjs');
 const {captureRuntimeObservation}=await f.load('scripts/runtime-observation.mjs');
 const state=f.state(),project=state.project,routeKey=`${project}/${role}`,env='dev',head=git(worktree,'rev-parse','HEAD');
 const pinned=wantedCommit??head,contains=[...new Set([head,pinned])];
 assert.equal(git(worktree,'merge-base','--is-ancestor',pinned,head),'','the actual serving checkout must contain the requested source');
 put(path.join(f.source,'.stacks/dev/environment.json'),{schemaVersion:9,env,production:false});
 const declaration=await stackDeclaration(f.root,env,f.source);
 const requirements={routeKey,env,operation:'serve',commit:pinned,approval:declaration.reference,portClaims:[],desiredState:{planSha256:sha('Observe exact fixture runtime without any shared writes'),serviceKind:'runtime',resourceRefs:[routeKey],effects:['attest-runtime-entry'],mutableResourceRefs:[routeKey],observationOnlyResourceRefs:[]}};
 planCells(f,[[step,'runtime.serve']]);
 const request=current(f,{operatorId:'runtime.serve',contexts:[],requirements,inputs:{}},step,{goal,workspace:false,mode:'inline',coordination});
 const dir=await open(f,request),registryFile=path.join(f.source,'.worktrees/sessions/central-runtime/owner.json');
 const startedAt=runtime.record?.startedAt??(runtime.startedAt??=new Date().toISOString());
 const entry=runtime.entry??{endpoints:{frontend:runtime.endpoint,api:runtime.endpoint,identity:runtime.endpoint},branch:git(worktree,'branch','--show-current'),head,contains,generation:10,status:'ready',healthEvidenceRefs:['measured-current-loopback-runtime'],identity:null,server:{worktree,pid:process.pid,listenerPid:process.pid,port:runtime.server.address().port,command:'node current-verifier-fixture',logRef:'runtime.log',pidFileRef:'runtime.pid',startedAt},lease:null};
 assert.equal(entry.head,head);assert.equal(entry.server.worktree,worktree);const generation=entry.generation,server=entry.server;
 // Fixture infrastructure declaration precedes its first observation. Later receipts only observe it.
 if(!runtime.registryInitialized){const registry=existsSync(registryFile)?JSON.parse(readFileSync(registryFile)):{schemaVersion:9,ownerTaskId:'fixture-runtime-owner',generation:10,updatedAt:startedAt,runtimes:{}};assert.equal(registry.runtimes[routeKey],undefined,'fixture setup never replaces another runtime owner');registry.runtimes[routeKey]=entry;put(registryFile,registry);runtime.registryInitialized=true;}
 const registryBytes=readFileSync(registryFile),fingerprint=sha(registryBytes);
 const before=await captureRuntimeObservation({root:f.root,hostRoot:f.source,branch:dir,label:'before',urls:[runtime.endpoint]});
 const after=await captureRuntimeObservation({root:f.root,hostRoot:f.source,branch:dir,label:'after',urls:[runtime.endpoint]});
 const ownerRef=runtime.ownerRef??'fixture-runtime-owner';
 const checks=NOOP_CHECKS.map(name=>({name,resourceRef:routeKey,status:'passed',evidenceRef:before.ref}));
 const findings=[{code:'RUNTIME_HEAD_REUSED',resourceRef:routeKey,port:null,holderRef:null,statement:'Paired measured observations found the same healthy current source and process.'}];
 const delta={serviceRef:routeKey,serviceKind:'runtime',ownerRef,approvalRef:declaration.reference,planSha256:requirements.desiredState.planSha256,inventoryFingerprint:fingerprint,generation,observedAt:new Date().toISOString(),inventoriedResources:[{resourceRef:routeKey,kind:'runtime',revision:`g-${generation}`,ownerRef}],observedPortHolders:[],portClaims:[],mutableResourceRefs:[routeKey],observationOnlyResourceRefs:[],allowedEffects:requirements.desiredState.effects,appliedEffects:[],capabilities:[{capability:'runtime:registry-write',custodyEvidenceRef:'fixture-runtime-custody'}],convergence:'already-converged',mutations:[],noOpProof:{before,after},runtimeLadder:{routeKey,operation:'serve',rung:'serve',reused:true,sessionId:state.id,wantedCommit:pinned,servedHead:head,contains:entry.contains,integration:null,infra:null,locations:[],observed:{head,containsWanted:true,pid:server.pid,pidAlive:true,probeAnswered:true,leaseSessionId:null,queue:[]},server:{pid:server.pid,previousPid:server.pid,port:server.port,command:server.command,logRef:server.logRef,pidFileRef:server.pidFileRef,startedAt,cache:{cleared:false,reason:'unchanged',directories:[],previousHead:head}},queuePosition:null,lease:null}};
 const receipt='# platform-operation-receipt — runtime '+routeKey+'\n'+table('Binding',['Field','Value'],[['Operator',q('runtime.serve')],['Step',q(`step-${step}/parallel-1`)],['Project',q(project)],['Service',routeKey],['Service kind','runtime'],['Owner',q(ownerRef)],['Approval',declaration.reference],['Desired state',q(requirements.desiredState.planSha256)],['Inventory fingerprint',q(fingerprint)]])+table('Convergence',['Field','Value'],[['Convergence','already-converged']])+table('Inventoried resources',['Resource','Kind','Revision','Owner'],[[q(routeKey),'runtime',`g-${generation}`,q(ownerRef)]])+table('Port holders',['Port','Holder','Evidence'])+table('Mutations',['Effect','Resource','Before','After'])+table('Checks',['Check','Resource','Status','Evidence'],checks.map(c=>[q(c.name),q(c.resourceRef),c.status,q(c.evidenceRef)]))+table('Findings',['Code','Resource','Port','Holder','Statement'],findings.map(c=>[q(c.code),q(routeKey),'—','—',c.statement]));
 put(path.join(dir,'response/response.md'),receipt);put(path.join(dir,'response/data/delta.json'),delta);put(path.join(dir,'response/data/checks.json'),{serviceRef:routeKey,serviceKind:'runtime',requiredCheckNames:NOOP_CHECKS,checks,findings});
 await accept(f,request,actual(request,{fields:{'platform-operation-receipt':'response/response.md',delta:'response/data/delta.json',checks:'response/data/checks.json'},fallbacks:[],commits:[],next:['api.verify']},'done',['response/response.md'],'sol-fresh'));
 assert.deepEqual(readFileSync(registryFile),registryBytes);
 const {acceptedProducerProof}=await f.load('scripts/producer-import.mjs');
 const proof=await acceptedProducerProof(f.root,state.id,step,1,'delta',{hostRoot:f.source});
 runtime.head=head;return{step,head,pinnedHead:pinned,ref:ref(step),request,proof,delta,entry};
}

export const API_SUITE_REF='src/modules/fixture/api-suite.mjs';
export const API_SUITE_SOURCE=`import assert from 'node:assert/strict';
const endpoint=process.argv[2]; const startedAt=new Date().toISOString(); const cases=[];
for(const [caseId,input,expected] of [['valid value is uppercased','hello','HELLO'],['empty value remains empty','',''],['repeated value is deterministic','hello','HELLO']]){
 const start=performance.now(); const url=new URL(endpoint);url.searchParams.set('value',input);
 const result=await fetch(url);assert.equal(result.status,200); const data=await result.json();assert.equal(data.value,expected);
 cases.push({caseId,request:'GET '+url.pathname,status:'pass',assertion:'value equals '+JSON.stringify(expected),durationMs:Math.max(1,Math.round(performance.now()-start)),evidenceRef:'response/artifacts/api-output.txt'});
}
process.stdout.write(JSON.stringify({startedAt,cases},null,2)+'\\n');
`;

export async function acceptApiVerification(f,runtime,before,{step,goal={doneWhen:3},pinnedHead=null,coordination=null,criteria=null}={}){
 const state=f.state(),servedHead=git(before.entry.server.worktree,'rev-parse','HEAD'),head=pinnedHead??git(f.worktree,'rev-parse','HEAD'),env='dev',flow='fixture-api';
 assert.equal(git(f.worktree,'merge-base','--is-ancestor',head,servedHead),'');
 assert.equal(before.head,servedHead);assert.equal(before.request.requirements.commit,head);
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15),runId=`${stamp}-${head.slice(0,7)}`,namespace=`uat-${runId}`;
 const {stackDeclaration}=await f.load('scripts/validate-request.mjs'),declaration=await stackDeclaration(f.root,env,f.source);
 const contexts=[{alias:`@worktrees/e2e/${flow}`,head:null},{alias:'@worktrees/sessions/central-runtime',head:null},{alias:'@workspaces/device-state',head:null},{alias:'@workspaces/be',head}];
 planCells(f,[[step,'api.verify']]);
 const request=current(f,{operatorId:'api.verify',contexts,requirements:{approval:declaration.reference,flow,env,runId,resume:null},inputs:{'platform-operation-receipt':before.ref}},step,{goal,coordination,criteria});
 const declared=JSON.parse(readFileSync(path.join(f.worktree,'package.json'))).scripts?.['test:e2e'];
 assert.equal(declared,`node ${API_SUITE_REF}`,'the API invocation consumes the source owner\'s declared suite');
 assert.equal(JSON.parse(git(f.worktree,'show',`${head}:package.json`)).scripts?.['test:e2e'],declared,'the pinned source declares the actual suite');
 const dir=await open(f,request),command=`node ${API_SUITE_REF} ${runtime.endpoint}`;
 const run=await promisify(execFile)(process.execPath,[API_SUITE_REF,runtime.endpoint],{cwd:f.worktree,encoding:'utf8',windowsHide:true,timeout:15000});
 const measured=JSON.parse(run.stdout),outputRef='response/artifacts/api-output.txt';put(path.join(dir,outputRef),run.stdout+run.stderr);
 const cases={runId,flow,commit:head,servedHead,servedContainsCommit:true,receiptRef:before.ref,endpoint:runtime.endpoint,command,commandRef:`package.json#scripts.test:e2e@${head}`,exitCode:0,outputRef,namespace,startedAt:measured.startedAt,cases:measured.cases};
 const lanes=['contract','data','lifecycle'].map(lane=>({lane,verdict:'pass',evidenceRefs:[outputRef],statement:lane==='data'?'The stateless API returned the measured input transformation and created no records.':lane==='lifecycle'?'Repeated actual API requests retained no mutable state or cleanup obligations.':'The actual API returned every expected value.'}));
 const flowRoot=path.join(f.worktree,'.worktrees/e2e',flow);
 const verdicts={runId,commit:head,servedHead,namespace,flowRoot,resultRef:`.worktrees/e2e/${flow}/runs/${runId}/result.json`,latestRef:`.worktrees/e2e/${flow}/latest.json`,historyRef:`.worktrees/e2e/${flow}/history.md`,lanes,records:[],cleanup:{performed:true,verifiedReadOnly:true,namespace,runRecordsDeleted:false}};
 put(path.join(flowRoot,'api/runs',runId,'result.json'),{runId,commit:head,lanes});put(path.join(flowRoot,'api/latest.json'),{runId});put(path.join(flowRoot,'api/history.md'),`# history\n\n- ${runId} — measured stateless API passed\n`);
 const receipt='# api-verification — '+flow+'\n'+table('Binding',['Field','Value'],[['Run',q(runId)],['Approval',q(declaration.reference)],['Flow',q(flow)],['Environment',env],['Pinned commit',q(head)],['Served head',q(servedHead)],['Served contains pinned','yes'],['Endpoint',q(runtime.endpoint)],['Namespace',q(namespace)],['Account','—'],['Credential','—'],['Command',q(command)],['Command source',q(API_SUITE_REF)],['Exit code','0'],['Run record',q(verdicts.resultRef)],['Latest',q(runId)]])+table('Cases',['Case','Request','Status','Assertion','Duration','Evidence'],cases.cases.map(c=>[q(c.caseId),q(c.request),c.status,c.assertion,`${c.durationMs}ms`,q(c.evidenceRef)]))+table('Lanes',['Lane','Verdict','Evidence'],lanes.map(l=>[q(l.lane),l.verdict,q(outputRef)]))+table('Namespace',['Record','Store','Inside','Read back'])+table('Printed',['Artifact','Why'],[[q('response/data/cases.json'),'Actual local HTTP cases and measured results']])+table('Findings',['Code','Statement'])+table('Fallbacks taken',['Code','Action']);
 put(path.join(dir,'response/response.md'),receipt);put(path.join(dir,'response/data/cases.json'),cases);put(path.join(dir,'response/data/verdicts.json'),verdicts);
 await accept(f,request,actual(request,{fields:{'api-verification':'response/response.md','api-cases':'response/data/cases.json','api-verdicts':'response/data/verdicts.json','api-output':outputRef},fallbacks:[],commits:[],next:['git.publish','workflow.verify']},'done',['response/response.md',outputRef]));
 const {acceptedProducerProof}=await f.load('scripts/producer-import.mjs');
 const proof=await acceptedProducerProof(f.root,state.id,step,1,'api-verification',{hostRoot:f.source});
 return{step,head,request,proof,cases,ref:ref(step),measured};
}

export async function acceptUatPlan(f,{step,goal,feature='fixture',flow='read-worker-result',entry='/fixture',coordination=null}={}){
 const modes={access:'anonymous',fixtures:'none',sourceRoles:'full'};
 const outcome='A visitor invokes the stateless worker through the displayed control and reads its actual result.';
 const requirements={goal:outcome,feature,env:'dev',resume:null,...modes};
 const contexts=[{alias:'@worktrees/_templates',head:null},{alias:`@worktrees/uat/${feature}/${flow}`,head:null}];
 planCells(f,[[step,'uat.plan']]);
 const request=current(f,{operatorId:'uat.plan',contexts,requirements,inputs:{}},step,{goal,workspace:false,coordination});
 const dir=await open(f,request);
 const units={schemaVersion:9,producedBy:'uat.plan',units:[{id:flow,kind:'flow',goal:outcome,inputs:[],dependsOn:[],tier:'journey'}]};
 const sheet={contractVersion:'starci/v2.2',feature,env:'dev',planVersion:'uat-plan/1',flows:[{...modes,flowId:flow,state:'missing',action:'create',entry,actorAliases:[],namespace:null}],cases:[{caseId:'read-worker-result',flowId:flow,order:1,actor:'anonymous',preconditions:['The separately admitted frontend and runtime are ready.'],inputs:['wrong','hello'],actions:['Enter and submit a value.','Correct the value in place and press Transform.','Repeat using the keyboard.','Reload and read the retained actual response.'],assertions:['visible-result'],expected:['The result reads HELLO after correction, repeat and reload.'],verification:['Observe the named controls, actual returned result, timing, keyboard operation and document continuity through the browser runner.'],fixture:null,cleanup:'none'}]};
 put(path.join(dir,'response/response.md'),'# uat-plan — '+feature+'\n'+table('Flows',['Flow','Entry','Steps','Account','Seed namespace','Tier'],[[q(flow),q(entry),'16','—','—','journey']])+table('Fallbacks taken',['Code','Action']));
 put(path.join(dir,'response/data/units.json'),units);put(path.join(dir,'response/data/cases.json'),sheet);
 await accept(f,request,actual(request,{fields:{'uat-plan':'response/response.md','uat-case-sheet':'response/data/cases.json',units:'response/data/units.json'},fallbacks:[],commits:[],next:['uat.verify']},'done',['response/response.md','response/data/cases.json']));
 const {acceptedProducerProof}=await f.load('scripts/producer-import.mjs');
 const proof=await acceptedProducerProof(f.root,f.state().id,step,1,'uat-plan',{hostRoot:f.source});
 return{step,ref:ref(step),casesRef:`step-${step}/parallel-1/response/data/cases.json`,unitsRef:`step-${step}/parallel-1/response/data/units.json`,request,proof,sheet,units};
}

// The caller supplies actual admitted FE predecessors and a measurement-based UX judge. This
// fixture never manufactures them; opening refuses absent or unaccepted prerequisites before
// the browser runs. A judge receives only records from the real runner, not a passing template.
export async function acceptBrowserVerification(f,{plan,audit,quality,route,runtime,feWorktree,beHead},
 {step,goal,browserHostRoot,coordination=null,criteria=null,walksFor,judgeExperience}={}){
 assert.equal(typeof walksFor,'function');assert.equal(typeof judgeExperience,'function');
 const state=f.state(),feHead=git(feWorktree,'rev-parse','HEAD'),feature=plan.request.requirements.feature,flow=plan.sheet.flows[0].flowId,env='dev';
 const stamp=new Date().toISOString().replace(/[-:]/g,'').replace('T','-').slice(0,15),runId=`${stamp}-${feHead.slice(0,7)}`;
 const flowRef=`.worktrees/uat/${feature}/${flow}`,flowRoot=path.join(f.worktree,flowRef),namespace=`uat-${runId}`,modes={access:'anonymous',fixtures:'none',sourceRoles:'full'};
 const lease=`uat-lease://${state.id}/${flow}/${runId}`;
 const contexts=[{alias:'@workspaces/fe',head:feHead},{alias:'@workspaces/be',head:beHead},{alias:`@worktrees/uat/${feature}/${flow}`,head:null},{alias:'@worktrees/_templates',head:null},{alias:'@workspaces/device-state',head:null},{alias:'@worktrees/sessions/central-runtime',head:null},{alias:'@knowledge/ui/proof',head:null}];
 const inputs={'frontend-surface-audit':audit.ref,'quality-verification':quality.ref,route:route.ref,'uat-plan':plan.ref,'uat-case-sheet':plan.casesRef};
 planCells(f,[[step,'uat.verify']]);
 const request=current(f,{operatorId:'uat.verify',contexts,requirements:{approval:null,feature,flow,env,cases:plan.sheet.cases.map(c=>c.caseId),runId,lease,resume:null,...modes},inputs},step,{goal,coordination,criteria});
 request.environment.workspace={alias:'@workspaces/fe',worktree:feWorktree,revision:feHead};request.environment.writes=[`@worktrees/uat/${feature}/${flow}`];request.environment.exclusive=[flowRoot];
 const dir=await open(f,request),responseDir=path.join(dir,'response');
 const {upstreamAuditScope}=await f.load('scripts/audit-scope.mjs'),scope=upstreamAuditScope(dir,request,f.root);
 const before=new Date().toISOString(),provenance={fe:feHead,be:beHead};
 const cases=plan.sheet.cases.filter(c=>c.flowId===flow).map(c=>({caseId:c.caseId,order:c.order,as:c.actor,assertions:c.assertions}));
 const snapshot={...modes,provenance,runId,approval:null,feature,flow,env,commit:feHead,frozenAt:before,flowRoot,snapshotRef:`${flowRef}/snapshot.json`,snapshotFingerprint:sha(JSON.stringify({plan:plan.proof.manifestFingerprint,cases,provenance})),lease:{leaseRef:lease,exclusive:true,expiresAt:new Date(Date.now()+300000).toISOString()},admission:[{kind:'frontend-surface-audit',ref:audit.ref,commit:feHead,role:'fe'},{kind:'quality-verification',ref:quality.ref,commit:feHead,role:'fe'}],accounts:[],flowSource:'planned',golden:{state:'candidate',ref:`${flowRef}/snapshots/${runId}.json`,approvedBy:null,env},fixtureNamespace:namespace,seed:null,isolation:{sessionId:state.id,browserProfileRef:`step-${step}/parallel-1/browser/${runId}`,servedHead:runtime.head,servedContainsCommit:true,ancestryEvidenceRef:'response/data/ancestry.json',seededIds:[],rollbackIds:[]},cases,...(scope?{auditScope:scope}:{})};
 const ancestry=git(feWorktree,'merge-base','--is-ancestor',feHead,runtime.head);assert.equal(ancestry,'');
 put(path.join(dir,'response/data/ancestry.json'),{head:runtime.head,commit:feHead,ancestor:true,observedAt:before});
 put(path.join(dir,'response/data/snapshot.json'),snapshot);put(path.join(flowRoot,'snapshot.json'),snapshot);
 const snapshotBytes=readFileSync(path.join(dir,'response/data/snapshot.json'));
 const {runWalk}=await f.load('scripts/browser-walk.mjs');
 const records=[];
 for(const walk of await walksFor({runId,flow,route:runtime.endpoint,cases,root:f.root,hostRoot:browserHostRoot})){
  assert.equal(walk.account,null);assert.equal(walk.run.runId,runId);
  // Runner input is a response artifact, not a late addition to the already-frozen request.
  const staging=path.join(dir,'response/artifacts',`walk-${walk.id}.json`);put(staging,walk);
  const result=await runWalk(staging,responseDir,{root:f.root,hostRoot:browserHostRoot});
  assert.equal(result.code,0,result.errors.join('; '));
  const base=`response/data/walks/${walk.id}`;
  const ran=JSON.parse(readFileSync(path.join(dir,base,'walk-result.json')));
  records.push({walk,result:ran,ledger:JSON.parse(readFileSync(path.join(dir,ran.ledgerRef))),walkRef:`${base}/walk.json`,resultRef:`${base}/walk-result.json`,
   captures:ran.captures.map(c=>({capture:c,measurements:JSON.parse(readFileSync(path.join(dir,c.measurementsRef))),ax:readFileSync(path.join(dir,c.axRef),'utf8'),dom:JSON.parse(readFileSync(path.join(dir,c.domRef)))}))});
 }
 assert.ok(records.length,'an actual browser run is required');
 assert.deepEqual(readFileSync(path.join(dir,'response/data/snapshot.json')),snapshotBytes,'the pre-action snapshot remains unchanged');
 const experience=await judgeExperience(records,{snapshot,plan});
 const {uxVerdict}=await f.load('operators/uat-verify/validate.mjs');
 assert.equal(experience.entries.length,11);assert.deepEqual({mean:experience.mean,verdict:experience.verdict},uxVerdict(experience.entries));assert.equal(experience.verdict,'ship','unproven or failed UX cannot become accepted UAT');
 const lanes=['behavior','ux','ui'].map(lane=>({lane,verdict:'pass',evidenceRefs:records.map(record=>record.resultRef),statement:`The ${lane} conclusion follows the actual browser assertions and measured experience record.`}));
 const verdicts={...modes,provenance,runId,commit:feHead,resultRef:`${flowRef}/runs/${runId}/result.json`,latestRef:`${flowRef}/latest.json`,historyRef:`${flowRef}/history.md`,lanes,experience,cleanup:{performed:false,owner:null,seedReceiptRef:null,isUat:true,namespace,runRecordsDeleted:false}};
 const runFile=path.join(flowRoot,'runs',runId,'result.json');assert.equal(existsSync(runFile),false);put(runFile,verdicts);put(path.join(flowRoot,'latest.json'),{runId});appendFileSync(path.join(flowRoot,'history.md'),`- ${runId} — actual browser verification passed\n`);
 put(path.join(dir,'response/data/verdicts.json'),verdicts);
 const screenshots=cases.map(c=>`response/artifacts/${c.caseId}.png`),captureRefs=cases.map(c=>`response/data/captures/${c.caseId}.json`);
 // A one-case run's sheet is the original capture, with no synthetic replacement image.
 assert.equal(screenshots.length,1,'multi-case fixture must stitch its real captures explicitly');copyFileSync(path.join(dir,screenshots[0]),path.join(dir,'response/artifacts/sheet.png'));
 if(scope)put(path.join(dir,'response/data/audit-scope.json'),scope);
 const receipt='# uat-flow-verification — '+feature+'/'+flow+'\n'+table('Admission',['Kind','Ref','Commit'],snapshot.admission.map(a=>[q(a.kind),q(a.ref),q(a.commit)]))+table('Snapshot',['Field','Value'],[['Run',q(runId)],['Approval','—'],['Feature',q(feature)],['Flow',q(flow)],['Commit',q(feHead)],['Frontend commit',feHead],['Backend commit',beHead],['Snapshot',q(snapshot.snapshotRef)],['Namespace',q(namespace)],['Accounts','—'],['Environment',env],['Credential','—'],['Flow source','planned'],['Golden','candidate, awaiting promotion'],['Run record',q(verdicts.resultRef)],['Latest',q(runId)]])+table('Cases',['Case','Order','Assertions','Capture','Screenshot','Outcome'],cases.map(c=>[q(c.caseId),c.order,c.assertions.join(', '),q(`response/data/captures/${c.caseId}.json`),q(`response/artifacts/${c.caseId}.png`),'pass']))+table('Lanes',['Lane','Verdict','Evidence'],lanes.map(l=>[q(l.lane),l.verdict,q(l.evidenceRefs[0])]))+table('Experience',['Rule','Measured','Score','Verdict'],experience.entries.map(r=>[q(r.rule),r.measured,r.score,r.verdict]))+`\n- Mean: ${experience.mean.toFixed(2)}\n- Verdict: ${experience.verdict}\n`+table('Verdict',['Topic','Verdict','Route'],[[q('experience'),experience.verdict,experience.routeTo]])+table('Printed',['Artifact','Why'],[[q('response/artifacts/sheet.png'),'The original actual browser capture for this single case.']])+table('Findings',['Code','Statement'])+table('Fallbacks taken',['Code','Action'])+table('Audit scope',['Field','Value'],[['Mode',scope?.mode??'not-recorded'],['Coverage claim',scope?.coverageClaim??'not-recorded'],['Deferred states',scope?.deferredStates.join(', ')||'—']]);
 put(path.join(dir,'response/response.md'),receipt);
 const fields={'uat-flow-verification':'response/response.md','uat-snapshot':'response/data/snapshot.json','uat-verdicts':'response/data/verdicts.json','uat-capture':captureRefs,screenshot:screenshots,sheet:'response/artifacts/sheet.png','uat-walk':records.map(r=>r.walkRef),'walk-result':records.map(r=>r.resultRef),...(scope?{'audit-scope':'response/data/audit-scope.json'}:{})};
 await accept(f,request,actual(request,{fields,fallbacks:[],commits:[],next:['git.publish','user','workflow.verify']},'done',['response/response.md',...records.map(r=>r.resultRef)]));
 const {acceptedProducerProof}=await f.load('scripts/producer-import.mjs');
 const proof=await acceptedProducerProof(f.root,state.id,step,1,'uat-flow-verification',{hostRoot:f.source});
 return{step,head:feHead,request,proof,snapshot,verdicts,records,ref:ref(step)};
}

export function transformWalksFor({runId,flow,route,cases}){
 const field={role:'textbox',name:'Input',exact:true},button={role:'button',name:'Transform',exact:true},status={role:'status',name:'Result',exact:true};
 return[{schemaVersion:9,id:'transform-result',flow,account:null,entry:{route,viewport:{width:390,height:844,deviceScaleFactor:1},colorScheme:'light',reducedMotion:'reduce',locale:'en'},run:{runId,cases:cases.map(c=>({caseId:c.caseId,order:c.order}))},steps:[
  {id:'entry',action:'goto',target:null,value:route},
  {id:'wrong-input',action:'fill',target:field,value:'wrong'},
  {id:'wrong-submit',action:'click',target:button},
  {id:'wrong-result',action:'expect',target:status,expect:{text:'WRONG'}},
  {id:'correct-input',action:'fill',target:field,value:'hello'},
  {id:'correct-submit',action:'click',target:button},
  {id:'correct-feedback',action:'capture',target:null,capture:{name:'correct-feedback'}},
  {id:'correct-result',action:'expect',target:status,expect:{text:'HELLO'}},
  {id:'keyboard-tab',action:'press',target:field,value:'Tab'},
  {id:'keyboard-submit',action:'press',target:button,value:'Enter'},
  {id:'repeat-result',action:'expect',target:status,expect:{text:'HELLO'}},
  {id:'before-reload',action:'capture',target:null,capture:{name:'before-reload'}},
  {id:'reload',action:'click',target:{role:'link',name:'Reload',exact:true}},
  {id:'restored-result',action:'expect',target:status,expect:{text:'HELLO'},assertion:{caseId:cases[0].caseId,assertionId:'visible-result',lane:'behavior'}},
  {id:'final',action:'capture',target:null,capture:{name:cases[0].caseId}}
 ]}];
}

export function judgeTransformExperience(records){
 assert.equal(records.length,1);const record=records[0],byId=new Map(record.result.steps.map(s=>[s.id,s]));
 for(const step of record.walk.steps)assert.equal(byId.get(step.id)?.outcome,'pass',`actual ${step.id} must pass`);
 const first=record.captures.find(c=>c.capture.name==='before-reload'),last=record.captures.at(-1);
 const loadId=html=>/data-fixture-load="([^"]+)"/.exec(html)?.[1];
 assert.ok(loadId(first.dom.html)&&loadId(last.dom.html),'reload proof needs measured document identity');assert.notEqual(loadId(first.dom.html),loadId(last.dom.html),'the reload action must actually replace the document');
 assert.match(last.ax,/Input/);assert.match(last.ax,/Transform/);assert.match(last.ax,/HELLO/);
 assert.match(last.dom.url,/hello/,'the measured address must retain the entered state');
 const button=last.measurements.elements.find(e=>e.ref==='button "Transform"');
 assert.ok(button?.bbox,'the narrow capture must measure the actual primary control');
 const within=button.bbox.y>=last.measurements.viewport[1]/2&&button.bbox.y+button.bbox.height<=last.measurements.viewport[1];
 const feedback=record.captures.find(c=>c.capture.name==='correct-feedback');
 assert.match(feedback.ax,/Transforming|HELLO/,'the actual immediate frame must show pending feedback or the completed result');
 const rawTiming=/data-fixture-feedback="([^"]+)"/.exec(feedback.dom.html)?.[1];
 assert.ok(rawTiming,'the actual feedback DOM must retain its own event and render-frame measurements');
 const times=new Map(record.ledger?.steps.map(step=>[step.id,step]));
 assert.equal(times.size,record.result.steps.length,'actual timing ledger must cover exactly this walk');
 for(const step of record.result.steps){const {startedAt,observed,...projection}=times.get(step.id)??{};assert.deepEqual(projection,step,'timing ledger and result must describe the same executed steps');}
 const timing=JSON.parse(decodeURIComponent(rawTiming)),submit=times.get('correct-submit'),capture=times.get('correct-feedback');
 assert.equal(timing.version,1);assert.equal(timing.sequence,2,'feedback must belong to the second actual submission');
 assert.equal(timing.documentTimeOrigin,Number(loadId(feedback.dom.html)),'timing belongs to the captured document');
 assert.equal(timing.target,'transform-form/button');assert.equal(timing.input,'hello');assert.equal(timing.activation?.input,'hello');
 assert.equal(timing.activation?.trusted,true);assert.equal(timing.activation?.type,'click');
 const ordered=[timing.activation?.at,timing.activation?.receivedAt,timing.handlerAt,timing.stateChangedAt,timing.beforePaint?.at,timing.afterPaint?.at];
 assert.ok(ordered.every(Number.isFinite)&&ordered.every((value,index)=>index===0||value>=ordered[index-1]),'event, handler, state and render observations need finite ordered times');
 assert.ok(Number.isFinite(timing.documentTimeOrigin)&&Number.isFinite(Date.parse(submit.startedAt))&&Number.isFinite(Date.parse(capture.startedAt)),'timing must bind actual runner timestamps');
 const eventAt=timing.documentTimeOrigin+timing.activation.at;
 assert.ok(eventAt>=Date.parse(submit.startedAt)-1&&eventAt<=Date.parse(submit.startedAt)+submit.ms+1,'activation must fall inside this actual correct-submit');
 assert.ok(timing.documentTimeOrigin+timing.afterPaint.at<=Date.parse(capture.startedAt)+capture.ms+1,'render measurement cannot postdate its DOM capture');
 assert.deepEqual(timing.changedState,{state:'pending',text:'Transforming…'},'the same handler must actually change the visible feedback state');
 for(const frame of [timing.beforePaint,timing.afterPaint]){
  assert.equal(frame.visible,true,'feedback must be visibly rendered across the measured paint interval');
  assert.ok(Number.isFinite(frame.frameTimestamp),'raw browser frame time is required');
  assert.ok(frame.state==='pending'&&frame.text==='Transforming…'||frame.state==='settled'&&frame.text==='HELLO','the measured frame must show this submission pending or completed');
 }
 assert.ok(timing.afterPaint.frameTimestamp>timing.beforePaint.frameTimestamp,'observations must bracket distinct rendering frames');
 const latency=timing.afterPaint.at-timing.activation.at;
 assert.ok(latency<=100,`actual activation-to-visible-feedback render upper bound is ${latency}ms`);
 const activated=record.result.steps.filter(s=>['goto','click','press'].includes(s.action)).length;assert.ok(activated<=16);
 const facts=[
  `restored-result reached HELLO through the displayed controls; ${record.result.steps.length} runner steps passed`,
  `${activated} committed navigation/submission/keyboard actions were measured against the declared budget of 16`,
  'wrong-result showed WRONG; correcting Input and pressing Transform reached HELLO without restarting',
  `trusted correct-submit to visible feedback across measured rendering frames took at most ${latency.toFixed(2)}ms; raw event, handler, state and frame times are retained in correct-feedback DOM`,
  'entry exposed the labelled Input and Transform control on the sole task surface, without intermediate navigation',
  'the same editable Input and operable Transform control remained after wrong-result and terminal success; repeat-result passed',
  `document identity changed from ${loadId(first.dom.html)} to ${loadId(last.dom.html)} while the address and visible result retained hello/HELLO`,
  'the persistent Input label is present in the final accessibility record; keyboard-tab and keyboard-submit completed successfully',
  `narrow primary bounds y=${button.bbox.y}, height=${button.bbox.height}, viewport=${last.measurements.viewport[1]}; ${within?'inside':'outside'} the lower-half reach zone`,
  'wrong-submit, correct-submit and keyboard-submit all used the same Transform control and returned the same result for repeated hello',
  'the captured Input label names the value and Transform names its effect; HELLO is the actual text result, with no unit omitted'
 ];
 const entries=facts.map((measured,i)=>({rule:`UX-${i+1}`,measured,score:i===8&&!within?3:4,verdict:i===8&&!within?'fail':'pass',routeTo:i===8&&!within?'direction':'none'}));
 const mean=entries.reduce((n,r)=>n+r.score,0)/entries.length;
 return{entries,mean,verdict:mean>=4?'ship':'fix-first',routeTo:mean>=4?'none':'direction'};
}

