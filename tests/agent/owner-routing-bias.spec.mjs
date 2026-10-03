import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {normalizeOwnerRoutingBias,biasForRole} from '../../scripts/lib/owner-routing-bias.mjs';
import {inspectLedger} from '../../engine/db/ledger.mjs';
import {ownerReserveGrant} from '../../scripts/agent/admission.mjs';

const grant={authorized:true,scopeId:'wf/job.a1',role:'op',provider:'claude',model:'claude-opus-5-5',reason:'owner explicitly permits this attempt at 96 percent'};
test('legacy soft aliases keep their shape and avoid wins',()=>{
  assert.deepEqual(normalizeOwnerRoutingBias({prefer:['Codex','claude','codex-agent','unknown'],avoid:['CLAUDE']}),{prefer:['codex-agent'],avoid:['claude-agent']});
  assert.deepEqual(normalizeOwnerRoutingBias(null),{prefer:[],avoid:[]});
});
test('concrete model requirements survive normalization',()=>{
  assert.deepEqual(normalizeOwnerRoutingBias({require:{provider:'Anthropic',model:'claude-sonnet-5-5'}}),{prefer:[],avoid:[],require:{provider:'claude',model:'claude-sonnet-5-5'}});
});
test('a hard requirement cannot silently disappear or contradict exclusion',()=>{
  for(const require of [{},{provider:'missing'},{pool:'missing'},{model:''},{provider:'claude',pool:'codex'},{provider:'claude',fallback:'codex'}])
    assert.throws(()=>normalizeOwnerRoutingBias({require}),{code:'invalid-owner-routing-bias'});
  assert.throws(()=>normalizeOwnerRoutingBias({require:{provider:'claude'},avoid:['claude-agent']}),/conflicts with avoid/);
  assert.throws(()=>normalizeOwnerRoutingBias({require:{pool:'claude'},avoid:[{provider:'claude'}]}),/conflicts with avoid/);
  assert.doesNotThrow(()=>normalizeOwnerRoutingBias({require:{provider:'claude'},avoid:[{model:'claude-sonnet-5-5'}]}),'excluding Sonnet leaves Opus eligible');
});
test('an Op requirement does not become a Critic or Kernel pin',()=>{
  const bias={require:{provider:'claude'}};
  assert.equal(biasForRole(bias,'op','job').require.provider,'claude');
  assert.deepEqual(biasForRole(bias,'critic','job'),{prefer:[],avoid:[]});
  assert.deepEqual(biasForRole(bias,'kernel','job'),{prefer:[],avoid:[]});
  assert.equal(biasForRole({...bias,roles:['op','critic']},'critic','job').require.provider,'claude');
});
test('a reserve override is explicit data scoped to the exact role and attempt',()=>{
  const bias={require:{provider:'claude'},reserveOverride:grant};
  assert.deepEqual(biasForRole(bias,'op',grant.scopeId).reserveOverride,grant);
  assert.equal(biasForRole(bias,'op','wf/job.a2').reserveOverride,undefined);
  assert.equal(biasForRole(bias,'worker',grant.scopeId).reserveOverride,undefined);
  assert.deepEqual(normalizeOwnerRoutingBias(bias).reserveOverride,grant);
});
test('malformed or unscoped grants fail closed',()=>{
  for(const bad of [{...grant,authorized:false},{...grant,scopeId:''},{...grant,role:'unknown'},{...grant,reason:''},{...grant,provider:'missing'},{...grant,model:''},{...grant,extra:true}])
    assert.throws(()=>normalizeOwnerRoutingBias({reserveOverride:bad}),{code:'invalid-owner-routing-bias'});
  assert.throws(()=>normalizeOwnerRoutingBias({roles:['critic'],reserveOverride:grant}),/outside the bias roles/);
  assert.throws(()=>normalizeOwnerRoutingBias({roles:[]}),/nonempty array/);
});
test('selectors can constrain several fields and a preference never adds a provider',()=>{
  const result=normalizeOwnerRoutingBias({prefer:[{provider:'OpenAI',model:'gpt-6.1-sol'},{pool:'claude'}],avoid:[{provider:'claude'}]});
  assert.deepEqual(result,{prefer:[{provider:'codex',model:'gpt-6.1-sol'}],avoid:[{provider:'claude'}]});
});

const root=path.resolve(import.meta.dirname,'../..');
const cli=(t,args,env={})=>{
  const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'owner-bias-cli-'));
  t.after(()=>fs.rmSync(scratch,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const result=spawnSync(process.execPath,[path.join(root,'packages/cli/bin/starci.mjs'),...(typeof args==='function'?args(scratch):args)],{
    cwd:root,encoding:'utf8',windowsHide:true,timeout:30000,
    env:{...process.env,...env,STARCI_LOCAL_ROOT:scratch,STARCI_TEST_MACHINE_FILE:path.join(scratch,'machine.sqlite')}
  });
  return {result,scratch};
};
test('workflow bias preserves a concrete requirement through the public CLI',t=>{
  const {result}=cli(t,['workflow','bias','--normalize',JSON.stringify({require:{provider:'Anthropic',model:'claude-sonnet-5-5'}})]);
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{prefer:[],avoid:[],require:{provider:'claude',model:'claude-sonnet-5-5'}});
});
test('workflow bias extracts the declared English exclusion through the public CLI',t=>{
  const {result}=cli(t,['workflow','bias',"don't use codex"]);
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout),{prefer:[],avoid:['codex-agent']});
});
test('workflow bias refuses malformed JSON and conflicting hard intent as bad usage',t=>{
  for(const raw of ['{',JSON.stringify({require:{provider:'claude'},avoid:['claude']})]){
    const {result}=cli(t,['workflow','bias','--normalize',raw]);
    assert.equal(result.status,2,result.stderr);
    assert.equal(result.stdout.trim(),'');
  }
});
test('workflow define refuses invalid or delegated reserve authority before writing state',t=>{
  const cases=[['--routing-bias','{'],['--routing-bias',JSON.stringify({require:{provider:'unknown'}})],
    ['--routing-bias',JSON.stringify({reserveOverride:grant}),'--defined-by','supervisor','--bridge-id','bridge.test']];
  for(const extra of cases){
    const {result,scratch}=cli(t,['workflow','define','--text','assess the model policy','--plan',...extra]);
    assert.equal(result.status,2,result.stderr);
    assert.equal(fs.existsSync(path.join(scratch,'machine.sqlite')),false,'rejected authority cannot create a host store');
    assert.equal(fs.existsSync(path.join(scratch,'projects')),false,'rejected authority cannot create a project ledger');
  }
});
test('delegated roles cannot record owner reserve authority through the public CLI',t=>{
  for(const role of ['op','supervisor','lead','coordinator']){
    const {result,scratch}=cli(t,['workflow','define','--text','assess the model policy','--plan',
      '--routing-bias',JSON.stringify({reserveOverride:grant})],{STARCI_ROLE:role});
    assert.equal(result.status,2,result.stderr);
    assert.equal(fs.existsSync(path.join(scratch,'machine.sqlite')),false,`${role} cannot create a host store`);
    assert.equal(fs.existsSync(path.join(scratch,'projects')),false,`${role} cannot create a project ledger`);
  }
});
test('an owner CLI definition persists the exact reserve grant and ledger authority',t=>{
  const bias={prefer:[],avoid:[],roles:['op'],require:{provider:'claude',model:grant.model},reserveOverride:grant};
  const {result,scratch}=cli(t,directory=>{
    const repo=path.join(directory,'app');
    fs.mkdirSync(repo);
    return ['workflow','define','--repo',repo,'--text','assess the model policy',
      '--routing-bias',JSON.stringify(bias),'--reason','owner explicitly approved this exact recovery attempt','--json'];
  },{STARCI_ROLE:'',ORCA_TERMINAL_HANDLE:''});
  assert.equal(result.status,0,result.stderr);
  const receipt=JSON.parse(result.stdout);
  assert.equal(receipt.queued,true);
  assert.ok(path.relative(scratch,receipt.ledger).startsWith('projects'+path.sep),'ledger must stay in the isolated root');
  const ledger=inspectLedger({file:receipt.ledger});
  try{
    const goal=ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(receipt.workflowId);
    assert.equal(goal.approved_by,'owner');
    assert.deepEqual(JSON.parse(goal.json).routing_bias,bias);
    assert.deepEqual(ownerReserveGrant(goal),grant,'the launch adapter receives the actual persisted owner row');
    const inbox=ledger.db.prepare('SELECT payload_json FROM inbox WHERE workflow_id=? AND kind=?').get(receipt.workflowId,'goal');
    assert.deepEqual(JSON.parse(inbox.payload_json).routing_bias,bias);
  }finally{ledger.close();}
});
