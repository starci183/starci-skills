// A cut's seam never stalls the chain (owner ruling 2026-09-28: "a seam must not stall the whole
// chain: a slipped seam is cut again or the later slices run in parallel with a stub, never a 3-hour wait"; scripts/kernel/seam-policy.mjs,
// modules/kernel/driver-loop.yaml enqueue.seamContractFirst). nivo wf-nivo-collab-group-chat-mujek7ue held seven
// backend.implement ordinals for more than a day behind seam op-backend.implement-9a2c4c2f03 (attempt 11, queued
// under a peer-wait after three failed attempts).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {parseYaml,stringifyYaml} from '../../engine/yaml.mjs';
import {cutSeamSettings,seamPriorityOf,seamPromptLines,seamReconcileOf,siblingSeamHold,SEAM_RECONCILED_EVENT} from '../../scripts/kernel/seam-policy.mjs';
import {validateOpReport} from '../../scripts/kernel/report-envelope.mjs';
import {registerWorkflowWorktree} from '../../scripts/kernel/workflow-worktree.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const ownerConfig=(t,patch)=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const example=path.join(ROOT,'config.example.yaml');
  fs.copyFileSync(example,path.join(dir,'config.example.yaml'));
  const config=parseYaml(fs.readFileSync(example,'utf8'));
  fs.writeFileSync(path.join(dir,'config.yaml'),stringifyYaml({...config,...patch}));
  return dir;
};
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const tempRepo=t=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-seam-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));for(const d of ['apps/core','docs','src/features/chat'])fs.mkdirSync(path.join(dir,d),{recursive:true});return dir;};
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const json=v=>JSON.stringify(v??null);
const seedGoal=(repo,workflowId)=>seed(repo,ledger=>{
  const at=Date.now();
  ledger.ensureWorkflow({workflowId,title:'seam'});
  ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(workflowId,0,'seamgoal','# goal',json({derivedFrom:'seam-test'}),at);
  ledger.write.changeWorkflowPhase({workflowId,to:'running',by:'test',reason:'seed seam workflow'});
});

/** A workflow with a 3-ordinal cut: seam src/features/chat/composition + apps/core/src, siblings chat/a and chat/b. */
function cutWorkflow(t,wf,{maxOps=null}={}){
  const repo=tempRepo(t);
  const owner=ownerConfig(t,{budgets:{maxOps}});
  seedGoal(repo,wf);
  const api=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,STARCI_OWNER_ROOT:owner,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:''}});
  const enq=(...extra)=>{const r=api('enqueue','--workflow',wf,...extra);assert.equal(r.status,0,r.stderr||r.stdout);return out(r).job_id;};
  const cut=(ordinal,paths)=>enq('--op','docs.author','--paths',paths,'--cut-id','chat-impl','--cut-ordinal',String(ordinal),'--cut-total','3');
  const seam=cut(1,'src/features/chat/composition,apps/core/src');
  const a=cut(2,'src/features/chat/a');
  const b=cut(3,'src/features/chat/b');
  const status=()=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr);return out(r);};
  const q=(jobId)=>status().frontier.queued.find(x=>x.jobId===jobId);
  return {repo,api,enq,seam,a,b,status,q};
}
const setRow=(repo,sql,...args)=>seed(repo,ledger=>ledger.db.prepare(sql).run(...args));
const settleJob=(repo,jobId,status,result=null)=>seed(repo,ledger=>{
  const current=ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status;
  const route=['queued','ready','leased','running',...(status==='succeeded'?['reported','succeeded']:['failed'])];
  for(const next of route.slice(route.indexOf(current)+1))ledger.write.setJobStatus({jobId,to:next,reason:'test settle'});
  if(result)ledger.write.recordJobResult({jobId,result});
});

test('the seam is enqueued with cut-seam priority, ranks first and reads "dispatch seam now"',t=>{
  const {repo,seam,a,status}=cutWorkflow(t,'wf-seam-priority');
  const priority=read(repo,l=>JSON.parse(l.db.prepare('SELECT priority_json FROM jobs WHERE job_id=?').get(seam).priority_json));
  assert.deepEqual(priority,{class:'cut-seam',cutId:'chat-impl',siblings:2});
  assert.equal(read(repo,l=>l.db.prepare('SELECT priority_json FROM jobs WHERE job_id=?').get(a).priority_json),null,'a sibling carries no seam priority');
  assert.deepEqual(seamPriorityOf({id:'x',ordinal:1,total:1}),null,'an uncut single slice is no seam');
  const s=status();
  assert.equal(s.frontier.queued[0].jobId,seam);
  assert.deepEqual(s.frontier.queued[0].seam,{cutId:'chat-impl',siblings:2});
  const action=s.nextActions.find(x=>x.jobId===seam);
  assert.equal(action.seamDuty,'dispatch-seam');
  assert.match(action.reason,/dispatch seam now/);
});

test('a sibling waits on a queued seam at most maxSiblingWaitMs, then runs on a stub',t=>{
  const {repo,seam,a,b,q,status}=cutWorkflow(t,'wf-seam-timeout');
  const {maxSiblingWaitMs}=cutSeamSettings();
  assert.equal(maxSiblingWaitMs,30*60_000,'runtimes.yaml allocation.cutSeam.maxSiblingWaitMs is 30 min');
  const held=q(a);
  assert.equal(held.queuedBecause,'dependency');
  assert.equal(held.blockedBy.job,seam);
  assert.match(held.detail,/at most until .*maxSiblingWaitMs/);
  // The seam sat queued (behind a wait, a full pool) past the window: the sibling proceeds with a stub.
  setRow(repo,'UPDATE jobs SET created_at=? WHERE job_id=?',Date.now()-maxSiblingWaitMs-60_000,a);
  const released=q(a);
  assert.equal(released.queuedBecause,'ready');
  assert.equal(released.seamStub.mode,'timeout');
  assert.equal(released.seamStub.seamJobId,seam);
  assert.equal(q(b).queuedBecause,'dependency','a younger sibling still waits its own window');
  const s=status();
  assert.equal(s.frontier.actionable,true);
  assert.match(s.nextActions.find(x=>x.jobId===a).reason,/ready on a stub \(timeout\).*owes cut-seam-reconcile/);
  assert.deepEqual(s.cutSets[0].seam.siblingsOnStub,[{jobId:a,mode:'timeout'}]);
  assert.deepEqual(s.cutSets[0].seam.siblingsHeld,[b]);
});

test('a seam that fails or slips releases its siblings to a stub and owes a re-cut plan',t=>{
  const {repo,enq,seam,a,b,q,status}=cutWorkflow(t,'wf-seam-recut');
  settleJob(repo,seam,'failed',{verdict:'fail'});
  assert.equal(q(a).queuedBecause,'ready','a dead seam never holds its siblings');
  assert.equal(q(a).seamStub.mode,'seam-failed');
  // One failure then a live retry: the retry is a live wait again (under the recut threshold).
  const retry1=enq('--op','docs.author','--paths','src/features/chat/composition,apps/core/src','--cut-id','chat-impl','--cut-ordinal','1','--cut-total','3');
  assert.equal(q(b).queuedBecause,'dependency');
  assert.equal(q(b).blockedBy.job,retry1);
  // A second failure: the seam slipped (allocation.cutSeam.recutAfterFailures 2) - even its queued retry holds nobody.
  settleJob(repo,retry1,'failed',{verdict:'blocked'});
  const retry2=enq('--op','docs.author','--paths','src/features/chat/composition,apps/core/src','--cut-id','chat-impl','--cut-ordinal','1','--cut-total','3');
  assert.equal(q(b).queuedBecause,'ready');
  assert.equal(q(b).seamStub.mode,'seam-slipped');
  const s=status();
  const view=s.cutSets[0].seam;
  assert.equal(view.jobId,retry2);
  assert.equal(view.failures,2);
  assert.deepEqual(view.recutPlan.seam,['src/features/chat/composition']);
  assert.deepEqual(view.recutPlan.wire,['apps/core/src']);
  assert.equal(view.recutPlan.featureRoot,'src/features/chat');
  const recut=s.nextActions.find(x=>x.seamDuty==='recut');
  assert.equal(recut.kind,'retry');
  assert.match(recut.reason,/re-cut the seam smaller/);
  assert.equal(s.frontier.actionable,true);
  assert.ok(s.frontier.seamDuties.some(d=>d.duty==='recut'));
});

test('the seam publishes its interface: every sibling starts on it at once',t=>{
  const {repo,api,seam,a,b,q}=cutWorkflow(t,'wf-seam-interface');
  fs.mkdirSync(path.join(repo,'src/features/chat/composition'),{recursive:true});
  fs.writeFileSync(path.join(repo,'src/features/chat/composition/contract.ts'),'export interface ChatPort { send(text: string): Promise<void>; }\n');
  fs.mkdirSync(path.join(repo,'src/features/chat/a'),{recursive:true});
  fs.writeFileSync(path.join(repo,'src/features/chat/a/x.ts'),'x\n');
  const outside=api('cut-seam','--publish-interface','--job',seam,'--files','src/features/chat/a/x.ts');
  assert.notEqual(outside.status,0);
  assert.match(outside.stderr,/seam-interface-outside-seam/);
  const notSeam=api('cut-seam','--publish-interface','--job',a,'--files','src/features/chat/a/x.ts');
  assert.match(notSeam.stderr,/cut-seam-not-seam/);
  const missing=api('cut-seam','--publish-interface','--job',seam,'--files','src/features/chat/composition/nope.ts');
  assert.match(missing.stderr,/seam-interface-file-missing/);
  const r=api('cut-seam','--publish-interface','--job',seam,'--files','src/features/chat/composition/contract.ts','--summary','ChatPort');
  assert.equal(r.status,0,r.stderr);
  assert.equal(out(r).files[0].path,'src/features/chat/composition/contract.ts');
  assert.match(out(r).files[0].sha256,/^[0-9a-f]{64}$/);
  for(const job of [a,b]){
    assert.equal(q(job).queuedBecause,'ready');
    assert.equal(q(job).seamStub.mode,'interface');
  }
  // In a workflow worktree the seam writes (never commits) its interface there: publish reads that tree, not the ledger checkout.
  const tree=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'starci-seam-wt-')));
  t.after(()=>fs.rmSync(tree,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  assert.equal(spawnSync('git',['init','-q','-b','main',tree],{windowsHide:true}).status,0);
  fs.mkdirSync(path.join(tree,'src/features/chat/composition'),{recursive:true});
  fs.writeFileSync(path.join(tree,'src/features/chat/composition/contract.ts'),'export interface ChatPort { close(): void; }\n');
  registerWorkflowWorktree({env:process.env},{workflowId:'wf-seam-interface',orcaWorktreeId:'repo-seam::wf-seam-interface',path:tree,branch:'wf-seam-interface'});
  const inTree=api('cut-seam','--publish-interface','--job',seam,'--files','src/features/chat/composition/contract.ts');
  assert.equal(inTree.status,0,inTree.stderr);
  assert.notEqual(out(inTree).files[0].sha256,out(r).files[0].sha256,'the interface is digested from the workflow worktree');
});

test('the Kernel releases a stuck cut; a sibling dispatched on a stub is told stub-first',t=>{
  const {repo,api,seam,a,q}=cutWorkflow(t,'wf-seam-release');
  assert.match(api('cut-seam','--release','--workflow','wf-seam-release','--op','docs.author','--cut-id','chat-impl').stderr,/needs --reason/);
  const r=api('cut-seam','--release','--workflow','wf-seam-release','--op','docs.author','--cut-id','chat-impl','--reason','seam behind peer-wait inc-x');
  assert.equal(r.status,0,r.stderr);
  assert.equal(out(r).seamJobId,seam);
  assert.equal(q(a).seamStub.mode,'released');
  // The stamp dispatch records rides into the op prompt: build on the interface or a local stub, never wait.
  const hold=read(repo,l=>siblingSeamHold(l.db,l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(a)));
  assert.equal(hold.hold,false);
  const lines=seamPromptLines({cut:{id:'chat-impl',ordinal:2,total:3,seamStub:hold.stub},jobLabel:a}).join('\n');
  assert.match(lines,/STUB-FIRST/);
  assert.match(lines,/write the minimal stub .* INSIDE your owned paths/);
  assert.match(lines,/seamAssumptions/);
  const seamLines=seamPromptLines({cut:{id:'chat-impl',ordinal:1,total:3},jobLabel:seam,api:'cli.mjs',repoLabel:'R'}).join('\n');
  assert.match(seamLines,/CONTRACT FIRST/);
  assert.match(seamLines,new RegExp(`node cli.mjs cut-seam --repo R --publish-interface --job ${seam}`));
  settleJob(repo,seam,'succeeded');
  assert.equal(api('cut-seam','--release','--workflow','wf-seam-release','--op','docs.author','--cut-id','chat-impl','--reason','x').stderr.includes('cut-seam-passed'),true);
});

test('a stub sibling that passed before its seam landed owes one light reconcile, not a redo',t=>{
  const {repo,api,seam,a,b,status}=cutWorkflow(t,'wf-seam-reconcile');
  // Sibling a ran on a stub and passed while the seam was still open.
  seed(repo,l=>{
    const row=l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(a);
    const payload=JSON.parse(row.payload_json);
    payload.cut.seamStub={mode:'timeout',seamJobId:seam,seamStatus:'queued'};
    l.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id=?").run(JSON.stringify(payload),a);
  });
  settleJob(repo,a,'succeeded');
  assert.match(api('cut-seam','--reconcile','--job',a,'--exit-code','0').stderr,/cut-seam-not-landed/);
  let s=status();
  assert.deepEqual(s.cutSets[0].seam.reconcile.pending.map(x=>x.jobId),[a]);
  assert.equal(s.nextActions.some(x=>x.seamDuty==='reconcile'),false,'nothing to reconcile against before the seam lands');
  // The seam lands: a owes cut-seam-reconcile.
  settleJob(repo,seam,'succeeded');
  s=status();
  assert.deepEqual(s.cutSets[0].seam.reconcile.owed.map(x=>x.jobId),[a]);
  const owed=s.nextActions.find(x=>x.seamDuty==='reconcile');
  assert.equal(owed.kind,'impact-check');
  assert.equal(owed.jobId,a);
  assert.match(owed.reason,/api cut-seam --reconcile --job/);
  assert.equal(s.frontier.actionable,true);
  assert.match(api('cut-seam','--reconcile','--job',b,'--exit-code','0').stderr,/cut-seam-no-stub/);
  assert.match(api('cut-seam','--reconcile','--job',a).stderr,/cut-seam-exit-code/);
  // Red: that ordinal alone is redone.
  const red=api('cut-seam','--reconcile','--job',a,'--exit-code','2','--command','npx tsc --noEmit -p .');
  assert.equal(red.status,0,red.stderr);
  s=status();
  assert.equal(s.nextActions.find(x=>x.seamDuty==='reconcile-red').jobId,a);
  // Green after the fix clears the duty.
  assert.equal(api('cut-seam','--reconcile','--job',a,'--exit-code','0','--command','npx tsc --noEmit -p .').status,0);
  s=status();
  assert.equal(s.nextActions.some(x=>String(x.seamDuty).startsWith('reconcile')),false);
  const rec=read(repo,l=>seamReconcileOf(l.db,{workflowId:'wf-seam-reconcile',op:'docs.author',cutId:'chat-impl'}));
  assert.deepEqual(rec.green.map(x=>x.jobId),[a]);
  assert.equal(read(repo,l=>l.db.prepare('SELECT count(*) n FROM events WHERE kind=?').get(SEAM_RECONCILED_EVENT).n),2);
});

test('the last free slot goes to a queued seam, never to other work',t=>{
  const {api,seam,enq}=cutWorkflow(t,'wf-seam-slot',{maxOps:1});
  const other=enq('--op','docs.author','--paths','docs/other');
  const refused=api('dispatch','--job',other);
  assert.notEqual(refused.status,0);
  assert.equal(out(refused).reason,'seam-priority');
  assert.equal(out(refused).seam,seam);
});

test('an op report may name its seam assumptions',()=>{
  const base={outcome:'done',summary:'slice done'};
  assert.equal(validateOpReport({...base,seamAssumptions:[{symbol:'ChatPort.send',assumption:'resolves after persist',file:'src/a/port.ts'}]}).ok,true);
  const bad=validateOpReport({...base,seamAssumptions:[{symbol:'x'}]});
  assert.equal(bad.ok,false);
  assert.match(bad.reasons.join(' '),/seamAssumptions/);
});
