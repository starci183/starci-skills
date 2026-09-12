import {spawnSync} from 'node:child_process';

/**
 * Model calls as functions: a fixed prompt frame, a required JSON schema, a headless provider command,
 * validation and a bounded retry. The model never sees the control loop; it fills a form.
 */
export const PLAN_OP='starci/op-plan@1';
export const DECISION='starci/decision@1';
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};

/** Headless provider commands. The prompt goes on stdin; the JSON answer is extracted from the provider's own envelope. */
export const HEADLESS_PROVIDERS={
  'claude-opus':{command:['claude','-p','--output-format','json','--model','opus'],extract:extractClaude},
  'claude-fable-5.1':{command:['claude','-p','--output-format','json','--model','claude-fable-5-1'],extract:extractClaude},
  'qwen3.8-flash':{command:['qwen','--model','qwen3.8-flash','--approval-mode','yolo','--output-format','json','--exclude-tools','agent'],extract:extractQwen}
};
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
  need(result.status===0,`${provider} headless exited ${result.status}: ${(result.stderr??'').slice(-400)}`);
  return spec.extract(result.stdout);
}

/** Call a model function over a provider chain with validation and one retry per provider. */
export function callFunction({kind,payload,form,providers,cwd,runHeadless:run=runHeadless,retries=1}){
  const attempts=[];
  for(const provider of providers){
    for(let attempt=0;attempt<=retries;attempt+=1){
      let answer;
      try{answer=run(provider,frame(kind,payload,form)+(attempt?`\nYour previous answer was invalid: ${attempts.at(-1).errors.join('; ')}. Answer again with the full JSON object.`:''),{cwd});}
      catch(error){attempts.push({provider,attempt,errors:[error.message]});break;}
      let parsed;
      try{parsed=extractJson(answer);}catch(error){attempts.push({provider,attempt,errors:[error.message]});continue;}
      const checked=validateForm(parsed,form);
      if(checked.ok)return {ok:true,provider,attempt,value:parsed,attempts};
      attempts.push({provider,attempt,errors:checked.errors});
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

/** decide: choose one option of a closed set for a crisis the policy table could not settle. */
export function decide({situation,options,context={},providers=['claude-fable-5.1','claude-opus'],cwd,runHeadless:run}){
  const form={...DECISION_FORM,option:{type:'string',enum:options}};
  const result=callFunction({kind:'decide',payload:{situation,options,context},form,providers,cwd,runHeadless:run});
  if(result.ok)result.value.schema=DECISION;
  return result;
}
