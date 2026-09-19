import {canonicalJSON,sha256} from '../core/index.mjs';
const digest=x=>sha256(canonicalJSON(x));
const text=x=>typeof x==='string'&&x.trim().length>0;
const strings=x=>Array.isArray(x)&&x.every(text)&&new Set(x).size===x.length;
export const planAreas=scope=>scope.schema==='starci/plan@2'?['business','architecture','implementation','backend','frontend','uat']:['business','architecture','implementation','uat'];
export function planProgress(scope,jobs) {
 const states=scope.workflows.map(job=>jobs[job.id]?.status??'planned');
 if(states.every(state=>state==='done'))return scope.mode==='auto'?'awaiting-terminal-review':'done';
 if(states.some(state=>['blocked','failed','awaiting-bootstrap'].includes(state)))return 'blocked';
 return states.every(state=>state==='planned')?'planned':'in-progress';
}
export function validatePlan(scope, catalog) {
 if(!['starci/plan@1','starci/plan@2'].includes(scope?.schema)||!text(scope.id)||!text(scope.requestId)||!text(scope.originalRequest)||!text(scope.finalOutcome)||!Array.isArray(scope.exclusions)||!Array.isArray(scope.workflows)||!scope.workflows.length) throw Error('A concrete pre-workflow scope is required');
 if(scope.mode!==undefined&&!['manual','auto'].includes(scope.mode))throw Error('Plan mode must be manual or auto; omission preserves manual behavior');
 if(scope.mode==='auto') {
  if(scope.schema!=='starci/plan@2'||!scope.auto||!Number.isInteger(scope.auto.maxMinutes)||scope.auto.maxMinutes<1||scope.auto.maxMinutes>480||scope.auto.acceptance!=='verified-criteria')throw Error('Auto requires Plan v2, an explicit 1–480 minute budget and verified-criteria delegation');
  for(const job of scope.workflows) {
   const policy=job.auto;
   if(!policy||!['local','isolated-test','manual'].includes(policy.environment)||!strings(policy.business)||!policy.business.length||!Array.isArray(policy.resourceEffects)||policy.resourceEffects.some(e=>!e||!job.resources.includes(e.target)||!text(e.operation)||!text(e.postcondition)))throw Error('Each auto Plan job needs an environment, business ceiling and exact resource-effect ceilings; use manual for reserved checkpoints');
  }
 } else if(scope.auto!==undefined||scope.workflows.some(job=>job.auto!==undefined))throw Error('Auto policy cannot be silently attached to a manual Plan');
 for(const section of planAreas(scope)) {
  const value=scope[section];
  if(!value||!['change','reuse','not-applicable'].includes(value.action)||!text(value.outcome)||!Array.isArray(value.targets))throw Error('Scope must explain business, architecture, implementation and UAT, including explicit reuse or non-applicability');
 }
 const ids=new Set();
 for(const [i,job] of scope.workflows.entries()) {
  if(!text(job.id)||ids.has(job.id)||!catalog.workflows.some(x=>x.id===job.workflow)||!text(job.purpose)||!text(job.input)||!text(job.output)||!Array.isArray(job.criteria)||!job.criteria.length||!job.criteria.every(text)||!Array.isArray(job.workTargets)||!Array.isArray(job.paths)||!Array.isArray(job.resources)||!Array.isArray(job.dependsOn)||job.dependsOn.some(id=>!ids.has(id))||i>0&&!job.dependsOn.includes(scope.workflows[i-1].id))throw Error('Scope jobs must be explicit, bounded and sequential');
  const selection=job.selection;
  if(!selection||!text(selection.requestQuote)||!scope.originalRequest.includes(selection.requestQuote)||typeof selection.codeChange!=='boolean'||!['none','unit-component','browser-uat'].includes(selection.verification)||typeof selection.separateDeliverable!=='boolean')throw Error('Each job needs explicit request-bound selection facts');
  if(job.workflow==='implement-backend'&&!selection.codeChange)throw Error('Backend implementation cannot be added merely to inspect or verify an existing API');
  if(job.workflow==='verify-flows'&&selection.verification!=='browser-uat')throw Error('verify-flows requires browser UAT; unit/component tests belong to code review or implementation checks');
  if(job.workflow==='implement-frontend'&&(!selection.codeChange||selection.verification!=='browser-uat'))throw Error('Frontend implementation owns draw/reuse, coding and browser UAT');
  if(job.workflow==='design-interface'&&scope.workflows.some(x=>x.workflow==='implement-frontend')&&!selection.separateDeliverable)throw Error('Frontend already owns design; a separate design job needs an explicitly requested standalone deliverable');
  if(job.workflow==='verify-flows'&&scope.workflows.some(x=>x.workflow==='implement-frontend')&&!selection.separateDeliverable)throw Error('Frontend already owns UAT; a separate retest must be explicitly requested');
  const e=job.estimate;
  if(!e||!Number.isFinite(e.minMinutes)||e.minMinutes<0||!Number.isFinite(e.maxMinutes)||e.maxMinutes<e.minMinutes||!text(e.assumptions))throw Error('Each workflow needs an estimate range and assumptions');
  ids.add(job.id);
 }
 if(scope.schema==='starci/plan@2') {
  if(!strings(scope.openQuestions))throw Error('Plan-wide open questions must be explicit');
  for(const job of scope.workflows)if(!strings(job.openQuestions))throw Error('Each workflow must declare its own unresolved goal questions');
  const references=xs=>strings(xs)&&xs.every(id=>ids.has(id));
  for(const section of planAreas(scope)) {
   const value=scope[section];
   if(!strings(value.targets)||!references(value.workflowIds)||!strings(value.evidence)||typeof value.reason!=='string')throw Error(`Invalid ${section} coverage: use known workflow IDs, evidence references and an explicit reason`);
   if(value.action==='change'&&(!value.workflowIds.length||!value.targets.length))throw Error(`Changed ${section} needs targets and producing workflows; later work must remain in the Plan`);
   if(value.action==='reuse'&&(!value.evidence.length||!value.targets.length))throw Error(`Reused ${section} needs existing targets and evidence; deferred work is not reuse`);
   if(value.action==='not-applicable'&&(!text(value.reason)||value.workflowIds.length||value.targets.length||value.evidence.length))throw Error(`Non-applicable ${section} needs a scope reason, not deferred delivery`);
  }
  if(!Array.isArray(scope.completionCriteria)||!scope.completionCriteria.length)throw Error('Plan needs terminal completion criteria, not only the current workflow outcome');
  const criteriaIds=new Set();
  for(const criterion of scope.completionCriteria) {
   if(!text(criterion.id)||criteriaIds.has(criterion.id)||!text(criterion.outcome)||!references(criterion.workflowIds)||!criterion.workflowIds.length)throw Error('Each terminal criterion needs a unique ID, observable outcome and producing workflows');
   criteriaIds.add(criterion.id);
  }
 }
 return {ok:true,digest:digest(scope)};
}
