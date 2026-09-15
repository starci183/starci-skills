import crypto from 'node:crypto';
import {MANAGER_SNAPSHOT} from '../models/manager-contract.mjs';
export {MANAGER_SNAPSHOT,MANAGER_DECISION,validateManagerDecision} from '../models/manager-contract.mjs';
const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
export const managerDigest=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const text=value=>typeof value==='string'?value:'';
const brief=(value,max=180)=>text(value).slice(0,max);
const strings=(value,max=16)=>Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,max):[];
export const managerProgressDigest=state=>managerDigest({head:state.head??null,ops:state.ops.map(op=>[op.id,op.status,op.attempt??1,Boolean(op.needsReplan)]),
  ledger:(state.ledger??[]).map(item=>[item.id,item.status,(item.evidence??[]).map(receipt=>[receipt.opId,receipt.kind,receipt.head])])});

/** Build only bounded facts and executable action ids; no model-authored path or Work node enters this seam. */
export function buildManagerSnapshot({state,actions,blockers=[],contextCatalog=[],capacity={},noProgress={round:0,budget:2},limit=40}){
  const generation=state.engine?.generation??0;
  const active=state.ops.filter(op=>['pending','ready','running','answering','paused','blocked'].includes(op.status));
  const offered=new Set(actions.slice(0,limit).map(action=>action.opId));
  const projected=[...active.filter(op=>offered.has(op.id)),...active.filter(op=>!offered.has(op.id))];
  const ops=projected.slice(0,limit).map(op=>({
    id:op.id,kind:op.kind,status:op.status,attempt:op.attempt??1,dependsOn:strings(op.dependsOn),waitingFor:op.waitingFor??null,
    refusal:brief(op.refusal),hasLease:Boolean(op.lease),needsReplan:Boolean(op.needsReplan),ledgerIds:strings(op.ledgerIds),
    purpose:brief(op.goal,300),acceptance:strings(op.acceptance,3).map(item=>brief(item)),findingCount:(op.findings??[]).length,
    unlocks:active.filter(other=>(other.dependsOn??[]).includes(op.id)).length,
    dependencies:strings(op.dependsOn).map(id=>({id,status:state.ops.find(other=>other.id===id)?.status??'missing'})),
    proof:strings(op.ledgerIds,8).map(id=>{const item=state.ledger?.find(row=>row.id===id);return {id,status:item?.status??'unknown',
      receipts:(item?.evidence??[]).slice(-3).map(receipt=>({kind:receipt.kind,opId:receipt.opId,head:receipt.head}))};})}));
  const semantic={goal:{job:brief(state.job,4000),definitionOfDone:strings(state.definitionOfDone,24).map(item=>brief(item,400)),
      approved:state.approved===true,scope:strings(state.scope,32),head:state.head??null,goalDigest:state.goalDigest??state.approval?.goalDigest??null},
    progress:{iterations:state.iterations??0,actionable:actions.length,running:state.ops.filter(op=>['running','answering'].includes(op.status)).length,
      ready:state.ops.filter(op=>op.status==='ready').length,blocked:state.ops.filter(op=>op.status==='blocked').length,capacity,
      omittedOps:Math.max(0,active.length-limit),omittedActions:Math.max(0,actions.length-limit)},
    ops,blockers:blockers.slice(0,64),actions:actions.slice(0,limit).map(action=>({...action,preconditions:[...(action.preconditions??[])],contextRefIds:[...(action.contextRefIds??[])]})),contextCatalog:contextCatalog.slice(0,limit),noProgress};
  delete semantic.progress.iterations; // polling is not a semantic manager wake-up
  const basisDigest=managerDigest(semantic),prior=state.engine?.manager??{};
  const version=prior.basisDigest===basisDigest?(prior.version??1):(prior.version??0)+1;
  const base={schema:MANAGER_SNAPSHOT,workflowId:state.id,generation,version,...semantic};
  if(JSON.stringify(base).length>60000&&limit>1)return buildManagerSnapshot({state,actions,blockers,contextCatalog,capacity,noProgress,limit:Math.max(1,Math.floor(limit/2))});
  const digest=managerDigest(base),decisionId=`manager-${managerDigest({workflowId:state.id,generation,version,digest}).slice(0,24)}`;
  return {...base,digest,decisionId,basisDigest};
}
