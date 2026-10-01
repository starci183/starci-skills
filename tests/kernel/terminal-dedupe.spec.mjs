import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';

// After the 2026-09-24 reboot Orca restored its previous tabs: old nivo Claude
// kernel sessions with their history and bare PowerShell tabs of old op tabs.
// The watchdogs started new kernels beside them, so every workflow had two
// kernel sessions. resume-all now closes, once Orca answers and before any
// watchdog starts, every terminal of the resumed repos that no ledger binds and
// that is a bare shell or a StarCi agent session; the owner's own sessions stay.

const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-dedupe-'));
const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
// lib.mjs resolves the Orca binary once, at import: point it at the stub first.
process.env.STARCI_ORCA_COMMAND=process.execPath;
process.env.STARCI_ORCA_ARGS=JSON.stringify([stub]);
delete process.env.ORCA_TERMINAL_HANDLE;
const {dedupeTerminals,classifyStrayTerminal,tabTitlesOf}=await import('../../scripts/kernel/terminal-dedupe.mjs');
test.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));

const CLAUDE_IDLE=body=>[body,'✻ Brewed for 1m 3s','─────','❯ ','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle)'].join('\n');
const PS=repo=>`Windows PowerShell\nCopyright (C) Microsoft Corporation.\n\nPS ${repo.replace(/\//g,'\\')}> `;

let n=0;
const world=({leased=false}={})=>{
  const dir=path.join(root,`w${++n}`);
  const repo=path.join(dir,'repo'),other=path.join(dir,'other');
  fs.mkdirSync(repo,{recursive:true});fs.mkdirSync(other,{recursive:true});
  const term=(handle,extra)=>({handle,connected:true,writable:true,worktree:repo,...extra});
  const terminals={
    'term-kernel-new':term('term-kernel-new',{tabTitle:'[Kernel] wf-a',title:'✳ App auth kernel',agentIdentity:'claude',screen:CLAUDE_IDLE('● status: engaged')}),
    'term-op-live':term('term-op-live',{tabTitle:'[Op] backend.implement a25 · wf-a',title:'Codex',screen:CLAUDE_IDLE('● working')}),
    'term-restored-kernel':term('term-restored-kernel',{tabTitle:'[Kernel] wf-a',title:'✳ Nivo app auth kernel workflow',agentIdentity:'claude',
      screen:CLAUDE_IDLE('● AUTH kernel: yielding; waiting on op-backend.implement-ed43628b07 report.')}),
    'term-restored-shell':term('term-restored-shell',{tabTitle:'Terminal 10',title:'Terminal 10',screen:PS(repo)}),
    'term-old-op-shell':term('term-old-op-shell',{tabTitle:'[Op] backend.scaffold a3 · wf-a',title:'devin',screen:PS(repo)}),
    'term-owner-claude':term('term-owner-claude',{tabTitle:'Claude',title:'✳ Fix login bug',agentIdentity:'claude',screen:CLAUDE_IDLE('● Here is the fix for the login form.')}),
    'term-other-repo':{...term('term-other-repo',{tabTitle:'[Kernel] wf-z',title:'kernel',screen:PS(other)}),worktree:other},
  };
  const stateFile=path.join(dir,'state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals}));
  process.env.STARCI_FAKE_ORCA_STATE=stateFile;
  process.env.STARCI_FAKE_ORCA_LOG=path.join(dir,'calls.jsonl');
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    seedWorkflow(ledger,{id:'wf-a',state:{phase:'running'},jobs:[
      {jobId:'kernel-wf-a',kind:'kernel',status:'running',workerId:'term-kernel-new'},
      {jobId:'op-live',opId:'backend.implement',status:'running',workerId:'term-op-live',payload:{}}],
      signals:[{scope:'kernel',key:'wf-a',token:'k',value:{terminal:'term-kernel-new'}}]});
    if(leased)seedWorkflow(ledger,{id:'wf-a',jobs:[{jobId:'op-flight',opId:'backend.implement',status:'leased',payload:{}}]});
  }finally{ledger.close();}
  return {repo,state:()=>JSON.parse(fs.readFileSync(stateFile,'utf8'))};
};

test('restored StarCi sessions and bare shells no ledger binds are quit and closed; bound kernels, live ops and the owner\'s session stay',()=>{
  const w=world();
  const dry=dedupeTerminals({repos:[w.repo],dryRun:true});
  assert.equal(dry.ok,true,JSON.stringify(dry));
  assert.deepEqual(dry.closed.map(c=>c.handle).sort(),['term-old-op-shell','term-restored-kernel','term-restored-shell']);
  assert.equal(w.state().closed,undefined,'a dry run closes nothing');

  const r=dedupeTerminals({repos:[w.repo]});
  assert.equal(r.ok,true,JSON.stringify(r));
  const byHandle=Object.fromEntries(r.closed.map(c=>[c.handle,c]));
  assert.deepEqual(Object.keys(byHandle).sort(),['term-old-op-shell','term-restored-kernel','term-restored-shell']);
  assert.equal(byHandle['term-restored-kernel'].kind,'agent');
  assert.equal(byHandle['term-restored-kernel'].marker,'[Kernel]');
  assert.equal(byHandle['term-restored-shell'].reason,'bare-shell');
  const state=w.state();
  assert.deepEqual(state.quits,[{handle:'term-restored-kernel',text:'\u0003\u0003'}],'a Claude session gets its double Ctrl+C; a bare shell is never typed into');
  assert.deepEqual([...state.closedTabs].sort(),['term-old-op-shell','term-restored-kernel','term-restored-shell'],'each closes with its tab');
  for(const h of ['term-kernel-new','term-op-live','term-owner-claude','term-other-repo'])assert.notEqual(state.terminals[h].closed,true,`${h} must stay`);
  assert.deepEqual(r.kept.map(k=>[k.handle,k.reason]),[['term-owner-claude','no-starci-marker']]);
});

test('a repo with a launch in flight defers every stray: a terminal being created is unbound for a moment',()=>{
  const w=world({leased:true});
  const r=dedupeTerminals({repos:[w.repo]});
  assert.equal(r.closed.length,0);
  assert.equal(r.deferred.length,4);
  assert.match(r.deferred[0].reason,/op-flight is being dispatched/);
  assert.equal(w.state().closed,undefined);
});

test('classifyStrayTerminal: markers in titles or frame, never the owner\'s unmarked agent',()=>{
  const idle=CLAUDE_IDLE('● done');
  assert.equal(classifyStrayTerminal({titles:['✳ Nivo app auth kernel workflow'],screen:idle}).marker,'kernel');
  assert.equal(classifyStrayTerminal({titles:['Codex'],screen:CLAUDE_IDLE('● settled op-interface.draw-edd3451af8')}).action,'close');
  assert.equal(classifyStrayTerminal({titles:['✳ Refactor notes'],screen:idle}).action,'keep');
  assert.equal(classifyStrayTerminal({titles:['[Kernel] wf-a'],screen:null}).reason,'unreadable');
  assert.equal(classifyStrayTerminal({titles:['anything'],screen:'PS C:\\Users\\Hi> '}).reason,'bare-shell');
});

test('tab titles come from the visual layouts, by tab id',()=>{
  const titles=tabTitlesOf([{root:{type:'group',tabs:[{tabId:'t1',title:'[Kernel] wf-a',panes:{type:'terminal',handle:'h1',tabId:'t1',title:'✳ pane'}}]}}],
    [{handle:'h1',tabId:'t1'},{handle:'h2',tabId:'t9'}]);
  assert.equal(titles.get('h1'),'[Kernel] wf-a');
  assert.equal(titles.get('h2'),null);
});
