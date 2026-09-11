import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseYaml} from '../core/yaml.mjs';
import {decideApproval,validateApprovalPolicy} from '../approvals/policy.mjs';

const policy=parseYaml(fs.readFileSync(new URL('../approvals/policy.yaml',import.meta.url),'utf8'));
const context=(type='source.edit')=>({
  schema:'starci/approval-context@1',
  brief:{status:'accepted',digest:'a'.repeat(64),allowedActions:['source.edit','test.run','fallback.no-effects','commit.local'],repositories:['nivo-backend'],scopes:['agentos'],reservedCheckpoints:[]},
  action:{type,repository:'nivo-backend',scope:'agentos',effectState:type==='fallback.no-effects'?'none':'known-within-brief'}
});

test('approval policy has one brief boundary and a machine-readable automatic envelope',()=>{
  assert.deepEqual(validateApprovalPolicy(policy),{ok:true,errors:[]});
  assert.equal(policy.entry.checkpoint,'workflow-brief');
  assert.equal(policy.withinAcceptedBrief.decision,'auto');
  assert.equal(policy.needUser.decision,'need-user');
});

test('read-only brief preparation is automatic before acceptance, effects are not',()=>{
  const read=context('inspect.read-only');read.brief.status='missing';read.brief.digest=null;read.action.effectState='none';
  assert.equal(decideApproval(policy,read).reason,'pre-brief-read-only');
  const edit=context();edit.brief.status='presented';
  assert.deepEqual(decideApproval(policy,edit),{schema:'starci/approval-decision@1',decision:'need-user',reason:'missing-or-unaccepted-brief',briefDigest:'a'.repeat(64),action:'source.edit',repository:'nivo-backend',scope:'agentos'});
});

test('accepted brief automates declared technical procedure and rejects material expansion',()=>{
  assert.equal(decideApproval(policy,context()).decision,'auto');
  for(const mutate of [
    value=>{value.action.businessOrSrsChange=true;},
    value=>{value.action.scope='other-module';},
    value=>{value.action.repository='nivo-fe';},
    value=>{value.action.effectState='unknown';},
    value=>{value.brief.reservedCheckpoints=['source.edit'];}
  ]){const value=context();mutate(value);assert.equal(decideApproval(policy,value).decision,'need-user');}
});

test('external effects and provider fallback stay inside explicit ceilings',()=>{
  const push=context('push.remote');
  assert.equal(decideApproval(policy,push).reason,'action-outside-effect-ceiling');
  push.brief.allowedActions.push('push.remote');
  assert.equal(decideApproval(policy,push).decision,'auto');
  const fallback=context('fallback.no-effects');fallback.action.fallbackReason='rate-limited';
  assert.equal(decideApproval(policy,fallback).decision,'auto');
  fallback.action.effectState='partial';
  assert.equal(decideApproval(policy,fallback).reason,'partial-or-unknown-effects');
});
