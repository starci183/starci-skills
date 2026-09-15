import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateAccepted} from '../kernel/verify.mjs';

const fixture=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-validator-required-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  fs.writeFileSync(path.join(dir,'a.js'),'changed');
  const store={dir,appendEvent:event=>store.events.push(event),events:[]};
  const state={id:'wf',job:'job',worktree:dir,head:'b'.repeat(40),needUser:[]};
  const op={id:'op',attempt:1,baseHead:'a'.repeat(40),nodeId:null,references:[],allowlist:['a.js'],checks:[]};
  const git=(command,args)=>args[0]==='diff'?{status:0,stdout:'diff --git a/a.js b/a.js\n-old\n+new\n'}:{status:0,stdout:''};
  const ctx={git,now:()=>Date.now(),engine:{requiredValidation:true,identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'job'}},validator:[]};
  return {store,state,op,ctx,input:{files:['a.js'],produced:[],verified:{checks:[]}}};
};

test('required validation cannot skip or accept unavailable validator',t=>{
  const f=fixture(t);f.ctx.validateOp=null;
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'unavailable');
  f.ctx.validateOp=()=>({verdict:'unavailable',reason:'offline'});
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'unavailable');
});

test('the required validator judges every kernel-observed file and requires complete independent fresh review',t=>{
  const f=fixture(t);let request;
  f.ctx.validateOp=value=>{request=value;return {verdict:'accept',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'review-2'};};
  const result=validateAccepted(f.store,f.state,f.op,f.ctx,{...f.input,files:['a.js','hidden.js'],produced:['a.js']});
  assert.equal(result.verdict,'accept');assert.deepEqual(request.diff.files,['a.js','hidden.js']);assert.equal(request.memory,'');assert.equal(request.freshContext,true);
  f.ctx.validateOp=()=>({verdict:'accept'});
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'inconclusive');
});

test('the required validator propagates pending async work instead of converting it to unavailable',t=>{
  const f=fixture(t),pending=Object.assign(new Error('pending'),{code:'STARCI_JOB_PENDING'});f.ctx.validateOp=()=>{throw pending;};
  assert.throws(()=>validateAccepted(f.store,f.state,f.op,f.ctx,f.input),error=>error===pending);
});

test('quota waiting preserves the candidate and does not consume validator failure allowance',t=>{
  const f=fixture(t),quota=Object.assign(new Error('fresh provider quota is unavailable'),{code:'STARCI_MODEL_QUOTA_WAIT'});
  f.ctx.validateOp=()=>{throw quota;};
  assert.throws(()=>validateAccepted(f.store,f.state,f.op,f.ctx,f.input),error=>error===quota);
  assert.equal(f.state.validatorUnavailable,undefined);assert.deepEqual(f.state.needUser,[]);assert.equal(f.op.validation,undefined);
});

test('the required validator refuses truncated diff and unresolved references before model review',t=>{
  const f=fixture(t);let calls=0;f.ctx.validateOp=()=>{calls++;return {verdict:'accept'};};
  f.ctx.git=(command,args)=>args[0]==='diff'?{status:0,stdout:'x'.repeat(130*1024)}:{status:0,stdout:''};
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'inconclusive');assert.equal(calls,0);
  f.ctx.git=(command,args)=>args[0]==='diff'?{status:0,stdout:'small'}:{status:0,stdout:''};f.op.references=['missing.md'];
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'inconclusive');assert.equal(calls,0);
});

test('the required validator resolves typed anchors to full contained bytes and preserves their metadata',t=>{
  const f=fixture(t);f.op.references=['sds:a.js#section-3'];let request;
  f.ctx.validateOp=value=>{request=value;return {verdict:'accept',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'review-2'};};
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'accept');
  const reference=request.resolvedReferences[0];assert.equal(reference.kind,'sds');assert.equal(reference.path,'a.js');assert.equal(reference.fragment,'section-3');
  assert.equal(Buffer.from(reference.bytes).toString(),'changed');
});

test('the required validator can judge a no-diff verification receipt only after complete reproduced checks',t=>{
  const f=fixture(t);f.op.kind='e2e.verify';f.op.checks=[{name:'public-api',command:'node e2e.mjs'}];f.input={files:[],produced:[],verified:{checks:[{name:'public-api',command:'node e2e.mjs',exitCode:0,evidence:'receipt sha256 abc'}]}};
  f.ctx.validateOp=()=>({verdict:'accept',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'review-2'});
  assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'accept');
  f.input.verified.checks=[];assert.equal(validateAccepted(f.store,f.state,f.op,f.ctx,f.input).verdict,'inconclusive');
});
