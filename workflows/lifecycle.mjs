import {validatePlan,planProgress} from './plan.mjs';
import {verifyPresentation} from './presentation.mjs';
import {stateRoot,assertNewStoragePath,isLocalOnlyWorkspace} from './storage.mjs';
import {assertAutoGoal,hasAutoAcceptance,verifyAutoEvidence,verifyAutoPredecessors,completeAutoPlan} from './auto.mjs';
import {readScopedMandate,validateDelegationSource,assertDelegatedGoal,assertDelegatedAssessment,assertDelegatedDispatch,hasDelegatedAcceptance,verifyDelegatedResult,completeDelegatedPlan,closeScopedMandate} from './delegation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {canonicalJSON,sha256,validateWorkspace,previewCompletion} from '../core/index.mjs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import { readDistJson } from '../core/runtime-root.mjs';
import {resolveExecutionChain} from '../profiles/select.mjs';
import {fileURLToPath} from 'node:url';
import {validBackendRun} from './select.mjs';
import {assertSourceLayout} from './source-layout.mjs';
import {typed} from './typed.mjs';
import {verifyProducerResult,verifyRequiredProducerInputs,hasDirectProducerAcceptance} from './producer-verification.mjs';
import {validateWorkPolicy,requestWorkPolicy,sealWorkResult,verifyRunWork,scopedWorkStatus,inRunWorkReady} from './work-binding.mjs';
const digest=x=>sha256(canonicalJSON(x));
const text=x=>typeof x==='string'&&x.trim().length>0;
const same=(a,b)=>digest(a)===digest(b);
const list=x=>Array.isArray(x)&&x.length>0&&x.every(text)&&new Set(x).size===x.length;
const inside=(root,file)=>{const r=path.relative(root,file);return r!== '..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const catalog=readDistJson('workflows','catalog.json');
const jobs=readDistJson('workflows','jobs.json');
export function resolveProjectSkillPath(moduleUrl=import.meta.url){const base=fileURLToPath(new URL('../',moduleUrl));const candidate=path.join(path.basename(base)==='.dist'?path.dirname(base):base,'SKILL.md');requireThat(fs.existsSync(candidate)&&fs.statSync(candidate).isFile(),'Project StarCi SKILL.md is missing beside this runtime');return fs.realpathSync(candidate);}
const projectSkillPath=resolveProjectSkillPath();
const matrix=(id,operation)=>{if(id==='implement-frontend')return readDistJson('workflows','matrix.json').rows;const workflow=jobs.workflows.find(w=>w.id===id);if(!workflow)return undefined;const rows=structuredClone(workflow.matrix);if(workflow.operations){requireThat(workflow.operations.includes(operation),'Select exactly one supported workflow operation');rows[0][0].operation=operation;}return rows;};
export function workStatus(root){
 requireThat(text(root)&&path.isAbsolute(root),'An absolute Work root is required');
 if(!fs.existsSync(root)||isLocalOnlyWorkspace(root))return {status:'missing',route:'prepare-work'};
 const recoverable=new Set(['STALE_COMPLETION','STALE_EVIDENCE','DEPENDENCY_NOT_DONE']);const checked=validateWorkspace(root),fatal=checked.errors.filter(e=>!recoverable.has(e.code));requireThat(fatal.length===0,'Existing Work is invalid; inspect it without overwriting');return {status:checked.ok?'ready':'stale'};
}
export function validateGoal(goal,{repositories={}}={}){
 if(Object.hasOwn(repositories,'be')||Object.hasOwn(repositories,'fe'))assertSourceLayout({host:path.dirname(path.dirname(projectSkillPath)),be:repositories.be,fe:repositories.fe,workRoot:repositories.be?path.join(path.resolve(repositories.be),'.starciwork'):undefined});
 requireThat(goal?.schema==='starci/goal@1'&&text(goal.id)&&text(goal.originalRequest)&&text(goal.requestId)&&text(goal.finalOutcome),'Concrete original request and final goal are required');
 requireThat(catalog.workflows.some(w=>w.id===goal.workflow),'Unknown workflow');
 if(goal.workflow==='implement-frontend'){requireThat(typeof goal.inputs?.requiresBackend==='boolean','Freeze whether this frontend job depends on a backend API');if(goal.inputs.requiresBackend)requireThat(validBackendRun(goal.inputs.acceptedBackendRun),'API-dependent frontend work requires an accepted backend lifecycle run with unit, backend E2E and API evidence');}
 requireThat(goal.scope&&list(goal.scope.business)&&Array.isArray(goal.scope.paths)&&Array.isArray(goal.scope.resources)&&Array.isArray(goal.scope.exclusions),'Explicit business scope and effect ceilings are required');
 requireThat(list(goal.criteria)&&list(goal.businessChanges),'Business changes and observable acceptance criteria are required');
 requireThat(Array.isArray(goal.impacts)&&Array.isArray(goal.resourceEffects)&&goal.impacts.length+goal.resourceEffects.length>0,'Identify exact code impacts or non-code resource effects');
 for(const impact of goal.impacts){
  requireThat(text(impact.repository)&&text(impact.service)&&text(impact.path)&&text(impact.change)&&text(impact.businessReason),'Every impact needs repository/service/path/change/business reason');
  requireThat(goal.scope.paths.includes(impact.repository+':'+impact.path),'Code impact exceeds approved scope');
  const base=repositories[impact.repository];requireThat(base&&fs.existsSync(base),'Resolve the actual repository root');
  const file=path.resolve(base,impact.path);requireThat(inside(fs.realpathSync(base),file),'Impact escapes repository');let ancestor=path.dirname(file);while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);requireThat(inside(fs.realpathSync(base),fs.realpathSync(ancestor)),'Impact parent escapes repository');
  if(impact.status==='new'){requireThat(!fs.existsSync(file)&&impact.startLine===null&&impact.endLine===null,'New files must be explicitly proposed without fake existing lines');}
  else {requireThat(impact.status==='existing'&&fs.existsSync(file)&&inside(fs.realpathSync(base),fs.realpathSync(file)),'Existing source must be a real owned file');const bytes=fs.readFileSync(file),lines=bytes.toString('utf8').split(/\r?\n/);requireThat(Number.isInteger(impact.startLine)&&impact.startLine>0&&Number.isInteger(impact.endLine)&&impact.endLine>=impact.startLine&&impact.endLine<=lines.length,'Existing code requires actual start/end lines');requireThat(impact.sourceHash===sha256(bytes)&&text(impact.anchor)&&lines.slice(impact.startLine-1,impact.endLine).join('\n').includes(impact.anchor),'Source hash or line anchor changed; re-inspect and reapprove');}
 }
 for(const effect of goal.resourceEffects)requireThat(goal.scope.resources.includes(effect.target)&&text(effect.operation)&&text(effect.postcondition),'Resource effects require exact approved target, operation and postcondition');
 const rows=matrix(goal.workflow,goal.cells?.[0]?.operation);requireThat(rows&&Array.isArray(goal.cells)&&goal.cells.length===rows.flat().length,'Every workflow is one concrete job');
 for(const [rowIndex,row]of rows.entries())for(const expected of row){const cell=goal.cells.find(c=>c.id===expected.id);requireThat(cell&&cell.op===expected.op&&cell.operation===expected.operation&&text(cell.purpose)&&text(cell.finalOutput)&&list(cell.criteria)&&cell.outputSchema&&cell.inputs&&typeof cell.inputs==='object','Cell identity, final purpose, typed output and criteria are required');if(rows.flat().length>1)requireThat(list(cell.workTargets)&&cell.workTargets.every(id=>goal.workTargets.includes(id)),'Each multi-cell stage needs exact owned Work targets');validateShapeSchema(cell.outputSchema);validateWorkPolicy(goal,cell);for(const binding of Object.values(cell.inputs)){if(binding.from==='request')requireThat(Object.hasOwn(goal.inputs??{},binding.key),'Missing original input');else{const previous=rows.slice(0,rowIndex).flat().find(c=>c.id===binding.cell);requireThat(binding.from==='cell'&&previous&&text(binding.key),'Handoffs must consume earlier cells');}}}
 requireThat(goal.criteria.every(id=>goal.cells.some(c=>c.criteria.includes(id))),'Every overall criterion must have a producing cell');
 requireThat(Array.isArray(goal.workTargets)&&(goal.workflow==='prepare-work'||list(goal.workTargets)),'Select exact Work target node IDs');
 return {ok:true,goalDigest:digest(goal),scopeDigest:digest({requestId:goal.requestId,originalRequest:goal.originalRequest,scope:goal.scope})};
}
function validateShapeSchema(schema){requireThat(schema&&['object','array','string','number','boolean','null'].includes(schema.type),'Unsupported output schema');requireThat(Object.keys(schema).every(k=>['type','properties','required','additionalProperties','items','enum'].includes(k)),'Unsupported output schema keywords');if(schema.type==='object'){requireThat(schema.additionalProperties===false&&schema.properties&&Array.isArray(schema.required)&&schema.required.every(k=>Object.hasOwn(schema.properties,k)),'Objects need closed properties and required keys');Object.values(schema.properties).forEach(validateShapeSchema);}if(schema.type==='array')validateShapeSchema(schema.items);}
export {typed};
export function propose(goal,{workRoot,repositories={}}){const checked=validateGoal(goal,{repositories}),work=workStatus(workRoot);return {schema:'starci/workflow-run@1',goal:structuredClone(goal),...checked,goalDigest:digest({goal,workRoot,repositories}),workRoot,repositories:structuredClone(repositories),route:work.status==='missing'&&goal.workflow!=='prepare-work'?'prepare-work':goal.workflow,status:'awaiting-goal-approval',approvals:[],requests:{},responses:{}};}
export const proposeStandalone=propose;
function bound(run){requireThat(run.goalDigest===digest({goal:run.goal,workRoot:run.workRoot,repositories:run.repositories})&&run.scopeDigest===digest({requestId:run.goal.requestId,originalRequest:run.goal.originalRequest,scope:run.goal.scope}),'Frozen goal or original scope was changed');}
function decision(receipt,phase,target){requireThat(receipt?.actor==='user'&&receipt.phase===phase&&receipt.digest===target&&receipt.approved===true&&text(receipt.messageId)&&text(receipt.quote),'An actual explicit user decision bound to this digest is required');}
function goalAuthorized(run) {
 if(run.delegated)return assertDelegatedGoal(run);
 if(run.automatic)return assertAutoGoal(run);
 return run.approvals.some(a=>a.actor==='user'&&a.phase==='goal'&&a.digest===run.goalDigest&&a.approved&&text(a.messageId)&&a.messageId!==run.goal.requestId&&a.replyTo===run.presentation.messageId);
}
function deliveryAuthorized(run) {
 verifyProducerResult(run);
 if(run.delegated){assertDelegatedGoal(run);return hasDelegatedAcceptance(run);}
 if(run.automatic){assertAutoGoal(run);verifyAutoEvidence(run);return hasAutoAcceptance(run);}
 return hasDirectProducerAcceptance(run);
}
export function preflightCompletion(run,completions) {
 bound(run);
 requireThat(['awaiting-acceptance','accepted'].includes(run.status)&&run.resultDigest===digest({goalDigest:run.goalDigest,responses:run.responses}),'A complete unchanged result is required before completion preflight');
 requireThat(same(Object.keys(completions).sort(),[...run.goal.workTargets].sort()),'Completion preflight must cover exactly the selected leaves');
 verifyProducerResult(run);
 const predicted=previewCompletion(run.workRoot,completions),verdict=scopedWorkStatus(predicted,run.goal.workTargets,{done:true,authored:run.goal.cells.some(c=>c.workPolicy),requiredChildrenOnly:run.goal.workflow==='implement-backend'});
 return {...verdict,preview:true,goalDigest:run.goalDigest,resultDigest:run.resultDigest,completionsDigest:digest(completions),warnings:predicted.warnings};
}
export function authorizeAutoGoal(run,{authorization,assessment,priorRuns={}}) {
 requireThat(!run.delegated,'Cannot mix scoped manual and automatic authority');
 bound(run);requireThat(run.status==='awaiting-goal-approval'&&run.presentation,'Present this concrete goal before auto risk assessment');
 const automatic={authorization:structuredClone(authorization),assessment:structuredClone(assessment)};
 const receipt={actor:'assistant',phase:'delegated-goal',digest:run.goalDigest,authorizationDigest:digest(authorization),assessmentDigest:digest(assessment)};
 const next={...run,automatic,approvals:[...run.approvals,receipt]};
 assertAutoGoal(next);verifyAutoPredecessors(next,priorRuns);validateGoal(run.goal,{repositories:run.repositories});
 requireThat(run.route===run.goal.workflow,'Missing Work requires the explicitly listed prepare-work job first');
 return {...next,status:'approved'};
}
export function acceptAutoDelivery(run) {
 bound(run);assertAutoGoal(run);
 requireThat(run.status==='awaiting-acceptance'&&run.resultDigest===digest({goalDigest:run.goalDigest,responses:run.responses}),'A complete unchanged auto result is required');
 verifyProducerResult(run);
 return {...run,status:'accepted',approvals:[...run.approvals,{actor:'assistant',phase:'delegated-acceptance',approved:true,digest:run.resultDigest,authorizationDigest:digest(run.automatic.authorization)}]};
}
function resolvedJobQuestions(run) {
 if(run.presentation.scope.schema==='starci/workflow-scope@1')return run.presentation.scope.openQuestions.length===0;
 const questions=run.presentation.scope.workflows.find(x=>x.id===run.presentation.jobId)?.openQuestions??[];
 if(!questions.length)return true;
 const answers=run.goal.inputs?.planQuestionAnswers;
 return Array.isArray(answers)&&answers.length===questions.length&&new Set(answers.map(x=>x?.question)).size===questions.length&&answers.every(x=>questions.includes(x?.question)&&text(x.answer));
}
export function presentGoal(run,{messageId,scope,jobId}) {
 bound(run);requireThat(run.status==='awaiting-goal-approval'&&text(messageId),'Present an unapproved goal with an actual assistant message ID');
 return presentBoundGoal(run,{messageId,scope,jobId});
}
/** A bounded existing-scope workflow needs one detailed goal, not a delivery Plan. */
export function presentStandaloneGoal(run,{messageId,openQuestions=[]}) {
 bound(run);requireThat(run.status==='awaiting-goal-approval'&&text(messageId)&&!run.presentation&&!run.automatic&&!run.delegated&&!run.approvals.length&&!Object.keys(run.requests).length,'Present a fresh standalone manual workflow before approval');
 const scope={schema:'starci/workflow-scope@1',id:run.goal.id,workflow:run.goal.workflow,requestId:run.goal.requestId,originalRequest:run.goal.originalRequest,goalDigest:run.goalDigest,openQuestions:structuredClone(openQuestions)};
 const next={...run,presentation:{messageId,goalDigest:run.goalDigest,scopeDigest:digest(scope),jobId:run.goal.id,scope}};
 verifyPresentation(next,catalog);return next;
}
function presentBoundGoal(run,{messageId,scope,jobId,provenance}) {
 requireThat(scope?.schema==='starci/plan@2','New workflow goal presentations require the complete Plan v2; revise legacy plans explicitly without migrating receipts');
 const checked=validatePlan(scope,catalog),job=scope.workflows.find(x=>x.id===jobId);
 requireThat(scope.requestId===run.goal.requestId&&scope.originalRequest===run.goal.originalRequest&&job?.workflow===run.goal.workflow,'Scope must preserve the original request and selected job');
 requireThat(run.goal.workTargets.every(x=>job.workTargets.includes(x))&&run.goal.scope.paths.every(x=>job.paths.includes(x))&&run.goal.scope.resources.every(x=>job.resources.includes(x)),'Goal exceeds presented scope job targets or effects');
 return {...run,presentation:{messageId,...(provenance?{provenance:structuredClone(provenance)}:{}),goalDigest:run.goalDigest,scopeDigest:checked.digest,jobId,scope:structuredClone(scope)}};
}
export function presentDelegatedGoal(run,{scope,jobId,reference,provenance}) {
 bound(run);requireThat(run.status==='awaiting-goal-approval'&&!run.automatic,'Present an unapproved manual goal');
 const {mandate}=readScopedMandate(scope,reference);validateDelegationSource(provenance,'assistant');
 requireThat(provenance.threadId===mandate.taskThreadId,'Present the goal in its actual task');
 return presentBoundGoal(run,{scope,jobId,messageId:provenance.messageId,provenance});
}
export function authorizeDelegatedGoal(run,{reference,assessment,source,priorRuns={}}) {
 bound(run);requireThat(run.status==='awaiting-goal-approval'&&run.presentation&&!run.automatic,'Present this manual goal before coordinator review');
 const receipt={actor:'assistant',phase:'scoped-goal',approved:true,digest:run.goalDigest,mandateDigest:reference.digest,presentationDigest:digest(run.presentation),assessmentDigest:digest(assessment),source:structuredClone(source)};
 const next={...run,delegated:{reference:structuredClone(reference),assessment:structuredClone(assessment)},approvals:[...run.approvals,receipt]};
 assertDelegatedGoal(next);assertDelegatedAssessment(next,assessment,'goal');verifyAutoPredecessors(next,priorRuns);validateGoal(next.goal,{repositories:next.repositories});
 requireThat(next.route===next.goal.workflow,'Missing Work requires an explicitly listed prepare-work job');
 return {...next,status:'approved'};
}
export function acceptDelegatedDelivery(run,{source,assessment,priorRuns={}}) {
 bound(run);const {mandate}=assertDelegatedGoal(run);validateDelegationSource(source,'assistant');
 requireThat(source.threadId===mandate.coordinatorThreadId&&run.status==='awaiting-acceptance','Actual designated coordinator result review required');
 assertDelegatedAssessment(run,assessment,'acceptance');verifyAutoPredecessors(run,priorRuns);verifyDelegatedResult(run);
 verifyRunWork(run);
 return {...run,status:'accepted',approvals:[...run.approvals,{actor:'assistant',phase:'scoped-acceptance',approved:true,digest:run.resultDigest,mandateDigest:run.delegated.reference.digest,assessmentDigest:digest(assessment),assessment:structuredClone(assessment),source:structuredClone(source)}]};
}
export function approveGoal(run,receipt){bound(run);requireThat(!run.delegated&&!run.presentation?.provenance&&text(run.presentation?.messageId),'Present the actual goal message before direct user approval');requireThat(!(run.presentation?.scope.openQuestions?.length),'Resolve Plan questions with the user before goal approval');requireThat(verifyPresentation(run,catalog),'Present the concrete scope and goal before approval');requireThat(resolvedJobQuestions(run),'Resolve this workflow goal questions before approval; future workflow questions do not block it');requireThat(receipt?.messageId!==run.goal.requestId&&receipt?.messageId!==run.presentation.messageId&&receipt?.quote!==run.goal.originalRequest&&receipt?.replyTo===run.presentation.messageId,'Approval must be an actual later user reply to the presented goal, not the original task request');decision(receipt,'goal',run.goalDigest);validateGoal(run.goal,{repositories:run.repositories});return {...run,approvals:[...run.approvals,structuredClone(receipt)],status:run.route==='prepare-work'&&run.goal.workflow!=='prepare-work'?'awaiting-bootstrap':'approved'};}
export function resumeFromBootstrap(run,bootstrap){bound(run);bound(bootstrap);requireThat(run.status==='awaiting-bootstrap'&&bootstrap.goal.workflow==='prepare-work'&&bootstrap.status==='done','An accepted completed bootstrap is required');requireThat(run.scopeDigest===bootstrap.scopeDigest&&run.workRoot===bootstrap.workRoot,'Bootstrap must preserve original request, scope and Work root');requireThat(workStatus(run.workRoot).status==='ready','Work bootstrap did not create valid Work');return {...run,route:run.goal.workflow,status:'approved',bootstrapDigest:digest(bootstrap)};}
const investigationOps=new Set(['workspace.manage','business.decide','architecture.decide','interface.draw']);
function workBindings(run,cell){
 if(run.goal.workflow==='prepare-work')return [];
 const checked=validateWorkspace(run.workRoot),recovering=investigationOps.has(cell.op);
 const fatal=checked.errors.filter(e=>!['STALE_COMPLETION','STALE_EVIDENCE','DEPENDENCY_NOT_DONE'].includes(e.code));
 requireThat(fatal.length===0,'Work graph is invalid; inspect it before execution');
 const owned=cell.workTargets??run.goal.workTargets,targets=owned.map(id=>checked.nodes.find(n=>n.id===id));
 requireThat(targets.every(Boolean),'Every Work target must resolve');
 if(!recovering){const rows=matrix(run.goal.workflow,cell.operation),prior=rows.slice(0,rows.findIndex(row=>row.some(c=>c.id===cell.id))).flat(),completed=prior.filter(c=>run.responses[c.id]).flatMap(c=>run.goal.cells.find(g=>g.id===c.id).workTargets??run.goal.workTargets);requireThat(inRunWorkReady(checked,owned,completed),'Work targets must be investigated, unblocked and eligible; completed in-run prerequisites are allowed');}
 return targets.map(n=>({id:n.id,contextDigest:n.contextDigest,inputDigest:n.inputDigest}));
}
export function requestCell(run,cellId,delegatedReview){bound(run);verifyRequiredProducerInputs(run);if(Object.keys(run.responses).length)verifyAutoEvidence({...run,goal:{...run.goal,cells:run.goal.cells.filter(c=>run.responses[c.id])}});if(run.delegated)assertDelegatedDispatch(run,delegatedReview,cellId);requireThat(verifyPresentation(run,catalog),'A current presented workflow goal and scope are required before dispatch');requireThat(goalAuthorized(run),'Missing actual bound goal approval');requireThat(['approved','running'].includes(run.status),'Goal approval and Work gate must pass before work');if(!Object.keys(run.requests).length)validateGoal(run.goal,{repositories:run.repositories});const rows=matrix(run.goal.workflow,run.goal.cells?.[0]?.operation),rowIndex=rows.findIndex(row=>row.some(c=>c.id===cellId));requireThat(rowIndex>=0&&!run.requests[cellId]&&!run.responses[cellId],'Unknown, already requested or already accepted cell');requireThat(rows.slice(0,rowIndex).flat().every(c=>run.responses[c.id]),'Previous sequential row has not passed');const cell=run.goal.cells.find(c=>c.id===cellId),inputs={};const bindings=workBindings(run,cell);for(const [key,binding]of Object.entries(cell.inputs)){const source=binding.from==='request'?run.goal.inputs:run.responses[binding.cell]?.outputs;requireThat(source&&Object.hasOwn(source,binding.key),'Missing accepted upstream output');inputs[key]=structuredClone(source[binding.key]);}const executionChain=resolveExecutionChain({skill:'starci',op:cell.op});const request={schema:'starci/cell-request@1',...requestWorkPolicy(run,cell),...(run.delegated?{delegatedReview:{coordinatorThreadId:delegatedReview.coordinatorThreadId,taskThreadId:delegatedReview.taskThreadId,assessment:structuredClone(delegatedReview.assessment)}}:{}),projectSkillPath,executionChain,cell:cell.id,op:cell.op,operation:cell.operation??null,goalDigest:run.goalDigest,scopeDigest:run.scopeDigest,workBindings:bindings,inputs,criteria:cell.criteria,outputSchema:cell.outputSchema};request.delegationPrompt=`Open and invoke the project StarCi skill at ${projectSkillPath}. Execute workflow ${run.goal.workflow}, approved goal ${run.goalDigest}, cell ${cell.id} with operator ${cell.op}. Orca must choose the first ready candidate in executionChain and may fall through only for an allowed no-effect failure. Use Work root ${run.workRoot} and only the request-bound targets, inputs, output schema, criteria and effect ceiling in this cell request. Return the exact typed response; do not perform free-form successor work.`;return {run:{...run,status:'running',requests:{...run.requests,[cellId]:request}},request:structuredClone(request)};}
function rejectMutableAuthoredArtifact(run,request,file){
 if(request.schema!=='starci/cell-request@2')return;
 const actual=fs.realpathSync(file),identity=fs.statSync(actual,{bigint:true});
 for(const owner of request.workInvariant.nodes){
  if(owner.schema!=='work/node@2'||!request.workPolicy.targets.includes(owner.id)||path.basename(owner.path)!=='index.yaml')continue;
  const target=fs.realpathSync(path.resolve(run.workRoot,owner.path)),targetIdentity=fs.statSync(target,{bigint:true});
  requireThat(actual!==target&&!(identity.ino!==0n&&identity.dev===targetIdentity.dev&&identity.ino===targetIdentity.ino),'Authored canonical index.yaml is lifecycle-mutable; use semantic workResult with immutable review artifacts, not a raw-byte artifact');
 }
}
export function acceptCell(run,response,{evidenceRoot}){bound(run);verifyRequiredProducerInputs(run);if(Object.keys(run.responses).length)verifyAutoEvidence({...run,goal:{...run.goal,cells:run.goal.cells.filter(c=>run.responses[c.id])}});const request=run.requests[response?.cell];requireThat(run.status==='running'&&request&&!run.responses[response.cell]&&response.requestDigest===digest(request)&&response.goalDigest===run.goalDigest&&response.scopeDigest===run.scopeDigest&&response.op===request.op&&response.operation===request.operation,'Response must match the current approved request');const cell=run.goal.cells.find(c=>c.id===request.cell);if(request.schema!=='starci/cell-request@2')requireThat(same(request.workBindings??[],workBindings(run,cell)),'Work inputs changed after dispatch; discard this response and investigate current scope');response=sealWorkResult(run,cell,response);requireThat(response.status==='pass'&&typed(response.outputs,request.outputSchema),'Response status or typed outputs failed');requireThat(Array.isArray(response.criteria)&&response.criteria.length===request.criteria.length&&new Set(response.criteria.map(c=>c.id)).size===request.criteria.length&&request.criteria.every(id=>response.criteria.some(c=>c.id===id&&c.status==='pass'&&text(c.observation)&&list(c.evidence))),'All pinned criteria need passing observations and actual evidence');requireThat(Array.isArray(response.artifacts)&&response.artifacts.length>0&&new Set(response.artifacts.map(a=>a.id)).size===response.artifacts.length,'Actual artifacts required');const base=fs.realpathSync(evidenceRoot);for(const a of response.artifacts){const file=path.resolve(base,a.path);requireThat(inside(base,file)&&fs.existsSync(file)&&inside(base,fs.realpathSync(file))&&sha256(fs.readFileSync(file))===a.sha256,'Evidence escapes, is missing or has changed');rejectMutableAuthoredArtifact(run,request,file);}requireThat(response.criteria.every(c=>c.evidence.every(id=>response.artifacts.some(a=>a.id===id))),'Criterion references missing artifact');const next={...run,evidenceRoots:{...run.evidenceRoots,[response.cell]:base},responses:{...run.responses,[response.cell]:structuredClone(response)}};if(Object.keys(next.responses).length===run.goal.cells.length){next.status='awaiting-acceptance';next.resultDigest=digest({goalDigest:run.goalDigest,responses:next.responses});}return next;}
export function acceptDelivery(run,receipt){bound(run);requireThat(!run.delegated&&!run.automatic,'Use the actual authority-specific result decision');requireThat(run.status==='awaiting-acceptance'&&run.resultDigest===digest({goalDigest:run.goalDigest,responses:run.responses}),'A complete unchanged result is required');verifyProducerResult(run);decision(receipt,'acceptance',run.resultDigest);const accepted={...run,status:'accepted',approvals:[...run.approvals,structuredClone(receipt)]};requireThat(hasDirectProducerAcceptance(accepted),'A distinct actual direct goal and result decision are required');return accepted;}
export function markWorkDone(run,completions){bound(run);requireThat(run.status==='accepted'&&run.resultDigest===digest({goalDigest:run.goalDigest,responses:run.responses}),'User acceptance is required before Work done');requireThat(deliveryAuthorized(run),'Missing bound user acceptance');const before=validateWorkspace(run.workRoot);requireThat(same(Object.keys(completions).sort(),[...run.goal.workTargets].sort()),'Completion cannot target other Work nodes');const preview=preflightCompletion(run,completions);requireThat(preview.ok,'Completion preflight failed; no Work files changed: '+JSON.stringify(preview.errors));const writes=[];for(const [id,completion]of Object.entries(completions)){const node=before.nodes.find(n=>n.id===id);requireThat(node&&node.children.length===0,'Only selected leaf nodes can be marked; parents derive done');const file=path.resolve(run.workRoot,node.path);requireThat(inside(fs.realpathSync(run.workRoot),fs.realpathSync(file)),'Node escapes Work');const original=fs.readFileSync(file,'utf8');let meta,body='';if(file.endsWith('.md')){const m=original.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);requireThat(m,'Malformed legacy node');meta=parseYaml(m[1]);body=m[2];}else meta=parseYaml(original);meta.state='done';meta.completion=completion;const bytes=file.endsWith('.md')?'---\n'+stringifyYaml(meta)+'---\n'+body:stringifyYaml(meta);writes.push({file,original,bytes});}
 try{for(const w of writes){requireThat(fs.readFileSync(w.file,'utf8')===w.original,'Concurrent node change');fs.writeFileSync(w.file,w.bytes);}const verified=validateWorkspace(run.workRoot);requireThat(scopedWorkStatus(verified,run.goal.workTargets,{done:true,authored:run.goal.cells.some(c=>c.workPolicy),requiredChildrenOnly:run.goal.workflow==='implement-backend'}).ok,'Completion proof failed; Work done rolled back');verifyRunWork({...run,status:'done'});return {...run,status:'done'};}catch(error){for(const w of writes)if(fs.readFileSync(w.file,'utf8')===w.bytes)fs.writeFileSync(w.file,w.original);throw error;}}
export {digest as workflowDigest};
function standaloneDirectory(workRoot,id){
 requireThat(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id),'Unsafe workflow ID');
 const dir=path.resolve(stateRoot(workRoot),'workflows',id),base=path.dirname(path.resolve(workRoot));
 assertNewStoragePath(dir);
 for(let file=dir;file!==base;file=path.dirname(file)){
  requireThat(inside(base,file),'Workflow path escaped its owner');
  requireThat(!fs.existsSync(file)||!fs.lstatSync(file).isSymbolicLink(),'Local workflow cannot follow symlinks');
 }
 return dir;
}
export function saveStandaloneRun(run,id=run.goal.id){
 bound(run);workStatus(run.workRoot);verifyPresentation(run,catalog);
 requireThat(run.presentation.scope.schema==='starci/workflow-scope@1'&&id===run.goal.id,'Standalone workflow must retain its own ID');
 const dir=standaloneDirectory(run.workRoot,id);
 for(const name of ['goal.yaml','run.yaml'])requireThat(!fs.existsSync(path.join(dir,name))||!fs.lstatSync(path.join(dir,name)).isSymbolicLink(),'Workflow record cannot follow symlinks');
 const file=path.join(dir,'run.yaml');
 if(fs.existsSync(file)){const old=parseYaml(fs.readFileSync(file,'utf8'));bound(old);requireThat(old.goalDigest===run.goalDigest&&same(old.presentation,run.presentation),'Workflow goal changed; use a new ID and reapprove');}
 fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'goal.yaml'),stringifyYaml(run.goal));
 fs.writeFileSync(file,stringifyYaml(run));return dir;
}
export function loadStandaloneRun(workRoot,id){
 const dir=standaloneDirectory(workRoot,id);
 const read=name=>{const file=path.join(dir,name);requireThat(!fs.lstatSync(file).isSymbolicLink(),'Workflow record cannot follow symlinks');return parseYaml(fs.readFileSync(file,'utf8'));};
 const run=read('run.yaml');bound(run);verifyPresentation(run,catalog);
 requireThat(run.presentation.scope.schema==='starci/workflow-scope@1'&&run.goal.id===id&&run.workRoot===workRoot&&same(read('goal.yaml'),run.goal),'Standalone workflow records disagree');return run;
}
export function saveRun(run,planId=run.presentation?.scope.id??run.goal.id){
 if(run.presentation?.scope.schema==='starci/workflow-scope@1')return saveStandaloneRun(run,planId);
 bound(run);workStatus(run.workRoot);
 if(run.delegated)assertDelegatedGoal(run,{active:false});
 requireThat(!run.presentation||planId===run.presentation.scope.id,'All workflow runs must remain in their one presented Plan bundle');
 requireThat(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(planId),'Unsafe Plan ID');
 // Normalize only I/O paths: never rewrite the request-bound Work root or its digest.
 const base=path.dirname(path.resolve(run.workRoot)),state=path.relative(base,stateRoot(run.workRoot)),dir=path.join(base,state,'plans',planId);
 if(!fs.existsSync(path.join(dir,'goal/index.yaml')))assertNewStoragePath(dir);
 const paths=['index.yaml','goal/index.yaml','approval/index.yaml','run/index.yaml'];
 for(const relative of [state,state+'/plans',state+'/plans/'+planId,...paths.map(p=>state+'/plans/'+planId+'/'+p)]){
  let file=path.join(base,relative);while(file!==base){requireThat(inside(base,file),'Plan ancestor escaped its owner');requireThat(!fs.existsSync(file)||!fs.lstatSync(file).isSymbolicLink(),'Local Plan cannot follow symlinks');const parent=path.dirname(file);requireThat(parent!==file,'Plan ancestor walk reached the filesystem root');file=parent;}
 }
 const read=relative=>fs.existsSync(path.join(dir,relative))?parseYaml(fs.readFileSync(path.join(dir,relative),'utf8')):null;
 const oldGoal=read('goal/index.yaml'),jobId=run.presentation?.jobId??run.goal.id;
 const plan=run.presentation?.scope??null,planDigest=plan?validatePlan(plan,catalog).digest:run.goalDigest;
 requireThat(!oldGoal||oldGoal.planDigest===planDigest||(!oldGoal.plan&&oldGoal.jobs?.[jobId]?.goalDigest===run.goalDigest),'Plan changed; present a revised Plan instead of overwriting an existing bundle');
 const oldApproval=read('approval/index.yaml'),oldExecution=read('run/index.yaml');
 if(oldGoal)requireThat(oldApproval?.planDigest===oldGoal.planDigest&&oldExecution?.planDigest===oldGoal.planDigest,'Incomplete or mismatched Plan bundle; reconcile before saving');
 const goals=oldGoal?.jobs??{},approvals=oldApproval?.jobs??{},runs=oldExecution?.jobs??{};
 for(const job of plan?.workflows??[]) {
  approvals[job.id]??={status:'pending',presentation:null,receipts:[]};
  runs[job.id]??={workflow:job.workflow,status:'planned',dependsOn:job.dependsOn,requests:{},responses:{},evidence:[]};
 }
 requireThat(!goals[jobId]||goals[jobId].goalDigest===run.goalDigest,'Job goal changed; revise and reapprove before replacing execution');
 goals[jobId]={goal:run.goal,goalDigest:run.goalDigest,scopeDigest:run.scopeDigest,workRoot:run.workRoot,repositories:run.repositories};
 approvals[jobId]={status:run.approvals.length?'recorded':'pending',presentation:run.presentation?{messageId:run.presentation.messageId,...(run.presentation.provenance?{provenance:run.presentation.provenance}:{}),goalDigest:run.goalDigest,planDigest}:null,receipts:run.approvals};
 const {goal,presentation,approvals:receipts,repositories,workRoot,...execution}=run;runs[jobId]=execution;
 if(oldExecution?.completion)requireThat(oldExecution.completion.planDigest===planDigest&&Object.entries(oldExecution.completion.resultDigests).every(([id,d])=>runs[id]?.status==='done'&&runs[id]?.resultDigest===d),'Completed Plan results changed; explicit revision is required');
 const documents={
  'index.yaml':{schema:'starci/plan-index@1',id:planId,goal:'goal/index.yaml',approval:'approval/index.yaml',run:'run/index.yaml'},
  'goal/index.yaml':{schema:'starci/plan-goal@1',planDigest,plan,jobs:goals},
  'approval/index.yaml':{schema:'starci/plan-approval@1',planDigest,jobs:approvals},
  'run/index.yaml':{schema:'starci/plan-run@1',planDigest,...(plan?{status:oldExecution?.completion?'done':Object.values(runs).some(r=>r.delegated)&&plan.workflows.every(j=>runs[j.id]?.status==='done')?'awaiting-terminal-review':planProgress(plan,runs)}:{}),jobs:runs,...(oldExecution?.completion?{completion:oldExecution.completion}:{})}
 };
 for(const [relative,doc]of Object.entries(documents)){const file=path.join(dir,relative);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,stringifyYaml(doc));}
 return dir;
}
export function saveAutoCompletion(plan,{authorization,criteria}) {
 const dir=path.join(stateRoot(authorization.presentation.workRoot),'plans',plan.id);
 requireThat(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(plan.id),'Unsafe Plan ID');
 const read=relative=>{const file=path.join(dir,relative);requireThat(fs.realpathSync(file).toLowerCase()===file.toLowerCase(),'Plan completion cannot follow links');return fs.readFileSync(file,'utf8');};
 const goal=parseYaml(read('goal/index.yaml')),approval=parseYaml(read('approval/index.yaml')),original=read('run/index.yaml'),execution=parseYaml(original);
 const planDigest=validatePlan(plan,catalog).digest;
 requireThat(goal.planDigest===planDigest&&same(goal.plan,plan)&&approval.planDigest===planDigest&&execution.planDigest===planDigest,'Mismatched Plan bundle; reconcile before completion');
 const runs={};
 for(const job of plan.workflows) {
  const g=goal.jobs[job.id],a=approval.jobs[job.id],r=execution.jobs[job.id];
  requireThat(g&&a?.presentation&&r,'Missing workflow records');
  runs[job.id]={...r,...g,approvals:a.receipts,presentation:{...a.presentation,scope:plan,scopeDigest:planDigest,jobId:job.id}};
 }
 const completion=completeAutoPlan(plan,{authorization,runs,criteria});
 const file=path.join(dir,'run/index.yaml');requireThat(fs.readFileSync(file,'utf8')===original,'Concurrent Plan change');
 fs.writeFileSync(file,stringifyYaml({...execution,status:'done',completion}));return completion;
}

/** Read the same four-file bundle without manufacturing presentation/approval IDs. */
export function loadPlanRuns(plan,workRoot) {
 const dir=path.join(stateRoot(workRoot),'plans',plan.id),planDigest=validatePlan(plan,catalog).digest;
 requireThat(/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(plan.id),'Unsafe Plan ID');
 const read=relative=>{const file=path.join(dir,relative);requireThat(fs.realpathSync(file).toLowerCase()===file.toLowerCase(),'Plan bundle cannot follow links');return parseYaml(fs.readFileSync(file,'utf8'));};
 const g=read('goal/index.yaml'),a=read('approval/index.yaml'),r=read('run/index.yaml');
 requireThat(g.planDigest===planDigest&&same(g.plan,plan)&&a.planDigest===planDigest&&r.planDigest===planDigest,'Mismatched Plan bundle');
 const runs={};
 for(const job of plan.workflows){if(!g.jobs[job.id])continue;const approval=a.jobs[job.id],execution=r.jobs[job.id];requireThat(approval?.presentation&&execution,'Incomplete workflow records');const presentation={...approval.presentation,scope:plan,scopeDigest:planDigest,jobId:job.id};delete presentation.planDigest;const run={...execution,...g.jobs[job.id],approvals:approval.receipts,presentation};bound(run);if(run.delegated)assertDelegatedGoal(run,{active:false});runs[job.id]=run;}
 return runs;
}
export function saveDelegatedCompletion(plan,{reference,criteria,source}) {
 const {mandate}=readScopedMandate(plan,reference),file=path.join(stateRoot(mandate.binding.workRoot),'plans',plan.id,'run/index.yaml');
 const runs=loadPlanRuns(plan,mandate.binding.workRoot),original=fs.readFileSync(file,'utf8');
 const completion=completeDelegatedPlan(plan,{reference,runs,criteria,source});
 requireThat(fs.readFileSync(file,'utf8')===original,'Concurrent Plan change');
 fs.writeFileSync(file,stringifyYaml({...parseYaml(original),status:'done',completion}));
 closeScopedMandate(plan,reference,completion);return completion;
}
