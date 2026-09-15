import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {stringifyYaml} from '../core/yaml.mjs';
import {main as launcherMain} from '../hosts/orca/launch.mjs';
import {amendmentContractLines,bindPlannedAmendmentEffects,operationAmendmentVerdict,readWorkflowAmendment} from '../kernel/amendment.mjs';
import {createWorkflowState} from '../kernel/kernel.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {createStore,stateGoalIdentity} from '../kernel/store.mjs';

function fixture(t){
  const root=fs.mkdtempSync(path.join(process.cwd(),'.workflow-amendment-test-'));
  t.after(()=>{assert.equal(path.dirname(root),process.cwd());assert.ok(path.basename(root).startsWith('.workflow-amendment-test-'));fs.rmSync(root,{recursive:true,force:true});});
  assert.equal(spawnSync('git',['init','-q'],{cwd:root,windowsHide:true}).status,0);
  const store=createStore({repoRoot:root,id:'wf-existing'});
  const state=createWorkflowState({job:'Deliver the originally approved slice',worktree:root,branch:'main',store,scope:['features/existing']});
  state.phase='finished';state.approved=true;state.goalDigest='a'.repeat(64);state.definitionOfDone=['Original acceptance'];
  state.decisions=[{id:'decision-1',answer:'Keep historical decision'}];
  state.ops=[
    {id:'accepted-1',kind:'backend.implement',status:'done',attempt:1,findings:[],files:['src/accepted.ts'],reports:[{dispatch:'ctx-accepted',outcome:'done'}],head:'b'.repeat(40)},
    {id:'remaining-1',kind:'frontend.implement',status:'blocked',attempt:3,findings:['Historical blocker'],files:[],reports:[],
      lease:{workflowId:'wf-existing',opId:'remaining-1',attempt:3,generation:2,jobId:'job-unknown',leaseToken:'lease-token'}}
  ];
  state.finished={outcome:'blocked',reason:'owner clarification required',report:store.paths.final};
  const journalFile=path.join(root,'runtime','journal.sqlite'),journal=openJournal({file:journalFile});
  const now=Date.now();
  journal.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,'effect_unknown',?,?,?,?)")
    .run('job-unknown',state.id,'remaining-1',3,2,'operation','implement','{}','{}','lease-token',now,now);
  journal.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .run('canonical-writer:fixture','job-unknown',state.id,'remaining-1',3,2,'lease-token',1,now,now+60000);
  journal.close();
  state.engine={schema:'starci/engine@1',version:'1.0.0',generation:2,journalFile,runtimePin:{root:root,digest:'c'.repeat(64)}};
  store.saveState(state);
  const amendment={schema:'starci/workflow-amendment@1',workflowId:state.id,baseGoalIdentity:stateGoalIdentity(state),
    authority:{actor:'owner',source:{threadId:'owner-codex-chat',messageId:null,messageIdAvailability:'not-exposed',
      quote:'Continue this same workflow with the frontend recovery scope.',assurance:'conversation-context-not-authenticated',at:null},statement:'Continue this same workflow with the frontend recovery scope.'},
    coordinator:{actor:'coordinator',source:{threadId:'run-coordinator',messageId:'coord-msg-9',messageIdAvailability:'available',
      quote:'Apply the owner grant to the existing workflow.',assurance:'conversation-context-not-authenticated',at:'2026-09-16T01:05:00Z'},decision:'apply-same-id',rationale:'The grant is explicit and the existing accepted work remains valid.'},
    changes:{clarifications:['The direct repair instruction supersedes the old no-rewrite note.'],addScope:['features/frontend-recovery'],
      scopeBindings:{'features/frontend-recovery':['.starciwork/features/frontend-recovery/**']},
      addDefinitionOfDone:['Frontend recovery is independently verified'],
      supersedeDefinitionOfDone:[{from:'Original acceptance',to:'Original acceptance remains, with the authorized bounded frontend recovery repair.'}],
      operationFindings:{'remaining-1':['Use the current authorized repair instruction.']},
      operationEffects:{'remaining-1':{paths:['src/frontend/**'],resources:[],external:[]}},
      effectCeiling:{paths:['.starciwork/features/frontend-recovery/**','src/frontend/**'],resources:[],external:[]}}};
  const amendmentFile=path.join(root,'amendment.yaml');fs.writeFileSync(amendmentFile,stringifyYaml(amendment));
  return {root,store,state,journalFile,amendment,amendmentFile};
}
const publicCommand=(fixture,...args)=>launcherMain([...args,'--worktree',path.relative(process.cwd(),fixture.root)],{orca:{}});

test('public stop and same-ID amendment preserve accepted history, owner decisions and an unknown writer',t=>{
  const f=fixture(t);
  assert.throws(()=>publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile),/not paused/);
  const stopped=publicCommand(f,'workflow-stop','--id',f.state.id);
  assert.equal(stopped.id,f.state.id);assert.ok(fs.existsSync(stopped.continuation));
  fs.writeFileSync(path.join(f.store.dir,'kernel.lock'),JSON.stringify({pid:process.pid,startedAt:Date.now(),startupToken:'owned'}));
  assert.throws(()=>publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile),/still running/);
  fs.rmSync(path.join(f.store.dir,'kernel.lock'));
  const amended=publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile);
  assert.equal(amended.ok,true);assert.equal(amended.replayed,false);assert.equal(amended.id,f.state.id);
  assert.equal(amended.amendment.baseGoalIdentity,'a'.repeat(64));
  const current=f.store.loadState();
  assert.equal(current.goalDigest,'a'.repeat(64),'the frozen approved goal identity is unchanged');
  assert.deepEqual(current.ops[0],f.state.ops[0],'accepted operation, reports and source identity are untouched');
  assert.deepEqual(current.decisions,f.state.decisions);
  assert.deepEqual(current.ops[1].lease,f.state.ops[1].lease,'unknown-effect writer identity stays fenced');
  assert.ok(current.scope.includes('features/frontend-recovery'));
  assert.equal(current.definitionOfDone.includes('Original acceptance'),false,'the contradictory historical criterion is no longer active');
  assert.ok(current.definitionOfDone.includes('Original acceptance remains, with the authorized bounded frontend recovery repair.'));
  assert.ok(current.definitionOfDone.includes('Frontend recovery is independently verified'));
  assert.deepEqual(current.definitionOfDoneHistory[0].criteria,['Original acceptance'],'the original wording remains historical evidence');
  assert.ok(current.ops[1].allowlist.includes('src/frontend/**'),'the named unfinished operation receives the bounded path grant');
  assert.ok(current.ops[1].findings.includes('Use the current authorized repair instruction.'));
  assert.equal(current.amendments[0].authority.source.messageIdAvailability,'not-exposed');
  assert.equal(current.amendments[0].authority.source.messageId,null,'an unavailable native owner message id is not invented');
  assert.equal(current.amendments[0].authority.source.at,null,'an unavailable native owner-event timestamp is not invented');
  assert.equal(current.amendments[0].coordinator.source.messageId,'coord-msg-9');
  assert.equal(current.amendments[0].approvalDigest,undefined,'an amendment digest is never presented as owner approval');
  const journal=openJournal({file:f.journalFile});
  assert.equal(journal.getJob('job-unknown').status,'effect_unknown');
  assert.equal(journal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get('job-unknown').n,1);
  const durable=journal.db.prepare('SELECT state_json FROM state_snapshots WHERE workflow_id=? AND generation=? ORDER BY snapshot_id DESC LIMIT 1').get(f.state.id,2);
  assert.equal(JSON.parse(durable.state_json).amendments[0].digest,current.amendments[0].digest,
    'the current-generation durable checkpoint contains the amendment that resume will load');
  journal.close();
  const brief=fs.readFileSync(amended.continuation,'utf8');
  for(const expected of ['Authorized same-workflow amendments','owner-codex-chat','not exposed','coord-msg-9','features/frontend-recovery','job-unknown','Unknown or live effects are intentionally preserved'])
    assert.match(brief,new RegExp(expected));
  const replay=publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile);
  assert.equal(replay.replayed,true);assert.equal(f.store.loadState().amendments.length,1);
  assert.equal(f.store.readEvents().filter(event=>event.event==='workflow-amended').length,1);
});

test('same owner source cannot drift and an amendment cannot reopen accepted work',t=>{
  const f=fixture(t);publicCommand(f,'workflow-stop','--id',f.state.id);
  publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile);
  const drift=structuredClone(f.amendment);drift.authority.statement='Different bytes under the same alleged owner message.';
  const driftFile=path.join(f.root,'drift.yaml');fs.writeFileSync(driftFile,stringifyYaml(drift));
  assert.throws(()=>publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',driftFile),/already bound/);
  const reopen=structuredClone(f.amendment);reopen.authority.source.at='2026-09-16T01:01:00Z';reopen.authority.source.quote='Open a separate clarification.';reopen.coordinator.source.messageId='coord-msg-10';
  reopen.changes.operationFindings={'accepted-1':['Run accepted work again.']};
  const reopenFile=path.join(f.root,'reopen.yaml');fs.writeFileSync(reopenFile,stringifyYaml(reopen));
  assert.throws(()=>publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',reopenFile),/cannot reopen accepted or settled operation/);
});

test('sequential, stale-projection and replayed amendments compose every prior operation grant without a lost update',t=>{
  const f=fixture(t);publicCommand(f,'workflow-stop','--id',f.state.id);const stale=f.store.loadState();
  publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile);
  fs.writeFileSync(f.store.paths.state,`${JSON.stringify(stale,null,2)}\n`,'utf8');
  const second=structuredClone(f.amendment);second.authority.source.at='2026-09-16T01:02:00Z';second.authority.source.quote='Retain the first amendment and add its validation criterion.';second.authority.statement=second.authority.source.quote;
  second.coordinator.source.messageId='coord-msg-11';second.coordinator.source.at='2026-09-16T01:06:00Z';
  second.changes={clarifications:['The second overlay composes with the first durable overlay.'],addScope:[],scopeBindings:{},
    addDefinitionOfDone:['The bounded repair has a current validation receipt'],supersedeDefinitionOfDone:[],operationFindings:{},operationEffects:{},
    effectCeiling:{paths:['src/frontend-validation/**'],resources:[],external:[]}};
  second.changes.operationEffects={'remaining-1':{paths:['src/frontend-validation/**'],resources:[],external:[]}};
  const file=path.join(f.root,'second.yaml');fs.writeFileSync(file,stringifyYaml(second));
  const result=publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',file);assert.equal(result.replayed,false);
  const current=f.store.loadState();assert.equal(current.amendments.length,2);assert.ok(current.scope.includes('features/frontend-recovery'));
  assert.ok(current.definitionOfDone.includes('The bounded repair has a current validation receipt'));
  assert.ok(current.ops[1].allowlist.includes('src/frontend/**'),'the first operation grant survives the stale projection');
  assert.ok(current.ops[1].allowlist.includes('src/frontend-validation/**'),'the later operation grant composes with the first');
  assert.equal(operationAmendmentVerdict(current,current.ops[1],{files:['src/frontend/login.tsx','src/frontend-validation/receipt.json']}).ok,true);
  const replay=publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',file);assert.equal(replay.replayed,true);
  assert.equal(f.store.loadState().amendments.length,2,'replay neither duplicates nor drops either grant');
});

test('a legacy amendment reloads the final controller checkpoint after its initial read and lock acquisition',t=>{
  const f=fixture(t);delete f.state.engine;f.store.saveState(f.state);publicCommand(f,'workflow-stop','--id',f.state.id);
  const latest=f.store.loadState();
  latest.ops[0].reports.push({dispatch:'ctx-after-open',outcome:'done',receipt:{digest:'d'.repeat(64)}});
  latest.decisions.push({id:'decision-after-open',answer:'Keep the controller final decision'});
  latest.controllerFinalCheckpoint={receipt:'controller-save-after-open',sequence:7};
  const latestFile=path.join(f.root,'latest-state.json');fs.writeFileSync(latestFile,`${JSON.stringify(latest,null,2)}\n`);
  const sentinel=path.join(f.root,'state-intercepted.txt');
  const preload=`import fs from 'node:fs';
const read=fs.readFileSync.bind(fs),target=process.env.STARCI_AMEND_INTERCEPT_TARGET,source=process.env.STARCI_AMEND_INTERCEPT_SOURCE,sentinel=process.env.STARCI_AMEND_INTERCEPT_SENTINEL;
let intercepted=false;
fs.readFileSync=function(file,...args){const value=read(file,...args);if(!intercepted&&String(file)===target){intercepted=true;const tmp=target+'.intercept.tmp';fs.writeFileSync(tmp,read(source));fs.renameSync(tmp,target);fs.writeFileSync(sentinel,'after-open-before-lock');}return value;};`;
  const invoked=spawnSync(process.execPath,['--import',`data:text/javascript,${encodeURIComponent(preload)}`,path.resolve('hosts/orca/launch.mjs'),
    'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile,'--worktree',path.relative(process.cwd(),f.root)],
  {cwd:process.cwd(),windowsHide:true,encoding:'utf8',env:{...process.env,STARCI_AMEND_INTERCEPT_TARGET:f.store.paths.state,
    STARCI_AMEND_INTERCEPT_SOURCE:latestFile,STARCI_AMEND_INTERCEPT_SENTINEL:sentinel}});
  assert.equal(invoked.status,0,invoked.stderr||invoked.stdout);assert.equal(fs.readFileSync(sentinel,'utf8'),'after-open-before-lock');
  const current=f.store.loadState();
  assert.deepEqual(current.ops[0].reports.at(-1),latest.ops[0].reports.at(-1),'the accepted receipt from the final controller save survives');
  assert.deepEqual(current.decisions.at(-1),latest.decisions.at(-1),'the final controller decision survives');
  assert.deepEqual(current.controllerFinalCheckpoint,latest.controllerFinalCheckpoint,'a newly added final-checkpoint field survives');
  assert.equal(current.amendments.length,1);assert.ok(current.scope.includes('features/frontend-recovery'));
});

test('real concurrent public amendment processes serialize, and retry composes the contender without a lost update',async t=>{
  const f=fixture(t);publicCommand(f,'workflow-stop','--id',f.state.id);
  const second=structuredClone(f.amendment);second.authority.source.quote='Also authorize the bounded audit output.';second.authority.statement=second.authority.source.quote;
  second.coordinator.source.messageId='coord-msg-concurrent';second.coordinator.source.at='2026-09-16T01:07:00Z';
  second.changes={clarifications:['The audit grant composes with every earlier grant.'],addScope:[],scopeBindings:{},addDefinitionOfDone:['The audit output is verified'],supersedeDefinitionOfDone:[],operationFindings:{},
    operationEffects:{'remaining-1':{paths:['src/frontend-audit/**'],resources:[],external:[]}},effectCeiling:{paths:['src/frontend-audit/**'],resources:[],external:[]}};
  const secondFile=path.join(f.root,'concurrent.yaml');fs.writeFileSync(secondFile,stringifyYaml(second));
  const launcher=path.resolve('hosts/orca/launch.mjs'),worktree=path.relative(process.cwd(),f.root);
  const invoke=file=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,[launcher,'workflow-amend','--id',f.state.id,'--amendment',file,'--worktree',worktree],{cwd:process.cwd(),windowsHide:true});let stdout='',stderr='';
    child.stdout.on('data',chunk=>{stdout+=chunk;});child.stderr.on('data',chunk=>{stderr+=chunk;});child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr,file}));});
  const attempts=await Promise.all([invoke(f.amendmentFile),invoke(secondFile)]);
  for(const attempt of attempts.filter(item=>item.code!==0))publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',attempt.file);
  const current=f.store.loadState(),remaining=current.ops.find(op=>op.id==='remaining-1');
  assert.equal(current.amendments.length,2,JSON.stringify(attempts));assert.equal(f.store.readEvents().filter(event=>event.event==='workflow-amended').length,2);
  assert.ok(remaining.allowlist.includes('src/frontend/**'));assert.ok(remaining.allowlist.includes('src/frontend-audit/**'));
  assert.ok(current.definitionOfDone.includes('The audit output is verified'));
});

test('amendment provenance matches the public schema instead of normalizing an omitted native message id',t=>{
  const f=fixture(t),record=structuredClone(f.amendment);
  delete record.authority.source.messageId;
  fs.writeFileSync(f.amendmentFile,stringifyYaml(record));
  assert.throws(()=>readWorkflowAmendment(f.amendmentFile),/authority\.source\.messageId/);
  record.authority.source.messageId=null;
  record.authority.source.at='2026-09-16';
  fs.writeFileSync(f.amendmentFile,stringifyYaml(record));
  assert.throws(()=>readWorkflowAmendment(f.amendmentFile),/null or an ISO date-time with a timezone/);
  record.authority.source.at=null;fs.writeFileSync(f.amendmentFile,stringifyYaml(record));
  assert.equal(readWorkflowAmendment(f.amendmentFile).record.authority.source.at,null);
});

test('bounded amendment authority reaches planning, dispatch contract and changed-file validation without widening other paths',t=>{
  const f=fixture(t);publicCommand(f,'workflow-stop','--id',f.state.id);publicCommand(f,'workflow-amend','--id',f.state.id,'--amendment',f.amendmentFile);
  const current=f.store.loadState(),op=current.ops.find(item=>item.id==='remaining-1');
  assert.equal(operationAmendmentVerdict(current,op,{files:['src/frontend/login.tsx']}).ok,true);
  const refused=operationAmendmentVerdict(current,op,{files:['src/backend/admin.ts']});assert.equal(refused.ok,false);assert.match(refused.reasons[0],/outside original and amended/);
  const contract=amendmentContractLines(current,op).join('\n');assert.match(contract,/superseded historical criterion/);assert.match(contract,/this operation's added paths: src\/frontend\/\*\*/);
  const planned={id:'planned-index',nodeId:'features/frontend-recovery',allowlist:['.starciwork/features/frontend-recovery/index.yaml'],references:[]};
  bindPlannedAmendmentEffects(current,planned,{id:'features/frontend-recovery',path:'features/frontend-recovery/index.yaml'});assert.deepEqual(planned.scopeAmendments,[current.amendments[0].digest]);
  assert.throws(()=>bindPlannedAmendmentEffects(current,{...planned,id:'outside',allowlist:['.starciwork/features/outside/index.yaml'],scopeAmendments:[]},{id:'features/frontend-recovery',path:'features/frontend-recovery/index.yaml'}),/exceeds the added-scope Work path binding/);
});
