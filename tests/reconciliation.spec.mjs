import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {RECONCILIATION_CASES,RECONCILIATION_FINDINGS,ROW_MALFORMED,checkReconciliation,conflictQuestions,
  decisionOptions,readReconciliation,recordDigests,recordKindOfNode,recordReadsOf,reconcileIntake} from '../kernel/reconciliation.mjs';

/**
 * One real Work tree on disk: features `sales` and `support` decided, feature `collab` a set of drafts. The
 * records are written as `work/node@2` YAML with real `extensions.work3.srs` statements, because every rule
 * under test is about what a record says and what the tree holds - a stub with no statements would prove the
 * restatement rule by accident.
 */
const REFUND='A refund is granted only while the order is inside the sales refund window of thirty days, counted from the day the customer received it.';
const ESCALATE='A support conversation that nobody answered within one working day is escalated to the duty supervisor automatically.';

function tree(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-reconciliation-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const list=[];
  const write=(where,node)=>{
    const file=path.join(root,...where.split('/'));
    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,stringifyYaml({schema:'work/node@2',required:true,...node}));
    list.push({id:node.id,kind:node.kind,path:where,state:node.state??null});
    return file;
  };
  const statements=(...lines)=>({extensions:{work3:{srs:{statements:[...lines]}}}});
  // Feature A: sales, decided. Its refund rule is the statement collab must reference and must not restate.
  write('features/sales/index.yaml',{id:'demo.sales',kind:'module'});
  write('features/sales/business/srs/rule/refund-window/index.yaml',
    {id:'demo.sales.business.srs.rule.refund-window',kind:'business',state:'done',description:'The refund window',...statements(REFUND)});
  write('features/sales/architecture/sds/contract/intake-command/index.yaml',
    {id:'demo.sales.architecture.sds.contract.intake-command',kind:'architecture',state:'done',description:'The intake command contract',
      extensions:{work3:{sds:{statements:['The intake command is answered synchronously inside one request and returns the created order.']}}}});
  // Feature B: support, decided, so the tree holds decided records of more than one other feature.
  write('features/support/index.yaml',{id:'demo.support',kind:'module'});
  write('features/support/business/srs/rule/escalation/index.yaml',
    {id:'demo.support.business.srs.rule.escalation',kind:'business',state:'done',description:'Escalation',...statements(ESCALATE)});
  return {root,list,write,statements,
    // The loaded ledger as the kernel hands it to the module, plus the two readers it injects.
    loaded:()=>({ok:true,workRoot:root,list:[...list],nodes:new Map(list.map(node=>[node.id,node]))}),
    readNode:node=>parseYaml(fs.readFileSync(path.join(root,...String(node.path).split('/')),'utf8')),
    readFile:node=>fs.readFileSync(path.join(root,...String(node.path).split('/')))};
}

/** The collab drafts every scenario starts from: a module record carrying the table, and one new requirement. */
function collab(fixture,rows,{shareStatement='Sharing a conversation thread with a colleague keeps the original owner and adds the colleague as a reader.'}={}){
  fixture.write('features/collab/index.yaml',{id:'demo.collab',kind:'module',description:'Collaboration',
    extensions:{work3:{reconciliation:rows}}});
  fixture.write('features/collab/business/srs/fr/share-thread/index.yaml',
    {id:'demo.collab.business.srs.fr.share-thread',kind:'business',state:'todo',description:'Share a thread',
      ...fixture.statements(shareStatement)});
  return fixture;
}
const codes=result=>result.findings.map(item=>item.code);
const REFERENCE_ROW={case:'reference',record:'demo.sales.business.srs.rule.refund-window',detail:'the collab refund path follows the sales refund window as decided'};

test('the three cases are the closed set and the seven findings are the mechanical half of the rule',()=>{
  assert.deepEqual(RECONCILIATION_CASES,['reference','conflict','new']);
  assert.deepEqual(RECONCILIATION_FINDINGS,['reconciliation-missing','reference-unknown','reference-restated',
    'conflict-without-decision','conflict-edited','new-unknown','new-reads-blind']);
});

/**
 * The reader never throws: an intake that wrote a broken table gets its rows back as findings and is retried,
 * because a malformed row is the operation's defect and a crash in the loop would be the kernel's.
 */
test('readReconciliation normalizes the rows it can shape and reports the ones it cannot, instead of throwing',()=>{
  const read=readReconciliation({extensions:{work3:{reconciliation:[
    {case:'reference',record:'a.one',detail:' shared '},
    {case:'new',record:'c.one',reads:['a.one','a.one',''],hands:['c.two'],detail:'new'},
    {case:'conflict',record:'a.two',decision:'c.d1',detail:'both cannot hold'},
    'a sentence, not a row',
    {case:'fit',record:'a.three'},
    {case:'new'}
  ]}}});
  assert.deepEqual(read.rows,[
    {case:'reference',record:'a.one',decision:null,reads:[],hands:[],detail:'shared'},
    {case:'new',record:'c.one',decision:null,reads:['a.one'],hands:['c.two'],detail:'new'},
    {case:'conflict',record:'a.two',decision:'c.d1',reads:[],hands:[],detail:'both cannot hold'}
  ]);
  assert.deepEqual(codes(read),[ROW_MALFORMED,ROW_MALFORMED,ROW_MALFORMED]);
  assert.match(read.findings[1].detail,/row 5 claims case "fit"; the cases are reference, conflict, new/);
  assert.match(read.findings[2].detail,/row 6 \(new\) names no record/);
  // A record with no table at all is not a malformed one: whether it needed one is the tree's question.
  assert.deepEqual(readReconciliation({extensions:{work3:{}}}),{rows:[],findings:[],table:false});
  assert.deepEqual(readReconciliation(null),{rows:[],findings:[],table:false});
  // A table that is not a list is one finding, not a silent empty table.
  const scalar=readReconciliation({extensions:{work3:{reconciliation:'see the prose above'}}});
  assert.deepEqual(codes(scalar),[ROW_MALFORMED]);
  assert.equal(scalar.table,true);
});

test('reconciliation-missing: an intake over a tree that holds decided records of other features wrote no table',t=>{
  const fixture=collab(tree(t),[]);
  const result=reconcileIntake({op:{intake:{scope:'collab'}},tree:fixture.loaded(),readNode:fixture.readNode});
  assert.deepEqual(codes(result),['reconciliation-missing']);
  assert.equal(result.ok,false);
  assert.equal(result.findings[0].record,null);
  assert.match(result.findings[0].detail,/3 decided record\(s\) outside collab/);
  assert.match(result.findings[0].detail,/extensions\.work3\.reconciliation/);
  assert.deepEqual(result.counts,{reference:0,conflict:0,new:0});
});

test('reference-unknown: a reference row names a record the tree does not hold, or one that is not decided',t=>{
  const fixture=collab(tree(t),[
    {case:'reference',record:'demo.sales.business.srs.rule.invented',detail:'a rule nobody wrote'},
    {case:'reference',record:'demo.collab.business.srs.fr.share-thread',detail:'our own draft'}
  ]);
  const result=reconcileIntake({op:{intake:{scope:'collab'}},tree:fixture.loaded(),readNode:fixture.readNode});
  assert.deepEqual(codes(result),['reference-unknown','reference-unknown']);
  assert.match(result.findings[0].detail,/the tree holds no record demo\.sales\.business\.srs\.rule\.invented/);
  // A draft of the feature itself is not a decided record to reference, and the finding says which state it is in.
  assert.match(result.findings[1].detail,/is todo, so it is not a decided record to reference/);
  assert.deepEqual(result.counts,{reference:2,conflict:0,new:0});
});

test('reference-restated: a new record under C repeats a referenced record\'s statement word for word',t=>{
  // The same long sentence, differently spaced and capitalized: the fold catches it, the citation is missing.
  const restated=`  ${REFUND.toUpperCase().replace(' only ','   ONLY ')}  `;
  const fixture=collab(tree(t),[REFERENCE_ROW,
    {case:'new',record:'demo.collab.business.srs.fr.share-thread',reads:['demo.sales.business.srs.rule.refund-window'],hands:[],detail:'sharing a thread'}],
    {shareStatement:restated});
  const result=reconcileIntake({op:{intake:{scope:'collab'}},tree:fixture.loaded(),readNode:fixture.readNode});
  assert.deepEqual(codes(result),['reference-restated']);
  assert.equal(result.findings[0].record,'demo.collab.business.srs.fr.share-thread');
  assert.match(result.findings[0].detail,/repeats a statement of the referenced record demo\.sales\.business\.srs\.rule\.refund-window word for word instead of citing it/);
  // A sentence shorter than twelve words is left to the validator: two features may state one short fact.
  const short=collab(tree(t),[REFERENCE_ROW,
    {case:'new',record:'demo.collab.business.srs.fr.share-thread',reads:['demo.sales.business.srs.rule.refund-window'],hands:[],detail:'sharing a thread'}],
    {shareStatement:'The refund window is thirty days.'});
  short.write('features/sales/business/srs/rule/refund-window/index.yaml',
    {id:'demo.sales.business.srs.rule.refund-window',kind:'business',state:'done',description:'The refund window',
      ...short.statements('The refund window is thirty days.')});
  assert.deepEqual(codes(reconcileIntake({op:{intake:{scope:'collab'}},tree:short.loaded(),readNode:short.readNode})),[]);
});

test('conflict-without-decision: the decision record must exist under C, be a decision and still be todo',t=>{
  const base=()=>({case:'conflict',record:'demo.sales.architecture.sds.contract.intake-command',
    detail:'collab needs an asynchronous intake; sales decided a synchronous contract'});
  const run=(fixture)=>reconcileIntake({op:{intake:{scope:'collab'}},tree:fixture.loaded(),readNode:fixture.readNode});
  // No decision record named at all.
  const nameless=collab(tree(t),[base()]);
  assert.deepEqual(codes(run(nameless)),['conflict-without-decision']);
  assert.match(run(nameless).findings[0].detail,/names no decision record under collab/);
  // Named, but the tree does not hold it.
  const absent=collab(tree(t),[{...base(),decision:'demo.collab.business.srs.decision.d-intake-contract'}]);
  assert.match(run(absent).findings[0].detail,/is not in the tree/);
  // Held, but under the other feature: a conflict is decided under the feature that raised it.
  const elsewhere=collab(tree(t),[{...base(),decision:'demo.sales.business.srs.decision.d-intake-contract'}]);
  elsewhere.write('features/sales/business/srs/decisions/d-intake-contract/index.yaml',
    {id:'demo.sales.business.srs.decision.d-intake-contract',kind:'decision',state:'todo',description:'Which intake contract?'});
  assert.match(run(elsewhere).findings[0].detail,/is not under collab; a conflict is decided under the feature that raised it/);
  // Held under collab, but it is an ordinary business record rather than a decision.
  const wrongKind=collab(tree(t),[{...base(),decision:'demo.collab.business.srs.decision.d-intake-contract'}]);
  wrongKind.write('features/collab/business/srs/decisions/d-intake-contract/index.yaml',
    {id:'demo.collab.business.srs.decision.d-intake-contract',kind:'business',state:'todo',description:'Which intake contract?'});
  assert.match(run(wrongKind).findings[0].detail,/is a business, not a decision record/);
  // Held, a decision, but already done: the owner's answer is not this intake's to assume.
  const answered=collab(tree(t),[{...base(),decision:'demo.collab.business.srs.decision.d-intake-contract'}]);
  answered.write('features/collab/business/srs/decisions/d-intake-contract/index.yaml',
    {id:'demo.collab.business.srs.decision.d-intake-contract',kind:'decision',state:'done',description:'Which intake contract?'});
  assert.match(run(answered).findings[0].detail,/is done, not `todo`: the owner has not answered it/);
});

test('conflict-edited: the decided record the conflict names was changed while the intake ran',t=>{
  const fixture=collab(tree(t),[{case:'conflict',record:'demo.sales.architecture.sds.contract.intake-command',
    decision:'demo.collab.business.srs.decision.d-intake-contract',detail:'synchronous against asynchronous'}]);
  fixture.write('features/collab/business/srs/decisions/d-intake-contract/index.yaml',
    {id:'demo.collab.business.srs.decision.d-intake-contract',kind:'decision',state:'todo',
      description:'Which intake contract does collab use?\n1. Keep the synchronous contract and queue inside collab.\n2. Make the intake asynchronous for both features.'});
  const loaded=fixture.loaded();
  // The digests the kernel captures at launch, before the op runs.
  const before=recordDigests(loaded,fixture.readFile);
  assert.equal(before['demo.sales.architecture.sds.contract.intake-command'],
    crypto.createHash('sha256').update(fs.readFileSync(path.join(fixture.root,'features/sales/architecture/sds/contract/intake-command/index.yaml'))).digest('hex'));
  // Untouched: the conflict is the owner's question and nothing else is wrong.
  const clean=reconcileIntake({op:{intake:{scope:'collab'}},tree:loaded,readNode:fixture.readNode,digests:before,readFile:fixture.readFile});
  assert.deepEqual(codes(clean),[]);
  // The intake "resolved" the conflict by rewriting the decided record of the other feature.
  fs.writeFileSync(path.join(fixture.root,'features/sales/architecture/sds/contract/intake-command/index.yaml'),
    stringifyYaml({schema:'work/node@2',required:true,id:'demo.sales.architecture.sds.contract.intake-command',kind:'architecture',state:'done',
      description:'The intake command contract',extensions:{work3:{sds:{statements:['The intake command is answered asynchronously.']}}}}));
  const edited=reconcileIntake({op:{intake:{scope:'collab'}},tree:loaded,readNode:fixture.readNode,digests:before,readFile:fixture.readFile});
  assert.deepEqual(codes(edited),['conflict-edited']);
  assert.match(edited.findings[0].detail,/was changed by this intake .* a conflict with a decided record is the owner's decision, never an edit/);
  // With no baseline digests nothing is claimed either way: an unproven edit is not a finding.
  assert.deepEqual(codes(reconcileIntake({op:{intake:{scope:'collab'}},tree:loaded,readNode:fixture.readNode})),[]);
});

test('new-unknown: a new row names a record outside C, or reads and hands ids the tree lacks',t=>{
  const row=extra=>({case:'new',record:'demo.collab.business.srs.fr.share-thread',reads:[],hands:[],detail:'sharing a thread',...extra});
  const run=fixture=>reconcileIntake({op:{intake:{scope:'collab'}},tree:fixture.loaded(),readNode:fixture.readNode});
  const absent=collab(tree(t),[row({record:'demo.collab.business.srs.fr.never-written'})]);
  assert.deepEqual(codes(run(absent)),['new-unknown']);
  assert.match(run(absent).findings[0].detail,/the tree holds no record demo\.collab\.business\.srs\.fr\.never-written/);
  // A record the tree holds, but under another feature: an intake authors its new records under its own feature.
  const foreign=collab(tree(t),[row({record:'demo.sales.business.srs.rule.refund-window'})]);
  assert.match(run(foreign).findings[0].detail,/is not under collab; an intake authors new records under its own feature/);
  // The declaration of what it reads and what it hands on must name records that exist.
  const dangling=collab(tree(t),[row({reads:['demo.sales.business.srs.rule.refund-window'],hands:['demo.collab.architecture.sds.flow.share']})]);
  assert.deepEqual(codes(run(dangling)),['new-unknown']);
  assert.match(run(dangling).findings[0].detail,/declares an id the tree does not hold: demo\.collab\.architecture\.sds\.flow\.share/);
});

test('new-reads-blind: a new row may cite only the record kinds its own record kind is derived from',t=>{
  // The catalog of design §2, by layout and by derivation: the rule is data, not a feeling about the path.
  assert.equal(recordKindOfNode({path:'features/sales/business/srs/rule/refund-window/index.yaml'}),'srs');
  assert.equal(recordKindOfNode({path:'features/sales/business/srs/decisions/d-1/index.yaml'}),'decision');
  assert.equal(recordKindOfNode({path:'features/sales/architecture/sds/contract/x/index.yaml'}),'sds');
  assert.equal(recordKindOfNode({path:'features/sales/ui/intake/index.yaml'}),'design');
  assert.equal(recordKindOfNode({path:'brand/index.yaml'}),'brand');
  assert.equal(recordKindOfNode({path:'features/sales/index.yaml'}),'record');
  assert.deepEqual(recordReadsOf('sds'),['sds','srs','decision']);
  // A record may always cite its own kind: a rule that refines another rule is a peer, not a derivation.
  assert.deepEqual(recordReadsOf('srs'),['srs','decision']);
  assert.deepEqual(recordReadsOf('nonsense'),[]);
  // An srs requirement of collab citing the sds of sales: a requirement is not derived from a design.
  const fixture=collab(tree(t),[
    {case:'new',record:'demo.collab.business.srs.fr.share-thread',
      reads:['demo.sales.architecture.sds.contract.intake-command'],hands:[],detail:'sharing a thread'}]);
  const result=reconcileIntake({op:{intake:{scope:'collab'}},tree:fixture.loaded(),readNode:fixture.readNode});
  assert.deepEqual(codes(result),['new-reads-blind']);
  assert.match(result.findings[0].detail,/is a srs record, which is derived from srs, decision; it cites demo\.sales\.architecture\.sds\.contract\.intake-command \(sds\)/);
  // The same row citing the decided requirement it really rests on is clean.
  const sound=collab(tree(t),[REFERENCE_ROW,
    {case:'new',record:'demo.collab.business.srs.fr.share-thread',
      reads:['demo.sales.business.srs.rule.refund-window'],hands:[],detail:'sharing a thread'}]);
  assert.deepEqual(codes(reconcileIntake({op:{intake:{scope:'collab'}},tree:sound.loaded(),readNode:sound.readNode})),[]);
});

/**
 * The whole rule over one honest table: three rows, one of each case, nothing wrong with any of them. What
 * comes back is what the kernel writes into `reconciled` and what it puts to the owner.
 */
test('a full pass counts the three cases and hands the conflict to the owner with its numbered options',t=>{
  const fixture=collab(tree(t),[
    REFERENCE_ROW,
    {case:'conflict',record:'demo.sales.architecture.sds.contract.intake-command',
      decision:'demo.collab.business.srs.decision.d-intake-contract',
      detail:'collab needs an asynchronous intake; sales decided a synchronous contract'},
    {case:'new',record:'demo.collab.business.srs.fr.share-thread',
      reads:['demo.sales.business.srs.rule.refund-window'],hands:['demo.collab.architecture.sds.flow.share'],
      detail:'sharing a thread is a capability no decided record covers'}
  ]);
  fixture.write('features/collab/architecture/sds/flow/share/index.yaml',
    {id:'demo.collab.architecture.sds.flow.share',kind:'architecture',state:'todo',description:'The share flow'});
  fixture.write('features/collab/business/srs/decisions/d-intake-contract/index.yaml',
    {id:'demo.collab.business.srs.decision.d-intake-contract',kind:'decision',state:'todo',
      description:['Which intake contract holds once collab exists?',
        'Sales decided a synchronous command; collab cannot answer inside one request.',
        '1. Keep the synchronous contract and let collab queue behind it.',
        '2. Make the intake asynchronous for both features and revise the sales contract.',
        '3. Give collab its own asynchronous contract beside the sales one.'].join('\n')});
  const loaded=fixture.loaded();
  const result=reconcileIntake({op:{intake:{scope:'collab'}},tree:loaded,readNode:fixture.readNode,
    digests:recordDigests(loaded,fixture.readFile),readFile:fixture.readFile});
  assert.equal(result.ok,true);
  assert.deepEqual(result.findings,[]);
  assert.deepEqual(result.counts,{reference:1,conflict:1,new:1});
  assert.deepEqual(result.conflicts,[{record:'demo.sales.architecture.sds.contract.intake-command',
    decision:'demo.collab.business.srs.decision.d-intake-contract',
    options:['Keep the synchronous contract and let collab queue behind it.',
      'Make the intake asynchronous for both features and revise the sales contract.',
      'Give collab its own asynchronous contract beside the sales one.'],
    detail:'collab needs an asynchronous intake; sales decided a synchronous contract'}]);
  // The options can also be authored as data, and then they are read as they stand rather than parsed from prose.
  assert.deepEqual(decisionOptions({extensions:{work3:{decision:{options:[{text:'one'},'two']}}}}),['one','two']);
  // A reference row changes nothing and a new row is simply the record the next sync sees: only the conflict asks.
  assert.deepEqual(conflictQuestions([REFERENCE_ROW],{tree:loaded,readNode:fixture.readNode}),[]);
});

/**
 * The first feature of an empty product reconciles with nothing. The rule must not invent a table for it, or
 * every product would begin with a failed intake.
 */
test('a tree with no other decided records needs no table at all',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-reconciliation-first-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'features','collab','index.yaml');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,stringifyYaml({schema:'work/node@2',required:true,id:'demo.collab',kind:'module',description:'Collaboration'}));
  const loaded={ok:true,workRoot:root,list:[
    {id:'demo.collab',kind:'module',path:'features/collab/index.yaml',state:null},
    // A draft of the feature itself, and a decided record of the same feature: neither is another feature's.
    {id:'demo.collab.business.srs.fr.share-thread',kind:'business',path:'features/collab/business/srs/fr/share-thread/index.yaml',state:'done'}]};
  const result=reconcileIntake({op:{intake:{scope:'collab'}},tree:loaded,readNode:()=>({schema:'work/node@2'})});
  assert.equal(result.ok,true);
  assert.deepEqual(result.findings,[]);
  assert.deepEqual(result.counts,{reference:0,conflict:0,new:0});
  assert.deepEqual(result.conflicts,[]);
  // The check reports the same thing when it is called on its own, which is how the kernel's own test drives it.
  assert.deepEqual(checkReconciliation([],{tree:loaded,scope:'collab',readNode:()=>null}),
    {ok:true,findings:[],counts:{reference:0,conflict:0,new:0}});
});
