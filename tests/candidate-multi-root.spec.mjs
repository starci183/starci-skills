import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {beginDetectionCandidate,freezeDetectionCandidate,readCandidateBridge,readCandidatePacket} from '../kernel/candidate-bridge.mjs';
import {prepareCandidateIntegration} from '../kernel/candidates.mjs';
import {candidateRootBindingDigest,candidateRootBindings,resolveCandidateReferences} from '../kernel/candidate-roots.mjs';
import {ledgerFileFor,openLedger} from '../kernel/ledger-db.mjs';
import {readmitCandidateRootBindingRetry,retryableOperation} from '../kernel/kernel.mjs';
import {sealRuntime,verifyRuntimePin} from '../kernel/runtime-pin.mjs';
import {RUNTIME_FILE_WRITE,WORKFLOW_STATE} from '../kernel/store.mjs';

/**
 * A co-resident foreign kernel now shares this repo's one ledger file (`ledgerFileFor(owner)`) instead of a
 * per-workflow journal. It still writes its legacy `_local/workflows/<id>` artifact bytes to disk (candidate
 * custody receipts diff real file bytes), but the state snapshot, events and kernel-lock signal that
 * `runtimeWriters`/`acknowledgedForeignRuntime` read now live in that shared ledger.
 */
function foreignLedgerWorkflow({owner,worktree,workflowId='other-workflow',generation=4,pin=null}){
  const ledgerFile=ledgerFileFor(owner),ledger=openLedger({file:ledgerFile}),dir=path.join(owner,'.starciwork','_local','workflows',workflowId);
  let state={schema:WORKFLOW_STATE,id:workflowId,approved:true,finished:false,worktree,goalDigest:'a'.repeat(64),
    ops:[{id:'foreign-op',dispatch:'ctx-foreign',launch:{dispatch:'ctx-foreign'},reports:[]}],
    engine:{schema:'starci/engine@1',generation,ledgerFile,...(pin?{runtimePin:pin}:{})}};
  ledger.ensureWorkflow({workflowId});
  const write=(relative,bytes)=>{
    const file=path.join(dir,...relative.split('/'));fs.mkdirSync(path.dirname(file),{recursive:true});
    if(bytes===null)fs.rmSync(file,{force:true});else fs.writeFileSync(file,bytes);
    const read=bytes===null?null:fs.readFileSync(file),fileStateValue=read!==null?'file':'absent',
      sha256=read!==null?crypto.createHash('sha256').update(read).digest('hex'):null,size=read?.length??0;
    ledger.appendEvent({workflowId,entityType:'runtime-file',entityId:relative,generation:state.engine.generation,kind:'runtime-file-written',
      payload:{schema:RUNTIME_FILE_WRITE,file,relative,mode:bytes===null?'delete':'replace',state:fileStateValue,sha256,size}});
    return file;
  };
  const saveSnapshot=(prefix='save')=>{
    const checkpointId=`${prefix}:${workflowId}:${state.engine.generation}:${crypto.randomBytes(4).toString('hex')}`;
    ledger.db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,events_head,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(checkpointId,workflowId,state.engine.generation,state.goalDigest,JSON.stringify(state),ledger.eventsHead(workflowId),Date.now());
  };
  const setLock=({holderPid=process.pid,token='foreign-runtime-token',at=1700000000000,expiresAt=null}={})=>
    ledger.db.prepare(`INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?)
      ON CONFLICT(scope,key) DO UPDATE SET holder_pid=excluded.holder_pid,token=excluded.token,at=excluded.at,expires_at=excluded.expires_at`)
      .run(workflowId,'kernel-lock',holderPid,token,null,at,expiresAt);
  const clearLock=()=>ledger.db.prepare('DELETE FROM signals WHERE scope=? AND key=?').run(workflowId,'kernel-lock');
  write('state.json',`${JSON.stringify(state,null,2)}\n`);
  ledger.appendEvent({workflowId,entityType:'workflow',entityId:workflowId,generation,kind:'foreign-kernel-ready'});
  write('events.jsonl','own events\n');
  write('kernel.lock',JSON.stringify({pid:process.pid,startedAt:1700000000000,startupToken:'foreign-runtime-token'}));
  saveSnapshot('bind');setLock();
  return {dir,ledger,ledgerFile,write,saveSnapshot,setLock,clearLock,
    get state(){return state;},
    setState(next){state=next;write('state.json',`${JSON.stringify(state,null,2)}\n`);saveSnapshot('save');},
    advanceGeneration(generation,nextLedgerFile=ledgerFile){state={...state,engine:{...state.engine,generation,ledgerFile:nextLedgerFile}};}};
}

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
    const worktree=path.join(temp,'backend-branch');run(owner,'worktree','add','--quiet','-b','foreign-runtime',worktree);
    const pin=foreignPin?sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'foreign-builds'),version:'1.0.0'}):null;
    foreign=foreignLedgerWorkflow({owner,worktree,pin});
  }
  const roots=[{id:'source',role:'source',repoRoot:source,primary:true,allowlist:['src/**'],references:[{kind:'file',ref:'source-rule.md',sourceRef:'source-rule.md',rootId:'source',rootRole:'source',path:'source-rule.md'}],
    inputPaths:[{kind:'file',ref:'source-rule.md',sourceRef:'source-rule.md',rootId:'source',rootRole:'source',path:'source-rule.md'}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:true,runtimeWritable:false,readOnly:false},
  {id:'work',role:'work',repoRoot:owner,workRoot:path.join(owner,'.starciwork'),primary:false,allowlist:['.starciwork/evidence/**'],references:[{kind:'sds',ref:'.starciwork/rule.md',sourceRef:'demo.rule',rootId:'work',rootRole:'work',path:'.starciwork/rule.md'}],
    inputPaths:[{kind:'sds',ref:'.starciwork/rule.md',sourceRef:'demo.rule',rootId:'work',rootRole:'work',path:'.starciwork/rule.md'}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:managed?['.starciwork/workflows/wf.md']:[],
    runtimeManagedFiles:managed?[{path:'.starciwork/workflows/wf.md',start:'<!-- starci:continuation:start -->',end:'<!-- starci:continuation:end -->'}]:[],workerWritable:true,runtimeWritable:managed,readOnly:false}];
  const control=path.join(temp,'control'),worker=path.join(temp,'worker'),bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'frontend',attempt:1,generation:2,jobId:'job-roots'},
    workerRoot:worker,controlRoot:control,roots,bindingDigest:candidateRootBindingDigest(roots),git,environmentDigest:'env'});
  t.after(()=>{foreign?.ledger.close();fs.rmSync(temp,{recursive:true,force:true});});return {temp,source,owner,roots,bridge,control,foreign};
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
  assert.ok(refused.reasons.some(reason=>reason==='work:custody-path-touched:.starciwork/rule.md'));
});

test('the kernel\'s .starciwork footprint is the ledger record alone; it is invisible without any housekeeping identity',t=>{
  const accepted=fixture(t,{local:true}),workFile=path.join(accepted.owner,'.starciwork/evidence/capture.txt');
  fs.writeFileSync(path.join(accepted.source,'src/app.js'),'new source\n');fs.writeFileSync(workFile,'new evidence\n');
  fs.mkdirSync(path.join(accepted.owner,'.starciwork'),{recursive:true});
  fs.writeFileSync(path.join(accepted.owner,'.starciwork','runtime.sqlite'),'live ledger bytes');
  fs.writeFileSync(path.join(accepted.owner,'.starciwork','runtime.sqlite-wal'),'wal bytes');
  fs.writeFileSync(path.join(accepted.owner,'.starciwork','runtime.sqlite-shm'),'shm bytes');
  const sealed=freezeDetectionCandidate(accepted.bridge,{git,requireReported:true,reportedFiles:['src/app.js','.starciwork/evidence/capture.txt']});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  assert.deepEqual(sealed.housekeepingObserved,[]);
});

test('exact current-workflow housekeeping is exempt without entering the candidate payload',t=>{
  // store.mjs has not migrated off `_local` yet - its own dispatch's projection stays exempt by trusted
  // identity, named exactly, while every other `.starciwork` path is still custody evidence.
  const accepted=fixture(t,{local:true}),workFile=path.join(accepted.owner,'.starciwork/evidence/capture.txt'),dispatch='ctx-owned';
  fs.writeFileSync(path.join(accepted.source,'src/app.js'),'new source\n');fs.writeFileSync(workFile,'new evidence\n');
  write(accepted.owner,'.starciwork/_local/workflows/wf/state.json','kernel state after launch\n');
  write(accepted.owner,'.starciwork/_local/workflows/wf/events.jsonl','kernel events after launch\n');
  write(accepted.owner,`.starciwork/_local/workflows/wf/reports/${dispatch}.json`,'{"schema":"starci/op-report@1"}\n');
  write(accepted.owner,'.starciwork/_local/workflows/wf/checks/frontend.json','[]\n');
  write(accepted.owner,'.starciwork/_local/workflows/supervisor.log','{"event":"kernel-started"}\n');
  const sealed=freezeDetectionCandidate(accepted.bridge,{git,requireReported:true,reportedFiles:['src/app.js','.starciwork/evidence/capture.txt'],
    housekeeping:{workflowId:'wf',opId:'frontend',dispatch}});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  const owner=accepted.owner.replaceAll('\\','/');assert.deepEqual(sealed.housekeepingObserved.sort(),[
    `${owner}/.starciwork/_local/workflows/wf/checks/frontend.json`,
    `${owner}/.starciwork/_local/workflows/wf/events.jsonl`,
    `${owner}/.starciwork/_local/workflows/wf/reports/${dispatch}.json`,
    `${owner}/.starciwork/_local/workflows/wf/state.json`,
    `${owner}/.starciwork/_local/workflows/supervisor.log`
  ].sort());
});

test('a stray write elsewhere under .starciwork stays fenced even with a housekeeping identity supplied',t=>{
  const refused=fixture(t);fs.writeFileSync(path.join(refused.source,'src/app.js'),'new source\n');
  write(refused.owner,'.starciwork/_local/workflows/audit.log','arbitrary\n');
  const quarantined=freezeDetectionCandidate(refused.bridge,{git,requireReported:true,reportedFiles:['src/app.js'],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(quarantined.status,'quarantine');
  assert.ok(quarantined.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/audit.log'),JSON.stringify(quarantined.reasons));
});

test('a ledger-backed live kernel may update another workflow in the shared Work store, but an unacknowledged projection cannot',t=>{
  const accepted=fixture(t,{foreignRuntime:true}),foreign=accepted.foreign;
  foreign.setState({...foreign.state,phase:'done',iteration:2,finished:{outcome:'done'}});
  foreign.write('events.jsonl','own events\nforeign-kernel-progress\n');
  foreign.write('contracts/foreign-op.md','foreign contract\n');
  foreign.write('checks/foreign-op.json','{}\n');
  foreign.write('checks/foreign-op-kernel.json','{}\n');
  foreign.write('reports/ctx-foreign.json','{}\n');
  foreign.write('kernel.lock',null);foreign.clearLock();
  const sealed=freezeDetectionCandidate(accepted.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  assert.deepEqual(sealed.runtimeAcknowledgements.map(item=>[item.rootId,item.workflowId,item.paths.map(path=>path.path).sort()]),[[
    'work','other-workflow',['.starciwork/_local/workflows/other-workflow/checks/foreign-op-kernel.json','.starciwork/_local/workflows/other-workflow/checks/foreign-op.json',
      '.starciwork/_local/workflows/other-workflow/contracts/foreign-op.md','.starciwork/_local/workflows/other-workflow/events.jsonl',
      '.starciwork/_local/workflows/other-workflow/kernel.lock','.starciwork/_local/workflows/other-workflow/reports/ctx-foreign.json',
      '.starciwork/_local/workflows/other-workflow/state.json'].sort()]]);
  assert.ok(sealed.packet.runtimeHousekeepingWriters.some(item=>item.rootId==='work'&&item.workflowId==='other-workflow'&&item.generation===4));

  const tampered=fixture(t,{foreignRuntime:true});
  fs.writeFileSync(path.join(tampered.foreign.dir,'state.json'),`${JSON.stringify({...tampered.foreign.state,phase:'worker-forged'},null,2)}\n`);
  const refused=freezeDetectionCandidate(tampered.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(refused.status,'quarantine');
  assert.ok(refused.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/other-workflow/state.json'),JSON.stringify(refused.reasons));

  const forgedEvent=fixture(t,{foreignRuntime:true});
  fs.appendFileSync(path.join(forgedEvent.foreign.dir,'events.jsonl'),`${JSON.stringify({at:Date.now(),seq:2,event:'forged-valid-tail'})}\n`);
  const eventRefused=freezeDetectionCandidate(forgedEvent.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(eventRefused.status,'quarantine');
  assert.ok(eventRefused.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/other-workflow/events.jsonl'),JSON.stringify(eventRefused.reasons));

  const rolledBack=fixture(t,{foreignRuntime:true});
  rolledBack.foreign.write('events.jsonl','legitimate-first\n');
  const staleBytes=fs.readFileSync(path.join(rolledBack.foreign.dir,'events.jsonl'));
  rolledBack.foreign.write('events.jsonl','legitimate-first\nlegitimate-latest\n');
  fs.writeFileSync(path.join(rolledBack.foreign.dir,'events.jsonl'),staleBytes);
  const rollbackRefused=freezeDetectionCandidate(rolledBack.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(rollbackRefused.status,'quarantine');
  assert.ok(rollbackRefused.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/other-workflow/events.jsonl'),JSON.stringify(rollbackRefused.reasons));

  const forgedArtifacts=fixture(t,{foreignRuntime:true});
  fs.mkdirSync(path.join(forgedArtifacts.foreign.dir,'checks'),{recursive:true});fs.writeFileSync(path.join(forgedArtifacts.foreign.dir,'checks','foreign-op.json'),'forged checks\n');
  fs.mkdirSync(path.join(forgedArtifacts.foreign.dir,'reports'),{recursive:true});fs.writeFileSync(path.join(forgedArtifacts.foreign.dir,'reports','ctx-foreign.json'),'forged report\n');
  const forgedArtifactsRefused=freezeDetectionCandidate(forgedArtifacts.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(forgedArtifactsRefused.status,'quarantine');
  assert.ok(forgedArtifactsRefused.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/other-workflow/checks/foreign-op.json'));
  assert.ok(forgedArtifactsRefused.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/other-workflow/reports/ctx-foreign.json'));

  const changedAfterReceipt=fixture(t,{foreignRuntime:true});
  changedAfterReceipt.foreign.write('reports/ctx-foreign.json','trusted report\n');
  fs.writeFileSync(path.join(changedAfterReceipt.foreign.dir,'reports','ctx-foreign.json'),'tampered after receipt\n');
  const changedAfterReceiptRefused=freezeDetectionCandidate(changedAfterReceipt.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(changedAfterReceiptRefused.status,'quarantine');
  assert.ok(changedAfterReceiptRefused.reasons.includes('work:custody-path-touched:.starciwork/_local/workflows/other-workflow/reports/ctx-foreign.json'));
});

test('a verified foreign runtime may advance generation while exact new-generation bytes and native artifacts remain attributable',t=>{
  const f=fixture(t,{foreignRuntime:true,foreignPin:true}),foreign=f.foreign,previousLedgerFile=foreign.ledgerFile.replaceAll('\\','/');
  foreign.advanceGeneration(5);foreign.setState({...foreign.state,phase:'retried'});
  foreign.write('reports/ctx-foreign.json','new generation report\n');
  foreign.write('kernel.lock',null);foreign.clearLock();
  const sealed=freezeDetectionCandidate(f.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(sealed.status,'sealed',JSON.stringify(sealed.reasons));
  const acknowledged=sealed.runtimeAcknowledgements.find(item=>item.workflowId==='other-workflow');
  assert.equal(acknowledged.previousGeneration,4);assert.equal(acknowledged.generation,5);assert.equal(acknowledged.previousLedgerFile,previousLedgerFile);
  assert.ok(acknowledged.paths.some(item=>item.path.endsWith('/state.json')&&item.ledgerSeq>0));
  assert.ok(acknowledged.paths.some(item=>item.path.endsWith('/reports/ctx-foreign.json')&&item.ledgerSeq>0));
});

test('ignored unrelated local mutations and deletion are caught on source and Work roots',t=>{
  const refused=fixture(t,{local:true});
  write(refused.source,'.starciwork/_local/workflows/other/state.json','worker changed another workflow\n');
  fs.rmSync(path.join(refused.source,'.starciwork/_local/inputs/unrelated.txt'));
  write(refused.owner,'.starciwork/_local/evidence-staging/new/unrelated.txt','worker created unrelated local evidence\n');
  const contaminated=freezeDetectionCandidate(refused.bridge,{git,reportedFiles:[],housekeeping:{workflowId:'wf',opId:'frontend',dispatch:'ctx-owned'}});
  assert.equal(contaminated.status,'quarantine');
  assert.ok(contaminated.reasons.includes('source:custody-path-touched:.starciwork/_local/workflows/other/state.json'),JSON.stringify(contaminated.reasons));
  assert.ok(contaminated.reasons.includes('source:custody-path-touched:.starciwork/_local/inputs/unrelated.txt'),JSON.stringify(contaminated.reasons));
  assert.ok(contaminated.reasons.includes('work:custody-path-touched:.starciwork/_local/evidence-staging/new/unrelated.txt'),JSON.stringify(contaminated.reasons));
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
  assert.ok(refused.reasons.some(reason=>reason.includes('pre-existing-user-work-modified:.starciwork/workflows/wf.md')||reason.includes('custody-path-touched:.starciwork/workflows/wf.md')));
});

test('runtime-managed continuation follows the attested workflow store when the source and loaded Work roots are worktrees',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-store-root-')),source=repo(path.join(temp,'frontend-worktree'),{'src/app.js':'base\n'}),
    worktree=repo(path.join(temp,'backend-worktree'),{'.starciwork/rule.md':'rule\n'}),storeRoot=repo(path.join(temp,'backend-store'),{'.gitignore':'/.starciwork/_local/\n'}),
    continuation=write(storeRoot,'workflows/wf.md','Human note\n<!-- starci:continuation:start -->\nold\n<!-- starci:continuation:end -->\n');
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const state={worktree:source},work={ledger:{repoRoot:worktree,workRoot:path.join(worktree,'.starciwork')}},op={allowlist:['src/**']},
    managed=[{path:continuation,start:'<!-- starci:continuation:start -->',end:'<!-- starci:continuation:end -->'}],
    bound=candidateRootBindings({state,work,op,runtimeManagedFiles:managed,runtimeStoreRoot:storeRoot});
  const store=bound.bindings.find(root=>root.id==='store');
  assert.equal(store.role,'workflow-store');assert.equal(store.workerWritable,false);assert.equal(store.runtimeWritable,true);
  assert.deepEqual(store.allowlist,[]);assert.deepEqual(store.runtimeManagedFiles.map(item=>item.path),['workflows/wf.md']);
});

test('attested workflow-store routing does not admit a foreign continuation path',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-store-foreign-')),source=repo(path.join(temp,'source'),{'src/app.js':'base\n'}),
    storeRoot=repo(path.join(temp,'store'),{'.gitignore':'/.starciwork/_local/\n'}),foreign=write(path.join(temp,'foreign'),'workflows/wf.md','foreign\n');
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  assert.throws(()=>candidateRootBindings({state:{worktree:source},work:{ledger:{repoRoot:source,workRoot:path.join(source,'.starciwork')}},
    op:{allowlist:['src/**']},runtimeStoreRoot:storeRoot,runtimeManagedFiles:[{path:foreign,start:'start',end:'end'}]}),/outside the accepted routed roots/);
});

test('workflow-store root is reserved for its exact runtime-managed continuation',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-store-authority-')),source=repo(path.join(temp,'source'),{'src/app.js':'base\n'}),
    storeRoot=repo(path.join(temp,'store'),{'workflows/wf.md':'brief\n'}),state={worktree:source},work={ledger:{repoRoot:source,workRoot:path.join(source,'.starciwork')}},
    continuation=path.join(storeRoot,'workflows','wf.md');t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  assert.throws(()=>candidateRootBindings({state,work,op:{allowlist:[continuation]},runtimeStoreRoot:storeRoot,
    runtimeManagedFiles:[{path:continuation,start:'start',end:'end'}]}),/cannot claim the runtime-managed workflow-store root/);
  assert.throws(()=>candidateRootBindings({state,work,op:{allowlist:['src/**']},runtimeStoreRoot:storeRoot,runtimePaths:[continuation],
    runtimeManagedFiles:[{path:continuation,start:'start',end:'end'}]}),/cannot claim the runtime-managed workflow-store root/);
});

test('workflow-store bridge excludes only the managed continuation section',t=>{
  const make=name=>{const temp=fs.mkdtempSync(path.join(os.tmpdir(),`starci-store-bridge-${name}-`)),source=repo(path.join(temp,'frontend'),{'src/app.js':'base\n'}),
    worktree=repo(path.join(temp,'backend-worktree'),{'.starciwork/rule.md':'rule\n'}),storeRoot=repo(path.join(temp,'backend-store'),
      {'workflows/wf.md':'Human note\n<!-- starci:continuation:start -->\nold\n<!-- starci:continuation:end -->\n'}),continuation=path.join(storeRoot,'workflows','wf.md'),
    bound=candidateRootBindings({state:{worktree:source},work:{ledger:{repoRoot:worktree,workRoot:path.join(worktree,'.starciwork')}},op:{allowlist:['src/**']},
      runtimeStoreRoot:storeRoot,runtimeManagedFiles:[{path:continuation,start:'<!-- starci:continuation:start -->',end:'<!-- starci:continuation:end -->'}]}),
    bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:name,attempt:1,generation:1,jobId:`job-${name}`},workerRoot:path.join(temp,'candidate'),
      controlRoot:path.join(temp,'control'),roots:bound.bindings,bindingDigest:bound.bindingDigest,git,environmentDigest:'env'});return {temp,source,continuation,bridge};};
  const accepted=make('accepted');t.after(()=>fs.rmSync(accepted.temp,{recursive:true,force:true}));
  fs.writeFileSync(accepted.continuation,'Human note\n<!-- starci:continuation:start -->\nnew\n<!-- starci:continuation:end -->\n');
  fs.writeFileSync(path.join(accepted.source,'src/app.js'),'changed\n');
  assert.equal(freezeDetectionCandidate(accepted.bridge,{git,requireReported:true,reportedFiles:['src/app.js']}).status,'sealed');
  const refused=make('refused');t.after(()=>fs.rmSync(refused.temp,{recursive:true,force:true}));
  fs.writeFileSync(refused.continuation,'Changed human note\n<!-- starci:continuation:start -->\nnew\n<!-- starci:continuation:end -->\n');
  const frozen=freezeDetectionCandidate(refused.bridge,{git,requireReported:true,reportedFiles:[]});assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.some(reason=>reason.includes('pre-existing-user-work-modified:workflows/wf.md')||reason.includes('outside-allowlist:workflows/wf.md')),JSON.stringify(frozen.reasons));
});

test('public retry narrowly re-admits a prelaunch candidate-root refusal and its dependency-only blocks',()=>{
  const root={id:'root',status:'blocked',refusal:'candidate-root-binding',dependsOn:[],reports:[],files:[]},
    audit={id:'audit',status:'blocked',dependsOn:['root','dependent'],reports:[],files:[]},
    leaf={id:'leaf',status:'blocked',dependsOn:['audit'],reports:[],files:[]},
    dependent={id:'dependent',status:'blocked',dependsOn:['root'],reports:[],files:[]},
    independentlyBlocked={id:'owner-blocked',status:'blocked',dependsOn:['root'],reports:[],files:[]},
    exact='dependent can never start: it depends on root',auditExact='audit can never start: it depends on root, dependent',owner='owner-blocked can never start: it depends on root',
    state={ops:[root,leaf,audit,dependent,independentlyBlocked],needUser:[{op:'root',kind:'environment',code:'candidate-root-binding',detail:'old route'},
      {op:'audit',kind:'authority',detail:auditExact},{op:'dependent',kind:'authority',detail:exact},{op:'owner-blocked',kind:'authority',detail:owner},{op:'owner-blocked',kind:'decision',detail:'independent owner choice'}]},
    recorded=[],store={readEvents:()=>[{event:'op-blocked',op:'leaf',reason:'dependency blocked'},{event:'op-blocked',op:'audit',reason:'dependency blocked'},{event:'op-blocked',op:'dependent',reason:'dependency blocked'},
      {event:'op-blocked',op:'owner-blocked',reason:'dependency blocked'}],appendEvent:event=>recorded.push(event)};
  assert.equal(retryableOperation(root),true);
  assert.deepEqual(readmitCandidateRootBindingRetry(store,state),{roots:['root'],dependents:['dependent','audit','leaf']});
  assert.equal(dependent.status,'pending');assert.equal(audit.status,'pending');assert.equal(independentlyBlocked.status,'blocked');
  assert.equal(state.needUser.some(item=>item.op==='dependent'),false);assert.equal(state.needUser.some(item=>item.kind==='decision'),true);
  assert.equal(recorded[0].event,'candidate-root-dependent-readmitted');
  for(const unsafe of [{...root,reports:[{outcome:'partial'}]},{...root,files:['src/x']},{...root,head:'abc'},{...root,verdict:'fail'},
    {...root,workerSettled:false},{...root,lease:{jobId:'live'}}])assert.equal(retryableOperation(unsafe),false,JSON.stringify(unsafe));
  const failedAudit={id:'audit-failed',kind:'review.verify',operation:'stales',status:'blocked',refusal:'audit-measurement-failed',workerSettled:true,
    audit:{schema:'starci/audit-measurement@1',operation:'stales',outcome:'failed',failures:['worker produced files']},reports:[{outcome:'partial'}],candidate:{status:'quarantine'}};
  assert.equal(retryableOperation(failedAudit),true,'typed inactive audit failure preserves its history and can rerun');
  assert.equal(retryableOperation({...failedAudit,workerSettled:null}),true,'a historical task with no active attempt fields is inactive');
  for(const unsafe of [{...failedAudit,workerSettled:false},{...failedAudit,lease:{jobId:'live'}},{...failedAudit,pending:{kind:'candidate'}},{...failedAudit,dispatch:'ctx_live'},
    {...failedAudit,terminal:'term_live'},{...failedAudit,audit:{...failedAudit.audit,failures:[]}},{...failedAudit,refusal:'authority'}])
    assert.equal(retryableOperation(unsafe),false,JSON.stringify(unsafe));
  const noReceipt={...dependent,status:'blocked'};assert.deepEqual(readmitCandidateRootBindingRetry({readEvents:()=>[],appendEvent(){}},{ops:[root,noReceipt],needUser:[]}),{roots:['root'],dependents:[]});
});

test('a non-Git runtime canon is content-bound, read-only and quarantines drift',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-runtime-root-')),source=repo(path.join(temp,'source'),{'src/app.js':'base\n'}),runtime=path.join(temp,'sealed-runtime'),canon='knowledge/grammars/index.yaml';
  fs.mkdirSync(path.dirname(path.join(runtime,canon)),{recursive:true});fs.writeFileSync(path.join(runtime,canon),'schema: grammar/index@1\n');t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const sourceRoot={id:'source',role:'source',repoRoot:source,primary:true,allowlist:['src/**'],references:[],inputPaths:[],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:true,runtimeWritable:false,readOnly:false},
    runtimeRoot={id:'runtime',role:'runtime-input',repoRoot:runtime,primary:false,nonGit:true,allowlist:[],references:[{kind:'file',ref:canon,sourceRef:'old-runtime/knowledge/grammars/index.yaml',rootId:'runtime',path:canon}],inputPaths:[{kind:'file',ref:canon,sourceRef:'old-runtime/knowledge/grammars/index.yaml',rootId:'runtime',path:canon}],oraclePaths:[],ownedDirtyPaths:[],runtimePaths:[],runtimeManagedFiles:[],workerWritable:false,runtimeWritable:false,readOnly:true};
  const identity={workflowId:'wf',opId:'draw',attempt:1,generation:1,jobId:'runtime-root'};
  assert.throws(()=>beginDetectionCandidate({identity,workerRoot:path.join(temp,'bad-worker'),controlRoot:path.join(temp,'bad-control'),roots:[sourceRoot,{...runtimeRoot,allowlist:[canon],workerWritable:true}],git,environmentDigest:'env'}),/read-only candidate root runtime/);
  const roots=[sourceRoot,runtimeRoot],bridge=beginDetectionCandidate({identity,workerRoot:path.join(temp,'worker'),controlRoot:path.join(temp,'control'),roots,bindingDigest:candidateRootBindingDigest(roots),git,environmentDigest:'env'});
  assert.equal(bridge.roots.find(root=>root.id==='runtime').bridge.acceptedHead.startsWith('content:'),true);
  fs.writeFileSync(path.join(runtime,canon),'schema: tampered\n');const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:[]});
  assert.equal(frozen.status,'quarantine');assert.ok(frozen.reasons.includes(`runtime:outside-allowlist:${canon}`));assert.ok(frozen.reasons.includes('runtime:canonical-head-drift'));
});

test('the complete sealed runtime identity rejects unreferenced modification, addition and post-freeze drift',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-full-runtime-root-')),source=repo(path.join(temp,'source'),{'src/app.js':'base\n'}),
    sealed=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'builds'),version:'1.0.0'});
  t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  const create=(name,mutateAfterFreeze=false)=>{
    const root=path.join(temp,name);fs.cpSync(sealed.root,root,{recursive:true});const pin={...sealed,root,sourceRoot:process.cwd()},state={worktree:source,host:process.cwd(),engine:{runtimePin:pin}},
      work={ledger:{repoRoot:source,workRoot:path.join(source,'.starciwork')},loaded:{nodes:new Map(),list:[]}},op={allowlist:['src/**'],references:[path.join(root,'knowledge','grammars','index.yaml')]},
      resolved=resolveCandidateReferences(op,state,{work}),bound=candidateRootBindings({state,op,work,resolvedReferences:resolved}),controlRoot=path.join(temp,`${name}-control`);
    assert.equal(verifyRuntimePin(pin).ok,true);const bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:name,attempt:1,generation:1,jobId:`job-${name}`},
      workerRoot:path.join(temp,`${name}-worker`),controlRoot,roots:bound.bindings,bindingDigest:bound.bindingDigest,git,environmentDigest:pin.digest});
    if(mutateAfterFreeze){const frozen=freezeDetectionCandidate(bridge,{git,requireReported:true,reportedFiles:[]});assert.equal(frozen.status,'sealed');return {bridge,frozen,pin,root};}
    return {bridge,pin,root};
  };
  const modified=create('modified');fs.appendFileSync(path.join(modified.root,'kernel','common.mjs'),'// drift\n');
  assert.equal(verifyRuntimePin(modified.pin).ok,false);const modifiedFreeze=freezeDetectionCandidate(modified.bridge,{git,requireReported:true,reportedFiles:[]});
  assert.equal(modifiedFreeze.status,'quarantine');assert.ok(modifiedFreeze.reasons.some(reason=>reason.includes('runtime:runtime-pin-drift:Runtime pin changed: kernel/common.mjs')));
  const added=create('added');fs.writeFileSync(path.join(added.root,'kernel','undeclared-probe.mjs'),'export default true;\n');
  assert.equal(verifyRuntimePin(added.pin).ok,false);const addedFreeze=freezeDetectionCandidate(added.bridge,{git,requireReported:true,reportedFiles:[]});
  assert.equal(addedFreeze.status,'quarantine');assert.ok(addedFreeze.reasons.some(reason=>reason.includes('runtime:runtime-pin-drift:Runtime pin contains unsealed files')));
  const after=create('after-freeze',true);fs.appendFileSync(path.join(after.root,'kernel','common.mjs'),'// later drift\n');
  const prepared=prepareCandidateIntegration(after.frozen.snapshot,after.frozen.packet,{canonicalRoots:{source, runtime:after.root},git,mode:'detection-canonical'});
  assert.equal(prepared.status,'quarantine');assert.ok(prepared.reasons.some(reason=>reason.includes('runtime:runtime-pin-drift:Runtime pin changed: kernel/common.mjs')),
    JSON.stringify({reasons:prepared.reasons,snapshot:after.frozen.snapshot.roots.find(root=>root.id==='runtime')?.runtimePin,packet:after.frozen.packet.roots.find(root=>root.id==='runtime')?.runtimePin}));
});
