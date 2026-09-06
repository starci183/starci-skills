import test from 'node:test';
import http from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,cp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const runtimeSource=path.resolve(import.meta.dirname,'..');
const sha=x=>'sha256:'+createHash('sha256').update(x).digest('hex');
const table=(title,columns,rows)=>`\n## ${title}\n\n| ${columns.join(' | ')} |\n| ${columns.map(()=> '---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n`;
const quote=x=>'`'+x+'`';
const put=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,typeof data==='string'?data:JSON.stringify(data));};

test('public route partition preserves the original two-route goal and closes only after both real runtime attestations',async t=>{
 const host=await mkdtemp(path.join(os.tmpdir(),'starci-noop-host-')),root=path.join(host,'.claude');
 t.after(()=>rm(host,{recursive:true,force:true}));
 const payload=JSON.parse(await readFile(path.join(runtimeSource,'package.json')));
 for(const file of ['package.json',...payload.files])await cp(path.join(runtimeSource,file),path.join(root,file),{recursive:true});
 const moduleAt=relative=>import(pathToFileURL(path.join(root,relative)).href);
 const [{openSession,confirmSession,cleanupFixtureOwners},{openAttempt,acceptAttempt},{previewRevision,commitRevision,editForecast,planAdmissionErrors},{expectedCheckIds,authorizationClasses},{loadEnvironmentSchema,stackDeclaration},{playwrightInstallOf},{NOOP_CHECKS,runtimeLadderErrors},{loadOperatorGraph,repairShapeErrors},{captureRuntimeObservation,runtimeNoopProofErrors}]=await Promise.all([
  moduleAt('scripts/v23-test-fixture.mjs'),moduleAt('scripts/attempt-gate.mjs'),moduleAt('scripts/plan-history.mjs'),moduleAt('operators/environment-preflight/validate.mjs'),moduleAt('scripts/validate-request.mjs'),moduleAt('scripts/browser-walk.mjs'),moduleAt('operators/runtime-serve/validate.mjs'),moduleAt('scripts/validate-chain.mjs'),moduleAt('scripts/runtime-observation.mjs')]);
 const owner=await mkdtemp(path.join(os.tmpdir(),'starci-repair-')),env='repair-'+path.basename(owner).toLowerCase().replace(/[^a-z0-9-]/g,'');
 const stack=path.join(host,'.stacks',env);await put(path.join(stack,'environment.json'),{schemaVersion:9,env,production:false});
 const install=playwrightInstallOf(host,root);let madeInstall=false;
 try{await readFile(install.module);}catch{madeInstall=true;await put(install.module,{name:'playwright',version:'0.0.0-synthetic'});await mkdir(path.join(install.browsers,'chromium-0000'),{recursive:true});}
 t.after(async()=>{cleanupFixtureOwners(owner);await rm(owner,{recursive:true,force:true});await rm(stack,{recursive:true,force:true});if(madeInstall)await rm(install.root,{recursive:true,force:true});});
 const opened=await openSession(path.join(owner,'.worktrees/sessions'),{project:'repair',hostBinding:{kind:'codex-task',hostId:path.basename(owner),worktree:owner,sourcePromptRef:'user:opening'},mission:{language:'en',goal:'Verify readiness and attest the requested runtime.',target:'Declared route',includes:['Readiness and runtime attestation'],outputs:['Readiness','Runtime receipt'],doneWhen:[{producedBy:'environment.preflight',evidence:'All readiness walls are clear.'},{producedBy:'runtime.serve',evidence:'The final requested runtime is attested.'}],verification:'Validate both typed receipts.',sourceRef:'user:opening'}});
 const draftFile=path.join(opened.session,'state.json'),draft=JSON.parse(await readFile(draftFile));
 const feRepo={...draft.mission.discovery.repositories[0],role:'fe',routeRef:`.workspaces/local/routes/${draft.project}/fe/config.json`};
 draft.mission.discovery.repositories.push(feRepo);draft.mission.discovery.impacts.push({...draft.mission.discovery.impacts[0],id:'frontend-runtime',role:'fe'});draft.mission.discovery.destinations.push({role:'fe',kind:'artifact',target:'session evidence'});
 draft.mission.doneWhen[1].evidence='Both declared frontend and backend routes serve their exact requested commits.';
 await put(draftFile,draft);await put(path.join(host,feRepo.routeRef),{project:draft.project,role:'fe',source:{path:host},repository:{diskPath:owner,gitRepository:feRepo.repository}});
 await confirmSession(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved'});
 const session=opened.session,file=path.join(session,'state.json'),read=async()=>JSON.parse(await readFile(file));let state=await read();
 const repo=state.mission.discovery.repositories[0],routeKey=state.project+'/be',decl=await stackDeclaration(root,env,host);
 const requirements={routeKey,env,operation:'serve',commit:repo.head,approval:decl.reference,portClaims:[],desiredState:{planSha256:sha('approved synthetic attestation declaration'),serviceKind:'runtime',resourceRefs:[routeKey],effects:['attest-runtime-entry'],mutableResourceRefs:[routeKey],observationOnlyResourceRefs:[]}};
 const initialFlags={requirements:{'environment.preflight':{project:state.project,roles:['be'],runtimeRoles:['be'],env,flow:null},'runtime.serve':requirements}};
 const initial=await previewRevision(root,session,initialFlags);await commitRevision(root,session,{previewHash:initial.previewHash,flags:initialFlags,reason:'The complete current forecast was reviewed.'});state=await read();
 const initialRuntime=Object.keys(initial.forecast.steps).find(cell=>initial.forecast.steps[cell]==='runtime.serve'),runtimeNode=initial.forecast.nodes[initialRuntime];
 async function requestFor(cell,over={}){const [step,parallel]=cell.split('/').map(Number),forecast=over.forecast??initial.forecast,operatorId=forecast.steps[cell];return {contractVersion:'starci/v2.2',schemaVersion:9,operatorId,sessionId:state.id,step,parallel,contexts:[],requirements:forecast.presets[cell]??{},inputs:{},resume:null,goal:forecast.goals[cell],attempt:{id:`${cell}:a1`,number:1,kind:'initial',previous:null},expected:{version:1,goalVersion:state.mission.version,sourceRef:`state.json#mission:v${state.mission.version}/${forecast.goals[cell].doneWhen!==undefined?'doneWhen:'+forecast.goals[cell].doneWhen:'prerequisite:'+forecast.goals[cell].prerequisite}`,criteria:[{id:'ready',required:true,expected:'The exact requested outcome is proved.',verification:'Validate all typed evidence.'}]},environment:{isolationId:`${cell}:a1`,mode:'inline',workspace:null,reads:[],writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]};}
 const first=await requestFor('1/1'),branch=path.join(session,'step-1/parallel-1');await put(path.join(branch,'request/request.json'),first);await openAttempt(branch);
 const schema=JSON.parse(await readFile(path.join(root,'templates/kinds/readiness-report.schema.json'))),classes=authorizationClasses(await loadEnvironmentSchema(root));
 function report(wall){const checks=expectedCheckIds(schema,['be'],classes,[]).map(id=>({id,family:id.split('.')[0],status:id===wall?'wall':id.startsWith('identity.flow.')?'skipped':'ok',evidence:id.startsWith('approval.')?decl.authorization[id.slice(9)]+', read from declaration':id===wall?'Registry does not attest the frozen checkout head.':'Synthetic observation for the regression.',owner:id===wall?'runtime':null}));return{project:state.project,roles:['be'],env,flow:null,declarationRef:decl.reference,checks,walls:wall?[{checkId:wall,owner:'runtime',repair:'Attest the existing served head under its runtime owner.'}]:[],generatedAt:new Date().toISOString()};}
 function receipt(r){return '# environment-readiness — '+state.project+'\n'+table('Binding',['Field','Value'],[['Project',state.project],['Roles','be'],['Environment',env],['Flow','—'],['Declaration',decl.reference]])+table('Checks',['Check','Family','Status','Evidence'],r.checks.map(c=>[quote(c.id),c.family,c.status,c.evidence]))+table('Walls',['Wall','Owner','Repair'],r.walls.map(w=>[quote(w.checkId),w.owner,w.repair]))+table('Fallbacks taken',['Code','Action'],[]);}
 function responseFor(request,fields,blocked=false){const evidence=Object.values(fields),profile=request.operatorId==='runtime.serve'?'sol-fresh':'sol-reviewer';return{contractVersion:'starci/v2.2',schemaVersion:9,operatorId:request.operatorId,step:request.step,parallel:request.parallel,status:blocked?'blocked':'done',...(blocked?{stop:'ENVIRONMENT_NOT_READY',reason:'runtime.be.head needs attestation.'}:{}),fields,fallbacks:[],commits:[],next:blocked?['runtime.serve']:[],boundProfile:profile,ranProfile:profile,attempt:{id:request.attempt.id,number:request.attempt.number,expectedVersion:request.expected.version},actual:{expectedVersion:request.expected.version,observedAt:new Date().toISOString(),observations:[{criterionId:'ready',observed:blocked?'The complete report retains the runtime wall.':'All requested checks pass.',evidence}]},comparison:{expectedVersion:request.expected.version,verdict:blocked?'inconclusive':'matched',criteria:[{criterionId:'ready',verdict:blocked?'inconclusive':'matched',evidence,note:blocked?'A required wall remains.':'All typed checks pass.'}],next:blocked?'blocked':'advance'},...(!blocked?{goalCheck:{achieved:true,evidence},outcome:{summary:'The requested evidence is available.',primary:{kind:'document',label:'Receipt',ref:'response/response.md'}}}:{})};}
 async function readiness(request,dir,wall){const r=report(wall);await put(path.join(dir,'response/data/readiness-report.json'),r);await put(path.join(dir,'response/response.md'),receipt(r));await put(path.join(dir,'response/response.json'),responseFor(request,{'environment-readiness':'response/response.md','readiness-report':'response/data/readiness-report.json'},Boolean(wall)));}
 await readiness(first,branch,'runtime.be.head');assert.equal((await acceptAttempt(branch)).state,'blocked');state=await read();
 const frozen=await readFile(path.join(branch,'request/request.json'));
 const flags={edit:{kind:'repair',cell:'1/1',wall:'runtime.be.head',requirements}};
 for(const alter of [s=>{s.attempts['1/1'].status='running';},s=>{delete s.attempts['1/1'].context;},s=>{delete s.attempts['1/1'].evidenceManifest;},s=>{s.attempts['1/1'].expected.goalVersion+=1;}]){const forged=structuredClone(state);alter(forged);await assert.rejects(editForecast(root,session,forged,initial.forecast,flags.edit,0),/sealed|manifest|receipt/);}
 for(const bad of [{wall:'runtime.be.port'},{requirements:{...requirements,routeKey:'repair/fe'}},{requirements:{...requirements,commit:'f'.repeat(40)}},{requirements:{...requirements,desiredState:{...requirements.desiredState,effects:['restart-runtime-server']}}},{requirements:{...requirements,approval:'.stacks/'+env+'/environment.json#sha256:'+'0'.repeat(64)}}])await assert.rejects(editForecast(root,session,state,initial.forecast,{...flags.edit,...bad},0),/REPAIR|AUTHORITY_DRIFT/);
 const next=await previewRevision(root,session,flags);await commitRevision(root,session,{previewHash:next.previewHash,flags,reason:'Repair only the accepted runtime head wall before rechecking all prerequisites.'});state=await read();
 const forecast=next.forecast,repairCell=Object.keys(forecast.repairs)[0],resumeCell=forecast.repairs[repairCell].resume;
 const graph=await loadOperatorGraph(root);assert.deepEqual(repairShapeErrors(graph,forecast,repairCell),[]);
 for(const alter of [f=>{f.repairs[repairCell].source=resumeCell;},f=>{f.repairs[repairCell].role='foreign';},f=>{f.goals[repairCell]={doneWhen:1};}]){const forged=structuredClone(forecast);alter(forged);assert.ok(repairShapeErrors(graph,forged,repairCell).length);}
 assert.equal(repairCell,'2/1');assert.equal(resumeCell,'3/1');assert.equal(forecast.nodes['1/1'],initial.forecast.nodes['1/1']);assert.ok(Object.values(forecast.nodes).includes(runtimeNode));assert.equal(Object.values(forecast.steps).filter(op=>op==='runtime.serve').length,2);assert.deepEqual(await readFile(path.join(branch,'request/request.json')),frozen);
 const runtime=await requestFor(repairCell,{forecast}),runtimeDir=path.join(session,'step-2/parallel-1');
 assert.deepEqual(await planAdmissionErrors(root,session,state,runtime),[]);
 const resume=await requestFor(resumeCell,{forecast});resume.resume={step:1,parallel:1,token:'runtime-head-repaired'};resume.attempt={id:'3/1:a2',number:2,kind:'retry',previous:first.attempt.id};resume.environment.isolationId=resume.attempt.id;
 assert.match((await planAdmissionErrors(root,session,state,resume)).join(),/sealed matched/);
 await put(path.join(runtimeDir,'request/request.json'),runtime);assert.equal((await openAttempt(runtimeDir)).state,'opened');
 // The owning operator must produce its ordinary complete runtime receipt before this resume can open.
 await put(path.join(session,'step-3/parallel-1/request/request.json'),resume);await assert.rejects(openAttempt(path.join(session,'step-3/parallel-1')),/sealed matched/);
 assert.equal((await read()).attempts['3/1'],undefined);
 assert.equal((await read()).requestHashes['3/1'],undefined);
 const head=requirements.commit,fp=sha('inventory'),effects=requirements.desiredState.effects,ownerRef='runtime-owner';
 const checkNames=NOOP_CHECKS;
 const list=checkNames.map(name=>({name,resourceRef:routeKey,status:'passed',evidenceRef:'probes/'+name+'.json'}));
 const findings=[{code:'RUNTIME_HEAD_REUSED',resourceRef:routeKey,port:null,holderRef:null,statement:'The current process already contains the wanted commit and answers its endpoint.'}];
 const delta={serviceRef:routeKey,serviceKind:'runtime',ownerRef,approvalRef:decl.reference,planSha256:requirements.desiredState.planSha256,inventoryFingerprint:fp,generation:2,observedAt:new Date().toISOString(),inventoriedResources:[{resourceRef:routeKey,kind:'runtime',revision:'g-1',ownerRef}],observedPortHolders:[],portClaims:[],mutableResourceRefs:[routeKey],observationOnlyResourceRefs:[],allowedEffects:effects,appliedEffects:[],capabilities:[{capability:'runtime:registry-write',custodyEvidenceRef:'custody/runtime.json'}],convergence:'already-converged',mutations:[],runtimeLadder:{routeKey,operation:'serve',rung:'serve',reused:true,sessionId:state.id,wantedCommit:head,servedHead:head,contains:[head],integration:null,infra:null,locations:[],observed:{head,containsWanted:true,pid:4200,pidAlive:true,probeAnswered:true,leaseSessionId:null,queue:[]},server:{pid:4200,previousPid:4200,port:8099,command:'node service.mjs',logRef:'logs/runtime.log',pidFileRef:'logs/runtime.pid',startedAt:'2026-01-01T00:00:00Z',cache:{cleared:false,reason:'unchanged',directories:[],previousHead:head}},queuePosition:null,lease:null}};
 const server=http.createServer((req,res)=>{if(req.headers['x-apollo-operation-name']!=='StarCiRuntimeObservation'){res.writeHead(400);res.end('operation header required');return;}res.writeHead(200,{'content-type':'text/plain'});res.end('healthy');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 assert.equal((await fetch('http://127.0.0.1:'+server.address().port)).status,400);
 const url='http://127.0.0.1:'+server.address().port,registryPath=path.join(host,'.worktrees/sessions/central-runtime/owner.json');let priorRegistry;try{priorRegistry=await readFile(registryPath);}catch{}
 t.after(async()=>{if(priorRegistry)await writeFile(registryPath,priorRegistry);else await rm(registryPath,{force:true});});
 const registry={schemaVersion:9,ownerTaskId:'runtime-owner',generation:2,updatedAt:new Date().toISOString(),runtimes:{[routeKey]:{endpoints:{frontend:url,api:url,identity:url},branch:'uat',head,contains:[head],generation:2,status:'ready',healthEvidenceRefs:['prior-proof'],identity:null,server:{worktree:owner,pid:process.pid,listenerPid:process.pid,port:server.address().port,command:'node test-runtime',logRef:'runtime.log',pidFileRef:'runtime.pid',startedAt:'2026-01-01T00:00:00Z'},lease:null}}};
 await put(registryPath,registry);const registryBytes=await readFile(registryPath);delta.inventoryFingerprint=sha(registryBytes);delta.runtimeLadder.server.pid=process.pid;delta.runtimeLadder.server.previousPid=process.pid;delta.runtimeLadder.observed.pid=process.pid;delta.runtimeLadder.server.port=server.address().port;
 const unrelatedLease=path.join(path.dirname(registryPath),'other-project-be.lease.json');await put(unrelatedLease,{sessionId:'independent-owner'});t.after(()=>rm(unrelatedLease,{force:true}));
 const targetLease=path.join(path.dirname(registryPath),routeKey.replace('/','-')+'.lease.json');await put(targetLease,{sessionId:'other-owner'});
 await assert.rejects(captureRuntimeObservation({root,hostRoot:host,branch:runtimeDir,label:'leased',urls:[url]}),/NOOP_RUNTIME_BUSY/);await rm(targetLease);
 for(const prefix of ['runtime-','identity-']){const lease=path.join(path.dirname(registryPath),prefix+routeKey.replace('/','-')+'.lease.json');await put(lease,{sessionId:'other-owner'});await assert.rejects(captureRuntimeObservation({root,hostRoot:host,branch:runtimeDir,label:'prefixed-lease',urls:[url]}),/NOOP_RUNTIME_BUSY/);await rm(lease);}
 const cli=await promisify(execFile)(process.execPath,[path.join(root,'scripts/runtime-observation.mjs'),runtimeDir,'before',url],{timeout:30000});const before=JSON.parse(cli.stdout);const after=await captureRuntimeObservation({root,hostRoot:host,branch:runtimeDir,label:'after',urls:[url]});delta.noOpProof={before,after};
 const proofResponse=responseFor(runtime,{}),proofArgs={root,hostRoot:host,branch:runtimeDir,request:runtime,response:proofResponse,delta};
 assert.deepEqual(await runtimeNoopProofErrors(proofArgs),[],'an unrelated route lease does not serialize read-only observation');
 for(const observedAt of [undefined,'invalid'])assert.match((await runtimeNoopProofErrors({...proofArgs,response:{actual:{observedAt}}})).join(),/finite invocation/);
 const stateFile=path.join(session,'state.json'),stateBytes=await readFile(stateFile),openedState=JSON.parse(stateBytes);
 for(const startedAt of [undefined,'invalid']){const changed=structuredClone(openedState);changed.attempts[repairCell].startedAt=startedAt;await put(stateFile,changed);assert.match((await runtimeNoopProofErrors(proofArgs)).join(),/finite invocation/);}await writeFile(stateFile,stateBytes);
 const observationFile=path.join(runtimeDir,before.ref),observationBytes=await readFile(observationFile);
 for(const change of [o=>{delete o.probes[0].headers;},o=>{o.probes[0].headers['x-foreign']='arbitrary';},o=>{delete o.source;},o=>{o.source.ancestor=false;},o=>{o.source.head='f'.repeat(40);},o=>{delete o.listener;},o=>{o.listener.pid+=1;},o=>{o.observedAt='invalid';},o=>{o.observedAt='2020-01-01T00:00:00Z';},o=>{o.probes[0].endedAt='invalid';},o=>{o.probes[0].status=503;},o=>{o.activeLeaseFiles=['foreign'];}]){const altered=JSON.parse(observationBytes);change(altered);const bytes=JSON.stringify(altered);await writeFile(observationFile,bytes);const changed=structuredClone(delta);changed.noOpProof.before.sha256=sha(bytes);assert.ok((await runtimeNoopProofErrors({...proofArgs,delta:changed})).length);}await writeFile(observationFile,observationBytes);
 await put(targetLease,{sessionId:'other-owner'});assert.match((await runtimeNoopProofErrors(proofArgs)).join(),/lease changed/);await rm(targetLease);
 const forgedRegistry=structuredClone(registry);forgedRegistry.runtimes[routeKey].server.listenerPid+=1;await put(registryPath,forgedRegistry);await assert.rejects(captureRuntimeObservation({root,hostRoot:host,branch:runtimeDir,label:'wrong-listener',urls:[url]}),/NOOP_PROCESS_UNAVAILABLE|NOOP_SOCKET_UNBOUND/);await writeFile(registryPath,registryBytes);
 for(const change of [r=>{r.runtimes[routeKey].head='f'.repeat(40);},r=>{delete r.runtimes[routeKey].server.worktree;}]){const altered=structuredClone(registry);change(altered);await put(registryPath,altered);await assert.rejects(captureRuntimeObservation({root,hostRoot:host,branch:runtimeDir,label:'wrong-source',urls:[url]}),/NOOP_SOURCE_UNBOUND/);}await writeFile(registryPath,registryBytes);
 assert.ok(runtimeLadderErrors(delta.runtimeLadder,{requirements:runtime.requirements,sessionId:state.id,applied:new Set(),findings:new Set(findings.map(f=>f.code)),readOnlyNoop:false}).length,'ordinary attestation still requires its applied effect');
 for(const change of [l=>{l.reused=false;},l=>{l.observed.leaseSessionId='foreign';}]){const changed=structuredClone(delta.runtimeLadder);change(changed);assert.ok(runtimeLadderErrors(changed,{requirements,sessionId:state.id,applied:new Set(),findings:new Set(findings.map(f=>f.code)),readOnlyNoop:true}).length);}
 assert.ok(runtimeLadderErrors(delta.runtimeLadder,{requirements,sessionId:state.id,applied:new Set(['attest-runtime-entry']),findings:new Set(findings.map(f=>f.code)),readOnlyNoop:true}).length,'a read-only no-op cannot claim an applied mutation');
 const runtimeText='# platform-operation-receipt — runtime '+routeKey+'\n'+table('Binding',['Field','Value'],[['Operator',quote('runtime.serve')],['Step',quote('step-2/parallel-1')],['Project',quote(state.project)],['Service',routeKey],['Service kind','runtime'],['Owner',quote(ownerRef)],['Approval',decl.reference],['Desired state',quote(requirements.desiredState.planSha256)],['Inventory fingerprint',quote(delta.inventoryFingerprint)]])+table('Convergence',['Field','Value'],[['Convergence','already-converged']])+table('Inventoried resources',['Resource','Kind','Revision','Owner'],[[quote(routeKey),'runtime','g-1',quote(ownerRef)]])+table('Port holders',['Port','Holder','Evidence'],[])+table('Mutations',['Effect','Resource','Before','After'],[])+table('Checks',['Check','Resource','Status','Evidence'],list.map(c=>[quote(c.name),quote(c.resourceRef),c.status,quote(c.evidenceRef)]))+table('Findings',['Code','Resource','Port','Holder','Statement'],findings.map(f=>[quote(f.code),quote(routeKey),'—','—',f.statement]));
 await put(path.join(runtimeDir,'response/response.md'),runtimeText);await put(path.join(runtimeDir,'response/data/delta.json'),delta);await put(path.join(runtimeDir,'response/data/checks.json'),{serviceRef:routeKey,serviceKind:'runtime',requiredCheckNames:checkNames,checks:list,findings});
 await put(path.join(runtimeDir,'response/response.json'),responseFor(runtime,{'platform-operation-receipt':'response/response.md',delta:'response/data/delta.json',checks:'response/data/checks.json'}));
 const frozenRuntime=await readFile(path.join(runtimeDir,'request/request.json'));
 assert.equal((await acceptAttempt(runtimeDir)).state,'matched');state=await read();
 assert.deepEqual(await readFile(path.join(runtimeDir,'request/request.json')),frozenRuntime);assert.deepEqual(await readFile(registryPath),registryBytes);
 const acceptedResponse=JSON.parse(await readFile(path.join(runtimeDir,'response/response.json')));
 assert.deepEqual(await runtimeNoopProofErrors({root,hostRoot:host,branch:runtimeDir,request:runtime,response:acceptedResponse,delta}),[]);
 for(const change of [d=>{d.generation+=1;},d=>{d.runtimeLadder.server.pid+=1;},d=>{d.noOpProof.after=d.noOpProof.before;},d=>{d.inventoryFingerprint=sha('different');}]){const changed=structuredClone(delta);change(changed);assert.ok((await runtimeNoopProofErrors({root,hostRoot:host,branch:runtimeDir,request:runtime,response:acceptedResponse,delta:changed})).length);}
 assert.deepEqual(await planAdmissionErrors(root,session,state,resume),[]);
 assert.equal((await openAttempt(path.join(session,'step-3/parallel-1'))).state,'opened');
 await readiness(resume,path.join(session,'step-3/parallel-1'),null);assert.equal((await acceptAttempt(path.join(session,'step-3/parallel-1'))).state,'matched');
 assert.deepEqual(await readFile(path.join(branch,'request/request.json')),frozen);
 const final=await read();assert.equal(final.attempts['1/1'].status,'blocked');assert.equal(final.attempts['2/1'].status,'matched');assert.equal(final.attempts['3/1'].status,'matched');
 assert.equal(Object.keys(final.attempts).length,3,'the final delivery runtime was neither opened nor credited');
 const {goalPartitionCoverage,forecastObligations,partitionAdmissionErrors}=await moduleAt('scripts/goal-partitions.mjs');
 const {goalLedger,provenErrors,v22SessionErrors}=await moduleAt('scripts/validate-session.mjs');
 const {readContext}=await moduleAt('scripts/mission-history.mjs');
 state=await read();const goalBytes=JSON.stringify(state.mission),oldContexts=JSON.stringify(Object.values(state.attempts).map(a=>a.context));
 const pendingRuntime=Object.keys(forecast.steps).find(cell=>forecast.steps[cell]==='runtime.serve'&&!state.attempts[cell]);
 const single=await previewRevision(root,session,{edit:{kind:'partition',cell:pendingRuntime,env,routes:[state.project+'/be']}});
 assert.equal(Object.values(single.forecast.obligations).find(set=>set.kind==='routes').members.length,1,'a goal-specific single route remains lawful in a multi-repository mission');
 const implicit=structuredClone(forecast);implicit.presets[pendingRuntime]={routeKey:state.project+'/be',env};
 assert.equal((await forecastObligations(root,session,state,implicit)).partitions[pendingRuntime].member,state.project+'/be','an existing sealed singleton selector needs no extra mapping');
 const unmapped=structuredClone(forecast);delete unmapped.presets[pendingRuntime];
 const [pendingStep,pendingParallel]=pendingRuntime.split('/').map(Number);
 assert.match((await partitionAdmissionErrors(root,session,state,{operatorId:'runtime.serve',step:pendingStep,parallel:pendingParallel,goal:{doneWhen:1}},unmapped)).join(),/GOAL_PARTITION_REQUIRED/);
 const partitionFlags={edit:{kind:'partition',cell:pendingRuntime,env,routes:[state.project+'/be',state.project+'/fe']}};
 const partitioned=await previewRevision(root,session,partitionFlags);
 assert.match(partitioned.preview,/partition: .*\/be/);assert.match(partitioned.preview,/partition: .*\/fe/);
 assert.equal(Object.keys(partitioned.forecast.partitions).length,2);
 await commitRevision(root,session,{flags:partitionFlags,previewHash:partitioned.previewHash,reason:'The original goal requires both declared runtime routes; each single-route invocation proves only its own route.'});
 state=await read();assert.equal(JSON.stringify(state.mission),goalBytes);assert.equal(JSON.stringify(Object.values(state.attempts).map(a=>a.context)),oldContexts);
 assert.equal((await goalPartitionCoverage(root,session,state)).goals.get(1).complete,false);
 const feServer=http.createServer((req,res)=>{res.writeHead(req.headers['x-apollo-operation-name']==='StarCiRuntimeObservation'?200:400);res.end('frontend fixture');});await new Promise(resolve=>feServer.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>feServer.close(resolve)));
 const feUrl='http://127.0.0.1:'+feServer.address().port;
 const fullRegistry=structuredClone(registry);fullRegistry.runtimes[state.project+'/fe']={...structuredClone(registry.runtimes[routeKey]),endpoints:{frontend:feUrl,api:feUrl,identity:feUrl},server:{...registry.runtimes[routeKey].server,port:feServer.address().port}};await put(registryPath,fullRegistry);
 const routeCells=Object.keys(partitioned.forecast.partitions);
 for(const [index,cell] of routeCells.entries()){
   const req=await requestFor(cell,{forecast:partitioned.forecast}),key=partitioned.forecast.presets[cell].routeKey,target=fullRegistry.runtimes[key],probeUrl=key.endsWith('/fe')?feUrl:url;
   req.requirements={...structuredClone(requirements),routeKey:key,desiredState:{...requirements.desiredState,resourceRefs:[key],mutableResourceRefs:[key]}};
   req.contexts=[{alias:'@workspaces/'+key.split('/')[1],head}];req.environment.reads=req.contexts.map(item=>item.alias);
   const [n,m]=cell.split('/'),dir=path.join(session,`step-${n}`,`parallel-${m}`);
   await put(path.join(dir,'request/request.json'),req);
   for(const alter of [r=>{r.requirements.routeKey=key.endsWith('/be')?state.project+'/fe':state.project+'/be';},r=>{r.requirements.env='foreign';},r=>{r.goal={doneWhen:0};},r=>{r.contexts[0].head='f'.repeat(40);},r=>{r.requirements.commit='f'.repeat(40);},r=>{r.contexts=[];}]){const bad=structuredClone(req);alter(bad);assert.ok((await planAdmissionErrors(root,session,state,bad)).length);}
   assert.equal((await openAttempt(dir)).state,'opened');
   const observedBefore=await captureRuntimeObservation({root,hostRoot:host,branch:dir,label:'route-before',urls:[probeUrl]});
   const observedAfter=await captureRuntimeObservation({root,hostRoot:host,branch:dir,label:'route-after',urls:[probeUrl]});
   const d=JSON.parse(JSON.stringify(delta).replaceAll(routeKey,key));d.inventoryFingerprint=sha(await readFile(registryPath));d.noOpProof={before:observedBefore,after:observedAfter};d.runtimeLadder.server.port=target.server.port;
   const ownChecks=JSON.parse(JSON.stringify({serviceRef:routeKey,serviceKind:'runtime',requiredCheckNames:checkNames,checks:list,findings}).replaceAll(routeKey,key));
   const text=runtimeText.replaceAll(routeKey,key).replaceAll('step-2/parallel-1',`step-${n}/parallel-${m}`).replaceAll(delta.inventoryFingerprint,d.inventoryFingerprint);
   await put(path.join(dir,'response/response.md'),text);await put(path.join(dir,'response/data/delta.json'),d);await put(path.join(dir,'response/data/checks.json'),ownChecks);
   await put(path.join(dir,'response/response.json'),responseFor(req,{'platform-operation-receipt':'response/response.md',delta:'response/data/delta.json',checks:'response/data/checks.json'}));
   assert.equal((await acceptAttempt(dir)).state,'matched');state=await read();
   const coverage=await goalPartitionCoverage(root,session,state);assert.deepEqual(coverage.errors,[]);assert.equal(coverage.goals.get(1).proven.size,index+1);assert.equal(coverage.goals.get(1).complete,index===1);
   const ledger=await goalLedger(session,state,root);
   const claiming={...state,brief:{...state.brief,proven:['doneWhen:1 both runtime routes served']}};
   assert.equal(provenErrors(claiming,ledger,{root}).length===0,index===1);
   if(index===0)assert.match((await v22SessionErrors(session,{...state,status:'done'},root)).join(),/missing required partition/);
 }
 assert.deepEqual(await v22SessionErrors(session,{...state,status:'done'},root),[]);
 const current=readContext(session,state.planHistory.active,'plans').forecast;
 const damaged=structuredClone(current);Object.values(damaged.obligations)[0].members.pop();assert.match((await forecastObligations(root,session,state,damaged)).errors.join(),/members|source|authority/);
 const wrong=structuredClone(current);wrong.partitions[routeCells[1]]=wrong.partitions[routeCells[0]];assert.match((await forecastObligations(root,session,state,wrong)).errors.join(),/route|environment/);
 const stale=structuredClone(state);stale.attempts[routeCells[1]].expected.goalVersion+=1;assert.equal((await goalPartitionCoverage(root,session,stale)).goals.get(1).complete,false);
 const [n,m]=routeCells[1].split('/'),fileToAlter=path.join(session,`step-${n}`,`parallel-${m}`,'response/data/delta.json'),retained=await readFile(fileToAlter);await put(fileToAlter,{});assert.equal((await goalPartitionCoverage(root,session,state)).goals.get(1).complete,false);await writeFile(fileToAlter,retained);
 assert.deepEqual(await readFile(path.join(branch,'request/request.json')),frozen);
});
