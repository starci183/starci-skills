import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {parseYaml} from '../core/yaml.mjs';
import {PLAN_OP_KINDS} from '../models/functions.mjs';
import {toOp} from './common.mjs';
import {auditDefinitionErrors} from './audit.mjs';
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
const cleanPath=value=>String(value??'').replaceAll('\\','/').replace(/^\.\//,'').replace(/\/+$/,'');
/** Directional containment: the owner grant covers the requested path/glob, never the reverse. */
export function effectPathCovered(grant,requested){
  const allowed=cleanPath(grant),wanted=cleanPath(requested);if(!allowed||!wanted)return false;
  if(!allowed.includes('*'))return wanted===allowed||wanted.startsWith(`${allowed}/`);
  if(allowed.endsWith('/**')){const root=allowed.slice(0,-3).replace(/\/+$/,'');return wanted===root||wanted.startsWith(`${root}/`);}
  if(wanted.includes('*'))return wanted===allowed;
  const escaped=allowed.replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('**','\0').replaceAll('*','[^/]*').replaceAll('\0','.*');
  try{return new RegExp(`^${escaped}$`).test(wanted);}catch{return false;}
}
const effectBlock=(value,label)=>{
  exactKeys(value,['paths','resources','external'],label);
  return {paths:list(value.paths,`${label}.paths`),resources:list(value.resources,`${label}.resources`),external:list(value.external,`${label}.external`)};
};
const effectSubset=(given,ceiling)=>given.paths.every(item=>ceiling.paths.some(grant=>effectPathCovered(grant,item)))&&
  given.resources.every(item=>ceiling.resources.includes(item))&&given.external.every(item=>ceiling.external.includes(item));
const replacements=(value,label)=>{
  if(value===undefined)return [];
  need(Array.isArray(value),`Workflow amendment ${label} must be an array`);
  const seen=new Set();return value.map((item,index)=>{exactKeys(item,['from','to'],`${label}[${index}]`);const from=text(item.from,`${label}[${index}].from`),to=text(item.to,`${label}[${index}].to`);need(!seen.has(from),`Workflow amendment ${label} must replace each original criterion once`);seen.add(from);return {from,to};});
};
const operationPath=(value,label)=>{const item=text(value,label),normalized=item.replaceAll('\\','/');
  need(!path.isAbsolute(item)&&!normalized.split('/').includes('..'),`Workflow amendment ${label} must be a path relative to the worktree`);return normalized;};
const checks=(value,label)=>{need(Array.isArray(value)&&value.length,`Workflow amendment ${label} must be a nonempty array`);
  const seen=new Set();return value.map((item,index)=>{exactKeys(item,['name','command'],`${label}[${index}]`);
    const check={name:text(item.name,`${label}[${index}].name`),command:text(item.command,`${label}[${index}].command`)};
    need(!seen.has(check.name),`Workflow amendment ${label} must use unique check names`);seen.add(check.name);return check;});};
function addedOperation(value,index){
  const label=`changes.addOperations[${index}]`;
  exactKeys(value,['id','kind','operation','goal','ledgerIds','allowlist','references','checks','acceptance','dependsOn'],label);
  need(Object.hasOwn(value,'id'),`Workflow amendment needs ${label}.id`);
  const raw={id:text(value.id,`${label}.id`),kind:text(value.kind,`${label}.kind`),...(value.operation===undefined?{}:{operation:text(value.operation,`${label}.operation`)}),goal:text(value.goal,`${label}.goal`),
    ledgerIds:list(value.ledgerIds,`${label}.ledgerIds`,{required:true}),
    allowlist:list(value.allowlist,`${label}.allowlist`,{required:true}).map((item,pathIndex)=>operationPath(item,`${label}.allowlist[${pathIndex}]`)),
    references:list(value.references,`${label}.references`).map((item,pathIndex)=>operationPath(item,`${label}.references[${pathIndex}]`)),
    checks:checks(value.checks,`${label}.checks`),acceptance:list(value.acceptance,`${label}.acceptance`,{required:true}),
    dependsOn:list(value.dependsOn,`${label}.dependsOn`)};
  const op=toOp(raw,index);need(PLAN_OP_KINDS.includes(op.kind),
    `Workflow amendment operation ${op.id} has unsupported plan kind ${op.kind}; expected one of ${PLAN_OP_KINDS.join(', ')}`);
  const auditErrors=auditDefinitionErrors(op);need(!auditErrors.length,`Workflow amendment operation ${op.id} is invalid: ${auditErrors.join('; ')}`);
  return {id:op.id,kind:op.kind,...(op.operation?{operation:op.operation}:{}),goal:op.goal,ledgerIds:op.ledgerIds,allowlist:op.allowlist,references:op.references,
    checks:op.checks,acceptance:op.acceptance,dependsOn:op.dependsOn};
}
const addedOperations=value=>{if(value===undefined)return [];need(Array.isArray(value),'Workflow amendment changes.addOperations must be an array');
  const result=value.map(addedOperation);need(new Set(result.map(item=>item.id)).size===result.length,'Workflow amendment changes.addOperations must use unique exact ids');return result;};
const dependencyChanges=value=>{if(value===undefined)return {};need(plain(value),'Workflow amendment changes.operationDependencies must be an object keyed by exact operation id');
  return Object.fromEntries(Object.entries(value).map(([opId,dependencies])=>[text(opId,'operation dependency target'),list(dependencies,`changes.operationDependencies.${opId}`,{required:true})]));};

function source(value,label){
  exactKeys(value,['threadId','messageId','messageIdAvailability','quote','assurance','at'],label);
  need(Object.hasOwn(value,'messageId'),`Workflow amendment needs ${label}.messageId (use null when the native id is not exposed)`);
  need(Object.hasOwn(value,'at'),`Workflow amendment needs ${label}.at (use null when the native event time is not exposed)`);
  const normalized={threadId:text(value.threadId,`${label}.threadId`),messageId:value.messageId??null,
    messageIdAvailability:text(value.messageIdAvailability,`${label}.messageIdAvailability`),quote:text(value.quote,`${label}.quote`),
    assurance:text(value.assurance,`${label}.assurance`),at:value.at===null?null:text(value.at,`${label}.at`)};
  need(normalized.assurance==='conversation-context-not-authenticated',
    `Workflow amendment ${label}.assurance must be conversation-context-not-authenticated`);
  need(normalized.messageIdAvailability==='available'
    ?typeof normalized.messageId==='string'&&Boolean(normalized.messageId.trim())
    :normalized.messageIdAvailability==='not-exposed'&&normalized.messageId===null,
    `Workflow amendment ${label} needs an actual native messageId or explicit not-exposed/null provenance`);
  if(typeof normalized.messageId==='string')normalized.messageId=normalized.messageId.trim();
  need(normalized.at===null||(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized.at)&&Number.isFinite(Date.parse(normalized.at))),
    `Workflow amendment ${label}.at must be null or an ISO date-time with a timezone`);
  return normalized;
}
const sourceKey=value=>`${value.threadId}:${value.messageIdAvailability==='available'?value.messageId:`not-exposed:${digest({quote:value.quote,at:value.at})}`}`;
const DEPENDENCY_EDITABLE=new Set(['pending','ready','blocked']);
const liveIdentity=op=>['lease','dispatch','terminal','task','pending'].some(key=>op?.[key]!==undefined&&op[key]!==null)||op?.workerSettled===false;
function assertAcyclic(ops){
  const dependencies=new Map(ops.map(op=>[op.id,[...(op.dependsOn??[])]])),visiting=new Set(),visited=new Set();
  const walk=(id,trail=[])=>{if(visiting.has(id))throw Error(`Workflow amendment operation dependency cycle: ${[...trail,id].join(' -> ')}`);if(visited.has(id))return;
    visiting.add(id);for(const dependency of dependencies.get(id)??[])walk(dependency,[...trail,id]);visiting.delete(id);visited.add(id);};
  for(const id of dependencies.keys())walk(id);
}

function prepareOperationChanges(state,record,amendmentDigest){
  const existing=Array.isArray(state.ops)?state.ops:[],existingIds=new Set(existing.map(op=>op.id)),ledgerIds=new Set((state.ledger??[]).map(item=>item.id));
  const knownReferences=unique([...(state.inputs??[]).map(item=>item?.ref).filter(Boolean),...(state.ledger??[]).map(item=>item?.inputRef).filter(Boolean),
    ...existing.flatMap(op=>[...(op.references??[]),...(op.allowlist??[])]),...record.changes.effectCeiling.paths]);
  const added=record.changes.addOperations.map((raw,index)=>{
    need(!existingIds.has(raw.id),`Amendment added operation id already exists: ${raw.id}`);
    for(const ledgerId of raw.ledgerIds)need(ledgerIds.has(ledgerId),`Amendment operation ${raw.id} claims unknown ledger item ${ledgerId}`);
    for(const reference of raw.references)need([...raw.allowlist,...knownReferences].some(grant=>effectPathCovered(String(grant).split('#')[0],String(reference).split('#')[0])),
      `Amendment operation ${raw.id} names unknown reference ${reference}`);
    const op=toOp({...raw,origin:'amendment'},existing.length+index);op.amendment=amendmentDigest;
    op.preAmendmentAllowlist=[];op.preAmendmentResources=[];op.preAmendmentExternal=[];
    op.amendmentEffects=[{amendment:amendmentDigest,paths:[...op.allowlist],resources:[],external:[]}];
    return op;
  });
  const all=[...existing,...added],byId=new Map(all.map(op=>[op.id,op]));
  need(byId.size===all.length,'Amendment operation ids are not unique in the workflow');
  for(const op of added)for(const dependency of op.dependsOn){need(byId.has(dependency),`Amendment operation ${op.id} depends on unknown operation ${dependency}`);
    need(dependency!==op.id,`Amendment operation ${op.id} cannot depend on itself`);}
  const prospective=new Map(all.map(op=>[op.id,[...(op.dependsOn??[])]]));
  for(const [opId,dependencies] of Object.entries(record.changes.operationDependencies)){
    const op=byId.get(opId);need(op,`Amendment dependency change names unknown operation ${opId}`);
    if(existingIds.has(opId))need(DEPENDENCY_EDITABLE.has(op.status)&&!liveIdentity(op),
      `Amendment cannot edit dependencies of accepted or live operation ${opId} (${op.status})`);
    for(const dependency of dependencies){need(byId.has(dependency),`Amendment operation ${opId} depends on unknown operation ${dependency}`);
      need(dependency!==opId,`Amendment operation ${opId} cannot depend on itself`);}
    prospective.set(opId,unique([...prospective.get(opId),...dependencies]));
  }
  assertAcyclic(all.map(op=>({id:op.id,dependsOn:prospective.get(op.id)})));
  for(const [opId] of Object.entries(record.changes.operationEffects))need(!added.some(op=>op.id===opId),
    `Amendment effects for added operation ${opId} must be declared by its addOperations.allowlist`);
  return {added,prospective,existingIds};
}

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
  exactKeys(record.changes,['clarifications','addScope','scopeBindings','addDefinitionOfDone','supersedeDefinitionOfDone','operationFindings','operationEffects','addOperations','operationDependencies','effectCeiling'],'changes');
  const clarifications=list(record.changes.clarifications,'changes.clarifications',{required:true});
  const addScope=list(record.changes.addScope,'changes.addScope');
  const addDefinitionOfDone=list(record.changes.addDefinitionOfDone,'changes.addDefinitionOfDone');
  const supersedeDefinitionOfDone=replacements(record.changes.supersedeDefinitionOfDone,'changes.supersedeDefinitionOfDone');
  const operationFindings=record.changes.operationFindings??{};
  need(plain(operationFindings),'Workflow amendment changes.operationFindings must be an object keyed by operation id');
  const findings=Object.fromEntries(Object.entries(operationFindings).map(([opId,items])=>[text(opId,'operation finding id'),list(items,`changes.operationFindings.${opId}`,{required:true})]));
  const effectCeiling=effectBlock(record.changes.effectCeiling,'changes.effectCeiling');
  const scopeBindings=record.changes.scopeBindings??{};
  need(plain(scopeBindings),'Workflow amendment changes.scopeBindings must be an object keyed by added scope');
  const boundScopes=Object.fromEntries(Object.entries(scopeBindings).map(([scope,paths])=>[text(scope,'scope binding'),list(paths,`changes.scopeBindings.${scope}`,{required:true})]));
  need(Object.keys(boundScopes).every(scope=>addScope.includes(scope))&&addScope.every(scope=>Object.hasOwn(boundScopes,scope)),
    'Workflow amendment changes.scopeBindings must bind every and only changes.addScope entry');
  for(const [scope,paths] of Object.entries(boundScopes))need(paths.every(item=>effectCeiling.paths.some(grant=>effectPathCovered(grant,item))),
    `Workflow amendment scope ${scope} exceeds changes.effectCeiling.paths`);
  const operationEffects=record.changes.operationEffects??{};
  need(plain(operationEffects),'Workflow amendment changes.operationEffects must be an object keyed by operation id');
  const effects=Object.fromEntries(Object.entries(operationEffects).map(([opId,value])=>[text(opId,'operation effect id'),effectBlock(value,`changes.operationEffects.${opId}`)]));
  for(const [opId,value] of Object.entries(effects))need(effectSubset(value,effectCeiling),`Workflow amendment operation ${opId} exceeds changes.effectCeiling`);
  const addOperations=addedOperations(record.changes.addOperations),operationDependencies=dependencyChanges(record.changes.operationDependencies);
  for(const op of addOperations)need(op.allowlist.every(item=>effectCeiling.paths.some(grant=>effectPathCovered(grant,item))),
    `Workflow amendment added operation ${op.id} exceeds changes.effectCeiling.paths`);
  need(!addScope.length||effectCeiling.paths.length,
    'Workflow amendment that adds scope must carry a nonempty changes.effectCeiling.paths owner grant');
  const normalized={schema:WORKFLOW_AMENDMENT,workflowId,baseGoalIdentity,authority,coordinator,
    changes:{clarifications,addScope,scopeBindings:boundScopes,addDefinitionOfDone,supersedeDefinitionOfDone,operationFindings:findings,operationEffects:effects,
      addOperations,operationDependencies,effectCeiling}};
  return {file:resolved,record:normalized,digest:digest(normalized)};
}

/** Apply one idempotent amendment without rewriting the approved goal, receipts, decisions or effect identities. */
export function applyWorkflowAmendment(store,state,file,{now=Date.now}={}){
  const parsed=readWorkflowAmendment(file),baseGoalIdentity=stateGoalIdentity(state);
  need(parsed.record.workflowId===state.id,`Amendment belongs to ${parsed.record.workflowId}, not workflow ${state.id}`);
  need(parsed.record.baseGoalIdentity===baseGoalIdentity,
    `Amendment base goal ${parsed.record.baseGoalIdentity} does not match frozen workflow goal ${baseGoalIdentity}`);
  const amendments=Array.isArray(state.amendments)?state.amendments:[];
  const replay=amendments.find(item=>item.digest===parsed.digest);
  if(replay){
    if(!store.readEvents().some(event=>event.event==='workflow-amended'&&event.digest===replay.digest))
      store.appendEvent({event:'workflow-amended',digest:replay.digest,baseGoalIdentity:replay.baseGoalIdentity,recoveredProjection:true});
    return {ok:true,replayed:true,amendment:replay,file:parsed.file};
  }
  const reusedGrant=amendments.find(item=>item.authority?.source&&sourceKey(item.authority.source)===sourceKey(parsed.record.authority.source));
  need(!reusedGrant,
    `Owner grant ${sourceKey(parsed.record.authority.source)} is already bound to amendment ${reusedGrant?.digest}`);
  const prepared=prepareOperationChanges(state,parsed.record,parsed.digest),targets=new Map([...(state.ops??[]),...prepared.added].map(op=>[op.id,op]));
  for(const opId of unique([...Object.keys(parsed.record.changes.operationFindings),...Object.keys(parsed.record.changes.operationEffects)])){
    const op=targets.get(opId);
    need(op,`Amendment finding names unknown operation ${opId}`);
    need(!SETTLED.has(op.status),`Amendment cannot reopen accepted or settled operation ${opId} (${op.status})`);
  }
  const priorDefinition=[...(Array.isArray(state.definitionOfDone)?state.definitionOfDone:[])];
  for(const replacement of parsed.record.changes.supersedeDefinitionOfDone)
    need(priorDefinition.filter(item=>item===replacement.from).length===1,`Amendment criterion to supersede is not exactly active once: ${replacement.from}`);
  // Every check above is read-only. State mutation starts only after the complete operation/dependency graph,
  // owner ceiling, criteria and target set have passed together.
  // Freeze the original derived identity before changing scope/criteria on old state shapes that did not persist it.
  if(!state.goalDigest)state.goalDigest=baseGoalIdentity;
  state.amendments=amendments;
  state.scope=unique([...(Array.isArray(state.scope)?state.scope:[]),...parsed.record.changes.addScope]);
  if(parsed.record.changes.supersedeDefinitionOfDone.length){state.definitionOfDoneHistory=Array.isArray(state.definitionOfDoneHistory)?state.definitionOfDoneHistory:[];
    state.definitionOfDoneHistory.push({amendment:parsed.digest,criteria:priorDefinition,replacements:parsed.record.changes.supersedeDefinitionOfDone});}
  const replacementMap=new Map(parsed.record.changes.supersedeDefinitionOfDone.map(item=>[item.from,item.to]));
  state.definitionOfDone=unique([...priorDefinition.map(item=>replacementMap.get(item)??item),...parsed.record.changes.addDefinitionOfDone]);
  state.ops.push(...prepared.added);
  for(const [opId,dependencies] of Object.entries(parsed.record.changes.operationDependencies)){
    const op=state.ops.find(item=>item.id===opId);
    if(prepared.existingIds.has(opId)){
      if(!Array.isArray(op.preAmendmentDependsOn))op.preAmendmentDependsOn=[...(op.dependsOn??[])];
      op.dependencyAmendments=[...(op.dependencyAmendments??[]),{amendment:parsed.digest,added:[...dependencies]}];
    }
    op.dependsOn=[...prepared.prospective.get(opId)];
  }
  for(const [opId,items] of Object.entries(parsed.record.changes.operationFindings)){
    const op=state.ops.find(item=>item.id===opId);
    op.findings=unique([...(Array.isArray(op.findings)?op.findings:[]),...items]);
  }
  for(const [opId,effects] of Object.entries(parsed.record.changes.operationEffects)){
    const op=state.ops.find(item=>item.id===opId);
    if(!Array.isArray(op.preAmendmentAllowlist))op.preAmendmentAllowlist=[...(Array.isArray(op.allowlist)?op.allowlist:[])];
    if(!Array.isArray(op.preAmendmentResources))op.preAmendmentResources=[...(Array.isArray(op.resources)?op.resources:[])];
    if(!Array.isArray(op.preAmendmentExternal))op.preAmendmentExternal=[...(Array.isArray(op.externalEffects)?op.externalEffects:[])];
    op.allowlist=unique([...(Array.isArray(op.allowlist)?op.allowlist:op.preAmendmentAllowlist),...effects.paths]);
    op.resources=unique([...(Array.isArray(op.resources)?op.resources:op.preAmendmentResources),...effects.resources]);
    op.externalEffects=unique([...(Array.isArray(op.externalEffects)?op.externalEffects:op.preAmendmentExternal),...effects.external]);
    op.amendmentEffects=[...(Array.isArray(op.amendmentEffects)?op.amendmentEffects:[]),{amendment:parsed.digest,...effects}];
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
    addScope:amendment.changes.addScope,scopeBindings:amendment.changes.scopeBindings,addDefinitionOfDone:amendment.changes.addDefinitionOfDone,
    supersedeDefinitionOfDone:amendment.changes.supersedeDefinitionOfDone,
    operationFindings:Object.keys(amendment.changes.operationFindings),addOperations:amendment.changes.addOperations.map(op=>op.id),
    operationDependencies:Object.keys(amendment.changes.operationDependencies),effectCeiling:amendment.changes.effectCeiling});
  return {ok:true,replayed:false,amendment,file:parsed.file};
}

/** Bounded contract context: authorization provenance and effect ceiling, never a claim of new goal approval. */
export function amendmentContractLines(state,op=null){
  const amendments=Array.isArray(state?.amendments)?state.amendments:[];
  if(!amendments.length)return [];
  const lines=['## Authorized same-workflow amendments',
    'These records clarify the frozen goal without replacing its original approval. Stay inside each owner-granted effect ceiling; accepted operations and historical evidence remain closed.'];
  for(const item of amendments){
    lines.push(`- Amendment \`${item.digest}\`, owner grant \`${sourceKey(item.authority.source)}\`, coordinator decision \`${sourceKey(item.coordinator.source)}\``);
    for(const clarification of item.changes.clarifications)lines.push(`  - clarification: ${clarification}`);
    for(const replacement of item.changes.supersedeDefinitionOfDone??[])lines.push(`  - superseded historical criterion: ${replacement.from}`,`    effective criterion: ${replacement.to}`);
    const added=(item.changes.addOperations??[]).find(candidate=>candidate.id===op?.id);
    if(added)lines.push(`  - this operation was added by the amendment as ${added.kind}${added.operation?` in read-only ${added.operation} measurement mode`:''}; its exact ledger ids are ${added.ledgerIds.join(', ')}`);
    const dependencies=item.changes.operationDependencies?.[op?.id]??[];
    if(dependencies.length)lines.push(`  - this operation's added dependencies: ${dependencies.join(', ')}`);
    lines.push(`  - paths: ${item.changes.effectCeiling.paths.join(', ')||'none'}`,
      `  - resources: ${item.changes.effectCeiling.resources.join(', ')||'none'}`,
      `  - external effects: ${item.changes.effectCeiling.external.join(', ')||'none'}`);
    const assigned=op?.amendmentEffects?.find(effect=>effect.amendment===item.digest);
    if(assigned)lines.push(`  - this operation's added paths: ${assigned.paths.join(', ')||'none'}`,
      `  - this operation's added resources: ${assigned.resources.join(', ')||'none'}`,
      `  - this operation's added external effects: ${assigned.external.join(', ')||'none'}`);
  }
  return [...lines,''];
}

/** Bind a newly planned Work op to the scope-to-path mapping that admitted its node. */
export function bindPlannedAmendmentEffects(state,op,node={}){
  const nodePath=cleanPath(node.path??op.references?.[0]??'').replace(/^\.starciwork\//,''),nodeId=String(node.id??op.nodeId??'');
  for(const amendment of state.amendments??[]){
    const entries=Object.entries(amendment.changes?.scopeBindings??{}).filter(([scope])=>{
      const wanted=cleanPath(scope).replace(/^\.starciwork\//,'');return wanted===nodeId||nodePath===wanted||nodePath.startsWith(`${wanted}/`)||wanted.startsWith(`${nodePath}/`);
    });
    if(!entries.length)continue;
    const granted=unique(entries.flatMap(([,paths])=>paths));
    const workPaths=(op.allowlist??[]).filter(item=>cleanPath(item).startsWith('.starciwork/'));
    need(workPaths.every(item=>granted.some(grant=>effectPathCovered(grant,item))),`Planned operation ${op.id} exceeds the added-scope Work path binding`);
    op.scopeAmendments=unique([...(op.scopeAmendments??[]),amendment.digest]);
  }
  return op;
}

/** Dispatch/verification fence for only the authority added by amendments; original op authority remains intact. */
export function operationAmendmentVerdict(state,op,{files=[],resources=null,external=null}={}){
  const reasons=[];
  for(const effect of op.amendmentEffects??[]){
    const amendment=(state.amendments??[]).find(item=>item.digest===effect.amendment),ceiling=amendment?.changes?.effectCeiling;
    if(!ceiling||!effectSubset(effect,ceiling)){reasons.push(`amendment ${effect.amendment} effect assignment exceeds or lacks its owner ceiling`);continue;}
    for(const path of effect.paths)if(!(op.allowlist??[]).includes(path))reasons.push(`amendment path ${path} is absent from the effective operation allowlist`);
    for(const resource of effect.resources)if(!(op.resources??[]).includes(resource))reasons.push(`amendment resource ${resource} is absent from the effective operation resources`);
    for(const item of effect.external)if(!(op.externalEffects??[]).includes(item))reasons.push(`amendment external effect ${item} is absent from the effective operation declaration`);
    if(Array.isArray(resources))for(const resource of effect.resources)if(!resources.includes(resource))reasons.push(`amendment resource ${resource} is not bound by the dispatch resource guard`);
    if(Array.isArray(external))for(const item of effect.external)if(!external.includes(item))reasons.push(`amendment external effect ${item} is not bound by the dispatch declaration`);
  }
  const original=op.preAmendmentAllowlist??op.allowlist??[],added=(op.amendmentEffects??[]).flatMap(item=>item.paths);
  for(const file of files)if(!original.some(grant=>effectPathCovered(grant,file))&&!added.some(grant=>effectPathCovered(grant,file)))reasons.push(`changed path ${file} is outside original and amended operation authority`);
  return {ok:reasons.length===0,reasons};
}
