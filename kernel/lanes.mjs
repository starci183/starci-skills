import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {getPath} from '../hosts/orca/calls.mjs';
import {listWorkflows} from './store.mjs';
import {samePath} from './routing.mjs';
import {currentBranch,firstLine,need,normalize,plain,required,slash,tail,unique} from './common.mjs';

/**
 * The lane of a workflow - the worktree it owns - is its own concern, and a small one: a place is created, a
 * row is named, a branch is merged home or it is not. It lives apart from the kernel loop because none of it
 * is about operations: it happens once before the first op exists and once after the last one is accepted,
 * and the only thing the loop asks of it is whether the merge went home.
 *
 * This is not the kind lane a node travels (`state.lanes`, `kernel/sync.mjs`); it is the place the whole
 * workflow happens.
 */

/**
 * A **lane** is the worktree one workflow owns: the kernel, every operation of that workflow and nothing else
 * live in it, on its own branch, and Orca shows it as one top-level row `[Workflow] <id>`. This is not the
 * kind lane a node travels (`state.lanes`, `laneOf`); it is the place the whole workflow happens.
 *
 * Two workflows never share a worktree, because sharing one is what made three workflows' agents hang under a
 * single Orca row with no way to tell whose operation is whose. The branch is merged back into the branch the
 * lane was cut from when, and only when, the workflow finishes `done`.
 */
export const laneRowTitle=id=>`[Workflow] ${required(id,'workflow id')}`;
export const LANE_NAME=/^[A-Za-z0-9][A-Za-z0-9._-]*$/;
/** `--lane` alone takes the workflow id as the name; `--lane <name>` takes that name, validated as one segment. */
export function laneNameOf(value,id){
  const named=typeof value==='string'&&value.trim()&&value.trim()!=='true'?value.trim():String(id);
  need(LANE_NAME.test(named),`A lane name is one path segment of letters, digits, dot, dash or underscore: ${named}`);
  return named;
}
export const laneBranchRef=value=>String(value??'').replace(/^refs\/heads\//,'').trim();
/** The lane row Orca just created, read from its receipt - never guessed, because the branch is Orca's to name. */
export function laneReceipt(receipt){
  const row=getPath(receipt,'result.worktree');
  const worktree=[row?.path,row?.worktreePath,row?.root,row?.directory].find(value=>typeof value==='string'&&value.trim());
  const branch=[row?.branch,row?.branchRef,row?.ref].map(laneBranchRef).find(Boolean);
  return {worktree:worktree?path.resolve(worktree):null,branch:branch??null,orcaId:row?.id??null};
}
/**
 * The workflow whose lane is this worktree, if any. A lane never opens a lane of its own: the rows would nest
 * and the owner would be back to guessing whose operation is whose.
 */
export function laneOwnerOf(roots,worktree){
  const target=path.resolve(worktree);
  for(const root of unique((roots??[]).filter(Boolean).map(item=>path.resolve(item)))){
    let entries=[];
    try{entries=listWorkflows(root);}catch{entries=[];}
    for(const entry of entries){
      const lane=entry.state?.lane;
      if(plain(lane)&&lane.worktree&&samePath(lane.worktree,target))return {id:entry.id,dir:entry.dir,lane};
    }
  }
  return null;
}
/**
 * Create the lane of one workflow: an Orca worktree of this repository, on a new branch cut from the branch the
 * caller is on, as a top-level row named `[Workflow] <id>` and marked in progress. Every failure is Orca's own
 * reason - a name that already exists is surfaced, never worked around.
 */
export function openLane(orca,{id,name,repoRoot,base,baseBranch,cwd=base,git=spawnSync}){
  need(plain(orca)&&typeof orca.invoke==='function','--lane needs an Orca runner: the lane is an Orca worktree');
  const created=orca.invoke('worktree-create',{repo:`path:${slash(path.resolve(repoRoot))}`,name,
    'base-branch':required(baseBranch,'base branch'),setup:'skip','no-parent':true},{cwd});
  need(created.outcome==='ok',`orca worktree create --name ${name} failed (${created.effectState??'unknown'}): ${created.reason??'no reason'}`);
  const row=laneReceipt(created.receipt);
  need(row.worktree&&fs.existsSync(row.worktree),`orca worktree create --name ${name} reported no worktree on disk: ${slash(row.worktree??'')}`);
  const branch=(()=>{const here=currentBranch(row.worktree,git);return here&&here!=='unknown'&&here!=='HEAD'?here:row.branch;})();
  need(branch,`The lane ${name} has no branch: neither the receipt nor ${slash(row.worktree)} names one`);
  const titled=orca.invoke('worktree-set',{worktree:`path:${slash(row.worktree)}`,'display-name':laneRowTitle(id),
    'workspace-status':'in-progress'},{cwd});
  need(titled.outcome==='ok',`orca worktree set --display-name "${laneRowTitle(id)}" failed: ${titled.reason??'no reason'}`);
  return {name,worktree:row.worktree,branch,orcaId:row.orcaId,
    base:{worktree:path.resolve(base),branch:baseBranch}};
}
/**
 * A lane's worktree is gone from disk - the checkout was deleted, but its branch lives on in the repository -
 * and the kernel needs a place to run again before it can resume. `reopenLane` recreates it through the same
 * Orca call `openLane` uses, naming the recorded branch as the base so the reopened tree starts from its own
 * last commit; the row is retitled exactly as a fresh lane's is, so Orca never shows two rows for one workflow.
 *
 * `providers/orca/calls.yaml` documents no `worktree-create` flag that checks out an existing branch instead
 * of cutting a new one from a base - only `base-branch`. Until that lands, the recorded branch is passed as
 * `base-branch` (the closest lever the contract offers) and the exact `path` is passed alongside as a hint a
 * host adapter may honour; the worktree Orca actually reports is what the caller gets back, never guessed.
 */
export function reopenLane(orca,{workflowId,branch,path:recordedPath,repoRoot,cwd=repoRoot}){
  need(plain(orca)&&typeof orca.invoke==='function','reopenLane needs an Orca runner: the lane is an Orca worktree');
  const id=required(workflowId,'workflow id'),recordedBranch=required(branch,'lane branch'),target=required(recordedPath,'lane worktree path');
  const base=required(repoRoot,'repository root the lane was cut from');
  const name=path.basename(target);
  const created=orca.invoke('worktree-create',{repo:`path:${slash(path.resolve(base))}`,name,'base-branch':recordedBranch,path:slash(target),
    setup:'skip','no-parent':true},{cwd});
  need(created.outcome==='ok',`orca worktree create --name ${name} failed to reopen the lane (${created.effectState??'unknown'}): ${created.reason??'no reason'}`);
  const row=laneReceipt(created.receipt);
  need(row.worktree&&fs.existsSync(row.worktree),`orca worktree create --name ${name} reported no worktree on disk while reopening the lane: ${slash(row.worktree??'')}`);
  const titled=orca.invoke('worktree-set',{worktree:`path:${slash(row.worktree)}`,'display-name':laneRowTitle(id),'workspace-status':'in-progress'},{cwd});
  need(titled.outcome==='ok',`orca worktree set --display-name "${laneRowTitle(id)}" failed while reopening the lane: ${titled.reason??'no reason'}`);
  return {name,worktree:row.worktree,branch:row.branch??recordedBranch,orcaId:row.orcaId};
}
/** The lane as a reader sees it: both trees, both branches, and the merge that took it home. */
export function laneView(state){
  const lane=state?.lane;
  if(!plain(lane))return null;
  return {name:lane.name??null,worktree:lane.worktree?slash(lane.worktree):null,branch:lane.branch??null,
    base:{worktree:lane.base?.worktree?slash(lane.base.worktree):null,branch:lane.base?.branch??null},
    orcaId:lane.orcaId??null,
    merged:plain(lane.merged)?{commit:lane.merged.commit??null,into:lane.merged.into??lane.base?.branch??null,at:lane.merged.at??null}:null,
    conflict:plain(lane.conflict)?{files:[...(lane.conflict.files??[])]}:null,
    closed:plain(lane.closed)?{at:lane.closed.at??null,preservedBranch:lane.closed.preservedBranch??lane.branch??null}:null};
}
/** Tell Orca what the row is now; the workflow's outcome never depends on the sidebar, so a refusal is recorded, not thrown. */
export function setLaneStatus(orca,store,state,status){
  if(!plain(orca)||typeof orca.invoke!=='function'||!plain(state.lane))return null;
  const result=orca.invoke('worktree-set',{worktree:`path:${slash(state.lane.worktree)}`,'workspace-status':status},
    {cwd:fs.existsSync(state.lane.base?.worktree??'')?state.lane.base.worktree:state.lane.worktree});
  if(result.outcome!=='ok')store.appendEvent({event:'lane-status-failed',status,reason:result.reason??null});
  return result;
}
/** The files a refused merge names: the unmerged paths, or - when git refused before starting - the ones it listed. */
export function mergeConflictFiles(run,result){
  const unmerged=run(['diff','--name-only','--diff-filter=U']);
  const listed=unmerged.status===0?(unmerged.stdout??'').split('\n').map(line=>line.trim()).filter(Boolean):[];
  if(listed.length)return unique(listed.map(normalize));
  return unique(`${result.stdout??''}\n${result.stderr??''}`.split('\n')
    .filter(line=>/^\s+\S/.test(line)).map(line=>normalize(line.trim())).filter(Boolean)).slice(0,20);
}
/**
 * The lane goes home: `git merge --no-ff` of the lane branch into the base branch, run in the base worktree.
 *
 * A conflict is not a merge the kernel may force. The base worktree is somebody's working copy - it may carry
 * uncommitted changes and a kernel of its own - so git refusing to overwrite a pending file is treated exactly
 * like a content conflict: the merge is aborted, nothing in the base is stashed or reset, and the workflow
 * finishes `blocked` with the conflicting files in a `merge` needUser item for the owner to settle by hand.
 */
export function mergeLane(store,state,ctx){
  const lane=state.lane;
  const base=lane.base?.worktree;
  const git=ctx?.git??spawnSync;
  const run=args=>git('git',args,{cwd:base,encoding:'utf8',windowsHide:true,env:{...process.env,ALLOW_SECRET_SCAN:'1'}});
  // The base worktree may have moved on. A merge goes into whatever branch is checked out there, so a different
  // branch is not this lane's merge at all: it is refused like a conflict and the owner settles it.
  const on=currentBranch(base,git);
  if(on!==lane.base.branch){
    const reason=`the base worktree ${slash(base)} is on ${on}, not ${lane.base.branch}`;
    lane.conflict={files:[],at:Date.now(),reason};
    store.appendEvent({event:'lane-merge-conflict',id:state.id,branch:lane.branch,base:lane.base.branch,files:[],reason});
    return {ok:false,files:[]};
  }
  const message=`merge(workflow): ${state.id} - ${lane.branch} into ${lane.base.branch}`;
  const merged=run(['merge','--no-ff','--no-edit','-m',message,lane.branch]);
  if(merged.status===0){
    const shown=run(['rev-parse','HEAD']);
    const commit=shown.status===0?(shown.stdout??'').trim():null;
    lane.merged={commit,into:lane.base.branch,at:Date.now()};
    delete lane.conflict;
    // The item asked for exactly this merge; a workflow resumed after a conflict is no longer waiting on it.
    state.needUser=state.needUser.filter(item=>item.kind!=='merge');
    store.appendEvent({event:'lane-merged',id:state.id,branch:lane.branch,base:lane.base.branch,commit});
    setLaneStatus(ctx?.orca,store,state,'completed');
    return {ok:true,commit};
  }
  const files=mergeConflictFiles(run,merged);
  // Abort whatever git did start; with nothing started there is nothing to abort and the refusal says so.
  run(['merge','--abort']);
  lane.conflict={files,at:Date.now(),reason:tail(merged.stderr,400)||tail(merged.stdout,400)};
  store.appendEvent({event:'lane-merge-conflict',id:state.id,branch:lane.branch,base:lane.base.branch,files,
    reason:lane.conflict.reason});
  return {ok:false,files};
}

/**
 * A done workflow hands its lane back before it writes its final report: the outcome the report states is the
 * outcome after the merge, so a lane that cannot go home is `blocked` in the report and not `done` with a
 * footnote. A base worktree that is no longer on disk is not a failure - there is nothing to merge into, and
 * the branch is kept either way.
 */
export function settleLane(store,state,outcome,ctx){
  if(outcome!=='done'||!plain(state.lane)||plain(state.lane.merged))return null;
  const base=state.lane.base?.worktree;
  if(!base||!fs.existsSync(base)){
    store.appendEvent({event:'lane-merge-skipped',id:state.id,branch:state.lane.branch,base:slash(base??''),
      reason:'the base worktree is not on disk'});
    return null;
  }
  const merged=mergeLane(store,state,ctx);
  if(merged.ok)return null;
  const detail=`the lane branch ${state.lane.branch} does not merge into ${state.lane.base.branch} in ${slash(base)}: ${merged.files.length?`conflicts in ${merged.files.join(', ')}`:firstLine(state.lane.conflict?.reason)||'git refused the merge'}; merge it by hand, then approve the workflow again`;
  if(!state.needUser.some(item=>item.kind==='merge'))state.needUser.push({kind:'merge',detail});
  return {outcome:'blocked',reason:detail};
}
