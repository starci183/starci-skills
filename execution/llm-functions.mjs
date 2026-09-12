import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Model calls as functions: a fixed prompt frame, a required JSON schema, a headless provider command,
 * validation and a bounded retry. The model never sees the control loop; it fills a form.
 */
export const PLAN_OP='starci/op-plan@1';
export const DECISION='starci/decision@1';
export const GOAL_PLAN='starci/goal-plan@1';
export const WORK_GOAL='starci/work-goal@1';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};

/** Headless provider commands. The prompt goes on stdin; the JSON answer is extracted from the provider's own envelope. */
export const HEADLESS_PROVIDERS={
  'claude-opus':{command:['claude','-p','--output-format','json','--model','opus'],extract:extractClaude},
  'claude-fable-5.1':{command:['claude','-p','--output-format','json','--model','claude-fable-5-1'],extract:extractClaude},
  'qwen3.8-flash':{command:['qwen','--model','qwen3.8-flash','--approval-mode','yolo','--output-format','json','--exclude-tools','agent'],extract:extractQwen},
  'gpt-5.6-sol':{command:['codex','exec','--json','--model','gpt-5.6-sol'],extract:extractCodex}
};
/** A provider that refuses with a quota signal is not broken: the chain moves on without retrying it. */
export const RATE_LIMITED=/429|rate.?limit|too many requests|overloaded/i;
function extractClaude(stdout){
  const envelope=JSON.parse(stdout);
  need(envelope.is_error!==true,`Claude headless error: ${envelope.result??envelope.subtype}`);
  return typeof envelope.result==='string'?envelope.result:JSON.stringify(envelope.result);
}
function extractQwen(stdout){
  const events=JSON.parse(stdout);
  const list=Array.isArray(events)?events:[events];
  const result=[...list].reverse().find(event=>event?.type==='result'||typeof event?.result==='string');
  need(result,'Qwen headless output has no result event');
  return typeof result.result==='string'?result.result:JSON.stringify(result.result??result);
}

/** Codex streams JSONL events; the answer is the last assistant message text. Unknown shapes fall back to the last line. */
export function extractCodex(stdout){
  const lines=String(stdout??'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  let answer;
  for(const line of lines){
    let event;
    try{event=JSON.parse(line);}catch{continue;}
    for(const candidate of [event,event?.item,event?.msg,event?.message,event?.response]){
      if(!plain(candidate))continue;
      const type=`${candidate.type??''} ${candidate.role??''}`;
      if(/user/i.test(type)||!/message|assistant/i.test(type))continue;
      const text=codexText(candidate.text??candidate.content??candidate.message);
      if(text)answer=text;
    }
  }
  return answer??lines.at(-1)??'';
}
function codexText(value){
  if(typeof value==='string')return value;
  if(Array.isArray(value))return value.map(codexText).filter(Boolean).join('\n');
  if(plain(value))return codexText(value.text??value.content??'');
  return '';
}

/** Pull the first JSON object out of free text (models wrap answers in fences or prose). */
export function extractJson(text){
  const trimmed=String(text??'').trim();
  const fenced=trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidates=[fenced?.[1],trimmed];
  for(const candidate of candidates){
    if(!candidate)continue;
    const start=candidate.indexOf('{');
    if(start<0)continue;
    for(let end=candidate.length;end>start;end-=1){
      if(candidate[end-1]!=='}')continue;
      try{return JSON.parse(candidate.slice(start,end));}catch{}
    }
  }
  throw Error('No JSON object in the model answer');
}

/** Minimal schema check: required keys with primitive types and enumerations; nested objects validated by predicate. */
export function validateForm(value,form){
  const errors=[];
  if(!plain(value))return {ok:false,errors:['answer is not an object']};
  for(const [key,rule] of Object.entries(form)){
    const item=value[key];
    if(rule.optional&&(item===undefined||item===null))continue;
    if(item===undefined||item===null){errors.push(`missing ${key}`);continue;}
    if(rule.type==='string'&&(typeof item!=='string'||!item.trim()))errors.push(`${key} must be a non-empty string`);
    if(rule.type==='string[]'&&!(Array.isArray(item)&&item.every(x=>typeof x==='string'&&x.trim())))errors.push(`${key} must be a list of strings`);
    if(rule.type==='object[]'&&!(Array.isArray(item)&&item.every(plain)))errors.push(`${key} must be a list of objects`);
    if(rule.enum&&!rule.enum.includes(item))errors.push(`${key} must be one of ${rule.enum.join(', ')}`);
    if(rule.minItems&&Array.isArray(item)&&item.length<rule.minItems)errors.push(`${key} needs at least ${rule.minItems} items`);
    if(rule.each&&Array.isArray(item))for(const [index,entry] of item.entries()){const inner=validateForm(entry,rule.each);for(const e of inner.errors)errors.push(`${key}[${index}]: ${e}`);}
  }
  return {ok:errors.length===0,errors};
}

export const OP_PLAN_FORM={
  goal:{type:'string'},srsIds:{type:'string[]'},sdsIds:{type:'string[]',minItems:1},allowlist:{type:'string[]',minItems:1},
  references:{type:'string[]',minItems:1},checks:{type:'object[]',minItems:1,each:{name:{type:'string'},command:{type:'string'}}},
  acceptance:{type:'string[]',minItems:1},inputs:{type:'string[]'},outputs:{type:'string[]',minItems:1},rationale:{type:'string',optional:true}
};
export const DECISION_FORM={option:{type:'string'},rationale:{type:'string'},instructions:{type:'string',optional:true}};
/** One job turned into a definition of done, a ledger of the things that must exist, and as many ops as the job needs. */
export const GOAL_FORM={
  definitionOfDone:{type:'string[]',minItems:1},
  ledger:{type:'object[]',minItems:1,each:{id:{type:'string'},title:{type:'string'},inputRef:{type:'string'},status:{type:'string',enum:['absent','partial','done','unknown']}}},
  ops:{type:'object[]',minItems:1,each:{id:{type:'string'},kind:{type:'string'},goal:{type:'string'},ledgerIds:{type:'string[]',minItems:1},
    allowlist:{type:'string[]',minItems:1},references:{type:'string[]'},checks:{type:'object[]',minItems:1,each:{name:{type:'string'},command:{type:'string'}}},
    acceptance:{type:'string[]',minItems:1},dependsOn:{type:'string[]'}}},
  risks:{type:'string[]',optional:true},questions:{type:'string[]',optional:true}
};

function frame(kind,payload,form){
  return [
    `You are a planning function inside the StarCi supervisor. Answer with ONE JSON object and nothing else.`,
    `Function: ${kind}. Required keys and types: ${JSON.stringify(Object.fromEntries(Object.entries(form).map(([k,v])=>[k,v.type+(v.enum?` in ${v.enum.join('|')}`:'')+(v.optional?' (optional)':'')])))}.`,
    `You decide only the content of the form. The process (provider, retries, waiting, reporting) is fixed by the runtime and is not yours to change.`,
    `Input:`,JSON.stringify(payload,null,2)
  ].join('\n');
}

/** Run one headless provider with a prompt on stdin; returns the raw answer text. */
export function runHeadless(provider,prompt,{cwd,timeoutMs=600000,spawn=spawnSync}={}){
  const spec=HEADLESS_PROVIDERS[provider];
  need(spec,`Unknown headless provider: ${provider}`);
  const [executable,...args]=spec.command;
  const result=spawn(executable,args,{cwd,input:prompt,encoding:'utf8',windowsHide:true,timeout:timeoutMs,shell:process.platform==='win32',maxBuffer:64*1024*1024});
  if(result.status!==0){
    const output=`${result.stderr??''}\n${result.stdout??''}`;
    if(RATE_LIMITED.test(output))throw Error(`rate-limited: ${provider} refused with a quota signal: ${output.trim().slice(-200)}`);
    need(false,`${provider} headless exited ${result.status}: ${(result.stderr??'').slice(-400)}`);
  }
  try{return spec.extract(result.stdout);}
  catch(error){
    if(RATE_LIMITED.test(error.message))throw Error(`rate-limited: ${provider} answered with a quota signal: ${error.message}`);
    throw error;
  }
}

/** Call a model function over a provider chain with validation and one retry per provider; `extra` adds cross-field rules. */
export function callFunction({kind,payload,form,providers,cwd,runHeadless:run=runHeadless,retries=1,extra}){
  const attempts=[];
  for(const provider of providers){
    for(let attempt=0;attempt<=retries;attempt+=1){
      let answer;
      try{answer=run(provider,frame(kind,payload,form)+(attempt?`\nYour previous answer was invalid: ${attempts.at(-1).errors.join('; ')}. Answer again with the full JSON object.`:''),{cwd});}
      catch(error){attempts.push({provider,attempt,errors:/^rate-limited:/.test(error.message)?['rate-limited']:[error.message]});break;}
      let parsed;
      try{parsed=extractJson(answer);}catch(error){attempts.push({provider,attempt,errors:[error.message]});continue;}
      const checked=validateForm(parsed,form);
      const errors=checked.ok?(extra?extra(parsed).errors??[]:[]):checked.errors;
      if(!errors.length)return {ok:true,provider,attempt,value:parsed,attempts};
      attempts.push({provider,attempt,errors});
    }
  }
  return {ok:false,attempts,reason:'no provider produced a valid form'};
}

/** planOp: fill the input form of one operation node from SRS/SDS material and prior reports. */
export function planOp({node,workflow,ownership,sdsMaterial,priorReports=[],providers=['claude-opus','qwen3.8-flash'],cwd,runHeadless:run}){
  const payload={operation:node.operation,scope:workflow,attempt:node.attempt??1,ownership,priorOpen:node.priorOpen??[],findings:node.findings??[],
    sdsSlice:node.sdsIds??[],material:sdsMaterial,priorReports:priorReports.map(r=>({outcome:r.outcome,summary:r.summary,open:r.open,files:r.files})),
    rules:['allowlist must be inside ownership','checks must be real commands runnable from the worktree','acceptance statements are verified one by one by review.verify','never plan process steps (ping, report, retry): they are fixed']};
  const result=callFunction({kind:'planOp',payload,form:OP_PLAN_FORM,providers,cwd,runHeadless:run});
  if(result.ok)result.value.schema=PLAN_OP;
  return result;
}

/** A path prefix for overlap tests: backslashes folded, glob tail cut, so `apps/x/**` and `apps/x/y.ts` compare as one tree. */
function pathKey(value){
  const parts=[];
  for(const segment of String(value??'').replace(/\\/g,'/').split('/')){
    if(segment.includes('*'))break;
    if(segment&&segment!=='.')parts.push(segment);
  }
  return parts.join('/');
}
const prefixOverlap=(a,b)=>a===''||b===''||a===b||a.startsWith(`${b}/`)||b.startsWith(`${a}/`);
/** Every op reachable from `id` through dependsOn; cycle-safe so the walk also serves as the cycle probe. */
function reachable(id,edges){
  const seen=new Set();const queue=[...(edges.get(id)??[])];
  while(queue.length){const next=queue.shift();if(seen.has(next))continue;seen.add(next);queue.push(...(edges.get(next)??[]));}
  return seen;
}

/** Cross-field rules of a goal plan: identity, a dependency order, a covered ledger and allowlists that cannot collide in parallel. */
export function goalPlanRules(plan){
  const errors=[];
  const ops=Array.isArray(plan?.ops)?plan.ops:[];
  const ids=ops.map(op=>op.id);
  for(const id of new Set(ids))if(ids.filter(other=>other===id).length>1)errors.push(`op id ${id} is used by ${ids.filter(other=>other===id).length} ops; op ids must be unique`);
  const known=new Set(ids);
  const edges=new Map(ops.map(op=>[op.id,(op.dependsOn??[]).filter(id=>known.has(id))]));
  for(const op of ops)for(const dependency of op.dependsOn??[])if(!known.has(dependency))errors.push(`op ${op.id} depends on ${dependency}, which is not an op of this plan`);
  for(const op of ops){
    const ahead=reachable(op.id,edges);
    if(ahead.has(op.id))errors.push(`op ${op.id} is part of a dependency cycle: ${[op.id,...[...ahead].filter(id=>reachable(id,edges).has(op.id))].join(' -> ')}`);
  }
  const referenced=new Set(ops.flatMap(op=>op.ledgerIds??[]));
  for(const item of Array.isArray(plan?.ledger)?plan.ledger:[])
    if(!referenced.has(item.id)&&item.status!=='done')errors.push(`ledger item ${item.id} is ${item.status} and no op builds it; reference it from an op or mark it done`);
  for(const op of ops)for(const ledgerId of op.ledgerIds??[])
    if(!(Array.isArray(plan?.ledger)?plan.ledger:[]).some(item=>item.id===ledgerId))errors.push(`op ${op.id} claims ledger item ${ledgerId}, which is not in the ledger`);
  if(!errors.some(error=>error.includes('dependency cycle')))for(const [index,op] of ops.entries())for(const other of ops.slice(index+1)){
    if(op.id===other.id||reachable(op.id,edges).has(other.id)||reachable(other.id,edges).has(op.id))continue;
    for(const mine of op.allowlist??[])for(const theirs of other.allowlist??[]){
      if(!prefixOverlap(pathKey(mine),pathKey(theirs)))continue;
      errors.push(`ops ${op.id} and ${other.id} are independent so they may run in parallel, but their allowlists overlap: ${mine} and ${theirs}. Split the paths or make one depend on the other.`);
    }
  }
  return {ok:errors.length===0,errors};
}

/** Form check plus cross-field rules: the whole contract of starci/goal-plan@1. */
export function validateGoalPlan(plan){
  const checked=validateForm(plan,GOAL_FORM);
  if(!checked.ok)return checked;
  return goalPlanRules(plan);
}

const GOAL_RULES=[
  'SRS/SDS are one input kind among others: a bug report, a UAT flow, a design, a dataset and existing code are equally valid inputs.',
  "the ledger must be derived from the job's definition of done, not from the file structure of the repository",
  'ops are dynamic: plan as many as the job needs, each small enough for one session to finish',
  'allowlists of ops that can run in parallel must be disjoint; overlapping paths are a re-plan, not a risk note',
  'checks are real commands runnable from the worktree',
  'acceptance statements are verified one by one by a verify op',
  'never plan process steps (ping, report, retry): they are fixed by the runtime'
];

/** One job whose ledger already exists: only the definition of done and the risks around it are asked. */
export const WORK_GOAL_FORM={
  definitionOfDone:{type:'string[]',minItems:1},
  risks:{type:'string[]',optional:true},questions:{type:'string[]',optional:true}
};
const WORK_GOAL_RULES=[
  'the ledger below is the authored Work tree: it is the TODO list, and you may neither add, drop nor rewrite a node',
  'the definition of done states what will be true of the product when those nodes are done, in the job\'s terms',
  'a risk is something that can make the listed work wrong or incomplete; a question is something only the user can settle',
  'never plan operations, allowlists, checks or process steps: the kernel derives them from the nodes'
];

/**
 * assessGoal: read the job and its material, and answer with the one goal plan the user approves. When
 * `ledger` is given the ledger is a fact (the Work tree), so only the definition of done, the risks and the
 * questions are asked and no operation form is invented.
 */
export function assessGoal({job,inputs=[],material=[],constraints=[],ledger=null,providers=['claude-opus','claude-fable-5.1'],cwd,runHeadless:run}){
  const payload={job,inputs:inputs.map(input=>({kind:input.kind,ref:input.ref,summary:input.summary})),material,constraints,
    ...(ledger?{ledger}:{}),rules:ledger?WORK_GOAL_RULES:GOAL_RULES};
  if(ledger){
    const assessed=callFunction({kind:'assessGoal',payload,form:WORK_GOAL_FORM,providers,cwd,runHeadless:run});
    if(assessed.ok)assessed.value.schema=WORK_GOAL;
    return assessed;
  }
  const result=callFunction({kind:'assessGoal',payload,form:GOAL_FORM,providers,cwd,runHeadless:run,extra:goalPlanRules});
  if(result.ok)result.value.schema=GOAL_PLAN;
  return result;
}

const cell=value=>String(value??'').replaceAll('|','\\|').replace(/\s*\r?\n\s*/g,' ').trim();
const list=value=>(Array.isArray(value)?value:[]).map(cell).join(', ')||'—';
/** The one page the user approves: no timestamps, no ordering surprises, the same plan always renders the same text. */
export function renderGoalMarkdown(plan,{job}={}){
  const lines=['# Goal','',cell(job)||'(no job text)','','## Definition of done',''];
  for(const [index,item] of (plan?.definitionOfDone??[]).entries())lines.push(`${index+1}. ${cell(item)}`);
  lines.push('','## Ledger','','| id | title | input | status |','| --- | --- | --- | --- |');
  for(const item of plan?.ledger??[])lines.push(`| ${cell(item.id)} | ${cell(item.title)} | ${cell(item.inputRef)} | ${cell(item.status)} |`);
  lines.push('','## Ops','','| id | kind | ledger ids | allowlist | depends on |','| --- | --- | --- | --- | --- |');
  for(const op of plan?.ops??[])lines.push(`| ${cell(op.id)} | ${cell(op.kind)} | ${list(op.ledgerIds)} | ${list(op.allowlist)} | ${list(op.dependsOn)} |`);
  for(const [heading,items] of [['Risks',plan?.risks],['Questions',plan?.questions]]){
    if(!Array.isArray(items)||!items.length)continue;
    lines.push('',`## ${heading}`,'');
    for(const item of items)lines.push(`- ${cell(item)}`);
  }
  return `${lines.join('\n')}\n`;
}

/** Read the job's material files relative to cwd, skip what is missing, and cap the whole payload. */
export function extractMaterial(files,{maxChars=60000,cwd=process.cwd()}={}){
  const parts=[];let total=0;
  for(const file of Array.isArray(files)?files:[]){
    const resolved=path.resolve(cwd,file);
    if(!fs.existsSync(resolved)||!fs.statSync(resolved).isFile())continue;
    const text=fs.readFileSync(resolved,'utf8');
    const slice=text.slice(0,Math.max(0,maxChars-total));
    total+=slice.length;parts.push({file,text:slice,truncated:slice.length<text.length});
    if(total>=maxChars)break;
  }
  return parts;
}

/** decide: choose one option of a closed set for a crisis the policy table could not settle. */
export function decide({situation,options,context={},providers=['claude-fable-5.1','claude-opus'],cwd,runHeadless:run}){
  const form={...DECISION_FORM,option:{type:'string',enum:options}};
  const result=callFunction({kind:'decide',payload:{situation,options,context},form,providers,cwd,runHeadless:run});
  if(result.ok)result.value.schema=DECISION;
  return result;
}
