import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-start-restart-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),'language: vi\neffort: medium\nkernel: {agent: codex, model: gpt-5.6-sol, effort: high}\n');
  fs.writeFileSync(state,JSON.stringify({counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,`import fs from 'node:fs';
const file=process.env.FAKE_ORCA_STATE;
const state=JSON.parse(fs.readFileSync(file,'utf8'));
const args=process.argv.slice(2),at=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
const save=()=>fs.writeFileSync(file,JSON.stringify(state));
const ok=result=>{console.log(JSON.stringify({ok:true,result}));process.exit(0)};
if(args[0]==='terminal'&&args[1]==='create'){
  const handle='term_fake_'+(++state.counter);
  const command=at('--command');
  const model=String(command||'').match(/(?:^|\\s)(?:-m|--model)\\s+["']?([^\\s"']+)/i)?.[1]??null;
  state.terminals[handle]={handle,connected:true,writable:true,sent:false,prompt:null,command,model};
  state.commands.push(command);save();ok({terminal:{handle,connected:true,writable:true}});
}
const handle=at('--terminal'),term=state.terminals[handle];
if(args[0]==='terminal'&&args[1]==='show')ok({terminal:term??{handle,connected:false,writable:false}});
if(args[0]==='terminal'&&args[1]==='read'){
  const tail=term?.sent?['Codex','model: '+term.model,'Thinking · 1s (esc twice to interrupt)']:['Codex','model: '+term.model,'Enter a prompt','❭'];
  ok({terminal:{...term,tail}});
}
if(args[0]==='terminal'&&args[1]==='send'){
  if(!term){console.error('missing terminal');process.exit(1)}
  term.sent=true;term.prompt=at('--text');save();ok({send:{handle,accepted:true}});
}
if(args[0]==='terminal'&&args[1]==='close'){
  if(term){term.connected=false;term.writable=false;save()}ok({close:{handle}});
}
console.error('unsupported '+args.join(' '));process.exit(2);
`);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),FAKE_ORCA_STATE:state,STARCI_OWNER_ROOT:ownerRoot};
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  return {repo,state,run};
};

test('a disconnected kernel restarts from the durable ledger with absolute host context',t=>{
  const f=fixture(t);
  const defined=f.run(DEFINE_GOAL,'--repo',f.repo,'--text','refactor the stale architecture','--json');
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);

  const first=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(first.status,0,first.stderr);
  const firstOut=json(first.stdout);assert.equal(firstOut?.replaced,false);assert.equal(firstOut?.attempt,1);
  assert.equal(firstOut?.generation,0);assert.equal(firstOut?.promptSubmitted,true);
  let state=json(fs.readFileSync(f.state,'utf8'));
  assert.match(state.commands[0],/\bcodex\b/i);
  assert.match(state.commands[0],/(?:^|\s)--model\s+['"]?gpt-5\.6-sol['"]?(?:\s|$)/i);
  assert.match(state.commands[0],/--ask-for-approval\s+never/);
  assert.match(state.commands[0],/--sandbox\s+danger-full-access/);
  assert.match(state.terminals[firstOut.terminal].prompt,new RegExp(ROOT.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(state.terminals[firstOut.terminal].prompt,/Never look for or create a\s+target-local `\.claude`/);

  const duplicate=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(duplicate.status,0,duplicate.stderr);
  assert.equal(json(duplicate.stdout)?.terminal,firstOut.terminal);
  state=json(fs.readFileSync(f.state,'utf8'));assert.equal(state.counter,1,'a connected kernel must not duplicate');

  state.terminals[firstOut.terminal].connected=false;state.terminals[firstOut.terminal].writable=false;
  fs.writeFileSync(f.state,JSON.stringify(state));
  const restarted=f.run(START_WORKFLOW,'--repo',f.repo,'--goal',workflowId,'--json');
  assert.equal(restarted.status,0,restarted.stderr);
  const restartOut=json(restarted.stdout);assert.equal(restartOut?.replaced,true);assert.equal(restartOut?.attempt,2);
  assert.equal(restartOut?.generation,0,'agent churn must not invalidate the workflow generation');
  assert.notEqual(restartOut?.terminal,firstOut.terminal);

  const ledger=inspectLedger({file:ledgerFileFor(f.repo)});
  try{
    const workflow=ledger.db.prepare('SELECT generation,phase FROM workflows WHERE workflow_id=?').get(workflowId);
    const job=ledger.db.prepare('SELECT attempt,generation,status,worker_id FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
    const inbox=ledger.db.prepare("SELECT status FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId);
    const kinds=ledger.db.prepare("SELECT kind FROM events WHERE workflow_id=? ORDER BY seq").all(workflowId).map(row=>row.kind);
    assert.deepEqual({...workflow},{generation:0,phase:'running'});
    assert.deepEqual({...job},{attempt:2,generation:0,status:'running',worker_id:restartOut.terminal});
    assert.equal(inbox.status,'claimed');
    assert.ok(kinds.includes('kernel-stale-cleared'));assert.ok(kinds.includes('kernel-restarted'));
    assert.ok(kinds.includes('phase-transition'),'the kernel claim must durably record queued->running');
  }finally{ledger.close();}
});
