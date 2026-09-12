import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {nodeDirectory,nodeFile} from './work-ledger.mjs';

/**
 * The guards the kernel owes itself before and around an operation (5.0). Three things an operation
 * agent must never be trusted with: the ledger record of its own node, an exclusive machine resource,
 * and the repository's git index. This module is the only place those are enforced — it reads and
 * repairs, it never decides scheduling, and it writes nothing outside the paths it protects.
 */
export const PROTECTED_SUFFIX='/**';
/** Locks inferred from what an operation actually runs, so two ops that need one machine never overlap. */
export const LOCK_RULES=[
  // Testcontainers isolate their own database per run, so container suites do not clash; only the shared local
  // stack (fixed ports), the e2e runtime and the cluster are exclusive resources.
  {pattern:/localhost:5432|127\.0\.0\.1:5432|localhost:8089|start:dev|docker compose/i,locks:['local-stack']},
  {pattern:/test:e2e|e2e/i,locks:['e2e-runtime']},
  {pattern:/kubectl|helm|KUBECONFIG/i,locks:['cluster']},
  {pattern:/uat\.verify|playwright/i,locks:['e2e-runtime']}
];
/** A pre-commit hook that names one of these is a secrets guard the kernel must declare around its own digests. */
export const SECRETS_GUARD=/secrets-guard|ALLOW_SECRET_SCAN/;
const SHARED_PREFIXES=['apps/','src/','packages/','libs/','.starciwork/'];
const URL_LIKE=/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi;
const PATH_TOKEN=/[A-Za-z0-9_@.][A-Za-z0-9_@.*/-]*/g;

const need=(condition,message)=>{if(!condition)throw Error(message);};
const slash=value=>String(value).replaceAll('\\','/').replace(/^\.\//,'');
const unique=values=>[...new Set(values)];
const sorted=values=>unique(values).sort((a,b)=>a.localeCompare(b));
const tail=(value,limit=200)=>String(value??'').trim().split('\n').at(-1)?.slice(0,limit)??'';
const isPromise=value=>value!==null&&typeof value==='object'&&typeof value.then==='function';

/* ------------------------------------------------------------------ protected paths */

/** The spec of a protected directory is `<dir>/**`; git and fs both want the bare directory. */
const expand=spec=>spec.endsWith(PROTECTED_SUFFIX)?spec.slice(0,-PROTECTED_SUFFIX.length).replace(/\/+$/,''):spec;
const covers=(file,spec)=>{const base=expand(spec);return file===base||file.startsWith(`${base}/`);};

/**
 * What the kernel owns on a Work node: the node's `index.yaml` and its whole evidence folder. An
 * operation agent may read these and may not write them — a completion it writes itself is a claim,
 * not a record, so the kernel reverts the write instead of accepting it.
 */
export function protectedPaths(node,repoRoot){
  need(typeof node==='string'||(node!==null&&typeof node==='object'),'A Work node is required');
  const root=path.resolve(String(repoRoot??'.'));
  const relative=target=>{const value=slash(path.relative(root,target));return value&&!value.startsWith('..')?value:slash(target);};
  return unique([relative(nodeFile(root,node)),`${relative(nodeDirectory(root,node))}/evidence${PROTECTED_SUFFIX}`]);
}

/** One porcelain read of the protected specs, with untracked directories expanded to their files. */
function statusEntries(git,{cwd,paths}){
  const specs=unique((paths??[]).map(slash).filter(Boolean));
  if(!specs.length)return {specs,entries:[]};
  const shown=git('git',['status','--porcelain','--',...unique(specs.map(expand))],{cwd,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return {specs,entries:[]};
  const seen=new Set(),entries=[];
  for(const line of (shown.stdout??'').split('\n').map(item=>item.replace(/\s+$/,'')).filter(Boolean)){
    const code=line.slice(0,2),untracked=code.trim()==='??';
    const named=slash(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''));
    // Git collapses a wholly untracked directory into one `dir/` line; the kernel needs the files inside it.
    for(const file of named.endsWith('/')?walk(cwd,named):[named]){
      if(seen.has(file)||!specs.some(spec=>covers(file,spec)))continue;
      seen.add(file);entries.push({file,code,untracked});
    }
  }
  return {specs,entries};
}

function walk(cwd,relative){
  const base=relative.replace(/\/+$/,''),root=path.resolve(cwd,base);
  let listed=[];
  try{listed=fs.readdirSync(root,{withFileTypes:true});}catch{return [];}
  return listed.flatMap(entry=>entry.isDirectory()?walk(cwd,`${base}/${entry.name}`):[`${base}/${entry.name}`]);
}

/** Protected paths this worktree actually changed: different from HEAD, or untracked. */
export function changedProtected(git,{cwd,paths}){
  return sorted(statusEntries(git,{cwd,paths}).entries.map(entry=>entry.file));
}

/**
 * Put the protected paths back the way HEAD has them: tracked changes are checked out, untracked files
 * under a protected directory are deleted. Nothing outside `paths` is ever read, restored or removed.
 */
export function revertProtected(git,{cwd,paths}){
  const {specs,entries}=statusEntries(git,{cwd,paths});
  const directories=specs.filter(spec=>spec.endsWith(PROTECTED_SUFFIX)).map(expand);
  const tracked=sorted(entries.filter(entry=>!entry.untracked).map(entry=>entry.file));
  const loose=sorted(entries.filter(entry=>entry.untracked&&directories.some(directory=>entry.file===directory||entry.file.startsWith(`${directory}/`))).map(entry=>entry.file));
  const reverted=[],removed=[];
  if(tracked.length){
    const out=git('git',['checkout','--',...tracked],{cwd,encoding:'utf8',windowsHide:true});
    if(out.status===0)reverted.push(...tracked);
  }
  for(const file of loose){
    try{fs.rmSync(path.resolve(cwd,file),{force:true});removed.push(file);}catch{/* a file already gone needs no removal */}
  }
  return {reverted,removed};
}

/* ------------------------------------------------------------------ exclusive resources */

/**
 * The machine resources one operation needs: whatever it declared in `op.resources` plus what its own
 * checks and kind prove it will reach for. Disjoint allowlists make two ops parallel; a shared lock
 * makes them sequential anyway, because one Docker daemon and one e2e runtime are not shareable.
 */
export function resourceLocks(op){
  const declared=Array.isArray(op?.resources)?op.resources.filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim()):[];
  const text=[typeof op?.kind==='string'?op.kind:'',...(Array.isArray(op?.checks)?op.checks:[]).map(check=>typeof check?.command==='string'?check.command:'')].join('\n');
  return sorted([...declared,...LOCK_RULES.filter(rule=>rule.pattern.test(text)).flatMap(rule=>rule.locks)]);
}

const locksOf=value=>Array.isArray(value)?sorted(value.filter(item=>typeof item==='string').map(item=>item.trim()).filter(Boolean)):resourceLocks(value);
/** True when two operations (or two lock lists) need the same resource. */
export function resourcesClash(a,b){const right=new Set(locksOf(b));return locksOf(a).some(lock=>right.has(lock));}

/* ------------------------------------------------------------------ the git queue */

let chain=Promise.resolve(),pending=0;
/**
 * One git index per worktree, so every git call the kernel makes runs alone. A synchronous callback on
 * an idle queue runs at once and returns its value unwrapped; anything asynchronous, and anything
 * arriving while asynchronous work is in flight, is promise-chained behind it in call order.
 */
export function gitQueue(fn){
  need(typeof fn==='function','gitQueue needs a function to run');
  if(pending===0){
    const result=fn();
    if(!isPromise(result))return result;
    pending+=1;
    chain=result.then(()=>{},()=>{}).then(()=>{pending-=1;});
    return result;
  }
  pending+=1;
  const queued=chain.then(()=>fn(),()=>fn());
  chain=queued.then(()=>{pending-=1;},()=>{pending-=1;});
  return queued;
}
/** Whether asynchronous git work is still queued; for assertions and shutdown, not for scheduling. */
export const gitQueueIdle=()=>pending===0;

/* ------------------------------------------------------------------ worktree preflight */

function secretsGuard(cwd,hooksPath){
  const candidates=unique([hooksPath?path.resolve(cwd,hooksPath,'pre-commit'):null,path.join(cwd,'.husky','pre-commit'),path.join(cwd,'.git','hooks','pre-commit')].filter(Boolean));
  return candidates.some(file=>{try{return fs.statSync(file).isFile()&&SECRETS_GUARD.test(fs.readFileSync(file,'utf8'));}catch{return false;}});
}

/**
 * What the kernel checks and repairs once, before it launches anything into a worktree. A fix is
 * applied and recorded; a problem is not repairable here and belongs to the user. Every path is
 * compared in slash form, so a Windows separator is never itself a finding.
 */
export function preflight({worktree,git=spawnSync}={}){
  const cwd=path.resolve(String(worktree??'.'));
  const run=args=>git('git',args,{cwd,encoding:'utf8',windowsHide:true});
  const read=key=>{const shown=run(['config','--get',key]);const value=shown.status===0?(shown.stdout??'').trim():'';return value||null;};
  const fixes=[],problems=[];
  let longpaths=read('core.longpaths');
  if(!longpaths){
    const set=run(['config','core.longpaths','true']);
    if(set.status===0){longpaths='true';fixes.push('set core.longpaths true so a deep evidence path can be written');}
    else problems.push(`core.longpaths could not be set: ${tail(set.stderr)||`exit ${set.status}`}`);
  }
  const hooksPath=read('core.hooksPath');
  const facts={longpaths,autocrlf:read('core.autocrlf'),hooksPath:hooksPath?slash(hooksPath):null,secretsGuard:secretsGuard(cwd,hooksPath)};
  const status=run(['status','--porcelain']);
  if(status.status!==0)problems.push(`git status does not run in ${slash(cwd)}: ${tail(status.stderr)||`exit ${status.status}`}`);
  const shown=run(['rev-parse','--abbrev-ref','HEAD']);
  const branch=shown.status===0?(shown.stdout??'').trim():'unknown';
  if(['main','master'].includes(branch))problems.push(`the workflow worktree is on ${branch}; a workflow commits on its own branch`);
  return {ok:problems.length===0,fixes,problems,facts};
}

/* ------------------------------------------------------------------ shared-change paths */

/**
 * The repository-relative paths a report names in prose — a `shared-change` blocker detail, a review
 * finding. Only tokens that look like a file or a declared directory survive: an extension, a `/**`
 * directory, or one of the source roots. URLs are dropped, because a link is not a write scope.
 */
export function parseSharedChangePaths(detail){
  const text=String(detail??'').replaceAll('\\','/').replace(URL_LIKE,' ');
  const found=[];
  for(const raw of text.match(PATH_TOKEN)??[]){
    const token=raw.replace(/[),;:.'"`\]]+$/,'');
    const candidate=token.endsWith(PROTECTED_SUFFIX)?token:token.replace(/\/+$/,'');
    if(!candidate.includes('/'))continue;
    const accepted=candidate.endsWith(PROTECTED_SUFFIX)||SHARED_PREFIXES.some(prefix=>candidate.startsWith(prefix))||/\/[^/]*\.[A-Za-z0-9]{1,8}$/.test(candidate);
    if(accepted&&!found.includes(candidate))found.push(candidate);
  }
  return found;
}
