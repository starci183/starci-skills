import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJSON,sha256,validateWorkspace} from '../core/index.mjs';
import {validatePlan} from './plan.mjs';
import {hasDelegatedAcceptance} from './delegation.mjs';
import {verifyRunWork,scopedWorkStatus} from './work-binding.mjs';
const digest=x=>sha256(canonicalJSON(x));
const text=x=>typeof x==='string'&&x.trim().length>0;
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const catalog=JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url)));
const allowed=new Set(['analyze-request','prepare-work','define-business','design-architecture','design-interface','implement-backend','implement-frontend','verify-flows','review-code','produce-content']);
const inside=(root,file)=>{const r=path.relative(root,file);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const runtimeRoot=fs.realpathSync(fileURLToPath(new URL('../',import.meta.url)));

function candidateWindow(plan,start) {
 const pending=plan.workflows.slice(start),candidateJobIds=[];
 let checkpoint=plan.openQuestions.length?{jobId:null,reason:'plan-questions'}:null;
 const estimate={minMinutes:0,maxMinutes:0};
 for(const job of pending) {
  if(checkpoint)break;
  const reason=job.openQuestions.length?'job-questions':job.auto.environment==='manual'?'manual-environment':!allowed.has(job.workflow)?'reserved-workflow':null;
  if(reason){checkpoint={jobId:job.id,reason};break;}
  candidateJobIds.push(job.id);
  estimate.minMinutes+=job.estimate.minMinutes;estimate.maxMinutes+=job.estimate.maxMinutes;
 }
 return {advisory:true,authorityGranted:false,candidateJobIds,laterJobIds:pending.slice(candidateJobIds.length).map(j=>j.id),estimate,checkpoint};
}

/** Presentation only: candidates are sequential, not already authorized/verified jobs. */
export function autoASAPWindow(plan) {
 requireThat(plan?.mode==='auto','Explicit auto Plan required');validatePlan(plan,catalog);
 return candidateWindow(plan,0);
}

/** Resume only from the evidence-checked next job, never caller-supplied offsets. */
export function autoASAPStatus(plan,options) {
 const next=nextAutoJob(plan,options);
 if(next.status==='awaiting-terminal-review')return {...next,...candidateWindow(plan,plan.workflows.length)};
 const index=plan.workflows.findIndex(j=>j.id===next.jobId);
 const window=candidateWindow(plan,index);
 if(next.status==='resume-or-report')return {...next,...window,candidateJobIds:[],laterJobIds:plan.workflows.slice(index).map(j=>j.id),estimate:{minMinutes:0,maxMinutes:0},checkpoint:{jobId:next.jobId,reason:next.status}};
 return {...next,...window};
}

// These are auditable local receipts, not authenticated identities or an OS sandbox.
export function presentAutoPlan(plan,{messageId,workRoot,repositories={},issuedAt=Date.now()}) {
 requireThat(plan.mode==='auto'&&text(messageId)&&messageId!==plan.requestId,'Explicit auto Plan and actual presentation message are required');
 const planDigest=validatePlan(plan,catalog).digest;
 requireThat(path.isAbsolute(workRoot)&&Object.values(repositories).every(p=>text(p)&&path.isAbsolute(p)&&fs.existsSync(p)),'Resolve absolute auto Work and repository bindings');
 requireThat(Number.isSafeInteger(issuedAt),'Auto presentation needs a concrete timestamp');
 const expiresAt=issuedAt+plan.auto.maxMinutes*60000;
 const realRepositories=Object.fromEntries(Object.entries(repositories).map(([id,p])=>[id,fs.realpathSync(p)]));
 const workParent=fs.realpathSync(path.dirname(workRoot));
 const binding={planDigest,workRoot,repositories:structuredClone(repositories),realRepositories,workParent,issuedAt,expiresAt};
 return {schema:'starci/auto-presentation@1',messageId,...binding,digest:digest(binding)};
}
export function approveAutoPlan(plan,presentation,receipt) {
 requireThat(digest(presentAutoPlan(plan,presentation))===digest(presentation),'Auto presentation changed');
 requireThat(!plan.openQuestions.length,'Resolve Plan-wide questions before auto delegation');
 requireThat(receipt?.actor==='user'&&receipt.phase==='plan-auto'&&receipt.approved===true&&receipt.digest===presentation.digest&&receipt.replyTo===presentation.messageId&&text(receipt.messageId)&&receipt.messageId!==presentation.messageId&&receipt.messageId!==plan.requestId&&text(receipt.quote)&&receipt.quote!==plan.originalRequest,'An actual later user reply must explicitly delegate this presented auto Plan');
 requireThat(Date.now()>=presentation.issuedAt&&Date.now()<presentation.expiresAt,'Auto presentation expired; present a fresh delegation');
 return {schema:'starci/auto-authorization@1',presentation:structuredClone(presentation),receipt:structuredClone(receipt),startedAt:presentation.issuedAt,expiresAt:presentation.expiresAt};
}
export function assertAutoAuthority(plan,authorization,{active=true}={}) {
 const p=authorization?.presentation,r=authorization?.receipt;
 requireThat(authorization?.schema==='starci/auto-authorization@1'&&p&&r,'Missing auto authorization');
 requireThat(digest(presentAutoPlan(plan,p))===digest(p)&&!plan.openQuestions.length,'Auto Plan or bindings changed');
 requireThat(r.actor==='user'&&r.phase==='plan-auto'&&r.approved===true&&r.digest===p.digest&&r.replyTo===p.messageId&&text(r.messageId)&&r.messageId!==p.messageId&&r.messageId!==plan.requestId&&text(r.quote)&&r.quote!==plan.originalRequest,'Missing actual bound auto delegation');
 requireThat(authorization.startedAt===p.issuedAt&&authorization.expiresAt===p.expiresAt,'Auto budget changed');
 if(active)requireThat(Date.now()>=authorization.startedAt&&Date.now()<authorization.expiresAt,'Auto budget expired or not started; stop and report');
 return p;
}
export function assessAutoGoal(run,assessment) {
 const plan=run.presentation?.scope,job=plan?.workflows.find(j=>j.id===run.presentation.jobId),reasons=[];
 if(plan?.mode!=='auto'||!job?.auto)reasons.push('No explicit auto policy for this job');
 if(!allowed.has(run.goal.workflow))reasons.push('This workflow requires its own explicit manual authority');
 if(!['local','isolated-test'].includes(job?.auto?.environment))reasons.push('Job is a reserved manual checkpoint');
 if(plan?.openQuestions.length||job?.openQuestions.length)reasons.push('Unresolved user checkpoint; agent answers cannot remove it in auto');
 if(!assessment||!['low','medium'].includes(assessment.risk)||assessment.environment!==job?.auto?.environment||assessment.reversible!==true||!text(assessment.reason)||!Array.isArray(assessment.evidence)||!assessment.evidence.length||!assessment.evidence.every(text)||!Array.isArray(assessment.hazards)||assessment.hazards.length)reasons.push('Risk is high, unknown, irreversible, insufficiently grounded or has unresolved hazards');
 if(job) {
  if(!run.goal.scope.business.every(x=>job.auto?.business.includes(x))||!plan.exclusions.every(x=>run.goal.scope.exclusions.includes(x)))reasons.push('Business ceiling or Plan exclusions changed');
  if(!job.criteria.every(x=>run.goal.criteria.includes(x)))reasons.push('Goal omits Plan criteria');
  // Bootstrap scope includes future leaves, but preparation must not complete them.
  if(run.goal.workflow!=='prepare-work'&&!job.workTargets.every(x=>run.goal.workTargets.includes(x)))reasons.push('Goal omits planned Work targets');
  if(!run.goal.resourceEffects.every(e=>job.auto?.resourceEffects.some(a=>digest(a)===digest(e))))reasons.push('Resource operation or postcondition exceeds delegation');
 }
 if(run.goal.workflow==='prepare-work'&&run.goal.cells.some(c=>c.operation!=='prepare'))reasons.push('Import or migration requires manual review');
 for(const impact of run.goal.impacts) {
  const repository=run.repositories[impact.repository];
  if(!repository)continue;
  const target=path.resolve(repository,impact.path);
  let existing=target;while(!fs.existsSync(existing))existing=path.dirname(existing);
  const resolved=path.resolve(fs.realpathSync(existing),path.relative(existing,target));
  if(inside(runtimeRoot,resolved)||['agents.md','claude.md'].includes(path.basename(target).toLowerCase()))reasons.push('Runtime or bootstrap self-modification requires manual authority');
 }
 return {allowed:reasons.length===0,reasons};
}
export function assertAutoGoal(run,{active=true}={}) {
 requireThat(!run.delegated,'Cannot mix scoped manual and auto authority');
 const plan=run.presentation?.scope,p=assertAutoAuthority(plan,run.automatic?.authorization,{active});
 requireThat(run.presentation.scopeDigest===p.planDigest&&run.presentation.goalDigest===run.goalDigest&&run.goalDigest===digest({goal:run.goal,workRoot:run.workRoot,repositories:run.repositories})&&run.scopeDigest===digest({requestId:run.goal.requestId,originalRequest:run.goal.originalRequest,scope:run.goal.scope}),'Auto goal or presented scope changed');
 requireThat(run.workRoot===p.workRoot&&digest(run.repositories)===digest(p.repositories)&&run.goal.requestId===plan.requestId&&run.goal.originalRequest===plan.originalRequest,'Auto repository, Work or request binding changed');
 const job=plan.workflows.find(j=>j.id===run.presentation.jobId);
 requireThat(job?.workflow===run.goal.workflow&&run.goal.workTargets.every(x=>job.workTargets.includes(x))&&run.goal.scope.paths.every(x=>job.paths.includes(x))&&run.goal.scope.resources.every(x=>job.resources.includes(x)),'Auto goal exceeds Plan targets');
 const assessment=assessAutoGoal(run,run.automatic.assessment);
 requireThat(assessment.allowed,'Auto stopped: '+assessment.reasons.join('; '));
 requireThat(run.approvals.some(a=>a.actor==='assistant'&&a.phase==='delegated-goal'&&a.digest===run.goalDigest&&a.authorizationDigest===digest(run.automatic.authorization)&&a.assessmentDigest===digest(run.automatic.assessment)),'Missing delegated goal assessment');
 return true;
}
export function hasAutoAcceptance(run) {
 try {
  assertAutoGoal(run,{active:false});
  return run.resultDigest===digest({goalDigest:run.goalDigest,responses:run.responses})&&run.approvals.some(a=>a.actor==='assistant'&&a.phase==='delegated-acceptance'&&a.digest===run.resultDigest&&a.authorizationDigest===digest(run.automatic.authorization)&&a.approved===true);
 } catch {return false;}
}
export function verifyAutoEvidence(run) {
 requireThat(Object.keys(run.responses).length===run.goal.cells.length,'Incomplete auto result');
 verifyRunWork(run);
 for(const cell of run.goal.cells) {
  const request=run.requests[cell.id],response=run.responses[cell.id];
  requireThat(request&&response?.status==='pass'&&response.requestDigest===digest(request)&&response.goalDigest===run.goalDigest&&response.scopeDigest===run.scopeDigest&&response.op===request.op&&response.operation===request.operation,'Auto response no longer matches its request');
  requireThat(cell.criteria.every(id=>response.criteria.some(c=>c.id===id&&c.status==='pass'&&text(c.observation)&&c.evidence?.length&&c.evidence.every(e=>response.artifacts.some(a=>a.id===e)))),'Missing auto criterion proof');
  requireThat(response.artifacts?.length&&text(run.evidenceRoots?.[cell.id]),'Missing bound auto evidence root');
  const base=fs.realpathSync(run.evidenceRoots[cell.id]);
  for(const artifact of response.artifacts) {
   const file=path.resolve(base,artifact.path);
   requireThat(inside(base,file)&&fs.existsSync(file)&&inside(base,fs.realpathSync(file))&&sha256(fs.readFileSync(file))===artifact.sha256,'Auto evidence is missing, stale or escapes its root');
  }
 }
}
export function verifyAutoPredecessors(run,priorRuns,{throughEnd=false}={}) {
 const plan=run.presentation.scope,index=throughEnd?plan.workflows.length:plan.workflows.findIndex(j=>j.id===run.presentation.jobId);
 requireThat(index>=0,'Unknown Plan workflow');
 for(const job of plan.workflows.slice(0,index)) {
  const prior=priorRuns[job.id];
  requireThat(prior?.status==='done'&&prior.presentation?.scopeDigest===run.presentation.scopeDigest&&digest(prior.presentation.scope)===run.presentation.scopeDigest&&prior.presentation?.jobId===job.id&&prior.goal.workflow===job.workflow&&prior.workRoot===run.workRoot&&digest(prior.repositories)===digest(run.repositories),'Previous Plan workflow is not completed in the same binding');
  requireThat(prior.goalDigest===digest({goal:prior.goal,workRoot:prior.workRoot,repositories:prior.repositories})&&prior.resultDigest===digest({goalDigest:prior.goalDigest,responses:prior.responses}),'Previous workflow proof changed');
  requireThat(!prior.delegated||hasDelegatedAcceptance(prior),'Invalid scoped predecessor acceptance cannot use a user-shaped fallback');
  requireThat(hasAutoAcceptance(prior)||hasDelegatedAcceptance(prior)||prior.approvals.some(a=>a.actor==='user'&&a.phase==='acceptance'&&a.approved===true&&a.digest===prior.resultDigest&&text(a.messageId)),'Previous workflow lacks acceptance');
  verifyAutoEvidence(prior);
  const work=validateWorkspace(prior.workRoot);
  requireThat(scopedWorkStatus(work,prior.goal.workTargets,{done:true,authored:prior.goal.cells.some(c=>c.workPolicy)}).ok,'Previous Work proof is no longer current');
 }
}
export function nextAutoJob(plan,{authorization,runs={}}) {
 const p=assertAutoAuthority(plan,authorization);
 const job=plan.workflows.find(j=>runs[j.id]?.status!=='done');
 verifyAutoPredecessors({presentation:{scope:plan,scopeDigest:p.planDigest,jobId:job?.id},workRoot:p.workRoot,repositories:p.repositories},runs,{throughEnd:!job});
 if(!job)return {status:'awaiting-terminal-review',jobId:null};
 const state=runs[job.id]?.status??'planned';
 if(state!=='planned')return {status:'resume-or-report',jobId:job.id,state};
 return {status:job.openQuestions.length||job.auto.environment==='manual'||!allowed.has(job.workflow)?'needs-user':'needs-risk-assessment',jobId:job.id};
}
export function completeAutoPlan(plan,{authorization,runs,criteria}) {
 requireThat(nextAutoJob(plan,{authorization,runs}).status==='awaiting-terminal-review','Every listed workflow must finish before terminal review');
 requireThat(Array.isArray(criteria)&&criteria.length===plan.completionCriteria.length&&new Set(criteria.map(c=>c?.id)).size===criteria.length,'Review every terminal criterion exactly once');
 for(const expected of plan.completionCriteria) {
  const result=criteria.find(c=>c.id===expected.id);
  requireThat(result?.status==='pass'&&text(result.observation)&&Array.isArray(result.evidence)&&result.evidence.length&&expected.workflowIds.every(id=>result.evidence.some(e=>e.jobId===id)),'Terminal criterion needs an observation and proof from every named producer');
  for(const ref of result.evidence) {
   const response=runs[ref.jobId]?.responses[ref.cellId],proof=response?.criteria.find(c=>c.id===ref.criterionId);
   requireThat(expected.workflowIds.includes(ref.jobId)&&proof?.status==='pass'&&proof.evidence?.length,'Terminal proof must cite a passing criterion from its producing workflow');
  }
 }
 return {schema:'starci/auto-completion@1',actor:'assistant',status:'done',planDigest:authorization.presentation.planDigest,authorizationDigest:digest(authorization),resultDigests:Object.fromEntries(plan.workflows.map(j=>[j.id,runs[j.id].resultDigest])),criteria:structuredClone(criteria)};
}
