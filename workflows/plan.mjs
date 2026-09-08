import {canonicalJSON,sha256} from '../core/index.mjs';
const digest=x=>sha256(canonicalJSON(x));
const text=x=>typeof x==='string'&&x.trim().length>0;
export function validatePlan(scope, catalog) {
 if(scope?.schema!=='starci/plan@1'||!text(scope.id)||!text(scope.requestId)||!text(scope.originalRequest)||!text(scope.finalOutcome)||!Array.isArray(scope.exclusions)||!Array.isArray(scope.workflows)||!scope.workflows.length) throw Error('A concrete pre-workflow scope is required');
 for(const section of ['business','architecture','implementation','uat']) {
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
 return {ok:true,digest:digest(scope)};
}
