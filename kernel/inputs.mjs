import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {loadConfig} from '../scripts/config.mjs';
import {fillWaitingAsks} from './fill.mjs';
import {inputBinding} from './inputs-model.mjs';
import {inputFiles,privateJson,processAlive} from './inputs-server.mjs';

const read=file=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}};
const OK=result=>result?.outcome==='ok';
const WAIT_MS=30000;
const bindingMatches=(a,b)=>a&&b&&['id','dir','workRoot','worktree','host'].every(key=>a[key]===b[key]);
const status=(state,phase,extra={})=>(state.inputs={...state.inputs,phase,...extra});
const runtimeVersion=()=>crypto.createHash('sha256').update(fs.readFileSync(new URL('./inputs-server.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./inputs-model.mjs',import.meta.url))).update(fs.readFileSync(new URL('./inputs-ui.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./inputs-readiness.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('./inputs-replacement.mjs',import.meta.url)))
  .update(fs.readFileSync(new URL('../core/identity.mjs',import.meta.url))).digest('hex');

/** Reconcile before the kernel blocks: save current asks, own one helper, and own one embedded Orca tab. */
export function reconcileWorkflowInputs(orca,store,state,{host=orca?.host,now=Date.now,spawnProcess=spawn,alive=processAlive}={}){
  if(host?.name!=='orca')return {phase:'headless'};
  const waiting=fillWaitingAsks(state);
  if(!waiting.length&&!state.inputs)return {phase:'idle'};
  // The helper reads this snapshot independently while the kernel uses synchronous waits.
  store.saveState(state);
  let binding;
  try{binding=inputBinding(state,store.dir);}catch{return status(state,'unavailable',{reason:'workflow-binding-unavailable'});}
  const files=inputFiles(store.dir),at=now();
  let session=read(files.session),lock=read(files.lock),launch=read(files.launch),server=read(files.server);
  if(session&&!bindingMatches(session.binding,binding))return status(state,'unavailable',{reason:'workflow-binding-changed'});
  if(lock&&!alive(lock.pid)){fs.rmSync(files.lock,{force:true});lock=null;}
  if(session&&lock&&session.runtimeVersion!==runtimeVersion()){
    if(!session.retire){session.retire=true;privateJson(files.session,session);}
    return status(state,'restarting',{reason:null});
  }
  if(!lock&&(!launch||!alive(launch.pid))){
    if(!waiting.length||state.finished)return status(state,state.finished?'finished':'idle');
    // A crashed launcher with an unrecorded child is fenced by a new session generation AND the exclusive helper lock.
    if(launch?.phase==='starting'&&at-launch.at<WAIT_MS)return status(state,'starting');
    let language='vi';try{language=loadConfig(state.host).language;}catch{}
    session={schema:'starci/input-session@1',id:crypto.randomBytes(16).toString('hex'),token:crypto.randomBytes(32).toString('base64url'),binding,language,createdAt:at,runtimeVersion:runtimeVersion()};
    privateJson(files.session,session);
    privateJson(files.launch,{session:session.id,phase:'starting',pid:null,at});
    try{
      const child=spawnProcess(process.execPath,[path.join(state.host,'bin','starci.mjs'),'workflow-inputs','--session',files.session],
        {cwd:state.worktree,stdio:'ignore',detached:true,windowsHide:true});
      child.on('error',()=>{});child.unref();
      privateJson(files.launch,{session:session.id,phase:child.pid?'spawned':'starting',pid:child.pid??null,at});
      return status(state,'starting',{reason:null});
    }catch{return status(state,'unavailable',{reason:'input-helper-start-failed'});}
  }
  if(!session||server?.session!==session.id||!alive(server.pid)||lock?.session!==session.id)return status(state,'starting');
  const url=`http://127.0.0.1:${server.port}/inputs/${session.id}#${session.token}`;
  if(at-(state.inputs?.lastCheckedAt??0)<WAIT_MS&&state.inputs?.session===session.id&&state.inputs?.page)return state.inputs;
  const previousSession=state.inputs?.session!==session.id?state.inputs?.session:state.inputs?.priorSession;
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
    let tab=matches[0]??tabs.find(tab=>tab.browserPageId===state.inputs?.page&&owned(tab))??tabs.find(owned);
    if(matches.length>1)return status(state,'unavailable',{reason:'duplicate-input-pages'});
    if(tab&&tab.url!==url){
      const updated=orca.invoke('tab-goto',{worktree:selector,page:tab.browserPageId,url},{cwd:state.worktree});
      if(!OK(updated))return status(state,'unavailable',{reason:'input-page-navigation-unconfirmed'});
      return status(state,'opening',{page:tab.browserPageId,reason:null,createUncertain:false});
    }
    if(!tab){
      if(!waiting.length)return status(state,state.finished?'finished':'idle',{page:null});
      if(state.inputs?.createUncertain)return status(state,'unavailable',{reason:'input-page-create-unconfirmed'});
      // Persist intent BEFORE effect, so a crash after tab-create never causes an untracked second page.
      state.inputs.createUncertain=true;store.saveState(state);
      const created=orca.invoke('tab-create',{worktree:selector,url},{cwd:state.worktree});
      const page=created.receipt?.result?.browserPageId;
      if(!OK(created)||!page){
        if(created.effectState==='none')state.inputs.createUncertain=false;
        return status(state,'unavailable',{reason:'input-page-create-unconfirmed'});
      }
      return status(state,'opening',{page,reason:null,createUncertain:false});
    }
    return status(state,tab.loadError?'unavailable':tab.title?.includes(state.id)?'ready':'opening',
      {page:tab.browserPageId,reason:tab.loadError?'input-page-load-failed':null,createUncertain:false});
  }catch{return status(state,'unavailable',{reason:'orca-input-page-unavailable'});}
}
