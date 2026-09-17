import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WORKFLOW_STATE,createStore,eventDigest,eventsHead,listWorkflows,newWorkflowId,replaceStateSnapshot,repositoryRoot,workflowsRoot} from '../kernel/store.mjs';
import {ledgerFileFor,openLedger} from '../kernel/ledger-db.mjs';

const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-store-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const state=extra=>({schema:WORKFLOW_STATE,phase:'plan',...extra});
const ID='20260912-104251-demo';
/** One teardown per test: every tracked handle closes before the tracked directories are removed. */
const fixture=t=>{const closers=[],dirs=[];
  t.after(()=>{for(const close of [...closers].reverse())close();for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true});});
  return {repo(){const dir=tmp();dirs.push(dir);return dir;},track(handle){closers.push(()=>handle.close());return handle;}};};

test('a workflow id is sortable by time and safe as a directory name',()=>{
  const id=newWorkflowId('Rebuild the Weekly League Board!',()=>Date.UTC(2026,8,12,10,42,51));
  assert.equal(id,'20260912-104251-rebuild-the-weekly-league-board');
  assert.match(newWorkflowId('x'),/^\d{8}-\d{6}-[a-z0-9-]+$/);
  const long=newWorkflowId('A'.repeat(10)+' very '+'long '.repeat(20)+'title',()=>0);
  assert.equal(long,'19700101-000000-aaaaaaaaaa-very-long-long-long-long-long');
  assert.equal(newWorkflowId('***',()=>0),'19700101-000000-workflow');
});

test('opening a store uses the ledger and creates nothing under _local',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.equal(store.dir,null);
  assert.equal(store.id,ID);
  assert.equal(store.ledgerFile,path.join(repo,'.starciwork','runtime.sqlite'));
  assert.ok(fs.existsSync(store.ledgerFile));
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local')),false,'no _local subtree is created');
  assert.equal(store.continuation,path.join(repo,'workflows',`${ID}.md`));
  for(const name of ['state','events','goal','goalJson','reports','contracts','checks','inbox','final','launch','continuation'])
    assert.throws(()=>store.paths[name],new RegExp(`store-paths-removed:${name}`),name);
  assert.throws(()=>{store.paths.state='x';},/store-paths-removed:state/);
  for(const method of ['reportPath','contractPath','checksPath'])
    assert.throws(()=>store[method]('op-1'),new RegExp(`store-paths-removed:${method}`),method);
  assert.throws(()=>createStore({repoRoot:repo,id:'a/b'}),/one directory segment/);
  assert.throws(()=>createStore({repoRoot:repo,id:' '}),/Missing workflow id/);
});

test('a _local workflow directory with no workflows row is unmigrated and refuses closed',t=>{
  const fx=fixture(t),repo=fx.repo(),ledger=fx.track(openLedger({file:ledgerFileFor(repo)}));
  fs.mkdirSync(path.join(workflowsRoot(repo),ID),{recursive:true});
  assert.throws(()=>createStore({repoRoot:repo,id:ID}),new RegExp(`ledger-unmigrated:${ID}`));
  // Once the ledger owns a row for it (migrated, `_local` kept as the import source), the store opens.
  ledger.ensureWorkflow({workflowId:ID});
  assert.equal(fx.track(createStore({repoRoot:repo,id:ID})).id,ID);
});

test('the audit log is append-only, hash-chained, and keeps counting after the store is re-opened',t=>{
  const fx=fixture(t),repo=fx.repo();
  const first=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.equal(first.appendEvent({event:'workflow.start'}).seq,1);
  assert.equal(first.appendEvent({event:'op.dispatch',op:'backend.implement'}).seq,2);
  const second=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.equal(second.appendEvent({event:'op.report',outcome:'done'}).seq,3);
  const all=second.readEvents();
  assert.deepEqual(all.map(event=>event.seq),[1,2,3]);
  assert.deepEqual(all.map(event=>event.event),['workflow.start','op.dispatch','op.report']);
  assert.ok(all.every(event=>Number.isInteger(event.at)));
  assert.deepEqual(second.readEvents({since:2}).map(event=>event.event),['op.report']);
  assert.throws(()=>second.appendEvent({seq:9}),/assigned by the log/);
  assert.throws(()=>second.appendEvent('nope'),/must be an object/);
  // The rows are the record: workflow entity, generation 0 before any binding, verified chain.
  const rows=second.ledger.db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(ID);
  assert.ok(rows.every(row=>row.entity_type==='workflow'&&row.entity_id===ID&&row.generation===0));
  assert.equal(rows[0].prev_digest,null);
  assert.equal(second.ledger.verifyChain({workflowId:ID}).ok,true);
  rows.reduce((prev,row)=>{
    assert.equal(row.digest,eventDigest({prevDigest:prev,eventId:row.event_id,kind:row.kind,payloadJson:row.payload_json,createdAt:row.created_at}));
    return row.digest;
  },null);
});

test('rotateEvents records one closure event per retired generation and moves on',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.appendEvent({event:'workflow.start'});
  assert.deepEqual(store.rotateEvents(1),{rotated:null,generation:1});
  assert.deepEqual(store.rotateEvents(1),{rotated:null,generation:1});
  const closures=store.readEvents().filter(event=>event.event==='events-generation-closed');
  assert.equal(closures.length,1,'a retired generation records its closure once');
  assert.equal(closures[0].generation,1);
  assert.throws(()=>store.rotateEvents(0),/retired generation/);
  assert.equal(store.ledger.verifyChain({workflowId:ID}).ok,true);
});

test('state round-trips through ledger snapshots, unbound at generation 0 and bound at the enrolled generation',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID})),ledger=fx.track(openLedger({file:ledgerFileFor(repo)}));
  assert.equal(store.loadState(),null);
  store.saveState(state({goal:'Ship the board'}));
  assert.deepEqual(store.loadState(),{schema:WORKFLOW_STATE,phase:'plan',goal:'Ship the board'});
  const zero=store.ledger.db.prepare('SELECT generation FROM state_snapshots WHERE workflow_id=?').all(ID);
  assert.deepEqual(zero.map(row=>row.generation),[0]);
  assert.equal(store.bindJournal(ledger,3),store);
  assert.equal(store.loadState().goal,'Ship the board','the bound seed is the latest snapshot, not a file');
  store.saveState(state({goal:'Ship the board',phase:'execute'}));
  assert.equal(store.loadState().phase,'execute');
  const bound=store.ledger.db.prepare("SELECT generation,goal_identity,events_head FROM state_snapshots WHERE workflow_id=? AND generation=3").all(ID);
  assert.ok(bound.length>0&&bound.every(row=>row.generation===3));
  assert.equal(bound.at(-1).events_head,eventsHead(store.ledger.db,ID),'every snapshot pins the chain tip');
  assert.throws(()=>store.saveState({phase:'execute'}),/schema starci\/workflow-state@1/);
  assert.throws(()=>store.saveState(state({goal:'Different goal',inputs:['x']})),/goal identity changed/);
  assert.throws(()=>store.saveState(state({goal:'Ship the board',plaintext:'hunter2'})),/raw secret/);
  store.unbindJournal(ledger);
  assert.throws(()=>store.transition(state({goal:'Ship the board'}),{transitionId:'x',apply:()=>{}}),/bound ledger/);
});

test('bindJournal refuses a handle on a different ledger and a generation bound to another goal',t=>{
  const fx=fixture(t),repo=fx.repo(),other=fx.repo();
  const store=fx.track(createStore({repoRoot:repo,id:ID})),foreign=fx.track(openLedger({file:ledgerFileFor(other)})),ledger=fx.track(openLedger({file:ledgerFileFor(repo)}));
  assert.throws(()=>store.bindJournal(foreign,1,{state:state({})}),new RegExp(`ledger-binding-mismatch:${ID}`));
  const first=state({goal:'g1'}),second=state({goal:'g2',inputs:['i']});
  store.bindJournal(ledger,1,{state:first});
  store.unbindJournal(ledger);
  assert.throws(()=>store.bindJournal(ledger,1,{state:second}),/different approved goal/);
  assert.throws(()=>store.bindJournal(ledger,0,{state:first}),/positive generation/);
  assert.throws(()=>store.bindJournal(null,1),/ledger handle/);
});

test('transition persists exactly once; replay returns the latest state without a second insert',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID})),ledger=fx.track(openLedger({file:ledgerFileFor(repo)}));
  const seed=state({goal:'g'});
  store.bindJournal(ledger,1,{state:seed});
  const next=store.transition(seed,{transitionId:'op-created:op-1',event:{kind:'op-created',payload:{op:'op-1'}},apply:draft=>{draft.ops=[{id:'op-1'}];}});
  assert.deepEqual(next.ops,[{id:'op-1'}]);
  const count=()=>store.ledger.db.prepare('SELECT count(*) n FROM state_snapshots WHERE workflow_id=?').get(ID).n;
  const before=count();
  const replayed=store.transition(seed,{transitionId:'op-created:op-1',apply:draft=>{draft.ops=[{id:'other'}];}});
  assert.deepEqual(replayed.ops,[{id:'op-1'}],'replay returns the recorded state');
  assert.equal(count(),before,'no second insert');
  const transitionEvent=store.ledger.db.prepare("SELECT kind FROM events WHERE workflow_id=? AND event_id=?").get(ID,`transition:${ID}:op-created:op-1`);
  assert.equal(transitionEvent?.kind,'op-created');
  assert.throws(()=>store.transition(seed,{transitionId:'drift',apply:draft=>{draft.goal='moved';draft.inputs=['x'];}}),/goal identity/);
  assert.equal(store.ledger.verifyChain({workflowId:ID}).ok,true);
});

test('reports, contracts and checks round-trip through their tables',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.deepEqual(store.readReports(),[]);
  store.writeReport({dispatchId:'ctx_b',opId:'op-2',attempt:1,report:{schema:'starci/op-report@1',dispatch:'ctx_b',outcome:'partial',open:['rest']}});
  store.writeReport({dispatchId:'ctx_a',report:{schema:'starci/op-report@1',dispatch:'ctx_a',outcome:'done'},fromTerminal:'term-9'});
  store.writeReport({dispatchId:'ctx_b',report:{schema:'starci/op-report@1',dispatch:'ctx_b',outcome:'done'},outcome:'done'});
  const reports=store.readReports();
  assert.deepEqual(reports.map(report=>report.dispatch),['ctx_a','ctx_b'],'ordered by dispatch id');
  assert.equal(reports[1].outcome,'done','the second report for a dispatch replaces the first');
  assert.equal(reports[0].fromTerminal,'term-9');
  assert.equal(reports[0].consumedAt,null);
  assert.equal(reports[1].opId,'op-2');
  assert.throws(()=>store.writeReport({dispatchId:'ctx_c'}),/outcome/);
  store.writeContract({opId:'op-1',attempt:1,dispatchId:'ctx_1',markdown:'# contract v1',context:{allowlist:['a/**']}});
  store.writeContract({opId:'op-1',attempt:2,markdown:'# contract v2'});
  assert.equal(store.readContract('op-1').markdown,'# contract v2','default read is the latest attempt');
  assert.deepEqual(store.readContract('op-1',1).context,{allowlist:['a/**']});
  assert.equal(store.readContract('missing'),null);
  store.writeChecks({opId:'op-1',attempt:1,checks:[{name:'t',exitCode:0}]});
  assert.deepEqual(store.readChecks('op-1'),[{name:'t',exitCode:0}]);
  assert.equal(store.readChecks('op-1',9),null);
});

test('inbox rows are pushed pending and settled with a disposition',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.deepEqual(store.inbox.pending(),[]);
  const pushed=store.inbox.push({kind:'owner-answer',key:'ask-1',payload:{text:'yes'}});
  store.inbox.push({kind:'amendment',payload:{markdown:'more'}});
  assert.equal(pushed.status,'pending');
  const pending=store.inbox.pending();
  assert.equal(pending.length,2);
  assert.deepEqual(pending[0].payload,{text:'yes'});
  assert.equal(pending[0].id,pushed.id);
  assert.equal(store.inbox.settle(pushed.id,'applied',{note:'taken'}),true);
  assert.equal(store.inbox.settle(9999,'applied'),false);
  assert.deepEqual(store.inbox.pending().map(row=>row.kind),['amendment']);
  const settled=store.ledger.db.prepare('SELECT status,disposition_json,applied_at FROM inbox WHERE inbox_id=?').get(pushed.id);
  assert.equal(settled.status,'applied');
  assert.deepEqual(JSON.parse(settled.disposition_json),{note:'taken'});
  assert.ok(Number.isInteger(settled.applied_at));
});

test('signals carry locks and payloads, workflow-scoped or ledger-wide',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.equal(store.signal.get(ID,'kernel-lock'),null);
  const held=store.signal.set(ID,'kernel-lock',{pid:process.pid,token:'tok',ttl:60000});
  assert.equal(held.pid,process.pid);
  assert.ok(held.expiresAt>held.at);
  assert.equal(store.signal.get(ID,'kernel-lock').token,'tok');
  store.signal.set('*','supervisor-lock',{pid:1,value:{role:'supervisor'}});
  assert.deepEqual(store.signal.get('*','supervisor-lock').value,{role:'supervisor'});
  store.signal.set(ID,'stop');
  assert.ok(store.signal.get(ID,'stop'));
  assert.equal(store.signal.clear(ID,'stop'),true);
  assert.equal(store.signal.get(ID,'stop'),null);
  assert.equal(store.signal.clear(ID,'stop'),false);
  assert.equal(store.signal.get(ID,'kernel-lock').token,'tok','clearing one key leaves the others');
});

test('goal revisions append and workflows.goal_identity follows the latest',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  assert.equal(store.goal(),null);
  const first=store.setGoal({markdown:'# Build the board',json:{schema:'starci/workflow-goal@1',rev:1,job:'board'}});
  assert.equal(first.revision,1);
  const second=store.setGoal({markdown:'# Build the board, amended',json:{schema:'starci/workflow-goal@1',rev:2,job:'board'},amendment:{digest:'abc'}});
  assert.equal(second.revision,2);
  const current=store.goal();
  assert.equal(current.revision,2);
  assert.equal(current.markdown,'# Build the board, amended');
  assert.deepEqual(current.amendment,{digest:'abc'});
  assert.equal(current.identity,second.identity);
  assert.equal(store.ledger.db.prepare('SELECT goal_identity FROM workflows WHERE workflow_id=?').get(ID).goal_identity,second.identity);
  const rows=store.ledger.db.prepare('SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision').all(ID);
  assert.deepEqual(rows.map(row=>row.revision),[1,2],'every revision is kept, append-only');
});

test('the continuation projection is the one runtime-owned file still acknowledged on disk',t=>{
  const fx=fixture(t),repo=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID})),ledger=fx.track(openLedger({file:ledgerFileFor(repo)}));
  const file=store.continuation;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'# brief\n');
  assert.equal(store.acknowledgeRuntimeFile(file),null,'unbound: nothing to bind the receipt to');
  store.bindJournal(ledger,1,{state:state({goal:'g'})});
  const receipt=store.acknowledgeRuntimeFile(file,`workflows/${ID}.md`,'replace');
  assert.equal(receipt.state,'file');
  assert.equal(receipt.relative,`workflows/${ID}.md`);
  const row=store.ledger.db.prepare("SELECT * FROM events WHERE workflow_id=? AND entity_type='runtime-file'").get(ID);
  assert.equal(row.kind,'runtime-file-written');
  assert.equal(row.entity_id,`workflows/${ID}.md`);
  assert.equal(JSON.parse(row.payload_json).sha256,receipt.sha256);
  assert.throws(()=>store.acknowledgeRuntimeFile(path.join(repo,'elsewhere.md')),/continuation projection/);
  assert.throws(()=>store.acknowledgeRuntimeFile(path.join(repo,'workflows','x.json')),/continuation projection/);
  assert.throws(()=>store.acknowledgeRuntimeFile(file,'other.md'),/does not match/);
  assert.equal(store.ledger.verifyChain({workflowId:ID}).ok,true);
});

test('exportTo reproduces the file layout a human reads, in seq order',t=>{
  const fx=fixture(t),repo=fx.repo(),out=fx.repo(),store=fx.track(createStore({repoRoot:repo,id:ID}));
  store.appendEvent({event:'workflow.start'});
  store.appendEvent({event:'op.dispatch',op:'op-1'});
  store.saveState(state({goal:'g'}));
  store.setGoal({markdown:'# goal',json:{rev:1}});
  store.writeReport({dispatchId:'ctx_1',report:{dispatch:'ctx_1',outcome:'done'}});
  store.writeContract({opId:'op-1',attempt:1,markdown:'# c1'});
  store.writeContract({opId:'op-1',attempt:2,markdown:'# c2'});
  store.writeChecks({opId:'op-1',attempt:1,checks:[{name:'lint',exitCode:0}]});
  const result=store.exportTo(out);
  assert.equal(result.dir,out);
  for(const name of ['state.json','events.jsonl','goal.md','goal.json','reports/ctx_1.json','contracts/op-1.attempt-1.md','contracts/op-1.attempt-2.md','checks/op-1.json'])
    assert.ok(result.files.includes(name),name);
  const lines=fs.readFileSync(path.join(out,'events.jsonl'),'utf8').split('\n').filter(Boolean).map(line=>JSON.parse(line));
  assert.deepEqual(lines.map(event=>event.seq),[1,2],'events.jsonl replays in seq order');
  assert.deepEqual(lines.map(event=>event.event),['workflow.start','op.dispatch']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'state.json'),'utf8')).goal,'g');
  assert.equal(fs.readFileSync(path.join(out,'goal.md'),'utf8'),'# goal');
  assert.equal(JSON.parse(fs.readFileSync(path.join(out,'reports','ctx_1.json'),'utf8')).outcome,'done');
  assert.equal(fs.readFileSync(path.join(out,'contracts','op-1.attempt-2.md'),'utf8'),'# c2');
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local')),false,'export never touches _local');
});

test('listWorkflows reads the ledger newest first, with the latest state body joined',t=>{
  const fx=fixture(t),repo=fx.repo();
  assert.deepEqual(listWorkflows(repo),[],'no ledger file, no workflows');
  const stores=['20260910-090000-older','20260912-104251-newest','20260912-080000-middle'].map(id=>fx.track(createStore({repoRoot:repo,id})));
  stores[1].saveState(state({phase:'review'}));
  const listed=listWorkflows(repo);
  assert.deepEqual(listed.map(item=>item.id),['20260912-104251-newest','20260912-080000-middle','20260910-090000-older']);
  assert.equal(listed[0].state.phase,'review');
  assert.equal(listed[1].state,null);
  assert.ok(listed.every(item=>item.dir===null&&item.updatedAt>0));
});

test('transient Windows replacement denial preserves the old complete snapshot until atomic promotion',t=>{
  const repo=tmp();t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const file=path.join(repo,'state.json'),pending=path.join(repo,'state.pending');
  const old=JSON.stringify(state({phase:'plan'})),next=JSON.stringify(state({phase:'run'}));
  fs.writeFileSync(file,old);fs.writeFileSync(pending,next);let calls=0;const waits=[];
  replaceStateSnapshot(pending,file,{platform:'win32',wait:ms=>waits.push(ms),rename:(from,to)=>{
    assert.equal(fs.readFileSync(file,'utf8'),old,'a waiting reader always sees the complete old state');
    if(calls++<2)throw Object.assign(Error('reader sharing violation'),{code:'EPERM'});
    return fs.renameSync(from,to);
  }});
  assert.equal(calls,3);assert.equal(waits.length,2);assert.equal(fs.readFileSync(file,'utf8'),next);assert.equal(fs.existsSync(pending),false);
});

test('persistent Windows replacement failure is bounded and preserves both complete snapshots',t=>{
  const repo=tmp();t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const file=path.join(repo,'state.json'),pending=path.join(repo,'state.pending');
  fs.writeFileSync(file,'old');fs.writeFileSync(pending,'new');let calls=0,waited=0;
  const failure=Object.assign(Error('persistent sharing violation'),{code:'EACCES'});
  assert.throws(()=>replaceStateSnapshot(pending,file,{platform:'win32',wait:ms=>{waited+=ms;},rename:()=>{calls++;throw failure;}}),error=>error===failure);
  assert.ok(calls>1&&calls<=6);assert.ok(waited>0&&waited<1000);
  assert.equal(fs.readFileSync(file,'utf8'),'old');assert.equal(fs.readFileSync(pending,'utf8'),'new');
});

test('snapshot replacement does not retry unrelated errors or non-Windows failures',()=>{
  for(const [platform,code] of [['win32','ENOENT'],['linux','EPERM']]){
    let calls=0;const failure=Object.assign(Error('non-transient replacement failure'),{code});
    assert.throws(()=>replaceStateSnapshot('pending','state',{platform,wait:()=>assert.fail('unexpected retry'),rename:()=>{calls++;throw failure;}}),error=>error===failure);
    assert.equal(calls,1);
  }
});

test('a linked worktree resolves to the main repository, so one product has one ledger',()=>{
  const root=repositoryRoot(process.cwd());
  assert.ok(fs.existsSync(path.join(root,'.git')));
  assert.equal(workflowsRoot(root),path.join(root,'.starciwork','_local','workflows'));
});
