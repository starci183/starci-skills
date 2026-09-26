import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

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

const kernelEvents=(repo,workflowId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{
    return ledger.db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind LIKE 'kernel-%' ORDER BY seq").all(workflowId)
      .map(row=>({kind:row.kind,payload:json(row.payload_json)}));
  }finally{ledger.close();}
};
const readState=f=>json(fs.readFileSync(f.state,'utf8'));
const boot=(f,extra={})=>{const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],extra);return {r,body:json(r.stdout)};};

test('a Claude onboarding gate falls through to GPT-6 Sol in the same boot and closes the gated terminal',t=>{
  const f=fixture(t,GROUP);
  const {r,body}=boot(f,{STARCI_FAKE_ORCA_GATE:'claude'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.agent,body.model,body.routedBy],['codex','gpt-6-sol','config']);
  assert.deepEqual(body.fellThrough.map(x=>[x.agent,x.model,x.step,x.gate]),[['claude','claude-opus-5-5','readiness','claude-first-run-onboarding']]);
  const events=kernelEvents(f.repo,f.workflowId);
  assert.deepEqual(events.map(e=>e.kind),['kernel-start-failed','kernel-booted']);
  const [failed,booted]=events;
  assert.equal(failed.payload.gate,'claude-first-run-onboarding');
  assert.equal(failed.payload.state,'interactive-gate');
  assert.deepEqual(failed.payload.fellThroughTo,{agent:'codex',model:'gpt-6-sol'});
  assert.equal(failed.payload.terminalClosed?.ok,true);
  assert.deepEqual([booted.payload.agent,booted.payload.model],['codex','gpt-6-sol']);
  assert.equal(booted.payload.fellThrough.length,1);
  const state=readState(f);
  assert.equal(state.counter,2,'one terminal per member tried');
  assert.deepEqual(state.closed,[failed.payload.terminal],'the gated terminal is closed');
  const live=Object.values(state.terminals).filter(term=>!term.closed).map(term=>term.handle);
  assert.deepEqual(live,[body.terminal],'exactly one live kernel terminal, the booted one');
  assert.match(state.terminals[body.terminal].command,/\bcodex\b/);
});

test('fall-through never happens for a single pin, a refused close, or the last member',t=>{
  const pinned=fixture(t,'kernel: {agent: claude, model: claude-opus-5-5, effort: high}');
  const p=boot(pinned,{STARCI_FAKE_ORCA_GATE:'claude'});
  assert.equal(p.r.status,1,'a gated single pin fails closed');
  assert.deepEqual(kernelEvents(pinned.repo,pinned.workflowId).map(e=>e.kind),['kernel-start-failed']);
  assert.equal(readState(pinned).counter,1,'no second member is tried');

  const refused=fixture(t,GROUP);
  const c=boot(refused,{STARCI_FAKE_ORCA_GATE:'claude',STARCI_FAKE_ORCA_CLOSE_FAILS:'*'});
  assert.equal(c.r.status,1,'a gated member whose terminal stays open must not fall through');
  const [event]=kernelEvents(refused.repo,refused.workflowId);
  assert.equal(event.payload.terminalClosed?.ok,false);
  assert.match(event.payload.fallThroughRefused,/not closed/);
  assert.equal(readState(refused).counter,1);

  const both=fixture(t,GROUP);
  const b=boot(both,{STARCI_FAKE_ORCA_GATE:'claude,codex'});
  assert.equal(b.r.status,1);
  const events=kernelEvents(both.repo,both.workflowId);
  assert.deepEqual(events.map(e=>[e.kind,e.payload.agent,e.payload.gate]),
    [['kernel-start-failed','claude','claude-first-run-onboarding'],['kernel-start-failed','codex','codex-directory-trust']]);
  assert.deepEqual(events[1].payload.fellThrough?.map(x=>x.agent),['claude']);
  const state=readState(both);
  assert.equal(Object.values(state.terminals).filter(term=>!term.closed).length,0,'no orphan terminal after an exhausted group');
  const ledger=inspectLedger({file:ledgerFileFor(both.repo)});
  try{assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM signals WHERE scope='kernel' AND key=?").get(both.workflowId).n,0,'the startup reservation is released');}
  finally{ledger.close();}
});

test('with no kernel key the unpinned route is the sol-think group',t=>{
  // Owner routing 2026-09-26: the kernel's own calls walk sol-think - Sol first, Opus as overflow.
  const f=fixture(t,null);
  const {r,body}=f.plan();
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([body.agent,body.model,body.routedBy],['codex','gpt-6-sol','route-model']);
  assert.deepEqual(body.group.map(m=>[m.agent,m.model]),[['codex','gpt-6-sol'],['claude','claude-opus-5-5']]);
  const dead=f.plan({STARCI_FAKE_ORCA_DEAD:'codex'});
  assert.equal(dead.r.status,0,dead.r.stderr);
  assert.deepEqual([dead.body.agent,dead.body.model],['claude','claude-opus-5-5']);
});
