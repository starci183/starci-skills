import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {authoredWorkspace,validateWorkspace,canonicalJSON,sha256} from '../core/index.mjs';

const hash=x=>sha256(canonicalJSON(x));
const same=(a,b)=>a!==undefined&&b!==undefined&&hash(a)===hash(b);
const need=(ok,message)=>{if(!ok)throw Error(message);};
const recoverable=new Set(['STALE_COMPLETION','STALE_EVIDENCE','DEPENDENCY_NOT_DONE']);
const designKinds={'business.decide':'business','architecture.decide':'architecture','interface.draw':'ui'};
const implementationKinds={'backend.implement':'implementation','interface.implement':'implementation'};
const implementationPolicy=cell=>cell.workPolicy?.schema==='starci/implementation-output@1';
const authoredKind=cell=>implementationPolicy(cell)?implementationKinds[cell.op]:designKinds[cell.op];
const inside=(root,file)=>{const r=path.relative(root,file);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const targets=(run,cell)=>cell.workTargets??run.goal.workTargets;
const bindings=(work,ids)=>ids.map(id=>{const n=work.nodes.find(n=>n.id===id);need(n,'Work target is missing');return {id,contextDigest:n.contextDigest,inputDigest:n.inputDigest};});

export function validateWorkPolicy(goal,cell){
 if(cell.workPolicy===undefined)return false;
 const p=cell.workPolicy;
 need(p&&Object.keys(p).every(k=>(implementationPolicy(cell)?['schema','targets']:['schema','targets','assetWrites']).includes(k))&&(p.schema==='starci/authored-work@1'&&designKinds[cell.op]||implementationPolicy(cell)&&implementationKinds[cell.op])&&Array.isArray(p.targets)&&p.targets.length&&p.targets.every(x=>typeof x==='string'&&x)&&new Set(p.targets).size===p.targets.length,'Explicit supported authored Work policy required');
 need(same(p.targets,cell.workTargets??goal.workTargets),'Authored policy must name the exact selected cell leaves');
 if(p.assetWrites!==undefined)need(Array.isArray(p.assetWrites)&&p.assetWrites.every(a=>a&&Object.keys(a).sort().join(',')==='nodeId,path'&&p.targets.includes(a.nodeId)&&typeof a.path==='string'&&a.path.startsWith('assets/')&&!a.path.includes('\\')&&!a.path.includes(':')&&a.path.split('/').every(p=>p&&p!=='.'&&p!=='..'))&&new Set(p.assetWrites.map(a=>a.nodeId+':'+a.path)).size===p.assetWrites.length,'Asset writes need exact selected owners and normalized assets paths');
 return true;
}
function assertWrite(run,file){
 file=path.resolve(file);const root=path.resolve(run.workRoot);
 need(inside(root,file)&&fs.realpathSync(root)===root,'Authored Work path escapes its real owner');
 let cursor=file;while(cursor!==root){need(inside(root,cursor)&&(!fs.existsSync(cursor)||!fs.lstatSync(cursor).isSymbolicLink()),'Authored Work cannot follow links');const parent=path.dirname(cursor);need(parent!==cursor,'Authored Work ancestor escaped root');cursor=parent;}
 const resource=run.goal.resourceEffects.some(e=>run.goal.scope.resources.includes(e.target)&&path.isAbsolute(e.target)&&path.resolve(e.target)===file);
 const code=run.goal.impacts.some(i=>run.goal.scope.paths.includes(i.repository+':'+i.path)&&run.repositories[i.repository]&&path.resolve(run.repositories[i.repository],i.path)===file);
 need(resource||code,'Every authored leaf and asset needs its exact approved write ceiling');
}
function authored(run,cell){
 need(validateWorkPolicy(run.goal,cell),'Missing frozen authored Work policy');
 const work=authoredWorkspace(run.workRoot,targets(run,cell));
 need(work.authoredBinding&&work.errors.every(e=>recoverable.has(e.code)),'Authored Work graph is invalid');
 for(const item of work.authoredBinding){need(item.schema==='work/node@2'&&item.kind===authoredKind(cell),'Authored operator does not own this leaf kind');assertWrite(run,path.join(run.workRoot,item.path));for(const asset of cell.workPolicy.assetWrites??[])if(asset.nodeId===item.id)assertWrite(run,path.resolve(run.workRoot,path.dirname(item.path),asset.path));}
 if(implementationPolicy(cell))work.implementationInputs=work.authoredBinding.map(item=>{
   const side=cell.op==='backend.implement'?'backend':'frontend';
   need(item.path.includes('/implementation/'+side+'/'),'Implementation operator must own its backend/frontend leaf');
   const meta=parseYaml(fs.readFileSync(path.join(run.workRoot,item.path),'utf8'));
   // Only actual implementation payload is writable. Expectations, descriptions,
   // sourceRefs, imports, extensions and every unknown future semantic key stay bound.
   for(const key of ['implementation','state','activity','completion','investigation','history'])delete meta[key];
   return {id:item.id,digest:hash(meta)};
 });
 return work;
}
function invariant(work,cell){return {nodes:work.authoredBinding,assets:work.authoredAssets.map(item=>({id:item.id,assets:item.assets.filter(asset=>!(cell.workPolicy.assetWrites??[]).some(a=>a.nodeId===item.id&&a.path===asset.path))})),...(implementationPolicy(cell)?{implementationInputs:work.implementationInputs}:{})};}

/** Scoped truth, not a replacement for the global validator verdict. */
export function scopedWorkStatus(work,ids,{done=false,authored=false,requiredChildrenOnly=false}={}){
 const selected=new Set(ids),necessary=new Set(),byId=new Map(work.nodes.map(n=>[n.id,n])),external=new Set();
 function visit(id,upstream=false){const n=byId.get(id);if(!n)return; if(upstream&&!selected.has(id))external.add(id);if(necessary.has(id))return;necessary.add(id);for(const input of [...n.dependsOn,...n.refs])visit(input,true);if(upstream)for(const child of n.children)if(!requiredChildrenOnly||byId.get(child)?.required!==false)visit(child,true);}
 ids.forEach(id=>visit(id));
 const scopeNodes=[...necessary].map(id=>byId.get(id));
 const belongs=e=>scopeNodes.some(n=>e.path===n.path||e.path.startsWith(path.posix.dirname(n.path)+'/evidence/'));
 const errors=work.errors.filter(e=>!recoverable.has(e.code)||belongs(e));
 const missing=ids.filter(id=>!byId.has(id));
 const blocked=scopeNodes.filter(n=>n.blockers?.length||n.blockedBy.some(id=>!selected.has(id))||n.suspensionReasons.some(r=>['ANCESTOR_NOT_INVESTIGATED','COMPLETION_BLOCKED','DECLARED_SUSPENSION'].includes(r.code))||external.has(n.id)&&(authored?n.effectiveState!=='done':['invalid','uninvestigate','suspended','blocked'].includes(n.effectiveState))||done&&selected.has(n.id)&&(n.children.length||n.effectiveState!=='done'));
 return {ok:!errors.length&&!missing.length&&!blocked.length,errors,missing,blocked:blocked.map(n=>n.id),remainingErrors:work.errors.filter(e=>!errors.includes(e)),globalOk:work.ok};
}

/** Ephemeral readiness only. Callers must verify the earlier accepted cells'
 * current proof before supplying their exact leaf IDs. Never mutates Work or
 * treats an aggregate itself as an accepted leaf. References bind content;
 * only dependsOn adds completion ordering, as in the persistent Work graph. */
export function inRunWorkReady(work,ids,completed=[]){
 const byId=new Map(work.nodes.map(n=>[n.id,n])),accepted=new Set(completed),visiting=new Set(),memo=new Map();
 if(work.errors.some(e=>!recoverable.has(e.code)))return false;
 const sound=n=>n&&!['invalid','uninvestigate','suspended','blocked'].includes(n.effectiveState)&&!['uninvestigate','suspended','blocked'].includes(n.state)&&!n.blockers?.length&&!n.suspensionReasons?.length&&!work.errors.some(e=>e.path===n.path||e.path.startsWith(path.posix.dirname(n.path)+'/evidence/'));
 function prerequisites(n){return n.dependsOn.every(ready)&&n.refs.every(id=>{const ref=byId.get(id);return ref?sound(ref):work.resources.some(r=>r.id===id);});}
 function ready(id){
  if(memo.has(id))return memo.get(id);
  const n=byId.get(id);if(!sound(n)||visiting.has(id))return false;
  visiting.add(id);
  const required=n.children.filter(id=>byId.get(id)?.required!==false);
  const ok=prerequisites(n)&&(n.children.length?(required.length?required.every(ready):n.effectiveState==='done'):n.effectiveState==='done'||accepted.has(id));
  visiting.delete(id);memo.set(id,ok);return ok;
 }
 return ids.every(id=>{const n=byId.get(id);return sound(n)&&prerequisites(n);});
}
export function requestWorkPolicy(run,cell){
 if(!validateWorkPolicy(run.goal,cell))return {};
 const work=authored(run,cell),verdict=scopedWorkStatus(work,targets(run,cell),{authored:true});
 // Selected leaves may carry stale old completion before their authorized revision.
 need(!verdict.missing.length&&!verdict.blocked.length&&verdict.errors.every(e=>recoverable.has(e.code)&&work.authoredBinding.some(n=>n.path===e.path)),'Authored immutable prerequisites are not current');
 return {schema:'starci/cell-request@2',workPolicy:structuredClone(cell.workPolicy),workInvariant:invariant(work,cell)};
}
function assertInvariant(run,cell,request){
 need(request.schema==='starci/cell-request@2'&&same(request.workPolicy,cell.workPolicy),'Authored request policy changed or is not versioned');
 const work=authored(run,cell);
 need(same(invariant(work,cell),request.workInvariant),'Authored immutable inputs, graph or scope changed');
 const verdict=scopedWorkStatus(work,targets(run,cell),{authored:true});
 need(!verdict.missing.length&&!verdict.blocked.length&&verdict.errors.every(e=>recoverable.has(e.code)&&work.authoredBinding.some(n=>n.path===e.path)),'Authored prerequisite review is not current');
 return work;
}
export function sealWorkResult(run,cell,response){
 const request=run.requests[cell.id];need(!Object.hasOwn(response,'workResult'),'Only the runtime seals authored Work results');
 if(request.schema!=='starci/cell-request@2'){need(!cell.workPolicy,'Legacy request cannot gain authored policy');return response;}
 const work=assertInvariant(run,cell,request);
 return {...response,workResult:{schema:'starci/authored-result@1',requestDigest:hash(request),bindings:bindings(work,targets(run,cell))}};
}
export function verifyWorkResult(run,cell,response){
 const request=run.requests[cell.id];need(request,'Missing Work request');
 if(request.schema==='starci/cell-request@2'){
   const work=assertInvariant(run,cell,request),expected={schema:'starci/authored-result@1',requestDigest:hash(request),bindings:bindings(work,targets(run,cell))};
   need(same(response.workResult,expected),'Authored output changed after its result was sealed');
   if(run.status==='done')need(scopedWorkStatus(work,targets(run,cell),{done:true,authored:true}).ok,'Completed authored Work proof is no longer current');
 }else{
   need(request.schema==='starci/cell-request@1'&&!cell.workPolicy&&!response.workResult,'Legacy request cannot gain authored policy or output seal');
   const work=validateWorkspace(run.workRoot);need(work.errors.every(e=>recoverable.has(e.code)),'Producer Work graph is invalid');
   const current=run.goal.workflow==='prepare-work'?[]:bindings(work,targets(run,cell));
   need(same(request.workBindings??[],current),'Producer Work inputs changed; investigate current scope');
 }
 return true;
}
export function verifyRunWork(run){for(const [id,response]of Object.entries(run.responses)){const cell=run.goal.cells.find(c=>c.id===id);need(cell,'Unknown Work producer cell');verifyWorkResult(run,cell,response);}return true;}
