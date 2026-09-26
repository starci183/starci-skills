import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {kindOrder} from '../scripts/agent/models.mjs';

// Owner decision 2026-09-25 ("khoá decide cho claude/codex"): strategy kinds - every kind whose order is
// think, decide or plan - run only on claude-agent or codex-agent. Owner routing 2026-09-26 adds the kernel
// calls' sol-think order to that frontier-only contract (Sol first, Opus overflow). Route walks that order;
// api dispatch launches only inside the kind's order at its tier, whatever names the pool (--model, the
// persisted route, the unrouted default).

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const RT=parseYaml(fs.readFileSync(path.join(ROOT,'modules','models','runtimes.yaml'),'utf8'));
const STRATEGY_ORDERS=['think','decide','plan','sol-think'];
const FRONTIER=['claude-agent','codex-agent'];
const DIFFICULTIES=['easy','medium','hard','insane'];
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

test('every think/decide/plan order at every tier and in preference names only claude-agent or codex-agent',()=>{
  for(const d of DIFFICULTIES){
    const tier=RT.allocation.tiers[d];
    assert.ok(tier&&typeof tier==='object',`allocation.tiers.${d} is declared`);
    for(const key of STRATEGY_ORDERS){
      const order=tier[key];
      assert.ok(Array.isArray(order)&&order.length,`allocation.tiers.${d}.${key} lists a pool`);
      assert.deepEqual(order.filter(p=>!FRONTIER.includes(p)),[],`allocation.tiers.${d}.${key}`);
    }
  }
  for(const key of STRATEGY_ORDERS)
    assert.deepEqual(RT.allocation.preference[key].filter(p=>!FRONTIER.includes(p)),[],`allocation.preference.${key}`);
});

test('every kind that walks a strategy order resolves to claude-agent/codex-agent pools at every difficulty',()=>{
  const strategy=Object.keys(RT.roleOfKind).filter(kind=>STRATEGY_ORDERS.includes(kindOrder({kind,difficulty:'hard',runtimes:RT}).orderKey));
  for(const kind of ['business.decide','architecture.decide','brand.decide','scope.define','request.analyze','decision.prepare','implementation.plan'])
    assert.ok(strategy.includes(kind),`${kind} walks a strategy order`);
  for(const kind of strategy) for(const d of DIFFICULTIES) for(const fanOut of [false,true]){
    const {chain,orderKey}=kindOrder({kind,difficulty:d,fanOut,runtimes:RT});
    assert.ok(STRATEGY_ORDERS.includes(orderKey),`${kind} at ${d}${fanOut?' (cut slice)':''} stays on its strategy order`);
    assert.ok(chain.length,`${kind} at ${d} has a pool`);
    assert.deepEqual(chain.filter(p=>!FRONTIER.includes(p)),[],`${kind} at ${d}${fanOut?' (cut slice)':''}`);
  }
});

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-strategy-pools-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_OWNER_ROOT:path.join(root,'owner'),
  };
  const run=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const callArgv=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const seed=({jobId,opId='business.decide',payload})=>{
    const workflowId=`wf-${jobId}`;
    const ledger=openLedger({file:ledgerFileFor(repo)});
    try{
      ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
        payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
      ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
      ledger.enqueueJob({jobId,workflowId,opId,kind:'op',payload:{opId,owned_paths:['docs/'],...payload}});
    }finally{ledger.close();}
  };
  const status=jobId=>{
    const ledger=inspectLedger({file:ledgerFileFor(repo)});
    try{return ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{ledger.close();}
  };
  return {repo,run,callArgv,seed,status};
};

const refused=(fx,r,jobId,{model,allowed=FRONTIER})=>{
  assert.equal(r.status,1,`dispatch must refuse: ${r.stdout}${r.stderr}`);
  const out=json(r.stdout);
  assert.equal(out?.reason,'model-outside-order',(r.stdout+r.stderr).slice(0,800));
  assert.equal(out?.model,model);
  assert.equal(out?.order,'think');
  assert.equal(out?.difficulty,'hard','think kinds launch at their hard floor');
  assert.deepEqual(out?.allowed,allowed);
  assert.equal(fx.status(jobId),'queued','the job stays queued');
  assert.deepEqual(fx.callArgv(),[],'no Orca call is made');
  return out;
};

test('api dispatch --model refuses a hand pool for a decide kind and names the allowed pools',t=>{
  const fx=fixture(t);
  fx.seed({jobId:'job-decide-qwen',payload:{model:'claude-agent',modelId:'claude-opus-5-5',difficulty:'medium'}});
  const dry=fx.run('dispatch','--repo',fx.repo,'--job','job-decide-qwen','--model','qwen-agent','--json');
  assert.equal(dry.status,0,dry.stderr||dry.stdout);
  assert.match(json(dry.stdout)?.modelOutsideOrder??'',/--model qwen-agent is outside/,'a dry run says the spawn will refuse');
  const out=refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-decide-qwen','--model','qwen-agent','--spawn','--json'),'job-decide-qwen',{model:'qwen-agent'});
  assert.match(out.detail,/--model qwen-agent is outside business\.decide's think order at hard \[claude-agent, codex-agent\]/);
  // A named profile target of a hand provider is refused the same way.
  refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-decide-qwen','--model','qwen3.8-max','--spawn','--json'),'job-decide-qwen',{model:'qwen3.8-max'});
});

test('api dispatch refuses the unrouted default and a persisted route outside the order',t=>{
  const fx=fixture(t);
  fx.seed({jobId:'job-unrouted',opId:'request.analyze',payload:{}});
  const unrouted=refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-unrouted','--spawn','--json'),'job-unrouted',{model:'qwen-agent'});
  assert.match(unrouted.detail,/the unrouted default qwen-agent .*re-run api route --job job-unrouted/);
  fx.seed({jobId:'job-stale-route',opId:'scope.define',payload:{model:'devin-agent',modelId:'swe-2-max',difficulty:'hard'}});
  const stale=refused(fx,fx.run('dispatch','--repo',fx.repo,'--job','job-stale-route','--spawn','--json'),'job-stale-route',{model:'devin-agent'});
  assert.match(stale.detail,/the persisted route devin-agent .*re-run api route --job job-stale-route/);
});

test('api dispatch --model inside the order launches that pool at the kind\'s tier',t=>{
  const fx=fixture(t);
  // An unrouted think job measured medium: codex launches Sol, the hard-floor pin, never Luna.
  fx.seed({jobId:'job-decide-codex',payload:{difficulty:'medium'}});
  for(const target of ['codex-agent','gpt-6-sol']){
    const r=fx.run('dispatch','--repo',fx.repo,'--job','job-decide-codex','--model',target,'--json');
    assert.equal(r.status,0,`${target}: ${r.stderr||r.stdout}`);
    assert.equal(json(r.stdout)?.spawnCommand?.model,'gpt-6-sol',target);
  }
  // A job routed to codex-agent and dispatched with --model claude-agent launches Claude's own pin,
  // never the routed Codex model id.
  fx.seed({jobId:'job-decide-claude',payload:{model:'codex-agent',modelId:'gpt-6-sol',effort:'high',difficulty:'hard'}});
  const r=fx.run('dispatch','--repo',fx.repo,'--job','job-decide-claude','--model','claude-agent','--spawn','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const start=fx.callArgv().find(argv=>argv.slice(0,2).join(' ')==='orchestration worker-start');
  assert.equal(start?.[start.indexOf('--agent')+1],'claude');
  assert.equal(start?.[start.indexOf('--model')+1],'claude-opus-5-5');
});
