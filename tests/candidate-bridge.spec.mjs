import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {acknowledgeRuntimeBaseline,beginDetectionCandidate,candidateChecksNeedDependencies,candidateDependencyPlan,candidateWriterResource,freezeDetectionCandidate,prepareCandidateDependencies,resolveCandidateReference,runtimeWriterHint} from '../kernel/candidate-bridge.mjs';

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

test('a write under .starciwork quarantines as custody-path-touched, never as ordinary scope drift',t=>{
  // The ledger record itself is never inventoried (see runtimeLocalPaths' ledgerRecord skip) - its custody
  // comes from the allowlist compiler refusing the scope up front. Any other `.starciwork` path is still
  // walked and hashed, so a stray write there is what this classification exists to catch.
  const f=fixture(t);fs.mkdirSync(path.join(f.root,'.starciwork','_local'),{recursive:true});fs.writeFileSync(path.join(f.root,'.starciwork','_local','rogue.json'),'tampered bytes');
  const result=freezeDetectionCandidate(f.bridge,{git});assert.equal(result.status,'quarantine');
  assert.ok(result.reasons.includes('custody-path-touched:.starciwork/_local/rogue.json'),JSON.stringify(result.reasons));
  assert.equal(result.reasons.some(reason=>reason.startsWith('outside-allowlist:')),false,'a custody-path write is never reported as ordinary scope drift');
});

test('the tracked ledger anchor is invisible to candidate observation, exactly like the untracked ledger files',t=>{
  // §12: the anchor is rewritten on every store.saveState() checkpoint - kernel-owned churn unrelated to any
  // candidate or worker, so a freeze mid-op must never see it as custody-path-touched (or anything else).
  const f=fixture(t);fs.mkdirSync(path.join(f.root,'.starciwork'),{recursive:true});
  fs.writeFileSync(path.join(f.root,'.starciwork','ledger-anchor.json'),JSON.stringify({schema:'starci/ledger-anchor@1',ledgerId:'x',updatedAt:0,workflows:{}}));
  fs.writeFileSync(path.join(f.root,'src','app.js'),'two\n');
  const sealed=freezeDetectionCandidate(f.bridge,{git,reportedFiles:['src/app.js']});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  assert.deepEqual(sealed.observedFiles,['src/app.js']);
  fs.writeFileSync(path.join(f.root,'.starciwork','ledger-anchor.json'),JSON.stringify({schema:'starci/ledger-anchor@1',ledgerId:'x',updatedAt:1,workflows:{wf:{generation:1}}}));
  const replay=freezeDetectionCandidate(f.bridge,{git,reportedFiles:['src/app.js']});
  assert.equal(replay.status,'sealed',JSON.stringify(replay.reasons));
});

test('an allowlist covering the ledger record is refused at candidate open, not observed later',t=>{
  const root=cloneTemplate(t,appBase,'starci-ledger-scope-'),parent=path.dirname(root);
  const identity={workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'job-ledger'};
  for(const entry of ['.starciwork','.starciwork/**','.starciwork/runtime.sqlite','.starciwork/runtime.sqlite-journal','.starciwork/runtime.sqlite-wal','.starciwork/runtime.sqlite-shm'])
    assert.throws(()=>beginDetectionCandidate({identity,repoRoot:root,workerRoot:path.join(parent,`${path.basename(root)}-candidate`),
      controlRoot:path.join(parent,`${path.basename(root)}-control`),allowlist:[entry],references:[],git,environmentDigest:'env'}),
      /scope-covers-ledger/,`allowlist entry ${entry} must be refused`);
});

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

test('dependency artifact installs inside the private candidate with a private cache',t=>{const f=fixture(t);f.bridge.dependency.command='synthetic install';
  const result=prepareCandidateDependencies(f.bridge,{exec:(command,options)=>{assert.equal(options.cwd,f.bridge.snapshot.workerRoot);assert.equal(options.env.npm_config_cache.startsWith(f.bridge.snapshot.controlRoot),true);
    fs.mkdirSync(path.join(options.cwd,'node_modules','tool'),{recursive:true});fs.writeFileSync(path.join(options.cwd,'node_modules','tool','index.js'),'ok');return {status:0,stdout:'installed'};}});
  assert.equal(result.ready,true);assert.equal(result.root.startsWith(f.bridge.snapshot.workerRoot),false);assert.equal(result.checkEnv.NODE_PATH,path.join(f.bridge.snapshot.workerRoot,'node_modules'));
});

test('dependency planning is gated by check consumers and honors declared package-manager provenance',t=>{
  const root=cloneTemplate(t,initOnlyBase,'starci-bridge-plan-');fs.writeFileSync(path.join(root,'package.json'),'{"packageManager":"pnpm@10.0.0"}');fs.writeFileSync(path.join(root,'package-lock.json'),'{}');fs.writeFileSync(path.join(root,'pnpm-lock.yaml'),'lockfileVersion: 9\n');
  assert.equal(candidateChecksNeedDependencies([{command:'node host/validate-yaml.mjs'}]),false);
  for(const command of ['node node_modules/eslint/bin/eslint.js src/a.ts','node "node_modules/eslint/bin/eslint.js" src/a.ts',"node 'node_modules/eslint/bin/eslint.js' src/a.ts",'npm run typecheck --workspace app','tsc --noEmit','eslint src','jest --runInBand','vitest run','next build','nest build'])
    assert.equal(candidateChecksNeedDependencies([{command}]),true,command);
  assert.equal(candidateDependencyPlan(root,{required:false}).ready,true);
  assert.deepEqual(candidateDependencyPlan(root,{required:true}),{manager:'pnpm',command:null,ready:false,reason:'unsupported declared package manager: pnpm'});
  const absent=cloneTemplate(t,initOnlyBase,'starci-bridge-no-package-');assert.deepEqual(candidateDependencyPlan(absent,{required:true}),{manager:null,command:null,ready:false,reason:'package tools are required but package.json is missing'});
});

test('dependency preparation rejects a link that escapes the private candidate',t=>{const f=fixture(t);f.bridge.dependency.command='synthetic install';
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'starci-external-dependency-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  const result=prepareCandidateDependencies(f.bridge,{exec:(command,options)=>{fs.mkdirSync(path.join(options.cwd,'node_modules'),{recursive:true});fs.symlinkSync(outside,path.join(options.cwd,'node_modules','escape'),'junction');return {status:0,stdout:'installed'};}});
  assert.equal(result.ready,false);assert.match(result.evidence,/external links: node_modules\/escape/);
});

test('dependency preparation rejects external root and workspace-local node_modules before following them',t=>{
  for(const placement of ['node_modules','apps/app/node_modules']){const f=fixture(t);f.bridge.dependency.command='synthetic install';const outside=fs.mkdtempSync(path.join(os.tmpdir(),'starci-external-modules-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
    const result=prepareCandidateDependencies(f.bridge,{exec:(command,options)=>{const target=path.join(options.cwd,...placement.split('/'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.symlinkSync(outside,target,'junction');return {status:0,stdout:'installed'};}});
    assert.equal(result.ready,false,placement);assert.match(result.evidence,new RegExp(`external links: ${placement.replace('/','\\/')}`));
  }
});

test('npm workspace dependencies materialize in the candidate for literal node_modules and workspace scripts',t=>{
  const root=cloneTemplate(t,initOnlyBase,'starci-bridge-workspace-');fs.mkdirSync(path.join(root,'apps','app'),{recursive:true});fs.mkdirSync(path.join(root,'packages','tool'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),JSON.stringify({private:true,workspaces:['apps/*','packages/*']}));
  fs.writeFileSync(path.join(root,'apps','app','package.json'),JSON.stringify({name:'@demo/app',version:'1.0.0',scripts:{typecheck:'node ../../node_modules/tool/bin.js'},dependencies:{tool:'1.0.0'}}));
  fs.writeFileSync(path.join(root,'packages','tool','package.json'),JSON.stringify({name:'tool',version:'1.0.0'}));fs.writeFileSync(path.join(root,'packages','tool','bin.js'),'console.log("workspace-ok")\n');
  assert.equal(spawnSync('npm install --package-lock-only --ignore-scripts --no-audit --no-fund',{cwd:root,encoding:'utf8',windowsHide:true,shell:true}).status,0);
  run(root,'add','-A');run(root,'commit','--quiet','-m','workspace');
  const parent=path.dirname(root),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'workspace',attempt:1,generation:1,jobId:'workspace-job'},repoRoot:root,
    workerRoot:path.join(parent,`${path.basename(root)}-candidate`),controlRoot:path.join(parent,`${path.basename(root)}-control`),allowlist:['apps/app/**'],git,environmentDigest:'env'});
  t.after(()=>{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});});
  assert.deepEqual(candidateDependencyPlan(bridge.snapshot.workerRoot),{manager:'npm',lockfile:'package-lock.json',command:'npm ci --ignore-scripts --no-audit --no-fund',lifecycleScripts:'disabled'});
  const installed=prepareCandidateDependencies(bridge,{exec:(command,options)=>spawnSync(command,{...options})});assert.equal(installed.ready,true,installed.evidence);
  const links=[];for(const entry of fs.readdirSync(path.join(bridge.snapshot.workerRoot,'node_modules'),{withFileTypes:true})){const target=path.join(bridge.snapshot.workerRoot,'node_modules',entry.name);if(fs.lstatSync(target).isSymbolicLink())links.push(fs.realpathSync(target));}
  assert.ok(links.length>0,'npm workspaces should create candidate-local links');assert.ok(links.every(target=>path.relative(bridge.snapshot.workerRoot,target)&&!path.relative(bridge.snapshot.workerRoot,target).startsWith('..')),'workspace links stay inside the candidate');
  const literal=spawnSync(process.execPath,['node_modules/tool/bin.js'],{cwd:bridge.snapshot.workerRoot,encoding:'utf8',env:{...process.env,...installed.checkEnv}});
  const workspace=spawnSync('npm run typecheck --workspace @demo/app',{cwd:bridge.snapshot.workerRoot,encoding:'utf8',windowsHide:true,shell:true,env:{...process.env,...installed.checkEnv}});
  assert.equal(literal.status,0,literal.stderr);assert.match(literal.stdout,/workspace-ok/);assert.equal(workspace.status,0,workspace.stderr);assert.match(workspace.stdout,/workspace-ok/);
});

test('kernel runtime bytes are copied into frozen worker and base views without changing protected oracles',t=>{const f=fixture(t),oracle=f.bridge.snapshot.oracle.digest;
  fs.writeFileSync(path.join(f.root,'src','runtime.js'),'kernel mark\n');acknowledgeRuntimeBaseline(f.bridge,['src/runtime.js']);
  assert.equal(fs.readFileSync(path.join(f.bridge.snapshot.workerRoot,'src','runtime.js'),'utf8'),'kernel mark\n');
  assert.equal(fs.readFileSync(path.join(f.bridge.snapshot.baseRoot,'src','runtime.js'),'utf8'),'kernel mark\n');assert.equal(f.bridge.snapshot.oracle.digest,oracle);
});

test('runtime acknowledgement rebaselines an allowlisted path but protects an acknowledged path outside the allowlist',t=>{
  const allowed=fixture(t);fs.writeFileSync(path.join(allowed.root,'src','runtime.js'),'kernel baseline\n');
  const rebound=acknowledgeRuntimeBaseline(allowed.bridge,['src/runtime.js']);assert.deepEqual(rebound.protectedPaths,[]);
  fs.writeFileSync(path.join(allowed.root,'src','runtime.js'),'worker change\n');
  const accepted=freezeDetectionCandidate(allowed.bridge,{git,reportedFiles:['src/runtime.js'],requireReported:true});
  assert.equal(accepted.status,'sealed',JSON.stringify(accepted.reasons));

  const protectedFixture=fixture(t);const protectedPath='keep.txt';
  const protectedResult=acknowledgeRuntimeBaseline(protectedFixture.bridge,[protectedPath]);assert.deepEqual(protectedResult.protectedPaths,[protectedPath]);
  fs.writeFileSync(path.join(protectedFixture.root,protectedPath),'worker drift\n');
  const refused=freezeDetectionCandidate(protectedFixture.bridge,{git,reportedFiles:[protectedPath],requireReported:true});
  assert.equal(refused.status,'quarantine');assert.ok(refused.reasons.includes(`kernel-owned-write-drift:${protectedPath}`),JSON.stringify(refused.reasons));
});

test('the whole .starciwork subtree is excluded from candidate references, staged inputs included',t=>{
  const root=cloneTemplate(t,appBase,'starci-inputs-'),parent=path.dirname(root);
  const input=path.join(root,'.starciwork','_local','inputs','wf','1-handoff.md');fs.mkdirSync(path.dirname(input),{recursive:true});fs.writeFileSync(input,'owner staged bytes\n');
  const live=path.join(root,'.starciwork','_local','workflows','wf','state.json');fs.mkdirSync(path.dirname(live),{recursive:true});fs.writeFileSync(live,'{}\n');
  const identity={workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'job-in'};
  // Goal-staged owner inputs are ledger rows now (`inputs.materialise`), never a `.starciwork` path a candidate
  // can reference directly: the retired `_local/inputs` exception is gone along with everything else under it.
  assert.throws(()=>beginDetectionCandidate({identity,repoRoot:root,workerRoot:path.join(parent,'in-candidate'),controlRoot:path.join(parent,'in-control'),
    allowlist:['src/**'],references:['.starciwork/_local/inputs/wf/1-handoff.md'],git,environmentDigest:'env'}),
    /not a readable, permitted source file/,'a staged _local input is no longer a candidate reference');
  assert.throws(()=>beginDetectionCandidate({identity:{...identity,jobId:'job-live'},repoRoot:root,
    workerRoot:path.join(parent,'live-candidate'),controlRoot:path.join(parent,'live-control'),
    allowlist:['src/**'],references:['.starciwork/_local/workflows/wf/state.json'],git,environmentDigest:'env'}),
    /not a readable, permitted source file/,'live kernel state is never a candidate input');
});
