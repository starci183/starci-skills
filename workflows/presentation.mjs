import {canonicalJSON,sha256} from '../core/index.mjs';
import {validatePlan} from './plan.mjs';
const hash=x=>sha256(canonicalJSON(x));
const need=(ok,message)=>{if(!ok)throw Error(message);};
export function verifyPresentation(run,catalog){
 const p=run.presentation,g=run.goal;
 need(p?.goalDigest===run.goalDigest,'Present the concrete scope and goal before approval');
 if(p.scope?.schema==='starci/workflow-scope@1'){
  need(!run.automatic&&!run.delegated&&!p.provenance,'Standalone workflow requires direct manual authority');
  need(p.scopeDigest===hash(p.scope)&&p.scope.goalDigest===run.goalDigest&&p.scope.id===g.id&&p.scope.workflow===g.workflow&&p.scope.requestId===g.requestId&&p.scope.originalRequest===g.originalRequest&&p.jobId===g.id,'Standalone workflow presentation changed');
  need(Object.keys(p.scope).sort().join(',')==='goalDigest,id,openQuestions,originalRequest,requestId,schema,workflow'&&Array.isArray(p.scope.openQuestions)&&p.scope.openQuestions.every(x=>typeof x==='string'&&x.trim()),'Invalid standalone workflow scope');
  return true;
 }
 need(validatePlan(p.scope,catalog).digest===p.scopeDigest,'Present the concrete scope and goal before approval: Plan changed');
 const job=p.scope.workflows.find(j=>j.id===p.jobId);
 need(job?.workflow===g.workflow&&p.scope.requestId===g.requestId&&p.scope.originalRequest===g.originalRequest&&g.workTargets.every(id=>job.workTargets.includes(id))&&g.scope.paths.every(x=>job.paths.includes(x))&&g.scope.resources.every(x=>job.resources.includes(x)),'Producer exceeds its presented job');
 return true;
}
