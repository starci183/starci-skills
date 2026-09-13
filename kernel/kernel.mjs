import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {skillRoot} from '../core/runtime-root.mjs';
import {getPath} from '../hosts/orca/calls.mjs';
import {waitTick} from '../hosts/orca/protocol.mjs';
import {buildOperationLaunch,notifyTerminal,settleDispatch,startOperation,sweepWorktree} from '../hosts/orca/launch.mjs';
import {validateReport} from './reports.mjs';
import {WORKFLOW_STATE,createStore,newWorkflowId,repositoryRoot,workflowsRoot} from './store.mjs';
import {grammarRepository,resolveLedgerRoot,sharedLedgerStatus} from './routing.mjs';
import {createAllocator,loadRuntimes} from './schedule.mjs';
import {loadsFileFor} from './loads.mjs';
import {proofFinding,proofPlan,runAtBase} from '../checks/proof.mjs';
import {stepsFor} from './contract.mjs';
import * as work from './ledger.mjs';
import * as llm from '../models/functions.mjs';
import * as graph from './graph.mjs';

import {AUTHOR_KIND,PLAN_KIND,AUTHORS_RECORD,authorsRecord,BRAND_DECIDE,BRAND_KIND,CHECK_TIMEOUT_MS,DYNAMIC_OPS_BUDGET,FINAL_REPORT,GATE_ROUNDS,GOAL_RECORD,
  KERNEL_CHECK,LAUNCH_LIMIT,LAUNCH_OPERATOR,LAUNCH_WAIT_MS,LEDGER_MODES,POLL_MS,RATE_LIMIT_WINDOW_MS,RECORD_OWNED,
  RESTART_LIMIT,RESUME_LIMIT,RETRY_LIMIT,SHARED_OPS_PER_ITERATION,SILENCE_LIMIT,STALL_MS,VALIDATOR_REJECT_LIMIT,
  VALIDATOR_UNAVAILABLE_LIMIT,VERIFY_ROUNDS,WORKFLOW_KERNEL,WORK_LEDGER,WORK_OPERATION,DECISION_OPERATION,
  addOp,allowlistsOverlap,byId,clockOf,covers,csv,currentBranch,describeNode,detectLedgerMode,dynamicBudget,firstLine,
  countsAgainstBudget,grammarReferences,hostDescriptorOf,hostMissing,inScopePath,inside,jobRulings,kernelGuards,kindRole,
  launchOperator,ledgerBinding,ledgerItem,liveStatus,locateSharedTreePaths,need,nextId,normalize,parseGate,parseQuota,
  parseRef,pathsIn,plain,readJson,reportAllowlist,required,routeKind,routeOf,routed,rulingsText,slash,sleepSync,runCommand,
  tail,toOp,unique,validateCommandAt,workModule,workOpId,workValidateCommand,writeJson} from './common.mjs';
import {ioBlock,kindsReadingBrand,undeclaredWrites} from './io.mjs';
import {readDistJson} from '../core/runtime-root.mjs';
import {recordDigests,reconcileIntake} from './reconciliation.mjs';
import {renderChecksFor} from '../checks/render.mjs';
import {laneOwnerOf,laneNameOf,laneRowTitle,laneView,openLane,settleLane,laneBranchRef} from './lanes.mjs';
import {RECONCILE_EVERY,SWEEP_MS,TAB_STATUSES,bindRun,closeOpTerminal,listTerminals,ownKernelTerminal,rebindRunIfNeeded,
  recoverCoordinatorTab,reconcileWithOrca,releaseKernelTab,siblingKernelGone,sweepStaleTerminals} from './terminals.mjs';
import {MECHANICAL_QUESTION,OWNER_ASK,answerOrEscalate,answerOwnerQuestion,credentialNeed,decisionAllowlistFor,
  openOwnerAsk,resumeWithAnswer,settleOwnerAsk} from './owner.mjs';
import {BRAND_PAYLOAD,brandAware,brandFields,brandOf,brandPayload,brandReferencesOf,brandSummary,changedFiles,
  kernelProof,machineVerify,noteBrand,opDiff,provenChecks,readValidatorMemory,recordVerdict,renderValidatorMemory,
  rereadBrand,sharedCheckCommand,treeForVerdict,validateAccepted,validatorRejectLimit} from './verify.mjs';
import {KERNEL_PLANNED_KINDS,LANE_LAYOUTS,advanceLanes,authorRecordOp,commitLedgerWrite,cutParentOf,deriveWorkOp,designGate,
  designNodeOf,designRecord,fanOutDeferral,groupIncomplete,groupVerifyKind,guardKernelPaths,guardRecordBlocks,kernelOwnedPaths,
  laneNext,laneOf,lanePredicates,
  laneProgress,laneSkip,laneText,laneWalked,ledgerWrite,markLedger,nodeLayout,protectedFingerprint,pruneAnsweredQuestions,
  CUT_OWNED,quarantineStrays,recordBlocks,recordDone,recordPath,repairKernelRecords,repairTarget,retemplateLanes,settleCut,
  sweepTreeStrays,syncLedgerOps} from './sync.mjs';
import {intakeOp,retemplateIntakeOps,scopeNames,settleIntake} from './intake.mjs';
import {CRITIQUE_HEADING,approve,critiqueGoalPhase,critiqueLines,critiqueRuntimes,decidedRecords,fallbackGoalMarkdown,
  goalPhase,laneHeaderLines,noteCritiqueInGoal,noteLaneInGoal,planCritiquePrerequisites,planGoalPhase,proposeQuota,
  recordStatements,validateWorkTree,workGoalMarkdown,workGoalPhase} from './goal.mjs';

/**
 * The StarCi 5.0 workflow kernel: one process per job. It assesses the goal into a ledger and a dynamic
 * list of operations, stops for the user's approval, then runs a pool of operations in ONE worktree under
 * disjoint allowlists until every ledger item is implemented, verified and the job gates are green.
 *
 * There is no Coordinator, no per-module Monitor and no provider chain: a runtime comes from the allocator,
 * every transition is an event in the workflow store, and `done` is never taken on trust - the kernel
 * re-runs the operation's own checks itself and commits only what it could reproduce.
 *
 * What is left in this file is the loop and nothing else: schedule, launch, accept a report, route what it
 * implies, run the gates, finish. Each of the concerns it calls is a file of its own and says in its own head
 * why it is one - `common.mjs` (what they all share), `io.mjs` (what a kind reads and produces), `goal.mjs`
 * (everything before the one human gate), `intake.mjs` (records the tree does not hold yet), `sync.mjs` (the
 * Work tree read and written), `owner.mjs` (the owner decides, the runtime prepares), `verify.mjs` (a `done`
 * is never taken on trust), `lanes.mjs` (the worktree a workflow owns) and `terminals.mjs` (a tab exists only
 * while somebody reads it). Every name they export is re-exported here, so a caller that knows the kernel as
 * one module keeps working.
 */

export {WORKFLOW_KERNEL,FINAL_REPORT,GOAL_RECORD,LEDGER_MODES,WORK_LEDGER,WORK_OPERATION,DECISION_OPERATION,
  BRAND_KIND,BRAND_DECIDE,LAUNCH_OPERATOR,launchOperator,kindRole,AUTHOR_KIND,PLAN_KIND,AUTHORS_RECORD,authorsRecord,RECORD_OWNED,STALL_MS,
  DYNAMIC_OPS_BUDGET,VALIDATOR_REJECT_LIMIT,VALIDATOR_UNAVAILABLE_LIMIT,allowlistsOverlap,kernelGuards,
  currentBranch,detectLedgerMode,ledgerBinding,dynamicBudget,hostDescriptorOf,hostMissing,parseQuota,
  reportAllowlist,workOpId,workModule,grammarReferences};
export {laneRowTitle,LANE_NAME,laneNameOf,laneOwnerOf,openLane,laneView} from './lanes.mjs';
export {RECONCILE_EVERY,SWEEP_MS,TAB_STATUSES,recoverCoordinatorTab,reconcileWithOrca,rebindRunIfNeeded,
  sweepStaleTerminals} from './terminals.mjs';
export {OWNER_ASK,credentialNeed,openOwnerAsk,answerOwnerQuestion} from './owner.mjs';
export {BRAND_PAYLOAD,brandFields,brandPayload,brandSummary,changedFiles,machineVerify,opDiff,readValidatorMemory,
  renderValidatorMemory,sharedCheckCommand,treeForVerdict,validatorRejectLimit} from './verify.mjs';
export {LANE_LAYOUTS,KERNEL_PLANNED_KINDS,nodeLayout,laneOf,lanePredicates,designRecord,deriveWorkOp,syncLedgerOps,
  kernelOwnedPaths,protectedFingerprint} from './sync.mjs';
export {CUT_ASSERTIONS,CUT_COMPONENTS,CUT_FILES,FAN_OUT,childOwning,cutGroup,cutOp,cutParentOf,cutReason,fanOutDeferral,
  groupIncomplete,groupVerifyKind,repairTarget,sdsComponents,settleCut} from './sync.mjs';
export {CRITIQUE_HEADING,approve,critiqueGoalPhase,critiqueLines,critiqueRuntimes,decidedRecords,goalPhase,
  laneHeaderLines,planGoalPhase,proposeQuota,recordStatements,validateWorkTree,workGoalPhase} from './goal.mjs';
export {ioBlock,ioPayload,kindsReadingBrand,intakeKindFor,decisionKindFor,recordKindOfPath,undeclaredWrites} from './io.mjs';
/**
 * The design grammar and the brand record are read by exactly these kinds. The list is no longer written here:
 * `kindsReadingBrand()` derives it from the kinds profile, and this constant is the snapshot the docs and the
 * tests still name. Every call site asks the function, so a profile that adds a kind is followed without an edit.
 */
export const DESIGN_KINDS=kindsReadingBrand();

/** The whole mutable state of one workflow. `schema` is the store's, so state.json is written atomically by it. */
export function createWorkflowState({job,inputs=[],worktree,branch,gates=[],store,host=null,launcher=null,
  ledgerMode='plan',scope=[],reintake=[],repoRoot=null,ledgerRoot=null,ledgerOwner=null,ledgerSource=null,ledgerShared=false,
  codeRole=null,codeSide=null,lane=null}){
  need(plain(store)&&typeof store.id==='string','A workflow store is required');
  need(LEDGER_MODES.includes(ledgerMode),`Unsupported ledger mode ${ledgerMode}; use ${LEDGER_MODES.join(' or ')}`);
  return {schema:WORKFLOW_STATE,kernel:WORKFLOW_KERNEL,id:store.id,dir:store.dir,
    job:required(job,'job'),inputs:inputs.map(parseRef),worktree:path.resolve(required(worktree,'worktree')),
    branch:required(branch,'branch'),gates:gates.map(parseGate),host,launcher,
    // The worktree above is this workflow's lane when it owns one: the tree it runs in, and the branch that is
    // merged back into `lane.base.branch` when the workflow finishes done.
    lane:plain(lane)?{...lane}:null,
    ledgerMode,scope:[...scope],reintake:[...reintake],repoRoot:repoRoot?path.resolve(repoRoot):null,
    // The code root is the worktree above; these name the tree the Work itself lives in, which may belong to
    // another repository of the same product.
    ledgerRoot:ledgerRoot?path.resolve(ledgerRoot):null,ledgerOwner:plain(ledgerOwner)?{...ledgerOwner}:null,
    ledgerSource,ledgerShared:Boolean(ledgerShared),codeRole,codeSide,
    // The repositories the binding declares by role, resolved at goal time and on every resume; `grammar` is the
    // one the kernel routes to itself, and null here means this workflow may not change the grammar.
    ledgerRoles:null,
    run:null,from:null,workflowTask:null,phase:'goal',approved:false,
    definitionOfDone:[],risks:[],questions:[],ledger:[],ops:[],needUser:[],gateResults:[],verifyRounds:{},gateRounds:0,
    lanes:{},
    decisions:[],ledgerSummary:null,brand:null,
    // The critique of the goal (`critiqueGoal`) and, when its verdict was `refuse`, the owner's own override of it.
    critique:null,critiqueOverride:null,
    dynamicOps:0,dynamicOpsBudget:DYNAMIC_OPS_BUDGET,sharedQueue:[],silences:{},preflight:null,
    head:null,iterations:0,counters:{},stalls:0,allocation:null,finished:null,createdAt:Date.now()};
}

const componentKey=ledgerIds=>[...ledgerIds].sort().join('+')||'-';
/**
 * The key a review round is counted against: the reviewed item set. Counting per module burned a feature's
 * three rounds on three different nodes, so the fourth node of a feature was never reviewed at all.
 */
const groupKey=(state,ledgerIds)=>{
  return componentKey(ledgerIds);
};
const implementsLedger=op=>op.kind!=='review.verify'&&(op.ledgerIds??[]).length>0;

/* ------------------------------------------------------------------ contract */

/**
 * The operation contract. The kernel owns every concrete value (goal, ledger items, allowlist, acceptance,
 * checks, report command); the process prose - cook until done, the mandatory ping, the never list - is
 * reused from docs/supervision-templates/op.md so one template serves every operation kind.
 */

/**
 * The lane line of a contract: the template this operation's node travels and which step this operation is.
 * An operation that belongs to no lane (a plan-ledger op, a shared change, a gate repair) gets no line.
 */
export function laneLine(state,op){
  const entry=state?.lanes?.[op?.nodeId??'']??state?.lanes?.[(op?.ledgerIds??[])[0]??'']??null;
  if(!entry?.lane?.length)return null;
  // An author op is no step of the lane: it is what makes the lane launchable, so it is named as preceding it.
  const walked=laneWalked(entry);
  if(op?.kind===PLAN_KIND)return `Lane: this op precedes ${laneText(walked)}; the kernel launches the children it writes itself - the seam first, then the rest at once - and proves the whole group once`;
  if(op?.kind===AUTHOR_KIND)return `Lane: this op precedes ${laneText(walked)}, which the kernel launches itself once this record is complete`;
  const at=walked.indexOf(op.kind);
  return `Lane: ${laneText(walked)} (this op: step ${at<0?(entry.done??[]).length+1:at+1} of ${walked.length})`;
}

/**
 * The brand, in the contract of every operation that may draw, build or judge a surface. It is short on
 * purpose - the identity, the rev and where the artwork is - because the record itself is in the references
 * right above it: the block exists so no design operation can claim it did not know the brand was there.
 */
function brandBlock(op,brand){
  if(!plain(brand)||!kindsReadingBrand().includes(op.kind))return [];
  return [`## Brand`,
    `- name: ${brand.name??'(unnamed)'} - family: ${brand.family??'-'} - rev: ${brand.rev??'-'}`,
    ...(brand.file?[`- record: \`${brand.file}\``]:[]),
    ...(brand.mascotAssets?.length?brand.mascotAssets.map(entry=>`- mascot/logo: \`${entry}\``):[`- no mascot or logo asset is declared`]),
    `Every colour, font, icon and illustration you produce comes from this record and the installed grammar; you never invent one beside them.`,``];
}

/**
 * What the critique of the goal demanded, in the contract of every operation of that goal. A `revise` verdict is
 * not advice the kernel filed away: the changes the critic required are part of the goal the user approved, so
 * they travel under the goal of every op and bind it as the goal itself does. Any other verdict renders nothing.
 */
function critiqueBlock(critique){
  const required=critique?.verdict==='revise'?(critique.required??[]).map(item=>firstLine(item)).filter(Boolean):[];
  if(!required.length)return [];
  return [`## Goal critique - required`,...required.map(item=>`- ${item}`),
    `The critique of this workflow's goal returned \`revise\`: these changes are part of the goal the user approved and bind this operation exactly as the goal above does.`,``];
}
/**
 * What the critic found among the decided records, in the contract of the intake that reconciles the feature: a
 * `conflict` overlap is a row the intake must write with its decision record, a `reference` overlap a record it
 * must cite by id. Only an intake gets the block; it is the one operation whose job the overlaps describe.
 */
function overlapBlock(critique,op){
  const overlaps=op?.intake?(critique?.overlaps??[]).filter(item=>plain(item)&&item.record):[];
  if(!overlaps.length)return [];
  return [`## Reconciliation the critic found`,...overlaps.map(item=>item.case==='conflict'
    ?`- \`${item.record}\` conflicts with this feature - ${firstLine(item.evidence)||'as the critic read it'}: write a \`conflict\` row naming it and a todo decision record under \`${op.intake.scope}\` with both sides, the options and one recommendation; never edit it.`
    :`- \`${item.record}\` already holds part of this feature - ${firstLine(item.evidence)||'as the critic read it'}: write a \`reference\` row citing it by id and restate nothing of it.`),
    `The kernel checks the table you write against these records by id; the owner decides every conflict.`,``];
}
/** A kind the kinds profile does not carry (a plan-ledger kind) declares no input and no output; it prints none. */
const ioLines=kind=>{try{const block=ioBlock(kind);return block?[...String(block).split(String.fromCharCode(10)),'']:[];}catch{return [];}};

export function renderContract({template,op,state,store,launcher=state.launcher,run=state.run,
  guards=kernelGuards,protectedPaths=null,brand=state.brand??null,critique=state.critique??null}){
  const text=String(template??'');
  for(const heading of ['## Cook until done','## Ping (mandatory)','## Never'])
    need(text.includes(heading),`The operation template has no "${heading}" section`);
  const afterCook=text.split('## Cook until done')[1];
  const cook=`## Cook until done${afterCook.split('## Never')[0]}`.replace(/\s+$/,'');
  const never=`## Never${text.split('## Never')[1]}`.replace(/\s+$/,'');
  const checksFile=slash(store.checksPath(op.id));
  const reportsDir=slash(store.paths.reports);
  const items=(op.ledgerIds??[]).map(id=>{const item=ledgerItem(state,id);return `- \`${id}\` ${item?.title??'(unknown goal item)'}${item?.inputRef?` - ${item.inputRef}`:''}`;});
  const locks=guards.resourceLocks(op);
  const owned=protectedPaths??op.kernelOwned??[];
  const sections=[
    `# Operation contract - \`${op.kind}\` - op \`${op.id}\` - attempt ${op.attempt}`,``,
    `Runtime StarCi 5.0. One worktree \`${slash(state.worktree)}\` on branch \`${state.branch}\`. Other operations are running beside you in this same worktree: never touch a path outside your allowlist, never commit, never switch branches. Your Task id, Dispatch id and terminal handle are in the dispatch preamble.`,``,
    ...(laneLine(state,op)?[laneLine(state,op),``]:[]),
    `## Goal`,op.goal,``,
    ...critiqueBlock(critique),
    ...overlapBlock(critique,op),
    // What this kind is derived from and what it may produce, from the record catalog: an operation reads its
    // declaration before it reads its allowlist, so a record it may not write is refused before it writes one.
    ...ioLines(op.kind),
    ...(op.nodeId?(authorsRecord(op.kind)
      ?(plain(op.cut)
        ?[`## Work node you cut`,`- \`${op.nodeId}\` - you split this node into child nodes with disjoint write scopes and turn it into a derived parent; you build none of them. Its whole folder is in your allowlist: removing its \`state\` is the job (a parent authors no state), and \`${CUT_OWNED.join('`, `')}\` and its evidence folder stay the kernel's - it reads them back, reverts the file if they moved and downgrades your report to \`failed\`. Never edit a node outside this folder.`,``]
        :[`## Work node you author`,`- \`${op.nodeId}\` - you complete this record so the kernel can launch the node's own work; you do not do that work. Its \`index.yaml\` is in your allowlist, and inside that file \`${RECORD_OWNED.join('`, `')}\` stay the kernel's: it reads them back, reverts the file if they moved and downgrades your report to \`failed\`. Never edit another node's \`index.yaml\`.`,``])
      :[`## Work node you close`,`- \`${op.nodeId}\` - the kernel writes its \`state\`, \`completion\` and evidence itself after it has reproduced your checks. Never edit a Work \`index.yaml\` unless it is in your allowlist.`,``]):[]),
    ...(items.length?[`## Goal items you close`,...items,``]:[]),
    `## Allowlist`,...op.allowlist.map(entry=>`- \`${entry}\``),
    `Anything else is out of scope. Name the exact paths you need in \`open[]\`, or report \`blocked\` with \`shared-change\` and the exact repository paths in the detail - a \`shared-change\` that names no path is sent straight back to you.`,``,
    ...(owned.length?[`## Never touch (kernel-owned)`,...owned.map(entry=>`- \`${entry}\``),
      `The kernel owns the node's \`state\`, \`completion\`, \`extensions.work3.kernel\` and its evidence. It reverts anything you write here and downgrades your report to \`failed\`.`,``]:[]),
    `## Resources`,...(locks.length?locks.map(entry=>`- \`${entry}\``):['- none: this operation claims no shared resource']),
    `Two operations that share a resource never run at the same time; never start, stop or reset one you did not declare.`,``,
    `## Credentials and configuration`,
    `A key, token, credential or configuration the environment does not provide is never invented, stubbed, defaulted or silently skipped. Report \`blocked\` with blocker \`environment\` naming the exact variable or secret name and where the code reads it; the owner provides the value out of band. Never write a secret value into a record, a report, a chat or a file the owner did not name.`,``,
    `## References`,...(op.references.length?op.references.map(entry=>`- ${entry}`):['- the goal and the allowlist above']),``,
    ...brandBlock(op,brand),
    ...(op.priorOpen.length?[`## Open items you inherit`,...op.priorOpen.map(item=>`- ${item}`),``]:[]),
    ...(op.findings.length?[`## Findings you must resolve`,...op.findings.map(item=>`- ${typeof item==='string'?item:JSON.stringify(item)}`),``]:[]),
    // The answer to an `ask` is typed into the op's terminal on Orca; a headless process has already exited by
    // then, so the answer reaches the op through the contract of its next attempt, on every host alike.
    ...(typeof op.answer==='string'&&op.answer.trim()?[`## Answer to the question you asked earlier`,op.answer.trim(),`Act on it; do not ask the same question again.`,``]:[]),
    ...(plain(op.question)?[`## Question for the owner`,`Asked by \`${op.question.from??'the kernel'}\` (${op.question.kind??'decision'}): ${op.question.text}`,...(op.question.options?.length?op.question.options.map((item,index)=>`${index+1}. ${item}`):[]),``]:[]),
    `## Acceptance`,...(op.acceptance.length?op.acceptance.map((item,index)=>`${index+1}. ${item}`):['1. the goal above holds']),``,
    stepsFor(op,{node:op.nodeId?state.ledger.find(item=>item.nodeId===op.nodeId)??null:null}),``,
    ...jobRulings(store),
    cook,``,
    `## Checks to run`,...(op.checks.length?op.checks.map(check=>`- ${check.name}: \`${check.command}\``):['- none were declared: run the checks this code already has and record them']),
    `Record every command with its exit code in \`${checksFile}\` as a JSON array \`[{"name","command","exitCode","evidence"}]\`.`,
    `The kernel re-runs these exact commands itself after your report and computes your changed files from git: a \`done\` the machine cannot reproduce is downgraded to \`failed\` and comes back to you.`,``,
    `## Report (exactly once, at the end)`,
    `\`node ${launcher} report --run ${run} --from <your terminal> --task <op task> --dispatch <your dispatch> --reports-dir ${reportsDir} --outcome done|partial|failed|ask|blocked --summary "<what you did, what the checks showed, what is left>" --files <comma-separated changed paths> --checks-file ${checksFile} [--open "<item>,<item>"] [--question "<text>" --options "a,b"] [--blocker shared-change|sds-gap|interface-gap|brand-gap|grammar-gap|environment|authority:<detail>]\``,
    `- \`done\` needs every check exiting 0 and no open item; otherwise report \`partial\` (with \`--open\`) or \`failed\`.`,
    `- \`ask\` pauses you until the kernel answers in this terminal; then continue and report again.`,
    `- The command must print \`ok:true\`. Never report twice; never exit without reporting.`,``,
    never
  ];
  const contract=`${sections.join('\n').replace(/\n{3,}/g,'\n\n')}\n`;
  need(!/<launcher>|<nested run>|<runtime dir>|<reports dir>/.test(contract),'The rendered contract still carries a template placeholder');
  return contract;
}

/* ------------------------------------------------------------------ launch */

/**
 * 5.0 has no provider chain: the allocator names exactly one runtime, so the launcher must try exactly one
 * candidate. `startOperation({candidates})` is that seam - the launcher takes the resolved selection instead
 * of resolving a chain - so nothing here has to pretend a target was unavailable. The allocated target is
 * still proven to belong to the operation's declared environments first, and the request is rebuilt from the
 * candidate alone so a mismatch is caught before any Orca effect. Why the other targets were not used is
 * recorded in the kernel's own `launched` event (`allocation`), never as a fake launcher attempt.
 */
export function launchWithCandidate(orca,{cwd,run,workflowTask,from,worktree,operation,scope,spec,candidate,runtime=null,wait,build=buildOperationLaunch,start=startOperation}){
  const input={run,workflowTask,from,worktree,operation,scope,spec};
  const target=required(candidate?.target,'allocated runtime target');
  const chain=build(input).candidates.map(item=>item.selection.target);
  need(chain.includes(target),`The allocated target ${target} is not in the ${operation} chain (${chain.join(', ')})`);
  const notAllocated=chain.filter(item=>item!==target);
  const request=build({...input,candidates:[candidate]});
  need(request.candidates.length===1,`The allocated candidate list built ${request.candidates.length} candidates`);
  need(JSON.stringify(request.candidates[0].selection)===JSON.stringify(candidate),
    `The built candidate is not the allocated one: ${request.candidates[0].selection.target}`);
  const launched=start(input,{orca,wait,candidates:[candidate]});
  return {...launched,allocation:{runtime,target,notAllocated,
    reason:'the runtime allocator assigned this operation to one runtime; the launcher was handed that candidate alone'}};
}

function launchOp(orca,store,state,op,allocated,ctx){
  if(op.needsReplan)replanOp(store,state,op,ctx);
  // A design operation derived before the brand was decided gets the record now: its references are the material
  // it must read, and by launch time that material exists.
  if(kindsReadingBrand().includes(op.kind)){
    const brand=brandReferencesOf(ctx.work?.api,ctx.work?.loaded);
    if(brand.length)op.references=unique([...op.references,...brand]);
  }
  // A reconciliation is judged against what the tree held BEFORE the intake ran: the digests are taken here.
  if(op.intake?.scope&&ctx.work?.loaded)op.intakeDigests=(()=>{try{return recordDigests(ctx.work.loaded);}catch{return null;}})();
  op.kernelOwned=kernelOwnedPaths(state,op,ctx);
  const contract=renderContract({template:ctx.template,op,state,store,guards:ctx.guards,protectedPaths:op.kernelOwned});
  fs.writeFileSync(store.contractPath(op.id),contract);
  op.contractFile=store.contractPath(op.id);
  const relative=path.relative(process.cwd(),state.worktree)||'.';
  // A launch that throws - Orca unreachable, a spec the command line cannot carry - is a failed launch, never the
  // end of the kernel: the op records it, avoids the runtime, and the loop goes on.
  let launched;
  try{
    launched=ctx.launch(orca,{cwd:state.worktree,run:state.run,workflowTask:state.workflowTask??state.id,from:state.from,
      worktree:relative,operation:launchOperator(op.kind),kind:op.kind,scope:op.id,spec:operationSpec(op,contract),candidate:allocated.candidate,runtime:allocated.runtime,wait:ctx.wait});
  }catch(error){
    launched={ok:false,stopReason:String(error?.message??error).slice(0,300),attempts:[{target:allocated.target,stage:'launch',effectState:'threw',reason:String(error?.message??error).slice(0,240)}]};
  }
  op.launch={ok:Boolean(launched?.ok),target:launched?.selection?.target??allocated.target,
    task:launched?.task?.id??null,dispatch:launched?.dispatchId??null,stopReason:launched?.stopReason??null};
  // Orca refuses every launch from a coordinator tab whose pane is gone ("no stable pane identity"): that is the
  // kernel's tab to replace, not the runtime's failure to count - a new tab is opened, the Run re-bound, the op
  // stays ready for the next tick. Once per attempt, so a tab Orca keeps refusing does not loop for ever.
  if(!launched?.ok&&/no stable pane identity/i.test(String(launched?.stopReason??''))&&!op.coordinatorRecovered){
    op.coordinatorRecovered=true;
    if(recoverCoordinatorTab(orca,store,state,{cwd:state.worktree})){
      // The slot the allocation took is given back without a failure: the runtime did nothing wrong.
      try{ctx.allocator.release?.(allocated.runtime,{op:op.id});}catch{}
      op.status='ready';op.launch=null;return {ok:false,reason:'the coordinator tab was replaced; the launch is tried again',recovered:true};
    }
  }
  if(!launched?.ok){
    op.launchFailures+=1;
    ctx.allocator.failed(allocated.runtime,{reason:launched?.stopReason??'launch failed',op:op.id});
    avoidRuntime(op,allocated.runtime,clockOf(ctx));
    // The attempts travel with the event: a launch that failed is only diagnosable from what Orca said at each step.
    store.appendEvent({event:'launch-failed',op:op.id,runtime:allocated.runtime,stopReason:launched?.stopReason??null,attempts:launched?.attempts?.length??0,
      detail:(launched?.attempts??[]).slice(0,4).map(attempt=>({target:attempt.target??null,stage:attempt.stage??null,effectState:attempt.effectState??null,reason:String(attempt.reason??'').slice(0,240),...(attempt.trust?{trust:attempt.trust}:{}),...(attempt.recovery?{recovery:attempt.recovery}:{})}))});
    if(op.launchFailures>=LAUNCH_LIMIT){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'environment',detail:`no runtime could launch ${op.id} (${op.launchFailures} attempts, last ${launched?.stopReason??'unknown'})`});
    }
    return {ok:false,reason:launched?.stopReason??'launch failed'};
  }
  op.status='running';op.runtime=allocated.runtime;op.target=allocated.target;op.coordinatorRecovered=false;
  // The launch is what the other kernels of this repository must see: the allocation alone could still fail.
  ctx.allocator.launched?.(allocated.runtime,{op:op.id});
  if(!op.baseHead){const shown=ctx.git('git',['rev-parse','HEAD'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});op.baseHead=shown.status===0?(shown.stdout??'').trim():null;}
  op.task=launched.task.id;op.dispatch=launched.dispatchId;op.terminal=launched.terminal;op.nudged=false;
  // A launch is an external effect: the state that names it is written before anything else can interrupt the kernel.
  store.saveState(state);
  store.appendEvent({event:'launched',op:op.id,kind:op.kind,node:op.nodeId,attempt:op.attempt,runtime:op.runtime,target:op.target,
    dispatch:op.dispatch,terminal:op.terminal,allocation:launched.allocation??null});
  // Work v2 authors only uninvestigate, todo and done, so the launch is recorded in the node's kernel block.
  ledgerWrite(store,state,op,ctx,'in-progress',node=>ctx.work.api.markInProgress(ctx.work.at,node,{opId:op.id,dispatch:op.dispatch}));
  // The baseline is taken after the kernel's own in-progress write, so only the operation's edits are caught.
  op.kernelOwnedAt=op.kernelOwned.length?protectedFingerprint(ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree,op.kernelOwned):null;
  // An author op holds the whole record, so the file cannot be fingerprinted as a unit: the blocks inside it
  // that stay the kernel's are snapshotted instead, after the same in-progress write.
  if(authorsRecord(op.kind))op.recordBlocks=recordBlocks(ctx,op.nodeId);
  return {ok:true};
}

/** A blocked operation whose design gap was settled is planned again with the new material. */
function replanOp(store,state,op,ctx){
  const planned=ctx.planOp({node:{id:op.id,operation:op.kind,attempt:op.attempt,priorOpen:op.priorOpen,findings:op.findings},
    workflow:state.id,ownership:unique(state.ops.flatMap(item=>item.allowlist)),sdsMaterial:[],
    priorReports:op.reports,cwd:ctx.cwd});
  op.needsReplan=false;
  if(!planned?.ok){store.appendEvent({event:'replan-failed',op:op.id,attempts:planned?.attempts?.length??0});return false;}
  const plan=planned.value;
  op.goal=plan.goal??op.goal;
  op.allowlist=plan.allowlist?.length?plan.allowlist:op.allowlist;
  op.references=plan.references?.length?plan.references:op.references;
  op.checks=plan.checks?.length?plan.checks.map(check=>({name:check.name,command:check.command})):op.checks;
  op.acceptance=plan.acceptance?.length?plan.acceptance:op.acceptance;
  store.appendEvent({event:'replanned',op:op.id,allowlist:op.allowlist});
  return true;
}

/* ------------------------------------------------------------------ schedule */

/** The launchable targets of one operation kind, or null when the allocator cannot name them. */
function launchableFor(allocator,kind){
  if(typeof allocator.launchableTargets!=='function')return null;
  try{return allocator.launchableTargets(kind);}catch{return null;}
}

/** The repository a node is delivered in when it is not this kernel's own; null when it is ours or unknown. */
function foreignNodeOf(ctx,op){
  if(!ctx?.work||!op?.nodeId||!ctx.work.code?.repository||typeof ctx.work.api?.nodeRepository!=='function')return null;
  const node=ctx.work.node(op.nodeId);
  if(!node)return null;
  try{const declared=ctx.work.api.nodeRepository(ctx.work.api.readNode(ctx.work.at??ctx.work.repoRoot,node));return declared&&declared!==ctx.work.code.repository?declared:null;}catch{return null;}
}

/**
 * The brand node of the tree: the one the brand record names, or the `brand` node the tree carries. A node
 * still `todo` is preferred, because that is the one a decision is owed.
 */
function brandNode(ctx){
  const loaded=ctx?.work?.loaded??null;
  if(!loaded)return null;
  const named=loaded.brand?.node?loaded.nodes?.get?.(loaded.brand.node)??null:null;
  if(named)return named;
  const list=loaded.list??[];
  return list.find(node=>node.kind===BRAND_KIND&&node.state==='todo')??list.find(node=>node.kind===BRAND_KIND)??null;
}
/**
 * The `brand.decide` operation: one per workflow, created the moment a design operation needs a brand record
 * the tree does not have. It is a decision - it authors the brand record and its assets, and its only check is
 * that the tree still validates afterwards - so it is created exactly the way the `sds-gap` route creates
 * `architecture.revise`, from the node the tree already carries. A tree that carries no brand node at all is
 * the one thing the kernel cannot invent: a brand is the product's identity, so it asks the user once.
 */
function ensureBrandDecide(store,state,ctx){
  const existing=state.ops.find(op=>op.kind===BRAND_DECIDE&&op.refusal!=='superseded');
  if(existing)return existing;
  const node=brandNode(ctx);
  if(!node){
    const detail='no brand record: author .starciwork/brand/index.yaml (a work.author or brand.decide op)';
    if(!state.needUser.some(item=>item.kind==='brand')){
      state.needUser.push({kind:'brand',detail});
      store.appendEvent({event:'brand-missing',detail});
    }
    return null;
  }
  const file=`.starciwork/${slash(node.path)}`;
  // The record and the folder around it: the assets a brand decision produces live beside the file it writes.
  const folder=`.starciwork/${slash(path.dirname(node.path))}/**`;
  const op=addOp(store,state,{id:nextId(state,'brand'),kind:BRAND_DECIDE,nodeId:node.id,
    goal:`Decide the brand in ${node.id}: the name, the design family, every colour token with the role it plays, the fonts, the mascot and logo assets, what is forbidden and the rules every imagery prompt must carry. Every design operation of this workflow is built and judged against this record.`,
    // No ledger item: a decision is not a slice of the goal, it is what the slices are measured against.
    ledgerIds:[],allowlist:unique([file,folder]),
    references:unique([node.path,...(node.refs??[]),...grammarReferences()]),
    checks:[{name:'work-tree-validates',command:workValidateCommand(ctx)}],
    acceptance:[`${node.id} records the brand: name, family, colour tokens with their roles, the mascot and logo assets, the forbidden list and the imagery prompt rules`,
      'the Work tree still validates'],origin:'ledger'},
    'a design operation cannot run before the brand is decided');
  op.difficulty='hard';
  store.appendEvent({event:'brand-decide-created',op:op.id,node:node.id,allowlist:op.allowlist});
  return op;
}
/**
 * A design-family operation reads the brand; without a brand record it would invent one, so it does not run.
 * The op waits behind the `brand.decide` operation this creates (and, if the tree carries no brand node, behind
 * the user) instead of being launched with nothing to read.
 */
function deferForBrand(store,state,op,ctx){
  if(!kindsReadingBrand().includes(op.kind)||!brandAware(ctx)||brandOf(ctx))return false;
  const decide=ensureBrandDecide(store,state,ctx);
  if(decide&&decide.id!==op.id&&!op.dependsOn.includes(decide.id)){
    op.dependsOn=unique([...op.dependsOn,decide.id]);
    op.status='pending';
  }
  store.appendEvent({event:'schedule-deferred',op:op.id,reason:'brand missing',...(decide?{waitingFor:decide.id}:{})});
  return true;
}

function scheduleOps(orca,store,state,ctx){
  for(const op of state.ops){
    if(op.status!=='pending')continue;
    const dependencies=op.dependsOn.map(id=>byId(state,id));
    if(dependencies.some(dependency=>dependency&&['blocked','failed'].includes(dependency.status))){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} can never start: it depends on ${op.dependsOn.join(', ')}`});
      store.appendEvent({event:'op-blocked',op:op.id,reason:'dependency blocked'});
      continue;
    }
    if(dependencies.every(dependency=>!dependency||dependency.status==='done'))op.status='ready';
  }
  const launched=[];
  for(const op of state.ops.filter(item=>item.status==='ready')){
    const busy=state.ops.filter(item=>['running','answering'].includes(item.status));
    if(busy.length>=ctx.allocator.maxParallelOps)break;
    // A design operation on a tree with no brand record is not launched at all: the brand is decided first.
    if(deferForBrand(store,state,op,ctx))continue;
    // On the Work ledger the authored files decide parallelism, through the ledger's own prefix semantics.
    const overlaps=other=>ctx.work?!ctx.work.api.disjoint(other.allowlist,op.allowlist):allowlistsOverlap(other.allowlist,op.allowlist);
    if(busy.some(overlaps)){
      store.appendEvent({event:'schedule-deferred',op:op.id,reason:'allowlist overlaps a running operation'});
      continue;
    }
    // Declared and inferred resource locks (postgres, e2e-runtime, docker, cluster) are as serializing as paths.
    const clashing=busy.filter(other=>ctx.guards.resourcesClash(op,other));
    if(clashing.length){
      store.appendEvent({event:'schedule-deferred',op:op.id,reason:'resource lock clashes a running operation',
        resources:ctx.guards.resourceLocks(op),clashes:clashing.map(other=>other.id)});
      continue;
    }
    // Fan-out: the children of one cut parent are bounded per group, and while the seam is unbuilt it runs alone.
    const fanOut=fanOutDeferral(state,op,busy,ctx);
    if(fanOut){
      store.appendEvent({event:'schedule-deferred',op:op.id,reason:fanOut.reason,parent:fanOut.parent,running:fanOut.running});
      continue;
    }
    const avoid=unique([...op.avoidRuntimes,...avoidForVerify(state,op)]);
    // Allocation stays inside the targets this operation can actually launch, so a runtime whose role has
    // no profile for this operation is never chosen and then rejected.
    // The allocator is asked for the op's own kind (the graph knows its role); the launchable chain is the
    // operator registry's, so a lane kind it does not carry is resolved to its operator id first.
    if(foreignNodeOf(ctx,op)){
      op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
      store.appendEvent({event:'launch-refused',op:op.id,reason:'the node is delivered by another repository'});
      continue;
    }
    // A kind that needs what this host does not have is refused here, not launched into a process that cannot do
    // the work: the op is blocked with the one item that names the missing capability, everything else carries on,
    // and approving the workflow again from a host that has it re-admits the op (`approve`).
    const missing=hostMissing(ctx.host,op.kind);
    if(missing.length){
      op.status='blocked';op.refusal='host-unsupported';op.dispatch=null;op.terminal=null;
      const detail=`${op.id} (${op.kind}) needs ${missing.join(', ')}, which the ${ctx.host.name} host does not have; approve the workflow again from a host that has it`;
      if(!state.needUser.some(item=>item.op===op.id&&item.kind==='host'))state.needUser.push({op:op.id,kind:'host',detail});
      store.appendEvent({event:'op-host-unsupported',op:op.id,kind:op.kind,node:op.nodeId??null,host:ctx.host.name,missing});
      continue;
    }
    const allocated=ctx.allocator.allocate(op.kind,{avoid,restrictTo:launchableFor(ctx.allocator,launchOperator(op.kind)),difficulty:op.difficulty??null});
    if(!allocated?.ok){
      // Every runtime that could carry the op is on its own avoid list: the list has served its purpose (one restart
      // per runtime) and now only starves the op. It is cleared and the op gets one more round on any runtime;
      // past the restart limit that round is the user's call instead.
      const reason=String(allocated?.reason??'no runtime');
      const starved=op.avoidRuntimes.length&&/\(avoided\)/.test(reason)&&!/\(no free slot\)|\(cooling|\(budget|\(rate/.test(reason);
      if(starved){
        if(op.restarts>RESTART_LIMIT){op.status='blocked';state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} failed on every runtime that can run it (${op.avoidRuntimes.join(', ')}) after ${op.restarts} restarts`});store.appendEvent({event:'avoid-exhausted',op:op.id,avoid:op.avoidRuntimes});continue;}
        store.appendEvent({event:'avoid-reset',op:op.id,avoid:op.avoidRuntimes,restarts:op.restarts});
        op.avoidRuntimes=[];
      }
      store.appendEvent({event:'allocation-deferred',op:op.id,reason,avoid});continue;
    }
    // The shared view changed the choice: an equally capable runtime no other kernel is on took the operation.
    if(allocated.preferredOver?.length)store.appendEvent({event:'allocation-shared',op:op.id,runtime:allocated.runtime,
      preferredOver:allocated.preferredOver,sharedLoad:allocated.sharedLoad??{}});
    // The probed provider budget changed the choice: a runtime with clearly more of its window left took the operation.
    if(allocated.sparedOver?.length)store.appendEvent({event:'allocation-budgeted',op:op.id,runtime:allocated.runtime,
      sparedOver:allocated.sparedOver,remaining:allocated.budget??{}});
    let candidate=null;
    try{candidate=allocated.candidate??ctx.allocator.candidateFor(launchOperator(op.kind),allocated.target);}
    catch(error){
      ctx.allocator.failed(allocated.runtime,{reason:'not launchable',op:op.id});
      avoidRuntime(op,allocated.runtime,clockOf(ctx));
      store.appendEvent({event:'allocation-rejected',op:op.id,runtime:allocated.runtime,reason:error.message});
      continue;
    }
    const result=launchOp(orca,store,state,op,{...allocated,candidate},ctx);
    if(result.ok)launched.push(op.id);
  }
  if(launched.length){state.stalls=0;state.stalledSince=null;}
  return launched;
}

/** A verify operation must never run on a runtime that implemented the ledger items it judges. */
function avoidForVerify(state,op){
  if(op.kind!=='review.verify')return [];
  return unique(state.ops.filter(other=>other.id!==op.id&&implementsLedger(other)&&other.ledgerIds.some(id=>op.ledgerIds.includes(id)))
    .map(other=>other.runtime).filter(Boolean));
}

/* ------------------------------------------------------------------ committing what was verified */

function commitOp(state,op,files,{git}){
  const run=args=>git('git',args,{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  const head=()=>{const shown=run(['rev-parse','HEAD']);return shown.status===0?(shown.stdout??'').trim():null;};
  if(!files.length)return {committed:false,head:head(),reason:'the operation changed nothing inside its allowlist'};
  const added=run(['add','--',...files]);
  if(added.status!==0)return {committed:false,head:null,reason:`git add: ${tail(added.stderr,300)}`};
  // One op, one commit, and in ledger mode a `Work:` trailer so the history names the node it closes.
  const message=[`feat(${op.id}): ${firstLine(op.goal).slice(0,80)}`,...(op.nodeId?['',`Work: ${op.nodeId}`]:[])].join('\n');
  const committed=run(['commit','-q','-m',message]);
  if(committed.status!==0)return {committed:false,head:null,reason:`git commit: ${tail(committed.stderr,300)}`};
  return {committed:true,head:head(),files};
}

/**
 * After an accepted done, files the operation left dirty outside every live allowlist are stray: they belong
 * to no running or paused operation, so they are reverted (tracked) or removed (untracked) and recorded as a
 * finding for the module review. Kernel-owned ledger paths are handled by guardKernelPaths, never here.
 */
function cleanStrayFiles(store,state,op,ctx){
  if(typeof ctx.git!=='function')return [];
  const shown=ctx.git('git',['status','--porcelain'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  if(shown.status!==0)return [];
  const live=state.ops.filter(item=>['running','paused','answering','ready'].includes(item.status)&&item.id!==op.id).flatMap(item=>item.allowlist??[]);
  const ledger=/^\.starciwork\//;
  const entries=(shown.stdout??'').split('\n').map(line=>line.replace(/\s+$/,'')).filter(Boolean)
    .map(line=>({code:line.slice(0,2),file:normalize(line.slice(3).split(' -> ').at(-1).replace(/^"|"$/g,''))}))
    .filter(entry=>!inside(entry.file,live)&&!inside(entry.file,op.kernelOwned??[])&&!ledger.test(entry.file)&&!entry.file.startsWith('.gitmounts/'));
  if(!entries.length)return [];
  const tracked=entries.filter(entry=>!entry.code.startsWith('??')).map(entry=>entry.file);
  const untracked=entries.filter(entry=>entry.code.startsWith('??')).map(entry=>entry.file);
  if(tracked.length)ctx.git('git',['checkout','--',...tracked],{cwd:state.worktree,encoding:'utf8',windowsHide:true});
  for(const file of untracked){try{fs.rmSync(path.join(state.worktree,file),{recursive:true,force:true});}catch{}}
  const finding=`operation ${op.id} left changes outside every live allowlist; the kernel reverted ${tracked.length} tracked and removed ${untracked.length} untracked path(s): ${[...tracked,...untracked].slice(0,12).join(', ')}`;
  op.strayFiles=[...tracked,...untracked];
  state.reviewFindings=[...(state.reviewFindings??[]),{op:op.id,finding}];
  store.appendEvent({event:'stray-files-reverted',op:op.id,tracked,untracked});
  return op.strayFiles;
}

/* ------------------------------------------------------------------ the design routes */

/**
 * A reported SDS gap reopens the design, it does not repair it in place: the architecture node the operation
 * names - or, failing that, the one in its own module - returns to `todo` and gets the kind the `sds-gap`
 * route names (`architecture.revise`: fix the SDS text, bump its rev), which the blocked operation waits for.
 */
function architectureNodeFor(ctx,op,detail){
  const nodes=ctx.work.loaded.list.filter(node=>node.kind==='architecture');
  const named=pathsIn(detail);
  const byPath=nodes.find(node=>named.some(file=>slash(node.path).includes(file)||file.includes(slash(path.dirname(node.path)))));
  if(byPath)return byPath;
  const own=ctx.work.node(op.nodeId);
  const key=own?workModule(own):null;
  return nodes.find(node=>key&&workModule(node)===key)??null;
}

/** `then: reopen` - the reporter waits for the op the route created and runs again with the settled material. */
function reopenRequester(store,state,op,open,created,note){
  op.status='pending';op.attempt+=1;op.dependsOn=unique([...op.dependsOn,created.id]);
  op.priorOpen=unique([...(open??[]),note]);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'op-reopened',op:op.id,waitingFor:created.id,note});
}

function reopenArchitecture(store,state,op,report,ctx,blocker){
  const architecture=architectureNodeFor(ctx,op,blocker.detail);
  if(!architecture)return null;
  const route=routeOf({blocker:'sds-gap',kind:op.kind})??{kind:'architecture.revise',origin:'architecture',then:'reopen'};
  ledgerWrite(store,state,op,ctx,'reopened',()=>ctx.work.api.markReopened(ctx.work.at,architecture,
    {reason:`${op.id} reported an SDS gap: ${blocker.detail}`,by:'starci-kernel'}));
  const designFile=`.starciwork/${slash(architecture.path)}`;
  // The revision owns the node file and the SDS folder around it: a design fix is text, and its text is there.
  const designFolder=`.starciwork/${slash(path.dirname(architecture.path))}/**`;
  const decide=addOp(store,state,{kind:routeKind(route,state,op)??'architecture.revise',nodeId:architecture.id,
    goal:`Revise the design ${op.id} found incomplete, in the architecture node ${architecture.id}: ${blocker.detail}. Fix the SDS text itself and bump its rev.`,
    ledgerIds:op.ledgerIds,allowlist:unique([designFile,designFolder]),references:unique([architecture.path,...op.references]),
    checks:[{name:'work-tree-validates',command:workValidateCommand(ctx)}],
    acceptance:[`${architecture.id} records the decision for: ${blocker.detail}`],origin:route.origin??'architecture'},
    `sds-gap reported by ${op.id}`);
  reopenRequester(store,state,op,report.open,decide,`the design gap is settled by ${decide.id} in ${architecture.path}; read the updated design first`);
  store.appendEvent({event:'sds-gap',op:op.id,node:op.nodeId,architecture:architecture.id,decide:decide.id});
  routed(store,op,'sds-gap',decide.id,decide.origin,{kind:decide.kind,node:architecture.id,then:route.then});
  return decide;
}

/**
 * `interface-gap`: a frontend implementation found the accepted design silent about what it must build. The
 * route puts the lane's draw step back in front of it instead of letting it invent a surface of its own.
 */
function reopenInterface(store,state,op,report,blocker,ctx=null){
  const route=routeOf({blocker:'interface-gap',kind:op.kind})??{kind:'interface.draw',origin:'architecture',then:'reopen'};
  // The gap is in the design record, so the drawing is done on the feature's ui node - its record and its
  // assets - not on the implementation's code paths; a feature with no ui node redraws where the requester is.
  const access=ctx?.work?{api:ctx.work.api,at:ctx.work.at,loaded:ctx.work.loaded}:null;
  const design=access?designNodeOf(access,ctx.work.node(op.nodeId))??null:null;
  const designPath=design?.path?slash(design.path):null;
  const target=design?.id?{nodeId:design.id,allowlist:unique([`.starciwork/${path.posix.dirname(designPath)}/**`,`.starciwork/${designPath}`]),references:unique([designPath,...op.references])}
    :{nodeId:op.nodeId,allowlist:op.allowlist,references:op.references};
  const draw=addOp(store,state,{id:nextId(state,'draw'),kind:routeKind(route,state,op)??'interface.draw',nodeId:target.nodeId,
    goal:`Draw the surface ${op.id} found missing in the accepted design: ${blocker.detail}`,
    ledgerIds:op.ledgerIds,allowlist:target.allowlist,references:target.references,checks:op.checks,
    acceptance:[`the accepted design answers: ${blocker.detail}`],origin:route.origin??'architecture'},
    `interface-gap reported by ${op.id}`);
  if(draw)locateSharedTreePaths(draw,ctx);
  reopenRequester(store,state,op,report.open,draw,`the interface gap is drawn by ${draw.id}; read the accepted design again first`);
  routed(store,op,'interface-gap',draw.id,draw.origin,{kind:draw.kind,node:op.nodeId??null,then:route.then});
  return draw;
}

/**
 * `grammar-gap`: a drawing or a build met a shape the installed grammar cannot render, and it is not a
 * composition of existing contracts. The route grows the grammar once - in the grammar's own repository, as one
 * semantic unit, published and recorded in the canon - and the requester reads that canon again behind it,
 * instead of inventing the shape beside the grammar in a product page.
 *
 * The one thing the kernel will not guess is where a language lives. A workspace binding with no `grammar`
 * repository role means this workflow may not change the grammar at all: nothing is created, nothing is
 * reopened, the requester stays blocked, and the question reaches the user naming the file that would answer it.
 */
function growGrammar(store,state,op,report,blocker,ctx=null){
  const grammar=ctx?.work?.grammar??null;
  if(!grammar){
    op.status='blocked';
    const detail=`grammar-gap from ${op.id} but the workspace binds no grammar repository (role \`grammar\` in .workspaces/projects/<project>/work.json)`;
    if(!state.needUser.some(item=>item.op===op.id&&item.kind==='environment'&&item.detail===detail))
      state.needUser.push({op:op.id,kind:'environment',detail});
    store.appendEvent({event:'grammar-unbound',op:op.id,node:op.nodeId??null,detail:blocker.detail});
    return 'grammar-unbound';
  }
  const route=routeOf({blocker:'grammar-gap',kind:op.kind})??{kind:'grammar.update',origin:'architecture',then:'reopen'};
  const named=grammar.package?` (\`${grammar.package}\`)`:'';
  // The grammar repository and the canon that names its units: both are outside the product tree, and the
  // operation may write nothing else - a product page is exactly what this route exists to prevent.
  const canon=[path.join(skillRoot,'knowledge','grammars'),path.join(skillRoot,'knowledge','patterns','fe')]
    .map(entry=>`${slash(entry)}/**`);
  const grow=addOp(store,state,{id:nextId(state,'grammar'),kind:routeKind(route,state,op)??'grammar.update',nodeId:op.nodeId??null,
    goal:`Grow the installed grammar${named} by the one semantic unit ${op.id} found missing: ${blocker.detail}. Try to express it as a composition of existing contracts first and write that attempt down; only a shape that does not compose becomes a new unit, implemented with its stories and tests, published at a new version and recorded in the canon. No product page.`,
    ledgerIds:op.ledgerIds,allowlist:unique([`${slash(grammar.root)}/**`,...canon]),
    references:unique([...op.references,...grammarReferences()]),checks:op.checks,
    acceptance:[`the grammar renders: ${blocker.detail}`,
      'the grammar package is published at a new version and the consumer imports it',
      'the canon names the new unit'],origin:route.origin??'architecture'},
    `grammar-gap reported by ${op.id}`);
  reopenRequester(store,state,op,report.open,grow,`the grammar is grown by ${grow.id}; read the canon again first`);
  store.appendEvent({event:'grammar-gap',op:op.id,node:op.nodeId??null,grammar:slash(grammar.root),package:grammar.package??null,grow:grow.id});
  routed(store,op,'grammar-gap',grow.id,grow.origin,{kind:grow.kind,node:op.nodeId??null,then:route.then});
  return 'grammar-gap';
}

/* ------------------------------------------------------------------ result policy */

const retryLimitFor=reason=>reason==='validator-reject'?validatorRejectLimit():RETRY_LIMIT;

function retryOp(store,state,op,findings,ctx,reason){
  op.repairs+=1;
  if(op.repairs>retryLimitFor(reason)){
    const chosen=ctx.decide({situation:`${op.kind} ${op.id} is still failing after ${op.repairs-1} retries (${reason})`,
      options:['retry-other-runtime','split','escalate-to-user'],
      context:{goal:firstLine(op.goal),allowlist:op.allowlist,findings,runtime:op.runtime},cwd:ctx.cwd});
    const option=chosen?.ok?chosen.value.option:'escalate-to-user';
    store.appendEvent({event:'decide',op:op.id,option,rationale:chosen?.ok?chosen.value.rationale:'decide produced no valid option'});
    if(option==='escalate-to-user'){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} exhausted its retries: ${findings[0]??reason}`});
      return 'escalate-to-user';
    }
    if(option==='split'){
      if(op.allowlist.length>1){
        op.status='done';op.verdict='split';
        for(const entry of op.allowlist)addOp(store,state,{kind:op.kind,goal:`${firstLine(op.goal)} - only \`${entry}\``,
          ledgerIds:op.ledgerIds,allowlist:[entry],references:op.references,checks:op.checks,acceptance:op.acceptance,
          findings,origin:'repair'},`split of ${op.id}`);
        return 'split';
      }
      store.appendEvent({event:'split-refused',op:op.id,reason:'a single-path allowlist cannot be split'});
    }
    avoidRuntime(op,op.runtime,clockOf(ctx));
    op.repairs=retryLimitFor(reason);
  }
  // The tab of the attempt that failed has no reader any more: the next attempt opens its own.
  if(ctx?.orca)closeOpTerminal(ctx.orca,store,state,op);
  op.status='ready';op.attempt+=1;op.findings=findings;op.priorOpen=[];op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'retry',op:op.id,attempt:op.attempt,reason,findings:findings.slice(0,3)});
  return 'retry';
}

function resumeOp(store,state,op,report,ctx){
  op.resumes+=1;
  if(op.resumes>RESUME_LIMIT){
    const chosen=ctx.decide({situation:`${op.id} reported partial ${op.resumes} times`,options:['resume-once-more','escalate-to-user'],
      context:{open:report.open,summary:report.summary},cwd:ctx.cwd});
    const option=chosen?.ok?chosen.value.option:'escalate-to-user';
    store.appendEvent({event:'decide',op:op.id,option,rationale:chosen?.ok?chosen.value.rationale:'decide produced no valid option'});
    if(option!=='resume-once-more'){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} never finishes: ${report.open?.[0]??report.summary}`});
      return 'escalate-to-user';
    }
    op.resumes=RESUME_LIMIT;
  }
  op.status='ready';op.attempt+=1;op.priorOpen=[...(report.open??[])];op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'resume',op:op.id,attempt:op.attempt,open:op.priorOpen.slice(0,3)});
  return 'resume';
}

/* ------------------------------------------------------------------ shared changes */

/**
 * A shared change is a path outside the operation's allowlist that its slice needs. The discipline is four
 * rules: the blocker must name concrete repository paths (a detail that names none is sent straight back to
 * the operation, as if it had asked a question); one shared op per distinct path set, where a path-prefix
 * overlap merges into the pending or running shared op and appends the requester; at most
 * three new shared ops per iteration, the rest queued; and the requester is `paused` - not `pending`, so
 * nothing reschedules it - until its shared op is `done`.
 */
const sharedAlive=op=>op.origin==='shared'&&liveStatus.includes(op.status);
const pathSetsOverlap=(a=[],b=[])=>a.some(one=>b.some(other=>covers(one,other)));
const sharedThisIteration=state=>state.ops.filter(op=>op.origin==='shared'&&op.createdIteration===state.iterations).length;

function pauseForShared(store,state,op,open,shared,note){
  op.status='paused';op.waitingFor=shared?.id??null;
  op.priorOpen=unique([...open,note]);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  if(shared)op.dependsOn=unique([...op.dependsOn,shared.id]);
  store.appendEvent({event:'op-paused',op:op.id,waitingFor:op.waitingFor,note});
}

const SHARED_DEPTH_LIMIT=2;
function createSharedOp(store,state,op,detail,paths){
  // The route decides what a shared change IS: the same build kind as the requester, created as `shared`.
  const route=routeOf({blocker:'shared-change',kind:op.kind})??{kind:'same',origin:'shared',then:'pause'};
  const created=addOp(store,state,{kind:routeKind(route,state,op)??op.kind,
    goal:`Apply the shared change ${op.id} cannot make: ${detail}`,
    ledgerIds:op.ledgerIds,allowlist:paths,references:op.references,checks:op.checks,
    acceptance:[detail],origin:route.origin??'shared',requesters:[op.id]},`shared-change reported by ${op.id}`);
  if(created){
    created.sharedDepth=(op.sharedDepth??0)+1;
    routed(store,op,'shared-change',created.id,created.origin,{kind:created.kind,paths,then:route.then});
  }
  return created;
}

/**
 * Whether a path names this worktree and not another repository: relative, no escape, and no segment that is
 * the folder of another bound repository or the folder every repository lives in (a `Repositories/other/...`
 * path is Source-relative, which an operation inside one worktree cannot reach). A new top-level folder is fine.
 */
function insideWorktree(state,entry){
  const relative=normalize(entry);
  if(!relative||path.isAbsolute(relative)||/^[A-Za-z]:/.test(relative))return false;
  const parts=relative.split('/').filter(Boolean);
  if(!parts.length||parts.includes('..'))return false;
  const others=new Set([...(state?.otherRepositories??[]),...(state?.repositoriesRoot?[state.repositoriesRoot]:[])].map(name=>String(name).toLowerCase()));
  return !parts.some(part=>others.has(part.toLowerCase()));
}
/**
 * A shared op an older build created for paths outside this worktree is settled: blocked as out-of-repository,
 * and every requester waiting on it is answered the way a fresh request now is.
 */
function refuseForeignShared(store,state,ctx){
  for(const op of state.ops){
    if(op.origin!=='shared'||!['pending','ready','running','paused','blocked'].includes(op.status)||op.refusal)continue;
    const allowlist=op.allowlist??[];
    if(!allowlist.length||allowlist.some(entry=>insideWorktree(state,entry)))continue;
    if(op.status==='running'&&op.dispatch&&ctx?.orca)settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'out-of-repository',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(op.runtime&&op.status==='running')ctx.allocator?.release?.(op.runtime);
    op.status='blocked';op.refusal='out-of-repository';op.dispatch=null;op.terminal=null;
    store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths:allowlist,reason:'outside this repository',settled:true});
    for(const id of op.requesters??[]){
      const requester=state.ops.find(candidate=>candidate.id===id);
      if(!requester||!['paused','pending'].includes(requester.status))continue;
      requester.priorOpen=unique([...(requester.priorOpen??[]),`the shared change ${op.id} named ${allowlist.join(', ')}, which is not in this repository; a shared change reaches only this worktree - record what you need from another repository as a source or an open gap in your own record, never as a change`]);
      requester.status='ready';requester.attempt=(requester.attempt??1)+1;requester.waitingFor=null;requester.dispatch=null;requester.terminal=null;
      store.appendEvent({event:'op-resumed',op:requester.id,reason:`${op.id} was out of this repository`});
    }
  }
}
/** One shared request: merge into an existing shared op, create one, or queue it for the next iteration. */
function requestSharedChange(store,state,op,{paths,detail,open=[]}){
  // The Work tree is the kernel's record, never an operation's: a shared change that names a ledger path is
  // refused and carried to the user as a finding. A read-only kind may not request one at all.
  const ledgerPaths=paths.filter(entry=>/^\.?\/?\.starciwork\//.test(slash(entry)));
  // A path of another repository is not a shared change: a shared change reaches only this worktree. The op is
  // told so and reports again - what it needs from another repository is a source or an open gap in its record.
  const foreign=paths.filter(entry=>!insideWorktree(state,entry));
  if(foreign.length&&!ledgerPaths.length){
    const file=store.reportPath(op.dispatch);
    if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
    op.answer=`The path(s) ${foreign.join(', ')} are not in this repository (${slash(state.worktree)}); a shared change reaches only this worktree. Record what you need from another repository in your own record - as a source it is traced to, or as an open gap - and report again without naming it as a change.`;
    op.status='answering';
    store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths:foreign,reason:'outside this repository'});
    return 'shared-change-foreign';
  }
  if(ledgerPaths.length||graph.isReadOnly?.(op.kind)){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'ledger-path',detail:`${op.id} (${op.kind}) asked for a change the kernel will not delegate: ${ledgerPaths.length?ledgerPaths.join(', '):'a read-only kind requested a shared change'}: ${detail}`});
    store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths,reason:ledgerPaths.length?'ledger path':'read-only kind'});
    return 'shared-change-refused';
  }
  // A shared op that itself needs a shared change is a design problem, not a scheduling one: two levels deep it stops.
  if((op.sharedDepth??0)>=SHARED_DEPTH_LIMIT){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'shared-depth',detail:`${op.id} is a shared change ${op.sharedDepth} levels deep and still needs ${paths.join(', ')}: ${detail}`});
    store.appendEvent({event:'shared-change-depth',op:op.id,depth:op.sharedDepth,paths});
    return 'shared-change-depth';
  }
  const existing=state.ops.find(item=>sharedAlive(item)&&pathSetsOverlap(item.allowlist,paths));
  if(existing){
    existing.requesters=unique([...(existing.requesters??[]),op.id]);
    // A shared op that has not launched yet absorbs the new paths; one already running keeps its allowlist.
    if(['pending','ready','paused'].includes(existing.status))existing.allowlist=unique([...existing.allowlist,...paths]);
    store.appendEvent({event:'shared-change-merged',op:op.id,shared:existing.id,paths,
      allowlist:existing.allowlist,requesters:existing.requesters});
    pauseForShared(store,state,op,open,existing,`the shared change is made by ${existing.id}; continue your own allowlist afterwards`);
    return 'shared-change-merged';
  }
  if(sharedThisIteration(state)>=SHARED_OPS_PER_ITERATION){
    state.sharedQueue=[...(state.sharedQueue??[]),{op:op.id,paths,detail,open}];
    store.appendEvent({event:'shared-change-deferred',op:op.id,paths,cap:SHARED_OPS_PER_ITERATION});
    pauseForShared(store,state,op,open,null,`the shared change for ${paths.join(', ')} waits for a free shared slot`);
    return 'shared-change-deferred';
  }
  const shared=createSharedOp(store,state,op,detail,paths);
  pauseForShared(store,state,op,open,shared,`the shared change is made by ${shared.id}; continue your own allowlist afterwards`);
  return 'shared-change';
}

/** Queued shared requests are retried once per iteration, under the same merge rule and the same cap. */
export function drainSharedQueue(store,state){
  const queue=state.sharedQueue??[];
  if(!queue.length)return [];
  // Emptied first: a request the cap defers again re-queues itself through the same path.
  state.sharedQueue=[];
  const created=[];
  for(const request of queue){
    const op=byId(state,request.op);
    if(!op||op.status!=='paused')continue;
    if(requestSharedChange(store,state,op,request)==='shared-change')created.push(op.waitingFor);
  }
  return created;
}

/** A paused op returns to `ready` exactly when its shared op is done, carrying the head that proves it. */
export function resumePaused(store,state){
  const resumed=[];
  for(const op of state.ops.filter(item=>item.status==='paused'&&item.waitingFor)){
    const shared=byId(state,op.waitingFor);
    if(!shared)continue;
    // A requester of an owner question waits for the owner's answer, not for the ask op's report: the answer
    // (`workflow-answer`, or one found in a decided record) is what resumes it, with the ruling in its contract.
    if(shared.kind===OWNER_ASK)continue;
    if(shared.status==='done'){
      op.status='ready';op.attempt+=1;op.waitingFor=null;
      op.priorOpen=[`shared change ${shared.id} done at ${shared.head??state.head??'unknown'}`];
      op.dispatch=null;op.terminal=null;op.nudged=false;
      store.appendEvent({event:'shared-change-resumed',op:op.id,shared:shared.id,head:shared.head??state.head??null});
      resumed.push(op.id);
      continue;
    }
    if(['blocked','failed'].includes(shared.status)){
      op.status='blocked';op.waitingFor=null;
      state.needUser.push({op:op.id,kind:'shared-change',detail:`${op.id} waits for the shared change ${shared.id}, which is ${shared.status}`});
      store.appendEvent({event:'shared-change-blocked',op:op.id,shared:shared.id});
    }
  }
  return resumed;
}

function handleBlocked(store,state,op,report,ctx){
  const blocker=report.blocker??{kind:'environment',detail:report.summary};
  if(blocker.kind==='shared-change'){
    const named=ctx.guards.parseSharedChangePaths(`${blocker.detail} ${(report.open??[]).join(' ')}`)??[];
    const paths=unique(named.map(normalize)).filter(file=>!inside(file,op.allowlist));
    if(!paths.length){
      // No path, no shared op: this is a question to the kernel, and the kernel answers it in the terminal.
      const file=store.reportPath(op.dispatch);
      if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
      op.answer=`Your shared-change block named no repository path outside your allowlist. Name the exact paths you need changed, repository-relative, one per line, then report again.`;
      op.status='answering';
      store.appendEvent({event:'shared-change-unnamed',op:op.id,detail:blocker.detail});
      return 'shared-change-unnamed';
    }
    return requestSharedChange(store,state,op,{paths,detail:blocker.detail,open:[...(report.open??[])]});
  }
  // A frontend build that has no design to build from is drawn first, never guessed at.
  if(blocker.kind==='interface-gap'){
    reopenInterface(store,state,op,report,blocker,ctx);
    return 'interface-gap';
  }
  // A shape the installed grammar cannot render is grown into the grammar, once, never invented beside it.
  if(blocker.kind==='grammar-gap')return growGrammar(store,state,op,report,blocker,ctx);
  if(blocker.kind==='sds-gap'){
    if(ctx.work&&reopenArchitecture(store,state,op,report,ctx,blocker))return 'sds-gap';
    const design=unique([...state.inputs.filter(item=>item.kind==='sds').map(item=>item.ref),
      ...pathsIn(blocker.detail).filter(file=>/\.(md|yaml|yml|json)$/.test(file))]);
    if(!design.length){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'sds-gap',detail:`${blocker.detail} (no design input to change)`});
      return 'escalate-to-user';
    }
    // The same route, on a plan ledger: the design inputs are the allowlist, and the op is re-planned after.
    const route=routeOf({blocker:'sds-gap',kind:op.kind})??{kind:'architecture.revise',origin:'architecture',then:'reopen'};
    const architecture=addOp(store,state,{kind:routeKind(route,state,op)??'architecture.revise',
      goal:`Settle the design gap ${op.id} hit: ${blocker.detail}`,
      ledgerIds:op.ledgerIds,allowlist:design,references:op.references,checks:[],
      acceptance:[`the design records the decision for: ${blocker.detail}`],origin:route.origin??'architecture'},`sds-gap reported by ${op.id}`);
    op.needsReplan=true;
    reopenRequester(store,state,op,report.open,architecture,`the design gap is settled by ${architecture.id}; read the updated design first`);
    routed(store,op,'sds-gap',architecture.id,architecture.origin,{kind:architecture.kind,then:route.then});
    return 'sds-gap';
  }
  // A credential or a configuration the environment lacks is the owner's to provide: the question is prepared for
  // them, with the exact variable name, instead of a bare line nobody answers.
  if(['environment','authority'].includes(blocker.kind)&&credentialNeed(blocker.detail))return openOwnerAsk(store,state,op,{kind:blocker.kind==='authority'?'authority':'credential',text:blocker.detail,options:[]},ctx,report);
  // `environment`, `authority` and anything the graph has no rule for: the user decides, the kernel does not guess.
  op.status='blocked';
  state.needUser.push({op:op.id,kind:blocker.kind,detail:blocker.detail});
  routed(store,op,blocker.kind,'needUser',null,{then:routeOf({blocker:blocker.kind,kind:op.kind})?.then??null});
  return 'escalate-to-user';
}

/**
 * An accepted `work.author` op is measured against the tree, never against its own report: the ledger is
 * reloaded and the candidate enriched again, so the answer comes from `executableCandidates` exactly as the
 * next iteration will read it. A node that is schedulable now is logged `record-authored` and its own lane
 * creates its first step on the next iteration. A node that is still not schedulable is the one thing the
 * kernel cannot do for the user: the incompleteness is raised once, and `authorRecordOp` never creates a
 * second author op for it.
 *
 * The node keeps `state: todo` throughout, because authoring a record is not completing work: no `markDone`,
 * no completion, no evidence manifest - only the kernel's own `in-progress` receipt from the launch.
 */
function settleAuthoredRecord(store,state,op,ctx){
  if(op.kind===OWNER_ASK){settleOwnerAsk(store,state,op,op.reports.at(-1)??{});return 'owner-ask-settled';}
  if(op.intake?.scope&&!op.nodeId){
    const settled=settleIntake(store,state,op,ctx);
    // A reconciliation the kernel could not accept comes back as findings, not as a verdict the intake acted on:
    // retrying an operation is the kernel's policy and stays here, so the intake never has to know about it.
    if(plain(settled)&&settled.retry)return retryOp(store,state,op,settled.findings,ctx,settled.reason);
    return settled;
  }
  // A cut authored the node's children, not the node's own record: it is settled by what now sits under its folder.
  if(plain(op.cut))return settleCut(store,state,op,ctx);
  const nodeId=op.nodeId;
  let candidate=null;
  try{
    const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});
    if(loaded.ok){
      ctx.work.loaded=loaded;
      candidate=ctx.work.api.executableCandidates(loaded,{scope:state.scope.length?state.scope:null,
        repository:ctx.work.code.repository,side:ctx.work.side}).find(item=>item.id===nodeId)??null;
    }
  }catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
  if(candidate?.schedulable){
    state.needUser=state.needUser.filter(item=>!(item.kind==='ledger'&&item.node===nodeId));
    store.appendEvent({event:'record-authored',node:nodeId,op:op.id,allowlist:candidate.allowlist,
      checks:candidate.checks.map(check=>check.assertion??check.command),
      lane:[...(state.lanes?.[nodeId]?.lane??[])]});
    return 'record-authored';
  }
  const detail=`ledger incomplete: ${candidate?.reason??`${nodeId} is still not launchable after ${op.id} completed its record`}`;
  if(!state.needUser.some(item=>item.kind==='ledger'&&item.node===nodeId))state.needUser.push({node:nodeId,kind:'ledger',detail});
  store.appendEvent({event:'record-still-incomplete',node:nodeId,op:op.id,detail});
  return 'record-still-incomplete';
}

/** One accepted report, one deterministic action. `done` passes through machine verification and a commit. */
export function applyOpReport(orca,store,state,op,report,ctx){
  if(validatorOnlyBlock(report)){
    store.appendEvent({event:'validator-only-block',op:op.id,note:'treated as partial: the kernel owns work-valid'});
    report={...report,outcome:'partial',open:[...(report.open??[]),'previous attempt was blocked only by the whole-tree validator while a sibling wrote the ledger; the kernel validates at acceptance'],blocker:null,signal:{type:'worker_done',orcaOutcome:'succeeded'}};
  }
  const checked=validateReport(report,{allowlist:reportAllowlist(op,ctx)});
  op.reports.push({attempt:op.attempt,runtime:op.runtime,outcome:report.outcome,summary:report.summary,
    files:report.files,open:report.open,checks:report.checks,blocker:report.blocker,question:report.question,valid:checked.ok});
  if(!checked.ok){
    store.appendEvent({event:'report-rejected',op:op.id,errors:checked.errors});
    return retryOp(store,state,op,checked.errors.map(error=>`your previous report was rejected: ${error}`),ctx,'report-rejected');
  }
  store.appendEvent({event:'report',op:op.id,outcome:report.outcome,runtime:op.runtime,attempt:op.attempt});
  // The kernel-owned ledger paths are reverted before anything is verified, and writing them is never accepted.
  const touched=guardKernelPaths(store,state,op,ctx);
  if(touched.length){
    op.reports.at(-1).downgradedTo='failed';
    return retryOp(store,state,op,[`operation modified kernel-owned ledger paths: ${touched.join(', ')}`],ctx,'kernel-paths-modified');
  }
  // The record-authoring op holds its own node's index.yaml, so the blocks inside it the kernel owns are guarded
  // by comparison rather than by path. A changed block is the same refusal as a written kernel path.
  const blocks=guardRecordBlocks(store,state,op,ctx);
  if(blocks.length){
    op.reports.at(-1).downgradedTo='failed';
    return retryOp(store,state,op,[`operation modified kernel-owned fields (${(plain(op.cut)?CUT_OWNED:RECORD_OWNED).join(', ')}) of the Work record it authors: ${blocks.join(', ')}`],ctx,'record-blocks-modified');
  }
  if(report.outcome==='done'){
    const verified=machineVerify(state,op,ctx);
    // `work-valid` is the kernel's own check and is stripped from every operation's list, so an op that edits the
    // tree is held to it here: the record it wrote must leave a tree that still validates, before anything is committed.
    if(authorsRecord(op.kind)){
      const command=workValidateCommand(ctx);
      const tree=(()=>{try{return {ok:Boolean(ctx.work.validate({repoRoot:ctx.work.ledger?.repoRoot??ctx.work.repoRoot,workRoot:ctx.work.ledger?.workRoot??null}).ok),reason:null};}
        catch(error){return {ok:false,reason:error.message};}})();
      verified.checks.push({name:'work-valid',command,exitCode:tree.ok?0:1,evidence:tree.reason??''});
      if(!tree.ok){
        verified.ok=false;
        verified.failed=[...verified.failed,verified.checks.at(-1)];
      }
    }
    writeJson(store.checksPath(`${op.id}-kernel`),{schema:'starci/workflow-kernel-checks@1',op:op.id,attempt:op.attempt,
      runtime:op.runtime,checks:verified.checks,verifiedAt:Date.now()});
    if(!verified.ok){
      op.reports.at(-1).downgradedTo='failed';
      store.appendEvent({event:'machine-verify-failed',op:op.id,failed:verified.failed.map(check=>`${check.name}=${check.exitCode}`)});
      return retryOp(store,state,op,verified.failed.map(check=>`the kernel re-ran ${check.name} (\`${check.command}\`) and it exited ${check.exitCode}: ${check.evidence}`),ctx,'machine-verify-failed');
    }
    const files=changedFiles(state,op,ctx,op.allowlist,{exclude:op.kernelOwned??[]});
    // Every changed file is mapped to a record kind, and a file whose kind this op does not declare in `writes`
    // is a defect the machine can name on its own: no model is asked, and the report goes back with the finding.
    // `ctx.kindsProfile` is the profile to read it against: null is the compiled one, and a caller that runs the
    // kernel against an authored or a fixture profile hands that one in instead of rebuilding `.dist` for it.
    const undeclared=(()=>{try{return undeclaredWrites(op.kind,files,{profile:ctx.kindsProfile??null,nodeKind:ctx.work?.node?.(op.nodeId)?.kind??null});}catch{return [];}})();
    if(undeclared.length){
      op.reports.at(-1).downgradedTo='failed';
      store.appendEvent({event:'io-undeclared-write',op:op.id,files:undeclared.map(item=>item.file)});
      return retryOp(store,state,op,undeclared.map(item=>`produced a ${item.record} record it does not declare: ${item.file}`),ctx,'io-undeclared-write');
    }
    // A drawing is the grammar rendered, so the canon rules are checked from the bytes it produced, before any
    // model judges it. A kernel given no render checker behaves exactly as it did before the rules existed.
    if(op.kind==='interface.draw'&&typeof ctx.renderChecks==='function'){
      const rendered=(()=>{try{return ctx.renderChecks({op,state,ctx,files});}catch(error){store.appendEvent({event:'render-check-unavailable',op:op.id,reason:String(error?.message??error).slice(0,240)});return null;}})();
      if(plain(rendered)&&rendered.ok===false){
        const failed=(Array.isArray(rendered.checks)?rendered.checks:[]).filter(check=>plain(check)&&check.outcome!=='pass');
        op.reports.at(-1).downgradedTo='failed';
        store.appendEvent({event:'render-check-failed',op:op.id,checks:failed.map(check=>`${check.id}=${check.outcome}`)});
        return retryOp(store,state,op,failed.map(check=>`render check ${check.id} ${check.outcome}: ${check.detail??''}`.trim()),ctx,'render-check-failed');
      }
      if(plain(rendered)&&rendered.ok)store.appendEvent({event:'render-checked',op:op.id,checks:(rendered.checks??[]).map(check=>`${check.id}=${check.outcome}`)});
    }
    // Proof by contrast: the specs this operation added must fail on the code it started from. A green check
    // alone is not evidence that the behavior changed.
    const plan=proofPlan(op,{changedFiles:files});
    if(plan.mode==='fail-before'&&op.baseHead){
      const proof=runAtBase({worktree:state.worktree,baseHead:op.baseHead,opHead:state.head??op.baseHead,specs:plan.specs,commands:plan.commands,git:ctx.git,exec:ctx.exec,timeoutMs:op.timeoutMs??CHECK_TIMEOUT_MS});
      op.proof={verdict:proof.verdict,reason:proof.reason??null,specs:plan.specs};
      store.appendEvent({event:'proof',op:op.id,verdict:proof.verdict,specs:plan.specs,reason:proof.reason??null});
      if(proof.verdict==='contradiction'){
        op.reports.at(-1).downgradedTo='failed';
        return retryOp(store,state,op,[proofFinding(proof)],ctx,'proof-contradiction');
      }
      if(proof.verdict==='weak'){const finding=proofFinding(proof);op.proofFindings=[...(op.proofFindings??[]),finding];state.needUser.push({op:op.id,kind:'proof',detail:finding});}
    }
    // The validator judges what the machine could not: a reject is a contradiction of the report, the op comes
    // back with the findings; a second reject of the same op stops it at the user instead of a third launch.
    const validation=validateAccepted(store,state,op,ctx,{files,verified});
    if(validation.verdict==='reject'){
      op.reports.at(-1).downgradedTo='failed';
      op.validatorRejects=(op.validatorRejects??0)+1;
      if(op.validatorRejects>=VALIDATOR_REJECT_LIMIT){
        op.status='blocked';
        // A blocked op's tab would sit idle in the sidebar until someone closed it by hand.
        if(ctx.orca)closeOpTerminal(ctx.orca,store,state,op);
        state.needUser.push({op:op.id,kind:'validator',detail:`${op.id} was rejected by the validator ${op.validatorRejects} times: ${validation.findings[0]}`});
        store.appendEvent({event:'validator-exhausted',op:op.id,rejects:op.validatorRejects,findings:validation.findings.slice(0,3)});
        return 'validator-exhausted';
      }
      return retryOp(store,state,op,validation.findings,ctx,'validator-reject');
    }
    const commit=ctx.guards.gitQueue(()=>commitOp(state,op,files,ctx));
    if(!commit.committed&&files.length){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'environment',detail:`the work could not be committed: ${commit.reason}`});
      store.appendEvent({event:'commit-failed',op:op.id,reason:commit.reason,files});
      return 'commit-failed';
    }
    if(commit.head)state.head=commit.head;
    op.status='done';op.files=files;op.head=commit.head??state.head;op.verifiedChecks=verified.checks;
    // An author op closes no node: it completed a record, so what follows is the ledger's answer, not a completion.
    // An owner.ask op closes no node either: it prepared or answered a question.
    if(authorsRecord(op.kind)||op.kind===OWNER_ASK){
      const settled=settleAuthoredRecord(store,state,op,ctx);
      store.appendEvent({event:'op-done',op:op.id,node:op.nodeId,runtime:op.runtime,head:op.head,files,
        checks:verified.checks.map(check=>`${check.name}=${check.exitCode}`),committed:commit.committed});
      ctx.guards.gitQueue(()=>cleanStrayFiles(store,state,op,ctx));
      if(ctx.orca)closeOpTerminal(ctx.orca,store,state,op);
      return settled;
    }
    if(op.kind==='review.verify'){
      const findings=reviewFindings(report);
      if(findings.length)return repairFromVerify(store,state,op,findings,ctx);
      op.verdict='pass';
    }
    // One accepted op is one lane step: the lane decides whether the node is told `in-progress` or `done`.
    const lanes=advanceLanes(store,state,op,ctx,verified);
    if(!lanes.handled){
      recordDone(store,state,op,ctx,verified);
      ctx.guards.gitQueue(()=>commitLedgerWrite(store,state,op,ctx));
    }
    markLedger(state,op,op.head);
    store.appendEvent({event:'op-done',op:op.id,node:op.nodeId,runtime:op.runtime,head:op.head,files,
      checks:verified.checks.map(check=>`${check.name}=${check.exitCode}`),committed:commit.committed});
    if(ctx.orca)closeOpTerminal(ctx.orca,store,state,op);
    ctx.guards.gitQueue(()=>cleanStrayFiles(store,state,op,ctx));
    return 'done';
  }
  if(report.outcome==='partial'){
    if(op.kind==='review.verify'){op.status='done';op.verdict='fail';return repairFromVerify(store,state,op,reviewFindings(report),ctx);}
    return resumeOp(store,state,op,report,ctx);
  }
  if(report.outcome==='failed'){
    if(op.kind==='review.verify'){op.status='done';op.verdict='fail';return repairFromVerify(store,state,op,reviewFindings(report),ctx);}
    const failing=(report.checks??[]).filter(check=>check.exitCode!==0)
      .map(check=>`${check.name} failed (exit ${check.exitCode}): ${check.evidence??''}`);
    // A red UAT run is not retried against the same code: the lane's build step is repaired first.
    if(kindRole(op.kind)==='verify')return repairFromUat(store,state,op,failing.length?failing:reviewFindings(report),ctx);
    return retryOp(store,state,op,failing.length?failing:[report.summary],ctx,'failed');
  }
  if(report.outcome==='ask')return answerOrEscalate(orca,store,state,op,report,ctx);
  return handleBlocked(store,state,op,report,ctx);
}

const reviewFindings=report=>{
  const findings=Array.isArray(report.findings)&&report.findings.length?report.findings:report.open??[];
  return findings.map(item=>typeof item==='string'?item:JSON.stringify(item));
};

/** The review rounds one reviewed node set may use: the `review-findings` route's bound. */
const reviewRounds=()=>routeOf({verdict:'fail',kind:'review.verify'})?.limit??VERIFY_ROUNDS;

/** A review that found something becomes one repair operation; the next review is created when it is done. */
function repairFromVerify(store,state,op,findings,ctx){
  op.verdict='fail';
  const key=groupKey(state,op.ledgerIds);
  const route=routeOf({verdict:'fail',kind:op.kind})??{kind:'lane-build',origin:'repair',then:'retry',limit:VERIFY_ROUNDS};
  const rounds=Number.isFinite(route.limit)?route.limit:VERIFY_ROUNDS;
  for(const id of op.ledgerIds){const item=ledgerItem(state,id);if(item&&item.status==='verified')item.status='implemented';}
  if((state.verifyRounds[key]??1)>=rounds){
    state.needUser.push({op:op.id,kind:'review',detail:`${key} still fails review after ${rounds} rounds: ${findings[0]??'no finding text'}`});
    store.appendEvent({event:'verify-limit',op:op.id,component:key,findings:findings.slice(0,3)});
    return 'verify-limit';
  }
  if(!findings.length){
    state.needUser.push({op:op.id,kind:'review',detail:`${op.id} failed review without naming a finding`});
    return 'verify-without-findings';
  }
  const named=unique(findings.flatMap(pathsIn)).filter(file=>inside(file,op.allowlist));
  // After a cut the group's proof judges many pieces at once, so a finding is repaired where it lives: the child
  // whose write scope holds every file it names. Findings spread over several children stay the group's.
  const target=repairTarget(state,op,findings);
  const scoped=target?named.filter(file=>inside(file,target.allowlist)):named;
  // The repair is the lane's build step, so a finding on frontend work comes back as frontend work.
  const repair=addOp(store,state,{kind:routeKind(route,state,op)??'backend.implement',
    goal:`Resolve the review findings of ${op.id}`,
    ...(target?{nodeId:target.nodeId,ledgerIds:target.ledgerIds}:{ledgerIds:op.ledgerIds}),
    allowlist:scoped.length?scoped:(target?target.allowlist:op.allowlist),
    references:op.references,checks:target?target.checks:op.checks,acceptance:op.acceptance,
    findings,origin:route.origin??'repair'},`review findings of ${op.id}`);
  store.appendEvent({event:'verify-findings',op:op.id,component:key,findings:findings.length,allowlist:named,
    ...(target?{child:target.nodeId}:{})});
  routed(store,op,'review-findings',repair.id,repair.origin,{kind:repair.kind,limit:rounds,then:route.then});
  return 'repair-from-findings';
}

/**
 * A UAT run that came back red: the route turns it into a repair of the lane's build step, and the run itself
 * is reopened behind that repair instead of being retried against the code it already failed. It shares the
 * review-round counter, so a flow cannot bounce between build and UAT forever.
 */
function repairFromUat(store,state,op,findings,ctx){
  const key=groupKey(state,op.ledgerIds);
  const route=routeOf({outcome:'failed',kind:op.kind})??{kind:'lane-build',origin:'repair',then:'reopen',limit:VERIFY_ROUNDS};
  const rounds=Number.isFinite(route.limit)?route.limit:VERIFY_ROUNDS;
  op.verdict='fail';
  if((state.verifyRounds[key]??0)>=rounds){
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'uat',detail:`${key} still fails UAT after ${rounds} rounds: ${findings[0]??'no finding text'}`});
    store.appendEvent({event:'uat-limit',op:op.id,component:key,findings:findings.slice(0,3)});
    return 'uat-limit';
  }
  state.verifyRounds[key]=(state.verifyRounds[key]??0)+1;
  const named=unique(findings.flatMap(pathsIn)).filter(file=>inside(file,op.allowlist));
  // A frontend group is walked once at the parent, so a red step is repaired where it lives: the child whose
  // write scope holds every file the findings name. A step that names files of several children stays the group's.
  const target=repairTarget(state,op,findings);
  const scoped=target?named.filter(file=>inside(file,target.allowlist)):named;
  const repair=addOp(store,state,{kind:routeKind(route,state,op)??'frontend.implement',nodeId:target?.nodeId??op.nodeId,
    goal:`Fix what the UAT run ${op.id} found red: ${firstLine(findings[0]??'the flow does not pass')}`,
    ledgerIds:target?target.ledgerIds:op.ledgerIds,
    allowlist:scoped.length?scoped:(target?target.allowlist:op.allowlist),references:op.references,
    checks:target?target.checks:op.checks,acceptance:op.acceptance,findings,origin:route.origin??'repair'},`uat findings of ${op.id}`);
  reopenRequester(store,state,op,findings,repair,`the UAT repair ${repair.id} lands first; then run the flow again`);
  store.appendEvent({event:'uat-findings',op:op.id,component:key,round:state.verifyRounds[key],findings:findings.length,
    ...(target?{child:target.nodeId}:{})});
  routed(store,op,'uat-failed',repair.id,repair.origin,{kind:repair.kind,limit:rounds,then:route.then});
  return 'repair-from-uat';
}

/* ------------------------------------------------------------------ accept, verify, gates */

/** The validator is the kernel's gate; an operation blocked only by it is resumed, never escalated as a shared change. */
function validatorOnlyBlock(report){
  if(report?.outcome!=='blocked'||report?.blocker?.kind!=='shared-change')return false;
  const failing=(report.checks??[]).filter(check=>check.exitCode!==0);
  return failing.length>0&&failing.every(check=>/work-valid/i.test(check.name??''))&&/\.starciwork|work-valid|validator/i.test(report.blocker.detail??'');
}

function acceptReports(orca,store,state,ctx){
  // The report file is the source of truth: a report whose Orca signal failed to send is still a report.
  const reports=store.readReports().filter(report=>report?.dispatch&&report?.outcome);
  const actions=[];
  for(const op of state.ops.filter(item=>item.status==='running')){
    const report=reports.find(item=>item.dispatch===op.dispatch);
    if(!report)continue;
    const dispatch=op.dispatch,runtime=op.runtime;
    const action=applyOpReport(orca,store,state,op,report,ctx);
    actions.push({op:op.id,action});
    state.stalls=0;
    if(op.status!=='answering'){
      ctx.allocator.release(runtime,{op:op.id});
      orca.invoke('worker-release',{dispatch},{cwd:state.worktree});
      sweepWorktree(orca,{cwd:state.worktree,from:state.from});
    }
  }
  return actions;
}

/**
 * What one proof covers. On the Work ledger it is the cut parent when the node was cut - the group is the unit
 * the heavy work was fanned out from, and its proof runs once for the whole group - and otherwise the module,
 * because that is the unit a reviewer can judge as a whole. On a plan ledger it is the connected component of
 * items an operation joined together.
 */
function verifyComponents(state,ready){
  if(state.ledgerMode===WORK_LEDGER){
    const groups=new Map();
    for(const id of ready){
      const key=cutParentOf(state,id)??ledgerItem(state,id)?.module??id;
      groups.set(key,(groups.get(key)??new Set()).add(id));
    }
    return [...groups.values()];
  }
  const components=[];
  for(const id of ready){
    const family=new Set(state.ops.filter(op=>implementsLedger(op)&&op.ledgerIds.includes(id)).flatMap(op=>op.ledgerIds).filter(other=>ready.includes(other)));
    family.add(id);
    const existing=components.find(component=>[...family].some(member=>component.has(member)));
    if(existing)for(const member of family)existing.add(member);
    else components.push(family);
  }
  return components;
}

/**
 * A lane proves itself with `review.verify` only when its template names that step and it has not run yet. A
 * frontend lane proves itself with its own `uat.verify` step instead, so no review is planned for it; an item
 * with no lane (a plan-ledger goal item) keeps the 4.x rule that every implemented item is reviewed.
 */
// A review is the LAST prove step of a lane: it is planned only when every step before it is accepted, so a
// backend node is reviewed after its e2e scenarios are green, never in parallel with them.
const laneWantsReview=(state,id,ctx=null)=>{
  const entry=state?.lanes?.[id];
  if(!entry?.lane?.length)return true;
  const next=laneNext(entry,lanePredicates(ctx,ctx?.work?.node?.(id)??null));
  // A cut child proves nothing on its own: every prove step of its lane is planned once, for its parent's group.
  if(cutParentOf(state,id))return Boolean(next)&&kindRole(next)==='verify';
  return entry.lane.includes('review.verify')&&next==='review.verify';
};

/**
 * A ledger group whose implementing operations are all done gets one independent proof. For a node that was cut
 * the group is the parent: its children build in parallel, and `e2e.verify` and then `review.verify` are planned
 * ONCE for the whole group - never once per piece - when every child's build step is accepted, on a runtime none
 * of the children used. The parent's group acceptance is that proof's acceptance.
 */
function planVerifyOps(store,state,ctx){
  const ready=state.ledger.filter(item=>item.status==='implemented').map(item=>item.id)
    .filter(id=>laneWantsReview(state,id,ctx))
    .filter(id=>{
      const ops=state.ops.filter(op=>op.ledgerIds.includes(id));
      return ops.some(implementsLedger)&&ops.filter(implementsLedger).every(op=>op.status==='done')
        &&!ops.some(op=>kindRole(op.kind)==='verify'&&op.origin==='verify'&&liveStatus.includes(op.status));
    });
  if(!ready.length)return [];
  const created=[];
  for(const component of verifyComponents(state,ready)){
    const ledgerIds=[...component].sort();
    const key=groupKey(state,ledgerIds);
    // One proof per group: a cut parent whose children are not all implemented yet waits for the rest of them.
    if(groupIncomplete(state,ledgerIds))continue;
    const kind=groupVerifyKind(state,ledgerIds);
    const review=kind==='review.verify';
    // The review of one group is bounded: past the last round the group waits for the user, it is not reviewed again.
    if(review&&(state.verifyRounds[key]??0)>=reviewRounds()){
      for(const id of ledgerIds){const item=ledgerItem(state,id);if(item)item.status='review-exhausted';}
      state.needUser.push({kind:'review',detail:`${key} used its ${reviewRounds()} review rounds and is implemented again; decide whether the last findings stand`});
      store.appendEvent({event:'verify-exhausted',component:key,rounds:state.verifyRounds[key]});
      continue;
    }
    const implementers=state.ops.filter(op=>implementsLedger(op)&&op.ledgerIds.some(id=>ledgerIds.includes(id)));
    const titles=ledgerIds.map(id=>ledgerItem(state,id)?.title??id).join('; ');
    if(review)state.verifyRounds[key]=(state.verifyRounds[key]??0)+1;
    const op=addOp(store,state,{kind,
      goal:review
        ?`Verify, without repairing anything, that ${titles} is implemented as the goal requires. Report every finding in open[]; an empty open[] means you accept the work.`
        :kind==='uat.verify'
          ?`Walk every flow of ${titles} on the rendered surface, as a person does, with a screenshot per step. This is the group's one walk: the screens were built in parallel and are walked together, never one at a time.`
          :`Prove ${titles} end to end through the public API on the real stack, one scenario per assertion of the group. This is the group's one proof: the pieces were built in parallel and are judged together, never one at a time.`,
      ledgerIds,allowlist:unique(implementers.flatMap(item=>item.allowlist)),
      references:unique(implementers.flatMap(item=>item.references)),
      checks:dedupeChecks(implementers.flatMap(item=>item.checks)),
      acceptance:unique([...(cutGroupAcceptance(state,ledgerIds)),...implementers.flatMap(item=>item.acceptance)]),
      resources:unique(implementers.flatMap(item=>item.resources??[])),
      avoidRuntimes:unique(implementers.map(item=>item.runtime).filter(Boolean)),origin:'verify'},
      `${review?`round ${state.verifyRounds[key]}`:kind} of ${key}`);
    created.push(op.id);
  }
  return created;
}
/** The group acceptance a cut parent kept when it became derived (`extensions.work3.groupAssertions`). */
const cutGroupAcceptance=(state,ledgerIds)=>unique(ledgerIds.map(id=>cutParentOf(state,id)).filter(Boolean)
  .flatMap(parent=>state.cuts?.[parent]?.assertions??[]));
const dedupeChecks=checks=>{const seen=new Map();for(const check of checks)if(!seen.has(check.command))seen.set(check.command,check);return [...seen.values()];};

/** The job gates are the kernel's own commands, never an operation's claim. A failing gate becomes one repair. */
export function runGates(store,state,ctx){
  if(!state.gates.length)return {ok:true,results:[]};
  const results=state.gates.map(gate=>{
    const result=ctx.exec(gate.command,{cwd:state.worktree,timeoutMs:gate.timeoutMs??CHECK_TIMEOUT_MS});
    const exitCode=Number.isInteger(result?.status)?result.status:1;
    return {name:gate.name,command:gate.command,exitCode,status:exitCode===0?'passed':'failed',evidence:tail(`${result?.stdout??''}${result?.stderr??''}`)};
  });
  state.gateResults=results;
  const failed=results.filter(result=>result.exitCode!==0);
  store.appendEvent({event:'gates',round:state.gateRounds,results:results.map(result=>`${result.name}=${result.exitCode}`)});
  if(!failed.length)return {ok:true,results};
  state.gateRounds+=1;
  if(state.gateRounds>GATE_ROUNDS){
    state.needUser.push({kind:'gate',detail:`${failed.map(result=>result.name).join(', ')} still fail after ${GATE_ROUNDS} repair rounds`});
    return {ok:false,repaired:false,results};
  }
  // The repair scope is the code every op touched - never the Work tree: a gate repair once carried `.starciwork`
  // paths from a design op's allowlist and committed a kernel block into a frontend record.
  addOp(store,state,{kind:'backend.implement',goal:`Make the job gates pass: ${failed.map(result=>result.name).join(', ')}`,
    ledgerIds:[],allowlist:unique(state.ops.flatMap(op=>op.allowlist)).filter(entry=>!/(^|\/)\.starciwork(\/|$)/.test(slash(entry))),references:[],
    checks:failed.map(result=>({name:result.name,command:result.command})),
    acceptance:failed.map(result=>`${result.name} exits 0`),
    findings:failed.map(result=>`${result.name} failed (exit ${result.exitCode}): ${result.evidence}`),origin:'gate'},
    `gate round ${state.gateRounds}`);
  return {ok:false,repaired:true,results};
}

/** Re-read the Work tree so the final report states what the ledger says now, not what it said at approval. */
function refreshLedgerSummary(state,ctx){
  if(!ctx?.work)return state.ledgerSummary;
  try{
    const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});
    state.ledgerSummary=ctx.work.api.ledgerSummary(loaded,{scope:state.scope.length?state.scope:null});
  }catch{/* a tree that cannot be re-read leaves the approved summary in place */}
  return state.ledgerSummary;
}

function finish(store,state,outcome,reason=null,ctx=null){
  // The lane is merged first, because a refused merge changes the outcome this report states.
  const settled=settleLane(store,state,outcome,ctx);
  if(settled){outcome=settled.outcome;reason=settled.reason;}
  const final={schema:FINAL_REPORT,id:state.id,job:state.job,outcome,reason,branch:state.branch,head:state.head,
    lane:laneView(state),
    ledgerMode:state.ledgerMode,scope:state.scope,ledgerSummary:refreshLedgerSummary(state,ctx),decisions:state.decisions,brand:state.brand??null,
    ledgerRoot:state.ledgerRoot?slash(state.ledgerRoot):null,ledgerShared:Boolean(state.ledgerShared),ledgerOwner:state.ledgerOwner??null,
    definitionOfDone:state.definitionOfDone,
    ledger:state.ledger.map(item=>({...item})),
    acceptedAsPreexisting:state.ledger.filter(item=>item.status==='preexisting').map(item=>item.id),
    gates:state.gateResults.map(result=>({name:result.name,command:result.command,status:result.status,exitCode:result.exitCode})),
    needUser:state.needUser,
    ops:state.ops.map(op=>({id:op.id,kind:op.kind,node:op.nodeId,origin:op.origin,status:op.status,runtime:op.runtime,attempt:op.attempt,
      allowlist:op.allowlist,ledgerIds:op.ledgerIds,head:op.head,ledgerCommit:op.ledgerCommit??null,verdict:op.verdict,validation:op.validation??null,files:op.files})),
    iterations:state.iterations,finishedAt:Date.now()};
  writeJson(store.paths.final,final);
  state.finished={outcome,reason,report:store.paths.final};
  state.phase='finished';
  store.appendEvent({event:'finished',outcome,reason,ledger:state.ledger.map(item=>`${item.id}=${item.status}`)});
  store.saveState(state);
  return final;
}

/**
 * Nobody reports a rate limit: the runtime simply goes quiet. Two `stalled-silent` settlements of the same
 * runtime inside half an hour are read as exactly that, the allocator is told, and the window is cleared so
 * the inference needs two fresh silences before it fires again.
 */
function noteSilence(store,state,op,ctx){
  const runtime=op.runtime;
  if(!runtime)return false;
  const at=ctx.now();
  const window=[...(state.silences?.[runtime]??[]),at].filter(time=>at-time<=RATE_LIMIT_WINDOW_MS);
  state.silences={...(state.silences??{}),[runtime]:window};
  if(window.length<SILENCE_LIMIT)return false;
  ctx.allocator.failed(runtime,{reason:'rate-limited (inferred from repeated silence)',op:op.id});
  state.silences[runtime]=[];
  store.appendEvent({event:'rate-limit-inferred',op:op.id,runtime,silences:window.length,windowMs:RATE_LIMIT_WINDOW_MS});
  return true;
}

export function settleStalled(orca,store,state,ctx,tick){
  for(const op of state.ops.filter(item=>item.status==='running')){
    const observed=(tick.liveness??[]).find(item=>item.dispatch===op.dispatch);
    if(!observed)continue;
    if(observed.liveness==='stalled-idle'&&!op.nudged){
      notifyTerminal(orca,{cwd:state.worktree,terminal:op.terminal,wait:ctx.wait,
        text:'Continue; when you are finished report exactly once with the report command in your contract'});
      op.nudged=true;
      store.appendEvent({event:'nudged',op:op.id,liveness:observed.liveness});
      continue;
    }
    if(!['stalled-prompt','stalled-silent','stalled-idle','dead','rate-limited'].includes(observed.liveness))continue;
    settleDispatch(orca,op.dispatch,{cwd:state.worktree,reason:observed.liveness,terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(observed.liveness==='rate-limited'){ctx.allocator.failed(op.runtime,{reason:`rate-limited (${observed.reason??'provider screen'})`,op:op.id});store.appendEvent({event:'rate-limit-parked',op:op.id,runtime:op.runtime});}
    else ctx.allocator.release(op.runtime,{op:op.id});
    if(observed.liveness==='stalled-silent'&&noteSilence(store,state,op,ctx))avoidRuntime(op,op.runtime,clockOf(ctx));
    op.restarts+=1;
    store.appendEvent({event:'settled',op:op.id,liveness:observed.liveness,restarts:op.restarts});
    noteAnomaly(store,state,`settled:${op.id}:${observed.liveness}`,{op:op.id,runtime:op.runtime,liveness:observed.liveness});
    triageAnomaly(store,state,`settled:${op.id}:${observed.liveness}`,{...ctx,orca});
    if(op.restarts>RESTART_LIMIT){
      op.status='blocked';
      if(observed.liveness==='rate-limited'){
        // A provider limit is time, not a defect: the op cools down and comes back on another runtime by itself.
        op.refusal='rate-limited';op.coolUntil=ctx.now()+RATE_LIMIT_COOLDOWN_MS;
        store.appendEvent({event:'rate-limit-cooling',op:op.id,runtime:op.runtime,until:op.coolUntil,restarts:op.restarts});
      }else state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} was restarted ${op.restarts} times (${observed.liveness})`});
      continue;
    }
    op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;avoidRuntime(op,op.runtime,clockOf(ctx));
  }
}

function answerQuestions(orca,store,state,ctx){
  for(const op of state.ops.filter(item=>item.status==='answering')){
    const delivered=notifyTerminal(orca,{cwd:state.worktree,terminal:op.terminal,text:op.answer,wait:ctx.wait});
    store.appendEvent({event:'answered',op:op.id,delivered:delivered.delivered??null});
    op.status='running';
  }
}

/* ------------------------------------------------------------------ the supervisor models */

/** The decide role's preference starts with the supervisor runtimes that exist in the profile. */
const plainObject=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function withSupervisorPreference(profile,runtimes){
  if(!profile||!plainObject(profile.runtimes))return profile;
  const known=runtimes.filter(id=>profile.runtimes[id]);
  if(!known.length)return profile;
  const copy=structuredClone(profile);
  copy.allocation=copy.allocation??{};copy.allocation.preference=copy.allocation.preference??{};
  copy.allocation.preference.decide=[...known,...((copy.allocation.preference.decide??[]).filter(id=>!known.includes(id)))];
  return copy;
}
export const DEFAULT_SUPERVISOR_RUNTIMES=['claude-fable-5.1','gpt-6-astra'];
/** `<host>/config.json` may set `supervisor.runtimes`: the models triage and decide operations prefer, strongest first. */
export function supervisorRuntimes(host){
  try{
    const config=JSON.parse(fs.readFileSync(path.join(host,'config.json'),'utf8'));
    const listed=Array.isArray(config?.supervisor?.runtimes)?config.supervisor.runtimes:typeof config?.supervisor==='string'?[config.supervisor]:null;
    const runtimes=(listed??[]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());
    return runtimes.length?runtimes:DEFAULT_SUPERVISOR_RUNTIMES;
  }catch{return DEFAULT_SUPERVISOR_RUNTIMES;}
}
/** `<host>/config.json` may set `validator.runtimes`: the providers the one validator of a workflow is called on, in order. */
export function validatorRuntimes(host){
  try{
    const config=JSON.parse(fs.readFileSync(path.join(host,'config.json'),'utf8'));
    const listed=Array.isArray(config?.validator?.runtimes)?config.validator.runtimes:typeof config?.validator==='string'?[config.validator]:null;
    const runtimes=(listed??[]).filter(item=>typeof item==='string'&&item.trim()).map(item=>item.trim());
    return runtimes.length?runtimes:llm.DEFAULT_VALIDATOR_RUNTIMES;
  }catch{return llm.DEFAULT_VALIDATOR_RUNTIMES;}
}
/**
 * The task spec travels on one Orca command line, and Windows bounds a command line near 32k characters: a
 * 142-file allowlist once made `task-create` fail with ENAMETOOLONG and took the kernel down with it. A contract
 * past this length is handed over as its head plus where the whole of it is, and the agent reads the file.
 */
/**
 * Orca pastes the task spec into the agent's terminal and fails the Dispatch when the TUI has not consumed it
 * within its start timeout: a 12k paste sat behind a "[Pasted Content]" marker on Claude and Codex alike
 * (`agent_prompt_stalled`) and no drawing launched for an afternoon. A short spec - the head plus the pointer to
 * the complete contract file - is consumed at once, and the agent reads the rest from disk.
 */
export const SPEC_LIMIT=4000;
export function operationSpec(op,contract){
  const text=String(contract??'');
  if(text.length<=SPEC_LIMIT)return text;
  const file=slash(String(op?.contractFile??''));
  const head=text.slice(0,SPEC_LIMIT-900);
  return `${head}\n\n[...]\n\nThis contract is longer than a task can carry (${text.length} characters). The COMPLETE contract - the allowlist, the working order, the report command and every rule after this point - is in the file \`${file}\`. Read that file in full before you do anything: it is the task, and a rule you did not read still binds you.`;
}
export const TRIAGE_AFTER=3;
/**
 * One stage of an iteration that throws is recorded (`kernel-error`) and the loop goes on; the same stage
 * failing this many times in a row stops the workflow for the user instead of letting a supervisor restart a
 * kernel that dies at the same line every minute.
 */
export const KERNEL_ERROR_LIMIT=5;
/** How long an op blocked by a provider rate limit waits before it is re-admitted on another runtime. */
export const RATE_LIMIT_COOLDOWN_MS=60*60*1000;
/**
 * A runtime an op learned to avoid - it failed to launch there, stalled there, or was rate-limited there - is
 * avoided for the cooldown, not for ever: the stamp says when, and `readmitCooled` opens the runtime to the op
 * again once the cooldown has passed (`avoid-expired`). A verify op's avoidance of its implementers carries no
 * stamp and never expires: that one is independence, not a failure.
 */
function avoidRuntime(op,runtime,now){
  if(!runtime)return;
  op.avoidRuntimes=unique([...(op.avoidRuntimes??[]),runtime]);
  op.avoidedAt={...(plain(op.avoidedAt)?op.avoidedAt:{}),[runtime]:now};
}
/**
 * An op the restart limit blocked for a rate limit is not the user's question: once its cooldown has passed it is
 * ready again with its restarts cleared and the limited runtime avoided. An op blocked by an older build - a
 * `restarted N times (rate-limited)` question with no cooldown recorded - is given one at load and released the
 * same way, and its question goes.
 */
function readmitCooled(store,state,ctx){
  const now=typeof ctx?.now==='function'?ctx.now():Date.now();
  for(const item of state.needUser.filter(entry=>entry.kind==='environment'&&/\(rate-limited\)$/.test(String(entry.detail??'')))){
    const op=state.ops.find(candidate=>candidate.id===item.op);
    if(!op||op.status!=='blocked'||op.refusal)continue;
    op.refusal='rate-limited';op.coolUntil=now;
    state.needUser=state.needUser.filter(entry=>entry!==item);
    store.appendEvent({event:'rate-limit-cooling',op:op.id,runtime:op.runtime,until:op.coolUntil,restarts:op.restarts,migrated:true});
  }
  for(const op of state.ops.filter(candidate=>candidate.status==='blocked'&&candidate.refusal==='rate-limited')){
    if(!(Number(op.coolUntil??0)<=now))continue;
    const limited=op.runtime;
    op.status='ready';op.refusal=null;op.coolUntil=null;op.restarts=0;op.dispatch=null;op.terminal=null;op.nudged=false;
    avoidRuntime(op,limited,now);
    store.appendEvent({event:'rate-limit-readmitted',op:op.id,avoid:op.avoidRuntimes});
  }
  // An avoidance older than the cooldown is over: the runtime is open to the op again.
  for(const op of state.ops.filter(candidate=>['pending','ready'].includes(candidate.status)&&plain(candidate.avoidedAt))){
    const expired=Object.entries(op.avoidedAt).filter(([,at])=>now-Number(at)>=RATE_LIMIT_COOLDOWN_MS).map(([id])=>id);
    if(!expired.length)continue;
    op.avoidRuntimes=(op.avoidRuntimes??[]).filter(id=>!expired.includes(id));
    for(const id of expired)delete op.avoidedAt[id];
    store.appendEvent({event:'avoid-expired',op:op.id,runtimes:expired,avoid:op.avoidRuntimes});
  }
}
function guardedStage(store,state,ctx,stage,fn){
  try{fn();state.kernelErrors=0;return 'ok';}
  catch(error){
    const message=String(error?.stack??error?.message??error).slice(0,600);
    state.kernelErrors=(state.kernelErrors??0)+1;
    store.appendEvent({event:'kernel-error',stage,count:state.kernelErrors,message});
    if(state.kernelErrors<KERNEL_ERROR_LIMIT){store.saveState(state);return 'error';}
    state.needUser.push({kind:'environment',detail:`the kernel failed ${state.kernelErrors} times in a row at ${stage}: ${String(error?.message??error).slice(0,240)}`});
    finish(store,state,'blocked',`the kernel keeps failing at ${stage}`,ctx);
    return 'stop';
  }
}
/**
 * Triage: the one place a model reads an anomaly the policy table could not classify. It is called only when
 * the same anomaly signature repeats, it may only pick from a closed option set, and every pick is recorded so
 * the next occurrence becomes a rule instead of another call.
 */
export const TRIAGE_OPTIONS=['resume-ops','park-runtime','settle-op','restart-kernel','needUser'];
export function noteAnomaly(store,state,signature,detail){
  state.anomalies=state.anomalies??{};
  const entry=state.anomalies[signature]=state.anomalies[signature]??{count:0,detail,firstAt:Date.now(),triaged:null};
  entry.count+=1;entry.lastAt=Date.now();
  return entry;
}
export function triageAnomaly(store,state,signature,ctx){
  const entry=state.anomalies?.[signature];
  if(!entry||entry.count<TRIAGE_AFTER||entry.triaged||typeof ctx.decide!=='function')return null;
  const chosen=ctx.decide({situation:`Anomaly repeated ${entry.count} times: ${signature}`,options:TRIAGE_OPTIONS,providers:ctx.supervisor??DEFAULT_SUPERVISOR_RUNTIMES,
    context:{detail:entry.detail,recentEvents:store.readEvents({since:Math.max(0,(store.readEvents().at(-1)?.seq??0)-40)}).map(e=>`${e.event}${e.op?` ${e.op}`:''}${e.reason?` ${String(e.reason).slice(0,80)}`:''}`),ops:state.ops.map(op=>`${op.id}=${op.status}`)},cwd:state.worktree});
  const option=chosen?.ok&&TRIAGE_OPTIONS.includes(chosen.value.option)?chosen.value.option:'needUser';
  entry.triaged={option,rationale:chosen?.ok?chosen.value.rationale:null,at:Date.now()};
  store.appendEvent({event:'triage',signature,option,rationale:entry.triaged.rationale,count:entry.count});
  // Resume only what a transient cause blocked: an op with a refusal (out of repository, superseded, dynamic budget) stays blocked whatever the anomaly.
  if(option==='resume-ops'){for(const op of state.ops)if(op.status==='blocked'&&!op.refusal){op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='park-runtime'){const runtime=entry.detail?.runtime;if(runtime)ctx.allocator.failed(runtime,{reason:`triage: ${signature}`});}
  else if(option==='settle-op'){const op=state.ops.find(item=>item.id===entry.detail?.op&&item.status==='running');if(op){settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'triage',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='restart-kernel'){fs.writeFileSync(path.join(store.dir,'stop.flag'),'triage restart');}
  else state.needUser.push({kind:'triage',detail:`${signature}: ${JSON.stringify(entry.detail).slice(0,300)}`});
  return option;
}

/* ------------------------------------------------------------------ the loop */

/**
 * Phase `run`. One iteration: schedule every operation whose dependencies are done and whose allowlist is
 * free, wait one tick, accept the reports that arrived (machine verification, commit, ledger), create the
 * reviews and repairs the results imply, and - when nothing is left to run - run the job gates and finish.
 * Every iteration appends a `tick` event and saves state, so re-running `workflow-run` continues.
 *
 * `reconcile`, `renderChecks` and `contractDigest` are the three seams other modules plug into. Their defaults
 * are the shipped modules (the typed reconciliation, the render checks, the contract digest); a caller that hands
 * in `null` runs without that rule, exactly as a kernel did before the rule existed, which is what the tests use.
 */
/**
 * The reconciliation seam, as the kernel runs it: the typed rows the intake wrote are checked against the tree
 * with the node reader of the ledger and the digests the launch captured (`op.intakeDigests`), so a decided
 * record the intake edited is caught against what the tree held before the op. A test hands `runLoop` its own
 * `reconcile` instead; `null` runs without the check, as a kernel did before the rule existed.
 */
function reconcileIntakeSeam({op,state,tree,scope}){
  const at=tree?.at??{repoRoot:tree?.repoRoot,workRoot:tree?.workRoot};
  return reconcileIntake({op,state,tree,scope,readNode:node=>work.readNode(at,node),digests:op?.intakeDigests??null});
}
/**
 * The digest of everything a proof of one kind rests on: the kind's declaration in the catalog, the operator
 * contract it launches through, and the validator rules. `markDone` stores it and the ledger sync compares it,
 * so a rule that moves reopens the proofs taken under the old one instead of leaving them verified by habit.
 * A kind the catalog does not carry (a plan-ledger kind) has no declaration to bind and answers `null`.
 */
function contractDigestFor(kind){
  let kindRecord=null;
  try{kindRecord=graph.kindRecord(kind);}catch{return null;}
  let operator=null;
  try{operator=readDistJson('ops',launchOperator(kind),'operator.json');}catch{operator=null;}
  return work.contractDigestOf({kind,kindRecord,operator,rules:llm.VALIDATOR_RULES});
}

export function runLoop(orca,store,state,{cwd=state.worktree,allocator,planOp=llm.planOp,decide=llm.decide,validateOp=llm.validateOp,template,supervisor=null,validator=null,
  wait=sleepSync,exec=runCommand,git=spawnSync,launch=launchWithCandidate,maxIterations=Infinity,guards=kernelGuards,
  ledgerApi=work,validate=validateWorkTree,ledgerRoot=null,resolveLedger=resolveLedgerRoot,
  reconcile=reconcileIntakeSeam,renderChecks=renderChecksFor,contractDigest=contractDigestFor,kindsProfile=null,
  waitTimeoutMs=900000,tickMs=120000,pollMs=POLL_MS,now=Date.now,host=hostDescriptorOf(orca)}={}){
  need(state.approved,`Workflow ${state.id} is not approved; run workflow-approve --id ${state.id}`);
  need(plain(allocator),'A runtime allocator is required');
  need(typeof template==='string'&&template.trim(),'The operation contract template is required');
  required(state.run,'Orca run id');required(state.from,'own terminal handle');
  // `validateOp:null` is an explicit choice to run without the validator; it is recorded once as `validator-skipped`.
  const ctx={cwd,allocator,planOp,decide,validateOp,template,wait,exec,git,launch,now,guards,work:null,orca,host:hostDescriptorOf({host}),
    reconcile,renderChecks,contractDigest,kindsProfile,
    supervisor:supervisor??supervisorRuntimes(state.host??''),validator:validator??validatorRuntimes(state.host??'')};
  // Which host runs this workflow is a fact of the run: a sequential host names itself so the log says why one op ran at a time.
  store.appendEvent({event:'host',name:ctx.host.name,capabilities:ctx.host.capabilities,sequential:ctx.host.sequential,maxParallelOps:allocator.maxParallelOps??null});
  // A state written before these bounds existed resumes with them.
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  state.dynamicOpsBudget=dynamicBudget(state);
  // The budget counts only shared and repair ops; a kernel-origin op an older build refused under it is superseded,
  // never reinstated by --allow-dynamic, and its needUser item goes with it.
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  for(const op of state.ops)if(!countsAgainstBudget(op)&&op.refusal==='dynamic-op'){op.refusal='superseded';state.needUser=state.needUser.filter(item=>item.op!==op.id||item.kind!=='dynamic-op');}
  // An op the validator exhausted gets one more round on a fresh kernel start: the validator's rules may have changed.
  for(const op of state.ops)if(op.status==='blocked'&&!op.refusal&&(op.validatorRejects??0)>=validatorRejectLimit()&&!op.validatorReset){op.status='ready';op.validatorRejects=0;op.validatorReset=true;op.dispatch=null;op.terminal=null;state.needUser=state.needUser.filter(item=>!(item.op===op.id&&item.kind==='validator'));}
  state.sharedQueue=Array.isArray(state.sharedQueue)?state.sharedQueue:[];
  state.silences=plain(state.silences)?state.silences:{};
  state.lanes=plain(state.lanes)?state.lanes:{};
  // A kind graph that cannot be read is not fatal - lanes simply do not apply - but it is never silent.
  const graphProblems=(()=>{try{return graph.validateGraph().map(item=>typeof item==='string'?item:`${item.code??'graph'}: ${item.message??JSON.stringify(item)}`);}catch(error){return [error.message];}})();
  if(graphProblems.length)store.appendEvent({event:'kind-graph-problem',problems:graphProblems.slice(0,5)});
  // The worktree itself is a precondition: long paths, the hooks env for kernel commits, the autocrlf state.
  const checked=guards.preflight({worktree:state.worktree,git})??{};
  state.preflight={ok:Boolean(checked.ok),fixes:[...(checked.fixes??[])],problems:[...(checked.problems??[])]};
  store.appendEvent({event:'preflight',ok:state.preflight.ok,fixes:state.preflight.fixes,problems:state.preflight.problems});
  for(const problem of state.preflight.problems)
    if(!state.needUser.some(item=>item.kind==='environment'&&item.detail===problem))
      state.needUser.push({kind:'environment',detail:problem});
  if(state.ledgerMode===WORK_LEDGER){
    // The Work tree is read once per run: every write below goes back into the node the operation closes.
    const repoRoot=state.repoRoot??repositoryRoot(state.worktree);
    state.repoRoot=repoRoot;
    // Two repositories, two jobs: the code is written, checked and committed here, and the Work is read and
    // recorded in the repository that owns the tree - which is this one unless the product routes it elsewhere.
    const binding=ledgerBinding(state,{repoRoot,host:state.host,ledgerRoot,git:ctx.git,resolve:resolveLedger});
    const at={repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot};
    const loaded=ledgerApi.loadLedger({...at,validate});
    // The kernel block is part of a node's semantic digest, so a completion must bind the digest the
    // validator reports AFTER that block is written: every transition resolves it through this reader.
    const digest=({node})=>{
      const fresh=ledgerApi.loadLedger({...at,validate}).nodes.get(node.id)?.inputDigest;
      need(/^[a-f0-9]{64}$/.test(String(fresh??'')),`The Work validator reports no inputDigest for ${node.id}`);
      return fresh;
    };
    const remote=ctx.git('git',['remote','get-url','origin'],{cwd:repoRoot,encoding:'utf8',windowsHide:true});
    const origin=remote.status===0?ledgerApi.normalizeOrigin?.((remote.stdout??'').trim())??null:null;
    // `code` identifies the slice every receipt names; `ledger` is where the record is written. They are the
    // same repository in a single-repository job, and `repoRoot`/`origin`/`repository` keep the old meaning:
    // the ledger is read at `repoRoot`, the code is named by `repository` at `origin`.
    const code={repoRoot,origin,repository:ledgerApi.repositoryName?.(repoRoot)??null};
    const ledger={repoRoot:binding.ownerRepoRoot,workRoot:binding.ledgerRoot,
      repository:binding.ownerRepository??ledgerApi.repositoryName?.(binding.ownerRepoRoot)??null};
    const shared=binding.sharedLedger?{owner:ledger.repository??slash(ledger.repoRoot),root:slash(ledger.workRoot)}:null;
    // The tree is re-read every iteration, so the node reader must answer over the CURRENT read and not over the
    // one this run started with: a node a cut authored mid-run is a node the kernel has to be able to write to.
    ctx.work={api:ledgerApi,loaded,validate,digest,node:id=>(ctx.work?.loaded??loaded).nodes.get(id)??null,
      code,ledger,at,shared:Boolean(shared),side:binding.side??null,source:binding.source,
      // The repositories of the product by role, and the one optional role the kernel routes to itself: the
      // grammar. Null when the binding declares none, which is a question for the user, never a guessed root.
      roles:plain(binding.roles)?binding.roles:null,grammar:grammarRepository(binding.roles),
      repoRoot:ledger.repoRoot,workRoot:ledger.workRoot,origin:code.origin,repository:code.repository};
    repairKernelRecords(store,state,ctx,loaded);
    retemplateLanes(store,state,loaded);
    pruneAnsweredQuestions(store,state,loaded);
    // The brand of this tree, as it stands at the start of the run: every design contract prints it from here.
    noteBrand(store,state,loaded,{silent:true});
    store.appendEvent({event:'ledger-loaded',workRoot:slash(loaded.workRoot),valid:loaded.ok,nodes:loaded.list.length,
      scope:state.scope,source:binding.source,code:code.repository,...(shared?{'ledger-shared':shared}:{})});
    // A shared tree is somebody else's working copy: the kernel commits into it, so it refuses to start over
    // a pending change it does not own rather than sweep that change into a `work(...)` commit.
    if(shared){
      const status=sharedLedgerStatus({ownerRepoRoot:ledger.repoRoot,ledgerRoot:ledger.workRoot,git:ctx.git});
      if(status.strays?.length)store.appendEvent({event:'ledger-shared-strays',owner:shared.owner,root:shared.root,strays:status.strays});
      if(!status.ok){
        // Not a finish: the pending change is somebody's work in progress, so this kernel steps back and the
        // supervisor tries again next round; the item stays in needUser until the owner commits or drops it.
        const detail=`the Work ledger ${shared.root} is owned by ${shared.owner} and carries uncommitted changes the kernel does not own: ${status.foreign.slice(0,12).join(', ')}`;
        if(!state.needUser.some(item=>item.kind==='ledger'&&item.detail===detail))state.needUser.push({kind:'ledger',detail});
        store.appendEvent({event:'ledger-shared-dirty',owner:shared.owner,root:shared.root,foreign:status.foreign});
        store.appendEvent({event:'preflight-blocked',reason:'the shared Work ledger carries uncommitted changes the kernel does not own'});
        store.saveState(state);
        return state;
      }
    }
  }
  // Operations created before a rule change carry their old check lists: the kernel-owned checks are stripped on load.
  for(const op of state.ops)if(Array.isArray(op.checks))op.checks=op.checks.filter(check=>!KERNEL_CHECK.test(check.name??''));
  reconcileWithOrca(orca,store,state,{cwd,wait,allocator});
  // The shared runtime ledger is a repository-wide file: this kernel's own entries for operations that are no
  // longer running are leftovers of a crashed start and would hold a slot of an expensive runtime for everybody.
  const swept=allocator.sharedSync?.(state.ops.filter(op=>op.status==='running').map(op=>op.id));
  if(swept?.dropped?.length)store.appendEvent({event:'runtime-loads-swept',dropped:swept.dropped});
  sweepTreeStrays(store,state,ctx);
  sweepStaleTerminals(orca,store,state,{cwd});
  state.buildStamp=buildStamp();
  for(let iteration=0;iteration<maxIterations&&!state.finished;iteration+=1){
    if(iteration>0&&iteration%RECONCILE_EVERY===0){reconcileWithOrca(orca,store,state,{cwd,wait,allocator});sweepTreeStrays(store,state,ctx);}
    if((iteration>0&&iteration%RECONCILE_EVERY===0)||now()-(state.lastSweepAt??0)>=SWEEP_MS)sweepStaleTerminals(orca,store,state,{cwd,now});
    if(stopRequested(store)){store.appendEvent({event:'stopped',reason:'stop flag'});releaseKernelTab(orca,store,state,{cwd,reason:'paused by stop flag'});store.saveState(state);return state;}
    applyInbox(store,state,ctx);
    if(state.restartRequested){const reason=state.restartRequested;state.restartRequested=null;store.appendEvent({event:'stopped',reason:`restart: ${reason}`});store.saveState(state);return state;}
    if(state.buildStamp&&buildStamp()&&buildStamp()!==state.buildStamp){store.appendEvent({event:'build-changed',from:state.buildStamp,to:buildStamp()});store.appendEvent({event:'stopped',reason:'build changed'});store.saveState(state);return state;}
    state.iterations+=1;
    store.appendEvent({event:'tick',iteration:state.iterations,
      ops:state.ops.map(op=>`${op.id}=${op.status}`),ledger:state.ledger.map(item=>`${item.id}=${item.status}`)});
    answerQuestions(orca,store,state,ctx);
    refuseForeignShared(store,state,{...ctx,orca});
    readmitCooled(store,state,ctx);
    resumePaused(store,state);
    drainSharedQueue(store,state);
    if(guardedStage(store,state,ctx,'sync',()=>{syncLedgerOps(store,state,ctx);planVerifyOps(store,state,ctx);})==='stop')break;
    if(guardedStage(store,state,ctx,'schedule',()=>scheduleOps(orca,store,state,ctx))==='stop')break;
    state.allocation=typeof allocator.serialize==='function'?allocator.serialize():allocator.snapshot?.()??null;
    // A provider limit another kernel ran into is this kernel's limit too; it is recorded once, when it is learned.
    for(const notice of allocator.takeSharedNotices?.()??[])
      store.appendEvent({event:'runtime-cooling-shared',runtime:notice.runtime,until:notice.until,wakeAt:notice.wakeAt,from:notice.from,reason:notice.reason??null});
    const running=state.ops.filter(op=>op.status==='running');
    // Fast path: an operation whose report is already on disk is accepted before any blocking wait.
    let early=null;
    if(guardedStage(store,state,ctx,'accept',()=>{early=acceptReports(orca,store,state,ctx);})==='stop')break;
    if(Array.isArray(early)&&early.length){store.appendEvent({event:'accepted-early',ops:early.map(item=>item.op)});store.saveState(state);continue;}
    if(running.length){
      const tick=waitTick(orca,{cwd:state.worktree,run:state.run,from:state.from,timeoutMs:waitTimeoutMs,tickMs,
        reportsDir:store.paths.reports,now,wait,wake:()=>inboxPending(store)||stopRequested(store)});
      if(tick.event==='check-failed'){noteAnomaly(store,state,`check-failed:${tick.check?.reason??'unknown'}`,{reason:tick.check?.reason??null});triageAnomaly(store,state,`check-failed:${tick.check?.reason??'unknown'}`,{...ctx,orca});}
    store.appendEvent({event:'wait',result:tick.event,ticks:tick.ticks,
        liveness:(tick.liveness??[]).map(item=>`${item.dispatch}:${item.liveness}`)});
      if(guardedStage(store,state,ctx,'accept',()=>acceptReports(orca,store,state,ctx))==='stop')break;
      settleStalled(orca,store,state,ctx,tick);
      store.saveState(state);
      continue;
    }
    if(state.ops.some(op=>liveStatus.includes(op.status))){
      // Nothing could be launched and nothing is running: every runtime is busy, cooling or out of budget.
      state.stalls+=1;
      state.stalledSince=state.stalledSince??now();
      store.appendEvent({event:'stalled',stalls:state.stalls,since:state.stalledSince,allocation:state.allocation});
      if(now()-state.stalledSince>=STALL_MS){
        state.needUser.push({kind:'environment',detail:`no runtime accepted an operation for ${Math.round((now()-state.stalledSince)/60000)} minutes (${state.stalls} attempts)`});
        finish(store,state,'blocked','no runtime accepted an operation',ctx);
        break;
      }
      store.saveState(state);
      wait(pollMs);
      continue;
    }
    const gate=runGates(store,state,ctx);
    if(gate.ok){
      const unverified=state.ledger.filter(item=>!['verified','preexisting'].includes(item.status));
      if(unverified.length)state.needUser.push({kind:'ledger',detail:`never verified: ${unverified.map(item=>`${item.id} (${item.status})`).join(', ')}`});
      finish(store,state,state.needUser.length?'blocked':'done',state.needUser.length?'the policy could not settle every goal item':null,ctx);
      break;
    }
    if(!gate.repaired){finish(store,state,'blocked','the job gates still fail',ctx);break;}
    store.saveState(state);
  }
  store.saveState(state);
  return state;
}

/* ------------------------------------------------------------------ cli */

/** Wait for the launch handle the terminal's creator writes (own handle, optional Orca run). */
export function awaitLaunch(file,{wait=sleepSync,timeoutMs=LAUNCH_WAIT_MS,intervalMs=2000,now=Date.now}={}){
  const started=now();
  for(;;){
    const launch=readJson(file,null);
    if(launch?.from)return launch;
    need(now()-started<=timeoutMs,`No launch handle in ${slash(file)} within ${timeoutMs} ms; pass --from <own terminal>`);
    wait(intervalMs);
  }
}

const hostOf=(options,repoRoot)=>path.resolve(options.host??path.join(repoRoot,'.claude'));
const launcherOf=host=>slash(path.join(host,'.dist','hosts','orca','launch.mjs'));
const templateOf=host=>fs.readFileSync(path.join(host,'docs','supervision-templates','op.md'),'utf8');

/** One kernel per workflow: a pid lock in the store refuses a second process; a stop flag ends the loop cleanly. */
function acquireKernelLock(store){
  const lock=path.join(store.dir,'kernel.lock');
  const existing=(()=>{try{return JSON.parse(fs.readFileSync(lock,'utf8'));}catch{return null;}})();
  if(existing?.pid&&existing.pid!==process.pid){
    let alive=false;try{process.kill(existing.pid,0);alive=true;}catch{alive=false;}
    need(!alive,`Another kernel (pid ${existing.pid}) already runs workflow ${store.id}; run workflow-stop first`);
  }
  fs.writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:Date.now()}));
  return ()=>{try{const now=JSON.parse(fs.readFileSync(lock,'utf8'));if(now.pid===process.pid)fs.rmSync(lock);}catch{}};
}
export function stopRequested(store){return fs.existsSync(path.join(store.dir,'stop.flag'));}
/** Whether a command waits in the inbox: the wait between ticks ends for it. */
export function inboxPending(store){try{return fs.readdirSync(store.paths.inbox).some(name=>name.endsWith('.json'));}catch{return false;}}
/** Whether the kernel of this store is a live process, by its lock. */
export function kernelAlive(store){
  const lock=readJson(path.join(store.dir,'kernel.lock'),null);
  const pid=Number(lock?.pid);
  if(!Number.isInteger(pid)||pid<=0)return false;
  try{process.kill(pid,0);return true;}catch{return false;}
}
/**
 * A command for a running kernel is a file in the store's inbox, never a write to its state: the kernel holds
 * the state in memory and would save over the change at its next tick. The kernel applies inbox commands at the
 * start of every iteration, in order, and records each (`inbox-applied`).
 */
export function queueInbox(store,command){
  const file=path.join(store.paths.inbox,`${Date.now()}-${Math.random().toString(16).slice(2,8)}.json`);
  fs.writeFileSync(file,JSON.stringify({...command,at:new Date().toISOString()}));
  return file;
}
function applyInbox(store,state,ctx){
  let files=[];
  try{files=fs.readdirSync(store.paths.inbox).filter(name=>name.endsWith('.json')).sort();}catch{return;}
  for(const name of files){
    const file=path.join(store.paths.inbox,name);
    let command=null;
    try{command=JSON.parse(fs.readFileSync(file,'utf8'));}catch{command=null;}
    try{fs.rmSync(file,{force:true});}catch{}
    if(!plain(command))continue;
    if(command.kind==='approve'){
      const before={budget:dynamicBudget(state),quota:JSON.stringify(state.quota??null)};
      approve(store,state,{allocation:command.allocation??null,allowDynamic:command.allowDynamic??null,acceptCritique:command.acceptCritique??null,host:ctx.host});
      const quotaChanged=JSON.stringify(state.quota??null)!==before.quota;
      store.appendEvent({event:'inbox-applied',kind:'approve',allocation:command.allocation??null,allowDynamic:command.allowDynamic??null,budget:{from:before.budget,to:dynamicBudget(state)},quotaChanged});
      // The allocator was built from the quota at start: a new allocation takes effect at the next kernel start,
      // which the supervisor gives within a minute once this loop returns.
      if(quotaChanged)state.restartRequested='allocation changed';
    }else if(command.kind==='answer'){
      try{const answered=answerOwnerQuestion(store,state,{op:command.op,choice:command.choice??null,note:command.note??null});store.appendEvent({event:'inbox-applied',kind:'answer',ask:answered.ask});}
      catch(error){store.appendEvent({event:'inbox-rejected',kind:'answer',reason:String(error?.message??error)});}
    }else store.appendEvent({event:'inbox-ignored',kind:command.kind??null});
  }
}
/**
 * The kernel loads its code once; a rebuild of the runtime is a new kernel. Every tick compares the module's
 * modification time with the one recorded at start, and a change ends the loop cleanly (`build-changed`) so the
 * supervisor starts the new code within a minute - no stop flag, no hand restart.
 */
const KERNEL_MODULE=(()=>{try{return new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1');}catch{return null;}})();
export function buildStamp(){try{return KERNEL_MODULE?Math.round(fs.statSync(KERNEL_MODULE).mtimeMs):null;}catch{return null;}}

export function kernelMain(command,options={},{orca,cwd=process.cwd(),wait=sleepSync,functions={}}={}){
  const worktree=path.resolve(cwd);
  const repoRoot=repositoryRoot(worktree);
  // The ledger a job works decides where its own runtime state lives too: a repository that shares another
  // repository's Work tree keeps no `.starciwork` of its own, so the workflow directory belongs to the owner.
  const routedLedger=()=>{try{return resolveLedgerRoot({repoRoot:worktree,host:hostOf(options,repoRoot),options});}catch{return null;}};
  const storeRootFor=id=>{
    if(fs.existsSync(path.join(workflowsRoot(repoRoot),id,'state.json')))return repoRoot;
    const resolved=routedLedger();
    return resolved?.sharedLedger&&fs.existsSync(path.join(workflowsRoot(resolved.ownerRepoRoot),id,'state.json'))
      ?resolved.ownerRepoRoot:repoRoot;
  };
  const open=id=>{
    const workflowId=required(id,'workflow id');
    const store=createStore({repoRoot:storeRootFor(workflowId),id:workflowId});
    const state=store.loadState();
    need(plain(state)&&state.kernel===WORKFLOW_KERNEL,`No workflow kernel state in ${slash(store.dir)}`);
    // A state written before the ledger mode existed resumes as a plan-ledger workflow.
    state.ledgerMode=LEDGER_MODES.includes(state.ledgerMode)?state.ledgerMode:'plan';
    state.scope=Array.isArray(state.scope)?state.scope:[];
    state.decisions=Array.isArray(state.decisions)?state.decisions:[];
    // A state written before lanes existed resumes with none: its nodes keep the single-step behaviour.
    state.lanes=plain(state.lanes)?state.lanes:{};
    // Ledger root = the worktree (branch content); the store root above = the main repository (history).
    state.repoRoot=state.repoRoot??worktree;
    if(options.allocation)state.quota=parseQuota(options.allocation);
    return {store,state};
  };
  if(command==='workflow-goal'){
    const job=required(options.job,'job');
    const host=hostOf(options,repoRoot);
    const id=options.id??newWorkflowId(job);
    // `--lane` makes this workflow its own Orca worktree row, cut from the branch this command runs on. The id is
    // decided first, because it names both the lane and the row the owner reads.
    const lane=options.lane===undefined||options.lane===false||options.lane==='false'?null:(()=>{
      const owner=laneOwnerOf([repoRoot,(()=>{try{return routedLedger()?.ownerRepoRoot??null;}catch{return null;}})()],worktree);
      need(!owner,`${slash(worktree)} is already the lane of workflow ${owner?.id}; a lane never opens a lane of its own - run workflow-goal --lane from the base worktree`);
      return openLane(orca,{id,name:laneNameOf(options.lane,id),repoRoot,base:worktree,baseBranch:currentBranch(worktree),cwd:worktree});
    })();
    // Everything below resolves against the tree this workflow actually runs in: the lane when it has one.
    const code=lane?lane.worktree:worktree;
    // Resolved before the store exists, because a shared ledger moves the workflow directory into its owner.
    const ledger=resolveLedgerRoot({repoRoot:code,host,options});
    const store=createStore({repoRoot:ledger.sharedLedger?ledger.ownerRepoRoot:repoRoot,id});
    const ledgerMode=detectLedgerMode(code,options.ledger??null,ledger.exists?ledger.ledgerRoot:null);
    const state=createWorkflowState({job,inputs:csv(options.inputs),worktree:code,branch:lane?lane.branch:currentBranch(code),
      gates:csv(options.gates),store,host,launcher:launcherOf(host),ledgerMode,scope:csv(options.scope),reintake:csv(options.reintake),repoRoot:code,lane,
      ledgerRoot:ledger.exists?ledger.ledgerRoot:null,ledgerShared:ledger.sharedLedger,ledgerSource:ledger.source,
      codeRole:ledger.role,codeSide:ledger.side,
      ledgerOwner:ledger.exists?{repoRoot:ledger.ownerRepoRoot,repository:ledger.ownerRepository,role:ledger.ownerRole,project:ledger.project}:null});
    if(options.allocation)state.quota=parseQuota(options.allocation);
    store.appendEvent({event:'created',job,inputs:state.inputs,worktree:slash(code),branch:state.branch,
      ledgerMode,scope:state.scope,ledgerRoot:slash(ledger.ledgerRoot),ledgerSource:ledger.source,
      ...(lane?{lane:lane.name}:{}),
      ...(ledger.sharedLedger?{'ledger-shared':{owner:ledger.ownerRepository??slash(ledger.ownerRepoRoot),root:slash(ledger.ledgerRoot)}}:{})});
    if(lane)store.appendEvent({event:'lane-created',name:lane.name,worktree:slash(lane.worktree),branch:lane.branch,
      orcaId:lane.orcaId,base:{worktree:slash(lane.base.worktree),branch:lane.base.branch},row:laneRowTitle(id)});
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,
      ...goalPhase(store,state,{cwd:code,ledgerRoot:options['ledger-root']??null,...functions})};
  }
  if(command==='workflow-lane-close'){
    const {store,state}=open(options.id);
    need(plain(state.lane),`Workflow ${state.id} has no lane: there is no worktree of its own to close`);
    need(!kernelAlive(store),`The kernel of ${state.id} is still running; run workflow-stop --id ${state.id} first`);
    if(plain(state.lane.closed))return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,lane:laneView(state),closed:true,
      next:'the lane was already closed; its branch is preserved'};
    need(plain(state.lane.merged),`The lane ${state.lane.name} of ${state.id} is not merged into ${state.lane.base?.branch} yet; a lane is closed only after it went home`);
    need(plain(orca)&&typeof orca.invoke==='function','workflow-lane-close needs an Orca runner: the lane is an Orca worktree');
    const removed=orca.invoke('worktree-rm',{worktree:`path:${slash(state.lane.worktree)}`,force:true},
      {cwd:fs.existsSync(state.lane.base?.worktree??'')?state.lane.base.worktree:worktree});
    need(removed.outcome==='ok',`orca worktree rm ${slash(state.lane.worktree)} failed (${removed.effectState??'unknown'}): ${removed.reason??'no reason'}`);
    state.lane.closed={at:Date.now(),preservedBranch:laneBranchRef(getPath(removed.receipt,'result.preservedBranch'))||state.lane.branch};
    store.appendEvent({event:'lane-closed',name:state.lane.name,worktree:slash(state.lane.worktree),
      branch:state.lane.branch,preservedBranch:state.lane.closed.preservedBranch});
    store.saveState(state);
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,lane:laneView(state),closed:true,
      next:`the worktree is gone and branch ${state.lane.closed.preservedBranch} is preserved`};
  }
  if(command==='workflow-stop'){
    const {store}=open(options.id);
    fs.writeFileSync(path.join(store.dir,'stop.flag'),String(Date.now()));
    return {schema:WORKFLOW_KERNEL,command,id:options.id,dir:store.dir,stopRequested:true,next:'the running kernel exits at its next iteration (at most one wait tick); workflow-run resumes from state.json'};
  }
  if(command==='workflow-approve'){
    const {store,state}=open(options.id);
    // A live kernel owns the state: the command is queued in its inbox and applied at its next tick.
    if(state.approved&&kernelAlive(store)){
      const file=queueInbox(store,{kind:'approve',allocation:options.allocation??null,allowDynamic:options['allow-dynamic']??null,
        acceptCritique:options['accept-critique']??null});
      return {schema:WORKFLOW_KERNEL,command,dir:store.dir,id:state.id,queued:true,inbox:file,
        next:'the running kernel applies this at its next iteration (event inbox-applied); a new allocation restarts the kernel through the supervisor'};
    }
    return {schema:WORKFLOW_KERNEL,command,dir:store.dir,
      ...approve(store,state,{allocation:options.allocation??null,allowDynamic:options['allow-dynamic']??null,
        acceptCritique:options['accept-critique']??null,host:hostDescriptorOf(orca)})};
  }
  if(command==='workflow-answer'){
    const {store,state}=open(options.id);
    need(options.op,'workflow-answer needs --op <owner-ask op id>');
    if(state.approved&&kernelAlive(store)){
      const file=queueInbox(store,{kind:'answer',op:options.op,choice:options.choice??null,note:options.note??null});
      return {schema:WORKFLOW_KERNEL,command,dir:store.dir,id:state.id,queued:true,inbox:file,next:'the running kernel delivers the answer at its next tick (event owner-answered)'};
    }
    const answered=answerOwnerQuestion(store,state,{op:options.op,choice:options.choice??null,note:options.note??null});
    store.saveState(state);
    return {schema:WORKFLOW_KERNEL,command,dir:store.dir,id:state.id,...answered,next:'approve or start the workflow again: the paused operation carries the answer in its next contract'};
  }
  if(command==='workflow-status'){
    const {store,state}=open(options.id);
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:state.phase,approved:state.approved,
      iterations:state.iterations,head:state.head,ledgerMode:state.ledgerMode,scope:state.scope,hostAdapter:state.hostAdapter??null,
      worktree:slash(state.worktree),branch:state.branch,lane:laneView(state),
      ledgerRoot:state.ledgerRoot?slash(state.ledgerRoot):null,ledgerSource:state.ledgerSource??null,
      ledgerShared:Boolean(state.ledgerShared),ledgerOwner:state.ledgerOwner??null,codeSide:state.codeSide??null,
      ledgerSummary:state.ledgerSummary,decisions:state.decisions,brand:state.brand??null,preflight:state.preflight??null,
      critique:state.critique??null,critiqueOverride:state.critiqueOverride??null,
      dynamicOps:state.dynamicOps??0,dynamicOpsBudget:dynamicBudget(state),sharedQueue:state.sharedQueue??[],
      ledger:state.ledger.map(item=>({id:item.id,status:item.status,title:item.title,evidence:item.evidence})),
      ops:state.ops.map(op=>({id:op.id,kind:op.kind,status:op.status,runtime:op.runtime,attempt:op.attempt})),
      // Per node: the lane it travels and how much of it is accepted - `lane: 2/3` is the line a user reads.
      lanes:Object.fromEntries(Object.entries(state.lanes??{}).map(([node,entry])=>
        [node,{lane:laneText(laneWalked(entry)),done:[...(entry.done??[])],skipped:[...(entry.skipped??[])],progress:laneProgress(entry)}])),
      workNodes:state.ops.filter(op=>op.nodeId).map(op=>({op:op.id,node:op.nodeId,status:op.status,kind:op.kind,
        lane:laneText(laneWalked(state.lanes?.[op.nodeId]))||null,progress:laneProgress(state.lanes?.[op.nodeId])})),
      gates:state.gateResults,needUser:state.needUser,finished:state.finished,
      events:store.readEvents().slice(-20),final:readJson(store.paths.final,null)};
  }
  if(command==='workflow-run'){
    const {store,state}=open(options.id);
    need(state.approved,`Workflow ${state.id} is not approved yet; run workflow-approve --id ${state.id}`);
    const host=hostDescriptorOf(orca);
    // A host that keeps files (the headless table, mailbox and dispatch logs) keeps them beside this workflow's own.
    if(typeof orca?.bindStore==='function')orca.bindStore(store.dir);
    // The supervisor starts the next kernel of this workflow on the same host, so the host is a fact of the state.
    state.hostAdapter=host.name;
    const launchFile=options['launch-file']?path.resolve(worktree,options['launch-file']):store.paths.launch;
    let from=options.from??state.from,run=options.run??state.run;
    if(!from&&fs.existsSync(launchFile)){const launch=awaitLaunch(launchFile,{wait});from=launch.from;run=run??launch.run??null;state.workflowTask=launch.task??state.workflowTask;}
    if(!from){
      // No coordinator terminal handed this kernel a handle (the supervisor started it): the kernel is its own
      // Orca terminal in the worktree - the one titled after it, reused across restarts, never a new tab per start.
      from=ownKernelTerminal(orca,store,state,worktree);
      state.kernelTerminalOwned=true;
    }
    state.from=required(from,'own terminal handle');
    // `run-bound` is the one-time hand-off this kernel performed; joining a run it already has is `run-resumed`.
    const binding=!run;
    state.run=run??bindRun(orca,{cwd:worktree,state,from:state.from});
    if(!binding)rebindRunIfNeeded(orca,store,state,{cwd:worktree});
    state.host=state.host??hostOf(options,repoRoot);
    state.launcher=state.launcher??launcherOf(state.host);
    store.appendEvent({event:binding?'run-bound':'run-resumed',run:state.run,from:state.from,iterations:state.iterations});
    const finished=(()=>{const release=acquireKernelLock(store);try{fs.rmSync(path.join(store.dir,'stop.flag'),{force:true});return runLoop(orca,store,state,{cwd:worktree,wait,
      // Slots are derived from the operations that are actually running; saved loads may belong to a dead kernel.
      supervisor:supervisorRuntimes(state.host),validator:validatorRuntimes(state.host),
      // Every kernel of this repository shares one runtime ledger beside the workflow directories, so an
      // expensive runtime another workflow is on is load here too and a provider cooldown is seen by all.
      // A sequential host (headless) caps the allocator at one operation whatever the approved quota says.
      allocator:createAllocator({runtimes:withSupervisorPreference(loadRuntimes(),supervisorRuntimes(state.host)),state:{...(state.allocation??{}),loads:Object.fromEntries(Object.entries(state.ops.filter(op=>op.status==='running'&&op.runtime).reduce((acc,op)=>{acc[op.runtime]=(acc[op.runtime]??0)+1;return acc;},{})))},quota:state.quota??null,shared:{path:loadsFileFor(store.dir),workflow:state.id},budget:{path:path.dirname(store.dir)},sequential:host.sequential}),template:templateOf(state.host),host,
      ledgerRoot:options['ledger-root']??null,
      maxIterations:options['max-iterations']?Number(options['max-iterations']):Infinity,...functions});}finally{release();}})()
    // The kernel's own tab is the Run's coordinator terminal, so it lives as long as the workflow: a pause or a
    // rebuild leaves it for the next start to reuse (a new tab would have to re-bind the Run and fence every live
    // Dispatch). A finished workflow closes it: nobody reads it any more.
    if(finished.finished&&state.kernelTerminalOwned&&state.from){try{orca.invoke('terminal-close',{terminal:state.from},{cwd:worktree});}catch{}store.appendEvent({event:'kernel-terminal-closed',terminal:state.from});state.from=null;state.kernelTerminalOwned=false;store.saveState(state);}
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:finished.phase,ledgerMode:finished.ledgerMode,
      finished:finished.finished,lane:laneView(finished),ledger:finished.ledger.map(item=>`${item.id}=${item.status}`),
      ledgerSummary:finished.ledgerSummary,needUser:finished.needUser,head:finished.head,iterations:finished.iterations,
      ledgerRoot:finished.ledgerRoot?slash(finished.ledgerRoot):null,ledgerShared:Boolean(finished.ledgerShared),
      ledgerOwner:finished.ledgerShared?(finished.ledgerOwner?.repository??slash(finished.ledgerOwner?.repoRoot??'')):null};
  }
  throw Error(`Unsupported workflow kernel command: ${command}`);
}

// The CLI surface is the canonical launcher (`hosts/orca/launch.mjs workflow-goal|workflow-approve|
// workflow-run|workflow-status`), which routes straight into kernelMain; this module stays import-only.
