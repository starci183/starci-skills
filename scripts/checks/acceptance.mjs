export const EVIDENCE_PACKET='starci/evidence-packet@1';
export const ACCEPTANCE_VERDICTS=Object.freeze(['pass','fail','inconclusive','unavailable']);

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const list=value=>Array.isArray(value)?value:[];
const nonempty=value=>typeof value==='string'&&Boolean(value.trim());
const identityMatches=(packet,identity)=>['workflowId','opId','attempt','generation','jobId'].every(field=>String(packet?.[field])===String(identity?.[field]));
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex');
const safeArtifact=(root,given)=>{
  if(!nonempty(given)||path.isAbsolute(given))throw new Error(`unsafe evidence path: ${given}`);
  const target=path.resolve(root,given),relative=path.relative(path.resolve(root),target);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw new Error(`evidence path escapes its root: ${given}`);
  const stat=fs.lstatSync(target);
  if(stat.isSymbolicLink()||!stat.isFile())throw new Error(`evidence artifact is not a regular file: ${given}`);
  const real=fs.realpathSync(target),realRelative=path.relative(fs.realpathSync(root),real);
  if(realRelative.startsWith('..')||path.isAbsolute(realRelative))throw new Error(`evidence artifact resolves outside its root: ${given}`);
  return real;
};

export function requiredGatesFor({kind,policy={}}={}){
  const configured=policy?.[kind]??policy?.default??[];
  return list(configured).map(item=>typeof item==='string'?{id:item,kind:item,required:true}:{required:true,...item});
}

export function validateEvidencePacket(packet,{requireIndependent=false}={}){
  const errors=[];
  if(packet?.schema!==EVIDENCE_PACKET)errors.push('invalid evidence schema');
  for(const field of ['gateId','gateKind','candidateDigest','oracleDigest','environmentDigest','owner'])if(!nonempty(packet?.[field]))errors.push(`missing ${field}`);
  for(const field of ['startedAt','finishedAt'])if(!nonempty(packet?.[field])||!Number.isFinite(Date.parse(packet[field])))errors.push(`missing or invalid ${field}`);
  if(packet?.complete!==true)errors.push('evidence packet is incomplete or truncated');
  if(!ACCEPTANCE_VERDICTS.includes(packet?.verdict))errors.push('invalid verdict');
  if(requireIndependent&&packet?.independentFromAttempt!==true)errors.push('gate requires evidence independent from the implementation attempt');
  if(requireIndependent&&(!nonempty(packet?.ownerAttemptId)||packet.ownerAttemptId===packet.opId))errors.push('independent gate requires a distinct owner attempt identity');
  if(!list(packet?.assertions).length)errors.push('missing assertions');
  for(const assertion of list(packet?.assertions)){
    if(!nonempty(assertion?.id)||!nonempty(assertion?.sourceRef)||!ACCEPTANCE_VERDICTS.includes(assertion?.outcome))errors.push('malformed assertion');
    if(assertion?.outcome==='pass'&&!list(assertion?.evidenceRefs).length)errors.push(`passing assertion ${assertion?.id??'(unknown)'} has no evidence`);
  }
  const ids=new Set();
  for(const artifact of list(packet?.artifacts)){
    if(!nonempty(artifact?.id)||!nonempty(artifact?.path)||!/^[a-f0-9]{64}$/.test(artifact?.sha256??''))errors.push('malformed artifact');
    else ids.add(artifact.id);
  }
  for(const assertion of list(packet?.assertions))for(const ref of list(assertion?.evidenceRefs))if(!ids.has(ref))errors.push(`assertion references missing artifact ${ref}`);
  return {ok:errors.length===0,errors};
}

/** Resolve every artifact from a verifier-owned evidence root and recompute its hash. */
export function resolveEvidencePacket(packet,{evidenceRoot,requireIndependent=false}={}){
  const base=validateEvidencePacket(packet,{requireIndependent}),errors=[...base.errors],artifacts=[];
  if(!evidenceRoot)errors.push('missing verifier-owned evidence root');
  else for(const artifact of list(packet?.artifacts)){
    try{
      const computed=sha256(fs.readFileSync(safeArtifact(evidenceRoot,artifact.path)));
      artifacts.push({...artifact,computedSha256:computed});
      if(computed!==artifact.sha256)errors.push(`artifact hash mismatch: ${artifact.id}`);
    }catch(error){errors.push(error.message);}
  }
  return {ok:errors.length===0,errors,packet:{...packet,resolvedArtifacts:artifacts,evidenceResolved:true}};
}

/** Required gates are fail closed: only a fresh, bound `pass` can admit integration. */
export function evaluateAcceptance({requirements=[],evidence=[],candidate,identity,evidenceRoots={}}={}){
  const blocking=[];
  if(!candidate||!nonempty(candidate.candidateDigest)||!nonempty(candidate.oracleDigest))blocking.push({gateId:'candidate',verdict:'inconclusive',reason:'missing sealed candidate identity'});
  for(const requirement of requirements){
    if(requirement.required===false)continue;
    const packet=evidence.find(item=>item?.gateId===requirement.id);
    if(!packet){blocking.push({gateId:requirement.id,verdict:'unavailable',reason:'required gate has no evidence packet'});continue;}
    const root=evidenceRoots[requirement.id];
    const valid=root?resolveEvidencePacket(packet,{evidenceRoot:root,requireIndependent:Boolean(requirement.independent)})
      :validateEvidencePacket(packet,{requireIndependent:Boolean(requirement.independent)});
    if(!valid.ok){blocking.push({gateId:requirement.id,verdict:'inconclusive',reason:valid.errors.join('; ')});continue;}
    if(requirement.resolveArtifacts!==false&&!root){blocking.push({gateId:requirement.id,verdict:'inconclusive',reason:'required gate evidence was not independently resolved'});continue;}
    if(identity&&!identityMatches(packet,identity)){blocking.push({gateId:requirement.id,verdict:'inconclusive',reason:'evidence belongs to another attempt/job generation'});continue;}
    if(packet.candidateDigest!==candidate.candidateDigest||packet.oracleDigest!==candidate.oracleDigest||packet.environmentDigest!==candidate.environmentDigest){
      blocking.push({gateId:requirement.id,verdict:'inconclusive',reason:'evidence is stale for the sealed candidate, oracle or environment'});continue;
    }
    const assertionFailure=packet.assertions.find(item=>item.outcome!=='pass');
    if(packet.verdict!=='pass'||assertionFailure)blocking.push({gateId:requirement.id,verdict:packet.verdict==='pass'?(assertionFailure?.outcome??'inconclusive'):packet.verdict,
      reason:assertionFailure?`assertion ${assertionFailure.id} is ${assertionFailure.outcome}`:`gate returned ${packet.verdict}`});
  }
  const precedence=['fail','inconclusive','unavailable'];
  const verdict=blocking.length?(precedence.find(value=>blocking.some(item=>item.verdict===value))??'inconclusive'):'pass';
  return {verdict,admitIntegration:verdict==='pass',blocking};
}

/** Narrow adapter for owner-request state: only kernel-resolved evidence can produce this receipt shape. */
export function kernelVerificationReceipt({id,requestId,evidence,acceptance,at=new Date().toISOString()}={}){
  if(!nonempty(id)||!nonempty(requestId))throw new TypeError('verification receipt requires id and requestId');
  if(evidence?.evidenceResolved!==true)throw new Error('owner verification receipt requires kernel-resolved evidence');
  if(!['pass','fail'].includes(acceptance?.verdict))throw new Error('owner verification receipt requires a conclusive kernel acceptance verdict');
  return {id,requestId,origin:'kernel-verification',status:acceptance.verdict==='pass'?'verified':'rejected',at};
}
