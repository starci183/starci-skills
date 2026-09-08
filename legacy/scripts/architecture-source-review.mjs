import {readFileSync,realpathSync,existsSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {validateAgainst} from './json-schema.mjs';
import {evidenceManifestErrors} from './evidence-manifest.mjs';
import {invocationState} from './mission-history.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const json=file=>JSON.parse(readFileSync(file,'utf8'));
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const policy=root=>json(path.join(root,'templates/kinds/architecture-source-review.schema.json')).review;
const git=(dir,...args)=>execFileSync('git',['-C',dir,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
const text=(dir,...args)=>git(dir,...args).toString('utf8').trim();
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const safe=ref=>typeof ref==='string'&&!path.isAbsolute(ref)&&!ref.includes('\\')&&!ref.split('/').some(part=>!part||part==='.'||part==='..')&&!ref.includes(':');
function location(branch){const parent=path.dirname(branch),session=path.resolve(parent,'../..');return{parent,session,state:json(path.join(session,'state.json'))};}
function inputs(parent){return{request:json(path.join(parent,'request/request.json')),current:json(path.join(parent,'response/data/current-state.json')),model:json(path.join(parent,'response/data/stack-model.json'))};}
function pathsOf(current,head){
 const refs=[...(current.components??[]),...(current.boundaries??[])].map(row=>row.evidence);
 return [...new Set(refs.map(ref=>{const match=/^(.+?)(?::\d+(?:-\d+)?)?@([a-f0-9]{40})$/.exec(ref??'');if(!match||match[2]!==head||!safe(match[1]))throw Error('CRITIQUE_SOURCE_UNBOUND: observed evidence must name a safe path at the frozen head');return match[1];}))].sort();
}
async function parentInputErrors(root,branch,request){
 const{session,state}=location(branch);const {localAcceptedInputErrors}=await import('./validate-request.mjs');
 return localAcceptedInputErrors(session,state,request.inputs?.['stack-model'],'stack-model',request);
}
function boundCheckout(parent,state,alias){
 const role=alias.slice('@workspaces/'.length);
 for(const[key,attempt]of Object.entries(state.attempts??{}).reverse()){
  if(attempt.operatorId!=='workspace.bind'||attempt.status!=='matched')continue;
  if(!/^[1-9]\d*\/[1-9]\d*$/.test(key))throw Error('CRITIQUE_SOURCE_UNBOUND: invalid source binding coordinate');
  const [step,parallel]=key.split('/'),canonical=`step-${step}/parallel-${parallel}`;
  if(attempt.requestRef!==`${canonical}/request/request.json`||attempt.responseRef!==`${canonical}/response/response.json`)throw Error('CRITIQUE_SOURCE_UNBOUND: noncanonical source binding references');
  const request=json(path.join(path.resolve(parent,'../..'),attempt.requestRef));
  if(request.requirements.role!==role)continue;
  const responseFile=path.join(path.resolve(parent,'../..'),attempt.responseRef),response=json(responseFile);
  if(response.fields?.route!=='response/data/route.json'||existsSync(path.join(path.dirname(path.dirname(responseFile)),'import.json')))throw Error('CRITIQUE_SOURCE_UNBOUND: source binding must be a canonical local accepted route');
  const route=json(path.join(path.dirname(path.dirname(responseFile)),response.fields.route));
  if(route.role!==role||route.project!==state.project)continue;
  return{checkout:realpathSync(route.checkout.diskPath),repository:route.checkout.gitRepository,branchKey:key,branch:path.dirname(path.dirname(responseFile)),attempt};
 }
 throw Error('CRITIQUE_SOURCE_UNBOUND: no accepted source binding owns the inspected repository');
}
function readBlob(checkout,head,ref){
 if(!safe(ref))throw Error('CRITIQUE_SOURCE_UNBOUND: unsafe source path');
 const row=text(checkout,'-c','core.quotePath=false','ls-tree',head,'--',ref),match=/^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
 if(!match||match[3]!==ref)throw Error('CRITIQUE_SOURCE_UNBOUND: source must be an exact regular Git blob, never a symlink or subtree');
 const bytes=git(checkout,'cat-file','blob',match[2]),content=bytes.toString('utf8');
 if(!Buffer.from(content).equals(bytes)||content.includes('\0'))throw Error('CRITIQUE_SOURCE_UNBOUND: review source must be UTF-8 text');
 const size=json(path.join(ROOT,'templates/kinds/architecture-source-review.schema.json')).properties.files.items.properties.chunks.items.maxLength;
 const chunks=[];for(let i=0;i<content.length;i+=size)chunks.push(content.slice(i,i+size));
 return{path:ref,blob:match[2],sha256:sha(bytes),chunks};
}

export async function collectArchitectureSource(root,branch,{extraPaths=[]}={}){
 const{parent,state}=location(branch),{request,current,model}=inputs(parent),alias='@workspaces/be';
 const head=request.contexts?.find(item=>item.alias===alias)?.head;
 if(!/^[a-f0-9]{40}$/.test(head??'')||current.observedHead!==head)throw Error('CRITIQUE_SOURCE_UNBOUND: parent observed source and frozen HEAD differ');
 const bound=boundCheckout(parent,state,alias);
 const sealErrors=await evidenceManifestErrors(bound.branch,bound.attempt.evidenceManifest);if(sealErrors.length)throw Error(sealErrors.join('\n'));
 const session=path.resolve(parent,'../..'),bindingRequest=json(path.join(bound.branch,'request/request.json'));
 invocationState(session,state,bindingRequest);
 const {localAcceptedInputErrors}=await import('./validate-request.mjs');
 const routeErrors=await localAcceptedInputErrors(session,state,`${bound.attempt.responseRef.slice(0,-'response.json'.length)}data/route.json`,'route');
 if(routeErrors.length)throw Error(routeErrors.join('\n'));
 const parentState=invocationState(session,state,request),declared=parentState.mission?.discovery?.repositories?.find(repository=>repository.role===alias.slice('@workspaces/'.length)&&repository.project===state.project);
 if(!declared||declared.repository!==bound.repository)throw Error('CRITIQUE_SOURCE_UNBOUND: accepted checkout differs from the parent confirmed repository');
 const actualRoot=realpathSync(text(bound.checkout,'rev-parse','--show-toplevel'));
 if(actualRoot!==bound.checkout||text(bound.checkout,'remote','get-url','origin')!==bound.repository)throw Error('CRITIQUE_SOURCE_UNBOUND: actual checkout or repository identity differs from accepted binding');
 const required=pathsOf(current,head);
 for(const ref of (model.operations??[]).flatMap(operation=>[operation.writerRef,...(operation.migrationRefs??[])])){
  if(!safe(ref))throw Error('CRITIQUE_SOURCE_UNBOUND: unsafe proposed operation path');
  // Existing affected implementation is observed too. Missing proposed paths are not invented source.
  if(text(bound.checkout,'ls-tree',head,'--',ref))required.push(ref);
 }
 const files=[...new Set([...required,...extraPaths])].sort().map(ref=>readBlob(bound.checkout,head,ref));
 return{version:1,parent:{sessionId:request.sessionId,step:request.step,parallel:request.parallel,attemptId:request.attempt.id,requestHash:sha(readFileSync(path.join(parent,'request/request.json'))),currentStateHash:sha(readFileSync(path.join(parent,'response/data/current-state.json'))),modelHash:sha(readFileSync(path.join(parent,'response/data/stack-model.json')))},
  alias,head,tree:text(bound.checkout,'rev-parse',`${head}^{tree}`),repository:bound.repository,constraints:request.requirements.constraints,tradeoffAxes:request.requirements.tradeoffAxes,files};
}

async function sealedChild(branch,request,state){
 const key=`${request.step}/${request.parallel}/${request.exchange}`,attempt=state.attempts?.[key];
 if(attempt?.status!=='matched'||attempt.id!==request.attempt?.id||state.requestHashes?.[key]!==sha(readFileSync(path.join(branch,'request/request.json')))||!attempt.context)return false;
 const canonical=`step-${request.step}/parallel-${request.parallel}/${request.exchange}`;
 if(attempt.requestRef!==`${canonical}/request/request.json`||attempt.responseRef!==`${canonical}/response/response.json`||!Number.isFinite(Date.parse(attempt.endedAt)))return false;
 if(!equal(json(path.join(branch,'request/request.json')),request))return false;
 const response=json(path.join(branch,'response/response.json'));
 if(response.status!=='done'||response.attempt?.id!==request.attempt.id||response.comparison?.verdict!=='matched')return false;
 if((await evidenceManifestErrors(branch,attempt.evidenceManifest)).length)return false;
 try{
  const {session}=location(branch);invocationState(session,state,request);
  const{localAcceptedInputErrors}=await import('./validate-request.mjs');
  return (await localAcceptedInputErrors(session,state,`${canonical}/response/critique.md`,'independent-critique')).length===0;
 }catch{return false;}
}

export async function architectureSourceRequestErrors(root,branch,request,{phase='predispatch'}={}){
 if(request.operatorId!=='architecture.decide'||request.exchange!=='critique'||request.contractVersion!=='starci/v2.2')return[];
 const errors=[];
 try{
  const{parent,state}=location(branch),frozen=policy(root),entry=request.frozenInputs?.find(item=>item.ref===frozen.snapshotRef);
  const historical=await sealedChild(branch,request,state);
  if(!entry){if(historical)return[];throw Error('fresh critique requires the frozen source snapshot');}
  const bytes=readFileSync(path.join(branch,frozen.snapshotRef));if(sha(bytes)!==entry.sha256)throw Error('source snapshot changed after freezing');
  const snapshot=JSON.parse(bytes),schema=json(path.join(root,'templates/kinds/architecture-source-review.schema.json'));
  errors.push(...validateAgainst(schema,snapshot,'architecture source snapshot'));if(errors.length)return errors;
  const original=inputs(parent),p=original.request,head=p.contexts?.find(item=>item.alias===snapshot.alias)?.head;
  if(snapshot.alias!=='@workspaces/be'||snapshot.head!==head||original.current.observedHead!==head)throw Error('source snapshot must bind the exact parent source HEAD');
  const expected={sessionId:p.sessionId,step:p.step,parallel:p.parallel,attemptId:p.attempt.id,requestHash:sha(readFileSync(path.join(parent,'request/request.json'))),currentStateHash:sha(readFileSync(path.join(parent,'response/data/current-state.json'))),modelHash:sha(readFileSync(path.join(parent,'response/data/stack-model.json')))};
  if(!equal(snapshot.parent,expected)||!equal(snapshot.constraints,p.requirements.constraints)||!equal(snapshot.tradeoffAxes,p.requirements.tradeoffAxes))throw Error('source snapshot differs from its parent identity, frozen constraints or selected model');
  if(!request.contexts?.some(item=>item.alias===snapshot.alias&&item.head===head)||!request.environment.reads.includes(snapshot.alias))throw Error('critique must receive its actual frozen source context');
  if(Object.keys(request.inputs??{}).some(kind=>kind!=='stack-model'))throw Error('critique must not receive author rationale or additional authored Inputs');
  const required=pathsOf(original.current,head),actual=snapshot.files.map(file=>file.path);
  if(new Set(actual).size!==actual.length||required.some(ref=>!actual.includes(ref)))throw Error('source snapshot omits observed boundary or component evidence');
  for(const file of snapshot.files)if(!safe(file.path)||sha(Buffer.from(file.chunks.join('')))!==file.sha256)throw Error('source snapshot contains an unsafe path or tampered source bytes');
  errors.push(...await parentInputErrors(root,branch,request));
  const key=`${request.step}/${request.parallel}/${request.exchange}`,attempt=state.attempts?.[key];
  let opened=false;
  if(attempt?.context&&state.requestHashes?.[key]===sha(readFileSync(path.join(branch,'request/request.json')))&&equal(attempt.frozenInputs,request.frozenInputs)){
   try{invocationState(location(branch).session,state,request);opened=true;}catch{}
  }
  if(!historical&&(phase!=='accept'||!opened)){
   const observed=await collectArchitectureSource(root,branch,{extraPaths:actual});
   if(!equal(observed,snapshot))throw Error('source snapshot is not the actual bound Git tree and blobs');
  }
 }catch(error){errors.push('CRITIQUE_SOURCE_UNBOUND: '+error.message);}
 return errors;
}

export async function architectureSourceCritiqueErrors(root,parent){
 const branch=path.join(parent,'critique'),file=path.join(branch,'request/request.json');if(!existsSync(file))return[];
 const request=json(file),binding=request.frozenInputs?.find(item=>item.ref===policy(root).snapshotRef);
 if(!binding)return[]; // Fresh omission is refused at request admission; historical receipts keep their exact shape.
 const errors=await architectureSourceRequestErrors(root,branch,request,{phase:'accept'});
 if(errors.length||!existsSync(path.join(branch,'response/critique.md')))return errors;
 const {tableUnder}=await import('./validate-response.mjs');const critique=readFileSync(path.join(branch,'response/critique.md'),'utf8');
 const execution=Object.fromEntries(tableUnder(critique,'## Execution')??[]),snapshot=json(path.join(branch,policy(root).snapshotRef));
 if(execution['Source snapshot']!==binding.sha256)errors.push('critique: Source snapshot must identify the exact frozen source digest');
 for(const row of policy(root).analysisRows)if(!execution[row]?.trim())errors.push(`critique: independent ${row} is required`);
 const paths=new Set(snapshot.files.map(file=>file.path));
 for(const row of tableUnder(critique,'## Attacks')??[]){const refs=[...(row[1]??'').matchAll(/\[source:([^\]]+)\]/g)].map(match=>match[1]);if(!refs.length||refs.some(ref=>!paths.has(ref)))errors.push(`critique: ${row[0]} must tie its attack to independently supplied source evidence`);}
 return errors;
}

if(process.argv[1]&&path.resolve(process.argv[1])===path.resolve(import.meta.filename)){
 const branch=path.resolve(process.argv[2]??'.');
 collectArchitectureSource(ROOT,branch).then(snapshot=>{
  const {state}=location(branch),request=json(path.join(branch,'request/request.json')),key=`${request.step}/${request.parallel}/${request.exchange}`;
  if(state.attempts?.[key]||state.requestHashes?.[key])throw Error('source snapshot preparation requires an unopened draft');
  const ref=policy(ROOT).snapshotRef,bytes=JSON.stringify(snapshot,null,2)+'\n';writeFileSync(path.join(branch,ref),bytes);console.log(JSON.stringify({ref,sha256:sha(bytes),context:{alias:snapshot.alias,head:snapshot.head}}));
 }).catch(error=>{console.error(error.message);process.exitCode=1;});
}
