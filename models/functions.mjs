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
const unique=list=>[...new Set(list)];

/** Headless provider commands. The prompt goes on stdin; the JSON answer is extracted from the provider's own envelope. */
export const HEADLESS_PROVIDERS={
  'claude-opus':{command:['claude','-p','--output-format','json','--model','opus'],extract:extractClaude,usage:usageClaude},
  'claude-fable-5.1':{command:['claude','-p','--output-format','json','--model','claude-fable-5-1'],extract:extractClaude,usage:usageClaude},
  'qwen3.8-flash':{command:['qwen','--model','qwen3.8-flash','--approval-mode','yolo','--output-format','json','--exclude-tools','agent'],extract:extractQwen,usage:usageQwen},
  'gpt-5.6-sol':{command:['codex','exec','--json','--model','gpt-5.6-sol'],extract:extractCodex,usage:usageCodex},
  'gpt-6-astra':{command:['codex','exec','--json','--model','gpt-6-astra'],extract:extractCodex,usage:usageCodex}
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

/**
 * Token accounting. Every provider prints what the call cost, in its own shape and under its own key names;
 * the runtime needs one number per call so the allocator can charge a day's budget (`usage.total` is what
 * `release(runtime, {tokens})` takes). Usage is telemetry, never a contract: a provider that reports nothing
 * yields `null` and the answer still stands.
 */
const INPUT_KEYS=['input_tokens','inputTokens','prompt_tokens','promptTokens','promptTokenCount','prompt','input'];
const OUTPUT_KEYS=['output_tokens','outputTokens','completion_tokens','completionTokens','candidatesTokenCount','candidates','output'];
const TOTAL_KEYS=['total_tokens','totalTokens','totalTokenCount','total'];
const COST_KEYS=['total_cost_usd','cost_usd','costUsd','cost'];
const TOKEN_NODES=['usage','stats','tokens','token_count','token_usage','total_token_usage'];
const pickNumber=(source,keys)=>{for(const key of keys){const value=Number(source?.[key]);if(Number.isFinite(value))return value;}return null;};
const hasTokens=block=>plain(block)&&[INPUT_KEYS,OUTPUT_KEYS,TOTAL_KEYS].some(keys=>pickNumber(block,keys)!==null);
/** One usage record: input, output, their total (or the provider's own total) and the cost when one is priced. */
export function tokenUsage({input=null,output=null,total=null,cost=null}={}){
  if([input,output,total,cost].every(value=>value===null))return null;
  const sum=total??((input??0)+(output??0));
  return {input:input??0,output:output??0,total:Number.isFinite(sum)?sum:0,cost:cost===null?null:cost};
}
const fromBlock=block=>hasTokens(block)?tokenUsage({input:pickNumber(block,INPUT_KEYS),output:pickNumber(block,OUTPUT_KEYS),total:pickNumber(block,TOTAL_KEYS),cost:pickNumber(block,COST_KEYS)}):null;
/** Sum usage records across attempts and providers; `null` stays `null` until one provider reports something. */
export function addUsage(total,next){
  if(!next)return total;
  const base=total??{input:0,output:0,total:0,cost:null};
  const cost=next.cost===null?base.cost:(base.cost??0)+next.cost;
  return {input:base.input+(next.input??0),output:base.output+(next.output??0),total:base.total+(next.total??0),cost};
}
const parseOrNull=text=>{try{return JSON.parse(text);}catch{return null;}};

/** Claude prints one envelope with `usage` and the priced total. Cache reads and writes are billed as input. */
export function usageClaude(stdout){
  const envelope=parseOrNull(stdout);
  if(!plain(envelope))return null;
  const usage=plain(envelope.usage)?envelope.usage:{};
  const cached=['cache_creation_input_tokens','cache_read_input_tokens'].map(key=>Number(usage[key])).filter(Number.isFinite);
  const input=pickNumber(usage,INPUT_KEYS);
  const cost=pickNumber(envelope,COST_KEYS)??pickNumber(usage,COST_KEYS);
  if(input===null&&pickNumber(usage,OUTPUT_KEYS)===null&&cost===null)return null;
  return tokenUsage({input:input===null&&!cached.length?null:(input??0)+cached.reduce((a,b)=>a+b,0),output:pickNumber(usage,OUTPUT_KEYS),cost});
}

/** Qwen reports either a per-event `usage` object or a final `stats` tree with one token block per model. */
export function usageQwen(stdout){
  const parsed=parseOrNull(stdout);
  if(parsed===null)return null;
  const blocks=tokenBlocks(parsed);
  const leaves=blocks.filter(block=>block.name==='tokens');
  const chosen=leaves.length?leaves:blocks;
  return chosen.reduce((total,block)=>addUsage(total,fromBlock(block.value)),null);
}
/** Every named token node that actually carries numbers, without descending into one that already does. */
function tokenBlocks(value,name=null,found=[]){
  if(Array.isArray(value)){for(const item of value)tokenBlocks(item,name,found);return found;}
  if(!plain(value))return found;
  if(TOKEN_NODES.includes(name)&&hasTokens(value)){found.push({name,value});return found;}
  for(const [key,inner] of Object.entries(value))tokenBlocks(inner,key,found);
  return found;
}

/**
 * Codex streams JSONL: `token_count` carries a cumulative `total_token_usage`, while a per-turn `usage` is one
 * turn only. The cumulative number wins when it is present; otherwise the per-turn records are summed.
 */
export function usageCodex(stdout){
  let cumulative=null,perTurn=null;
  for(const line of String(stdout??'').split(/\r?\n/)){
    const event=parseOrNull(line.trim());
    if(!plain(event))continue;
    for(const candidate of [event,event.info,event.msg,event.item,event.response]){
      if(!plain(candidate))continue;
      if(hasTokens(candidate.total_token_usage))cumulative=fromBlock(candidate.total_token_usage);
      else if(hasTokens(candidate.usage))perTurn=addUsage(perTurn,fromBlock(candidate.usage));
      else if(hasTokens(candidate.token_usage))perTurn=addUsage(perTurn,fromBlock(candidate.token_usage));
    }
  }
  return cumulative??perTurn;
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
    acceptance:{type:'string[]',minItems:1},dependsOn:{type:'string[]'},difficulty:{type:'string',enum:['easy','medium','hard'],optional:true}}},
  risks:{type:'string[]',optional:true},questions:{type:'string[]',optional:true}
};

const PLANNING_ROLE='a planning function inside the StarCi supervisor';
function frame(kind,payload,form,role=PLANNING_ROLE){
  return [
    `You are ${role}. Answer with ONE JSON object and nothing else.`,
    `Function: ${kind}. Required keys and types: ${JSON.stringify(Object.fromEntries(Object.entries(form).map(([k,v])=>[k,v.type+(v.enum?` in ${v.enum.join('|')}`:'')+(v.optional?' (optional)':'')])))}.`,
    `You decide only the content of the form. The process (provider, retries, waiting, reporting) is fixed by the runtime and is not yours to change.`,
    `Input:`,JSON.stringify(payload,null,2)
  ].join('\n');
}

/**
 * Run one headless provider with a prompt on stdin; returns the answer text and what the call cost. Usage is
 * read from the same stdout the answer came from, and a provider that reports none yields `usage:null` rather
 * than failing a valid answer.
 */
export function runHeadlessWithUsage(provider,prompt,{cwd,timeoutMs=600000,spawn=spawnSync}={}){
  const spec=HEADLESS_PROVIDERS[provider];
  need(spec,`Unknown headless provider: ${provider}`);
  const [executable,...args]=spec.command;
  const result=spawn(executable,args,{cwd,input:prompt,encoding:'utf8',windowsHide:true,timeout:timeoutMs,shell:process.platform==='win32',maxBuffer:64*1024*1024});
  if(result.status!==0){
    const output=`${result.stderr??''}\n${result.stdout??''}`;
    if(RATE_LIMITED.test(output))throw Error(`rate-limited: ${provider} refused with a quota signal: ${output.trim().slice(-200)}`);
    need(false,`${provider} headless exited ${result.status}: ${(result.stderr??'').slice(-400)}`);
  }
  let text;
  try{text=spec.extract(result.stdout);}
  catch(error){
    if(RATE_LIMITED.test(error.message))throw Error(`rate-limited: ${provider} answered with a quota signal: ${error.message}`);
    throw error;
  }
  let usage=null;
  try{usage=spec.usage?spec.usage(result.stdout):null;}catch{usage=null;}
  return {text,usage};
}

/** The string-returning call every existing caller uses; the usage of that same call is read by `callFunction`. */
export function runHeadless(provider,prompt,options={}){return runHeadlessWithUsage(provider,prompt,options).text;}

/**
 * Call a model function over a provider chain with validation and one retry per provider; `extra` adds
 * cross-field rules. `usage` is the sum over every attempt the call paid for, including the invalid ones: the
 * kernel charges the whole call to the runtime that ran it, not only its last try.
 */
export function callFunction({kind,payload,form,providers,cwd,runHeadless:run=runHeadlessWithUsage,retries=1,extra,role}){
  const attempts=[];
  let usage=null;
  for(const provider of providers){
    for(let attempt=0;attempt<=retries;attempt+=1){
      let answered;
      try{answered=run(provider,frame(kind,payload,form,role)+(attempt?`\nYour previous answer was invalid: ${attempts.at(-1).errors.join('; ')}. Answer again with the full JSON object.`:''),{cwd});}
      catch(error){attempts.push({provider,attempt,errors:/^rate-limited:/.test(error.message)?['rate-limited']:[error.message]});break;}
      // A caller may inject a plain string-returning runner; then the call simply has no usage to charge.
      const answer=typeof answered==='string'?answered:answered?.text;
      if(typeof answered!=='string')usage=addUsage(usage,answered?.usage??null);
      let parsed;
      try{parsed=extractJson(answer);}catch(error){attempts.push({provider,attempt,errors:[error.message]});continue;}
      const checked=validateForm(parsed,form);
      const errors=checked.ok?(extra?extra(parsed).errors??[]:[]):checked.errors;
      if(!errors.length)return {ok:true,provider,attempt,value:parsed,attempts,usage};
      attempts.push({provider,attempt,errors});
    }
  }
  return {ok:false,attempts,usage,reason:'no provider produced a valid form'};
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
export const DIFFICULTY_LEVELS=['easy','medium','hard'];
export const WORK_GOAL_FORM={
  definitionOfDone:{type:'string[]',minItems:1},
  difficulty:{type:'object[]',optional:true,each:{op:{type:'string'},level:{type:'string',enum:DIFFICULTY_LEVELS},why:{type:'string',optional:true}}},
  risks:{type:'string[]',optional:true},questions:{type:'string[]',optional:true}
};
const WORK_GOAL_RULES=[
  'the ledger below is the authored Work tree: it is the TODO list, and you may neither add, drop nor rewrite a node',
  'the definition of done states what will be true of the product when those nodes are done, in the job\'s terms',
  'a risk is something that can make the listed work wrong or incomplete; a question is something only the user can settle',
  'never plan operations, allowlists, checks or process steps: the kernel derives them from the nodes',
  'rate every ledger node in `difficulty` as easy (mechanical, one file family, no design judgement), medium (several files, existing patterns) or hard (cross-cutting, concurrency, persistence semantics, security, unclear SDS): the kernel routes hard work to the strongest runtimes and easy work to the cheapest'
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

/* ------------------------------------------------------------------ the validator */

/**
 * validateOp: the one validator of a workflow, as a headless call per accepted operation result. The kernel
 * asks it after its own machine verification and proof, before the commit: does this diff satisfy the goal,
 * the acceptance and the node's assertions? The verdict is closed - `accept`, or `reject` with findings that
 * each name a file of the diff - and a finding outside the diff is dropped, because the validator has no
 * authority over what the operation did not change. The memory the kernel maintains travels with every call,
 * so one identity judges every op of the workflow consistently without living in a terminal.
 */
export const VALIDATION='starci/op-validation@1';
export const VALIDATOR_VERDICTS=['accept','reject','unavailable'];
/** Sol first, Opus as the fallback: the user's choice, overridable by `validator.runtimes` in config.json. */
export const DEFAULT_VALIDATOR_RUNTIMES=['gpt-5.6-sol','claude-opus'];
export const VALIDATION_FORM={
  verdict:{type:'string',enum:['accept','reject']},summary:{type:'string'},
  findings:{type:'object[]',optional:true,each:{file:{type:'string'},line:{optional:true},assertion:{type:'string',optional:true},detail:{type:'string'}}}
};
const VALIDATOR_ROLE='the acceptance validator of one StarCi workflow: you judge whether an operation result satisfies its goal, its acceptance statements and its Work assertions, from the diff and the machine check results alone';
export const VALIDATOR_RULES=[
  'judge only what the diff shows against the goal, the acceptance statements and the assertions; never assume work the diff does not contain and never ask for work outside the goal',
  'the checks list is the complete machine evidence: a check named `work-valid` is the kernel\'s own whole-tree validation and proves the acceptance statement of that name; an acceptance statement that no listed check names is judged from the diff itself, and is never rejected merely because no check carries its name',
  'every finding must name a file of the diff (the `files` list); a finding on any other file is dropped by the kernel, so put the defect where the diff is',
  'reject only for a concrete defect: an acceptance statement or assertion the diff does not satisfy, a check that proves nothing, a spec that cannot fail, code the goal did not ask for, a machine check whose evidence contradicts the claim; style and preference are never findings',
  'stay consistent with the memory: the same kind of result gets the same verdict as before, and a job ruling in the memory is binding',
  'a design candidate of an interface.draw operation is the installed grammar rendering the screen\'s main state, captured by a browser: its components are grammar contracts and its colours brand tokens, with real product-shaped content; an image-model painting, a script that paints boxes and text, a mockup-tool export, a screenshot of unstyled markup, or grey placeholder bars for content is a defect and the result is rejected; loading, empty and error states are described in the record, never drawn, and a candidate per state is not required',
  'the markup kept beside each candidate as `<candidate>.html` is the render\'s source and is what the candidate is judged from: a capture with no markup beside it is a defect, and in that markup a list of entities wrapped in a card surface is a defect (a collection is a page section with a heading, a card is one item), as is a palette outside the brand colour tokens and the grammar\'s own - a dominant colour the brand does not declare, or the brand\'s primary present nowhere',
  'when a `brand` record is given it is binding: a design candidate or a built surface that uses a colour, a font or an icon outside the brand colour tokens (each with the role the record gives it) and the installed grammar is a defect, and so is one that uses anything the record forbids',
  'a credential, a key, a token or a configuration the environment does not provide is never invented, stubbed, defaulted or silently skipped: code that hardcodes a value, falls back to a fake, or disables an integration when its key is missing instead of reporting blocked with the exact variable name is a defect; a record that describes an external integration without naming the credential the owner provides, and the `custody: identity:<slug>` that holds it, is a defect',
  'a credential has exactly one custody: the tree\'s own encrypted identity resource (`.starciwork/_resources/identity/<slug>/secrets.enc.yaml`), read through `sops exec-env` at the moment of use. A diff that reads a credential from anywhere else - a plain environment variable the operation exported, an `.env` or config file, a checked-in file, a second variable of its own naming, a default - is a defect; and a diff that WRITES a credential value anywhere at all - a record, a fixture, a spec, an `.env`, a log line, a report, a commit - is a defect whatever else it gets right, and so is one that widens the window a value is live in beyond the single checking process',
  'an intake (work.author over a whole feature) is judged as a reconciliation of three cases - `reference`, `conflict`, `new` - and the kernel has ALREADY checked every id of its table: that the records exist, that a referenced one is decided, that each conflict names an open decision record under this feature, and that no decided record was edited. Judge only what a reader can: whether a `reference` row\'s cited record really covers the claim it is cited for, whether a record the table calls `new` restates a decided record in other words rather than adding something, and whether a `conflict` row\'s decision record states both sides, the consequences of each, the numbered options and exactly one recommendation. A record of another feature that this operation edited, and a side of the feature the table leaves out altogether, are defects',
  'an interface.asset result is the artwork of the slots the design record declared: a slot whose file is missing, or artwork that ignores the brand mascot and logo references the record names, is a defect',
  'a frontend.implement result that substitutes its own image for a declared artwork slot, or omits a declared slot altogether, is a defect - the slot files the asset step produced are what the surface must use',
  'an external integration is proven live or it is not proven: an `integration.verify` result whose scenario fakes, stubs, mocks, records, replays or skips the declared provider, or that reads the credential from anywhere but the identity custody the declaration names (through `sops exec-env`, at the moment of use), or that prints, logs or commits a secret value, is a defect; and an `e2e.verify` evidence whose `proof.fakes` omits a provider the diff fakes is a defect - a faked outside system is allowed there, unnamed it is not',
  'a record repair (`architecture.revise`, `business.revise`) that changed the record leaves three things together: the changed passage, a `rev` higher than it was, and EXACTLY ONE new `extensions.work3.decisionLog` entry `{rev, at, gap, chosen, why, alternatives}` naming the gap it answered. A changed record with no entry, a bumped rev with no changed passage, a second entry, or an earlier entry rewritten or deleted is a defect - the log is how the owner sees what the runtime decided for them',
  'the runtime may settle an unclear record, it may not settle one about money, authority or customer data silently: a revision whose chosen reading changes an observable outcome about what is charged, paid, refunded, taxed or owed and to whom, about who may do or see a thing, or about what is stored, shown, shared or deleted about a person, and that names no decision record with numbered options and one recommendation, is a defect whatever else the diff gets right',
  'an assertion listed under node.deferred is proven by the kernel itself or by a later step of the node lane (an end-to-end run, a review): never reject this operation for it, and never ask this operation to prove it',
  'the process (retry, commit, ledger) is the kernel\'s; you answer accept or reject and one line of summary'
];
/**
 * The declared input and output of the operation's kind, when the caller hands them over. It is the one rule
 * that can be stated over data rather than over prose: the kind says which record kinds it may read and which
 * it may produce, so a citation or a write outside that declaration is a defect nobody has to feel out.
 */
export const VALIDATOR_IO_RULE='this operation declares what it reads and what it produces (`io.reads`, `io.writes`, as record kinds): a record cited outside `io.reads` or written outside `io.writes` is a defect, whatever else the diff gets right';
const normalizeFile=value=>String(value??'').replaceAll('\\','/').replace(/^\.\//,'').replace(/^\/+/,'').trim();
/** A reject must carry a finding, otherwise there is nothing for the operation to fix. */
const validationRules=answer=>({errors:answer.verdict==='reject'&&!(Array.isArray(answer.findings)&&answer.findings.length)?['a reject must carry at least one finding']:[]});

export function validateOp({op,node=null,diff,checks=[],references=[],brand=null,io=null,memory='',providers=DEFAULT_VALIDATOR_RUNTIMES,skip=[],cwd,runHeadless:run}){
  need(plain(op)&&typeof op.id==='string','validateOp needs the operation');
  const files=unique((diff?.files??[]).map(normalizeFile).filter(Boolean));
  // A provider the allocator reports as cooling is skipped, not tried: a rate limit parks it for every caller.
  const chain=providers.filter(provider=>!skip.includes(provider));
  if(!chain.length)return {ok:false,verdict:'unavailable',reason:`every validator provider is unavailable (${providers.join(', ')})`,attempts:[],usage:null,findings:[],dropped:[]};
  const payload={
    op:{id:op.id,kind:op.kind,goal:op.goal,attempt:op.attempt??1,acceptance:op.acceptance??[],allowlist:op.allowlist??[]},
    ...(node?{node:{id:node.id??op.nodeId??null,description:node.description??null,assertions:node.assertions??[],deferred:node.deferred??[]}}:{}),
    checks:checks.map(check=>({name:check.name,command:check.command,exitCode:check.exitCode,evidence:check.evidence??null})),
    references,
    // The brand of the product, when the tree has one: the colour tokens with their roles, the mascot and logo
    // assets, what is forbidden and the rules an imagery prompt must carry. It is the rule set a surface is
    // judged against, so it travels as data beside the diff, never as prose in the role line.
    ...(plain(brand)?{brand}:{}),
    // What the kind declares it reads and produces, when the kernel hands it over. It travels as data, and the
    // rule that makes it binding travels with it: an operation with no declaration is judged without either.
    ...(plain(io)?{io:{reads:unique(strings(io.reads)),writes:unique(strings(io.writes))}}:{}),
    diff:{files,truncated:Boolean(diff?.truncated),text:String(diff?.text??'')},
    memory:String(memory??''),
    rules:plain(io)?[...VALIDATOR_RULES,VALIDATOR_IO_RULE]:VALIDATOR_RULES
  };
  const result=callFunction({kind:'validateOp',payload,form:VALIDATION_FORM,providers:chain,cwd,runHeadless:run,extra:validationRules,role:VALIDATOR_ROLE});
  if(!result.ok)return {ok:false,verdict:'unavailable',reason:result.reason??'no provider produced a valid verdict',attempts:result.attempts,usage:result.usage,findings:[],dropped:[]};
  const answer=result.value;
  const findings=[],dropped=[];
  for(const finding of Array.isArray(answer.findings)?answer.findings:[]){
    const file=normalizeFile(finding.file);
    const item={file,line:Number.isInteger(Number(finding.line))&&finding.line!==null&&finding.line!==''?Number(finding.line):null,
      assertion:typeof finding.assertion==='string'&&finding.assertion.trim()?finding.assertion.trim():null,detail:String(finding.detail??'').trim()};
    (files.includes(file)?findings:dropped).push(item);
  }
  // A reject whose every finding pointed outside the diff is no verdict at all: nothing in it can be acted on.
  const verdict=answer.verdict==='reject'&&!findings.length?'unavailable':answer.verdict;
  return {ok:true,schema:VALIDATION,verdict,summary:String(answer.summary??'').trim(),findings,dropped,
    provider:result.provider,attempt:result.attempt,attempts:result.attempts,usage:result.usage,
    ...(verdict==='unavailable'?{reason:'every finding named a file outside the diff'}:{})};
}

/* ------------------------------------------------------------------ the critic of the goal */

/**
 * critiqueGoal: every goal a person writes is challenged before anything is planned from it. The critique is
 * the runtime's own step, not a helper session: one headless call per goal phase, the same call shape as
 * `assessGoal`, answering one closed verdict. `sound` proceeds as written, `revise` proceeds only under the
 * `required` changes - which the kernel renders into the contract of every operation - and `refuse` stops the
 * approval until the one question is answered or the owner overrides it. An objection that names no evidence is
 * dropped here, so a critique can never cost work on the strength of an opinion alone.
 *
 * Beside the verdict the critic answers `overlaps`: one entry per decided record the goal touches, with the
 * case it is - `reference` (the record already holds it, so the work cites it) or `conflict` (it cannot hold
 * together with what that record settled, so the owner decides). That is what turns a critique into a plan: a
 * conflict is rendered for the owner and travels into the intake's contract, a reference is the list of
 * records the intake must cite. What no decided record covers is not an overlap at all, and is left out.
 */
export const CRITIQUE='starci/goal-critique@1';
export const CRITIQUE_VERDICTS=['sound','revise','refuse'];
export const OBJECTION_KINDS=['premise','scope','testability','hidden-decision','consistency'];
/**
 * The two cases the critic can see from the goal text and the decided records. The third case of a
 * reconciliation - `new` - is not an overlap with anything, so it is not the critic's to name: the intake
 * authors it and declares what it reads and what it hands on.
 */
export const OVERLAP_CASES=['reference','conflict'];
/**
 * What only the OWNER can provide for this goal's proofs to be real, named up front from the whole product
 * rather than discovered one stuck operation at a time: a credential or token, a sandbox or test account on an
 * external system, a real dataset or sample, or the legal/consent authority to act on real people or money.
 */
export const PROVISION_KINDS=['credential','account','dataset','authority'];
/** Fable first, Astra as the fallback: the host's supervisor runtimes, overridable by `supervisor.runtimes` in config.json. */
/** Astra first: the critique is one call per goal and Fable's own weekly window is the scarcer one. `critique.runtimes` in config.json overrides it. */
export const DEFAULT_CRITIC_RUNTIMES=['gpt-6-astra','claude-fable-5.1'];
/** What a goal can rest on that the tree may not hold yet: the records the runtime authors first (`srs`, `sds`, `brand`) and the one it cannot (`decision`). */
export const PREREQUISITE_KINDS=['srs','sds','brand','decision'];
export const CRITIQUE_FORM={
  verdict:{type:'string',enum:CRITIQUE_VERDICTS},
  // Objections are read leniently: a model that answers them as sentences, or with a kind outside the closed
  // list, is not sent back for it - the kernel shapes what it can and drops what names no evidence. Two
  // providers in a row failed the strict form on a real goal and the goal went uncritiqued. An objection may
  // carry `decisive`, which only a `hidden-decision` uses: true when the decision the goal takes silently is
  // about money, authority or customer data, and the kernel then plans an owner.ask before the work that
  // touches its feature; false (or absent) when the record repair will settle it when an operation hits it.
  objections:{type:'list',optional:true},
  // What the owner must provide, read as leniently as the objections are: an entry with no known kind or no
  // name is dropped and counted, never a reason to send a whole critique back.
  provisions:{type:'list',optional:true},
  // The overlaps with the decided records, read as leniently as the objections are: an entry that names no
  // record, or a case outside `reference`/`conflict`, is dropped and counted - never a reason to send a whole
  // critique back, because a goal that goes uncritiqued costs more than an overlap the kernel could not shape.
  overlaps:{type:'list',optional:true},
  required:{type:'string[]',optional:true},alternatives:{type:'string[]',optional:true},question:{type:'string',optional:true},
  // A prerequisite of a kind the kernel does not know is dropped, never a reason to send the whole critique back.
  prerequisites:{type:'object[]',optional:true,each:{kind:{type:'string'},feature:{type:'string',optional:true},why:{type:'string'}}}
};
const CRITIC_ROLE='the critic of one workflow goal: your job is to find what is wrong with the goal before anyone works from it - never to restate it, never to praise it';
const CRITIC_RULES=[
  'every objection names its evidence: a record id of the decided records below, a rule statement of one of them, or a fact of the job text - an objection without evidence is dropped by the kernel',
  'challenge the premises: what the goal assumes about the product that the accepted records contradict or do not support',
  'challenge the scope: too wide to finish, too narrow to matter, or one goal that mixes a decision with a build',
  'challenge the testability: what in the goal no check could ever prove, and what would make it provable',
  'name the hidden decisions: what the goal silently decides that the owner should decide as a record. Mark each one `decisive: true` when the decision changes an observable outcome about MONEY (what is charged, paid, refunded, taxed or owed, and to whom), AUTHORITY (who may do or see a thing) or CUSTOMER DATA (what is stored, shown, shared or deleted about a person), and `decisive: false` otherwise - a naming, a shape, an ordering, a default the product can live either way with. A non-decisive hidden decision costs nobody an owner question: the record repair settles it when an operation hits it. A decisive one is put to the owner before the work that touches its feature starts',
  'name the provisions: everything only the OWNER can provide for the proofs of this goal to be real, one entry per thing in `provisions` as `{kind: credential | account | dataset | authority, name, feature, why}`. `credential` is a key, token or secret; `account` is a sandbox or test account on an external system (a payment gateway, a bank, e-invoice, tax, SMS or email, identity, storage); `dataset` is a real sample or export the work must run against (transaction statements, invoices, a customer export); `authority` is legal or consent permission to act for real (messaging real users, charging real cards, touching production data). Read the WHOLE product for these, not the job text alone: name every one the scope of this goal implies from the decided records - an accounting feature that settles transactions implies the gateway sandbox and the statement samples even when the job text never mentions either. A provision you cannot name precisely is still named, with what it is for',
  'offer the alternatives: a cheaper or a safer way to the same outcome, one sentence each',
  'check the consistency with the accepted records and name the record you checked against',
  'the verdict is closed: `sound` proceeds as written, `revise` proceeds only under the changes you list in `required`, `refuse` is for a goal that contradicts an accepted record or that cannot be verified at all - and then `question` is the one question whose answer would unblock it',
  'a goal that adds a feature or a capability to a product with decided records is a reconciliation, never an append: fill `overlaps` with one entry per decided record the goal touches, `{record: <id of a decided record below>, case: reference | conflict, evidence: the statement of that record the goal meets}` - a goal that would only be added beside the decided records, naming none of them, is `revise` with the reconciliation in `required`',
  '`reference` is an overlap the goal repeats: the decided record already holds it, so the work cites that record by its id and restates, re-words or redefines nothing of it',
  '`conflict` is an overlap that cannot hold together with what the decided record settled: it is never overwritten and never averaged, it becomes a decision record stating both sides, the consequences, the numbered options and one recommendation, and the OWNER answers it - never you and never the operation',
  'what no decided record covers is new work, not an overlap: leave it out of `overlaps` entirely - the intake authors it under its own feature and declares what it reads and what it hands on',
  'name the prerequisites: a record the goal builds on that the decided records and the ledger do not hold - the srs or sds of the feature it extends ("add X to the backend" with no record of X), the brand a design needs, a decision nobody took - goes to `prerequisites` with the feature it belongs to and why; the kernel authors those records first and holds the build behind them, so a missing record is a prerequisite, never a reason to refuse',
  'never restate the goal and never praise it: a line that is not a defect is not an objection'
];
/** What this runtime can prove and what it cannot: the critic weighs testability against exactly this. */
export const CRITIQUE_CONSTRAINTS=[
  'the kernel verifies by command only: the checks declared per operation (re-run by the kernel itself), the job gates, and the one validator that reads each diff against the acceptance statements and the node assertions',
  'the kernel cannot verify taste, desirability, market fit, or anything a person has to look at and judge: a goal that rests on one of those is untestable by this runtime unless it names who judges it and on what evidence'
];
const strings=value=>(Array.isArray(value)?value:[]).map(item=>String(item??'').trim()).filter(Boolean);
/** `decisive` read leniently: a boolean, or any of the words a model reaches for when it means "yes, this one". */
const decisiveFlag=value=>value===true||/^(true|yes|y|1|decisive|material|money|authority|customer|customer[- ]?data|owner)$/i.test(String(value??'').trim());
const summarize=list=>(Array.isArray(list)?list:[]).filter(plain).map(item=>({id:item.id??null,kind:item.kind??null,title:item.title??null}));
/**
 * A verdict that costs work must carry something to act on: `revise` and `refuse` need at least one evidenced
 * objection, `revise` the changes the operations must honour, `refuse` the one question that would unblock it.
 */
const critiqueRules=answer=>{
  const errors=[];
  const evidenced=(Array.isArray(answer.objections)?answer.objections:[]).filter(item=>plain(item)&&String(item.evidence??'').trim());
  // A closed-list kind is not demanded of the model: the kernel maps an unknown one, so the list is advice here.
  if(['revise','refuse'].includes(answer.verdict)&&!evidenced.length)
    errors.push(`a ${answer.verdict} must carry at least one objection, and every objection must name its evidence (a record id, a rule statement, a fact of the job text)`);
  if(answer.verdict==='revise'&&!strings(answer.required).length)
    errors.push('a revise must list in `required` the changes every operation of this goal has to honour');
  if(answer.verdict==='refuse'&&!String(answer.question??'').trim())
    errors.push('a refuse must state in `question` the one question whose answer would unblock the goal');
  return {errors};
};

/**
 * The decided records the critic is held to, bounded: at most `maxRecords` records and `maxChars` of statement
 * text across all of them. A goal is critiqued against what the product already accepted, not against the tree.
 */
export function boundRecords(records,{maxRecords=40,maxChars=12000}={}){
  const list=(Array.isArray(records)?records:[]).filter(plain);
  const kept=[];let total=0;
  for(const record of list.slice(0,maxRecords)){
    const statements=[];
    for(const statement of strings(record.statements)){
      if(total+statement.length>maxChars)continue;
      total+=statement.length;statements.push(statement);
    }
    kept.push({id:String(record.id??''),kind:record.kind??null,title:String(record.title??'').trim(),statements});
  }
  return {records:kept,truncated:list.length>kept.length||total>=maxChars};
}

export function critiqueGoal({job,scope=[],ledger=[],decisions=[],records=[],material=[],brand=null,constraints=[],
  providers=DEFAULT_CRITIC_RUNTIMES,cwd,runHeadless:run}){
  need(String(job??'').trim(),'critiqueGoal needs the job text: the goal it is asked to critique');
  const chain=(Array.isArray(providers)?providers:[providers]).filter(item=>typeof item==='string'&&item.trim());
  if(!chain.length)return {ok:false,verdict:'unavailable',reason:'no critic provider was given',attempts:[],usage:null,
    objections:[],dropped:[],overlaps:[],provisions:[],required:[],alternatives:[],question:null,prerequisites:[]};
  const bounded=boundRecords(records);
  const payload={
    job:String(job),
    scope:(Array.isArray(scope)?scope:[scope]).map(item=>String(item??'').trim()).filter(Boolean),
    ledger:summarize(ledger),
    openDecisions:summarize(decisions),
    decidedRecords:bounded.records,
    ...(bounded.truncated?{decidedRecordsTruncated:true}:{}),
    ...(Array.isArray(material)&&material.length?{material}:{}),
    ...(plain(brand)?{brand:{name:brand.name??null,family:brand.family??null,rev:brand.rev??null,file:brand.file??null}}:{}),
    constraints:unique([...CRITIQUE_CONSTRAINTS,...strings(constraints)]),
    rules:CRITIC_RULES
  };
  const result=callFunction({kind:'critiqueGoal',payload,form:CRITIQUE_FORM,providers:chain,cwd,runHeadless:run,
    extra:critiqueRules,role:CRITIC_ROLE});
  if(!result.ok)return {ok:false,verdict:'unavailable',reason:result.reason??'no provider produced a valid critique',
    attempts:result.attempts??[],usage:result.usage??null,objections:[],dropped:[],overlaps:[],provisions:[],required:[],alternatives:[],question:null,prerequisites:[]};
  const answer=result.value;
  const objections=[],dropped=[];
  for(const raw of (Array.isArray(answer.objections)?answer.objections:[])){
    const given=plain(raw)?raw:typeof raw==='string'?{claim:raw}:null;
    if(!given)continue;
    const kind=String(given.kind??'').trim().toLowerCase();
    const item={kind:OBJECTION_KINDS.includes(kind)?kind:'consistency',claim:String(given.claim??given.text??given.objection??'').trim(),
      evidence:String(given.evidence??'').trim(),consequence:String(given.consequence??given.impact??'').trim(),
      // `decisive` is the one thing that turns an objection into an operation: a hidden decision about money,
      // authority or customer data becomes an owner question before the work, anything else is settled by the
      // record repair when an operation hits it. Read leniently - a model that answers "yes" or "money" means true.
      decisive:decisiveFlag(given.decisive??given.material??given.owner)};
    if(!item.claim)continue;
    (item.evidence?objections:dropped).push(item);
  }
  // What only the owner can provide, shaped the way the goal page and `workflow-status` will read it back.
  const provisions=[];let provisionsDropped=0;
  for(const raw of (Array.isArray(answer.provisions)?answer.provisions:[])){
    const given=plain(raw)?raw:null;
    const kind=String(given?.kind??'').trim().toLowerCase();
    const name=String(given?.name??given?.variable??given?.what??'').trim();
    if(!given||!PROVISION_KINDS.includes(kind)||!name){provisionsDropped+=1;continue;}
    provisions.push({kind,name,feature:String(given.feature??given.scope??'').trim()||null,why:String(given.why??given.reason??'').trim()});
  }
  // The overlaps with the decided records, as the three cases the intake will then write as data. An entry
  // that names no record, or a case the runtime does not know, is dropped and counted rather than argued with:
  // the kernel renders a `conflict` for the owner and hands a `reference` to the intake as a record to cite, so
  // an unshaped entry would name work nobody could act on.
  const overlaps=[];let overlapsDropped=0;
  for(const raw of (Array.isArray(answer.overlaps)?answer.overlaps:[])){
    const given=plain(raw)?raw:null;
    const kind=String(given?.case??given?.kind??'').trim().toLowerCase();
    const record=String(given?.record??given?.id??'').trim();
    if(!given||!record||!OVERLAP_CASES.includes(kind)){overlapsDropped+=1;continue;}
    overlaps.push({record,case:kind,evidence:String(given.evidence??given.statement??'').trim()});
  }
  const reasons=[...(dropped.length?[`${dropped.length} objection(s) named no evidence and were dropped by the kernel`]:[]),
    ...(overlapsDropped?[`${overlapsDropped} overlap(s) named no decided record or no known case and were dropped by the kernel`]:[]),
    ...(provisionsDropped?[`${provisionsDropped} provision(s) named no known kind or no name and were dropped by the kernel`]:[])];
  return {ok:true,schema:CRITIQUE,verdict:answer.verdict,objections,dropped,overlaps,provisions,
    ...(overlapsDropped?{overlapsDropped}:{}),...(provisionsDropped?{provisionsDropped}:{}),
    required:strings(answer.required),alternatives:strings(answer.alternatives),
    question:String(answer.question??'').trim()||null,
    prerequisites:(Array.isArray(answer.prerequisites)?answer.prerequisites:[]).filter(plain).map(raw=>({kind:String(raw.kind??'').trim(),
      feature:String(raw.feature??'').trim()||null,why:String(raw.why??'').trim()})).filter(item=>PREREQUISITE_KINDS.includes(item.kind)&&(item.kind==='brand'||item.feature)),
    provider:result.provider,attempt:result.attempt,attempts:result.attempts,usage:result.usage,
    ...(reasons.length?{reason:reasons.join('; ')}:{})};
}
