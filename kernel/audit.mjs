import crypto from 'node:crypto';
import {canonicalJSON,sha256} from '../core/index.mjs';
import {CODE_PATTERN_REPORT,verifyCodePatternReportDigest} from '../scripts/check-scoped-lint.mjs';

/** Read-only measurement modes carried by review.verify. They are never delivery or repair verdicts. */
export const AUDIT_OPERATIONS=Object.freeze(['stales','lint']);

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const digest=value=>crypto.createHash('sha256').update(String(value??'')).digest('hex');

export function normalizeAuditOperation(kind,operation,{label='operation'}={}){
  if(operation===undefined||operation===null)return null;
  if(kind!=='review.verify'||typeof operation!=='string'||!AUDIT_OPERATIONS.includes(operation))
    throw Error(`${label} must be one of ${AUDIT_OPERATIONS.join(', ')} on review.verify only`);
  return operation;
}

export const isAuditOperation=op=>op?.kind==='review.verify'&&AUDIT_OPERATIONS.includes(op?.operation);

function commandProtocol(command){
  const value=String(command??'').trim().replaceAll('\\','/');
  if(!value||/[;&|`<>\r\n]|\$\(/.test(value))return null;
  const starci='(?:starci(?:\\.cmd|\\.exe)?|node(?:\\.exe)?\\s+(?:"[^"]*bin/starci\\.mjs"|\'[^\']*bin/starci\\.mjs\'|\\S*bin/starci\\.mjs))';
  if(new RegExp(`^${starci}\\s+check-stales(?:\\s|$)`,'i').test(value)||
    /^node(?:\.exe)?\s+(?:"[^"]*scripts\/check-stales\.mjs"|'[^']*scripts\/check-stales\.mjs'|\S*scripts\/check-stales\.mjs)(?:\s|$)/i.test(value))return 'stales';
  if(new RegExp(`^${starci}\\s+architecture\\s+check(?:\\s|$)`,'i').test(value))return 'architecture';
  if(new RegExp(`^${starci}\\s+stacks\\s+check(?:\\s|$)`,'i').test(value))return 'stacks';
  if(new RegExp(`^${starci}\\s+validate(?:\\s|$)`,'i').test(value))return 'work';
  if(/^node(?:\.exe)?\s+(?:"[^"]*scripts\/check-scoped-lint\.mjs"|'[^']*scripts\/check-scoped-lint\.mjs'|\S*scripts\/check-scoped-lint\.mjs)(?:\s|$)/i.test(value))return 'code-pattern';
  return 'shell';
}

export function auditDefinitionErrors(op){
  if(op?.operation===undefined||op?.operation===null)return [];
  try{normalizeAuditOperation(op.kind,op.operation,{label:`operation mode of ${op.id??'operation'}`});}catch(error){return [String(error.message??error)];}
  const checks=Array.isArray(op.checks)?op.checks:[];
  if(!checks.length)return [`${op.operation} audit ${op.id??'operation'} needs at least one exact check command`];
  if(checks.some(check=>commandProtocol(check?.command)===null))
    return [`${op.operation} audit ${op.id??'operation'} contains an empty or compound shell command`];
  if(op.operation==='stales'&&(checks.length!==1||commandProtocol(checks[0]?.command)!=='stales'))
    return [`stales audit ${op.id??'operation'} needs exactly one direct starci check-stales command`];
  return [];
}

function parsed(stdout){
  try{return JSON.parse(String(stdout??'').trim());}catch{return null;}
}

function structured(protocol,result,exitCode){
  const value=parsed(result?.stdout);
  if(!plain(value))return {ok:false,reason:`${protocol} returned no parseable JSON report`};
  if(protocol==='stales'){
    const unsigned={...value};delete unsigned.reportDigest;
    const digest64=input=>typeof input==='string'&&/^[a-f0-9]{64}$/.test(input),id=input=>typeof input==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(input);
    const statuses=new Set(['verified-conforming','revalidation-needed','known-drift','missing','unverifiable']);
    const categories=new Set(['source-drift','evidence-invalid','input-unavailable','contract-drift','stack-drift']);
    const layers=new Set(['source','work','stack']);
    const routes=new Set(['business.decide','architecture.decide','backend.implement','interface.implement','runtime.operate','review.verify']);
    const coverage=plain(value.coverage)&&value.coverage.mode==='canonical-work'&&typeof value.coverage.closure==='string'&&value.coverage.closure.length>0&&
      Array.isArray(value.coverage.selectedNodeIds)&&value.coverage.selectedNodeIds.every(id)&&Array.isArray(value.coverage.sourceBindings);
    const inputs=plain(value.currentInputs)&&plain(value.currentInputs.work)&&typeof value.currentInputs.work.ok==='boolean'&&
      Number.isInteger(value.currentInputs.work.selectedNodes)&&value.currentInputs.work.selectedNodes>=0&&digest64(value.currentInputs.work.snapshotDigest)&&
      Array.isArray(value.currentInputs.repositories)&&value.currentInputs.repositories.length>0&&value.currentInputs.repositories.every(repo=>plain(repo)&&id(repo.id)&&
        typeof repo.root==='string'&&/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(repo.head)&&typeof repo.dirty==='boolean'&&
        (repo.originDigest===null||digest64(repo.originDigest))&&typeof repo.credentialFreeOrigin==='boolean'&&digest64(repo.snapshotDigest));
    const subjects=Array.isArray(value.subjects)&&value.subjects.every(subject=>plain(subject)&&id(subject.id)&&typeof subject.path==='string'&&
      typeof subject.kind==='string'&&digest64(subject.inputDigest)&&typeof subject.effectiveState==='string'&&statuses.has(subject.status)&&
      Array.isArray(subject.findingIds)&&subject.findingIds.every(id));
    const findings=Array.isArray(value.findings)&&value.findings.every(finding=>plain(finding)&&id(finding.id)&&typeof finding.bindingId==='string'&&
      (finding.nodeId===null||id(finding.nodeId))&&categories.has(finding.category)&&statuses.has(finding.status)&&layers.has(finding.layer)&&
      typeof finding.code==='string'&&typeof finding.detail==='string'&&routes.has(finding.route)&&routes.has(finding.operator)&&
      (finding.impactSetId===null||id(finding.impactSetId))&&Object.hasOwn(finding,'expected')&&Object.hasOwn(finding,'observed')&&Object.hasOwn(finding,'repairCandidate'));
    const shape=value.schema==='starci/source-staleness-report@1'&&typeof value.workRoot==='string'&&value.workRoot.length>0&&
      Array.isArray(value.targets)&&new Set(value.targets).size===value.targets.length&&value.targets.every(target=>typeof target==='string'&&target.length>0)&&
      digest64(value.baselineDigest)&&typeof value.clean==='boolean'&&coverage&&Array.isArray(value.limitations)&&value.limitations.length>0&&
      value.limitations.every(limit=>typeof limit==='string'&&limit.length>0)&&plain(value.impactGraph)&&Array.isArray(value.impactGraph.edges)&&
      Array.isArray(value.impactGraph.impactSets)&&inputs&&subjects&&findings&&digest64(value.reportDigest)&&
      value.reportDigest===sha256(canonicalJSON(unsigned));
    if(!shape)return {ok:false,reason:'check-stales returned a malformed report'};
    const count=value.findings.length,consistent=exitCode===0?value.clean&&count===0:exitCode===1?!value.clean&&count>0:false;
    return consistent?{ok:true,outcome:exitCode===0?'clean':'findings',count,schema:value.schema,resultDigest:value.reportDigest}:
      {ok:false,reason:`check-stales exit ${exitCode} contradicts its clean/findings report`};
  }
  if(protocol==='architecture'){
    const count=Array.isArray(value.violations)?value.violations.length:0;
    const shape=value.schema==='starci/architecture-check@1'&&typeof value.ok==='boolean'&&Array.isArray(value.violations)&&Array.isArray(value.errors);
    if(!shape)return {ok:false,reason:'architecture check returned a malformed report'};
    if(value.errors.length)return {ok:false,reason:`architecture check could not inspect its inputs (${value.errors.map(error=>error?.ruleId??'unknown').join(', ')})`};
    const consistent=exitCode===0?value.ok&&count===0:exitCode===1?!value.ok&&count>0:false;
    return consistent?{ok:true,outcome:exitCode===0?'clean':'findings',count,schema:value.schema,resultDigest:digest(result.stdout)}:
      {ok:false,reason:`architecture check exit ${exitCode} contradicts its report`};
  }
  if(protocol==='stacks'){
    const shape=value.schema==='starci/application-stacks-check@1'&&typeof value.ok==='boolean'&&Array.isArray(value.errors),count=shape?value.errors.length:0;
    if(!shape)return {ok:false,reason:'stacks check returned a malformed report'};
    const unavailable=value.errors.filter(error=>['environment-invalid','manifest-unavailable','deployment-model-unavailable','input-too-large',
      'manifest-invalid','deployment-model-invalid','source-root-unavailable','source-package-invalid','docker-build-input-unavailable'].includes(error?.code));
    if(unavailable.length)return {ok:false,reason:`stacks check could not inspect its inputs (${unavailable.map(error=>error.code).join(', ')})`};
    const consistent=exitCode===0?value.ok&&count===0:exitCode===1?!value.ok&&count>0:false;
    return consistent?{ok:true,outcome:exitCode===0?'clean':'findings',count,schema:value.schema,resultDigest:digest(result.stdout)}:
      {ok:false,reason:`stacks check exit ${exitCode} contradicts its report`};
  }
  if(protocol==='work'){
    const shape=typeof value.ok==='boolean'&&Array.isArray(value.errors),count=shape?value.errors.length:0;
    if(!shape)return {ok:false,reason:'Work validation returned a malformed report'};
    const unavailable=value.errors.filter(error=>['ROOT','UNSUPPORTED_METADATA','READ','UNSAFE_PATH','FRONTMATTER','METADATA_OBJECT'].includes(error?.code));
    if(unavailable.length)return {ok:false,reason:`Work validation could not inspect its inputs (${unavailable.map(error=>error.code).join(', ')})`};
    const consistent=exitCode===0?value.ok&&count===0:exitCode===1?!value.ok&&count>0:false;
    return consistent?{ok:true,outcome:exitCode===0?'clean':'findings',count,schema:'work/validation-result@1',resultDigest:digest(result.stdout)}:
      {ok:false,reason:`Work validation exit ${exitCode} contradicts its report`};
  }
  if(protocol==='code-pattern'){
    const shape=value.schema===CODE_PATTERN_REPORT&&typeof value.ok==='boolean'&&['clean','findings','unavailable','invalid'].includes(value.status)&&
      plain(value.coverage)&&Array.isArray(value.obligations)&&Array.isArray(value.files)&&Array.isArray(value.issues)&&verifyCodePatternReportDigest(value);
    if(!shape)return {ok:false,reason:'code-pattern check returned a malformed report'};
    if(exitCode===2||['unavailable','invalid'].includes(value.status))return {ok:false,reason:`code-pattern check could not inspect its inputs (${value.issues.map(issue=>issue?.code??'unknown').slice(0,8).join(', ')})`};
    const count=value.issues.length,consistent=exitCode===0?value.ok&&value.status==='clean'&&count===0:
      exitCode===1?!value.ok&&value.status==='findings'&&count>0:false;
    return consistent?{ok:true,outcome:exitCode===0?'clean':'findings',count,schema:value.schema,resultDigest:value.reportDigest}:
      {ok:false,reason:`code-pattern check exit ${exitCode} contradicts its report`};
  }
  return null;
}

/**
 * Re-run exact audit checks. Exit 1 is findings only for a known, parseable StarCi protocol.
 * An arbitrary lint shell command may prove clean with exit 0; its nonzero output never gains repair authority.
 */
export function measureAuditChecks(op,run){
  const definition=auditDefinitionErrors(op);
  if(definition.length)return {ok:false,outcome:'failure',checks:[],failures:definition};
  const checks=[],failures=[];
  let findings=0;
  for(const check of op.checks??[]){
    let execution;try{execution=run(check);}catch(error){execution={status:null,stdout:'',stderr:'',error:String(error?.message??error)};}
    const exitCode=Number.isInteger(execution?.status)?execution.status:null,protocol=commandProtocol(check.command);
    let observation=null;
    if(protocol&&protocol!=='shell')observation=structured(protocol,execution,exitCode);
    else if(exitCode===0)observation={ok:true,outcome:'clean',count:0,schema:'process/exit@1',resultDigest:digest(execution?.stdout)};
    else observation={ok:false,reason:`unstructured check ${check.name} exited ${exitCode??'without a code'}`};
    if(!observation?.ok)failures.push(`${check.name}: ${observation?.reason??'audit check failed without a structured result'}`);
    else if(observation.outcome==='findings')findings+=observation.count;
    checks.push({name:check.name,command:check.command,exitCode:exitCode??1,protocol:protocol??'unsupported',
      outcome:observation?.ok?observation.outcome:'failure',findingCount:observation?.ok?observation.count:0,
      resultSchema:observation?.ok?observation.schema:null,resultDigest:observation?.ok?observation.resultDigest:null,
      evidence:observation?.ok?`${observation.schema} ${observation.outcome}${observation.count?` (${observation.count} finding(s))`:''}`:'audit check output was unavailable or malformed'});
  }
  if(failures.length)return {ok:false,outcome:'failure',checks,failures};
  return {ok:true,outcome:findings?'findings':'clean',checks,failures:[],findings};
}
