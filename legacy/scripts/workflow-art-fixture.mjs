// Actual current operator gates around explicitly synthetic PNG transport fixtures.
// The fixtures claim byte/provenance/ordering evidence, never an ImageGen run or design quality.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {deflateSync} from 'node:zlib';
import {freezeKnowledge,INTERFACE_PAGE} from './workflow-interface-fixture.mjs';
import {current,actual,open,accept,put,branch,sha,git,planCells} from './workflow-source-fixture.mjs';
const bindings=['@knowledge/ui/composition','@knowledge/ui/presentation','@knowledge/ui/proof','@knowledge/grammars/starci'];
export function syntheticCanvas(width,height){
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;};
 const chunk=(kind,data)=>{const bytes=Buffer.concat([Buffer.from(kind),data]),out=Buffer.alloc(data.length+12);out.writeUInt32BE(data.length);bytes.copy(out,4);out.writeUInt32BE(crc(bytes),out.length-4);return out;};
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=6;
 const raster=Buffer.alloc((width*4+1)*height);for(let row=0;row<height;row++)for(let col=0;col<width;col++){const at=row*(width*4+1)+1+col*4;raster[at]=80;raster[at+1]=96;raster[at+2]=112;raster[at+3]=255;}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raster)),chunk('IEND',Buffer.alloc(0))]);
}
export async function acceptedDrawing(fixture,{compare=false}={}){
 const {f,dir,brief,bytes,request,knowledge}=fixture,api=await f.load('scripts/art-direction.mjs');
 await open(f,request);
 const png=syntheticCanvas(1440,900),pngRef='response/artifacts/form.png';
 put(path.join(dir,pngRef),png);const prompt=bytes.toString()+'\nConcept: '+JSON.stringify(brief.concepts[0]),promptRef='response/artifacts/form.prompt.txt';put(path.join(dir,promptRef),prompt);
 const bundle={version:1,target:brief.target,route:brief.route,goalVersion:request.expected.goalVersion,brief:{ref:'request/art-direction-brief.json',sha256:sha(bytes)},source:{alias:'@workspaces/fe',head:request.contexts.find(c=>c.alias==='@workspaces/fe').head},grammar:brief.grammar,candidates:[{id:'form',concept:'focused-module',title:'Synthetic PNG transport fixture',rationale:'Tests the protocol only, not visual design.',limits:['Synthetic fixture pixels, not an ImageGen execution or approved design.'],prompt:{ref:promptRef,sha256:sha(prompt)},generation:{tool:'@tools/imagegen',sourceRef:'fixture:synthetic-tool-contract-no-execution-claim',inputHash:sha(bytes)},png:{ref:pngRef,sha256:sha(png),width:1440,height:900},regions:[{region:'main',realization:'Protocol fixture for a live native form.',grammarCompatibility:'No visual compatibility claim from synthetic pixels.'}],assets:[],anatomy:[{element:'surface',bounds:{x:0,y:0,width:1440,height:900}}]}],selected:'form',decisionId:api.artDecisionId(request,bytes)};
 put(path.join(dir,'response/data/art-direction.json'),bundle);put(path.join(dir,'response/data/family-understanding.json'),knowledge.brief);
 const {manifestEntities}=await f.load('scripts/knowledge-manifest.mjs');
 put(path.join(dir,'response/data/knowledge-coverage.json'),{schemaVersion:10,manifestFingerprint:knowledge.manifest.fingerprint,items:manifestEntities(knowledge.manifest).map(entity=>({key:entity.key,applicability:'n/a',reason:'This automated transport-only fixture asserts no '+entity.key+' visual compliance; product design review remains unproved.',evidence:['request/art-direction-brief.json']}))});
 const coverageFile=path.join(dir,'response/data/knowledge-coverage.json'),coverage=JSON.parse(readFileSync(coverageFile));
 const boundFile=coverage.items.find(item=>item.key.startsWith('file:'));delete boundFile.reason;boundFile.applicability='applicable';boundFile.actual='The canonical file was retained and read through the exact manifest; this protocol fixture claims source binding only.';boundFile.evidence=['response/data/art-direction.json'];put(coverageFile,coverage);
 if(compare){const other=structuredClone(bundle.candidates[0]);other.id='alternate';other.title='Alternate synthetic transport fixture';other.png.ref='response/artifacts/alternate.png';const otherPng=syntheticCanvas(1440,901);put(path.join(dir,other.png.ref),otherPng);other.png.sha256=sha(otherPng);other.png.height=901;bundle.candidates.push(other);bundle.selected=null;put(path.join(dir,'response/data/art-direction.json'),bundle);}
 const response=actual(request,{fields:{'frontend-art-direction':'response/data/art-direction.json','art-direction-png':[pngRef],'art-direction-prompt':[promptRef],'knowledge-coverage':'response/data/knowledge-coverage.json','family-understanding':'response/data/family-understanding.json'},fallbacks:[],commits:[],next:['interface.generate']},'done',['response/data/art-direction.json'],'sol-fresh');
 response.outcome.primary={kind:'image',label:'Synthetic PNG protocol fixture',ref:pngRef};
 if(compare){response.status='blocked';response.stop='DIRECTION_CHOICE_REQUIRED';response.next=[];delete response.outcome;delete response.goalCheck;response.comparison.verdict='inconclusive';response.comparison.criteria.forEach(row=>row.verdict='inconclusive');response.comparison.next='blocked';response.fields['art-direction-png']=bundle.candidates.map(candidate=>candidate.png.ref);response.interaction={kind:'tier-choice',decisionId:bundle.decisionId,options:bundle.candidates.map(candidate=>({id:candidate.id,label:candidate.title,tradeoff:'Synthetic '+candidate.png.width+'x'+candidate.png.height+' transport only; no visual-quality claim.'}))};}
 await accept(f,request,response);
 return{api,png,pngRef,bundle,response};
}
export async function prepareDrawingOnPeer(f,{step,nextStep,coordination}){
 planCells(f,[[step,'interface.draw']]);
 const impact=f.state().mission.discovery.impacts.findIndex(row=>row.role==='fe');
 assert.ok(impact>=0,'The confirmed peer mission owns the frontend behavior');
 const purpose=f.state().mission.discovery.impacts[impact].behavior,head=git(f.feWorktree,'rev-parse','HEAD');
 const dir=branch(f,step),sourceBytes=readFileSync(path.join(f.feWorktree,INTERFACE_PAGE));
 put(path.join(dir,'request/before.html'),sourceBytes);
 const knowledge=await freezeKnowledge(f,dir,bindings);
 knowledge.brief.businessShape={shape:'Existing anonymous transformation module; protocol fixture for drawing-stage ownership.',fit:'composed',source:'request/before.html'};
 knowledge.brief.compatibility='Drawing protocol fixture only; no new business feature or claimed rendered quality.';
 put(path.join(dir,'request/family-understanding.json'),knowledge.brief);
 const evidence={kind:'intent',source:{ref:'mission:/discovery/impacts/'+impact+'/behavior',sha256:sha(purpose)},statement:purpose},source=evidence.source;
 const regions=[{id:'main',journey:['transform'],states:['loaded','pending','error','settled'],information:['result'],content:['approved-copy'],acceptance:'Keep the actual action, editable input, result and retry states as live UI.'}];
 const authority=knowledge.manifest.files.find(file=>file.path==='knowledge/grammars/starci/family.md');
 const brief={version:1,target:'/fixture',route:'/fixture',changeLevel:'reconstruct',business:{purpose:evidence,actors:[{id:'visitor',description:evidence}],journey:[{id:'transform',actor:'visitor',action:evidence,outcome:evidence}]},surface:{states:['loaded','pending','error','settled'].map(id=>({id,description:evidence})),information:[{id:'result',description:evidence}],viewports:[{id:'wide',width:1440,height:900},{id:'narrow',width:390,height:844}]},content:[{id:'approved-copy',kind:'intent',value:purpose,source}],references:[],grammar:{family:'starci',version:knowledge.brief.packageBinding.version,manifestHash:knowledge.manifest.fingerprint,adoption:[{region:'main',component:'Published Common/Core ownership and native control semantics',authority:{ref:authority.path,sha256:authority.sha256},limits:'A drawing cannot authorize a CSS override or replace live controls.'}]},regions,imageryPlan:[{region:'main',purpose:'explanation',subject:'Actual transformation inputs and outputs',style:'Clear native controls',coherence:'Same action and result language',reuse:'existing',medium:'live-ui',source:[source],prominence:'Primary',placement:'Main surface',responsive:'Single-column at narrow viewport',accessibility:'Actual labelled input, button and result status',delivery:'Existing source component, not rasterized data'}],unresolved:[],concepts:[{id:'focused-module',centralIdea:'Make the actual next action and its result clear.',story:'Input, transformation, outcome and recovery.',tone:'Quiet and direct',artStyle:'Coherent published Grammar',hierarchy:'Input and primary action lead to result',imageryLanguage:'Live state and value semantics',business:['transform'],grammar:['main']}],comparisonRequest:null,sourceFiles:[{path:INTERFACE_PAGE,sha256:sha(sourceBytes),status:'observed'}]};
 put(path.join(dir,'request/art-direction-brief.json'),brief);
 brief.visual={assets:[],elements:[{id:'surface',region:'main',kind:'control',purpose:'The real form is live UI, not pixels.',asset:null,registry:null,connects:[],anatomy:'The existing main region contains the labelled input, action and live result.',dimensions:brief.surface.viewports.map(v=>({viewport:v.id,width:[0,v.width],height:[0,4096]})),responsive:'Required native content remains available in each bound viewport.',motion:'Static feedback stays visible with reduced motion; no animation conveys a required result.'}]};
 brief.sourceFiles[0].sha256=sha(execFileSync('git',['-C',f.feWorktree,'show',head+':'+INTERFACE_PAGE],{windowsHide:true}));
 put(path.join(dir,'request/art-direction-brief.json'),brief);
 const bytes=readFileSync(path.join(dir,'request/art-direction-brief.json'));
 const request=current(f,{operatorId:'interface.draw',contexts:[{alias:'@workspaces/fe',head:head},{alias:'@grammar/core',head:null},...bindings.map(alias=>({alias,head:null}))],requirements:{target:'/fixture',changeLevel:'reconstruct',compare:'no',selectionPolicy:'automatic',resume:null},inputs:{}},step,{goal:{prerequisite:nextStep+'/1'},coordination,workspace:false,criteria:[{id:'transport',required:true,expected:'The protocol fixture retains a valid PNG and frozen drawing-input provenance.',verification:'Validate byte binding and presentation ordering; no ImageGen or visual-quality claim.'}]});
 request.frozenInputs=[{ref:'request/art-direction-brief.json',sha256:sha(bytes)},{ref:'request/before.html',sha256:sha(sourceBytes)}];
 for(const ref of ['request/knowledge-manifest.json','request/family-understanding.json'])request.frozenInputs.push({ref,sha256:sha(readFileSync(path.join(dir,ref)))});
 put(path.join(dir,'request/request.json'),request);
 return{f,dir,brief,bytes,request,knowledge};
}
export async function acceptDrawingOnPeer(f,options){
 const prepared=await prepareDrawingOnPeer(f,options),drawing=await acceptedDrawing(prepared),markdown=await drawing.api.renderArtSheet(f.root,prepared.dir);
 assert.match(markdown,/## Operator Result\n\n!\[/);
 assert.equal(execFileSync(process.execPath,[path.join(f.root,'scripts/art-direction.mjs'),'present',prepared.dir],{encoding:'utf8',windowsHide:true}),markdown);
 put(path.join(f.home,f.sessionId+'-inline-drawing-result.md'),markdown);
 await drawing.api.recordArtPresentation(f.root,prepared.dir,{sourceRef:'fixture:actual-native-png-markdown-emitted-before-frontend',presentationHash:sha(markdown)});
 assert.equal(f.state().choices[drawing.bundle.decisionId],undefined,'Default one direction has no fabricated user answer');
 return{...prepared,...drawing,ref:'step-'+options.step+'/parallel-1/response/data/art-direction.json',markdown};
}
export function drawingAdoption(f,drawing){
 return async({request,response,dir})=>{
  const ref='response/data/art-direction-adoption.json',capture='response/artifacts/form.wide.png',head=response.commits.at(-1);
  put(path.join(dir,ref),{version:1,direction:{ref:drawing.ref,sha256:sha(readFileSync(path.join(f.session,drawing.ref)))},candidate:drawing.bundle.selected,png:{ref:drawing.pngRef,sha256:sha(drawing.png)},regions:[{region:'main',implementation:'Actual native form; synthetic direction tests byte/region binding only.',evidence:{ref:capture,sha256:sha(readFileSync(path.join(dir,capture)))}}],assets:[],elements:[{element:'surface',source:{path:INTERFACE_PAGE,sha256:sha(execFileSync('git',['-C',f.feWorktree,'show',head+':'+INTERFACE_PAGE],{windowsHide:true}))},asset:null,registry:null}]});
  response.fields['art-direction-adoption']=ref;
 };
}
export function drawingFidelity(f,source){
 return async({request,response,dir})=>{
  const adoptionRef='step-'+source.step+'/parallel-1/response/data/art-direction-adoption.json',adoptionBytes=readFileSync(path.join(f.session,adoptionRef)),adoption=JSON.parse(adoptionBytes),verdicts=JSON.parse(readFileSync(path.join(dir,response.fields.verdicts))),entry=verdicts.entries[0],judged=entry.results.find(result=>result.verdict==='pass'),capture='response/artifacts/'+entry.matrixId+'.png',ref='response/data/art-direction-fidelity.json';
  const fidelity={version:1,adoption:{ref:adoptionRef,sha256:sha(adoptionBytes)},direction:adoption.direction,candidate:adoption.candidate,png:adoption.png,results:[{region:'main',capture:{ref:capture,sha256:sha(readFileSync(path.join(dir,capture)))},matrixId:entry.matrixId,path:judged.path,rule:judged.rule,verdict:'pass',observation:'Actual measured native form rule; protocol fixture does not claim visual similarity to synthetic pixels.',grammar:'Existing published ownership remains bound.'}],verdict:'pass',checks:[]};
  const rules={anatomy:'HIERARCHY-2',dimensions:'RESPONSIVE-1',responsive:'RESPONSIVE-1',motion:'MOTION-1',semantics:'TRUTH-3'};
  for(const captureRef of response.fields.capture){
   const record=JSON.parse(readFileSync(path.join(dir,captureRef))),rows=verdicts.entries.find(e=>e.matrixId===record.matrixId).results,measurements=JSON.parse(readFileSync(path.join(dir,record.driver.measurementsRef)));
   for(const [axis,rule]of Object.entries(rules)){
    const actual=rows.find(r=>r.rule===rule),measured=measurements.elements.find(e=>e.ref===actual.path),image='response/artifacts/'+record.matrixId+'.png',evidence=record.driver.resultRef;
    fidelity.checks.push({element:'surface',axis,matrixId:record.matrixId,path:actual.path,rule,capture:{ref:image,sha256:sha(readFileSync(path.join(dir,image)))},measurement:{ref:record.driver.measurementsRef,element:measured.ref,bbox:measured.bbox},evidence:{ref:evidence,sha256:sha(readFileSync(path.join(dir,evidence)))},verdict:'pass',observation:'Actual canonical rule and browser measurements; transport fixture does not establish visual similarity to synthetic PNG.'});
   }
  }
  put(path.join(dir,ref),fidelity);response.fields['art-direction-fidelity']=ref;
  const api=await f.load('scripts/art-direction.mjs');assert.deepEqual(await api.artFidelityErrors(f.root,dir,request,response),[]);
 };
}
