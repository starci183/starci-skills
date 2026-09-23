import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {openAsks} from '../scripts/supervisor/poll.mjs';

// The ask-report lifecycle in the ledger: modules/kernel/api.yaml askLifecycle.
// serve-ask.mjs owns ask-serving / ask-serving-expired / ask-superseded /
// ask-answered; every reader of open asks honours the terminal kinds.

const ROOT=path.resolve(import.meta.dirname,'..');
const SERVE_ASK=path.join(ROOT,'scripts','kernel','serve-ask.mjs');
const WORKFLOW='wf-serve-ask';

const seedAskReport=(ledger,{dispatchId,opId='provision.ask',workflowId=WORKFLOW,at=Date.now(),refs=null})=>{
  ledger.transaction(db=>{
    db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at)
      VALUES(?,?,?,?,?,?,?,?)`)
      .run(workflowId,dispatchId,opId,1,1,'ask',
        JSON.stringify({schema:'starci/op-report@1',outcome:'ask',summary:`ask from ${dispatchId}`,
          question:{text:'which way?',options:['a','b'],...(refs?{refs}:{})}}),at);
  });
};

const serve=(repoRoot,...extra)=>spawnSync(process.execPath,
  [SERVE_ASK,'--repo',repoRoot,'--workflow',WORKFLOW,'--ttl','400',...extra],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});

const askEvents=(ledger,kind)=>ledger.db
  .prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(WORKFLOW,kind)
  .map(r=>JSON.parse(r.payload_json));

test('parking a replacement ask retires the earlier one with ask-superseded',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_old'});
    seedAskReport(ledger,{dispatchId:'ctx_new'});

    const r=serve(repoRoot);
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.equal(JSON.parse(r.stdout.trim().split('\n').pop()).dispatchId,'ctx_new',
      'with no --dispatch the newest ask report is the one served');

    assert.deepEqual(askEvents(ledger,'ask-superseded').map(p=>[p.dispatchId,p.by]),
      [['ctx_old','ctx_new']],'the retired ask names the ask that replaced it');
    assert.deepEqual(askEvents(ledger,'ask-serving').map(p=>p.dispatchId),['ctx_new']);
    assert.deepEqual(askEvents(ledger,'ask-serving-expired').map(p=>p.dispatchId),['ctx_new'],
      'the ttl window closes the form and says so');

    const open=await openAsks(ledger.db);
    assert.deepEqual(open.map(a=>a.dispatch_id),['ctx_new'],
      'a superseded ask is no longer open — the owner can never act on it');
    assert.equal(open[0].liveness,'dead','the expired form is dead, not relayable');
  });
});

test('an unanswered ask of a different op is not superseded',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_other_op',opId:'decision.prepare'});
    seedAskReport(ledger,{dispatchId:'ctx_serving',opId:'provision.ask'});

    const r=serve(repoRoot);
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.deepEqual(askEvents(ledger,'ask-superseded'),[],
      'two ops may legitimately hold one owner gate each');
    assert.deepEqual((await openAsks(ledger.db)).map(a=>a.dispatch_id).sort(),
      ['ctx_other_op','ctx_serving']);
  });
});

// Live Modules: three provision.ask jobs asked about Chatbot, Shell auth and
// Accounting; serving the Accounting ask retired the other two open questions.
test('an ask of the same op about a different subject is not superseded',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_chatbot',refs:['decision.chatbot.d-chatbot-customer-channel-proof']});
    seedAskReport(ledger,{dispatchId:'ctx_shell_old',refs:['decision.instance-management.shell-api-authentication']});
    seedAskReport(ledger,{dispatchId:'ctx_shell_new',refs:['decision.instance-management.shell-api-authentication']});

    const r=serve(repoRoot);
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.deepEqual(askEvents(ledger,'ask-superseded').map(p=>[p.dispatchId,p.by]),
      [['ctx_shell_old','ctx_shell_new']],'only the earlier ask about the same decision is retired');
    assert.deepEqual((await openAsks(ledger.db)).map(a=>a.dispatch_id).sort(),['ctx_chatbot','ctx_shell_new'],
      'the Chatbot question stays open for the owner');
  });
});

test('a superseded ask that is served again is open again',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_old'});
    seedAskReport(ledger,{dispatchId:'ctx_new'});
    assert.equal(serve(repoRoot).status,0);
    assert.deepEqual((await openAsks(ledger.db)).map(a=>a.dispatch_id),['ctx_new']);
    const r=serve(repoRoot,'--dispatch','ctx_old');
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.deepEqual((await openAsks(ledger.db)).map(a=>a.dispatch_id).sort(),['ctx_new','ctx_old'],
      'the re-served question reaches the owner list again');
  });
});

test('--review reads an ask; it never retires one',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_first'});
    seedAskReport(ledger,{dispatchId:'ctx_second'});

    const r=serve(repoRoot,'--review');
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.deepEqual(askEvents(ledger,'ask-superseded'),[],'a read-only review mutates nothing');
    assert.deepEqual((await openAsks(ledger.db)).map(a=>a.dispatch_id).sort(),
      ['ctx_first','ctx_second']);
  });
});

// A StarCi Next Kernel sat an hour on an ask-reserve (inc-2558dd227dfd): status
// said re-serve with serve-ask.mjs, but the Kernel may mutate only through
// api.mjs. `api serve-ask` launches the same form detached.
test('api serve-ask launches the form for a filed ask and refuses one that was never filed',async t=>{
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_api'});
    const API=path.join(ROOT,'scripts','kernel','api.mjs');
    const api=(...a)=>spawnSync(process.execPath,[API,'serve-ask','--repo',repoRoot,'--workflow',WORKFLOW,...a,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
    const refused=api('--dispatch','ctx_nope');
    assert.notEqual(refused.status,0);
    assert.match(refused.stderr,/ask-unknown/);
    const r=api('--dispatch','ctx_api','--ttl','400');
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.equal(JSON.parse(r.stdout).dispatchId,'ctx_api');
    // The detached form binds, records ask-serving, and expires on its ttl.
    const until=Date.now()+20000;
    while(Date.now()<until&&askEvents(ledger,'ask-serving-expired').length===0) await new Promise(res=>setTimeout(res,250));
    assert.deepEqual(askEvents(ledger,'ask-serving').map(p=>p.dispatchId),['ctx_api']);
    assert.deepEqual(askEvents(ledger,'ask-serving-expired').map(p=>p.dispatchId),['ctx_api']);
  });
});
