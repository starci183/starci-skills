import fs from 'node:fs';
import crypto from 'node:crypto';
import {createV6Runtime,enrollV6,isV6,isJobPending,settleGenerationLeases,prepareGenerationRetry} from './runtime-v6.mjs';
import {applyOwnerInbox} from './owner-inbox.mjs';
import {verifyAcceptedIntegrationOwnerRequests} from './owner-requests.mjs';
import {verifyRuntimePin} from './runtime-pin.mjs';
import {freshRuntimeBudget,probeRuntimeBudget} from './budget.mjs';
import {acquireStartup,releaseStartup} from './startup-lock.mjs';
import {createWorkflowModelEligibility} from './model-policy.mjs';
import {openJournal} from './journal.mjs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {skillRoot} from '../core/runtime-root.mjs';
import {getPath} from '../hosts/orca/calls.mjs';
import {waitTick} from '../hosts/orca/protocol.mjs';
import {buildOperationLaunch,notifyTerminal,settleDispatch,startOperation,sweepWorktree} from '../hosts/orca/launch.mjs';
import {buildReport,validateReport} from './reports.mjs';
import {TAB_READ_LIMIT,classifyTab} from './tab.mjs';
import {WORKFLOW_STATE,createStore,newWorkflowId,repositoryRoot,workflowsRoot} from './store.mjs';
import {grammarRepository,resolveLedgerRoot,sharedLedgerStatus} from './routing.mjs';
import {createAllocator,loadRuntimes} from './schedule.mjs';
import {loadsFileFor} from './loads.mjs';
import {planProtectedProof,proofFinding,proofPlan,protectedProofFinding,runAtBase,runProtectedProof} from '../checks/proof.mjs';
import {evaluateAcceptance,kernelVerificationReceipt,resolveEvidencePacket} from '../checks/acceptance.mjs';
import {protectedOracleManifest} from './candidate-bridge.mjs';
import {prepareCandidateIntegration} from './candidates.mjs';
import {buildManagerSnapshot,validateManagerDecision,managerProgressDigest} from './manager.mjs';
import {stepsFor} from './contract.mjs';
import * as work from './ledger.mjs';
import * as llm from '../models/functions.mjs';
import * as graph from './graph.mjs';

import {AUTHOR_KIND,PLAN_KIND,AUTHORS_RECORD,authorsRecord,BRAND_DECIDE,BRAND_KIND,CHECK_TIMEOUT_MS,DYNAMIC_OPS_BUDGET,FINAL_REPORT,GATE_ROUNDS,GOAL_RECORD,
  KERNEL_CHECK,LAUNCH_LIMIT,LAUNCH_OPERATOR,LAUNCH_WAIT_MS,LEDGER_MODES,POLL_MS,RATE_LIMIT_WINDOW_MS,RECORD_OWNED,
  RESTART_LIMIT,RESUME_LIMIT,RETRY_LIMIT,SHARED_OPS_PER_ITERATION,SILENCE_LIMIT,STALL_MS,VALIDATOR_REJECT_LIMIT,
  VALIDATOR_UNAVAILABLE_LIMIT,VERIFY_ROUNDS,WORKFLOW_KERNEL,WORK_LEDGER,WORK_OPERATION,DECISION_OPERATION,
  addOp,allowlistsOverlap,buildScope,byId,clockOf,covers,csv,currentBranch,describeNode,detectLedgerMode,dynamicBudget,firstLine,
  countsAgainstBudget,grammarReferences,hostDescriptorOf,hostMissing,inScopePath,inside,jobRulings,kernelGuards,kindRole,
  launchOperator,ledgerBinding,ledgerItem,liveStatus,locateSharedTreePaths,need,nextId,normalize,parseGate,parseQuota,
  parseRef,pathsIn,plain,readJson,reportAllowlist,required,routeKind,routeOf,routed,rulingsText,slash,sleepSync,runCommand,
  tail,toOp,unique,validateCommandAt,workModule,workOpId,workValidateCommand,writeJson} from './common.mjs';
import {ioBlock,kindsReadingBrand,undeclaredWrites,writesWorkRecords} from './io.mjs';
import {readDistJson} from '../core/runtime-root.mjs';
import {loadConfig,nonOperationModels} from '../scripts/config.mjs';
import {recordDigests,reconcileIntake} from './reconciliation.mjs';
import {renderChecksFor} from '../checks/render.mjs';
import {laneOwnerOf,laneNameOf,laneRowTitle,laneView,openLane,settleLane,laneBranchRef} from './lanes.mjs';
import {INFRA_RESTART_LIMIT,RECONCILE_EVERY,SWEEP_MS,TAB_STATUSES,bindRun,closeOpTerminal,listTerminals,ownKernelTerminal,rebindRunIfNeeded,
  recoverCoordinatorTab,reconcileWithOrca,releaseKernelTab,siblingKernelGone,sweepStaleTerminals} from './terminals.mjs';
import {DECISION_PREPARE,PROVISION_ASK,STOP_KINDS,isAsk,openConflictDecision,answerCommand,answerOrEscalate,answerOwnerQuestion,continueOwnerRequest,dedupeNeedUser,inheritProvisional,
  openOwnerAsk,provisionalLines,redactSecrets,settleOwnerAsk,stopReasonFor,
  mechanicalOwnerLine,noteOwnerList,ownerItems,ownerLines,waitsForOwner} from './owner.mjs';
import {askFillLine,credentialAsked,fillCommand,fillWaitingAsks,inputReadyAsks,ownerFillLines,settleFilledAsks} from './fill.mjs';
import {reconcileWorkflowInputs,recoverWorkflowInputReferences} from './inputs.mjs';
import {reconcileCanonicalDecisionInputs} from './decision-inputs.mjs';
import {INTEGRATION_RESEARCH_ORDER,integrationReadiness,prepareCredentialAsk,preparationFingerprint,relatedIntegrations} from './inputs-readiness.mjs';
import {snapshotCredentialVersions,credentialReplacementFor} from './inputs-replacement.mjs';
import {BRAND_PAYLOAD,attributedFiles,brandAware,brandFields,brandOf,brandPayload,brandReferencesOf,brandSummary,changedFiles,
  kernelProof,machineVerify,noteBrand,opDiff,provenChecks,readValidatorMemory,recordVerdict,renderValidatorMemory,
  rereadBrand,sharedCheckCommand,treeForVerdict,treeVerdictFor,validateAccepted,validatorRejectLimit} from './verify.mjs';
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
  DYNAMIC_OPS_BUDGET,VALIDATOR_REJECT_LIMIT,VALIDATOR_UNAVAILABLE_LIMIT,allowlistsOverlap,buildScope,kernelGuards,
  currentBranch,detectLedgerMode,ledgerBinding,dynamicBudget,hostDescriptorOf,hostMissing,parseQuota,
  reportAllowlist,workOpId,workModule,grammarReferences};
export {laneRowTitle,LANE_NAME,laneNameOf,laneOwnerOf,openLane,laneView} from './lanes.mjs';
export {TAB_READ_LIMIT,TAB_VERDICTS,TAB_WINDOW,classifyTab,contractTrace} from './tab.mjs';
export {INFRA_RESTART_LIMIT,RECONCILE_EVERY,SWEEP_MS,TAB_STATUSES,infrastructureCause,recoverCoordinatorTab,reconcileWithOrca,rebindRunIfNeeded,
  sweepStaleTerminals} from './terminals.mjs';
export {ASK_KINDS,DECISION_PREPARE,PROVISION_ASK,isAsk,PROVISION_KINDS,QUESTION_KINDS,STOP_KINDS,answerCommand,answerOwnerQuestion,credentialNeed,
  decisionAllowlistFor,dedupeNeedUser,inheritProvisional,irreversibleEffect,openOwnerAsk,ownerProvisionNeed,
  provisionalLines,redactSecrets,stopReasonFor,
  IDENTITY_SET_COMMAND,OWNER_LINE_KINDS,mechanicalOwnerLine,noteOwnerList,ownerDigest,ownerItems,ownerLines,ownerSection,waitsForOwner} from './owner.mjs';
export {askFillLine,credentialAsked,custodyIn,fillCommand,fillWaitingAsks,ownerFillLines,settleCredentialPresence,
  settleFilledAsks,variablesIn} from './fill.mjs';
export {BRAND_PAYLOAD,attributedFiles,brandFields,brandPayload,brandSummary,changedFiles,machineVerify,opDiff,readValidatorMemory,
  renderValidatorMemory,sharedCheckCommand,treeForVerdict,treeVerdictFor,validatorRejectLimit} from './verify.mjs';
export {LANE_LAYOUTS,KERNEL_PLANNED_KINDS,nodeLayout,laneOf,lanePredicates,designRecord,deriveWorkOp,syncLedgerOps,
  kernelOwnedPaths,protectedFingerprint} from './sync.mjs';
export {CUT_ASSERTIONS,CUT_COMPONENTS,CUT_FILES,FAN_OUT,childOwning,cutGroup,cutOp,cutParentOf,cutReason,fanOutDeferral,
  groupIncomplete,groupVerifyKind,repairTarget,sdsComponents,settleCut} from './sync.mjs';
export {CRITIQUE_HEADING,approve,critiqueGoalPhase,critiqueLines,critiqueRuntimes,decidedRecords,goalPhase,
  laneHeaderLines,planGoalPhase,proposeQuota,recordStatements,validateWorkTree,workGoalPhase} from './goal.mjs';
export {ioBlock,ioPayload,kindsReadingBrand,intakeKindFor,decisionKindFor,recordKindOfPath,undeclaredWrites,writesWorkRecords} from './io.mjs';
/**
 * The design grammar and the brand record are read by exactly these kinds. The list is no longer written here:
 * `kindsReadingBrand()` derives it from the kinds profile, and this constant is the snapshot the docs and the
 * tests still name. Every call site asks the function, so a profile that adds a kind is followed without an edit.
 */
export const DESIGN_KINDS=kindsReadingBrand();

/** The whole mutable state of one workflow. `schema` is the store's, so state.json is written atomically by it. */
export function createWorkflowState({job,inputs=[],worktree,branch,gates=[],store,host=null,launcher=null,
  ledgerMode='plan',scope=[],reintake=[],migrate=[],repoRoot=null,ledgerRoot=null,ledgerOwner=null,ledgerSource=null,ledgerShared=false,
  codeRole=null,codeSide=null,lane=null}){
  need(plain(store)&&typeof store.id==='string','A workflow store is required');
  need(LEDGER_MODES.includes(ledgerMode),`Unsupported ledger mode ${ledgerMode}; use ${LEDGER_MODES.join(' or ')}`);
  return {schema:WORKFLOW_STATE,kernel:WORKFLOW_KERNEL,id:store.id,dir:store.dir,
    job:required(job,'job'),inputs:inputs.map(parseRef),worktree:path.resolve(required(worktree,'worktree')),
    branch:required(branch,'branch'),gates:gates.map(parseGate),host,launcher,
    // The worktree above is this workflow's lane when it owns one: the tree it runs in, and the branch that is
    // merged back into `lane.base.branch` when the workflow finishes done.
    lane:plain(lane)?{...lane}:null,
    ledgerMode,scope:[...scope],reintake:[...reintake],migrate:[...migrate],repoRoot:repoRoot?path.resolve(repoRoot):null,
    // The code root is the worktree above; these name the tree the Work itself lives in, which may belong to
    // another repository of the same product.
    ledgerRoot:ledgerRoot?path.resolve(ledgerRoot):null,ledgerOwner:plain(ledgerOwner)?{...ledgerOwner}:null,
    ledgerSource,ledgerShared:Boolean(ledgerShared),codeRole,codeSide,
    // The repositories the binding declares by role, resolved at goal time and on every resume; `grammar` is the
    // one the kernel routes to itself, and null here means this workflow may not change the grammar.
    ledgerRoles:null,
    run:null,from:null,workflowTask:null,phase:'goal',approved:false,
    definitionOfDone:[],risks:[],questions:[],ledger:[],ops:[],needUser:[],gateResults:[],verifyRounds:{},gateRounds:0,
    // Decisions the runtime took on its own recommendation so the work could continue. They are NOT `needUser`:
    // the workflow may finish `done` over them, and the owner's different answer is what reopens what rests on one.
    provisional:[],
    // The last findings per reviewed group, and how often that group's review was escalated inside the runtime today.
    verifyFindings:{},verifyEscalations:{},
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
const implementsLedger=op=>op.kind!=='review.verify'&&op.refusal!=='superseded'&&(op.ledgerIds??[]).length>0;

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
  const credentialRequestFile=checksFile.replace(/\.json$/,'.credential-request.json');
  const reportsDir=slash(store.paths.reports);
  const items=(op.ledgerIds??[]).map(id=>{const item=ledgerItem(state,id);return `- \`${id}\` ${item?.title??'(unknown goal item)'}${item?.inputRef?` - ${item.inputRef}`:''}`;});
  const locks=guards.resourceLocks(op);
  const owned=protectedPaths??op.kernelOwned??[];
  const sections=[
    `# Operation contract - \`${op.kind}\` - op \`${op.id}\` - attempt ${op.attempt}`,``,
    `Runtime StarCi ${isV6(state)?state.engine.version:'5.0'}. One worktree \`${slash(state.worktree)}\` on branch \`${state.branch}\`. ${isV6(state)?'The kernel serializes native writers and independently verifies a frozen copy of your observed changes. This host detects write drift but does not enforce an OS sandbox.':'Other operations are running beside you in this same worktree:'} Never touch a path outside your allowlist, never commit, never switch branches. Your Task id, Dispatch id and terminal handle are in the dispatch preamble.`,``,
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
    ...(state.ledgerShared&&(state.ledgerRoot||state.ledgerOwner?.repoRoot)?[`## Where the Work tree lives`,
      `This repository shares the Work tree of ${state.ledgerOwner?.repository??'its backend'}: the one tree is \`${slash(state.ledgerRoot??path.join(state.ledgerOwner.repoRoot,'.starciwork'))}\`. Every record, candidate and asset goes there, at the absolute paths the allowlist names; a \`.starciwork\` folder created in this worktree is the wrong tree and is a defect.`,``]:[]),
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
    `The kernel re-runs these exact commands itself after your report and computes your changed files from git: a \`done\` the machine cannot reproduce is downgraded to \`failed\` and comes back to you.`,
    `An error the whole-tree validator reports under a path outside your allowlist is not yours: name it in your summary and report as if that check passed for your files. The kernel judges the tree by what you could have caused, never by a red corner another workflow owns.`,``,
    `## Report (exactly once, at the end)`,
    `\`node ${launcher} report --run ${run} --from <your terminal> --task <op task> --dispatch <your dispatch> --reports-dir ${reportsDir} --outcome done|partial|failed|ask|blocked --summary "<what you did, what the checks showed, what is left>" --files <comma-separated changed paths> --checks-file ${checksFile} [--open "<item>,<item>"] [--question "<text>" --options "a,b"] [--blocker shared-change|srs-gap|sds-gap|interface-gap|brand-gap|grammar-gap|environment|authority:<detail>] [--credential-request-file <safe JSON>]\``,
    `- \`done\` needs every check exiting 0 and no open item; otherwise report \`partial\` (with \`--open\`) or \`failed\`.`,
    `- Only an \`integration.verify\` whose declared live check explicitly rejected a credential as invalid or expired may report \`blocked\` \`environment\` with \`--credential-request-file ${credentialRequestFile}\`. Writing this nonsecret report artifact beside your checks file is permitted. The file is exactly \`{"reason":"invalid|expired","variables":["DECLARED_VARIABLE"],"check":"declared-failed-check"}\`, using one actual reason. The named check must have a nonzero exit and safe observed evidence, with its declared command. Never include values, custody paths or a baseline; the kernel binds the request to the exact tested custody version. Other provider failures keep their actual failure path.`,
    `- \`ask\` pauses you until the kernel answers in this terminal; then continue and report again.`,
    `- The command must print \`ok:true\`. Never report twice; never exit without reporting.`,``,
    never
  ];
  let contract=`${sections.join('\n').replace(/\n{3,}/g,'\n\n')}\n`;
  if(isV6(state))contract=contract.replaceAll('reverts the file if they moved and downgrades your report to `failed`','quarantines the changed bytes if they moved and refuses acceptance');
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

export function candidateReferences(op,state,ctx){
  const repo=path.resolve(state.worktree),workRoot=ctx.work?.ledger?.workRoot??path.join(repo,'.starciwork'),owner=ctx.work?.ledger?.repoRoot??repo;
  if(path.resolve(owner)!==repo||path.relative(repo,path.resolve(workRoot)).startsWith('..'))throw new Error('v6 candidate cannot yet bind references from an external shared Work ledger');
  const nodes=ctx.work?.loaded?.nodes,list=ctx.work?.loaded?.list??[];
  return (op.references??[]).map(value=>{const parsed=parseRef(value),literal=slash(parsed.ref),at=literal.indexOf('#'),key=at<0?literal:literal.slice(0,at),fragment=at<0?'':literal.slice(at);
    let relative=null;
    const node=nodes?.get?.(key)??list.find(item=>item.id===key||item.path===key);
    if(node?.path)relative=slash(path.relative(repo,path.join(workRoot,node.path)));
    else {const workDirect=path.resolve(workRoot,key),workBack=path.relative(path.resolve(workRoot),workDirect);
      if(!workBack.startsWith('..')&&!path.isAbsolute(workBack)&&fs.existsSync(workDirect))relative=slash(path.relative(repo,workDirect));
      else {const direct=path.resolve(repo,key);if(!path.relative(repo,direct).startsWith('..')&&fs.existsSync(direct))relative=slash(path.relative(repo,direct));}}
    if(!relative)throw new Error(`candidate reference is not resolved by the loaded Work tree or repository: ${key}`);
    return {kind:parsed.kind,ref:`${relative}${fragment}`,sourceRef:literal};});
}

export function resetReviewEpoch(store,state,priorGeneration=state.engine?.generation??0){
  const superseded=[];
  const historical={generation:priorGeneration,rounds:structuredClone(state.verifyRounds??{}),findings:structuredClone(state.verifyFindings??{}),escalations:structuredClone(state.verifyEscalations??{})};
  state.reviewEpochs=[...(state.reviewEpochs??[]),historical];
  for(const repair of state.ops.filter(item=>item.origin==='repair'&&item.status==='paused'&&item.waitingFor&&!item.reports?.length&&!item.dispatch&&!item.terminal)){
    const ask=byId(state,repair.waitingFor);
    const key=componentKey(repair.ledgerIds??[]),legacyBound=repair.reviewGeneration===undefined&&repair.contractBytes===0&&
      JSON.stringify(repair.findings??[])===JSON.stringify(state.verifyFindings?.[key]??[]);
    const referenced=state.ops.some(item=>item.id!==repair.id&&item.id!==ask?.id&&((item.dependsOn??[]).includes(ask?.id)||item.waitingFor===ask?.id));
    const ownerEvidence=repair.answer!==undefined||ask?.answer!==undefined||ask?.ownerAnswer!==undefined||ask?.ownerContinuationReceipt!==undefined||
      (repair.ownerContinuationReceipts??[]).length>0||(ask?.ownerContinuationReceipts??[]).length>0;
    if(!(repair.reviewGeneration===priorGeneration||legacyBound)||!ask||!['pending','ready'].includes(ask.status)||ask.reports?.length||ask.dispatch||ask.terminal||
      ask.question?.from!==repair.id||ask.question?.prepared!==true||referenced||ownerEvidence)continue;
    repair.status='blocked';repair.refusal='superseded';repair.waitingFor=null;ask.status='blocked';ask.refusal='superseded';superseded.push({repair:repair.id,ask:ask.id});
    state.needUser=(state.needUser??[]).filter(item=>item.op!==repair.id&&item.op!==ask.id);
    state.provisional=(state.provisional??[]).filter(item=>item.op!==ask.id||item.answered);
    store.appendEvent({event:'review-epoch-superseded',generation:priorGeneration,repair:repair.id,ask:ask.id,
      proof:'derived review repair and prepared owner question were unlaunched, unanswered, and bound to the retired review epoch'});
  }
  const unfinished=key=>key.split('+').filter(Boolean).some(id=>(state.ledger??[]).find(item=>item.id===id)?.status!=='verified');
  state.verifyRounds=Object.fromEntries(Object.entries(state.verifyRounds??{}).filter(([key])=>!unfinished(key)));
  state.verifyFindings=Object.fromEntries(Object.entries(state.verifyFindings??{}).filter(([key])=>!unfinished(key)));
  state.verifyEscalations=Object.fromEntries(Object.entries(state.verifyEscalations??{}).filter(([key])=>!unfinished(key)));
  store.appendEvent({event:'review-epoch-reset',generation:priorGeneration,proof:'review counters and findings are generation-local; accepted operations and owner answers are preserved'});
  return superseded;
}
export function settleSkippedGenerationLeases(state,{settle=settleGenerationLeases,journalFile=state.engine?.journalFile}={}){
  const skipped=state.ops.filter(op=>op.v6Lease&&!retryableV6Operation(op));
  for(const op of skipped)need(op.v6WorkerSettled===true,`Skipped operation ${op.id} retains an unsettled durable lease`);
  if(!skipped.length)return [];
  const results=settle({journalFile,leases:skipped.map(op=>op.v6Lease),reason:'generation retry after confirmed stop of skipped operation'});
  for(let index=0;index<skipped.length;index++){need(results[index]?.ok,`Durable lease ${skipped[index].v6Lease.jobId} could not be settled before retry: ${results[index]?.reason??'unknown'}`);delete skipped[index].v6Lease;}
  return skipped.map(op=>op.id);
}
const LEGACY_COORDINATOR_ERROR='Operation can be launched only by the exact Workflow Monitor bound as nested Run coordinator';
const REVIEWED_LEGACY_COORDINATOR_LAUNCH_SHA256='34c167c6fb5150b552992350ff43f22c36e935af03b93b91e661cf4e62479801';
/** Migrate one closed legacy receipt whose pinned launcher proves the rejection happened before task creation. */
export function reconcileLegacyCoordinatorLease(state,op,{orca,store,verifyPin=verifyRuntimePin,settle=settleGenerationLeases,readFile=file=>fs.readFileSync(file),hashSource=bytes=>crypto.createHash('sha256').update(bytes).digest('hex')}={}){
  if(!op?.v6Lease||op.dispatch||op.terminal||op.launch?.task||op.launch?.dispatch)return {ok:false,reason:'operation has launch-effect identity'};
  if(op.launch?.stopReason!==LEGACY_COORDINATOR_ERROR)return {ok:false,reason:'unrecognized legacy launch rejection'};
  if(op.v6Lease.workflowId!==state.id||op.v6Lease.opId!==op.id||op.v6Lease.generation!==state.engine?.generation)return {ok:false,reason:'durable lease identity does not match workflow operation generation'};
  const checked=verifyPin(state.engine?.runtimePin);if(!checked.ok)return {ok:false,reason:`runtime pin rejected: ${checked.reason}`};
  let source;try{source=readFile(path.join(state.engine.runtimePin.root,'.dist','hosts','orca','launch.mjs'));}catch(error){return {ok:false,reason:`pinned launcher source unavailable: ${error.message}`};}
  const sourceHash=hashSource(source);if(sourceHash!==REVIEWED_LEGACY_COORDINATOR_LAUNCH_SHA256)return {ok:false,reason:`pinned launcher hash ${sourceHash} is not the reviewed legacy no-effect module`};
  let shown;try{shown=orca.invoke('run-show',{id:state.run},{cwd:state.worktree});}catch(error){return {ok:false,reason:`run attestation unavailable: ${error.message}`};}
  const observedRun=shown?.outcome==='ok'?getPath(shown.receipt,'result.run'):null,coordinator=observedRun?.coordinator_handle??null;
  if(observedRun?.id!==state.run)return {ok:false,reason:'run attestation does not match the recorded Run'};
  if(!coordinator)return {ok:false,reason:'run coordinator is missing or ambiguous'};
  if(coordinator===state.from)return {ok:false,reason:'recorded monitor still matches the Run coordinator'};
  const released=settle({journalFile:state.engine.journalFile,leases:[op.v6Lease],reason:'legacy pinned coordinator attestation rejected before task creation'})[0];
  if(!released?.ok)return {ok:false,reason:`durable lease settlement failed: ${released?.reason??'unknown'}`};
  const lease=op.v6Lease;op.v6WorkerSettled=true;op.refusal='runtime-reconciliation';
  store.appendEvent({event:'legacy-coordinator-no-effect-proved',op:op.id,jobId:lease.jobId,generation:lease.generation,pin:state.engine.runtimePin.digest,recordedFrom:state.from,observedCoordinator:coordinator,
    proof:`verified runtime pin contains reviewed legacy launcher ${sourceHash}; its coordinator rejection precedes every task-create, and operation/launch carry no task, dispatch or terminal identity`});
  return {ok:true,jobId:lease.jobId,coordinator};
}
/** Re-read an exact failed launch and release its lease only when Orca proves the worker and resource are stopped. */
function durableLaunchObservation(state,op){let journal;try{journal=openJournal({file:state.engine.journalFile});return journal.events({workflowId:state.id}).find(event=>event.entity_id===op.v6Lease.jobId&&event.generation===op.v6Lease.generation&&event.kind==='operation-launch-observed'&&event.payload?.task===op.launch.task&&event.payload?.dispatch===op.launch.dispatch)??null;}finally{journal?.close();}}
export function reconcileFailedLaunchLease(state,op,{orca,store,settle=settleGenerationLeases,observeLaunch=durableLaunchObservation}={}){
  const taskId=op?.launch?.task;if(!op?.v6Lease||!taskId||op.dispatch||op.terminal)return {ok:false,reason:'failed launch identity is incomplete or already active'};
  const launchReceipt=observeLaunch(state,op);
  if(!launchReceipt)return {ok:false,reason:'failed launch is not bound to this durable lease attempt and generation'};
  let shown;try{shown=orca.invoke('dispatch-show',{task:taskId},{cwd:state.worktree});}catch(error){return {ok:false,reason:`dispatch lookup unavailable: ${error.message}`};}
  const dispatch=shown?.outcome==='ok'?getPath(shown.receipt,'result.dispatch'):null;
  if(!dispatch?.id||dispatch.task_id!==taskId||dispatch.run_id!==state.run)return {ok:false,reason:'dispatch is missing or does not match the recorded Run and Task'};
  if(dispatch.status!=='failed'||dispatch.last_failure!=='agent_prompt_stalled')return {ok:false,reason:'dispatch failure is not the closed prompt-delivery failure'};
  let inspected;try{inspected=orca.invoke('worker-show',{dispatch:dispatch.id},{cwd:state.worktree});}catch(error){return {ok:false,reason:`worker settlement unavailable: ${error.message}`};}
  const result=inspected?.outcome==='ok'?getPath(inspected.receipt,'result'):null,worker=result?.worker,observed=result?.dispatch,observation=result?.observation,resource=result?.terminalResource,terminal=result?.terminal;
  const exact=observed?.id===dispatch.id&&observed?.task_id===taskId&&observed?.run_id===state.run&&worker?.dispatch_id===dispatch.id&&worker?.state==='failed'&&worker?.stage==='dispatch_input'
    &&observation?.exactWorker===true&&observation?.status==='exited'&&terminal?.handle===dispatch.assignee_handle&&terminal?.connected===false
    &&resource?.originDispatchId===dispatch.id&&resource?.ownerDispatchId===dispatch.id&&resource?.ownershipState==='released'&&resource?.releaseState==='released';
  if(!exact)return {ok:false,reason:`worker ${dispatch.id} is not proven exited with its exact terminal resource released`};
  const released=settle({journalFile:state.engine.journalFile,leases:[op.v6Lease],reason:'Orca proved failed dispatch-input worker exited and released its terminal resource'})[0];
  if(!released?.ok)return {ok:false,reason:`durable lease settlement failed: ${released?.reason??'unknown'}`};
  const lease=op.v6Lease;op.v6WorkerSettled=true;op.refusal='runtime-reconciliation';op.launch.dispatch=dispatch.id;
  store.appendEvent({event:'failed-launch-stopped-proved',op:op.id,jobId:lease.jobId,generation:lease.generation,run:state.run,task:taskId,dispatch:dispatch.id,terminal:terminal.handle,
    proof:'dispatch failed at dispatch_input; exact worker exited; its exact terminal resource ownership and release states are released; candidate reconciliation still accounts for any late filesystem effects'});
  return {ok:true,jobId:lease.jobId,dispatch:dispatch.id};
}
/** Recover a launched native lease only from the exact stopped Orca worker and its still-fenced candidate. */
export function reconcileStoppedNativeRetryLease(state,op,{orca,store,settleHost=settleDispatch,createRuntime=createV6Runtime,git=spawnSync,waitFn=sleepSync}={}){
  const lease=op?.v6Lease,dispatchId=op?.launch?.dispatch,taskId=op?.launch?.task,candidate=op?.v6Candidate?.bridge?.identity;
  if(!lease||!dispatchId||!taskId||op.dispatch||op.terminal)return {ok:false,reason:'stopped native retry identity is incomplete or still active'};
  const exactLease=lease.workflowId===state.id&&lease.opId===op.id&&lease.attempt===op.attempt&&lease.generation===state.engine?.generation&&
    candidate?.workflowId===lease.workflowId&&candidate?.opId===lease.opId&&candidate?.attempt===lease.attempt&&candidate?.generation===lease.generation&&candidate?.jobId===lease.jobId;
  if(!exactLease)return {ok:false,reason:'candidate and durable lease do not bind the current workflow operation attempt'};
  let inspected;try{inspected=orca.invoke('worker-show',{dispatch:dispatchId},{cwd:state.worktree});}catch(error){return {ok:false,reason:`worker settlement unavailable: ${error.message}`};}
  const result=inspected?.outcome==='ok'?getPath(inspected.receipt,'result'):null,worker=result?.worker,dispatch=result?.dispatch,observation=result?.observation,terminal=result?.terminal;
  const stopped=['failed','stopped','succeeded'].includes(worker?.state)&&observation?.exactWorker===true&&observation?.status==='exited'&&
    (!terminal||(terminal.connected===false&&terminal.writable===false&&(terminal.paneRuntimeId===undefined||terminal.paneRuntimeId===null||terminal.paneRuntimeId===-1)));
  if(dispatch?.id!==dispatchId||dispatch?.task_id!==taskId||dispatch?.run_id!==state.run||worker?.dispatch_id!==dispatchId||!stopped)
    return {ok:false,reason:'Orca does not prove the exact current Run/Task/Dispatch worker exited'};
  let settlement;try{settlement=settleHost(orca,dispatchId,{cwd:state.worktree,reason:'workflow retry reconciles an exited native attempt',terminalHandle:terminal?.handle??null,closeTerminal:false,wait:waitFn});}
  catch(error){return {ok:false,reason:`typed host settlement failed: ${error.message}`};}
  if(settlement?.effectState!=='none')return {ok:false,reason:`exact native process settlement remains ${settlement?.effectState??'unknown'}`};
  const runtime=createRuntime({store,state,eligibility:()=>({eligible:false,reasons:['retry reconciliation only']}),git});
  try{
    const reconciled=runtime.settleStoppedOperation(op,{dispatch:dispatchId,settlement,reason:'public workflow retry proved the exact native worker exited'});
    if(!reconciled.ok)return reconciled;
    store.appendEvent({event:'retry-native-attempt-reconciled',op:op.id,jobId:lease.jobId,attempt:lease.attempt,generation:lease.generation,
      run:state.run,task:taskId,dispatch:dispatchId,candidateDigest:reconciled.candidateDigest??null,observedFiles:reconciled.observedFiles??[],
      proof:'exact Orca worker exited; typed process settlement succeeded; candidate bytes were sealed while its writer fence remained held'});
    store.saveState(state);
    return {ok:true,dispatch:dispatchId,observedFiles:reconciled.observedFiles??[],candidateDigest:reconciled.candidateDigest??null};
  }finally{runtime.close();}
}
export function refundLegacyCoordinatorProbations(store,state,runtime){
  const events=store.readEvents(),refunded=[];
  for(const proofEvent of events.filter(event=>event.event==='legacy-coordinator-no-effect-proved')){
    const op=byId(state,proofEvent.op),job=runtime.journal.getJob(proofEvent.jobId);if(!op||!job)continue;
    need(job.status==='cancelled'&&job.workflow_id===state.id&&job.op_id===op.id&&job.generation===proofEvent.generation&&job.kind==='operation',`Legacy probation job ${proofEvent.jobId} does not match its settled operation receipt`);
    const runtimeId=job.payload?.runtime,identity={workflowId:job.workflow_id,opId:job.op_id,attempt:job.attempt,generation:job.generation,jobId:job.job_id,probationRuntime:runtimeId,probationRole:job.role};
    const result=runtime.refundUnbegunProbation(op,{code:'native-execution-never-began',effectState:'none',taskCreated:false,inputAccepted:false,
      attestationId:`legacy-coordinator:${proofEvent.pin}:${job.job_id}`,legacyNoEffectEventId:`${state.id}:event:${proofEvent.seq??proofEvent.jobId}`,
      jobId:job.job_id,generation:job.generation,workflowId:job.workflow_id,opId:job.op_id,runtimeId,role:job.role},identity);
    need(result.ok,`Legacy probation ${job.job_id} could not be refunded: ${result.code}`);refunded.push({jobId:job.job_id,code:result.code});
  }
  return refunded;
}

function launchOp(orca,store,state,op,allocated,ctx){
  if(op.needsReplan)replanOp(store,state,op,ctx);
  if(ctx.v6){delete op.v6WorkerSettled;delete op.v6Pending;op.v6ReviewRound=0;}
  if(op.kind==='integration.verify')op.credentialVersions=snapshotCredentialVersions(op,ctx);
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
  // How much the agent is told to read before it may do anything: the grace before the first stall verdict.
  op.contractBytes=Buffer.byteLength(contract,'utf8');
  const relative=path.relative(process.cwd(),state.worktree)||'.';
  // A launch that throws - Orca unreachable, a spec the command line cannot carry - is a failed launch, never the
  // end of the kernel: the op records it, avoids the runtime, and the loop goes on.
  let launched,workerEffectStarted=false;
  try{
    if(ctx.v6){op.v6ResolvedReferences=candidateReferences(op,state,ctx);ctx.v6.beginCandidate(op,{repoRoot:state.worktree,allowlist:op.allowlist,references:op.v6ResolvedReferences,
      inputPaths:[...op.v6ResolvedReferences,...unique(op.kernelOwned??[])],ownedDirtyPaths:op.v6OwnedBaselinePaths??[],
      dependencyDigests:op.dependencyDigests??{},environmentDigest:typeof op.environmentDigest==='string'&&op.environmentDigest.trim()?op.environmentDigest:
        (typeof state.engine?.runtimePin?.digest==='string'&&state.engine.runtimePin.digest.trim()?state.engine.runtimePin.digest:
          (typeof state.engine?.runtimePinDigest==='string'&&state.engine.runtimePinDigest.trim()?state.engine.runtimePinDigest:'runtime-unpinned')),
      dependencyInstall:op.dependencyInstall??null});}
    if(ctx.v6)ctx.v6.beginLaunchIntent(op);
    workerEffectStarted=true;
    launched=ctx.launch(orca,{cwd:state.worktree,run:state.run,workflowTask:state.workflowTask??state.id,from:state.from,
      worktree:relative,operation:launchOperator(op.kind),kind:op.kind,scope:op.id,spec:operationSpec(op,contract),candidate:allocated.candidate,runtime:allocated.runtime,wait:ctx.wait});
  }catch(error){
    const typedNoEffect=['ORCA_COORDINATOR_MISMATCH','ORCA_TASK_CREATE_FAILED'].includes(error?.code)&&error?.effectState==='none';
    const effectState=error?.effectState==='unknown'?'unknown':typedNoEffect?'none':workerEffectStarted?'unknown':'none';
    launched={ok:false,effectState,stopReason:String(error?.message??error).slice(0,300),attempts:[{target:allocated.target,stage:'launch',effectState,reason:String(error?.message??error).slice(0,240)}]};
  }
  const persistedAttempts=(launched?.attempts??[]).slice(0,8).map(attempt=>({target:attempt.target??null,agent:attempt.agent??null,model:attempt.model??null,dispatchId:attempt.dispatchId??null,effectState:attempt.effectState??'unknown',stage:attempt.stage??null,reason:String(attempt.reason??'').slice(0,300),
    ...(attempt.settlement?{settlement:{schema:attempt.settlement.schema??null,dispatchId:attempt.settlement.dispatchId??attempt.dispatchId??null,effectState:attempt.settlement.effectState??'unknown',residualTerminal:attempt.settlement.residualTerminal??null,abandoned:Boolean(attempt.settlement.abandoned),closedTerminal:attempt.settlement.closedTerminal?{handle:attempt.settlement.closedTerminal.handle??null,outcome:attempt.settlement.closedTerminal.outcome??null}:null}}:{}),
    ...(attempt.recovery?{recovery:{ok:Boolean(attempt.recovery.ok),action:attempt.recovery.action??null,reason:String(attempt.recovery.reason??'').slice(0,200)}}:{})}));
  op.launch={ok:Boolean(launched?.ok),target:launched?.selection?.target??allocated.target,
    task:launched?.task?.id??null,dispatch:launched?.dispatchId??null,stopReason:launched?.stopReason??null,
    effectState:launched?.effectState??(launched?.ok?'partial':'unknown'),attempts:persistedAttempts};
  if(ctx.v6)ctx.v6.recordLaunchObservation(op);
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
    if(ctx.v6&&op.launch.effectState!=='none'){
      op.status='blocked';op.refusal='effect-unknown';op.incidentSignature='launch-effect-unknown';
      store.appendEvent({event:'launch-reconciliation-required',op:op.id,reason:launched?.stopReason??'unconfirmed launch effects'});
      store.saveState(state);return {ok:false,reason:'launch effect reconciliation required'};
    }
    op.launchFailures+=1;
    ctx.allocator.failed(allocated.runtime,{reason:launched?.stopReason??'launch failed',op:op.id});
    avoidRuntime(op,allocated.runtime,clockOf(ctx));
    // The attempts travel with the event: a launch that failed is only diagnosable from what Orca said at each step.
    store.appendEvent({event:'launch-failed',op:op.id,runtime:allocated.runtime,stopReason:launched?.stopReason??null,attempts:launched?.attempts?.length??0,
      detail:(launched?.attempts??[]).slice(0,4).map(attempt=>({target:attempt.target??null,stage:attempt.stage??null,effectState:attempt.effectState??null,reason:String(attempt.reason??'').slice(0,240),...(attempt.trust?{trust:attempt.trust}:{}),...(attempt.recovery?{recovery:attempt.recovery}:{})}))});
    // Launch attempts are a mechanical bound: spent, the op cools and comes back by itself rather than becoming a
    // question nobody can answer ("no runtime could launch op-3" is not a decision the owner can take).
    if(op.launchFailures>=LAUNCH_LIMIT)coolOp(store,state,op,ctx,`no runtime could launch ${op.id} (${op.launchFailures} attempts, last ${launched?.stopReason??'unknown'})`);
    return {ok:false,reason:launched?.stopReason??'launch failed'};
  }
  op.status='running';op.runtime=allocated.runtime;op.target=allocated.target;op.coordinatorRecovered=false;
  // The launch is what the other kernels of this repository must see: the allocation alone could still fail.
  ctx.allocator.launched?.(allocated.runtime,{op:op.id});
  if(!op.baseHead){const shown=ctx.git('git',['rev-parse','HEAD'],{cwd:state.worktree,encoding:'utf8',windowsHide:true});op.baseHead=shown.status===0?(shown.stdout??'').trim():null;}
  op.task=launched.task.id;op.dispatch=launched.dispatchId;op.terminal=launched.terminal;op.nudged=false;
  // A launch is an external effect: the state that names it is written before anything else can interrupt the kernel.
  store.saveState(state);
  op.launchedAt=clockOf(ctx);
  store.appendEvent({event:'launched',op:op.id,kind:op.kind,node:op.nodeId,attempt:op.attempt,runtime:op.runtime,target:op.target,
    dispatch:op.dispatch,terminal:op.terminal,allocation:launched.allocation??null});
  // Work v2 authors only uninvestigate, todo and done, so the launch is recorded in the node's kernel block.
  ledgerWrite(store,state,op,ctx,'in-progress',node=>ctx.work.api.markInProgress(ctx.work.at,node,{opId:op.id,dispatch:op.dispatch}));
  if(ctx.v6)ctx.v6.acknowledgeRuntimeWrites(op,op.kernelOwned??[]);
  // The baseline is taken after the kernel's own in-progress write, so only the operation's edits are caught.
  op.kernelOwnedAt=op.kernelOwned.length?protectedFingerprint(ctx.work?.ledger?.repoRoot??ctx.work?.repoRoot??state.worktree,op.kernelOwned):null;
  // An author op holds the whole record, so the file cannot be fingerprinted as a unit: the blocks inside it
  // that stay the kernel's are snapshotted instead, after the same in-progress write.
  if(authorsRecord(op.kind))op.recordBlocks=recordBlocks(ctx,op.nodeId);
  if(op.integrationPreparation)try{op.preparationBefore=preparationFingerprint(ctx.work.api.readNode(ctx.work.at,ctx.work.node(op.nodeId)));}catch{op.preparationBefore=null;}
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

/**
 * A dependency is dead when it failed, or when the kernel refused it for good. A refusal time lifts - a cooldown
 * (`launch-cooling`) or a provider limit (`rate-limited`) - is not one: the op is re-admitted when the clock says so,
 * and whatever waits for it simply waits.
 */
const TIME_BOUND_REFUSALS=['launch-cooling','rate-limited'];
export const deadOp=op=>Boolean(op)&&(op.status==='failed'||(op.status==='blocked'&&Boolean(op.refusal)&&!TIME_BOUND_REFUSALS.includes(op.refusal)));
/**
 * The one operation the kernel never launches: a `provision.ask` for a credential. An agent in a tab printing
 * a command for the owner to type was never a question the owner could answer, so the kernel prints ONE line -
 * the variables, the custody, the exact `identity fill` command - and this op simply waits: `running`, no
 * dispatch, no runtime, no slot, no deadline. It is settled by presence, at the tick, when the owner has run
 * the command. The other stop kinds still ask in their own terminal: an account, a dataset or an authority has
 * nothing to type into a prompt, and what the owner does for those is done outside this machine.
 */
function fillWaiting(orca,store,state,op,ctx){
  if(op.kind!==PROVISION_ASK||op.question?.stop!=='credential')return false;
  op.inputMode=ctx.host?.name==='orca'?'gui':'cli';
  if(!op.fill||!op.credential?.custody||!op.credential?.variables?.length){
    let declared=[];
    try{declared=ctx.work?work.declaredIntegrations(ctx.work.loaded).list:[];}catch{declared=[];}
    const requesters=state.ops.filter(item=>(op.requesters??[]).includes(item.id));
    const before=op.fillCommand??null;
    op.credential=credentialAsked(op,{declared,requesters});
    // Named before the tree was loaded (a start migration runs first), the custody may only be known now: the
    // one line is printed when the command exists, and never twice for the same command.
    if(op.fill&&before===null){
      op.fillCommand=op.credential.custody&&op.credential.variables.length
        ?fillCommand({host:state.host,slug:op.credential.custody.replace(/^identity:/,''),variables:op.credential.variables,workRoot:ctx.work?.at?.workRoot??null}):null;
      if(op.fillCommand){
        store.appendEvent({event:'provision-fill-named',ask:op.id,variables:[...op.credential.variables],custody:op.credential.custody,command:op.fillCommand});
        try{notifyTerminal(orca,{cwd:state.worktree,terminal:state.from,text:askFillLine(op),wait:ctx.wait});}catch{/* the same line is on every page */}
      }
      return true;
    }
    if(op.fill)return true;
    op.fill=true;op.fillCheckedAt=null;
    op.fillCommand=op.credential.custody&&op.credential.variables.length
      ?fillCommand({host:state.host,slug:op.credential.custody.replace(/^identity:/,''),
        variables:op.credential.variables,workRoot:ctx.work?.at?.workRoot??null})
      :null;
    store.appendEvent({event:'provision-fill-waiting',ask:op.id,variables:[...op.credential.variables],
      custody:op.credential.custody,command:op.fillCommand,requesters:[...(op.requesters??[])]});
    // One line in the owner's own tab, once, when the question opens - never a wall of text every iteration.
    try{notifyTerminal(orca,{cwd:state.worktree,terminal:state.from,text:askFillLine(op),wait:ctx.wait});}
    catch{/* the tab may be gone; the same line is on every page that shows this workflow */}
  }
  op.status='running';op.dispatch=null;op.terminal=null;op.nudged=false;op.launchedAt=null;
  return true;
}

/** Missing provider research is an owning record operation, never an owner's credential problem. */
export function deferForIntegrationPreparation(store,state,op,ctx,{entries=null}={}){
  if(!ctx.work||authorsRecord(op.kind)||isAsk(op.kind)||op.integrationPreparation)return false;
  const declared=entries??work.declaredIntegrations(ctx.work.loaded).list;
  const related=entries??relatedIntegrations(op,declared,ctx.work.loaded.list);
  const missing=related.filter(entry=>!integrationReadiness(entry,{now:clockOf(ctx)}).ok);
  if(!missing.length)return false;
  for(const owner of unique(missing.map(entry=>entry.declaredBy))){
    const node=ctx.work.node(owner),record=node?recordPath(state,ctx,node):null;
    const scoped=node&&work.inScope(node,state.scope.length?state.scope:null);
    if(!record||!scoped){
      op.status='blocked';
      const detail=`Official integration documentation needs research in ${owner}; its preparation record is outside this workflow's writable binding or approved scope.`;
      if(!state.needUser.some(item=>item.op===op.id&&item.kind==='authority'&&item.detail===detail))state.needUser.push({op:op.id,kind:'authority',detail});
      store.appendEvent({event:'integration-preparation-authority',op:op.id,owner});continue;
    }
    let author=state.ops.find(item=>item.integrationPreparation?.owner===owner);
    if(!author){
      author=addOp(store,state,{kind:AUTHOR_KIND,nodeId:owner,ledgerIds:[],allowlist:[record],references:unique([node.path,...(node.refs??[])]),
        goal:`Research the official documentation for the external integrations declared by ${owner}. Repair ONLY extensions.work3.integrations[].preparation in this owning record. ${INTEGRATION_RESEARCH_ORDER}`,
        checks:[{name:'work-valid',command:workValidateCommand(ctx)}],acceptance:['Every declared integration has current official documentation evidence, resolved credential semantics and a complete preparation and live verification plan.','All content outside preparation is unchanged.'],origin:'ledger'},
      `official integration preparation missing for ${op.id}`);
      author.integrationPreparation={owner};author.difficulty='hard';
    }
    normalizePreparationAuthority(store,state,author,ctx);
    // A prior finished author gets a fresh attempt only for this specific missing preparation, never a stale conversation.
    if(author.status==='done'){author.status='ready';author.attempt+=1;author.dispatch=null;author.terminal=null;author.preparationBefore=null;}
    op.dependsOn=unique([...(op.dependsOn??[]),author.id]);
    if(op.status!=='blocked')op.status='pending';
    op.findings=unique([...(op.findings??[]),`Read the official-documentation preparation produced by ${author.id} before design, implementation, credentials or live verification.`]);
  }
  return true;
}

/** Bind a preparation-only author to its one approved owning declaration, including authors reused from old runs. */
export function normalizePreparationAuthority(store,state,op,ctx){
  const owner=op?.integrationPreparation?.owner;
  need(typeof owner==='string'&&owner,'integration preparation has no owning declaration');
  need(ctx?.work,'canonical Work binding is unavailable');
  const node=ctx.work.node(owner);
  need(node&&work.inScope(node,state.scope?.length?state.scope:null),`${owner} is outside this workflow's approved scope`);
  const record=recordPath(state,ctx,node);
  need(typeof record==='string'&&record,`${owner} has no protected declaration record`);
  const oldNode=op.nodeId,oldAllowlist=[...(op.allowlist??[])];
  op.nodeId=owner;op.allowlist=[record];op.references=unique([node.path,...(node.refs??[])]);
  const changed=oldNode!==owner||oldAllowlist.length!==1||oldAllowlist[0]!==record;
  if(changed)store.appendEvent({event:'integration-preparation-authority-refreshed',op:op.id,owner,record,previousNode:oldNode??null,previousAllowlist:oldAllowlist});
  return changed;
}

/** Re-evaluate old waits on restart; unsupported variable-only asks are hidden and their requester is re-admitted. */
export function refreshCredentialPreparation(store,state,ctx){
  if(!ctx.work){for(const ask of fillWaitingAsks(state))prepareCredentialAsk(ask,[],{now:clockOf(ctx)});return;}
  const entries=work.declaredIntegrations(ctx.work.loaded).list;
  for(const ask of fillWaitingAsks(state)){
    if(prepareCredentialAsk(ask,entries,{now:clockOf(ctx)}))continue;
    for(const id of ask.requesters??[]){
      const requester=byId(state,id);
      if(!requester||requester.status!=='paused'||requester.waitingFor!==ask.id)continue;
      if(requester.dispatch||requester.terminal){
        if(!ctx.orca)continue;
        let closed=false;
        try{
          if(requester.dispatch)closed=settleDispatch(ctx.orca,requester.dispatch,{cwd:state.worktree,
            reason:'fresh integration research attempt',terminalHandle:requester.terminal,closeTerminal:Boolean(requester.terminal),wait:ctx.wait}).effectState==='none';
          else closed=ctx.orca.invoke('terminal-close',{terminal:requester.terminal},{cwd:state.worktree}).outcome==='ok';
        }catch{}
        if(!closed){store.appendEvent({event:'credential-research-settlement-pending',op:requester.id});continue;}
        store.appendEvent({event:'credential-research-terminal-settled',op:requester.id,terminal:requester.terminal});
      }
      requester.status='ready';requester.waitingFor=null;requester.dispatch=null;requester.terminal=null;requester.attempt+=1;
      requester.dependsOn=(requester.dependsOn??[]).filter(dependency=>dependency!==ask.id);
      requester.findings=unique([...(requester.findings??[]),INTEGRATION_RESEARCH_ORDER]);
      deferForIntegrationPreparation(store,state,requester,ctx,{entries:entries.filter(entry=>ask.credential?.variables?.includes(entry.credential?.name)&&entry.credential.custody===ask.credential?.custody)});
      store.appendEvent({event:'credential-research-readmitted',ask:ask.id,op:requester.id});
    }
  }
}
export function prepareV6WorkGate(op,ctx){
  need(ctx?.v6,'v6 runtime is required to prepare a Work gate');
  need(ctx?.work&&plain(ctx.work.ledger),'canonical Work binding is unavailable');
  const command=workValidateCommand(ctx);need(typeof command==='string'&&command.trim(),'canonical Work validator command is unavailable');
  const checks=Array.isArray(op.checks)?op.checks:[],named=checks.filter(check=>String(check?.name??'').toLowerCase()==='work-valid');
  if(named.some(check=>check.command!==command))throw Error('work-valid is reserved for the exact canonical Work validator command');
  const others=checks.filter(check=>String(check?.name??'').toLowerCase()!=='work-valid');
  op.checks=[...others,{name:'work-valid',command,runtimePrepared:true}];
  return named.length!==1||named[0].command!==command||named[0].runtimePrepared!==true;
}

/** Every sealed v6 byte is attributed to its operation; legacy runs retain report-confirmed attribution. */
export function producedKindVerdict(op,observed,ctx){
  const produced=ctx?.v6?[...observed]:attributedFiles(op,observed,ctx);
  try{return {ok:true,produced,undeclared:undeclaredWrites(op.kind,produced,{profile:ctx?.kindsProfile??null,nodeKind:ctx?.work?.node?.(op.nodeId)?.kind??null})};}
  catch(error){return ctx?.v6?{ok:false,produced,undeclared:[],error:String(error?.message??error)}:{ok:true,produced,undeclared:[]};}
}

export function activatePendingOps(store,state){
  for(const op of state.ops){
    if(op.status!=='pending')continue;
    const dependencies=op.dependsOn.map(id=>byId(state,id));
    // Only a dependency that failed, or that the kernel refused for good, is dead; one blocked without a refusal is
    // cooling, re-admitted or authored, and the op simply waits for it.
    if(dependencies.some(deadOp)){
      op.status='blocked';
      state.needUser.push({op:op.id,kind:'authority',detail:`${op.id} can never start: it depends on ${op.dependsOn.join(', ')}`});
      store.appendEvent({event:'op-blocked',op:op.id,reason:'dependency blocked'});
      continue;
    }
    if(dependencies.every(dependency=>dependency?.status==='done'||(!dependency&&state.engine?.coordination!=='agent-v1')))op.status='ready';
  }
}

export function persistPrelaunchReservation(store,state,op,v6){
  try{store.saveState(state);return {ok:true};}
  catch(error){need(v6.reservationPhase(op).phase==='reserved',`Prelaunch reservation ${op.id} lost its safe durable phase after state persistence failed`);throw error;}
}
function scheduleOps(orca,store,state,ctx,{orderedOpIds=null}={}){
  activatePendingOps(store,state);
  const launched=[];
  const ready=state.ops.filter(item=>item.status==='ready');
  const ranked=ctx.v6?ctx.v6.rank(ready):ready;
  const selected=orderedOpIds?orderedOpIds.map(id=>ready.find(op=>op.id===id)).filter(Boolean):ranked;
  for(const op of selected){
    ctx.currentOp=op;
    if(ctx.v6&&op.integrationPreparation){
      try{if(normalizePreparationAuthority(store,state,op,ctx))store.saveState(state);}
      catch(error){op.status='blocked';op.refusal='runtime-gate-binding';const detail=`${op.id} cannot bind its integration preparation to one approved declaration: ${String(error?.message??error)}`;op.v6Pending={kind:'runtime-gate-binding',detail};store.appendEvent({event:'integration-preparation-authority-refused',op:op.id,reason:detail});continue;}
    }
    // A credential is asked by one command the owner runs, so its ask is never dispatched to a runtime at all:
    // it waits here, holding no runtime and no slot, until the custody holds every variable it named.
    if(fillWaiting(orca,store,state,op,ctx))continue;
    if((ctx.deferPreparation??deferForIntegrationPreparation)(store,state,op,ctx))continue;
    // An operation waiting on the owner occupies no parallel slot: the owner takes as long as the owner takes.
    const busy=state.ops.filter(item=>['running','answering'].includes(item.status)&&!item.fill);
    if(busy.length>=ctx.allocator.maxParallelOps)break;
    // A design operation on a tree with no brand record is not launched at all: the brand is decided first.
    if(deferForBrand(store,state,op,ctx))continue;
    // On the Work ledger the authored files decide parallelism, through the ledger's own prefix semantics.
    const overlaps=other=>ctx.work?!ctx.work.api.disjoint(other.allowlist,op.allowlist):allowlistsOverlap(other.allowlist,op.allowlist);
    // Two asks share the feature's policy-decisions folder by design, and neither is authoring in it: each writes
    // at most one NEW slug folder of its own, and the whole-tree validator is what catches a duplicate. Waiting for
    // each other bought nothing and cost an hour - three credential tabs the owner never saw sat behind one
    // decision draft that shared nothing with them. A non-ask on that folder still waits: it edits what is there.
    const contends=other=>overlaps(other)&&!(isAsk(op.kind)&&isAsk(other.kind));
    if(busy.some(contends)){
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
    if(ctx.v6&&writesWorkRecords(op.kind,{profile:ctx.kindsProfile})){
      try{if(prepareV6WorkGate(op,ctx)){store.appendEvent({event:'v6-work-gate-prepared',op:op.id,command:op.checks.find(check=>check.name==='work-valid').command});store.saveState(state);}}
      catch(error){op.status='blocked';op.refusal='runtime-gate-binding';const detail=`${op.id} cannot prepare its required canonical Work gate: ${String(error?.message??error)}`;op.v6Pending={kind:'runtime-gate-binding',detail};store.appendEvent({event:'v6-work-gate-refused',op:op.id,reason:detail});continue;}
    }
    const allocationJob={...op,opId:op.id,role:kindRole(op.kind),independentReview:ctx.v6?{required:true,freshContext:true}:op.independentReview,checks:op.checks};
    const reservation=ctx.v6?.reservationPhase?.(op);
    const allocated=reservation?.phase==='reserved'?{ok:true,runtime:reservation.runtime,target:reservation.target,role:reservation.role,continuedReservation:true}:
      ctx.allocator.allocate(op.kind,{avoid,restrictTo:launchableFor(ctx.allocator,launchOperator(op.kind)),difficulty:op.difficulty??null,job:allocationJob});
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
      op.deferral={reason,at:clockOf(ctx)};
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
    if(ctx.v6){
      const reserved=ctx.v6.reserveOperation(op,allocated);
      if(!reserved.ok){
        ctx.allocator.release(allocated.runtime,{op:op.id});
        op.deferral={reason:(reserved.reasons??['global capacity unavailable']).join('; '),at:clockOf(ctx)};
        store.appendEvent({event:'admission-deferred',op:op.id,reason:op.deferral.reason});
        continue;
      }
    }
    if(ctx.v6)persistPrelaunchReservation(store,state,op,ctx.v6);
    const result=launchOp(orca,store,state,op,{...allocated,candidate},ctx);
    if(ctx.v6){
      if(result.ok)ctx.v6.launched(op);
      else if(op.launch?.ok===false&&op.launch?.effectState==='none')ctx.v6.settled(op,{status:'failed',reason:'launch proved no effect'});
    }
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
  if(ctx.v6)return [];
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

/* ------------------------------------------------------------------ the record routes */

/**
 * The two record gaps the kernel routes the same way, one layer apart. `sds-gap` is a design that does not say
 * how; `srs-gap` is a requirement that does not say what, or says it twice in two ways. Both reopen the node
 * that OWNS the record - never the operation that tripped over it - create the repair kind the route names on
 * that node's own file and folder, and put the requester behind it. Everything that differs between them is
 * here as data, so the two routes cannot drift apart in the parts that are supposed to be identical.
 */
const RECORD_GAPS=Object.freeze({
  'sds-gap':Object.freeze({nodeKinds:['architecture'],fallback:{kind:'architecture.revise',origin:'architecture',then:'reopen'},
    reason:'reported an SDS gap',nodeField:'architecture',opField:'decide',
    goal:(op,node,detail)=>`Revise the design ${op.id} found incomplete, in the architecture node ${node.id}: ${detail}. Fix the SDS text itself and bump its rev.`,
    acceptance:(node,detail)=>`${node.id} records the decision for: ${detail}`,
    note:(created,node)=>`the design gap is settled by ${created.id} in ${node.path}; read the updated design first`}),
  'srs-gap':Object.freeze({nodeKinds:['business','business-overview','module'],fallback:{kind:'business.revise',origin:'business',then:'reopen'},
    reason:'reported a requirement gap',nodeField:'business',opField:'revise',
    goal:(op,node,detail)=>`Revise the requirement ${op.id} could not derive its work from, in the business node ${node.id}: ${detail}. State the readings the record admits, write the most reasonable one into the requirement, rule or journey with the acceptance an implementer derives code from, say why in the decision log and bump its rev.`,
    acceptance:(node,detail)=>`${node.id} settles the requirement for: ${detail}`,
    note:(created,node)=>`the requirement gap is settled by ${created.id} in ${node.path}; read the updated requirement first`})
});

/**
 * The node that owns the record a gap names: the one the detail names by path, or - failing that - the one of
 * the reporting operation's own module. `null` when the tree carries none, which the caller must not paper over.
 */
function recordNodeFor(ctx,op,detail,nodeKinds){
  const nodes=ctx.work.loaded.list.filter(node=>nodeKinds.includes(node.kind));
  const named=pathsIn(detail);
  const byPath=nodes.find(node=>named.some(file=>slash(node.path).includes(file)||file.includes(slash(path.dirname(node.path)))));
  if(byPath)return byPath;
  const own=ctx.work.node(op.nodeId);
  const key=own?workModule(own):null;
  return nodes.find(node=>key&&workModule(node)===key)??null;
}
function architectureNodeFor(ctx,op,detail){return recordNodeFor(ctx,op,detail,RECORD_GAPS['sds-gap'].nodeKinds);}

/** `then: reopen` - the reporter waits for the op the route created and runs again with the settled material. */
function reopenRequester(store,state,op,open,created,note){
  op.status='pending';op.attempt+=1;op.dependsOn=unique([...op.dependsOn,created.id]);
  op.priorOpen=unique([...(open??[]),note]);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'op-reopened',op:op.id,waitingFor:created.id,note});
}

/**
 * One record gap, routed on the Work tree. The node that owns the record is reopened and gets the repair kind
 * the route names, on its own record file and the folder around it - a record fix is text, and its text is
 * there - and the requester waits behind it and reads the settled record on its next attempt.
 */
function reopenRecordOwner(store,state,op,report,ctx,blocker,blockerKind){
  const gap=RECORD_GAPS[blockerKind];
  const owner=recordNodeFor(ctx,op,blocker.detail,gap.nodeKinds);
  if(!owner)return null;
  const route=routeOf({blocker:blockerKind,kind:op.kind})??gap.fallback;
  ledgerWrite(store,state,op,ctx,'reopened',()=>ctx.work.api.markReopened(ctx.work.at,owner,
    {reason:`${op.id} ${gap.reason}: ${blocker.detail}`,by:'starci-kernel'}));
  const file=`.starciwork/${slash(owner.path)}`;
  const folder=`.starciwork/${slash(path.dirname(owner.path))}/**`;
  const repair=addOp(store,state,{kind:routeKind(route,state,op)??gap.fallback.kind,nodeId:owner.id,
    goal:gap.goal(op,owner,blocker.detail),
    ledgerIds:op.ledgerIds,allowlist:unique([file,folder]),references:unique([owner.path,...op.references]),
    checks:[{name:'work-tree-validates',command:workValidateCommand(ctx)}],
    acceptance:[gap.acceptance(owner,blocker.detail)],origin:route.origin??gap.fallback.origin},
    `${blockerKind} reported by ${op.id}`);
  reopenRequester(store,state,op,report.open,repair,gap.note(repair,owner));
  store.appendEvent({event:blockerKind,op:op.id,node:op.nodeId,[gap.nodeField]:owner.id,[gap.opField]:repair.id});
  routed(store,op,blockerKind,repair.id,repair.origin,{kind:repair.kind,node:owner.id,then:route.then});
  return repair;
}
function reopenArchitecture(store,state,op,report,ctx,blocker){return reopenRecordOwner(store,state,op,report,ctx,blocker,'sds-gap');}
/**
 * `srs-gap`: the requirement itself is silent, confusing or self-contradictory. The business node that owns the
 * SRS is reopened and revised - the runtime states the readings, takes the most reasonable one and says why -
 * rather than the design inventing the product rule it was supposed to realise.
 */
function reopenBusiness(store,state,op,report,ctx,blocker){return reopenRecordOwner(store,state,op,report,ctx,blocker,'srs-gap');}

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
      // A record author (an intake, a migration, a node author) is one operation over one record set: splitting it
      // by allowlist entry made four half-intakes of one feature. Only a build is ever split.
      options:op.intake||authorsRecord(op.kind)?['retry-other-runtime','escalate-to-user']:['retry-other-runtime','split','escalate-to-user'],
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
  if(ctx.v6){
    const incident=ctx.v6.incident(op,reason,findings);
    if(incident.exhausted){
      op.status='blocked';op.incidentSignature=`${op.id}:${reason}`;
      store.appendEvent({event:'incident-exhausted',op:op.id,reason,progress:incident.progress});
      state.needUser.push({op:op.id,kind:'environment',detail:`The bounded recovery for ${op.id} made no verified progress; runtime diagnosis is required (${reason}).`});
      return 'incident-exhausted';
    }
  }
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
/**
 * The feature folder a shared change belongs under, in the tree's own spelling: the requester's node first, then
 * its paths, then the first feature the tree carries. `null` only when this workflow has no Work tree at all.
 */
function sharedFeatureOf(op,ctx){
  const folderOf=where=>{const match=slash(String(where??'')).match(/features\/([^/]+)\//);return match?match[1]:null;};
  const fromTree=id=>{try{return folderOf(ctx?.work?.node?.(id)?.path);}catch{return null;}};
  return [op?.nodeId,...(op?.ledgerIds??[])].filter(Boolean).map(fromTree).find(Boolean)
    ??(op?.allowlist??[]).map(folderOf).find(Boolean)
    ??(op?.references??[]).map(folderOf).find(Boolean)
    ??(ctx?.work?.loaded?.list??[]).map(node=>folderOf(node.path)).find(Boolean)
    ??null;
}
/**
 * A shared change too deep to delegate is not a question for the owner and not a dead end: it is work nobody
 * wrote down. The kernel creates one `work.author` op that authors a Work node for exactly those paths, and
 * from then on the change travels the ordinary road - a record with a write scope and checks, a lane, a proof -
 * instead of a third nested shared op nobody bounded.
 */
function authorSharedNode(store,state,op,ctx,{paths,detail,open}){
  const feature=sharedFeatureOf(op,ctx);
  if(!feature)return null;
  const slug=`shared-${slash(String(op.id)).replace(/[^A-Za-z0-9]+/g,'-').toLowerCase()}`;
  const folder=`.starciwork/features/${feature}/implementation/${slug}`;
  const node=`${folder}/index.yaml`;
  const author=addOp(store,state,{kind:AUTHOR_KIND,nodeId:null,
    goal:`Author one Work node for the change ${op.id} cannot make inside its own slice, and do not make the change: ${detail}. Its write scope is exactly ${paths.join(', ')}; state what the change must achieve as testable assertions and one runnable check per assertion, \`state: todo\`, referring to the records this feature already holds. The kernel schedules that node's own operation afterwards.`,
    ledgerIds:[],allowlist:[node,`${folder}/**`],
    references:unique([...(op.references??[])]),
    checks:ctx?.work?.at?.workRoot?[{name:'work-tree-validates',command:validateCommandAt(ctx.work.at.workRoot)}]:[],
    acceptance:[`${node} is a valid Work node whose write scope is ${paths.join(', ')} and whose checks name its assertions`,
      'no product code changed: this operation writes the record, the node\'s own operation does the work',
      'the Work tree still validates'],origin:'ledger'},
    `shared change ${op.id} is ${op.sharedDepth??0} levels deep`);
  if(!author)return null;
  author.difficulty='hard';
  author.sharedAuthored=[...paths];
  store.appendEvent({event:'shared-authored',node,op:op.id,author:author.id,depth:op.sharedDepth??0,paths});
  pauseForShared(store,state,op,open,author,`the change is too deep to delegate again: ${author.id} authors the Work node ${node} for ${paths.join(', ')}, and that node's own operation makes the change`);
  return author;
}

/** One shared request: merge into an existing shared op, create one, or queue it for the next iteration. */
function requestSharedChange(store,state,op,{paths,detail,open=[]},ctx=null){
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
  // The Work tree is the kernel's record, never an operation's. An op that asked for record paths AND code paths
  // is split rather than stopped: the record paths are refused with one event and the code paths carry on as the
  // scoped shared op. A request that is record paths alone (or a read-only kind) is refused outright - told, in
  // its own terminal, to report again without them - and is never an item on the owner's list: the owner cannot
  // decide anything here, because the answer is a rule of the runtime.
  const codePaths=paths.filter(entry=>!ledgerPaths.includes(entry));
  if(ledgerPaths.length||graph.isReadOnly?.(op.kind)){
    const reason=ledgerPaths.length?'ledger path':'read-only kind';
    store.appendEvent({event:'ledger-path-refused',op:op.id,kind:op.kind,paths:ledgerPaths,
      continued:ledgerPaths.length&&codePaths.length?codePaths:[],reason});
    if(!ledgerPaths.length||!codePaths.length){
      const file=store.reportPath(op.dispatch);
      if(fs.existsSync(file))fs.renameSync(file,`${file}.answered-${op.reports.length}`);
      op.answer=`The Work tree is the kernel's own record: ${ledgerPaths.length?`${ledgerPaths.join(', ')} is not a change any operation may ask for`:`a ${op.kind} operation reads the tree and never changes it`}. The kernel writes \`state\`, \`completion\` and the kernel block itself. Report again naming only repository paths, or report what the record should say in \`open[]\` and let the kernel route it.`;
      op.status='answering';
      store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths,reason});
      return 'shared-change-refused';
    }
    paths=codePaths;
  }
  // A shared op that itself needs a shared change is a design problem, not a scheduling one - but a design
  // problem is work, not a question: at the depth limit the change becomes one Work node of its own, authored
  // by a `work.author` op and scheduled like any other node. Only paths outside this repository stay refused,
  // and those were already answered above.
  if((op.sharedDepth??0)>=SHARED_DEPTH_LIMIT){
    const authored=authorSharedNode(store,state,op,ctx,{paths,detail,open});
    if(authored)return 'shared-authored';
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'shared-depth',detail:`${op.id} is a shared change ${op.sharedDepth} levels deep and still needs ${paths.join(', ')}: ${detail}`});
    store.appendEvent({event:'shared-change-depth',op:op.id,depth:op.sharedDepth,paths,reason:'no feature folder in the tree to author a node under'});
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
export function drainSharedQueue(store,state,ctx=null){
  const queue=state.sharedQueue??[];
  if(!queue.length)return [];
  // Emptied first: a request the cap defers again re-queues itself through the same path.
  state.sharedQueue=[];
  const created=[];
  for(const request of queue){
    const op=byId(state,request.op);
    if(!op||op.status!=='paused')continue;
    if(requestSharedChange(store,state,op,request,ctx)==='shared-change')created.push(op.waitingFor);
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
    if(isAsk(shared.kind))continue;
    if(shared.status==='done'){
      op.status='ready';op.attempt+=1;op.waitingFor=null;
      delete op.blockedByDependency;
      op.priorOpen=[`shared change ${shared.id} done at ${shared.head??state.head??'unknown'}`];
      op.dispatch=null;op.terminal=null;op.nudged=false;
      store.appendEvent({event:'shared-change-resumed',op:op.id,shared:shared.id,head:shared.head??state.head??null});
      resumed.push(op.id);
      continue;
    }
    // A shared op blocked without a refusal is still alive - the kernel cools, re-admits or authors it - so its
    // requester keeps waiting; only a refused or failed shared change blocks the requester behind it.
    if(deadOp(shared)){
      op.status='blocked';op.blockedByDependency={id:shared.id,attempt:op.attempt};op.waitingFor=null;
      state.needUser.push({op:op.id,kind:'shared-change',detail:`${op.id} waits for the shared change ${shared.id}, which is ${shared.status}`});
      store.appendEvent({event:'shared-change-blocked',op:op.id,shared:shared.id,attempt:op.attempt});
    }
  }
  return resumed;
}

/** Re-admit only a dependency-block transition whose exact dependency later produced a completed operation. */
export function recoverSatisfiedDependencyBlocks(store,state,{events=null}={}){
  let history=events;const recovered=[];
  for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&!item.fill&&!item.ownerRequest)){
    if(op.v6Lease||op.v6Pending||op.dispatch||op.terminal)continue;
    if(state.needUser.some(item=>item.op===op.id&&['authority','decision','credential','provision'].includes(item.kind)))continue;
    const marker=plain(op.blockedByDependency)?op.blockedByDependency:null;
    let dependency=marker?.id??(typeof op.blockedByDependency==='string'?op.blockedByDependency:null),receipt=null;
    if(marker&&marker.attempt!==op.attempt)continue;
    if(!dependency){
      history??=store.readEvents();
      receipt=[...history].reverse().find(event=>event.event==='shared-change-blocked'&&event.op===op.id);
      dependency=receipt?.shared??null;
      if(receipt?.attempt!==undefined&&receipt.attempt!==op.attempt)continue;
      const index=receipt?history.lastIndexOf(receipt):-1;
      const allowed=new Set(['need-user-answered','owner-line-dropped','need-user-stale-dropped','terminals-swept']);
      if(index<0||history.slice(index+1).some(event=>event.op===op.id&&!allowed.has(event.event)))continue;
    }
    if(!dependency||(op.dependsOn??[]).includes(dependency)===false)continue;
    const shared=byId(state,dependency);
    if(!shared||isAsk(shared.kind)||shared.status!=='done'||shared.refusal)continue;
    op.status='ready';op.attempt=(op.attempt??1)+1;op.dispatch=null;op.terminal=null;op.nudged=false;delete op.blockedByDependency;
    op.priorOpen=[`shared change ${shared.id} later completed at ${shared.head??state.head??'unknown'}`];
    state.needUser=state.needUser.filter(item=>!(item.op===op.id&&item.kind==='shared-change'));
    store.appendEvent({event:'dependency-readmitted',op:op.id,dependency:shared.id,head:shared.head??state.head??null,proof:'shared-change-blocked receipt followed by completed dependency'});
    recovered.push(op.id);
  }
  return recovered;
}

/** Drop an old review line only when a later accepted review receipt verifies every ledger item it covered. */
export function sweepResolvedReviewLines(store,state){
  const dropped=[];
  state.needUser=state.needUser.filter(item=>{
    if(item.kind!=='review'||!item.op)return true;
    const old=byId(state,item.op),ids=old?.ledgerIds??[];
    if(old?.status!=='done'||!ids.length)return true;
    const key=groupKey(state,ids);
    if((state.verifyFindings?.[key]??[]).length)return true;
    const oldIndex=state.ops.indexOf(old);
    const resolved=ids.every(id=>{
      const ledger=ledgerItem(state,id);if(ledger?.status!=='verified')return false;
      return (ledger.evidence??[]).some(receipt=>receipt.kind==='review.verify'&&receipt.opId!==old.id&&typeof receipt.head==='string'&&receipt.head&&
        state.ops.some((review,index)=>index>oldIndex&&review.id===receipt.opId&&review.kind==='review.verify'&&review.status==='done'&&review.verdict==='pass'&&review.head===receipt.head&&
          (review.ledgerIds??[]).includes(id)));
    });
    if(!resolved)return true;
    dropped.push(item.op);store.appendEvent({event:'resolved-review-line-dropped',op:item.op,ledgerIds:ids,proof:'later accepted review receipt verifies every covered ledger item'});return false;
  });
  return dropped;
}

/** One strategic manager turn. The model chooses only ids whose executable meaning the kernel supplied. */
export function coordinateManagedWorkflow(store,state,ctx){
  if(state.engine?.coordination!=='agent-v1')return null;
  activatePendingOps(store,state);
  const continuations=state.ops.filter(op=>op.status==='ready'&&!op.fill&&!op.ownerRequest&&ctx.v6?.reservationPhase?.(op).phase==='reserved');
  if(continuations.length)return {pending:false,continuation:true,dispatch:continuations.map(op=>op.id)};
  const ready=state.ops.filter(op=>op.status==='ready'&&!op.fill&&!op.ownerRequest&&!op.v6Lease);
  const actions=ready.map(op=>({id:`${op.needsReplan?'replan':'dispatch'}:${op.id}`,type:op.needsReplan?'replan':'dispatch',opId:op.id,
    preconditions:[`status:${op.id}:ready`,'no-live-lease','approved-operation-boundaries'],summary:`${op.needsReplan?'Replan':'Dispatch'} ${op.id} (${op.kind})`,contextRefIds:[]}));
  if(verificationCandidates(state,ctx).length)actions.unshift({id:'plan-verification',type:'plan-verification',opId:null,preconditions:['completed-implementers','lane-ready','no-live-proof-for-group'],summary:'Plan the next mandatory verification from the canonical lane graph',contextRefIds:[]});
  const blockers=state.needUser.slice(0,48).map((item,index)=>({id:`blocker:${index}:${item.op??'workflow'}`,kind:['decision','authority','credential','provision'].includes(item.kind)?'owner':'technical',opId:item.op??null,summary:String(item.kind??'blocked')}));
  for(const [signature,entry] of Object.entries(state.anomalies??{}).filter(([,value])=>value.count>=TRIAGE_AFTER&&!value.triaged).slice(0,16))
    blockers.push({id:`anomaly:${blockers.length}`,kind:'technical',opId:entry.detail?.op??null,summary:`repeated anomaly: ${String(signature).slice(0,120)}`});
  state.engine.manager=plain(state.engine.manager)?state.engine.manager:{};
  const manager=state.engine.manager,now=ctx.now?.()??Date.now(),progressDigest=managerProgressDigest(state);
  if(manager.progressDigest!==progressDigest){manager.progressDigest=progressDigest;manager.noProgressRound=0;manager.incident=null;}
  const busy=state.ops.filter(op=>['running','answering'].includes(op.status)&&!op.fill&&!op.ownerRequest);
  const capacity={operationLimit:ctx.allocator?.maxParallelOps??null,nativeWriterLimit:ctx.v6?1:null,activeOperations:busy.length,globalAIJobLimit:10};
  const makeSnapshot=()=>buildManagerSnapshot({state,actions,blockers,capacity,noProgress:{round:manager.noProgressRound??0,budget:2}});
  let snapshot=makeSnapshot();
  if(!actions.length&&!manager.pendingSnapshot)return {pending:false,waiting:true,dispatch:[]};
  if(manager.incident?.basisDigest===snapshot.basisDigest)return {incident:true,dispatch:[]};
  if(manager.lastBasisDigest===snapshot.basisDigest&&Array.isArray(manager.lastActions)){
    const knownWait=busy.length>0||(ready.length>0&&ready.every(op=>/budget exhausted|cooling|no free slot|rate-limit|resource .*capacity|writer.*busy/i.test(String(op.deferral?.reason??''))));
    if(knownWait||now-(manager.lastAppliedAt??now)<60000)return {pending:false,cached:true,dispatch:manager.lastActions.filter(id=>id.startsWith('dispatch:')).map(id=>id.slice(9))};
    manager.noProgressRound=(manager.noProgressRound??0)+1;
    snapshot=makeSnapshot();
    if(manager.noProgressRound>2){manager.incident={kind:'manager-no-progress',basisDigest:snapshot.basisDigest,reason:'manager exhausted its bounded no-progress turns without executable progress or a known wait'};
      store.appendEvent({event:'manager-no-progress',round:manager.noProgressRound,budget:2});store.saveState(state);return {incident:true,dispatch:[]};}
  }
  // Drain a pending durable turn before requesting another. A changed semantic snapshot cannot adopt its decision.
  const requested=manager.pendingSnapshot??snapshot;
  Object.assign(manager,{version:requested.version,basisDigest:requested.basisDigest,pendingDecisionId:requested.decisionId,pendingDigest:requested.digest,pendingSnapshot:requested});
  store.saveState(state);
  let result;
  try{result=ctx.manageWorkflow(requested);}
  catch(error){if(isJobPending(error)){if(manager.pendingNoted!==requested.decisionId){manager.pendingNoted=requested.decisionId;store.appendEvent({event:'manager-pending',decisionId:requested.decisionId,digest:requested.digest});store.saveState(state);}return {pending:true,dispatch:[]};}
    manager.pendingSnapshot=null;manager.pendingDecisionId=null;manager.pendingDigest=null;
    if(error?.code==='STARCI_MODEL_QUOTA_WAIT'){
      const reason=String(error.message).slice(0,300);if(manager.quotaWait!==reason)store.appendEvent({event:'manager-quota-wait',reason});manager.quotaWait=reason;store.saveState(state);return {pending:true,quotaWait:true,dispatch:[]};}
    manager.incident={kind:'manager-unavailable',basisDigest:requested.basisDigest,reason:String(error?.message??error).slice(0,300)};
    store.appendEvent({event:'manager-unavailable',decisionId:requested.decisionId,reason:manager.incident.reason});store.saveState(state);return {incident:true,dispatch:[]};}
  manager.pendingSnapshot=null;manager.pendingDecisionId=null;manager.pendingDigest=null;
  if(requested.basisDigest!==snapshot.basisDigest||requested.generation!==snapshot.generation){
    store.appendEvent({event:'manager-stale-discarded',decisionId:requested.decisionId,currentDigest:snapshot.digest});store.saveState(state);return {pending:false,stale:true,dispatch:[]};}
  const decision=result?.value??result,checked=validateManagerDecision(decision,requested);
  if(!checked.ok){manager.incident={kind:'manager-invalid',reason:checked.reason,digest:requested.digest,basisDigest:requested.basisDigest};store.appendEvent({event:'manager-refused',decisionId:requested.decisionId,reason:checked.reason});store.saveState(state);return {pending:false,incident:true,dispatch:[]};}
  const dispatch=[];
  for(const id of checked.orderedActionIds){
    if(id==='plan-verification'){planVerifyOps(store,state,ctx);continue;}
    if(id.startsWith('replan:')){const op=byId(state,id.slice(7));if(op?.status==='ready'&&op.needsReplan&&!op.v6Lease&&!op.fill&&!op.ownerRequest){ctx.currentOp=op;replanOp(store,state,op,ctx);}continue;}
    if(id.startsWith('dispatch:')){const opId=id.slice(9),op=byId(state,opId);if(op?.status==='ready'&&!op.v6Lease&&!op.fill&&!op.ownerRequest)dispatch.push(opId);}
  }
  const rationale=String(decision.rationale).slice(0,500);
  Object.assign(manager,{lastDecisionId:requested.decisionId,lastDigest:requested.digest,lastBasisDigest:requested.basisDigest,lastActions:[...checked.orderedActionIds],lastRationale:rationale,lastAppliedIteration:state.iterations,lastAppliedAt:now,incident:null});
  store.appendEvent({event:'manager-applied',decisionId:requested.decisionId,digest:requested.digest,actions:checked.orderedActionIds,rationale});store.saveState(state);
  return {pending:false,dispatch};
}

function handleBlocked(store,state,op,report,ctx){
  const blocker=report.blocker??{kind:'environment',detail:report.summary};
  if(report.credentialRequest){
    const replacement=credentialReplacementFor(op,report,ctx);
    if(!replacement.ok)return retryOp(store,state,op,[replacement.reason],ctx,'credential-replacement-refused');
    const {custody,variables,replacements}=replacement;
    const text=`Replace the ${report.credentialRequest.reason} credential ${variables.join(', ')} in ${custody}; its declared live verification check rejected the tested version.`;
    const result=openOwnerAsk(store,state,op,{kind:'credential',text,options:[],inputRevision:JSON.stringify(replacements)},ctx,report);
    const ask=byId(state,op.waitingFor);
    if(ask)ask.credential={...(ask.credential??{}),custody,variables,replacements};
    return result;
  }
  if(blocker.kind==='shared-change'){
    // A record-authoring op (an intake, a migration, a node author) writes records under its allowlist and nothing
    // else: it has no code to change and nobody to delegate one to. One migration asked for the identity resource
    // it was only meant to declare and for the code that reads the variable, and the kernel dutifully opened a
    // shared op on product code. The answer is the rule, in the op's next attempt.
    if(authorsRecord(op.kind)&&!plain(op.cut)){
      store.appendEvent({event:'shared-change-refused',op:op.id,kind:op.kind,paths:ctx.guards.parseSharedChangePaths?.(String(blocker.detail??''))??[],reason:'record-authoring op'});
      return retryOp(store,state,op,[`A ${op.kind} operation writes records under its allowlist and asks for no shared change: a credential's custody (\`identity:<slug>\`) is declared, never created - the owner creates it when the integration is proven - and the code that reads a variable is never yours to change. Write the declarations, leave everything else, and report done.`],ctx,'record-authoring-shared-change');
    }
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
    return requestSharedChange(store,state,op,{paths,detail:blocker.detail,open:[...(report.open??[])]},ctx);
  }
  // A frontend build that has no design to build from is drawn first, never guessed at.
  if(blocker.kind==='interface-gap'){
    reopenInterface(store,state,op,report,blocker,ctx);
    return 'interface-gap';
  }
  // A shape the installed grammar cannot render is grown into the grammar, once, never invented beside it.
  if(blocker.kind==='grammar-gap')return growGrammar(store,state,op,report,blocker,ctx);
  // A requirement the SRS does not settle is revised in the business record - the runtime states the readings,
  // takes the most reasonable one and says why - never guessed at in a design or in code.
  if(blocker.kind==='srs-gap'){
    if(ctx.work&&reopenBusiness(store,state,op,report,ctx,blocker))return 'srs-gap';
    // No Work tree, or no business node to revise: the requirement is the owner's and the kernel says so.
    op.status='blocked';
    state.needUser.push({op:op.id,kind:'srs-gap',detail:`${blocker.detail} (no requirement record to revise)`});
    routed(store,op,'srs-gap','needUser',null,{then:routeOf({blocker:'srs-gap',kind:op.kind})?.then??null});
    return 'escalate-to-user';
  }
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
  // Something only the owner can provide - a credential, an account on an outside system, a real dataset, a
  // legal authority - or an effect nobody can undo: the question is prepared for them, naming the exact thing,
  // instead of a bare line nobody answers. Both pause the op that asked, because there is nothing honest to do.
  const stop=stopReasonFor({kind:blocker.kind,text:blocker.detail});
  if(['environment','authority'].includes(blocker.kind)&&stop)
    return openOwnerAsk(store,state,op,{kind:stop,text:blocker.detail,options:[]},ctx,report);
  // An `authority` block that names nothing the owner must provide is a decision the records do not settle: the
  // runtime takes it on its own recommendation and carries on, and the owner answers whenever they like.
  if(blocker.kind==='authority')return openOwnerAsk(store,state,op,{kind:'decision',text:blocker.detail,options:[]},ctx,report);
  // `environment` and anything the graph has no rule for: the user decides, the kernel does not guess.
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
  if(op.integrationPreparation){store.appendEvent({event:'integration-preparation-authored',op:op.id,owner:op.integrationPreparation.owner});return 'integration-preparation-authored';}
  if(isAsk(op.kind)){settleOwnerAsk(store,state,op,op.reports.at(-1)??{});return 'owner-ask-settled';}
  // A node authored for a shared change closes nothing and completes no existing record: the tree is re-read so
  // the next sync sees the new node, and the requester is released by `resumePaused` like any other shared op.
  if(Array.isArray(op.sharedAuthored)){
    try{const loaded=ctx.work.api.loadLedger({...ctx.work.at,validate:ctx.work.validate});if(loaded.ok)ctx.work.loaded=loaded;}
    catch(error){store.appendEvent({event:'ledger-sync-failed',op:op.id,reason:error.message});}
    store.appendEvent({event:'shared-node-authored',op:op.id,paths:op.sharedAuthored,allowlist:op.allowlist});
    return 'shared-node-authored';
  }
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
    const outcome=(report.open??[]).length?'partial':'done';
    store.appendEvent({event:'validator-only-block',op:op.id,from:report.outcome,to:outcome,note:'the kernel owns the whole-tree validator and judges it by what this operation could have caused'});
    // The failing tree check leaves the report: the kernel adds its own, scoped, at acceptance.
    report={...report,outcome,blocker:undefined,checks:(report.checks??[]).filter(check=>!(check.exitCode!==0&&/work-valid|work-tree-validates/i.test(check.name??''))),...(outcome==='partial'?{open:[...(report.open??[]),'previous attempt was blocked only by the whole-tree validator; the kernel validates at acceptance, scoped to this operation']}:{}),blocker:null,signal:{type:'worker_done',orcaOutcome:'succeeded'}};
  }
  const checked=validateReport(report,{allowlist:reportAllowlist(op,ctx)});
  op.reports.push({attempt:op.attempt,runtime:op.runtime,outcome:report.outcome,summary:report.summary,
    files:report.files,open:report.open,checks:report.checks,blocker:report.blocker,question:report.question,
    ...(checked.ok&&report.credentialRequest?{credentialRequest:report.credentialRequest}:{}),valid:checked.ok});
  if(!checked.ok){
    store.appendEvent({event:'report-rejected',op:op.id,errors:checked.errors});
    return retryOp(store,state,op,checked.errors.map(error=>`your previous report was rejected: ${error}`),ctx,'report-rejected');
  }
  store.appendEvent({event:'report',op:op.id,outcome:report.outcome,runtime:op.runtime,attempt:op.attempt});
  if(ctx.v6&&authorsRecord(op.kind)&&typeof op.recordBlocks==='string'){
    const current=recordBlocks(ctx,op.nodeId),before=(()=>{try{return JSON.parse(op.recordBlocks);}catch{return null;}})(),after=(()=>{try{return JSON.parse(current);}catch{return null;}})();
    const owned=plain(op.cut)?CUT_OWNED:RECORD_OWNED,keys={state:'state',completion:'completion','extensions.work3.kernel':'kernel'};
    const changed=current===null||!before||!after||owned.some(name=>JSON.stringify(before[keys[name]??name]??null)!==JSON.stringify(after[keys[name]??name]??null));
    if(changed){
      op.v6Pending={kind:'protected-record-quarantine',blocks:owned,paths:op.allowlist??[]};
      store.appendEvent({event:'record-blocks-quarantined',op:op.id,node:op.nodeId,blocks:owned,paths:op.allowlist??[]});
      return 'acceptance-pending';
    }
  }
  // The kernel-owned ledger paths are reverted before anything is verified, and writing them is never accepted.
  const touched=ctx.v6?[]:guardKernelPaths(store,state,op,ctx);
  if(touched.length){
    op.reports.at(-1).downgradedTo='failed';
    return retryOp(store,state,op,[`operation modified kernel-owned ledger paths: ${touched.join(', ')}`],ctx,'kernel-paths-modified');
  }
  // The record-authoring op holds its own node's index.yaml, so the blocks inside it the kernel owns are guarded
  // by comparison rather than by path. A changed block is the same refusal as a written kernel path.
  const blocks=ctx.v6?[]:guardRecordBlocks(store,state,op,ctx);
  if(blocks.length){
    op.reports.at(-1).downgradedTo='failed';
    return retryOp(store,state,op,[`operation modified kernel-owned fields (${(plain(op.cut)?CUT_OWNED:RECORD_OWNED).join(', ')}) of the Work record it authors: ${blocks.join(', ')}`],ctx,'record-blocks-modified');
  }
  // An ask op that found the answer - in a decided record, from the owner in its tab, or as a provision present -
  // has done its job whatever outcome it wrote: the marker is the ruling, and a `blocked` beside it is noise
  // (one ask answered from a record, then asked for a Work path it had no business with, and died four times
  // being told so). No check of its own is owed: the answer is the record's, and the requester carries it.
  const askMarker=isAsk(op.kind)&&report.outcome!=='done'?(String(report.summary??'').match(/^\s*(answered-from|answered-by-owner|credential|provided):/i)??[])[1]??null:null;
  if(askMarker){
    op.status='done';op.dispatch=null;op.terminal=null;op.nudged=false;
    store.appendEvent({event:'owner-ask-marker-honoured',op:op.id,outcome:report.outcome,marker:askMarker.toLowerCase()});
    settleOwnerAsk(store,state,op,report);
    return 'owner-ask-settled';
  }
  if(report.outcome==='done'){
    let acceptedOwnerEvidence=null,acceptedOwnerAcceptance=null;
    if(op.integrationPreparation){
      let fingerprint=null;try{fingerprint=preparationFingerprint(ctx.work.api.readNode(ctx.work.at,ctx.work.node(op.nodeId)));}catch{}
      const prepared=work.declaredIntegrations(ctx.work.loaded).list.filter(entry=>entry.declaredBy===op.integrationPreparation.owner);
      const errors=prepared.flatMap(entry=>integrationReadiness(entry,{now:clockOf(ctx)}).errors);
      if(!prepared.length||errors.length||!fingerprint||fingerprint!==op.preparationBefore)
        return retryOp(store,state,op,[...errors,...(!prepared.length?['The owning integration declaration is missing.']:[]),
          ...(!fingerprint||fingerprint!==op.preparationBefore?['The research repair changed content outside preparation or has no valid launch baseline.']:[])],ctx,'integration-preparation-invalid');
    }
    if(ctx.v6&&op.v6Candidate?.status!=='sealed'){
      const frozen=ctx.v6.freezeCandidate(op,{reportedFiles:report.files??[]});
      if(frozen.status!=='sealed'){
        op.v6Pending={kind:'candidate-quarantine',reasons:frozen.reasons??['candidate could not be sealed']};
        store.appendEvent({event:'candidate-quarantined',op:op.id,reasons:op.v6Pending.reasons,observedFiles:frozen.observedFiles??[]});
        return 'acceptance-pending';
      }
    }
    if(ctx.v6&&op.v6Candidate?.bridge?.dependency?.command&&!op.v6Candidate?.dependency?.ready){const dependency=ctx.v6.prepareCandidateDependencies(op);if(!dependency.ready){op.v6Pending={kind:'candidate-dependencies',reason:dependency.evidence};return 'acceptance-pending';}}
    const candidateRoot=ctx.v6?ctx.v6.candidateCwd(op):null,candidateWork=ctx.v6&&ctx.work?{...ctx.work,repoRoot:candidateRoot,
      ledger:{...ctx.work.ledger,repoRoot:candidateRoot,workRoot:path.join(candidateRoot,'.starciwork')},
      at:plain(ctx.work.at)?{...ctx.work.at,repoRoot:candidateRoot,workRoot:path.join(candidateRoot,'.starciwork')}:ctx.work.at}:ctx.work;
    const verifyCtx=ctx.v6?{...ctx,work:candidateWork,cwd:candidateRoot,exec:(command,options)=>ctx.v6.candidateCheck(command,options,op)}:ctx;
    const verified=machineVerify(state,op,verifyCtx);
    // `work-valid` is the kernel's own check and is stripped from every operation's list, so an op that edits the
    // tree is held to it here: the record it wrote must leave a tree that still validates, before anything is committed.
    if((ctx.v6&&writesWorkRecords(op.kind,{profile:ctx.kindsProfile}))||authorsRecord(op.kind)){
      const command=workValidateCommand(ctx);
      // Scoped to what this op could have caused, the way a node's own proof is judged: an error under a path
      // another workflow owns is evidence in the check, never this op's failure.
      const verdict=treeVerdictFor(verifyCtx,op);
      const tree={ok:verdict.ok,reason:verdict.ok
        ?(verdict.foreign.length?`${verdict.foreign.length} error(s) elsewhere in the tree are outside this operation`:null)
        :verdict.own.map(error=>`${error.code} ${error.path??''}`).join('; ')};
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
    const files=ctx.v6?[...(op.v6Candidate?.observedFiles??[])]:changedFiles(state,op,ctx,op.allowlist,{exclude:op.kernelOwned??[]});
    // Every changed file this op is answerable for is mapped to a record kind, and a file whose kind this op does
    // not declare in `writes` is a defect the machine can name on its own: no model is asked, and the report goes
    // back with the finding. Answerable means claimed: a project's repositories share one Work tree, so a record
    // a frontend lane is writing right now is dirty in the backend's worktree, and an allowlist that happens to
    // cover it is not evidence that this op wrote it. `attributedFiles` keeps the files the op itself reported,
    // over every attempt it made, so its own uncommitted work from an earlier attempt still counts.
    // `ctx.kindsProfile` is the profile to read it against: null is the compiled one, and a caller that runs the
    // kernel against an authored or a fixture profile hands that one in instead of rebuilding `.dist` for it.
    const kindVerdict=producedKindVerdict(op,files,ctx),produced=kindVerdict.produced,undeclared=kindVerdict.undeclared;
    if(!kindVerdict.ok){
      const finding=`record-kind validation was unavailable: ${kindVerdict.error}`;
      op.reports.at(-1).downgradedTo='failed';store.appendEvent({event:'io-kind-validation-unavailable',op:op.id,reason:finding});
      return retryOp(store,state,op,[finding],ctx,'io-kind-validation-unavailable');
    }
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
    if(ctx.v6){
      const manifest=protectedOracleManifest(op.v6Candidate.bridge,op,{expectedBaseFailures:op.expectedBaseFailures??{}});
      const plan=planProtectedProof(op,{oracleManifest:manifest,candidateChanges:files,policy:op.proofPolicy??null});
      const proofExec=(command,options)=>ctx.v6.check(command,{...options,env:op.v6Candidate?.dependency?.checkEnv},op);
      const proof=runProtectedProof({plan,baseRoot:op.v6Candidate.snapshot.baseRoot,candidateRoot:op.v6Candidate.snapshot.workerRoot,
        oracleRoot:op.v6Candidate.snapshot.oracleRoot,exec:proofExec,timeoutMs:op.timeoutMs??CHECK_TIMEOUT_MS});
      op.proof={verdict:proof.verdict,manifestDigest:proof.manifestDigest??null};
      store.appendEvent({event:'proof',op:op.id,verdict:proof.verdict,manifestDigest:proof.manifestDigest??null});
      if(proof.verdict!=='pass'){
        op.v6Pending={kind:'protected-proof',verdict:proof.verdict,detail:protectedProofFinding(proof)};
        return 'acceptance-pending';
      }
    }else{
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
    }
    // The validator judges what the machine could not: a reject is a contradiction of the report, the op comes
    // back with the findings; a second reject of the same op stops it at the user instead of a third launch.
    const validation=validateAccepted(store,state,op,ctx.v6?{...verifyCtx,v6Candidate:op.v6Candidate}:ctx,{files,verified,produced});
    if(ctx.v6&&!['accept','reject'].includes(validation.verdict)){
      op.v6ReviewRound=(op.v6ReviewRound??0)+1;
      op.v6Pending={kind:'required-validation',verdict:validation.verdict,round:op.v6ReviewRound};
      store.appendEvent({event:'acceptance-pending',op:op.id,attempt:op.attempt,gate:'independent-review',verdict:validation.verdict});
      if(op.v6ReviewRound>=3){op.status='blocked';op.incidentSignature='validator-unavailable';state.needUser.push({op:op.id,kind:'environment',detail:'Required independent validation is unavailable; the candidate remains unaccepted.'});}
      return 'acceptance-pending';
    }
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
    if(ctx.v6){
      const candidate=op.v6Candidate.packet;
      const acceptanceCriteria=(op.acceptance??[]).map(value=>String(value).trim()).filter(Boolean);
      if(!acceptanceCriteria.length){op.v6Pending={kind:'required-acceptance',blocking:['operation has no explicit acceptance criteria to bind evidence']};return 'acceptance-pending';}
      const candidateIdentity=Object.fromEntries(['workflowId','opId','attempt','generation','jobId'].map(field=>[field,candidate[field]]));
      const receiptRelative=`evidence/${candidate.jobId}-validation.json`,receiptFile=path.join(store.dir,receiptRelative);
      const receipt={schema:'starci/validation-receipt@1',identity:candidateIdentity,candidateDigest:candidate.candidateDigest,
        checks:verified.checks,validation,acceptanceCriteria,createdAt:candidate.sealedAt};
      fs.mkdirSync(path.dirname(receiptFile),{recursive:true});
      const receiptBytes=`${JSON.stringify(receipt,null,2)}\n`;
      if(!fs.existsSync(receiptFile))fs.writeFileSync(receiptFile,receiptBytes,{flag:'wx'});
      else if(fs.readFileSync(receiptFile,'utf8')!==receiptBytes){op.v6Pending={kind:'required-acceptance',blocking:['immutable validation receipt conflicts with this attempt']};return 'acceptance-pending';}
      const ownerEvidence={schema:'starci/evidence-packet@1',...candidateIdentity,gateId:'independent-review',gateKind:'semantic-review',
          owner:validation.provider??'validator',ownerAttemptId:validation.reviewerAttemptId,independentFromAttempt:validation.independentFromAttempt,
          candidateDigest:candidate.candidateDigest,oracleDigest:candidate.oracleDigest,environmentDigest:candidate.environmentDigest,complete:validation.complete,
          startedAt:new Date(op.launchedAt??Date.now()).toISOString(),finishedAt:new Date().toISOString(),verdict:validation.verdict==='accept'?'pass':'fail',
          assertions:acceptanceCriteria.map((criterion,index)=>({id:`acceptance-${index+1}`,sourceRef:`${op.nodeId??op.id}#acceptance-${index+1}`,
            criterion,outcome:validation.verdict==='accept'?'pass':'fail',evidenceRefs:['validator']})),
          artifacts:[{id:'validator',path:receiptRelative,sha256:crypto.createHash('sha256').update(fs.readFileSync(receiptFile)).digest('hex')} ]};
      const acceptance=evaluateAcceptance({requirements:[{id:'independent-review',required:true,independent:true}],evidence:[ownerEvidence],
        candidate,identity:candidateIdentity,evidenceRoots:{'independent-review':store.dir}});
      if(!acceptance.admitIntegration){op.v6Pending={kind:'required-acceptance',blocking:acceptance.blocking};return 'acceptance-pending';}
      const resolved=resolveEvidencePacket(ownerEvidence,{evidenceRoot:store.dir,requireIndependent:true});
      if(!resolved.ok){op.v6Pending={kind:'required-acceptance',blocking:resolved.errors};return 'acceptance-pending';}
      acceptedOwnerEvidence=resolved.packet;acceptedOwnerAcceptance=acceptance;
      const prepared=prepareCandidateIntegration(op.v6Candidate.snapshot,candidate,{canonicalRoot:state.worktree,git:ctx.git,
        ignoreCanonicalPaths:[],mode:'detection-canonical'});
      if(prepared.status!=='ready'){op.v6Pending={kind:'integration-quarantine',reasons:prepared.reasons};return 'acceptance-pending';}
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
    if(op.kind==='integration.verify'&&acceptedOwnerEvidence&&acceptedOwnerAcceptance){
      const ownerVerified=verifyAcceptedIntegrationOwnerRequests(state,{op,evidence:acceptedOwnerEvidence,acceptance:acceptedOwnerAcceptance,now:ctx.now??Date.now,
        receiptFor:({request})=>kernelVerificationReceipt({id:`provider-${crypto.createHash('sha256').update(`${request.id}:${op.id}:${op.attempt}:${acceptedOwnerEvidence.candidateDigest}`).digest('hex').slice(0,32)}`,
          requestId:request.id,evidence:acceptedOwnerEvidence,acceptance:acceptedOwnerAcceptance})});
      for(const result of ownerVerified)store.appendEvent({event:result.ok?'owner-credential-verified':'owner-credential-verification-rejected',op:op.id,request:result.requestId,ask:result.opId,code:result.code});
    }
    // An author op closes no node: it completed a record, so what follows is the ledger's answer, not a completion.
    // An ask op closes no node either: it prepared a decision, answered a question or confirmed a provision.
    if(authorsRecord(op.kind)||isAsk(op.kind)){
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

/**
 * The decided records a set of findings actually cites: an SRS or SDS record of the tree, `done`, named by its
 * id inside the finding text. That is the whole test for "the reviewer is arguing with a decision that exists".
 */
const DECIDED_RECORD=/(^|\/)(business\/srs|architecture\/sds)(\/|$)/;
function citedDecidedRecords(ctx,findings){
  const list=ctx?.work?.loaded?.list??[];
  const text=(findings??[]).map(item=>typeof item==='string'?item:JSON.stringify(item)).join('\n');
  return unique(list.filter(node=>node.state==='done'&&DECIDED_RECORD.test(slash(node.path??''))
    &&typeof node.id==='string'&&node.id&&text.includes(node.id)).map(node=>node.id));
}
/** The runtime the allocator would pick for this kind if it were asked now; null when it cannot say. */
const previewRuntime=(ctx,kind,avoid)=>{try{return ctx.allocator?.review?.(kind,{avoid})?.ready?.[0]?.runtime??null;}catch{return null;}};
/** How often one reviewed group may be escalated inside the runtime in one day: twice its review rounds. */
const escalationCap=()=>reviewRounds()*2;
/** The escalations this group has already had today; a new day starts the bound again. */
const escalationsToday=(state,ctx,key)=>{
  const day=new Date(clockOf(ctx)).toISOString().slice(0,10);
  const entry=state.verifyEscalations?.[key];
  return plain(entry)&&entry.day===day?Number(entry.count)||0:0;
};
/**
 * How many review rounds one group may use: its route's limit, plus one for every escalation the runtime has
 * granted it today. An escalation buys the group a repair AND the review that judges it - a repair nobody
 * reviews proves nothing - and the escalations themselves are capped, so the two bounds together terminate.
 */
const reviewRoundsFor=(state,ctx,key)=>reviewRounds()+escalationsToday(state,ctx,key);
/**
 * A spent review bound is a MECHANICAL bound, and a mechanical bound never becomes a question for the owner: it
 * escalates inside the runtime. The escalation is always one more repair round, on the strongest implement
 * runtime that has not worked this group yet - and the findings decide where its ruling comes from.
 *
 * When the last findings cite a decided record - an SRS or SDS record of this tree, by id - the argument is with
 * work that exists, and the repair reads those records. When they cite no decided record at all, the reviewer
 * and the builder are disagreeing about something nobody ever decided: that is a HIDDEN DECISION, put to the
 * owner as a provisional question (rule 1), and the repair waits for the recommendation and carries it. Only a
 * group that has spent its escalations for the day is parked for the owner, and that is the bound on the bound.
 */
function escalateVerify(store,state,ctx,{key,ledgerIds,findings,op}){
  const day=new Date(clockOf(ctx)).toISOString().slice(0,10);
  const count=escalationsToday(state,ctx,key);
  const cited=citedDecidedRecords(ctx,findings);
  const review=op??state.ops.filter(item=>item.kind==='review.verify'&&item.ledgerIds.some(id=>ledgerIds.includes(id))).at(-1)??null;
  if(count<escalationCap()){
    const implementers=state.ops.filter(item=>implementsLedger(item)&&item.ledgerIds.some(id=>ledgerIds.includes(id)));
    const used=unique(implementers.map(item=>item.runtime).filter(Boolean));
    const route=routeOf({verdict:'fail',kind:review?.kind??'review.verify'})??{kind:'lane-build',origin:'repair',then:'retry'};
    const kind=routeKind(route,state,review??{kind:'review.verify',ledgerIds})??'backend.implement';
    // The repair's scope is composed from other operations' allowlists, so the Work tree is dropped from it
    // unless the repair's own kind authors records: a drawing op in the group would otherwise hand a code builder
    // the records another lane is writing in the one shared tree, which is how a repair gets blamed for them.
    const composed=unique(implementers.flatMap(item=>item.allowlist??[]));
    const allowlist=writesWorkRecords(kind,{profile:ctx?.kindsProfile??null})?composed:buildScope(composed);
    const repair=allowlist.length?addOp(store,state,{kind,
      goal:cited.length
        ?`Resolve the review findings of ${key} against the decided records they cite (${cited.join(', ')}). The ordinary review rounds are spent: read those records first and change the code to match them, or report \`blocked\` with \`sds-gap\` naming the record that cannot be met.`
        :`Resolve the review findings of ${key}. Its reviewers keep disagreeing with its builders about a rule no decided record states, so the runtime is settling that rule now: the ruling reaches you as the answer to the question you inherit, and you build to it.`,
      ledgerIds:[...ledgerIds],allowlist,
      references:unique([...implementers.flatMap(item=>item.references??[]),...cited]),
      checks:dedupeChecks(implementers.flatMap(item=>item.checks??[])),
      acceptance:unique(implementers.flatMap(item=>item.acceptance??[])),
      findings:[...findings],avoidRuntimes:used,origin:'repair'},`review escalation of ${key}`):null;
    if(repair){
      repair.difficulty='hard';repair.reviewGeneration=state.engine?.generation??0;
      for(const id of ledgerIds){const item=ledgerItem(state,id);if(item&&item.status==='verified')item.status='implemented';}
      state.verifyEscalations={...(plain(state.verifyEscalations)?state.verifyEscalations:{}),[key]:{day,count:count+1}};
      store.appendEvent({event:'verify-escalated',group:key,component:key,round:count+1,cap:escalationCap(),
        runtime:previewRuntime(ctx,kind,used),avoid:used,cited,hidden:!cited.length,op:repair.id});
      if(!cited.length){
        store.appendEvent({event:'verify-hidden-decision',group:key,component:key,rounds:state.verifyRounds[key]??0,
          findings:findings.slice(0,3),op:repair.id});
        // Prepared by the kernel, so provisional by construction: the sentence quotes the finding, and a finding that
        // mentions a token or a bank is what the decision is ABOUT, never a request for one (two hidden decisions of
        // the chatbot review were once read as credential questions and waited for the owner over nothing).
        openOwnerAsk(store,state,repair,{kind:'hidden-decision',prepared:true,
          text:`The review of ${key} keeps failing and its findings cite no decided record: ${findings[0]??'no finding text'}. Which rule should hold here? State the numbered options and recommend one; the runtime takes the recommendation and carries on, and the owner may answer differently later.`,
          options:[]},ctx);
        const ask=byId(state,repair.waitingFor);if(ask)ask.reviewGeneration=repair.reviewGeneration;
      }
      return 'verify-escalated';
    }
  }
  for(const id of ledgerIds){const item=ledgerItem(state,id);if(item)item.status='review-exhausted';}
  state.needUser.push({...(review?{op:review.id}:{}),kind:'review',
    detail:`${key} still fails review after ${state.verifyRounds[key]??reviewRounds()} rounds and ${count} escalation(s) inside the runtime: ${findings[0]??'no finding text'}`});
  store.appendEvent({event:'verify-parked',group:key,component:key,rounds:state.verifyRounds[key]??0,cited,escalations:count});
  return 'verify-parked';
}

/** A review that found something becomes one repair operation; the next review is created when it is done. */
function repairFromVerify(store,state,op,findings,ctx){
  op.verdict='fail';
  const key=groupKey(state,op.ledgerIds);
  const route=routeOf({verdict:'fail',kind:op.kind})??{kind:'lane-build',origin:'repair',then:'retry',limit:VERIFY_ROUNDS};
  const rounds=reviewRoundsFor(state,ctx,key);
  for(const id of op.ledgerIds){const item=ledgerItem(state,id);if(item&&item.status==='verified')item.status='implemented';}
  // The last findings of this group are kept, because the escalation is decided from what they cite, and the
  // stage that decides it (`planVerifyOps`) runs a tick later with no report in its hands.
  if(findings.length)state.verifyFindings={...(plain(state.verifyFindings)?state.verifyFindings:{}),[key]:findings.slice(0,10)};
  if((state.verifyRounds[key]??1)>=rounds){
    store.appendEvent({event:'verify-limit',op:op.id,component:key,findings:findings.slice(0,3)});
    return escalateVerify(store,state,ctx,{key,ledgerIds:[...op.ledgerIds],findings,op});
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

/**
 * The whole-tree validator is the kernel's gate, and the kernel judges it by what the op could have caused. An
 * operation that ran the raw command, saw a red corner another workflow owns (a frontend design whose assets
 * have not landed yet) and reported `blocked` or `failed` over it has done its work: the report is read as
 * `done` when it carries no open item (`partial` when it does), and the kernel's scoped verdict decides.
 */
function validatorOnlyBlock(report){
  if(!['blocked','failed'].includes(report?.outcome))return false;
  const failing=(report.checks??[]).filter(check=>check.exitCode!==0);
  if(!failing.length||!failing.every(check=>/work-valid|work-tree-validates/i.test(check.name??'')))return false;
  const blocker=report.blocker;
  return !plain(blocker)||/\.starciwork|work-valid|validat|asset/i.test(`${blocker.kind??''} ${blocker.detail??''}`);
}

/** Quarantine is a visible incident, never an indefinitely polling successful worker. */
export function quarantineCandidate(store,state,op,pending){
  const signature=crypto.createHash('sha256').update(JSON.stringify(pending)).digest('hex');
  op.v6Pending=pending;op.status='blocked';op.refusal='runtime-reconciliation';
  if(op.quarantineSignature!==signature){
    op.quarantineSignature=signature;
    store.appendEvent({event:'candidate-reconciliation-required',op:op.id,attempt:op.attempt,...pending});
    state.needUser??=[];
    state.needUser=state.needUser.filter(item=>item.op!==op.id||item.code!=='candidate-reconciliation');
    state.needUser.push({op:op.id,kind:'environment',code:'candidate-reconciliation',detail:
      `The frozen result remains unaccepted: ${pending.kind}. Reconcile the recorded evidence before another writer starts; the writer reservation is retained.`});
  }
  store.saveState(state);
}

function acceptReports(orca,store,state,ctx){
  // The report file is the source of truth: a report whose Orca signal failed to send is still a report.
  const reports=store.readReports().filter(report=>report?.dispatch&&report?.outcome);
  const actions=[];
  for(const op of state.ops.filter(item=>item.status==='running')){
    const report=reports.find(item=>item.dispatch===op.dispatch);
    if(!report)continue;
    const dispatch=op.dispatch,runtime=op.runtime;
    ctx.currentOp=op;
    if(ctx.v6&&report.outcome==='done'&&!op.v6WorkerSettled){
      const settled=settleDispatch(orca,dispatch,{cwd:state.worktree,reason:'freeze candidate before independent acceptance',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
      if(settled.effectState!=='none'){quarantineCandidate(store,state,op,{kind:'dispatch-reconciliation',effectState:settled.effectState});continue;}
      op.v6WorkerSettled=true;
      ctx.v6.settled(op,{reason:'native worker settled before acceptance',workerOnly:true});
    }
    if(ctx.v6&&report.outcome==='done'&&op.v6WorkerSettled&&op.v6Candidate?.status!=='sealed'){
      const frozen=ctx.v6.freezeCandidate(op,{reportedFiles:report.files??[]});
      if(frozen.status!=='sealed'){
        quarantineCandidate(store,state,op,{kind:'candidate-quarantine',reasons:frozen.reasons??['candidate could not be sealed'],observedFiles:frozen.observedFiles??[]});continue;
      }
      store.saveState(state);
    }
    const before=ctx.v6?structuredClone(op):null;
    let action;
    try{action=applyOpReport(orca,store,state,op,report,ctx);}
    catch(error){
      if(!ctx.v6||(!isJobPending(error)&&error?.code!=='STARCI_MODEL_QUOTA_WAIT'))throw error;
      for(const key of Object.keys(op))delete op[key];Object.assign(op,before);
      op.v6Pending=error?.code==='STARCI_MODEL_QUOTA_WAIT'?{kind:'model-quota-wait',status:'waiting',reason:String(error.message).slice(0,240)}:{kind:'durable-job',jobId:error.job?.identity?.jobId,status:error.job?.status};
      store.saveState(state);continue;
    }
    if(ctx.v6&&action==='acceptance-pending'){
      if(/quarantine|protected-proof|candidate-dependencies|required-acceptance/.test(op.v6Pending?.kind??''))quarantineCandidate(store,state,op,op.v6Pending);
      continue;
    }
    delete op.v6Pending;
    actions.push({op:op.id,action});
    state.stalls=0;
    if(op.status!=='answering'){
      ctx.allocator.release(runtime,{op:op.id});
      if(!ctx.v6||!op.v6WorkerSettled)orca.invoke('worker-release',{dispatch},{cwd:state.worktree});
      if(ctx.v6&&op.v6Lease&&op.status!=='running'){
        const settled=op.v6WorkerSettled?{effectState:'none'}:settleDispatch(orca,dispatch,{cwd:state.worktree,reason:'settle reported operation',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
        if(settled.effectState==='none')ctx.v6.settled(op);
      }
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
export function verificationCandidates(state,ctx){
  const ready=state.ledger.filter(item=>item.status==='implemented').map(item=>item.id)
    .filter(id=>laneWantsReview(state,id,ctx))
    .filter(id=>{
      const ops=state.ops.filter(op=>op.ledgerIds.includes(id));
      return ops.some(implementsLedger)&&ops.filter(implementsLedger).every(op=>op.status==='done')
        &&!ops.some(op=>kindRole(op.kind)==='verify'&&op.origin==='verify'&&liveStatus.includes(op.status));
    });
  return verifyComponents(state,ready).map(component=>[...component].sort()).filter(ids=>!groupIncomplete(state,ids));
}
function planVerifyOps(store,state,ctx){
  const created=[];
  for(const ledgerIds of verificationCandidates(state,ctx)){
    const key=groupKey(state,ledgerIds);
    // One proof per group: a cut parent whose children are not all implemented yet waits for the rest of them.
    if(groupIncomplete(state,ledgerIds))continue;
    const kind=groupVerifyKind(state,ledgerIds);
    const review=kind==='review.verify';
    // The review of one group is bounded, and the bound is mechanical: it escalates inside the runtime - one more
    // repair round against the decided records the findings cite, or a provisional question when they cite none -
    // instead of becoming a line on the owner's list that nobody can act on.
    if(review&&(state.verifyRounds[key]??0)>=reviewRoundsFor(state,ctx,key)){
      store.appendEvent({event:'verify-exhausted',component:key,group:key,rounds:state.verifyRounds[key]});
      escalateVerify(store,state,ctx,{key,ledgerIds,findings:state.verifyFindings?.[key]??[],op:null});
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
  // paths from a design op's allowlist and committed a kernel block into a frontend record. Narrower when the
  // gate's own evidence names the files: a typecheck that fails in two files is a two-file repair, and a repair
  // holding the whole job's allowlist held every other operation behind it for a morning. What it turns out to
  // need beyond those files it asks for as a shared change, like any build.
  const whole=buildScope(state.ops.flatMap(op=>op.allowlist));
  const named=unique(failed.flatMap(result=>pathsIn(result.evidence))).filter(file=>inside(file,whole));
  const scope=named.length?named:whole;
  if(named.length)store.appendEvent({event:'gate-scope-narrowed',gates:failed.map(result=>result.name),files:named});
  addOp(store,state,{kind:'backend.implement',goal:`Make the job gates pass: ${failed.map(result=>result.name).join(', ')}`,
    ledgerIds:[],allowlist:scope,references:[],
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
  dedupeNeedUser(state);
  // A decision the runtime took for the owner is not a reason to finish blocked - the work is real and the
  // recommendation is recorded - but it is never silent either: the report says which, and how to answer them.
  const provisional=(state.provisional??[]).map(entry=>({...entry,answerWith:answerCommand(state,entry.op)}));
  const final={schema:FINAL_REPORT,id:state.id,job:state.job,outcome,reason,branch:state.branch,head:state.head,
    lane:laneView(state),
    ledgerMode:state.ledgerMode,scope:state.scope,ledgerSummary:refreshLedgerSummary(state,ctx),decisions:state.decisions,brand:state.brand??null,
    ledgerRoot:state.ledgerRoot?slash(state.ledgerRoot):null,ledgerShared:Boolean(state.ledgerShared),ledgerOwner:state.ledgerOwner??null,
    definitionOfDone:state.definitionOfDone,
    ledger:state.ledger.map(item=>({...item})),
    acceptedAsPreexisting:state.ledger.filter(item=>item.status==='preexisting').map(item=>item.id),
    gates:state.gateResults.map(result=>({name:result.name,command:result.command,status:result.status,exitCode:result.exitCode})),
    needUser:state.needUser,
    provisional,provisionalReport:provisionalLines(state).join('\n'),
    // The same list the status page prints, in the report that outlives the run: a finished workflow still owes
    // the owner every question on it, and the report is where they read what to type.
    owner:ownerItems(state),ownerReport:ownerLines(state).join('\n'),
    ops:state.ops.map(op=>({id:op.id,kind:op.kind,node:op.nodeId,origin:op.origin,status:op.status,runtime:op.runtime,attempt:op.attempt,
      allowlist:op.allowlist,ledgerIds:op.ledgerIds,head:op.head,ledgerCommit:op.ledgerCommit??null,verdict:op.verdict,validation:op.validation??null,
      provisional:[...(op.provisional??[])],files:op.files})),
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

/**
 * How long one attempt may run: a review three hours, a build eight, the op's own timeout when it names one. An
 * attempt past that is over whatever the liveness probe says - a review once "worked" for eleven hours on a
 * runtime that never came back, holding the job gates behind its allowlist the whole time.
 */
export const OP_DEADLINE_MS={verify:3*60*60*1000,default:8*60*60*1000};
export const opDeadlineFor=op=>Number.isFinite(op?.timeoutMs)&&op.timeoutMs>0?op.timeoutMs:kindRole(op?.kind)==='verify'?OP_DEADLINE_MS.verify:OP_DEADLINE_MS.default;

/* ------------------------------------------------------------------ the tab before the verdict */

/**
 * The first minutes of an attempt are not evidence of anything. An agent handed a long contract is told to read
 * it from a file before it does anything else, and reading twelve thousand characters looks exactly like an idle
 * prompt to a probe that only knows whether output moved. `telegram-bot-author` was called idle thirty-nine
 * seconds after its launch and cooled two attempts later without ever having been given the time to start.
 *
 * So an operation whose contract is long, or whose kind authors a record rather than working from one
 * (`work.author`, `implementation.plan`, an intake, the two ask kinds), is owed `LONG_CONTRACT_GRACE_MS` of
 * quiet after `launched` before any stall verdict is taken about it: no nudge, no settle, no tab read.
 */
export const LONG_CONTRACT_GRACE_MS=3*60*1000;
/** A screen heuristic cannot stop an exact native worker while its typed host heartbeat is still fresh. */
export const NATIVE_ACTIVITY_GRACE_MS=2*60*1000;
/** A contract past this is "long": the operator contracts that author records run three to thirteen kilobytes. */
export const LONG_CONTRACT_BYTES=8*1024;
/** Relaunches the kernel pays for itself (`prompt-missing`) before it starts charging them to the operation. */
/** The two liveness words that are a guess about a screen, and so the two the kernel checks the screen for. */
const TAB_READ_LIVENESS=['stalled-idle','stalled-silent'];
const graceMsFor=op=>authorsRecord(op?.kind)||isAsk(op?.kind)||plain(op?.intake)||Number(op?.contractBytes??0)>=LONG_CONTRACT_BYTES
  ?LONG_CONTRACT_GRACE_MS:0;
/** Whether this operation is still inside its grace. An attempt with no launch time has no grace to be inside. */
export function withinStallGrace(op,now){
  const grace=graceMsFor(op);
  return grace>0&&Number.isFinite(op?.launchedAt)&&now-op.launchedAt<grace;
}

/** The tab's last lines through the seam the kernel already reads terminals with; null when there is no reading. */
function readOpTab(orca,state,op){
  if(!op.terminal)return null;
  try{
    const read=orca.invoke('terminal-read',{terminal:op.terminal,limit:TAB_READ_LIMIT,screen:true},{cwd:state.worktree});
    if(read.outcome!=='ok')return null;
    const tail=getPath(read.receipt,'result.terminal.tail');
    return Array.isArray(tail)?tail.map(line=>String(line??'')):null;
  }catch{return null;}
}

/** One reading per operation per liveness round: the round is the iteration the tick belongs to. */
function tabVerdict(orca,state,op){
  if(op.tabReadAt===state.iterations)return op.tabRead??null;
  const tail=readOpTab(orca,state,op);
  op.tabReadAt=state.iterations;
  op.tabRead=tail?classifyTab({lines:tail,op}):null;
  return op.tabRead;
}

/** What the tab said, as the report the operation would have written had it got that far. */
function tabReport(state,op,read,text){
  const base={run:state.run??state.id,task:op.task??op.id,dispatch:op.dispatch,from:op.terminal??op.id};
  try{
    const report=read.verdict==='asked'
      ?buildReport({...base,outcome:'ask',summary:`${op.id} is waiting on a question it never reported`,
        question:{text:text||`${op.id} asked a question in its tab`,options:[],...(read.kind?{kind:read.kind}:{})}})
      :buildReport({...base,outcome:'failed',files:[],checks:[],
        summary:text||`${op.id} ended its turn without writing a report`});
    return {...report,via:'tab-read'};
  }catch{return null;}
}

/**
 * The kernel reads the tab before it calls an operation stalled, and answers what it finds there.
 *
 * Returns the verdict it acted on, or `null` when the ordinary nudge-and-settle path should judge this
 * operation after all - because there is no tab to read, because the reading is `idle`, or because the kernel
 * has already paid for this operation's launches `INFRA_RESTART_LIMIT` times and a relaunch it does not charge
 * would loop for ever.
 */
function settleFromTab(orca,store,state,op,ctx,observed){
  const read=tabVerdict(orca,state,op);
  if(!read||read.verdict==='idle')return null;
  if(read.verdict==='prompt-missing'&&(op.infraRestarts??0)>=INFRA_RESTART_LIMIT)return null;
  const text=redactSecrets(String(read.text??'')).slice(0,600);
  store.appendEvent({event:'tab-read',op:op.id,verdict:read.verdict,liveness:observed.liveness,...(text?{text}:{})});
  // Still drawing a turn: the probe was early. The wait is extended, nothing is nudged and nothing is charged.
  if(read.verdict==='working')return 'working';
  // The prompt never reached the agent, so there is nothing the agent did wrong and nothing to hold against it:
  // the attempt is relaunched, on the same runtime if the allocator offers it, and `op.restarts` does not move.
  if(read.verdict==='prompt-missing'){
    const settled=settleDispatch(orca,op.dispatch,{cwd:state.worktree,reason:'prompt-missing',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(!reconcileStoppedNativeAttempt(store,state,op,ctx,settled,'prompt-missing'))return 'native-reconciliation';
    ctx.allocator.release(op.runtime,{op:op.id});
    op.infraRestarts=(op.infraRestarts??0)+1;
    store.appendEvent({event:'op-relaunched',op:op.id,runtime:op.runtime,reason:'prompt-missing',
      infraRestarts:op.infraRestarts,restarts:op.restarts});
    op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;op.launchedAt=null;
    return 'prompt-missing';
  }
  const report=tabReport(state,op,read,text);
  if(!report)return null;
  const dispatch=op.dispatch,runtime=op.runtime,terminal=op.terminal;
  try{fs.writeFileSync(store.reportPath(dispatch),JSON.stringify(report,null,2));}catch{}
  applyOpReport(orca,store,state,op,report,{...ctx,orca});
  // Exactly what an accepted report releases - unless the kernel answered the question, in which case the tab
  // is still the only place that answer can be typed.
  if(op.status!=='answering'){
    settleDispatch(orca,dispatch,{cwd:state.worktree,reason:`tab-read:${read.verdict}`,terminalHandle:terminal,closeTerminal:true,wait:ctx.wait});
    ctx.allocator.release(runtime,{op:op.id});
  }
  return read.verdict;
}

/**
 * A native Dispatch has no child PID in the journal. Once its host settlement proves the exact process stopped,
 * freeze its byte delta while the canonical writer fence is still held, preserve that delta as the next attempt's
 * owned baseline, and only then release the durable job. An ambiguous stop or candidate never becomes a retry.
 */
function reconcileStoppedNativeAttempt(store,state,op,ctx,settlement,reason){
  if(!ctx.v6)return true;
  const reconciled=ctx.v6.settleStoppedOperation(op,{dispatch:op.dispatch,settlement,reason});
  if(!reconciled.ok){quarantineCandidate(store,state,op,{kind:'native-stop-reconciliation',effectState:reconciled.effectState??'unknown',reasons:[reconciled.reason??'native attempt could not be reconciled']});return false;}
  const prior={attempt:op.attempt,dispatch:op.dispatch,candidateDigest:reconciled.candidateDigest??null,observedFiles:[...(reconciled.observedFiles??[])]};
  op.v6PriorStoppedAttempt=prior;op.attempt=(op.attempt??1)+1;
  delete op.v6WorkerSettled;delete op.v6RetryReconciled;
  store.appendEvent({event:'native-attempt-reconciled',op:op.id,attempt:prior.attempt,nextAttempt:op.attempt,dispatch:prior.dispatch,
    candidateDigest:prior.candidateDigest,observedFiles:prior.observedFiles,historicalEffectState:prior.observedFiles.length?'partial':'none-observed'});
  return true;
}

/** Fresh typed host activity outranks a prompt-shaped screen. Identity mismatches and stale heartbeats prove nothing. */
export function nativeActivityProof(orca,state,op,now,{graceMs=NATIVE_ACTIVITY_GRACE_MS}={}){
  if(!op?.dispatch||!state?.run)return {active:false,reason:'native Dispatch identity unavailable'};
  let shown;try{shown=orca.invoke('worker-show',{dispatch:op.dispatch},{cwd:state.worktree});}catch(error){return {active:false,reason:String(error?.message??error)};}
  if(shown?.outcome!=='ok')return {active:false,reason:shown?.reason??'worker-show failed'};
  const result=getPath(shown.receipt,'result'),dispatch=result?.dispatch,worker=result?.worker,observation=result?.observation;
  const heartbeat=Date.parse(dispatch?.last_heartbeat_at??dispatch?.lastHeartbeatAt??'');
  const exact=dispatch?.id===op.dispatch&&dispatch?.run_id===state.run&&(!op.task||dispatch?.task_id===op.task)
    &&worker?.dispatch_id===op.dispatch&&observation?.exactWorker===true&&observation?.status==='running';
  const age=Number.isFinite(heartbeat)?Math.max(0,now-heartbeat):Infinity;
  return {active:exact&&age<=graceMs,exact,heartbeatAt:Number.isFinite(heartbeat)?heartbeat:null,ageMs:age,
    reason:exact?(age<=graceMs?'exact native worker heartbeat is fresh':'exact native worker heartbeat is stale'):'worker-show identity or process state differs'};
}

export function settleStalled(orca,store,state,ctx,tick){
  const now=clockOf(ctx);
  // An op that waits for the OWNER is exempt from the deadline: it is not slow, it is waiting, and the wait is
  // the owner's to end. `op-overrun` once killed the tab that was asking for a credential over a long lunch. An
  // op waiting for a credential to be filled in has no dispatch at all: nothing is running for it.
  for(const op of state.ops.filter(item=>item.status==='running'&&!item.fill&&!waitsForOwner(state,item)&&Number.isFinite(item.launchedAt)&&now-item.launchedAt>opDeadlineFor(item))){
    // Past its deadline: settled as an overrun and relaunched elsewhere, like a stall the probe cannot see.
    const settled=settleDispatch(orca,op.dispatch,{cwd:state.worktree,reason:'overrun',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(!reconcileStoppedNativeAttempt(store,state,op,ctx,settled,'overrun'))continue;
    ctx.allocator.release(op.runtime,{op:op.id});
    op.restarts+=1;
    store.appendEvent({event:'op-overrun',op:op.id,runtime:op.runtime,ranMs:now-op.launchedAt,deadlineMs:opDeadlineFor(op),restarts:op.restarts});
    noteAnomaly(store,state,`overrun:${op.id}`,{op:op.id,runtime:op.runtime});
    if(op.restarts>RESTART_LIMIT){coolOp(store,state,op,ctx,`${op.id} overran its deadline ${op.restarts} times`);continue;}
    op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;op.launchedAt=null;avoidRuntime(op,op.runtime,now);
  }
  for(const op of state.ops.filter(item=>item.status==='running'&&!item.fill&&item.dispatch)){
    const observed=(tick.liveness??[]).find(item=>item.dispatch===op.dispatch);
    if(!observed)continue;
    // A provision.ask is waiting for the owner in its tab by design: its idleness is the wait, not a stall.
    // A decision.prepare never waits, so its idleness is a stall like any other op's.
    if(op.kind===PROVISION_ASK&&observed.liveness==='stalled-idle')continue;
    if(TAB_READ_LIVENESS.includes(observed.liveness)){
      // A long contract is read before anything else happens, and reading it looks exactly like an idle prompt.
      if(withinStallGrace(op,now)){
        store.appendEvent({event:'stall-grace',op:op.id,kind:op.kind,liveness:observed.liveness,
          sinceLaunchMs:now-op.launchedAt,graceMs:LONG_CONTRACT_GRACE_MS});
        continue;
      }
      // The screen is the evidence. Only an `idle` reading - or no reading at all - reaches the nudge below.
      if(settleFromTab(orca,store,state,op,ctx,observed))continue;
    }
    if(observed.liveness==='stalled-idle'&&!op.nudged){
      notifyTerminal(orca,{cwd:state.worktree,terminal:op.terminal,wait:ctx.wait,
        text:'Continue; when you are finished report exactly once with the report command in your contract'});
      op.nudged=true;
      store.appendEvent({event:'nudged',op:op.id,liveness:observed.liveness});
      continue;
    }
    if(!['stalled-prompt','stalled-silent','stalled-idle','dead','rate-limited'].includes(observed.liveness))continue;
    if(ctx.v6&&observed.liveness!=='rate-limited'){
      const activity=nativeActivityProof(orca,state,op,now);
      if(activity.active){
        if(!Number.isFinite(op.nativeActivityDeferredAt)||now-op.nativeActivityDeferredAt>=NATIVE_ACTIVITY_GRACE_MS){op.nativeActivityDeferredAt=now;store.appendEvent({event:'native-settlement-deferred',op:op.id,dispatch:op.dispatch,liveness:observed.liveness,heartbeatAt:activity.heartbeatAt,ageMs:activity.ageMs});}
        continue;
      }
    }
    const settled=settleDispatch(orca,op.dispatch,{cwd:state.worktree,reason:observed.liveness,terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});
    if(!reconcileStoppedNativeAttempt(store,state,op,ctx,settled,observed.liveness))continue;
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
      // An op the restart limit caught for going idle is a mechanical bound too: it cools and is re-admitted,
      // up to the daily cap. Every other liveness (dead, stalled-prompt, stalled-silent) is still the user's.
      }else if(observed.liveness==='stalled-idle')coolOp(store,state,op,ctx,`${op.id} was restarted ${op.restarts} times (stalled-idle)`);
      else state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} was restarted ${op.restarts} times (${observed.liveness})`});
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
/** Closed non-operation model bindings come only from validated config.json. */
export const supervisorRuntimes=host=>nonOperationModels('kernelManager',loadConfig(host));
export const workflowModelConfigRoot=state=>isV6(state)&&state.engine.runtimePin?.root?state.engine.runtimePin.root:state.host??'';
export const validatorRuntimes=host=>nonOperationModels('validator',loadConfig(host));
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
 * How often one operation may be re-admitted after a mechanical launch bound in one day. The bound itself is
 * not a question for the owner - a launcher that will not start is time, not a decision - so the op cools and
 * comes back; past this cap the environment really is broken and that IS the owner's, as an `environment` item.
 */
export const LAUNCH_DAILY_CAP=6;
/**
 * A mechanical launch bound: the op cools for the same window a provider limit uses and is re-admitted by
 * `readmitCooled`, with its launch and restart counters cleared. `detail` is the line the owner would have been
 * given; it is carried on the op so the item past the cap says exactly what kept failing.
 */
function coolOp(store,state,op,ctx,detail,{migrated=false}={}){
  const now=clockOf(ctx);
  op.status='blocked';op.refusal='launch-cooling';op.coolUntil=now+RATE_LIMIT_COOLDOWN_MS;
  op.coolReason=String(detail).slice(0,240);
  op.dispatch=null;op.terminal=null;op.nudged=false;
  store.appendEvent({event:'launch-cooling',op:op.id,until:op.coolUntil,
    launchFailures:op.launchFailures??0,restarts:op.restarts??0,detail:op.coolReason,...(migrated?{migrated:true}:{})});
  return 'launch-cooling';
}
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
/**
 * The rule the owner's list was written under. Every rule that turns a mechanical bound into an escalation
 * applies to what an OLDER rule already parked for the owner, not only to what this kernel meets from now on:
 * a review the old rule parked after its rounds, a shared change it called too deep, a record path it refused
 * outright, a launch it gave up on, a requester it blocked behind a blocked shared change. Once per rule change,
 * on kernel start, each such item is judged again under the current rule and routed where the rule routes it
 * today; what the current rule still parks stays parked, and the list shrinks to what is genuinely the owner's.
 * The stamp changes when the parking rules do, never with the build.
 */
/** The kinds of line on the owner's list that describe a mechanical state of an op, never a decision of the owner's. */
const MECHANICAL_LINES=['shared-depth','ledger-path','environment','shared-change','validator','triage'];
/**
 * A mechanical line about an op that has since moved on - it runs, waits, or finished - is stale, and a stale line
 * would finish the workflow `blocked` over nothing. Every tick, such lines go; a line about an op still blocked
 * without a refusal stays until the rule that re-admits it runs.
 */
export function sweepStaleLines(store,state){
  const dropped=[];
  // A line the runtime has already taken in hand is never the owner's: a record a `work.author` op is writing
  // right now, an environment an op has since run in. The owner was handed those and could do nothing with
  // them but wait for the kernel - which is the opposite of a list that says what to type.
  state.needUser=state.needUser.filter(item=>{
    const mechanical=mechanicalOwnerLine(state,item);
    if(!mechanical)return true;
    store.appendEvent({event:'owner-line-dropped',node:mechanical.node??null,op:mechanical.op??null,kind:item.kind,reason:mechanical.reason});
    return false;
  });
  state.needUser=state.needUser.filter(item=>{
    if(!MECHANICAL_LINES.includes(item.kind))return true;
    // A triage line carries its op inside the signature (`settled:<op>:<liveness>`) rather than as a field.
    const opId=item.op??(item.kind==='triage'?(String(item.detail??'').match(/^[a-z-]+:([^:]+):/)??[])[1]:null);
    if(!opId)return true;
    const op=byId(state,opId);
    if(!op||op.status==='blocked')return true;
    dropped.push({kind:item.kind,op:op.id,status:op.status});return false;
  });
  if(dropped.length)store.appendEvent({event:'need-user-stale-dropped',dropped});
  return dropped;
}
export const PARK_RULE='5.0.0-plus.3';
export function rejudgeParked(store,state,ctx){
  if(state.parkRule===PARK_RULE)return [];
  const routed=[];
  const drop=item=>{state.needUser=state.needUser.filter(entry=>entry!==item);};
  const readmit=(op,finding)=>{op.status='ready';op.refusal=null;op.attempt+=1;op.findings=unique([...(op.findings??[]),finding]);op.priorOpen=[];op.dispatch=null;op.terminal=null;op.nudged=false;};
  // What the op asked for when it was parked: the shared-change blocker of its last report, read as the kernel reads it today.
  const requested=op=>{
    const report=(op.reports??[]).at(-1);
    const blocker=plain(report?.blocker)?report.blocker:null;
    if(!blocker||blocker.kind!=='shared-change')return {paths:[],detail:'',open:[]};
    const named=ctx.guards?.parseSharedChangePaths?.(`${blocker.detail} ${(report.open??[]).join(' ')}`)??[];
    return {paths:unique(named.map(normalize)).filter(file=>!inside(file,op.allowlist)),detail:String(blocker.detail??''),open:[...(report.open??[])]};
  };
  for(const item of [...state.needUser]){
    const op=item.op?byId(state,item.op):null;
    const stuck=Boolean(op&&op.status==='blocked'&&!op.refusal);
    let route=null;
    // A mechanical line about an op that is no longer blocked - it ran again, finished, or waits - is stale.
    if(op&&!stuck&&MECHANICAL_LINES.includes(item.kind)){drop(item);route=`stale:${op.status}`;}
    else if(item.kind==='ledger'&&/^never verified:/.test(String(item.detail??''))){drop(item);route='recomputed-at-finish';}
    else if(item.kind==='review'){
      // The parked review of a group is escalated as the current rule escalates a spent review; its companion
      // line ("used its rounds and is implemented again") names no op and goes with it.
      if(!op){drop(item);route='companion-line';}
      else if(op.kind==='review.verify'&&(op.ledgerIds??[]).length){
        const key=groupKey(state,op.ledgerIds);
        const findings=state.verifyFindings?.[key]??reviewFindings((op.reports??[]).at(-1)??{});
        drop(item);
        route=escalateVerify(store,state,ctx,{key,ledgerIds:[...op.ledgerIds],findings,op});
      }
    }
    else if(item.kind==='shared-depth'&&stuck){
      const {paths,detail,open}=requested(op);
      const author=paths.length?authorSharedNode(store,state,op,ctx,{paths,detail,open}):null;
      if(author){drop(item);route='shared-authored';}
    }
    else if(item.kind==='ledger-path'&&stuck){
      const {paths,detail,open}=requested(op);
      const ledgerPaths=paths.filter(entry=>/^\.?\/?\.starciwork\//.test(slash(entry)));
      const codePaths=paths.filter(entry=>!ledgerPaths.includes(entry));
      drop(item);
      store.appendEvent({event:'ledger-path-refused',op:op.id,kind:op.kind,paths:ledgerPaths,continued:codePaths,reason:'ledger path',rejudged:true});
      if(codePaths.length)route=requestSharedChange(store,state,op,{paths:codePaths,detail,open},ctx);
      else{
        readmit(op,`The Work tree is the kernel's own record: ${ledgerPaths.join(', ')} is not a change any operation may ask for, and an error of the tree outside your allowlist no longer counts against you. Run your checks on your own files and report done with their evidence, or blocked with a shared-change that names code paths only.`);
        route='readmitted';
      }
    }
    else if(item.kind==='environment'&&stuck&&!/\(rate-limited\)$/.test(String(item.detail??''))){
      // A rate limit is migrated by `readmitCooled` itself, which also avoids the limited runtime; every other spent
      // launch is a mechanical bound: it cools and comes back with its counters cleared.
      drop(item);
      coolOp(store,state,op,ctx,String(item.detail??''),{migrated:true});
      op.coolUntil=clockOf(ctx);
      route='launch-cooling';
    }
    else if(item.kind==='shared-change'&&stuck){
      const shared=(op.dependsOn??[]).map(id=>byId(state,id)).find(dep=>dep&&dep.status!=='done'&&!deadOp(dep));
      if(shared){drop(item);op.status='paused';op.waitingFor=shared.id;op.dispatch=null;op.terminal=null;op.nudged=false;route=`waits-for:${shared.id}`;}
    }
    if(route)routed.push({kind:item.kind,op:op?.id??null,route});
  }
  // A requester an older rule blocked behind a blocked shared change and then lost the line for (deduplicated,
  // or dropped with the shared op's own item) waits for that change too; one whose changes are all done runs again.
  const alive=dep=>dep&&dep.status!=='done'&&!deadOp(dep);
  for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&(item.dependsOn??[]).length&&!state.needUser.some(entry=>entry.op===item.id))){
    const deps=op.dependsOn.map(id=>byId(state,id)).filter(Boolean);
    const shared=deps.find(alive);
    if(shared){op.status='paused';op.waitingFor=shared.id;op.dispatch=null;op.terminal=null;op.nudged=false;routed.push({kind:'blocked-requester',op:op.id,route:`waits-for:${shared.id}`});continue;}
    if(deps.length&&deps.every(dep=>dep.status==='done')){
      op.status='ready';op.attempt+=1;op.waitingFor=null;op.dispatch=null;op.terminal=null;op.nudged=false;
      op.priorOpen=deps.map(dep=>`shared change ${dep.id} done at ${dep.head??state.head??'unknown'}`);
      routed.push({kind:'blocked-requester',op:op.id,route:'resumed'});
    }
  }
  state.parkRule=PARK_RULE;
  store.appendEvent({event:'parked-rejudged',rule:PARK_RULE,routed,left:state.needUser.length});
  return routed;
}

function readmitCooled(store,state,ctx){
  const now=typeof ctx?.now==='function'?ctx.now():Date.now();
  // (A validator that rejected an op twice keeps its bound: the op stops there, and a fresh kernel start gives it
  // exactly one more round - `validatorReset` - because the validator's rules may have changed. Not a cooldown.)
  for(const item of state.needUser.filter(entry=>['environment','authority'].includes(entry.kind)&&entry.op)){
    const op=state.ops.find(candidate=>candidate.id===item.op);
    if(!op||op.status!=='blocked'||op.refusal)continue;
    const detail=String(item.detail??'');
    if(/\(rate-limited\)$/.test(detail)){
      op.refusal='rate-limited';op.coolUntil=now;
      state.needUser=state.needUser.filter(entry=>entry!==item);
      store.appendEvent({event:'rate-limit-cooling',op:op.id,runtime:op.runtime,until:op.coolUntil,restarts:op.restarts,migrated:true});
      continue;
    }
    // "Can never start" over a dependency that is alive after all: the op waits for it again.
    if(item.kind==='authority'&&/can never start: it depends on/.test(detail)){
      const deps=(op.dependsOn??[]).map(id=>byId(state,id)).filter(Boolean);
      if(!deps.some(deadOp)){
        state.needUser=state.needUser.filter(entry=>entry!==item);
        op.status='pending';
        store.appendEvent({event:'dependency-alive',op:op.id,dependsOn:op.dependsOn});
      }
      continue;
    }
    // Retries spent on the whole-tree validator are a mechanical bound too: the op comes back with its retries
    // cleared and the current rule (the kernel judges the tree scoped to it) in force.
    if(item.kind==='authority'&&/exhausted its retries|never finishes/.test(detail)&&/work-tree-validates|work-valid|validat|asset/i.test(detail)){
      state.needUser=state.needUser.filter(entry=>entry!==item);
      op.repairs=0;op.resumes=0;
      coolOp(store,state,op,ctx,detail,{migrated:true});
      op.coolUntil=now;
      continue;
    }
    // A lost agent, an idle restart, a launch nobody could take: mechanical bounds, wherever they were parked from
    // (an older build, or the terminal reconciliation that has no cooldown of its own). They cool and come back,
    // up to the daily cap; only past the cap is the environment the owner's after all.
    if(/lost its agent|\(stalled-idle\)|could not be launched|no runtime could launch|failed on every runtime/.test(detail)){
      state.needUser=state.needUser.filter(entry=>entry!==item);
      coolOp(store,state,op,ctx,detail,{migrated:true});
      op.coolUntil=now;
    }
  }
  for(const op of state.ops.filter(candidate=>candidate.status==='blocked'&&candidate.refusal==='rate-limited')){
    if(!(Number(op.coolUntil??0)<=now))continue;
    const limited=op.runtime;
    op.status='ready';op.refusal=null;op.coolUntil=null;op.restarts=0;op.dispatch=null;op.terminal=null;op.nudged=false;
    avoidRuntime(op,limited,now);
    store.appendEvent({event:'rate-limit-readmitted',op:op.id,avoid:op.avoidRuntimes});
  }
  // A mechanical launch bound is time, not a defect: once the cooldown has passed the op is admitted again with
  // its counters cleared, up to the daily cap. Past the cap the environment is the owner's after all.
  const day=new Date(now).toISOString().slice(0,10);
  for(const op of state.ops.filter(candidate=>candidate.status==='blocked'&&candidate.refusal==='launch-cooling')){
    if(!(Number(op.coolUntil??0)<=now))continue;
    const seen=plain(op.launchReadmissions)&&op.launchReadmissions.day===day?op.launchReadmissions.count:0;
    if(seen>=LAUNCH_DAILY_CAP){
      op.refusal='launch-exhausted';op.coolUntil=null;
      state.needUser.push({op:op.id,kind:'environment',detail:`${op.coolReason??`${op.id} could not be launched`}; it was re-admitted ${seen} times today and the environment still refuses it`});
      store.appendEvent({event:'launch-cap-reached',op:op.id,readmissions:seen,cap:LAUNCH_DAILY_CAP});
      continue;
    }
    op.launchReadmissions={day,count:seen+1};
    op.status='ready';op.refusal=null;op.coolUntil=null;op.launchFailures=0;op.restarts=0;op.dispatch=null;op.terminal=null;op.nudged=false;
    store.appendEvent({event:'launch-readmitted',op:op.id,readmissions:seen+1,cap:LAUNCH_DAILY_CAP,avoid:op.avoidRuntimes??[]});
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
export function guardedStage(store,state,ctx,stage,fn){
  try{fn();state.kernelErrors=0;if(ctx.v6&&state.engine.stageErrors)delete state.engine.stageErrors[stage];return 'ok';}
  catch(error){
    if(isJobPending(error)||error?.code==='STARCI_MODEL_QUOTA_WAIT'){store.saveState(state);return 'deferred';}
    const message=String(error?.stack??error?.message??error).slice(0,600);
    state.kernelErrors=(state.kernelErrors??0)+1;
    if(ctx.v6){state.engine.stageErrors??={};state.kernelErrors=state.engine.stageErrors[stage]=(state.engine.stageErrors[stage]??0)+1;}
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
export function retryOwnedBaseline(state,op,git=spawnSync){const changed=changedFiles(state,op,{git},op.allowlist,{exclude:op.kernelOwned??[]}),attributed=attributedFiles(op,changed);return {changed,attributed,unclaimed:changed.filter(file=>!attributed.includes(file))};}
export const retryableV6Operation=op=>!op?.fill&&!op?.ownerRequest&&(['running','answering'].includes(op?.status)||Boolean(op?.v6RetryReconciled)||(Boolean(op?.v6Lease)&&(op?.refusal==='runtime-reconciliation'||op?.v6WorkerSettled===true)));
export function noteAnomaly(store,state,signature,detail){
  state.anomalies=state.anomalies??{};
  const entry=state.anomalies[signature]=state.anomalies[signature]??{count:0,detail,firstAt:Date.now(),triaged:null};
  entry.count+=1;entry.lastAt=Date.now();
  return entry;
}
export function triageAnomaly(store,state,signature,ctx){
  const entry=state.anomalies?.[signature];
  if(!entry||entry.count<TRIAGE_AFTER||entry.triaged||typeof ctx.decide!=='function')return null;
  if(state.engine?.coordination==='agent-v1'){
    if(!entry.managerObserved){entry.managerObserved=true;store.appendEvent({event:'manager-anomaly-observed',signature,count:entry.count});}
    return 'manager';
  }
  const chosen=ctx.decide({situation:`Anomaly repeated ${entry.count} times: ${signature}`,options:TRIAGE_OPTIONS,providers:ctx.supervisor,
    context:{detail:entry.detail,recentEvents:store.readEvents({since:Math.max(0,(store.readEvents().at(-1)?.seq??0)-40)}).map(e=>`${e.event}${e.op?` ${e.op}`:''}${e.reason?` ${String(e.reason).slice(0,80)}`:''}`),ops:state.ops.map(op=>`${op.id}=${op.status}`)},cwd:state.worktree});
  const option=chosen?.ok&&TRIAGE_OPTIONS.includes(chosen.value.option)?chosen.value.option:'needUser';
  entry.triaged={option,rationale:chosen?.ok?chosen.value.rationale:null,at:Date.now()};
  store.appendEvent({event:'triage',signature,option,rationale:entry.triaged.rationale,count:entry.count});
  // Resume only what a transient cause blocked: an op with a refusal (out of repository, superseded, dynamic budget) stays blocked whatever the anomaly.
  if(option==='resume-ops'){for(const op of state.ops)if(op.status==='blocked'&&!op.refusal&&(!ctx.v6||(entry.detail?.op===op.id&&op.incidentSignature===signature))){op.status='ready';op.dispatch=null;op.terminal=null;}}
  else if(option==='park-runtime'){const runtime=entry.detail?.runtime;if(runtime)ctx.allocator.failed(runtime,{reason:`triage: ${signature}`});}
  else if(option==='settle-op'){const op=state.ops.find(item=>item.id===entry.detail?.op&&item.status==='running');if(op){settleDispatch(ctx.orca,op.dispatch,{cwd:state.worktree,reason:'triage',terminalHandle:op.terminal,closeTerminal:true,wait:ctx.wait});op.status='ready';op.dispatch=null;op.terminal=null;}}
  // A restart is asked of the loop, never written as a stop flag: a stop flag is a pause the supervisor honours until
  // someone removes it, and a triage restart of a drawing once sat paused for an hour that way.
  else if(option==='restart-kernel'){state.restartRequested='triage restart';}
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

/** Restore semantic durable state without replacing the coordinator identity validated for this process launch. */
export function restoreDurableCheckpoint(state,checkpoint,binding=null){
  need(plain(state)&&plain(checkpoint),'durable checkpoint recovery needs workflow state');
  need(checkpoint.id===state.id,'durable checkpoint workflow identity mismatch');
  const owned=plain(binding)&&binding.workflowId===state.id&&typeof binding.from==='string'&&binding.from&&typeof binding.run==='string'&&binding.run;
  Object.assign(state,checkpoint);
  if(!owned)return state;
  state.from=binding.from;state.run=binding.run;
  if(typeof binding.hostAdapter==='string'&&binding.hostAdapter)state.hostAdapter=binding.hostAdapter;
  if(typeof binding.launcher==='string'&&binding.launcher)state.launcher=binding.launcher;
  if(binding.kernelTerminalOwned===true)state.kernelTerminalOwned=true;
  else if(binding.kernelTerminalOwned===false)state.kernelTerminalOwned=false;
  if(typeof binding.workflowTask==='string'&&binding.workflowTask)state.workflowTask=binding.workflowTask;
  return state;
}

export function runLoop(orca,store,state,{cwd=state.worktree,allocator,planOp=llm.planOp,decide=llm.decide,validateOp=llm.validateOp,template,supervisor=null,validator=null,
  wait=sleepSync,exec=runCommand,git=spawnSync,launch=launchWithCandidate,maxIterations=Infinity,guards=kernelGuards,
  ledgerApi=work,validate=validateWorkTree,ledgerRoot=null,resolveLedger=resolveLedgerRoot,
  reconcile=reconcileIntakeSeam,renderChecks=renderChecksFor,contractDigest=contractDigestFor,kindsProfile=null,
  verifyPresence=null,reconcileInputs=reconcileWorkflowInputs,refreshPreparation=refreshCredentialPreparation,deferPreparation=deferForIntegrationPreparation,
  v6Runtime=null,modelEligibility=null,modelPolicy=null,runtimeBinding=null,
  waitTimeoutMs=900000,tickMs=120000,pollMs=POLL_MS,now=Date.now,host=hostDescriptorOf(orca)}={}){
  need(state.approved,`Workflow ${state.id} is not approved; run workflow-approve --id ${state.id}`);
  // Restore the narrowly identified 5-plus GUI collision before any resumed operation reads goal inputs.
  const recoveredInputs=recoverWorkflowInputReferences(store,state);
  if(!recoveredInputs.ok){
    if(!state.needUser.some(item=>item.code==='workflow-input-repair')){
      state.needUser.push({kind:'environment',code:'workflow-input-repair',detail:`Runtime repair required: approved workflow input references cannot be restored from the matching goal (${recoveredInputs.reason}). No operation was resumed.`});
      store.appendEvent({event:'input-reference-recovery-refused',reason:recoveredInputs.reason});
    }
    finish(store,state,'blocked','workflow input references require runtime repair');
    return state;
  }
  if(recoveredInputs.recovered){
    state.needUser=state.needUser.filter(item=>item.code!=='workflow-input-repair');
    if(state.finished?.reason==='workflow input references require runtime repair'){state.finished=null;state.phase='run';}
  }
  need(plain(allocator),'A runtime allocator is required');
  need(typeof template==='string'&&template.trim(),'The operation contract template is required');
  required(state.run,'Orca run id');required(state.from,'own terminal handle');
  // `validateOp:null` is an explicit choice to run without the validator; it is recorded once as `validator-skipped`.
  const ctx={cwd,allocator,planOp,decide,validateOp,template,wait,exec,git,launch,now,guards,work:null,orca,host:hostDescriptorOf({host}),
    reconcile,renderChecks,contractDigest,kindsProfile,deferPreparation,...(verifyPresence?{verifyPresence}:{}),
    supervisor:supervisor??supervisorRuntimes(workflowModelConfigRoot(state)),validator:validator??validatorRuntimes(workflowModelConfigRoot(state))};
  ctx.v6=v6Runtime??(isV6(state)?createV6Runtime({store,state,now,eligibility:modelEligibility,modelPolicy,git,
    exec:(command,options)=>ctx.v6.check(command,options,ctx.currentOp??null)}):null);
  if(ctx.v6){
    store.bindJournal?.(ctx.v6.journal,state.engine.generation,{state});
    const checkpoint=store.loadState();
    if(checkpoint)restoreDurableCheckpoint(state,checkpoint,runtimeBinding);
    ctx.planOp=args=>ctx.v6.model('planOp',args,ctx.currentOp??null);
    ctx.decide=args=>ctx.v6.model('decide',args,ctx.currentOp??null);
    ctx.validateOp=args=>ctx.v6.model('validateOp',args,args.op??ctx.currentOp??null);
    ctx.manageWorkflow=snapshot=>ctx.v6.manageWorkflow(snapshot);
    ctx.exec=(command,options)=>ctx.v6.check(command,options,ctx.currentOp??null);
    store.appendEvent({event:'engine-active',major:6,generation:state.engine.generation,assurance:state.engine.assurance});
  }
  // Which host runs this workflow is a fact of the run: a sequential host names itself so the log says why one op ran at a time.
  store.appendEvent({event:'host',name:ctx.host.name,capabilities:ctx.host.capabilities,sequential:ctx.host.sequential,maxParallelOps:allocator.maxParallelOps??null});
  // A state written before these bounds existed resumes with them.
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  state.dynamicOpsBudget=dynamicBudget(state);
  // The budget counts only shared and repair ops; a kernel-origin op an older build refused under it is superseded,
  // never reinstated by --allow-dynamic, and its needUser item goes with it.
  state.dynamicOps=state.ops.filter(item=>countsAgainstBudget(item)).length;
  for(const op of state.ops)if(!countsAgainstBudget(op)&&op.refusal==='dynamic-op'){op.refusal='superseded';state.needUser=state.needUser.filter(item=>item.op!==op.id||item.kind!=='dynamic-op');}
  // A shared op an older rule opened on behalf of a record-authoring op (an intake asking for the code that reads a
  // variable) is withdrawn: a record author never delegates a code change, and its requester runs again with the rule.
  for(const shared of state.ops.filter(item=>item.origin==='shared'&&authorsRecord(item.kind)&&['pending','ready','running','paused'].includes(item.status))){
    if(shared.status==='running'&&shared.dispatch)try{settleDispatch(orca,shared.dispatch,{cwd,reason:'withdrawn: a record author delegates no code change',terminalHandle:shared.terminal,closeTerminal:true,wait});}catch{/* the terminal may already be gone */}
    shared.status='blocked';shared.refusal='superseded';shared.dispatch=null;shared.terminal=null;
    store.appendEvent({event:'shared-op-withdrawn',op:shared.id,kind:shared.kind,requesters:shared.requesters??[],reason:'a record-authoring op asks for no shared change'});
    for(const requester of (shared.requesters??[]).map(id=>byId(state,id)).filter(Boolean)){
      requester.status='ready';requester.attempt+=1;requester.waitingFor=null;requester.dispatch=null;requester.terminal=null;requester.nudged=false;
      requester.findings=unique([...(requester.findings??[]),`A ${requester.kind} operation writes records under its allowlist and asks for no shared change: a credential's custody (\`identity:<slug>\`) is declared, never created, and the code that reads a variable is never yours to change. Write the declarations, leave everything else, and report done.`]);
      requester.dependsOn=(requester.dependsOn??[]).filter(id=>id!==shared.id);
    }
  }
  // The one `owner.ask` kind of earlier builds is two kinds now: a state written before the split is renamed on
  // start by what its question is - a provision waits (`provision.ask`), everything else is prepared (`decision.prepare`).
  const HIDDEN_DECISION=/^The review of \S+ keeps failing and its findings cite no decided record/;
  for(const op of state.ops.filter(item=>item.kind==='owner.ask'||(item.kind===PROVISION_ASK&&HIDDEN_DECISION.test(String(item.question?.text??''))&&!['done','failed'].includes(item.status)))){
    // A hidden decision the kernel raised is a prepared question whatever its sentence mentions; an earlier rule
    // read one as a credential request. It is a decision.prepare, and its question says so.
    const hidden=HIDDEN_DECISION.test(String(op.question?.text??''));
    if(hidden&&plain(op.question))op.question={...op.question,kind:'hidden-decision',prepared:true};
    const kind=!hidden&&STOP_KINDS.includes(op.question?.kind)?PROVISION_ASK:DECISION_PREPARE;
    if(op.kind===kind)continue;
    store.appendEvent({event:'kind-renamed',op:op.id,from:op.kind,to:kind,...(hidden?{hidden:true}:{})});
    op.kind=kind;
  }
  // A finish an older rule declared over a stall that time lifts (the daily op budget) is withdrawn: the workflow
  // is what it was, and its runtimes come back with the UTC day.
  if(state.finished?.reason==='no runtime accepted an operation'){
    store.appendEvent({event:'finish-withdrawn',outcome:state.finished.outcome,reason:state.finished.reason});
    state.finished=null;state.phase='run';state.stalls=0;state.stalledSince=null;
    state.needUser=state.needUser.filter(item=>!(item.kind==='environment'&&!item.op&&/^no runtime accepted an operation/.test(String(item.detail??''))));
  }
  // A provisional decision whose record an older redactor masked is repaired from the ask that took it: the ask's
  // question still names the record, and a decision nobody can name is one nobody can overturn.
  for(const entry of (state.provisional??[]).filter(item=>/\[redacted\]/.test(String(item.decision??'')))){
    const ask=byId(state,entry.op);
    const record=ask?.question?.record??null;
    if(!record)continue;
    store.appendEvent({event:'provisional-record-repaired',ask:entry.op,from:entry.decision,to:record});
    for(const op of state.ops)if(Array.isArray(op.provisional))op.provisional=op.provisional.map(id=>id===entry.decision?record:id);
    entry.decision=record;
  }
  // A running op launched before the deadline rule carries its launch time from the log, so the deadline holds.
  {
    let launches=null;
    for(const op of state.ops.filter(item=>item.status==='running'&&!Number.isFinite(item.launchedAt))){
      launches??=store.readEvents().filter(event=>event.event==='launched');
      const last=launches.filter(event=>event.op===op.id&&event.dispatch===op.dispatch).at(-1)??launches.filter(event=>event.op===op.id).at(-1);
      if(last?.at)op.launchedAt=last.at;
    }
  }
  // An environment blocker an op itself reported is retried once per build: a new build is what changes the
  // environment the op saw (an operator that could not write an integration node, a rule that refused a path), and
  // the op's next attempt is the only witness of whether it still holds. Once per build stamp, never in a loop.
  {
    const stamp=buildStamp();
    for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&item.reports?.at?.(-1)?.blocker?.kind==='environment'&&stamp&&item.environmentRetryStamp!==stamp)){
      const line=state.needUser.find(item=>item.op===op.id&&item.kind==='environment');
      if(!line)continue;
      state.needUser=state.needUser.filter(item=>item!==line);
      op.environmentRetryStamp=stamp;
      op.status='ready';op.attempt+=1;op.dispatch=null;op.terminal=null;op.nudged=false;
      op.findings=unique([...(op.findings??[]),`the runtime was rebuilt since you reported the environment blocker "${firstLine(String(op.reports.at(-1).blocker.detail??''))}": try again against the current build, and report blocked again only if it still holds`]);
      store.appendEvent({event:'environment-retried',op:op.id,build:stamp});
    }
  }
  // A validator block whose findings name only files the op never claimed is not the op's block: those files
  // are a neighbour's work under the same allowlist (the first ask's draft beside the second's), and the
  // validator judges claimed files only now. The op runs again, told to leave them alone. Once: the line goes.
  for(const op of state.ops.filter(item=>item.status==='blocked'&&!item.refusal&&state.needUser.some(line=>line.op===item.id&&line.kind==='validator'))){
    const changed=changedFiles(state,op,ctx,op.allowlist,{exclude:op.kernelOwned??[]});
    const own=attributedFiles(op,changed,ctx);
    if(!own.length)continue;
    const named=unique((op.findings??[]).flatMap(finding=>pathsIn(String(finding)))).map(entry=>slash(entry).replace(/\/$/,''));
    const claimed=entry=>own.some(file=>file===entry||file.startsWith(`${entry}/`));
    if(!named.length||named.some(claimed))continue;
    state.needUser=state.needUser.filter(line=>!(line.op===op.id&&line.kind==='validator'));
    op.status='ready';op.attempt=(op.attempt??1)+1;op.dispatch=null;op.terminal=null;op.nudged=false;op.validatorRejects=0;
    op.findings=[`the validator's earlier findings named only files you never reported as yours (${named.join(', ')}): they are another operation's work beside yours and are not judged against you any more. Leave them exactly as they are and report only the files you write.`];
    store.appendEvent({event:'validator-readmitted',op:op.id,files:named});
  }
  // An ask that reported a provision present while an older build masked the variable's name: the owner's item it
  // became is not the owner's, and its requesters are still paused on a provision already made. Settled again
  // from the report it gave, exactly as the report would have been settled then.
  for(const ask of state.ops.filter(item=>isAsk(item.kind)&&item.status==='done'&&!item.answer&&/^\s*credential:\s*[A-Z][A-Z0-9_]*\s+present/m.test(String(item.reports?.at?.(-1)?.summary??'')))){
    const paused=state.ops.filter(item=>item.status==='paused'&&item.waitingFor===ask.id);
    if(!paused.length)continue;
    state.needUser=state.needUser.filter(line=>!(line.op===ask.id&&line.kind==='decision'));
    settleOwnerAsk(store,state,ask,ask.reports.at(-1));
    store.appendEvent({event:'ask-resettled',ask:ask.id,requesters:paused.map(item=>item.id),reason:'the variable name in its report was masked by an older build'});
  }
  // A credential ask an older build launched as an agent and that agent could not prepare (blocked, the owner's
  // list holding "could not prepare the question") is a credential to fill in like any other: the kernel takes it
  // over - one line, the `identity fill` command - and its requester waits on the custody, not on a tab.
  for(const op of state.ops.filter(item=>item.kind===PROVISION_ASK&&item.question?.stop==='credential'&&!item.fill&&!item.answer&&['blocked','pending','ready'].includes(item.status))){
    const was=op.status;
    state.needUser=state.needUser.filter(line=>!(line.op===op.id&&line.kind==='decision'));
    op.refusal=null;op.reports=op.reports??[];
    if(ctx.orca&&op.terminal)closeOpTerminal(ctx.orca,store,state,op);
    fillWaiting(orca,store,state,op,ctx);
    store.appendEvent({event:'provision-fill-readmitted',ask:op.id,was,requesters:[...(op.requesters??[])]});
  }
  // Split children an older rule made of a record author are withdrawn: half an intake is not an operation.
  for(const op of state.ops.filter(item=>item.origin==='repair'&&authorsRecord(item.kind)&&!item.nodeId&&/ - only \`/.test(String(item.goal??''))&&['pending','ready','blocked'].includes(item.status)&&item.refusal!=='superseded')){
    op.status='blocked';op.refusal='superseded';op.dispatch=null;op.terminal=null;
    store.appendEvent({event:'split-withdrawn',op:op.id,kind:op.kind,reason:'a record author is never split'});
  }
  // The record author the split was made of was marked done with verdict `split` and never accepted: it runs
  // again as itself, so its records reach the tree through the ordinary acceptance and commit.
  for(const op of state.ops.filter(item=>authorsRecord(item.kind)&&item.status==='done'&&item.verdict==='split')){
    op.status='ready';op.verdict=null;op.attempt=(op.attempt??1)+1;op.dispatch=null;op.terminal=null;op.nudged=false;op.repairs=0;
    op.findings=unique([...(op.findings??[]),'an older rule split this operation by allowlist entry and never accepted its records; run again as one operation over the whole allowlist']);
    store.appendEvent({event:'split-parent-readmitted',op:op.id,kind:op.kind});
  }
  // A conflict an older rule parked for the owner is taken provisionally now: the decision record the intake wrote
  // is read by one detached decision.prepare, and the line leaves the owner's list.
  for(const item of state.needUser.filter(entry=>!ctx.v6&&entry.kind==='decision'&&entry.record&&entry.op&&byId(state,entry.op)?.intake)){
    const intake=byId(state,item.op);
    const ask=openConflictDecision(store,state,intake,{record:null,decision:item.record,detail:String(item.detail??'').replace(/ - answer with workflow-answer.*$/,''),options:item.options??[]},ctx);
    if(ask){state.needUser=state.needUser.filter(entry=>entry!==item);store.appendEvent({event:'conflict-taken-provisionally',op:intake.id,record:item.record,ask:ask.id});}
  }
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
  reconcileCanonicalDecisionInputs(store,state,ctx);
  for(const op of state.ops)if(Array.isArray(op.checks))op.checks=op.checks.filter(check=>!KERNEL_CHECK.test(check.name??''));
  reconcileWithOrca(orca,store,state,{cwd,wait,allocator});
  // The shared runtime ledger is a repository-wide file: this kernel's own entries for operations that are no
  // longer running are leftovers of a crashed start and would hold a slot of an expensive runtime for everybody.
  const swept=allocator.sharedSync?.(state.ops.filter(op=>op.status==='running').map(op=>op.id));
  if(swept?.dropped?.length)store.appendEvent({event:'runtime-loads-swept',dropped:swept.dropped});
  if(!ctx.v6)sweepTreeStrays(store,state,ctx);
  sweepStaleTerminals(orca,store,state,{cwd});
  state.buildStamp=buildStamp();
  rejudgeParked(store,state,ctx);
  recoverSatisfiedDependencyBlocks(store,state);
  sweepResolvedReviewLines(store,state);
  // A finish declared `blocked` over the owner's list is withdrawn once that list is empty and work remains: the
  // items it finished over have been settled (re-judged, retried, taken provisionally) and the workflow is what it was.
  if(state.finished?.outcome==='blocked'&&!state.needUser.length&&state.ops.some(op=>['ready','pending','paused'].includes(op.status))){
    store.appendEvent({event:'finish-withdrawn',outcome:state.finished.outcome,reason:state.finished.reason,because:'every item on the owner\'s list has been settled and work remains'});
    state.finished=null;state.phase='run';state.stalls=0;state.stalledSince=null;
  }
  // Existing fill waits need their GUI immediately on resume, including a kernel restarted into old state.
  refreshPreparation(store,state,ctx);
  for(const ask of fillWaitingAsks(state))ask.inputMode=ctx.host.name==='orca'?'gui':'cli';
  reconcileInputs(orca,store,state,ctx);
  for(let iteration=0;iteration<maxIterations&&!state.finished;iteration+=1){
    ctx.currentOp=null;
    ctx.v6?.pulse();
    if(iteration>0&&iteration%RECONCILE_EVERY===0){reconcileWithOrca(orca,store,state,{cwd,wait,allocator});if(!ctx.v6)sweepTreeStrays(store,state,ctx);}
    if((iteration>0&&iteration%RECONCILE_EVERY===0)||now()-(state.lastSweepAt??0)>=SWEEP_MS){sweepStaleTerminals(orca,store,state,{cwd,now});reviveSupervisor(store,state,ctx,{now});}
    if(stopRequested(store)){store.appendEvent({event:'stopped',reason:'stop flag'});releaseKernelTab(orca,store,state,{cwd,reason:'paused by stop flag'});store.saveState(state);return state;}
    reconcileCanonicalDecisionInputs(store,state,ctx);
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
    recoverSatisfiedDependencyBlocks(store,state,{events:[]});
    sweepResolvedReviewLines(store,state);
    drainSharedQueue(store,state,ctx);
    // A provisional decision travels to everything built behind it, and the owner's list carries one line per
    // question - not the same line once per iteration.
    inheritProvisional(state);
    sweepStaleLines(store,state);
    const merged=dedupeNeedUser(state);
    if(merged)store.appendEvent({event:'need-user-deduplicated',dropped:merged,items:state.needUser.length});
    // What the owner would read now, recorded when - and only when - it differs from what they would have read
    // last tick. The event is the trail of the question, not a heartbeat of the list.
    noteOwnerList(store,state);
    if(guardedStage(store,state,ctx,'sync',()=>{syncLedgerOps(store,state,ctx);if(state.engine?.coordination!=='agent-v1')planVerifyOps(store,state,ctx);})==='stop')break;
    let managed=state.engine?.coordination==='agent-v1'?{pending:true,dispatch:[]}:null;
    if(state.engine?.coordination==='agent-v1'&&guardedStage(store,state,ctx,'manager',()=>{managed=coordinateManagedWorkflow(store,state,ctx);})==='stop')break;
    if(!managed?.pending&&!managed?.incident&&guardedStage(store,state,ctx,'schedule',()=>scheduleOps(orca,store,state,ctx,{orderedOpIds:managed?managed.dispatch:null}))==='stop')break;
    // A credential ask already waiting but with no command to copy - its custody was named in a place nothing had
    // read yet - is asked again every tick until it has one. Nothing else revisits it: it is not scheduled, and the
    // start migrations only see asks that are not waiting yet, so ask-6 waited with an empty line for an hour.
    for(const ask of state.ops.filter(op=>op.fill===true&&op.status==='running'&&!op.fillCommand&&!op.answer))
      fillWaiting(orca,store,state,ask,ctx);
    // Has the owner run the fill command yet? Answered by the custody file and nothing else (`provision-filled`),
    // after scheduling, because a credential ask becomes the owner's exactly by not being scheduled.
    refreshPreparation(store,state,ctx);
    settleFilledAsks(store,state,ctx);
    reconcileInputs(orca,store,state,ctx);
    store.saveState(state);
    state.allocation=typeof allocator.serialize==='function'?allocator.serialize():allocator.snapshot?.()??null;
    // A provider limit another kernel ran into is this kernel's limit too; it is recorded once, when it is learned.
    for(const notice of allocator.takeSharedNotices?.()??[])
      store.appendEvent({event:'runtime-cooling-shared',runtime:notice.runtime,until:notice.until,wakeAt:notice.wakeAt,from:notice.from,reason:notice.reason??null});
    const running=state.ops.filter(op=>op.status==='running');
    // Fast path: an operation whose report is already on disk is accepted before any blocking wait.
    let early=null;
    if(guardedStage(store,state,ctx,'accept',()=>{early=acceptReports(orca,store,state,ctx);})==='stop')break;
    if(Array.isArray(early)&&early.length){store.appendEvent({event:'accepted-early',ops:early.map(item=>item.op)});store.saveState(state);continue;}
    // A strategic model call is a durable wait. Owner inbox, report acceptance and lease pulses ran above;
    // do not classify that wait as worker starvation or finish while its result still needs reconciliation.
    if(managed?.pending){store.saveState(state);wait(Math.min(pollMs,1000));continue;}
    if(running.length){
      if(ctx.v6&&state.ops.some(op=>op.v6Pending)){store.saveState(state);wait(Math.min(pollMs,1000));continue;}
      const inputWait=fillWaitingAsks(state).length>0;
      const tick=waitTick(orca,{cwd:state.worktree,run:state.run,from:state.from,
        timeoutMs:inputWait?Math.min(waitTimeoutMs,5000):waitTimeoutMs,tickMs:inputWait?Math.min(tickMs,5000):tickMs,
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
      // A stall over a bound that time lifts - a daily op budget spent, a cooldown, every slot taken - is a wait,
      // never a finish: the budget rolls with the UTC day and the cooldown ends, and the work is exactly what it was.
      // Only a stall nobody can name a reason for reaches the owner as an environment item.
      const waiting=state.ops.filter(op=>op.status==='ready');
      const timeBound=waiting.length>0&&waiting.every(op=>/budget exhausted|cooling|no free slot|rate-limit/i.test(String(op.deferral?.reason??'')));
      if(timeBound){
        if(now()-(state.budgetWaitAt??0)>=30*60*1000){
          state.budgetWaitAt=now();
          store.appendEvent({event:'budget-wait',ops:waiting.map(op=>op.id),since:state.stalledSince,reason:waiting[0].deferral.reason});
        }
        state.stalledSince=now();
      }else if(now()-state.stalledSince>=STALL_MS){
        state.needUser.push({kind:'environment',detail:`no runtime accepted an operation for ${Math.round((now()-state.stalledSince)/60000)} minutes (${state.stalls} attempts)`});
        finish(store,state,'blocked','no runtime accepted an operation',ctx);
        break;
      }
      store.saveState(state);
      wait(ctx.v6?Math.min(pollMs,5000):pollMs);
      continue;
    }
    let gate;
    try{ctx.currentOp=null;gate=runGates(store,state,ctx);}
    catch(error){if(!isJobPending(error))throw error;store.saveState(state);wait(Math.min(pollMs,1000));continue;}
    if(gate.ok){
      // A node of another repository of the product is settled there, never here: it does not hold this
      // workflow open, and the final ledger names it as `out-of-repository`.
      const unverified=state.ledger.filter(item=>!['verified','preexisting','out-of-repository'].includes(item.status));
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
/**
 * The launcher a workflow persisted is the file its contracts tell every op to report through. A build that
 * lays the runtime out differently leaves that path behind, and a workflow that started under the old layout
 * writes fresh contracts naming a file that is not there: an op then cannot report, or reports through
 * whatever it finds. An absolute launcher that no longer exists is replaced by the one this build has, and the
 * exchange is recorded (`launcher-relocated`); a relative launcher (a test's stand-in) is left alone.
 */
/**
 * The supervisor revives a dead kernel; nobody revived a dead supervisor, and one afternoon both died in the same
 * second and the workflow sat for an hour with nine ops "running" and nothing running them. Every round the
 * supervisor writes `supervisor.lock {pid, at}` beside each store; a kernel that finds it stale (no round for
 * SUPERVISOR_STALE_MS) with its pid gone starts one from the same command line, detached, at most once per
 * SUPERVISOR_REVIVE_EVERY_MS - and says so (`supervisor-revived`). A lock that was never written is left alone:
 * a kernel run by hand, or by a test, has no supervisor to miss.
 */
export const SUPERVISOR_STALE_MS=5*60*1000;
export const SUPERVISOR_REVIVE_EVERY_MS=10*60*1000;
export function reviveSupervisor(store,state,ctx,{now=Date.now,spawn=spawnDetached,alive=pidAlive}={}){
  const file=path.join(path.dirname(store.dir),'supervisor.lock');
  let lock=null;try{lock=JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}
  if(!lock||typeof lock.at!=='number')return null;
  if(now()-lock.at<SUPERVISOR_STALE_MS)return null;
  if(lock.pid&&alive(lock.pid))return null;
  if(state.supervisorRevivedAt&&now()-state.supervisorRevivedAt<SUPERVISOR_REVIVE_EVERY_MS)return null;
  if(!state.host)return null;
  const args=[path.join(state.host,'bin','starci.mjs'),'workflow-supervise','--host',state.host];
  let pid=null;
  try{pid=spawn(process.execPath,args,{cwd:state.worktree});}catch(error){store.appendEvent({event:'supervisor-revive-failed',reason:String(error?.message??error)});return null;}
  state.supervisorRevivedAt=now();
  store.appendEvent({event:'supervisor-revived',pid,silentMs:now()-lock.at,lastPid:lock.pid??null});
  return pid;
}
function spawnDetached(executable,args,{cwd}){
  const child=spawn(executable,args,{cwd,detached:true,stdio:'ignore',windowsHide:true});
  child.unref();
  return child.pid??null;
}
function pidAlive(pid){try{process.kill(pid,0);return true;}catch{return false;}}

export function relocateLauncher(store,state){
  const current=state.launcher?slash(String(state.launcher)):null;
  if(!current||!path.isAbsolute(current)||fs.existsSync(current))return false;
  const to=launcherOf(state.host);
  if(!fs.existsSync(to)||to===current)return false;
  state.launcher=to;
  store.appendEvent({event:'launcher-relocated',from:current,to});
  return true;
}
const templateOf=host=>fs.readFileSync(path.join(host,'docs','supervision-templates','op.md'),'utf8');

/** One kernel per workflow: a pid lock in the store refuses a second process; a stop flag ends the loop cleanly. */
function acquireKernelLock(store,{launchToken=null}={}){
  const lock=path.join(store.dir,'kernel.lock');
  const owner=acquireStartup(store.dir,{launchToken,pid:process.pid});
  try{fs.writeFileSync(lock,JSON.stringify({pid:process.pid,startedAt:Date.now(),startupToken:owner.token}));}
  catch(error){releaseStartup(store.dir,owner);throw error;}
  return ()=>{releaseStartup(store.dir,owner);try{const now=JSON.parse(fs.readFileSync(lock,'utf8'));if(now.pid===process.pid&&now.startupToken===owner.token)fs.rmSync(lock);}catch{}};
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
export function applyInbox(store,state,ctx){
  let files=[];
  try{files=fs.readdirSync(store.paths.inbox).filter(name=>name.endsWith('.json')).sort();}catch{return;}
  for(const name of files){
    const file=path.join(store.paths.inbox,name);
    let command=null;
    try{command=JSON.parse(fs.readFileSync(file,'utf8'));}catch{command=null;}
    if(!plain(command))continue;
    if(command.schema==='starci/job@1'&&command.kind==='owner-action'){
      const eventId=command.eventId??name;
      const apply=next=>{
        next.ownerInboxReceipts??={};
        if(next.ownerInboxReceipts[eventId])return;
        const pendingEvents=[];
        const atomicStore={appendEvent:event=>pendingEvents.push(event),saveState:()=>{}};
        const result=applyOwnerInbox(atomicStore,next,command,{verificationReceipts:next.verificationReceipts??[]});
        if(result.ok&&['answer','choose','confirm'].includes(result.receipt?.actionType)){
          const continued=continueOwnerRequest(atomicStore,next,{receipt:result.receipt,currentRequest:result.request});
          if(!continued.ok)throw Error(`Owner continuation rejected: ${continued.code}`);
        }
        next.ownerInboxReceipts[eventId]={ok:result.ok,code:result.code,at:Date.now(),events:pendingEvents};
      };
      if(ctx.v6&&store.transition){const next=store.transition(state,{transitionId:eventId,event:{kind:'owner-action-applied',payload:{eventId}},apply});Object.assign(state,next);}
      else {apply(state);store.saveState(state);}
      try{fs.rmSync(file,{force:true});}catch{}
      continue;
    }
    try{fs.rmSync(file,{force:true});}catch{}
    if(command.kind==='approve'){
      const before={budget:dynamicBudget(state),quota:JSON.stringify(state.quota??null)};
      approve(store,state,{allocation:command.allocation??null,allowDynamic:command.allowDynamic??null,acceptCritique:command.acceptCritique??null,host:ctx.host});
      const quotaChanged=JSON.stringify(state.quota??null)!==before.quota;
      store.appendEvent({event:'inbox-applied',kind:'approve',allocation:command.allocation??null,allowDynamic:command.allowDynamic??null,budget:{from:before.budget,to:dynamicBudget(state)},quotaChanged});
      // The allocator was built from the quota at start: a new allocation takes effect at the next kernel start,
      // which the supervisor gives within a minute once this loop returns.
      if(quotaChanged)state.restartRequested='allocation changed';
    }else if(command.kind==='answer'){
      try{const answered=answerOwnerQuestion(store,state,{op:command.op,choice:command.choice??null,note:command.note??null},ctx);store.appendEvent({event:'inbox-applied',kind:'answer',ask:answered.ask});}
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
      gates:csv(options.gates),store,host,launcher:launcherOf(host),ledgerMode,scope:csv(options.scope),reintake:csv(options.reintake),migrate:csv(options.migrate),repoRoot:code,lane,
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
    // The provider quota the goal phase selects on is refreshed through the host's typed probe when it has one;
    // a host that cannot read it answers a reason, and the selector then chooses nothing rather than guessing.
    const budget=root=>freshRuntimeBudget(root,{probe:typeof orca?.probeBudget==='function'?()=>orca.probeBudget():probeRuntimeBudget});
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,
      ...goalPhase(store,state,{cwd:code,ledgerRoot:options['ledger-root']??null,budget,...functions})};
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
  if(command==='workflow-retry'){
    const {store,state}=open(options.id);
    need(state.approved,'Only an approved workflow can be retried');
    need(!kernelAlive(store),'Pause the workflow with workflow-stop and wait for its kernel to exit before retrying');
    need(options.engine==='6','workflow-retry currently requires --engine 6');
    const pin=options['runtime-pin']?readJson(path.resolve(options['runtime-pin']),null):state.engine?.runtimePin;
    const checked=verifyRuntimePin(pin);need(checked.ok,`A verified runtime pin is required: ${checked.reason??''}`);
    if(state.engine?.major===6&&store.readEvents().some(event=>event.event==='legacy-coordinator-no-effect-proved')){
      const runtimeRoot=path.dirname(state.engine.journalFile),runtimeProfile=loadRuntimes(),policy=createWorkflowModelEligibility({runtimes:runtimeProfile,state,
        policyFile:path.join(skillRoot,'.dist','model','capabilities.json'),qualificationsFile:path.join(runtimeRoot,'model-qualifications.json'),probationsFile:path.join(runtimeRoot,'model-probations.json'),root:runtimeRoot});
      const refundRuntime=createV6Runtime({store,state,modelPolicy:policy,eligibility:()=>({eligible:false,reasons:['refund-only runtime']} )});
      try{refundLegacyCoordinatorProbations(store,state,refundRuntime);}finally{refundRuntime.close();}
    }
    const retryJobs=state.engine?.major===6?prepareGenerationRetry({journalFile:state.engine.journalFile,workflowId:state.id,generation:state.engine.generation}):{cancelled:[],unsettled:[]};
    if(retryJobs.cancelled.length)store.appendEvent({event:'retry-queued-jobs-cancelled',generation:state.engine.generation,jobs:retryJobs.cancelled,proof:'queued, unleased, and no job-spawned receipt'});
    need(!retryJobs.unsettled.length,`Current-generation durable model/check jobs must settle before retry: ${retryJobs.unsettled.join(', ')}`);
    for(const op of state.ops.filter(item=>item.v6Lease&&!retryableV6Operation(item)&&item.launch?.task&&item.launch?.dispatch&&!item.dispatch&&!item.terminal&&item.v6Candidate?.bridge)){
      const reconciled=reconcileStoppedNativeRetryLease(state,op,{orca,store});
      need(reconciled.ok,`Stopped native lease ${op.v6Lease?.jobId??op.id} cannot be reconciled for retry: ${reconciled.reason}`);
    }
    for(const op of state.ops.filter(item=>item.v6Lease&&!retryableV6Operation(item)&&item.launch?.task&&!item.dispatch&&!item.terminal)){
      const reconciled=reconcileFailedLaunchLease(state,op,{orca,store});need(reconciled.ok,`Failed launch lease ${op.v6Lease?.jobId??op.id} cannot be proved stopped: ${reconciled.reason}`);
    }
    for(const op of state.ops.filter(item=>item.v6Lease&&!retryableV6Operation(item)&&item.launch?.stopReason===LEGACY_COORDINATOR_ERROR)){
      const reconciled=reconcileLegacyCoordinatorLease(state,op,{orca,store});need(reconciled.ok,`Legacy coordinator lease ${op.v6Lease?.jobId??op.id} cannot be proved no-effect: ${reconciled.reason}`);
    }
    settleSkippedGenerationLeases(state);
    const priorGeneration=state.engine?.generation??0;
    const retry=[];
    for(const op of state.ops){
      if(!retryableV6Operation(op))continue;
      if(op.dispatch){
        const settled=settleDispatch(orca,op.dispatch,{cwd:state.worktree,reason:'owner requested fresh v6 workflow retry',terminalHandle:op.terminal,closeTerminal:true,wait});
        need(settled.effectState==='none',`Dispatch ${op.dispatch} must be reconciled before retry; its effect state is ${settled.effectState}`);
        store.appendEvent({event:'retry-dispatch-settled',op:op.id,dispatch:op.dispatch,effectState:settled.effectState});
      }
      if(op.v6Lease){
        need(Boolean(op.dispatch)||op.v6WorkerSettled===true,`Operation ${op.id} has a durable lease but no confirmed native stop receipt`);
        const released=settleGenerationLeases({journalFile:state.engine.journalFile,leases:[op.v6Lease],reason:'workflow retry after confirmed native dispatch stop'})[0];
        need(released?.ok,`Durable lease ${op.v6Lease.jobId} could not be settled before retry: ${released?.reason??'unknown'}`);
      }
      const reconciledNative=op.v6RetryReconciled;
      const provenance=retryOwnedBaseline(state,op),dirty=provenance.changed,
        owned=reconciledNative?[...new Set(reconciledNative.observedFiles??[])].filter(file=>provenance.changed.includes(file)):provenance.attributed,
        unclaimed=provenance.changed.filter(file=>!owned.includes(file));
      op.v6OwnedBaselinePaths=owned;
      store.appendEvent({event:'retry-provenance',op:op.id,attempt:op.attempt,changed:dirty,attributed:owned,unclaimed,
        policy:unclaimed.length?'unclaimed dirty paths remain protected and are not adopted':'every adopted dirty path is both reported by this operation and present in Git status'});
      op.status='ready';op.attempt=(op.attempt??1)+1;op.dispatch=null;op.terminal=null;op.nudged=false;
      op.findings=[];op.priorOpen=[];op.retryFromCanonical=true;
      if(reconciledNative)op.v6PriorStoppedAttempt={attempt:reconciledNative.attempt,dispatch:reconciledNative.dispatch,
        candidateDigest:reconciledNative.candidateDigest??null,observedFiles:[...owned]};
      if(op.refusal==='runtime-reconciliation')delete op.refusal;
      delete op.quarantineSignature;
      state.needUser=state.needUser.filter(item=>!(item.op===op.id&&['candidate-reconciliation','runtime-reconciliation'].includes(item.code)));
      for(const key of ['v6Lease','v6Pending','v6WorkerSettled','v6RetryReconciled','baseHead','kernelOwnedAt','recordBlocks'])delete op[key];
      retry.push(op.id);
      store.saveState(state);
    }
    resetReviewEpoch(store,state,priorGeneration);
    const engine=enrollV6(store,state,{runtimePin:pin,journalFile:options['journal-file']??state.engine?.journalFile});state.launcher=checked.launcher;
    store.appendEvent({event:'workflow-retried',engine:6,generation:engine.generation,ops:retry,context:'fresh agents from canonical approved inputs and Work'});
    store.saveState(state);
    fs.rmSync(path.join(store.dir,'stop.flag'),{force:true});
    return {schema:WORKFLOW_KERNEL,command,ok:true,id:state.id,engine:6,generation:engine.generation,retried:retry,
      next:'The supervisor starts the approved workflow on its sealed runtime. This is a resumed workflow trial, not a clean end-to-end trial.'};
  }
  if(command==='workflow-answer'){
    const {store,state}=open(options.id);
    need(options.op,'workflow-answer needs --op <decision.prepare or provision.ask op id>');
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
      engine:state.engine?{major:state.engine.major,version:state.engine.version,generation:state.engine.generation,
        assurance:state.engine.assurance,runtimeDigest:state.engine.runtimePin?.digest??null}:null,
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
      gates:state.gateResults,needUser:state.needUser,provisional:state.provisional??[],
      // The three owner-facing places in one list, so a machine reading this record asks the same question the
      // page asks: what is waiting on the owner, and what do they type for it - the credentials to fill included.
      owner:ownerItems(state),ownerReport:[...ownerLines(state),...ownerFillLines(state)].join('\n'),
      inputPreparation:fillWaitingAsks(state).filter(ask=>!ask.credential?.ready).length,
      ownerFill:inputReadyAsks(state).map(ask=>({op:ask.id,variables:[...(ask.credential?.variables??[])],
        custody:ask.credential?.custody??null,command:ask.fillCommand??null,requesters:[...(ask.requesters??[])]})),
      finished:state.finished,
      events:store.readEvents().slice(-20),final:readJson(store.paths.final,null)};
  }
  if(command==='workflow-run'){
    const {store,state}=open(options.id);
    need(state.approved,`Workflow ${state.id} is not approved yet; run workflow-approve --id ${state.id}`);
    const releaseKernel=acquireKernelLock(store,{launchToken:options['startup-token']??null});
    try{
    const host=hostDescriptorOf(orca);
    if(isV6(state)){
      const pinned=verifyRuntimePin(state.engine.runtimePin);need(pinned.ok,`Runtime pin verification failed: ${pinned.reason??''}`);
      need(path.resolve(skillRoot)===path.resolve(state.engine.runtimePin.root),'An enrolled workflow must start through its sealed runtime launcher');
      state.launcher=pinned.launcher;
    }
    // A host that keeps files (the headless table, mailbox and dispatch logs) keeps them beside this workflow's own.
    if(typeof orca?.bindStore==='function')orca.bindStore(store.dir);
    // The supervisor starts the next kernel of this workflow on the same host, so the host is a fact of the state.
    state.hostAdapter=host.name;
    const launchFile=options['launch-file']?path.resolve(worktree,options['launch-file']):store.paths.launch;
    let from=options.from??state.from,run=options.run??state.run,launchTask=null,openedKernelTerminal=false;
    if(!from&&fs.existsSync(launchFile)){const launch=awaitLaunch(launchFile,{wait});from=launch.from;run=run??launch.run??null;launchTask=launch.task??null;if(launchTask)state.workflowTask=launchTask;}
    if(!from){
      // No coordinator terminal handed this kernel a handle (the supervisor started it): the kernel is its own
      // Orca terminal in the worktree - the one titled after it, reused across restarts, never a new tab per start.
      from=ownKernelTerminal(orca,store,state,worktree);
      state.kernelTerminalOwned=true;openedKernelTerminal=true;
    }
    state.from=required(from,'own terminal handle');
    // `run-bound` is the one-time hand-off this kernel performed; joining a run it already has is `run-resumed`.
    const binding=!run;
    state.run=run??bindRun(orca,{cwd:worktree,state,from:state.from});
    if(!binding)rebindRunIfNeeded(orca,store,state,{cwd:worktree});
    state.host=state.host??hostOf(options,repoRoot);
    state.launcher=state.launcher??launcherOf(state.host);
    relocateLauncher(store,state);
    const invocationOwnsTerminal=openedKernelTerminal||(()=>{try{return listTerminals(orca,worktree).some(item=>item.handle===state.from&&item.title===`[Kernel] ${state.id}`);}catch{return false;}})();
    const runtimeBinding={workflowId:state.id,from:state.from,run:state.run,hostAdapter:state.hostAdapter,launcher:state.launcher,
      kernelTerminalOwned:invocationOwnsTerminal,...(launchTask?{workflowTask:launchTask}:{})};
    store.appendEvent({event:binding?'run-bound':'run-resumed',run:state.run,from:state.from,iterations:state.iterations});
    const runtimeProfile=withSupervisorPreference(loadRuntimes(),supervisorRuntimes(workflowModelConfigRoot(state)));
    let modelPolicy=null;
    if(isV6(state)){
      const root=path.dirname(state.engine.journalFile);fs.mkdirSync(root,{recursive:true});
      modelPolicy=createWorkflowModelEligibility({runtimes:runtimeProfile,state,policyFile:path.join(skillRoot,'.dist','model','capabilities.json'),
        qualificationsFile:path.join(root,'model-qualifications.json'),probationsFile:path.join(root,'model-probations.json'),root});
    }
    const eligibility=modelPolicy?((job,runtime)=>{
      const op=job?.input?.op??job;
      const actual={...op,opId:job.opId??op.opId??op.id,kind:job?.input?.functionName?job.kind:op.kind,
        ...(job?.input?.functionName?{input:job.input}:{}),
        role:job.role??kindRole(op.kind),independentReview:{required:true,freshContext:true},
        checks:op.checks};
      return modelPolicy.eligibility(actual,runtime);
    }):null;
    fs.rmSync(path.join(store.dir,'stop.flag'),{force:true});
    const finished=runLoop(orca,store,state,{cwd:worktree,wait,
      // Slots are derived from the operations that are actually running; saved loads may belong to a dead kernel.
      supervisor:supervisorRuntimes(workflowModelConfigRoot(state)),validator:validatorRuntimes(workflowModelConfigRoot(state)),
      // Every kernel of this repository shares one runtime ledger beside the workflow directories, so an
      // expensive runtime another workflow is on is load here too and a provider cooldown is seen by all.
      // A sequential host (headless) caps the allocator at one operation whatever the approved quota says.
      allocator:createAllocator({runtimes:runtimeProfile,state:{...(state.allocation??{}),loads:Object.fromEntries(Object.entries(state.ops.filter(op=>op.status==='running'&&op.runtime).reduce((acc,op)=>{acc[op.runtime]=(acc[op.runtime]??0)+1;return acc;},{})))},quota:state.quota??null,shared:{path:loadsFileFor(store.dir),workflow:state.id},budget:{path:path.dirname(store.dir)},sequential:host.sequential,eligibility}),template:templateOf(isV6(state)?state.engine.runtimePin.root:state.host),host,
      modelEligibility:eligibility,modelPolicy,runtimeBinding,
      ledgerRoot:options['ledger-root']??null,
      maxIterations:options['max-iterations']?Number(options['max-iterations']):Infinity,...functions});
    // The kernel's own tab is the Run's coordinator terminal, so it lives as long as the workflow: a pause or a
    // rebuild leaves it for the next start to reuse (a new tab would have to re-bind the Run and fence every live
    // Dispatch). A finished workflow closes it: nobody reads it any more.
    if(finished.finished&&state.kernelTerminalOwned&&state.from){try{orca.invoke('terminal-close',{terminal:state.from},{cwd:worktree});}catch{}store.appendEvent({event:'kernel-terminal-closed',terminal:state.from});state.from=null;state.kernelTerminalOwned=false;store.saveState(state);}
    return {schema:WORKFLOW_KERNEL,command,id:state.id,dir:store.dir,phase:finished.phase,ledgerMode:finished.ledgerMode,
      finished:finished.finished,lane:laneView(finished),ledger:finished.ledger.map(item=>`${item.id}=${item.status}`),
      ledgerSummary:finished.ledgerSummary,needUser:finished.needUser,head:finished.head,iterations:finished.iterations,
      ledgerRoot:finished.ledgerRoot?slash(finished.ledgerRoot):null,ledgerShared:Boolean(finished.ledgerShared),
      ledgerOwner:finished.ledgerShared?(finished.ledgerOwner?.repository??slash(finished.ledgerOwner?.repoRoot??'')):null};
    }finally{releaseKernel();}
  }
  throw Error(`Unsupported workflow kernel command: ${command}`);
}

// The CLI surface is the canonical launcher (`hosts/orca/launch.mjs workflow-goal|workflow-approve|
// workflow-run|workflow-status`), which routes straight into kernelMain; this module stays import-only.
