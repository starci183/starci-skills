import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {reportsSince,DEFAULT_INTERVAL_MS} from '../scripts/supervisor/poll.mjs';

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

test('the supervisor cadence has one authority and supervise.yaml cites it',t=>{
  assert.equal(typeof DEFAULT_INTERVAL_MS,'number');
  const yaml=fs.readFileSync(path.join(ROOT,'modules','supervisor','supervise.yaml'),'utf8');
  assert.match(yaml,/scripts\/supervisor\/poll\.mjs/,'the loop command names the moved mechanism');
  assert.doesNotMatch(yaml,new RegExp(String(DEFAULT_INTERVAL_MS)),
    'the cadence number lives in the code, never restated in the contract');
});
