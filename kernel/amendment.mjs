import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {stateGoalIdentity} from './store.mjs';

export const WORKFLOW_AMENDMENT='starci/workflow-amendment@1';
const SETTLED=new Set(['done','skipped','cancelled']);
const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,label)=>{need(typeof value==='string'&&value.trim(),`Workflow amendment needs ${label}`);return value.trim();};
const list=(value,label,{required=false}={})=>{
  if(value===undefined&&!required)return [];
  need(Array.isArray(value)&&value.every(item=>typeof item==='string'&&item.trim()),`Workflow amendment ${label} must be an array of nonempty strings`);
  const normalized=value.map(item=>item.trim());
  need(new Set(normalized).size===normalized.length,`Workflow amendment ${label} must contain unique strings`);
  if(required)need(normalized.length,`Workflow amendment ${label} must not be empty`);
  return normalized;
};
const exactKeys=(value,allowed,label)=>{
  need(plain(value),`Workflow amendment needs ${label}`);
  const unknown=Object.keys(value).filter(key=>!allowed.includes(key));
  need(!unknown.length,`Workflow amendment ${label} has unsupported fields: ${unknown.join(', ')}`);
};
const stable=value=>Array.isArray(value)?value.map(stable):plain(value)?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value;
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
const unique=value=>[...new Set(value)];

function source(value,label){
  exactKeys(value,['threadId','messageId','messageIdAvailability','quote','assurance','at'],label);
  need(Object.hasOwn(value,'messageId'),`Workflow amendment needs ${label}.messageId (use null when the native id is not exposed)`);
  const normalized={threadId:text(value.threadId,`${label}.threadId`),messageId:value.messageId??null,
    messageIdAvailability:text(value.messageIdAvailability,`${label}.messageIdAvailability`),quote:text(value.quote,`${label}.quote`),
    assurance:text(value.assurance,`${label}.assurance`),at:text(value.at,`${label}.at`)};
  need(normalized.assurance==='conversation-context-not-authenticated',
    `Workflow amendment ${label}.assurance must be conversation-context-not-authenticated`);
  need(normalized.messageIdAvailability==='available'
    ?typeof normalized.messageId==='string'&&Boolean(normalized.messageId.trim())
    :normalized.messageIdAvailability==='not-exposed'&&normalized.messageId===null,
    `Workflow amendment ${label} needs an actual native messageId or explicit not-exposed/null provenance`);
  if(typeof normalized.messageId==='string')normalized.messageId=normalized.messageId.trim();
  need(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized.at)&&Number.isFinite(Date.parse(normalized.at)),
    `Workflow amendment ${label}.at must be an ISO date-time with a timezone`);
  return normalized;
}
const sourceKey=value=>`${value.threadId}:${value.messageIdAvailability==='available'?value.messageId:`not-exposed@${value.at}`}`;

/**
 * Read the bounded, explicit owner grant that overlays a frozen workflow goal. This record is not a replacement
 * goal and its digest is never called an approval digest: the original approved goal identity remains durable.
 */
export function readWorkflowAmendment(file){
  const resolved=path.resolve(text(file,'file'));
  const stat=fs.lstatSync(resolved);
  need(stat.isFile()&&!stat.isSymbolicLink(),'Workflow amendment must be a real file, not a symlink');
  need(stat.size<=256*1024,'Workflow amendment exceeds 256 KiB');
  const record=parseYaml(fs.readFileSync(resolved,'utf8'));
  exactKeys(record,['schema','workflowId','baseGoalIdentity','authority','coordinator','changes'],'record');
  need(record.schema===WORKFLOW_AMENDMENT,`Workflow amendment schema must be ${WORKFLOW_AMENDMENT}`);
  const workflowId=text(record.workflowId,'workflowId'),baseGoalIdentity=text(record.baseGoalIdentity,'baseGoalIdentity');
  exactKeys(record.authority,['actor','source','statement'],'authority');
  need(record.authority.actor==='owner','Workflow amendment authority.actor must be owner');
  const authority={actor:'owner',source:source(record.authority.source,'authority.source'),statement:text(record.authority.statement,'authority.statement')};
  exactKeys(record.coordinator,['actor','source','decision','rationale'],'coordinator');
  need(record.coordinator.actor==='coordinator','Workflow amendment coordinator.actor must be coordinator');
  need(record.coordinator.decision==='apply-same-id','Workflow amendment coordinator.decision must be apply-same-id');
  const coordinator={actor:'coordinator',source:source(record.coordinator.source,'coordinator.source'),decision:'apply-same-id',
    rationale:text(record.coordinator.rationale,'coordinator.rationale')};
  exactKeys(record.changes,['clarifications','addScope','addDefinitionOfDone','operationFindings','effectCeiling'],'changes');
  const clarifications=list(record.changes.clarifications,'changes.clarifications',{required:true});
  const addScope=list(record.changes.addScope,'changes.addScope');
  const addDefinitionOfDone=list(record.changes.addDefinitionOfDone,'changes.addDefinitionOfDone');
  const operationFindings=record.changes.operationFindings??{};
  need(plain(operationFindings),'Workflow amendment changes.operationFindings must be an object keyed by operation id');
  const findings=Object.fromEntries(Object.entries(operationFindings).map(([opId,items])=>[text(opId,'operation finding id'),list(items,`changes.operationFindings.${opId}`,{required:true})]));
  exactKeys(record.changes.effectCeiling,['paths','resources','external'],'changes.effectCeiling');
  const effectCeiling={paths:list(record.changes.effectCeiling.paths,'changes.effectCeiling.paths'),
    resources:list(record.changes.effectCeiling.resources,'changes.effectCeiling.resources'),
    external:list(record.changes.effectCeiling.external,'changes.effectCeiling.external')};
  need(!addScope.length||effectCeiling.paths.length,
    'Workflow amendment that adds scope must carry a nonempty changes.effectCeiling.paths owner grant');
  const normalized={schema:WORKFLOW_AMENDMENT,workflowId,baseGoalIdentity,authority,coordinator,
    changes:{clarifications,addScope,addDefinitionOfDone,operationFindings:findings,effectCeiling}};
  return {file:resolved,record:normalized,digest:digest(normalized)};
}

/** Apply one idempotent amendment without rewriting the approved goal, receipts, decisions or effect identities. */
export function applyWorkflowAmendment(store,state,file,{now=Date.now}={}){
  const parsed=readWorkflowAmendment(file),baseGoalIdentity=stateGoalIdentity(state);
  need(parsed.record.workflowId===state.id,`Amendment belongs to ${parsed.record.workflowId}, not workflow ${state.id}`);
  need(parsed.record.baseGoalIdentity===baseGoalIdentity,
    `Amendment base goal ${parsed.record.baseGoalIdentity} does not match frozen workflow goal ${baseGoalIdentity}`);
  state.amendments=Array.isArray(state.amendments)?state.amendments:[];
  const replay=state.amendments.find(item=>item.digest===parsed.digest);
  if(replay){
    if(!store.readEvents().some(event=>event.event==='workflow-amended'&&event.digest===replay.digest))
      store.appendEvent({event:'workflow-amended',digest:replay.digest,baseGoalIdentity:replay.baseGoalIdentity,recoveredProjection:true});
    return {ok:true,replayed:true,amendment:replay,file:parsed.file};
  }
  const reusedGrant=state.amendments.find(item=>item.authority?.source&&sourceKey(item.authority.source)===sourceKey(parsed.record.authority.source));
  need(!reusedGrant,
    `Owner grant ${sourceKey(parsed.record.authority.source)} is already bound to amendment ${reusedGrant?.digest}`);
  for(const opId of Object.keys(parsed.record.changes.operationFindings)){
    const op=(state.ops??[]).find(item=>item.id===opId);
    need(op,`Amendment finding names unknown operation ${opId}`);
    need(!SETTLED.has(op.status),`Amendment cannot reopen accepted or settled operation ${opId} (${op.status})`);
  }
  // Freeze the original derived identity before changing scope/criteria on old state shapes that did not persist it.
  if(!state.goalDigest)state.goalDigest=baseGoalIdentity;
  state.scope=unique([...(Array.isArray(state.scope)?state.scope:[]),...parsed.record.changes.addScope]);
  state.definitionOfDone=unique([...(Array.isArray(state.definitionOfDone)?state.definitionOfDone:[]),...parsed.record.changes.addDefinitionOfDone]);
  for(const [opId,items] of Object.entries(parsed.record.changes.operationFindings)){
    const op=state.ops.find(item=>item.id===opId);
    op.findings=unique([...(Array.isArray(op.findings)?op.findings:[]),...items]);
  }
  const amendment={schema:WORKFLOW_AMENDMENT,digest:parsed.digest,baseGoalIdentity,appliedAt:typeof now==='function'?now():now,
    authority:parsed.record.authority,coordinator:parsed.record.coordinator,changes:parsed.record.changes};
  state.amendments.push(amendment);
  // Save the durable snapshot first. If the append-only projection is interrupted, an identical replay repairs
  // the missing projection event without applying the amendment twice.
  store.saveState(state);
  store.appendEvent({event:'workflow-amended',digest:amendment.digest,baseGoalIdentity,
    ownerGrant:{threadId:amendment.authority.source.threadId,messageId:amendment.authority.source.messageId,
      messageIdAvailability:amendment.authority.source.messageIdAvailability,at:amendment.authority.source.at},
    coordinatorDecision:{threadId:amendment.coordinator.source.threadId,messageId:amendment.coordinator.source.messageId,
      messageIdAvailability:amendment.coordinator.source.messageIdAvailability,at:amendment.coordinator.source.at},
    addScope:amendment.changes.addScope,addDefinitionOfDone:amendment.changes.addDefinitionOfDone,
    operationFindings:Object.keys(amendment.changes.operationFindings),effectCeiling:amendment.changes.effectCeiling});
  return {ok:true,replayed:false,amendment,file:parsed.file};
}

/** Bounded contract context: authorization provenance and effect ceiling, never a claim of new goal approval. */
export function amendmentContractLines(state){
  const amendments=Array.isArray(state?.amendments)?state.amendments:[];
  if(!amendments.length)return [];
  const lines=['## Authorized same-workflow amendments',
    'These records clarify the frozen goal without replacing its original approval. Stay inside each owner-granted effect ceiling; accepted operations and historical evidence remain closed.'];
  for(const item of amendments){
    lines.push(`- Amendment \`${item.digest}\`, owner grant \`${sourceKey(item.authority.source)}\`, coordinator decision \`${sourceKey(item.coordinator.source)}\``);
    for(const clarification of item.changes.clarifications)lines.push(`  - clarification: ${clarification}`);
    lines.push(`  - paths: ${item.changes.effectCeiling.paths.join(', ')||'none'}`,
      `  - resources: ${item.changes.effectCeiling.resources.join(', ')||'none'}`,
      `  - external effects: ${item.changes.effectCeiling.external.join(', ')||'none'}`);
  }
  return [...lines,''];
}
