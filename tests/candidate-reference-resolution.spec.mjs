import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {candidateReferences} from '../kernel/kernel.mjs';
import {candidateRootBindingDigest,candidateRootBindings} from '../kernel/candidate-roots.mjs';
import {grammarReferences} from '../kernel/common.mjs';

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

test('external shared Work references bind to the accepted owner without losing their original spelling',t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-code-')),owner=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-'));
  t.after(()=>{fs.rmSync(repo,{recursive:true,force:true});fs.rmSync(owner,{recursive:true,force:true});});
  fs.writeFileSync(path.join(repo,'source.md'),'source bytes\n');
  const node={id:'demo.frontend.ui',path:'features/demo/ui/index.yaml'},workRoot=path.join(owner,'.starciwork'),nodeFile=path.join(workRoot,node.path);
  fs.mkdirSync(path.dirname(nodeFile),{recursive:true});fs.writeFileSync(nodeFile,'schema: work/node@2\n');
  const ctx={work:{ledger:{repoRoot:owner,workRoot},loaded:{nodes:new Map([[node.id,node]]),list:[node]}}},state={worktree:repo};
  const resolved=candidateReferences({references:[`${node.id}#design`,'source.md',nodeFile]},state,ctx);
  assert.deepEqual(resolved.map(item=>[item.rootId,item.path,item.sourceRef]),[
    ['work',`.starciwork/${node.path}`,`${node.id}#design`],['source','source.md','source.md'],['work',`.starciwork/${node.path}`,nodeFile.replaceAll('\\','/')]]);
  const unrelated=path.join(path.dirname(owner),'unrelated.txt');fs.writeFileSync(unrelated,'not routed\n');
  assert.throws(()=>candidateReferences({references:[unrelated]},state,ctx),/outside the accepted routed roots/);
});

test('root binding identity changes when Work ownership or read-only reference mapping changes',t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-code-')),owner=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-'));
  t.after(()=>{fs.rmSync(repo,{recursive:true,force:true});fs.rmSync(owner,{recursive:true,force:true});});
  for(const name of ['.starciwork-a','.starciwork-b']){const file=path.join(owner,name,'rule.md');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${name}\n`);}
  const make=workName=>{const workRoot=path.join(owner,workName),work={ledger:{repoRoot:owner,workRoot},loaded:{nodes:new Map(),list:[]}},state={worktree:repo},op={allowlist:['src/**'],references:[path.join(workRoot,'rule.md')],kernelOwned:[]};
    const resolved=candidateReferences(op,state,{work});return candidateRootBindings({state,op,work,resolvedReferences:resolved}).bindings;};
  const first=make('.starciwork-a'),second=make('.starciwork-b');
  assert.notEqual(candidateRootBindingDigest(first),candidateRootBindingDigest(second));
  assert.notDeepEqual(first.find(root=>root.id==='work').references,second.find(root=>root.id==='work').references);
});

test('sealed runtime canon is discovered and only the workflow-bound authored runtime can translate pre-pin references',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-runtime-ref-')),repo=path.join(temp,'code'),host=path.join(temp,'runtime-source'),pin=path.join(temp,'sealed');
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));fs.mkdirSync(repo,{recursive:true});
  const authored=path.join(host,'knowledge','grammars','index.yaml'),compiled=path.join(pin,'.dist','knowledge','grammars','INDEX.json');
  fs.mkdirSync(path.dirname(authored),{recursive:true});fs.writeFileSync(authored,'schema: grammar/index@1\n');
  fs.mkdirSync(path.dirname(compiled),{recursive:true});fs.writeFileSync(compiled,'{"schema":"grammar/index@1"}\n');
  const state={worktree:repo,host,engine:{runtimePin:{root:pin}}},ctx={work:{ledger:{repoRoot:repo,workRoot:path.join(repo,'.starciwork')},loaded:{nodes:new Map(),list:[]}}};
  assert.deepEqual(grammarReferences(pin),[compiled.replaceAll('\\','/')]);
  const translated=candidateReferences({references:[authored]},state,ctx)[0];
  assert.deepEqual([translated.rootId,translated.ref,translated.sourceRef],['runtime','.dist/knowledge/grammars/INDEX.json',authored.replaceAll('\\','/')]);
  const derived=candidateReferences({references:grammarReferences(pin)},state,ctx)[0];
  assert.deepEqual([derived.rootId,derived.ref,derived.sourceRef],['runtime','.dist/knowledge/grammars/INDEX.json',compiled.replaceAll('\\','/')]);
  const foreign=path.join(temp,'unrelated','knowledge','grammars','index.yaml');
  assert.throws(()=>candidateReferences({references:[foreign]},state,ctx),/outside the accepted routed roots/);
  assert.throws(()=>candidateRootBindings({state,work:ctx.work,op:{allowlist:[compiled]}}),/cannot write the read-only runtime-input root/);
});
