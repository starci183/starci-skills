import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// The kernel is a model GROUP: config.yaml `kernel: {group: [...]}` (the shipped default) or the unpinned
// think-group route. Members are tried in order with the provider availability signals; a single pin keeps
// its authoritative, fail-closed meaning.
const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const GROUP='kernel: {group: [{agent: claude, model: claude-opus-5-5}, {agent: codex, model: gpt-6-sol}], effort: high}';

const fixture=(t,kernelLine)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kernel-group-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json'),log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),`language: vi\neffort: medium\n${kernelLine?`${kernelLine}\n`:''}`);
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot};
  const run=(script,args,extra={})=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...extra}});
  const defined=run(DEFINE_GOAL,['--repo',repo,'--text','boot the kernel group','--json']);
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const plan=(extra={})=>{const r=run(START_WORKFLOW,['--repo',repo,'--goal',workflowId,'--plan','--json'],extra);return {r,body:json(r.stdout)};};
  return {root,repo,state,workflowId,run,plan};
};

test('the group form plans Claude Opus 5.5 first with GPT-6 Sol behind it',t=>{
  const {r,body}=fixture(t,GROUP).plan();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.agent,body.model,body.effort,body.routedBy],['claude','claude-opus-5-5','high','config']);
  assert.deepEqual(body.group.map(m=>[m.agent,m.model,m.effort]),[['claude','claude-opus-5-5','high'],['codex','gpt-6-sol','high']]);
  assert.equal(body.fallThrough,true);
  assert.match(body.command,/\bclaude\b/);
});

test('the group skips a dead or circuit-open Claude and orders a limited one last',t=>{
  const f=fixture(t,GROUP);
  const dead=f.plan({STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.agent,dead.body.model],['codex','gpt-6-sol']);
  assert.deepEqual(dead.body.group.map(m=>m.agent),['codex']);
  assert.match(dead.body.warnings.join('\n'),/claude\/claude-opus-5-5 skipped — quota probe dead/);
  const limited=f.plan({STARCI_FAKE_ORCA_LIMITED:'claude'});
  assert.equal(limited.r.status,0,limited.r.stderr);
  assert.deepEqual(limited.body.group.map(m=>[m.agent,m.availability]),[['codex','available'],['claude','limited']]);
  const ledger=openLedger({file:ledgerFileFor(f.repo)});
  try{
    const now=Date.now();
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('provider-health','claude',NULL,NULL,?,?,?)")
      .run(JSON.stringify({schema:'starci/provider-health@1',provider:'claude',status:'unavailable',failureKind:'auth'}),now,now+3600000);
  }finally{ledger.close();}
  const circuit=f.plan();
  assert.equal(circuit.r.status,0,circuit.r.stderr);
  assert.deepEqual(circuit.body.group.map(m=>m.agent),['codex']);
  assert.match(circuit.body.warnings.join('\n'),/claude\/claude-opus-5-5 skipped — provider circuit open \(auth\)/);
  const both=f.plan({STARCI_FAKE_ORCA_DEAD:'claude,codex'});
  assert.equal(both.r.status,1);
  assert.equal(both.body.step,'kernel-group-unavailable');
  assert.match(both.body.routeError,/claude\/claude-opus-5-5 skipped.*codex\/gpt-6-sol skipped/s);
});

test('a single pin keeps its meaning: authoritative, one member, no fall-through, fails closed',t=>{
  const f=fixture(t,'kernel: {agent: claude, model: claude-opus-5-5, effort: high}');
  const pinned=f.plan();
  assert.equal(pinned.r.status,0,pinned.r.stderr);
  assert.deepEqual([pinned.body.agent,pinned.body.model,pinned.body.routedBy,pinned.body.fallThrough],['claude','claude-opus-5-5','config',false]);
  assert.equal(pinned.body.group.length,1);
  const dead=f.plan({STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,1,'a dead pinned agent is never substituted');
  assert.equal(dead.body.step,'kernel-pin-unavailable');
});

test('with no kernel key the unpinned route is the think group',t=>{
  const f=fixture(t,null);
  const {r,body}=f.plan();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.agent,body.model,body.routedBy],['claude','claude-opus-5-5','route-model']);
  assert.deepEqual(body.group.map(m=>[m.agent,m.model]),[['claude','claude-opus-5-5'],['codex','gpt-6-sol']]);
  const dead=f.plan({STARCI_FAKE_ORCA_DEAD:'claude'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.agent,dead.body.model],['codex','gpt-6-sol']);
});
