import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {openMachine} from '../../engine/db/machine.mjs';

export function createKernelSettleNextStepFixture(){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-settle-next-'));
  const repo=path.join(root,'repo');
  const machineHome=path.join(root,'machine');
  const env={...process.env,STARCI_PROJECTS_ROOT:path.join(root,'projects'),STARCI_TEST_MACHINE_FILE:path.join(machineHome,'machine.sqlite'),STARCI_LOCAL_ROOT:machineHome};
  fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  fs.mkdirSync(machineHome,{recursive:true});
  openMachine({file:env.STARCI_TEST_MACHINE_FILE}).close();
  const ledgerFile=ledgerFileFor(repo,{env});
  const ledger=openLedger({file:ledgerFile});

  const reset=()=>{
    ledger.transaction(db=>{
      const workflows=db.prepare('SELECT workflow_id FROM workflows').all();
      const authorize=db.prepare(`INSERT OR REPLACE INTO workflow_purges(
        workflow_id,state,approved_by,approval_ref,archive_path,archive_sha256,verified_at,created_at
      ) VALUES(?,'deleting','test-fixture','shared-reset','test-fixture','test-fixture',?,?)`);
      const remove=db.prepare('DELETE FROM workflows WHERE workflow_id=?');
      const forget=db.prepare('DELETE FROM workflow_purges WHERE workflow_id=?');
      const at=Date.now();
      for(const {workflow_id} of workflows){
        authorize.run(workflow_id,at,at);
        remove.run(workflow_id);
        forget.run(workflow_id);
      }
      const remaining=db.prepare('SELECT (SELECT count(*) FROM workflows) workflows, (SELECT count(*) FROM jobs) jobs').get();
      if(remaining.workflows!==0||remaining.jobs!==0)throw Error(`shared ledger reset left ${remaining.workflows} workflows and ${remaining.jobs} jobs`);
    });
    const ledgerDir=path.dirname(ledgerFile);
    fs.rmSync(path.join(ledgerDir,'settle-parity'),{recursive:true,force:true});
    fs.rmSync(path.join(ledgerDir,'settle-tail'),{recursive:true,force:true});
  };

  return {
    repo,
    env,
    reset,
    seed:fn=>fn(ledger),
    read:fn=>fn(ledger.db),
    dispose(){
      ledger.close();
      fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});
    }
  };
}
