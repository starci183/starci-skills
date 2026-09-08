const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>plain(x)&&keys.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>keys.includes(k));
export function validateWorkflowCatalog(catalog,jobs,frontend) {
  const errors=[];
  if(!exact(catalog,['schema','skill','gates','fallback','readOnly','unknownExplicitWorkflow','limits','workflows'])||catalog.gates!=='gates.json'||catalog.schema!=='starci/workflow-catalog@1'||catalog.skill!=='../SKILL.md'||catalog.fallback!=='direct-task'||catalog.readOnly!=='answer-or-inspect'||catalog.unknownExplicitWorkflow!=='error'||!Array.isArray(catalog.workflows))return {ok:false,errors:['Invalid workflow catalog']};
  if(!exact(catalog.limits,['rows','columns','secondaryDefinitions'])||Object.values(catalog.limits).some(n=>n!==3))errors.push('Invalid limits');
  const expected=new Set([frontend.id,...jobs.workflows.map(w=>w.id)]),ids=new Set(),intents=new Set();
  for(const row of catalog.workflows){
    if(!exact(row,['id','intent','when','definition','execution'])||Object.values(row).some(x=>typeof x!=='string'||!x.trim())){errors.push('Invalid workflow entry');continue;}
    if(ids.has(row.id)||intents.has(row.intent)||!expected.has(row.id))errors.push('Duplicate or unknown workflow');
    ids.add(row.id);intents.add(row.intent);
    if(row.definition!==(row.id===frontend.id?'frontend.json':'jobs.json')||row.execution!==(row.id===frontend.id?'frontend-gate':'explicit-coordinator'))errors.push('Wrong workflow source or execution claim');
  }
  if(ids.size!==expected.size||[...expected].some(id=>!ids.has(id)))errors.push('Incomplete workflow discovery');
  const fallback=jobs.workflows.find(w=>w.id==='direct-task');
  if(!fallback||fallback.matrix.length!==1||fallback.matrix[0].length!==1||fallback.matrix[0][0].op!=='task.execute')errors.push('Fallback must be exactly one task.execute cell');
  return {ok:errors.length===0,errors};
}
/** Read-only policy selection, never a dispatcher or an authorization grant. */
export function selectWorkflow(catalog,{workflowId,intent,readOnly=false}={}) {
  if(readOnly)return {kind:'answer-or-inspect'};
  if(workflowId!==undefined){
    const entry=catalog.workflows.find(w=>w.id===workflowId);
    if(!entry)throw Error('Unknown explicitly selected workflow');
    return {kind:'workflow',...structuredClone(entry),reason:'explicit-selection'};
  }
  const matched=catalog.workflows.find(w=>w.intent===intent);
  const entry=matched??catalog.workflows.find(w=>w.id===catalog.fallback);
  if(!entry)throw Error('Missing fallback workflow');
  return {kind:'workflow',...structuredClone(entry),reason:matched?'matched-intent':'direct-request-fallback'};
}
