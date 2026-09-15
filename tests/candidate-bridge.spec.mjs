import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {acknowledgeRuntimeBaseline,beginDetectionCandidate,candidateWriterResource,freezeDetectionCandidate,prepareCandidateDependencies,resolveCandidateReference,runtimeWriterHint} from '../kernel/candidate-bridge.mjs';

const git=(command,args,options)=>spawnSync(command,args,options);
const run=(cwd,...args)=>{const result=git('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
// Building a fresh git repo from scratch (init + 3x config + add + commit, six process spawns) is the dominant cost
// of every test below, and most tests want the exact same tracked history. Each templated base is built once and
// filesystem-copied per test (a single in-process fs.cpSync, no spawn) instead of re-running git to reproduce it;
// the two tests that need a divergent commit still copy the cheap initialised-only template and commit their own
// content, so only the repo shape is shared, never the assertions or the commit each test actually needs.
let appBase,initOnlyBase;
test.before(()=>{
  appBase=fs.mkdtempSync(path.join(os.tmpdir(),'starci-bridge-basetpl-'));
  run(appBase,'init','--quiet','-b','main');run(appBase,'config','user.email','bridge@starci.local');run(appBase,'config','user.name','Bridge');run(appBase,'config','commit.gpgsign','false');
  fs.mkdirSync(path.join(appBase,'src'));fs.writeFileSync(path.join(appBase,'src','app.js'),'one\n');fs.writeFileSync(path.join(appBase,'keep.txt'),'user baseline\n');
  fs.writeFileSync(path.join(appBase,'package.json'),'{"scripts":{"test":"node src/app.js"}}\n');fs.writeFileSync(path.join(appBase,'secret.enc'),'ciphertext\n');
  run(appBase,'add','-A');run(appBase,'commit','--quiet','-m','base');
  initOnlyBase=fs.mkdtempSync(path.join(os.tmpdir(),'starci-bridge-inittpl-'));
  run(initOnlyBase,'init','--quiet','-b','main');run(initOnlyBase,'config','user.email','bridge@starci.local');run(initOnlyBase,'config','user.name','Bridge');run(initOnlyBase,'config','commit.gpgsign','false');
});
test.after(()=>{fs.rmSync(appBase,{recursive:true,force:true});fs.rmSync(initOnlyBase,{recursive:true,force:true});});
const cloneTemplate=(t,template,prefix)=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),prefix));fs.cpSync(template,root,{recursive:true});t.after(()=>{try{fs.rmSync(root,{recursive:true,force:true});}catch{}});return root;};
const fixture=(t,references=['src/app.js'])=>{const root=cloneTemplate(t,appBase,'starci-bridge-');
  fs.writeFileSync(path.join(root,'keep.txt'),'existing user edit\n');
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

test('sealed replay rejects an extra newly-created allowlisted file outside the immutable delta',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.root,'src','app.js'),'two\n');
  const first=freezeDetectionCandidate(f.bridge,{git,reportedFiles:['src/app.js']});assert.equal(first.status,'sealed');
  fs.writeFileSync(path.join(f.root,'src','late.js'),'late write after sealing\n');
  const replay=freezeDetectionCandidate(f.bridge,{git,reportedFiles:['src/app.js']});
  assert.equal(replay.status,'quarantine');
  assert.ok(replay.reasons.includes('canonical-delta-added:src/late.js'));
  assert.equal(first.packet.changes.some(change=>change.path==='src/late.js'),false,'the sealed packet is never widened on replay');
});

test('modifying pre-existing user work or writing outside allowlist quarantines without revert',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.root,'keep.txt'),'worker collision\n');
  fs.writeFileSync(path.join(f.root,'escape.txt'),'escape\n');const result=freezeDetectionCandidate(f.bridge,{git});assert.equal(result.status,'quarantine');
  assert.ok(result.reasons.some(reason=>reason.startsWith('pre-existing-user-work-modified:keep.txt')));assert.ok(result.reasons.includes('outside-allowlist:escape.txt'));
  assert.equal(fs.readFileSync(path.join(f.root,'keep.txt'),'utf8'),'worker collision\n');});

test('only the owned continuation managed section is excluded; changing adjacent human notes is still a full-delta collision',t=>{
  const root=cloneTemplate(t,appBase,'starci-managed-'),start='<!-- managed:start -->',end='<!-- managed:end -->';fs.mkdirSync(path.join(root,'workflows'));
  fs.writeFileSync(path.join(root,'workflows','wf.md'),`# Human handoff\nkeep me\n\n${start}\nold runtime projection\n${end}\n`);run(root,'add','-A');run(root,'commit','--quiet','-m','continuation');
  const make=(job)=>{const suffix=`${path.basename(root)}-${job}`;const bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:job},repoRoot:root,
    workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],runtimeManagedFiles:[{path:'workflows/wf.md',start,end}],git,environmentDigest:'env'});
    t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});return bridge;};
  const accepted=make('managed-only');fs.writeFileSync(path.join(root,'workflows','wf.md'),`# Human handoff\nkeep me\n\n${start}\nnew runtime projection\n${end}\n`);fs.writeFileSync(path.join(root,'src','app.js'),'two\n');
  const sealed=freezeDetectionCandidate(accepted,{git});assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));assert.deepEqual(sealed.observedFiles,['src/app.js']);
  run(root,'add','-A');run(root,'commit','--quiet','-m','runtime-section');const collided=make('human-change');fs.writeFileSync(path.join(root,'workflows','wf.md'),`# Human handoff\nchanged by worker\n\n${start}\nnewer runtime projection\n${end}\n`);
  const refused=freezeDetectionCandidate(collided,{git});assert.equal(refused.status,'quarantine');assert.ok(refused.reasons.includes('outside-allowlist:workflows/wf.md'));
});

test('managed-only public brief updates coexist with pre-existing untracked and tracked-dirty human notes',t=>{
  const start='<!-- managed:start -->',end='<!-- managed:end -->',body=(note,value)=>`${note}\n\n${start}\n${value}\n${end}\n`;
  for(const mode of ['untracked','tracked-dirty']){
    const root=cloneTemplate(t,appBase,`starci-managed-${mode}-`),brief='workflows/wf.md';fs.mkdirSync(path.join(root,'workflows'));
    fs.writeFileSync(path.join(root,brief),body('Human notes preserved','old runtime projection'));
    if(mode==='tracked-dirty'){
      run(root,'add','-A');run(root,'commit','--quiet','-m','public brief');
      fs.writeFileSync(path.join(root,brief),body('Human notes locally revised before launch','old runtime projection'));
    }
    const suffix=`${path.basename(root)}-${mode}`,bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:mode},repoRoot:root,
      workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],runtimeManagedFiles:[{path:brief,start,end}],git,environmentDigest:'env'});
    t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});
    const note=mode==='tracked-dirty'?'Human notes locally revised before launch':'Human notes preserved';
    fs.writeFileSync(path.join(root,brief),body(note,'new runtime projection'));fs.writeFileSync(path.join(root,'src','app.js'),'two\n');
    const sealed=freezeDetectionCandidate(bridge,{git});assert.equal(sealed.status,'sealed',`${mode}: ${JSON.stringify(sealed.reasons)}`);assert.deepEqual(sealed.observedFiles,['src/app.js']);
  }
});

test('removed, duplicated or malformed managed markers remain full-file candidate collisions',t=>{
  const start='<!-- managed:start -->',end='<!-- managed:end -->',variants=[
    'Human notes\n\nruntime projection without markers\n',
    `Human notes\n\n${start}\none\n${start}\ntwo\n${end}\n`,
    `Human notes\n\n${end}\nwrong order\n${start}\n`
  ];
  for(const [index,body] of variants.entries()){
    const root=cloneTemplate(t,appBase,`starci-managed-malformed-${index}-`),brief='workflows/wf.md';fs.mkdirSync(path.join(root,'workflows'));
    fs.writeFileSync(path.join(root,brief),`Human notes\n\n${start}\nold\n${end}\n`);run(root,'add','-A');run(root,'commit','--quiet','-m','public brief');
    const suffix=`${path.basename(root)}-${index}`,bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:`malformed-${index}`},repoRoot:root,
      workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],runtimeManagedFiles:[{path:brief,start,end}],git,environmentDigest:'env'});
    t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});
    fs.writeFileSync(path.join(root,brief),body);const refused=freezeDetectionCandidate(bridge,{git});assert.equal(refused.status,'quarantine');assert.ok(refused.reasons.includes(`outside-allowlist:${brief}`));
  }
});

test('a malformed baseline cannot hide a human edit behind equal missing outside digests',t=>{
  const start='<!-- managed:start -->',end='<!-- managed:end -->',root=cloneTemplate(t,appBase,'starci-managed-malformed-baseline-'),brief='workflows/wf.md';
  fs.mkdirSync(path.join(root,'workflows'));fs.writeFileSync(path.join(root,brief),`Human notes preserved\n\n${start}\nold runtime projection\n`);
  const suffix=path.basename(root),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'malformed-baseline'},repoRoot:root,
    workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],runtimeManagedFiles:[{path:brief,start,end}],git,environmentDigest:'env'});
  t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,brief),`Human notes changed without authority\n\n${start}\nnew runtime projection\n`);
  const refused=freezeDetectionCandidate(bridge,{git});assert.equal(refused.status,'quarantine');assert.ok(refused.reasons.includes(`pre-existing-user-work-modified:${brief}`));assert.ok(refused.reasons.includes(`outside-allowlist:${brief}`));
});

test('renames include source and destination in the observed patch',t=>{const f=fixture(t);fs.renameSync(path.join(f.root,'src','app.js'),path.join(f.root,'src','renamed.js'));
  const result=freezeDetectionCandidate(f.bridge,{git});assert.equal(result.status,'sealed');assert.deepEqual(result.observedFiles,['src/app.js','src/renamed.js']);
  assert.deepEqual(result.packet.changes.map(item=>item.path),['src/app.js','src/renamed.js']);});

test('only explicitly provenance-owned dirty allowlist paths may advance',t=>{
  const root=cloneTemplate(t,initOnlyBase,'starci-owned-dirty-');fs.mkdirSync(path.join(root,'src'));
  fs.writeFileSync(path.join(root,'src','dirty.js'),'base\n');run(root,'add','-A');run(root,'commit','--quiet','-m','base');fs.writeFileSync(path.join(root,'src','dirty.js'),'owned prior attempt\n');
  const suffix=path.basename(root),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:2,generation:1,jobId:'job'},repoRoot:root,
    workerRoot:path.join(path.dirname(root),`${suffix}-candidate`),controlRoot:path.join(path.dirname(root),`${suffix}-control`),allowlist:['src/**'],references:[],ownedDirtyPaths:['src/dirty.js'],git});
  t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});
  fs.writeFileSync(path.join(root,'src','dirty.js'),'current attempt\n');assert.equal(freezeDetectionCandidate(bridge,{git}).status,'sealed');
});

test('a prior attempt\'s owned path that is clean now is dropped from ownership, not a launch failure',t=>{
  const root=cloneTemplate(t,initOnlyBase,'starci-owned-clean-');fs.mkdirSync(path.join(root,'src'));
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
