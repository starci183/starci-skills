// A deferred settle that waits on a later leg and a draw retry
// ordered --after the attempt it retries held one another forever (nivo
// wf-nivo-workspace-provision-mujek7cb, inc-a158db5dc9b7 / inc-47e909b2f28c); a 993-path
// packet never launched (ENAMETOOLONG at task-create, inc-826e077777de).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';
import {parseYaml,stringifyYaml} from '../engine/yaml.mjs';
import {GATE_WAITS_ON_JOB,legOrderExemption} from '../scripts/kernel/leg-order.mjs';
import {TASK_SPEC_MAX_CHARS,packetFileOf,taskSpecOf} from '../scripts/kernel/task-spec.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=v=>JSON.stringify(v??null);
const tmp=(t,prefix)=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),prefix));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));return dir;};

test('legOrderExemption: a row whose own wait names the queued job (or its lineage) does not hold it',()=>{
  const row={job_id:'op-business.decide-held',op_id:'business.decide'};
  const job={job_id:'op-interface.draw-retry'};
  const gate=(holds,until)=>[{incidentId:'inc-1',holds,until}];
  assert.deepEqual(legOrderExemption({row,job,typedGates:gate([row.job_id],[{type:'job',jobId:job.job_id,want:'succeeded'}])}),{why:GATE_WAITS_ON_JOB,incident:'inc-1'});
  assert.deepEqual(legOrderExemption({row,job,typedGates:gate(['business.decide'],[{type:'job',jobId:job.job_id}])})?.why,GATE_WAITS_ON_JOB,'a gate holding the op holds the row');
  assert.deepEqual(legOrderExemption({row,job,typedGates:gate([row.job_id],[{type:'job',jobId:'op-interface.draw-old'}]),headOf:(id)=>id==='op-interface.draw-old'?job.job_id:id})?.why,
    GATE_WAITS_ON_JOB,'a condition naming a failed attempt names its open retry');
  assert.equal(legOrderExemption({row,job,typedGates:gate([row.job_id],[{type:'job',jobId:'op-other-1234567890'}])}),null,'a wait on another job keeps the hold');
  assert.equal(legOrderExemption({row,job,typedGates:gate(['op-someone-else'],[{type:'job',jobId:job.job_id}])}),null,'a gate on another job is not this row\'s wait');
  assert.equal(legOrderExemption({row,job,typedGates:gate([row.job_id],[{type:'commit',repo:'r',target:'a'}])}),null);
});

test('taskSpecOf: a packet over the argv budget is written verbatim to the job dir and the spec points at it',t=>{
  const dir=tmp(t,'starci-spec-');
  const small='[Op] x\nowned_paths: a, b';
  assert.deepEqual(taskSpecOf({prompt:small,file:path.join(dir,'p.md'),op:'x',jobId:'j'}),{spec:small,spilled:false});
  assert.equal(fs.existsSync(path.join(dir,'p.md')),false,'a packet that fits writes nothing');

  const owned=Array.from({length:993},(_,i)=>`.starciwork/features/workspace-provision/impl/nivo-backend/n${i}/report.json`);
  const big=`[Op] business.decide\nowned_paths: ${owned.join(', ')}\n  cut: ...`;
  assert.ok(big.length>TASK_SPEC_MAX_CHARS);
  const file=packetFileOf(path.join(dir,'jobs','op-business.decide-cc63d20d87'),2);
  assert.match(file,/packet\.a2\.md$/);
  const out=taskSpecOf({prompt:big,file,op:'business.decide',jobId:'op-business.decide-cc63d20d87',attempt:2});
  assert.equal(out.spilled,true);
  assert.equal(fs.readFileSync(file,'utf8'),big,'the file is the rendered packet byte for byte');
  assert.ok(out.spec.length<1000,`the spec is a short pointer (${out.spec.length})`);
  assert.ok(out.spec.includes(path.resolve(file)),'the spec names the absolute packet path');
  assert.match(out.spec,/Read that whole file now/);
  assert.match(out.spec,/job op-business\.decide-cc63d20d87, attempt 2/);
  assert.equal(taskSpecOf({prompt:big,file:null,op:'x',jobId:'j'}).tooLong,true,'no file to write keeps the prompt inline');
});

// The live shape, through api status: a business.decide whose deferred settle waits until-job on the
// draw retry, and the draw retry enqueued --after the
// failed attempt it retries.
test('status: the draw a deferred settle waits on reads ready, not dependency on its own waiter',t=>{
  const repo=tmp(t,'starci-unstick-'),wf='wf-unstick';
  const owner=tmp(t,'starci-owner-');
  const example=path.join(ROOT,'config.example.yaml');
  fs.copyFileSync(example,path.join(owner,'config.example.yaml'));
  fs.writeFileSync(path.join(owner,'config.yaml'),stringifyYaml({...parseYaml(fs.readFileSync(example,'utf8')),budgets:{maxOps:null}}));
  const api=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,STARCI_OWNER_ROOT:owner}});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  const job=(jobId,opId,status,payload,extra={})=>({jobId,opId,status,role:'op',payload:{opId,...payload},...extra});
  try{
    seedWorkflow(ledger,{id:wf,state:{phase:'running',job:'unstick'},
      goal:{revision:0,identity:'g',markdown:'# goal',json:{opChain:{legs:[{op:'business.decide'},{op:'interface.draw'}]},derivedPlan:{legs:[{op:'business.decide'},{op:'interface.draw'}],edges:[['business.decide','interface.draw']]}}},
      jobs:[
        job('op-business.decide-held00000','business.decide','running',{owned_paths:['a/decide']}),
        job('op-interface.draw-old0000000','interface.draw','failed',{owned_paths:['a/draw']}),
        // The retry is try 2 of the same work unit as the attempt it retries.
        job('op-interface.draw-retry00000','interface.draw','queued',{owned_paths:['a/draw'],after:['op-interface.draw-old0000000'],retry:{retryOf:'op-interface.draw-old0000000'}},
          {tryNo:2,retryOf:'op-interface.draw-old0000000',unitId:'op-interface.draw-old0000000'})]});
  }finally{ledger.close();}
  const status=()=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr||r.stdout);return JSON.parse(r.stdout).frontier.queued;};
  const draw=()=>status().find((q)=>q.jobId==='op-interface.draw-retry00000');

  // Before the wait names it, the authoring business.decide in flight is a real predecessor.
  assert.equal(draw().queuedBecause,'dependency');
  assert.equal(draw().blockedBy.job,'op-business.decide-held00000');

  const raised=api('incident','--workflow',wf,'--kind','owner-gate','--holds','op-business.decide-held00000',
    '--until-job','op-interface.draw-retry00000:succeeded','--detail','deferred settle: the draw commits the FE files in its owned paths');
  assert.equal(raised.status,0,raised.stderr||raised.stdout);
  const now=draw();
  assert.equal(now.queuedBecause,'ready',JSON.stringify(now));
});
