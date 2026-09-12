import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {GOAL_FORM,GOAL_PLAN,assessGoal,extractCodex,extractMaterial,renderGoalMarkdown,validateGoalPlan} from '../execution/llm-functions.mjs';

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

test('the goal-plan schema file documents the form the runtime validates',()=>{
  const schema=parseYaml(fs.readFileSync(new URL('../schemas/goal-plan.yaml',import.meta.url),'utf8'));
  assert.equal(schema.describes,GOAL_PLAN);
  assert.equal(schema.module,'execution/llm-functions.mjs');
  for(const key of Object.keys(GOAL_FORM))assert.ok(key in schema.fields,`schemas/goal-plan.yaml does not document ${key}`);
  assert.ok(schema.rules.some(rule=>/disjoint/.test(rule)));
});
