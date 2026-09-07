// Protocol/transport fixtures only: synthetic pixels are explicitly not ImageGen or visual-quality proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {syntheticCanvas,acceptedDrawing} from './workflow-art-fixture.mjs';
import {createInterfaceFixture,acceptInterfaceRoute,acceptInterface,acceptAudit,startInterfaceRuntime,freezeKnowledge,INTERFACE_PAGE} from './workflow-interface-fixture.mjs';
import {technicalQuality} from './art-direction-quality-fixture.mjs';
import {current,actual,open,accept,put,planCells,branch,sha} from './workflow-source-fixture.mjs';

const bindings=['@knowledge/ui/composition','@knowledge/ui/presentation','@knowledge/ui/proof','@knowledge/grammars/starci'];
async function drawingFixture(t,{designOnly=false}={}){
 const purpose='An anonymous visitor can enter text, run its uppercase transformation, read the result, retry a failed request and restore the result by reloading.';
 const f=await createInterfaceFixture(t,{sessionId:'png-direction-protocol',mission:({discovery})=>{
  if(!designOnly)return{discovery,includes:[purpose]};
  discovery.stage='handoff';discovery.impacts=discovery.impacts.map(impact=>({...impact,tags:['documentation'],behavior:'Retain a PNG concept document from the existing source; no implementation or browser delivery.'}));
  discovery.lanes=Object.fromEntries(Object.keys(discovery.lanes).map(key=>[key,{status:'not-applicable',reason:'This protocol fixture requests a design artifact only; no product implementation, audit or UAT.'}]));
  return{discovery,goal:'Draw a source-bound PNG concept document only.',includes:[purpose],doneWhen:[{producedBy:'interface.draw',evidence:'The requested PNG concept document is retained.'}]};
 }});
 const route=await acceptInterfaceRoute(f);
 planCells(f,designOnly?[[11,'interface.draw']]:[[11,'interface.draw'],[12,'interface.generate']]);
 const dir=branch(f,11),sourceBytes=readFileSync(path.join(f.feWorktree,INTERFACE_PAGE));
 put(path.join(dir,'request/before.html'),sourceBytes);
 const knowledge=await freezeKnowledge(f,dir,bindings);
 knowledge.brief.businessShape={shape:'Existing anonymous transformation module; protocol fixture for drawing-stage ownership.',fit:'composed',source:'request/before.html'};
 knowledge.brief.compatibility='Drawing protocol fixture only; no new business feature or claimed rendered quality.';
 put(path.join(dir,'request/family-understanding.json'),knowledge.brief);
 const evidence={kind:'intent',source:{ref:'mission:/includes/0',sha256:sha(purpose)},statement:purpose},source=evidence.source;
 const regions=[{id:'main',journey:['transform'],states:['loaded','pending','error','settled'],information:['result'],content:['approved-copy'],acceptance:'Keep the actual action, editable input, result and retry states as live UI.'}];
 const authority=knowledge.manifest.files.find(file=>file.path==='knowledge/grammars/starci/family.md');
 const brief={version:1,target:'/fixture',route:'/fixture',changeLevel:'reconstruct',business:{purpose:evidence,actors:[{id:'visitor',description:evidence}],journey:[{id:'transform',actor:'visitor',action:evidence,outcome:evidence}]},surface:{states:['loaded','pending','error','settled'].map(id=>({id,description:evidence})),information:[{id:'result',description:evidence}],viewports:[{id:'wide',width:1440,height:900},{id:'narrow',width:390,height:844}]},content:[{id:'approved-copy',kind:'intent',value:purpose,source}],references:[],grammar:{family:'starci',version:knowledge.brief.packageBinding.version,manifestHash:knowledge.manifest.fingerprint,adoption:[{region:'main',component:'Published Common/Core ownership and native control semantics',authority:{ref:authority.path,sha256:authority.sha256},limits:'A drawing cannot authorize a CSS override or replace live controls.'}]},regions,imageryPlan:[{region:'main',purpose:'explanation',subject:'Actual transformation inputs and outputs',style:'Clear native controls',coherence:'Same action and result language',reuse:'existing',medium:'live-ui',source:[source],prominence:'Primary',placement:'Main surface',responsive:'Single-column at narrow viewport',accessibility:'Actual labelled input, button and result status',delivery:'Existing source component, not rasterized data'}],unresolved:[],concepts:[{id:'focused-module',centralIdea:'Make the actual next action and its result clear.',story:'Input, transformation, outcome and recovery.',tone:'Quiet and direct',artStyle:'Coherent published Grammar',hierarchy:'Input and primary action lead to result',imageryLanguage:'Live state and value semantics',business:['transform'],grammar:['main']}],comparisonRequest:null,sourceFiles:[{path:INTERFACE_PAGE,sha256:sha(sourceBytes),status:'observed'}]};
 put(path.join(dir,'request/art-direction-brief.json'),brief);
 brief.visual={assets:[],elements:[{id:'surface',region:'main',kind:'control',purpose:'The real form is live UI, not pixels.',asset:null,registry:null,connects:[],anatomy:'The existing main region contains the labelled input, action and live result.',dimensions:brief.surface.viewports.map(v=>({viewport:v.id,width:[0,v.width],height:[0,4096]})),responsive:'Required native content remains available in each bound viewport.',motion:'Static feedback stays visible with reduced motion; no animation conveys a required result.'}]};
 brief.sourceFiles[0].sha256=sha(execFileSync('git',['-C',f.feWorktree,'show',f.feBase+':'+INTERFACE_PAGE],{windowsHide:true}));
 put(path.join(dir,'request/art-direction-brief.json'),brief);
 const bytes=readFileSync(path.join(dir,'request/art-direction-brief.json'));
 const request=current(f,{operatorId:'interface.draw',contexts:[{alias:'@workspaces/fe',head:f.feBase},{alias:'@grammar/core',head:null},...bindings.map(alias=>({alias,head:null}))],requirements:{target:'/fixture',changeLevel:'reconstruct',compare:'no',selectionPolicy:'automatic',resume:null},inputs:{}},11,{goal:designOnly?{doneWhen:0}:{prerequisite:'12/1'},workspace:false,criteria:[{id:'transport',required:true,expected:'The protocol fixture retains a valid PNG and frozen drawing-input provenance.',verification:'Validate byte binding and presentation ordering; no ImageGen or visual-quality claim.'}]});
 request.frozenInputs=[{ref:'request/art-direction-brief.json',sha256:sha(bytes)},{ref:'request/before.html',sha256:sha(sourceBytes)}];
 for(const ref of ['request/knowledge-manifest.json','request/family-understanding.json'])request.frozenInputs.push({ref,sha256:sha(readFileSync(path.join(dir,ref)))});
 put(path.join(dir,'request/request.json'),request);
 return{f,dir,brief,bytes,request,knowledge,route};
}

test('fresh drawing admission binds actual source, necessary business/concept/Grammar and explicit comparison authority',async t=>{
 const {f,dir,brief,bytes,request}=await drawingFixture(t),api=await f.load('scripts/art-direction.mjs');
 assert.deepEqual(await api.artRequestErrors(f.root,dir,request),[]);
 const mutate=async(change,pattern)=>{const altered=structuredClone(brief);change(altered);put(path.join(dir,'request/art-direction-brief.json'),altered);const req=structuredClone(request);req.frozenInputs[0].sha256=sha(readFileSync(path.join(dir,'request/art-direction-brief.json')));assert.match((await api.artRequestErrors(f.root,dir,req)).join(),pattern);writeFileSync(path.join(dir,'request/art-direction-brief.json'),bytes);};
 await mutate(b=>b.business.purpose.kind='example',/necessary business/);
 await mutate(b=>b.unresolved.push({id:'actor',necessary:true,reason:'No approved actor is known.'}),/necessary drawing inputs/);
 await mutate(b=>b.concepts[0].business=['invented-feature'],/not grounded/);
 await mutate(b=>b.grammar.version='99.0.0',/resolved family/);
 await mutate(b=>b.sourceFiles[0].sha256=sha('other source'),/source blob differs/);
 await mutate(b=>b.sourceFiles[0].path='../foreign.html',/escapes|path traversal/);
 await mutate(b=>b.regions[0].states.pop(),/omits or invents states/);
 await mutate(b=>b.imageryPlan=[],/every region|array is too short/);
 await mutate(b=>delete b.visual,/visual|required/);
 const comparison=structuredClone(request);comparison.requirements.compare='yes';comparison.requirements.selectionPolicy='approval-required';
 assert.match((await api.artRequestErrors(f.root,dir,comparison)).join(),/explicit user comparison request/);
 const missing=structuredClone(request);missing.frozenInputs=[];assert.match((await api.artRequestErrors(f.root,dir,missing)).join(),/not frozen/);
 const wrongHead=structuredClone(request);wrongHead.contexts[0].head='a'.repeat(40);assert.match((await api.artRequestErrors(f.root,dir,wrongHead)).join(),/HEAD changed/);
 const originalState=readFileSync(path.join(f.session,'state.json'));
 for(const version of [undefined,'starci/v2.1']){
  const legacy=structuredClone(request);if(version===undefined)delete legacy.contractVersion;else legacy.contractVersion=version;
  await assert.rejects(open(f,legacy),/contractVersion|legacy|v2.2/);
  assert.deepEqual(readFileSync(path.join(f.session,'state.json')),originalState,'missing or legacy marker grants no fresh execution');
 }
 await assert.rejects(open(f,missing),/not frozen|frozenInputs/);
 assert.deepEqual(readFileSync(path.join(f.session,'state.json')),originalState,'omitted drawing proof grants no fresh execution');
 await open(f,request);assert.equal(f.state().attempts['11/1'].status,'running');
});


test('explicit comparison retains actual choice through public preview, commit, resume and immutable PNG acceptance',async t=>{
 const fixture=await drawingFixture(t,{designOnly:true}),{f,dir,brief,request}=fixture;
 const user='Please compare two PNG directions before I select one.';put(path.join(dir,'request/user-comparison.txt'),user);
 brief.comparisonRequest={selectedBy:'user',sourceRef:'fixture:actual-explicit-comparison-request',statement:user,source:{ref:'request/user-comparison.txt',sha256:sha(user)}};put(path.join(dir,'request/art-direction-brief.json'),brief);fixture.bytes=readFileSync(path.join(dir,'request/art-direction-brief.json'));
 request.frozenInputs[0].sha256=sha(fixture.bytes);request.frozenInputs.push({ref:'request/user-comparison.txt',sha256:sha(user)});request.requirements.compare='yes';request.requirements.selectionPolicy='approval-required';
 const {api,bundle,response}=await acceptedDrawing(fixture,{compare:true}),state=f.state(),originalState=readFileSync(path.join(f.session,'state.json'));
 const originalFiles=['request/request.json','response/response.json','response/data/art-direction.json',...bundle.candidates.map(candidate=>candidate.png.ref)],original=originalFiles.map(ref=>readFileSync(path.join(dir,ref)));
 const binding=JSON.parse(readFileSync(path.join(branch(f,10),'request/request.json'))),forecast={chain:[['10/1'],['11/1']],steps:{'10/1':'workspace.bind','11/1':'interface.draw'},goals:{'10/1':binding.goal,'11/1':request.goal},presets:{'10/1':binding.requirements,'11/1':request.requirements},reasons:{},dependencies:{'10/1':[],'11/1':['10/1']},evidenceDependencies:{'10/1':[],'11/1':[]},nodes:{'10/1':'binding','11/1':'drawing'},handoffs:{},imports:{},resumes:{},fanout:{}};
 const {retainContext}=await f.load('scripts/mission-history.mjs'),{scopeHash}=await f.load('scripts/mission-scope.mjs');state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const address=await retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:state.mission.version,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:address,revisions:[address]};put(path.join(f.session,'state.json'),state);
 const plans=await f.load('scripts/plan-history.mjs'),flags={edit:{kind:'resume',cell:'11/1'}};
 await assert.rejects(plans.previewRevision(f.root,f.session,flags),/actual recorded user selection/);
 const markdown=await api.renderArtSheet(f.root,dir);assert.equal((markdown.match(/!\[/g)??[]).length,2);
 await assert.rejects(api.recordArtChoice(f.root,dir,{selected:'alternate',selectedBy:'coordinator',sourceRef:'fixture:review',presentationSourceRef:'fixture:sheet',presentationHash:sha(markdown)}),/actual user choice/);
 await api.recordArtChoice(f.root,dir,{selected:'alternate',selectedBy:'user',sourceRef:'fixture:actual-test-user-choice',presentationSourceRef:'fixture:exact-native-sheet',presentationHash:sha(markdown)});
 const before=readFileSync(path.join(f.session,'state.json')),preview=await plans.previewRevision(f.root,f.session,flags);assert.deepEqual(readFileSync(path.join(f.session,'state.json')),before);
 const pngFile=path.join(dir,bundle.candidates[1].png.ref),pngBytes=readFileSync(pngFile);writeFileSync(pngFile,Buffer.concat([pngBytes,Buffer.from('tampered')]));await assert.rejects(plans.previewRevision(f.root,f.session,flags),/hash|changed|inventory|manifest|PNG/i);writeFileSync(pngFile,pngBytes);
 const altered=f.state();altered.choices[bundle.decisionId].selected='invented';put(path.join(f.session,'state.json'),altered);await assert.rejects(plans.commitRevision(f.root,f.session,{flags,previewHash:preview.previewHash,reason:'Reject an unoffered choice.'}),/selection|sheet|PNG|choice/i);writeFileSync(path.join(f.session,'state.json'),before);
 await plans.commitRevision(f.root,f.session,{flags,previewHash:preview.previewHash,reason:'Resume the exact comparison sheet after its actual fixture user choice.'});
 const cell=f.state().current,step=Number(cell.split('/')[0]),resumed=current(f,request,step,{goal:request.goal,workspace:false,number:2,previous:request.attempt.id,resume:{step:11,parallel:1,token:bundle.decisionId}});resumed.requirements=structuredClone(f.state().planned[cell].requirements);resumed.decisionId=bundle.decisionId;resumed.selectedOption='alternate';resumed.frozenInputs=structuredClone(request.frozenInputs);
 resumed.expected=structuredClone(request.expected);
 const next=branch(f,step);cpSync(path.join(dir,'request'),path.join(next,'request'),{recursive:true});await open(f,resumed);cpSync(path.join(dir,'response'),path.join(next,'response'),{recursive:true});
 const selected=structuredClone(bundle);selected.selected='alternate';put(path.join(next,'response/data/art-direction.json'),selected);
 const done=actual(resumed,{fields:response.fields,fallbacks:[],commits:[],next:['user']},'done',['response/data/art-direction.json'],'sol-fresh');done.outcome.primary={kind:'image',label:'Selected synthetic protocol PNG',ref:selected.candidates[1].png.ref};await accept(f,resumed,done);
 assert.equal(f.state().attempts[cell].status,'matched');assert.equal(f.state().choices[bundle.decisionId].selectedBy,'user');
 originalFiles.forEach((ref,index)=>assert.deepEqual(readFileSync(path.join(dir,ref)),original[index]));assert.deepEqual(plans.planHistoryErrors(f.session,f.state()),[]);
 const {goalLedger}=await f.load('scripts/validate-session.mjs');assert.equal((await goalLedger(f.session,f.state(),f.root)).find(row=>row.branch===cell).achieved,true,'PNG-only delivery does not demand frontend code or product UAT');
 const {confirmSession}=await f.load('scripts/v23-test-fixture.mjs');await confirmSession(f.session,{selected:'corrected',selectedBy:'user',sourceRef:'fixture:actual-scope-correction',mission:{...f.state().mission,goal:'Reconsider the same source-bound concept under the corrected design brief.'}});await confirmSession(f.session,{selected:'as-stated',selectedBy:'user',sourceRef:'fixture:actual-corrected-scope-answer'});
 const {validateStep}=await f.load('scripts/validate-step.mjs');assert.deepEqual((await validateStep(f.root,next,{operator:true,requestPhase:'accept'})).errors,[],'accepted original comparison retains its opening mission and actual choice');
 assert.match((await api.artChoiceErrors(f.root,next,f.state(),resumed)).join(),/another sheet or scope/,'old comparison cannot authorize fresh corrected-scope work');
 originalFiles.forEach((ref,index)=>assert.deepEqual(readFileSync(path.join(dir,ref)),original[index]));
});

test('default PNG protocol acceptance requires native inline presentation before frontend admission and never invents a user choice',async t=>{
 const {f,dir,brief,bytes,request,knowledge,route}=await drawingFixture(t),api=await f.load('scripts/art-direction.mjs');
 const {png,pngRef,bundle}=await acceptedDrawing({f,dir,brief,bytes,request,knowledge});
 const markdown=await api.renderArtSheet(f.root,dir);assert.match(markdown,/## Operator Result\n\n!\[/);assert.ok(markdown.includes(path.resolve(dir,pngRef).replaceAll('\\','/')));
 assert.equal(execFileSync(process.execPath,[path.join(f.root,'scripts/art-direction.mjs'),'present',dir],{encoding:'utf8',windowsHide:true}),markdown,'standalone CLI emits the same actual native PNG sheet');
 assert.equal(f.state().choices[bundle.decisionId],undefined,'one direction needs no user choice');
 const next=branch(f,12);put(path.join(next,'request/before.html'),readFileSync(path.join(dir,'request/before.html')));
 await freezeKnowledge(f,next,bindings);
 const fe=current(f,{operatorId:'interface.generate',contexts:request.contexts,requirements:{target:'/fixture',changeLevel:'reconstruct',candidates:1,selectionPolicy:'automatic'},inputs:{'frontend-art-direction':'step-11/parallel-1/response/data/art-direction.json'}},12,{goal:{doneWhen:2},workspace:false});
 assert.match((await api.artConsumerErrors(f.root,next,fe)).join(),/has not been shown inline/);
 await assert.rejects(api.recordArtPresentation(f.root,dir,{sourceRef:'fixture:rendered-sheet',presentationHash:sha('[PNG](form.png)')}),/native PNG embed/);
 await api.recordArtPresentation(f.root,dir,{sourceRef:'fixture:actual-renderer-output-in-this-protocol-test',presentationHash:sha(markdown)});
 assert.deepEqual(await api.artConsumerErrors(f.root,next,fe),[]);
 const competing=structuredClone(fe);competing.requirements.candidates=2;assert.match((await api.artConsumerErrors(f.root,next,competing)).join(),/competing direction/);
 const absent=structuredClone(fe);delete absent.inputs['frontend-art-direction'];assert.match((await api.artConsumerErrors(f.root,next,absent)).join(),/prior accepted PNG/);
 assert.equal(f.state().choices[bundle.decisionId],undefined);
 const runtime=await startInterfaceRuntime(t,f),directionRef='step-11/parallel-1/response/data/art-direction.json';
 const adoptionFor=async({request,response,dir})=>{
  const ref='response/data/art-direction-adoption.json',capture='response/artifacts/form.wide.png';
  put(path.join(dir,ref),{version:1,direction:{ref:directionRef,sha256:sha(readFileSync(path.join(f.session,directionRef)))},candidate:'form',png:{ref:pngRef,sha256:sha(png)},regions:[{region:'main',implementation:'Actual native form; synthetic direction tests byte/region binding only.',evidence:{ref:capture,sha256:sha(readFileSync(path.join(dir,capture)))}}],assets:[],elements:[{element:'surface',source:{path:INTERFACE_PAGE,sha256:sha(execFileSync('git',['-C',f.feWorktree,'show',response.commits.at(-1)+':'+INTERFACE_PAGE],{windowsHide:true}))},asset:null,registry:null}]});
  response.fields['art-direction-adoption']=ref;response.next=['quality.verify'];
  if(request.requirements.changeLevel==='reconstruct'){
   const file=path.join(dir,response.fields['frontend-direction-decision']);let text=readFileSync(file,'utf8').replace('| Change level | `refine` |','| Change level | `reconstruct` |').replace('| Classification | `locked-refine` |','| Classification | `reconstruct` |');
   text=text.replace('## References\n\n| Standard | Class | URL | What is borrowed | Limitation |\n| --- | --- | --- | --- | --- |','## References\n\n| Standard | Class | URL | What is borrowed | Limitation |\n| --- | --- | --- | --- | --- |\n| Selected PNG protocol | `module-form` | — | Exact selected candidate identity and region ownership | Synthetic transport fixture; no visual similarity claim |');put(file,text);
  }
 };
 const attach=({request})=>{request.inputs['frontend-art-direction']=directionRef;};
 const broken=await acceptInterface(f,runtime,route,{step:12,beforeRequest:args=>{attach(args);args.request.requirements.changeLevel='reconstruct';},beforeResponse:adoptionFor,transform:s=>s.replace(/(<header id="intro">[\s\S]*?<\/header>)(<form id="transform-form">)/,'$2$1').replace('>Run</button>','>Transform</button>').replace('aria-label="Result"','aria-label="Output"'),description:'Recompose the form introduction within its form; retain a detectable output-name regression for the technical gate fixture'});
 const {goalLedger}=await f.load('scripts/validate-session.mjs');
 assert.equal((await goalLedger(f.session,f.state(),f.root)).find(row=>row.branch==='12/1').achieved,false,'source acceptance alone is not completed visual delivery');
 const failed=await technicalQuality(f,broken,{step:13,auditStep:16,expectedPass:false});
 const auditProbe={operatorId:'interface.audit',contexts:[{alias:'@workspaces/fe',head:broken.head}],inputs:{'frontend-source-application':broken.ref,'quality-verification':failed.ref}};
 assert.match((await api.artAuditAdmissionErrors(f.root,branch(f,16),auditProbe)).join(),/not accepted/);
 const repaired=await acceptInterface(f,runtime,route,{step:14,beforeRequest:attach,beforeResponse:adoptionFor,transform:s=>s.replace('aria-label="Output"','aria-label="Result"'),description:'Restore the required accessible Result name detected by the real technical gate'});
 assert.notEqual(repaired.head,broken.head);
 const passed=await technicalQuality(f,repaired,{step:15,auditStep:16});
 assert.equal((await goalLedger(f.session,f.state(),f.root)).find(row=>row.branch==='14/1').achieved,false,'technical green alone is not surface completion');
 const audit=await acceptAudit(f,runtime,repaired,route,{step:16,beforeRequest:({request})=>{request.inputs['quality-verification']=passed.ref;},beforeResponse:async({request,response,dir})=>{
  const adoptionRef='step-14/parallel-1/response/data/art-direction-adoption.json',adoptionBytes=readFileSync(path.join(f.session,adoptionRef)),adoption=JSON.parse(adoptionBytes),verdicts=JSON.parse(readFileSync(path.join(dir,response.fields.verdicts))),entry=verdicts.entries[0],judged=entry.results.find(result=>result.verdict==='pass'),capture='response/artifacts/'+entry.matrixId+'.png',ref='response/data/art-direction-fidelity.json';
  const fidelity={version:1,adoption:{ref:adoptionRef,sha256:sha(adoptionBytes)},direction:adoption.direction,candidate:adoption.candidate,png:adoption.png,results:[{region:'main',capture:{ref:capture,sha256:sha(readFileSync(path.join(dir,capture)))},matrixId:entry.matrixId,path:judged.path,rule:judged.rule,verdict:'pass',observation:'Actual measured native form rule; protocol fixture does not claim visual similarity to synthetic pixels.',grammar:'Existing published ownership remains bound.'}],verdict:'pass'};
  fidelity.checks=[];
  const rules={anatomy:'HIERARCHY-2',dimensions:'RESPONSIVE-1',responsive:'RESPONSIVE-1',motion:'MOTION-1',semantics:'TRUTH-3'};
  for(const captureRef of response.fields.capture){
   const record=JSON.parse(readFileSync(path.join(dir,captureRef))),rows=verdicts.entries.find(e=>e.matrixId===record.matrixId).results,measurements=JSON.parse(readFileSync(path.join(dir,record.driver.measurementsRef)));
   for(const [axis,rule]of Object.entries(rules)){
    const actual=rows.find(r=>r.rule===rule),measured=measurements.elements.find(e=>e.ref===actual.path),image='response/artifacts/'+record.matrixId+'.png',evidence=record.driver.resultRef;
    fidelity.checks.push({element:'surface',axis,matrixId:record.matrixId,path:actual.path,rule,capture:{ref:image,sha256:sha(readFileSync(path.join(dir,image)))},measurement:{ref:record.driver.measurementsRef,element:measured.ref,bbox:measured.bbox},evidence:{ref:evidence,sha256:sha(readFileSync(path.join(dir,evidence)))},verdict:'pass',observation:'Actual canonical rule and browser measurements; transport fixture does not establish visual similarity to synthetic PNG.'});
   }
  }
  put(path.join(dir,ref),fidelity);response.fields['art-direction-fidelity']=ref;
  assert.deepEqual(await api.artFidelityErrors(f.root,dir,request,response),[]);
  fidelity.results[0].verdict='fail';put(path.join(dir,ref),fidelity);assert.match((await api.artFidelityErrors(f.root,dir,request,response)).join(),/actual owner-routed/);fidelity.results[0].verdict='pass';put(path.join(dir,ref),fidelity);
 }});
 assert.equal(f.state().attempts['16/1'].status,'matched');
 const ledger=await goalLedger(f.session,f.state(),f.root);assert.equal(ledger.find(row=>row.branch==='14/1').achieved,true);assert.equal(ledger.find(row=>row.branch==='12/1').achieved,false,'earlier broken source gets no later source credit');
 const stale=structuredClone(audit.request);stale.inputs['quality-verification']=failed.ref;assert.match((await api.artAuditAdmissionErrors(f.root,branch(f,16),stale)).join(),/not accepted/);
 assert.deepEqual(readFileSync(path.join(dir,pngRef)),png,'implementation and repair preserve the original PNG');
});


