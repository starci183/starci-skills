import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {parseYaml} from '../engine/yaml.mjs';
import {buildSpawnCommand} from '../scripts/agent/lib.mjs';

// Unattended Codex operations launch with the codex card's bypassArgs.
// A managed `orca orchestration worker-start --agent codex` has no approval
// or sandbox flag, so Codex ran on Orca's default approval policy and every
// tool call reached the owner as an "Allow Codex to make changes" prompt.
// The codex profiles are therefore card-composed command terminals: the same
// command (model + effort + bypassArgs) the Kernel terminal boots with.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const DISPATCH_OP=path.join(ROOT,'scripts','route','dispatch-op.mjs');
const PROFILES=path.join(ROOT,'modules','models','profiles');
const AGENTS=path.join(ROOT,'modules','models','agents');
const MANAGED_KINDS=['managed-agent','native-managed-agent'];
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const readYaml=file=>parseYaml(fs.readFileSync(file,'utf8'));

const cards=Object.fromEntries(fs.readdirSync(AGENTS).filter(f=>f.endsWith('.yaml'))
  .map(f=>[f.replace(/\.yaml$/,''),readYaml(path.join(AGENTS,f))]));
const bypassOf=provider=>(cards[provider]?.terminalFallback?.bypassArgs??[]).map(String);
const profiles=fs.readdirSync(PROFILES).filter(f=>f.endsWith('.yaml'))
  .map(f=>({target:f.replace(/\.yaml$/,''),doc:readYaml(path.join(PROFILES,f))}));

// Each bypass argument must appear as its own token (quoted or bare) in order.
const assertCarries=(command,args,label)=>{
  assert.ok(args.length>0,`${label}: no bypassArgs to check`);
  const tokens=String(command).split(/\s+/).map(t=>t.replace(/^['"]|['"]$/g,''));
  let at=-1;
  for(const arg of args){
    const next=tokens.indexOf(arg,at+1);
    assert.ok(next>at,`${label}: launch command lacks '${arg}' from the card bypassArgs — ${command}`);
    at=next;
  }
};

const fixture=(t,{mode='healthy'}={})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-codex-ops-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:mode,
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
  };
  const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const callArgv=()=>fs.existsSync(path.join(root,'calls.jsonl'))
    ?fs.readFileSync(path.join(root,'calls.jsonl'),'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l).argv)
    :[];
  const find=verb=>callArgv().filter(argv=>argv.slice(0,2).join(' ')===verb);
  const orcaState=()=>json(fs.readFileSync(path.join(root,'state.json'),'utf8'))??{};
  return {root,repo,env,run,callArgv,find,orcaState};
};

const seed=(fx,{workflowId,jobId,payload})=>{
  const ledger=openLedger({file:ledgerFileFor(fx.repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload});
  }finally{ledger.close();}
};
const jobRow=(repo,jobId)=>{
  const ledger=inspectLedger({file:ledgerFileFor(repo)});
  try{return ledger.db.prepare('SELECT status,worker_id,payload_json,result_json FROM jobs WHERE job_id=?').get(jobId);}
  finally{ledger.close();}
};

/* ------------------------------------------------------------ static law */

test('no Codex profile launches through managed worker-start',()=>{
  const codex=profiles.filter(p=>p.doc?.provider==='codex');
  assert.deepEqual(codex.map(p=>p.target).sort(),['codex-agent','gpt-6-luna','gpt-6-sol']);
  for(const {target,doc} of codex){
    const orca=doc.launch?.orca??{};
    assert.equal(orca.kind,'command-terminal',`${target}: an unattended Codex op must be a command terminal`);
    assert.equal(orca.adapter,'codex',`${target}: the codex card composes the command`);
    assert.ok(!MANAGED_KINDS.includes(orca.kind),`${target} would reach worker-start --agent codex without bypassArgs`);
  }
  // Any managed profile left must belong to a card that is not Codex.
  for(const {target,doc} of profiles)
    if(MANAGED_KINDS.includes(doc?.launch?.orca?.kind))
      assert.notEqual(doc.launch.orca.agent??doc.provider,'codex',`${target}: managed Codex launch`);
});

test('every card with bypassArgs composes an op command that carries them',()=>{
  const withBypass=Object.keys(cards).filter(name=>bypassOf(name).length);
  assert.ok(withBypass.includes('codex'),'the codex card declares bypassArgs');
  for(const provider of withBypass){
    // Card-composed shape (routed model + effort) and an explicit override.
    const composed=buildSpawnCommand({provider,model:'probe-model',effort:'high'});
    assert.ok(!composed.error,`${provider}: ${composed.error}`);
    assertCarries(composed.command,bypassOf(provider),`${provider} card-composed`);
    const explicit=buildSpawnCommand({provider,command:`${cards[provider].terminalFallback.command} --model probe-model`});
    assert.ok(!explicit.error,`${provider}: ${explicit.error}`);
    assertCarries(explicit.command,bypassOf(provider),`${provider} explicit command`);
  }
});

test('api dispatch and dispatch-op dry runs of every command-terminal profile show the card bypassArgs',t=>{
  const fx=fixture(t);
  const terminalProfiles=profiles.filter(p=>p.doc?.launch?.orca?.kind==='command-terminal'&&bypassOf(p.doc.provider).length);
  assert.ok(terminalProfiles.length>=3,'the codex profiles are command terminals with card bypassArgs');
  terminalProfiles.forEach(({target,doc},i)=>{
    const workflowId=`wf-dry-${i}`,jobId=`job-dry-${i}`;
    seed(fx,{workflowId,jobId,payload:{opId:'code.refactor',owned_paths:['docs/'],model:target,difficulty:'hard'}});
    const dry=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model',target,'--json');
    assert.equal(dry.status,0,`${target}: ${dry.stderr||dry.stdout}`);
    const out=json(dry.stdout);
    assert.equal(out?.orca?.launchKind,'command-terminal');
    assert.ok(!out?.spawnCommand?.error,`${target}: ${out?.spawnCommand?.error}`);
    assertCarries(out.spawnCommand.command,bypassOf(doc.provider),`${target} api dispatch`);
    assert.equal(out.orca.commands.some(c=>/worker-start/.test(c.cli)),false,`${target}: no worker-start in the plan`);

    const op=fx.run(DISPATCH_OP,'--op','code.refactor','--model',target,'--json');
    assert.equal(op.status,0,`${target}: ${op.stderr||op.stdout}`);
    const create=json(op.stdout)?.orca?.commands?.find(c=>c.step==='create');
    assert.ok(create,`${target}: dispatch-op plans a terminal create`);
    assertCarries(create.cli,bypassOf(doc.provider),`${target} dispatch-op`);
  });
  // Card-composed Codex pins the routed difficulty's model and effort.
  const sol=json(fx.run(API,'dispatch','--repo',fx.repo,'--job',`job-dry-${terminalProfiles.findIndex(p=>p.target==='codex-agent')}`,'--model','codex-agent','--json').stdout);
  assert.match(sol.spawnCommand.command,/--model\s+'gpt-6-sol'/);
  assert.match(sol.spawnCommand.command,/model_reasoning_effort="high"/);
  assert.equal(sol.spawnCommand.model,'gpt-6-sol');
  assert.equal(sol.spawnCommand.effort,'high');
});

/* --------------------------------------------------- end-to-end, fake Orca */

test('a Codex op dispatches as an unattended command terminal: Task, preamble, attested model, settle closes it',t=>{
  const fx=fixture(t);
  const workflowId='wf-codex-op',jobId='job-codex-op';
  seed(fx,{workflowId,jobId,payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  const r=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
  assert.equal(r.status,0,`codex dispatch failed: ${r.stderr||r.stdout}`);

  assert.deepEqual(fx.find('orchestration worker-start'),[],'no Codex op goes through worker-start');
  const creates=fx.find('terminal create');
  assert.equal(creates.length,1);
  const create=creates[0];
  const command=create[create.indexOf('--command')+1];
  assertCarries(command,bypassOf('codex'),'codex op terminal');
  assert.match(command,/(?:^|\s)codex(?:\s|$)/);
  assert.match(command,/--model\s+'gpt-6-sol'/);
  assert.match(command,/model_reasoning_effort="high"/);
  assert.equal(create[create.indexOf('--worktree')+1],fx.repo,'same worktree value the managed path passed to worker-start');
  assert.equal(create[create.indexOf('--title')+1],`[Op] code.refactor a1 · ${workflowId}`);

  const task=fx.find('orchestration task-create')[0];
  assert.equal(task?.[task.indexOf('--display-name')+1],'[Op] code.refactor');
  assert.equal(task?.[task.indexOf('--from')+1],'fake-kernel-terminal','the Task hangs under the Kernel');
  const dispatch=fx.find('orchestration dispatch')[0];
  assert.ok(dispatch?.includes('--return-preamble'),'the Task binds through dispatch --return-preamble');
  assert.equal(dispatch?.[dispatch.indexOf('--to')+1],'fake-terminal-1');
  assert.ok(fx.find('orchestration dispatch-show').length>=1,'the assignee is attested');

  const job=jobRow(fx.repo,jobId);
  assert.equal(job?.status,'running');
  assert.equal(job?.worker_id,'fake-terminal-1','a command-terminal op is held by its terminal handle');
  const payload=json(job?.payload_json);
  assert.equal(payload?.modelId,'gpt-6-sol','the model attested from the rendered terminal is persisted');
  assert.equal(payload?.effort,'high');
  assert.equal(payload?.hierarchy?.parentNodeId,`agent:kernel:${workflowId}`);
  assert.equal(payload?.hierarchy?.runtime?.model,'gpt-6-sol');
  assert.equal(payload?.hierarchy?.runtime?.terminalHandle,'fake-terminal-1');
  assert.equal(payload?.orca?.agentTerminalHandle,'fake-terminal-1');
  assert.equal(payload?.managed,undefined,'not a managed worker');

  const report=path.join(fx.repo,'report.json');fs.writeFileSync(report,JSON.stringify({
    schema:'starci/op-report@1',outcome:'done',summary:'codex op completed',head:'abc1234def',
    files:['docs/codex-result.md'],checks:[{name:'self-check',command:'true',exitCode:0}],
  }));
  const filed=fx.run(API,'report','--repo',fx.repo,'--job',jobId,'--report',report,'--json');
  assert.equal(filed.status,0,`report failed: ${filed.stderr||filed.stdout}`);
  const checked=fx.run(API,'check','--repo',fx.repo,'--job',jobId,'--checks',JSON.stringify({
    checks:[{name:'validator',command:'codex validation',exitCode:0,evidence:'green'}],
  }),'--json');
  assert.equal(checked.status,0,`check failed: ${checked.stderr||checked.stdout}`);
  const s=fx.run(API,'settle','--repo',fx.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(s.status,0,`settle failed: ${s.stderr||s.stdout}`);
  assert.equal(jobRow(fx.repo,jobId)?.status,'succeeded');
  assert.ok((fx.orcaState().closed??[]).includes('fake-terminal-1'),'settle closes the op terminal');
  // With its tab, so Orca cannot resume the session under a new handle, and the
  // receipt stays on the job (two nivo strays were traced only by reading them).
  assert.deepEqual(fx.orcaState().closedTabs,['fake-terminal-1']);
  // custody: the receipt proves the worker gone, never infers it (inc-eb9a21769d69).
  assert.deepEqual(JSON.parse(jobRow(fx.repo,jobId).payload_json).terminalClosed,{handle:'fake-terminal-1',ok:true,tab:'tab-fake-terminal-1',quit:{sent:true,exited:true,command:'/quit'},custody:{state:'released',proof:'release-ok'}});
  // The agent quits itself before the close, so no hidden Codex process is left behind.
  assert.deepEqual(fx.orcaState().quits,[{handle:'fake-terminal-1',text:'/quit'}]);
  assert.deepEqual(fx.find('orchestration worker-stop'),[],'no managed worker to stop');
});

test('a rejected Codex op launch closes its terminal and never starts a managed worker',t=>{
  const fx=fixture(t,{mode:'auth'});
  const workflowId='wf-codex-reject',jobId='job-codex-reject';
  seed(fx,{workflowId,jobId,payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent'}});
  const r=fx.run(API,'dispatch','--repo',fx.repo,'--job',jobId,'--model','codex-agent','--spawn','--json');
  assert.notEqual(r.status,0,'a 401 terminal is a rejected dispatch');
  assert.equal(json(r.stdout)?.rejected,'dispatch-rejected');
  assert.notEqual(jobRow(fx.repo,jobId)?.status,'running');
  assert.deepEqual(fx.find('orchestration worker-start'),[]);
  const command=fx.find('terminal create')[0];
  assertCarries(command[command.indexOf('--command')+1],bypassOf('codex'),'rejected codex op terminal');
  const live=Object.values(fx.orcaState().terminals??{}).filter(term=>!term.closed).map(term=>term.handle);
  assert.deepEqual(live,[],'the refused terminal is closed');
});

// Five nivo Codex op launches failed model attestation ("did not render
// gpt-6-sol within 15000ms") and their rejections kept no screen; the refused
// terminal's tail now rides on dispatch-rejected, and the spawner closes a
// refused terminal with its tab.
test('a refused launch keeps its screen tail and is closed with its tab',()=>{
  const api=fs.readFileSync(path.join(ROOT,'scripts','kernel','api.mjs'),'utf8');
  assert.ok(api.includes('screenTail: screenTailOf(details.screen)'),'dispatch-rejected carries the screen tail');
  const lib=fs.readFileSync(path.join(ROOT,'scripts','agent','lib.mjs'),'utf8');
  assert.ok(lib.includes('closed = closeOperationTerminal(handle)'),'a refused terminal closes with its tab');
});
