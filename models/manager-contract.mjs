export const MANAGER_SNAPSHOT='starci/manager-snapshot@1';
export const MANAGER_DECISION='starci/manager-decision@1';
export const MANAGER_DECISION_FORM={schema:{type:'string',enum:[MANAGER_DECISION]},workflowId:{type:'string'},decisionId:{type:'string'},generation:{type:'number'},version:{type:'number'},digest:{type:'string'},basisDigest:{type:'string'},orderedActionIds:{type:'string[]'},rationale:{type:'string'},contextRequests:{type:'object[]',optional:true,each:{actionId:{type:'string'},refIds:{type:'string[]'}}}};

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const unique=list=>[...new Set(list)];
const exactKeys=(value,allowed)=>Object.keys(value).every(key=>allowed.includes(key));
const bounded=(value,max)=>{try{return JSON.stringify(value).length<=max;}catch{return false;}};
const snapshotKeys=['schema','workflowId','decisionId','generation','version','digest','basisDigest','goal','progress','ops','blockers','actions','contextCatalog','noProgress'];
const decisionKeys=['schema','workflowId','decisionId','generation','version','digest','basisDigest','orderedActionIds','rationale','contextRequests'];
const result=errors=>({ok:errors.length===0,errors:unique(errors),reason:unique(errors)[0]??null});

/** Validate the bounded kernel projection before any provider receives it. */
export function validateManagerSnapshot(value){
  const errors=[];
  if(!plain(value))return result(['manager snapshot is not an object']);
  if(!exactKeys(value,snapshotKeys))errors.push('manager snapshot has unknown fields');
  if(value.schema!==MANAGER_SNAPSHOT)errors.push('manager snapshot schema is invalid');
  for(const key of ['workflowId','decisionId','digest','basisDigest'])if(typeof value[key]!=='string'||!value[key].trim())errors.push(`manager snapshot ${key} is required`);
  for(const key of ['generation','version'])if(!Number.isInteger(value[key])||value[key]<0)errors.push(`manager snapshot ${key} must be a non-negative integer`);
  if(!plain(value.goal)||typeof value.goal.job!=='string'||!Array.isArray(value.goal.definitionOfDone)||!value.goal.definitionOfDone.every(item=>typeof item==='string'))errors.push('manager snapshot goal is invalid');
  if(!plain(value.progress)||!plain(value.noProgress)||!Number.isInteger(value.noProgress.round)||!Number.isInteger(value.noProgress.budget)||value.noProgress.round<0||value.noProgress.budget<0)errors.push('manager snapshot progress budget is invalid');
  for(const key of ['ops','blockers','actions','contextCatalog'])if(!Array.isArray(value[key])||value[key].length>100||!value[key].every(plain))errors.push(`manager snapshot ${key} is invalid`);
  const actions=new Set(),contexts=new Set();
  for(const item of (Array.isArray(value.contextCatalog)?value.contextCatalog:[]).filter(plain)){if(typeof item.id!=='string'||!item.id.trim()||contexts.has(item.id)||typeof item.kind!=='string'||typeof item.digest!=='string')errors.push('manager context catalog is invalid');contexts.add(item.id);}
  for(const action of (Array.isArray(value.actions)?value.actions:[]).filter(plain)){
    if(typeof action.id!=='string'||!action.id.trim()||actions.has(action.id)||typeof action.type!=='string'||typeof action.summary!=='string'||!Array.isArray(action.preconditions)||!action.preconditions.every(item=>typeof item==='string')||!Array.isArray(action.contextRefIds)||!action.contextRefIds.every(item=>typeof item==='string'&&contexts.has(item)))errors.push('manager action is invalid');
    if(action.modelPreferences!==undefined&&(!Array.isArray(action.modelPreferences)||!action.modelPreferences.every(item=>typeof item==='string')))errors.push('manager action model preferences are invalid');
    actions.add(action.id);
  }
  if(!bounded(value,64000))errors.push('manager snapshot exceeds the bounded context');
  return result(errors);
}

/** Bind a model decision to exactly one immutable snapshot and its listed actions. */
export function validateManagerDecision(value,snapshot){
  const errors=[];
  if(!plain(value))return {...result(['manager decision is not an object']),orderedActionIds:[]};
  if(!plain(snapshot))errors.push('manager decision snapshot is invalid');
  if(!exactKeys(value,decisionKeys))errors.push('manager decision has unknown fields');
  if(value.schema!==MANAGER_DECISION)errors.push('manager decision schema is invalid');
  for(const key of ['workflowId','decisionId','digest','basisDigest'])if(typeof value[key]!=='string'||!value[key].trim())errors.push(`manager decision ${key} is required`);
  for(const key of ['generation','version'])if(!Number.isInteger(value[key])||value[key]<0)errors.push(`manager decision ${key} must be a non-negative integer`);
  if(!Array.isArray(value.orderedActionIds)||!value.orderedActionIds.every(item=>typeof item==='string'))errors.push('manager decision orderedActionIds is invalid');
  if(typeof value.rationale!=='string'||!value.rationale.trim()||value.rationale.length>4000)errors.push('manager decision rationale is invalid');
  if(value.contextRequests!==undefined&&(!Array.isArray(value.contextRequests)||!value.contextRequests.every(plain)))errors.push('manager decision contextRequests is invalid');
  for(const key of ['workflowId','decisionId','generation','version','digest','basisDigest'])if(value[key]!==snapshot?.[key])errors.push(`manager decision ${key} does not match its snapshot`);
  const actions=new Map((Array.isArray(snapshot?.actions)?snapshot.actions:[]).filter(plain).map(action=>[action.id,action])),ordered=Array.isArray(value.orderedActionIds)?value.orderedActionIds:[];
  if(new Set(ordered).size!==ordered.length)errors.push('manager decision repeats an action');
  if(ordered.some(id=>!actions.has(id)))errors.push('manager decision names an unknown action');
  if(actions.size&&!ordered.length)errors.push('manager decision must select an available action');
  for(const request of (Array.isArray(value.contextRequests)?value.contextRequests:[]).filter(plain)){
    const action=actions.get(request.actionId),refs=Array.isArray(request.refIds)?request.refIds:[],allowed=new Set(action?.contextRefIds??[]);
    if(!exactKeys(request,['actionId','refIds']))errors.push('manager context request has unknown fields');
    if(!action||!ordered.includes(request.actionId))errors.push('manager context request is not bound to a selected action');
    if(!Array.isArray(request.refIds)||new Set(refs).size!==refs.length||refs.some(id=>typeof id!=='string'||!allowed.has(id)))errors.push('manager context request names an unavailable reference');
  }
  return {...result(errors),orderedActionIds:errors.length?[]:ordered};
}
