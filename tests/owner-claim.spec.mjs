import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {notOwnerWorkOf,ownerClaimAudit,ownerClaimOf} from '../scripts/kernel/owner-claim.mjs';

// nivo wf-nivo-workspace-provision-mujek7cb: inc-2474f6593dfe / inc-f19d118298f1 were resolved
// "Owner confirmed: ..." with no owner answer in the ledger. A resolution that claims an owner decision
// now names a verified owner answer (ask-answered event + receipt, both answeredBy owner) or refuses.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const WF='wf-owner-claim';

const world=t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owner-claim-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const l=openLedger({file:ledgerFileFor(repo)});
  try{l.ensureWorkflow({workflowId:WF,title:'owner claim'});}finally{l.close();}
  return repo;
};
// An answered ask: the ask-answered event and its starci/ask-answer@1 receipt, both naming `answeredBy`.
const answerAsk=(repo,dispatchId,answeredBy='owner')=>{
  const dir=path.join(repo,'.starciwork','kernel-evidence',WF,'serve-ask');
  fs.mkdirSync(dir,{recursive:true});
  const receiptPath=path.join(dir,`answer-${dispatchId}.json`);
  fs.writeFileSync(receiptPath,JSON.stringify({schema:'starci/ask-answer@1',workflowId:WF,dispatchId,optionIndex:0,option:'yes',answeredBy,at:new Date().toISOString()}));
  const l=openLedger({file:ledgerFileFor(repo)});
  try{l.appendEvent({workflowId:WF,entityType:'report',entityId:dispatchId,kind:'ask-answered',payload:{dispatchId,receiptPath,answeredBy,optionIndex:0}});}finally{l.close();}
};
const raise=(repo,kind,detail)=>{
  const r=runApi('incident','--repo',repo,'--workflow',WF,'--kind',kind,'--detail',detail,'--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  return JSON.parse(r.stdout).incidentId;
};
const resolve=(repo,id,...extra)=>{
  const r=runApi('incident','--repo',repo,'--workflow',WF,'--resolve',id,...extra,'--json');
  let body=null;try{body=JSON.parse(r.stdout||r.stderr);}catch{}
  return {r,body};
};
const incidentRow=(repo,id)=>{
  const l=inspectLedger({file:ledgerFileFor(repo)});
  try{
    return {status:l.db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(id)?.status,
      resolved:l.db.prepare("SELECT payload_json FROM events WHERE kind='incident-resolved' AND entity_id=?").all(id).map(r=>JSON.parse(r.payload_json))};
  }finally{l.close();}
};

test('ownerClaimOf reads English and Vietnamese owner claims, accented or not, and not a wait or a negation',()=>{
  for(const text of ['Owner confirmed: work-debt reconcile attributed the files','the owner has approved the plan','Settled by owner-approved landing',
    'Owner answer relayed by supervisor','approved by the owner','Thầy xác nhận dùng mặc định','Chủ dự án xác nhận phạm vi','owner đã trả lời trước đó',
    'Chu du an da duyet','được owner duyệt','theo xác nhận của chủ sở hữu'])
    assert.ok(ownerClaimOf(text),text);
  for(const text of ['peer.ts reverted by its author workflow','Debt đã land: work.author commit 80910660','no owner answer yet',
    'waiting until the owner approved it','Chờ chủ sở hữu duyệt drawing','gate không chờ câu trả lời của owner','the owner has not confirmed'])
    assert.equal(ownerClaimOf(text),null,text);
  assert.ok(notOwnerWorkOf('RUNTIME LIMIT (ghi hold): packet vượt Windows spawn limit'));
  assert.ok(notOwnerWorkOf('DEFERRED SETTLE (không phải việc owner thực hiện — ghi để hold theo contract)'));
  assert.equal(notOwnerWorkOf('Owner decision pending on ask ctx_b313f1b0b0b6'),null);
});

test('an unproven owner claim is refused owner-claim-unproven and writes nothing',t=>{
  const repo=world(t);
  const id=raise(repo,'foreign-file-committed','peer.ts committed by a foreign job');
  const fake=resolve(repo,id,'--detail','Owner confirmed: the foreign files are adopted debt');
  assert.equal(fake.r.status,1,fake.r.stdout);
  assert.equal(fake.body.code,'owner-claim-unproven');
  assert.match(fake.body.error,/--owner-answer <dispatchId>/);
  const vi=resolve(repo,id,'--detail','Thầy xác nhận: nhận nợ qua commit-only');
  assert.equal(vi.body.code,'owner-claim-unproven');
  // An ask answered automatically is no owner answer.
  answerAsk(repo,'ctx_auto0000001','auto-recommended');
  const auto=resolve(repo,id,'--detail','Owner confirmed','--owner-answer','ctx_auto0000001');
  assert.equal(auto.body.code,'owner-claim-unproven');
  assert.match(auto.body.error,/auto-recommended, not the owner/);
  const bySay=resolve(repo,id,'--detail','files adopted','--by','owner');
  assert.equal(bySay.body.code,'owner-claim-unproven','--by owner needs the answer too');
  assert.deepEqual(incidentRow(repo,id),{status:'open',resolved:[]});
});

test('a verified owner answer backs the claim; a kernel resolution without owner words still works',t=>{
  const repo=world(t);
  answerAsk(repo,'ctx_owner000001');
  const claimed=raise(repo,'foreign-file-committed','peer.ts committed by a foreign job');
  const ok=resolve(repo,claimed,'--detail','Owner confirmed peer.ts is adopted debt','--owner-answer','ctx_owner000001');
  assert.equal(ok.r.status,0,ok.r.stderr);
  assert.equal(ok.body.ownerAnswer,'ctx_owner000001');
  const row=incidentRow(repo,claimed);
  assert.equal(row.status,'resolved');
  assert.equal(row.resolved[0].ownerAnswer.dispatchId,'ctx_owner000001');
  // An ask the text cites is verified the same way.
  const cited=raise(repo,'plan-note','scope question');
  assert.equal(resolve(repo,cited,'--detail','Owner answered ctx_owner000001 with option 1').r.status,0);

  const plain=raise(repo,'environment','C: low on space');
  const kernel=resolve(repo,plain,'--detail','C: free space restored to 196 GB');
  assert.equal(kernel.r.status,0,kernel.r.stderr);
  assert.equal(kernel.body.by,'kernel');
  assert.equal(incidentRow(repo,plain).resolved[0].by,'kernel');

  // An owner-gate resolves as the owner unless a non-owner resolver is named.
  const gate=raise(repo,'owner-gate','RUNTIME LIMIT: packet owned_paths exceed the Windows spawn limit');
  assert.equal(resolve(repo,gate,'--detail','runtime fixed on .claude main').body.code,'owner-claim-unproven');
  const sup=resolve(repo,gate,'--detail','runtime fixed on .claude main','--by','supervisor');
  assert.equal(sup.r.status,0,sup.r.stderr);
  assert.equal(incidentRow(repo,gate).resolved[0].by,'supervisor');
  assert.equal(resolve(repo,raise(repo,'owner-gate','owner picks a plan'),'--by','boss').body.code,'resolver-invalid');
});

test('the audit lists a past resolution whose owner claim no answer backs, and api status flags a not-owner owner-gate',t=>{
  const repo=world(t);
  answerAsk(repo,'ctx_owner000002');
  const fakeId=raise(repo,'foreign-file-committed','legacy');
  const provenId=raise(repo,'foreign-file-committed','legacy proven');
  // History as the old runtime wrote it: free text, no resolver, no answer.
  const l=openLedger({file:ledgerFileFor(repo)});
  try{
    for(const [id,detail] of [[fakeId,'Owner confirmed: adopted debt'],[provenId,'Owner confirmed in ask ctx_owner000002']]){
      l.db.prepare("UPDATE incidents SET status='resolved' WHERE incident_id=?").run(id);
      l.appendEvent({workflowId:WF,entityType:'incident',entityId:id,kind:'incident-resolved',payload:{detail}});
    }
  }finally{l.close();}
  const ro=inspectLedger({file:ledgerFileFor(repo)});
  try{
    const found=ownerClaimAudit(ro.db);
    assert.deepEqual(found.map(f=>[f.incidentId,f.claim]),[[fakeId,'owner confirmed']]);
  }finally{ro.close();}
  const gate=raise(repo,'owner-gate','DEFERRED SETTLE (không phải việc owner thực hiện): settle waits on adoption commits');
  const status=runApi('status','--repo',repo,'--workflow',WF,'--json');
  assert.equal(status.status,0,status.stderr);
  const frontier=JSON.parse(status.stdout).frontier;
  assert.deepEqual(frontier.ownerGatesNotOwnerWork.map(g=>g.incidentId),[gate]);
  assert.deepEqual(frontier.ownerClaimsUnproven.map(c=>c.incidentId),[fakeId]);
  const cli=spawnSync(process.execPath,[path.join(ROOT,'scripts','checks','owner-claims-audit.mjs'),'--repo',repo,'--json'],{encoding:'utf8',windowsHide:true});
  assert.equal(cli.status,1,cli.stderr);
  const out=JSON.parse(cli.stdout);
  assert.deepEqual(out.ledgers[0].unproven.map(f=>f.incidentId),[fakeId]);
  assert.deepEqual(out.ledgers[0].notOwnerWork.map(g=>g.incidentId),[gate]);
});
