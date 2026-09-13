import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {CRITIQUE,DECISION_FORM,DEFAULT_CRITIC_RUNTIMES,GOAL_FORM,GOAL_PLAN,assessGoal,boundRecords,callFunction,critiqueGoal,extractCodex,extractMaterial,renderGoalMarkdown,usageClaude,usageCodex,usageQwen,validateGoalPlan,validateOp} from '../models/functions.mjs';

const op=(id,extra={})=>({id,kind:'backend.implement',goal:`Build ${id}`,ledgerIds:[`L-${id}`],allowlist:[`apps/be/src/${id}`],
  references:['.starciwork/features/sales/sds.md#3'],checks:[{name:'unit',command:'npx vitest run sales'}],acceptance:[`${id} works`],dependsOn:[],...extra});
const ledgerOf=(...ids)=>ids.map(id=>({id:`L-${id}`,title:`Thing ${id}`,inputRef:'bug-report#1',status:'absent'}));
const goalPlan=()=>({definitionOfDone:['Order intake persists an order.'],ledger:ledgerOf('a','b'),ops:[op('a'),op('b')],risks:['Shared registration may be needed.']});
const tmp=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-llm-functions-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;};

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
    'reads the credential from anywhere but the environment variable the declaration names',
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
    evidence:'demo.sales.architecture.sds.ledger',consequence:'Two components would own one write path.'}]);
  assert.deepEqual(revised.result.dropped,[{kind:'premise',claim:'I would not build it this way',evidence:'',consequence:'none'}]);
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
  // The supervisor runtimes are the default chain, and a goal with no job text is not a goal to critique.
  assert.deepEqual(DEFAULT_CRITIC_RUNTIMES,['gpt-6-astra','claude-fable-5.1'],'astra first: one call per goal, and Fable has the scarcer week');
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
