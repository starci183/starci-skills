import {readDistJson} from '../core/runtime-root.mjs';

export const SDS_MAP_CONTRACT=readDistJson('specifications','sds-map.json');
export const SDS_AGGREGATE_SCHEMA=SDS_MAP_CONTRACT.aggregateSchema;
export const SDS_MAP_SCHEMAS=Object.freeze(Object.fromEntries([SDS_MAP_CONTRACT.overview,...Object.values(SDS_MAP_CONTRACT.sections)].map(section=>[section.type,section.schema])));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const texts=(value,{empty=false}={})=>Array.isArray(value)&&(empty||value.length>0)&&value.every(text)&&new Set(value).size===value.length;
const hasImplementationProvenance=value=>{
 if(Array.isArray(value))return value.some(hasImplementationProvenance);
 if(!object(value))return false;
 if(Object.keys(value).some(key=>['sourceRefs','codeRefs','revision','commit','existence','implementationStatus'].includes(key)))return true;
 return Object.values(value).some(hasImplementationProvenance);
};

export function classifySDSPath(relative,hasChildren=false){
 const parts=relative.replaceAll('\\','/').split('/'),architecture=parts.lastIndexOf('architecture'),sds=architecture>=0?parts.indexOf('sds',architecture+1):-1;
 if(architecture>=0&&parts.slice(architecture+1).join('/')==='overview/index.yaml')return {aggregate:false,type:SDS_MAP_CONTRACT.overview.type,category:'overview',expectedSchema:SDS_MAP_CONTRACT.overview.schema};
 if(sds<0||parts.at(-1)!=='index.yaml')return null;
 const tail=parts.slice(sds+1,-1);if(!tail.length)return {aggregate:true,section:'sds',expectedSchema:SDS_AGGREGATE_SCHEMA};
 const category=tail[0],contract=SDS_MAP_CONTRACT.sections[category];if(!contract)return {aggregate:false,type:null,category,expectedSchema:null};
 if(tail.length===1||hasChildren)return {aggregate:true,section:category,expectedSchema:SDS_AGGREGATE_SCHEMA};
 return {aggregate:false,type:contract.type,category,expectedSchema:contract.schema};
}

function local(payload,type){
 const errors=[],fail=message=>errors.push(message),section=[SDS_MAP_CONTRACT.overview,...Object.values(SDS_MAP_CONTRACT.sections)].find(item=>item.type===type);
 if(!object(payload)){fail('Typed SDS payload is required.');return errors;}
 if(payload.schema!==section?.schema)fail(`Expected ${section?.schema}.`);
 if(hasImplementationProvenance(payload))fail('SDS is independent of source code; source observations, revisions and implementation proof belong to Implementation.');
 for(const key of section?.required??[])if(!Object.hasOwn(payload,key))fail(`Missing ${key}.`);
 if(!text(payload.id)||!text(payload.title))fail('Stable id and title are required.');
 if(payload.status!==undefined&&!['draft','ready','blocked','accepted','proposed'].includes(payload.status))fail('Unsupported SDS status.');
 if(type==='overview'){
  for(const key of ['businessRefs','designGoals','actors','systemContext','qualityStrategy','constraints','topologyRefs','implementationHandoff'])if(!texts(payload[key]))fail(`${key} must be a non-empty unique text array.`);
  if(!object(payload.scope)||!texts(payload.scope.in)||!texts(payload.scope.out)||!Array.isArray(payload.decisions)||!payload.decisions.length)fail('Overview needs explicit in/out scope and design decisions.');
  if(Array.isArray(payload.decisions))for(const decision of payload.decisions)if(!object(decision)||!text(decision.concern)||!['retain','extend','correct','replace','add'].includes(decision.disposition)||!text(decision.rationale)||!text(decision.impact)||!text(decision.migration))fail('Each overview decision needs concern, retain/extend/correct/replace/add disposition, rationale, impact and migration.');
 }
 if(type==='flow'){
  if(!Array.isArray(payload.businessRefs)||!payload.businessRefs.length||!object(payload.entryPoint)||!text(payload.entryPoint.channel)||!text(payload.entryPoint.trigger)||!text(payload.entryPoint.codeUnitRef)||!texts(payload.preconditions,{empty:true})||!Array.isArray(payload.inputs)||!texts(payload.participants))fail('SDS flow needs Business refs, an exact entry point, preconditions, inputs and participants.');
  const alternatives=payload.alternativeSequences,exceptions=payload.exceptionSequences,sequences=[payload.mainSequence,...(Array.isArray(alternatives)?alternatives:[]),...(Array.isArray(exceptions)?exceptions:[])];
  if(!object(payload.mainSequence)||!Array.isArray(payload.mainSequence.steps)||!payload.mainSequence.steps.length||!Array.isArray(alternatives)||!Array.isArray(exceptions))fail('SDS flow needs main, alternative and exception sequences.');
  if(Array.isArray(alternatives)&&!alternatives.length&&!text(payload.branchReview?.alternatives))fail('Explain why no alternative code path applies.');
  if(Array.isArray(exceptions)&&!exceptions.length&&!text(payload.branchReview?.exceptions))fail('Explain why no exception code path applies.');
  const mainSteps=new Set(payload.mainSequence?.steps?.map(step=>step.id)??[]),allSteps=new Set();
  for(const sequence of sequences){if(!object(sequence)||!text(sequence.id)||!Array.isArray(sequence.steps)||!sequence.steps.length){fail('Every SDS sequence needs an id and ordered steps.');continue;}for(const step of sequence.steps){if(!object(step)||!text(step.id)||allSteps.has(step.id)||!text(step.codeUnitRef)||!text(step.operation)||!text(step.input)||!text(step.output)||!texts(step.contractRefs,{empty:true})||!texts(step.dataRefs,{empty:true})||!text(step.transaction)||!texts(step.failureRefs,{empty:true}))fail(`${sequence.id} contains an incomplete or duplicate code step.`);else allSteps.add(step.id);}}
  for(const branch of [...(alternatives??[]),...(exceptions??[])])if(!mainSteps.has(branch.fromStep)||!text(branch.condition)||!text(branch.resumeAt)||!text(branch.outcome))fail(`${branch?.id??'SDS branch'} needs a valid fork, condition, resume/end and outcome.`);
  if(!object(payload.recovery)||!text(payload.recovery.owner)||!text(payload.recovery.stateSource)||!text(payload.recovery.retryIdentity)||!text(payload.recovery.resumeCondition))fail('SDS flow needs an owned recovery procedure.');
  if(!object(payload.postconditions)||!texts(payload.postconditions.success)||!texts(payload.postconditions.failure))fail('SDS flow needs success and failure postconditions.');
  if(!object(payload.resultMapping)||!text(payload.resultMapping.response)||!text(payload.resultMapping.appState)||!text(payload.resultMapping.lateResult))fail('SDS flow must map response, app state and late results.');
 }
 if(type==='code-unit'){
  if(!['frontend','backend','shared'].includes(payload.side)||!text(payload.repositoryRole)||!text(payload.path)||!Array.isArray(payload.symbols)||!payload.symbols.length)fail('Code unit needs side, repository role, target path and symbols.');
  for(const symbol of payload.symbols??[])if(!object(symbol)||!text(symbol.name)||!text(symbol.kind)||!text(symbol.signature)||!text(symbol.responsibility))fail('Each code symbol needs name, kind, signature and responsibility.');
  for(const key of ['callers','callees','contractRefs','dataRefs','qualityRefs','verificationRefs'])if(!texts(payload[key],{empty:true}))fail(`${key} must be a unique text array.`);
 }
 if(type==='contract'){
  if(!['api','event','job','function','webhook','stream'].includes(payload.kind)||!text(payload.callerCodeUnitRef)||!text(payload.receiverCodeUnitRef)||!['sync','async','in-process'].includes(payload.mode)||!text(payload.transport)||!text(payload.operation)||!Array.isArray(payload.request)||!Array.isArray(payload.response)||!texts(payload.errors)||!text(payload.authorization)||!text(payload.timeout)||!text(payload.retry)||!text(payload.idempotency)||!text(payload.compatibility))fail('Contract needs direction, interaction shape, errors, authorization, timing, retry, idempotency and compatibility.');
 }
 if(type==='data-model'){
  if(!text(payload.ownerCodeUnitRef)||!text(payload.store)||typeof payload.authoritative!=='boolean'||!text(payload.classification)||!Array.isArray(payload.fields)||!payload.fields.length||!texts(payload.states)||!Array.isArray(payload.transactions)||!payload.transactions.length||!text(payload.consistency)||!text(payload.retention)||!object(payload.recovery))fail('Data model needs writer, store, fields, states, transactions, consistency, retention and recovery.');
 }
 if(type==='quality'){
  if(!['security','performance','reliability'].includes(payload.qualityKind)||!texts(payload.businessRefs)||!texts(payload.scopeRefs)||!text(payload.mechanism)||!Array.isArray(payload.scenarios)||!payload.scenarios.length||!object(payload.measurement)||!texts(payload.optimization,{empty:true})||!texts(payload.tradeoffs)||!texts(payload.verificationRefs))fail('Quality design needs kind, business scope, mechanism, scenarios, measurement, optimization, tradeoffs and verification.');
 }
 if(type==='deployment')if(!text(payload.topology)||!Array.isArray(payload.placements)||!payload.placements.length||!Array.isArray(payload.connections)||!object(payload.configuration)||!object(payload.credentials)||!text(payload.scaling)||!texts(payload.failureDomains)||!text(payload.rollout)||!text(payload.rollback)||!object(payload.recovery))fail('Deployment needs topology, placement, connections, config/credential custody, scaling, failure domains, rollout, rollback and recovery.');
 if(type==='decision')if(!text(payload.problem)||!Array.isArray(payload.options)||payload.options.length<2||!text(payload.decision)||!['proposed','accepted','deferred','rejected'].includes(payload.status)||!text(payload.rationale)||!texts(payload.tradeoffs)||!texts(payload.affectedRefs)||!text(payload.revisitWhen))fail('Design decision needs alternatives, status, rationale, tradeoffs, affected refs and revisit condition.');
 if(type==='verification'){
  if(Object.hasOwn(payload,'evidence')||Object.hasOwn(payload,'executionEvidence'))fail('SDS is source of truth; evidence fields belong to local verification state.');
  if(!texts(payload.businessAcceptanceRefs)||!texts(payload.scopeRefs)||!text(payload.level)||!texts(payload.setup)||!texts(payload.steps)||!texts(payload.expected)||!texts(payload.securityChecks,{empty:true})||!texts(payload.performanceChecks,{empty:true})||!texts(payload.failureChecks,{empty:true}))fail('Verification design needs Business acceptance, scope, setup, steps, expected results and quality checks.');
 }
 return errors;
}

export function validateSDSMap(entries,srsEntries=[],businessEntries=[]){
 const issues=[],add=(entry,code,message)=>issues.push({code,path:entry.path,message}),byId=new Map();
 for(const entry of entries){const {classification,payload}=entry;if(classification.aggregate){if(payload!==undefined&&payload?.schema!==SDS_AGGREGATE_SCHEMA)add(entry,'SDS_AGGREGATE','SDS parent indexes may contain only starci/sds-aggregate@1 metadata.');continue;}if(!classification.type){add(entry,'SDS_SECTION_PATH','Unsupported SDS section folder.');continue;}for(const message of local(payload,classification.type))add(entry,'SDS_MAP',message);if(object(payload)&&text(payload.id)){if(byId.has(payload.id))add(entry,'SDS_ID',`Duplicate SDS id ${payload.id}.`);else byId.set(payload.id,entry);}}
 const resolve=(entry,ids,type,label,{empty=false}={})=>{if(!Array.isArray(ids)||(!empty&&!ids.length)){add(entry,'SDS_REF',`${label} references are required.`);return;}for(const id of ids){const target=byId.get(id);if(!target||target.classification.type!==type)add(entry,'SDS_REF',`${label} ${id} does not resolve to ${type}.`);}};
 const business=new Map(),flows=new Map(),acceptance=new Map();for(const entry of businessEntries)if(text(entry.nodeId))business.set(entry.nodeId,entry);for(const entry of srsEntries){const payload=entry.payload;if(text(entry.nodeId))business.set(entry.nodeId,entry);if(!object(payload)||!text(payload.id))continue;business.set(payload.id,entry);if(entry.classification.type==='functional-requirement'){for(const flow of [payload.mainFlow,...(payload.alternativeFlows??[]),...(payload.exceptionFlows??[])])if(object(flow)&&text(flow.id))flows.set(flow.id,entry);for(const ac of payload.acceptanceCriteria??[])if(object(ac)&&text(ac.id))acceptance.set(ac.id,entry);}}
 const businessRef=(entry,ref)=>{if(!object(ref)||!texts(ref.requirementIds)||!texts(ref.flowIds)||!texts(ref.acceptanceIds))return add(entry,'SDS_BUSINESS','Business refs need requirement, flow and acceptance IDs.');for(const id of ref.requirementIds)if(!business.has(id))add(entry,'SDS_BUSINESS',`Unknown SRS requirement ${id}.`);for(const id of ref.flowIds)if(!flows.has(id))add(entry,'SDS_BUSINESS',`Unknown SRS flow ${id}.`);for(const id of ref.acceptanceIds)if(!acceptance.has(id))add(entry,'SDS_BUSINESS',`Unknown SRS acceptance ${id}.`);};
 for(const entry of entries.filter(item=>!item.classification.aggregate)){const payload=entry.payload,type=entry.classification.type;if(!object(payload))continue;
  if(type==='flow'){
   for(const ref of payload.businessRefs??[])businessRef(entry,ref);resolve(entry,payload.participants,'code-unit','Participant');resolve(entry,[payload.entryPoint?.codeUnitRef].filter(Boolean),'code-unit','Entry point');resolve(entry,payload.verificationRefs,'verification','Verification');resolve(entry,payload.topologyRefs,'deployment','Topology');
   for(const sequence of [payload.mainSequence,...(payload.alternativeSequences??[]),...(payload.exceptionSequences??[])])for(const step of sequence?.steps??[]){resolve(entry,[step.codeUnitRef],'code-unit','Code unit');resolve(entry,step.contractRefs,'contract','Contract',{empty:true});resolve(entry,step.dataRefs,'data-model','Data',{empty:true});}
  }
  if(type==='code-unit'){resolve(entry,payload.callers,'code-unit','Caller',{empty:true});resolve(entry,payload.callees,'code-unit','Callee',{empty:true});resolve(entry,payload.contractRefs,'contract','Contract',{empty:true});resolve(entry,payload.dataRefs,'data-model','Data',{empty:true});resolve(entry,payload.qualityRefs,'quality','Quality',{empty:true});resolve(entry,payload.verificationRefs,'verification','Verification',{empty:true});}
  if(type==='contract'){resolve(entry,[payload.callerCodeUnitRef],'code-unit','Contract caller');resolve(entry,[payload.receiverCodeUnitRef],'code-unit','Contract receiver');}
  if(type==='data-model')resolve(entry,[payload.ownerCodeUnitRef],'code-unit','Data owner');
  if(type==='quality'){for(const id of payload.businessRefs??[])if(!business.has(id)&&!flows.has(id))add(entry,'SDS_BUSINESS',`Unknown quality Business ref ${id}.`);for(const id of payload.scopeRefs??[])if(!byId.has(id))add(entry,'SDS_REF',`Unknown quality scope ${id}.`);resolve(entry,payload.verificationRefs,'verification','Quality verification');}
  if(type==='deployment')for(const placement of payload.placements??[])resolve(entry,[placement.codeUnitRef],'code-unit','Deployment placement');
  if(type==='verification'){for(const id of payload.businessAcceptanceRefs??[])if(!acceptance.has(id))add(entry,'SDS_BUSINESS',`Unknown verification acceptance ${id}.`);for(const id of payload.scopeRefs??[])if(!byId.has(id))add(entry,'SDS_REF',`Unknown verification scope ${id}.`);}
 if(type==='decision')for(const id of payload.affectedRefs??[])if(!byId.has(id))add(entry,'SDS_REF',`Unknown decision target ${id}.`);
  if(type==='overview'){for(const id of payload.businessRefs??[])if(!business.has(id))add(entry,'SDS_BUSINESS',`Unknown overview Business ref ${id}.`);resolve(entry,payload.topologyRefs,'deployment','Overview topology');}
 }
 const flowEntries=entries.filter(entry=>entry.classification.type==='flow');if(flowEntries.length&&!entries.some(entry=>entry.classification.type==='code-unit'))add(flowEntries[0],'SDS_CODE_MAP','SDS flows require owned code units.');
 return issues;
}
