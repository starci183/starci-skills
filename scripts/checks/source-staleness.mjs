import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {canonicalJSON,sha256,validateWorkspace} from '../../engine/index.mjs';
import {parseYaml} from '../../engine/yaml.mjs';

const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const SHA=/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/;
const STALE_CODES=new Set(['STALE_COMPLETION','STALE_EVIDENCE','SOURCE_EVIDENCE_BINDING','CODE_EVIDENCE_BINDING','SOURCE_SNAPSHOT','ASSET_HASH','ASSET_UNREADABLE','EVIDENCE_NOT_PASS','EVIDENCE_OWNER','ASSERTION_COVERAGE']);
const CONTRACT_DRIFT_CODES=new Set(['SPECIFICATION_SOURCE_UNBOUND','SPECIFICATION_SOURCE_STALE','SPECIFICATION_BUSINESS_DRIFT','SPECIFICATION_JOURNEY_DRIFT','SPECIFICATION_JOURNEY_UNBOUND','SRS_BINDING','SDS_BINDING','SRS_GRAPH']);
const protectedPath=value=>/(^|\/)(?:\.git|_local)(\/|$)/.test(value)||/(^|\/)\.stacks\/staging(\/|$)/.test(value);
const slash=value=>String(value).split(path.sep).join('/');
const text=value=>typeof value==='string'&&value.trim().length>0;
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const array=value=>Array.isArray(value)?value:[];
const unique=values=>[...new Set(values)].sort((a,b)=>a.localeCompare(b));
const selectionRaw=new WeakMap();

export class SourceStalenessInputError extends Error {
  constructor(message,code='INVALID_INPUT'){super(message);this.name='SourceStalenessInputError';this.code=code;}
}

function realDirectory(value,label){
  const resolved=path.resolve(String(value??''));
  let stat,real;
  try{stat=fs.lstatSync(resolved);real=fs.realpathSync(resolved);}catch{throw new SourceStalenessInputError(`${label} is not a readable directory`,'UNREADABLE_ROOT');}
  if(stat.isSymbolicLink()||!stat.isDirectory()||real!==resolved)throw new SourceStalenessInputError(`${label} must be an exact real directory, not a symlink`,'UNSAFE_ROOT');
  return real;
}

function safeRelative(value,label='path'){
  if(!text(value))throw new SourceStalenessInputError(`${label} must be a normalized relative path`,'UNSAFE_PATH');
  const normalized=slash(value.trim());
  if(normalized!==value.trim()||path.isAbsolute(normalized)||/^[A-Za-z]:|[\\:\x00-\x1f]/.test(normalized)||normalized.split('/').some(part=>!part||part==='.'||part==='..')||protectedPath(normalized))throw new SourceStalenessInputError(`${label} is unsafe or protected`,'UNSAFE_PATH');
  return normalized;
}

function git(root,args,{allowFailure=false}={}){
  const result=spawnSync('git',['-c','core.quotepath=false',...args],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
  if(result.error||(!allowFailure&&result.status!==0))throw new SourceStalenessInputError(`Cannot inspect repository ${root}`,'REPOSITORY_UNAVAILABLE');
  return {status:result.status??1,stdout:result.stdout??'',stderr:result.stderr??''};
}

function repositoryState(id,value){
  if(!ID.test(id))throw new SourceStalenessInputError(`Invalid repository id ${id}`,'INVALID_REPOSITORY');
  const root=realDirectory(value,`repository ${id}`),top=path.resolve(git(root,['rev-parse','--show-toplevel']).stdout.trim());
  if(top!==root)throw new SourceStalenessInputError(`Repository ${id} must map to its Git top level`,'INVALID_REPOSITORY');
  const head=git(root,['rev-parse','HEAD']).stdout.trim();
  if(!SHA.test(head))throw new SourceStalenessInputError(`Repository ${id} has no full Git HEAD`,'REPOSITORY_UNAVAILABLE');
  const dirty=git(root,['status','--porcelain=v1','--untracked-files=normal','--',':(exclude).starciwork/**',':(exclude).stacks/staging/**']).stdout.length>0;
  const actualOrigin=git(root,['remote','get-url','origin'],{allowFailure:true}),origin=actualOrigin.status===0?normalizeOrigin(actualOrigin.stdout.trim()):{safe:false,canonical:null};
  return {id,root,head,dirty,origin};
}

function normalizeOrigin(value){
  let candidate=String(value??'').trim();
  const scp=candidate.match(/^git@([^/:\s]+):(.+)$/u);if(scp)candidate=`ssh://git@${scp[1]}/${scp[2]}`;
  try{
    const url=new URL(candidate),ssh=url.protocol==='ssh:',https=url.protocol==='https:';
    if((!ssh&&!https)||url.password||url.search||url.hash||(ssh&&url.username&&url.username!=='git')||(https&&url.username))return {safe:false,canonical:null};
    const pathname=url.pathname.replace(/\/+$/u,'').replace(/\.git$/u,'');
    if(!url.hostname||pathname.length<2)return {safe:false,canonical:null};
    return {safe:true,canonical:`${url.hostname.toLowerCase()}${url.port?`:${url.port}`:''}${pathname}`};
  }catch{return {safe:false,canonical:null};}
}

function repositoryFingerprint(repo,specs){
  const selected=specs.length?specs:[];
  const head=git(repo.root,['rev-parse','HEAD']).stdout.trim();
  const diff=selected.length?git(repo.root,['diff','--binary','--no-ext-diff','--no-textconv','HEAD','--',...selected]).stdout:'';
  const list=selected.length?git(repo.root,['ls-files','--others','--exclude-standard','-z','--',...selected]).stdout.split('\0').filter(Boolean).sort((a,b)=>a.localeCompare(b)):[];
  if(list.length>10000)throw new SourceStalenessInputError(`Repository ${repo.id} has too many untracked inputs to fingerprint safely`,'REPOSITORY_UNBOUNDED');
  let total=0;const untracked=[];for(const relative of list){const safe=safeRelative(slash(relative),'untracked source path'),target=path.resolve(repo.root,...safe.split('/')),checked=safeSourceTarget(repo.root,target);if(checked.kind!=='file')throw new SourceStalenessInputError(`Repository ${repo.id} has an unsafe untracked input`,'UNSAFE_PATH');const stat=fs.statSync(target);total+=stat.size;if(total>64*1024*1024)throw new SourceStalenessInputError(`Repository ${repo.id} has too many untracked bytes to fingerprint safely`,'REPOSITORY_UNBOUNDED');untracked.push({path:safe,sha256:sha256(fs.readFileSync(target))});}
  return sha256(canonicalJSON({head,origin:repo.origin.canonical,diff:sha256(diff),untracked}));
}

function repositoryCoverage(selected,raw,repositories){
  const coverage=new Map([...repositories.keys()].map(id=>[id,{full:false,paths:new Set()}]));
  for(const node of selected){const metadata=raw.get(node.id);for(const binding of array(metadata?.completion?.sourceIdentity?.repositories)){const row=coverage.get(binding?.repository);if(!row||!object(binding?.coverage))continue;if(binding.coverage.kind==='full-tree')row.full=true;else for(const value of array(binding.coverage.paths))try{row.paths.add(safeRelative(value,'source coverage path'));}catch{}}
    for(const ref of array(metadata?.sourceRefs)){const row=coverage.get(ref?.repository);if(!row)continue;try{row.paths.add(safeRelative(ref.path,'sourceRefs path'));}catch{}}
  }
  return new Map([...coverage].map(([id,row])=>[id,row.full?['.',':(exclude).starciwork/**',':(exclude).stacks/staging/**']:[...row.paths].sort((a,b)=>a.localeCompare(b))]));
}

function workFingerprint(root){
  const rows=[];let count=0,total=0;
  const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const target=path.join(directory,entry.name),relative=slash(path.relative(root,target));if(entry.isSymbolicLink())throw new SourceStalenessInputError('Work contains a symlink and cannot be snapshotted safely','UNSAFE_PATH');if(entry.isDirectory()){if(!['_local','.git','node_modules'].includes(entry.name)&&!protectedPath(relative))walk(target);continue;}if(!entry.isFile()||/(^|\/)secrets\.enc\.yaml$/u.test(relative))continue;if(++count>20000)throw new SourceStalenessInputError('Work has too many files to fingerprint safely','WORK_UNBOUNDED');const stat=fs.statSync(target);total+=stat.size;if(total>512*1024*1024)throw new SourceStalenessInputError('Work has too many bytes to fingerprint safely','WORK_UNBOUNDED');rows.push({path:relative,sha256:sha256(fs.readFileSync(target))});}};
  walk(root);return sha256(canonicalJSON(rows));
}

function loadNode(workRoot,node){
  const relative=safeRelative(node.path,`Work path for ${node.id}`),file=path.resolve(workRoot,...relative.split('/'));
  const inside=path.relative(workRoot,file);
  if(inside.startsWith('..')||path.isAbsolute(inside))throw new SourceStalenessInputError(`Work path for ${node.id} escapes its root`,'UNSAFE_PATH');
  let stat,real;
  try{stat=fs.lstatSync(file);real=fs.realpathSync(file);}catch{throw new SourceStalenessInputError(`Cannot read Work node ${node.id}`,'UNREADABLE_WORK');}
  if(stat.isSymbolicLink()||!stat.isFile()||real!==file)throw new SourceStalenessInputError(`Work node ${node.id} is not a real file`,'UNSAFE_PATH');
  let raw;
  try{raw=parseYaml(fs.readFileSync(file,'utf8'));}catch{throw new SourceStalenessInputError(`Cannot parse Work node ${node.id}`,'UNREADABLE_WORK');}
  if(!object(raw)||raw.id!==node.id)throw new SourceStalenessInputError(`Work node identity changed while scanning ${node.id}`,'WORK_RACE');
  return raw;
}

function semanticOwners(nodes,raw){
  const owners={srs:new Map(),sds:new Map()},own=(space,id,nodeId)=>{if(text(id)&&!owners[space].has(id))owners[space].set(id,nodeId);};
  for(const node of nodes){const value=raw.get(node.id),srs=value?.extensions?.work3?.srs,sds=value?.extensions?.work3?.sds;if(srs?.schema?.startsWith('starci/srs-aggregate')||sds?.schema?.startsWith('starci/sds-aggregate'))continue;if(srs?.schema?.startsWith('starci/srs-')){own('srs',srs.id,node.id);if(srs.schema==='starci/srs-functional-requirement@1'){for(const flow of [srs.mainFlow,...array(srs.alternativeFlows),...array(srs.exceptionFlows)])own('srs',flow?.id,node.id);for(const acceptance of array(srs.acceptanceCriteria))own('srs',acceptance?.id,node.id);}}if(sds?.schema?.startsWith('starci/sds-'))own('sds',sds.id,node.id);}
  return owners;
}

function semanticDependencies(node,raw,owners){
  const value=raw.get(node.id),srs=value?.extensions?.work3?.srs,sds=value?.extensions?.work3?.sds,refs=[];
  const add=(space,ids)=>{for(const id of array(ids))if(text(id)){const owner=owners[space].get(id);if(owner&&owner!==node.id)refs.push(owner);}};
  if(srs?.schema==='starci/srs-functional-requirement@1')add('srs',[...array(srs.businessRuleRefs),...array(srs.dataRefs),...array(srs.nonFunctionalRefs),...array(srs.decisionRefs)]);
  if(['starci/srs-non-functional-requirement@1','starci/srs-business-rule@1'].includes(srs?.schema))add('srs',srs.decisionRefs);
  if(srs?.schema==='starci/srs-data-definition@1')add('srs',array(srs.relations).map(row=>row?.dataRef));
  if(srs?.schema==='starci/srs-customer-journey@1')add('srs',[...array(srs.stages).flatMap(stage=>[stage?.requirementRef,stage?.flowRef,...array(stage?.acceptanceRefs)]),...array(srs.branches).flatMap(branch=>[branch?.requirementRef,branch?.flowRef,...array(branch?.acceptanceRefs)])]);
  if(sds?.schema==='starci/sds-flow@1'){for(const business of array(sds.businessRefs))add('srs',[...array(business?.requirementIds),...array(business?.flowIds),...array(business?.acceptanceIds)]);add('sds',[sds.entryPoint?.componentRef,...array(sds.participants),...array(sds.topologyRefs),...array(sds.verificationRefs),...[sds.mainSequence,...array(sds.alternativeSequences),...array(sds.exceptionSequences)].flatMap(sequence=>array(sequence?.steps).flatMap(step=>[step?.componentRef,...array(step?.contractRefs),...array(step?.dataRefs)]))]);}
  if(sds?.schema==='starci/sds-component@1')add('sds',[...array(sds.interfaceRefs),...array(sds.dataRefs),...array(sds.qualityRefs),...array(sds.verificationRefs)]);
  if(sds?.schema==='starci/sds-contract@1')add('sds',[sds.callerComponentRef,sds.receiverComponentRef]);
  if(sds?.schema==='starci/sds-data-model@1')add('sds',[sds.ownerComponentRef]);
  if(sds?.schema==='starci/sds-quality@1'){add('srs',sds.businessRefs);add('sds',[...array(sds.scopeRefs),...array(sds.verificationRefs)]);}
  if(sds?.schema==='starci/sds-deployment@1')add('sds',array(sds.placements).map(row=>row?.componentRef));
  if(sds?.schema==='starci/sds-decision@1')add('sds',sds.affectedRefs);
  if(sds?.schema==='starci/sds-verification@1'){add('srs',sds.businessAcceptanceRefs);add('sds',sds.scopeRefs);}
  const specification=value?.extensions?.work3?.specification;if(!refs.length&&specification?.schema==='starci/srs@3')for(const ref of array(specification.refs))if(text(ref?.nodeId)&&ref.nodeId!==node.id)refs.push(ref.nodeId);
  return unique(refs);
}

export function sourceStalenessClosure(nodes,targets,raw){
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const seeds=targets.length?targets:nodes.map(node=>node.id);
  for(const id of seeds)if(!byId.has(id))throw new SourceStalenessInputError(`Unknown Work target ${id}`,'UNKNOWN_TARGET');
  if(!raw||[...byId.keys()].some(id=>!raw.has(id)))throw new SourceStalenessInputError('Closure needs every canonical Work node','UNREADABLE_WORK');
  const parents=new Map();for(const node of nodes)for(const child of node.children)parents.set(child,node.id);
  const owners=semanticOwners(nodes,raw),brand=nodes.length===1?null:nodes.find(node=>node.kind==='brand'&&node.path==='brand/index.yaml')?.id??null;
  const chosen=new Set(),expandedDescendants=new Set(),pending=seeds.map(id=>({id,descendants:true}));
  while(pending.length){const {id,descendants}=pending.pop(),node=byId.get(id);if(!node)continue;const fresh=!chosen.has(id);chosen.add(id);
    if(descendants&&!expandedDescendants.has(id)){expandedDescendants.add(id);for(const child of node.children)pending.push({id:child,descendants:true});}
    if(!fresh)continue;
    for(const dependency of [...node.dependsOn,...node.refs,...semanticDependencies(node,raw,owners)])pending.push({id:dependency,descendants:true});
    const seenParents=new Set();for(let parent=parents.get(id);parent&&!seenParents.has(parent);parent=parents.get(parent)){seenParents.add(parent);pending.push({id:parent,descendants:false});}
    if(brand&&(node.kind==='ui'||(['implementation','uat'].includes(node.kind)&&/(^|\/)frontend(\/|$)/.test(node.path))))pending.push({id:brand,descendants:true});
  }
  return nodes.filter(node=>chosen.has(node.id)).sort((a,b)=>a.id.localeCompare(b.id));
}

function nodeRoute(node,{evidence=false,stack=false}={}){
  if(evidence)return 'review.verify';
  if(stack)return 'runtime.operate';
  if(node.kind==='business'||node.kind==='business-overview')return 'business.decide';
  if(node.kind==='architecture')return 'architecture.decide';
  if(node.kind==='implementation'&&/(^|\/)frontend(\/|$)/.test(node.path))return 'interface.implement';
  if(node.kind==='implementation')return 'backend.implement';
  if(node.kind==='operations')return 'runtime.operate';
  return 'review.verify';
}

function pathspecs(coverage){
  if(coverage.kind==='scoped')return coverage.paths.map(p=>safeRelative(p,'source coverage path'));
  return ['.',':(exclude).starciwork/**',':(exclude).stacks/staging/**'];
}

function refExists(repo,revision){return git(repo.root,['cat-file','-e',`${revision}^{commit}`],{allowFailure:true}).status===0;}
function safeSourceTarget(root,target){
  const relative=path.relative(root,target);if(relative.startsWith(`..${path.sep}`)||relative==='..'||path.isAbsolute(relative))return {kind:'unsafe'};
  let cursor=root;for(const part of relative.split(path.sep).filter(Boolean)){cursor=path.join(cursor,part);let stat;try{stat=fs.lstatSync(cursor);}catch{return {kind:'missing'};}if(stat.isSymbolicLink())return {kind:'unsafe'};}
  try{const real=fs.realpathSync(target),inside=path.relative(root,real);if(inside.startsWith(`..${path.sep}`)||inside==='..'||path.isAbsolute(inside))return {kind:'unsafe'};const stat=fs.statSync(real);return {kind:stat.isFile()?'file':stat.isDirectory()?'directory':'unsafe'};}catch{return {kind:'missing'};}
}
function coveredChange(repo,revision,coverage){
  const specs=pathspecs(coverage);
  if(coverage.kind==='scoped')for(const relative of specs){
    // A scoped coverage entry may name every descendant of a directory. Git understands the
    // trailing `/**` pathspec, while the filesystem probe must inspect its concrete directory.
    const probe=relative.endsWith('/**')?relative.slice(0,-3):relative;
    const target=path.resolve(repo.root,...probe.split('/')),inside=path.relative(repo.root,target);
    if(inside.startsWith('..')||path.isAbsolute(inside))throw new SourceStalenessInputError('Source coverage escapes its repository','UNSAFE_PATH');
    const checked=safeSourceTarget(repo.root,target);if(checked.kind==='unsafe')return {kind:'unsafe',relative};if(checked.kind==='missing')return {kind:'missing',relative};
  }
  const tracked=git(repo.root,['diff','--quiet','--no-ext-diff',revision,'--',...specs],{allowFailure:true});
  if(![0,1].includes(tracked.status))return {kind:'unavailable'};
  const untracked=git(repo.root,['ls-files','--others','--exclude-standard','-z','--',...specs],{allowFailure:true});
  if(untracked.status!==0)return {kind:'unavailable'};
  return {kind:tracked.status===1||untracked.stdout.length?'changed':'same'};
}

function sourceRefChange(repo,ref){
  const relative=safeRelative(ref.path,'sourceRefs path'),target=path.resolve(repo.root,...relative.split('/'));
  const checked=safeSourceTarget(repo.root,target);if(checked.kind==='unsafe')return {kind:'unsafe'};if(checked.kind==='missing')return {kind:'missing'};
  const result=git(repo.root,['diff','--quiet','--no-ext-diff',ref.revision,'--',relative],{allowFailure:true});
  if(![0,1].includes(result.status))return {kind:'unavailable'};
  const untracked=git(repo.root,['ls-files','--others','--exclude-standard','-z','--',relative],{allowFailure:true});
  if(untracked.status!==0)return {kind:'unavailable'};
  return {kind:result.status===1||untracked.stdout.length?'changed':'same'};
}

function ownerForPath(selected,errorPath){
  if(errorPath==='.')return null;
  const normalized=slash(errorPath);
  return selected.filter(node=>normalized===node.path||normalized.startsWith(node.path.slice(0,node.path.lastIndexOf('/')+1))).sort((a,b)=>b.path.length-a.path.length)[0]??null;
}

function affectedFor(nodeId,selected){
  const byId=new Map(selected.map(node=>[node.id,node])),reverse=new Map(),raw=selectionRaw.get(selected)??new Map(),owners=semanticOwners(selected,raw);
  for(const node of selected)for(const [relation,ids] of [['dependsOn',node.dependsOn],['refs',node.refs]])for(const id of ids){if(!byId.has(id))continue;const rows=reverse.get(id)??[];rows.push({to:node.id,relation});reverse.set(id,rows);}
  for(const node of selected){for(const child of node.children)if(byId.has(child)){const rows=reverse.get(child)??[];rows.push({to:node.id,relation:'child-input'});reverse.set(child,rows);}for(const owner of semanticDependencies(node,raw,owners))if(byId.has(owner)){const rows=reverse.get(owner)??[];rows.push({to:node.id,relation:'semantic-input'});reverse.set(owner,rows);}}
  const brand=selected.find(node=>node.kind==='brand'&&node.path==='brand/index.yaml');if(brand)for(const node of selected)if(node.id!==brand.id&&(node.kind==='ui'||(['implementation','uat'].includes(node.kind)&&/(^|\/)frontend(\/|$)/.test(node.path)))){const rows=reverse.get(brand.id)??[];rows.push({to:node.id,relation:'brand-context'});reverse.set(brand.id,rows);}
  const result=[{nodeId,reason:'self',edges:[]}],seen=new Set([nodeId]),pending=[{id:nodeId,edges:[]}];
  const descendants=[...(byId.get(nodeId)?.children??[])];while(descendants.length){const id=descendants.shift();if(seen.has(id))continue;seen.add(id);const edges=[{from:nodeId,to:id,relation:'ancestor-context'}];result.push({nodeId:id,reason:'typed-dependent',edges});pending.push({id,edges});descendants.push(...(byId.get(id)?.children??[]));}
  while(pending.length){const current=pending.shift();for(const edge of (reverse.get(current.id)??[]).sort((a,b)=>a.to.localeCompare(b.to)||a.relation.localeCompare(b.relation))){if(seen.has(edge.to))continue;seen.add(edge.to);const edges=[...current.edges,{from:current.id,to:edge.to,relation:edge.relation}];result.push({nodeId:edge.to,reason:'typed-dependent',edges});pending.push({id:edge.to,edges});}}
  return result.sort((a,b)=>a.nodeId.localeCompare(b.nodeId));
}

function makeFinding(base,selected){
  const stable={bindingId:base.bindingId,nodeId:base.nodeId,category:base.category,status:base.status,code:base.code,expected:base.expected??null,observed:base.observed??null};
  const impactSetId=base.nodeId?`impact-${sha256(canonicalJSON({root:base.nodeId,selected:selected.map(node=>node.id)})).slice(0,24)}`:null;
  return {id:`stale-${sha256(canonicalJSON(stable)).slice(0,24)}`,...base,impactSetId,repairCandidate:base.repairPaths?.length?{paths:unique(base.repairPaths),authorized:false}:null};
}

function scanIdentity({node,identity,repositories,selected,bindingId,repairPaths}){
  const findings=[];
  const declaredRepositories=array(identity.repositories);if(!Array.isArray(identity.repositories)){const route=nodeRoute(node);findings.push(makeFinding({bindingId:`${bindingId}:malformed`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'MALFORMED_SOURCE_IDENTITY',detail:'The stored source identity does not contain a repository list.',expected:{schema:'starci/source-identity@1',repositories:'array'},observed:null,route,operator:route,repairPaths},selected));}
  for(const declared of declaredRepositories){
    if(!object(declared)||!text(declared.repository)||!object(declared.coverage)||!['full-tree','scoped'].includes(declared.coverage.kind)||!Array.isArray(declared.coverage.paths)){
      const route=nodeRoute(node);findings.push(makeFinding({bindingId:`${bindingId}:malformed`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'MALFORMED_SOURCE_IDENTITY',detail:'The stored source identity is malformed and cannot define a safe comparison.',expected:{schema:'starci/source-identity@1'},observed:null,route,operator:route,repairPaths},selected));continue;
    }
    const repo=repositories.get(declared.repository),stack=array(declared.coverage?.paths).some(p=>p==='.stacks'||p.startsWith('.stacks/'));
    const route=nodeRoute(node,{stack});
    if(!repo){findings.push(makeFinding({bindingId:`${bindingId}:${declared.repository}`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:stack?'stack':'source',code:'REPOSITORY_MAPPING_MISSING',detail:'The source identity names a repository that was not explicitly mapped.',expected:{repository:declared.repository},observed:null,route,operator:route,repairPaths},selected));continue;}
    const declaredOrigin=normalizeOrigin(declared.origin);if(!repo.origin.safe||!declaredOrigin.safe||repo.origin.canonical!==declaredOrigin.canonical){findings.push(makeFinding({bindingId:`${bindingId}:${declared.repository}:origin`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:stack?'stack':'source',code:'REPOSITORY_ORIGIN_MISMATCH',detail:'The mapped repository origin is missing, unsafe, or differs from the credential-free source identity origin.',expected:{repository:declared.repository,originDigest:declaredOrigin.safe?sha256(declaredOrigin.canonical):null},observed:{originMatch:false,credentialFree:repo.origin.safe},route,operator:route,repairPaths},selected));continue;}
    const revision=declared.state==='committed'?declared.commit:declared.baseCommit;
    if(!SHA.test(revision??'')||!refExists(repo,revision)){findings.push(makeFinding({bindingId:`${bindingId}:${declared.repository}`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:stack?'stack':'source',code:'SOURCE_REVISION_UNAVAILABLE',detail:'The declared source revision cannot be resolved in the mapped repository.',expected:{repository:declared.repository,revision},observed:{head:repo.head},route,operator:route,repairPaths},selected));continue;}
    if(declared.state==='dirty'){
      findings.push(makeFinding({bindingId:`${bindingId}:${declared.repository}`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:stack?'stack':'source',code:'DIRTY_SNAPSHOT_COMPARISON_UNDEFINED',detail:'Canonical Work preserves the tested dirty snapshot asset, but its format does not define a reversible checkout comparison.',expected:{repository:declared.repository,baseCommit:revision,snapshotSha256:declared.snapshot?.sha256??null},observed:{head:repo.head,dirty:repo.dirty},route,operator:route,repairPaths},selected));continue;
    }
    let change;try{change=coveredChange(repo,revision,declared.coverage);}catch(error){if(!(error instanceof SourceStalenessInputError))throw error;change={kind:'unsafe'};}
    if(change.kind==='same')continue;
    const missing=change.kind==='missing',unavailable=['unsafe','unavailable'].includes(change.kind);
    findings.push(makeFinding({bindingId:`${bindingId}:${declared.repository}`,nodeId:node.id,category:unavailable?'input-unavailable':missing?'source-drift':stack?'stack-drift':'source-drift',status:unavailable?'unverifiable':missing?'missing':'revalidation-needed',layer:stack?'stack':'source',code:unavailable?'SOURCE_COVERAGE_UNREADABLE':missing?'SOURCE_PATH_MISSING':'SOURCE_INPUTS_CHANGED',detail:unavailable?'The declared source coverage cannot be inspected safely.':missing?'A declared covered source path is missing.':'Bytes inside the declared tested coverage differ from the stored source identity; this requires revalidation and does not by itself prove the implementation wrong.',expected:{repository:declared.repository,revision,coverage:declared.coverage},observed:{head:repo.head,dirty:repo.dirty,...(missing?{missingPath:change.relative}:{})},route,operator:route,repairPaths},selected));
  }
  return findings;
}

function scanSourceRefs({node,refs,repositories,selected,repairPaths}){
  const findings=[];
  for(const [index,ref] of (refs??[]).entries()){
    if(!object(ref)||!text(ref.repository)||!SHA.test(ref.revision??'')||!text(ref.path)){
      const route=nodeRoute(node);findings.push(makeFinding({bindingId:`work:${node.id}:sourceRef:${index}:malformed`,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'MALFORMED_SOURCE_REFERENCE',detail:'A stored source reference is malformed and cannot define a safe comparison.',expected:{repository:true,revision:'full-git-sha',path:'normalized-relative'},observed:null,route,operator:route,repairPaths},selected));continue;
    }
    const repo=repositories.get(ref.repository),stack=ref.path==='.stacks'||ref.path.startsWith('.stacks/'),route=nodeRoute(node,{stack}),bindingId=`work:${node.id}:sourceRef:${index}:${ref.repository}:${ref.path}`;
    if(!repo){findings.push(makeFinding({bindingId,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:stack?'stack':'source',code:'REPOSITORY_MAPPING_MISSING',detail:'The source reference names a repository that was not explicitly mapped.',expected:{repository:ref.repository,revision:ref.revision,path:ref.path},observed:null,route,operator:route,repairPaths},selected));continue;}
    if(!refExists(repo,ref.revision)){findings.push(makeFinding({bindingId,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:stack?'stack':'source',code:'SOURCE_REVISION_UNAVAILABLE',detail:'The source reference revision cannot be resolved in the mapped repository.',expected:{repository:ref.repository,revision:ref.revision,path:ref.path},observed:{head:repo.head},route,operator:route,repairPaths},selected));continue;}
    let change;try{change=sourceRefChange(repo,ref);}catch(error){if(!(error instanceof SourceStalenessInputError))throw error;change={kind:'unsafe'};}
    if(change.kind==='same')continue;
    const missing=change.kind==='missing',unavailable=['unsafe','unavailable'].includes(change.kind);
    findings.push(makeFinding({bindingId,nodeId:node.id,category:unavailable?'input-unavailable':missing?'source-drift':stack?'stack-drift':'source-drift',status:unavailable?'unverifiable':missing?'missing':'revalidation-needed',layer:stack?'stack':'source',code:unavailable?'SOURCE_REFERENCE_UNREADABLE':missing?'SOURCE_PATH_MISSING':'SOURCE_INPUTS_CHANGED',detail:unavailable?'The referenced path cannot be inspected safely.':missing?'The exact referenced source path is missing.':'The referenced path differs from the observed revision; rerun the owning review before accepting current source.',expected:{repository:ref.repository,revision:ref.revision,path:ref.path},observed:{head:repo.head,dirty:repo.dirty},route,operator:route,repairPaths},selected));
  }
  return findings;
}

function scanLegacyCodeRefs({node,refs,repositories,selected,repairPaths}){
  const findings=[];for(const [index,ref] of refs.entries()){
    const route=nodeRoute(node),bindingId=`work:${node.id}:codeRef:${index}`;
    if(!object(ref)||!text(ref.repository)||!SHA.test(ref.commit??'')){findings.push(makeFinding({bindingId,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'MALFORMED_CODE_REFERENCE',detail:'A legacy code reference is malformed.',expected:{repository:true,commit:'full-git-sha'},observed:null,route,operator:route,repairPaths},selected));continue;}
    const repo=repositories.get(ref.repository);if(!repo){findings.push(makeFinding({bindingId,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'REPOSITORY_MAPPING_MISSING',detail:'The legacy code reference names a repository that was not explicitly mapped.',expected:{repository:ref.repository,revision:ref.commit},observed:null,route,operator:route,repairPaths},selected));continue;}
    if(!refExists(repo,ref.commit)){findings.push(makeFinding({bindingId,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'SOURCE_REVISION_UNAVAILABLE',detail:'The legacy code reference commit cannot be resolved.',expected:{repository:ref.repository,revision:ref.commit},observed:{head:repo.head},route,operator:route,repairPaths},selected));continue;}
    findings.push(makeFinding({bindingId,nodeId:node.id,category:'input-unavailable',status:'unverifiable',layer:'source',code:'LEGACY_CODE_REFS_COVERAGE_UNKNOWN',detail:'Legacy codeRefs bind a commit but declare no source coverage, so this scanner cannot prove which current paths remain conforming.',expected:{repository:ref.repository,revision:ref.commit},observed:{head:repo.head,dirty:repo.dirty},route,operator:route,repairPaths},selected));
  }return findings;
}

/** Deterministically compare canonical Work freshness bindings with current mapped Git repositories. Read only. */
export function scanCanonicalWork({workRoot,repositories={},targets=[]}={}, {afterMeasurements=()=>{}}={}){
  const work=realDirectory(workRoot,'Work root');
  if(!Array.isArray(targets)||targets.some(id=>!ID.test(id))||new Set(targets).size!==targets.length)throw new SourceStalenessInputError('Targets must be unique exact Work node IDs','INVALID_TARGET');
  if(!object(repositories)||!Object.keys(repositories).length)throw new SourceStalenessInputError('At least one explicit repository mapping is required','REPOSITORY_MAPPING_MISSING');
  if(typeof afterMeasurements!=='function')throw new SourceStalenessInputError('afterMeasurements must be a function','INVALID_INPUT');
  const repoStates=new Map(Object.entries(repositories).sort(([a],[b])=>a.localeCompare(b)).map(([id,root])=>[id,repositoryState(id,root)])),beforeWork=workFingerprint(work);
  const validation=validateWorkspace(work),allRaw=new Map(validation.nodes.map(node=>[node.id,loadNode(work,node)])),selected=sourceStalenessClosure(validation.nodes,targets,allRaw),selectedIds=new Set(selected.map(node=>node.id));
  const raw=new Map(selected.map(node=>[node.id,allRaw.get(node.id)]));
  selectionRaw.set(selected,raw);
  const repoCoverage=repositoryCoverage(selected,raw,repoStates),beforeSnapshots=new Map([...repoStates].map(([id,repo])=>[id,repositoryFingerprint(repo,repoCoverage.get(id)??[])]));
  const findings=[];
  for(const error of validation.errors){
    const node=ownerForPath(selected,error.path),anyOwner=ownerForPath(validation.nodes,error.path);if(!node&&anyOwner)continue;
    if(node&&!selectedIds.has(node.id))continue;
    const evidence=STALE_CODES.has(error.code),contract=CONTRACT_DRIFT_CODES.has(error.code),category=evidence?'evidence-invalid':contract?'contract-drift':'input-unavailable',status=evidence?'revalidation-needed':contract?'known-drift':'unverifiable',route=node?nodeRoute(node,{evidence}):'review.verify';
    findings.push(makeFinding({bindingId:`work-validator:${error.code}:${error.path}`,nodeId:node?.id??null,category,status,layer:'work',code:error.code,detail:error.message,expected:node?{inputDigest:node.inputDigest}:null,observed:node?{effectiveState:node.effectiveState}:null,route,operator:route,repairPaths:node?[node.path]:[]},selected));
  }
  for(const node of selected){
    const metadata=raw.get(node.id),repairPaths=[node.path];
    if(node.required&&node.children.length===0&&node.effectiveState!=='done'&&!object(metadata.completion)){
      const implementation=node.kind==='implementation',route=implementation?'review.verify':nodeRoute(node);
      findings.push(makeFinding({bindingId:`work:${node.id}:completion`,nodeId:node.id,category:implementation?'evidence-invalid':'contract-drift',status:'missing',layer:'work',code:implementation?'IMPLEMENTATION_PROOF_MISSING':'WORK_NOT_COMPLETE',detail:implementation?'The required implementation leaf has no current completion proof. This does not prove that source code is absent.':'The required Work leaf is not currently complete.',expected:{effectiveState:'done',inputDigest:node.inputDigest},observed:{effectiveState:node.effectiveState,authoredState:node.state},route,operator:route,repairPaths},selected));
    }
    if(Array.isArray(metadata.sourceRefs))findings.push(...scanSourceRefs({node,refs:metadata.sourceRefs,repositories:repoStates,selected,repairPaths}));
    const identity=metadata.completion?.sourceIdentity;
    if(object(identity))findings.push(...scanIdentity({node,identity,repositories:repoStates,selected,bindingId:`work:${node.id}:completion`,repairPaths}));
    else if(Array.isArray(metadata.completion?.codeRefs))findings.push(...scanLegacyCodeRefs({node,refs:metadata.completion.codeRefs,repositories:repoStates,selected,repairPaths}));
  }
  afterMeasurements();
  for(const [id,repo] of repoStates){const after=repositoryFingerprint(repo,repoCoverage.get(id)??[]),before=beforeSnapshots.get(id);if(after!==before)findings.push(makeFinding({bindingId:`repository:${id}:scan-snapshot`,nodeId:null,category:'input-unavailable',status:'unverifiable',layer:'source',code:'SCAN_INPUT_CHANGED',detail:'Repository inputs changed while the scanner was measuring them; rerun against one stable snapshot.',expected:{snapshotDigest:before},observed:{snapshotDigest:after},route:'review.verify',operator:'review.verify',repairPaths:[]},selected));}
  const afterWork=workFingerprint(work);if(afterWork!==beforeWork)findings.push(makeFinding({bindingId:'work:scan-snapshot',nodeId:null,category:'input-unavailable',status:'unverifiable',layer:'work',code:'SCAN_INPUT_CHANGED',detail:'Canonical Work inputs changed while the scanner was measuring them; rerun against one stable snapshot.',expected:{snapshotDigest:beforeWork},observed:{snapshotDigest:afterWork},route:'review.verify',operator:'review.verify',repairPaths:[]},selected));
  const dedup=[...new Map(findings.map(item=>[item.id,item])).values()].sort((a,b)=>a.id.localeCompare(b.id));
  const impactById=new Map(),edgeByKey=new Map();for(const finding of dedup){if(!finding.nodeId||impactById.has(finding.impactSetId))continue;const affected=affectedFor(finding.nodeId,selected);for(const item of affected)for(const edge of item.edges){const key=canonicalJSON(edge);edgeByKey.set(key,edge);}impactById.set(finding.impactSetId,{id:finding.impactSetId,rootNodeId:finding.nodeId,affectedNodeIds:affected.map(item=>item.nodeId).sort((a,b)=>a.localeCompare(b))});}
  const impactGraph={edges:[...edgeByKey.values()].sort((a,b)=>canonicalJSON(a).localeCompare(canonicalJSON(b))),impactSets:[...impactById.values()].sort((a,b)=>a.id.localeCompare(b.id))};
  const byNode=new Map();for(const item of dedup)if(item.nodeId){const rows=byNode.get(item.nodeId)??[];rows.push(item);byNode.set(item.nodeId,rows);}
  const rank={'missing':4,'known-drift':3,'revalidation-needed':2,'unverifiable':1,'verified-conforming':0};
  const subjects=selected.map(node=>{const rows=byNode.get(node.id)??[],status=rows.map(row=>row.status).sort((a,b)=>rank[b]-rank[a]||a.localeCompare(b))[0]??'verified-conforming';return {id:node.id,path:node.path,kind:node.kind,inputDigest:node.inputDigest,effectiveState:node.effectiveState,status,findingIds:rows.map(row=>row.id).sort()};});
  const baseline=selected.map(node=>{const metadata=raw.get(node.id);return {id:node.id,inputDigest:node.inputDigest,completionInputDigest:metadata.completion?.inputDigest??null,sourceRefs:metadata.sourceRefs??[],sourceIdentity:metadata.completion?.sourceIdentity??null};});
  const sourceBindings=selected.flatMap(node=>{const metadata=raw.get(node.id),direct=array(metadata.completion?.sourceIdentity?.repositories),legacy=array(metadata.completion?.codeRefs),observed=array(metadata.sourceRefs);return [...direct.filter(object).map(binding=>({nodeId:node.id,type:'source-identity',repository:binding.repository??null,coverage:binding.coverage?.kind??'unknown',paths:Array.isArray(binding.coverage?.paths)?[...binding.coverage.paths].sort():[]})),...legacy.filter(object).map(binding=>({nodeId:node.id,type:'code-refs',repository:binding.repository??null,coverage:'unknown',paths:[]})),...observed.filter(object).map(binding=>({nodeId:node.id,type:'source-ref',repository:binding.repository??null,coverage:'exact-path',paths:text(binding.path)?[binding.path]:[]}))];}).sort((a,b)=>canonicalJSON(a).localeCompare(canonicalJSON(b)));
  const report={schema:'starci/source-staleness-report@1',workRoot:slash(work),targets:targets.length?[...targets].sort():selected.map(node=>node.id),baselineDigest:sha256(canonicalJSON(baseline)),clean:dedup.length===0,coverage:{mode:'canonical-work',closure:'targets plus aggregate descendants, ancestors, dependsOn, refs, split semantic inputs and implicit brand context',selectedNodeIds:selected.map(node=>node.id),sourceBindings},limitations:['This deterministic check proves declared structural freshness only; it does not decide semantic code conformance to SRS/SDS.','No runtime, browser, API or UAT behavior is executed.','Dirty source identities remain unverifiable because the snapshot asset contract does not define a universal reversible checkout format.','Legacy codeRefs remain unverifiable because they declare no path coverage.'],impactGraph,currentInputs:{work:{ok:validation.ok,selectedNodes:selected.length,snapshotDigest:beforeWork},repositories:[...repoStates.values()].map(repo=>({id:repo.id,root:slash(repo.root),head:repo.head,dirty:repo.dirty,originDigest:repo.origin.safe?sha256(repo.origin.canonical):null,credentialFreeOrigin:repo.origin.safe,snapshotDigest:beforeSnapshots.get(repo.id)})).sort((a,b)=>a.id.localeCompare(b.id))},subjects,findings:dedup};
  return {...report,reportDigest:sha256(canonicalJSON(report))};
}
