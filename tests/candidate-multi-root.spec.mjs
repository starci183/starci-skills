import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {beginDetectionCandidate,freezeDetectionCandidate,readCandidateBridge,readCandidatePacket} from '../kernel/candidate-bridge.mjs';
import {prepareCandidateIntegration} from '../kernel/candidates.mjs';
import {candidateRootBindingDigest} from '../kernel/candidate-roots.mjs';

const git=(command,args,options)=>spawnSync(command,args,options);
const run=(cwd,...args)=>{const result=git('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
function repo(root,files){fs.mkdirSync(root,{recursive:true});for(const [name,bytes] of Object.entries(files)){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  run(root,'init','--quiet','-b','main');run(root,'config','user.email','roots@starci.test');run(root,'config','user.name','Roots');run(root,'config','commit.gpgsign','false');run(root,'add','-A');run(root,'commit','--quiet','-m','base');return root;}
function fixture(t,{managed=false}={}){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-roots-')),source=repo(path.join(temp,'frontend'),{'src/app.js':'old source\n','source-rule.md':'source input\n'}),
    owner=repo(path.join(temp,'backend'),{'.starciwork/rule.md':'work input\n','.starciwork/evidence/capture.txt':'old evidence\n',
      ...(managed?{'.starciwork/workflows/wf.md':'Human note\n<!-- starci:continuation:start -->\nold\n<!-- starci:continuation:end -->\n'}:{})});
  const roots=[{id:'source',role:'source',repoRoot:source,primary:true,allowlist:['src/**'],references:[{kind:'file',ref:'source-rule.md',sourceRef:'source-rule.md',rootId:'source',rootRole:'source',path:'source-rule.md'}],
    inputPaths:[{kind:'file',ref:'source-rule.md',sourceRef:'source-rule.md',rootId:'source',rootRole:'source',path:'source-rule.md'}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:true,runtimeWritable:false,readOnly:false},
  {id:'work',role:'work',repoRoot:owner,workRoot:path.join(owner,'.starciwork'),primary:false,allowlist:['.starciwork/evidence/**'],references:[{kind:'sds',ref:'.starciwork/rule.md',sourceRef:'demo.rule',rootId:'work',rootRole:'work',path:'.starciwork/rule.md'}],
    inputPaths:[{kind:'sds',ref:'.starciwork/rule.md',sourceRef:'demo.rule',rootId:'work',rootRole:'work',path:'.starciwork/rule.md'}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:managed?['.starciwork/workflows/wf.md']:[],
    runtimeManagedFiles:managed?[{path:'.starciwork/workflows/wf.md',start:'<!-- starci:continuation:start -->',end:'<!-- starci:continuation:end -->'}]:[],workerWritable:true,runtimeWritable:managed,readOnly:false}];
  const control=path.join(temp,'control'),worker=path.join(temp,'worker'),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'frontend',attempt:1,generation:2,jobId:'job-roots'},
    workerRoot:worker,controlRoot:control,roots,bindingDigest:candidateRootBindingDigest(roots),git,environmentDigest:'env'});
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));return {temp,source,owner,roots,bridge,control};
}

test('two real repositories freeze, reload and validate under one exact root binding',t=>{
  const f=fixture(t),workFile=path.join(f.owner,'.starciwork/evidence/capture.txt');
  fs.writeFileSync(path.join(f.source,'src/app.js'),'new source\n');fs.writeFileSync(workFile,'new evidence\n');
  const frozen=freezeDetectionCandidate(f.bridge,{git,requireReported:true,reportedFiles:['src/app.js',workFile]});
  assert.equal(frozen.status,'sealed',JSON.stringify(frozen.reasons));assert.equal(frozen.packet.roots.length,2);
  assert.deepEqual(frozen.packet.changes.map(item=>item.rootId).sort(),['source','work']);
  assert.equal(readCandidateBridge(f.control).bindingDigest,f.bridge.bindingDigest);assert.equal(readCandidatePacket(f.control).roots.length,2);
  const prepared=prepareCandidateIntegration(frozen.snapshot,frozen.packet,{canonicalRoots:{source:f.source,work:f.owner},git,mode:'detection-canonical'});
  assert.equal(prepared.status,'ready',JSON.stringify(prepared.reasons));assert.deepEqual(prepared.roots.map(root=>root.id),['source','work']);
});

test('aggregate sealing rejects unreported per-root changes and protected-input drift',t=>{
  const missing=fixture(t);fs.writeFileSync(path.join(missing.source,'src/app.js'),'new source\n');fs.writeFileSync(path.join(missing.owner,'.starciwork/evidence/capture.txt'),'new evidence\n');
  const unreported=freezeDetectionCandidate(missing.bridge,{git,requireReported:true,reportedFiles:['src/app.js']});assert.equal(unreported.status,'quarantine');
  assert.ok(unreported.reasons.some(reason=>reason.includes('unreported-changed-file:')&&reason.includes('capture.txt')));
  const drift=fixture(t);fs.writeFileSync(path.join(drift.owner,'.starciwork/rule.md'),'tampered protected input\n');
  const refused=freezeDetectionCandidate(drift.bridge,{git,requireReported:true,reportedFiles:[path.join(drift.owner,'.starciwork/rule.md')]});assert.equal(refused.status,'quarantine');
  assert.ok(refused.reasons.some(reason=>reason==='work:outside-allowlist:.starciwork/rule.md'));
});

test('aggregate replay preserves a partially sealed root and catches deletion and source identity drift',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.source,'src/app.js'),'new source\n');
  const source=f.bridge.roots.find(root=>root.id==='source');assert.equal(freezeDetectionCandidate(source.bridge,{git}).status,'sealed','first root settles before interruption');
  fs.rmSync(path.join(f.owner,'.starciwork/evidence/capture.txt'));const workFile=path.join(f.owner,'.starciwork/evidence/capture.txt');
  const replay=freezeDetectionCandidate(f.bridge,{git,requireReported:true,reportedFiles:['src/app.js',workFile]});assert.equal(replay.status,'sealed',JSON.stringify(replay.reasons));
  fs.writeFileSync(workFile,'recreated after sealed deletion\n');const deletionDrift=freezeDetectionCandidate(f.bridge,{git,requireReported:true,reportedFiles:['src/app.js',workFile]});
  assert.equal(deletionDrift.status,'quarantine');assert.ok(deletionDrift.reasons.some(reason=>reason.includes('canonical-deletion-drift')));
  const wrongRoots=prepareCandidateIntegration(replay.snapshot,replay.packet,{canonicalRoots:{source:f.source,work:f.source},git,mode:'detection-canonical'});
  assert.ok(wrongRoots.reasons.includes('candidate-root-binding-mismatch:work'));
  run(f.source,'add','src/app.js');run(f.source,'commit','--quiet','-m','head drift');
  const stale=prepareCandidateIntegration(replay.snapshot,replay.packet,{canonicalRoots:{source:f.source,work:f.owner},git,mode:'detection-canonical'});
  assert.ok(stale.reasons.some(reason=>reason.startsWith('source:expected-head-mismatch:')));
});

test('backend-owned continuation ignores only its managed section and remains bound to the Work root',t=>{
  const f=fixture(t,{managed:true}),brief=path.join(f.owner,'.starciwork/workflows/wf.md');
  assert.equal(f.bridge.rootBindings.find(root=>root.id==='work').runtimeManagedFiles[0].path,'.starciwork/workflows/wf.md');
  fs.writeFileSync(brief,'Human note\n<!-- starci:continuation:start -->\nnew\n<!-- starci:continuation:end -->\n');fs.writeFileSync(path.join(f.source,'src/app.js'),'new source\n');
  assert.equal(freezeDetectionCandidate(f.bridge,{git,requireReported:true,reportedFiles:['src/app.js']}).status,'sealed');
  const other=fixture(t,{managed:true}),otherBrief=path.join(other.owner,'.starciwork/workflows/wf.md');
  fs.writeFileSync(otherBrief,'Changed human note\n<!-- starci:continuation:start -->\nnew\n<!-- starci:continuation:end -->\n');
  const refused=freezeDetectionCandidate(other.bridge,{git,requireReported:true,reportedFiles:[]});assert.equal(refused.status,'quarantine');
  assert.ok(refused.reasons.some(reason=>reason.includes('pre-existing-user-work-modified:.starciwork/workflows/wf.md')||reason.includes('outside-allowlist:.starciwork/workflows/wf.md')));
});

test('a non-Git runtime canon is content-bound, read-only and quarantines drift',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-runtime-root-')),source=repo(path.join(temp,'source'),{'src/app.js':'base\n'}),runtime=path.join(temp,'sealed-runtime'),canon='.dist/knowledge/grammars/index.json';
  fs.mkdirSync(path.dirname(path.join(runtime,canon)),{recursive:true});fs.writeFileSync(path.join(runtime,canon),'{"schema":"grammar/index@1"}\n');t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const sourceRoot={id:'source',role:'source',repoRoot:source,primary:true,allowlist:['src/**'],references:[],inputPaths:[],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:true,runtimeWritable:false,readOnly:false},
    runtimeRoot={id:'runtime',role:'runtime-input',repoRoot:runtime,primary:false,nonGit:true,allowlist:[],references:[{kind:'file',ref:canon,sourceRef:'old-runtime/knowledge/grammars/index.yaml',rootId:'runtime',path:canon}],inputPaths:[{kind:'file',ref:canon,sourceRef:'old-runtime/knowledge/grammars/index.yaml',rootId:'runtime',path:canon}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:false,runtimeWritable:false,readOnly:true};
  const identity={workflowId:'wf',opId:'draw',attempt:1,generation:1,jobId:'runtime-root'};
  assert.throws(()=>beginDetectionCandidate({identity,workerRoot:path.join(temp,'bad-worker'),controlRoot:path.join(temp,'bad-control'),roots:[sourceRoot,{...runtimeRoot,allowlist:[canon],workerWritable:true}],git,environmentDigest:'env'}),/read-only candidate root runtime/);
  const roots=[sourceRoot,runtimeRoot],bridge=beginDetectionCandidate({identity,workerRoot:path.join(temp,'worker'),controlRoot:path.join(temp,'control'),roots,bindingDigest:candidateRootBindingDigest(roots),git,environmentDigest:'env'});
  assert.equal(bridge.roots.find(root=>root.id==='runtime').bridge.acceptedHead.startsWith('content:'),true);
  fs.writeFileSync(path.join(runtime,canon),'{"schema":"tampered"}\n');const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:[]});
  assert.equal(frozen.status,'quarantine');assert.ok(frozen.reasons.includes(`runtime:outside-allowlist:${canon}`));assert.ok(frozen.reasons.includes('runtime:canonical-head-drift'));
});
