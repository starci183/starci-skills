const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const clean=value=>typeof value==='string'?value.trim():'';
const list=value=>Array.isArray(value)?value:[];
const unique=value=>[...new Set(value)];
const riskRank={low:1,medium:2,high:3,critical:4};
const floorRank={probation:1,standard:2,high:3,critical:4};
const RISKS=Object.keys(riskRank),FLOORS=Object.keys(floorRank);
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

export function normalizeWorkload(op={},context={}){
  return {kind:clean(op.kind||op.operation),role:clean(context.role||op.role),domain:clean(context.domain||op.domain||'general'),
    risk:clean(context.risk||op.risk||'medium'),qualityFloor:clean(context.qualityFloor||op.qualityFloor||'standard'),
    tools:unique(list(context.tools||op.tools).map(clean).filter(Boolean)).sort(),contextTokens:Number(context.contextTokens??op.contextTokens??0),
    requiresIndependentReview:Boolean(context.requiresIndependentReview??op.requiresIndependentReview)};
}

function qualification(runtime,evidence,workload,now){
  if(!plain(evidence)||evidence.schema!=='starci/model-qualification@1')return ['model eligibility unavailable'];
  const reasons=[];
  const selectedModel=clean(runtime.model||runtime.target);
  if(!clean(evidence.provider)||!clean(evidence.model)||!clean(evidence.version))reasons.push('model identity qualification is incomplete');
  if(clean(evidence.provider)!==clean(runtime.provider)||clean(evidence.model)!==selectedModel||!clean(runtime.version)||clean(evidence.version)!==clean(runtime.version))reasons.push('qualification does not match selected runtime identity');
  if(!clean(evidence.suite)||!clean(evidence.measuredAt)||!plain(evidence.outcomes))reasons.push('measurable qualification evidence is incomplete');
  if(evidence.verified!==true||evidence.receipt?.schema!=='starci/model-evaluation-receipt@1'||!clean(evidence.receipt?.artifact?.sha256))reasons.push('verified evaluator artifact receipt is missing');
  const measured=Date.parse(evidence.measuredAt),expires=Date.parse(evidence.expiresAt??'');
  if(!Number.isFinite(measured)||measured>now())reasons.push('qualification date is invalid');
  if(evidence.expiresAt&&!Number.isFinite(expires)||Number.isFinite(expires)&&expires<=now())reasons.push('qualification is stale');
  if(!['independent-eval','verified-runtime-eval'].includes(evidence.source)||evidence.attestation==='self-claimed')reasons.push('qualification provenance is not trusted');
  if(!RISKS.includes(workload.risk))reasons.push(`unknown workload risk ${workload.risk||'(empty)'}`);
  if(!FLOORS.includes(workload.qualityFloor))reasons.push(`unknown quality floor ${workload.qualityFloor||'(empty)'}`);
  if(!list(evidence.workloads).some(item=>item===workload.kind||item==='*'))reasons.push(`workload ${workload.kind||'(unknown)'} is not qualified`);
  if(!list(evidence.domains).some(item=>item===workload.domain||item==='*'))reasons.push(`domain ${workload.domain} is not qualified`);
  for(const tool of workload.tools)if(!list(evidence.tools).includes(tool))reasons.push(`required tool ${tool} is not qualified`);
  if(workload.contextTokens>Number(evidence.maxContextTokens??0))reasons.push('required context exceeds qualified context');
  if((floorRank[evidence.qualityFloor]??0)<(floorRank[workload.qualityFloor]??2))reasons.push(`quality floor ${workload.qualityFloor} is not met`);
  if((riskRank[evidence.maxRisk]??0)<(riskRank[workload.risk]??2))reasons.push(`risk ${workload.risk} is not qualified`);
  if(evidence.outcomes.status!=='pass'||Number(evidence.outcomes.cases??0)<1||Number(evidence.outcomes.passRate??0)<Number(evidence.thresholds?.minPassRate??1))reasons.push('qualification outcomes do not pass');
  return reasons;
}

/** Bootstrap is scoped probation, never manufactured qualification. Strict oracle and independent review remain mandatory. */
function probationReasons(runtime,probation,workload){
  if(!plain(probation)||probation.schema!=='starci/model-probation@1'||probation.status!=='active')return ['model eligibility unavailable'];
  const reasons=[];
  if(clean(probation.provider)!==clean(runtime.provider)||clean(probation.model)!==clean(runtime.model||runtime.target))reasons.push('probation does not match selected runtime identity');
  if(!RISKS.includes(workload.risk))reasons.push(`unknown workload risk ${workload.risk||'(empty)'}`);
  if(!FLOORS.includes(workload.qualityFloor))reasons.push(`unknown quality floor ${workload.qualityFloor||'(empty)'}`);
  if(!clean(probation.scopeId)||!list(probation.workloads).includes(workload.kind))reasons.push('probation does not cover this workload');
  if(!probation.strictMachineGates||!probation.independentReview||!probation.noExternalEffects)reasons.push('probation strict gates are incomplete');
  if((riskRank[workload.risk]??2)>riskRank.medium||['high','critical'].includes(workload.qualityFloor))reasons.push('probation cannot satisfy elevated quality or risk');
  if(Number(probation.remainingAttempts??0)<1)reasons.push('probation attempts are exhausted');
  return reasons;
}

export function evaluateModelEligibility({runtime,evidence,probation=null,workload,role,now=Date.now()}={}){
  const job=normalizeWorkload(workload??{},{role});
  if(!plain(runtime)||!clean(runtime.provider)||!clean(runtime.model||runtime.target))return {eligible:false,reasons:['model eligibility unavailable'],mode:null,workload:job};
  let reasons=qualification(runtime,evidence,job,()=>now);
  let mode='qualified';
  if(reasons.length&&probation){reasons=probationReasons(runtime,probation,job);mode='probation';}
  return {eligible:reasons.length===0,reasons,mode:reasons.length?null:mode,workload:job,
    qualification:reasons.length?null:{provider:runtime.provider,model:runtime.model||runtime.target,evidenceId:clean(evidence?.id)||null,scopeId:mode==='probation'?probation.scopeId:null}};
}

function readRecord(file,{optional=false,fallback=null}={}){try{const bytes=fs.readFileSync(file);return {bytes,value:file.endsWith('.json')?JSON.parse(bytes):parseYaml(bytes.toString('utf8'))};}catch(error){if(optional&&error.code==='ENOENT')return {bytes:null,value:fallback};throw error;}}
/** Load only evaluator receipts whose artifact hash resolves inside the declared qualification root. */
export function loadModelEligibilityContext({policyFile,qualificationsFile,probationsFile=null,root=path.dirname(qualificationsFile)}={}){
  const policy=readRecord(policyFile).value,records=readRecord(qualificationsFile,{optional:true,fallback:{qualifications:[]}}).value,base=fs.realpathSync(path.resolve(root)),accepted={};
  if(policy?.schema!=='starci/model-capability-policy@1')throw Error('Model capability policy is unavailable');
  for(const record of list(records?.qualifications??records)){
    const artifact=record?.receipt?.artifact,relative=clean(artifact?.path),candidate=path.resolve(base,relative);
    if(!relative||!(candidate===base||candidate.startsWith(base+path.sep)))continue;
    let bytes,file;try{file=fs.realpathSync(candidate);if(!(file===base||file.startsWith(base+path.sep)))continue;bytes=fs.readFileSync(file);}catch{continue;}
    if(sha256(bytes)!==clean(artifact.sha256))continue;
    const id=clean(record.runtimeId);if(id)accepted[id]={...record,verified:true};
  }
  const probation=probationsFile?readRecord(probationsFile,{optional:true,fallback:{}}).value:{};
  return {policy,evidenceByRuntime:accepted,probationByRuntime:plain(probation?.probations)?probation.probations:plain(probation)?probation:{},
    eligibility:(job,runtime)=>evaluateModelEligibility({runtime,evidence:accepted[runtime.id],probation:(plain(probation?.probations)?probation.probations:probation)?.[runtime.id],workload:job,role:job.role})};
}

const HIGH_KINDS=['integration.verify','release.deliver','deployment.operate','data.correct','production.deploy'];
const MODEL_KINDS=['model.assessGoal','model.planOp','model.decide','model.validateOp'];
export function workloadFor(op={},state={}){
  const declared=clean(op.kind||op.operation),functionName=clean(op.input?.functionName||op.functionName),kind=declared==='model'&&functionName?`model.${functionName}`:declared;
  const modelFunction=MODEL_KINDS.includes(kind)||op.jobType==='model-function'||declared==='judge';
  const external=list(op.externalEffects||op.resourceEffects).some(effect=>typeof effect==='string'?effect!=='none':effect?.external!==false);
  const elevated=HIGH_KINDS.includes(kind)||['high','critical'].includes(op.risk)||['high','critical'].includes(op.qualityFloor);
  const checks=list(op.checks),reviewPlanned=op.independentReview?.required===true&&op.independentReview?.freshContext===true;
  const workload=normalizeWorkload({...op,kind},{role:op.role,domain:op.domain||'general',risk:elevated?'high':op.risk||'medium',qualityFloor:elevated?'high':op.qualityFloor||'standard',tools:modelFunction?[]:op.tools||[]});
  return {...workload,scope:'local',approved:state.approved===true,noExternalEffects:!external,
    strictMachineGates:modelFunction||checks.length>0,freshIndependentReview:modelFunction||reviewPlanned,
    probationEligible:!elevated&&!external&&(modelFunction||(checks.length>0&&reviewPlanned))};
}

const localProbationAllowed=job=>job?.approved===true&&job?.scope==='local'&&job?.noExternalEffects===true
  &&job?.strictMachineGates===true&&job?.freshIndependentReview===true&&job?.probationEligible===true&&!HIGH_KINDS.includes(job?.kind);

function probationUnavailableReasons(job,scope,budget){
  const reasons=[];
  if((scope?.remaining??2)<1)reasons.push('probation attempts are exhausted for this operation workload');
  if(Number(budget?.remaining??0)<1)reasons.push('workflow probation budget is exhausted');
  if(job?.approved!==true)reasons.push('probation requires an approved workflow');
  if(job?.scope!=='local')reasons.push('probation requires local scope');
  if(job?.noExternalEffects!==true)reasons.push('probation forbids external effects');
  if(job?.strictMachineGates!==true)reasons.push('probation requires declared machine gates');
  if(job?.freshIndependentReview!==true)reasons.push('probation requires fresh independent review');
  if(HIGH_KINDS.includes(job?.kind)||['high','critical'].includes(job?.risk)||['high','critical'].includes(job?.qualityFloor))
    reasons.push('probation cannot satisfy elevated quality or risk');
  return unique(reasons);
}

/** Bind the profile and workflow once; the returned callback is directly injectable into scheduler/engine. */
export function createWorkflowModelEligibility({runtimes,state,policyFile,qualificationsFile,probationsFile=null,root,now=Date.now}={}){
  if(!plain(runtimes?.runtimes)||!plain(state)||!clean(state.id))throw Error('Workflow model eligibility binding is incomplete');
  const loaded=loadModelEligibilityContext({policyFile,qualificationsFile,probationsFile,root});
  state.modelEligibility=plain(state.modelEligibility)?state.modelEligibility:{probations:{}};
  state.modelEligibility.probations=plain(state.modelEligibility.probations)?state.modelEligibility.probations:{};
  state.modelEligibility.probationScopes=plain(state.modelEligibility.probationScopes)?state.modelEligibility.probationScopes:{};
  // Every operation may need a planner, one native worker and an independent judge. Each workload gets two
  // attempts, while one finite workflow ceiling still prevents runtime/provider switching from minting budget.
  const configuredCeiling=Number(state.engine?.probationCeiling),defaultCeiling=Math.max(6,(Array.isArray(state.ops)?Math.max(1,state.ops.length):1)*6);
  state.modelEligibility.probationBudget=plain(state.modelEligibility.probationBudget)?state.modelEligibility.probationBudget:{remaining:Number.isFinite(configuredCeiling)?Math.max(0,configuredCeiling):defaultCeiling,initial:Number.isFinite(configuredCeiling)?Math.max(0,configuredCeiling):defaultCeiling};
  const runtimeOf=value=>typeof value==='string'?{id:value,...runtimes.runtimes[value]}:value;
  const scopeOf=(job,actual)=>`${state.id}/${clean(job?.opId)||'workflow'}/${clean(actual.kind)||'unknown'}/${clean(actual.role)||'unknown'}`;
  const callback=(job,runtimeValue)=>{
    const runtime=runtimeOf(runtimeValue),id=clean(runtime?.id),actual=workloadFor(job,state),scopeId=scopeOf(job,actual),key=`${id}:${scopeId}`;
    const scope=state.modelEligibility.probationScopes[scopeId]??{remaining:2,initial:2,consumedJobs:[]};state.modelEligibility.probationScopes[scopeId]=scope;
    let probation=state.modelEligibility.probations[key];
    if(!loaded.evidenceByRuntime[id]&&!probation&&localProbationAllowed(actual)&&scope.remaining>0&&state.modelEligibility.probationBudget.remaining>0){
      probation={schema:'starci/model-probation@1',status:'active',provider:clean(runtime.provider),model:clean(runtime.model||runtime.target),scopeId,
        workloads:[clean(actual.kind)],strictMachineGates:true,independentReview:true,noExternalEffects:true,remainingAttempts:scope.remaining,createdAt:now()};
      state.modelEligibility.probations[key]=probation;
    }
    const evidence=loaded.evidenceByRuntime[id],decision=evaluateModelEligibility({runtime,evidence,probation,workload:actual,role:actual.role,now:now()});
    if(evidence||decision.eligible)return decision;
    const detail=probation?.status==='exhausted'
      ?probationUnavailableReasons(actual,scope,state.modelEligibility.probationBudget)
      :probation
        ?decision.reasons
      :probationUnavailableReasons(actual,scope,state.modelEligibility.probationBudget);
    return {...decision,reasons:['model qualification evidence is missing',...detail]};
  };
  // Execution chains are keyed by target/model IDs. Qualified targets may fall through; probation admits exactly
  // one target for one durable job so an internal fallback can never execute an unconsumed probation candidate.
  const providerFilter=job=>{
    const candidates=Object.entries(runtimes.runtimes).map(([id,pool])=>({id,...pool}));
    const qualified=candidates.filter(runtime=>loaded.evidenceByRuntime[runtime.id]
      &&evaluateModelEligibility({runtime,evidence:loaded.evidenceByRuntime[runtime.id],workload:workloadFor(job,state),role:job?.role,now:now()}).eligible)
      .map(runtime=>runtime.target??runtime.id);
    if(qualified.length)return [...new Set(qualified)];
    for(const runtime of candidates)if(callback(job,runtime).eligible)return [runtime.target??runtime.id];
    return [];
  };
  const consumeProbation=(job,runtimeValue)=>{
    const runtime=runtimeOf(runtimeValue),actual=workloadFor(job,state),scopeId=scopeOf(job,actual),entry=state.modelEligibility.probations[`${clean(runtime?.id)}:${scopeId}`],scope=state.modelEligibility.probationScopes[scopeId],jobId=clean(job?.jobId);
    if(!jobId)return {ok:false,code:'probation-job-id-required'};
    if(scope?.consumedJobs?.includes(jobId))return {ok:true,code:'probation-consumed-cached',scopeId,remainingAttempts:scope.remaining};
    if(!entry||entry.scopeId!==scopeId||entry.status!=='active'||!scope||scope.remaining<1||state.modelEligibility.probationBudget.remaining<1)return {ok:false,code:'probation-unavailable'};
    scope.remaining-=1;scope.consumedJobs=[...(scope.consumedJobs??[]),jobId];scope.consumedReceipts=[...(scope.consumedReceipts??[]),
      {jobId,runtimeId:clean(runtime?.id),workflowId:clean(job?.workflowId),opId:clean(job?.opId),generation:job?.generation??null,at:now()}];state.modelEligibility.probationBudget.remaining-=1;
    for(const [key,item] of Object.entries(state.modelEligibility.probations))if(key.endsWith(`:${scopeId}`)){item.remainingAttempts=scope.remaining;if(scope.remaining===0)item.status='exhausted';}
    return {ok:true,code:'probation-consumed',scopeId,remainingAttempts:scope.remaining};
  };
  const refundProbation=(job,runtimeValue,proof={})=>{
    const runtime=runtimeOf(runtimeValue),actual=workloadFor(job,state),scopeId=scopeOf(job,actual),scope=state.modelEligibility.probationScopes[scopeId],jobId=clean(job?.jobId);
    const valid=proof?.code==='native-execution-never-began'&&proof.effectState==='none'&&proof.taskCreated===false&&proof.inputAccepted===false&&clean(proof.attestationId)&&
      clean(proof.jobId)===jobId&&String(proof.generation)===String(job?.generation)&&clean(proof.workflowId)===clean(job?.workflowId)&&clean(proof.opId)===clean(job?.opId)&&clean(proof.runtimeId)===clean(runtime?.id);
    if(!valid)return {ok:false,code:'probation-refund-proof-invalid'};
    if(!scope?.consumedJobs?.includes(jobId))return {ok:false,code:'probation-job-not-consumed'};
    const consumed=scope.consumedReceipts?.find(item=>item.jobId===jobId),binding=proof?.journalBinding;
    const legacyBound=binding?.source==='durable-journal'&&binding.status==='cancelled'&&clean(binding.jobId)===jobId&&clean(binding.workflowId)===clean(job?.workflowId)&&
      clean(binding.opId)===clean(job?.opId)&&String(binding.generation)===String(job?.generation)&&clean(binding.runtimeId)===clean(runtime?.id)&&clean(binding.role)===clean(job?.role)&&clean(proof.legacyNoEffectEventId);
    if(consumed?(consumed.runtimeId!==clean(runtime?.id)||consumed.workflowId!==clean(job?.workflowId)||consumed.opId!==clean(job?.opId)||String(consumed.generation)!==String(job?.generation)):
      !legacyBound)return {ok:false,code:'probation-consumption-identity-mismatch'};
    scope.refundedJobs=Array.isArray(scope.refundedJobs)?scope.refundedJobs:[];
    if(scope.refundedJobs.some(item=>item.jobId===jobId))return {ok:true,code:'probation-refund-cached',scopeId,remainingAttempts:scope.remaining};
    scope.refundedJobs.push({jobId,attestationId:proof.attestationId,generation:job.generation,runtimeId:runtime.id,at:now()});
    scope.remaining=Math.min(scope.initial,scope.remaining+1);
    const budget=state.modelEligibility.probationBudget;budget.remaining=Math.min(budget.initial,budget.remaining+1);
    for(const [key,item] of Object.entries(state.modelEligibility.probations))if(key.endsWith(`:${scopeId}`)){item.remainingAttempts=scope.remaining;if(scope.remaining>0&&item.status==='exhausted')item.status='active';}
    return {ok:true,code:'probation-refunded',scopeId,remainingAttempts:scope.remaining,attestationId:proof.attestationId};
  };
  return {...loaded,eligibility:callback,providerFilter,consumeProbation,refundProbation};
}

export function eligibleCandidates({candidates=[],evidenceByRuntime={},probationByRuntime={},workload,role,now=Date.now()}={}){
  return candidates.map(runtime=>({runtime,result:evaluateModelEligibility({runtime,evidence:evidenceByRuntime[runtime.id],probation:probationByRuntime[runtime.id],workload,role,now})}));
}

/** Quota can order eligible candidates; it can never make an ineligible model eligible or lower the floor. */
export function selectEligibleCandidate(options={}){
  const reviewed=eligibleCandidates(options),ready=reviewed.filter(item=>item.result.eligible);
  ready.sort((a,b)=>Number(options.budget?.[b.runtime.id]?.remaining??0)-Number(options.budget?.[a.runtime.id]?.remaining??0)||String(a.runtime.id).localeCompare(String(b.runtime.id)));
  return ready.length?{ok:true,runtime:ready[0].runtime,eligibility:ready[0].result,reviewed}:{ok:false,reason:'no eligible model',reviewed};
}

export function reviewerPolicy({candidate,authorAttempt,reviewEvidence,workload,now=Date.now()}={}){
  const base=evaluateModelEligibility({runtime:candidate,evidence:reviewEvidence,workload:{...normalizeWorkload(workload),requiresIndependentReview:true},role:'verify',now});
  const reasons=[...base.reasons];
  if(!plain(authorAttempt)||!clean(authorAttempt.attemptId))reasons.push('author attempt identity is missing');
  if(!clean(candidate?.attemptId)||candidate.attemptId===authorAttempt?.attemptId)reasons.push('review must use a distinct attempt');
  if(!candidate?.freshContext)reasons.push('review context is not fresh');
  if(candidate?.inheritsAuthorConversation)reasons.push('review inherits author hidden context');
  if(clean(candidate?.contextDigest)&&candidate.contextDigest===clean(authorAttempt?.hiddenContextDigest))reasons.push('review context includes author hidden history');
  return {eligible:reasons.length===0,reasons,qualification:base.qualification,
    independent:reasons.length===0,providerDifferent:clean(candidate?.provider)!==clean(authorAttempt?.provider),modelDifferent:clean(candidate?.model||candidate?.target)!==clean(authorAttempt?.model)};
}
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {parseYaml} from '../core/yaml.mjs';
