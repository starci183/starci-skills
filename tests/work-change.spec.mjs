import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sameDriveTmp} from './_ledger-fixture.mjs';
import {checkWorkChange,classifyChange,normativeDigest,normative,readWorkTree,CHANGE_KINDS,WorkChangeInputError} from '../checks/work-change.mjs';

/**
 * The change record decides how far an edit travels, so every fixture here is a pair of trees: the
 * revision that was and the revision that is. The findings are the interesting half - a check that
 * only ever proves the clean case proves that it cannot see anything.
 *
 * Fixtures live in `sameDriveTmp()`, never in the runtime tree, and every one of them is removed by a
 * `t.after` registered the moment the directory exists - cleanup that runs only when the code under
 * test succeeded is not cleanup.
 */
const runtime=path.resolve(import.meta.dirname,'..');
const EXAMPLE=path.join(runtime,'examples/todo-app/.starciwork');
const AT='2026-01-01T00:00:00.000Z';
const LATER='2026-02-01T00:00:00.000Z';
/** A manifest says what it was proved against; these stand in for the capturing kernel's own tokens. */
const REV1='d'.repeat(64),REV2='e'.repeat(64);

function world(t){
  const base=sameDriveTmp();fs.mkdirSync(base,{recursive:true});
  const dir=fs.mkdtempSync(path.join(base,'starci-work-change-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
}
const write=(file,body)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body,'utf8');};
const quoted=list=>list.map(item=>`  - ${JSON.stringify(item)}`).join('\n');
const inline=change=>`{${Object.entries(change).map(([key,value])=>`${key}: ${Array.isArray(value)?`[${value.map(item=>JSON.stringify(item)).join(', ')}]`:value}`).join(', ')}}`;

/**
 * One rule with its criteria and its evidence, written as the record-per-file shape the example uses.
 * `change: null` writes a record nobody declared a revision for.
 */
function plant(root,{statements=['A task is created only with a non-empty title.'],change={rev:1,kind:'initial',at:AT},
  state='done',title='A rule',description=null,criteria={'refuses-empty':['The creation is refused.']},evidence={},extra=''}={}){
  const dir=path.join(root,'features/demo/br/rule');
  write(path.join(dir,'index.yaml'),[`schema: work/business-rule`,`id: br.demo.rule`,`title: ${title}`,
    ...(description?[`description: ${description}`]:[]),`state: ${state}`,'statements:',quoted(statements),
    `acceptanceCriteria: [${Object.keys(criteria).join(', ')}]`,'module: src/demo/rule',
    ...(change?[`change: ${inline(change)}`]:[]),...(extra?[extra]:[]),''].join('\n'));
  for(const [name,then] of Object.entries(criteria))
    write(path.join(dir,'ac',name,'index.yaml'),[`schema: work/acceptance-criterion`,`id: ac.demo.rule.${name}`,
      `rule: br.demo.rule`,`given: A person at the form`,`when: They submit it`,'then:',quoted(then),''].join('\n'));
  for(const [id,proof] of Object.entries(evidence))
    write(path.join(dir,'evidence',id,'manifest.yaml'),[`schema: work/evidence`,`id: ${id}`,`record: br.demo.rule`,
      `outcome: pass`,...(proof.recordDigest===null?[]:[`recordDigest: ${proof.recordDigest??REV1}`]),
      ...(proof.stale===undefined?[]:[`stale: ${proof.stale}`]),
      ...(proof.staleReason?[`staleReason: ${JSON.stringify(proof.staleReason)}`]:[]),'assertions:',
      ...(proof.assertions??['ac.demo.rule.refuses-empty']).flatMap(id=>[`  - id: ${id}`,'    outcome: pass',
        '    observation: npm run test:unit -- src/demo/rule exited 0']),
      'provenance:','  actor: starci-kernel','  tool: starci-kernel','  environment: local',
      `  capturedAt: ${proof.capturedAt??AT}`,''].join('\n'));
  return root;
}
/** A baseline tree and a current tree in one fixture, checked against each other. `before: null` is a tree the record did not exist in yet. */
function pair(t,before,after){
  const dir=world(t);
  if(before===null)fs.mkdirSync(path.join(dir,'before/features'),{recursive:true});else plant(path.join(dir,'before'),before);
  plant(path.join(dir,'after'),after);
  return checkWorkChange({workRoot:path.join(dir,'after'),baselineRoot:path.join(dir,'before')});
}
const solo=(t,record)=>checkWorkChange({workRoot:plant(path.join(world(t),'only'),record)});
const codes=report=>report.findings.map(finding=>finding.code).sort();
const only=(report,id)=>report.records.find(record=>record.id===id);

test('the four kinds are computed from the two revisions, not read from the author',t=>{
  const statements=['A complete task is never reopened.'];
  const initial=pair(t,null,{statements,state:'todo',change:{rev:1,kind:'initial',at:AT}});
  assert.equal(only(initial,'br.demo.rule').computedKind,'initial');
  assert.deepEqual(initial.findings,[]);
  const editorial=pair(t,{statements,title:'One'},{statements,title:'Another',description:'Rewritten at length.',change:{rev:2,kind:'editorial',at:LATER}});
  assert.equal(only(editorial,'br.demo.rule').computedKind,'editorial');
  const clarifying=pair(t,{statements},{statements:[...statements,'The owner is told why.'],change:{rev:2,kind:'clarifying',at:LATER}});
  assert.equal(only(clarifying,'br.demo.rule').computedKind,'clarifying');
  const breaking=pair(t,{statements},{statements:['A complete task may be reopened by its owner.'],change:{rev:2,kind:'breaking',at:LATER,withdraws:statements}});
  assert.equal(only(breaking,'br.demo.rule').computedKind,'breaking');
  assert.deepEqual(CHANGE_KINDS,['initial','editorial','clarifying','breaking']);
});

test('the normative digest moves for a statement and stands still for prose',()=>{
  const rule={schema:'work/business-rule',id:'br.demo.rule',title:'A rule',state:'done',
    statements:['A complete task is never reopened.'],change:{rev:1,kind:'initial',at:AT}};
  const prose={...rule,title:'A much better title',description:'Three paragraphs of it.',state:'todo',
    change:{rev:2,kind:'editorial',at:LATER},evidence:'proves-rule'};
  assert.equal(normativeDigest(prose),normativeDigest(rule));
  assert.notEqual(normativeDigest({...rule,statements:['A complete task may be reopened.']}),normativeDigest(rule));
  assert.equal(Object.hasOwn(normative(rule),'title'),false);
  assert.equal(normative(rule).statements.length,1);
});

test('an edited acceptance criterion is a break even when the rule text stands',t=>{
  const report=pair(t,{criteria:{'refuses-empty':['The creation is refused.']},change:{rev:1,kind:'initial',at:AT}},
    {criteria:{'refuses-empty':['The creation is refused with a 422.']},change:{rev:2,kind:'clarifying',at:LATER}});
  assert.equal(only(report,'br.demo.rule').computedKind,'breaking');
  assert.deepEqual(codes(report),['CHANGE_KIND_MISMATCH']);
});

test('a malformed change record is named rather than interpreted',t=>{
  const report=solo(t,{change:{rev:0,kind:'tweak',at:'not-a-time',motive:'unknown'}});
  assert.equal(report.clean,false);
  assert.equal(report.findings.filter(finding=>finding.code==='CHANGE_INVALID').length,4);
  assert.deepEqual(codes(solo(t,{change:{rev:3,kind:'initial',at:AT}})),['CHANGE_INVALID']);
});

test('rev 1 has no previous revision, so a declared edit there is a mismatch without any baseline',t=>{
  const report=solo(t,{change:{rev:1,kind:'editorial',at:AT}});
  assert.deepEqual(codes(report),['CHANGE_KIND_MISMATCH']);
  assert.equal(report.findings[0].expected,'initial');
});

test('a declared editorial whose normative digest moved is a mismatch',t=>{
  const report=pair(t,{statements:['A complete task is never reopened.']},
    {statements:['A complete task may be reopened by its owner.'],change:{rev:2,kind:'editorial',at:LATER}});
  assert.deepEqual(codes(report),['CHANGE_KIND_MISMATCH']);
  assert.deepEqual([report.findings[0].expected,report.findings[0].observed],['breaking','editorial']);
});

test('withdrawing needs the breaking kind, and a withdrawal cannot name a statement that still stands',t=>{
  const clause='A complete task is never reopened.';
  assert.deepEqual(codes(solo(t,{statements:['Something else.'],change:{rev:2,kind:'clarifying',at:LATER,withdraws:[clause]}})),
    ['WITHDRAWS_WITHOUT_BREAKING']);
  assert.deepEqual(codes(solo(t,{statements:[clause],state:'todo',change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]}})),
    ['WITHDRAWS_STILL_PRESENT']);
});

test('a withdrawal that names nothing the previous revision carried is refused',t=>{
  const report=pair(t,{statements:['A complete task is never reopened.']},
    {statements:['A complete task may be reopened by its owner.'],state:'todo',
      change:{rev:2,kind:'breaking',at:LATER,withdraws:['A task is deleted only by its owner.']}});
  assert.deepEqual(codes(report),['WITHDRAWS_UNKNOWN_STATEMENT']);
  assert.equal(report.findings[0].observed,'A task is deleted only by its owner.');
});

test('content that moved without a revision is an edit nobody declared',t=>{
  const moved=pair(t,{statements:['A complete task is never reopened.']},
    {statements:['A complete task may be reopened by its owner.'],change:{rev:1,kind:'initial',at:AT}});
  assert.deepEqual(codes(moved),['CHANGE_UNRECORDED']);
  assert.equal(moved.findings[0].computed,'breaking');
  const ungoverned=pair(t,{statements:['A complete task is never reopened.'],change:null},
    {statements:['A complete task may be reopened by its owner.'],change:null});
  assert.deepEqual(codes(ungoverned),['CHANGE_UNRECORDED']);
});

test('a revision never goes backwards',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,change:{rev:2,kind:'breaking',at:LATER,withdraws:['An older clause.']}},
    {statements,change:{rev:1,kind:'initial',at:AT}});
  assert.deepEqual(codes(report),['REV_NOT_MONOTONIC']);
  assert.equal(report.findings[0].observed,1);
});

test('a breaking change that leaves its evidence unmarked is reported, not repaired',t=>{
  const clause='A complete task is never reopened.';
  const report=solo(t,{statements:['A complete task may be reopened by its owner.'],state:'todo',
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]},evidence:{'proves-rule':{capturedAt:AT}}});
  assert.deepEqual(codes(report),['EVIDENCE_STALE_UNMARKED']);
  assert.match(report.findings[0].observed,/proves-rule\/manifest\.yaml$/);
  const before=fs.readFileSync(path.join(report.workRoot,'features/demo/br/rule/evidence/proves-rule/manifest.yaml'),'utf8');
  assert.equal(before.includes('stale:'),false,'the check writes nothing into the tree it judges');
});

test('stale evidence must name the revision that expired it and the clause that went',t=>{
  const clause='A complete task is never reopened.';
  const current={statements:['A complete task may be reopened by its owner.'],state:'todo',
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]}};
  assert.deepEqual(codes(solo(t,{...current,evidence:{'proves-rule':{stale:true,staleReason:'It is old.'}}})),['STALE_REASON_UNNAMED']);
  assert.deepEqual(codes(solo(t,{...current,evidence:{'proves-rule':{stale:true,staleReason:'Expired at rev 2.'}}})),['STALE_REASON_UNNAMED']);
  assert.deepEqual(codes(solo(t,{...current,evidence:{'proves-rule':{stale:true,
    staleReason:'Proven against rev 1, whose never-reopen clause rev 2 withdrew. Kept as history.'}}})),[]);
});

test('only a breaking change expires evidence',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,evidence:{'proves-rule':{stale:false}}},
    {statements,title:'A better title',change:{rev:2,kind:'editorial',at:LATER},
      evidence:{'proves-rule':{stale:true,staleReason:'Expired by rev 2.'}}});
  // Two findings for one wrong act: the prose edit expired proof it had no business expiring, and the
  // record it left behind now claims done on nothing but history.
  assert.deepEqual(codes(report),['EVIDENCE_STALED_WITHOUT_BREAK','STATE_RESTS_ON_STALE_EVIDENCE']);
  assert.equal(report.findings[0].computed,'editorial');
});

test('expired evidence is marked, never deleted',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,evidence:{'proves-rule':{stale:false}}},
    {statements:['A complete task may be reopened by its owner.'],state:'todo',
      change:{rev:2,kind:'breaking',at:LATER,withdraws:statements},evidence:{}});
  assert.deepEqual(codes(report),['EVIDENCE_DELETED']);
  assert.equal(report.findings[0].observed,'proves-rule');
});

test('a rule whose whole proof became history cannot stay done',t=>{
  const clause='A complete task is never reopened.';
  const report=solo(t,{statements:['A complete task may be reopened by its owner.'],state:'done',
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]},
    evidence:{'proves-rule':{stale:true,staleReason:'Proven against rev 1, whose never-reopen clause rev 2 withdrew.'}}});
  assert.deepEqual(codes(report),['STATE_RESTS_ON_STALE_EVIDENCE']);
});

test('a manifest that does not say what it was proved against is named',t=>{
  const report=solo(t,{evidence:{'proves-rule':{stale:false,recordDigest:null}}});
  assert.deepEqual(codes(report),['EVIDENCE_DIGEST_MISSING']);
  assert.match(report.limitations.join(' '),/recordDigest is the capturing kernel's own token and is not recomputed here/);
});

test('a clarifying addition never expires proof the old criteria still hold',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,criteria:{'refuses-empty':['The creation is refused.']},evidence:{'proves-rule':{stale:false}}},
    {statements,criteria:{'refuses-empty':['The creation is refused.'],'names-the-rule':['The refusal names the rule.']},
      change:{rev:2,kind:'clarifying',at:LATER},evidence:{'proves-rule':{stale:false}}});
  // The record's normative digest moved and the manifest still carries the token of the revision
  // before it - and that is not staleness: what the old criterion proved is untouched.
  assert.deepEqual(report.findings,[]);
  assert.equal(only(report,'br.demo.rule').computedKind,'clarifying');
});

test('a record that cannot be read is not a clean record',t=>{
  const dir=world(t);const root=plant(path.join(dir,'only'));
  write(path.join(root,'features/demo/br/rule/evidence/broken/manifest.yaml'),'schema: work/evidence\noutcome: pass\noutcome: fail\n');
  const report=checkWorkChange({workRoot:root});
  assert.deepEqual(codes(report),['RECORD_UNREADABLE']);
  assert.equal(report.clean,false);
});

test('a prose edit stales nothing',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,evidence:{'proves-rule':{stale:false}}},
    {statements,title:'Completing a task twice changes nothing',description:'Three fresh paragraphs of prose.',
      change:{rev:2,kind:'editorial',at:LATER},evidence:{'proves-rule':{stale:false}}});
  assert.deepEqual(report.findings,[]);
  const record=only(report,'br.demo.rule');
  assert.equal(record.computedKind,'editorial');
  assert.deepEqual(record.evidence.map(proof=>proof.stale),[false]);
});

test('a clarifying addition leaves the existing criteria proven and only the new one unproven',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,criteria:{'refuses-empty':['The creation is refused.']},evidence:{'proves-rule':{stale:false}}},
    {statements:[...statements,'The owner is told which rule refused them.'],
      criteria:{'refuses-empty':['The creation is refused.'],'names-the-rule':['The refusal names the rule.']},
      change:{rev:2,kind:'clarifying',at:LATER},evidence:{'proves-rule':{stale:false}}});
  assert.deepEqual(report.findings,[]);
  const record=only(report,'br.demo.rule');
  assert.equal(record.computedKind,'clarifying');
  assert.deepEqual(record.criteria,['ac.demo.rule.names-the-rule','ac.demo.rule.refuses-empty']);
  assert.deepEqual(record.evidence.map(proof=>proof.stale),[false]);
});

test('a breaking edit marks the right evidence stale and leaves later proof alone',t=>{
  const clause='A complete task is never reopened.';
  // Both manifests were captured against rev 1. After the break one is re-run - its manifest carries
  // the token of what replaced the broken content - and the other is left as the history it now is.
  const before={statements:[clause],criteria:{'refuses-empty':['The creation is refused.'],'is-reversible':['The task reads incomplete.']},
    evidence:{'proves-the-clause':{stale:false,capturedAt:AT,assertions:['ac.demo.rule.refuses-empty']},
      're-proves-after':{stale:false,capturedAt:AT,assertions:['ac.demo.rule.is-reversible']}}};
  const after={statements:['A complete task may be reopened by its owner.'],state:'todo',
    criteria:before.criteria,change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]},
    evidence:{'proves-the-clause':{stale:true,capturedAt:AT,assertions:['ac.demo.rule.refuses-empty'],
      staleReason:'Proven against rev 1, whose never-reopen clause rev 2 withdrew. Kept as history.'},
      're-proves-after':{stale:false,recordDigest:REV2,capturedAt:'2026-03-01T00:00:00.000Z',assertions:['ac.demo.rule.is-reversible']}}};
  const clean=pair(t,before,after);
  assert.deepEqual(clean.findings,[]);
  assert.deepEqual(only(clean,'br.demo.rule').evidence.map(proof=>[proof.id,proof.stale]),
    [['proves-the-clause',true],['re-proves-after',false]]);
  const unmarked=pair(t,before,{...after,evidence:{...after.evidence,'proves-the-clause':{stale:false,capturedAt:AT,assertions:['ac.demo.rule.refuses-empty']}}});
  assert.deepEqual(codes(unmarked),['EVIDENCE_STALE_UNMARKED']);
  assert.match(unmarked.findings[0].observed,/proves-the-clause\/manifest\.yaml$/);
});

test('the example withdrawal returns its rule to todo with its history intact',()=>{
  const report=checkWorkChange({workRoot:EXAMPLE});
  assert.deepEqual(report.findings,[]);
  const rule=only(report,'br.task.complete.once');
  assert.deepEqual([rule.rev,rule.declaredKind,rule.state],[2,'breaking','todo']);
  assert.deepEqual(rule.withdraws,['A complete task is never reopened.']);
  assert.deepEqual(rule.criteria,['ac.task.complete.once.is-idempotent','ac.task.complete.once.is-reversible']);
  assert.deepEqual(rule.evidence.map(proof=>[proof.id,proof.stale]),[['proves-completion',true]]);
  assert.equal(fs.existsSync(path.join(EXAMPLE,'features/task/br/complete/once/evidence/proves-completion/manifest.yaml')),true);
  // Every other governed record of the example is an untouched first revision.
  assert.deepEqual([...new Set(report.records.filter(record=>record.declaredKind&&record.id!=='br.task.complete.once')
    .map(record=>`${record.rev}:${record.declaredKind}`))],['1:initial']);
  // The rev-1 statement is gone from the record, so the transition it declares is a break.
  const tree=readWorkTree(EXAMPLE),current=tree.records.get('br.task.complete.once');
  const previous={...current,meta:{...current.meta,statements:['A complete task is never reopened.'],
    acceptanceCriteria:['is-idempotent']},criteria:new Map([['ac.task.complete.once.is-idempotent',current.criteria.get('ac.task.complete.once.is-idempotent')]])};
  assert.equal(classifyChange(previous,current),'breaking');
});

test('the check refuses a missing or unreadable root instead of reporting about nothing',t=>{
  assert.throws(()=>checkWorkChange({}),WorkChangeInputError);
  assert.throws(()=>checkWorkChange({workRoot:path.join(world(t),'absent')}),WorkChangeInputError);
});

test('the public command reports the example and refuses bad arguments',()=>{
  const run=args=>spawnSync(process.execPath,['bin/starci.mjs','work-change',...args],{cwd:runtime,encoding:'utf8',windowsHide:true});
  const ok=run(['check','--work','examples/todo-app/.starciwork']);
  assert.equal(ok.status,0,ok.stderr);
  const report=JSON.parse(ok.stdout);
  assert.equal(report.schema,'starci/work-change@1');
  assert.equal(report.clean,true);
  assert.equal(report.baseline,null);
  assert.match(report.limitations[0],/No baseline was given/);
  for(const args of [['check'],['check','--fix','true'],['repair','--work','.'],['check','--work']])
    assert.equal(run(args).status,1,`work-change ${args.join(' ')} must be refused`);
  assert.match(run(['check','--work','examples/todo-app/.starciwork','--against']).stderr,/Invalid work-change check options/);
});
