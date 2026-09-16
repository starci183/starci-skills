import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {beginDetectionCandidate,freezeDetectionCandidate,readCandidateBridge,readCandidatePacket} from '../kernel/candidate-bridge.mjs';
import {prepareCandidateIntegration} from '../kernel/candidates.mjs';
import {candidateRootBindingDigest,candidateRootBindings,resolveCandidateReferences} from '../kernel/candidate-roots.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {retireFinishedWorkflowRows} from '../kernel/kernel.mjs';
import {sealRuntime,verifyRuntimePin} from '../kernel/runtime-pin.mjs';
import {createStore,WORKFLOW_STATE} from '../kernel/store.mjs';

const git=(command,args,options)=>spawnSync(command,args,options);
const run=(cwd,...args)=>{const result=git('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
function repo(root,files){fs.mkdirSync(root,{recursive:true});for(const [name,bytes] of Object.entries(files)){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
  run(root,'init','--quiet','-b','main');run(root,'config','user.email','roots@starci.test');run(root,'config','user.name','Roots');run(root,'config','commit.gpgsign','false');run(root,'add','-A');run(root,'commit','--quiet','-m','base');return root;}
const write=(root,name,bytes)=>{const file=path.join(root,...name.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);return file;};
function fixture(t,{managed=false,local=false,foreignRuntime=false,foreignPin=false}={}){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-roots-')),source=repo(path.join(temp,'frontend'),{'src/app.js':'old source\n','source-rule.md':'source input\n','.gitignore':'/.starciwork/_local/\n'}),
    owner=repo(path.join(temp,'backend'),{'.starciwork/rule.md':'work input\n','.starciwork/evidence/capture.txt':'old evidence\n',
      '.starciwork/.gitignore':'_local/\n',
      ...(managed?{'.starciwork/workflows/wf.md':'Human note\n<!-- starci:continuation:start -->\nold\n<!-- starci:continuation:end -->\n'}:{})});
  if(local)for(const root of [source,owner]){
    write(root,'.starciwork/_local/workflows/wf/state.json','own state before launch\n');
    write(root,'.starciwork/_local/workflows/wf/events.jsonl','own events before launch\n');
    write(root,'.starciwork/_local/workflows/other/state.json','other workflow state\n');
    write(root,'.starciwork/_local/inputs/unrelated.txt','unrelated local input\n');
  }
  let foreign=null;
  if(foreignRuntime){
    const worktree=path.join(temp,'backend-branch');run(owner,'worktree','add','--quiet','-b','foreign-runtime',worktree);const journalFile=path.join(temp,'runtime','foreign-journal.sqlite'),
      store=createStore({repoRoot:owner,id:'other-workflow'}),journal=openJournal({file:journalFile}),state={schema:WORKFLOW_STATE,id:'other-workflow',approved:true,finished:false,
        worktree,ledgerRoot:path.join(worktree,'.starciwork'),goalDigest:'a'.repeat(64),ops:[{id:'foreign-op',dispatch:'ctx-foreign',launch:{dispatch:'ctx-foreign'},reports:[]}],
        engine:{schema:'starci/engine@1',generation:4,journalFile,...(foreignPin?{runtimePin:sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'foreign-builds'),version:'1.0.0'})}:{})}};
    store.bindJournal(journal,4,{state});store.saveState(state);store.appendEvent({event:'foreign-kernel-ready'});
    fs.writeFileSync(path.join(store.dir,'kernel.lock'),JSON.stringify({pid:process.pid,startedAt:1700000000000,startupToken:'foreign-runtime-token'}));
    foreign={worktree,store,journal,state};
  }
  const roots=[{id:'source',role:'source',repoRoot:source,primary:true,allowlist:['src/**'],references:[{kind:'file',ref:'source-rule.md',sourceRef:'source-rule.md',rootId:'source',rootRole:'source',path:'source-rule.md'}],
    inputPaths:[{kind:'file',ref:'source-rule.md',sourceRef:'source-rule.md',rootId:'source',rootRole:'source',path:'source-rule.md'}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:true,runtimeWritable:false,readOnly:false},
  {id:'work',role:'work',repoRoot:owner,workRoot:path.join(owner,'.starciwork'),primary:false,allowlist:['.starciwork/evidence/**'],references:[{kind:'sds',ref:'.starciwork/rule.md',sourceRef:'demo.rule',rootId:'work',rootRole:'work',path:'.starciwork/rule.md'}],
    inputPaths:[{kind:'sds',ref:'.starciwork/rule.md',sourceRef:'demo.rule',rootId:'work',rootRole:'work',path:'.starciwork/rule.md'}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:managed?['.starciwork/workflows/wf.md']:[],
    runtimeManagedFiles:managed?[{path:'.starciwork/workflows/wf.md',start:'<!-- starci:continuation:start -->',end:'<!-- starci:continuation:end -->'}]:[],workerWritable:true,runtimeWritable:managed,readOnly:false}];
  const control=path.join(temp,'control'),worker=path.join(temp,'worker'),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'frontend',attempt:1,generation:2,jobId:'job-roots'},
    workerRoot:worker,controlRoot:control,roots,bindingDigest:candidateRootBindingDigest(roots),git,environmentDigest:'env'});
  t.after(()=>{foreign?.journal.close();fs.rmSync(temp,{recursive:true,force:true});});return {temp,source,owner,roots,bridge,control,foreign};
}

test('two real repositories accept both routed Work report spellings while unchanged extras stay diagnostic',t=>{
  for(const spelling of ['absolute','work-relative']){
    const f=fixture(t),workFile=path.join(f.owner,'.starciwork/evidence/capture.txt');
    fs.writeFileSync(path.join(f.source,'src/app.js'),'new source\n');fs.writeFileSync(workFile,'new evidence\n');
    const touched=path.join(f.source,'src/touched-and-reverted.js');fs.writeFileSync(touched,'temporary\n');fs.rmSync(touched);
    const workReport=spelling==='absolute'?workFile:'.starciwork/evidence/capture.txt';
    const frozen=freezeDetectionCandidate(f.bridge,{git,requireReported:true,reportedFiles:['src/app.js',workReport,'src/touched-and-reverted.js']});
    assert.equal(frozen.status,'sealed',`${spelling}: ${JSON.stringify(frozen.reasons)}`);assert.equal(frozen.packet.roots.length,2);
    assert.deepEqual(frozen.packet.changes.map(item=>item.rootId).sort(),['source','work']);
    assert.ok(frozen.reportDiagnostics.unmatched.includes('src/touched-and-reverted.js'));
    assert.equal(readCandidateBridge(f.control).bindingDigest,f.bridge.bindingDigest);assert.equal(readCandidatePacket(f.control).roots.length,2);
    const prepared=prepareCandidateIntegration(frozen.snapshot,frozen.packet,{canonicalRoots:{source:f.source,work:f.owner},git,mode:'detection-canonical'});
    assert.equal(prepared.status,'ready',JSON.stringify(prepared.reasons));assert.deepEqual(prepared.roots.map(root=>root.id),['source','work']);
  }
});

test('aggregate sealing rejects unreported per-root changes and protected-input drift',t=>{
  const missing=fixture(t);fs.writeFileSync(path.join(missing.source,'src/app.js'),'new source\n');fs.writeFileSync(path.join(missing.owner,'.starciwork/evidence/capture.txt'),'new evidence\n');
  const unreported=freezeDetectionCandidate(missing.bridge,{git,requireReported:true,reportedFiles:['src/app.js','../capture.txt']});assert.equal(unreported.status,'quarantine');
  assert.ok(unreported.reasons.some(reason=>reason.includes('unreported-changed-file:')&&reason.includes('capture.txt')));
  const drift=fixture(t);fs.writeFileSync(path.join(drift.owner,'.starciwork/rule.md'),'tampered protected input\n');
  const refused=freezeDetectionCandidate(drift.bridge,{git,requireReported:true,reportedFiles:[path.join(drift.owner,'.starciwork/rule.md')]});assert.equal(refused.status,'quarantine');
  assert.ok(refused.reasons.some(reason=>reason==='work:outside-allowlist:.starciwork/rule.md'));
});

test('exact current-workflow housekeeping is exempt without entering the candidate payload',t=>{
  const accepted=fixture(t,{local:true}),workFile=path.join(accepted.owner,'.starciwork/evidence/capture.txt'),dispatch='ctx-owned';
  fs.writeFileSync(path.join(accepted.source,'src/app.js'),'new source\n');fs.writeFileSync(workFile,'new evidence\n');
  write(accepted.owner,'.starciwork/_local/workflows/wf/state.json','kernel state after launch\n');
  write(accepted.owner,'.starciwork/_local/workflows/wf/events.jsonl','kernel events after launch\n');
  write(accepted.owner,`.starciwork/_local/workflows/wf/reports/${dispatch}.json`,'{"schema":"starci/op-report@1"}\n');
  write(accepted.owner,'.starciwork/_local/workflows/wf/checks/frontend.json','[]\n');
  const sealed=freezeDetectionCandidate(accepted.bridge,{git,requireReported:true,reportedFiles:['src/app.js','.starciwork/evidence/capture.txt'],
    housekeeping:{workflowId:'wf',opId:'frontend',dispatch}});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  const owner=accepted.owner.replaceAll('\\','/');assert.deepEqual(sealed.housekeepingObserved.sort(),[
    `${owner}/.starciwork/_local/workflows/wf/checks/frontend.json`,
    `${owner}/.starciwork/_local/workflows/wf/events.jsonl`,
    `${owner}/.starciwork/_local/workflows/wf/reports/${dispatch}.json`,
    `${owner}/.starciwork/_local/workflows/wf/state.json`
  ].sort());
});

test('a journal-backed live kernel may update another workflow in the shared Work store, but an unacknowledged projection cannot',t=>{
  const accepted=fixture(t,{foreignRuntime:true}),next={...accepted.foreign.state,phase:'done',iteration:2,finished:{outcome:'done'}};
  accepted.foreign.store.saveState(next);accepted.foreign.store.appendEvent({event:'foreign-kernel-progress',iteration:2});
  fs.writeFileSync(accepted.foreign.store.contractPath('foreign-op'),'foreign contract\n');accepted.foreign.store.acknowledgeRuntimeFile(accepted.foreign.store.contractPath('foreign-op'),'contracts/foreign-op.md','replace');
  fs.writeFileSync(accepted.foreign.store.checksPath('foreign-op'),'{}\n');accepted.foreign.store.acknowledgeRuntimeFile(accepted.foreign.store.checksPath('foreign-op'),'checks/foreign-op.json','replace');
  fs.writeFileSync(accepted.foreign.store.checksPath('foreign-op-kernel'),'{}\n');accepted.foreign.store.acknowledgeRuntimeFile(accepted.foreign.store.checksPath('foreign-op-kernel'),'checks/foreign-op-kernel.json','replace');
  fs.writeFileSync(accepted.foreign.store.reportPath('ctx-foreign'),'{}\n');accepted.foreign.store.acknowledgeRuntimeFile(accepted.foreign.store.reportPath('ctx-foreign'),'reports/ctx-foreign.json','replace');
  const finishedLock=path.join(accepted.foreign.store.dir,'kernel.lock');fs.rmSync(finishedLock);accepted.foreign.store.acknowledgeRuntimeFile(finishedLock,'kernel.lock','delete');
  const retired=retireFinishedWorkflowRows(accepted.foreign.store,next);assert.equal(retired.ok,true);assert.equal(retired.retained.snapshots,1);assert.ok(retired.retained.runtimeFileReceipts>=7);
  const sealed=freezeDetectionCandidate(accepted.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  assert.deepEqual(sealed.runtimeAcknowledgements.map(item=>[item.rootId,item.workflowId,item.paths.map(path=>path.path).sort()]),[[
    'work','other-workflow',['.starciwork/_local/workflows/other-workflow/checks/foreign-op-kernel.json','.starciwork/_local/workflows/other-workflow/checks/foreign-op.json',
      '.starciwork/_local/workflows/other-workflow/contracts/foreign-op.md','.starciwork/_local/workflows/other-workflow/events.jsonl',
      '.starciwork/_local/workflows/other-workflow/kernel.lock','.starciwork/_local/workflows/other-workflow/reports/ctx-foreign.json',
      '.starciwork/_local/workflows/other-workflow/state.json'].sort()]]);
  assert.ok(sealed.packet.runtimeHousekeepingWriters.some(item=>item.rootId==='work'&&item.workflowId==='other-workflow'&&item.generation===4));

  const tampered=fixture(t,{foreignRuntime:true}),stateFile=tampered.foreign.store.paths.state,forged={...tampered.foreign.state,phase:'worker-forged'};
  fs.writeFileSync(stateFile,`${JSON.stringify(forged,null,2)}\n`);
  const refused=freezeDetectionCandidate(tampered.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(refused.status,'quarantine');
  assert.ok(refused.reasons.includes('work:outside-allowlist:.starciwork/_local/workflows/other-workflow/state.json'),JSON.stringify(refused.reasons));

  const forgedEvent=fixture(t,{foreignRuntime:true}),eventsFile=forgedEvent.foreign.store.paths.events;
  fs.appendFileSync(eventsFile,`${JSON.stringify({at:Date.now(),seq:2,event:'forged-valid-tail'})}\n`);
  const eventRefused=freezeDetectionCandidate(forgedEvent.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(eventRefused.status,'quarantine');
  assert.ok(eventRefused.reasons.includes('work:outside-allowlist:.starciwork/_local/workflows/other-workflow/events.jsonl'),JSON.stringify(eventRefused.reasons));

  const rolledBack=fixture(t,{foreignRuntime:true}),rollbackEvents=rolledBack.foreign.store.paths.events;
  rolledBack.foreign.store.appendEvent({event:'legitimate-first'});const staleBytes=fs.readFileSync(rollbackEvents);
  rolledBack.foreign.store.appendEvent({event:'legitimate-latest'});fs.writeFileSync(rollbackEvents,staleBytes);
  const rollbackRefused=freezeDetectionCandidate(rolledBack.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(rollbackRefused.status,'quarantine');
  assert.ok(rollbackRefused.reasons.includes('work:outside-allowlist:.starciwork/_local/workflows/other-workflow/events.jsonl'),JSON.stringify(rollbackRefused.reasons));

  const forgedArtifacts=fixture(t,{foreignRuntime:true});fs.writeFileSync(forgedArtifacts.foreign.store.checksPath('foreign-op'),'forged checks\n');
  fs.writeFileSync(forgedArtifacts.foreign.store.reportPath('ctx-foreign'),'forged report\n');
  const forgedArtifactsRefused=freezeDetectionCandidate(forgedArtifacts.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(forgedArtifactsRefused.status,'quarantine');
  assert.ok(forgedArtifactsRefused.reasons.includes('work:outside-allowlist:.starciwork/_local/workflows/other-workflow/checks/foreign-op.json'));
  assert.ok(forgedArtifactsRefused.reasons.includes('work:outside-allowlist:.starciwork/_local/workflows/other-workflow/reports/ctx-foreign.json'));

  const changedAfterReceipt=fixture(t,{foreignRuntime:true});fs.writeFileSync(changedAfterReceipt.foreign.store.reportPath('ctx-foreign'),'trusted report\n');
  changedAfterReceipt.foreign.store.acknowledgeRuntimeFile(changedAfterReceipt.foreign.store.reportPath('ctx-foreign'),'reports/ctx-foreign.json','replace');
  fs.writeFileSync(changedAfterReceipt.foreign.store.reportPath('ctx-foreign'),'tampered after receipt\n');
  const changedAfterReceiptRefused=freezeDetectionCandidate(changedAfterReceipt.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(changedAfterReceiptRefused.status,'quarantine');
  assert.ok(changedAfterReceiptRefused.reasons.includes('work:outside-allowlist:.starciwork/_local/workflows/other-workflow/reports/ctx-foreign.json'));
});

test('a verified foreign runtime may advance generation while exact new-generation bytes and native artifacts remain attributable',t=>{
  const f=fixture(t,{foreignRuntime:true,foreignPin:true}),nextJournal=path.join(f.temp,'runtime','foreign-journal-g5.sqlite'),next={...f.foreign.state,phase:'retried',
    engine:{...f.foreign.state.engine,generation:5,journalFile:nextJournal}};
  const journal=openJournal({file:nextJournal});
  try{
    f.foreign.store.unbindJournal(f.foreign.journal).bindJournal(journal,5,{state:next});
    f.foreign.store.saveState(next);f.foreign.store.appendEvent({event:'workflow-retried',generation:5});
    fs.writeFileSync(f.foreign.store.reportPath('ctx-foreign'),'new generation report\n');f.foreign.store.acknowledgeRuntimeFile(f.foreign.store.reportPath('ctx-foreign'),'reports/ctx-foreign.json','replace');
    const lock=path.join(f.foreign.store.dir,'kernel.lock');fs.rmSync(lock);f.foreign.store.acknowledgeRuntimeFile(lock,'kernel.lock','delete');
    const sealed=freezeDetectionCandidate(f.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
    assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
    const acknowledged=sealed.runtimeAcknowledgements.find(item=>item.workflowId==='other-workflow');
    assert.equal(acknowledged.previousGeneration,4);assert.equal(acknowledged.generation,5);assert.equal(acknowledged.previousJournalFile,f.foreign.state.engine.journalFile.replaceAll('\\','/'));
    assert.ok(acknowledged.paths.some(item=>item.path.endsWith('/state.json')&&item.journalSeq>0));
    assert.ok(acknowledged.paths.some(item=>item.path.endsWith('/reports/ctx-foreign.json')&&item.journalSeq>0));
  }finally{f.foreign.store.unbindJournal(journal);journal.close();}
});

test('ignored unrelated local mutations and deletion are caught on source and Work roots',t=>{
  const refused=fixture(t,{local:true});
  write(refused.source,'.starciwork/_local/workflows/other/state.json','worker changed another workflow\n');
  fs.rmSync(path.join(refused.source,'.starciwork/_local/inputs/unrelated.txt'));
  write(refused.owner,'.starciwork/_local/evidence-staging/new/unrelated.txt','worker created unrelated local evidence\n');
  const contaminated=freezeDetectionCandidate(refused.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(contaminated.status,'quarantine');
  assert.ok(contaminated.reasons.includes('source:outside-allowlist:.starciwork/_local/workflows/other/state.json'),JSON.stringify(contaminated.reasons));
  assert.ok(contaminated.reasons.includes('source:outside-allowlist:.starciwork/_local/inputs/unrelated.txt'),JSON.stringify(contaminated.reasons));
  assert.ok(contaminated.reasons.includes('work:outside-allowlist:.starciwork/_local/evidence-staging/new/unrelated.txt'),JSON.stringify(contaminated.reasons));
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

test('the complete sealed runtime identity rejects unreferenced modification, addition and post-freeze drift',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-full-runtime-root-')),source=repo(path.join(temp,'source'),{'src/app.js':'base\n'}),
    sealed=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'builds'),version:'1.0.0'});
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const create=(name,mutateAfterFreeze=false)=>{
    const root=path.join(temp,name);fs.cpSync(sealed.root,root,{recursive:true});const pin={...sealed,root,sourceRoot:process.cwd()},state={worktree:source,host:process.cwd(),engine:{runtimePin:pin}},
      work={ledger:{repoRoot:source,workRoot:path.join(source,'.starciwork')},loaded:{nodes:new Map(),list:[]}},op={allowlist:['src/**'],references:[path.join(root,'.dist','knowledge','grammars','INDEX.json')]},
      resolved=resolveCandidateReferences(op,state,{work}),bound=candidateRootBindings({state,op,work,resolvedReferences:resolved}),controlRoot=path.join(temp,`${name}-control`);
    assert.equal(verifyRuntimePin(pin).ok,true);const bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:name,attempt:1,generation:1,jobId:`job-${name}`},
      workerRoot:path.join(temp,`${name}-worker`),controlRoot,roots:bound.bindings,bindingDigest:bound.bindingDigest,git,environmentDigest:pin.digest});
    if(mutateAfterFreeze){const frozen=freezeDetectionCandidate(bridge,{git,requireReported:true,reportedFiles:[]});assert.equal(frozen.status,'sealed');return {bridge,frozen,pin,root};}
    return {bridge,pin,root};
  };
  const modified=create('modified');fs.appendFileSync(path.join(modified.root,'.dist','kernel','common.mjs'),'// drift\n');
  assert.equal(verifyRuntimePin(modified.pin).ok,false);const modifiedFreeze=freezeDetectionCandidate(modified.bridge,{git,requireReported:true,reportedFiles:[]});
  assert.equal(modifiedFreeze.status,'quarantine');assert.ok(modifiedFreeze.reasons.some(reason=>reason.includes('runtime:runtime-pin-drift:Runtime pin changed: .dist/kernel/common.mjs')));
  const added=create('added');fs.writeFileSync(path.join(added.root,'.dist','kernel','undeclared-probe.mjs'),'export default true;\n');
  assert.equal(verifyRuntimePin(added.pin).ok,false);const addedFreeze=freezeDetectionCandidate(added.bridge,{git,requireReported:true,reportedFiles:[]});
  assert.equal(addedFreeze.status,'quarantine');assert.ok(addedFreeze.reasons.some(reason=>reason.includes('runtime:runtime-pin-drift:Runtime pin contains unsealed files')));
  const after=create('after-freeze',true);fs.appendFileSync(path.join(after.root,'.dist','kernel','common.mjs'),'// later drift\n');
  const prepared=prepareCandidateIntegration(after.frozen.snapshot,after.frozen.packet,{canonicalRoots:{source, runtime:after.root},git,mode:'detection-canonical'});
  assert.equal(prepared.status,'quarantine');assert.ok(prepared.reasons.some(reason=>reason.includes('runtime:runtime-pin-drift:Runtime pin changed: .dist/kernel/common.mjs')),
    JSON.stringify({reasons:prepared.reasons,snapshot:after.frozen.snapshot.roots.find(root=>root.id==='runtime')?.runtimePin,packet:after.frozen.packet.roots.find(root=>root.id==='runtime')?.runtimePin}));
});
