import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,unlinkSync,existsSync,chmodSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {createSharedSourceFixture,incorporateAndRegress} from './workflow-shared-source-fixture.mjs';
import {git,put} from './workflow-source-fixture.mjs';

test('A/B continue independent writes, consume exact accepted C through normal merge, then execute source regression',async t=>{
 const f=await createSharedSourceFixture(t);
 const readiness=await f.call('coordinationReadiness',f.coordinator);
 assert.ok(readiness.every(row=>row.status==='waiting-incorporation'));
 const original=git(f.a.worktree,'rev-parse','HEAD');
 const dirty=path.join(f.a.worktree,'local-user-work.txt');put(dirty,'keep this uncommitted work');
 const args={input:f.a.importRef,alias:'@workspaces/be',worktree:f.a.worktree};
 await assert.rejects(f.call('incorporateExtraction',f.a,f.a.dependencyId,args),/COORDINATION_DIRTY/);
 assert.equal(readFileSync(dirty,'utf8'),'keep this uncommitted work');assert.equal(git(f.a.worktree,'rev-parse','HEAD'),original);unlinkSync(dirty);
 await assert.rejects(f.call('incorporateExtraction',f.a,f.a.dependencyId,{...args,worktree:f.b.worktree}),/registered consumer/);
 const model=path.join(f.a.session,'step-100/parallel-1/response/response.md'),bytes=readFileSync(model);put(model,'changed accepted import');
 await assert.rejects(f.call('incorporateExtraction',f.a,f.a.dependencyId,args),/COORDINATION_INPUT/);put(model,bytes);
 const a=await incorporateAndRegress(f,f.a);
 // Crash the actual command after Git committed the exact merge but before the consumer wrote
 // its receipt. The repository's real post-merge hook provides a deterministic external barrier.
 const hooks=path.join(f.a.home,'hooks'),entered=path.join(f.a.home,'hook-entered'),release=path.join(f.a.home,'hook-release'),finished=path.join(f.a.home,'hook-finished');
 const sh=file=>file.replaceAll('\\','/');
 const hook=path.join(hooks,'post-merge');put(hook,`#!/bin/sh\nprintf reached > '${sh(entered)}'\nwhile [ ! -f '${sh(release)}' ]; do sleep 0.05; done\nprintf finished > '${sh(finished)}'\n`);chmodSync(hook,0o755);git(f.a.repository,'config','core.hooksPath',hooks);
 const driver=path.join(f.a.home,'incorporate-driver.mjs');
 put(driver,`import {incorporateExtraction} from ${JSON.stringify(pathToFileURL(path.join(f.root,'scripts/workflow-coordination.mjs')).href)};await incorporateExtraction(${JSON.stringify(f.root)},${JSON.stringify(f.b.session)},${JSON.stringify(f.b.dependencyId)},${JSON.stringify({...args,worktree:f.b.worktree,input:f.b.importRef})});`);
 const child=spawn(process.execPath,[driver],{windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';child.stderr.on('data',data=>{stderr+=data;});const exit=new Promise(resolve=>child.on('exit',resolve));
 const until=async check=>{const stop=Date.now()+60000;while(!check()){assert.ok(Date.now()<stop,stderr||'incorporation barrier timed out');await new Promise(resolve=>setTimeout(resolve,20));}};
 try{
  await until(()=>existsSync(entered));child.kill();await exit;put(release,'continue');await until(()=>existsSync(finished));
  const pending=f.b.state().coordination.incorporations[0];assert.equal(pending.receipt,null,'a merge without a receipt cannot appear completed');
  const mergedHead=git(f.b.worktree,'rev-parse','HEAD');
  git(f.a.repository,'config','--unset','core.hooksPath');
  const b=await incorporateAndRegress(f,f.b);
  assert.equal(b.merged.head,mergedHead,'retry measures the original crash result without a second merge');
  assert.equal(a.quality.proof.operatorId,'quality.verify');assert.equal(b.quality.proof.operatorId,'quality.verify');
  assert.notEqual(a.source.head,b.source.head,'consumer deliveries are actually distinct descendants of the shared commit');
 }finally{put(release,'continue');if(child.exitCode===null)child.kill();await exit;}
 assert.ok((await f.call('coordinationReadiness',f.coordinator)).every(row=>row.status==='ready'));
});
