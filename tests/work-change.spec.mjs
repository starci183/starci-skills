import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {sameDriveTmp} from './_ledger-fixture.mjs';
import {checkWorkChange,classifyChange,normativeDigest,normative,readWorkTree,CHANGE_KINDS,WorkChangeInputError} from '../scripts/checks/work-change.mjs';

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
const EXAMPLE=path.join(runtime,'examples/todo-app-backend/.starciwork');
const AT='2026-01-01T00:00:00.000Z';
const LATER='2026-02-01T00:00:00.000Z';
/** What a proof was captured against; these stand in for the capturing kernel's own tokens. */
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
  state='done',title='A rule',description=null,criteria={'refuses-empty':['The creation is refused.']},evidence=null,extra=''}={}){
  const dir=path.join(root,'features/demo/br/rule');
  write(path.join(dir,'index.yaml'),[`schema: work/business-rule@1`,`id: br.demo.rule`,`title: ${title}`,
    ...(description?[`description: ${description}`]:[]),`state: ${state}`,'statements:',quoted(statements),
    `acceptanceCriteria: [${Object.keys(criteria).join(', ')}]`,'module: src/demo/rule',
    ...(change?[`change: ${inline(change)}`]:[]),...(extra?[extra]:[]),
    // The kernel writes this block into the record it proves; nothing here is authored by a worker.
    ...(evidence?['evidence:',
      ...(evidence.recordDigest===null?[]:[`  recordDigest: ${evidence.recordDigest??REV1}`]),
      '  outcome: pass',
      ...(evidence.stale===undefined?[]:[`  stale: ${evidence.stale}`]),
      ...(evidence.staleReason?[`  staleReason: ${JSON.stringify(evidence.staleReason)}`]:[]),'  assertions:',
      ...(evidence.assertions??['ac.demo.rule.refuses-empty']).flatMap(id=>[`    - id: ${id}`,'      outcome: pass',
        '      observation: npm run test:unit -- src/demo/rule exited 0']),
      '  provenance:','    actor: starci-kernel','    tool: starci-kernel','    environment: local',
      `    capturedAt: ${evidence.capturedAt??AT}`]:[]),''].join('\n'));
  for(const [name,then] of Object.entries(criteria))
    write(path.join(dir,'ac',name,'index.yaml'),[`schema: work/acceptance-criterion@1`,`id: ac.demo.rule.${name}`,
      `rule: br.demo.rule`,`given: A person at the form`,`when: They submit it`,'then:',quoted(then),''].join('\n'));
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
  const rule={schema:'work/business-rule@1',id:'br.demo.rule',title:'A rule',state:'done',
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
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]},evidence:{capturedAt:AT}});
  assert.deepEqual(codes(report),['EVIDENCE_STALE_UNMARKED']);
  assert.equal(report.findings[0].observed,REV1);
  const onDisk=fs.readFileSync(path.join(report.workRoot,'features/demo/br/rule/index.yaml'),'utf8');
  assert.equal(onDisk.includes('stale:'),false,'the check writes nothing into the tree it judges');
});

test('stale evidence must name the revision that expired it and the clause that went',t=>{
  const clause='A complete task is never reopened.';
  const current={statements:['A complete task may be reopened by its owner.'],state:'todo',
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]}};
  assert.deepEqual(codes(solo(t,{...current,evidence:{stale:true,staleReason:'It is old.'}})),['STALE_REASON_UNNAMED']);
  assert.deepEqual(codes(solo(t,{...current,evidence:{stale:true,staleReason:'Expired at rev 2.'}})),['STALE_REASON_UNNAMED']);
  assert.deepEqual(codes(solo(t,{...current,evidence:{stale:true,
    staleReason:'Proven against rev 1, whose never-reopen clause rev 2 withdrew. Kept as history.'}})),[]);
});

test('only a breaking change expires evidence',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,evidence:{stale:false}},
    {statements,title:'A better title',change:{rev:2,kind:'editorial',at:LATER},
      evidence:{stale:true,staleReason:'Expired by rev 2.'}});
  // Two findings for one wrong act: the prose edit expired proof it had no business expiring, and the
  // record it left behind now claims done on nothing but history.
  assert.deepEqual(codes(report),['EVIDENCE_STALED_WITHOUT_BREAK','STATE_RESTS_ON_STALE_EVIDENCE']);
  assert.equal(report.findings[0].computed,'editorial');
});

test('expired evidence is marked, never deleted',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,evidence:{stale:false}},
    {statements:['A complete task may be reopened by its owner.'],state:'todo',
      change:{rev:2,kind:'breaking',at:LATER,withdraws:statements},evidence:null});
  assert.deepEqual(codes(report),['EVIDENCE_DELETED']);
  assert.equal(report.findings[0].observed,REV1);
});

test('a rule whose whole proof became history cannot stay done',t=>{
  const clause='A complete task is never reopened.';
  const report=solo(t,{statements:['A complete task may be reopened by its owner.'],state:'done',
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]},
    evidence:{stale:true,staleReason:'Proven against rev 1, whose never-reopen clause rev 2 withdrew.'}});
  assert.deepEqual(codes(report),['STATE_RESTS_ON_STALE_EVIDENCE']);
});

test('a manifest that does not say what it was proved against is named',t=>{
  const report=solo(t,{evidence:{stale:false,recordDigest:null}});
  assert.deepEqual(codes(report),['EVIDENCE_DIGEST_MISSING']);
  assert.match(report.limitations.join(' '),/recordDigest is the capturing kernel's own token and is not recomputed here/);
});

test('a clarifying addition never expires proof the old criteria still hold',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,criteria:{'refuses-empty':['The creation is refused.']},evidence:{stale:false}},
    {statements,criteria:{'refuses-empty':['The creation is refused.'],'names-the-rule':['The refusal names the rule.']},
      change:{rev:2,kind:'clarifying',at:LATER},evidence:{stale:false}});
  // The record's normative digest moved and the manifest still carries the token of the revision
  // before it - and that is not staleness: what the old criterion proved is untouched.
  assert.deepEqual(report.findings,[]);
  assert.equal(only(report,'br.demo.rule').computedKind,'clarifying');
});

test('a record that cannot be read is not a clean record',t=>{
  const dir=world(t);const root=plant(path.join(dir,'only'));
  write(path.join(root,'features/demo/br/broken/index.yaml'),'schema: work/business-rule@1\nid: br.demo.broken\nstate: todo\nstate: done\n');
  const report=checkWorkChange({workRoot:root});
  assert.deepEqual(codes(report),['RECORD_UNREADABLE']);
  assert.equal(report.clean,false);
});

test('a prose edit stales nothing',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,evidence:{stale:false}},
    {statements,title:'Completing a task twice changes nothing',description:'Three fresh paragraphs of prose.',
      change:{rev:2,kind:'editorial',at:LATER},evidence:{stale:false}});
  assert.deepEqual(report.findings,[]);
  const record=only(report,'br.demo.rule');
  assert.equal(record.computedKind,'editorial');
  assert.equal(record.evidence.stale,false);
});

test('a clarifying addition leaves the existing criteria proven and only the new one unproven',t=>{
  const statements=['A complete task is never reopened.'];
  const report=pair(t,{statements,criteria:{'refuses-empty':['The creation is refused.']},evidence:{stale:false}},
    {statements:[...statements,'The owner is told which rule refused them.'],
      criteria:{'refuses-empty':['The creation is refused.'],'names-the-rule':['The refusal names the rule.']},
      change:{rev:2,kind:'clarifying',at:LATER},evidence:{stale:false}});
  assert.deepEqual(report.findings,[]);
  const record=only(report,'br.demo.rule');
  assert.equal(record.computedKind,'clarifying');
  assert.deepEqual(record.criteria,['ac.demo.rule.names-the-rule','ac.demo.rule.refuses-empty']);
  assert.equal(record.evidence.stale,false);
});

test('a breaking edit marks the evidence it expired, and leaves proof captured against the new content alone',t=>{
  const clause='A complete task is never reopened.';
  const criteria={'refuses-empty':['The creation is refused.'],'is-reversible':['The task reads incomplete.']};
  const before={statements:[clause],criteria,evidence:{stale:false,capturedAt:AT}};
  const after={statements:['A complete task may be reopened by its owner.'],state:'todo',criteria,
    change:{rev:2,kind:'breaking',at:LATER,withdraws:[clause]},
    evidence:{stale:true,capturedAt:AT,
      staleReason:'Proven against rev 1, whose never-reopen clause rev 2 withdrew. Kept as history.'}};
  const marked=pair(t,before,after);
  assert.deepEqual(marked.findings,[]);
  assert.deepEqual(only(marked,'br.demo.rule').evidence,{recordDigest:REV1,outcome:'pass',stale:true});
  // Proof the kernel re-ran after the break carries the token of what replaced the broken content, and
  // is not history: nothing asks anybody to run it again.
  const reproved=pair(t,before,{...after,state:'done',
    evidence:{stale:false,recordDigest:REV2,capturedAt:'2026-03-01T00:00:00.000Z'}});
  assert.deepEqual(reproved.findings,[]);
  const unmarked=pair(t,before,{...after,evidence:{stale:false,capturedAt:AT}});
  assert.deepEqual(codes(unmarked),['EVIDENCE_STALE_UNMARKED']);
  assert.equal(unmarked.findings[0].observed,REV1);
});

// The example tree is the readable statement of the change model, so it is asserted against the checker
// rather than exempted from it: the two rules a tree can break without a baseline are that a first
// revision declares `initial` (there is nothing for it to have travelled from) and that a revision which
// withdraws content of its own declares `breaking`.
test('the example tree declares its own revisions the way the change model requires',()=>{
  const report=checkWorkChange({workRoot:EXAMPLE});
  assert.deepEqual(report.findings,[],'the example is the statement of the model; a finding here means the tree and the model disagree');
  assert.equal(report.clean,true);
  // A first revision has no predecessor, so its kind is decidable without a baseline and is always initial.
  assert.deepEqual([...new Set(report.records.filter(record=>record.declaredKind&&record.rev===1).map(record=>record.declaredKind))],['initial']);
  for(const record of report.records) if(record.declaredKind) assert.ok(CHANGE_KINDS.includes(record.declaredKind),`${record.id} declares ${record.declaredKind}`);
});

test('the example withdrawal is recorded as breaking and keeps the clauses it removed',()=>{
  const report=checkWorkChange({workRoot:EXAMPLE});
  const gap=only(report,'gap.plan.sepay-not-reachable');
  assert.deepEqual([gap.rev,gap.declaredKind,gap.state],[2,'breaking','todo']);
  assert.deepEqual(gap.withdraws,['no module exists yet at src/plan/payments (gap.plan.unbuilt-module)',
    "no request has ever reached SePay's sandbox merchant account for real"],
    'a withdrawn clause is written out rather than deleted, because it is what any proof of the old revision was proving');
  // The withdrawn clauses are gone from the record itself, so the transition it declares is a break and
  // not an author's opinion of one.
  const tree=readWorkTree(EXAMPLE),current=tree.records.get('gap.plan.sepay-not-reachable');
  const previous={...current,meta:{...current.meta,statements:[...gap.withdraws,...(current.meta.statements??[])]}};
  assert.equal(classifyChange(previous,current),'breaking');
});

test('the check refuses a missing or unreadable root instead of reporting about nothing',t=>{
  assert.throws(()=>checkWorkChange({}),WorkChangeInputError);
  assert.throws(()=>checkWorkChange({workRoot:path.join(world(t),'absent')}),WorkChangeInputError);
});

// `starci work-change` is not one of the runtime's verbs, so the report contract is asserted where a
// caller actually gets it. A spec that spawned the CLI would be asserting a command nobody can run.
test('a report without a baseline says which findings it could not evaluate',()=>{
  const usage=spawnSync(process.execPath,['bin/starci.mjs','help'],{cwd:runtime,encoding:'utf8',windowsHide:true});
  assert.doesNotMatch(usage.stdout,/work-change/,'the check has no CLI verb; if one is added, this report contract belongs behind it too');
  const report=checkWorkChange({workRoot:EXAMPLE});
  assert.equal(report.schema,'starci/work-change@1');
  assert.equal(report.clean,true);
  assert.equal(report.baseline,null);
  assert.match(report.limitations[0],/No baseline was given/,
    'a clean report over one tree must say what it did not look at, or it reads as a clean report over the transition');
  assert.equal(report.coverage.compared,0,'nothing was compared, because there was nothing to compare against');
});
