import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {classifyAgentScreen} from '../scripts/kernel/terminal-liveness.mjs';

// A provider screen that waits for a human answer (Codex directory trust, Claude Code first-run setup)
// must fail readiness at once with state `interactive-gate` and the gate's name, never sit out the
// readiness timeout. The runtime only names the gate; answering it is the owner's decision.
const ROOT=path.resolve(import.meta.dirname,'..');

// Exact screens observed from a real launch.
const CODEX_TRUST="You are in D:\\Repositories\\starci-next  Do you trust the contents of this directory? Working with untrusted contents comes with higher risk of prompt injection. Trusting the directory allows project-local config, hooks, and exec policies to load. › 1. Yes, continue 2. No, quit  Press enter to continue";
const CLAUDE_ONBOARDING="Let's get started. Choose the text style that looks best with your terminal To change this later, run /theme 1. Auto (match terminal) ❯ 2. Dark mode ✔";

test('the Codex trust prompt and the Claude Code onboarding are interactive gates with named reasons',()=>{
  assert.deepEqual([classifyAgentScreen(CODEX_TRUST).state,classifyAgentScreen(CODEX_TRUST).gate],['interactive-gate','codex-directory-trust']);
  assert.deepEqual([classifyAgentScreen(CLAUDE_ONBOARDING).state,classifyAgentScreen(CLAUDE_ONBOARDING).gate],['interactive-gate','claude-first-run-onboarding']);
  const lines=CODEX_TRUST.replace('? ','?\n').replace(' › ','\n› ').replace(' 2. ','\n  2. ');
  assert.equal(classifyAgentScreen(lines).gate,'codex-directory-trust','the gate wins over the `›` prompt row');
  assert.equal(classifyAgentScreen('1 Yes (Approve once)\n2 No\nconfirm · esc Cancel').gate,'tool-approval');
});

// A canned Orca: `terminal create` answers with a handle or the receipt error named by
// STARCI_TEST_CREATE_ERROR, `terminal read` shows STARCI_TEST_SCREEN, `terminal close` succeeds.
const STUB=String.raw`const argv=process.argv.slice(2);const verb=argv.slice(0,2).join(' ');
const out=o=>console.log(JSON.stringify(o));
if(verb==='terminal create'){
  if(process.env.STARCI_TEST_CREATE_ERROR){out({ok:false,error:{code:process.env.STARCI_TEST_CREATE_ERROR,message:'worktree is not a registered Orca repo'}});process.exit(1);}
  out({ok:true,result:{terminal:{handle:'gate-term-1',connected:true,writable:true}}});process.exit(0);
}
if(verb==='terminal read'){out({ok:true,result:{terminal:{handle:'gate-term-1',screen:process.env.STARCI_TEST_SCREEN||''}}});process.exit(0);}
if(verb==='terminal close'){out({ok:true,result:{closed:true}});process.exit(0);}
out({ok:true,result:{}});`;

const spawnWith=(t,provider,env)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-gate-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const stub=path.join(dir,'orca-stub.mjs');
  fs.writeFileSync(stub,STUB);
  const lib=pathToFileURL(path.join(ROOT,'scripts','agent','lib.mjs')).href;
  const script=`const {spawnAgent}=await import(${JSON.stringify(lib)});console.log(JSON.stringify(spawnAgent({provider:${JSON.stringify(provider)},worktree:${JSON.stringify(dir)},title:'[Kernel] gate',kernel:true})));`;
  const started=Date.now();
  const r=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:60000,windowsHide:true,
    env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_ORCA_SKIP_LIVE_CHECK:'1',...env}});
  assert.equal(r.status,0,r.stderr);
  return {result:JSON.parse(r.stdout.trim().split('\n').pop()),ms:Date.now()-started};
};

test('kernel readiness fails fast on a gate and names it',t=>{
  for(const [provider,screen,gate] of [['codex',CODEX_TRUST,'codex-directory-trust'],['claude',CLAUDE_ONBOARDING,'claude-first-run-onboarding']]){
    const {result,ms}=spawnWith(t,provider,{STARCI_TEST_SCREEN:screen});
    assert.equal(result.ok,false);
    assert.equal(result.step,'readiness');
    assert.deepEqual([result.state,result.signal,result.gate],['interactive-gate','interactive-gate',gate]);
    assert.match(result.error,new RegExp(gate));
    assert.ok(ms<30000,`${provider} readiness took ${ms}ms — a gate must not wait out the readiness timeout`);
  }
});

test('a refused terminal create carries the Orca receipt error code',t=>{
  const {result}=spawnWith(t,'codex',{STARCI_TEST_CREATE_ERROR:'selector_not_found'});
  assert.equal(result.ok,false);
  assert.equal(result.step,'create');
  assert.equal(result.errorCode,'selector_not_found');
  assert.match(result.error,/^selector_not_found: /);
});
