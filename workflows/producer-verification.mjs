import fs from 'node:fs';
import path from 'node:path';
import {canonicalJSON,sha256,validateWorkspace} from '../core/index.mjs';
import {validatePlan} from './plan.mjs';
import {typed} from './typed.mjs';
import {verifyWorkResult,scopedWorkStatus} from './work-binding.mjs';
import {validBackendRun} from './select.mjs';

const hash=x=>sha256(canonicalJSON(x));
const same=(a,b)=>a!==undefined&&b!==undefined&&hash(a)===hash(b);
const text=x=>typeof x==='string'&&x.trim().length>0;
const list=x=>Array.isArray(x)&&x.length>0&&x.every(text)&&new Set(x).size===x.length;
const need=(ok,message)=>{if(!ok)throw Error(message);};
const inside=(root,file)=>{const r=path.relative(root,file);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);};
const catalog=JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url)));
const jobs=JSON.parse(fs.readFileSync(new URL('./jobs.json',import.meta.url)));
const frontend=JSON.parse(fs.readFileSync(new URL('./matrix.json',import.meta.url)));

/** Function-only boundary: never evaluated during module initialization.
 * The admitted nested producer must be backend, so it cannot recurse into FE. */
export function verifyRequiredProducerInputs(run){
 if(run?.goal?.workflow==='implement-frontend'&&run.goal.inputs?.requiresBackend===true)
  need(validBackendRun(run.goal.inputs.acceptedBackendRun),'Required backend producer proof or authority is no longer current');
 return true;
}

/** Authority-independent proof. This checks current content, never grants approval. */
export function verifyProducerEnvelope(run){
 const goal=run?.goal,p=run?.presentation;
 need(goal&&run.schema==='starci/workflow-run@1'&&run.goalDigest===hash({goal,workRoot:run.workRoot,repositories:run.repositories})&&run.scopeDigest===hash({requestId:goal.requestId,originalRequest:goal.originalRequest,scope:goal.scope}),'Frozen producer goal or binding changed');
 need(p?.goalDigest===run.goalDigest&&validatePlan(p.scope,catalog).digest===p.scopeDigest,'Producer presentation or Plan changed');
 const job=p.scope.workflows.find(j=>j.id===p.jobId);
 need(job?.workflow===goal.workflow&&p.scope.requestId===goal.requestId&&p.scope.originalRequest===goal.originalRequest&&goal.workTargets.every(id=>job.workTargets.includes(id))&&goal.scope.paths.every(x=>job.paths.includes(x))&&goal.scope.resources.every(x=>job.resources.includes(x)),'Producer exceeds its presented job');
 const definition=jobs.workflows.find(j=>j.id===goal.workflow),rows=goal.workflow==='implement-frontend'?frontend.rows:definition?.matrix;
 need(rows&&Array.isArray(goal.cells)&&goal.cells.length===rows.flat().length&&new Set(goal.cells.map(c=>c.id)).size===goal.cells.length&&list(goal.criteria)&&goal.criteria.every(id=>goal.cells.some(c=>c.criteria.includes(id))),'Producer workflow cells or criteria changed');
 for(const expected of rows.flat()){const cell=goal.cells.find(c=>c.id===expected.id);need(cell&&cell.op===expected.op&&list(cell.criteria)&&(definition?.operations?definition.operations.includes(cell.operation):cell.operation===expected.operation),'Producer operation no longer matches workflow');}
 return rows;
}

/** Verify selected completed cells, also used before an in-run successor dispatch.
 * Caller owns envelope/authority checks when passing a selected-cell projection. */
export function verifyProducerCells(run,{complete=true}={}){
 verifyRequiredProducerInputs(run);
 need(run?.requests&&run.responses&&Array.isArray(run.goal?.cells),'Missing producer request/results');
 if(complete)need(Object.keys(run.responses).length===run.goal.cells.length,'Incomplete producer result');
 const work=validateWorkspace(run.workRoot),inRun=new Set(Object.keys(run.responses).flatMap(id=>run.goal.cells.find(c=>c.id===id)?.workTargets??[]));
 need(work.errors.every(e=>['STALE_COMPLETION','STALE_EVIDENCE','DEPENDENCY_NOT_DONE'].includes(e.code)),'Current producer Work graph is invalid');
 for(const [id,response]of Object.entries(run.responses)){
  const cell=run.goal.cells.find(c=>c.id===id),request=run.requests[id];
  need(cell&&request&&request.cell===id&&request.goalDigest===run.goalDigest&&request.scopeDigest===run.scopeDigest&&request.op===cell.op&&request.operation===(cell.operation??null)&&same(request.criteria,cell.criteria)&&same(request.outputSchema,cell.outputSchema),'Producer request differs from its frozen goal cell');
  need(response?.cell===id&&response.status==='pass'&&response.requestDigest===hash(request)&&response.goalDigest===run.goalDigest&&response.scopeDigest===run.scopeDigest&&response.op===request.op&&response.operation===request.operation,'Producer response no longer matches its request');
  const inputs={};for(const [key,binding]of Object.entries(cell.inputs)){const source=binding.from==='request'?run.goal.inputs:binding.from==='cell'?run.responses[binding.cell]?.outputs:null;need(source&&Object.hasOwn(source,binding.key),'Producer input is missing');inputs[key]=source[binding.key];}
  need(same(inputs,request.inputs)&&typed(response.outputs,cell.outputSchema),'Producer typed output or consumed input changed');
  need(Array.isArray(response.criteria)&&response.criteria.length===cell.criteria.length&&new Set(response.criteria.map(c=>c?.id)).size===cell.criteria.length&&cell.criteria.every(id=>response.criteria.some(c=>c?.id===id&&c.status==='pass'&&text(c.observation)&&list(c.evidence))),'Producer requires every exact passing criterion');
  need(Array.isArray(response.artifacts)&&response.artifacts.length&&new Set(response.artifacts.map(a=>a?.id)).size===response.artifacts.length&&text(run.evidenceRoots?.[id]),'Missing producer artifacts or evidence root');
  const base=fs.realpathSync(run.evidenceRoots[id]);
  for(const artifact of response.artifacts){need(text(artifact.id)&&text(artifact.path)&&/^[a-f0-9]{64}$/.test(artifact.sha256??''),'Malformed producer artifact');const file=path.resolve(base,artifact.path);need(inside(base,file)&&fs.existsSync(file)&&inside(base,fs.realpathSync(file))&&fs.statSync(file).isFile()&&sha256(fs.readFileSync(file))===artifact.sha256,'Producer evidence is missing, stale or escapes its root');}
  need(response.criteria.every(c=>c.evidence.every(id=>response.artifacts.some(a=>a.id===id))),'Producer criterion references missing artifact');
  verifyWorkResult(run,cell,response);
  if(run.goal.workflow!=='prepare-work')for(const target of cell.workTargets??run.goal.workTargets){const n=work.nodes.find(n=>n.id===target);need(n&&n.blockedBy.every(id=>run.status!=='done'&&inRun.has(id))&&!n.blockers?.length,'Producer prerequisite is no longer current');if(run.status==='done')need(n.effectiveState==='done','Completed producer Work proof is no longer current');}
 }
 if(run.status==='done')need(scopedWorkStatus(work,run.goal.workTargets,{done:true,authored:run.goal.cells.some(c=>c.workPolicy),requiredChildrenOnly:run.goal.workflow==='implement-backend'}).ok,'Completed producer scope is no longer current');
 if(run.goal.workflow==='implement-backend')need(scopedWorkStatus(work,run.goal.workTargets,{done:run.status==='done',authored:true,requiredChildrenOnly:true}).ok&&run.goal.workTargets.every(id=>!['invalid','uninvestigate','suspended','blocked'].includes(work.nodes.find(n=>n.id===id)?.effectiveState)),'Backend producer inputs or completion are no longer current');
 return true;
}

export function verifyProducerResult(run,{partial=false}={}){
 const rows=verifyProducerEnvelope(run);
 if(!partial)need(['awaiting-acceptance','accepted','done'].includes(run.status)&&run.resultDigest===hash({goalDigest:run.goalDigest,responses:run.responses}),'Incomplete or changed producer result');
 const known=new Set(rows.flat().map(c=>c.id));need(Object.keys(run.requests??{}).every(id=>known.has(id))&&Object.keys(run.responses??{}).every(id=>known.has(id)),'Unknown producer cell receipt');
 for(const [i,row]of rows.entries())for(const cell of row)if(run.responses[cell.id])need(rows.slice(0,i).flat().every(c=>run.responses[c.id]),'Producer handoff skipped a prior row');
 return verifyProducerCells(run,{complete:!partial});
}

/** Actual direct-human path only. Never a fallback for another authority mode. */
export function hasDirectProducerAcceptance(run){
 try{
  if(run.automatic||run.delegated||run.presentation?.provenance||!text(run.presentation?.messageId)||(run.presentation.scope.mode??'manual')!=='manual')return false;
  verifyProducerResult(run);
  const p=run.presentation,approvals=run.approvals;
  const goalApproval=approvals.find(a=>a?.actor==='user'&&a.phase==='goal'&&a.approved===true&&a.digest===run.goalDigest&&text(a.messageId)&&text(a.quote)&&a.messageId!==run.goal.requestId&&a.messageId!==p.messageId&&a.quote!==run.goal.originalRequest&&a.replyTo===p.messageId);
  return Boolean(goalApproval&&approvals.some(a=>a?.actor==='user'&&a.phase==='acceptance'&&a.approved===true&&a.digest===run.resultDigest&&text(a.messageId)&&text(a.quote)&&a.messageId!==goalApproval.messageId&&a.messageId!==p.messageId&&a.messageId!==run.goal.requestId));
 }catch{return false;}
}
