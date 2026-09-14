import fs from 'node:fs';
import path from 'node:path';
import {findWorkRoot,identityPaths,identitySecretPresent,identitySecretVersion} from '../core/identity.mjs';
import {credentialVersionChanged} from './inputs-replacement.mjs';
import {liveStatus,slash,unique} from './common.mjs';
import {isAsk,settleOwnerAsk} from './owner.mjs';

/**
 * Credential questions belong to the workflow. Orca receives one kernel-owned input page (inputs.mjs),
 * while a headless host retains identity fill. No model agent handles either path. The kernel settles asks
 * by encrypted-custody presence alone; values never enter state, events, reports or this module.
 */
/** An environment variable name as the code reads it: upper case words joined by underscores. */
export const VARIABLE_TOKEN=/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;
const CUSTODY_TOKEN=/\bidentity:([a-z0-9]+(?:[-_.][a-z0-9]+)*)\b/;
export const SLUG=/^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/;

/** Every variable name a sentence carries, in the order it carries them. */
export const variablesIn=text=>unique(String(text??'').match(VARIABLE_TOKEN)??[]);
/** The custody a sentence names, as its slug; null when it names none. */
export const custodyIn=text=>(String(text??'').match(CUSTODY_TOKEN)??[])[1]??null;

/**
 * What one credential question is actually asking for: the variables and the custody they live in. The tree's
 * own declaration wins when it has one - `extensions.work3.integrations` carries
 * `credential: {name, providedBy: owner, custody: identity:<slug>}`, which is where the exact spelling lives -
 * and the words of the question are read otherwise. Neither is invented: a question that names no variable and
 * a tree that declares no custody produce nulls, and the owner is told exactly that instead of a guess.
 */
export function credentialAsked(ask,{declared=[],requesters=[]}={}){
  // The custody slug is wherever it was said: the question, the ask op's own reports (an agent that could not
  // prepare still named "identity:<slug>" in its blocker), and what the requesters reported before asking.
  const said=op=>(op?.reports??[]).map(report=>`${report?.summary??''}\n${report?.blocker?.detail??''}`).join('\n');
  const text=`${ask?.question?.text??''}\n${ask?.question?.detail??''}\n${ask?.goal??''}\n${said(ask)}\n${requesters.map(said).join('\n')}`;
  const named=variablesIn(text);
  const rows=declared.filter(entry=>entry?.credential?.name);
  const matched=rows.filter(entry=>named.includes(entry.credential.name));
  const variables=matched.length?unique(matched.map(entry=>entry.credential.name)):named;
  const custody=matched.map(entry=>entry.credential.custody).find(Boolean)
    ??(custodyIn(text)?`identity:${custodyIn(text)}`:null)
    ??rows.map(entry=>entry.credential.custody).find(Boolean)??null;
  const provider=matched.map(entry=>entry.provider).find(Boolean)??matched.map(entry=>entry.id).find(Boolean)??null;
  return {variables,custody,provider,...(ask.credential?.replacements?{replacements:ask.credential.replacements}:{})};
}

/**
 * The exact command the owner copies. It carries the work root because the owner runs it wherever their
 * terminal happens to be, and a credential that lands in the wrong tree is a credential nobody can read.
 */
export function fillCommand({host=null,slug,variables=[],workRoot=null}={}){
  const runner=host?`${slash(path.join(String(host),'bin','starci.mjs'))}`:'<skill root>/bin/starci.mjs';
  return `node ${runner} identity fill ${slug??'<slug>'}`
    +variables.map(name=>` --name ${name}`).join('')
    +(workRoot?` --work-root ${slash(workRoot)}`:'');
}

/** The Work tree a custody of this workflow lives in: the bound ledger root, else the nearest tree of the worktree. */
export function workRootOf(state){
  if(typeof state?.ledgerRoot==='string'&&state.ledgerRoot.trim())return state.ledgerRoot;
  try{return findWorkRoot(state?.worktree??process.cwd());}catch{return null;}
}

/** Every credential ask waiting for the owner to run the command. Nothing else in the workflow waits for them. */
export const fillWaitingAsks=state=>(state?.ops??[])
  .filter(op=>isAsk(op.kind)&&op.fill===true&&liveStatus.includes(op.status)&&!op.answer);
export const inputReadyAsks=state=>fillWaitingAsks(state).filter(ask=>ask.credential?.ready===true);

/**
 * The one line the owner reads, wherever this workflow is printed: what to fill, where it lives, and the
 * command that does it. Never an instruction to invent a value, and never a value.
 */
export function askFillLine(ask){
  if(!ask?.credential?.ready)return 'The workflow is researching the integration and preparing its input requirements. No credential input is needed yet.';
  const names=[...(ask?.credential?.variables??[])];
  const custody=ask?.credential?.custody??null;
  if(ask?.inputMode==='gui')return names.length&&custody
    ?`Open this workflow's Credentials page in Orca to fill ${names.join(', ')} for ${custody}. Saved fields resume their waiting tasks automatically.`
    :`Credential request ${ask.id} needs an exact variable and identity custody declaration before its workflow form can accept input.`;
  if(!names.length||!custody)return `Fill the credential ${ask?.id} asks for: its question names no variable`
    +`${custody?'':' and no `custody: identity:<slug>` is declared for it'} - declare it on the integration record,`
    +` or answer with \`starci workflow-answer --op ${ask?.id} --note "<what you provided>"\`.`;
  return `Fill ${names.join(', ')} for ${custody}: copy and run  ${ask.fillCommand??fillCommand({slug:custody.replace(/^identity:/,''),variables:names})}`;
}
/** The `## Owner` section of a status page or a goal: one line per credential the owner still owes. */
export function ownerFillLines(state){
  const waiting=inputReadyAsks(state);
  if(!waiting.length)return [];
  return [`## Owner (${waiting.length})`,...waiting.map(ask=>`- ${askFillLine(ask)}`)];
}

/* ------------------------------------------------------------------ settling by presence */

const secretsOf=(workRoot,slug)=>{try{return identityPaths(workRoot,slug).secrets;}catch{return null;}};

/**
 * The owner filled the credential in: the presence of every variable is checked the way the contract checks
 * it, and only then is the ask settled - exactly as the report `credential: <VAR> present in identity:<slug>`
 * would have settled it. Nothing here has ever seen a value; the check reads an exit code.
 */
export function settleCredentialPresence(store,state,ask,{variables,custody,via='fill',workRoot=null,
  verifyPresence=identitySecretPresent,version=identitySecretVersion}={}){
  if(ask.credential?.preparationRequired&&!ask.credential.ready)return {ok:false,ask:ask.id,checked:[],reason:'official integration preparation is incomplete'};
  const slug=String(custody??'').replace(/^identity:/,'');
  const names=unique((variables??[]).filter(Boolean));
  if(!names.length)return {ok:false,ask:ask?.id??null,checked:[],reason:'the question names no credential variable'};
  if(!SLUG.test(slug))return {ok:false,ask:ask.id,checked:[],reason:`no custody \`identity:<slug>\` is declared for ${names.join(', ')}`};
  const root=workRoot??workRootOf(state);
  if(!root)return {ok:false,ask:ask.id,checked:[],reason:'this workflow has no Work tree to hold a custody'};
  for(const replacement of ask.credential?.replacements??[]){
    if(!names.includes(replacement.name)||!credentialVersionChanged(replacement.baseline,version({workRoot:root,slug,name:replacement.name})))
      return {ok:false,ask:ask.id,checked:[],reason:'The rejected credential still needs a new canonical write for that exact variable.'};
  }
  const checked=names.map(name=>{
    try{const answer=verifyPresence({workRoot:root,slug,name});return {name,ok:Boolean(answer?.ok),reason:answer?.reason??null};}
    catch(error){return {name,ok:false,reason:String(error?.message??error).slice(0,200)};}
  });
  const missing=checked.filter(entry=>!entry.ok);
  if(missing.length)return {ok:false,ask:ask.id,checked,reason:missing.map(entry=>`${entry.name}: ${entry.reason}`).join('; ')};
  // One settlement per variable, each the sentence the ask op would have reported, so a requester reads the
  // presence of every name it was stopped on and the log carries one `credential-present` per variable.
  const summary=names.map(name=>`credential: ${name} present in identity:${slug}`).join('; ');
  for(const name of names)settleOwnerAsk(store,state,ask,{summary:`credential: ${name} present in identity:${slug}`});
  ask.status='done';ask.fill=false;ask.dispatch=null;ask.terminal=null;
  ask.answer={choice:null,note:`present in identity:${slug}`,at:Date.now(),via};
  ask.reports=[...(ask.reports??[]),{outcome:'done',summary,files:[],checks:[],via}];
  state.needUser=(state.needUser??[]).filter(entry=>!(entry.op===ask.id&&entry.kind==='decision'));
  store.appendEvent({event:'provision-filled',ask:ask.id,variables:names,custody:`identity:${slug}`,via});
  return {ok:true,ask:ask.id,checked,summary};
}

/**
 * Every tick: has the owner run the command yet? The question is answered by the custody file and nothing
 * else, so it costs one `stat` while the file is unchanged and one short sops run when it is not. A kernel
 * that asked and then never looked again would be the old tab with extra steps.
 */
export function settleFilledAsks(store,state,ctx=null){
  const settled=[];
  const root=ctx?.work?.at?.workRoot??workRootOf(state);
  if(!root)return settled;
  for(const ask of fillWaitingAsks(state)){
    if(ask.credential?.preparationRequired&&!ask.credential.ready)continue;
    const slug=String(ask.credential?.custody??'').replace(/^identity:/,'');
    if(!SLUG.test(slug)||!(ask.credential?.variables??[]).length)continue;
    const secrets=secretsOf(root,slug);
    // Nothing filled in yet, or nothing has changed since the last look: no sops run, no event, no noise.
    let stamp=null;
    try{stamp=secrets?fs.statSync(secrets).mtimeMs:null;}catch{stamp=null;}
    if(stamp!==null&&ask.credential?.replacements?.length)stamp=JSON.stringify([stamp,...ask.credential.replacements.map(item=>(ctx?.credentialVersion??identitySecretVersion)({workRoot:root,slug,name:item.name}))]);
    if(stamp===null||ask.fillCheckedAt===stamp)continue;
    ask.fillCheckedAt=stamp;
    const answer=settleCredentialPresence(store,state,ask,{variables:ask.credential.variables,
      custody:ask.credential.custody,via:'fill',workRoot:root,
      ...(ctx?.verifyPresence?{verifyPresence:ctx.verifyPresence}:{}),...(ctx?.credentialVersion?{version:ctx.credentialVersion}:{})});
    if(answer.ok)settled.push(ask.id);
    else store.appendEvent({event:'provision-fill-incomplete',ask:ask.id,reason:answer.reason});
  }
  return settled;
}
