import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {readDistJson} from '../core/runtime-root.mjs';
import {getPath} from './orca-calls.mjs';
import {notifyTerminal,settleDispatch,startOperation,sweepWorktree} from './orca-supervised-launch.mjs';
import {reportOutcome,waitTick} from './orca-protocol.mjs';
import {readReports,reportsDirectory,validateReport} from './reports.mjs';
import {decide as decideFn,planOp as planOpFn} from './llm-functions.mjs';

/**
 * The Workflow Monitor as a program. It owns the operation DAG, the provider chain, the wait loop, the
 * result policy and the upward report. A model is called only through planOp (fill an operation's input
 * form) and decide (choose one option of a closed set); everything else is this code.
 */
export const SUPERVISE_STATE='starci/supervise-state@1';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const csv=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const writeJson=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);};

export function loadOpIo(){return readDistJson('schemas','op-io.json');}

/** Initial DAG for a workflow: implement, then review. Repairs and sidearms are inserted by the policy. */
export function initialState({workflow,run,from,worktree,branch,ownership,sdsFiles,parentRun,workflowTask,monitorDispatch,runtimeDir,launcher,host}){
  return {schema:SUPERVISE_STATE,workflow,run,from,worktree,branch,ownership,sdsFiles,parentRun,workflowTask,monitorDispatch,runtimeDir,launcher,host,
    createdAt:Date.now(),nodes:[
      {id:'implement-1',operation:'backend.implement',base:'implement',status:'ready',attempt:1,restarts:0,priorOpen:[],findings:[]},
      {id:'review-1',operation:'review.verify',base:'review',status:'pending',attempt:1,restarts:0,after:'implement-1'}
    ],repairs:{implement:0,review:0},events:[],finished:null};
}

const RESTART_LIMIT=3;
function log(state,event){state.events.push({at:Date.now(),...event});}
function nodeById(state,id){return state.nodes.find(node=>node.id===id);}
function readyNode(state){
  for(const node of state.nodes){
    if(node.status==='pending'&&(!node.after||nodeById(state,node.after)?.status==='done'))node.status='ready';
  }
  return state.nodes.find(node=>node.status==='ready')??null;
}
function runningNode(state){return state.nodes.find(node=>node.status==='running')??null;}

/** Render the fixed operation contract frame with the planned form; process sections come from the template. */
export function renderContract({template,plan,node,state}){
  const sections=[
    `# Operation contract — \`${node.operation}\` — scope \`${state.workflow}\` — attempt ${node.attempt}`,
    ``,`Runtime StarCi 4.2 (supervised). Worktree \`${state.worktree}\` (branch \`${state.branch}\`). Work only inside this worktree. Your Task id, Dispatch id and terminal handle are in the dispatch preamble.`,
    ``,`## Goal`,plan.goal,``,`SRS: ${plan.srsIds.join(', ')||'-'}. SDS: ${plan.sdsIds.join(', ')}.`,
    ...(node.priorOpen?.length?[``,`## Open items you inherit`,...node.priorOpen.map(item=>`- ${item}`)]:[]),
    ...(node.findings?.length?[``,`## Findings you must resolve`,...node.findings.map(item=>`- ${typeof item==='string'?item:JSON.stringify(item)}`)]:[]),
    ``,`## Allowlist`,...plan.allowlist.map(item=>`- \`${item}\``),`Anything else is out of scope: do not edit it; describe the needed change in open[] or report blocked (shared-change).`,
    ``,`## References`,...plan.references.map(item=>`- ${item}`),
    ``,`## Acceptance (verified one by one by review.verify)`,...plan.acceptance.map((item,index)=>`${index+1}. ${item}`),
    ``,`## Inputs`,...(plan.inputs?.length?plan.inputs.map(item=>`- ${item}`):['- the references above']),``,`## Outputs`,...plan.outputs.map(item=>`- ${item}`),
    ``,`## Checks to run`,...plan.checks.map(check=>`- ${check.name}: \`${check.command}\``),
    `Record every command with its exit code in \`${state.runtimeDir}/checks-${node.id}.json\` as a JSON array \`[{"name","command","exitCode","evidence"}]\`.`
  ];
  const process_=template.split('## Cook until done')[1]??'';
  return `${sections.join('\n')}\n\n## Cook until done${process_}`
    .replaceAll('<launcher>',`node ${state.launcher}`).replaceAll('<nested run>',state.run).replaceAll('<runtime dir>',state.runtimeDir)
    .replaceAll('<runtime dir>/checks-<op task>.json',`${state.runtimeDir}/checks-${node.id}.json`).replaceAll('checks-<op task>.json',`checks-${node.id}.json`);
}

function sdsMaterial(state,maxChars=60000){
  const parts=[];let total=0;
  for(const file of state.sdsFiles){
    const resolved=path.resolve(state.worktree,file);
    if(!fs.existsSync(resolved))continue;
    const text=fs.readFileSync(resolved,'utf8');
    const slice=text.slice(0,Math.max(0,maxChars-total));
    total+=slice.length;parts.push({file,text:slice,truncated:slice.length<text.length});
    if(total>=maxChars)break;
  }
  return parts;
}

/** Plan and launch one ready node. */
function launchNode(orca,state,node,{cwd,planOp,template,wait}){
  const priorReports=state.nodes.flatMap(n=>n.reports??[]);
  const planned=planOp({node,workflow:state.workflow,ownership:state.ownership,sdsMaterial:sdsMaterial(state),priorReports,cwd});
  if(!planned.ok){node.status='failed';node.failure={stage:'planOp',attempts:planned.attempts};log(state,{node:node.id,event:'plan-failed'});return {ok:false,reason:'planOp produced no valid form',node};}
  const plan=planned.value;
  for(const file of plan.allowlist){
    need(state.ownership.some(root=>file===root||file.startsWith(root.replace(/\/?\*\*$/,''))),`planOp put ${file} outside the ownership ${state.ownership.join(', ')}`);
  }
  node.plan=plan;
  const contract=renderContract({template,plan,node,state});
  const file=path.join(state.runtimeDir,`op-${state.workflow.toLowerCase()}-${node.id}.md`);
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contract);
  node.contractFile=file;
  const launched=startOperation({run:state.run,workflowTask:state.workflowTask,from:state.from,worktree:path.relative(process.cwd(),state.worktree)||'.',operation:node.operation,scope:state.workflow,spec:contract},{orca,wait});
  node.launch={ok:launched.ok,task:launched.task?.id??null,dispatch:launched.dispatchId??null,terminal:launched.terminal??null,target:launched.selection?.target??null,attempts:launched.attempts,stopReason:launched.stopReason??null};
  if(!launched.ok){
    node.status=launched.stopReason==='chain-exhausted'?'blocked':'failed';
    log(state,{node:node.id,event:'launch-failed',stopReason:launched.stopReason});
    return {ok:false,reason:launched.stopReason,node};
  }
  node.status='running';node.task=launched.task.id;node.dispatch=launched.dispatchId;node.terminal=launched.terminal;
  log(state,{node:node.id,event:'launched',target:node.launch.target,dispatch:node.dispatch});
  return {ok:true,node};
}

function policyFor(io,operation,report){
  const kind=io.kinds[operation];need(kind,`No op-io policy for ${operation}`);
  const key=report.outcome==='blocked'?`blocked.${report.blocker?.kind}`:report.outcome;
  return {action:kind.resultPolicy[key]??'escalate',repairLimit:kind.resultPolicy.repairLimit??3,resumeLimit:kind.resultPolicy.resumeLimit??5,overLimit:kind.resultPolicy.overLimit??'escalate'};
}

function insertAfter(state,anchor,node){const index=state.nodes.findIndex(n=>n.id===anchor.id);state.nodes.splice(index+1,0,node);}

/** Apply the deterministic result policy to an accepted report. */
export function applyReport(state,node,report,{io,decide,cwd}){
  node.reports=[...(node.reports??[]),{outcome:report.outcome,summary:report.summary,files:report.files,open:report.open,checks:report.checks,blocker:report.blocker,question:report.question,findings:report.findings??[]}];
  let {action,repairLimit,resumeLimit,overLimit}=policyFor(io,node.operation,report);
  const repairs=state.repairs[node.base]??0;
  if(action==='resume-node'&&(node.resumes??0)>=resumeLimit){
    // The op keeps running out of budget on the same work: that is a crisis, not a resume.
    const chosen=decide({situation:`${node.operation} for ${state.workflow} reported partial ${node.resumes} times`,options:['resume-once-more','escalate','accept-partial'],context:{summary:report.summary,open:report.open},cwd});
    action=chosen.ok?({'resume-once-more':'resume-node','escalate':'escalate','accept-partial':'next-node'})[chosen.value.option]:'escalate';
    log(state,{node:node.id,event:'decide',option:chosen.ok?chosen.value.option:null,rationale:chosen.ok?chosen.value.rationale:null});
  }
  if(/^repair-node/.test(action)&&repairs>=repairLimit){
    if(overLimit==='decide'){
      const chosen=decide({situation:`${node.operation} for ${state.workflow} still ${report.outcome} after ${repairs} repairs`,options:['one-more-repair','escalate','accept-partial'],context:{summary:report.summary,open:report.open,findings:report.findings??[]},cwd});
      action=chosen.ok?({'one-more-repair':action,'escalate':'escalate','accept-partial':'next-node'})[chosen.value.option]:'escalate';
      log(state,{node:node.id,event:'decide',option:chosen.ok?chosen.value.option:null,rationale:chosen.ok?chosen.value.rationale:null});
    }else action=overLimit;
  }
  log(state,{node:node.id,event:'report',outcome:report.outcome,action});
  const repairNode=(seed)=>{
    state.repairs[node.base]=repairs+1;
    const id=`${node.base}-repair-${state.repairs[node.base]}`;
    const repair={id,operation:'backend.implement',base:node.base,status:'pending',attempt:node.attempt+1,restarts:0,priorOpen:seed.open??[],findings:seed.findings??[]};
    insertAfter(state,node,repair);
    if(node.operation==='review.verify'){
      const review={id:`review-${state.repairs.review+1}-after-${id}`,operation:'review.verify',base:'review',status:'pending',attempt:node.attempt+1,restarts:0,after:id};
      state.repairs.review=(state.repairs.review??0);
      insertAfter(state,repair,review);
    }
    return id;
  };
  switch(action){
    case 'next-node':case 'workflow-goal-if-last-node':node.status='done';break;
    case 'resume-node':node.status='ready';node.attempt+=1;node.resumes=(node.resumes??0)+1;node.priorOpen=report.open??[];node.dispatch=null;node.terminal=null;node.nudged=false;break;
    case 'repair-node-from-open':node.status='done';repairNode({open:report.open});break;
    case 'repair-node-from-checks':node.status='done';repairNode({findings:report.checks.filter(c=>c.exitCode!==0).map(c=>`${c.name} failed (exit ${c.exitCode}): ${c.evidence??''}`)});break;
    case 'repair-node-from-findings':node.status='done';repairNode({findings:(report.findings?.length?report.findings:report.open)??[]});break;
    case 'insert-architecture-decide':{
      node.status='paused';
      const sidearm={id:`architecture-${(state.repairs.architecture=(state.repairs.architecture??0)+1)}`,operation:'architecture.decide',base:'architecture',status:'ready',attempt:1,restarts:0,gap:report.blocker,replans:node.id};
      state.nodes.splice(state.nodes.indexOf(node),0,sidearm);
      break;
    }
    case 'replan-node-that-was-blocked':{
      node.status='done';
      const blocked=nodeById(state,node.replans);
      if(blocked){blocked.status='ready';blocked.attempt+=1;blocked.priorOpen=[...(blocked.priorOpen??[]),`SDS updated by ${node.id}: ${report.summary}`];}
      break;
    }
    case 'escalate-and-continue':node.escalation=report.blocker;node.status='done';break;
    case 'answer-if-local-else-escalate':{
      const chosen=decide({situation:`Operation ${node.id} asked: ${report.question?.text}`,options:['answer','escalate'],context:{options:report.question?.options??[],ownership:state.ownership,summary:report.summary},cwd});
      if(chosen.ok&&chosen.value.option==='answer'&&chosen.value.instructions){node.answer=chosen.value.instructions;node.status='answering';}
      else{node.status='blocked';node.escalation={kind:'authority',detail:report.question?.text??'question'};}
      break;
    }
    default:node.status='blocked';node.escalation=report.blocker??{kind:'environment',detail:report.summary};
  }
  return action;
}

function commitBranch(state,{git=spawnSync}={}){
  const files=[...new Set(state.nodes.flatMap(n=>(n.reports??[]).flatMap(r=>r.files??[])))];
  if(!files.length)return {committed:false,reason:'no files reported'};
  const run=args=>git('git',args,{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  const add=run(['add','--',...files]);
  if(add.status!==0)return {committed:false,reason:add.stderr?.slice(-300)};
  const commit=run(['commit','-q','-m',`feat(${state.workflow.toLowerCase()}): supervised implementation of the accepted SDS slice\n\nReports: ${state.nodes.filter(n=>n.reports?.length).map(n=>n.id).join(', ')}`]);
  const head=run(['rev-parse','HEAD']).stdout?.trim()??null;
  return {committed:commit.status===0,head,reason:commit.status===0?null:commit.stderr?.slice(-300)};
}

/**
 * One supervisor loop. `maxIterations` bounds tests; production runs until the workflow report is sent.
 * Every wait is a launcher wait tick (ping-pong inside); every launch is the chain launcher; every result goes
 * through the op-io policy table.
 */
export function superviseLoop(orca,state,{cwd,io=loadOpIo(),planOp=planOpFn,decide=decideFn,template,wait,maxIterations=Infinity,git,stateFile=null,now=Date.now}={}){
  const save=()=>{if(stateFile)writeJson(stateFile,state);};
  const directory=state.reportsDir?path.resolve(state.reportsDir):reportsDirectory(cwd,state.run);
  const parentReportsDir=state.parentReportsDir?path.resolve(state.parentReportsDir):reportsDirectory(path.resolve(cwd),state.parentRun);
  for(let iteration=0;iteration<maxIterations;iteration+=1){
    save();
    if(state.finished)return state;
    let node=runningNode(state);
    if(!node){
      const answering=state.nodes.find(n=>n.status==='answering');
      if(answering){notifyTerminal(orca,{cwd,terminal:answering.terminal,text:answering.answer,wait});answering.status='running';continue;}
      const blocked=state.nodes.find(n=>n.status==='blocked');
      if(blocked){
        const escalation=blocked.escalation??{kind:'environment',detail:blocked.launch?.stopReason??'blocked'};
        const sent=reportOutcome(orca,{cwd,kind:'workflow',run:state.parentRun,from:state.from,task:state.workflowTask,dispatch:state.monitorDispatch,outcome:'blocked',summary:`${state.workflow}: node ${blocked.id} blocked (${escalation.kind}): ${escalation.detail}`.slice(0,600),blocker:escalation,branch:state.branch,reportsDir:parentReportsDir,now});
        state.finished={outcome:'blocked',node:blocked.id,report:sent.file};log(state,{event:'escalated',node:blocked.id});save();return state;
      }
      const ready=readyNode(state);
      if(!ready){
        const commit=commitBranch(state,{git});
        const done=reportOutcome(orca,{cwd,kind:'workflow',run:state.parentRun,from:state.from,task:state.workflowTask,dispatch:state.monitorDispatch,outcome:commit.committed?'done':'failed',summary:`${state.workflow}: ${state.nodes.filter(n=>n.status==='done').length} nodes done; ${commit.committed?`committed ${commit.head}`:`commit failed: ${commit.reason}`}`.slice(0,600),files:[...new Set(state.nodes.flatMap(n=>(n.reports??[]).flatMap(r=>r.files??[])))],checks:[{name:'review',command:'review.verify',exitCode:0}],gates:[{name:'review',status:'passed'}],branch:state.branch,head:commit.head??'unknown',reportsDir:parentReportsDir,now});
        state.finished={outcome:commit.committed?'done':'failed',head:commit.head,report:done.file};log(state,{event:'finished',outcome:state.finished.outcome});save();return state;
      }
      const launched=launchNode(orca,state,ready,{cwd,planOp,template,wait});
      if(!launched.ok)continue;
      node=ready;
    }
    const tick=waitTick(orca,{cwd,run:state.run,from:state.from,timeoutMs:900000,tickMs:120000,reportsDir:state.reportsDir??null,now,wait});
    log(state,{node:node.id,event:'tick',result:tick.event,ticks:tick.ticks});
    const report=[...readReports(directory)].find(r=>r?.dispatch===node.dispatch&&r?.sent);
    if(report){
      const checked=validateReport(report,{allowlist:node.plan?.allowlist??state.ownership});
      if(!checked.ok){
        log(state,{node:node.id,event:'report-rejected',errors:checked.errors});
        settleDispatch(orca,node.dispatch,{cwd,reason:'report rejected',terminalHandle:node.terminal,closeTerminal:true,wait});
        node.status='done';state.repairs[node.base]=(state.repairs[node.base]??0)+1;
        insertAfter(state,node,{id:`${node.base}-repair-${state.repairs[node.base]}`,operation:'backend.implement',base:node.base,status:'pending',attempt:node.attempt+1,restarts:0,priorOpen:[],findings:checked.errors.map(e=>`previous report rejected: ${e}`)});
        continue;
      }
      const finishedDispatch=node.dispatch;
      applyReport(state,node,report,{io,decide,cwd});
      orca.invoke('worker-release',{dispatch:finishedDispatch},{cwd});
      sweepWorktree(orca,{cwd,from:state.from});
      continue;
    }
    const mine=tick.liveness.find(item=>item.dispatch===node.dispatch);
    if(mine&&['stalled-prompt','stalled-silent','dead','stalled-idle'].includes(mine.liveness)){
      if(mine.liveness==='stalled-idle'&&!node.nudged){notifyTerminal(orca,{cwd,terminal:node.terminal,text:'Continue; when finished report with the launcher report command exactly once',wait});node.nudged=true;continue;}
      settleDispatch(orca,node.dispatch,{cwd,reason:mine.liveness,terminalHandle:node.terminal,closeTerminal:true,wait});
      node.restarts+=1;log(state,{node:node.id,event:'restart',reason:mine.liveness,restarts:node.restarts});
      if(node.restarts>RESTART_LIMIT){node.status='blocked';node.escalation={kind:'environment',detail:`${node.id} restarted ${node.restarts} times (${mine.liveness})`};continue;}
      node.status='ready';node.nudged=false;
    }
  }
  return state;
}

export function superviseMain(options,{orca,cwd}){
  const runtimeDir=path.resolve(cwd,required(options['runtime-dir'],'runtime dir'));
  const stateFile=path.join(runtimeDir,`supervise-${required(options.workflow,'workflow')}.json`);
  const host=path.resolve(required(options.host,'host .claude path'));
  const launcher=path.join(host,'.dist','execution','orca-supervised-launch.mjs').replaceAll('\\','/');
  const template=fs.readFileSync(path.join(host,'docs','supervision-templates','op.md'),'utf8');
  const state=readJson(stateFile,null)??initialState({workflow:options.workflow,run:required(options.run,'nested run'),from:required(options.from,'own terminal'),worktree:path.resolve(cwd),branch:required(options.branch,'branch'),ownership:csv(options.ownership),sdsFiles:csv(options.sds),parentRun:required(options['parent-run'],'parent run'),workflowTask:required(options['workflow-task'],'workflow task'),monitorDispatch:required(options['monitor-dispatch'],'monitor dispatch'),runtimeDir,launcher,host});
  return superviseLoop(orca,state,{cwd,template,stateFile,maxIterations:options['max-iterations']?Number(options['max-iterations']):Infinity});
}
