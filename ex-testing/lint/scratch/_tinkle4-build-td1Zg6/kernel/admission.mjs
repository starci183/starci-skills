import * as ledgerDb from './ledger-db.mjs';
const {machineFileFor,openMachine,releaseTwoPhase,reserveTwoPhase}=ledgerDb;

export const GLOBAL_AI_RESOURCE='ai/global';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const activeStatuses="'leased','running'";
/** Cross-ledger needs: provider quota and machine-wide locks. Everything else is a repo-scoped ledger fence. */
const machineScoped=key=>String(key).startsWith('ai/')||String(key).startsWith('machine:');
/**
 * The ledger's own identity (docs §3/§5): a `meta.ledger_id` uuid, never a realpath digest — a renamed,
 * junctioned or UNC-reached checkout must keep its machine leases. Namespace import so this resolves the
 * real `ledgerDb.ledgerIdOf` the moment it's linked, never a digest computed here. A handle that isn't a
 * ledger-db one (the retired `journal.mjs`'s, still a valid `createAdmission` caller in its own tests) has
 * no `meta` table to query; that failure is caught and the identity is simply unknown (`null`), not fatal
 * - nothing in this module keys anything by `admission.ledgerId`, it is informational only.
 */
const ledgerIdOf=handle=>{
  if(typeof ledgerDb.ledgerIdOf==='function'){try{const id=ledgerDb.ledgerIdOf(handle);if(id)return id;}catch{}}
  return handle.ledgerId??null;
};
/**
 * `leases_match_job` makes lease-identity drift impossible to persist: where a post-hoc check used to find a
 * drifted row, the trigger now aborts the write. The abort is mapped back to the same named failure so the
 * caller's reconcile path is unchanged.
 */
const isLeaseDrift=error=>String(error?.message??'').includes('lease-identity-drift');
const driftGuard=fn=>{try{return fn();}catch(error){if(isLeaseDrift(error))return {ok:false,reason:'lease-identity-drift',reasons:['lease-identity-drift']};throw error;}};

/**
 * The ledger (`journal` handle) owns repo-scoped fences and one mirrored lease row per machine-scoped need;
 * the machine DB arbitrates `ai/*`/`machine:*` capacity across ledgers, its token recorded as `machine_ref`
 * on the paired ledger row. Reserve/release/settle all run through the two-phase helpers so a failure on
 * either side leaves nothing held. Budgets stay ledger-only: reserveTwoPhase/releaseTwoPhase know nothing of
 * them, so they are reserved/returned around the two-phase call, undone on any partial failure.
 */
export function createAdmission({journal,machine=null,machineFile=null,now=Date.now,defaultAiCapacity=10}={}){
  need(journal?.transaction,'createAdmission needs a journal');
  const ownsMachine=!machine;
  machine??=openMachine({file:machineFile??machineFileFor(),now});
  const ledgerId=ledgerIdOf(journal);
  const dbFor=key=>machineScoped(key)?machine.db:journal.db;
  const setCapacity=(resourceKey,capacity)=>dbFor(resourceKey).prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?) ON CONFLICT(resource_key) DO UPDATE SET capacity=excluded.capacity').run(resourceKey,capacity);
  setCapacity(GLOBAL_AI_RESOURCE,defaultAiCapacity);
  const returnBudgets=(db,jobId,{consume=false}={})=>{for(const row of db.prepare('SELECT scope_key,units FROM budget_reservations WHERE job_id=?').all(jobId))db.prepare('UPDATE budgets SET reserved_value=MAX(0,reserved_value-?),used_value=used_value+? WHERE scope_key=?').run(row.units,consume?row.units:0,row.scope_key);db.prepare('DELETE FROM budget_reservations WHERE job_id=?').run(jobId);};
  const splitResources=resources=>{
    const leases=[],machineNeeds=[];
    for(const item of resources){need(item?.key&&Number.isInteger(item.units)&&item.units>0,'Invalid resource request');(machineScoped(item.key)?machineNeeds:leases).push({resourceKey:item.key,units:item.units});}
    return {leases,machineNeeds};
  };
  const reserveBudgets=(jobId,budgets)=>{
    if(!budgets.length)return {ok:true};
    const reasons=[];
    journal.transaction(db=>{
      for(const item of budgets){need(item?.key&&Number.isInteger(item.units)&&item.units>0,'Invalid budget request');const row=db.prepare('SELECT * FROM budgets WHERE scope_key=?').get(item.key);if(!row)reasons.push(`budget ${item.key} is undeclared`);else if(row.used_value+row.reserved_value+item.units>row.limit_value)reasons.push(`budget ${item.key} exhausted`);}
      if(reasons.length)return;
      for(const item of budgets){db.prepare('UPDATE budgets SET reserved_value=reserved_value+? WHERE scope_key=?').run(item.units,item.key);db.prepare('INSERT INTO budget_reservations(scope_key,job_id,units) VALUES(?,?,?)').run(item.key,jobId,item.units);}
    });
    return reasons.length?{ok:false,reasons}:{ok:true};
  };
  const expire=db=>{
    const at=now(),expired=db.prepare(`SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE l.expires_at<=? AND j.status IN (${activeStatuses})`).all(at).map(row=>row.job_id);
    for(const id of expired)db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=?").run(at,id);
    const settled=db.prepare(`SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE j.status NOT IN (${activeStatuses},'effect_unknown')`).all().map(row=>row.job_id);
    const refs=[];for(const id of settled){refs.push(...db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(id).map(row=>row.machine_ref));returnBudgets(db,id);db.prepare('DELETE FROM leases WHERE job_id=?').run(id);}
    return {expired,refs};
  };
  /** Every reservation attempt first moves timed-out leases to effect_unknown so their capacity stays fenced. */
  const runExpire=()=>{const released=journal.transaction(db=>expire(db));for(const ref of released.refs){try{machine.release(ref);}catch{}}return released.expired;};
  return {
    machine,ledgerId,
    setCapacity,
    setBudget(scopeKey,limit){journal.db.prepare('INSERT INTO budgets(scope_key,limit_value) VALUES(?,?) ON CONFLICT(scope_key) DO UPDATE SET limit_value=excluded.limit_value').run(scopeKey,limit);},
    reserve({jobId,workflowId,opId=null,attempt=1,generation,resources=[],ttlMs=60000,budgets=[]}={}){
      return driftGuard(()=>{
        runExpire();
        const existing=journal.getJob(jobId);
        need(existing&&existing.workflow_id===workflowId&&existing.op_id===opId&&existing.attempt===attempt&&existing.generation===generation,'Reservation identity does not match the durable job');
        if(existing.status!=='queued')return {ok:false,reasons:[`job is ${existing.status}`]};
        const {leases,machineNeeds}=splitResources(resources);
        const result=reserveTwoPhase(journal,machine,{job:{jobId,workflowId,opId,attempt,generation,kind:existing.kind,role:existing.role,payload:existing.payload},leases,machineNeeds,ttlMs});
        // Repo-capacity failure already carries `reasons`; a machine-side (ai/*) reservation failure from
        // reserveTwoPhase only carries a singular `reason` (it stops at the first exhausted resource). Every
        // caller here treats `reasons` as the informative array, so normalize rather than let a machine
        // rejection fall back to a bare "waiting for job X" with the actual cause dropped.
        if(!result.ok)return {...result,reasons:result.reasons??(result.reason?[result.reason]:[])};
        const budgeted=reserveBudgets(jobId,budgets);
        if(!budgeted.ok){
          releaseTwoPhase(journal,machine,{jobId});
          journal.db.prepare("UPDATE jobs SET status='queued',updated_at=? WHERE job_id=?").run(now(),jobId);
          return budgeted;
        }
        return {ok:true,leaseToken:result.leaseToken,expiresAt:result.expiresAt,fencing:result.fencing};
      });
    },
    assertFence({jobId,generation,leaseToken}){const row=journal.db.prepare('SELECT generation,lease_token,status,deadline FROM jobs WHERE job_id=?').get(jobId);return Boolean(row&&row.generation===generation&&row.lease_token===leaseToken&&['leased','running'].includes(row.status)&&row.deadline>now());},
    renew({jobId,generation,leaseToken,ttlMs=60000}){
      const deadline=now()+ttlMs;
      const result=journal.db.prepare(`UPDATE jobs SET deadline=?,updated_at=? WHERE job_id=? AND generation=? AND lease_token=? AND status IN (${activeStatuses})`).run(deadline,now(),jobId,generation,leaseToken);
      if(result.changes){journal.db.prepare('UPDATE leases SET expires_at=? WHERE job_id=? AND token=?').run(deadline,jobId,leaseToken);for(const row of journal.db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND token=? AND machine_ref IS NOT NULL').all(jobId,leaseToken))machine.db.prepare('UPDATE leases SET expires_at=? WHERE token=?').run(deadline,row.machine_ref);}
      return result.changes===1?{ok:true,expiresAt:deadline}:{ok:false,reason:'stale fence'};
    },
    release({jobId,generation,leaseToken,consumeBudgets=false}){
      return driftGuard(()=>{
        const job=journal.getJob(jobId);
        if(!job||job.generation!==generation||job.lease_token!==leaseToken)return {ok:false,reason:'stale fence'};
        journal.transaction(db=>returnBudgets(db,jobId,{consume:consumeBudgets}));
        releaseTwoPhase(journal,machine,{jobId});
        return {ok:true};
      });
    },
    settleUnknown({jobId,generation,leaseToken,status='failed',result=null,event=null}){
      need(['failed','cancelled'].includes(status),'Reconciliation must resolve the unknown effect before releasing its fence');
      return driftGuard(()=>{
        const job=journal.getJob(jobId);
        if(!job||job.generation!==generation||job.lease_token!==leaseToken||job.status!=='effect_unknown')return {ok:false,reason:'stale or unsettled fence'};
        if(event)need(event.entityId===jobId&&event.workflowId===job.workflow_id&&event.generation===generation
          &&event.entityType==='job','Reconciliation event must bind the exact durable job');
        journal.transaction(db=>returnBudgets(db,jobId));
        releaseTwoPhase(journal,machine,{jobId,status,result});
        if(event)journal.appendEvent(event);
        return {ok:true};
      });
    },
    expire(){return runExpire();},
    close(){if(ownsMachine)machine.close();}
  };
}
