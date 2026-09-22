import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';

// scripts/api/orca/lib.mjs is the whole host boundary: argv comes from
// modules/host/orca/calls.yaml and, before the first mutation, the verb about
// to run is compared against the live `orca agent-context --json` listing.
// Every case here drives that runner through the shared fake Orca, which
// answers agent-context from calls.yaml itself.
const ROOT=path.resolve(import.meta.dirname,'..');

const stubEnv=(t,extra={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-orca-call-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  return {root,log:path.join(root,'calls.jsonl'),env:{
    ...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    ...extra,
  }};
};

// One child node process per case: the agent-context listing is cached for the
// life of a process, so a fresh process is the only honest way to vary it.
const call=(fx,body)=>{
  const script=path.join(fx.root,`case-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(script,`import {orcaCall} from ${JSON.stringify(pathToFileURL(path.join(ROOT,'scripts','api','orca','lib.mjs')).href)};\n`+
    `console.log(JSON.stringify((${body})(orcaCall)));\n`);
  const r=spawnSync(process.execPath,[script],{encoding:'utf8',env:fx.env,timeout:60000,windowsHide:true});
  assert.equal(r.status,0,`case process failed: ${r.stderr}`);
  return JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1));
};
const logged=fx=>fs.existsSync(fx.log)
  ?fs.readFileSync(fx.log,'utf8').trim().split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l).argv)
  :[];

test('argv is assembled from calls.yaml — declared flags only, in contract order',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>c('worker-start',{task:'task-1',worktree:'wt',agent:'codex',model:'gpt-5.6-sol','display-name':'[Op] x',run:'run-1',from:'kernel-1'})`);
  assert.equal(out.outcome,'ok');
  const start=logged(fx).find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.ok(start,'worker-start never reached the binary');
  assert.deepEqual(start,['orchestration','worker-start','--task','task-1','--worktree','wt','--agent','codex',
    '--model','gpt-5.6-sol','--display-name','[Op] x','--run','run-1','--from','kernel-1','--json'],
    'argv order and content are calls.yaml flags order plus defaults.jsonFlag');
});

test('a param calls.yaml does not declare is a contract violation, not a flag',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{try{c('worker-stop',{dispatch:'d1',force:true});return{threw:false}}catch(e){return{threw:true,message:e.message}}}`);
  assert.equal(out.threw,true,'an undeclared param must throw before any process runs');
  assert.match(out.message,/--force is not a flag calls\.yaml declares/);
  assert.deepEqual(logged(fx),[],'nothing may reach the binary once the contract is violated');
});

test('a missing required flag refuses before the process runs',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>{try{c('worker-show',{});return{threw:false}}catch(e){return{threw:true,message:e.message}}}`);
  assert.equal(out.threw,true);
  assert.match(out.message,/missing required --dispatch/);
  assert.deepEqual(logged(fx),[]);
});

test('the receipt is classified by the calls.yaml classify block',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_MODE:'auth-partial'});
  const out=call(fx,`c=>c('worker-start',{task:'t',worktree:'wt',agent:'codex',run:'r'})`);
  assert.equal(out.outcome,'failed');
  assert.equal(out.effectState,'partial','a residual dispatch is partial, so fallback must settle it first');
  const release=call(stubEnv(t,{STARCI_FAKE_ORCA_MODE:'prompt-stalled'}),`c=>c('worker-release',{dispatch:'d1'})`);
  assert.equal(release.outcome,'failed');
  assert.equal(release.effectState,'partial','state retained is a live residual resource');
});

test('the live agent-context listing is read once per process, before the first mutation only',t=>{
  const fx=stubEnv(t);
  const out=call(fx,`c=>[c('terminal-show',{terminal:'t1'}).outcome,c('terminal-read',{terminal:'t1'}).outcome,`+
    `c('terminal-rename',{terminal:'t1',title:'[Op] x'}).outcome,c('terminal-close',{terminal:'t1'}).outcome]`);
  assert.deepEqual(out,['ok','ok','ok','ok']);
  const verbs=logged(fx).map(argv=>argv[0]);
  assert.equal(verbs.filter(v=>v==='agent-context').length,1,'the listing is cached for the process');
  assert.equal(verbs.indexOf('agent-context'),2,'reads run untouched; the listing is fetched at the first mutation');
});

test('a read-only process never spends a call on agent-context',t=>{
  const fx=stubEnv(t);
  call(fx,`c=>c('terminal-show',{terminal:'t1'}).outcome`);
  assert.equal(logged(fx).some(argv=>argv[0]==='agent-context'),false);
});

test('a flag the live binary does not offer refuses the mutation and allows the read',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_OMIT_FLAG:'terminal send:enter'});
  const out=call(fx,`c=>({read:c('terminal-read',{terminal:'t1'}),send:c('terminal-send',{terminal:'t1',text:'hi',enter:true})})`);
  assert.equal(out.read.outcome,'ok','a read is never blocked by the mutation guard');
  assert.equal(out.send.outcome,'failed');
  assert.equal(out.send.effectState,'none','a refused call left no effect to reconcile');
  assert.equal(out.send.reason,'host-contract-drift');
  assert.deepEqual(out.send.missing,{command:'terminal send',flags:['enter']});
  assert.match(out.send.error,/terminal-send/);
  assert.match(out.send.error,/--enter/);
  assert.equal(logged(fx).some(argv=>argv.slice(0,2).join(' ')==='terminal send'),false,
    'the refusal happens before effects — terminal send must never have run');
});

test('a command the live binary does not offer refuses the mutation by name',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_OMIT_COMMAND:'orchestration worker-stop'});
  const out=call(fx,`c=>c('worker-stop',{dispatch:'d1'})`);
  assert.equal(out.outcome,'failed');
  assert.equal(out.reason,'host-contract-drift');
  assert.deepEqual(out.missing,{command:'orchestration worker-stop'});
  assert.equal(logged(fx).some(argv=>argv.slice(0,2).join(' ')==='orchestration worker-stop'),false);
});

test('STARCI_ORCA_SKIP_LIVE_CHECK=1 is the documented stub escape and nothing else',t=>{
  const fx=stubEnv(t,{STARCI_FAKE_ORCA_OMIT_COMMAND:'terminal rename',STARCI_ORCA_SKIP_LIVE_CHECK:'1'});
  const out=call(fx,`c=>c('terminal-rename',{terminal:'t1',title:'[Op] x'})`);
  assert.equal(out.outcome,'ok','the override skips the comparison, it does not change the call');
  assert.equal(logged(fx).some(argv=>argv[0]==='agent-context'),false,'no listing is fetched when the check is skipped');
});
