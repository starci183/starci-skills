import {readFileSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {mutateSession} from './session-lock.mjs';
import {retainContext,readContext,missionAt,invocationState} from './mission-history.mjs';
import {scopeHash,frozenScopeErrors} from './mission-scope.mjs';
import {validateAgainst} from './json-schema.mjs';
import {evidenceManifestErrors} from './evidence-manifest.mjs';
import {restatementDecisionId,restatementChoiceSource} from './restatement-choice.mjs';
const json=file=>JSON.parse(readFileSync(file,'utf8'));
const sha=value=>'sha256:'+createHash('sha256').update(value).digest('hex');
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const fail=message=>{throw Error('RESTATEMENT_DELEGATION_INVALID: '+message);};
const policy=root=>json(path.join(root,'resources/interaction.json')).delegatedRestatement;
function schema(root,kind,value){const errors=validateAgainst(json(path.join(root,`templates/kinds/restatement-${kind}.schema.json`)),value,kind);if(errors.length)fail(errors.join('\n'));}
function approved(session,state,scope,root){
 const record=missionAt(session,state,scope.missionVersion);
 if(scope.sessionId!==state.id||scope.scopeHash!==scopeHash(record.mission)||scope.missionVersion!==state.mission.version||scopeHash(state.mission)!==scope.scopeHash)fail('current confirmed mission/version/scope differs');
 const errors=frozenScopeErrors(state,{root});if(errors.length)fail(errors.join('\n'));
 return record;
}
function coordinator(session,state,coordinatorSession){
 const directory=realpathSync(coordinatorSession),other=json(path.join(directory,'state.json'));
 if(directory===realpathSync(session)||other.id===state.id||other.hostBinding?.hostId===state.hostBinding?.hostId)fail('a workflow cannot grant its own restatement authority');
 if(other.topology?.mode!=='coordinated'||!other.hostBinding?.hostId||!other.hostBinding?.kind)fail('the user-designated reviewer must have a bound coordinator identity');
 return {session:directory,sessionId:other.id,hostBinding:other.hostBinding};
}
export async function recordRestatementDelegation(root,session,grant){
 schema(root,'delegation',grant);const rule=policy(root);
 if(grant.selectedBy!==rule.grantSource||grant.operators.some(operator=>!rule.operators.includes(operator)))fail('only an explicit user grant for the declared restatement operators is allowed');
 return mutateSession(session,async state=>{
  approved(session,state,grant.scope,root);
  const reviewer=coordinator(session,state,grant.coordinatorSession);
  const record={version:1,grant,coordinator:reviewer,mission:state.missionSnapshots[grant.scope.missionVersion]};
  const basis=await retainContext(session,rule.grantContext,record),decisionId=`restatement-delegation:${basis.hash.slice(7)}`;
  const choice={selected:rule.grantSelection,selectedBy:rule.grantSource,sourceRef:grant.sourceRef,basis};
  if(state.choices?.[decisionId]&&!same(state.choices[decisionId],choice))fail('the original user delegation is immutable');
  state.choices??={};state.choices[decisionId]=choice;return{decisionId,...choice};
 });
}
function grantOf(root,session,state,decisionId,scope,{fresh=true}={}){
 const rule=policy(root),choice=state.choices?.[decisionId];
 if(!choice||choice.selectedBy!==rule.grantSource||choice.selected!==rule.grantSelection)fail('missing actual user delegation');
 const record=readContext(session,choice.basis,rule.grantContext);schema(root,'delegation',record.grant);
 if(decisionId!==`restatement-delegation:${choice.basis.hash.slice(7)}`||choice.sourceRef!==record.grant.sourceRef||record.grant.selectedBy!==rule.grantSource||!same(record.grant.scope,scope)||!same(record.mission,state.missionSnapshots?.[scope.missionVersion]))fail('delegation does not bind the exact retained approval');
 if(record.grant.operators.some(operator=>!rule.operators.includes(operator)))fail('delegation includes a non-restatement operator');
 if(fresh&&!same(coordinator(session,state,record.grant.coordinatorSession),record.coordinator))fail('coordinator identity changed');
 return record;
}
function clause(mission,pointer,rule){
 const tokens=pointer.split('/').slice(1).map(token=>token.replaceAll('~1','/').replaceAll('~0','~'));
 if(!pointer.startsWith('/')||!rule.scopeFields.includes(tokens[0]))fail('mapping must name an approved scope clause');
 let value=mission;for(const token of tokens){if(!value||typeof value!=='object'||!Object.hasOwn(value,token))fail('mapped scope clause does not exist');value=value[token];}
 if(typeof value!=='string'||!value.trim())fail('mapped scope clause must be explicit text');return value;
}
async function reviewBinding(root,session,state,branch,review,{fresh=true}={}){
 schema(root,'delegated-review',review);const rule=policy(root),scope={sessionId:state.id,missionVersion:review.goalVersion,scopeHash:review.scopeHash};
 const record=approved(session,state,scope,root),grant=grantOf(root,session,state,review.delegationId,scope,{fresh});
 if(path.resolve(review.coordinatorSession)!==path.resolve(grant.grant.coordinatorSession)||(fresh&&realpathSync(review.coordinatorSession)!==grant.coordinator.session))fail('decision was not reviewed by the delegated coordinator');
 const request=json(path.join(branch,'request/request.json')),response=json(path.join(branch,'response/response.json')),cell=`${request.step}/${request.parallel}`,attempt=state.attempts?.[cell];
 if(!grant.grant.operators.includes(request.operatorId)||request.exchange||request.expected?.goalVersion!==review.goalVersion)fail('operator or mission is outside the delegation');
 if(attempt?.status!=='blocked'||attempt.id!==request.attempt.id||response.stop!=='RESTATEMENT_UNCONFIRMED'||response.status!=='blocked')fail('review needs the exact accepted blocked reading');
 if(attempt.requestRef!==`step-${request.step}/parallel-${request.parallel}/request/request.json`||attempt.responseRef!==`step-${request.step}/parallel-${request.parallel}/response/response.json`||state.requestHashes?.[cell]!==review.requestHash)fail('review request has no exact accepted authority');
 if(sha(readFileSync(path.join(branch,'request/request.json')))!==review.requestHash)fail('reviewed request bytes changed');
 if(!attempt.context)fail('reading has no retained invocation authority');invocationState(session,state,request);
 const text=readFileSync(path.join(branch,'response/restatement.md'),'utf8');if(sha(text)!==review.restatementHash)fail('reviewed restatement bytes changed');
 const subject=/^# restatement — ([a-z0-9][a-z0-9-]*)\r?$/m.exec(text)?.[1],decisionId=restatementDecisionId(request,subject,text);
 if(!subject||response.interaction?.decisionId!==decisionId)fail('reading does not bind its exact decision identity');
 const errors=await evidenceManifestErrors(branch,attempt.evidenceManifest);if(errors.length)fail(errors.join('\n'));
 const {tableUnder}=await import('./validate-response.mjs'),lines=tableUnder(text,'## Restatement')??[];
 if(review.lines.length!==lines.length||new Set(review.lines.map(line=>line.line)).size!==lines.length)fail('every rendered line needs its own reviewed scope mapping');
 for(const [number,statement]of lines){const mapped=review.lines.find(line=>line.line===Number(number));if(!mapped||mapped.statementHash!==sha(statement))fail('reviewed line bytes or ordinal differ');for(const ref of mapped.clauses)if(ref.hash!==sha(clause(record.mission,ref.pointer,rule)))fail('mapped approved clause changed');}
 const exclusions=(record.mission.excludes??[]).map((text,index)=>({index,hash:sha(text)}));if(!same(review.exclusions,exclusions))fail('review must account for every frozen exclusion');
 return{decisionId,request,grant};
}
export async function recordDelegatedRestatementReview(root,branch,review){
 branch=path.resolve(branch);const session=path.dirname(path.dirname(branch));
 return mutateSession(session,async state=>{
  const binding=await reviewBinding(root,session,state,branch,review);
  const {validateStep}=await import('./validate-step.mjs');const checked=await validateStep(root,branch,{operator:true,requestPhase:'accept'});if(checked.errors.length)fail(checked.errors.join('\n'));
  const rule=policy(root),value={version:1,review,mission:state.missionSnapshots[review.goalVersion],coordinator:binding.grant.coordinator};
  const existing=state.choices?.[binding.decisionId];
  if(existing){if(existing.selectedBy!=='coordinator'||!same(readContext(session,existing.basis,rule.reviewContext),value))fail('preserve the original answer or delegated decision');return{decisionId:binding.decisionId,...existing};}
  const basis=await retainContext(session,rule.reviewContext,value),choice={selected:review.selected,selectedBy:'coordinator',sourceRef:review.sourceRef,basis};
  state.choices??={};state.choices[binding.decisionId]=choice;return{decisionId:binding.decisionId,...choice};
 });
}
export async function delegatedRestatementErrors(root,branch,state,request,{phase='predispatch'}={}){
 const choice=state.choices?.[request.decisionId];if(choice?.selectedBy!=='coordinator')return[];
 try{
  if(!request.resume||request.exchange||!String(request.decisionId).startsWith('restatement:'))fail('delegation authorizes only a same-scope restatement continuation');
  const session=path.dirname(path.dirname(branch)),rule=policy(root),record=readContext(session,choice.basis,rule.reviewContext);
  if(!same(record.mission,state.missionSnapshots?.[request.expected?.goalVersion])||choice.selected!=='as-stated'||choice.sourceRef!==record.review.sourceRef||record.review.selectedBy!=='coordinator')fail('decision differs from the retained coordinator review');
  const previous=path.join(session,`step-${request.resume.step}/parallel-${request.resume.parallel}`);
  const binding=await reviewBinding(root,session,state,previous,record.review,{fresh:phase!=='accept'});
  if(binding.decisionId!==request.decisionId||request.operatorId!==binding.request.operatorId||request.expected?.goalVersion!==record.review.goalVersion||request.selectedOption!==choice.selected)fail('decision cannot be reused for a different reading/operator/goal');
  if(!same(record.coordinator,binding.grant.coordinator))fail('reviewer does not match the delegated identity');
  return[];
 }catch(error){return[error.message];}
}
