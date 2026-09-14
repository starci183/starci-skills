import {newToken} from './journal.mjs';

export const GLOBAL_AI_RESOURCE='ai/global';
const need=(ok,message)=>{if(!ok)throw Error(message);};
const activeStatuses="'leased','running'";

export function createAdmission({journal,now=Date.now,defaultAiCapacity=10}={}){
  need(journal?.transaction,'createAdmission needs a journal');
  const setCapacity=(resourceKey,capacity)=>journal.db.prepare('INSERT INTO resources(resource_key,capacity) VALUES(?,?) ON CONFLICT(resource_key) DO UPDATE SET capacity=excluded.capacity').run(resourceKey,capacity);
  setCapacity(GLOBAL_AI_RESOURCE,defaultAiCapacity);
  const returnBudgets=(db,jobId)=>{for(const row of db.prepare('SELECT scope_key,units FROM budget_reservations WHERE job_id=?').all(jobId))db.prepare('UPDATE budgets SET reserved_value=MAX(0,reserved_value-?) WHERE scope_key=?').run(row.units,row.scope_key);db.prepare('DELETE FROM budget_reservations WHERE job_id=?').run(jobId);};
  const expire=db=>{const at=now(),expired=db.prepare(`SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE l.expires_at<=? AND j.status IN (${activeStatuses})`).all(at).map(row=>row.job_id);for(const id of expired)db.prepare("UPDATE jobs SET status='effect_unknown',deadline=NULL,updated_at=? WHERE job_id=?").run(at,id);const settled=db.prepare(`SELECT DISTINCT l.job_id FROM leases l JOIN jobs j ON j.job_id=l.job_id WHERE j.status NOT IN (${activeStatuses},'effect_unknown')`).all().map(row=>row.job_id);for(const id of settled){returnBudgets(db,id);db.prepare('DELETE FROM leases WHERE job_id=?').run(id);}return expired;};
  return {
    setCapacity,
    setBudget(scopeKey,limit){journal.db.prepare('INSERT INTO budgets(scope_key,limit_value) VALUES(?,?) ON CONFLICT(scope_key) DO UPDATE SET limit_value=excluded.limit_value').run(scopeKey,limit);},
    reserve({jobId,workflowId,opId=null,attempt=1,generation,resources=[],ttlMs=60000,budgets=[]}){
      return journal.transaction(db=>{
        expire(db);
        const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
        need(job&&job.workflow_id===workflowId&&job.op_id===opId&&job.attempt===attempt&&job.generation===generation,'Reservation identity does not match the durable job');
        if(job.status!=='queued')return {ok:false,reasons:[`job is ${job.status}`]};
        const requested=new Map();for(const item of resources){need(item?.key&&Number.isInteger(item.units)&&item.units>0,'Invalid resource request');requested.set(item.key,(requested.get(item.key)??0)+item.units);}
        const reasons=[];
        for(const [key,units] of requested){const row=db.prepare('SELECT capacity FROM resources WHERE resource_key=?').get(key);if(!row)reasons.push(`resource ${key} has no declared capacity`);else{const used=db.prepare('SELECT COALESCE(SUM(units),0) AS used FROM leases WHERE resource_key=?').get(key).used;if(used+units>row.capacity)reasons.push(`resource ${key} capacity ${row.capacity} has ${used} used and needs ${units}`);}}
        for(const item of budgets){need(item?.key&&Number.isInteger(item.units)&&item.units>0,'Invalid budget request');const row=db.prepare('SELECT * FROM budgets WHERE scope_key=?').get(item.key);if(!row)reasons.push(`budget ${item.key} is undeclared`);else if(row.used_value+row.reserved_value+item.units>row.limit_value)reasons.push(`budget ${item.key} exhausted`);}
        if(reasons.length)return {ok:false,reasons};
        const token=newToken(),at=now(),expiresAt=at+ttlMs;
        for(const [key,units] of requested)db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(key,jobId,workflowId,opId,attempt,generation,token,units,at,expiresAt);
        for(const item of budgets){db.prepare('UPDATE budgets SET reserved_value=reserved_value+? WHERE scope_key=?').run(item.units,item.key);db.prepare('INSERT INTO budget_reservations(scope_key,job_id,units) VALUES(?,?,?)').run(item.key,jobId,item.units);}
        db.prepare("UPDATE jobs SET status='leased',lease_token=?,deadline=?,updated_at=? WHERE job_id=?").run(token,expiresAt,at,jobId);
        return {ok:true,leaseToken:token,expiresAt,fencing:Object.fromEntries([...requested].map(([key])=>[key,generation]))};
      });
    },
    assertFence({jobId,generation,leaseToken}){const row=journal.db.prepare('SELECT generation,lease_token,status,deadline FROM jobs WHERE job_id=?').get(jobId);return Boolean(row&&row.generation===generation&&row.lease_token===leaseToken&&['leased','running'].includes(row.status)&&row.deadline>now());},
    renew({jobId,generation,leaseToken,ttlMs=60000}){const deadline=now()+ttlMs;const result=journal.db.prepare(`UPDATE jobs SET deadline=?,updated_at=? WHERE job_id=? AND generation=? AND lease_token=? AND status IN (${activeStatuses})`).run(deadline,now(),jobId,generation,leaseToken);if(result.changes)journal.db.prepare('UPDATE leases SET expires_at=? WHERE job_id=? AND token=?').run(deadline,jobId,leaseToken);return result.changes===1?{ok:true,expiresAt:deadline}:{ok:false,reason:'stale fence'};},
    release({jobId,generation,leaseToken,consumeBudgets=false}){return journal.transaction(db=>{const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);if(!job||job.generation!==generation||job.lease_token!==leaseToken)return {ok:false,reason:'stale fence'};for(const row of db.prepare('SELECT scope_key,units FROM budget_reservations WHERE job_id=?').all(jobId))db.prepare(`UPDATE budgets SET reserved_value=MAX(0,reserved_value-?),used_value=used_value+? WHERE scope_key=?`).run(row.units,consumeBudgets?row.units:0,row.scope_key);db.prepare('DELETE FROM budget_reservations WHERE job_id=?').run(jobId);db.prepare('DELETE FROM leases WHERE job_id=? AND token=?').run(jobId,leaseToken);db.prepare("UPDATE jobs SET lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?").run(now(),jobId);return {ok:true};});},
    settleUnknown({jobId,generation,leaseToken,status='failed',result=null}){need(['failed','cancelled','effect_unknown'].includes(status),'Invalid reconciliation status');return journal.transaction(db=>{const job=db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);if(!job||job.generation!==generation||job.lease_token!==leaseToken||job.status!=='effect_unknown')return {ok:false,reason:'stale or unsettled fence'};returnBudgets(db,jobId);db.prepare('DELETE FROM leases WHERE job_id=? AND token=?').run(jobId,leaseToken);db.prepare('UPDATE jobs SET status=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?').run(status,JSON.stringify(result),now(),jobId);return {ok:true};});},
    expire(){return journal.transaction(db=>expire(db));}
  };
}
