import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {candidateReferences} from '../kernel/kernel.mjs';

test('candidate references resolve Work-relative paths and canonical node ids through the loaded ledger',t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-ref-'));t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const node={id:'nivo.shared.business.srs.rule.recovery',path:'features/shared/business/srs/rule/recovery/index.yaml'};
  const file=path.join(repo,'.starciwork',node.path);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'schema: work/node@2\n');
  fs.writeFileSync(path.join(repo,'.starciwork','workspace.yaml'),'schema: work/workspace@1\n');
  const ctx={work:{
    ledger:{repoRoot:repo,workRoot:path.join(repo,'.starciwork')},
    loaded:{nodes:new Map([[node.id,node]]),list:[node]}
  }};
  const state={worktree:repo};
  assert.deepEqual(candidateReferences({references:[`${node.path}#rule`,node.id,'workspace.yaml']},state,ctx).map(item=>item.ref),
    [`.starciwork/${node.path}#rule`,`.starciwork/${node.path}`,'.starciwork/workspace.yaml']);
  assert.throws(()=>candidateReferences({references:['nivo.missing.rule']},state,ctx),/not resolved/);
});

test('external shared Work ledgers block explicitly until candidate multi-root snapshots are supported',t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-code-')),owner=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-'));
  t.after(()=>{fs.rmSync(repo,{recursive:true,force:true});fs.rmSync(owner,{recursive:true,force:true});});
  assert.throws(()=>candidateReferences({references:[]},{worktree:repo},{work:{ledger:{repoRoot:owner,workRoot:path.join(owner,'.starciwork')},loaded:{nodes:new Map(),list:[]}}}),/external shared Work ledger/);
});
