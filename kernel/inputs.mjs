import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {loadConfig} from '../scripts/config/config.mjs';
import {GOAL_RECORD,REF_KINDS,plain,sealedRuntimeOf} from './common.mjs';
import {fillWaitingAsks} from './fill.mjs';
import {inputBinding} from './inputs-model.mjs';
import {inputFiles,privateJson,processAlive} from './inputs-server.mjs';
import {deriveOwnerRequests} from './owner-requests.mjs';

const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
const OK=result=>result?.outcome==='ok';
const WAIT_MS=30000;
/**
 * The detached input helper is a worker like any other: it never touches the ledger file directly, so its
 * session/launch/lock/server coordination lives in scratch, under `os.tmpdir()/starci/<hash>/` - never in
 * `.starciwork`. `inputs.lock` itself is the one signal of the four the kernel also reads on its own tick,
 * so it lives in the ledger's `signals` table instead (scope the workflow id, key `inputs-lock`).
 *
 * A workflow id is unique only inside its own ledger (`(repoRoot,id)` together), so the scratch directory
 * is keyed by both - keying by `id` alone let two workflows of the same id in different repositories share
 * one scratch directory and read each other's session.
 */
export const inputScratchDir=(id,repoRoot)=>path.join(os.tmpdir(),'starci',
  crypto.createHash('sha256').update(`${path.resolve(required(repoRoot,'repository root'))}:${required(id,'workflow id')}`).digest('hex').slice(0,32));
function required(value,label){if(typeof value!=='string'||!value.trim())throw Error(`Missing ${label}`);return value.trim();}
const bindingMatches=(a,b)=>a&&b&&['id','repoRoot','workRoot','worktree','host'].every(key=>a[key]===b[key]);
// Approved goal references remain in state.inputs; the owner surface has its own lifecycle.
const status=(state,phase,extra={})=>(state.ownerInputs={...state.ownerInputs,phase,...extra});
const SURFACE_PHASES=['idle','starting','restarting','checking','unavailable','opening','ready','finished'];
const SURFACE_FIELDS={
  phase:value=>SURFACE_PHASES.includes(value),
  reason:value=>value===null||typeof value==='string',
  lastCheckedAt:value=>Number.isFinite(value)&&value>=0,
  session:value=>typeof value==='string'&&/^[a-f0-9]{32}$/.test(value),
  priorSession:value=>value===null||typeof value==='string'&&/^[a-f0-9]{32}$/.test(value),
  page:value=>value===null||typeof value==='string'&&value.length>0,
  createUncertain:value=>typeof value==='boolean'
};

/** Recover only the earlier GUI/goal-key collision, from the unchanged approved goal's exact references. */
export function recoverWorkflowInputReferences(store,state){
  if(Array.isArray(state.inputs))return {ok:true,recovered:false};
  const collided=state.inputs;
  const refused=reason=>({ok:false,recovered:false,reason});
  if(!plain(collided)||!SURFACE_PHASES.includes(collided.phase))return refused('input-reference-shape-invalid');
  const numeric=Object.keys(collided).filter(key=>/^(0|[1-9][0-9]*)$/.test(key)).sort((a,b)=>Number(a)-Number(b));
  if(numeric.some((key,index)=>key!==String(index)))return refused('input-reference-shape-invalid');
  const surface={};
  for(const [key,value] of Object.entries(collided)){
    if(numeric.includes(key))continue;
    if(!Object.hasOwn(SURFACE_FIELDS,key)||!SURFACE_FIELDS[key](value))return refused('input-reference-shape-invalid');
    surface[key]=value;
  }
  const refs=numeric.map(key=>collided[key]);
  const validRefs=items=>Array.isArray(items)&&items.every(item=>plain(item)&&Object.keys(item).length===2
    &&REF_KINDS.includes(item.kind)&&typeof item.ref==='string'&&item.ref.trim().length>0);
  if(!validRefs(refs)||(state.ownerInputs!=null&&!plain(state.ownerInputs)))return refused('input-reference-shape-invalid');
  const goal=store.goal()?.json??null;
  if(!plain(goal))return refused('input-reference-goal-unavailable');
  const equalRefs=(a,b)=>a.length===b.length&&a.every((item,index)=>item.kind===b[index].kind&&item.ref===b[index].ref);
  if(!state.approved||goal.schema!==GOAL_RECORD||goal.id!==state.id||goal.job!==state.job
    ||!validRefs(goal.inputs)||!equalRefs(refs,goal.inputs))return refused('input-reference-goal-mismatch');
  // A corrected kernel may already have newer surface status. It wins over the retained legacy fields.
  state.ownerInputs={...surface,...state.ownerInputs};
  state.inputs=structuredClone(goal.inputs);
  store.appendEvent({event:'input-references-recovered',count:state.inputs.length,source:'approved-goal'});
  store.saveState(state);
  return {ok:true,recovered:true};
}

const runtimeVersion=()=>crypto.createHash('sha256').update(fs.readFileSync(new URL('./inputs-server.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./inputs-model.mjs',import.meta.url))).update(fs.readFileSync(new URL('./inputs-ui.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./inputs-readiness.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./inputs-replacement.mjs',import.meta.url))).update(fs.readFileSync(new URL('./owner-requests.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./owner-inbox.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('../core/identity.mjs',import.meta.url))).digest('hex');

/** Reconcile before the kernel blocks: save current asks, own one helper, and own one embedded Orca tab. */
export function reconcileWorkflowInputs(orca,store,state,{host=orca?.host,now=Date.now,spawnProcess=spawn,alive=processAlive}={}){
  if(host?.name!=='orca')return {phase:'headless'};
  const waiting=[...new Set([...fillWaitingAsks(state),...deriveOwnerRequests(state).filter(request=>['waiting-owner','needs-correction'].includes(request.status)).map(request=>state.ops.find(op=>op.id===request.opId)).filter(Boolean)])];
  if(!waiting.length&&!state.ownerInputs)return {phase:'idle'};
  // The helper reads this snapshot independently while the kernel uses synchronous waits.
  store.saveState(state);
  const scratch=inputScratchDir(state.id,store.repoRoot);
  fs.mkdirSync(scratch,{recursive:true});
  let binding;
  try{binding=inputBinding(state,store);}catch{return status(state,'unavailable',{reason:'workflow-binding-unavailable'});}
  const files=inputFiles(scratch),at=now();
  let session=read(files.session),lock=store.signal.get(state.id,'inputs-lock'),launch=read(files.launch),server=read(files.server);
  if(session&&!bindingMatches(session.binding,binding))return status(state,'unavailable',{reason:'workflow-binding-changed'});
  if(lock&&!alive(lock.pid)){store.signal.clear(state.id,'inputs-lock');lock=null;}
  if(session&&lock&&session.runtimeVersion!==runtimeVersion()){
    if(!session.retire){session.retire=true;privateJson(files.session,session);}
    return status(state,'restarting',{reason:null});
  }
  if(!lock&&(!launch||!alive(launch.pid))){
    if(!waiting.length||state.finished)return status(state,state.finished?'finished':'idle');
    // A crashed launcher with an unrecorded child is fenced by a new session generation AND the exclusive helper lock.
    if(launch?.phase==='starting'&&at-launch.at<WAIT_MS)return status(state,'starting');
    let language='vi';try{language=loadConfig(state.host).language;}catch{}
    session={schema:'starci/input-session@1',id:crypto.randomBytes(16).toString('hex'),token:crypto.randomBytes(32).toString('base64url'),
      binding,language,createdAt:at,runtimeVersion:runtimeVersion()};
    privateJson(files.session,session);
    privateJson(files.launch,{session:session.id,phase:'starting',pid:null,at});
    try{
      const runtimeRoot=sealedRuntimeOf(state)?.root??state.host;
      const child=spawnProcess(process.execPath,[path.join(runtimeRoot,'bin','starci.mjs'),'workflow-inputs','--session',files.session],
        {cwd:state.worktree,stdio:'ignore',detached:true,windowsHide:true});
      child.on('error',()=>{});child.unref();
      privateJson(files.launch,{session:session.id,phase:child.pid?'spawned':'starting',pid:child.pid??null,at});
      return status(state,'starting',{reason:null});
    }catch{return status(state,'unavailable',{reason:'input-helper-start-failed'});}
  }
  if(!session||server?.session!==session.id||!alive(server.pid)||lock?.value?.session!==session.id)return status(state,'starting');
  const url=`http://127.0.0.1:${server.port}/inputs/${session.id}#${session.token}`;
  if(at-(state.ownerInputs?.lastCheckedAt??0)<WAIT_MS&&state.ownerInputs?.session===session.id&&state.ownerInputs?.page)return state.ownerInputs;
  const previousSession=state.ownerInputs?.session!==session.id?state.ownerInputs?.session:state.ownerInputs?.priorSession;
  status(state,'checking',{lastCheckedAt:at,session:session.id,priorSession:previousSession??null});
  // Browser operations are typed and verified. An unknown create is reconciled by list, never blindly repeated.
  try{
    const verified=orca.verify({cwd:state.worktree});
    if(!verified.ok)return status(state,'unavailable',{reason:'orca-contract-unavailable'});
    const selector=`path:${state.worktree.replaceAll('\\','/')}`;
    const listed=orca.invoke('tab-list',{worktree:selector},{cwd:state.worktree});
    if(!OK(listed))return status(state,'unavailable',{reason:'orca-tab-list-unavailable'});
    const tabs=listed.receipt?.result?.tabs;
    if(!Array.isArray(tabs))return status(state,'unavailable',{reason:'orca-tab-list-unavailable'});
    // Only an exact persisted page or this helper's exact URL is ours; never close or reuse an owner's other tab.
    const owned=tab=>{try{const address=new URL(tab.url);return address.hostname==='127.0.0.1'
      &&[session.id,previousSession].filter(Boolean).some(id=>address.pathname===`/inputs/${id}`);}catch{return false;}};
    const matches=tabs.filter(tab=>tab.url===url);
    let tab=matches[0]??tabs.find(tab=>tab.browserPageId===state.ownerInputs?.page&&owned(tab))??tabs.find(owned);
    if(matches.length>1)return status(state,'unavailable',{reason:'duplicate-input-pages'});
    if(tab&&tab.url!==url){
      const updated=orca.invoke('tab-goto',{worktree:selector,page:tab.browserPageId,url},{cwd:state.worktree});
      if(!OK(updated))return status(state,'unavailable',{reason:'input-page-navigation-unconfirmed'});
      return status(state,'opening',{page:tab.browserPageId,reason:null,createUncertain:false});
    }
    if(!tab){
      if(!waiting.length)return status(state,state.finished?'finished':'idle',{page:null});
      if(state.ownerInputs?.createUncertain)return status(state,'unavailable',{reason:'input-page-create-unconfirmed'});
      // Persist intent BEFORE effect, so a crash after tab-create never causes an untracked second page.
      state.ownerInputs.createUncertain=true;store.saveState(state);
      const created=orca.invoke('tab-create',{worktree:selector,url},{cwd:state.worktree});
      const page=created.receipt?.result?.browserPageId;
      if(!OK(created)||!page){
        if(created.effectState==='none')state.ownerInputs.createUncertain=false;
        return status(state,'unavailable',{reason:'input-page-create-unconfirmed'});
      }
      return status(state,'opening',{page,reason:null,createUncertain:false});
    }
    return status(state,tab.loadError?'unavailable':tab.title?.includes(state.id)?'ready':'opening',
      {page:tab.browserPageId,reason:tab.loadError?'input-page-load-failed':null,createUncertain:false});
  }catch{return status(state,'unavailable',{reason:'orca-input-page-unavailable'});}
}
