import {readDistJson} from '../core/runtime-root.mjs';

export const SRS_AGGREGATE_SCHEMA='starci/srs-aggregate@1';
export const SRS_SECTION_CONTRACT=readDistJson('specifications','srs-sections.json');
export const SRS_SECTION_SCHEMAS=Object.freeze(Object.fromEntries(Object.values(SRS_SECTION_CONTRACT.sections).map(section=>[section.type,section.schema])));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const text=value=>typeof value==='string'&&value.trim().length>0;
const texts=(value,{empty=false}={})=>Array.isArray(value)&&(empty||value.length>0)&&value.every(text)&&new Set(value).size===value.length;
const hasCodeProvenance=value=>{
 if(Array.isArray(value))return value.some(hasCodeProvenance);
 if(!object(value))return false;
 if(Object.keys(value).some(key=>['sourceRefs','codeRefs','repositoryRole','revision','commit','symbol','implementationStatus'].includes(key)))return true;
 return Object.values(value).some(hasCodeProvenance);
};

export function classifySRSPath(relative,hasChildren=false){
 const parts=relative.replaceAll('\\','/').split('/');
 const business=parts.lastIndexOf('business'),srs=business>=0?parts.indexOf('srs',business+1):-1;
 if(srs<0||parts.at(-1)!=='index.yaml')return null;
 const tail=parts.slice(srs+1,-1);
 if(!tail.length)return {aggregate:true,section:'feature-srs',expectedSchema:SRS_AGGREGATE_SCHEMA};
 const category=tail[0];
 if(category==='business-rules'&&tail[1]==='policy-decisions'){
  if(tail.length===2||hasChildren)return {aggregate:true,section:'policy-decisions',expectedSchema:SRS_AGGREGATE_SCHEMA};
  return {aggregate:false,type:'policy-decision',category,expectedSchema:SRS_SECTION_SCHEMAS['policy-decision']};
 }
 const contract=SRS_SECTION_CONTRACT.sections[category];
 if(!contract)return {aggregate:false,type:null,category,expectedSchema:null};
 if(tail.length===1||hasChildren)return {aggregate:true,section:category,expectedSchema:SRS_AGGREGATE_SCHEMA};
 return {aggregate:false,type:contract.type,category,expectedSchema:contract.schema};
}

function localValidation(payload,type){
 const errors=[],fail=message=>errors.push(message),required=SRS_SECTION_CONTRACT.sections[Object.keys(SRS_SECTION_CONTRACT.sections).find(key=>SRS_SECTION_CONTRACT.sections[key].type===type)]?.required??[];
 if(!object(payload)){fail('Typed SRS payload is required.');return errors;}
 if(payload.schema!==SRS_SECTION_SCHEMAS[type])fail(`Expected ${SRS_SECTION_SCHEMAS[type]}.`);
 if(hasCodeProvenance(payload))fail('SRS is independent of source code; code paths, symbols, revisions and implementation proof belong downstream.');
 for(const key of required)if(!Object.hasOwn(payload,key))fail(`Missing ${key}.`);
 if(!text(payload.id)||!text(payload.title))fail('Stable id and title are required.');
 if(payload.status!==undefined&&!['draft','accepted','blocked'].includes(payload.status))fail('Unsupported SRS status.');
 const gwt=(rows,at)=>{if(!Array.isArray(rows)||!rows.length){fail(`${at} requires acceptance criteria.`);return;}const ids=new Set();for(const row of rows){if(!object(row)||!text(row.id)||ids.has(row.id))fail(`${at} acceptance ids must be unique.`);else ids.add(row.id);if(!(text(row.given)||texts(row.given))||!text(row.when)||!(text(row.then)||texts(row.then)))fail(`${row?.id??at} requires Given/When/Then.`);}};
 if(type==='functional-requirement'){
  const actorIds=Array.isArray(payload.actors)?payload.actors:object(payload.actors)?[payload.actors.primary,...(payload.actors.supporting??[])].filter(Boolean):[];
  if(!text(payload.goal)||!texts(actorIds)||!text(payload.trigger)||!texts(payload.preconditions,{empty:true})||!Array.isArray(payload.inputs)||!payload.inputs.length||!Array.isArray(payload.outputs)||!payload.outputs.length)fail('FR needs goal, actors, trigger, preconditions, inputs and outputs.');
  for(const key of ['businessRuleRefs','dataRefs','nonFunctionalRefs','decisionRefs'])if(!texts(payload[key],{empty:true}))fail(`${key} must be a unique text array.`);
  const main=payload.mainFlow,alternatives=payload.alternativeFlows,exceptions=payload.exceptionFlows,flows=[main,...(Array.isArray(alternatives)?alternatives:[]),...(Array.isArray(exceptions)?exceptions:[])];
  if(!object(main)||!text(main.id)||!Array.isArray(main.steps)||!main.steps.length||!Array.isArray(alternatives)||!Array.isArray(exceptions))fail('FR needs one ordered main flow plus alternative and exception arrays.');
  if(Array.isArray(alternatives)&&!alternatives.length&&!text(payload.branchReview?.alternatives))fail('Explain why no alternative flow applies.');
  if(Array.isArray(exceptions)&&!exceptions.length&&!text(payload.branchReview?.exceptions))fail('Explain why no exception flow applies.');
  const flowIds=new Set(),stepIds=new Set();
  for(const flow of flows){if(!object(flow)||!text(flow.id)||flowIds.has(flow.id)||!Array.isArray(flow.steps)||!flow.steps.length){fail('Every flow needs a unique id and ordered steps.');continue;}flowIds.add(flow.id);for(const step of flow.steps){if(!object(step)||!text(step.id)||stepIds.has(step.id)||!text(step.actor)||!text(step.request)||!text(step.systemResponse)||!text(step.businessEffect)||!texts(step.acceptanceRefs)){fail(`${flow.id} contains an incomplete or duplicate step.`);continue;}stepIds.add(step.id);if(!actorIds.includes(step.actor))fail(`${step.id} uses an undeclared actor.`);}}
  const mainSteps=new Set(Array.isArray(main?.steps)?main.steps.map(step=>step.id):[]);
  for(const branch of [...(Array.isArray(alternatives)?alternatives:[]),...(Array.isArray(exceptions)?exceptions:[])]){if(!mainSteps.has(branch.fromStep)||!text(branch.condition)||!texts(branch.postconditions)||!texts(branch.acceptanceRefs)||!object(branch.resume)||!['main-step','end'].includes(branch.resume.type))fail(`${branch?.id??'Branch'} needs a valid main-flow fork, outcome and resume/end.`);else if(branch.resume.type==='main-step'&&!mainSteps.has(branch.resume.stepRef))fail(`${branch.id} resumes at an unknown main step.`);else if(branch.resume.type==='end'&&!text(branch.resume.outcome))fail(`${branch.id} needs an end outcome.`);}
  gwt(payload.acceptanceCriteria,'FR');
  const acceptance=new Map((payload.acceptanceCriteria??[]).map(row=>[row.id,row]));
  for(const flow of flows)for(const step of flow?.steps??[])for(const id of step.acceptanceRefs??[]){const ac=acceptance.get(id);if(!ac||ac.flowRef!==flow.id||!Array.isArray(ac.stepRefs)||!ac.stepRefs.includes(step.id))fail(`${step.id} has an unresolved acceptance reference ${id}.`);}
  for(const ac of payload.acceptanceCriteria??[]){if(!flowIds.has(ac.flowRef))fail(`${ac.id} references an unknown flow.`);for(const id of ac.stepRefs??[])if(!stepIds.has(id))fail(`${ac.id} references an unknown step.`);}
  if(!object(payload.postconditions)||!texts(payload.postconditions.success)||!texts(payload.postconditions.failure))fail('FR needs success and failure postconditions.');
 }
 if(type==='non-functional-requirement'){
  if(!texts(payload.scope)||!text(payload.requirement)||!object(payload.measurement)||!text(payload.measurement.metric)||!text(payload.measurement.conditions))fail('NFR needs scope, requirement and measurable conditions.');
  if(object(payload.measurement)&&Object.hasOwn(payload.measurement,'evidenceRequired'))fail('NFR is source of truth; measurement.evidenceRequired belongs to local verification, not SRS.');
  if(!texts(payload.decisionRefs,{empty:true}))fail('NFR decisionRefs must be a unique text array.');gwt(payload.acceptanceCriteria,'NFR');
 }
 if(type==='business-rule'){
  if(!texts(payload.statements)||!texts(payload.decisionRefs,{empty:true}))fail('Business rule needs statements and decisionRefs.');gwt(payload.acceptanceCriteria,'Business rule');
 }
 if(type==='data-definition'){
  if(!text(payload.owner)||!Array.isArray(payload.fields)||!payload.fields.length||!texts(payload.states)||!Array.isArray(payload.transitions)||!Array.isArray(payload.relations)||!texts(payload.invariants)||!object(payload.privacy))fail('Data definition needs owner, fields, states, transitions, invariants and privacy.');
  const fields=new Set();for(const field of payload.fields??[]){if(!object(field)||!text(field.name)||fields.has(field.name)||!text(field.meaning)||!text(field.validation)||!text(field.classification))fail('Data fields require unique names, meaning, validation and classification.');else fields.add(field.name);}
  const states=new Set(payload.states??[]);for(const transition of payload.transitions??[])if(!object(transition)||!text(transition.id)||!states.has(transition.from)||!states.has(transition.to)||!text(transition.event)||!text(transition.guard))fail(`${transition?.id??'Transition'} does not resolve declared states.`);
  if(!text(payload.privacy?.access)||!text(payload.privacy?.retention)||!text(payload.privacy?.referenceWithdrawal))fail('Data privacy needs access, retention and reference-withdrawal behavior.');
 }
 if(type==='customer-journey'){
  if(!text(payload.actor)||!text(payload.entry)||!texts(payload.preconditions,{empty:true})||!Array.isArray(payload.stages)||!payload.stages.length||!Array.isArray(payload.branches)||!text(payload.exit))fail('Journey needs actor, entry, ordered stages, branches and exit.');
  const stages=payload.stages??[],ids=stages.map(stage=>stage.id);if(!ids.every(text)||new Set(ids).size!==ids.length)fail('Journey stage ids must be unique.');
  for(let index=0;index<stages.length;index++){const stage=stages[index];if(!text(stage.actorAction)||!text(stage.requirementRef)||!text(stage.flowRef)||!texts(stage.acceptanceRefs)||!text(stage.outcome)||stage.nextStep!==(ids[index+1]??null))fail(`${stage?.id??'Journey stage'} is incomplete or breaks sequence.`);}
  for(const branch of payload.branches??[])if(!text(branch.id)||!texts(branch.atStageRefs)||!text(branch.requirementRef)||!text(branch.flowRef)||!text(branch.condition)||!text(branch.handling)||!texts(branch.acceptanceRefs)||!texts(branch.outcome))fail(`${branch?.id??'Journey branch'} is incomplete.`);gwt(payload.acceptanceCriteria,'Journey');
 }
 if(type==='policy-decision'){
  if(Object.hasOwn(payload,'closureEvidence'))fail('Policy decisions use closureCriteria; evidence fields do not belong in SRS.');
  if(!text(payload.accountableRole)||!text(payload.question)||!texts(payload.requiredDecisions)||!text(payload.safeDisposition)||!text(payload.closureCriteria)||!['open','accepted','deferred','rejected'].includes(payload.decisionStatus))fail('Policy decision needs status, accountable role, question, required decisions, safe disposition and closure criteria.');
 }
 return errors;
}

export function validateSRSGraph(entries){
 const issues=[],add=(entry,code,message)=>issues.push({code,path:entry.path,message}),leafEntries=entries.filter(entry=>!entry.classification.aggregate),byId=new Map(),flows=new Map(),acceptance=new Map();
 for(const entry of entries){
  const {classification,payload}=entry;
  if(classification.aggregate){if(payload!==undefined&&payload?.schema!==SRS_AGGREGATE_SCHEMA)add(entry,'SRS_AGGREGATE','SRS parent indexes may contain only starci/srs-aggregate@1 metadata.');continue;}
  if(!classification.type){add(entry,'SRS_SECTION_PATH','Unsupported SRS section folder.');continue;}
  for(const message of localValidation(payload,classification.type))add(entry,'SRS_SECTION',message);
  if(!object(payload)||!text(payload.id))continue;
  if(byId.has(payload.id))add(entry,'SRS_ID',`Duplicate semantic SRS id ${payload.id}.`);else byId.set(payload.id,entry);
  if(classification.type==='functional-requirement')for(const flow of [payload.mainFlow,...(payload.alternativeFlows??[]),...(payload.exceptionFlows??[])]){if(object(flow)&&text(flow.id))flows.set(flow.id,{entry,flow});for(const ac of payload.acceptanceCriteria??[])if(object(ac)&&text(ac.id))acceptance.set(ac.id,{entry,ac});}
 }
 const typed=(entry,ids,type,label)=>{for(const id of ids??[]){const target=byId.get(id);if(!target||target.classification.type!==type)add(entry,'SRS_REF',`${label} ${id} does not resolve to ${type}.`);}};
 const journeyCoverage=new Set();
 for(const entry of leafEntries){const payload=entry.payload,type=entry.classification.type;if(!object(payload))continue;
  if(text(payload.featureOwner)&&!entry.path.replaceAll('\\','/').startsWith(`features/${payload.featureOwner}/`))add(entry,'SRS_OWNER',`Feature owner ${payload.featureOwner} does not own this path.`);
  typed(entry,payload.decisionRefs,'policy-decision','Decision');
  if(type==='functional-requirement'){
   typed(entry,payload.businessRuleRefs,'business-rule','Business rule');typed(entry,payload.dataRefs,'data-definition','Data');typed(entry,payload.nonFunctionalRefs,'non-functional-requirement','NFR');
   const semantic=[...(payload.businessRuleRefs??[]),...(payload.dataRefs??[]),...(payload.nonFunctionalRefs??[]),...(payload.decisionRefs??[])],expected=semantic.map(id=>byId.get(id)?.nodeId).filter(Boolean).sort(),actual=[...entry.workRefs].sort();if(JSON.stringify(expected)!==JSON.stringify(actual))add(entry,'SRS_TRACE','Work refs must exactly match FR business-rule, data, NFR and decision ownership.');
  }
  if(type==='business-rule'||type==='non-functional-requirement')typed(entry,payload.decisionRefs,'policy-decision','Decision');
  if(type==='data-definition')typed(entry,(payload.relations??[]).map(row=>row.dataRef),'data-definition','Related data');
  if(type==='customer-journey'){
   for(const stage of payload.stages??[]){const requirement=byId.get(stage.requirementRef),flow=flows.get(stage.flowRef);if(requirement?.classification.type!=='functional-requirement'||flow?.entry!==requirement)add(entry,'SRS_JOURNEY',`${stage.id} does not resolve its FR flow owner.`);else journeyCoverage.add(stage.requirementRef);for(const id of stage.acceptanceRefs??[])if(acceptance.get(id)?.entry!==requirement)add(entry,'SRS_JOURNEY',`${stage.id} has unrelated acceptance ${id}.`);}
   for(const branch of payload.branches??[]){const requirement=byId.get(branch.requirementRef),flow=flows.get(branch.flowRef);if(flow?.entry!==requirement||flow?.flow?.condition!==branch.condition)add(entry,'SRS_JOURNEY',`${branch.id} does not match its FR branch.`);for(const stage of branch.atStageRefs??[])if(!(payload.stages??[]).some(row=>row.id===stage&&row.requirementRef===branch.requirementRef))add(entry,'SRS_JOURNEY',`${branch.id} points to an unrelated journey stage.`);}
  }
  if(type==='policy-decision'){
   typed(entry,payload.affectedFeatureRefs,'functional-requirement','Affected FR');typed(entry,payload.affectedDataRefs,'data-definition','Affected data');typed(entry,payload.affectedNfrRefs,'non-functional-requirement','Affected NFR');
  }
 }
 for(const entry of leafEntries.filter(entry=>entry.classification.type==='functional-requirement'))if(!journeyCoverage.has(entry.payload?.id))add(entry,'SRS_JOURNEY_COVERAGE','Every FR must participate in at least one customer journey.');
 return issues;
}
