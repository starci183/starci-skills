import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../../engine/db/ledger.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {proofRepo} from '../helpers/sonar-scan.mjs';
import {adoptLaunchTrust} from '../helpers/launch-trust.mjs';
import {addWorkflowWorktree} from '../helpers/workflow-worktree-row.mjs';
import {loadRuntimes,raiseToFloor} from '../../scripts/agent/models.mjs';
import {tierMembers,tierOfOp} from '../../scripts/agent/tiers.mjs';

// Think kinds (decide, plan and the authoring that reasons) never reach a hands-only pool: their difficulty floor puts them on the
// high tier or above, whose members are Claude and Codex. starci kernel dispatch launches only inside the op's tier at its
// floor-raised difficulty, whatever names the pool (--model, the persisted route, the unrouted default), and launches the
// tier's own member of that agent.

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const RT=loadRuntimes();
const FRONTIER=['claude','codex'];
const DIFFICULTIES=['easy','medium','hard','insane'];
const HIGH=['claude/claude-sonnet-5-5','codex/gpt-6.1-sol'];
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

test('every think kind resolves to a claude or codex member at every difficulty',()=>{
  const strategy=Object.entries(RT.roleOfKind).filter(([,entry])=>entry.work==='think').map(([kind])=>kind);
  for(const kind of ['business.decide','architecture.decide','brand.decide','scope.define','request.analyze','decision.prepare','implementation.plan'])
    assert.ok(strategy.includes(kind),`${kind} is a think kind`);
  for(const kind of strategy) for(const d of DIFFICULTIES){
    const floor=RT.roleOfKind[kind].floor;
    const tier=tierOfOp({kind,difficulty:raiseToFloor(d,floor)});
    assert.ok(['high','frontier','imagegen'].includes(tier),`${kind} at ${d} takes tier ${tier}`);
    assert.deepEqual(tierMembers(tier).filter(member=>!FRONTIER.includes(member.provider)),[],`${kind} at ${d}`);
  }
});

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-strategy-pools-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});proofRepo(t,repo);fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:path.join(root,'owner'),
    // machineFileFor honours STARCI_TEST_MACHINE_FILE first; without it the spawned api lands on the
    // shared starci-test-registry file, which the current machine schema refuses (machine-schema-old).
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
    ...adoptLaunchTrust(root,{roots:[repo],ref:'private strategy-pools fixture adoption'}),
  };
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const callArgv=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const seed=({jobId,opId='business.decide',payload})=>{
    const workflowId=`wf-${jobId}`;
    addWorkflowWorktree({repo,workflowId,env});
    const ledger=openLedger({file:ledgerFileFor(repo)});
    try{
      seedWorkflow(ledger,{id:workflowId,state:{phase:'running',job:workflowId},
        jobs:[
          {jobId:`kernel-${workflowId}`,kind:'kernel',status:'running',workerId:'fake-kernel-terminal',
            payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}},
          {jobId,opId,kind:'op',payload:{opId,owned_paths:['docs/'],...payload}},
        ]});
    }finally{ledger.close();}
  };
  const status=jobId=>{
    const ledger=inspectLedger({file:ledgerFileFor(repo)});
    try{return ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{ledger.close();}
  };
  return {repo,run,callArgv,seed,status};
};

const refused=(fx,r,jobId,{model,allowed=HIGH})=>{
  assert.equal(r.status,1,`dispatch must refuse: ${r.stdout}${r.stderr}`);
  const out=json(r.stdout);
  assert.equal(out?.reason,'model-outside-order',(r.stdout+r.stderr).slice(0,800));
  assert.equal(out?.model,model);
  assert.equal(out?.tier,'high');
  assert.equal(out?.difficulty,'hard','decide and plan kinds launch at their hard floor');
  assert.deepEqual(out?.allowed,allowed);
  assert.equal(fx.status(jobId),'queued','the job stays queued');
  assert.deepEqual(fx.callArgv(),[],'no Orca call is made');
  return out;
};

test('starci kernel dispatch --model refuses a hand pool for a decide kind and names the tier members',t=>{
  const fx=fixture(t);
  fx.seed({jobId:'job-decide-hand',payload:{model:'claude-agent',modelId:'claude-opus-5-5',difficulty:'medium'}});
  const dry=fx.run('dispatch','--repo',fx.repo,'--job','job-decide-hand','--model','devin-agent','--json');
  assert.equal(dry.status,0,dry.stderr||dry.stdout);
  assert.match(json(dry.stdout)?.modelOutsideOrder??'',/--model devin-agent is outside/,'a dry run says the spawn will refuse');
  const out=refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-decide-hand','--model','devin-agent','--spawn','--json'),'job-decide-hand',{model:'devin-agent'});
  assert.match(out.detail,/--model devin-agent is outside business\.decide's tier high at hard \[claude\/claude-sonnet-5-5, codex\/gpt-6\.1-sol\]/);
});

test('starci kernel dispatch refuses the unrouted default and a persisted route outside the order',t=>{
  const fx=fixture(t);
  fx.seed({jobId:'job-unrouted',opId:'request.analyze',payload:{}});
  const unrouted=refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-unrouted','--spawn','--json'),'job-unrouted',{model:'devin-agent'});
  assert.match(unrouted.detail,/the unrouted default devin-agent .*re-run starci kernel route --job job-unrouted/);
  fx.seed({jobId:'job-stale-route',opId:'scope.define',payload:{model:'devin-agent',modelId:'swe-2-max',difficulty:'hard'}});
  const stale=refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-stale-route','--spawn','--json'),'job-stale-route',{model:'devin-agent'});
  assert.match(stale.detail,/the persisted route devin\/swe-2-max .*re-run starci kernel route --job job-stale-route/);
});

test('starci kernel dispatch --model inside the order launches that pool at the kind\'s tier',t=>{
  const fx=fixture(t);
  // An unrouted decide job measured medium: its floor is hard, so codex launches the high tier's Sol, never Luna.
  fx.seed({jobId:'job-decide-codex',payload:{difficulty:'medium'}});
  for(const target of ['codex-agent','gpt-6.1-sol']){
    const r=fx.run('dispatch','--repo',fx.repo,'--job','job-decide-codex','--model',target,'--json');
    assert.equal(r.status,0,`${target}: ${r.stderr||r.stdout}`);
    assert.equal(json(r.stdout)?.launch?.model,'gpt-6.1-sol',target);
  }
  // A job routed to codex-agent and dispatched with --model claude-agent launches the tier's Claude member,
  // never the routed Codex model id.
  fx.seed({jobId:'job-decide-claude',payload:{model:'codex-agent',modelId:'gpt-6.1-sol',effort:'high',difficulty:'hard'}});
  const r=fx.run('dispatch','--repo',fx.repo,'--job','job-decide-claude','--model','claude-agent','--spawn','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const start=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.equal(start?.[start.indexOf('--agent')+1],'claude');
  assert.equal(start?.[start.indexOf('--model')+1],'claude-sonnet-5-5','the explicit agent keeps the tier model');
});
