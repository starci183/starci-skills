import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WORKFLOW_STATE,createStore,listWorkflows,newWorkflowId,replaceStateSnapshot,repositoryRoot,workflowsRoot} from '../kernel/store.mjs';
import {trackHandles} from './_ledger-fixture.mjs';

const tmp=()=>{const dir=path.join(os.tmpdir(),'starci-workflow-store-spec',`${Date.now()}-${Math.random().toString(16).slice(2)}`);fs.mkdirSync(dir,{recursive:true});return dir;};
const state=extra=>({schema:WORKFLOW_STATE,phase:'plan',...extra});

test('a workflow id is sortable by time and safe as a directory name',()=>{
  const id=newWorkflowId('Rebuild the Weekly League Board!',()=>Date.UTC(2026,8,12,10,42,51));
  assert.equal(id,'20260912-104251-rebuild-the-weekly-league-board');
  assert.match(newWorkflowId('x'),/^\d{8}-\d{6}-[a-z0-9-]+$/);
  const long=newWorkflowId('A'.repeat(10)+' very '+'long '.repeat(20)+'title',()=>0);
  assert.equal(long,'19700101-000000-aaaaaaaaaa-very-long-long-long-long-long');
  assert.ok(long.split('-').at(-1).length>0&&long.length-16<=40);
  assert.equal(newWorkflowId('***',()=>0),'19700101-000000-workflow');
});

test('opening a store uses the ledger and creates nothing under _local',t=>{
  const track=trackHandles(t),repo=tmp();
  t.after(()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true}));
  const store=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.equal(store.dir,null,'no per-workflow directory exists any more - everything is a row');
  assert.equal(store.ledgerFile,path.join(repo,'.starciwork','runtime.sqlite'));
  assert.ok(fs.existsSync(store.ledgerFile));
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local')),false,'no _local subtree is created');
  for(const name of ['state','events','goal','reports','contracts','checks','inbox'])
    assert.throws(()=>store.paths[name],new RegExp(`store-paths-removed:${name}`),name);
  for(const method of ['reportPath','contractPath','checksPath'])
    assert.throws(()=>store[method]('op-1'),new RegExp(`store-paths-removed:${method}`),method);
  assert.throws(()=>createStore({repoRoot:repo,id:'a/b'}),/one directory segment/);
  assert.throws(()=>createStore({repoRoot:repo,id:' '}),/Missing workflow id/);
});

test('the event log is append only and its seq keeps counting after the store is re-opened',t=>{
  const track=trackHandles(t),repo=tmp();
  t.after(()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true}));
  const first=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.equal(first.appendEvent({event:'workflow.start'}).seq,1);
  assert.equal(first.appendEvent({event:'op.dispatch',op:'backend.implement'}).seq,2);
  const reopened=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.equal(reopened.appendEvent({event:'op.report',outcome:'done'}).seq,3);
  const all=reopened.readEvents();
  assert.deepEqual(all.map(event=>event.seq),[1,2,3]);
  assert.deepEqual(all.map(event=>event.event),['workflow.start','op.dispatch','op.report']);
  assert.ok(all.every(event=>Number.isInteger(event.at)));
  assert.deepEqual(reopened.readEvents({since:2}).map(event=>event.event),['op.report']);
  assert.equal(first.readEvents().length,3,'a second handle on the same row is still the same append-only log');
  assert.throws(()=>first.appendEvent({seq:9}),/assigned by the log/);
  assert.throws(()=>first.appendEvent('nope'),/must be an object/);
  const third=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.equal(third.appendEvent({event:'x'}).seq,4,'the seq keeps counting across every re-open, there is no file to go stale');
});

test('state round-trips through the ledger, survives a re-open, and refuses the wrong schema',t=>{
  const track=trackHandles(t),repo=tmp();
  t.after(()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true}));
  const store=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.equal(store.loadState(),null);
  store.saveState(state({goal:'Ship the board'}));
  assert.deepEqual(store.loadState(),{schema:WORKFLOW_STATE,phase:'plan',goal:'Ship the board'});
  store.saveState(state({phase:'execute',ops:[{id:'op-1',status:'dispatched'}]}));
  assert.equal(store.loadState().phase,'execute');
  assert.throws(()=>store.saveState({phase:'execute'}),/schema starci\/workflow-state@1/);
  // A fresh handle on the same repo reads the same ledger row - there is no per-process file cache to miss.
  const reopened=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.equal(reopened.loadState().phase,'execute');
});

test('reports are written and read back by dispatch id, and a second write for the same dispatch upserts rather than duplicates',t=>{
  const track=trackHandles(t),repo=tmp();
  t.after(()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true}));
  const store=track(createStore({repoRoot:repo,id:'20260912-104251-demo'}));
  assert.deepEqual(store.readReports(),[]);
  store.writeReport({dispatchId:'ctx_a',opId:'op-1',attempt:1,outcome:'done'});
  store.writeReport({dispatchId:'ctx_b',opId:'op-2',attempt:1,outcome:'partial'});
  assert.deepEqual(store.readReports().map(report=>report.dispatchId),['ctx_a','ctx_b']);
  store.writeReport({dispatchId:'ctx_a',opId:'op-1',attempt:2,outcome:'done'});
  const reports=store.readReports();
  assert.equal(reports.length,2,'the same dispatch id upserts in place, it never accumulates a second row');
  assert.equal(reports.find(report=>report.dispatchId==='ctx_a').attempt,2);
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

test('listWorkflows returns every workflow of the repository newest first with its state',t=>{
  const track=trackHandles(t),repo=tmp();
  t.after(()=>fs.rmSync(path.dirname(repo),{recursive:true,force:true}));
  assert.deepEqual(listWorkflows(repo),[]);
  track(createStore({repoRoot:repo,id:'20260910-090000-older'}));
  track(createStore({repoRoot:repo,id:'20260912-104251-newest'})).saveState(state({phase:'review'}));
  track(createStore({repoRoot:repo,id:'20260912-080000-middle'}));
  const listed=listWorkflows(repo);
  assert.deepEqual(listed.map(item=>item.id),['20260912-104251-newest','20260912-080000-middle','20260910-090000-older']);
  assert.equal(listed[0].state.phase,'review');
  assert.equal(listed[1].state,null);
  assert.equal(listed[0].dir,null,'there is no per-workflow directory to report any more');
  assert.ok(listed.every(item=>item.updatedAt>0));
});

test('a linked worktree resolves to the main repository, so one product has one workflows root',()=>{
  const root=repositoryRoot(process.cwd());
  assert.ok(fs.existsSync(path.join(root,'.git')));
  assert.equal(workflowsRoot(root),path.join(root,'.starciwork','_local','workflows'));
});
