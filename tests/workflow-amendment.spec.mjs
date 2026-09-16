import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {stringifyYaml} from '../core/yaml.mjs';
import {main as launcherMain} from '../hosts/orca/launch.mjs';
import {amendmentContractLines,applyWorkflowAmendment,bindPlannedAmendmentEffects,operationAmendmentVerdict,readWorkflowAmendment} from '../kernel/amendment.mjs';
import {createWorkflowState} from '../kernel/kernel.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {createStore,stateGoalIdentity} from '../kernel/store.mjs';
import {acquireStartup,reserveStartup} from '../kernel/startup-lock.mjs';

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
const addOperation=(id,kind='review.verify',operation=null)=>({id,kind,...(operation?{operation}:{}),goal:`Run ${id} against the authorized source slice.`,ledgerIds:['frontend-slice'],
  allowlist:['src/frontend/**'],references:['src/frontend/**'],checks:[{name:`${id}-check`,command:operation==='stales'
    ?'node bin/starci.mjs check-stales --work .starciwork --repo source=.'
    :'node --test tests/frontend.spec.mjs'}],
  acceptance:[`${id} records a current independent result.`],dependsOn:[]});
const operationAmendment=(fixture)=>{const record=structuredClone(fixture.amendment);record.changes.addOperations=[addOperation('pre-source-audit','review.verify','stales'),addOperation('post-independent-review')];
  record.changes.operationDependencies={'remaining-1':['pre-source-audit'],'post-independent-review':['remaining-1']};return record;};

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

test('an owner maps each superseded unfinished check exactly and history stays immutable',t=>{
  const f=fixture(t),op=f.state.ops[1];op.status='pending';delete op.lease;
  op.checks=[{command:'node --test components/old.spec.mjs',name:'component-path',timeoutMs:120000},{name:'integration',command:'npm test'}];f.store.saveState(f.state);
  f.amendment.changes.supersedeOperationChecks={'remaining-1':[
    {from:{name:'component-path',command:'node --test components/old.spec.mjs'},to:{name:'feature-path',command:'node --test features/new.spec.mjs'},reason:'The source moved from components to features.'},
    {from:{name:'integration',command:'npm test'},to:{name:'slice-integration',command:'node --test tests/slice.spec.mjs'},reason:'The publication gate owns the full suite.'}
  ]};fs.writeFileSync(f.amendmentFile,stringifyYaml(f.amendment));
  const applied=applyWorkflowAmendment(f.store,f.state,f.amendmentFile),current=f.state.ops[1];
  assert.deepEqual(current.checks,[{name:'feature-path',command:'node --test features/new.spec.mjs'},{name:'slice-integration',command:'node --test tests/slice.spec.mjs'}]);
  assert.deepEqual(current.checkHistory[0].checks,[{command:'node --test components/old.spec.mjs',name:'component-path',timeoutMs:120000},{name:'integration',command:'npm test'}]);
  assert.equal(current.checkHistory[0].amendment,applied.amendment.digest);
  assert.match(amendmentContractLines(f.state,current).join('\n'),/publication gate owns the full suite/);
  const invalid=fixture(t);invalid.state.ops[1].status='pending';delete invalid.state.ops[1].lease;invalid.state.ops[1].checks=[{name:'only',command:'npm test'}];invalid.store.saveState(invalid.state);
  invalid.amendment.changes.supersedeOperationChecks={'remaining-1':[{from:{name:'only',command:'different'},to:{name:'slice',command:'node --test slice'},reason:'Bounded replacement.'}]};
  fs.writeFileSync(invalid.amendmentFile,stringifyYaml(invalid.amendment));
  assert.throws(()=>applyWorkflowAmendment(invalid.store,invalid.state,invalid.amendmentFile),/not exactly active once/);
});

test('public amendment reclaims a dead running startup row but refuses a live one',t=>{
  const dead=fixture(t);publicCommand(dead,'workflow-stop','--id',dead.state.id);
  const reserved=reserveStartup(dead.store.dir,{pid:999999,alive:()=>false}),running=acquireStartup(dead.store.dir,{launchToken:reserved.token,pid:999999});assert.equal(running.ok,true);
  fs.writeFileSync(path.join(dead.store.dir,'kernel.lock'),JSON.stringify({pid:999999,startedAt:1,startupToken:running.token}));
  assert.equal(publicCommand(dead,'workflow-amend','--id',dead.state.id,'--amendment',dead.amendmentFile).ok,true);
  assert.equal(dead.store.loadState().ops[1].lease.jobId,'job-unknown','startup recovery does not alter unresolved operation effects');
  const live=fixture(t);publicCommand(live,'workflow-stop','--id',live.state.id);
  const liveReservation=reserveStartup(live.store.dir),liveRunning=acquireStartup(live.store.dir,{launchToken:liveReservation.token});
  fs.writeFileSync(path.join(live.store.dir,'kernel.lock'),JSON.stringify({pid:process.pid,startedAt:Date.now(),startupToken:liveRunning.token}));
  assert.throws(()=>publicCommand(live,'workflow-amend','--id',live.state.id,'--amendment',live.amendmentFile),/still running/);
});

test('an amendment without check supersession keeps its pre-extension digest for replay',t=>{
  const f=fixture(t),parsed=readWorkflowAmendment(f.amendmentFile);
  assert.equal(Object.hasOwn(parsed.record.changes,'supersedeOperationChecks'),false);
  const first=applyWorkflowAmendment(f.store,f.state,f.amendmentFile);
  assert.equal(first.amendment.digest,parsed.digest);
  assert.equal(applyWorkflowAmendment(f.store,f.state,f.amendmentFile).replayed,true);
  assert.equal(f.store.loadState().amendments.length,1);
});

test('retained Task tracking is amendable after reconciliation while live effect identities remain fenced',t=>{
  const tracked=fixture(t);tracked.state.ledger=[{id:'frontend-slice',title:'Existing frontend refactor slice',status:'planned',evidence:[]}];
  const op=tracked.state.ops[1];op.status='ready';delete op.lease;op.task='task_retained_after_retry';op.checks=[{name:'old-path',command:'node --test components/old.spec.mjs'}];tracked.store.saveState(tracked.state);
  const record=operationAmendment(tracked);record.changes.supersedeOperationChecks={'remaining-1':[{from:{name:'old-path',command:'node --test components/old.spec.mjs'},to:{name:'new-path',command:'node --test features/new.spec.mjs'},reason:'The retained Task id tracks history; no worker identity remains live.'}]};
  fs.writeFileSync(tracked.amendmentFile,stringifyYaml(record));
  applyWorkflowAmendment(tracked.store,tracked.state,tracked.amendmentFile);
  assert.equal(op.task,'task_retained_after_retry','amendment preserves canonical Task tracking');
  assert.deepEqual(op.dependsOn,['pre-source-audit']);assert.deepEqual(op.checks,[{name:'new-path',command:'node --test features/new.spec.mjs'}]);

  for(const [name,identity] of [['lease',{jobId:'job-live'}],['dispatch','ctx_live'],['terminal','term_live'],['pending',{kind:'durable-job'}],['workerSettled',false]]){
    const f=fixture(t);f.state.ledger=[{id:'frontend-slice',title:'Existing frontend refactor slice',status:'planned',evidence:[]}];
    const target=f.state.ops[1];target.status='ready';delete target.lease;target.task='task_historical';target[name]=identity;f.store.saveState(f.state);
    const amendment=operationAmendment(f);fs.writeFileSync(f.amendmentFile,stringifyYaml(amendment));
    assert.throws(()=>applyWorkflowAmendment(f.store,f.state,f.amendmentFile),/accepted or live operation/,name);
  }
});

test('an authorized amendment atomically inserts pre-audit and post-review operations into the existing DAG',t=>{
  const f=fixture(t),accepted=structuredClone(f.state.ops[0]),decisions=structuredClone(f.state.decisions),approval=f.state.goalDigest;
  f.state.ledger=[{id:'frontend-slice',title:'Existing frontend refactor slice',status:'planned',evidence:[]}];
  f.state.ops[1].status='pending';delete f.state.ops[1].lease;f.store.saveState(f.state);
  const record=operationAmendment(f);fs.writeFileSync(f.amendmentFile,stringifyYaml(record));
  const applied=applyWorkflowAmendment(f.store,f.state,f.amendmentFile,{now:()=>1234});assert.equal(applied.replayed,false);
  const pre=f.state.ops.find(op=>op.id==='pre-source-audit'),remaining=f.state.ops.find(op=>op.id==='remaining-1'),post=f.state.ops.find(op=>op.id==='post-independent-review');
  assert.equal(pre.kind,'review.verify');assert.equal(pre.origin,'amendment');assert.equal(pre.status,'pending');assert.equal(pre.amendment,applied.amendment.digest);
  assert.equal(pre.operation,'stales');assert.match(amendmentContractLines(f.state,pre).join('\n'),/read-only stales measurement mode/);
  assert.deepEqual(remaining.dependsOn,['pre-source-audit']);assert.deepEqual(remaining.preAmendmentDependsOn,[]);
  assert.deepEqual(remaining.dependencyAmendments,[{amendment:applied.amendment.digest,added:['pre-source-audit']}]);
  assert.deepEqual(post.dependsOn,['remaining-1']);assert.equal(operationAmendmentVerdict(f.state,post,{files:['src/frontend/result.ts']}).ok,true);
  assert.deepEqual(f.state.ops[0],accepted);assert.deepEqual(f.state.decisions,decisions);assert.equal(f.state.goalDigest,approval);assert.equal(f.state.approved,true);
  assert.match(amendmentContractLines(f.state,post).join('\n'),/added by the amendment as review\.verify/);
  const replay=applyWorkflowAmendment(f.store,f.state,f.amendmentFile,{now:()=>9999});assert.equal(replay.replayed,true);
  assert.equal(f.state.ops.filter(op=>['pre-source-audit','post-independent-review'].includes(op.id)).length,2);
  assert.deepEqual(remaining.dependsOn,['pre-source-audit']);assert.equal(f.store.readEvents().filter(event=>event.event==='workflow-amended').length,1);
});

test('invalid added operations and dependency edits fail before any workflow byte or event changes',t=>{
  const cases={
    collision:record=>{record.changes.addOperations[0].id='accepted-1';},
    kind:record=>{record.changes.addOperations[0].kind='task.execute';},
    wrongAuditKind:record=>{record.changes.addOperations[0].kind='backend.implement';},
    unknownAuditMode:record=>{record.changes.addOperations[0].operation='repair';},
    unboundStalesCommand:record=>{record.changes.addOperations[0].checks=[{name:'looks-like-audit',command:'npm run lint'}];},
    compoundLintCommand:record=>{record.changes.addOperations[0].operation='lint';record.changes.addOperations[0].checks=[{name:'compound',command:'npm run lint; echo clean'}];},
    ledger:record=>{record.changes.addOperations[0].ledgerIds=['unknown-ledger'];},
    checks:record=>{record.changes.addOperations[0].checks=[];},
    ceiling:record=>{record.changes.addOperations[0].allowlist=['src/backend/**'];},
    absoluteReference:record=>{record.changes.addOperations[0].references=['C:/outside/source.ts'];},
    unknownReference:record=>{record.changes.addOperations[0].references=['docs/unknown-source.md'];},
    unknownDependency:record=>{record.changes.operationDependencies['post-independent-review']=['missing-op'];},
    selfDependency:record=>{record.changes.operationDependencies['post-independent-review']=['post-independent-review'];},
    cycle:record=>{record.changes.operationDependencies['pre-source-audit']=['post-independent-review'];},
    acceptedTarget:record=>{record.changes.operationDependencies['accepted-1']=['pre-source-audit'];},
  };
  for(const [name,alter] of Object.entries(cases)){
    const f=fixture(t);f.state.ledger=[{id:'frontend-slice',title:'Existing frontend refactor slice',status:'planned',evidence:[]}];
    f.state.ops[1].status='pending';delete f.state.ops[1].lease;f.store.saveState(f.state);
    const record=operationAmendment(f);alter(record);fs.writeFileSync(f.amendmentFile,stringifyYaml(record));
    const before=structuredClone(f.state),eventCount=f.store.readEvents().length;
    assert.throws(()=>applyWorkflowAmendment(f.store,f.state,f.amendmentFile),undefined,name);
    assert.deepEqual(f.state,before,name);assert.deepEqual(f.store.loadState(),before,name);assert.equal(f.store.readEvents().length,eventCount,name);
  }
  for(const [name,status,withLease] of [['running','running',false],['paused','paused',false],['effect-unknown','blocked',true]]){
    const f=fixture(t);f.state.ledger=[{id:'frontend-slice',title:'Existing frontend refactor slice',status:'planned',evidence:[]}];
    f.state.ops[1].status=status;if(!withLease)delete f.state.ops[1].lease;f.store.saveState(f.state);
    const record=operationAmendment(f);fs.writeFileSync(f.amendmentFile,stringifyYaml(record));
    const before=structuredClone(f.state),eventCount=f.store.readEvents().length;
    assert.throws(()=>applyWorkflowAmendment(f.store,f.state,f.amendmentFile),/accepted or live operation/,name);
    assert.deepEqual(f.state,before,name);assert.deepEqual(f.store.loadState(),before,name);assert.equal(f.store.readEvents().length,eventCount,name);
  }
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
