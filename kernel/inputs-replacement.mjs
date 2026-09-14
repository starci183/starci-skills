import {identitySecretVersion} from '../core/identity.mjs';
import {declaredIntegrations} from './ledger.mjs';
import {integrationReadiness,relatedIntegrations} from './inputs-readiness.mjs';

const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const revision=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
export const credentialVersionChanged=(before,current)=>Boolean(before&&current&&digest(before.ciphertextDigest)
  &&digest(current.ciphertextDigest)&&revision(current.writeRevision)&&current.writeRevision!==before.writeRevision
  &&current.ciphertextDigest!==before.ciphertextDigest);
const same=(a,b)=>Boolean(a&&b&&a.ciphertextDigest===b.ciphertextDigest&&a.writeRevision===b.writeRevision);
const declaredFor=(op,ctx)=>ctx.work?relatedIntegrations(op,declaredIntegrations(ctx.work.loaded).list,ctx.work.loaded.list):[];

/** Freeze the custody version tested by this verifier, before its agent starts. */
export function snapshotCredentialVersions(op,ctx,{version=ctx.credentialVersion??identitySecretVersion}={}){
  if(op.kind!=='integration.verify'||!ctx.work)return [];
  return declaredFor(op,ctx).filter(entry=>entry.credential?.custody&&entry.credential?.name).map(entry=>({
    name:entry.credential.name,custody:entry.credential.custody,
    version:version({workRoot:ctx.work.at.workRoot,slug:entry.credential.custody.replace(/^identity:/,''),name:entry.credential.name})}));
}

/** Admit only an explicit rejected-credential report bound to this operation's declared failing live check. */
export function credentialReplacementFor(op,report,ctx,{version=ctx.credentialVersion??identitySecretVersion}={}){
  const request=report.credentialRequest;
  if(op.kind!=='integration.verify'||!ctx.work||!request)return {ok:false,reason:'Credential replacement belongs to its owning integration verifier.'};
  const failed=(report.checks??[]).find(check=>check.name===request.check&&check.exitCode!==0);
  if(!failed||(op.checks??[]).filter(check=>check.name===request.check&&check.command===failed.command).length!==1)
    return {ok:false,reason:'Credential replacement must name the declared failing live verification check and its exact command.'};
  const rows=declaredFor(op,ctx),replacements=[],custodies=new Set();
  for(const name of request.variables){
    const matches=rows.filter(entry=>entry.credential?.name===name);
    if(!matches.length||matches.some(entry=>!integrationReadiness(entry,{now:ctx.now?.()??Date.now(),stage:'input'}).ok))
      return {ok:false,reason:'Research and executable preparation for each rejected credential must be complete in this verifier\'s declared scope.'};
    const custody=matches[0].credential.custody;
    if(matches.some(entry=>entry.credential.custody!==custody))return {ok:false,reason:'The rejected credential has ambiguous custody.'};
    custodies.add(custody);
    const tested=(op.credentialVersions??[]).find(item=>item.name===name&&item.custody===custody)?.version;
    const current=version({workRoot:ctx.work.at.workRoot,slug:custody.replace(/^identity:/,''),name});
    if(!same(tested,current))return {ok:false,reason:'Credential custody changed or has no launch baseline; verify the current custody on a fresh attempt before requesting replacement.'};
    replacements.push({name,reason:request.reason,baseline:tested});
  }
  if(custodies.size!==1)return {ok:false,reason:'One credential replacement request must belong to exactly one declared custody.'};
  return {ok:true,custody:[...custodies][0],variables:[...request.variables],replacements};
}
