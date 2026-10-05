import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {workflowPurgeApproval,sweepLedgers} from '../../scripts/housekeeping/hk-ledger.mjs';
import {sweepStarciLogs} from '../../scripts/housekeeping/hk-logs.mjs';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';
const adoption=repo=>({retention:{workflowPurge:{approvedBy:'owner',approvalRef:'private fixture owner retention approval',repos:[repo]}}});
test('workflow purge needs current adoption of the exact ledger-owner repository',t=>withLedger(t,({repoRoot,ledger,ledgerFile})=>{
  const now=1800000000000;seedWorkflow(ledger,{id:'wf-expired',state:{phase:'finished'},now:()=>now-40*86400000});ledger.db.prepare('UPDATE workflows SET finished_at=? WHERE workflow_id=?').run(now-40*86400000,'wf-expired');
  ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(repoRoot);
  return (async()=>{let calls=0;const purge=args=>{calls++;assert.equal(args.approvalRef,'private fixture owner retention approval');return {archive:'private.zip',purge:{state:'purged'}};};
    const unadopted=await sweepLedgers({files:[ledgerFile],now,config:{},purge});assert.equal(calls,0);assert.equal(unadopted.skipped[0]?.reason,'workflow-purge-policy-not-adopted');
    const adopted=await sweepLedgers({files:[ledgerFile],now,config:adoption(repoRoot),purge});assert.equal(calls,1);assert.equal(adopted.purged.length,1);
    const child=path.join(repoRoot,'child');fs.mkdirSync(child);assert.equal(workflowPurgeApproval(child,adoption(repoRoot)),null);
  })();
}));
test('the existing machine log pruner is invoked only on apply and its failures are visible',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'machine-retention-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const file=path.join(root,'known-machine.sqlite');fs.writeFileSync(file,'private sentinel');
  const env={STARCI_LOCAL_ROOT:path.join(root,'state'),USERPROFILE:path.join(root,'home'),APPDATA:path.join(root,'orca'),STARCI_TEST_MACHINE_FILE:file};
  let opens=0,closes=0,prunes=0;const machineOpen=()=>{opens++;return {pruneLogs:()=>{prunes++;return 7;},close:()=>closes++};};
  const dry=await sweepStarciLogs({env,machineFile:file,machineOpen});assert.equal(opens,0);assert.equal(dry.report.machineLogs.state,'dry-run');
  const applied=await sweepStarciLogs({apply:true,env,machineFile:file,machineOpen});assert.equal(applied.ok,true);assert.equal(applied.report.machineLogs.deleted,7);assert.equal(prunes,1);assert.equal(closes,1);
  const failed=await sweepStarciLogs({apply:true,env,machineFile:file,machineOpen:()=>({pruneLogs:()=>{throw Error('busy')},close:()=>closes++})});assert.equal(failed.ok,false);assert.equal(failed.report.machineLogs.state,'failed');assert.equal(closes,2);
});
