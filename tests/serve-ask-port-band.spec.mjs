import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// serve-ask's port band is scanned to its last port, both ends included - a hand-rolled scan
// once stopped one short (it probed first..last-1). The spec uses --band with a private band:
// the shared engine/config.mjs ASK_PORT_BAND is raced by every other spec that serves asks.

const ROOT=path.resolve(import.meta.dirname,'..');
const SERVE_ASK=path.join(ROOT,'scripts','kernel','serve-ask.mjs');
const WORKFLOW='wf-port-band';
const [BAND_FIRST,BAND_LAST]=[29690,29699];
const bandRange=(from,to)=>Array.from({length:to-from+1},(_,i)=>from+i);

const seedAskReport=(ledger,{dispatchId,workflowId=WORKFLOW,at=Date.now()})=>{
  ledger.transaction(db=>{
    db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at)
      VALUES(?,?,?,?,?,?,?,?)`)
      .run(workflowId,dispatchId,'provision.ask',1,1,'ask',
        JSON.stringify({schema:'starci/op-report@1',outcome:'ask',summary:`ask from ${dispatchId}`,
          question:{text:'which way?',options:['a','b']}}),at);
  });
};

const serve=(repoRoot,...extra)=>spawnSync(process.execPath,
  [SERVE_ASK,'--repo',repoRoot,'--workflow',WORKFLOW,'--ttl','400','--band',`${BAND_FIRST}..${BAND_LAST}`,...extra],
  {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:60000});

/** Hold 127.0.0.1:<port> for the test's life; a port another process already took stays just as taken. */
const occupy=(t,ports)=>{
  const held=[];
  t.after(()=>{for(const server of held)try{server.close();}catch{}});
  return (async()=>{
    for(const port of ports){
      const server=net.createServer();
      try{
        await new Promise((res,rej)=>{server.once('error',rej);server.listen({port,host:'127.0.0.1',exclusive:true},res);});
        held.push(server);
      }catch{try{server.close();}catch{}}
    }
    return held.length;
  })();
};

test('the band is scanned to its shared last port, inclusive',async t=>{
  await occupy(t,bandRange(BAND_FIRST,BAND_LAST-1));
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_band_last'});
    const r=serve(repoRoot);
    assert.equal(r.status,0,r.stderr||r.stdout);
    const out=JSON.parse(r.stdout.trim().split('\n').pop());
    assert.equal(out.port,BAND_LAST,
      `every port below ${BAND_LAST} is occupied, so the scan must reach the shared band's last port`);
  });
});

test('a fully occupied band fails closed naming the shared band',async t=>{
  await occupy(t,bandRange(BAND_FIRST,BAND_LAST));
  await withLedger(t,async({repoRoot,ledger})=>{
    seedWorkflow(ledger,{id:WORKFLOW,state:{phase:'running'}});
    seedAskReport(ledger,{dispatchId:'ctx_band_full'});
    const r=serve(repoRoot);
    assert.equal(r.status,1,`expected exit 1, got ${r.status}: ${r.stdout}`);
    const err=JSON.parse(r.stderr.trim().split('\n').pop());
    assert.equal(err.ok,false);
    assert.equal(err.error,`no free port in ${BAND_FIRST}..${BAND_LAST}`);
  });
});
