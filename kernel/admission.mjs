import crypto from 'node:crypto';
import fs from 'node:fs';
import {machineFileFor,machineScoped,openMachine,releaseTwoPhase,reserveTwoPhase} from './ledger-db.mjs';

export const GLOBAL_AI_RESOURCE='ai/global';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const activeStatuses="'leased','running'";
/** sha256 of the ledger file's realpath, 16 hex - the `ledgers` row the machine arbiter knows it by. */
const ledgerIdOf=journal=>journal.ledgerId??crypto.createHash('sha256').update(fs.realpathSync(journal.path??journal.file)).digest('hex').slice(0,16);
/**
 * `leases_match_job` makes lease-identity drift impossible to persist: where a post-hoc check used to find a
 * drifted row, the trigger now aborts the write. The abort is mapped back to the same named failure so the
 * caller's reconcile path is unchanged.
 */
const isLeaseDrift=error=>String(error?.message??'').includes('lease-identity-drift');
const driftGuard=fn=>{try{return fn();}catch(error){if(isLeaseDrift(error))return {ok:false,reason:'lease-identity-drift',reasons:['lease-identity-drift']};throw error;}};

/**
 * The ledger (`journal` handle) owns repo-scoped fences and one mirrored lease row per machine-scoped need;
 * the machine DB arbitrates `ai/*` and `machine:*` capacity across ledgers, its token recorded as
 * `machine_ref` on the paired ledger row. Reserve/release/settle all run through the two-phase helpers so a
 * failure on either side leaves nothing held.
 */
export function createAdmission({journal,machine=null,machineFile=null,now=Date.now,defaultAiCapacity=10}={}){
  need(journal?.transaction,'createAdmission needs a journal');
  const ownsMachine=!machine;
  machine??=openMachine({file:machineFile??machineFileFor(),now});
  const ledgerId=ledgerIdOf(journal);
  const dbFor=key=>machineScoped(key)?machine.db:journal.db;
  const setCapacity=(resourceKey,capacity)=>dbFor(resourceKey).prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?) ON CONFLICT(resource_key) DO UPDATE SET capacity=excluded.capacity').run(resourceKey,capacity);
  setCapacity(GLOBAL_AI_RESOURCE,defaultAiCapacity);
  const releaseRefs=refs=>{for(const ref of refs){try{machine.release(ref);}catch{}}};
  const returnBudgets=(db,jobId)=>{for(const row of db.prepare('SELECT scope_key,units FROM budget_reservations WHERE job_id=?').all(jobId))db.prepare('UPDATE budgets SET reserved_value=MAX(0,reserved_value-?) WHERE scope_key=?').run(row.units,row.scope_key);db.prepare('DELETE FROM budget_reservations WHERE job_id=?').run(jobId);};
  const expire=db=>{const at=now(),expired=db.prepare(`SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE l.expires_at<=? AND j.status IN (${activeStatuses})`).all(at).map(row=>row.job_id);for(const id of expired)db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=?").run(at,id);const settled=db.prepare(`SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE j.status NOT IN (${activeStatuses},'effect_unknown')`).all().map(row=>row.job_id);const refs=[];for(const id of settled){refs.push(...db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(id).map(row=>row.machine_ref));returnBudgets(db,id);db.prepare('DELETE FROM leases WHERE job_id=?').run(id);}return {expired,refs,settled};};
  return {
    machine,ledgerId,
    setCapacity,
    setBudget(scopeKey,limit){machine.db.prepare('INSERT INTO budgets(scope_key,limit_value) VALUES(?,?) ON CONFLICT(scope_key) DO UPDATE SET limit_value=excluded.limit_value').run(scopeKey,limit);},
    reserve(spec){return driftGuard(()=>reserveTwoPhase({ledger:journal,machine,ledgerId,now,...spec}));},
    assertFence({jobId,generation,leaseToken}){const row=journal.db.prepare('SELECT generation,lease_token,status,deadline FROM jobs WHERE job_id=?').get(jobId);return Boolean(row&&row.generation===generation&&row.lease_token===leaseToken&&['leased','running'].includes(row.status)&&row.deadline>now());},
    renew({jobId,generation,leaseToken,ttlMs=60000}){const deadline=now()+ttlMs;const result=journal.db.prepare(`UPDATE jobs SET deadline=?,updated_at=? WHERE job_id=? AND generation=? AND lease_token=? AND status IN (${activeStatuses})`).run(deadline,now(),jobId,generation,leaseToken);if(result.changes){journal.db.prepare('UPDATE leases SET expires_at=? WHERE job_id=? AND token=?').run(deadline,jobId,leaseToken);for(const row of journal.db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND token=? AND machine_ref IS NOT NULL').all(jobId,leaseToken))machine.db.prepare('UPDATE leases SET expires_at=? WHERE token=?').run(deadline,row.machine_ref);}return result.changes===1?{ok:true,expiresAt:deadline}:{ok:false,reason:'stale fence'};},
    release({jobId,generation,leaseToken,consumeBudgets=false}){return driftGuard(()=>releaseTwoPhase({ledger:journal,machine,ledgerId,jobId,generation,leaseToken,consumeBudgets,now}));},
    settleUnknown({jobId,generation,leaseToken,status='failed',result=null,event=null}){
      need(['failed','cancelled'].includes(status),'Reconciliation must resolve the unknown effect before releasing its fence');
      return driftGuard(()=>{
        const job=journal.getJob(jobId);
        if(!job||job.status!=='effect_unknown')return {ok:false,reason:'stale or unsettled fence'};
        if(event)need(event.entityId===jobId&&event.workflowId===job.workflow_id&&event.generation===generation
          &&event.entityType==='job','Reconciliation event must bind the exact durable job');
        return releaseTwoPhase({ledger:journal,machine,ledgerId,jobId,generation,leaseToken,now,
          settle:{status,result,event,requireStatus:'effect_unknown'}});
      });
    },
    expire(){const released=journal.transaction(db=>expire(db));releaseRefs(released.refs);for(const id of released.settled){try{machine.releaseJob?.({ledgerId,jobId:id});}catch{}}return released.expired;},
    close(){if(ownsMachine)machine.close();}
  };
}
