import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {launchTrustSettings,workflowPurgeSettings} from '../../engine/config.mjs';
import {launchTrustVerdict,ensureLaunchTrust,claudeKeyForms} from '../../scripts/agent/trust.mjs';
import {spawnAgent,loadAdapter,gateAutoAnswerRule} from '../../scripts/agent/lib.mjs';
import {fakeAdmission} from '../helpers/fake-admission.mjs';
const world=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'owner-trust-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));const repo=path.join(root,'repo'),other=path.join(root,'other'),home=path.join(root,'home');for(const dir of [repo,other,home])fs.mkdirSync(dir);return {root,repo,other,home};};
const profile=roots=>({launchTrust:{profile:'automatic',approvedBy:'owner',approvalRef:'private fixture current adoption',roots}});
test('owner profiles are closed and cannot borrow a historical public default',()=>{
  assert.equal(launchTrustSettings({}),null);assert.equal(workflowPurgeSettings({}),null);
  for(const value of [{profile:'automatic',approvedBy:'runtime',approvalRef:'old Q6',roots:['/repo']},{profile:'automatic',approvedBy:'owner',approvalRef:'',roots:['/repo']},{profile:'automatic',approvedBy:'owner',approvalRef:'current',roots:['relative']},{profile:'automatic',approvedBy:'owner',approvalRef:'current',roots:['/repo'],allDirectories:true}])assert.throws(()=>launchTrustSettings({launchTrust:value}));
});
test('only an exact adopted root admits an existing directory; prefixes and unresolved selectors refuse',t=>{
  const {repo,other}=world(t),child=path.join(repo,'child');fs.mkdirSync(child);
  const roots=dir=>[dir];
  assert.equal(launchTrustVerdict({cwd:repo,config:{},roots}).ok,false);
  assert.equal(launchTrustVerdict({cwd:repo,config:profile([repo]),roots}).ok,true);
  assert.equal(launchTrustVerdict({cwd:child,config:profile([repo]),roots}).ok,false);
  assert.equal(launchTrustVerdict({cwd:other,config:profile([repo]),roots}).ok,false);
  assert.equal(launchTrustVerdict({cwd:'new-child',config:profile([repo]),roots}).ok,false);
  assert.equal(launchTrustVerdict({cwd:repo,config:{launchTrust:{...profile([repo]).launchTrust,profile:'declined'}},roots}).ok,false);
});
test('missing adoption and provider declines leave private trust files byte-exact',t=>{
  const {repo,home}=world(t),env={NODE_TEST_CONTEXT:'child-v8',STARCI_AGENT_TRUST_HOME:home};
  assert.equal(ensureLaunchTrust({agent:'claude',cwd:repo,config:{},env}).status,'declined');
  assert.deepEqual(fs.readdirSync(home),[]);assert.deepEqual(fs.readdirSync(repo),[]);
  const file=path.join(home,'.claude.json'),original=JSON.stringify({projects:{[claudeKeyForms(repo)[0]]:{hasTrustDialogAccepted:false}}});fs.writeFileSync(file,original);
  assert.equal(ensureLaunchTrust({agent:'claude',cwd:repo,config:profile([repo]),env}).status,'declined');
  assert.equal(fs.readFileSync(file,'utf8'),original);assert.deepEqual(fs.readdirSync(repo),[]);
  fs.mkdirSync(path.join(home,'.codex'));const toml=path.join(home,'.codex','config.toml'),declined=`[projects.${JSON.stringify(repo)}]\ntrust_level = "untrusted"\n`;fs.writeFileSync(toml,declined);
  assert.equal(ensureLaunchTrust({agent:'codex',cwd:repo,config:profile([repo]),env}).status,'declined');assert.equal(fs.readFileSync(toml,'utf8'),declined);assert.deepEqual(fs.readdirSync(repo),[]);
});
test('a failed or declined trust receipt releases the known reserved slot and prevents worker-start',()=>{
  for(const trust of [{status:'declined',reason:'owner declined'},{status:'failed',errors:[{error:'cannot verify file'}]}]){
    let starts=0;const admission=fakeAdmission(),io={admission,hostAgent:()=>({ok:true}),trust:()=>trust,start:()=>{starts++;throw Error('must not start');}};
    const out=spawnAgent({provider:'codex',model:'gpt-6.1-sol',worktree:'/private-fixture',request:{job:'trust-refusal'},io,preflight:{depth:1,limit:10}});
    assert.equal(out.ok,false);assert.equal(out.step,'launch-trust');assert.equal(out.effectState,'none');assert.equal(starts,0);
    assert.equal(admission.calls.filter(([name])=>name==='reserve').length,1);
    assert.equal(admission.calls.filter(([name])=>name==='release').length,1);
    assert.equal([...admission.reservations.values()][0].state,'released');
  }
  for(const [agent,gate] of [['codex','codex-directory-trust'],['claude','claude-workspace-trust'],['claude','claude-bypass-permissions-consent']])assert.equal(gateAutoAnswerRule(loadAdapter(agent).card,gate),null,'a screen cannot prove owner-approved repository scope');
});
