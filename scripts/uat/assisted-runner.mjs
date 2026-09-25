#!/usr/bin/env node
// A user-facing, event-driven bridge around a prepared Playwright UAT session.
// It never opens runtime.sqlite and never decides Work state. The surrounding
// dispatched operation cites the write-once receipt in its ordinary api report.

import '../lib/hide-child-windows.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import {spawn, spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {parseYaml, stringifyYaml} from '../../engine/yaml.mjs';
import {acquireUatSlot} from './uat-slots.mjs';
import {launchFor} from './launch.mjs';

export const RUNNER_VERSION='1.0.0';
export const PROTOCOL_PREFIX='@@STARCI_ASSISTED_UAT@@';
const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'..','..');
const SCHEMAS={
  request:path.join(ROOT,'modules','schemas','assisted-uat-request.schema.yaml'),
  session:path.join(ROOT,'modules','schemas','assisted-uat-session-manifest.schema.yaml'),
  receipt:path.join(ROOT,'modules','schemas','assisted-uat-receipt.schema.yaml'),
  cleanup:path.join(ROOT,'modules','schemas','assisted-uat-cleanup.schema.yaml'),
  redaction:path.join(ROOT,'modules','schemas','assisted-uat-redaction.schema.yaml'),
};
const TERMINAL_PHASES=new Set(['finished','stale','failed']);
const STATUSES=new Set(['completed','failed','not-run','cancelled','inconclusive']);
const SIGNALS=new Set(['ok','fail','cancel']);
const SAFE_ENV=['PATH','Path','PATHEXT','SystemRoot','COMSPEC','TEMP','TMP','HOME','USERPROFILE','LOCALAPPDATA','APPDATA','NODE_PATH'];
// How a manifest command is spawned: scripts/uat/launch.mjs (re-exported for existing callers).
export {launchFor};

const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
export const digestFile=file=>sha256(fs.readFileSync(file));
const canonical=value=>{
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
};
export const digestValue=value=>sha256(JSON.stringify(canonical(value)));
const iso=()=>new Date().toISOString();
const readYaml=file=>parseYaml(fs.readFileSync(file,'utf8'));
const same=(a,b)=>path.resolve(a)===path.resolve(b);
const relativePosix=(base,file)=>path.relative(base,file).replace(/\\/g,'/');
const inside=(base,file)=>{const rel=path.relative(path.resolve(base),path.resolve(file));return rel===''||(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel));};
const need=(condition,message,code='assisted-uat-invalid')=>{if(!condition)throw Object.assign(new Error(message),{code});};

let validators;
const schemaValidators=()=>{
  if(validators)return validators;
  const ajv=new Ajv2020({allErrors:true,strict:false,formats:{'date-time':true,uri:true}});
  validators=Object.fromEntries(Object.entries(SCHEMAS).map(([name,file])=>[name,ajv.compile(readYaml(file))]));
  return validators;
};
const validate=(kind,value)=>{
  const check=schemaValidators()[kind];
  need(check(value),`${kind} schema: ${(check.errors??[]).map(error=>`${error.instancePath||'/'} ${error.message}`).join('; ')}`,'assisted-uat-schema-invalid');
};
const resolvePrepared=(base,declared,label)=>{
  need(typeof declared==='string'&&declared.length>0,`${label} path is missing`);
  need(!path.isAbsolute(declared),`${label} must be relative to the assisted-UAT directory`);
  const file=path.resolve(base,declared);
  need(inside(base,file),`${label} escapes the assisted-UAT directory`);
  return file;
};
const resolveCwd=(base,declared)=>path.isAbsolute(declared)?path.resolve(declared):path.resolve(base,declared);
const expandTemplate=(base,template,runId,label)=>{
  need((template.match(/\{runId\}/g)??[]).length===1,`${label} needs exactly one {runId}`);
  return resolvePrepared(base,template.replace('{runId}',runId),label);
};
const uniqueIds=(items,label)=>need(new Set(items.map(item=>item.id)).size===items.length,`${label} ids must be unique`);

export function computeRequestBindings(request){
  const buildDigest=digestValue(request.build);
  const environmentDigest=digestValue(request.environment);
  const flowsDigest=digestValue(request.flows);
  const inputDigest=digestValue({
    build:request.build,environment:request.environment,flows:request.flows,
    humanGates:request.humanGates,scripts:request.scripts,
    redaction:request.redaction,cleanup:request.cleanup,
  });
  return {inputDigest,buildDigest,environmentDigest,flowsDigest};
}

const assertDigest=(actual,expected,label)=>need(actual===expected,`${label} digest mismatch: expected ${expected}, got ${actual}`,'assisted-uat-stale');
const packageAt=(cwd,name)=>{
  try{return createRequire(path.join(cwd,'package.json')).resolve(`${name}/package.json`);}catch{return null;}
};
export function validateLockedPlaywright(prepared){
  const {session,root}=prepared, command=session.launch.command, joined=command.join(' ').toLowerCase();
  const cwd=resolveCwd(root,session.launch.cwd),first=command[0],firstBase=path.basename(first).toLowerCase().replace(/\.(?:cmd|exe)$/,'');
  const localExecutable=path.isAbsolute(first)&&inside(path.join(cwd,'node_modules'),first)&&/playwright/i.test(first);
  const localNodeCli=(same(first,process.execPath)||firstBase==='node')&&path.isAbsolute(command[1]??'')&&inside(path.join(cwd,'node_modules'),command[1])&&/playwright/i.test(command[1]);
  const packageExec=(firstBase==='npx'&&command.includes('--no-install'))
    ||(firstBase==='npm'&&command.includes('exec')&&command.includes('--no'))
    ||(['pnpm','yarn'].includes(firstBase)&&command.includes('exec'));
  need(localExecutable||localNodeCli||packageExec,'launch.command must use the project-local Playwright CLI or package-manager no-install/exec form');
  need(/playwright/.test(joined)&&/(^|\s)test(\s|$)/.test(joined),'launch.command must run the project Playwright test runner');
  need(/--headed(?:\s|$|=true)/.test(joined)&&!/(?:^|\s)--headless/.test(joined),'assisted UAT requires a visible --headed browser');
  need(/--workers(?:=|\s+)1(?:\s|$)/.test(joined),'assisted UAT requires --workers=1 for a sequential isolated session');
  need(joined.includes(session.playwright.browser.toLowerCase()),`launch.command must select ${session.playwright.browser}`);
  need(fs.existsSync(path.join(cwd,'package.json')),`Playwright cwd has no package.json: ${cwd}`);
  const packageFile=packageAt(cwd,'@playwright/test')??packageAt(cwd,'playwright');
  need(packageFile,'the prepared project has no installed locked @playwright/test or playwright package');
  const installed=JSON.parse(fs.readFileSync(packageFile,'utf8'));
  need(installed.version===session.playwright.version,`Playwright version drift: manifest ${session.playwright.version}, installed ${installed.version}`,'assisted-uat-stale');
  let browserRevision=null;
  const coreFile=packageAt(cwd,'playwright-core');
  if(coreFile){
    const browsersFile=path.join(path.dirname(coreFile),'browsers.json');
    if(fs.existsSync(browsersFile))browserRevision=JSON.parse(fs.readFileSync(browsersFile,'utf8')).browsers?.find(item=>item.name==='chromium')?.revision??null;
  }
  if(browserRevision!=null)need(String(browserRevision)===String(session.playwright.revision),`browser revision drift: manifest ${session.playwright.revision}, installed ${browserRevision}`,'assisted-uat-stale');
  return {cwd,packageFile,version:installed.version,browserRevision:String(browserRevision??session.playwright.revision)};
}

export function inspectPreparedRequest({requestPath,receiptPath,allowExistingReceipt=false}={}){
  need(path.isAbsolute(requestPath??''),'--request must be an explicit absolute path');
  need(path.isAbsolute(receiptPath??''),'--receipt must be an explicit absolute path');
  const requestFile=path.resolve(requestPath),receiptFile=path.resolve(receiptPath);
  need(fs.existsSync(requestFile),`prepared request does not exist: ${requestFile}`);
  need(path.basename(requestFile)==='request.yaml','the selected prepared request must be request.yaml');
  if(!allowExistingReceipt)need(!fs.existsSync(receiptFile),`receipt already exists and is immutable: ${receiptFile}`,'assisted-uat-receipt-exists');
  const root=path.dirname(requestFile),requestBytes=fs.readFileSync(requestFile),request=parseYaml(requestBytes.toString('utf8'));
  validate('request',request);
  uniqueIds(request.flows,'flow'); uniqueIds(request.humanGates,'human gate');
  for(const flow of request.flows)uniqueIds(flow.steps,`flow ${flow.id} step`);
  const expectedBindings=computeRequestBindings(request);
  for(const [key,value] of Object.entries(expectedBindings))assertDigest(value,request.bindings[key],`request ${key}`);
  const sessionFile=resolvePrepared(root,request.sessionManifest.path,'session manifest');
  need(fs.existsSync(sessionFile),`session manifest does not exist: ${sessionFile}`);
  const sessionBytes=fs.readFileSync(sessionFile),session=parseYaml(sessionBytes.toString('utf8'));
  validate('session',session);
  const declaredRequest=resolvePrepared(root,session.request.path,'session request');
  need(same(declaredRequest,requestFile),'session manifest selects a different request');
  assertDigest(sha256(requestBytes),session.request.sha256,'session request');
  assertDigest(sha256(requestBytes),session.bindings.requestDigest,'session request binding');
  for(const key of ['inputDigest','buildDigest','environmentDigest','flowsDigest'])assertDigest(request.bindings[key],session.bindings[key],`session ${key}`);
  const requestScripts=request.scripts.map(({flowId,path,sha256})=>({flowId,path,sha256}));
  need(JSON.stringify(canonical(requestScripts))===JSON.stringify(canonical(session.scripts)),'request and session script declarations differ','assisted-uat-stale');
  assertDigest(digestValue(session.scripts),session.bindings.scriptsDigest,'session scripts');
  for(const script of session.scripts){
    const file=resolvePrepared(root,script.path,`script ${script.flowId}`);
    need(fs.existsSync(file),`prepared script is missing: ${file}`);
    assertDigest(digestFile(file),script.sha256,`script ${script.flowId}`);
  }
  const cleanupFile=resolvePrepared(root,request.cleanup.path,'cleanup plan');
  const redactionFile=resolvePrepared(root,request.redaction.path,'redaction policy');
  need(fs.existsSync(cleanupFile),'cleanup plan is missing'); need(fs.existsSync(redactionFile),'redaction policy is missing');
  validate('cleanup',readYaml(cleanupFile));validate('redaction',readYaml(redactionFile));
  try{for(const rule of readYaml(redactionFile).rules)new RegExp(rule.pattern,'giu');}catch(error){throw Object.assign(new Error(`redaction schema: invalid regular expression (${error.message})`),{code:'assisted-uat-schema-invalid'});}
  assertDigest(digestFile(cleanupFile),request.cleanup.sha256,'request cleanup plan');
  assertDigest(request.cleanup.sha256,session.bindings.cleanupPlanDigest,'session cleanup plan');
  assertDigest(digestFile(redactionFile),request.redaction.sha256,'request redaction policy');
  assertDigest(request.redaction.sha256,session.bindings.redactionPolicyDigest,'session redaction policy');
  const flowById=new Map(request.flows.map(flow=>[flow.id,flow]));
  for(const gate of request.humanGates){
    const flow=flowById.get(gate.flowId);need(flow,`gate ${gate.id} names unknown flow ${gate.flowId}`);
    need(flow.steps.some(step=>step.id===gate.afterStepId),`gate ${gate.id} names unknown step ${gate.afterStepId}`);
  }
  need(JSON.stringify(session.humanGateIds)===JSON.stringify(request.humanGates.map(gate=>gate.id)),'session humanGateIds must exactly preserve frozen gate order','assisted-uat-stale');
  need(request.receipt.schema===session.receipt.schema&&request.receipt.pathTemplate===session.receipt.pathTemplate,'request and session receipt declarations differ','assisted-uat-stale');
  const runId=path.basename(receiptFile,'.yaml');
  need(runId&&runId!==path.basename(receiptFile),`receipt must be a named .yaml file`);
  need(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(runId),'receipt run ID contains unsupported path characters');
  const expectedReceipt=expandTemplate(root,request.receipt.pathTemplate,runId,'receipt path template');
  need(same(expectedReceipt,receiptFile),'--receipt does not match the prepared receipt pathTemplate');
  const runDir=expandTemplate(root,session.artifacts.runDirTemplate,runId,'run directory template');
  need(inside(root,runDir)&&!inside(runDir,receiptFile),'run directory and receipt must be disjoint inside the prepared assisted-UAT root');
  return {root,requestFile,receiptFile,sessionFile,cleanupFile,redactionFile,runDir,runId,request,session,
    requestDigest:sha256(requestBytes),sessionDigest:sha256(sessionBytes)};
}

const stateFileOf=runDir=>path.join(runDir,'control','state.yaml');
const signalsDirOf=runDir=>path.join(runDir,'control','signals');
const signalFileOf=(runDir,gateId)=>path.join(signalsDirOf(runDir),`${sha256(gateId).slice(0,24)}.yaml`);
const writeAtomic=(file,value)=>{
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(tmp,stringifyYaml(value),{flag:'wx'});
  // Windows refuses a rename over a file another process holds open (a waiter's readState, the other writer).
  for(let i=0;;i++){try{fs.renameSync(tmp,file);return;}catch(error){
    if(i>=20||!['EPERM','EBUSY','EACCES'].includes(error.code)){try{fs.rmSync(tmp,{force:true});}catch{}throw error;}
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25*(i+1));
  }}
};
const readState=runDir=>readYaml(stateFileOf(runDir));
const writeState=(prepared,state)=>writeAtomic(stateFileOf(prepared.runDir),state);
// A queued run is alive and waiting for a machine-wide UAT slot (uat-slots.mjs), not dead.
const publicState=state=>({runId:state.runId,phase:state.phase,revision:state.revision,pendingGate:state.pendingGate??null,event:state.event??null,receipt:state.phase==='finished'?state.receipt:null,
  ...(state.phase==='queued'?{waitingForSlot:true,queuePosition:state.queuePosition??null,slotLimit:state.slotLimit??null}:{})});
const updateState=(prepared,state,phase,event,extra={})=>{
  Object.assign(state,extra,{phase,revision:(state.revision??0)+1,event,updatedAt:iso()});writeState(prepared,state);return state;
};
const validateFreshState=(prepared,state)=>{
  need(state.requestDigest===prepared.requestDigest&&state.sessionDigest===prepared.sessionDigest,'run state belongs to stale prepared bytes','assisted-uat-stale');
  need(same(state.receipt,prepared.receiptFile)&&same(state.runDir,prepared.runDir),'run state path binding changed','assisted-uat-stale');
};
const pidAlive=pid=>{if(!Number.isInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch{return false;}};

const waitForChange=(prepared,after,timeoutMs)=>new Promise((resolve,reject)=>{
  const current=()=>{try{return readState(prepared.runDir);}catch{return null;}};
  const ready=state=>state&&((state.revision??0)>after||TERMINAL_PHASES.has(state.phase));
  const control=path.dirname(stateFileOf(prepared.runDir));
  let done=false,watcher,timer;
  const finish=(error,value)=>{if(done)return;done=true;try{watcher?.close();}catch{}clearTimeout(timer);error?reject(error):resolve(value);};
  const check=()=>{const next=current();if(ready(next))finish(null,next);};
  // Watch before the first read: a write landing between a read and the watch is otherwise lost until the timeout.
  watcher=fs.watch(control,check);
  timer=setTimeout(()=>finish(Object.assign(new Error('event wait timed out'),{code:'assisted-uat-timeout'})),timeoutMs);
  check();
});
const waitForSignal=(prepared,gateId,timeoutMs)=>new Promise((resolve,reject)=>{
  const file=signalFileOf(prepared.runDir,gateId),read=()=>fs.existsSync(file)?readYaml(file):null;
  let done=false,watcher,timer;
  const finish=(error,value)=>{if(done)return;done=true;try{watcher?.close();}catch{}clearTimeout(timer);error?reject(error):resolve(value);};
  const check=()=>{const signal=read();if(signal)finish(null,signal);};
  watcher=fs.watch(signalsDirOf(prepared.runDir),check);
  timer=setTimeout(()=>finish(Object.assign(new Error(`gate ${gateId} timed out`),{code:'assisted-uat-timeout'})),timeoutMs);
  check();
});

const redactionPolicy=prepared=>{
  const raw=readYaml(prepared.redactionFile)??{},rules=Array.isArray(raw.rules)?raw.rules:[];
  return rules.filter(rule=>typeof rule?.pattern==='string'&&rule.pattern.length).map(rule=>({pattern:new RegExp(rule.pattern,'giu'),replacement:String(rule.replacement??'[REDACTED]')}));
};
const sanitizer=(prepared)=>{
  const secretValues=prepared.session.launch.envNames.map(name=>process.env[name]).filter(value=>typeof value==='string'&&value.length>=4);
  const rules=redactionPolicy(prepared);
  return value=>{
    let text=String(value??'');
    for(const secret of secretValues)text=text.split(secret).join('[REDACTED]');
    for(const rule of rules)text=text.replace(rule.pattern,rule.replacement);
    return text.replace(/\bBearer\s+[A-Za-z0-9._~-]+/giu,'Bearer [REDACTED]').replace(/\b(?:otp|password|secret|token)\s*[:=]\s*\S+/giu,'$1=[REDACTED]');
  };
};
const safeRefs=(prepared,refs=[])=>refs.map(ref=>{
  need(typeof ref==='string'&&!path.isAbsolute(ref),'evidence refs must be relative');
  const file=path.resolve(prepared.root,ref);need(inside(prepared.runDir,file),'evidence ref is outside this run');return relativePosix(prepared.root,file);
});
const commandLabel=command=>command.map((part,index)=>index===0?path.basename(part):part).join(' ');
const runCommand=(prepared,item,defaultCwd)=>{
  const command=Array.isArray(item?.command)?item.command:[];need(command.length,`command ${item?.id??'(unnamed)'} is empty`);
  const cwd=resolveCwd(prepared.root,item.cwd??defaultCwd);
  const env=Object.fromEntries([...SAFE_ENV,...prepared.session.launch.envNames].filter(name=>process.env[name]!==undefined).map(name=>[name,process.env[name]]));
  const launch=launchFor(command);
  const result=spawnSync(launch.file,launch.args,{cwd,env,encoding:'utf8',timeout:prepared.request.limits.timeoutMs,windowsHide:true});
  return {id:item.id??'command',command:sanitizer(prepared)(commandLabel(command)),exitCode:Number.isInteger(result.status)?result.status:1,evidenceRefs:[]};
};
const policyCommands=(file,key)=>{const value=readYaml(file)??{};const list=value[key];return Array.isArray(list)?list:[];};

const normalizeProtocolEvent=(prepared,event,sanitize)=>{
  need(event&&typeof event==='object'&&!Array.isArray(event),'driver protocol event must be an object');
  if(event.type==='checkpoint')return {type:'checkpoint',gateId:String(event.gateId??'')};
  if(event.type==='step'){
    need(STATUSES.has(event.status),'step status is invalid');
    return {type:'step',flowId:String(event.flowId??''),id:String(event.id??''),status:event.status,observed:event.observed==null?null:sanitize(event.observed),evidenceRefs:safeRefs(prepared,event.evidenceRefs)};
  }
  if(event.type==='check')return {type:'check',id:String(event.id??''),command:sanitize(event.command??'machine assertion'),exitCode:Number(event.exitCode),evidenceRefs:safeRefs(prepared,event.evidenceRefs)};
  if(event.type==='artifact')return {type:'artifact',path:safeRefs(prepared,[event.path])[0],mediaType:String(event.mediaType??'application/octet-stream'),redacted:event.redacted===true};
  if(event.type==='postcondition'){
    need(STATUSES.has(event.status),'postcondition status is invalid');
    return {type:'postcondition',id:String(event.id??''),expected:sanitize(event.expected??''),observed:sanitize(event.observed??''),status:event.status,evidenceRefs:safeRefs(prepared,event.evidenceRefs)};
  }
  throw Object.assign(new Error(`unsupported driver protocol event '${event.type}'`),{code:'assisted-uat-protocol-invalid'});
};

const finishReceipt=(prepared,state,data,completionSignal,launchExit)=>{
  const cleanupActions=[],cleanupFailures=[];
  for(const item of policyCommands(prepared.cleanupFile,'actions')){const result=runCommand(prepared,item,prepared.session.launch.cwd);cleanupActions.push(result);if(result.exitCode!==0)cleanupFailures.push(`${result.id} exited ${result.exitCode}`);}
  for(const item of policyCommands(prepared.cleanupFile,'verify')){const result=runCommand(prepared,item,prepared.session.launch.cwd);cleanupActions.push(result);if(result.exitCode!==0)cleanupFailures.push(`${result.id} exited ${result.exitCode}`);}
  const redactionResults=[],redactionFailures=[];
  for(const item of policyCommands(prepared.redactionFile,'commands')){const result=runCommand(prepared,item,prepared.session.launch.cwd);redactionResults.push(result);if(result.exitCode!==0)redactionFailures.push(`${result.id} exited ${result.exitCode}`);}
  const artifacts=[];
  for(const artifact of data.artifacts){
    const file=path.resolve(prepared.root,artifact.path);
    if(!fs.existsSync(file)||!inside(prepared.runDir,file)){redactionFailures.push(`artifact missing or outside run: ${artifact.path}`);continue;}
    if(!artifact.redacted){redactionFailures.push(`artifact lacks redaction attestation: ${artifact.path}`);continue;}
    artifacts.push({...artifact,sha256:digestFile(file),redacted:true});
  }
  for(const required of prepared.session.artifacts.requiredMedia)if(!artifacts.some(artifact=>artifact.mediaType===required))redactionFailures.push(`required media missing: ${required}`);
  const flowEvents=new Map(data.steps.map(step=>[`${step.flowId}\0${step.id}`,step]));
  const flows=prepared.request.flows.map(flow=>{
    const steps=flow.steps.map(step=>flowEvents.get(`${flow.id}\0${step.id}`)??{id:step.id,status:'not-run',observed:null,evidenceRefs:[]});
    const status=steps.every(step=>step.status==='completed')?'completed':steps.some(step=>step.status==='failed')?'failed':steps.some(step=>step.status==='cancelled')?'cancelled':'inconclusive';
    return {id:flow.id,status,steps:steps.map(({id,status,observed,evidenceRefs})=>({id,status,observed,evidenceRefs}))};
  });
  const gateResults=new Map(data.gates.map(gate=>[gate.id,gate]));
  const humanGates=prepared.request.humanGates.map(gate=>gateResults.get(gate.id)??{id:gate.id,status:'not-run',response:'not-run',evidenceRefs:[]});
  const checks=[...data.checks,{id:'playwright-session',command:'locked Playwright headed chromium session',exitCode:launchExit,evidenceRefs:[]},...redactionResults];
  const receipt={schema:'starci/assisted-uat-receipt@1',receiptId:prepared.runId,runId:prepared.runId,
    request:{path:relativePosix(prepared.root,prepared.requestFile),sha256:prepared.requestDigest},
    sessionManifest:{path:relativePosix(prepared.root,prepared.sessionFile),sha256:prepared.sessionDigest},
    bindings:{...prepared.session.bindings},
    runner:{name:'starci-assisted-uat',version:RUNNER_VERSION,platform:`${process.platform}-${process.arch}`,playwrightVersion:prepared.session.playwright.version,browserRevision:String(prepared.session.playwright.revision)},
    startedAt:state.startedAt,finishedAt:iso(),completionSignal:{...completionSignal,meaning:'execution-finished-not-pass'},
    flows,humanGates,checks,artifacts,postconditions:data.postconditions,
    cleanup:{attempted:true,complete:cleanupFailures.length===0,actions:cleanupActions,unresolved:cleanupFailures},
    redaction:{applied:true,complete:redactionFailures.length===0,failures:redactionFailures}};
  validate('receipt',receipt);
  fs.mkdirSync(path.dirname(prepared.receiptFile),{recursive:true});
  fs.writeFileSync(prepared.receiptFile,stringifyYaml(receipt),{flag:'wx'});
  updateState(prepared,state,'finished',{type:'finished',receipt:prepared.receiptFile,meaning:'receipt-recorded-not-pass'},{pendingGate:null,receipt:prepared.receiptFile,finishedAt:receipt.finishedAt});
  return receipt;
};

const runSession=async(prepared,state,slot)=>{
  const sanitize=sanitizer(prepared),data={steps:[],checks:[],artifacts:[],postconditions:[],gates:[]};
  let completionSignal=null,launchExit=1,protocolError=null;
  const env=Object.fromEntries([...SAFE_ENV,...prepared.session.launch.envNames].filter(name=>process.env[name]!==undefined).map(name=>[name,process.env[name]]));
  Object.assign(env,{STARCI_ASSISTED_UAT_REQUEST:prepared.requestFile,STARCI_ASSISTED_UAT_RUN_DIR:prepared.runDir,STARCI_ASSISTED_UAT_PROTOCOL:PROTOCOL_PREFIX});
  const command=prepared.session.launch.command,launch=launchFor(command);
  // The owner's headed session keeps its console. Under node --test that console is a Windows Terminal
  // default-terminal handoff per run: a tab left open, and a handoff WT stalls under suite load, so the
  // driver never starts and the run times out.
  const child=spawn(launch.file,launch.args,{cwd:resolveCwd(prepared.root,prepared.session.launch.cwd),env,stdio:['pipe','pipe','ignore'],windowsHide:Boolean(process.env.NODE_TEST_CONTEXT)});
  const childExit=new Promise(resolve=>{
    child.once('exit',code=>resolve(Number.isInteger(code)?code:1));
    child.once('error',error=>{protocolError=error;resolve(1);});
  });
  updateState(prepared,state,'running',{type:'started',runId:prepared.runId},{pid:process.pid,childPid:child.pid,waitingForSlot:false,queuePosition:null,uatSlot:slot.slot});
  const timeout=setTimeout(()=>{protocolError=Object.assign(new Error('assisted UAT session timed out'),{code:'assisted-uat-timeout'});try{child.kill();}catch{}},prepared.request.limits.timeoutMs);
  const lines=readline.createInterface({input:child.stdout,crlfDelay:Infinity});
  try{
    for await(const line of lines){
      if(!line.startsWith(PROTOCOL_PREFIX))continue;
      const event=normalizeProtocolEvent(prepared,JSON.parse(line.slice(PROTOCOL_PREFIX.length)),sanitize);
      if(event.type==='checkpoint'){
        const gate=prepared.request.humanGates[data.gates.length];
        need(gate&&gate.id===event.gateId,`checkpoint ${event.gateId} is not the next frozen gate`,'assisted-uat-protocol-invalid');
        updateState(prepared,state,'waiting',{type:'checkpoint',gate:{id:gate.id,class:gate.class,instruction:gate.prompt,accepted:['ok','fail','cancel'],secretNotice:'Enter credentials or OTP only in the visible browser, never in chat.'}},{pendingGate:gate.id});
        let signal;
        try{signal=await waitForSignal(prepared,gate.id,prepared.request.limits.timeoutMs);}catch(error){signal={value:'cancel',actor:'runner-timeout',recordedAt:iso()};protocolError=error;}
        need(SIGNALS.has(signal.value),`invalid signal for gate ${gate.id}`);
        const status=signal.value==='ok'?'completed':signal.value==='fail'?'failed':'cancelled';
        data.gates.push({id:gate.id,status,response:signal.value,evidenceRefs:[]});
        completionSignal={value:signal.value,actor:signal.actor,recordedAt:signal.recordedAt};
        child.stdin.write(`${JSON.stringify({type:'human-signal',gateId:gate.id,value:signal.value})}\n`);
        updateState(prepared,state,signal.value==='ok'?'running':'finalizing',{type:'signal-accepted',gateId:gate.id,value:signal.value},{pendingGate:null});
        if(signal.value!=='ok'){try{child.kill();}catch{}break;}
      }else if(event.type==='step'){
        const flow=prepared.request.flows.find(item=>item.id===event.flowId);need(flow?.steps.some(step=>step.id===event.id),`driver named undeclared step ${event.flowId}/${event.id}`,'assisted-uat-protocol-invalid');const {type,...record}=event;data.steps.push(record);
      }else if(event.type==='check'){
        need(event.id&&Number.isInteger(event.exitCode),'driver check needs id and integer exitCode');const {type,...record}=event;data.checks.push(record);
      }else if(event.type==='artifact'){const {type,...record}=event;data.artifacts.push(record);}
      else if(event.type==='postcondition'){const {type,...record}=event;data.postconditions.push(record);}
    }
    launchExit=child.exitCode!=null?child.exitCode:await childExit;
  }catch(error){protocolError=error;try{child.kill();}catch{}}
  finally{clearTimeout(timeout);lines.close();}
  if(!completionSignal)completionSignal={value:'cancel',actor:protocolError?'runner-protocol':'runner',recordedAt:iso()};
  if(protocolError)data.checks.push({id:'runner-protocol',command:'validate assisted UAT event protocol',exitCode:1,evidenceRefs:[]});
  finishReceipt(prepared,state,data,completionSignal,launchExit);
};
// The machine-wide UAT ceiling (config.yaml uat.maxConcurrent): no browser or app work starts before this
// run holds a slot. While it waits the run state is `queued` with its FIFO position; the slot is released
// on every exit path — this finally, and the uat-slots process 'exit' hook for a crash.
const workerMain=async prepared=>{
  const state=readState(prepared.runDir);validateFreshState(prepared,state);
  const slot=await acquireUatSlot({runId:prepared.runId,onQueued:({position,limit,holders})=>{
    updateState(prepared,state,'queued',{type:'queued',waitingForSlot:true,position,limit,holders},{waitingForSlot:true,queuePosition:position,slotLimit:limit});
  }});
  try{return await runSession(prepared,state,slot);}finally{slot.release();}
};

export function startSession({requestPath,receiptPath,skipRunnerCheck=false}={}){
  const prepared=inspectPreparedRequest({requestPath,receiptPath,allowExistingReceipt:true});
  if(fs.existsSync(prepared.receiptFile)){const receipt=readYaml(prepared.receiptFile);validate('receipt',receipt);assertDigest(prepared.requestDigest,receipt.request.sha256,'existing receipt request');return {idempotent:true,runId:prepared.runId,phase:'finished',revision:null,receipt:prepared.receiptFile};}
  const stateFile=stateFileOf(prepared.runDir);
  if(fs.existsSync(stateFile)){const state=readState(prepared.runDir);validateFreshState(prepared,state);if(!TERMINAL_PHASES.has(state.phase)&&!pidAlive(state.pid))return {...publicState(state),staleProcess:true};return {idempotent:true,...publicState(state)};}
  need(!fs.existsSync(prepared.runDir),`run directory already exists without a valid state: ${prepared.runDir}`,'assisted-uat-run-collision');
  if(!skipRunnerCheck)validateLockedPlaywright(prepared);
  fs.mkdirSync(signalsDirOf(prepared.runDir),{recursive:true});fs.mkdirSync(path.join(prepared.runDir,'artifacts'),{recursive:true});
  const state={schema:'starci/assisted-uat-run-state@1',runId:prepared.runId,request:prepared.requestFile,requestDigest:prepared.requestDigest,sessionManifest:prepared.sessionFile,sessionDigest:prepared.sessionDigest,receipt:prepared.receiptFile,runDir:prepared.runDir,phase:'starting',revision:0,pid:null,pendingGate:null,event:null,startedAt:iso(),updatedAt:iso()};
  writeState(prepared,state);
  const log=fs.openSync(path.join(prepared.runDir,'control','runner.log'),'a');
  const child=spawn(process.execPath,[fileURLToPath(import.meta.url),'_worker','--request',prepared.requestFile,'--receipt',prepared.receiptFile],{detached:true,stdio:['ignore',log,log],windowsHide:true});
  state.pid=child.pid;writeState(prepared,state);child.unref();fs.closeSync(log);
  return publicState(state);
}

export function signalSession({requestPath,receiptPath,value,actor='user'}={}){
  need(SIGNALS.has(value),'--value must be exactly ok, fail, or cancel');
  let prepared;
  try{prepared=inspectPreparedRequest({requestPath,receiptPath,allowExistingReceipt:true});}catch(error){throw error;}
  need(fs.existsSync(stateFileOf(prepared.runDir)),'assisted UAT session has not been started');
  const state=readState(prepared.runDir);
  try{validateFreshState(prepared,state);}catch(error){if(state.pendingGate){const file=signalFileOf(prepared.runDir,state.pendingGate);if(!fs.existsSync(file))fs.writeFileSync(file,stringifyYaml({schema:'starci/assisted-uat-signal@1',gateId:state.pendingGate,value:'cancel',actor:'runner-stale-detection',recordedAt:iso()}),{flag:'wx'});}throw error;}
  const replayGate=state.pendingGate??state.event?.gateId;
  if(replayGate){
    const replayFile=signalFileOf(prepared.runDir,replayGate);
    if(fs.existsSync(replayFile)){
      const existing=readYaml(replayFile);need(existing.value===value,`checkpoint already received '${existing.value}'; conflicting replay refused`,'assisted-uat-signal-conflict');return {accepted:true,idempotent:true,gateId:existing.gateId,value:existing.value,revision:state.revision};
    }
  }
  need(state.phase==='waiting'&&state.pendingGate,'no human checkpoint is awaiting a signal');
  const signal={schema:'starci/assisted-uat-signal@1',gateId:state.pendingGate,value,actor:String(actor||'user'),recordedAt:iso()};
  const file=signalFileOf(prepared.runDir,state.pendingGate);
  if(fs.existsSync(file)){const existing=readYaml(file);need(existing.value===value,`checkpoint already received '${existing.value}'; conflicting replay refused`,'assisted-uat-signal-conflict');return {accepted:true,idempotent:true,gateId:existing.gateId,value:existing.value,revision:state.revision};}
  fs.writeFileSync(file,stringifyYaml(signal),{flag:'wx'});
  return {accepted:true,idempotent:false,gateId:signal.gateId,value:signal.value,revision:state.revision};
}

export async function waitSession({requestPath,receiptPath,after=0}={}){
  const prepared=inspectPreparedRequest({requestPath,receiptPath,allowExistingReceipt:true});
  if(fs.existsSync(prepared.receiptFile))return {runId:prepared.runId,phase:'finished',revision:null,receipt:prepared.receiptFile,event:{type:'finished',receipt:prepared.receiptFile,meaning:'receipt-recorded-not-pass'}};
  need(fs.existsSync(stateFileOf(prepared.runDir)),'assisted UAT session has not been started');
  const state=readState(prepared.runDir);validateFreshState(prepared,state);
  const next=await waitForChange(prepared,Number(after),prepared.request.limits.timeoutMs);
  validateFreshState(prepared,next);return publicState(next);
}

const parseArgs=argv=>{const out={};for(let i=0;i<argv.length;i++){const token=argv[i];if(!token.startsWith('--'))continue;const key=token.slice(2);out[key]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;}return out;};
const print=value=>process.stdout.write(`${JSON.stringify(value,null,2)}\n`);
const use=()=>{console.error('use: node scripts/uat/assisted-runner.mjs <inspect|start|status|wait|signal|run> --request <absolute request.yaml> --receipt <absolute new receipt.yaml> [--after n] [--value ok|fail|cancel]');process.exit(2);};

async function interactive(args){
  let state=startSession({requestPath:args.request,receiptPath:args.receipt});print(state);
  const input=readline.createInterface({input:process.stdin,output:process.stdout});
  try{
    while(state.phase!=='finished'){
      state=await waitSession({requestPath:args.request,receiptPath:args.receipt,after:state.revision??0});print(state);
      if(state.phase==='waiting'){
        const answer=(await new Promise(resolve=>input.question('Signal [ok/fail/cancel]: ',resolve))).trim().toLowerCase();
        signalSession({requestPath:args.request,receiptPath:args.receipt,value:answer,actor:os.userInfo().username||'user'});
      }
    }
  }finally{input.close();}
}

async function main(){
  const [command,...rest]=process.argv.slice(2),args=parseArgs(rest);
  if(!command||!args.request||!args.receipt)use();
  try{
    if(command==='inspect'){const prepared=inspectPreparedRequest({requestPath:args.request,receiptPath:args.receipt,allowExistingReceipt:true});validateLockedPlaywright(prepared);return print({ok:true,requestId:prepared.request.requestId,runId:prepared.runId,requestDigest:prepared.requestDigest,sessionDigest:prepared.sessionDigest,bindings:prepared.session.bindings,runDir:prepared.runDir,receipt:prepared.receiptFile,humanGates:prepared.request.humanGates.map(({id,class:kind,prompt})=>({id,class:kind,instruction:prompt}))});}
    if(command==='start')return print({ok:true,...startSession({requestPath:args.request,receiptPath:args.receipt})});
    if(command==='wait')return print({ok:true,...await waitSession({requestPath:args.request,receiptPath:args.receipt,after:Number(args.after??0)})});
    if(command==='signal')return print({ok:true,...signalSession({requestPath:args.request,receiptPath:args.receipt,value:args.value,actor:args.actor??'user'})});
    if(command==='run')return interactive(args);
    if(command==='status'){
      const prepared=inspectPreparedRequest({requestPath:args.request,receiptPath:args.receipt,allowExistingReceipt:true});
      if(fs.existsSync(prepared.receiptFile))return print({ok:true,runId:prepared.runId,phase:'finished',revision:null,receipt:prepared.receiptFile});
      need(fs.existsSync(stateFileOf(prepared.runDir)),'assisted UAT session has not been started');
      const state=readState(prepared.runDir);validateFreshState(prepared,state);
      return print({ok:true,...publicState(state),...(!TERMINAL_PHASES.has(state.phase)&&!pidAlive(state.pid)?{staleProcess:true}:{})});
    }
    if(command==='_worker'){
      // A terminating signal exits through process 'exit', so the held UAT slot is released.
      for(const sig of ['SIGINT','SIGTERM','SIGBREAK','SIGHUP'])process.on(sig,()=>process.exit(143));
      const prepared=inspectPreparedRequest({requestPath:args.request,receiptPath:args.receipt,allowExistingReceipt:true});
      try{return await workerMain(prepared);}catch(error){
        try{const state=readState(prepared.runDir);updateState(prepared,state,'failed',{type:'runner-failed',code:error?.code??'assisted-uat-error'},{pendingGate:null});}catch{}
        throw error;
      }
    }
    use();
  }catch(error){console.error(JSON.stringify({ok:false,code:error?.code??'assisted-uat-error',error:String(error?.message??error)}));process.exit(1);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
