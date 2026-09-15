import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {CRITIQUE,CRITIQUE_FORM,DECISION_FORM,DEFAULT_CRITIC_RUNTIMES,GOAL_FORM,GOAL_PLAN,MANAGER_DECISION,MANAGER_SNAPSHOT,OVERLAP_CASES,PROVISION_KINDS,VALIDATOR_IO_RULE,VALIDATOR_RULES,assessGoal,boundRecords,callFunction,critiqueGoal,extractCodex,extractMaterial,manageWorkflow,renderGoalMarkdown,usageClaude,usageCodex,usageQwen,validateGoalPlan,validateManagerDecision,validateManagerSnapshot,validateOp} from '../models/functions.mjs';

const op=(id,extra={})=>({id,kind:'backend.implement',goal:`Build ${id}`,ledgerIds:[`L-${id}`],allowlist:[`apps/be/src/${id}`],
  references:['.starciwork/features/sales/sds.md#3'],checks:[{name:'unit',command:'npx vitest run sales'}],acceptance:[`${id} works`],dependsOn:[],...extra});
const ledgerOf=(...ids)=>ids.map(id=>({id:`L-${id}`,title:`Thing ${id}`,inputRef:'bug-report#1',status:'absent'}));
const goalPlan=()=>({definitionOfDone:['Order intake persists an order.'],ledger:ledgerOf('a','b'),ops:[op('a'),op('b')],risks:['Shared registration may be needed.']});
const managerSnapshot=()=>({schema:MANAGER_SNAPSHOT,workflowId:'wf',decisionId:'manager-abc',generation:2,version:3,digest:'digest-3',basisDigest:'basis-3',
  goal:{job:'Finish the approved workflow',definitionOfDone:['All accepted operations are complete.']},progress:{ready:1,blocked:0},
  ops:[{id:'op-a',kind:'backend.implement',status:'ready'}],blockers:[],actions:[{id:'plan-op-a',type:'plan-operation',opId:'op-a',preconditions:['ready:op-a'],summary:'Plan the ready operation',contextRefIds:['ctx-op-a'],modelPreferences:['gpt-6-astra']}],
  contextCatalog:[{id:'ctx-op-a',kind:'operation-contract',digest:'ctx-digest'}],noProgress:{round:0,budget:2}});
const tmp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-llm-functions-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};

test('workflow manager returns only a snapshot-bound executable order and allowlisted context ids',()=>{
  const snapshot=managerSnapshot(),answer={schema:MANAGER_DECISION,workflowId:'wf',decisionId:'manager-abc',generation:2,version:3,digest:'digest-3',basisDigest:'basis-3',orderedActionIds:['plan-op-a'],rationale:'Plan the only ready operation.',contextRequests:[{actionId:'plan-op-a',refIds:['ctx-op-a']}]};
  assert.equal(validateManagerSnapshot(snapshot).ok,true);
  const result=manageWorkflow({snapshot,providers:['gpt-6-astra'],runHeadless:()=>JSON.stringify(answer)});assert.equal(result.ok,true);assert.deepEqual(result.value,answer);
  assert.equal(validateManagerDecision({...answer,digest:'stale'},snapshot).ok,false);
  assert.equal(validateManagerDecision({...answer,orderedActionIds:['invented']},snapshot).ok,false);
  assert.equal(validateManagerDecision({...answer,contextRequests:[{actionId:'plan-op-a',refIds:['raw/path']} ]},snapshot).ok,false);
  assert.equal(validateManagerDecision({...answer,authority:'approved'},snapshot).ok,false,'free-form authority cannot enter the executor contract');
  assert.equal(validateManagerSnapshot({...snapshot,pollTimestamp:Date.now()}).ok,false,'poll metadata cannot change manager identity');
});

test('the goal form is a contract: shape, unique ids, a real dependency order, a covered ledger and disjoint parallel allowlists',()=>{
  const base=goalPlan();
  assert.equal(validateGoalPlan(base).ok,true,JSON.stringify(validateGoalPlan(base).errors));
  assert.match(validateGoalPlan({...base,definitionOfDone:[]}).errors.join(';'),/definitionOfDone needs at least 1/);
  assert.match(validateGoalPlan({...base,ledger:[{...base.ledger[0],status:'maybe'}],ops:[op('a')]}).errors.join(';'),/ledger\[0\]: status must be one of absent, partial, done, unknown/);
  assert.match(validateGoalPlan({...base,ops:[{...op('a'),checks:[]},op('b')]}).errors.join(';'),/ops\[0\]: checks needs at least 1/);

  // unique ids
  assert.match(validateGoalPlan({...base,ledger:ledgerOf('a'),ops:[op('a'),{...op('a'),allowlist:['apps/be/src/other']}]}).errors.join(';'),/op id a is used by 2 ops/);
  // unknown dependsOn
  assert.match(validateGoalPlan({...base,ops:[op('a'),op('b',{dependsOn:['c']})]}).errors.join(';'),/op b depends on c, which is not an op of this plan/);
  // cycle
  const cyclic=validateGoalPlan({...base,ops:[op('a',{dependsOn:['b']}),op('b',{dependsOn:['a']})]});
  assert.equal(cyclic.ok,false);
  assert.match(cyclic.errors.join(';'),/op a is part of a dependency cycle/);
  assert.match(cyclic.errors.join(';'),/op b is part of a dependency cycle/);
  // unreferenced ledger id, unless it is already done
  const orphan=validateGoalPlan({...base,ledger:[...base.ledger,{id:'L-c',title:'Thing c',inputRef:'design#2',status:'partial'}]});
  assert.deepEqual(orphan.errors,['ledger item L-c is partial and no op builds it; reference it from an op or mark it done']);
  assert.equal(validateGoalPlan({...base,ledger:[...base.ledger,{id:'L-c',title:'Thing c',inputRef:'design#2',status:'done'}]}).ok,true);
  assert.match(validateGoalPlan({...base,ops:[op('a'),{...op('b'),ledgerIds:['L-z']}]}).errors.join(';'),/op b claims ledger item L-z, which is not in the ledger/);

  // overlapping allowlists: independent ops cannot share a path prefix, a dependency makes the same paths legal
  const overlap=validateGoalPlan({...base,ops:[{...op('a'),allowlist:['apps/be/src/sales/**']},{...op('b'),allowlist:['apps/be/src/sales/intake.ts']}]});
  assert.equal(overlap.ok,false);
  assert.equal(overlap.errors.length,1);
  assert.match(overlap.errors[0],/ops a and b are independent so they may run in parallel, but their allowlists overlap: apps\/be\/src\/sales\/\*\* and apps\/be\/src\/sales\/intake\.ts/);
  assert.equal(validateGoalPlan({...base,ops:[{...op('a'),allowlist:['apps/be/src/sales/**']},{...op('b'),allowlist:['apps/be/src/sales/intake.ts'],dependsOn:['a']}]}).ok,true);
  // a transitive dependency is still a dependency
  assert.equal(validateGoalPlan({definitionOfDone:['x'],ledger:ledgerOf('a','b','c'),ops:[
    {...op('a'),allowlist:['apps/be/src/sales/**']},op('b',{dependsOn:['a']}),{...op('c'),allowlist:['apps/be/src/sales/intake.ts'],dependsOn:['b']}]}).ok,true);
});

test('assessGoal skips a rate-limited provider without retrying it and schemas the plan the next provider fills',()=>{
  const seen=[];
  const result=assessGoal({job:'Fix the order intake bug.',inputs:[{kind:'bug-report',ref:'BUG-12',summary:'Intake drops the receipt.'}],
    material:[{file:'bug.md',text:'steps',truncated:false}],constraints:['no schema change'],providers:['claude-opus','claude-fable-5.1'],
    runHeadless:(provider,prompt)=>{
      seen.push(provider);
      assert.match(prompt,/Function: assessGoal/);
      assert.match(prompt,/acceptance statements are verified one by one by a verify op/);
      if(provider==='claude-opus')throw Error('rate-limited: claude-opus refused with a quota signal: 429 too many requests');
      return `Here is the plan:\n\`\`\`json\n${JSON.stringify(goalPlan())}\n\`\`\``;
    }});
  assert.equal(result.ok,true);
  assert.equal(result.provider,'claude-fable-5.1');
  assert.equal(result.attempt,0);
  assert.deepEqual(seen,['claude-opus','claude-fable-5.1']);
  assert.deepEqual(result.attempts,[{provider:'claude-opus',attempt:0,errors:['rate-limited']}]);
  assert.equal(result.value.schema,GOAL_PLAN);
});

test('a plan that breaks a cross-field rule is returned to the model with both op ids named',()=>{
  const bad={...goalPlan(),ops:[{...op('a'),allowlist:['apps/be/src/sales/**']},{...op('b'),allowlist:['apps/be/src/sales/intake.ts']}]};
  const answers=[JSON.stringify(bad),JSON.stringify(goalPlan())];
  const prompts=[];
  const result=assessGoal({job:'Build intake.',providers:['claude-opus'],runHeadless:(provider,prompt)=>{prompts.push(prompt);return answers.shift();}});
  assert.equal(result.ok,true);
  assert.equal(result.attempt,1);
  assert.equal(result.attempts.length,1);
  assert.match(result.attempts[0].errors.join(';'),/ops a and b are independent/);
  assert.match(prompts[1],/Your previous answer was invalid: ops a and b are independent/);
});

test('assessGoal receives the complete nested form before its first answer and again on a shape retry',()=>{
  const incomplete={definitionOfDone:['The stack is reproducible.'],ledger:[{id:'stack'}],ops:[{id:'prepare'}]};
  const prompts=[],answers=[JSON.stringify(incomplete),JSON.stringify(goalPlan())];
  const result=assessGoal({job:'Prepare an application stack.',providers:['gpt-6-astra'],runHeadless:(_provider,prompt)=>{prompts.push(prompt);return answers.shift();}});
  assert.equal(result.ok,true);
  assert.equal(result.attempt,1);
  assert.equal(prompts.length,2);
  for(const prompt of prompts){
    assert.match(prompt,/Complete recursive form contract:/);
    assert.match(prompt,/"ledger".*"each":\{"id":\{"type":"string"\},"title":\{"type":"string"\},"inputRef":\{"type":"string"\},"status":\{"type":"string","enum":\["absent","partial","done","unknown"\]\}\}/);
    assert.match(prompt,/"ops".*"kind":\{"type":"string"\}.*"checks":\{"type":"object\[\]","minItems":1,"each":\{"name":\{"type":"string"\},"command":\{"type":"string"\}\}\}.*"dependsOn":\{"type":"string\[\]"\}/);
    assert.match(prompt,/Every field is required unless its rule says optional:true/);
  }
  assert.match(prompts[1],/ledger\[0\]: missing title/);
  assert.match(prompts[1],/ops\[0\]: missing kind/);
});

test('the approval page is deterministic markdown: job, numbered definition of done, ledger and ops tables, risks',()=>{
  const plan={...goalPlan(),ops:[op('a'),op('b',{dependsOn:['a']})],questions:['Which gateway owns the receipt?']};
  const rendered=renderGoalMarkdown(plan,{job:'Fix the order intake bug.'});
  assert.equal(rendered,renderGoalMarkdown(plan,{job:'Fix the order intake bug.'}));
  assert.match(rendered,/^# Goal\n\nFix the order intake bug\.\n/);
  assert.match(rendered,/## Definition of done\n\n1\. Order intake persists an order\./);
  assert.match(rendered,/## Ledger\n\n\| id \| title \| input \| status \|\n\| --- \| --- \| --- \| --- \|\n\| L-a \| Thing a \| bug-report#1 \| absent \|/);
  assert.match(rendered,/## Ops\n\n\| id \| kind \| ledger ids \| allowlist \| depends on \|/);
  assert.match(rendered,/\| a \| backend\.implement \| L-a \| apps\/be\/src\/a \| — \|/);
  assert.match(rendered,/\| b \| backend\.implement \| L-b \| apps\/be\/src\/b \| a \|/);
  assert.match(rendered,/## Risks\n\n- Shared registration may be needed\./);
  assert.match(rendered,/## Questions\n\n- Which gateway owns the receipt\?\n$/);
  assert.doesNotMatch(renderGoalMarkdown(goalPlan(),{job:'x'}),/## Questions/);
  // a pipe in the content cannot break the table, and a multi-line title folds into one cell
  const piped=renderGoalMarkdown({...goalPlan(),ledger:[{id:'L-a',title:'a | b\n  c',inputRef:'r',status:'absent'}],ops:[op('a')]},{job:'x'});
  assert.match(piped,/\| L-a \| a \\\| b c \| r \| absent \|/);
});

test('extractMaterial reads relative to cwd, skips what is missing and caps the whole payload',t=>{
  const dir=tmp(t);
  fs.writeFileSync(path.join(dir,'one.md'),'a'.repeat(30));
  fs.mkdirSync(path.join(dir,'nested'));
  fs.writeFileSync(path.join(dir,'nested','two.md'),'b'.repeat(30));
  const whole=extractMaterial(['one.md','missing.md','nested/two.md'],{cwd:dir});
  assert.deepEqual(whole.map(part=>[part.file,part.text.length,part.truncated]),[['one.md',30,false],['nested/two.md',30,false]]);
  const capped=extractMaterial(['one.md','nested/two.md'],{cwd:dir,maxChars:40});
  assert.deepEqual(capped.map(part=>[part.file,part.text.length,part.truncated]),[['one.md',30,false],['nested/two.md',10,true]]);
  assert.equal(capped.reduce((total,part)=>total+part.text.length,0),40);
  assert.deepEqual(extractMaterial(['nested'],{cwd:dir}),[]);
  assert.deepEqual(extractMaterial(undefined,{cwd:dir}),[]);
});

test('extractCodex returns the last assistant message of a JSONL stream and falls back to the last line',()=>{
  const stream=[
    '{"type":"thread.started","thread_id":"t1"}',
    '{"type":"item.completed","item":{"type":"user_message","text":"fill the form"}}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"thinking out loud"}}',
    '{"type":"assistant_message","content":[{"type":"output_text","text":"{\\"a\\":1}"}]}',
    'not json at all',
    '{"type":"turn.completed","usage":{"input_tokens":10}}'
  ].join('\n');
  assert.equal(extractCodex(stream),'{"a":1}');
  assert.equal(extractCodex('{"type":"item.completed","item":{"type":"agent_message","text":"only one"}}\n'),'only one');
  assert.equal(extractCodex('{"type":"turn.completed"}\n{"odd":"shape"}'),'{"odd":"shape"}');
  assert.equal(extractCodex(''),'');
});

test('each provider envelope is read for what the call cost, and nothing is invented when it reports none',()=>{
  // Claude: one envelope with `usage` and the priced total. Cache reads and writes are billed as input.
  const claude=JSON.stringify({type:'result',is_error:false,result:'{"option":"a"}',
    usage:{input_tokens:120,output_tokens:30,cache_read_input_tokens:400,cache_creation_input_tokens:100},total_cost_usd:0.0123});
  assert.deepEqual(usageClaude(claude),{input:620,output:30,total:650,cost:0.0123});
  assert.equal(usageClaude(JSON.stringify({type:'result',result:'{}'})),null);
  assert.equal(usageClaude('not json'),null);

  // Qwen: a final `stats` tree with one token block per model, or a per-event `usage`, or neither.
  const qwenStats=JSON.stringify([{type:'result',result:'{"a":1}'},
    {type:'stats',stats:{models:{'qwen3.8-flash':{api:{totalRequests:3},tokens:{prompt:200,candidates:50,total:250,cached:0}}},tools:{totalCalls:4}}}]);
  assert.deepEqual(usageQwen(qwenStats),{input:200,output:50,total:250,cost:null});
  assert.deepEqual(usageQwen(JSON.stringify([{type:'result',result:'x',usage:{input_tokens:10,output_tokens:2}}])),{input:10,output:2,total:12,cost:null});
  assert.equal(usageQwen(JSON.stringify([{type:'result',result:'x'}])),null);
  assert.equal(usageQwen('not json'),null);

  // Codex: `token_count` carries a cumulative total, so the last one wins; per-turn `usage` events are summed.
  const codexCounts=[
    '{"type":"token_count","info":{"total_token_usage":{"input_tokens":900,"output_tokens":120,"total_tokens":1020},"last_token_usage":{"input_tokens":100,"output_tokens":20}}}',
    '{"type":"token_count","info":{"total_token_usage":{"input_tokens":1800,"output_tokens":240,"total_tokens":2040},"last_token_usage":{"input_tokens":900,"output_tokens":120}}}'
  ].join('\n');
  assert.deepEqual(usageCodex(codexCounts),{input:1800,output:240,total:2040,cost:null});
  assert.deepEqual(usageCodex('{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}\n{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}'),
    {input:20,output:10,total:30,cost:null});
  assert.equal(usageCodex('{"type":"thread.started","thread_id":"t1"}\nnot json'),null);
  assert.equal(usageCodex(''),null);
});

test('a call charges every attempt it paid for, and a plain string runner simply has no usage to charge',()=>{
  const form={...DECISION_FORM,option:{type:'string',enum:['a']}};
  const answers=[{text:'{}',usage:{input:10,output:2,total:12,cost:null}},
    {text:JSON.stringify({option:'a',rationale:'because'}),usage:{input:20,output:5,total:25,cost:0.01}}];
  const charged=callFunction({kind:'decide',payload:{},form,providers:['claude-opus'],runHeadless:()=>answers.shift()});
  assert.equal(charged.ok,true);
  assert.equal(charged.attempt,1);
  // The invalid first try is paid for too: the kernel charges the runtime the whole call, not only its last try.
  assert.deepEqual(charged.usage,{input:30,output:7,total:37,cost:0.01});
  // An exhausted chain still reports what it spent, so a failed call is not a free call.
  const failed=callFunction({kind:'decide',payload:{},form,providers:['claude-opus'],retries:0,
    runHeadless:()=>({text:'{}',usage:{input:4,output:1,total:5,cost:null}})});
  assert.equal(failed.ok,false);
  assert.deepEqual(failed.usage,{input:4,output:1,total:5,cost:null});
  assert.equal(callFunction({kind:'decide',payload:{},form,providers:['claude-opus'],runHeadless:()=>JSON.stringify({option:'a',rationale:'r'})}).usage,null);
});

test('the goal-plan schema file documents the form the runtime validates',()=>{
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/goal-plan.yaml',import.meta.url),'utf8'));
  assert.equal(schema.describes,GOAL_PLAN);
  assert.equal(schema.module,'models/functions.mjs');
  for(const key of Object.keys(GOAL_FORM))assert.ok(key in schema.fields,`schemas/goal-plan.yaml does not document ${key}`);
  assert.ok(schema.rules.some(rule=>/disjoint/.test(rule)));
});

test('validateOp frames the op, the diff, the checks and the memory; drops a finding outside the diff; and is unavailable on garbage or a closed chain',()=>{
  const prompts=[];
  const op={id:'op-intake',kind:'backend.implement',goal:'Implement intake.',acceptance:['intake persists'],allowlist:['apps/be/src/intake.ts'],attempt:2};
  const diff={files:['apps/be/src/intake.ts','apps/be/src/intake.spec.ts'],text:"diff --git a/apps/be/src/intake.ts b/apps/be/src/intake.ts\n+export const intake=1;\n",truncated:true};
  const call=(answers,extra={})=>validateOp({op,node:{id:'demo.intake',description:'Persist an order.',assertions:['unit-tests-pass']},diff,
    checks:[{name:'unit',command:'npx vitest run intake',exitCode:0,evidence:'1 passed'}],references:['sds.md#3'],memory:'- op-catalog | accept | catalog persisted',
    providers:['gpt-5.6-sol','claude-opus'],runHeadless:(provider,prompt)=>{prompts.push([provider,prompt]);const next=answers.shift();if(next instanceof Error)throw next;return next;},...extra});
  const accepted=call([JSON.stringify({verdict:'accept',summary:'The diff persists the order and the spec proves it.'})]);
  assert.equal(accepted.ok,true);assert.equal(accepted.verdict,'accept');assert.equal(accepted.provider,'gpt-5.6-sol');
  assert.equal(accepted.summary,'The diff persists the order and the spec proves it.');
  assert.deepEqual(accepted.findings,[]);assert.deepEqual(accepted.dropped,[]);
  const prompt=prompts[0][1];
  assert.match(prompt,/^You are the acceptance validator of one StarCi workflow/);
  assert.match(prompt,/Function: validateOp\. Required keys and types: .*"verdict":"string in accept\|reject"/);
  for(const needle of ['- op-catalog | accept | catalog persisted','+export const intake=1;','"truncated": true','unit-tests-pass','Persist an order.','"exitCode": 0','1 passed','sds.md#3','intake persists','"attempt": 2','every finding must name a file of the diff'])
    assert.ok(prompt.includes(needle),`the prompt carries ${needle}`);

  // A reject keeps the finding inside the diff (path folded) and drops the one outside; the verdict stands.
  const rejected=call([JSON.stringify({verdict:'reject',summary:'The spec proves nothing.',findings:[
    {file:'./apps/be/src/intake.ts',line:'12',assertion:'unit-tests-pass',detail:'the spec asserts nothing'},{file:'apps/be/src/receipt.ts',detail:'the receipt is not in the diff'}]})]);
  assert.equal(rejected.verdict,'reject');
  assert.deepEqual(rejected.findings,[{file:'apps/be/src/intake.ts',line:12,assertion:'unit-tests-pass',detail:'the spec asserts nothing'}]);
  assert.deepEqual(rejected.dropped,[{file:'apps/be/src/receipt.ts',line:null,assertion:null,detail:'the receipt is not in the diff'}]);
  // A reject with no finding at all is an invalid form: the provider is asked once more, then the answer stands.
  prompts.length=0;
  const corrected=call([JSON.stringify({verdict:'reject',summary:'no'}),JSON.stringify({verdict:'accept',summary:'fine after all'})]);
  assert.equal(corrected.verdict,'accept');assert.equal(corrected.attempt,1);
  assert.match(prompts[1][1],/Your previous answer was invalid: a reject must carry at least one finding/);
  // Every finding outside the diff: nothing actionable, so it is unavailable rather than a reject or an accept.
  const outside=call([JSON.stringify({verdict:'reject',summary:'x',findings:[{file:'apps/be/src/receipt.ts',detail:'no'}]})]);
  assert.equal(outside.ok,true);assert.equal(outside.verdict,'unavailable');assert.match(outside.reason,/outside the diff/);
  assert.equal(outside.dropped.length,1);
  // Garbage twice on the first provider, a crash on the second: unavailable, with the attempts on record.
  const garbage=call(['nonsense','still nonsense',Error('claude-opus headless exited 1: boom')]);
  assert.equal(garbage.ok,false);assert.equal(garbage.verdict,'unavailable');
  assert.deepEqual(garbage.attempts.map(item=>[item.provider,item.attempt]),[['gpt-5.6-sol',0],['gpt-5.6-sol',1],['claude-opus',0]]);
  // Cooling providers are skipped, not paid for; an empty chain is unavailable without a call.
  prompts.length=0;
  const fallback=call([JSON.stringify({verdict:'accept',summary:'ok'})],{skip:['gpt-5.6-sol']});
  assert.equal(fallback.provider,'claude-opus');assert.deepEqual(prompts.map(item=>item[0]),['claude-opus']);
  const closed=call([],{skip:['gpt-5.6-sol','claude-opus']});
  assert.equal(closed.ok,false);assert.equal(closed.verdict,'unavailable');assert.match(closed.reason,/every validator provider is unavailable/);
  assert.equal(prompts.length,1,'no provider was called for a closed chain');
});

/**
 * The rule that answers the four chatbot nodes of 2026-09-13: a prove operation may still fake an outside
 * provider, but only where the contract allows it and only when the evidence names it. The rule travels in
 * the payload of every verdict, so neither kind can be judged without it.
 */
test('validateOp carries the rule that an integration is proven live or it is not proven',()=>{
  const prompts=[];
  const op={id:'op-telegram',kind:'integration.verify',goal:'Prove the Telegram delivery live.',
    acceptance:['a message reaches the sandbox chat'],allowlist:['src/tests/integration/telegram.live-spec.ts'],attempt:1};
  validateOp({op,diff:{files:['src/tests/integration/telegram.live-spec.ts'],text:'+const token=process.env.TELEGRAM_BOT_TOKEN;\n',truncated:false},
    checks:[],references:['features/sales/integration/telegram/index.yaml'],providers:['gpt-5.6-sol'],
    runHeadless:(provider,prompt)=>{prompts.push(prompt);return JSON.stringify({verdict:'accept',summary:'the run reached the sandbox'});}});
  for(const rule of ['an external integration is proven live or it is not proven',
    'whose scenario fakes, stubs, mocks, records, replays or skips the declared provider',
    'reads the credential from anywhere but the identity custody the declaration names',
    'prints, logs or commits a secret value, is a defect',
    'an `e2e.verify` evidence whose `proof.fakes` omits a provider the diff fakes is a defect'])
    assert.ok(prompts[0].includes(rule),`the rules bind the integration: ${rule}`);
});

/**
 * The brand travels with every verdict, as data beside the diff and as rules the validator is held to: a colour,
 * a font, an icon, a forbidden element or an artwork slot outside the record is a defect, not a preference.
 */
test('validateOp carries the brand record into the prompt, with the rules that make it binding, and omits it when the tree has none',()=>{
  const prompts=[];
  const op={id:'op-cart',kind:'frontend.implement',goal:'Build the cart surface.',acceptance:['the cart renders'],allowlist:['apps/web/src/cart/index.tsx'],attempt:1};
  const diff={files:['apps/web/src/cart/index.tsx'],text:'diff --git a/apps/web/src/cart/index.tsx b/apps/web/src/cart/index.tsx\n+const ink="#fff";\n',truncated:false};
  const brand={name:'Aurora',family:'aurora',rev:4,
    colorTokens:{'--brand-ink':{value:'oklch(0.21 0.01 275)',role:'text'}},
    mascotAssets:['brand/assets/mascot-front.png'],forbidden:['the bare word white inside a style tag'],
    imageryPromptRules:['every imagery prompt names the mascot sheet']};
  const call=(extra={})=>validateOp({op,diff,checks:[],references:['brand/index.yaml'],
    providers:['gpt-5.6-sol'],runHeadless:(provider,prompt)=>{prompts.push(prompt);return JSON.stringify({verdict:'accept',summary:'inside the brand'});},...extra});
  call({brand});
  const prompt=prompts[0];
  for(const needle of ['"name": "Aurora"','"rev": 4','--brand-ink','"role": "text"','brand/assets/mascot-front.png',
    'the bare word white inside a style tag','every imagery prompt names the mascot sheet'])
    assert.ok(prompt.includes(needle),`the prompt carries ${needle}`);
  for(const rule of ['when a `brand` record is given it is binding',
    'outside the brand colour tokens (each with the role the record gives it) and the installed grammar is a defect',
    'the markup kept beside each candidate as `<candidate>.html` is the render\'s source and is what the candidate is judged from',
    'a list of entities wrapped in a card surface is a defect (a collection is a page section with a heading, a card is one item)',
    'as is a palette outside the brand colour tokens and the grammar\'s own',
    'an interface.asset result is the artwork of the slots the design record declared',
    'artwork that ignores the brand mascot and logo references the record names, is a defect',
    'a frontend.implement result that substitutes its own image for a declared artwork slot, or omits a declared slot altogether, is a defect'])
    assert.ok(prompt.includes(rule),`the rules bind the brand: ${rule}`);
  // A tree with no brand record sends no brand key at all: an empty one would read as "the brand allows nothing".
  prompts.length=0;
  call();
  assert.doesNotMatch(prompts[0],/"brand"/);
  assert.match(prompts[0],/when a `brand` record is given it is binding/,'the rule still says what happens when there is one');
});

/**
 * An operation's kind declares which record kinds it may read and which it may produce. When the kernel hands
 * that declaration over, it becomes a rule the validator is held to instead of a feeling about scope; when it
 * does not, neither the data nor the rule is in the prompt, so no operation is judged against a declaration
 * nobody gave it.
 */
test('validateOp carries the declared reads and writes of the kind, with the rule that makes them binding, and omits both when none is given',()=>{
  const prompts=[];
  const op={id:'op-draw',kind:'interface.draw',goal:'Draw the cart.',acceptance:['the cart is drawn'],allowlist:['features/sales/ui/cart/index.yaml'],attempt:1};
  const diff={files:['features/sales/ui/cart/index.yaml'],text:'diff --git a/features/sales/ui/cart/index.yaml b/features/sales/ui/cart/index.yaml\n+screens: []\n',truncated:false};
  const call=extra=>validateOp({op,diff,checks:[],references:[],providers:['gpt-5.6-sol'],
    runHeadless:(provider,prompt)=>{prompts.push(prompt);return JSON.stringify({verdict:'accept',summary:'inside the declaration'});},...extra});
  call({io:{reads:['srs','sds','brand','grammar','design','srs'],writes:['design']}});
  const prompt=prompts[0];
  assert.match(prompt,/"io": \{/);
  // The record kinds travel as data, deduplicated, exactly as the kind declares them.
  assert.match(prompt,/"reads": \[\s*"srs",\s*"sds",\s*"brand",\s*"grammar",\s*"design"\s*\]/);
  assert.match(prompt,/"writes": \[\s*"design"\s*\]/);
  assert.ok(prompt.includes(VALIDATOR_IO_RULE),'the rule that makes the declaration binding travels with it');
  assert.match(VALIDATOR_IO_RULE,/a record cited outside `io\.reads` or written outside `io\.writes` is a defect/);
  // No declaration, no data and no rule: the kind's own contract is the only thing that was given.
  prompts.length=0;
  call();
  assert.doesNotMatch(prompts[0],/"io"/);
  assert.ok(!prompts[0].includes(VALIDATOR_IO_RULE));
});

/**
 * An intake is judged as a reconciliation of three cases, and the mechanical half of it is already done: the
 * kernel checked every id before the validator was called. What is left for a reader is exactly three things,
 * and the rule has to say so, or the validator re-does the kernel's work and misses its own.
 */
test('the intake rule tells the validator what the kernel already checked and what only a reader can judge',()=>{
  const prompts=[];
  const op={id:'op-intake',kind:'work.author',goal:'Author the collab records.',acceptance:['collab is authored'],allowlist:['features/collab/**'],attempt:1};
  validateOp({op,diff:{files:['features/collab/index.yaml'],text:'+case: reference\n',truncated:false},checks:[],
    providers:['gpt-5.6-sol'],runHeadless:(provider,prompt)=>{prompts.push(prompt);return JSON.stringify({verdict:'accept',summary:'reconciled'});}});
  const prompt=prompts[0];
  for(const phrase of ["a reconciliation of three cases - `reference`, `conflict`, `new`",
    "the kernel has ALREADY checked every id of its table",
    "that a referenced one is decided, that each conflict names an open decision record under this feature, and that no decided record was edited",
    "whether a `reference` row's cited record really covers the claim it is cited for",
    "whether a record the table calls `new` restates a decided record in other words",
    "whether a `conflict` row's decision record states both sides, the consequences of each, the numbered options and exactly one recommendation",
    "A record of another feature that this operation edited, and a side of the feature the table leaves out altogether, are defects"])
    assert.ok(prompt.includes(phrase),`the intake rule says: ${phrase}`);
  // The two withdrawn rulings are gone: no sds-gap against another feature's record, no formula anywhere.
  assert.doesNotMatch(prompt,/sds-gap/);
  assert.doesNotMatch(prompt,/A, B \+ C/);
});

/**
 * The critique of a goal is a function like any other: a fixed frame, a closed verdict, a bounded retry. What is
 * particular to it is the price of an objection - it can cost the owner a re-write of the goal - so an objection
 * that names no evidence is dropped, and a verdict that costs work with nothing to act on is not a valid form.
 */
const critiqueCall=(answers,extra={})=>{
  const seen=[];
  const result=critiqueGoal({job:'Make the receipt feel fast.',scope:['sales'],
    ledger:[{id:'demo.sales.implementation.backend.intake',kind:'implementation',title:'Persist an order'}],
    decisions:[{id:'demo.sales.business.srs.policy.refund',kind:'business',title:'Refund window'}],
    records:[{id:'demo.sales.architecture.sds.ledger',kind:'architecture',title:'Ledger component map',
      statements:['Every write to an order goes through the ledger writer.']}],
    constraints:['the ledger is the authored Work tree and is not yours to change'],
    providers:['claude-fable-5.1','gpt-6-astra'],
    runHeadless:(provider,prompt)=>{seen.push([provider,prompt]);const next=answers.shift();if(next instanceof Error)throw next;return next;},
    ...extra});
  return {result,seen};
};

test('critiqueGoal frames the goal against the accepted records, carries its rules and answers one closed verdict',()=>{
  const {result,seen}=critiqueCall([JSON.stringify({verdict:'sound',objections:[],alternatives:[]})]);
  assert.equal(result.ok,true);
  assert.equal(result.schema,CRITIQUE);
  assert.equal(result.verdict,'sound');
  assert.equal(result.provider,'claude-fable-5.1');
  assert.deepEqual([result.objections,result.dropped,result.required,result.alternatives],[[],[],[],[]]);
  assert.equal(result.question,null);
  const prompt=seen[0][1];
  assert.match(prompt,/^You are the critic of one workflow goal: your job is to find what is wrong with the goal before anyone works from it - never to restate it, never to praise it\./);
  assert.match(prompt,/Function: critiqueGoal\. Required keys and types: .*"verdict":"string in sound\|revise\|refuse"/);
  for(const needle of ['Make the receipt feel fast.','"sales"','demo.sales.implementation.backend.intake',
    'demo.sales.business.srs.policy.refund','demo.sales.architecture.sds.ledger',
    'Every write to an order goes through the ledger writer.',
    'the ledger is the authored Work tree and is not yours to change'])
    assert.ok(prompt.includes(needle),`the critique reads ${needle}`);
  for(const rule of ['every objection names its evidence','challenge the premises','challenge the scope',
    'challenge the testability','name the hidden decisions','offer the alternatives',
    'check the consistency with the accepted records and name the record you checked against',
    'never restate the goal and never praise it','the kernel verifies by command only',
    'the kernel cannot verify taste, desirability, market fit'])
    assert.ok(prompt.includes(rule),`the critique is held to: ${rule}`);
  // The verdict is closed: anything outside sound|revise|refuse is an invalid form, not a third answer.
  const open=critiqueCall([JSON.stringify({verdict:'looks-fine',objections:[]}),JSON.stringify({verdict:'sound',objections:[]})]);
  assert.equal(open.result.verdict,'sound');
  assert.equal(open.result.attempt,1);
  assert.match(open.result.attempts[0].errors.join(';'),/verdict must be one of sound, revise, refuse/);
  assert.match(open.seen[1][1],/Your previous answer was invalid: verdict must be one of sound, revise, refuse/);
  // The decided records are bounded before they are framed: 40 records and 12k characters of statements.
  const many=boundRecords(Array.from({length:50},(_,index)=>({id:`r-${index}`,statements:['x'.repeat(400)]})));
  assert.equal(many.records.length,40);
  assert.equal(many.truncated,true);
  assert.equal(many.records.reduce((total,record)=>total+record.statements.join('').length,0)<=12000,true);
  assert.deepEqual(boundRecords([{id:'r',statements:['  one  ','','two']}]),{records:[{id:'r',kind:null,title:'',statements:['one','two']}],truncated:false});
});

test('a critique that costs work must carry something to act on: evidence, required changes, or the one question',()=>{
  const objection=(extra={})=>({kind:'consistency',claim:'The goal writes the order outside the ledger writer',
    evidence:'demo.sales.architecture.sds.ledger',consequence:'Two components would own one write path.',...extra});
  // An objection with no evidence is dropped on the record; the evidenced ones stand and the verdict with them.
  const revised=critiqueCall([JSON.stringify({verdict:'revise',objections:[objection(),
    {kind:'premise',claim:'I would not build it this way',consequence:'none'}],
    required:['name the component that owns the order write'],alternatives:['extend the ledger writer instead']})]);
  assert.equal(revised.result.verdict,'revise');
  assert.deepEqual(revised.result.objections,[{kind:'consistency',claim:'The goal writes the order outside the ledger writer',
    evidence:'demo.sales.architecture.sds.ledger',consequence:'Two components would own one write path.',decisive:false}]);
  assert.deepEqual(revised.result.dropped,[{kind:'premise',claim:'I would not build it this way',evidence:'',consequence:'none',decisive:false}]);
  assert.match(revised.result.reason,/1 objection\(s\) named no evidence and were dropped/);
  assert.deepEqual(revised.result.required,['name the component that owns the order write']);
  // A revise or a refuse with no objection at all, or with no evidenced one, is sent back to the model.
  const empty=critiqueCall([JSON.stringify({verdict:'revise',objections:[],required:['x']}),
    JSON.stringify({verdict:'revise',objections:[objection()],required:['x']})]);
  assert.equal(empty.result.verdict,'revise');
  assert.match(empty.result.attempts[0].errors.join(';'),/a revise must carry at least one objection, and every objection must name its evidence/);
  const unevidenced=critiqueCall([JSON.stringify({verdict:'refuse',objections:[{kind:'scope',claim:'too wide',consequence:'it never finishes'}],question:'which one?'}),
    JSON.stringify({verdict:'sound',objections:[]})]);
  assert.equal(unevidenced.result.verdict,'sound');
  assert.match(unevidenced.result.attempts[0].errors.join(';'),/a refuse must carry at least one objection/);
  // A revise must say what the operations have to honour; a refuse must name the question that would unblock it.
  const silent=critiqueCall([JSON.stringify({verdict:'revise',objections:[objection()]}),JSON.stringify({verdict:'sound',objections:[]})]);
  assert.match(silent.result.attempts[0].errors.join(';'),/a revise must list in `required` the changes every operation of this goal has to honour/);
  const questionless=critiqueCall([JSON.stringify({verdict:'refuse',objections:[objection()]}),JSON.stringify({verdict:'sound',objections:[]})]);
  assert.match(questionless.result.attempts[0].errors.join(';'),/a refuse must state in `question` the one question whose answer would unblock the goal/);
  const refused=critiqueCall([JSON.stringify({verdict:'refuse',objections:[objection()],question:'Which component owns the order write?'})]);
  assert.equal(refused.result.verdict,'refuse');
  assert.equal(refused.result.question,'Which component owns the order write?');
  // The chain is walked in the order the caller gave: one retry per provider, then the next one.
  const fallback=critiqueCall(['nonsense','still nonsense',JSON.stringify({verdict:'sound',objections:[]})]);
  assert.equal(fallback.result.verdict,'sound');
  assert.equal(fallback.result.provider,'gpt-6-astra');
  assert.deepEqual(fallback.seen.map(item=>item[0]),['claude-fable-5.1','claude-fable-5.1','gpt-6-astra']);
  // An exhausted chain is `unavailable` with its attempts on record, exactly as the validator is.
  const exhausted=critiqueCall(['nonsense','nonsense again',Error('gpt-6-astra headless exited 1: boom')]);
  assert.equal(exhausted.result.ok,false);
  assert.equal(exhausted.result.verdict,'unavailable');
  assert.deepEqual(exhausted.result.objections,[]);
  assert.deepEqual(exhausted.result.attempts.map(item=>[item.provider,item.attempt]),
    [['claude-fable-5.1',0],['claude-fable-5.1',1],['gpt-6-astra',0]]);
  // Both validator-pool peers are available to the quota-aware selector; configuration order is not a fallback promise.
  assert.deepEqual(new Set(DEFAULT_CRITIC_RUNTIMES),new Set(['gpt-6-astra','claude-fable-5.1']));
  // Objections written as sentences or with a kind outside the list are shaped, never sent back: the evidenced ones stay.
  const lenient=critiqueCall([JSON.stringify({verdict:'revise',required:['name the record'],objections:['just a sentence',{kind:'security',claim:'The token is read from a file nobody fills',evidence:'delivery.module.ts',consequence:'Delivery silently disabled.'}]})]);
  assert.equal(lenient.result.verdict,'revise');
  assert.deepEqual(lenient.result.objections.map(item=>[item.kind,item.claim]),[['consistency','The token is read from a file nobody fills']]);
  assert.equal(lenient.result.dropped.length,1,'the sentence without evidence was dropped, not fatal');
  // A prerequisite is kept when it names a feature (or is the brand) and has a known kind; anything else is dropped quietly.
  const withPrereqs=critiqueCall([JSON.stringify({verdict:'revise',objections:[objection()],required:['author the chat records first'],
    prerequisites:[{kind:'sds',feature:'chat',why:'the goal extends a module the tree has no architecture record for'},{kind:'brand',why:'the design needs tokens'},{kind:'sds',why:'no feature named'},{kind:'other',feature:'x',why:'unknown kind'}]})]);
  assert.deepEqual(withPrereqs.result.prerequisites,[{kind:'sds',feature:'chat',why:'the goal extends a module the tree has no architecture record for'},{kind:'brand',feature:null,why:'the design needs tokens'}]);
  assert.throws(()=>critiqueGoal({job:'  ',runHeadless:()=>'{}'}),/critiqueGoal needs the job text/);
  assert.equal(critiqueGoal({job:'x',providers:[],runHeadless:()=>'{}'}).verdict,'unavailable');
});

/**
 * The owner's ruling of 2026-09-14, seen from the critic's side. A hidden decision is not one thing: a naming,
 * a shape or a default is settled by the record repair when an operation hits it and costs nobody a question,
 * while a decision about money, authority or customer data is the owner's and is put to them before the work.
 * The critic is what tells those two apart, so `decisive` travels on the objection.
 */
test('a hidden decision says whether it is decisive, and the critic names what only the owner can provide',()=>{
  const hidden=(extra={})=>({kind:'hidden-decision',claim:'The goal picks who may refund an order',
    evidence:'demo.sales.business.srs.policy.refund',consequence:'A support agent could refund without a manager.',...extra});
  const decisive=critiqueCall([JSON.stringify({verdict:'revise',required:['name who may refund'],
    objections:[hidden({decisive:true}),
      // Not decisive: a naming the product can live either way with, settled by the record repair when it is hit.
      {kind:'hidden-decision',claim:'The goal names the endpoint /orders/refund',evidence:'demo.sales.architecture.sds.ledger',
        consequence:'Two spellings of one route.',decisive:false}]})]);
  assert.deepEqual(decisive.result.objections.map(item=>[item.kind,item.decisive]),[['hidden-decision',true],['hidden-decision',false]]);
  // `decisive` is read as leniently as everything else: a model that answers a word instead of a boolean means it.
  for(const answer of [true,'yes','TRUE','money','authority','customer-data'])
    assert.equal(critiqueCall([JSON.stringify({verdict:'revise',required:['x'],objections:[hidden({decisive:answer})]})]).result.objections[0].decisive,true,String(answer));
  for(const answer of [false,'no','',null,undefined,'maybe'])
    assert.equal(critiqueCall([JSON.stringify({verdict:'revise',required:['x'],objections:[hidden({decisive:answer})]})]).result.objections[0].decisive,false,String(answer));
  // The rule the critic is held to names the three things that make a decision the owner's.
  const {seen}=critiqueCall([JSON.stringify({verdict:'sound',objections:[]})]);
  const prompt=seen[0][1];
  for(const needle of ['`decisive: true`','MONEY','AUTHORITY','CUSTOMER DATA','the record repair settles it',
    'name the provisions','credential | account | dataset | authority','Read the WHOLE product for these'])
    assert.ok(prompt.includes(needle),`the critic is told: ${needle}`);

  // The provisions: everything only the owner can provide for the proofs of this goal to be real.
  assert.deepEqual(PROVISION_KINDS,['credential','account','dataset','authority']);
  assert.equal(CRITIQUE_FORM.provisions.type,'list','provisions are read as leniently as the objections are');
  assert.equal(CRITIQUE_FORM.provisions.optional,true);
  const provided=critiqueCall([JSON.stringify({verdict:'sound',objections:[],provisions:[
    {kind:'credential',name:'VNPAY_SANDBOX_SECRET',feature:'payments',why:'no live charge can be proven without it'},
    {kind:'account',name:'VNPay sandbox merchant',feature:'payments',why:'the gateway will not answer without one'},
    {kind:'dataset',name:'three real bank statements',feature:'accounting',why:'reconciliation cannot be proven on invented rows'},
    {kind:'authority',name:'consent to message real users',feature:'chat',why:'a live send touches real people'},
    // Dropped and counted: an unknown kind, an entry with no name, a bare sentence.
    {kind:'vibes',name:'x',why:'no'},{kind:'credential',why:'nameless'},'the gateway key'
  ]})]);
  assert.deepEqual(provided.result.provisions.map(item=>[item.kind,item.name,item.feature]),
    [['credential','VNPAY_SANDBOX_SECRET','payments'],['account','VNPay sandbox merchant','payments'],
      ['dataset','three real bank statements','accounting'],['authority','consent to message real users','chat']]);
  assert.equal(provided.result.provisionsDropped,3);
  assert.match(provided.result.reason,/3 provision\(s\) named no known kind or no name and were dropped/);
  // A critique that answers none is simply a goal that needs nothing of the owner, never a form error.
  assert.deepEqual(critiqueCall([JSON.stringify({verdict:'sound',objections:[]})]).result.provisions,[]);
  assert.deepEqual(critiqueGoal({job:'x',providers:[],runHeadless:()=>'{}'}).provisions,[]);

  // And the validator holds the record repair to the log it must leave and to the decision it may not take alone.
  const rules=VALIDATOR_RULES.join('\n');
  assert.match(rules,/EXACTLY ONE new `extensions\.work3\.decisionLog` entry/);
  assert.match(rules,/A changed record with no entry, a bumped rev with no changed passage, a second entry, or an earlier entry rewritten or deleted\s+is a defect/);
  assert.match(rules,/may not settle one about money, authority or customer data silently/);
  assert.match(rules,/names no decision record with numbered options and one recommendation, is a defect/);
});

/**
 * A goal that adds to a product with decided records is a reconciliation, and the critic is where the runtime
 * first sees it. It answers the two cases it can see from the goal text - `reference` and `conflict` - and the
 * three of them are stated as rules instead of as the formula the owner once used to explain the thinking.
 */
test('the critic answers the overlaps with the decided records as the three cases, and the formula is gone',()=>{
  assert.deepEqual(OVERLAP_CASES,['reference','conflict']);
  assert.equal(CRITIQUE_FORM.overlaps.type,'list','overlaps is read as leniently as the objections are');
  assert.equal(CRITIQUE_FORM.overlaps.optional,true);
  const objection={kind:'consistency',claim:'The goal writes the order outside the ledger writer',
    evidence:'demo.sales.architecture.sds.ledger',consequence:'Two components would own one write path.'};
  const {result,seen}=critiqueCall([JSON.stringify({verdict:'revise',objections:[objection],required:['reconcile against the sales records'],
    overlaps:[
      {record:'demo.sales.business.srs.policy.refund',case:'reference',evidence:'the refund window is already decided there'},
      {record:'demo.sales.architecture.sds.ledger',case:'CONFLICT',evidence:'collab needs an asynchronous write'},
      // Dropped and counted: a case the runtime does not know, an entry that names no record, a bare sentence.
      {record:'demo.sales.business.srs.policy.refund',case:'new',evidence:'nothing decided covers it'},
      {case:'reference',evidence:'some record somewhere'},
      'the refund policy is related'
    ]})]);
  assert.equal(result.verdict,'revise');
  assert.deepEqual(result.overlaps,[
    {record:'demo.sales.business.srs.policy.refund',case:'reference',evidence:'the refund window is already decided there'},
    {record:'demo.sales.architecture.sds.ledger',case:'conflict',evidence:'collab needs an asynchronous write'}]);
  assert.equal(result.overlapsDropped,3);
  assert.match(result.reason,/3 overlap\(s\) named no decided record or no known case and were dropped by the kernel/);
  // The rules that replaced the formula: the three cases, and the instruction to fill `overlaps` with them.
  const prompt=seen[0][1];
  for(const rule of ['fill `overlaps` with one entry per decided record the goal touches',
    '{record: <id of a decided record below>, case: reference | conflict, evidence: the statement of that record the goal meets}',
    '`reference` is an overlap the goal repeats',
    'cites that record by its id and restates, re-words or redefines nothing of it',
    '`conflict` is an overlap that cannot hold together with what the decided record settled',
    'it is never overwritten and never averaged',
    'the OWNER answers it - never you and never the operation',
    'what no decided record covers is new work, not an overlap: leave it out of `overlaps` entirely'])
    assert.ok(prompt.includes(rule),`the critic is held to: ${rule}`);
  assert.doesNotMatch(prompt,/A, B \+ C/,'the illustrative formula is not runtime content');
  assert.doesNotMatch(prompt,/=> A'/);
  // A critique that names no overlap at all answers an empty list, and says nothing about dropping any.
  const none=critiqueCall([JSON.stringify({verdict:'sound',objections:[]})]);
  assert.deepEqual(none.result.overlaps,[]);
  assert.equal(none.result.overlapsDropped,undefined);
  assert.equal(none.result.reason,undefined);
  // An unavailable critique still answers the shape, so the kernel never reads `overlaps` off undefined.
  assert.deepEqual(critiqueGoal({job:'x',providers:[],runHeadless:()=>'{}'}).overlaps,[]);
  assert.deepEqual(critiqueCall(['nonsense','nonsense',Error('gpt-6-astra headless exited 1')]).result.overlaps,[]);
});
