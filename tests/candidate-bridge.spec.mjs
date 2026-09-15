import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {acknowledgeRuntimeBaseline,beginDetectionCandidate,candidateWriterResource,freezeDetectionCandidate,prepareCandidateDependencies,resolveCandidateReference,runtimeWriterHint} from '../kernel/candidate-bridge.mjs';

const git=(command,args,options)=>spawnSync(command,args,options);
const run=(cwd,...args)=>{const result=git('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
const fixture=(t,references=['src/app.js'])=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-bridge-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  run(root,'init','--quiet','-b','main');run(root,'config','user.email','bridge@starci.local');run(root,'config','user.name','Bridge');run(root,'config','commit.gpgsign','false');
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','app.js'),'one\n');fs.writeFileSync(path.join(root,'keep.txt'),'user baseline\n');
  fs.writeFileSync(path.join(root,'package.json'),'{"scripts":{"test":"node src/app.js"}}\n');fs.writeFileSync(path.join(root,'secret.enc'),'ciphertext\n');
  run(root,'add','-A');run(root,'commit','--quiet','-m','base');fs.writeFileSync(path.join(root,'keep.txt'),'existing user edit\n');
  const parent=path.dirname(root),identity={workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'job'};
  const bridge=beginDetectionCandidate({identity,repoRoot:root,workerRoot:path.join(parent,`${path.basename(root)}-candidate`),controlRoot:path.join(parent,`${path.basename(root)}-control`),
    allowlist:['src/**'],references,git,environmentDigest:'env'});
  t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});return {root,bridge};};

test('native compatibility advertises one detection-only writer resource',t=>{const f=fixture(t),resource=candidateWriterResource(f.root),hint=runtimeWriterHint({repoRoot:f.root});
  assert.equal(resource.units,1);assert.equal(hint.maxWriters,1);assert.equal(hint.assurance,'detection-only');assert.equal(hint.resource.key,resource.key);});

test('snapshot carries the full tracked build closure while excluding secret material and Git metadata',t=>{const f=fixture(t),paths=f.bridge.snapshot.source.entries.map(item=>item.path);
  assert.ok(paths.includes('package.json'));assert.ok(paths.includes('src/app.js'));assert.equal(paths.includes('secret.enc'),false);assert.equal(paths.some(file=>file.startsWith('.git/')),false);});

test('settled worker delta is derived from Git and frozen independently of report.files',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'src','app.js'),'two\n');
  const result=freezeDetectionCandidate(f.bridge,{git,reportedFiles:[]});assert.equal(result.status,'sealed');assert.deepEqual(result.observedFiles,['src/app.js']);assert.deepEqual(result.packet.reportedFiles,[]);});

test('modifying pre-existing user work or writing outside allowlist quarantines without revert',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'keep.txt'),'worker collision\n');
  fs.writeFileSync(path.join(f.root,'escape.txt'),'escape\n');const result=freezeDetectionCandidate(f.bridge,{git});assert.equal(result.status,'quarantine');
  assert.ok(result.reasons.some(reason=>reason.startsWith('pre-existing-user-work-modified:keep.txt')));assert.ok(result.reasons.includes('outside-allowlist:escape.txt'));
  assert.equal(fs.readFileSync(path.join(f.root,'keep.txt'),'utf8'),'worker collision\n');});

test('renames include source and destination in the observed patch',t=>{const f=fixture(t);fs.renameSync(path.join(f.root,'src','app.js'),path.join(f.root,'src','renamed.js'));
  const result=freezeDetectionCandidate(f.bridge,{git});assert.equal(result.status,'sealed');assert.deepEqual(result.observedFiles,['src/app.js','src/renamed.js']);
  assert.deepEqual(result.packet.changes.map(item=>item.path),['src/app.js','src/renamed.js']);});

test('only explicitly provenance-owned dirty allowlist paths may advance',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owned-dirty-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));run(root,'init','--quiet','-b','main');
  run(root,'config','user.email','bridge@starci.local');run(root,'config','user.name','Bridge');run(root,'config','commit.gpgsign','false');fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'src','dirty.js'),'base\n');run(root,'add','-A');run(root,'commit','--quiet','-m','base');fs.writeFileSync(path.join(root,'src','dirty.js'),'owned prior attempt\n');
  const suffix=path.basename(root),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:2,generation:1,jobId:'job'},repoRoot:root,
    workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],ownedDirtyPaths:['src/dirty.js'],git});
  t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'src','dirty.js'),'current attempt\n');assert.equal(freezeDetectionCandidate(bridge,{git}).status,'sealed');
});

test('a prior attempt\'s owned path that is clean now is dropped from ownership, not a launch failure',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owned-clean-'));t.after(()=>{try{fs.rmSync(root,{recursive:true,force:true});}catch{}});run(root,'init','--quiet','-b','main');
  run(root,'config','user.email','bridge@starci.local');run(root,'config','user.name','Bridge');run(root,'config','commit.gpgsign','false');fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'src','dirty.js'),'committed by the owner since\n');run(root,'add','-A');run(root,'commit','--quiet','-m','base');
  const suffix=path.basename(root),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:3,generation:1,jobId:'job'},repoRoot:root,
    workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],ownedDirtyPaths:['src/dirty.js'],git});
  t.after(()=>{try{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});}catch{}});
  assert.deepEqual(bridge.droppedOwnedPaths,['src/dirty.js']);
  assert.deepEqual(bridge.ownedDirtyPaths,[]);
  fs.mkdirSync(path.join(root,'docs'));fs.writeFileSync(path.join(root,'docs','outside.md'),'dirty and outside\n');
  assert.throws(()=>beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:3,generation:1,jobId:'job2'},repoRoot:root,
    workerRoot:path.join(path.dirname(root),`${suffix}-candidate2`),controlRoot:path.join(path.dirname(root),`${suffix}-control2`),allowlist:['src/**'],references:[],ownedDirtyPaths:['docs/outside.md'],git}),
    /must be inside the bounded allowlist/,'an owned path outside the allowlist is still refused even when clean');
});

test('typed and anchored references bind the complete contained source file and retain fragment metadata',t=>{
  assert.deepEqual(resolveCandidateReference('sds:.starciwork/design.md#section-3'),{kind:'sds',path:'.starciwork/design.md',fragment:'section-3',ref:'.starciwork/design.md#section-3'});
  assert.deepEqual(resolveCandidateReference({kind:'file',ref:'src/app.js#L1'}),{kind:'file',path:'src/app.js',fragment:'L1',ref:'src/app.js#L1'});
  assert.throws(()=>resolveCandidateReference('sds:../outside.md#x'),/escapes the source root/);
  const f=fixture(t,['sds:src/app.js#section-3']);assert.equal(f.bridge.snapshot.source.entries.find(item=>item.path==='src/app.js').size,4);
  assert.deepEqual(f.bridge.resolvedReferences,[{kind:'sds',path:'src/app.js',fragment:'section-3',ref:'src/app.js#section-3'}]);
  assert.throws(()=>beginDetectionCandidate({identity:f.bridge.identity,repoRoot:f.root,workerRoot:'unused',controlRoot:'unused',references:['sds:../outside.md#x'],git}),/escapes the source root/);
});

test('candidate evidence environment identity rejects object-shaped runtime pins',t=>{const f=fixture(t);
  assert.throws(()=>beginDetectionCandidate({identity:f.bridge.identity,repoRoot:f.root,workerRoot:'unused',controlRoot:'unused',references:[],git,environmentDigest:{digest:'env'}}),/nonempty string/);
});

test('dependency artifact is installed outside candidate without symlinks or an external cache',t=>{const f=fixture(t);f.bridge.dependency.command='synthetic install';
  const result=prepareCandidateDependencies(f.bridge,{exec:(command,options)=>{assert.equal(options.cwd.startsWith(f.bridge.snapshot.controlRoot),true);assert.deepEqual(Object.keys(options.env),['npm_config_cache']);assert.equal(options.env.npm_config_cache.startsWith(options.cwd),true);
    fs.mkdirSync(path.join(options.cwd,'node_modules','tool'),{recursive:true});fs.writeFileSync(path.join(options.cwd,'node_modules','tool','index.js'),'ok');return {status:0,stdout:'installed'};}});
  assert.equal(result.ready,true);assert.equal(result.root.startsWith(f.bridge.snapshot.workerRoot),false);assert.equal(result.checkEnv.NODE_PATH,path.join(result.root,'node_modules'));
});

test('kernel runtime bytes are copied into frozen worker and base views without changing protected oracles',t=>{const f=fixture(t),oracle=f.bridge.snapshot.oracle.digest;
  fs.writeFileSync(path.join(f.root,'src','runtime.js'),'kernel mark\n');acknowledgeRuntimeBaseline(f.bridge,['src/runtime.js']);
  assert.equal(fs.readFileSync(path.join(f.bridge.snapshot.workerRoot,'src','runtime.js'),'utf8'),'kernel mark\n');
  assert.equal(fs.readFileSync(path.join(f.bridge.snapshot.baseRoot,'src','runtime.js'),'utf8'),'kernel mark\n');assert.equal(f.bridge.snapshot.oracle.digest,oracle);
});
