import {readFileSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {inflateSync} from 'node:zlib';
import {visualBrief,visualCandidate,visualAdoption,visualFidelity} from './art-visual-proof.mjs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateAgainst} from './json-schema.mjs';
import {mutateSession} from './session-lock.mjs';
import {retainContext,readContext,invocationState} from './mission-history.mjs';
import {evidenceManifestErrors} from './evidence-manifest.mjs';
import {sourceCheckoutOf} from './workspace-checkout.mjs';
const read=file=>JSON.parse(readFileSync(file,'utf8'));
export const artHash=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const rule=root=>read(path.join(root,'resources/interaction.json')).artDirection;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw Error('ART_DIRECTION_INVALID: '+message);};
const sessionOf=branch=>path.dirname(path.dirname(branch));
const identity=request=>request.step+'/'+request.parallel;
const schema=(root,kind,value)=>validateAgainst(read(path.join(root,'templates/kinds',kind+'.schema.json')),value,kind);
function safe(base,ref){
 if(typeof ref!=='string'||path.isAbsolute(ref)||path.win32.isAbsolute(ref)||ref.includes('\\')||ref.split('/').some(p=>!p||p==='.'||p==='..'))fail('unsafe artifact ref');
 const full=path.resolve(base,ref),real=realpathSync(full),rel=path.relative(realpathSync(base),real);
 if(!rel||rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))fail('artifact leaves its owner');
 return full;
}
const bytesOf=(base,ref)=>readFileSync(safe(base,ref));
function verified(base,item){const bytes=bytesOf(base,item.ref);if(artHash(bytes)!==item.sha256)fail('changed artifact '+item.ref);return bytes;}
function crc32(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
// Decode the complete PNG transport; a signature or renamed HTML file is not a drawing.
export function pngShape(bytes){
 if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail('not a PNG');
 let at=8,shape=null,ended=false,parts=[],header,palette=null,dataEnded=false;
 while(at<bytes.length){if(at+12>bytes.length)fail('truncated PNG');const length=bytes.readUInt32BE(at),type=bytes.toString('ascii',at+4,at+8),end=at+12+length;
  if(end>bytes.length)fail('truncated PNG chunk');const data=bytes.subarray(at+8,at+8+length);
  if(!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)||/^[A-Z]/.test(type)&&!['IHDR','PLTE','IDAT','IEND'].includes(type))fail('unsupported PNG critical chunk');
  if(crc32(bytes.subarray(at+4,at+8+length))!==bytes.readUInt32BE(at+8+length))fail('PNG checksum mismatch');
  if(type==='IHDR'){if(shape||at!==8||length!==13)fail('invalid PNG header');header=data;shape={width:data.readUInt32BE(0),height:data.readUInt32BE(4)};if(!shape.width||!shape.height)fail('empty PNG');}
  if(type==='PLTE'){if(palette||parts.length||!length||length%3||length>768)fail('invalid PNG palette');palette=data;}
  if(parts.length&&type!=='IDAT')dataEnded=true;
  if(type==='IDAT'){if(dataEnded)fail('nonconsecutive PNG image data');parts.push(data);}if(type==='IEND'){if(length!==0||end!==bytes.length)fail('invalid PNG end');ended=true;}at=end;
 }
 if(!shape||!ended||!parts.length)fail('incomplete PNG');
 const depth=header[8],color=header[9],channels={0:1,2:3,3:1,4:2,6:4}[color];
 if(!channels||!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]}[color].includes(depth))||header[10]||header[11]||header[12]>1)fail('invalid PNG pixel format');
 if(color===3&&(!palette||palette.length/3>2**depth)||[0,4].includes(color)&&palette)fail('PNG palette differs from its pixel format');
 const raster=inflateSync(Buffer.concat(parts),{maxOutputLength:256*1024*1024});
 const passes=header[12]?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]];
 let position=0;
 for(const[x,y,dx,dy]of passes){const width=Math.ceil((shape.width-x)/dx),height=Math.ceil((shape.height-y)/dy);if(width<=0||height<=0)continue;const stride=Math.ceil(width*channels*depth/8)+1;for(let row=0;row<height;row++){if(position+stride>raster.length||raster[position]>4)fail('invalid PNG scanlines');position+=stride;}}
 if(position!==raster.length)fail('PNG raster length differs from its declared dimensions');return shape;
}
function pointer(object,ref){let value=object;for(const key of ref.split('/').slice(1)){const k=key.replaceAll('~1','/').replaceAll('~0','~');if(!value||!Object.hasOwn(value,k))fail('missing approved scope clause');value=value[k];}if(typeof value!=='string')fail('scope source must name explicit text');return Buffer.from(value);}
function resolveEvidence(root,branch,request,state,item){
 let bytes;
 if(item.ref.startsWith('mission:/'))bytes=pointer(state.mission,item.ref.slice(8));
 else if(item.ref.startsWith('input:')){
  const kind=item.ref.slice(6),ref=request.inputs?.[kind];if(!ref)fail('undeclared business/source input '+kind);bytes=bytesOf(sessionOf(branch),ref);
 }else if(item.ref.startsWith('knowledge/')){
  const manifest=read(path.join(branch,'request/knowledge-manifest.json')),entry=manifest.files.find(file=>file.path===item.ref&&file.authority==='canonical');
  if(!entry||entry.sha256!==item.sha256)fail('unbound Grammar authority');bytes=bytesOf(root,item.ref);
 }else if(item.ref.startsWith('request/')){
  if(!request.frozenInputs?.some(input=>input.ref===item.ref&&input.sha256===item.sha256))fail('drawing input is not frozen');bytes=bytesOf(branch,item.ref);
 }else fail('drawing evidence must be approved mission text, a declared input or frozen request/knowledge');
 if(artHash(bytes)!==item.sha256)fail('drawing evidence hash changed');return bytes;
}
function walkEvidence(value,visit){if(!value||typeof value!=='object')return;if(typeof value.ref==='string'&&typeof value.sha256==='string'){visit(value);return;}for(const child of Object.values(value))if(Array.isArray(child))child.forEach(item=>walkEvidence(item,visit));else walkEvidence(child,visit);}
function exactIds(actual,expected,label){if(actual.length!==new Set(actual).size||!same([...actual].sort(),[...expected].sort()))fail(label+' must cover the exact declared set');}
export async function artRequestErrors(root,branch,request,{phase='predispatch'}={}){
 if(request.operatorId!==rule(root).operator)return[];
 try{
  const session=sessionOf(branch),live=read(path.join(session,'state.json')),state=phase==='accept'?invocationState(session,live,request):live;
  const ref=rule(root).brief,bytes=bytesOf(branch,ref),brief=JSON.parse(bytes);
  const errors=schema(root,'art-direction-brief',brief);if(errors.length)return errors;
  const viewportSchema=read(path.join(root,'templates/kinds/capture.schema.json')).properties.viewport;
  for(const viewport of brief.surface.viewports){const invalid=validateAgainst(viewportSchema,[viewport.width,viewport.height],'drawing viewport');if(invalid.length)return invalid;}
  if(!request.frozenInputs?.some(item=>item.ref===ref&&item.sha256===artHash(bytes)))fail('complete drawing brief is not frozen');
  if(brief.target!==request.requirements.target||brief.changeLevel!==request.requirements.changeLevel)fail('drawing target/change level differs');
  const compare=request.requirements.compare==='yes';
  if((request.requirements.selectionPolicy??'automatic')!==(compare?'approval-required':'automatic'))fail('only explicit comparison enables the user choice policy');
  if(compare&&!brief.comparisonRequest)fail('comparison requires the explicit user comparison request');
  if(!compare&&brief.comparisonRequest)fail('comparison authority cannot silently change the default one-direction job');
  if(brief.comparisonRequest){const source=resolveEvidence(root,branch,request,state,brief.comparisonRequest.source).toString('utf8');if(!source.includes(brief.comparisonRequest.statement))fail('comparison statement is absent from its frozen user source');}
  const checkout=sourceCheckoutOf(root,branch,request),head=request.contexts.find(c=>c.alias==='@workspaces/fe')?.head;
  if(!checkout||!head)fail('drawing source checkout is unbound');
  const git=(...args)=>execFileSync('git',['-C',checkout,...args],{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
  if(phase!=='accept'&&git('rev-parse','HEAD')!==head)fail('drawing source HEAD changed');
  for(const item of brief.sourceFiles){
   if(path.isAbsolute(item.path)||path.win32.isAbsolute(item.path)||item.path.includes('\\')||item.path.split('/').some(part=>!part||part==='.'||part==='..'))fail('source path escapes its checkout');
   const tree=git('ls-tree',head,'--',item.path);
   if(item.status==='absent'){if(tree||item.sha256!==null)fail('claimed absent source exists');}
   else{if(!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(tree))fail('source evidence is not a regular Git blob');const bytes=execFileSync('git',['-C',checkout,'show',head+':'+item.path],{windowsHide:true,stdio:['ignore','pipe','pipe']});if(artHash(bytes)!==item.sha256)fail('source blob differs from the observed drawing input');}
  }
  if(brief.unresolved.some(item=>item.necessary))fail('necessary drawing inputs remain unresolved');
  const necessary=[brief.business.purpose,...brief.business.actors.map(a=>a.description),...brief.business.journey.flatMap(j=>[j.action,j.outcome]),...brief.surface.states.map(s=>s.description),...brief.surface.information.map(i=>i.description)];
  if(necessary.some(item=>!['fact','intent'].includes(item.kind)))fail('necessary business/surface authority cannot be example or unknown');
  walkEvidence(brief,item=>resolveEvidence(root,branch,request,state,item));
  const manifest=read(path.join(branch,'request/knowledge-manifest.json')),family=read(path.join(branch,'request/family-understanding.json'));
  if(brief.grammar.manifestHash!==manifest.fingerprint||brief.grammar.family!==family.grammarId||brief.grammar.version!==family.packageBinding?.version)fail('drawing Grammar differs from the resolved family/version');
  visualBrief(brief);
  const ids=items=>items.map(item=>item.id);
  for(const items of [brief.business.actors,brief.business.journey,brief.surface.states,brief.surface.information,brief.content,brief.regions,brief.concepts])if(new Set(ids(items)).size!==items.length)fail('duplicate drawing identity');
  for(const journey of brief.business.journey)if(!ids(brief.business.actors).includes(journey.actor))fail('journey actor is unbound');
  for(const[collection,wanted]of [['journey',ids(brief.business.journey)],['states',ids(brief.surface.states)],['information',ids(brief.surface.information)],['content',ids(brief.content)]]){const covered=brief.regions.flatMap(r=>r[collection]);if(covered.some(id=>!wanted.includes(id))||wanted.some(id=>!covered.includes(id)))fail('region mapping omits or invents '+collection);}
  for(const item of [...brief.imageryPlan,...brief.grammar.adoption])if(!ids(brief.regions).includes(item.region))fail('imagery or Grammar adoption names an unknown region');
  if(brief.regions.some(r=>!brief.grammar.adoption.some(a=>a.region===r.id)))fail('region lacks Grammar adoption');
  for(const concept of brief.concepts)if(concept.business.some(id=>!ids(brief.business.journey).includes(id))||concept.grammar.some(id=>!ids(brief.regions).includes(id)))fail('concept is not grounded in business and Grammar adoption');
  if(brief.regions.some(r=>!brief.imageryPlan.some(p=>p.region===r.id)))fail('every region requires an imagery or native-content decision');
  if(compare&&request.resume){const errors=await artChoiceErrors(root,branch,state,request);if(errors.length)return errors;}
  return[];
 }catch(error){return[error.message];}
}
export function artDecisionId(request,briefBytes){return 'art-direction:'+request.sessionId+':v'+request.expected.goalVersion+':'+artHash(briefBytes).slice(7);}
export async function artResponseErrors(root,branch,request,response){
 if(!['done','blocked'].includes(response.status)||response.status==='blocked'&&response.stop!=='DIRECTION_CHOICE_REQUIRED')return[];
 try{
  const ref=response.fields?.['frontend-art-direction'];if(typeof ref!=='string')fail('missing art direction bundle');
  const bundle=JSON.parse(bytesOf(branch,ref)),errors=schema(root,'frontend-art-direction',bundle);if(errors.length)return errors;
  const briefBytes=verified(branch,bundle.brief),brief=JSON.parse(briefBytes),policy=read(path.join(root,'resources/interaction.json'));
  if(bundle.brief.ref!==rule(root).brief||bundle.target!==request.requirements.target||bundle.route!==brief.route||bundle.goalVersion!==request.expected.goalVersion)fail('bundle target/mission/brief mismatch');
  if(!same(bundle.grammar,brief.grammar)||bundle.source.head!==request.contexts.find(c=>c.alias==='@workspaces/fe')?.head)fail('bundle source/Grammar changed');
  if(bundle.decisionId!==artDecisionId(request,briefBytes))fail('bundle decision identity changed');
  const compare=request.requirements.compare==='yes';
  if(compare?(bundle.candidates.length<policy.minOptions||bundle.candidates.length>policy.maxOptions):bundle.candidates.length!==policy.artDirection.defaultCandidates)fail('default is one direction; comparison uses only explicitly requested option bounds');
  if(new Set(bundle.candidates.map(c=>c.id)).size!==bundle.candidates.length)fail('duplicate direction');
  const pngRefs=[];
  for(const candidate of bundle.candidates){
   const concept=brief.concepts.find(c=>c.id===candidate.concept);if(!concept)fail('candidate has no frozen concept');
   const prompt=verified(branch,candidate.prompt).toString('utf8');
   if(!prompt.includes(briefBytes.toString('utf8'))||!prompt.includes(JSON.stringify(concept)))fail('ImageGen prompt omits the complete frozen brief or selected concept');
   if(candidate.generation.inputHash!==artHash(briefBytes))fail('ImageGen input provenance differs');
   const image=verified(branch,candidate.png),shape=pngShape(image);if(shape.width!==candidate.png.width||shape.height!==candidate.png.height)fail('PNG dimensions differ');
   if(brief.surface&&!brief.surface.viewports.some(viewport=>shape.width>=viewport.width&&shape.height>=viewport.height))fail('direction PNG is smaller than every declared surface viewport');
   visualCandidate(brief,candidate);
   pngRefs.push(candidate.png.ref);exactIds(candidate.regions.map(r=>r.region),brief.regions.map(r=>r.id),'candidate regions');
   const session=sessionOf(branch),frozen=candidate.assets.length?invocationState(session,read(path.join(session,'state.json')),request):null;
   if(new Set(candidate.assets.map(asset=>asset.id)).size!==candidate.assets.length)fail('duplicate separately usable asset identity');
   for(const asset of candidate.assets){if(!brief.regions.some(r=>r.id===asset.region))fail('asset names an unknown region');walkEvidence(asset.provenance,item=>resolveEvidence(root,branch,request,frozen,item));}
   if(brief.imageryPlan.some(plan=>plan.reuse==='generate'&&plan.medium==='raster'&&!candidate.assets.some(asset=>asset.region===plan.region)))fail('generated region imagery lacks separately usable asset specification');
  }
  const declared=response.fields?.['art-direction-png'];exactIds(Array.isArray(declared)?declared:[declared],pngRefs,'declared PNG outputs');
  if(response.status==='blocked'){
   if(!compare||bundle.selected!==null||response.interaction?.decisionId!==bundle.decisionId||response.interaction?.kind!=='tier-choice')fail('only an explicit comparison needs the exact tier choice');
   exactIds(response.interaction.options.map(o=>o.id),bundle.candidates.map(c=>c.id),'choice options');
  }else{
   if(!bundle.candidates.some(c=>c.id===bundle.selected)||(compare&&(request.selectedOption!==bundle.selected||request.decisionId!==bundle.decisionId))||(!compare&&(bundle.selected!==bundle.candidates[0].id||request.decisionId||request.selectedOption)))fail('done direction must bind the actual selected PNG without a fabricated default user choice');
   const selected=bundle.candidates.find(c=>c.id===bundle.selected);
   if(compare){
    if(!request.resume)fail('a compared direction must resume its original accepted sheet');
    const previous=path.join(sessionOf(branch),`step-${request.resume.step}/parallel-${request.resume.parallel}`),original=await acceptedArt(root,previous);
    if(!same(bundle.candidates,original.bundle.candidates)||!same(bundle.grammar,original.bundle.grammar)||bundle.brief.sha256!==original.bundle.brief.sha256)fail('selection cannot redraw or replace the accepted candidate bytes');
   }
   if(response.outcome?.primary?.kind!=='image'||response.outcome.primary.ref!==selected.png.ref)fail('Operator Result must embed the selected PNG');
  }
  return[];
 }catch(error){return[error.message];}
}
export async function acceptedArt(root,branch){
 const session=sessionOf(branch),state=read(path.join(session,'state.json')),request=read(path.join(branch,'request/request.json')),response=read(path.join(branch,'response/response.json')),attempt=state.attempts?.[identity(request)];
 if(request.operatorId!==rule(root).operator||!attempt?.evidenceManifest||attempt.id!==request.attempt.id||!['blocked','matched'].includes(attempt.status))fail('directions need a sealed accepted art invocation');
 const errors=await evidenceManifestErrors(branch,attempt.evidenceManifest);if(errors.length)fail(errors.join('\n'));
 const {validateStep}=await import('./validate-step.mjs');const result=await validateStep(root,branch,{operator:true,requestPhase:'accept'});if(result.errors.length)fail(result.errors.join('\n'));
 return{session,state,request,response,attempt,bundle:JSON.parse(bytesOf(branch,response.fields['frontend-art-direction']))};
}
export async function renderArtSheet(root,branch){
 const {response,bundle}=await acceptedArt(root,branch);
 const shown=response.status==='done'?bundle.candidates.filter(c=>c.id===bundle.selected):bundle.candidates;
 const lines=['## Operator Result','',...shown.flatMap(c=>['![ '+c.title.replace(/[\[\]\r\n]/g,' ')+' ](<'+path.resolve(branch,c.png.ref).replaceAll('\\','/').replaceAll('>','%3E')+'>)','']),response.status==='done'?'Selected visual direction; frontend implementation and UAT remain unproved.':'Directions drawn; awaiting the actual user selection before frontend implementation.'];
 return lines.join('\n')+'\n';
}
export async function artChoiceErrors(root,branch,state,request){
 try{
  const choice=state.choices?.[request.decisionId];
  if(choice?.selectedBy!=='user'||!choice.basis||!request.resume)fail('compared PNG direction needs its actual recorded user selection');
  const session=sessionOf(branch),previous=path.join(session,`step-${request.resume.step}/parallel-${request.resume.parallel}`),art=await acceptedArt(root,previous);
  if(art.response.stop!=='DIRECTION_CHOICE_REQUIRED'||art.response.status!=='blocked'||art.request.expected.goalVersion!==state.mission.version||request.expected.goalVersion!==state.mission.version||request.operatorId!==art.request.operatorId||request.decisionId!==art.bundle.decisionId||request.selectedOption!==choice.selected)fail('direction choice belongs to another sheet or scope');
  const record=readContext(session,choice.basis,rule(root).context),candidate=art.bundle.candidates.find(c=>c.id===choice.selected),markdown=await renderArtSheet(root,previous);
  if(!candidate||record.requestHash!==state.requestHashes[identity(art.request)]||record.bundleHash!==artHash(bytesOf(previous,art.response.fields['frontend-art-direction']))||record.candidate!==choice.selected||!same(record.png,candidate.png)||record.markdown!==markdown||record.presentationHash!==artHash(markdown)||record.sourceRef!==choice.sourceRef||!record.presentationSourceRef)fail('user selection is not bound to the displayed original PNG sheet');
  return[];
 }catch(error){return[error.message];}
}
export async function recordArtChoice(root,branch,answer){
 if(answer.selectedBy!=='user'||!String(answer.sourceRef??'').trim()||!String(answer.presentationSourceRef??'').trim())fail('actual user choice and displayed-message source are required');
 const original=await acceptedArt(root,branch),markdown=await renderArtSheet(root,branch);
 if(original.response.status!=='blocked'||original.response.stop!=='DIRECTION_CHOICE_REQUIRED')fail('choice needs the accepted blocked direction sheet');
 if(answer.presentationHash!==artHash(markdown))fail('presentation is not the exact native PNG sheet');
 const candidate=original.bundle.candidates.find(c=>c.id===answer.selected);if(!candidate)fail('unoffered direction');
 return mutateSession(original.session,async state=>{
  if(state.mission.version!==original.request.expected.goalVersion)fail('choice scope is stale');
  const basis=await retainContext(original.session,rule(root).context,{version:1,requestHash:state.requestHashes[identity(original.request)],bundleHash:artHash(bytesOf(branch,original.response.fields['frontend-art-direction'])),candidate:candidate.id,png:candidate.png,markdown,presentationHash:answer.presentationHash,presentationSourceRef:answer.presentationSourceRef,sourceRef:answer.sourceRef,recordedAt:new Date().toISOString()});
  const choice={selected:answer.selected,selectedBy:'user',sourceRef:answer.sourceRef,basis},old=state.choices?.[original.bundle.decisionId];
  if(old)fail('preserve the original direction choice');state.choices??={};state.choices[original.bundle.decisionId]=choice;return{decisionId:original.bundle.decisionId,...choice};
 });
}
export async function recordArtPresentation(root,branch,shown){
 if(!String(shown.sourceRef??'').trim())fail('actual displayed-message source is required');
 const original=await acceptedArt(root,branch),markdown=await renderArtSheet(root,branch);
 if(shown.presentationHash!==artHash(markdown))fail('presentation is not the exact native PNG embed');
 return mutateSession(original.session,async state=>{
  if(state.mission.version!==original.request.expected.goalVersion)fail('presentation scope is stale');
  const value={version:1,requestHash:state.requestHashes[identity(original.request)],bundleHash:artHash(bytesOf(branch,original.response.fields['frontend-art-direction'])),markdown,presentationHash:shown.presentationHash,sourceRef:shown.sourceRef,recordedAt:new Date().toISOString()};
  const key='art-presented:'+value.bundleHash.slice(7);
  if(state.choices?.[key])return{decisionId:key,...state.choices[key]};
  const basis=await retainContext(original.session,rule(root).context,value),record={selected:'presented',selectedBy:'coordinator',sourceRef:shown.sourceRef,basis};
  state.choices??={};state.choices[key]=record;return{decisionId:key,...record};
 });
}
export async function artConsumerErrors(root,branch,request,{phase='predispatch'}={}){
 if(request.operatorId!=='interface.generate')return[];
 const required=rule(root).visualChangeLevels.includes(request.requirements?.changeLevel),ref=request.inputs?.['frontend-art-direction'];
 if(!required&&!ref)return[];
 try{
  const session=sessionOf(branch),live=read(path.join(session,'state.json')),attempt=live.attempts?.[identity(request)];
  if(!ref){
   if(phase==='accept'&&attempt?.status==='matched'&&attempt.context&&attempt.evidenceManifest){
    invocationState(session,live,request);const errors=await evidenceManifestErrors(branch,attempt.evidenceManifest);if(errors.length)fail(errors.join('\n'));return[];
   }
   fail('visual creation/redesign requires a prior accepted PNG direction');
  }
  if(!/^step-\d+\/parallel-\d+\/response\/data\/art-direction\.json$/.test(ref))fail('direction input must name its exact accepted bundle');
  const producer=path.resolve(session,ref,'../../..'),art=await acceptedArt(root,producer);
  const state=phase==='accept'?invocationState(session,live,request):live;
  if(art.response.status!=='done'||art.bundle.goalVersion!==request.expected.goalVersion||art.bundle.target!==request.requirements.target)fail('direction selection is absent, stale or for a different target');
  const hash=artHash(bytesOf(session,ref)),shown=state.choices?.['art-presented:'+hash.slice(7)];
  if(shown?.selected!=='presented'||shown.selectedBy!=='coordinator'||!shown.basis)fail('selected PNG has not been shown inline before frontend admission');
  const record=readContext(session,shown.basis,rule(root).context);
  if(record.bundleHash!==hash||record.requestHash!==art.state.requestHashes[identity(art.request)]||record.sourceRef!==shown.sourceRef||record.presentationHash!==artHash(record.markdown)||record.markdown!==await renderArtSheet(root,producer))fail('presentation does not bind the exact selected PNG');
  if(!Number.isFinite(Date.parse(record.recordedAt)))fail('presentation time is invalid');
  if(attempt?.startedAt&&Date.parse(record.recordedAt)>Date.parse(attempt.startedAt))fail('PNG presentation happened after frontend invocation opened');
  if((request.requirements.candidates??1)!==1||request.requirements.selectionPolicy==='approval-required'||request.requirements.approval)fail('HTML cannot choose a competing direction after PNG selection');
  const fe=request.contexts?.find(c=>c.alias==='@workspaces/fe')?.head,checkout=sourceCheckoutOf(root,branch,request);
  if(!checkout||!fe)fail('frontend has no actual checkout/source binding');
  execFileSync('git',['-C',checkout,'merge-base','--is-ancestor',art.bundle.source.head,fe],{stdio:'pipe',windowsHide:true});
  const manifest=read(path.join(branch,'request/knowledge-manifest.json'));
  if(manifest.fingerprint!==art.bundle.grammar.manifestHash)fail('frontend Grammar changed from the selected direction');
  return[];
 }catch(error){return[error.message];}
}
export async function artAdoptionErrors(root,branch,request,response){
 const input=request.inputs?.['frontend-art-direction'];if(!input||response.status!=='done')return[];
 try{
  const ref=response.fields?.['art-direction-adoption'];if(typeof ref!=='string')fail('missing selected direction adoption');
  const adoption=JSON.parse(bytesOf(branch,ref)),errors=schema(root,'art-direction-adoption',adoption);if(errors.length)return errors;
  const session=sessionOf(branch),bundle=JSON.parse(bytesOf(session,input)),selected=bundle.candidates.find(c=>c.id===bundle.selected);
  if(adoption.direction.ref!==input||adoption.direction.sha256!==artHash(bytesOf(session,input))||adoption.candidate!==selected?.id||adoption.png.ref!==selected.png.ref||adoption.png.sha256!==selected.png.sha256)fail('implementation replaced the selected PNG');
  exactIds(adoption.regions.map(r=>r.region),selected.regions.map(r=>r.region),'implemented direction regions');
  for(const region of adoption.regions)verified(branch,region.evidence);
  exactIds(adoption.assets.map(a=>a.id),selected.assets.map(a=>a.id),'realized asset identities');
  for(const asset of adoption.assets){if(selected.assets.find(item=>item.id===asset.id)?.region!==asset.region)fail('realized asset moved to a different region');verified(branch,asset);}
  const drawingBranch=path.join(session,input.split('/response/')[0]),brief=JSON.parse(verified(drawingBranch,bundle.brief));
  visualAdoption(brief,selected,adoption,branch,{verified,pngShape,hash:artHash,reference:item=>verified(drawingBranch,item),source:ref=>{
   if(typeof ref!=='string'||path.isAbsolute(ref)||path.win32.isAbsolute(ref)||ref.includes('\\')||ref.split('/').some(p=>!p||p==='.'||p==='..'))fail('unsafe implemented anatomy source');
   const checkout=sourceCheckoutOf(root,branch,request),head=response.commits?.at(-1);if(!checkout||!head)fail('implemented anatomy lacks committed source');
   const entry=execFileSync('git',['-C',checkout,'ls-tree',head,'--',ref],{encoding:'utf8',windowsHide:true});if(!/^100(644|755) blob /.test(entry))fail('anatomy must bind a regular committed source blob');
   return execFileSync('git',['-C',checkout,'show',head+':'+ref],{windowsHide:true});
  }});
  const directionText=bytesOf(branch,response.fields['frontend-direction-decision']).toString('utf8');
  const {tableUnder}=await import('./validate-response.mjs');
  const selectedHtml=(tableUnder(directionText,'## Decision')??[]).find(row=>row[0]==='Selected candidate')?.[1];
  if(String(selectedHtml).replaceAll('`','')!==selected.id)fail('HTML render must realize the selected PNG identity');
  return[];
 }catch(error){return[error.message];}
}
export async function artAuditAdmissionErrors(root,branch,request,{phase='predispatch'}={}){
 if(request.operatorId!=='interface.audit')return[];
 try{
  const session=sessionOf(branch),sourceRef=request.inputs?.['frontend-source-application'];if(!sourceRef)return[];
  const sourceBranch=path.dirname(path.dirname(path.join(session,sourceRef))),source=read(path.join(sourceBranch,'response/response.json'));
  if(!source.fields?.['art-direction-adoption'])return[];
  const ref=request.inputs?.['quality-verification'];if(typeof ref!=='string'||!/^step-\d+\/parallel-\d+\/response\/response\.md$/.test(ref))fail('art-directed final audit requires accepted technical gate proof');
  const qualityBranch=path.dirname(path.dirname(path.join(session,ref))),qualityRequest=read(path.join(qualityBranch,'request/request.json')),quality=read(path.join(qualityBranch,'response/response.json'));
  const live=read(path.join(session,'state.json')),attempt=live.attempts?.[identity(qualityRequest)];
  if(qualityRequest.operatorId!=='quality.verify'||attempt?.status!=='matched'||quality.status!=='done'||qualityRequest.inputs?.['frontend-source-application']!==sourceRef||quality.fields?.['quality-verification']!==path.relative(qualityBranch,path.join(session,ref)).replaceAll('\\','/'))fail('technical proof is not accepted for this exact source');
  const errors=await evidenceManifestErrors(qualityBranch,attempt.evidenceManifest);if(errors.length)fail(errors.join('\n'));
  const {validateStep}=await import('./validate-step.mjs');const checked=await validateStep(root,qualityBranch,{operator:true,requestPhase:'accept'});if(checked.errors.length)fail(checked.errors.join('\n'));
  const head=request.contexts?.find(c=>c.alias==='@workspaces/fe')?.head;
  if(!head||qualityRequest.contexts?.find(c=>c.alias==='@workspaces/fe')?.head!==head||!source.commits?.includes(head))fail('technical proof is stale for the audited source HEAD');
  const gates=qualityRequest.requirements.gates?.filter(g=>g.required),refs=quality.fields['gate-result'];
  if(!gates?.length||!Array.isArray(refs))fail('technical proof lacks its required frozen command plan');
  const records=refs.map(ref=>read(safe(qualityBranch,ref)));
  for(const gate of gates){const result=records.find(r=>r.gate===gate.gate);if(!result||result.commandRef!==gate.commandRef||result.configRef!==gate.configRef||result.sourceHead!==head||result.predecessorCommit!==head||result.status!=='pass'||result.exitCode!==0||result.required!==true||result.debt)fail('required exact-head technical command did not pass');}
  if(phase!=='accept'){const checkout=sourceCheckoutOf(root,branch,request);if(!checkout||execFileSync('git',['-C',checkout,'rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim()!==head)fail('source advanced after technical proof');}
  return[];
 }catch(error){return[error.message];}
}
export async function artFidelityErrors(root,branch,request,response){
 if(response.status!=='done'||request.contractVersion!=='starci/v2.2')return[];
 try{
  const sourceRef=request.inputs?.['frontend-source-application'];if(!sourceRef)return[];
  const session=sessionOf(branch),sourceBranch=path.dirname(path.join(session,sourceRef)),source=read(path.join(sourceBranch,'response.json')),adoptionRef=source.fields?.['art-direction-adoption'];
  if(!adoptionRef)return[];
  const producer=path.dirname(sourceBranch),adoptionBytes=bytesOf(producer,adoptionRef),adoption=JSON.parse(adoptionBytes),ref=response.fields?.['art-direction-fidelity'];
  if(typeof ref!=='string')fail('audit must compare the actual render with its selected PNG');
  const fidelity=JSON.parse(bytesOf(branch,ref)),errors=schema(root,'art-direction-fidelity',fidelity);if(errors.length)return errors;
  if(fidelity.adoption.ref!==path.relative(session,path.join(producer,adoptionRef)).replaceAll('\\','/')||fidelity.adoption.sha256!==artHash(adoptionBytes)||!same(fidelity.direction,adoption.direction)||!same(fidelity.png,adoption.png)||fidelity.candidate!==adoption.candidate)fail('fidelity compares a different direction/implementation');
  exactIds(fidelity.results.map(r=>r.region),adoption.regions.map(r=>r.region),'fidelity regions');
  const verdicts=read(safe(branch,response.fields.verdicts)),screenshots=response.fields.screenshot??[];
  for(const result of fidelity.results){
   pngShape(verified(branch,result.capture));
   if(!screenshots.includes(result.capture.ref))fail('fidelity image is not an actual declared audit screenshot');
   const entry=verdicts.entries.find(e=>e.matrixId===result.matrixId),judged=entry?.results.find(r=>r.path===result.path&&r.rule===result.rule);
   if(!judged||judged.verdict!==result.verdict)fail('fidelity result is absent from the actual owner-routed audit verdict');
   const captureRef=(response.fields.capture??[]).find(ref=>read(safe(branch,ref)).matrixId===result.matrixId);
   if(!captureRef||result.capture.ref!==`response/artifacts/${result.matrixId}.png`)fail('fidelity image does not match its measured audit matrix');
  }
  const bundle=JSON.parse(bytesOf(session,adoption.direction.ref)),drawingBranch=path.join(session,adoption.direction.ref.split('/response/')[0]),brief=JSON.parse(verified(drawingBranch,bundle.brief));
  visualFidelity(brief,bundle.candidates.find(c=>c.id===bundle.selected),fidelity,response,branch,{verified,pngShape,read:(base,ref)=>JSON.parse(bytesOf(base,ref))},read(path.join(root,'templates/kinds/art-direction-fidelity.schema.json')).properties.checks.items.properties.axis.enum);
  if(fidelity.verdict!==(fidelity.results.every(r=>r.verdict==='pass')?'pass':'fail'))fail('fidelity verdict hides a changed region');
  return[];
 }catch(error){return[error.message];}
}
// Goal projection only: old source receipts remain immutable, while their applied surface needs
// accepted exact-source technical and rendered proof. This never dispatches or grants effects.
export async function artDeliveryCoverage(root,session,state,active,verify){
 const errors=[],groups=new Map(),proofs=new Map();
 const proof=async cell=>{if(!proofs.has(cell))proofs.set(cell,await verify(cell));return proofs.get(cell);};
 for(const cell of active){
  if(state.steps[cell]!=='interface.generate'||state.attempts?.[cell]?.status!=='matched'||state.attempts[cell].expected?.goalVersion!==state.mission.version)continue;
  try{
   const [n,m]=cell.split('/'),branch=path.join(session,'step-'+n,'parallel-'+m),request=read(path.join(branch,'request/request.json'));
   if(!request.inputs?.['frontend-art-direction']||request.requirements.mode!=='apply'||!Number.isInteger(request.goal?.doneWhen))continue;
   const source=await proof(cell),goal=request.goal.doneWhen,key='art-surface:'+goal+':'+(request.unit??'')+':'+request.requirements.target;
   const prior=groups.get(key);if(!prior||Date.parse(source.attempt.endedAt)>Date.parse(prior.source.attempt.endedAt))groups.set(key,{key,goal,cell,source,complete:false});
  }catch(error){errors.push(error.message);}
 }
 for(const row of groups.values()){
  const input=path.relative(session,path.join(row.source.branch,row.source.response.fields['frontend-source-application'])).replaceAll('\\','/');
  for(const cell of active){
   if(state.steps[cell]!=='interface.audit'||state.attempts?.[cell]?.status!=='matched'||state.attempts[cell].expected?.goalVersion!==state.mission.version)continue;
   try{
    const [n,m]=cell.split('/'),branch=path.join(session,'step-'+n,'parallel-'+m),request=read(path.join(branch,'request/request.json'));
    if(request.inputs?.['frontend-source-application']!==input)continue;
    const audit=await proof(cell),checked=[...await artAuditAdmissionErrors(root,branch,request,{phase:'accept'}),...await artFidelityErrors(root,branch,request,audit.response)];
    if(checked.length)fail(checked.join('\n'));
    const fidelity=read(safe(branch,audit.response.fields['art-direction-fidelity']));
    const {tableUnder}=await import('./validate-response.mjs'),{AUDIT_TOPICS}=await import('../operators/interface-audit/validate.mjs');
    const topics=tableUnder(bytesOf(branch,audit.response.fields['frontend-surface-audit']).toString('utf8'),'## Verdict')??[];
    if(fidelity.verdict==='pass'&&AUDIT_TOPICS.every(topic=>topics.some(([name,verdict,route])=>name===topic&&['pass','ship'].includes(verdict)&&route==='none'))){row.complete=true;row.audit=cell;break;}
   }catch(error){errors.push(error.message);}
  }
 }
 return{errors,rows:[...groups.values()].map(({source,...row})=>row)};
}
async function main(){const root=path.resolve(import.meta.dirname,'..'),[operation,target,file]=process.argv.slice(2);if(operation==='present')process.stdout.write(await renderArtSheet(root,path.resolve(target)));else if(operation==='answer')process.stdout.write(JSON.stringify(await recordArtChoice(root,path.resolve(target),read(file)))+'\n');else if(operation==='shown')process.stdout.write(JSON.stringify(await recordArtPresentation(root,path.resolve(target),read(file)))+'\n');else throw Error('usage: art-direction.mjs present <branch> | shown <branch> <display.json> | answer <branch> <actual-answer.json>');}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
