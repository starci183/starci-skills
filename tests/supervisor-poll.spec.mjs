import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {reportsSince,openAsks,orcaTree,DEFAULT_INTERVAL_MS} from '../scripts/supervisor/poll.mjs';
import {orcaTreeFindings,readTerminals} from '../scripts/checks/check-orca-tree.mjs';

// scripts/supervisor/poll.mjs is the supervisor's mechanism: a pure observer
// over the durable ledger. modules/supervisor/supervise.yaml is its contract.

const ROOT=path.resolve(import.meta.dirname,'..');
const POLL=path.join(ROOT,'scripts','supervisor','poll.mjs');
const WORKFLOW='wf-supervisor-poll';

const seedReports=(ledger,count,{workflowId=WORKFLOW}={})=>{
  const at=Date.now();
  ledger.transaction(db=>{
    for(let i=1;i<=count;i++){
      db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at)
        VALUES(?,?,?,?,?,?,?,?)`)
        .run(workflowId,`ctx_${String(i).padStart(4,'0')}`,'code.refactor',1,1,'done',
          JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:`r${i}`}),at+i);
    }
  });
};

test('reportsSince filters in SQL: a cycle that misses more than a page still sees every report',t=>{
  withLedger(t,({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    // More than the 30-row page the projection used to take before filtering:
    // that shape dropped the oldest of a busy interval and advanced the cursor
    // past them for good.
    seedReports(ledger,42);

    const all=reportsSince(ledger.db,0);
    assert.equal(all.length,42,'every report past the cursor is returned, not one page of them');
    assert.deepEqual(all.map(r=>r.report_id),all.map(r=>r.report_id).slice().sort((a,b)=>a-b),
      'reports come back oldest-first so the digest reads in order');

    const tail=reportsSince(ledger.db,all[9].report_id);
    assert.equal(tail.length,32,'the cursor is exclusive');
    assert.equal(tail[0].report_id,all[10].report_id);
  });
});

test('reportsSince honours the --workflow filter',t=>{
  withLedger(t,({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedWorkflow(ledger,{id:'wf-other',state:{phase:'running'}});
    seedReports(ledger,3);
    seedReports(ledger,2,{workflowId:'wf-other'});

    assert.equal(reportsSince(ledger.db,0).length,5);
    assert.deepEqual(reportsSince(ledger.db,0,new Set(['wf-other'])).map(r=>r.workflow_id),
      ['wf-other','wf-other']);
  });
});

test('poll.mjs runs from scripts/supervisor and prints one digest per --once cycle',t=>{
  withLedger(t,({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WORKFLOW);
    seedReports(ledger,2);

    const r=spawnSync(process.execPath,[POLL,'--repo',repoRoot,'--once'],
      {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});
    assert.equal(r.status,0,r.stderr||r.stdout);
    assert.match(r.stdout,/===== poll /,'the cycle prints a digest header');
    assert.match(r.stdout,/supervisor-poll \[running\] kernel no-signal/,
      'a workflow with no kernel signal reads no-signal, never a host call');
    assert.match(r.stdout,/report supervisor-poll code\.refactor a1 -> done/);
  });
});

/* --------------------------------------------- ask liveness in the digest */

const seedAsk=(ledger,{dispatchId,events=[],workflowId=WORKFLOW})=>{
  const at=Date.now();
  ledger.transaction(db=>{
    db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at)
      VALUES(?,?,?,?,?,?,?,?)`)
      .run(workflowId,dispatchId,'owner.ask',1,1,'ask',
        JSON.stringify({schema:'starci/op-report@1',outcome:'ask',summary:'pick one',
          question:{text:'which way?',options:['a','b']}}),at);
  });
  for(const e of events)
    ledger.appendEvent({workflowId,entityType:'report',entityId:dispatchId,kind:e.kind,
      payload:{dispatchId,...(e.url?{url:e.url}:{})}});
};

const listen=async(t,handler)=>{
  const server=http.createServer(handler);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/form`;
};

// A free port nobody is listening on: bind one, read it back, close it.
const closedPort=async()=>{
  const probe=net.createServer();
  await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
  const {port}=probe.address();
  await new Promise(resolve=>probe.close(resolve));
  return port;
};

test('a recorded ask-serving-expired tags the ask dead without touching the network',async t=>{
  await withLedger(t,async({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAsk(ledger,{dispatchId:'ctx_expired',events:[
      {kind:'ask-serving',url:'http://127.0.0.1:1/dead-form'},
      {kind:'ask-serving-expired'},
    ]});

    const saved=globalThis.fetch;
    globalThis.fetch=()=>{throw new Error('the digest probed a URL the ledger already called dead');};
    try{
      const asks=await openAsks(ledger.db);
      assert.equal(asks.length,1);
      assert.equal(asks[0].liveness,'dead');
      assert.equal(asks[0].url,'http://127.0.0.1:1/dead-form','a dead ask still shows what it served');
    }finally{globalThis.fetch=saved;}
  });
});

test('a serving URL that answers 200 is live; a closed port is stale',async t=>{
  const url=await listen(t,(req,res)=>{res.writeHead(200,{'content-type':'text/html'});res.end('<form>');});
  const dead=`http://127.0.0.1:${await closedPort()}/form`;
  await withLedger(t,async({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAsk(ledger,{dispatchId:'ctx_live',events:[{kind:'ask-serving',url}]});
    seedAsk(ledger,{dispatchId:'ctx_stale',events:[{kind:'ask-serving',url:dead}]});

    const byDispatch=Object.fromEntries((await openAsks(ledger.db)).map(a=>[a.dispatch_id,a.liveness]));
    assert.deepEqual(byDispatch,{ctx_live:'live',ctx_stale:'stale'});
  });
});

test('a form that answers non-2xx is stale, and an ask never served is unserved',async t=>{
  const gone=await listen(t,(req,res)=>{res.writeHead(404);res.end('not found');});
  await withLedger(t,async({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAsk(ledger,{dispatchId:'ctx_404',events:[{kind:'ask-serving',url:gone}]});
    seedAsk(ledger,{dispatchId:'ctx_never',events:[]});

    const byDispatch=Object.fromEntries((await openAsks(ledger.db)).map(a=>[a.dispatch_id,a.liveness]));
    assert.deepEqual(byDispatch,{ctx_404:'stale',ctx_never:'unserved'});
  });
});

test('a re-served ask is probed again, not left dead by the earlier expiry',async t=>{
  const url=await listen(t,(req,res)=>{res.writeHead(200);res.end('ok');});
  await withLedger(t,async({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAsk(ledger,{dispatchId:'ctx_reserved',events:[
      {kind:'ask-serving',url:'http://127.0.0.1:1/old-form'},
      {kind:'ask-serving-expired'},
      {kind:'ask-serving',url},
    ]});

    const asks=await openAsks(ledger.db);
    assert.equal(asks[0].liveness,'live');
    assert.equal(asks[0].url,url,'the newest ask-serving wins — event order is seq, not the random event_id');
  });
});

test('a ledger with no kernel signal makes no host call — the tree is simply unchecked',t=>{
  withLedger(t,({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    const tree=orcaTree(ledger.db);
    assert.deepEqual(tree,{listed:false,reason:'no kernel signal',findings:[]},
      'a pure observer with nothing of ours in Orca asks Orca nothing');
  });
});

test('the digest prints one ORCA-TREE line per finding, from the same projection the check exports',t=>{
  withLedger(t,({ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'},
      signals:[{scope:'kernel',key:WORKFLOW,token:'k1',value:{terminal:'term-kernel-new'}}],
      jobs:[{jobId:`kernel-${WORKFLOW}`,kind:'kernel',status:'running',worker_id:'term-kernel-new',payload:{}}]});
    // Two live [Kernel] terminals for one workflow — exactly what the owner
    // found in the sidebar.
    const listing={ok:true,terminals:[
      {handle:'term-kernel-new',title:`[Kernel] ${WORKFLOW}`,connected:true},
      {handle:'term-kernel-old',title:`[Kernel] ${WORKFLOW}`,connected:true},
    ]};
    const tree=orcaTree(ledger.db,{terminals:listing});
    assert.equal(tree.listed,true);
    assert.deepEqual(tree.findings.map(f=>f.code),['DUPLICATE_KERNEL']);
    assert.deepEqual(tree.findings,orcaTreeFindings(ledger.db,readTerminals(listing)),
      'the digest and the check report the same thing, because they are the same projection');
  });
});

test('the supervisor cadence has one authority and supervise.yaml cites it',t=>{
  assert.equal(typeof DEFAULT_INTERVAL_MS,'number');
  const yaml=fs.readFileSync(path.join(ROOT,'modules','supervisor','supervise.yaml'),'utf8');
  assert.match(yaml,/scripts\/supervisor\/poll\.mjs/,'the loop command names the moved mechanism');
  assert.doesNotMatch(yaml,new RegExp(String(DEFAULT_INTERVAL_MS)),
    'the cadence number lives in the code, never restated in the contract');
});
