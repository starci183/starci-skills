import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ENGINE_SCHEMA,isEnrolled,predatesEngineSchema,sealedRuntimeOf} from '../kernel/common.mjs';
import {ENGINE_VERSION,relocateJournal} from '../kernel/engine.mjs';
import {migrateEngineState} from '../kernel/kernel.mjs';
import {openLedger} from '../kernel/ledger-db.mjs';
import {createAdmission} from '../kernel/admission.mjs';
import {WORKFLOW_STATE,createStore} from '../kernel/store.mjs';
import {CANDIDATE_RECORD,readCandidateBridge} from '../kernel/candidate-bridge.mjs';

/**
 * A workflow enrolled by an earlier build - the engine named by a number, every engine-owned op field prefixed
 * with it, the candidate manifests kept whole in the state - is moved to this build's record once, at the retry
 * boundary, and only there. The number is read from the record, never known to this code.
 */
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-engine-migration-'));
// A sibling temp file, never nested inside a test's own `dir`: an unclosed admission machine handle on
// Windows would otherwise block that dir's own cleanup, and the real default machine.sqlite is shared
// (and mutated) by every other spec file's admission fixtures.
const temporaryMachineFile=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'starci-engine-migration-machine-')),'machine.sqlite');
const pkg=JSON.parse(fs.readFileSync(new URL('../package.json',import.meta.url),'utf8'));

test('the engine version is the package version, and the engine identity is a schema',()=>{
  assert.equal(ENGINE_VERSION,pkg.version);assert.equal(pkg.version,'1.0.4');
  assert.equal(isEnrolled({engine:{schema:ENGINE_SCHEMA}}),true);
  assert.equal(isEnrolled({engine:{major:7,journalFile:'j'}}),false);
  assert.equal(predatesEngineSchema({engine:{major:7,journalFile:'j'}}),true);
  // §8's last paragraph: predatesEngineSchema is deliberately dual-purpose (its own docstring in
  // kernel/common.mjs says so too) - a numbered pre-schema marker OR a state that still names the
  // retired journal (journalFile without ledgerFile) is unmigrated, whether or not it already carries
  // the current schema. A schema tag alone does not clear this: the ledger-migrate step is separate.
  assert.equal(predatesEngineSchema({engine:{schema:ENGINE_SCHEMA,journalFile:'j'}}),true);
  assert.equal(predatesEngineSchema({engine:{schema:ENGINE_SCHEMA,ledgerFile:'l'}}),false);
  assert.equal(predatesEngineSchema({}),false);
  assert.deepEqual(sealedRuntimeOf({engine:{major:7,runtimePin:{root:'R'}}}),{root:'R'},'the sealed build is read from either shape');
});

const inlineCandidate=(dir,{withSnapshot=true}={})=>{
  const controlRoot=path.join(dir,'candidates','job-1','control'),workerRoot=path.join(dir,'candidates','job-1','worker');fs.mkdirSync(controlRoot,{recursive:true});
  const snapshot={schema:'starci/candidate-snapshot@1',workflowId:'wf',opId:'op',attempt:1,generation:3,jobId:'job-1',controlRoot,workerRoot,baseRoot:path.join(controlRoot,'base'),oracleRoot:path.join(controlRoot,'oracles'),source:{entries:[{path:'a.txt',sha256:'x',size:1,mode:420}],digest:'d'},oracle:{entries:[],digest:'o'}};
  if(withSnapshot)fs.writeFileSync(path.join(controlRoot,'snapshot.json'),JSON.stringify(snapshot));
  const bridge={schema:'starci/candidate-bridge@1',identity:{workflowId:'wf',opId:'op',attempt:1,generation:3,jobId:'job-1'},snapshot,repoRoot:dir,allowlist:['a.txt'],references:[],resolvedReferences:[],inputPaths:[],acceptedHead:'h'.repeat(40),
    sourceBaseline:[{path:'a.txt',state:'file',sha256:'x',size:1}],dirtyBaseline:[],dirtyBaselinePaths:[],ownedDirtyPaths:[],droppedOwnedPaths:[],dependency:{mode:'isolated-artifact',command:null,root:path.join(controlRoot,'dependencies'),ready:true},writer:{host:'orca-native'},beganAt:'t'};
  return {status:'running',bridge};
};

test('migration renames the numbered fields, puts inline candidates under their control roots, gives the engine its schema and records it once',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createStore({repoRoot:dir,id:'wf'}),candidate=inlineCandidate(dir);
  const state={schema:WORKFLOW_STATE,id:'wf',approved:true,worktree:dir,engine:{major:7,version:'0.9.0',generation:3,journalFile:path.join(dir,'old.sqlite'),runtimePin:{root:'R'},coordination:'agent-v1',modelSelections:{a:1}},
    ops:[{id:'op',status:'running',attempt:1,v7Lease:{jobId:'job-1'},v7Pending:{kind:'durable-job'},v7WorkerSettled:true,v7Candidate:candidate,v7CandidateDigest:'cd',v7OwnedBaselinePaths:['a.txt'],v7ResolvedReferences:['r'],plain:'kept'},
      {id:'ready',status:'ready',attempt:2,v7Candidate:inlineCandidate(path.join(dir,'gone'))},{id:'bare',status:'pending',attempt:1}]};
  fs.rmSync(path.join(dir,'gone'),{recursive:true,force:true});
  store.saveState(state);
  const result=migrateEngineState(store,state);
  assert.equal(result.migrated,true);
  assert.deepEqual(state.engine,{schema:ENGINE_SCHEMA,version:'0.9.0',generation:3,journalFile:path.join(dir,'old.sqlite'),runtimePin:{root:'R'},coordination:'agent-v1',modelSelections:{a:1}},'the number is gone, everything else stays');
  const [op,ready,bare]=state.ops;
  assert.deepEqual(Object.keys(op).sort(),['attempt','candidate','candidateDigest','id','lease','ownedBaselinePaths','pending','plain','resolvedReferences','status','workerSettled']);
  assert.deepEqual(op.lease,{jobId:'job-1'});assert.equal(op.candidateDigest,'cd');assert.equal(op.plain,'kept');
  assert.equal(op.candidate.schema,CANDIDATE_RECORD);assert.equal(op.candidate.controlRoot,candidate.bridge.snapshot.controlRoot);assert.deepEqual(op.candidate.identity,candidate.bridge.identity);
  assert.equal(readCandidateBridge(op.candidate.controlRoot).acceptedHead,'h'.repeat(40),'the bridge the state carried is on disk now');
  assert.equal(ready.candidate,undefined,'a candidate whose control root is gone is dropped');assert.deepEqual(Object.keys(bare).sort(),['attempt','id','status']);
  const events=store.readEvents().filter(event=>event.event==='engine-state-migrated');
  assert.equal(events.length,1);assert.deepEqual(events[0].fields,['candidate','candidateDigest','lease','ownedBaselinePaths','pending','resolvedReferences','workerSettled']);
  assert.deepEqual(events[0].dropped,[{op:'ready',reason:'its control root is gone; the next attempt begins a new candidate'}]);
  assert.equal(JSON.stringify(store.loadState()).includes('sourceBaseline'),false,'the projection no longer carries the manifests');
  assert.deepEqual(migrateEngineState(store,state),{migrated:false},'a migrated record is not migrated again');
  store.close();
});

test('a record already on the schema is untouched, whatever fields it carries',()=>{
  const state={engine:{schema:ENGINE_SCHEMA,journalFile:'j'},ops:[{id:'op',v9Lease:{}}]},events=[];
  assert.deepEqual(migrateEngineState({appendEvent:event=>events.push(event),saveState(){}},state),{migrated:false});
  assert.deepEqual(events,[]);assert.ok(state.ops[0].v9Lease);
});

test('relocating a workflow\'s ledger binding refuses while the former ledger holds anything live, and otherwise retires its rows and carries the probation ledgers over',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const from=path.join(dir,'old','runtime.sqlite'),to=path.join(dir,'new','runtime.sqlite');
  const journal=openLedger({file:from}),admission=createAdmission({journal,machineFile:temporaryMachineFile()});
  journal.enqueueJob({jobId:'live',workflowId:'wf',opId:'op',attempt:1,generation:1,kind:'operation',payload:{}});admission.setCapacity('ai/global',10);
  assert.equal(admission.reserve({jobId:'live',workflowId:'wf',opId:'op',attempt:1,generation:1,resources:[{key:'ai/global',units:1}],ttlMs:60000}).ok,true);
  journal.enqueueJob({jobId:'done',workflowId:'wf',generation:1,kind:'model',payload:{}});journal.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='done'").run();
  journal.enqueueJob({jobId:'other',workflowId:'other',generation:1,kind:'model',payload:{}});
  fs.writeFileSync(path.join(dir,'old','model-probations.json'),'{"p":1}');
  const refused=relocateJournal({from,to,workflowId:'wf'});
  assert.equal(refused.ok,false);assert.match(refused.reason,/1 lease\(s\) and 1 unsettled job\(s\)/);assert.equal(fs.existsSync(to),false);
  assert.equal(admission.release({jobId:'live',generation:1,leaseToken:journal.getJob('live').lease_token}).ok,true);journal.db.prepare("UPDATE jobs SET status='cancelled' WHERE job_id='live'").run();journal.close();
  const moved=relocateJournal({from,to,workflowId:'wf'});
  assert.equal(moved.ok,true);assert.deepEqual(moved.retired,{snapshots:0,jobs:2,events:0,incidents:0,goals:0,reports:0,contracts:0,checks:0,inbox:0,inputs:0,signals:0,workflows:1});assert.deepEqual(moved.copied,['model-probations.json']);
  assert.equal(fs.readFileSync(path.join(dir,'new','model-probations.json'),'utf8'),'{"p":1}');
  const old=openLedger({file:from});assert.deepEqual(old.workflows().map(item=>item.workflowId),['other'],'another workflow\'s rows are not this relocation\'s to touch');old.close();
  assert.equal(relocateJournal({from:path.join(dir,'absent.sqlite'),to,workflowId:'wf'}).ok,true);
});

// §8: rotateEvents no longer renames a jsonl segment (paths.events/paths.state/paths.goal are all removed) -
// generations are a column on the one events table, so retiring one is a no-op that just records
// `events-generation-closed` once. There is no file to check, no segment number to collide, and no live
// log to start empty; what's left of the original intent is that rotating is idempotent and history -
// including a fresh process's, after nothing but its own open - stays readable in order with the seq
// counter never resetting.
test('the event log rotates by generation and history stays readable, with the seq counter continuing',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const store=createStore({repoRoot:dir,id:'wf'});
  store.appendEvent({event:'a'});store.appendEvent({event:'b'});
  assert.deepEqual(store.rotateEvents(1),{rotated:null,generation:1});
  assert.deepEqual(store.rotateEvents(1),{rotated:null,generation:1},'retiring the same generation twice is not an error');
  store.appendEvent({event:'c'});
  const named=event=>event.event??event.kind;
  assert.deepEqual(store.readEvents().map(named).filter(kind=>kind!=='events-generation-closed'),['a','b','c']);
  assert.equal(store.readEvents().filter(event=>named(event)==='events-generation-closed').length,1,'the no-op still records its own event exactly once');
  const beforeReopen=store.readEvents().length;
  const fresh=createStore({repoRoot:dir,id:'wf'});fresh.appendEvent({event:'d'});
  const freshEvents=fresh.readEvents();
  assert.deepEqual(freshEvents.map(named).filter(kind=>kind!=='events-generation-closed'),['a','b','c','d'],'a new process continues after the newest event, seq never resets');
  assert.ok(freshEvents.length>beforeReopen,'the seq counter kept advancing across the reopen instead of starting over');
  fresh.close();store.close();
});
