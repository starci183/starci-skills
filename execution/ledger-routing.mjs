import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {LEDGER_DIRECTORY,normalizeOrigin,repositoryName} from './work-ledger.mjs';

/**
 * Which Work ledger a workflow works, when the repository it runs in is not the repository that owns the
 * ledger. A product has exactly one canonical `.starciwork`, owned by its backend; a frontend (or any other
 * source of the same product) shares that tree through the host route registry instead of keeping a second
 * one. So the kernel resolves two different roots before it starts: the **code** root, which is the worktree
 * it commits in, and the **ledger** root, which is the tree it reads and writes Work into.
 *
 * Resolution order, strongest first:
 *
 * 1. `--ledger-root <path>` — the user named the tree; a path that is not a Work tree is an error, never a
 *    silent fallback.
 * 2. the host route registry `<host>/../.workspaces/projects/<project>/work.json`
 *    (`starci/workspace-binding@1`): the binding names the repositories of a project by role and says which
 *    role owns the Work (`work.ownerRole` + `work.pathFromRepository`). A repository is recognized by its
 *    declared path or — so a worktree is recognized too — by its actual git origin, which is what
 *    `schemas/workspace-routing.yaml` asks for before any effect.
 * 3. `<repoRoot>/.starciwork` — the repository owns its own tree, which is every single-repository job.
 */
export const BINDING_SCHEMA='starci/workspace-binding@1';
export const REGISTRY_PATH=path.join('.workspaces','projects');
export const BINDING_FILE='work.json';
export const LEDGER_SOURCES=['option','workspace','local'];
/** Role -> the side of the product that role delivers; a role outside this map constrains no layout. */
export const ROLE_SIDES={be:'backend',backend:'backend',api:'backend',server:'backend',
  fe:'frontend',frontend:'frontend',web:'frontend',app:'frontend',landing:'frontend'};
/**
 * Paths inside a ledger the kernel writes itself: a node's `index.yaml`, everything under an `evidence/`
 * folder, and the `_local` runtime tree. A pending change anywhere else under a shared ledger is somebody
 * else's authored work, and a kernel that committed over it would be committing what it never read.
 */
export const KERNEL_OWNED_LEDGER=/(?:^|\/)(?:evidence|_local)\/|(?:^|\/)index\.ya?ml$/;

const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const slash=value=>String(value??'').replaceAll('\\','/');
const unique=list=>[...new Set(list)];
const directory=target=>{try{return fs.statSync(target).isDirectory();}catch{return false;}};
const hasFeatures=root=>directory(path.join(root,'features'));
/** Compare two paths as the file system does: through their real location, case-folded on Windows. */
const key=value=>{
  let resolved=path.resolve(value);
  try{resolved=fs.realpathSync.native?fs.realpathSync.native(resolved):fs.realpathSync(resolved);}catch{/* an absent path compares by its literal form */}
  const normalized=slash(resolved).replace(/\/+$/,'');
  return process.platform==='win32'?normalized.toLowerCase():normalized;
};
export const samePath=(a,b)=>Boolean(a&&b)&&key(a)===key(b);

/** The registry of project routes: `.workspaces/projects` beside the host `.claude`, or inside a host given as the Source directory. */
export function registryRoot(host){
  if(!host)return null;
  const base=path.resolve(String(host));
  return [path.join(base,REGISTRY_PATH),path.join(path.dirname(base),REGISTRY_PATH)].find(directory)??null;
}

/** Every readable project binding in the registry, in directory order. A malformed one is skipped, not fatal. */
export function readBindings(projectsRoot){
  const root=path.resolve(required(projectsRoot,'registry root'));
  let entries=[];
  try{entries=fs.readdirSync(root,{withFileTypes:true});}catch{return [];}
  const bindings=[];
  for(const entry of entries.filter(item=>item.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))){
    const file=path.join(root,entry.name,BINDING_FILE);
    let binding=null;
    try{binding=JSON.parse(fs.readFileSync(file,'utf8'));}catch{continue;}
    if(!plain(binding)||!plain(binding.repositories))continue;
    bindings.push({project:typeof binding.project==='string'&&binding.project.trim()?binding.project.trim():entry.name,file,binding});
  }
  return bindings;
}

/** The directory a route declares, resolved from Source: `pathFromSource`, or a sibling named by `directory`. */
function routeDirectory(route,source){
  const relative=[route.pathFromSource,route.path,route.kind==='sibling'&&route.directory?path.join('..',route.directory):null]
    .find(item=>typeof item==='string'&&item.trim());
  return relative?path.resolve(source,relative):null;
}

/** The repositories of one binding as routes: role, declared directory and declared origin. */
export function bindingRoutes(binding,{source}={}){
  const base=path.resolve(required(source,'source directory'));
  return Object.entries(plain(binding?.repositories)?binding.repositories:{})
    .filter(([,route])=>plain(route))
    .map(([role,route])=>({role,directory:routeDirectory(route,base),
      origin:normalizeOrigin(route.gitRepository??route.origin??null),declared:route.gitRepository??route.origin??null}))
    .filter(route=>route.directory);
}

/** The origin a repository actually has, normalized the way a Work record names one. */
export function originOf(repoRoot,git=spawnSync){
  const shown=git('git',['remote','get-url','origin'],{cwd:repoRoot,encoding:'utf8',windowsHide:true});
  return shown?.status===0?normalizeOrigin((shown.stdout??'').trim()):null;
}

/**
 * Two remotes name the same repository when host and path agree: a route declares `https://host/org/repo.git`
 * and the clone may well answer `git@host:org/repo`. Protocol and credentials are how you reach it, not which
 * repository it is.
 */
export function originKey(origin){
  if(!origin)return null;
  try{
    const url=new URL(origin);
    const repository=url.pathname.replace(/\.git$/,'').replace(/\/+$/,'').replace(/^\/+/,'');
    return repository?`${url.host.toLowerCase()}/${repository.toLowerCase()}`:null;
  }catch{return null;}
}
const sameOrigin=(a,b)=>{const left=originKey(a),right=originKey(b);return Boolean(left&&right)&&left===right;};

/** The repository root of a ledger directory: the tree's own repository, not the directory above it. */
function ownerOf(ledgerRoot){
  if(path.basename(ledgerRoot)===LEDGER_DIRECTORY)return path.dirname(ledgerRoot);
  for(let current=ledgerRoot;;){
    if(fs.existsSync(path.join(current,'.git')))return current;
    const parent=path.dirname(current);
    if(parent===current)return path.dirname(ledgerRoot);
    current=parent;
  }
}

function fromOption(named){
  const target=path.resolve(String(named));
  const nested=path.join(target,LEDGER_DIRECTORY);
  const ledgerRoot=hasFeatures(target)?target:hasFeatures(nested)?nested:null;
  need(ledgerRoot,`--ledger-root ${slash(target)} is not a Work ledger: neither ${slash(path.join(target,'features'))} nor ${slash(path.join(nested,'features'))} exists`);
  return {source:'option',ledgerRoot,ownerRepoRoot:ownerOf(ledgerRoot),project:null,role:null,ownerRole:null,binding:null};
}

function fromWorkspace({code,host,git}){
  const projects=registryRoot(host);
  if(!projects)return null;
  const source=path.dirname(path.dirname(projects));
  const origin=originOf(code,git);
  const matched=[];
  for(const {project,file,binding} of readBindings(projects)){
    const routes=bindingRoutes(binding,{source});
    const mine=routes.find(route=>samePath(route.directory,code)||sameOrigin(route.origin,origin));
    if(!mine)continue;
    const work=plain(binding.work)?binding.work:{};
    const ownerRole=typeof work.ownerRole==='string'&&work.ownerRole.trim()?work.ownerRole.trim():null;
    const owner=ownerRole?routes.find(route=>route.role===ownerRole):null;
    // The binding names this repository, so a binding that cannot say who owns the Work is a routing defect:
    // picking a tree anyway is exactly the silent guess the routing contract forbids.
    need(ownerRole&&owner,`${slash(file)} binds ${slash(code)} as role ${mine.role} but names no resolvable work.ownerRole; fix the route or pass --ledger-root`);
    matched.push({source:'workspace',project,role:mine.role,ownerRole,
      ownerRepoRoot:owner.directory,
      ledgerRoot:path.resolve(owner.directory,typeof work.pathFromRepository==='string'&&work.pathFromRepository.trim()?work.pathFromRepository.trim():LEDGER_DIRECTORY),
      binding:file});
  }
  if(!matched.length)return null;
  need(matched.length===1,`${slash(code)} is bound by ${matched.length} workspace projects (${matched.map(item=>item.project).join(', ')}); name the tree with --ledger-root`);
  return matched[0];
}

/**
 * Resolve the ledger a workflow in `repoRoot` works. `exists` is false only on the local fallback, where a
 * repository simply has no Work tree and the kernel runs its model-assessed plan ledger instead; a named or
 * routed tree that is not there is an error, because something said it would be.
 */
export function resolveLedgerRoot({repoRoot,host=null,options={},git=spawnSync}={}){
  const code=path.resolve(required(repoRoot,'repository root'));
  const named=options['ledger-root']??options.ledgerRoot??null;
  const resolved=named?fromOption(named):fromWorkspace({code,host,git});
  if(!resolved){
    const ledgerRoot=path.join(code,LEDGER_DIRECTORY);
    return settle({source:'local',ledgerRoot,ownerRepoRoot:code,project:null,role:null,ownerRole:null,binding:null},code,hasFeatures(ledgerRoot));
  }
  need(hasFeatures(resolved.ledgerRoot),resolved.source==='workspace'
    ?`${slash(resolved.binding)} routes the Work of ${resolved.project} to ${slash(resolved.ledgerRoot)}, which has no features/ tree`
    :`--ledger-root ${slash(resolved.ledgerRoot)} has no features/ tree`);
  return settle(resolved,code,true);
}

function settle(resolved,code,exists){
  const ownerRepoRoot=path.resolve(resolved.ownerRepoRoot);
  return {...resolved,ledgerRoot:path.resolve(resolved.ledgerRoot),ownerRepoRoot,
    ownerRepository:repositoryName(ownerRepoRoot),
    sharedLedger:!samePath(ownerRepoRoot,code),
    side:ROLE_SIDES[String(resolved.role??'').toLowerCase()]??null,
    exists};
}

/**
 * Whether a shared ledger is safe to start a workflow against. The kernel commits its own writes in the
 * owner repository, so a pending change there that the kernel does not own has to reach the user first: it
 * would otherwise be swept into a `work(...)` commit nobody authored.
 */
export function sharedLedgerStatus({ownerRepoRoot,ledgerRoot,git=spawnSync}={}){
  const owner=path.resolve(required(ownerRepoRoot,'ledger owner repository'));
  const root=slash(path.relative(owner,path.resolve(required(ledgerRoot,'ledger root'))))||'.';
  const shown=git('git',['status','--porcelain','--',root],{cwd:owner,encoding:'utf8',windowsHide:true});
  if(shown?.status!==0)return {ok:true,root,readable:false,foreign:[],kernelOwned:[]};
  const files=unique((shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>slash(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))));
  const kernelOwned=files.filter(file=>KERNEL_OWNED_LEDGER.test(file));
  const foreign=files.filter(file=>!KERNEL_OWNED_LEDGER.test(file));
  return {ok:foreign.length===0,root,readable:true,foreign,kernelOwned};
}
