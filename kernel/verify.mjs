import fs from 'node:fs';
import path from 'node:path';
import * as llm from '../models/functions.mjs';
import {KERNEL_CHECK,RETRY_LIMIT,VALIDATOR_DIFF_BYTES,VALIDATOR_MEMORY_BYTES,VALIDATOR_MEMORY_LINES,VALIDATOR_UNAVAILABLE_LIMIT,
  CHECK_TIMEOUT_MS,firstLine,inside,ledgerAccess,normalize,oneLine,parseRef,plain,routeOf,rulingsText,slash,tail,unique,workValidateCommand} from './common.mjs';
import {ioPayload} from './io.mjs';

/**
 * Everything the kernel proves for itself, in one file, because they are one claim: a `done` is never taken on
 * trust. The machine half re-runs the operation's own checks and computes its changed files from git; the
 * judged half hands that reproduced result to the one validator of the workflow, with the memory the kernel
 * owns and the brand the operation was supposed to read. Nothing here launches, routes or writes the ledger -
 * it only answers whether what came back is what the kernel can reproduce and what the validator accepts.
 *
 * The brand lives here too, and for the same reason: the brand record is what a design verdict is founded on,
 * so the fields the kernel reads out of it (`brandFields`), the summary it prints (`brandSummary`) and the
 * payload the validator judges by (`brandPayload`) belong beside the verdict that uses them.
 */

/* ------------------------------------------------------------------ the brand */

const BRAND_DIRECTORY='brand';
/**
 * The brand record as the Work ledger answers it. A ledger build that knows about brands always carries the
 * field - `{node, rev, file, spec}` or `null` - and one that does not carries none, which is the only way the
 * kernel tells "this product has no brand yet" from "this tree was never asked about brands".
 */
export const brandAware=ctx=>{const access=ledgerAccess(ctx);return Boolean(access?.loaded)&&Object.hasOwn(access.loaded,'brand');};
/** A brand the kernel can hand to an operation: the node exists and its record carries a spec or a rev. A brand node with nothing authored yet is a brand still to decide, not one to read. */
export const brandOf=ctx=>{const brand=ledgerAccess(ctx)?.loaded?.brand;return plain(brand)&&(plain(brand.spec)||(brand.rev!==null&&brand.rev!==undefined))?brand:null;};
/**
 * The brand spec in the fields the kernel reads. The authored shape is the Work schema's (`identity.name`,
 * `color.tokens[]`, `mascot.assets[]`, `imagery.promptRules`); a spec that already names these fields flat is
 * read as it is, so an injected ledger and a real record answer the same. Asset paths are made tree-relative.
 */
export function brandFields(brand){
  const spec=plain(brand?.spec)?brand.spec:{};
  const treePath=entry=>{const p=slash(String(entry??'')).replace(/^\.\//,'');return !p?'':p.startsWith(`${BRAND_DIRECTORY}/`)?p:`${BRAND_DIRECTORY}/${p}`;};
  const tokenMap=Array.isArray(spec.color?.tokens)
    ?Object.fromEntries(spec.color.tokens.filter(plain).filter(item=>typeof item.token==='string'&&item.token).map(item=>[item.token,{value:item.value??null,role:item.role??null}]))
    :null;
  const mascot=Array.isArray(spec.mascot?.assets)?spec.mascot.assets.filter(plain).map(item=>treePath(item.path)).filter(Boolean):null;
  const rev=spec.rev??brand?.rev??null;
  return {
    name:spec.identity?.name??spec.name??brand?.name??null,
    family:spec.identity?.family??spec.family??brand?.family??null,
    rev:rev===undefined?null:rev,
    colorTokens:plain(spec.colorTokens)?spec.colorTokens:tokenMap,
    mascotAssets:unique((Array.isArray(spec.mascotAssets)?spec.mascotAssets.map(entry=>slash(String(entry??''))):mascot??[]).filter(Boolean)),
    forbidden:Array.isArray(spec.forbidden)?spec.forbidden:Array.isArray(spec.imagery?.forbidden)?spec.imagery.forbidden:null,
    imageryPromptRules:Array.isArray(spec.imageryPromptRules)?spec.imageryPromptRules:Array.isArray(spec.imagery?.promptRules)?spec.imagery.promptRules:null
  };
}
/** The brand file and every asset beside it, as the ledger names them; a ledger that names none adds nothing. */
export const brandReferencesOf=(api,loaded)=>{
  if(typeof api?.brandReferences!=='function'||!loaded?.brand)return [];
  try{return unique((api.brandReferences(loaded)??[]).map(entry=>slash(String(entry??''))).filter(Boolean));}catch{return [];}
};
/** What a contract prints and the status records: the brand's identity and its artwork, never the whole spec. */
export function brandSummary(loaded){
  const brand=loaded?.brand;
  if(!plain(brand)||!(plain(brand.spec)||(brand.rev!==null&&brand.rev!==undefined)))return null;
  const fields=brandFields(brand);
  return {node:brand.node??null,file:brand.file?slash(String(brand.file)):null,name:fields.name,family:fields.family,rev:fields.rev,mascotAssets:fields.mascotAssets};
}
/** What the validator is given: the brand as rules, trimmed to the fields a verdict may be founded on. */
export const BRAND_PAYLOAD=['name','family','rev','colorTokens','mascotAssets','forbidden','imageryPromptRules'];
export function brandPayload(loaded){
  const brand=loaded?.brand;
  if(!plain(brand))return null;
  const fields=brandFields(brand);
  const value={};
  for(const field of BRAND_PAYLOAD){
    const given=fields[field];
    if(given!==undefined&&given!==null&&!(Array.isArray(given)&&!given.length))value[field]=given;
  }
  return Object.keys(value).length?value:null;
}
/**
 * The brand summary on the state, and the one event a changed `rev` owes every operation that already read it.
 * A new rev is not the kernel's to act on beyond this: the Work validator binds a completion to the digest of
 * what it was built from, so a frontend-facing node whose brand moved is reopened in the tree itself and
 * `syncLedgerOps` picks it up on the next iteration like any other newly schedulable node.
 */
export function noteBrand(store,state,loaded,{op=null,silent=false}={}){
  if(!loaded||!Object.hasOwn(loaded,'brand'))return state.brand??null;
  const summary=brandSummary(loaded);
  const changed=String(state.brand?.rev??'')!==String(summary?.rev??'');
  state.brand=summary;
  if(changed&&!silent&&summary?.rev!==null&&summary?.rev!==undefined)
    store.appendEvent({event:'brand-revised',rev:summary.rev,node:summary.node??null,...(op?{op:op.id}:{})});
  return summary;
}
/**
 * An accepted brand decision is read back from the tree at once, and that is all the kernel does about it: the
 * new record and its rev become the material of every operation launched from here on, and the Work validator -
 * which binds a completion to the digest of what it was built from - is what reopens the frontend-facing nodes
 * that were built against the old brand. `syncLedgerOps` then picks them up as newly schedulable nodes.
 */
export function rereadBrand(store,state,op,ctx){
  try{
    const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});
    if(loaded.ok)ctx.work.loaded=loaded;
    noteBrand(store,state,loaded,{op});
  }catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
}

/* ------------------------------------------------------------------ machine verification */

/** Re-run the operation's own checks. A `done` the kernel cannot reproduce is not a `done`. */
/**
 * A check a Work node declares names the tree the way the tree names itself (`... validate .starciwork`); on a
 * shared ledger that tree is in the owner repository, not in this worktree, so the bare `.starciwork` argument
 * is the owner's absolute path when the kernel re-runs it here (the sales drawing was retried for `ENOENT`).
 */
export function sharedCheckCommand(command,ctx){
  const workRoot=ctx?.work?.shared?slash(ctx.work.ledger?.workRoot??''):'';
  if(!workRoot)return command;
  return String(command??'').replace(/(^|\s)\.starciwork(?=\s|$|\/)/g,`$1${workRoot}`);
}
const TREE_CHECK=/^work-(valid|tree-validates)$/i;
export function machineVerify(state,op,{exec,cwd=state.worktree,work=null}={}){
  const checks=[];
  // The whole-tree validator is the kernel's own gate at acceptance, never an operation check. An op that lists it
  // under its other name (`work-tree-validates`, the intake's and the cut's) is judged the way the kernel judges its
  // own: over the errors this op could have caused, never over a red corner of the tree another workflow owns.
  for(const check of (op.checks??[]).filter(check=>!KERNEL_CHECK.test(check.name??''))){
    if(TREE_CHECK.test(check.name??'')&&work){
      const verdict=treeVerdictFor({work},op);
      checks.push({name:check.name,command:check.command,exitCode:verdict.ok?0:1,evidence:verdict.ok
        ?(verdict.foreign.length?`${verdict.foreign.length} error(s) elsewhere in the tree are outside this operation`:'')
        :verdict.own.map(error=>`${error.code} ${error.path??''}: ${error.message??''}`).join('; ')});
      continue;
    }
    const result=exec(sharedCheckCommand(check.command,{work}),{cwd,timeoutMs:op.timeoutMs??CHECK_TIMEOUT_MS});
    const exitCode=Number.isInteger(result?.status)?result.status:1;
    checks.push({name:check.name,command:check.command,exitCode,evidence:tail(`${result?.stdout??''}${result?.stderr??''}`)});
  }
  return {ok:checks.every(check=>check.exitCode===0),checks,failed:checks.filter(check=>check.exitCode!==0)};
}

/**
 * The changed files of this worktree, filtered to the operation's allowlist: the kernel never trusts
 * report.files. `exclude` is the kernel-owned ledger set, which no operation commit may ever carry.
 */
export function changedFiles(state,op,{git},allowlist=op.allowlist,{exclude=[]}={}){
  // Every untracked file by name: a new record is one file in a new folder, and `git status` collapses that to
  // the folder, which no report ever names - so the record was never attributed to the op that wrote it.
  const shown=git('git',['status','--porcelain','--untracked-files=all'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  return unique((shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))))
    .filter(file=>inside(file,allowlist)&&!inside(file,exclude));
}

/**
 * The changed files this operation itself claimed, across every attempt it made: `report.files` of each of its
 * reports, intersected with what git actually shows. One Work tree is shared by a project's repositories, so a
 * record a frontend lane is writing right now is dirty in the backend's worktree beside the backend's own work;
 * whether it falls inside some allowlist says nothing about who wrote it. What an operation produced is what it
 * said it produced and git confirms. Its own uncommitted work from an earlier attempt still counts: that attempt
 * reported those files, and every report the operation ever sent is read here, not only the last one.
 *
 * `changedFiles` is unchanged and remains the git-computed truth - what is committed, what the validator judges
 * and what the proof plan reads. This narrows attribution only: who a changed file is charged to.
 */
export function attributedFiles(op,files=[],ctx=null){
  const owner=ctx?.work?.ledger?.repoRoot?`${normalize(ctx.work.ledger.repoRoot)}/`:null;
  const spellings=file=>{const value=normalize(file);return owner&&value.startsWith(owner)?[value,value.slice(owner.length)]:[value];};
  const claimed=new Set((op?.reports??[]).flatMap(report=>Array.isArray(report?.files)?report.files:[]).flatMap(spellings));
  return files.filter(file=>spellings(file).some(spelling=>claimed.has(spelling)));
}

/** The checks the kernel itself re-ran, carrying the assertion each one proves (the check name is that id). */
export const provenChecks=checks=>checks.map(check=>({name:check.name,command:check.command,exitCode:check.exitCode,assertion:check.name}));

/**
 * The checks the kernel owns (`work-valid`: the whole-tree validator) are stripped from every op, so the kernel
 * proves them itself when it records a node done: it validates the tree now and adds one passing check per
 * kernel-owned assertion the node declares. A tree that does not validate proves nothing and the write is refused.
 */
export function kernelProof(ctx,nodeId,op=null){
  if(!ctx.work||typeof ctx.work.api.readNode!=='function')return [];
  const node=ctx.work.node(nodeId);
  if(!node)return [];
  let owned=[];
  try{owned=ctx.work.api.nodeChecks(ctx.work.api.readNode(ctx.work.at,node)).filter(check=>KERNEL_CHECK.test(check.assertion??''));}catch{owned=[];}
  if(!owned.length)return [];
  // A red tree fails the op only where the op could have caused it: an error under a path another workflow
  // owns (a drawing's missing assets, a decision another lane wrote in the wrong folder) is foreign, reported
  // as `ledger-invalid`, and never the reason a backend slice is rejected twice and blocked.
  const verdict=treeVerdictFor(ctx,op??null);
  return owned.map(check=>({name:check.assertion,command:workValidateCommand(ctx),exitCode:verdict.ok?0:1,assertion:check.assertion,
    evidence:verdict.ok?(verdict.foreign.length?`${verdict.foreign.length} error(s) elsewhere in the tree are outside this operation`:''):verdict.own.map(error=>`${error.code} ${error.path??''}`).join('; ')}));
}
/**
 * The errors of the whole tree split by whether this op could have caused them: under its allowlist, in the
 * files it reported, or on the node it closes. Only its own errors count against it.
 */
export function treeVerdictFor(ctx,op){
  let result=null;
  try{result=ctx.work.validate({repoRoot:ctx.work.ledger?.repoRoot??ctx.work.repoRoot,workRoot:ctx.work.ledger?.workRoot??null});}catch(error){return {ok:false,own:[{code:'VALIDATOR',path:'',message:String(error?.message??error)}],foreign:[]};}
  if(!plain(result)||typeof result.ok!=='boolean'||!Array.isArray(result.errors)||result.errors.some(error=>!plain(error))||
    (result.ok&&result.errors.length>0)||(!result.ok&&result.errors.length===0))
    return {ok:false,own:[{code:'VALIDATOR',path:'',message:'Work validation returned missing, malformed, or contradictory evidence'}],foreign:[]};
  const errors=result.errors;
  if(result.ok===true)return {ok:true,own:[],foreign:[]};
  if(!op)return {ok:false,own:errors,foreign:[]};
  const owned=unique([...(op.allowlist??[]),...(op.files??[]),...(op.kernelOwned??[])].map(entry=>slash(String(entry))));
  const root=slash(ctx.work.ledger?.workRoot??'');
  const treePath=file=>{const value=slash(String(file??''));return root&&value.startsWith(`${root}/`)?`.starciwork/${value.slice(root.length+1)}`:value;};
  const within=(file,entry)=>{const e=treePath(entry).replace(/\/?\*+$/,'').replace(/\/+$/,'');return file===e||file.startsWith(`${e}/`);};
  const node=op.nodeId?ctx.work.node?.(op.nodeId):null;
  const nodePath=node?.path?`.starciwork/${slash(node.path)}`:null;
  const own=[],foreign=[];
  for(const error of errors){
    const file=`.starciwork/${slash(String(error.path??''))}`;
    const mine=!String(error.path??'').trim()||owned.some(entry=>within(file,entry))||(nodePath&&(file===nodePath||file.startsWith(path.posix.dirname(nodePath)+'/')));
    (mine?own:foreign).push(error);
  }
  return {ok:own.length===0,own,foreign};
}

/* ------------------------------------------------------------------ the validator */

/**
 * One validator per workflow, shared by every op: not an agent in a terminal (a serial bottleneck whose context
 * rots and that would itself need supervising) but an identity with memory - a headless `validateOp` call the
 * kernel makes for each result its own machine verification and proof already passed, before anything is
 * committed or written into the ledger. The kernel owns the memory (`<store>/validator/memory.md`, rebuilt
 * from `verdicts.jsonl` and the job rulings, bounded in lines and bytes) and hands it into every call, so the
 * verdicts stay consistent across ops. The verdict is data: it decides accept, retry or stop-at-the-user and
 * changes nothing else.
 */
const validatorPaths=store=>{const dir=path.join(store.dir,'validator');return {dir,memory:path.join(dir,'memory.md'),verdicts:path.join(dir,'verdicts.jsonl')};};
export function readValidatorMemory(store){try{return fs.readFileSync(validatorPaths(store).memory,'utf8');}catch{return '';}}
function readVerdicts(store){
  let text='';try{text=fs.readFileSync(validatorPaths(store).verdicts,'utf8');}catch{return [];}
  return text.split('\n').map(line=>line.trim()).filter(Boolean).map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
}
/** The memory page: job rulings first (binding), then the latest verdict lines, oldest dropped until the page fits. */
export function renderValidatorMemory(store,state){
  const lines=readVerdicts(store).slice(-VALIDATOR_MEMORY_LINES).map(item=>{
    const finding=item.verdict==='reject'&&item.findings?.[0]?` - finding: ${item.findings[0].file}: ${oneLine(item.findings[0].detail,120)}`:'';
    return `- ${item.op} | ${item.verdict} | ${oneLine(item.summary||item.reason||'')}${finding}`;
  });
  const rulings=oneLine(rulingsText(store),6*1024);
  const render=list=>[`# Validator memory - workflow ${state.id}`,``,`Job: ${firstLine(state.job)}`,``,
    ...(rulings?[`## Job rulings (binding)`,``,rulings,``]:[]),
    `## Verdicts (oldest first, op | verdict | summary)`,``,...(list.length?list:['- none yet']),``].join('\n');
  let text=render(lines);
  while(Buffer.byteLength(text)>VALIDATOR_MEMORY_BYTES&&lines.length>1){lines.shift();text=render(lines);}
  return text;
}
export function recordVerdict(store,state,op,record){
  const paths=validatorPaths(store);
  fs.mkdirSync(paths.dir,{recursive:true});
  fs.appendFileSync(paths.verdicts,`${JSON.stringify({at:Date.now(),op:op.id,node:op.nodeId,attempt:op.attempt,...record})}\n`);
  fs.writeFileSync(paths.memory,renderValidatorMemory(store,state));
}

/** The unified diff of the op's changed files against the head it started from; an untracked file is rendered as an added one. */
export function opDiff(state,op,files,{git}){
  const run=args=>git('git',args,{cwd:state.worktree,encoding:'utf8',windowsHide:true,maxBuffer:64*1024*1024});
  const base=op.baseHead??'HEAD';
  let text='';
  if(files.length){
    const shown=run(['diff','--no-color',base,'--',...files]);
    if(shown.status===0)text=shown.stdout??'';
    // `git diff <head>` shows nothing for a file git does not track yet: an added file is rendered as one.
    const others=run(['ls-files','--others','--exclude-standard','--',...files]);
    for(const file of (others.status===0?(others.stdout??''):'').split('\n').map(line=>normalize(line.trim())).filter(Boolean)){
      let body='';try{body=fs.readFileSync(path.join(state.worktree,file),'utf8');}catch{continue;}
      text+=`diff --git a/${file} b/${file}\nnew file mode 100644\n--- /dev/null\n+++ b/${file}\n${body.split('\n').map(line=>`+${line}`).join('\n')}\n`;
    }
  }
  const truncated=Buffer.byteLength(text)>VALIDATOR_DIFF_BYTES;
  if(truncated)text=`${Buffer.from(text).subarray(0,VALIDATOR_DIFF_BYTES).toString()}\n[diff truncated by the kernel at ${VALIDATOR_DIFF_BYTES} bytes; the validator sees a prefix]\n`;
  return {files,base,text,truncated};
}
/** The authored node the op closes, as the validator reads it: id, description and the assertions it must satisfy. */
function validatorNode(ctx,op){
  if(!ctx.work||!op.nodeId)return null;
  const node=ctx.work.node(op.nodeId);
  if(!node)return null;
  try{
    const raw=ctx.work.api.readNode(ctx.work.repoRoot,node);
    const all=Array.isArray(raw?.assertions)?raw.assertions.map(String):[];
    // An assertion this op does not carry a check for is proven elsewhere: by the kernel (work-valid) or by a later
    // lane step (the e2e run, the review). The validator is told so, or it rejects the op for what is not its job.
    const own=new Set((op.checks??[]).map(check=>String(check.name??'')));
    let named=[];try{named=ctx.work.api.nodeChecks(raw).map(check=>check.assertion).filter(Boolean);}catch{named=[];}
    const deferred=all.filter(assertion=>KERNEL_CHECK.test(assertion)||(named.includes(assertion)&&!own.has(assertion)));
    return {id:node.id,description:raw?.description??null,assertions:all.filter(assertion=>!deferred.includes(assertion)),deferred};
  }
  catch{return {id:node.id,description:null,assertions:[],deferred:[]};}
}
/** Runtimes the allocator has parked: the validator skips them instead of paying a call into a closed door. */
const coolingRuntimes=allocator=>{try{return (allocator?.snapshot?.()?.cooling??[]).map(item=>item?.runtime).filter(Boolean);}catch{return [];}};
const findingText=finding=>`validator: ${finding.file}${finding.line?`:${finding.line}`:''}${finding.assertion?` [${finding.assertion}]`:''} - ${finding.detail}`;

/**
 * Ask the validator about one result the kernel already reproduced. Returns `{verdict}` with `findings` on a
 * reject. `unavailable` (no provider, no parseable answer) never blocks: it is recorded, counted, and after
 * VALIDATOR_UNAVAILABLE_LIMIT in a row it is a needUser item. With `validateOp:null` the step is skipped once,
 * on the record.
 */
/**
 * The brand the validator judges by is the one on disk now. An op that wrote the brand record itself is judged
 * by its own record, never by the summary the last sync read before it ran: brand-1 set rev 1 and was rejected
 * twice for the rev 4 the sync had seen. Any other op is judged by the tree as last read.
 */
export function treeForVerdict(ctx,files){
  if(!ctx?.work||!(files??[]).some(file=>/(^|\/)brand\/index\.yaml$/.test(slash(String(file)))))return ctx?.work?.loaded??null;
  try{const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});ctx.work.loaded=loaded;return loaded;}catch{return ctx.work.loaded??null;}
}
export function validateAccepted(store,state,op,ctx,{files,verified,produced=null}){
  const strict=Boolean(ctx.v6?.requiredValidation);
  if(ctx.validateOp===null||ctx.validateOp===undefined){
    if(!state.validatorSkipped){state.validatorSkipped=true;store.appendEvent({event:'validator-skipped',reason:'no validator function was given to this kernel'});}
    return strict?{verdict:'unavailable',reason:'required validator is not configured'}:{verdict:'skipped'};
  }
  // The validator judges what the operation claimed and git confirms (`produced`, see `attributedFiles`): two
  // decision drafts share one `policy-decisions/**` allowlist, and the second ask was rejected twice for the first
  // ask's record that was dirty beside its own. An operation that claimed nothing is judged on everything it could
  // have changed, as before - a report that hides its files buys it nothing.
  const judged=strict?files:((produced??[]).length?produced:files);
  const left=files.filter(file=>!judged.includes(file));
  if(left.length)store.appendEvent({event:'validator-scope-attributed',op:op.id,judged,left:left.slice(0,12)});
  const verificationKind=['integration.verify','review.verify','e2e.verify','uat.verify'].includes(op.kind);
  const reproducedNoDiffEvidence=strict&&verificationKind&&(op.checks??[]).length>0&&verified.checks.length>=(op.checks??[]).length&&
    verified.checks.every(check=>check.exitCode===0&&typeof check.command==='string'&&check.command.trim()&&typeof check.evidence==='string'&&check.evidence.trim());
  // A review or a no-op slice changed nothing: there is no diff to judge, and a call on nothing could only misjudge.
  if(!judged.length&&!reproducedNoDiffEvidence){store.appendEvent({event:'validator-skipped',op:op.id,reason:'the operation changed nothing inside its allowlist, so there is no diff to judge'});return strict
    ?{verdict:'inconclusive',reason:'required validation has no observed candidate files'}:{verdict:'skipped'};}
  const providers=ctx.validator??llm.DEFAULT_VALIDATOR_RUNTIMES;
  const diff=strict&&ctx.v6Candidate?.packet?frozenCandidateDiff(ctx.v6Candidate,judged):opDiff(state,op,judged,ctx);
  if(strict&&diff.truncated){
    store.appendEvent({event:'validator-inconclusive',op:op.id,reason:'the complete candidate diff exceeds the validator transport bound',diffFiles:files});
    return {verdict:'inconclusive',reason:'required validator did not receive the complete candidate diff'};
  }
  const resolvedReferences=strict?resolveValidatorReferences(state,op,ctx.v6Candidate?.snapshot?.workerRoot):null;
  if(strict&&!resolvedReferences.ok){
    store.appendEvent({event:'validator-inconclusive',op:op.id,reason:resolvedReferences.errors.join('; ')});
    return {verdict:'inconclusive',reason:resolvedReferences.errors.join('; ')};
  }
  let result;
  // The kernel's own check (`work-valid`) is proven by the kernel, not by the agent: it goes to the validator with the
  // re-run checks, so an acceptance statement naming it is never rejected as unproven (repair-5 was, four times).
  const proven=[...verified.checks,...kernelProof(ctx,op.nodeId??op.ledgerIds?.[0]??null,op)];
  try{result=ctx.validateOp({op,node:validatorNode(ctx,op),diff,checks:proven,references:op.references,
    ...(strict?{resolvedReferences:resolvedReferences.entries,freshContext:true,
      authorAttemptId:ctx.v6Candidate?.packet?Object.fromEntries(['workflowId','opId','attempt','generation','jobId'].map(field=>[field,ctx.v6Candidate.packet[field]])):
        (typeof ctx.v6?.identity==='function'?ctx.v6.identity(op):{opId:op.id,attempt:op.attempt})}:{}),
    // What the kind declares it reads and produces travels with the verdict: a record cited outside `reads` or
    // written outside `writes` is a defect the validator can only name if it was told the declaration.
    io:ioPayloadOf(op.kind),
    // The brand travels with every verdict: a colour, a font, an icon or an artwork slot outside it is a defect,
    // and the validator can only say so if it was given the record the operation was supposed to read.
    brand:brandPayload(treeForVerdict(ctx,files)),
    memory:strict?'':readValidatorMemory(store),providers,skip:coolingRuntimes(ctx.allocator),cwd:ctx.cwd});}
  catch(error){if(error?.code==='STARCI_JOB_PENDING')throw error;result={ok:false,verdict:'unavailable',reason:error.message};}
  const verdict=llm.VALIDATOR_VERDICTS.includes(result?.verdict)?result.verdict:'unavailable';
  const summary=oneLine(result?.summary),provider=result?.provider??null,reason=oneLine(result?.reason)||null;
  const findings=(Array.isArray(result?.findings)?result.findings:[]).filter(item=>item&&typeof item.file==='string');
  op.validation={verdict,summary:summary||null,provider,at:ctx.now(),...(verdict==='unavailable'?{reason}:{})};
  for(const dropped of Array.isArray(result?.dropped)?result.dropped:[])
    store.appendEvent({event:'validator-finding-dropped',op:op.id,file:dropped.file,detail:oneLine(dropped.detail),diffFiles:files});
  recordVerdict(store,state,op,{head:state.head??op.baseHead??null,verdict,summary,findings,provider,usage:result?.usage??null,reason,diffTruncated:diff.truncated});
  if(verdict==='unavailable'){
    state.validatorUnavailable=(state.validatorUnavailable??0)+1;
    store.appendEvent({event:'validator-unavailable',op:op.id,reason,consecutive:state.validatorUnavailable,attempts:(result?.attempts??[]).length});
    if(state.validatorUnavailable>=VALIDATOR_UNAVAILABLE_LIMIT&&!state.needUser.some(item=>item.kind==='validator'&&!item.op))
      state.needUser.push({kind:'validator',detail:`the validator answered nothing usable for ${state.validatorUnavailable} op results in a row (${providers.join(', ')}); last: ${reason??'unknown'}`});
    return {verdict};
  }
  state.validatorUnavailable=0;
  if(verdict==='accept'&&strict&&(result?.complete!==true||result?.independentFromAttempt!==true||result?.freshContext!==true||!result?.reviewerAttemptId||result.reviewerAttemptId===op.id)){
    const missing='required validator result lacks complete, independent, fresh-context reviewer attestation';
    store.appendEvent({event:'validator-inconclusive',op:op.id,reason:missing,provider});
    return {verdict:'inconclusive',reason:missing};
  }
  if(verdict==='accept'){store.appendEvent({event:'validated',op:op.id,summary,provider,usage:result?.usage??null});return {verdict,provider,
    complete:result?.complete===true,independentFromAttempt:result?.independentFromAttempt===true,freshContext:result?.freshContext===true,
    reviewerAttemptId:result?.reviewerAttemptId??null};}
  store.appendEvent({event:'validator-rejected',op:op.id,summary,provider,findings:findings.slice(0,5).map(findingText),usage:result?.usage??null});
  return {verdict,findings:findings.map(findingText)};
}
function frozenCandidateDiff(candidate,files){
  const packet=candidate.packet,snapshot=candidate.snapshot,selected=new Set(files),chunks=[];
  for(const change of packet.changes.filter(item=>selected.has(item.path))){
    const read=(root,file)=>{try{const bytes=fs.readFileSync(path.join(root,file));return {encoding:'base64',bytes:bytes.length,content:bytes.toString('base64')};}catch{return null;}};
    chunks.push(JSON.stringify({path:change.path,beforeSha256:change.beforeSha256,afterSha256:change.afterSha256,
      before:read(snapshot.baseRoot,change.path),after:read(snapshot.workerRoot,change.path)}));
  }
  const text=chunks.join('\n'),truncated=Buffer.byteLength(text)>VALIDATOR_DIFF_BYTES;
  return {files,base:packet.acceptedHead,text,truncated};
}
function resolveValidatorReferences(state,op,rootOverride=null){
  const errors=[],entries=[],root=fs.realpathSync(rootOverride??state.worktree);
  for(const given of unique(op.v6ResolvedReferences??op.references??[])){
    let parsed,relative,fragment;
    try{parsed=parseRef(given);const literal=slash(parsed.ref),hash=literal.indexOf('#');relative=normalize(hash<0?literal:literal.slice(0,hash));fragment=hash<0?null:literal.slice(hash+1);}
    catch(error){errors.push(`validator reference is invalid: ${String(given)} (${error.message})`);continue;}
    if(!relative||path.isAbsolute(relative)||/^[A-Za-z]:\//.test(relative)||relative==='..'||relative.startsWith('../')||relative.includes('/../')){errors.push(`validator reference escapes the candidate root: ${String(parsed.ref)}`);continue;}
    let target=path.resolve(root,relative);
    try{
      if(fs.lstatSync(target).isDirectory()){const index=['index.yaml','index.yml','index.json','index.md'].find(name=>fs.existsSync(path.join(target,name)));if(!index)throw Object.assign(new Error('directory has no canonical index'),{code:'EISDIR'});relative=`${relative.replace(/\/$/,'')}/${index}`;target=path.join(target,index);}
      const stat=fs.lstatSync(target),real=fs.realpathSync(target),back=path.relative(root,real);
      if(stat.isSymbolicLink()||!stat.isFile()||back.startsWith('..')||path.isAbsolute(back)){errors.push(`validator reference is not a contained regular file: ${given}`);continue;}
      entries.push({kind:parsed.kind,path:relative,fragment,ref:parsed.ref,bytes:fs.readFileSync(real)});
    }catch(error){errors.push(`validator reference is unreadable: ${given} (${error.code??error.message})`);}
  }
  return {ok:errors.length===0,entries,errors};
}
/** A kind the io module cannot read (a plan-ledger kind the catalog never declared) simply declares nothing. */
const ioPayloadOf=kind=>{try{return ioPayload(kind);}catch{return {reads:[],writes:[]};}};

/**
 * How many times one op may be retried. The `validator-reject` route carries its own, lower limit: the accept
 * path that re-validates a written ledger (`validateAccepted`) reads it from here, so the bound lives in the
 * graph with every other route bound and not in two places.
 */
export const validatorRejectLimit=()=>routeOf({verdict:'reject'})?.limit??RETRY_LIMIT;
