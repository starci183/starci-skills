import crypto from 'node:crypto';

export const PREPARATION_SCHEMA='starci/integration-preparation@1';
const text=value=>typeof value==='string'&&Boolean(value.trim());
const list=value=>Array.isArray(value)&&value.every(text);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const https=value=>{try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}};

/** Evidence validation is structural, not a claim that a cited publisher or interpretation is correct.
 * The owning operation and its independent review must actually read the official sources and check claims.
 */
export function integrationReadiness(entry,{now=Date.now(),stage='research'}={}){
  const prep=entry?.preparation,errors=[];
  const fail=code=>errors.push(code);
  if(prep?.schema!==PREPARATION_SCHEMA)return {ok:false,errors:['official-documentation-research-missing'],preparation:null};
  const sources=Array.isArray(prep.sources)?prep.sources:[];
  if(!sources.length)fail('official-sources-missing');
  for(const source of sources){
    const date=Date.parse(source?.readAt??'');
    if(!https(source?.url)||!text(source?.title)||!text(source?.publisher)||source?.official!==true
      ||!Number.isFinite(date)||date>now+5*60*1000||!text(source?.observation))fail('official-source-evidence-invalid');
  }
  const urls=new Set(sources.filter(Boolean).map(source=>source.url));
  const traced=value=>list(value?.sourceRefs)&&value.sourceRefs.length>0&&value.sourceRefs.every(url=>urls.has(url));
  const auth=prep.auth;
  if(!text(auth?.scheme)||!text(auth?.account)||!list(auth?.scopes)||!text(auth?.scopeReason)||!traced(auth)
    ||!['issue','expiry','refresh','rotate','revoke'].every(key=>text(auth?.lifecycle?.[key])))fail('authentication-lifecycle-incomplete');
  const credential=prep.credential;
  if(credential?.name!==entry?.credential?.name||credential?.custody!==entry?.credential?.custody
    ||!text(credential?.label)||!text(credential?.meaning)||!text(credential?.obtain)||!traced(credential))fail('credential-semantics-unproven');
  for(const kind of ['callback','webhook']){
    const point=prep.interfaces?.[kind];
    if(typeof point?.applicable!=='boolean'||!text(point?.reason)||!traced(point)
      ||point.applicable&&(!text(point?.requirements)||!text(point?.verification)))fail(`${kind}-applicability-unresolved`);
  }
  const prerequisites=Array.isArray(prep.prerequisites)?prep.prerequisites:[];
  if(!Array.isArray(prep.prerequisites))fail('prerequisites-missing');
  const ownerSteps=new Set(prerequisites.filter(step=>step?.owner==='owner'&&step.status==='pending').map(step=>step.id));
  for(const step of prerequisites){
    if(!text(step?.id)||!['workflow','owner'].includes(step?.owner)||!text(step?.action)||!text(step?.reason)||!traced(step)
      ||!['ready','pending'].includes(step?.status))fail('prerequisite-ownership-unresolved');
    const waitsForOwner=list(step?.dependsOn)&&step.dependsOn.length>0&&step.dependsOn.every(id=>ownerSteps.has(id));
    if(step?.owner==='workflow'&&step.status==='ready'&&!text(step.evidence))fail('machine-preparation-evidence-missing');
    if(stage==='input'&&step?.owner==='workflow'&&step.status==='pending'&&!waitsForOwner)fail('machine-preparation-pending');
  }
  const proof=prep.verification;
  if(!list(proof?.steps)||!proof.steps.length||!text(proof?.success)||!text(proof?.failure)||!traced(proof))fail('live-verification-plan-missing');
  return {ok:errors.length===0,errors:[...new Set(errors)],preparation:prep};
}

/** Shared mandatory text; source captures and claims live in the owning canonical integration declaration. */
export const INTEGRATION_RESEARCH_ORDER=`Before deciding an external integration's design, credential fields or owner setup, READ the provider's current OFFICIAL documentation using the available browser/search tool. A variable name or old code never establishes its meaning. Keep primary-source URLs, publisher, title, actual read date and a concise observation of the relevant evidence in the owning declaration's preparation.sources. Independently verify that each source is official and each claim is supported; a URL alone is not proof the page was read. Recheck the current provider/API version when a change or observed discrepancy makes prior research stale. Record preparation with schema ${PREPARATION_SCHEMA}: auth {scheme, account, scopes, scopeReason, lifecycle {issue, expiry, refresh, rotate, revoke}, sourceRefs}; credential {name, custody, label, meaning, obtain, sourceRefs}; interfaces {callback, webhook}, each {applicable, reason, sourceRefs} and, when applicable, {requirements, verification}; prerequisites [{id, owner: workflow|owner, action, reason, status: ready|pending, evidence, dependsOn, sourceRefs}]; verification {steps, success, failure, sourceRefs}. Every source is {url, title, publisher, official: true, readAt, observation}. sourceRefs name source URLs. Prepare every currently executable machine-owned prerequisite within existing authority before asking the owner. A machine step that requires an owner action may stay pending with dependsOn naming that pending owner step; run it after the owner acts. Owner-only steps explain why a human is required. Callback/webhook requirements depend on the actual provider and integration; never require them universally. Unavailable documentation is a RESEARCH GAP to repair or report as failed with safe evidence, never a credential request. Missing authority for machine setup is its actual authority boundary, never disguised as a missing secret. Keep a live verification plan and distinguish stored presence from provider validity. Write preparation only in an owned declaration; a consumer without that write scope returns an sds-gap/shared-change through the existing owning-operation route. Never invent sources, accounts, scopes, credentials, setup completion, or live evidence.`;

export function relatedIntegrations(op,entries,nodes=[]){
  const byId=new Map(nodes.map(node=>[node.id,node]));
  const selected=[op?.nodeId,...(op?.ledgerIds??[]),...(op?.references??[])];
  for(const value of [...selected])for(const dependency of byId.get(value)?.dependsOn??[])selected.push(typeof dependency==='string'?dependency:dependency?.id);
  const paths=selected
    .map(value=>String(byId.get(value)?.path??value??'').replaceAll('\\','/'));
  const integrationIds=new Set(paths.map(value=>value.match(/(?:^|\/)integration\/([^/]+)(?:\/|$)/)?.[1]).filter(Boolean));
  if(integrationIds.size)return entries.filter(entry=>integrationIds.has(entry.id));
  return entries.filter(entry=>selected.includes(entry.declaredBy)||paths.includes(entry.declaredPath));
}

/** A credential ask is writable only after every requested name has a current, complete preparation. */
export function prepareCredentialAsk(ask,entries,{now=Date.now()}={}){
  const credential=ask.credential??{},preparations=[];
  for(const name of credential.variables??[]){
    const matches=entries.filter(entry=>entry.credential?.name===name&&entry.credential?.custody===credential.custody);
    const checked=matches.map(entry=>({entry,result:integrationReadiness(entry,{now,stage:'input'})}));
    // Duplicate declarations must agree about credential meaning; one stale copy cannot be ignored.
    const valid=checked.length>0&&checked.every(item=>item.result.ok)
      &&new Set(checked.map(item=>item.entry.preparation?.credential?.meaning)).size===1;
    const entry=checked[0]?.entry;
    preparations.push({name,ok:valid,errors:valid?[]:checked.length?checked.flatMap(item=>item.result.errors):['integration-declaration-missing'],
      ...(entry?.preparation?{preparation:entry.preparation,provider:entry.provider}:{}),owners:[...new Set(matches.map(item=>item.declaredBy))]});
  }
  ask.credential={...credential,preparationRequired:true,preparations,
    ready:preparations.length>0&&preparations.every(item=>item.ok)};
  return ask.credential.ready;
}

/** A research repair may change preparation only, never the surrounding accepted product semantics. */
export function preparationFingerprint(raw){
  const clean=structuredClone(raw);
  for(const entry of clean?.extensions?.work3?.integrations??[])delete entry.preparation;
  const ordered=value=>Array.isArray(value)?value.map(ordered):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,ordered(value[key])])):value;
  return digest(JSON.stringify(ordered(clean)));
}
