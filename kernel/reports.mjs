import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

/**
 * Typed outcome envelopes for the supervision protocol (4.1). An operation or a workflow ends with
 * exactly one report: the file is the source of truth, the Orca message is only the wake-up signal.
 */
export const OP_REPORT='starci/op-report@1';
export const WORKFLOW_REPORT='starci/workflow-report@1';
export const OUTCOMES=['done','partial','failed','ask','blocked'];
/** The blocker vocabulary of `model/kinds.yaml`; the graph routes each one, so the two lists must agree. */
export const BLOCKER_KINDS=['shared-change','srs-gap','sds-gap','interface-gap','brand-gap','grammar-gap','environment','authority'];
/** Orca signal per outcome: the message type the receiver's blocking wait subscribes to. */
export const SIGNALS={
  done:{type:'worker_done',orcaOutcome:'succeeded'},
  partial:{type:'worker_done',orcaOutcome:'succeeded'},
  failed:{type:'worker_done',orcaOutcome:'failed'},
  ask:{type:'question',orcaOutcome:null},
  blocked:{type:'escalation',orcaOutcome:null}
};

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const list=(value,label)=>{need(Array.isArray(value)&&value.every(item=>typeof item==='string'&&item.trim()),`Invalid ${label}`);return value.map(item=>item.trim());};
const normalize=value=>String(value).replaceAll('\\','/').replace(/^\.\//,'');

export function signalFor(outcome){
  need(OUTCOMES.includes(outcome),`Unsupported report outcome: ${outcome}`);
  return SIGNALS[outcome];
}

/** Build and validate one report; throws on a contract violation so an invalid report is never written or sent. */
export function buildReport({kind='op',outcome,run,task,dispatch,from,summary,files=[],checks=[],open=[],question=null,blocker=null,credentialRequest=null,branch=null,head=null,gates=[],observations=[],reportedAt=Date.now()}){
  need(['op','workflow'].includes(kind),`Unsupported report kind: ${kind}`);
  const report={
    schema:kind==='op'?OP_REPORT:WORKFLOW_REPORT,kind,outcome:text(outcome,'outcome'),
    run:text(run,'run id'),task:text(task,'task id'),dispatch:text(dispatch,'dispatch id'),from:text(from,'reporting terminal'),
    summary:text(summary,'summary').replace(/\s+/g,' ').slice(0,600),
    files:list(files,'files').map(normalize),
    checks:checks.map(check=>{
      need(plain(check)&&typeof check.name==='string'&&typeof check.command==='string'&&Number.isInteger(check.exitCode),'Each check needs name, command and an integer exitCode');
      return {name:check.name,command:check.command,exitCode:check.exitCode,evidence:typeof check.evidence==='string'?check.evidence.slice(0,400):null};
    }),
    open:list(open,'open items'),question:question?{text:text(question.text,'question text'),options:Array.isArray(question.options)?list(question.options,'question options'):[],
      // `mechanical` (which runtime, retry, a format) is the kernel's to answer; anything else is the owner's.
      ...(typeof question.kind==='string'&&question.kind.trim()?{kind:question.kind.trim()}:{})}:null,
    blocker:blocker?{kind:text(blocker.kind,'blocker kind'),detail:text(blocker.detail,'blocker detail')}:null,
    ...(credentialRequest!==null?{credentialRequest}:{}),
    branch:branch?text(branch,'branch'):null,head:head?text(head,'head'):null,gates:gates.map(gate=>{need(plain(gate)&&typeof gate.name==='string'&&typeof gate.status==='string','Each gate needs name and status');return {name:gate.name,status:gate.status};}),
    observations:list(observations,'observations'),reportedAt,signal:signalFor(outcome),sent:null
  };
  const problems=validateReport(report).errors;
  need(problems.length===0,problems.join('; '));
  return report;
}

/** Contract rules a receiver applies before accepting a report. */
export function validateReport(report,{allowlist=null}={}){
  const errors=[];
  if(!plain(report)||![OP_REPORT,WORKFLOW_REPORT].includes(report.schema))return {ok:false,errors:['Unsupported report schema']};
  if(!OUTCOMES.includes(report.outcome))errors.push(`Unsupported outcome ${report.outcome}`);
  if(report.credentialRequest!==undefined){
    const request=report.credentialRequest;
    if(!plain(request)||Object.keys(request).some(key=>!['reason','variables','check'].includes(key))
      ||!['invalid','expired'].includes(request.reason)||typeof request.check!=='string'||!request.check.trim()||request.check.length>100
      ||!Array.isArray(request.variables)||!request.variables.length||request.variables.length>16
      ||request.variables.some(name=>typeof name!=='string'||!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
      ||new Set(request.variables).size!==request.variables.length)
      errors.push('Invalid typed credential replacement request; use reason, variables and check only.');
    else if(report.outcome!=='blocked'||report.blocker?.kind!=='environment'
      ||!Array.isArray(report.checks)||!report.checks.some(check=>check.name===request.check&&Number.isInteger(check.exitCode)&&check.exitCode!==0&&typeof check.evidence==='string'&&check.evidence.trim()))
      errors.push('Credential replacement requires blocked/environment and the named failing check with safe observed evidence.');
  }
  if(report.outcome==='done'){
    if(!Array.isArray(report.checks)||report.checks.length===0)errors.push('done requires at least one check that was actually run');
    if(Array.isArray(report.checks)&&report.checks.some(check=>check.exitCode!==0))errors.push('done cannot carry a failing check; report failed or partial');
    if(Array.isArray(report.open)&&report.open.length)errors.push('done cannot leave open items; report partial');
  }
  if(report.outcome==='partial'&&(!Array.isArray(report.open)||report.open.length===0))errors.push('partial requires open items for the next operation');
  if(report.outcome==='ask'&&!report.question?.text)errors.push('ask requires a question');
  if(report.outcome==='blocked'){
    if(!report.blocker)errors.push('blocked requires a blocker');
    else if(!BLOCKER_KINDS.includes(report.blocker.kind))errors.push(`Unsupported blocker kind ${report.blocker.kind}`);
  }
  if(report.outcome==='failed'&&!(Array.isArray(report.checks)&&report.checks.some(check=>check.exitCode!==0))&&!(typeof report.summary==='string'&&report.summary.length>0))errors.push('failed requires a failing check or a summary');
  if(report.schema===WORKFLOW_REPORT&&['done','partial'].includes(report.outcome)&&(!report.branch||!report.head))errors.push('A workflow done/partial report needs branch and head');
  if(Array.isArray(allowlist)&&allowlist.length&&Array.isArray(report.files)){
    // An allowlist entry is a file or a folder root, written with or without a glob tail (`brand/**`, `src/*`):
    // the tail names the folder, it is not part of the path a file must start with.
    const roots=allowlist.map(entry=>normalize(entry).replace(/\/?\*+$/,'').replace(/\/+$/,''));
    for(const file of report.files)if(!roots.some(root=>file===root||file.startsWith(`${root}/`)))errors.push(`File outside the allowlist: ${file}`);
  }
  if(report.signal?.type!==SIGNALS[report.outcome]?.type)errors.push('Signal does not match the outcome');
  return {ok:errors.length===0,errors};
}

/** Linked worktrees share one report root: the main repository's .starciwork, resolved through the git common dir. */
export function repositoryRoot(cwd){
  const probe=spawnSync('git',['rev-parse','--git-common-dir'],{cwd,encoding:'utf8',windowsHide:true});
  const common=probe.status===0?probe.stdout.trim():'';
  if(!common)return cwd;
  const resolved=path.resolve(cwd,common);
  return path.basename(resolved)==='.git'?path.dirname(resolved):cwd;
}
export function reportsDirectory(cwd,run,explicit=null){
  return explicit?path.resolve(cwd,explicit):path.join(repositoryRoot(cwd),'.starciwork','_local','runtime','reports',run);
}
export function reportPath(directory,dispatch){return path.join(directory,`${dispatch}.json`);}

export function readReports(directory){
  if(!fs.existsSync(directory))return [];
  return fs.readdirSync(directory).filter(name=>name.endsWith('.json')&&name!=='wait-state.json').sort().map(name=>{
    try{return JSON.parse(fs.readFileSync(path.join(directory,name),'utf8'));}catch{return {schema:null,file:name,error:'unreadable report file'};}
  });
}

/** Compose the short Orca message body: the receiver reads the file for everything else. */
export function reportBody(report,file){
  const lines=[`outcome: ${report.outcome}`,`report: ${normalize(file)}`,`summary: ${report.summary}`];
  if(report.files.length)lines.push(`files: ${report.files.slice(0,20).join(', ')}${report.files.length>20?` (+${report.files.length-20})`:''}`);
  if(report.checks.length)lines.push(`checks: ${report.checks.map(check=>`${check.name}=${check.exitCode}`).join(', ')}`);
  if(report.open.length)lines.push(`open: ${report.open.join(' | ')}`);
  if(report.question)lines.push(`question: ${report.question.text}${report.question.options.length?` [${report.question.options.join(' / ')}]`:''}`);
  if(report.blocker)lines.push(`blocker: ${report.blocker.kind} - ${report.blocker.detail}`);
  if(report.branch)lines.push(`branch: ${report.branch}@${report.head}`);
  return lines.join('\n').slice(0,3000);
}
