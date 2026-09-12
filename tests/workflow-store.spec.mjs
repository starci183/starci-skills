import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {WORKFLOW_STATE,createStore,listWorkflows,newWorkflowId,repositoryRoot,workflowsRoot} from '../execution/workflow-store.mjs';

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

test('opening a store creates the single workflow directory and nothing outside it',()=>{
  const repo=tmp();
  try{
    const store=createStore({repoRoot:repo,id:'20260912-104251-demo'});
    assert.equal(store.dir,path.join(workflowsRoot(repo),'20260912-104251-demo'));
    for(const key of ['reports','contracts','checks','inbox'])assert.ok(fs.statSync(store.paths[key]).isDirectory(),key);
    assert.equal(store.paths.state,path.join(store.dir,'state.json'));
    assert.equal(store.paths.events,path.join(store.dir,'events.jsonl'));
    assert.equal(store.reportPath('ctx_op'),path.join(store.dir,'reports','ctx_op.json'));
    assert.equal(store.contractPath('op-1'),path.join(store.dir,'contracts','op-1.md'));
    assert.equal(store.checksPath('op-1'),path.join(store.dir,'checks','op-1.json'));
    assert.deepEqual(fs.readdirSync(path.join(repo,'.starciwork','_local')),['workflows']);
    assert.throws(()=>createStore({repoRoot:repo,id:'a/b'}),/one directory segment/);
    assert.throws(()=>createStore({repoRoot:repo,id:' '}),/Missing workflow id/);
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
});

test('the event log is append only and its seq keeps counting after the store is re-opened',()=>{
  const repo=tmp();
  try{
    const first=createStore({repoRoot:repo,id:'20260912-104251-demo'});
    assert.equal(first.appendEvent({kind:'workflow.start'}).seq,1);
    assert.equal(first.appendEvent({kind:'op.dispatch',op:'backend.implement'}).seq,2);
    const reopened=createStore({repoRoot:repo,id:'20260912-104251-demo'});
    assert.equal(reopened.appendEvent({kind:'op.report',outcome:'done'}).seq,3);
    const all=reopened.readEvents();
    assert.deepEqual(all.map(event=>event.seq),[1,2,3]);
    assert.deepEqual(all.map(event=>event.kind),['workflow.start','op.dispatch','op.report']);
    assert.ok(all.every(event=>Number.isInteger(event.at)));
    assert.deepEqual(reopened.readEvents({since:2}).map(event=>event.kind),['op.report']);
    assert.equal(first.readEvents().length,3);
    assert.throws(()=>first.appendEvent({seq:9}),/assigned by the log/);
    assert.throws(()=>first.appendEvent('nope'),/must be an object/);
    fs.appendFileSync(first.paths.events,'{ not json\n\n');
    assert.deepEqual(first.readEvents().map(event=>event.seq),[1,2,3]);
    assert.equal(createStore({repoRoot:repo,id:'20260912-104251-demo'}).appendEvent({kind:'x'}).seq,4);
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
});

test('state is written atomically through a tmp file that never survives the write',()=>{
  const repo=tmp();
  try{
    const store=createStore({repoRoot:repo,id:'20260912-104251-demo'});
    assert.equal(store.loadState(),null);
    store.saveState(state({goal:'Ship the board'}));
    assert.deepEqual(store.loadState(),{schema:WORKFLOW_STATE,phase:'plan',goal:'Ship the board'});
    store.saveState(state({phase:'execute',ops:[{id:'op-1',status:'dispatched'}]}));
    assert.equal(store.loadState().phase,'execute');
    assert.deepEqual(fs.readdirSync(store.dir).filter(name=>name.includes('tmp')),[]);
    assert.deepEqual(fs.readdirSync(store.dir).sort(),['checks','contracts','inbox','reports','state.json']);
    assert.throws(()=>store.saveState({phase:'execute'}),/schema starci\/workflow-state@1/);
    fs.writeFileSync(store.paths.state,'{ truncated');
    assert.equal(store.loadState(),null);
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
});

test('reading reports skips the wait state, non-JSON names and unreadable files',()=>{
  const repo=tmp();
  try{
    const store=createStore({repoRoot:repo,id:'20260912-104251-demo'});
    assert.deepEqual(store.readReports(),[]);
    fs.writeFileSync(store.reportPath('ctx_a'),JSON.stringify({dispatch:'ctx_a',outcome:'done'}));
    fs.writeFileSync(store.reportPath('ctx_b'),JSON.stringify({dispatch:'ctx_b',outcome:'partial'}));
    fs.writeFileSync(path.join(store.paths.reports,'wait-state.json'),JSON.stringify({deliveryId:'delivery_2'}));
    fs.writeFileSync(path.join(store.paths.reports,'broken.json'),'{ half written');
    fs.writeFileSync(path.join(store.paths.reports,'notes.md'),'not a report');
    assert.deepEqual(store.readReports().map(report=>report.dispatch),['ctx_a','ctx_b']);
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
});

test('listWorkflows returns every workflow of the repository newest first with its state',()=>{
  const repo=tmp();
  try{
    assert.deepEqual(listWorkflows(repo),[]);
    createStore({repoRoot:repo,id:'20260910-090000-older'});
    createStore({repoRoot:repo,id:'20260912-104251-newest'}).saveState(state({phase:'review'}));
    createStore({repoRoot:repo,id:'20260912-080000-middle'});
    fs.writeFileSync(path.join(workflowsRoot(repo),'stray.json'),'{}');
    const listed=listWorkflows(repo);
    assert.deepEqual(listed.map(item=>item.id),['20260912-104251-newest','20260912-080000-middle','20260910-090000-older']);
    assert.equal(listed[0].state.phase,'review');
    assert.equal(listed[1].state,null);
    assert.equal(listed[0].dir,path.join(workflowsRoot(repo),'20260912-104251-newest'));
    assert.ok(listed.every(item=>item.updatedAt>0));
  }finally{fs.rmSync(path.dirname(repo),{recursive:true,force:true});}
});

test('a linked worktree resolves to the main repository, so one product has one workflows root',()=>{
  const root=repositoryRoot(process.cwd());
  assert.ok(fs.existsSync(path.join(root,'.git')));
  assert.equal(workflowsRoot(root),path.join(root,'.starciwork','_local','workflows'));
});
