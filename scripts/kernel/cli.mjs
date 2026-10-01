#!/usr/bin/env node
// cli.mjs — the kernel agent's ONLY gate to the ledger. One thin command per
// state operation; the long-lived [Kernel] never opens .starciwork/runtime.sqlite
// itself and never spawns op terminals by hand — `dispatch` owns that.
//
//   node scripts/kernel/cli.mjs <cmd> --repo <path> [...] [--json]
//
//   survey   --repo <path> --workflow <id> [--deliveries]
//   status   --repo <path> --workflow <id>
//   hierarchy --repo <path> --workflow <id>
//   plan     --repo <path> --workflow <id> --file <plan.json>
//   enqueue  --repo <path> --workflow <id> --op <opId> --paths <csv> [--title <t>] [--risk <r>]
//            [--repository <repo-id>] [--cut-id <id> --cut-ordinal <n> --cut-total <n>]
//   estimate --repo <path> --files <n> [--assertions <n>] [--components <n>] [--records <n>]
//            [--paths <csv>] [--gear <n>]
//   route    --repo <path> --job <job_id> [--difficulty <d>]
//   dispatch --repo <path> --job <job_id> [--model <target>] [--worktree <sel>] [--spawn] [--lease-ttl <ms>]
//   reconcile --repo <path> (--orphan-kernel-jobs | --orca-tasks) [--workflow <id>] [--dry-run]
//   nudge    --repo <path> --job <job_id>
//   observe  --repo <path> --job <job_id> [--lines <n>]
//   questions --repo <path> --workflow <id>
//   reply    --repo <path> --workflow <id> --message <msg_id> (--body <answer> | --to-owner [--body <note>])
//   peers    --repo <path> --workflow <id>
//   notify   --repo <path> --workflow <id> --to <peerId,...|peers> --kind <request|heads-up|handoff|reply|follow-up>
//            --subject <s> --body <text> [--reply-to <key>] [--refs <csv>]
//   inbox    --repo <path> --workflow <id> [--ack <key> --disposition <text>]
//   foundations --repo <path> [--workflow <id>]
//   foundation --repo <path> --workflow <id> (--claim <name> | --declare-dependent <name> | --land <name> --proof <s> | --declare-none)
//   settle   --repo <path> --job <job_id> --verdict <pass|fail|blocked> [--report <path>]
//   report   --repo <path> --job <job_id> --report <file> [--outcome <done|partial|failed|ask|blocked>]
//   op-contract --repo <path> --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
//   check    --repo <path> --job <job_id> (--checks '<json>' | --checks-file <path>)
//   consume-report --repo <path> --job <job_id>
//   (enqueue also takes [--after <jobId>,...]: jobs that must settle succeeded first)
//   incident --repo <path> --workflow <id> --kind <k> --detail <s> [--op <opId>] [--holds <opId|jobId>,...]
//   incident --repo <path> --workflow <id> --kind peer-wait --peer <workflowId> --detail <s> [--op <opId>] [--holds ...] [--refs <csv>] [--until-message]
//   incident --repo <path> --workflow <id> --resolve <incidentId> [--detail <s>] [--by kernel|owner|supervisor] [--owner-answer <dispatchId>]
//   (incident also takes typed release conditions, [--until-record <path>[@state|>=rev]] [--until-job <jobId>[:settled|succeeded]]
//    [--until-message <peer>[:kind]] [--until-commit <repo>:<ref-or-path>] [--until-incident <id>[:resolved]], each repeatable,
//    or --attach <incidentId> with them to type an open incident; scripts/kernel/gate-conditions.mjs)
//   finish   --repo <path> --workflow <id>
//   kernel-ack-rev --repo <path> --workflow <id> --rev <sha> [--files <csv>]
//   contract-release --repo <path> --family <op> [--workflow <id>] [--batch <name>] [--reason <text>] [--dry-run]
//   run-deferred-tests --repo <path> --workflow <id> [--kind unit|e2e|integration] [--dry-run]
//
// Every read prints a JSON-safe result; every write runs inside one
// ledger.transaction. --json gives the machine form; without it each command
// prints a compact human line. Bad arguments exit 2 with usage.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import cp, { spawn, spawnSync } from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import {
  openLedger, ledgerFileFor, newToken, JOB_STATUSES, reserveTwoPhase,
  startAttempt, writeContract, updateContractContext, updateAttempt, endRejectedAttempt, setJobStatus, recordJobResult, releaseLeases, openIncident,
  updateJob, updateIncident, resolveIncident, renewLeases, setSignal, clearSignal, setInboxStatus, jobResult, setUnitState, getUnit,
} from '../../engine/db/ledger.mjs';
import { machineFileFor, openMachine } from '../../engine/db/machine.mjs';
import { recordWhy } from './why-record.mjs';
import { gateBaseOf } from './workflow-checkpoint.mjs';
import { workflowWorktreeOf } from './workflow-worktree.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import {
  AWAITING_OWNER, RETRY_CLASS_ENVIRONMENT, admitOpSlot,
  findOwnedPathLeaseConflicts, ownedPathLeaseRequests, retiredBeforeDispatch, ownedPathsIntersect,
} from '../../engine/admission.mjs';
import { admitUnit, spentTriesOf, unitStateOf, writeUnitTry } from './units.mjs';
import { independentChecksOf } from './verbs/shared/check-evidence.mjs';
import { activeDelegation, allocationMs, allocationSettings, inspectOwnerConfig, loadConfig, runtimeProfile } from '../../engine/config.mjs';
import { OP_REPORT_OUTCOMES } from './report-envelope.mjs';
import { ownedPathEffects } from './settle-landed.mjs';
import { lineageJobsOf } from './owner-answers.mjs';
import { isAwaitingOwner, unresolvedFailures } from './failure-steps.mjs';
import { planAncestorsOf, planGraphOf } from '../route/plan-edges.mjs';
import { domainsOfPaths, latestVersion as latestGraphVersion } from '../work/work-graph-store.mjs';
import { lineageRouteAdjust } from './lineage-route.mjs';
import { enqueueRepository, ownedPathPlacements } from './target-repo.mjs';
import { deliverPrompt, loadAdapter, PROMPT_DELIVERY_STALLED, gateAutoAnswerRule } from '../agent/lib.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow, TERMINAL_GONE_CODES } from '../api/orca/terminal-show.mjs';
import { terminalSend } from '../api/orca/terminal-send.mjs';
import { sleepSync } from '../lib/sleep-sync.mjs';
import { parseJson } from '../lib/json.mjs';
// The reads and guards the split-out verbs share with what stays here (lane slim-api):
// one definition per helper, in scripts/kernel/verbs/shared/, imported back under the same names.
import {
  csvList, getWorkflow, goalJsonOf, jobOpOf, jobPayloadOf, operationTerminalHandleOf,
  latestGoal, ownedPathsOf, workDirOf, JOB_ROW, jobResultSql, latestContractOf, latestReportOf, latestAttemptOf,
  operationTaskOf, operationDispatchOf,
} from './verbs/shared/rows.mjs';
import { KERNEL_LAUNCH_EVENTS, kernelSeatOf } from './verbs/shared/kernel-seat.mjs';
import { dispatchEvidenceOf } from './verbs/shared/dispatch-state.mjs';
import { foundationDutyFor } from './verbs/shared/foundation-duty.mjs';
import { resolveJob, reportDispatchIdOf, REPORTABLE_JOB_STATUSES, requireDispatchedReportBinding, parseAttempt, reportIdentityOf } from './verbs/shared/report-binding.mjs';
import { AGENT_HIERARCHY_SCHEMA, workflowNodeId, kernelNodeId, operationNodeId, agentHierarchyFor } from './verbs/shared/hierarchy.mjs';
import { WORKER_QUESTION } from './verbs/shared/messages.mjs';
import { PEER_WAIT, blockingViewOf, leaseCanonOf, openPeerWaits, releaseTypedWaits } from './verbs/shared/peers.mjs';
import { OP_ROLE, callerOf, refuseOpCaller } from './verbs/shared/caller.mjs';
import { slash } from '../lib/path-key.mjs';
import { closeOperationTerminal, closeExitedTerminal } from './close-op-terminal.mjs';
import { closeSelfSafe } from '../machine/close-verify.mjs';
import { releaseSettledSession } from './op-session.mjs';
import { recordSettledAttemptUsage } from './usage-record.mjs';
import { reapAgentProcess } from './reap-agent-process.mjs';
import { withLedgerRead } from '../connectors/lib.mjs';
import { quitAgent } from './quit-agent.mjs';
import { isLiveProofOp } from './ask-server.mjs';
import {
  AUTOPILOT_BY, AUTOPILOT_EVENTS, AUTOPILOT_RULING, HANDOVER_CREDENTIALS_SUBJECT, PROVISIONAL_LABEL,
  SUPERVISOR_GATE, credentialsOwed, deferredQueueCause, openSupervisorGate, provisionalOps,
  routeCapUnderAutopilot,
} from './autopilot.mjs';
import {
  classifyAgentScreen, staleAwareState, outputAgeOf, exitedAgentPromptRow, echoesSentText, collapse,
  clipDraft, TRAILING_ROWS, cardLivenessPatterns, DEFAULT_STAGED_PATTERN,
} from './terminal-liveness.mjs';
import { wakeKernelForTransition } from './wake-delivery.mjs';
import { FOUNDATION_WAIT, SHELL_FOUNDATION, shellFoundationWaitOf } from './shell-foundation.mjs';
import {
  KERNEL_REV_STALE, OP_REV_DRIFT, currentRuntimeRev, kernelRevState, opRevDrift, opRevStale, revRootOf,
  shortRev,
} from './runtime-rev.mjs';
// Pool selection and launch-model resolution, plus the Orca orchestration
// wrappers the managed-agent dispatch path drives — one thin wrapper per
// calls.yaml verb (run-create/task-create/worker-start/dispatch/
// dispatch-show/worker-show/worker-stop/worker-release).
import { selectPool, providerCircuitOf, defaultOperationTarget } from '../agent/models.mjs';
import { readProviderCircuit, writeProviderCircuit as storeProviderCircuit } from './provider-circuit.mjs';
import { credentialFingerprintOf, credentialRotated } from '../agent/credential-fingerprint.mjs';
import { QUOTA_FAILURE_KIND, outageSpecsOf, outageInText, outageOnScreen } from '../agent/provider-outage.mjs';
import { kindRoute as kindRouteOf, isFanOutSlice } from '../agent/models.mjs';
import { recentDispatchCounts, auditAuthorOf } from '../agent/balance.mjs';
import { configuredAllocationPolicy } from '../../engine/config.mjs';
import { deferJob, deferralOf as testDeferralOf, ownerSpecs, deferredTestsOf, planLegDeferral, specsOff } from './spec-deferral.mjs';
import { HANDOVER_OP } from './handover.mjs';
import { baselineWorkInputs, inputDrift } from './input-digests.mjs';
import {
  admittedContractOf, admittedBeforeChange, advisoryCodesFor, changeById, withheldChangesFor, classifyChecks,
  contractVersionOf, laterChangesFor, loadContractChanges,
} from './contract-version.mjs';
import { queueSettleMedia } from '../connectors/telegram-media.mjs';
import { guardLaunch } from '../guards/hook-install.mjs';

import { attributeRedGate, failingFromText, peerRouteOf } from './gate-attribution.mjs';
import { accountList } from '../api/orca/account-list.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { taskCreate } from '../api/orca/task-create.mjs';
import { salvageUnfiledReport, unfiledReportCandidates } from './report-salvage.mjs';
import { gitResult } from '../api/git/lib.mjs';
import { hostWideDisconnectOf } from './host-event.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { workflowDisplayName } from '../lib/display-names.mjs';
import { taskUpdate } from '../api/orca/task-update.mjs';
import {
  SEAM_PRIORITY_CLASS, SEAM_RECONCILE_CHECK, cutSeamSettings, isSeamCut, recutPlanOf, seamPriorityOf,
  seamReconcileOf, seamStateOf, siblingSeamHold, cutManifestOf, canonSettleFollowUpOf,
  canonConformancePolicy,
} from './cut-seam.mjs';
import { destinationsOf } from './progress-rca.mjs';
import {
  LOG_TYPED_MISSING, LOG_TYPED_MISSING_EVENT, insertLogRows,
  openLogs, prepareLogRow, syncLogs, typedLogGaps,
} from './typed-logs.mjs';
import { bindWorkflowRun, staleTasks, CLOSED_TASK_STATUSES } from './orca-runs.mjs';
import { taskList } from '../api/orca/task-list.mjs';
import { UNTIL_FLAGS, lineageHeadById } from './gate-conditions.mjs';
import { extensionUsage, loadApiExtensions, requiredOf, statusExtras } from './api-extensions.mjs';
import { refuseSettleBacklog } from './kernel-authority.mjs';
import { refuseDecisionsFirst } from '../machine/decisions.mjs';
import { DRAW_ACCEPTANCE_CHANGE, drawAcceptanceFindings, jobBoundFiles } from '../work/draw/draw-acceptance.mjs';
import { DRAW_LOOP_CHANGE, settleDrawMetricFindings } from '../work/draw-loop-settle.mjs';
import { recordGrammarProposals } from '../work/grammar-proposal.mjs';
import { ASSET_OP, recordAssetSlots } from '../work/asset-slot.mjs';
import { judgeJob, SONAR_ENFORCE_CHANGE } from './sonar-settle.mjs';
import { judgeJobLoop, judgeJobProofs, OP_GATE_CHANGE, OP_PROOF_CHANGE } from './gate-settle.mjs';
import { PROOF_MEDIA_CHANGE, collectJobFiles, filedReportOf, indexJobArtifacts, jobShasOf, proofMediaGate, proofMediaPolicyOf } from './job-artifacts.mjs';
import { WORK_HYGIENE_CHANGE, checkWorkFilesAbs, inSecretScope, rangeFiles } from '../work/validate/work-hygiene.mjs';
import { taskSpecOf } from './task-spec.mjs';
import { legOrderExemption } from './leg-order.mjs';
import { PROOF_INTEGRITY_CHANGE, coverageOf } from './proof-integrity.mjs';
import { classifyFailure, isMeasurementLeg, measurementCheckClass, resolveRootOwner } from './verify-failure.mjs';
import { starciSourceRoot } from '../housekeeping/hk-orphan-ledgers.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// The owner config (config.yaml) lives at the runtime root. STARCI_OWNER_ROOT points the one
// reader in engine/config.mjs at a different directory holding one — the same test and tooling
// seam scripts/kernel/start-workflow.mjs and scripts/route/route-model.mjs use.
const ownerRoot = process.env.STARCI_OWNER_ROOT ? path.resolve(process.env.STARCI_OWNER_ROOT) : skillRoot;

// The status vocabulary is engine/db/ledger.mjs JOB_STATUSES; these are the
// three views this gate reasons in. enqueue writes 'queued' and settle writes
// 'succeeded'|'failed' — the durable engine's own words.
const FINAL_SETTLED = [...JOB_STATUSES.settled];
// A job's try number (jobs.try_no; JOB_ROW projects it as `attempt`), whichever row shape a caller passes.
const tryOf = (job) => job?.attempt ?? job?.try_no ?? null;
const SETTLED = [...JOB_STATUSES.settled, ...JOB_STATUSES.fenced];
const DISPATCHABLE = [...JOB_STATUSES.dispatchable];
// The reports.outcome vocabulary — the worker-facing half of the op IPC.
const REPORT_OUTCOMES = OP_REPORT_OUTCOMES;
// Kernel verdict ↔ worker outcome consistency at settle: a pass settles a
// `done` report, a fail settles `failed|partial`, a blocked verdict settles
// `blocked|ask` (an unanswered ask is a blocked op). A `done` report is only
// a worker claim: an independently recorded red check may overrule it to fail.
const VERDICT_OUTCOMES = { pass: ['done'], fail: ['failed', 'partial'], blocked: ['blocked', 'ask'] };
const CHECK_PASS_WORDS = new Set(['pass', 'passed', 'ok', 'green', 'success', 'succeeded']);
const CHECK_FAIL_WORDS = new Set(['fail', 'failed', 'error', 'red', 'blocked', 'not-run', 'not_run']);
const isCheckResultEnvelope = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.checks)) return false;
  return value.checks.length > 0 && value.checks.every((check) => {
    if (!check || typeof check !== 'object' || Array.isArray(check)) return false;
    if (typeof check.name !== 'string' || !check.name.trim()) return false;
    if (!Number.isInteger(check.exitCode)) return false;
    if (check.command != null && typeof check.command !== 'string') return false;
    if (check.evidence != null && typeof check.evidence !== 'string') return false;
    // codes: the finding codes that made a red check red (scripts/kernel/contract-version.mjs
    // classifyChecks reads them against the leg's admitted contract).
    if (check.codes != null && (!Array.isArray(check.codes) || !check.codes.every((code) => typeof code === 'string'))) return false;
    // failing: the files a red check's failure implicates (scripts/kernel/gate-attribution.mjs).
    if (check.failing != null && (!Array.isArray(check.failing) || !check.failing.every((file) => typeof file === 'string'))) return false;
    return true;
  });
};
// A red check api check marked `advisory` (a check or finding code a contract change added after
// the leg was admitted) is a suspect, and one it marked `peerBlocked` (its failing files are a
// peer's change, scripts/kernel/gate-attribution.mjs) is the peer's: neither counts passed or
// failed, and a pass still needs at least one green check.
const isAdvisoryCheck = (check) => check.exitCode !== 0 && Boolean(check.advisory && typeof check.advisory === 'object');
const isPeerBlockedCheck = (check) => check.exitCode !== 0 && !isAdvisoryCheck(check) && Boolean(check.peerBlocked && typeof check.peerBlocked === 'object');
/** A measurement leg's red check that ran and measured findings, marked so it counts as a completed measurement. */
const markMeasured = (check) => (check && typeof check === 'object' && measurementCheckClass(check) === 'findings' && !check.peerBlocked && !check.advisory
  ? { ...check, measured: { class: 'findings', leg: 'measurement' } } : check);
const isMeasuredCheck = (check) => check.exitCode !== 0 && !isAdvisoryCheck(check) && !isPeerBlockedCheck(check) && check.measured?.class === 'findings';
// H8: a check the runtime could not re-run is the caller's own word (authority declared): its green never counts
// passed, its red counts failed. One that could not run at all (unavailable) counts neither (H7).
const isDeclaredGreen = (check) => check.authority === 'declared' && check.exitCode === 0;
const isUnavailableCheck = (check) => check.unavailable === true;
const summarizeCheckEvidence = (value) => {
  if (isCheckResultEnvelope(value)) {
    const advisory = value.checks.filter(isAdvisoryCheck).length;
    const peerBlocked = value.checks.filter(isPeerBlockedCheck).length;
    // A measurement leg's check that ran and measured findings (api check marks it `measured`,
    // scripts/kernel/verify-failure.mjs) is a completed measurement: it counts passed.
    const measured = value.checks.filter(isMeasuredCheck).length;
    const declared = value.checks.filter(isDeclaredGreen).length, unavailable = value.checks.filter(isUnavailableCheck).length;
    const passed = value.checks.filter((check) => check.exitCode === 0 && !isDeclaredGreen(check) && !isUnavailableCheck(check)).length + measured;
    const failed = value.checks.length - passed - advisory - peerBlocked - declared - unavailable;
    return { observed: value.checks.length, passed, failed, green: passed > 0 && failed === 0, ...(declared ? { declared } : {}), ...(unavailable ? { unavailable } : {}), ...(advisory ? { advisory } : {}), ...(peerBlocked ? { peerBlocked } : {}), ...(measured ? { measured } : {}) };
  }
  const summary = { observed: 0, passed: 0, failed: 0 };
  const visit = (item, key = '') => {
    const normalizedKey = String(key).trim().toLowerCase();
    if (Array.isArray(item)) { for (const entry of item) visit(entry, normalizedKey); return; }
    if (item && typeof item === 'object') {
      for (const [childKey, child] of Object.entries(item)) visit(child, childKey);
      return;
    }
    if (normalizedKey === 'exitcode' || normalizedKey === 'exit_code') {
      const code = Number(item);
      if (Number.isFinite(code)) {
        summary.observed += 1;
        if (code === 0) summary.passed += 1;
        else summary.failed += 1;
      }
      return;
    }
    if (typeof item === 'boolean' && /^(?:ok|pass|passed|success|succeeded)$/.test(normalizedKey)) {
      summary.observed += 1;
      if (item) summary.passed += 1;
      else summary.failed += 1;
      return;
    }
    if (typeof item !== 'string') return;
    const word = item.trim().toLowerCase();
    if (CHECK_PASS_WORDS.has(word)) { summary.observed += 1; summary.passed += 1; }
    else if (CHECK_FAIL_WORDS.has(word)) { summary.observed += 1; summary.failed += 1; }
  };
  visit(value);
  return { ...summary, green: summary.observed > 0 && summary.failed === 0 && summary.passed > 0 };
};

const usage = (code) => {
  console.error(`use: node scripts/kernel/cli.mjs <cmd> --repo <path> [...] [--json]
  survey   --workflow <id> [--deliveries]
  status   --workflow <id>
  hierarchy --workflow <id>
  artifacts --workflow <id> [--job <job_id>] [--kind <kind>]   every indexed proof file of the workflow's jobs (job_artifacts), per job
  log      --workflow <id> [--job <job_id>] --kind <kind> --msg <short text> [--data '<json>'] [--refs <csv>] [--level info|warn|error] [--node <work-graph node>] [--actor kernel|runtime|check|land]
           one typed log row into the ledger's logs table (the buffered log writer: no events row, no ledger transaction held); an op logs only its own job, as actor op
  logs     --workflow <id> [--job <job_id>] [--after <seq>] [--kinds <csv>] [--limit <n>]   the workflow's typed log rows (events synced first)
  coverage --workflow <id>   every FR, shape and proof case of the workflow's scope with its evidence: proven|stale|missing
  verify-proofs --workflow <id>   re-hash every indexed proof file and walk the events digest chain; exit 1 on tampering
  plan     --workflow <id> --file <plan.json>
  enqueue  --workflow <id> --op <opId> --paths <csv> [--records <csv>] [--title <t>] [--what <short name>] [--risk <r>] [--retry-of <job>] [--reopen <reason>] [--derived-from <jobs>]
           [--repository <repo-id>] [--params '<json>'] [--cut-id <id> --cut-ordinal <n> --cut-total <n>]
           [--new-module <repository-relative dir>,...]   the grant creates these module roots (else every granted directory must already exist)
  estimate --files <n> [--assertions <n>] [--components <n>] [--records <n>]
           [--paths <csv>] [--gear <n>]
           deterministic size class + agent count from runtimes.yaml allocation.slicing
  route    --job <job_id> [--difficulty <d>]
  dispatch --job <job_id> [--model <target>] [--worktree <sel>] [--spawn]
  reconcile --job <job_id> [--drop --reason <text> | --reap | --dead-worker [--settle-failed] [--no-salvage] | --release-worker]
  reconcile --orphan-kernel-jobs [--workflow <id>] [--dry-run]   kernel jobs of finished/archived workflows -> cancelled
  reconcile --orca-tasks [--workflow <id>] [--dry-run]           re-bind the Run to the live Kernel, close open Tasks no live job holds
  nudge    --job <job_id>
  observe  --job <job_id> [--lines <n>]
  questions --workflow <id>
  messages  --workflow <id> [--all]   every orchestration message on the workflow's Runs (read-only; the 'You have N orchestration messages' notice)
  reply    --workflow <id> --message <msg_id> (--body <answer> | --to-owner [--body <note>])
  peers    --workflow <id>
  notify   --workflow <id> --to <peerId,...|peers> --kind <request|heads-up|handoff|reply|follow-up>
           --subject <s> --body <text> [--reply-to <key>] [--refs <csv>]
  inbox    --workflow <id> [--ack <key> --disposition <text>]
  foundations [--workflow <id>]   the ledger's shared foundations: owner, state, dependents, waits; undeclared workflows
  foundation --workflow <id> (--claim <name> [--kind <k>] [--version <v>] | --declare-dependent <name> | --land <name> --proof <text> [--version <v>] [--refs <csv>] | --declare-none) [--detail <s>]
  record-change --workflow <id> --record <.starciwork path> --reach <follow-up|advisory> --reason <text>   the record's OWNER declares its committed change breaking (peers owe ONE follow-up leg) or advisory
  settle   --job <job_id> --verdict <pass|fail|blocked> [--report <path>]
  report   --job <job_id> --report <file> [--outcome <${REPORT_OUTCOMES.join("|")}>]
  op-contract --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
  check    --job <job_id> (--checks '<json>' | --checks-file <path>)
  consume-report --job <job_id>
  serve-ask --workflow <id> [--dispatch <id>] [--ttl <ms>] [--now]
  retire-ask --workflow <id> --dispatch <id> --reason <text>
  incident --workflow <id> --kind <k> --detail <s> [--op <opId>] [--holds <opId|jobId>,...]
           [--introduced-by <commit>,... | --introducer <workflowId>] [--fix <text>]  (--kind shared-blocker: routed to the introducing workflow as a follow-up)
           [--peer <workflowId> [--refs <csv>] [--until-message]]  (--peer and a bare --until-message only with --kind peer-wait)
  incident --workflow <id> --resolve <incidentId> [--detail <s>] [--by kernel|owner|supervisor] [--owner-answer <dispatchId>]
           typed release (repeatable; the runtime resolves the incident once all hold):
           [--until-record <path>[@state|>=rev]] [--until-job <jobId>[:settled|succeeded]]
           [--until-message <peer>[:kind]] [--until-commit <repo>:<ref-or-path>] [--until-incident <id>[:resolved]] [--until-foundation <name>] [--until-landed <workflowId>@<repository>]
  incident --workflow <id> --attach <incidentId> --until-<type> <spec> ...   type an open incident's release
  provider-health --provider <p> [--recover --reason <text> [--probe]]
           the ledger provider-health row; --recover clears an open circuit (Kernel terminal only)
  provider-health [--provider <p>] --quota-probe [--force]
           an open quota circuit: a real 1-token completion at most once per probe.everyMs (and right after
           the plan reset); a pass clears it (the kernel watchdog runs it under --repair)
  finish   --workflow <id>
  cut-seam --publish-interface --job <seam job> --files <csv> [--summary <s>]   the seam publishes its committed interface: siblings start on it
  cut-seam --release --workflow <id> --op <op> --cut-id <id> --reason <text>     the Kernel releases a cut's siblings to run on a stub now
  cut-seam --reconcile --job <sibling job> --exit-code <n> [--command <c>] [--evidence <path>]   cut-seam-reconcile of a stub sibling against the landed seam
  kernel-ack-rev --workflow <id> --rev <sha> [--files <csv>]
  autopilot --workflow <id> [--sweep|--bundle|--checklist [--lang vi|en]|--set on|off --reason <s>|--defer-to-handover --op <opId> --class credential|real-money|shared-system|owner-decision --detail <s> [--fields <csv>] [--stub <s>] [--job <id>]|--release <dispatchId|key> --reason <s>|--defer-leg <jobId> --reason <s>|--reopen <dispatchId> --handover-answer <dispatchId> [--note <s>]|--extend-budget attempts=<n>,tokens=<n>,wallMs=<n> --reason <s>]
           record the runtime rev (.claude HEAD) whose kernel files this Kernel has read (runtime-rev.mjs)
  contract-release --family <op> [--workflow <id>] [--batch <name>] [--reason <text>] [--dry-run]
           the Supervisor's release point of a frozen op family (modules/kernel/contract-freeze.yaml)
  archive  --workflow <id> --reason <text> [--by owner|supervisor]
           stop a workflow that will not finish: archived_at set, open jobs dropped, asks retired, Kernel and Tasks closed
  rename   --workflow <id> --title "<name>" [--by owner|supervisor] [--no-terminals] [--dry-run]
           set the workflow's display name (workflow_id unchanged); renames its live [Kernel] and [Op] tabs
  run-deferred-tests --workflow <id> [--kind unit|e2e|integration] [--dry-run]
           re-queue the test legs the owner's config.yaml specs switches deferred (api status testsDeferred)`);
  process.exit(code);
};

const parseArgs = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    // reconcile --dead-worker --no-salvage: a boolean flag of this lane.
    if (k === '--no-salvage') { a[k.slice(2)] = true; continue; }
    // Typed release conditions repeat and collect in order as [type, spec] (gate-conditions.mjs). A bare
    // --until-message keeps its peer-wait meaning (any next message from --peer); with a value it is
    // the typed condition.
    if (UNTIL_FLAGS.includes(k.slice(2)) && (k !== '--until-message' || (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')))) {
      const v = argv[++i];
      if (v === undefined) usage(2);
      (a.until ??= []).push([k.slice('--until-'.length), v]);
      continue;
    }
    if (API_EXT.flags.has(k.slice(2))) { a[k.slice(2)] = true; continue; }   // scripts/kernel/api-extensions.mjs
    const name = k.slice(2);
    if (['json', 'spawn', 'drop', 'to-owner', 'reap', 'deliveries', 'dead-worker', 'settle-failed', 'release-worker', 'now', 'recover', 'probe', 'until-message', 'orphan-kernel-jobs', 'orca-tasks', 'dry-run', 'sweep', 'bundle', 'checklist', 'defer-to-handover', 'declare-none', 'quota-probe', 'force', 'no-terminals', 'publish-interface', 'release', 'reconcile'].includes(name)) { a[name] = true; continue; }
    const v = argv[++i];
    if (v === undefined) usage(2);
    a[name] = v;
  }
  return a;
};
const need = (cond, msg) => { if (!cond) { console.error(`api: ${msg}`); usage(2); } };

const openRepoLedger = (repo) => {
  const file = ledgerFileFor(repo); // throws ledger-root-is-runtime on a runtime root — deliberate
  if (!fs.existsSync(file)) throw Object.assign(new Error(`ledger-missing: ${file} — no .starciwork/runtime.sqlite at that repo`), { code: 'ledger-missing' });
  return openLedger({ file });
};

const emit = (out, human, asJson) => {
  // Status fields contributed by scripts/kernel/status/*.mjs (api-extensions.mjs), for the status that asked.
  if (statusAsk && out?.workflowId === statusAsk.ctx.workflowId && Object.hasOwn(out, 'frontier')) {
    const { fields, lines } = statusExtras(API_EXT.status, statusAsk.ctx, out);
    statusAsk = null;
    Object.assign(out, fields);
    if (lines.length) human = [human, ...lines.map((l) => `  ${l}`)].join('\n');
  }
  if (asJson) console.log(JSON.stringify(out, null, 2));
  else console.log(human);
};

// How recently a terminal must have printed for an unclassifiable screen to
// still count as a live turn. One authority: modules/models/runtimes.yaml
// allocation.liveness.activeUnclassifiedMs.
const ACTIVE_UNCLASSIFIED_MS = allocationMs('liveness.activeUnclassifiedMs');
// An `active` screen whose terminal printed nothing for this long is a frozen
// frame: it reads turn-idle (reason stale-active) so the nudge frontier and the
// transition wake reach it (allocation.liveness.activeStaleMs).
const ACTIVE_STALE_MS = allocationMs('liveness.activeStaleMs');
// A worker still at its idle prompt, or frozen, this long after a delivered nudge, with nothing
// printed since, is quiet: dead to the frontier like one whose agent exited
// (allocation.liveness.quietMs).
const QUIET_MS = allocationMs('liveness.quietMs');
// A managed worker-start returns before Orca has injected the worker's Task, so a just-dispatched
// managed worker can read an idle prompt for tens of seconds before its first turn is visible - and
// was nudged in front of the arriving Task (inc-bc0b90a7ec70, inc-9ae771781252). For launchGraceMs
// after its latest op-dispatched event such a worker is `starting`, never nudge-ready
// (allocation.liveness.launchGraceMs). Every op is a worker-start worker, so every dispatch carries it.
const LAUNCH_GRACE_MS = allocationMs('liveness.launchGraceMs');
// A provider card may set its own liveness.activeStaleMs / liveness.quietMs
// (modules/models/agents/<provider>.yaml): Devin redraws nothing while a long tool call runs, so the
// ten-minute activeStaleMs read its live "Thinking · 32m 53s (esc twice to interrupt)" frame as a
// frozen one (inc-3b9864f5f3f8, inc-07830ad93e97, inc-e24bf11bb76c, inc-4c84210fc979).
// The card's liveness block rides the one cached card read (terminal-liveness.mjs cardLivenessPatterns):
// an uncached loadAdapter here re-parsed the same yaml on every status/observe/nudge worker (L-11).
const livenessMsOf = (job, key, fallback) => {
  const payload = jobPayloadOf(job);
  const provider = String(payload.provider ?? payload.agent ?? '').trim().toLowerCase();
  if (!provider) return fallback;
  const value = Number(cardLivenessPatterns().get(provider)?.liveness?.[key]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
};
// The quiet proof: a nudge of THIS dispatch (after its latest op-dispatched event) older than the
// provider's quietMs, and no terminal output for longer than that. A live agent answers a wake in
// minutes; a Mia Mia worker sat leased at a PowerShell prompt, nudged, with no report, until the
// Kernel wrote an incident by hand (inc-c6cf249ecd5a, inc-591629353910, inc-2de345cd4068).
const quietAfterNudge = (db, job, { now, outputAgeMs }) => {
  if (outputAgeMs == null) return null;
  const quietMs = livenessMsOf(job, 'quietMs', QUIET_MS);
  const dispatchedAt = db.prepare("SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind='op-dispatched'").get(job.job_id)?.at ?? 0;
  const nudgedAt = db.prepare("SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind='op-worker-nudged' AND created_at>=?").get(job.job_id, dispatchedAt)?.at ?? null;
  if (nudgedAt == null || now - nudgedAt <= quietMs || outputAgeMs <= quietMs) return null;
  return { quietMs, nudgedAt, outputAgeMs };
};
// The launch grace: a managed worker whose latest op-dispatched event is younger than launchGraceMs
// and that no nudge has followed is still starting - worker-start's 'ready' receipt only means Orca
// accepted the Task, not that a turn is on screen yet. Returns {dispatchedAt, ageMs, graceMs} or null.
const launchGraceOf = (db, job, { now }) => {
  if (!db || !jobPayloadOf(job).managed?.dispatchId) return null;
  const dispatchedAt = db.prepare("SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind='op-dispatched'").get(job.job_id)?.at ?? null;
  if (dispatchedAt == null) return null;
  const ageMs = Math.max(0, now - dispatchedAt);
  if (ageMs >= LAUNCH_GRACE_MS) return null;
  const nudgedAt = db.prepare("SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind='op-worker-nudged' AND created_at>=?").get(job.job_id, dispatchedAt)?.at ?? null;
  return nudgedAt == null ? { dispatchedAt, ageMs, graceMs: LAUNCH_GRACE_MS } : null;
};

// Operation statuses that hold one of the workflow's concurrent slots. A queued
// job has not been dispatched and holds nothing; everything from the lease
// forward does, including a fenced launch whose effect may exist.
const SLOT_HOLDING_STATUSES = [...JOB_STATUSES.dispatchable.filter((status) => status !== 'queued'), ...JOB_STATUSES.fenced];
// modules/models/runtimes.yaml — the pool cards and the fleet ceiling. Every
// concurrency number this gate reasons with comes from here, through the one
// cached loader (engine/config.mjs runtimeProfile): a missing or unparsable
// file throws, never reads as an empty document.
const poolCardFor = (doc, target) => Object.entries(doc?.runtimes ?? {})
  .find(([poolId, runtime]) => (runtime?.target ?? poolId) === target)?.[1] ?? null;
const fleetMaxParallelOps = () => {
  const value = Number(runtimeProfile()?.maxParallelOps);
  return Number.isInteger(value) && value > 0 ? value : null;
};
/**
 * The owner's concurrent-operation budget. A missing, unparsable or schema-short config.yaml must
 * never stop a workflow from routing (the same tolerance start-workflow and route-model keep), so
 * an unreadable owner file leaves `maxOps` unbounded and the fleet ceiling admits alone.
 */
const ownerMaxOps = () => {
  const owner = inspectOwnerConfig(ownerRoot);
  if (owner.error || owner.invalid) return null;
  const value = Number(owner.config?.budgets?.maxOps);
  return Number.isInteger(value) && value > 0 ? value : null;
};
/**
 * Admission against min(budgets.maxOps, maxParallelOps) for one workflow: how many of its
 * operations already hold a slot, against the lower of the two declared ceilings
 * (engine/admission.mjs admitOpSlot). The refusal string is `max-ops`.
 */
const opSlotAdmission = (db, workflowId, { excludeJobId = null } = {}) => {
  const running = db.prepare(
    `SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND job_id<>?
       AND status IN (${SLOT_HOLDING_STATUSES.map(() => '?').join(',')})`
  ).get(workflowId, excludeJobId ?? '', ...SLOT_HOLDING_STATUSES).n;
  return admitOpSlot({ running, maxOps: ownerMaxOps(), maxParallelOps: fleetMaxParallelOps() });
};

/**
 * The queued cut seams of a workflow that a free slot would launch: ordinal 1 of a cut of more than one,
 * not held by an owner-gate or peer-wait. api dispatch gives them the workflow's last free slot.
 */
const queuedSeamsOf = (db, workflowId) => {
  const rows = db.prepare(`SELECT job_id,workflow_id,op_id,status,payload_json FROM jobs WHERE workflow_id=? AND status='queued'
    AND json_extract(payload_json,'$.cut.ordinal')=1 AND json_extract(payload_json,'$.cut.total')>1 ORDER BY created_at`).all(workflowId);
  if (!rows.length) return [];
  const gates = [...openOwnerGates(db, workflowId), ...openPeerWaits(db, workflowId)];
  return rows.filter((row) => !ownerGateOf(gates, row));
};
// The goal as an op reads it: the owner's statement and the revision's
// amendment, never the whole goal json (its opChain is the Kernel's plan).
const goalForPacket = (goal) => {
  let json = {};
  try { json = JSON.parse(goal?.json ?? '{}') ?? {}; } catch { json = {}; }
  return { revision: goal?.revision ?? null, statement: String(goal?.markdown ?? ''),
    ...(json.revision ? { amendment: json.revision } : {}), ...(json.derivedFrom ? { derivedFrom: json.derivedFrom } : {}) };
};

/** The approved goal leg for this op (goals.json.opChain.legs[]): its `params`
 *  carry the owner's tunables (define-goal --params), its `kernelParams` the
 *  kernel defaults a planner-injected leg names. An absent leg sets none. */
const goalLegOf = (goal, opId) => {
  try {
    const legs = JSON.parse(goal?.json ?? '{}')?.opChain?.legs;
    return Array.isArray(legs) ? legs.find((l) => l?.op === opId) ?? null : null;
  } catch { return null; }
};
/**
 * The live head of a cut's seam (ordinal 1): its latest job that was not retired before dispatch. A
 * dropped seam retry is no seam - the ordinals behind it wait on the attempt that actually ran, or on
 * the retry the Kernel enqueues next (inc-b428eb47fde3). Null when the seam has no such job.
 */
const cutSeamHeadOf = (db, { workflowId, op, cutId }) => db.prepare(`SELECT job_id,status,try_no AS attempt,worker_id,payload_json,${jobResultSql('jobs')} AS result_json FROM jobs
  WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')=1 ORDER BY try_no DESC, created_at DESC`)
  .all(workflowId, op, String(cutId)).find((row) => !retiredBeforeDispatch(row)) ?? null;
/**
 * The cut set {workflowId, op, cut.id} as the ledger holds it now: the latest job (highest attempt) of each
 * ordinal 1..cut.total and the ordinals whose latest job has not settled succeeded. `ownJobId` counts as
 * passed for its own ordinal - it is the job being settled. Ordinals settle in any order once the seam
 * passed, so "final" is not ordinal === total: the pass that leaves no other ordinal open is the one that
 * CLOSES the set, whichever ordinal it is (inc-751dd1ac4492: ordinal total could pass while a lower sibling
 * was still running, and the last sibling to settle then passed on slice checks alone, so no ordinal ever
 * ran the whole-set integration gate).
 */
const cutSetStateOf = (db, { workflowId, op, cut, ownJobId = null }) => {
  // A row retired before it dispatched is no attempt of its ordinal (retiredBeforeDispatch).
  const rows = db.prepare(`SELECT job_id,status,try_no AS attempt,worker_id,payload_json,${jobResultSql('jobs')} AS result_json,json_extract(payload_json,'$.cut.ordinal') AS ordinal FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? ORDER BY try_no, created_at`).all(workflowId, op, String(cut.id))
    .filter((row) => row.job_id === ownJobId || !retiredBeforeDispatch(row));
  const latest = new Map();
  for (const row of rows) latest.set(Number(row.ordinal), row);
  const own = rows.find((row) => row.job_id === ownJobId);
  const ordinals = Array.from({ length: Math.max(0, Number(cut.total) || 0) }, (_, i) => i + 1);
  const open = ordinals.filter((n) => !(own && Number(own.ordinal) === n) && latest.get(n)?.status !== 'succeeded');
  return {
    id: String(cut.id), op, total: Number(cut.total),
    passed: ordinals.filter((n) => !open.includes(n)),
    open,
    jobs: Object.fromEntries(ordinals.filter((n) => latest.has(n)).map((n) => [n, { jobId: latest.get(n).job_id, status: latest.get(n).status }])),
  };
};
const CUT_SLICE_CHECKS = ['cut-slice-postcondition', 'cut-regression-inventory'];
const CUT_SET_CLOSING_CHECK = 'full-regression-final';
// What the runtime typed into an operation's terminal (the contract row, plus
// the exact delivered text dispatch recorded) and how the worker's provider
// renders a staged paste (its card's submission.stagedPattern). The classifier
// needs both to tell an unsubmitted paste from a running turn: a Devin worker's
// inline contract sat in its input box for 13 minutes and read `active` from
// the words it contains (inc-06aeecf432f1).
const stagedInputEvidenceOf = (db, job, payload = jobPayloadOf(job)) => {
  const row = db ? latestContractOf(db, job.job_id) : null;
  const context = parseJson(row?.context_json ?? '', {}) ?? {};
  const sentText = [context.delivery?.text, row?.markdown].filter((text) => typeof text === 'string' && text).join('\n') || null;
  const provider = payload.provider ?? payload.agent ?? null;
  const cardPattern = provider ? cardLivenessPatterns().get(String(provider).toLowerCase())?.stagedPattern ?? null : null;
  let stagedPattern = DEFAULT_STAGED_PATTERN;
  if (typeof cardPattern === 'string' && cardPattern.trim()) {
    try { stagedPattern = new RegExp(`${DEFAULT_STAGED_PATTERN.source}|${cardPattern}`, 'i'); } catch { /* the default still holds */ }
  }
  return { sentText, stagedPattern, ...(provider ? { provider: String(provider).toLowerCase() } : {}) };
};
// The text the last provider input-glyph row holds (rails stripped) - what an Enter would submit.
// The screen cannot tell the agent's real input buffer from painted placeholder chrome; the caller
// decides which it is.
const INPUT_ROW_GLYPH = /^\s*[>›❯❭]\s*/u;
const workerInputRowText = (screen) => {
  const rows = String(screen ?? '').split(/\r?\n/).filter(Boolean).slice(-TRAILING_ROWS)
    .map((line) => line.replace(/^\s*[│┃]\s?/u, ''));
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (!INPUT_ROW_GLYPH.test(rows[i])) continue;
    const text = collapse(rows[i].replace(INPUT_ROW_GLYPH, ''));
    if (text) return text;
  }
  return null;
};
// What a provider paints in an EMPTY input row: Codex 'Ask Codex to do anything', Devin
// 'Ask/Guide/Message Devin ...', Claude's rotating 'Try "..."' hint,
// the queued-message Enter prompts. Painted placeholder is not input text.
const INPUT_ROW_PLACEHOLDER = /^(?:ask (?:codex|claude|devin)\b|message devin\b|guide devin\b|enter a prompt\b|press enter to send queued messages\b|press up to (?:edit|select) (?:a )?queued messages?\b|you have \d+ orchestration messages?\b|try\s*["'“])/iu;
// Input text the runtime itself put there: a paste marker the provider's card declares, or a
// verbatim piece of a text the runtime sent this terminal (the dispatched contract, or the same
// wake left staged by a dropped send).
const runtimeOwnedInput = (inputText, { sentText = null, stagedPattern = DEFAULT_STAGED_PATTERN } = {}, wakeText = null) =>
  stagedPattern.test(inputText)
  || [sentText, wakeText].some((text) => echoesSentText(inputText, text));
// The worker liveness values that prove the exact operation terminal can never
// file its report: the terminal exists but is disconnected/unwritable, a
// running Orca answered that the handle names no terminal at all, the
// terminal is back at a bare shell prompt because its agent exited, or the
// worker stayed quiet past its provider's timeout after a delivered nudge.
// `wedged` is deliberately absent: its agent is still live and its turn may
// hold effects the owned paths cannot bound, so it recovers only through
// `reconcile --dead-worker --settle-failed`, never the plain --dead-worker
// requeue (inc-2c1ac4ff3e48). `launch-abandoned` is a leased job past its lease deadline with no worker
// bound: its dispatch died before any worker existed.
const DEAD_WORKER_LIVENESS = ['disconnected', 'gone', 'agent-exited', 'quiet', 'launch-abandoned'];
// Mid-run host dialogs the runtime answers (owner rule 2026-09-23: the runtime, never the owner, answers
// launch and host prompts). A gate the worker's agent card allowlists (gateAutoAnswer.gates) reads
// interactive-gate with gateAutoAnswer {gate, select, answers, limit}: status lists it nudge-ready and
// api nudge answers it, one op-worker-gate-answered event per answer. After `limit` answers on the same
// attempt (the gate's maxPerAttempt, default GATE_ANSWER_LIMIT) the gate is a loop, not a prompt: the
// worker reads `gate-loop`, nudge refuses it, and it recovers like a wedged worker through
// reconcile --dead-worker --settle-failed, so repeats across attempts become a retry-loop finding
// (starci-next inc-af01e1cedbf4: a provider's "A potential loop was detected" menu).
const GATE_ANSWERED_EVENT = 'op-worker-gate-answered';
const GATE_ANSWER_LIMIT = 2;
const workerCardOf = (job) => {
  const agent = agentOfJob(jobPayloadOf(job));
  if (!agent) return { agent: null, card: null };
  try { return { agent, card: loadAdapter(agent)?.card ?? null }; } catch { return { agent, card: null }; }
};
const workerGateAnswerOf = (db, job, gate) => {
  if (!gate) return null;
  const { agent, card } = workerCardOf(job);
  const rule = card ? gateAutoAnswerRule(card, gate) : null;
  if (!rule) return null;
  const limit = Math.max(1, Number(card.gateAutoAnswer?.gates?.[gate]?.maxPerAttempt) || GATE_ANSWER_LIMIT);
  const answers = db ? db.prepare(`SELECT COUNT(*) n FROM events WHERE entity_id=? AND kind=?
      AND json_extract(payload_json,'$.attempt')=? AND json_extract(payload_json,'$.gate')=?`).get(job.job_id, GATE_ANSWERED_EVENT, tryOf(job), gate)?.n ?? 0 : 0;
  return { gate, agent, select: rule.select, answers, limit, ...(answers >= limit ? { loop: true } : {}) };
};
// One writability judgement for liveness and nudge. Orca's `terminal show` can answer writable:true for a
// terminal whose writes it refuses terminal_not_writable: Orca 1.4.209 binds a send to the terminal's
// process incarnation, and every terminal created before the update refuses (nivo inc-f1b576fb6006). A nudge records that
// refusal (op-worker-unwritable); a refusal newer than the worker's last output and last heartbeat makes
// the terminal unwritable here, so status reads it disconnected and reconcile --dead-worker recovers it.
const TERMINAL_NOT_WRITABLE = 'terminal_not_writable';
const UNWRITABLE_EVENT = 'op-worker-unwritable';
const sendRefusedAtOf = (db, job, terminal) => (db ? db.prepare(`SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind=?
  AND json_extract(payload_json,'$.attempt')=? AND json_extract(payload_json,'$.terminal')=?`).get(job.job_id, UNWRITABLE_EVENT, tryOf(job), terminal)?.at ?? null : null);
// The worker's sign of life outside its frame: its Orca dispatch heartbeat (`orca orchestration send --type
// heartbeat`, a tool call of a running turn). A frame frozen while the worker heartbeats is a terminal that
// stopped rendering, not a stalled turn (inc-f1b576fb6006: frozen 50 minutes, heartbeats every 5-10).
const heartbeatAtOf = (job) => {
  const payload = jobPayloadOf(job);
  const dispatch = operationDispatchOf(payload);
  if (!dispatch) return null;
  try {
    const raw = workerShow({ dispatch })?.dispatch?.lastHeartbeatAt;
    if (!raw) return null;
    const text = String(raw);
    const at = Date.parse(/[zZ]$|[+-]\d\d:?\d\d$/.test(text) ? text : `${text.replace(' ', 'T')}Z`);
    return Number.isFinite(at) ? at : null;
  } catch { return null; }
};
// `frame: true` returns the raw screen and input-box draft of the one read this worker paid for, so a
// caller that reasons on the same frame (api nudge's foreign-input check) does not read the terminal
// a second time with a TOCTOU window between classification and send.
const observeOperationWorker = (job, now = Date.now(), db = null, { frame = false } = {}) => {
  const terminalHandle = operationTerminalHandleOf(job);
  // Released while its settle is held (reconcile --release-worker on a held job): its report is
  // consumed and its terminal is closed on purpose, so there is nothing left to observe.
  const releasedWhileHeld = jobPayloadOf(job).workerReleased;
  if (releasedWhileHeld?.custody?.state === 'released') {
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness: 'released', releasedAt: releasedWhileHeld.at ?? null,
      heldBy: releasedWhileHeld.heldBy ?? null, observedAt: now };
  }
  // A leased job with no worker bound is a launch: in flight until its lease deadline (jobs.deadline,
  // dispatchLeaseTtlMs after the lease), abandoned after it. A dispatch killed mid-spawn (a shell timeout
  // around api dispatch, nivo inc-c1d5bdbea173) leaves exactly that row.
  if (job.status === 'leased' && !terminalHandle) {
    const deadline = Number(job.deadline);
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle: null,
      liveness: deadline > 0 && deadline <= now ? 'launch-abandoned' : 'launching', leaseDeadline: deadline > 0 ? deadline : null,
      ...(jobPayloadOf(job).launchTerminal?.handle ? { launchTerminal: jobPayloadOf(job).launchTerminal.handle } : {}), observedAt: now };
  }
  if (!terminalHandle) return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle: null, liveness: 'unknown', reason: 'operation terminal handle unavailable', observedAt: now };
  try {
    const shown = terminalShow({ terminal: terminalHandle });
    const { lastOutputAt, outputAgeMs } = outputAgeOf(shown?.terminal?.lastOutputAt, now);
    const connected = shown?.connected === true, shownWritable = shown?.writable === true;
    const refusedAt = shownWritable ? sendRefusedAtOf(db, job, terminalHandle) : null;
    const refused = refusedAt != null && !(lastOutputAt >= refusedAt);
    let screenState = null, shellPrompt = null, providerOutage = null, inputDraft = null, screenGate = null, screen = null;
    if (shown?.ok && connected && shownWritable) {
      try {
        const read = terminalRead({ terminal: terminalHandle, screen: true });
        // A frame ending in a bare shell prompt: the agent exited and its
        // terminal is a plain shell that would run a nudge as a command.
        if (read?.ok) shellPrompt = exitedAgentPromptRow(read.screen);
        // The input box's draft is read in its input row (Orca lifts it out of the frame): the
        // contract left unsubmitted there is staged input, not an idle prompt.
        if (read?.ok) inputDraft = read.draft ?? null;
        if (read?.ok && frame) screen = read.screen ?? null;
        if (read?.ok) {
          const classified = shellPrompt ? { state: 'agent-exited' } : classifyAgentScreen(read.screen, { ...(db ? stagedInputEvidenceOf(db, job) : {}), draft: inputDraft });
          screenState = classified.state;
          screenGate = classified.state === 'interactive-gate' ? classified.gate ?? null : null;
        }
        // An outage error row the provider CLI rendered: evidence for the provider circuit (api status
        // records it). An active turn is getting completions, so an old error row above it proves nothing.
        if (read?.ok && screenState !== 'active') providerOutage = workerOutageEvidence(job, read.screen);
      } catch { /* terminal-show fallback below remains conservative */ }
    }
    const activeStaleMs = livenessMsOf(job, 'activeStaleMs', ACTIVE_STALE_MS);
    // An active frame whose output time Orca does not know (a restarted Orca re-attaches its panes with
    // no lastOutputAt) is aged by its dispatch heartbeat instead, and with no heartbeat it is never stale.
    const ageFallbackAt = outputAgeMs == null && screenState === 'active' ? heartbeatAtOf(job) : null;
    const judgedAgeMs = outputAgeMs ?? (ageFallbackAt != null ? Math.max(0, now - ageFallbackAt) : null);
    const stale = staleAwareState(screenState, judgedAgeMs, activeStaleMs);
    // A frozen active frame or a refused write is read against the dispatch heartbeat: a worker that
    // heartbeat within activeStaleMs is active, and a heartbeat after the refusal voids it.
    const heartbeatAt = stale.staleActive || refused ? ageFallbackAt ?? heartbeatAtOf(job) : null;
    const heartbeatAgeMs = heartbeatAt != null ? Math.max(0, now - heartbeatAt) : null;
    const beating = heartbeatAgeMs != null && heartbeatAgeMs <= activeStaleMs;
    const unwritable = refused && !(heartbeatAt > refusedAt);
    const writable = shownWritable && !unwritable;
    // A host dialog the worker's card allowlists (a loop-detection menu) is the runtime's to
    // answer: api nudge picks it. Answered maxPerAttempt times on this attempt, it is a loop (gate-loop).
    const gateAnswer = screenState === 'interactive-gate' && connected && writable ? workerGateAnswerOf(db, job, screenGate) : null;
    // 'gone' is a running Orca's typed answer that the handle names no
    // terminal (after a host reboot Orca knows none of them); an unreachable
    // Orca stays 'unknown' and never proves a worker dead.
    const liveness = !shown?.ok ? (TERMINAL_GONE_CODES.has(shown?.errorCode) ? 'gone' : 'unknown')
      : !connected || !writable ? 'disconnected'
      : screenState === 'agent-exited' ? 'agent-exited'
      : screenState === 'staged-input' ? 'staged-input'
      : screenState === 'wedged' ? 'wedged'
      : stale.staleActive ? (beating ? 'active' : 'turn-idle')
      : screenState === 'active' ? 'active'
      : screenState === 'turn-idle' ? 'turn-idle'
      : screenState === 'interactive-gate' ? (gateAnswer?.loop ? 'gate-loop' : 'interactive-gate')
      : screenState === 'failed' ? 'failed'
      : outputAgeMs != null && outputAgeMs <= ACTIVE_UNCLASSIFIED_MS ? 'active-unclassified'
      : 'live-idle';
    const quiet = db && ['turn-idle', 'live-idle'].includes(liveness) ? quietAfterNudge(db, job, { now, outputAgeMs }) : null;
    // A managed worker still inside its launch grace reads `starting`, never nudge-ready (a staged
    // paste already counts as ready - the grace exists because worker-start returns before the Task
    // reaches the screen, not because the worker cannot already hold input).
    const starting = !quiet && ['turn-idle', 'live-idle'].includes(liveness) ? launchGraceOf(db, job, { now }) : null;
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness: quiet ? 'quiet' : starting ? 'starting' : liveness, connected, writable, ...(quiet ? { quiet } : {}),
      terminalStatus: shown?.terminal?.status ?? null, lastOutputAt,
      outputAgeMs, screenState, ...(shellPrompt ? { shellPrompt } : {}), ...(inputDraft ? { inputDraft: clipDraft(inputDraft) } : {}),
      ...(frame ? { screen, draft: inputDraft } : {}),
      ...(screenGate ? { gate: screenGate } : {}), ...(gateAnswer ? { gateAutoAnswer: gateAnswer } : {}),
      ...(stale.staleActive && connected && writable ? { livenessReason: beating ? 'heartbeat' : 'stale-active' } : {}),
      ...(heartbeatAgeMs != null ? { heartbeatAgeMs } : {}),
      ...(starting ? { livenessReason: 'launch-grace', launchGrace: starting } : {}),
      ...(providerOutage ? { providerOutage } : {}),
      ...(unwritable ? { livenessReason: 'terminal-incarnation-stale', sendRefusedAt: refusedAt } : {}),
      ...(shown?.errorCode || unwritable ? { errorCode: shown?.errorCode ?? TERMINAL_NOT_WRITABLE } : {}), observedAt: now };
  } catch (error) {
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness: 'unknown', reason: String(error?.message ?? error), observedAt: now };
  }
};

// A durable transition wakes the workflow's Kernel at once when its turn has yielded to the prompt;
// the watchdog is the coarse fallback. Best effort: a terminal failure never rolls back or hides the
// committed row (scripts/kernel/wake-delivery.mjs wakeKernelForTransition).
const reportFiledWake = (ledger, { workflowId, transition, jobId, dispatchId }) => wakeKernelForTransition(ledger, {
  workflowId, transition, ids: { jobId, dispatchId }, lines: [
    `Operation job ${jobId} filed dispatch ${dispatchId}.`,
    'Re-read canonical api status and survey now; consume, independently check and settle the exact report, release its worker, then continue the approved frontier.',
  ],
});

/* ----------------------------------------------------------- foundations */
// Shared foundations across the workflows of one ledger (scripts/kernel/foundations.mjs;
// modules/kernel/driver-loop.yaml foundations): a layout tree/shell, a brand, a @starci/grammar
// version, a shared module - each with ONE owner workflow, a state and its dependents. The owner's
// foundation legs run first; a dependent waits on the landing with a typed wait
// (api incident --kind peer-wait --until-foundation <name>), which the landing releases.
const foundationDutyOf = (db, wf, options) => foundationDutyFor(db, wf, skillRoot, options);

const agentHierarchyOf = (db, workflowId) => agentHierarchyFor(db, workflowId, skillRoot);

const staleInputProjection = (db, wf, repo = null) => {
  if (wf.phase === 'finished') return { staleInput: [], sourceDrift: [], peerDrift: [] };
  try {
    const drift = inputDrift(db, wf.workflow_id, { root: skillRoot, repo, workDir: repo ? workDirOf(repo) : '.starciwork', registry: loadContractChanges(skillRoot) });
    return { staleInput: drift.stale, sourceDrift: drift.sourceDrift, peerDrift: drift.peerDrift };
  } catch (e) { return { staleInput: [], sourceDrift: [], peerDrift: [], staleInputError: String(e?.message ?? e) }; }
};
const peerDriftLines = (summary, indent = '') => (summary ? summary.records.map((entry) => `${indent}peer-drift (advisory, not stale): ${entry.file} (owner ${entry.owner ?? '-'} by ${entry.ownerBy}) changed after ${entry.jobs} settled job(s) read it${entry.writers.length ? ` — written by ${entry.writers.join(', ')}` : ''}${entry.foreignWrite ? ' (a peer wrote a record this workflow owns: review it, redo nothing)' : ''}${entry.breakingIgnored === 'written-by-non-owner' ? ' — its breaking change note was written by a non-owner and binds nothing' : ''}; nothing to redo unless its owner declares the change breaking`) : []);
const staleOperationLine = (item) => `${item.followUp ? 'breaking-follow-up' : 'stale-input'}: ${staleLabel(item)} — ${item.paths.join(', ')}${item.breakingBy ? ` (breaking change declared by owner ${item.breakingBy.join(', ')}${item.followUp ? '; ONE follow-up leg' : ''})` : ''}`;
const sourceDriftLines = (summary, indent = '') => (summary ? summary.paths.map((entry) => `${indent}source-drift (advisory, not stale): ${entry.path} edited after ${entry.jobs} settled job(s) were admitted${entry.changes.length ? ` — registered ${entry.changes.join(', ')}` : ' — UNREGISTERED in modules/kernel/contract-changes.yaml'}${entry.followUp.length ? `; follow-up via contractFollowUps (${entry.followUp.join(', ')})` : '; nothing to redo'}`) : []);
const staleLabel = (item) => `${item.jobId} (${item.op} a${item.attempt}${item.cut ? ` cut ${item.cut.id} ${item.cut.ordinal}/${item.cut.total}` : ''})`;
/* ---------------------------------------------------------------- status */
/**
 * Whether the serve-ask form an ask-serving event names still answers: its
 * recorded pid is alive, or (an event from before pids were recorded) its
 * localhost port still accepts a connection. Returns null when neither can be
 * told, which keeps the ask counted as served.
 */
function askFormAlive(payload, { probeMs = 1500 } = {}) {
  const pid = Number(payload?.pid);
  if (Number.isInteger(pid) && pid > 0) {
    try { process.kill(pid, 0); return true; } catch (error) { return error?.code === 'EPERM'; }
  }
  const port = Number(/^https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)\//.exec(String(payload?.url ?? ''))?.[1]);
  if (!Number.isInteger(port)) return null;
  const probe = spawnSync(process.execPath, ['-e', `const s=require('net').connect(${port},'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),${probeMs})`],
    { windowsHide: true, timeout: probeMs + 2000 });
  return probe.status === 0;
}

// Frontier states that are themselves a call to act. 'engaged' is not one —
// it only becomes actionable when the workflow also holds a ready operation.
// frontier.actionable is the single boolean the driver's yield rule reads.
const ACTIONABLE_FRONTIER_STATES = ['transition-ready', 'settle-ready', 'worker-dead', 'worker-question', 'worker-nudge-ready', 'worker-wedged', 'peer-message', 'handover-answered', 'finish-ready', 'ask-reserve', 'handover-due', 'next-ready', 'orphaned-frontier', 'idle'];
/**
 * Why one queued job is not running, in the order the causes actually bite. `dependency` is the
 * plan gate the Kernel applies before it routes at all; the four after it are the admission checks
 * `api route` and `api dispatch` run, in their own order (workflow ceiling, provider circuit, path
 * fence, pool saturation); `ready` means nothing blocks it and the Kernel is the only thing left.
 */
// 'dependency-failed' is a dependency that can no longer succeed on its own: the
// seam or --after job it waits on settled failed (not an owner wait), so only
// the Kernel can move it - retry the blocker, re-point the dependant, or drop it.
const QUEUED_BECAUSE = ['owner-gate', 'supervisor-gate', 'deferred', 'deferred-to-handover', 'peer-wait', 'foundation-wait', 'dependency', 'dependency-failed', 'max-ops', 'circuit-open', 'path-lease', 'pool-full', 'ready'];
/**
 * Open owner-gate incidents of a workflow: a step only the owner can drive
 * (an assisted OAuth run, a consent screen) holds the jobs it names until the
 * Kernel resolves the incident. `api incident --kind owner-gate --holds` names
 * the held ops or jobs; without --holds the incident's --op is held. A job the
 * owner holds is not work the Kernel can do, so status never calls it ready
 * and the watchdog never wakes a Kernel for it.
 */
const OWNER_GATE_KINDS = ['owner-gate', 'owner-gate-pending'];
// Autopilot (scripts/kernel/autopilot.mjs): a supervisor-gate holds its jobs the way an owner gate does, but it is
// the Supervisor's to resolve; `holds: ['*']` (a spent autopilot budget) holds every queued job.
const HOLDING_GATE_KINDS = [...OWNER_GATE_KINDS, SUPERVISOR_GATE];
const openOwnerGates = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
  .map((row) => {
    const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
    if (!HOLDING_GATE_KINDS.includes(kind)) return null;
    const raised = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const holds = parseJson(raised?.payload_json, {})?.holds;
    return { incidentId: row.incident_id, kind, holds: Array.isArray(holds) && holds.length ? holds : [row.op_id].filter(Boolean),
      opId: row.op_id ?? null, detail: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, '') };
  })
  .filter(Boolean);
/** The frontier reason's clause for settles a recorded wait holds (cmdStatus heldSettle). */
const heldSettleText = (held) => (held.length
  ? `; the settle of ${held.map((item) => `${item.jobId} (${item.blockedBy.incident})`).join(', ')} is deferred behind ${held.length === 1 ? 'its wait' : 'those waits'} (report consumed; check and settle once the wait resolves)`
  : '');
const ownerGateOf = (gates, job) => {
  const opId = job.op_id ?? jobPayloadOf(job).opId ?? null;
  return gates.find((gate) => gate.holds.includes(job.job_id) || (opId && gate.holds.includes(opId)) || (gate.kind === SUPERVISOR_GATE && gate.holds.includes('*') && job.status === 'queued')) ?? null;
};
/**
 * Open peer-wait incidents of a workflow: work that cannot pass its preflight until a PEER workflow
 * lands something (installs a dependency, writes a record). `api incident --kind peer-wait --peer
 * <workflowId>` records it; --holds (else --op) names the held ops or jobs, which read queuedBecause
 * peer-wait, and with nothing else open the frontier reads `peer-wait`, not actionable, instead of
 * orphaned-frontier (mia-mia wf-miamia-work-and-stacks-mud7kjun, inc-0aebf976e625: brand.decide waited
 * on wf-miamia-base-repos-mud7kk5c's Grammar install while status re-woke the Kernel for nothing). A
 * peer message from that peer wakes the Kernel and, with --until-message, resolves the wait
 * (peerWaitMessageArrived). `peer` is the peer's live row: a wait on a peer that is no longer running
 * can never be met by it, so it is the Kernel's move again (frontier.peerWaitsDead).
 */
const approvedLegOps = (goalJson) => planGraphOf(goalJson ?? {}).ops;
/** One queued job's blocking cause and the id that holds it. */
/**
 * Work-record order the kernel already declared: a job owns record
 * directories (owned_paths holding an index.yaml with an id); when one of its
 * records dependsOn a record another job of this workflow owns, that job holds
 * it. Returns jobId -> [blocking jobIds]. A Collab kernel ran seven
 * implementation slices one at a time from these edges while status called
 * them all ready - and missed the one that could already run in parallel.
 */
function recordDependencies(repo, workflowJobs) {
  const ownerOfRecord = new Map(), recordsOfJob = new Map();
  for (const row of workflowJobs) {
    const owned = (jobPayloadOf(row).owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
    for (const rel of owned) {
      if (!rel.startsWith('.starciwork/')) continue;
      let doc = null;
      try { doc = parseYaml(fs.readFileSync(path.join(repo, rel.replace(/\/+$/, ''), 'index.yaml'), 'utf8')); } catch { continue; }
      if (!doc?.id) continue;
      // Every job that owned the record, in created order: the record is met
      // once any of them succeeded; otherwise the latest owner holds it.
      ownerOfRecord.set(doc.id, [...(ownerOfRecord.get(doc.id) ?? []), row]);
      recordsOfJob.set(row.job_id, [...(recordsOfJob.get(row.job_id) ?? []), doc]);
    }
  }
  const out = new Map();
  for (const [jobId, docs] of recordsOfJob) {
    const blockers = [...new Set(docs.flatMap((doc) => (Array.isArray(doc.dependsOn) ? doc.dependsOn : [])
      .map((dep) => {
        const owners = ownerOfRecord.get(typeof dep === 'string' ? dep : dep?.id) ?? [];
        if (!owners.length || owners.some((owner) => owner.status === 'succeeded')) return null;
        return owners[owners.length - 1].job_id;
      })
      .filter((owner) => owner && owner !== jobId)))];
    if (blockers.length) out.set(jobId, blockers);
  }
  return out;
}
/**
 * Does this row's declared --after chain reach targetId? Followed transitively
 * with a visited set — two jobs each enqueued --after the other must not loop.
 * An earlier leg's job the Kernel ordered after this one is not its
 * predecessor: the explicit edge overrides leg order (inc-df38ecef1927 — a draw
 * held forever by a brand attempt that was itself enqueued --after the draw).
 */
function afterChainReaches(db, row, targetId) {
  const seen = new Set([row.job_id]);
  const stack = [...(Array.isArray(jobPayloadOf(row).after) ? jobPayloadOf(row).after : [])];
  while (stack.length) {
    const id = stack.pop();
    if (id === targetId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const after = jobPayloadOf(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(id)).after;
    if (Array.isArray(after)) stack.push(...after);
  }
  return false;
}
/**
 * queuedBecauseOf plus the cut seam's contract-first release (scripts/kernel/cut-seam.mjs): a sibling
 * ordinal its seam no longer holds carries seamStub {mode, seamJobId, reason} - it runs now on the seam's
 * published interface or a stub of its own, never waiting past allocation.cutSeam.maxSiblingWaitMs.
 */
/** runtimes.yaml allocation.routeHoldMs: how long a routed-but-queued job keeps its pool slot after its latest route. */
const routeHoldMsOf = () => allocationMs('routeHoldMs');
/**
 * Pool load fleet-wide, the one count `api route` (capacity) and `api status` (queuedBecause pool-full) both
 * reason with, so they agree: every non-settled job whose payload.model names a pool holds a slot of it - running,
 * leased and answering jobs always, and a routed-but-QUEUED one only while its latest route decision (payload.routedAt,
 * else its newest route-decided event) is younger than allocation.routeHoldMs. The hold lets sequential route calls of
 * one fan-out see the fleet filling instead of piling every slice onto the first preferred pool; past it, a job parked
 * behind a gate, a hold, a peer-wait, a dependency or a readiness loop no longer starves the pool for hours (nivo
 * 2026-09-28: devin 10/10 with 5 ops running). Re-routing a queued job refreshes its hold.
 * {byModel: {pool: n}, holders: Set<jobId>, routeHoldMs}; `excludeJobId` (the job being routed) holds nothing.
 */
function poolLoadOf(db, { now = Date.now(), routeHoldMs = routeHoldMsOf(), excludeJobId = null } = {}) {
  const byModel = {}, holders = new Set();
  const routedEventAt = db.prepare("SELECT MAX(created_at) at FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=? AND kind='route-decided'");
  for (const row of db.prepare(`SELECT job_id,workflow_id,status,payload_json FROM jobs WHERE status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`).all(...FINAL_SETTLED)) {
    if (row.job_id === excludeJobId) continue;
    const payload = parseJson(row.payload_json, {}) ?? {};
    if (!payload.model) continue;
    if (row.status === 'queued') {
      const routedAt = Number(payload.routedAt) || Number(routedEventAt.get(row.workflow_id, row.job_id)?.at) || 0;
      if (!routedAt || now - routedAt >= routeHoldMs) continue;
    }
    byModel[payload.model] = (byModel[payload.model] ?? 0) + 1;
    holders.add(row.job_id);
  }
  return { byModel, holders, routeHoldMs };
}
function queuedBecauseOf(db, job, ctx) {
  const payload = jobPayloadOf(job);
  let seamHold = null;
  try { seamHold = siblingSeamHold(db, job, { now: ctx.now ?? Date.now(), isOwnerWait: (row) => isAwaitingOwner(db, row) }); } catch { seamHold = null; }
  const out = queuedBecauseInner(db, job, { ...ctx, seamHold });
  if (seamHold && !seamHold.hold) out.seamStub = { mode: seamHold.stub.mode, seamJobId: seamHold.stub.seamJobId, seamStatus: seamHold.stub.seamStatus, reason: seamHold.stub.reason };
  if (isSeamCut(payload.cut)) out.seam = { cutId: String(payload.cut.id), siblings: Number(payload.cut.total) - 1 };
  return out;
}
function queuedBecauseInner(db, job, { planAncestors, jobsByOp, slots, rtDoc, poolLoad, ownerGates = [], peerWaits = [], recordDeps = new Map(), canon = null, workGraph = null, typedGates = [], seamHold = null }) {
  const payload = jobPayloadOf(job);
  const opId = job.op_id ?? payload.opId ?? null;

  const gate = ownerGateOf(ownerGates, job);
  if (gate) {
    return gate.kind === SUPERVISOR_GATE ? {
      queuedBecause: SUPERVISOR_GATE,
      blockedBy: { incident: gate.incidentId },
      detail: `supervisor-gate incident ${gate.incidentId} holds it (autopilot): the Supervisor fixes the runtime/process cause or decides the retry and resolves it --by supervisor; never the owner`,
    } : {
      queuedBecause: 'owner-gate',
      blockedBy: { incident: gate.incidentId },
      detail: `owner-gate incident ${gate.incidentId} holds it; the Kernel resolves it (api incident --resolve) once the owner's step lands`,
    };
  }
  // Autopilot: a deferred leg, or a live proof waiting for the handover credential checklist.
  const deferred = deferredQueueCause(db, job);
  if (deferred) return deferred;
  const peerWait = ownerGateOf(peerWaits, job);
  if (peerWait) {
    return {
      queuedBecause: 'peer-wait',
      blockedBy: { incident: peerWait.incidentId, peer: peerWait.peer },
      detail: `peer-wait incident ${peerWait.incidentId} holds it until peer ${peerWait.peer} lands what it waits on (${peerWait.detail.slice(0, 160)}); a peer message from ${peerWait.peer} wakes the Kernel${peerWait.untilMessage ? ' and resolves the wait' : ', which resolves it (api incident --resolve) once the proof holds'}`,
    };
  }

  // An interface.draw whose workflow is a declared dependent of a claimed foundation `shell` (the layout chain another
  // live workflow draws) waits for its landing (scripts/kernel/shell-foundation.mjs); it never drafts a second shell.
  if (opId === 'interface.draw') {
    const shellFoundation = shellFoundationWaitOf(db, job.workflow_id);
    if (shellFoundation) return { queuedBecause: FOUNDATION_WAIT, blockedBy: { foundation: SHELL_FOUNDATION, workflow: shellFoundation.owner }, detail: shellFoundation.detail };
  }
  // A plan ancestor (planAncestorsOf) holds this job only while it has a job still in flight or
  // queued. A leg with no job, or whose jobs all settled, is not a wait: the plan either never
  // enqueued it (intake legs) or already moved past it. Nor is a pending row whose own --after chain
  // reaches this job — the Kernel declared that order explicitly, so it overrides the plan. A leg the
  // plan edges do not lead from never holds it.
  // Nor does a job whose own wait's typed conditions name this one (scripts/kernel/leg-order.mjs legOrderExemption).
  // With a work graph, a business or architecture leg is held only by an ancestor of the same phase in a domain it shares.
  const otherDomain = (row) => workGraph && DOMAIN_PARALLEL_OPS.includes(opId) && DOMAIN_PARALLEL_OPS.includes(row.op_id)
    && disjointDomains(workGraph.graph, payload.owned_paths, jobPayloadOf(row).owned_paths);
  // Nor does a test leg the owner's config.yaml specs switches defer (spec-deferral.mjs): nothing waits on a deferred test.
  const specs = ownerSpecs(skillRoot);
  const blocking = (opId ? planAncestors.get(opId) ?? [] : [])
    .map((earlier) => ({ earlier, pending: (jobsByOp.get(earlier) ?? []).filter((row) => row.job_id !== job.job_id && !FINAL_SETTLED.includes(row.status) && !afterChainReaches(db, row, job.job_id) && !otherDomain(row)
      && !testDeferralOf({ skillRoot, op: row.op_id, payload: jobPayloadOf(row), settings: specs })
      && !legOrderExemption({ row, rowPayload: jobPayloadOf(row), job, typedGates, headOf: (id) => lineageHeadById(db, id)?.row.job_id ?? id })) }))
    .find(({ pending }) => pending.length > 0);
  if (blocking) {
    return {
      queuedBecause: 'dependency',
      blockedBy: { op: blocking.earlier, job: blocking.pending[blocking.pending.length - 1].job_id },
      detail: `approved leg ${blocking.earlier} still has job ${blocking.pending[blocking.pending.length - 1].job_id} ${blocking.pending[blocking.pending.length - 1].status}; it precedes ${opId} in the approved order`,
    };
  }

  // A declared --after job, or the seam (ordinal 1) of this job's cut, that
  // has not settled succeeded holds it like an earlier leg does. The seam is
  // its live head: a dropped, never-dispatched seam retry is skipped. A named
  // job is followed down its retry lineage (gate-conditions.mjs lineageHeadOf):
  // a failed --after job whose retry is queued is a live wait, not a dead one
  // the Kernel must drop and re-enqueue (starci-next sn-subscription a14-a23).
  // A lineage that leads back to this job is its own history, never a wait: a retry whose --after
  // names the attempt it retries (a draw follow-up enqueued --after op-interface.draw-3cd517a152
  // as that job's retry, nivo wf-nivo-workspace-provision-mujek7cb) otherwise held itself forever.
  const heldByJob = (priorId) => {
    const prior = lineageHeadById(db, priorId)?.row ?? null;
    return prior && prior.status !== 'succeeded' && prior.job_id !== job.job_id ? prior : null;
  };
  // The seam holds a sibling only while siblingSeamHold says so: a published interface, a dead or slipped
  // seam, a Kernel release or allocation.cutSeam.maxSiblingWaitMs lets it run on a stub (cut-seam.mjs).
  const seam = payload.cut && Number(payload.cut.ordinal) > 1 && (seamHold ? seamHold.hold : true)
    ? cutSeamHeadOf(db, { workflowId: job.workflow_id ?? payload.hierarchy?.workflowId, op: opId, cutId: payload.cut.id })?.job_id ?? null
    : null;
  // A released sibling is not held back through the seam's Work record either: a record edge to a job
  // of its own cut's seam (ordinal 1) is the same wait the release lifted (cut-seam.mjs; nivo collab-impl-be
  // ordinals dependsOn the composition record the seam owns).
  const seamReleased = Boolean(seamHold && !seamHold.hold);
  const ownSeamRow = (id) => {
    if (!seamReleased) return false;
    const cut = jobPayloadOf(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(id)).cut;
    return Boolean(cut && String(cut.id) === String(payload.cut.id) && Number(cut.ordinal) === 1);
  };
  const recordHolds = (recordDeps.get(job.job_id) ?? []).filter((id) => !ownSeamRow(id));
  for (const priorId of [...(Array.isArray(payload.after) ? payload.after : []), ...(seam ? [seam] : []), ...recordHolds]) {
    const prior = heldByJob(priorId);
    if (prior) {
      // A StarCi Next and a MiaMia workspace.manage sat queued behind a seam
      // and an --after job that had settled failed; the frontier read engaged,
      // the watchdog never woke the Kernel, and both workflows stalled.
      const dead = FINAL_SETTLED.includes(prior.status) && !isAwaitingOwner(db, db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(prior.job_id));
      return {
        queuedBecause: dead ? 'dependency-failed' : 'dependency',
        blockedBy: { op: prior.op_id, job: prior.job_id },
        detail: (priorId === seam
          ? (seamHold?.hold ? seamHold.detail : `cut ${payload.cut.id} seam ${prior.job_id} is ${prior.status}; the other ordinals wait for it`)
          : (recordDeps.get(job.job_id) ?? []).includes(priorId)
            ? `a Work record this job owns dependsOn a record owned by ${prior.job_id}, which is ${prior.status}`
            : `declared --after job ${prior.job_id} is ${prior.status}`)
          + (prior.job_id !== priorId ? ` (the retry lineage of ${priorId})` : '')
          + (dead ? '; it will not succeed on its own, so the Kernel retries it, re-points this job, or drops it' : ''),
      };
    }
  }

  if (!slots.ok) {
    return {
      queuedBecause: 'max-ops',
      blockedBy: { ceiling: slots.ceiling, ceilingSource: slots.ceilingSource, running: slots.running },
      detail: `the workflow holds ${slots.running} of ${slots.ceiling} operations (${slots.ceilingSource})`,
    };
  }

  const target = payload.model ?? null;
  const card = target ? poolCardFor(rtDoc, target) : null;
  if (target) {
    const health = providerHealthOf(db, card?.provider ?? target);
    if (health) {
      return {
        queuedBecause: 'circuit-open',
        blockedBy: { provider: health.provider, pool: target },
        detail: `provider ${health.provider} circuit open (${health.failureKind ?? 'auth'}) until ${health.expiresAt ?? 'explicit recovery'}; ${circuitClearHint(health)}`,
      };
    }
  }

  // Lease-row existence is the fence, expiry only a recovery signal
  // (engine/admission.mjs findOwnedPathLeaseConflicts) — an expired row still
  // answers "why is this queued", because the prior attempt's effect may exist.
  // A projection never throws on a malformed stored path: dispatch admission is
  // where that row is refused, and status must still answer for its siblings.
  let conflict = null;
  try { conflict = findOwnedPathLeaseConflicts(db, opLeaseRequests(payload, canon, opId), { excludeJobId: job.job_id, canonicalOf: canon?.canonicalOf })[0] ?? null; }
  catch { conflict = null; }
  if (conflict) {
    const expired = !(Number(conflict.expires_at) > Date.now());
    return {
      queuedBecause: 'path-lease',
      blockedBy: { path: conflict.held, job: conflict.job_id, op: conflict.op_id ?? null, expiresAt: conflict.expires_at ?? null },
      detail: `${conflict.held} is held by ${conflict.job_id} (${conflict.op_id ?? '-'}) and overlaps ${conflict.requested}; `
        + (expired
          ? `that lease expired at ${new Date(Number(conflict.expires_at)).toISOString()} but its row still fences — reconcile or settle ${conflict.job_id}`
          : `lease expires ${new Date(Number(conflict.expires_at)).toISOString()}; it becomes ready when ${conflict.job_id} settles and releases it — wait, never re-dispatch it by hand`),
    };
  }

  // A routed-but-queued job counts toward its pool while its route hold lasts (poolLoadOf, the same count
  // `api route` reasons with); what bounds it is the OTHER holders of the lane.
  const maxParallel = Number(card?.maxParallel);
  const otherHolders = Math.max(0, (poolLoad.byModel[target] ?? 0) - (poolLoad.holders.has(job.job_id) ? 1 : 0));
  if (target && Number.isInteger(maxParallel) && maxParallel > 0 && otherHolders >= maxParallel) {
    return {
      queuedBecause: 'pool-full',
      blockedBy: { pool: target, running: otherHolders, maxParallel },
      detail: `pool ${target} holds ${otherHolders} of ${maxParallel} slots`,
    };
  }

  return { queuedBecause: 'ready', blockedBy: null, detail: null };
}
// The Kernel seat as the ledger holds it: the attempt, its terminal, the launch that seated it and who
// ran that launch. `you` is true when the caller's ORCA_TERMINAL_HANDLE is the seat's terminal, so a
// Kernel proves a launch prompt or a wake (both name the attempt) against the ledger, not against the text.
/**
 * op-rev-drift at settle (WARN, never a refusal): the runtime rev the leg was dispatched under
 * (contracts.context_json.contract.runtimeSha) against the current one; when the op's contract files
 * changed in between, one op-rev-drift event {op, attempt, from, to, files} (api status opRevDrift, typed
 * log warning). Returns it, or null.
 */
function recordOpRevDrift(ledger, job) {
  try {
    const op = jobOpOf(job), root = revRootOf();
    const row = latestContractOf(ledger.db, job.job_id);
    const from = parseJson(row?.context_json)?.contract?.runtimeSha ?? null;
    const drift = opRevDrift(root, op, from, currentRuntimeRev(root));
    if (!drift) return null;
    const payload = { op, attempt: tryOf(job), ...drift };
    ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, generation: job.generation ?? 0,
      kind: OP_REV_DRIFT, payload, createdAt: Date.now() }));
    return payload;
  } catch { return null; }
}

/** The nextActions step a stale Kernel runs first: re-read what changed, then ack the current rev. */
const rereadActionOf = (rev, workflowId) => ({ kind: 'reread', rev: rev.current, acked: rev.acked, files: rev.full ? ['modules/kernel/kernel-prompt.md', 'modules/kernel/driver-loop.yaml'] : rev.files,
  ...(rev.changes.length ? { changes: rev.changes.map((c) => c.id) } : {}),
  reason: `the runtime moved from the rev you acked (${shortRev(rev.acked)}) to ${shortRev(rev.current)}: re-read ${rev.full ? 'modules/kernel/kernel-prompt.md and modules/kernel/driver-loop.yaml in full' : rev.files.join(', ')}${rev.changes.length ? ` and the contract changes ${rev.changes.map((c) => c.id).join(', ')}` : ''}, then api kernel-ack-rev --workflow ${workflowId} --rev ${shortRev(rev.current)}; until then enqueue/dispatch of a leg whose op contract changed is refused ${KERNEL_REV_STALE}` });
/**
 * The RUNNING legs whose op contract moved on the runtime since their dispatch (op-rev-drift before settle): the
 * worker still runs its brief, is judged by its admission, and hears it on its next nudge. [{jobId, op, attempt, from,
 * to, files, advisoryChanges}]
 */
function runningOpRevDriftOf(db, workflowId, { root = revRootOf() } = {}) {
  const rows = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind='op' AND status IN ('running','answering')`).all(workflowId);
  if (!rows.length) return [];
  const current = currentRuntimeRev(root), registry = loadContractChanges(skillRoot), out = [];
  for (const job of rows) {
    const op = jobOpOf(job);
    const admission = admittedContractOf(db, job);
    const drift = opRevDrift(root, op, admission.version?.runtimeSha ?? null, current);
    if (!drift) continue;
    out.push({ jobId: job.job_id, op, attempt: tryOf(job), ...drift, advisoryChanges: laterChangesFor(registry, { admittedAt: admission.at, op, withheld: admission.withheld }).map((c) => c.id) });
  }
  return out;
}
/** The newest op-rev-drift warnings of a workflow (api settle): [{jobId, op, attempt, from, to, files, at}]. */
const opRevDriftOf = (db, workflowId, limit = 5) => db.prepare('SELECT entity_id,payload_json,created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT ?')
  .all(workflowId, OP_REV_DRIFT, limit).map((row) => ({ jobId: row.entity_id, ...(parseJson(row.payload_json) ?? {}), at: row.created_at }));

/**
 * enqueue/dispatch refuse kernel-rev-stale for a leg whose op contract (or a contract change scoped to its op)
 * changed between the runtime rev the Kernel acked and the current one (runtime-rev.mjs opRevStale). Other
 * legs, a Kernel that never acked (booted before this gate) and an unreadable rev pass.
 */
function refuseStaleKernelRev(db, workflowId, op, verb) {
  const root = revRootOf();
  let state = null;
  try { state = kernelRevState(db, workflowId, { root }); } catch { return; }
  const hit = opRevStale(state, op, { root });
  if (!hit) return;
  const what = [...hit.files, ...hit.changes.map((id) => `contract change ${id}`)].join(', ');
  throw Object.assign(new Error(`${KERNEL_REV_STALE}: ${verb} of ${op} refused - its op contract changed between the runtime rev you acked (${shortRev(state.acked)}) and the current one (${shortRev(state.current)}): ${what}. Re-read ${state.full ? 'modules/kernel/kernel-prompt.md and modules/kernel/driver-loop.yaml in full' : state.files.join(', ')}, then api kernel-ack-rev --workflow ${workflowId} --rev ${shortRev(state.current)} and ${verb} again (api status kernelRev)`),
    { code: KERNEL_REV_STALE, op, acked: state.acked, current: state.current, files: hit.files, changes: hit.changes });
}

const NEXT_ACTION_KINDS = ['retry', 'root-verify', 'dispatch', 'impact-check', 'supervisor-gate', 'owner-gate', 'wait'];
// Legs that run per domain in parallel once the workflow has a work graph (scripts/work/work-graph-store.mjs).
const DOMAIN_PARALLEL_OPS = ['business.decide', 'architecture.decide'];
const disjointDomains = (graph, left, right) => {
  const a = domainsOfPaths(graph, left), b = domainsOfPaths(graph, right);
  return a.size > 0 && b.size > 0 && ![...a].some((domain) => b.has(domain));
};
const NEXT_ACTION_MOVES = ['retry', 'root-verify', 'dispatch', 'impact-check'];
const LEG_IN_FLIGHT = ['leased', 'running', 'answering', 'effect_unknown'];
/** The newest work-graph nodes of a workflow (display names read what a job covers); null without one. */
const latestGraphNodesOf = (db, workflowId) => { try { return latestGraphVersion(db, workflowId)?.graph?.nodes ?? null; } catch { return null; } };
const nextActionLabel = (action) => `${action.kind} ${action.op ?? '-'}${action.jobId ? ` ${action.jobId}` : ''}${action.displayName ?? action.label ? ` «${action.displayName ?? action.label}»` : ''}`;
function graphProjectionOf(db, { wf, legOps, planAncestors, workflowJobs, jobsByOp, failedRows, queued, ownerGates, peerWaits, awaitingOwner, staleReady, staleProofs = [], credentialWaitOps = new Set(), approvalWaitOps = new Set(), workGraph = null, contractFollowUps = [], assetSlotsOwed = [], autopilot = null }) {
  if (wf.phase === 'finished') return { nextActions: [], legs: [] };
  const unresolved = unresolvedFailures(db, failedRows, workflowJobs);
  const rowOf = new Map(workflowJobs.map((row) => [row.job_id, row]));
  const actions = [];
  // Autopilot (scripts/kernel/autopilot.mjs): deferred legs wait for the final review and block nothing.
  const deferredJobs = new Set((autopilot?.deferred ?? []).map((item) => item.jobId));
  // The owner's config.yaml specs switches, read once per projection: a test leg of a class that is off is
  // deferred, so nothing waits on it and its enqueue/route only records the deferral (spec-deferral.mjs).
  const specs = ownerSpecs(skillRoot);
  const goalText = latestGoal(db, wf.workflow_id)?.markdown ?? null;
  const deferredPlanOps = new Map(legOps.map((op) => [op, planLegDeferral({ skillRoot, op, settings: specs, goalText })]).filter(([, deferral]) => deferral));
  const specDeferredJobs = new Map(deferredTestsOf(db, wf.workflow_id).map((item) => [item.jobId, item.reason ?? 'deferred']));
  for (const row of unresolved) {
    const step = (jobResult(db, row.job_id) ?? {}).nextStep;
    if (!step || ownerGateOf(ownerGates, row) || step.kind === 'deferred' || deferredJobs.has(row.job_id)) continue;
    actions.push({ kind: 'retry', op: row.op_id, jobId: row.job_id,
      reason: `${row.job_id} failed and nothing follows it (${['owner-gate', SUPERVISOR_GATE].includes(step.kind) ? `${step.kind} ${step.incidentId} resolved` : step.reason}): api enqueue --op ${row.op_id} with its paths and records --retry-of ${row.job_id}` });
  }
  for (const item of awaitingOwner.filter((ask) => ask.answer === 'answered')) {
    actions.push({ kind: 'retry', op: item.opId, jobId: item.jobId, reason: item.answeredBy === AUTOPILOT_BY
      ? `autopilot answered ask ${item.dispatchId} (${item.provisional ? `provisional acceptance, ${PROVISIONAL_LABEL}` : 'redraw/revise with the gate findings as the brief'}; owner ruling ${AUTOPILOT_RULING}): api enqueue --op ${item.opId} --retry-of ${item.jobId} so it applies the receipt`
      : `the owner answered ask ${item.dispatchId}: api enqueue --op ${item.opId} --retry-of ${item.jobId} so it runs with the answer` });
  }
  // The owner's handover feedback re-opened a provisional acceptance: only that op re-runs (draw-feedback loop).
  for (const item of autopilot?.reopened ?? []) {
    actions.push({ kind: 'retry', op: item.opId, jobId: item.jobId, reason: `the owner's handover answer ${item.handoverDispatchId} re-opened the provisional ${item.record ?? item.dispatchId}: api enqueue --op ${item.opId} --retry-of ${item.jobId} - the redraw's brief is the owner's note in ${item.receiptPath}` });
  }
  // A queued leg the specs switches defer needs nothing it waits on: whatever holds it, its route settles it
  // deferred at once (no dispatch, no attempt), which releases every leg behind it.
  const deferredQueued = new Map(queued.map((item) => [item.jobId, testDeferralOf({ skillRoot, op: item.opId, payload: jobPayloadOf(rowOf.get(item.jobId)), settings: specs })]).filter(([, deferral]) => deferral));
  for (const item of queued.filter((row) => deferredQueued.has(row.jobId))) {
    const deferral = deferredQueued.get(item.jobId);
    actions.push({ kind: 'dispatch', op: item.opId, jobId: item.jobId, deferred: deferral.reason,
      reason: `deferred (${deferral.reason}): api route --job ${item.jobId} settles it deferred without dispatch (no attempt spent, whatever it was queued behind) and the legs behind it proceed` });
  }
  for (const item of queued.filter((row) => row.queuedBecause === 'ready' && !deferredQueued.has(row.jobId))) {
    const payload = jobPayloadOf(rowOf.get(item.jobId));
    actions.push({ kind: payload.rootVerify ? 'root-verify' : 'dispatch', op: item.opId, jobId: item.jobId,
      ...(item.seam ? { seamDuty: 'dispatch-seam' } : {}),
      reason: payload.rootVerify ? `read-only check of the root-cause claim on ${payload.rootVerify.node} (for ${payload.rootVerify.of}): api route --job ${item.jobId}, then api dispatch`
        : item.seam ? `dispatch seam now: ordinal 1 of cut ${item.seam.cutId}, ${item.seam.siblings} sibling ordinal(s) build on it (priority ${SEAM_PRIORITY_CLASS}): api route --job ${item.jobId}, then api dispatch - before any other queued work`
        : item.seamStub ? `ready on a stub (${item.seamStub.mode}): ${item.seamStub.reason}; api route --job ${item.jobId}, then api dispatch - it owes ${SEAM_RECONCILE_CHECK} once the seam lands`
        : `ready: api route --job ${item.jobId}, then api dispatch` });
  }
  const firstReached = legOps.findIndex((op) => jobsByOp.has(op));
  const succeeded = new Set(workflowJobs.filter((row) => row.status === 'succeeded').map((row) => row.op_id));
  if (firstReached >= 0) {
    for (const [index, op] of legOps.entries()) {
      if (index <= firstReached || jobsByOp.has(op) || op === HANDOVER_OP) continue;
      // Autopilot: provision.ask is planned only at the end of the flow (the handover credential checklist below);
      // a live proof waits for it while every other leg proceeds on the sandbox/stub path.
      if (autopilot?.on && (op === 'provision.ask' || (isLiveProofOp(op) && autopilot.credentialsOwed))) continue;
      // A credential ask holds only the live-proof legs: a build behind it runs on placeholder values.
      const credentialOnly = (ancestor) => credentialWaitOps.has(ancestor) && !isLiveProofOp(op);
      const waitsOn = (planAncestors.get(op) ?? []).filter((ancestor) => !(autopilot?.on && ancestor === 'provision.ask') && (approvalWaitOps.has(ancestor) || (!succeeded.has(ancestor) && !credentialOnly(ancestor)
        && !deferredPlanOps.has(ancestor) && (jobsByOp.has(ancestor) || legOps.indexOf(ancestor) > firstReached))));
      if (!waitsOn.length) {
        const placeholder = (planAncestors.get(op) ?? []).some(credentialOnly);
        const nodes = workGraph ? workGraph.frontier.map((node) => node.id) : [];
        const deferral = deferredPlanOps.get(op);
        actions.push({ kind: 'dispatch', op, ...(nodes.length ? { nodes } : {}), ...(deferral ? { deferred: deferral.reason } : {}), reason: deferral
          ? `approved leg ${op} is deferred (${deferral.reason}): api enqueue --op ${op} with its paths records it - it settles deferred at once, never dispatched, no attempt spent - and the legs behind it do not wait on it`
          : `approved leg ${op} has no job and every plan leg before it succeeded${placeholder ? ' or waits on a credential only' : ''}: api enqueue --op ${op}${placeholder ? ' building on placeholder values (credentialPending)' : ''}${nodes.length ? ` once per runnable work-graph node (${nodes.join(', ')}) with --paths its ownedPaths` : ''}, then route and dispatch it` });
      }
    }
  }
  // A red node of the work graph owes rework: the op that last wrote it runs again on its owned paths.
  const followedUp = new Set(contractFollowUps.map((item) => item.jobId));
  for (const node of workGraph?.frontier ?? []) {
    if (node.color !== 'red' || !node.lastOp || followedUp.has(node.lastJob)) continue;
    actions.push({ kind: 'dispatch', op: node.lastOp, nodes: [node.id], reason: `work-graph v${workGraph.version} turned ${node.id} red: api enqueue --op ${node.lastOp} --paths ${node.ownedPaths.join(',')}, then route and dispatch it` });
  }
  // A proof whose every piece of evidence is stale re-runs only the check that made it (proof-integrity.mjs).
  for (const item of staleProofs.filter((proof) => !staleReady.some((stale) => stale.jobId === proof.jobId))) {
    actions.push({ kind: 'impact-check', op: item.op, jobId: item.jobId, reason: `its proof of ${item.items.slice(0, 5).join(', ')}${item.items.length > 5 ? ` (+${item.items.length - 5})` : ''} is stale: ${item.changed.slice(0, 5).join(', ')} changed since it was indexed; re-dispatch ${item.op} as a new attempt --retry-of ${item.jobId} (only that check)` });
  }
  // A leg a reach: follow-up contract change owes a follow-up is rework: enqueue the follow-up leg.
  // Its work-graph nodes read red through the same follow-up, so they ride on this action instead of their own.
  for (const item of contractFollowUps) {
    const nodes = (workGraph?.frontier ?? []).filter((node) => node.color === 'red' && node.lastJob === item.jobId);
    const paths = [...new Set(nodes.flatMap((node) => node.ownedPaths ?? []))];
    actions.push({ kind: 'dispatch', op: item.followUpOp, jobId: item.jobId, change: item.change, ...(nodes.length ? { nodes: nodes.map((node) => node.id) } : {}),
      reason: `contract change ${item.change} owes ${item.followUpOp} a follow-up of ${item.jobId} (${item.op} a${item.attempt} ${item.status}): api enqueue --op ${item.followUpOp} --contract-change ${item.change} --follow-up-of ${item.jobId}${item.after ? ` --after ${item.after}` : ''} ${paths.length ? `--paths ${paths.join(',')}` : 'with its paths'}, then route and dispatch it` });
  }
  // Artwork slots a drawing declared and interface.asset has not filled (scripts/work/asset-slot.mjs): propose the
  // interface.asset leg that owes them, unless one is already queued or in flight.
  const assetLegOpen = workflowJobs.some((row) => row.op_id === ASSET_OP && (row.status === 'queued' || LEG_IN_FLIGHT.includes(row.status)));
  if (assetSlotsOwed.length && !assetLegOpen) {
    const records = [...new Set(assetSlotsOwed.map((slot) => slot.ui).filter(Boolean))];
    actions.push({ kind: 'dispatch', op: ASSET_OP, slots: assetSlotsOwed.map((slot) => slot.key),
      reason: `${assetSlotsOwed.length} artwork slot(s) the drawing owes to interface.asset (${assetSlotsOwed.slice(0, 5).map((slot) => slot.key).join(', ')}${assetSlotsOwed.length > 5 ? ` (+${assetSlotsOwed.length - 5})` : ''}): api enqueue --op ${ASSET_OP} --paths ${records.join(',')}, then route and dispatch it - it generates each slot under the brand imagery.promptRules and replaces the placeholder (src + data-asset-sha256)` });
  }
  for (const item of staleReady) {
    actions.push({ kind: 'impact-check', op: item.op, jobId: item.jobId, reason: item.followUp
      ? `the owner of a record it read declared the change breaking: enqueue ONE follow-up attempt of ${item.op}${item.cut ? ` cut ordinal ${item.cut.ordinal}` : ''}`
      : `records it read changed since it settled: re-dispatch ${item.op} as a new attempt${item.cut ? ` of cut ordinal ${item.cut.ordinal}` : ''}` });
  }
  for (const gate of ownerGates) {
    const held = gate.holds.find((id) => rowOf.has(id)) ?? null;
    actions.push(gate.kind === SUPERVISOR_GATE
      ? { kind: SUPERVISOR_GATE, op: gate.opId ?? (held ? rowOf.get(held).op_id : null), ...(held ? { jobId: held } : {}), incidentId: gate.incidentId,
        reason: `supervisor-gate ${gate.incidentId}: ${gate.detail}; the Supervisor's step (never the owner's) - keep driving every other leg; its resolve --by supervisor wakes you` }
      : { kind: 'owner-gate', op: gate.opId ?? (held ? rowOf.get(held).op_id : null), ...(held ? { jobId: held } : {}), incidentId: gate.incidentId,
        reason: `owner-gate ${gate.incidentId}: ${gate.detail}; the owner's step, then api incident --resolve` });
  }
  // Under autopilot nothing waits on the owner but the end of the flow: a pending ask the sweep could not handle
  // is the handover's (or its credential checklist's).
  for (const item of awaitingOwner.filter((ask) => ask.answer === 'pending')) {
    actions.push({ kind: 'owner-gate', op: item.opId, jobId: item.jobId, reason: autopilot?.on ? `ask ${item.dispatchId ?? '-'} is the end-of-flow owner step (handover or its credential checklist)` : `ask ${item.dispatchId ?? '-'} waits on the owner` });
  }
  // The ONE end-of-flow credential step: every business leg but the deferred live proofs settled (or deferred).
  if (autopilot?.on && autopilot.checklistDue) {
    actions.push({ kind: 'dispatch', op: 'provision.ask', final: true, reason: `the end-of-flow owner step "bổ sung credential": api enqueue --op provision.ask --params '{"subject":"${HANDOVER_CREDENTIALS_SUBJECT}"}' --paths .starciwork/evidence/${wf.workflow_id}.credentials; its ask files the question \`api autopilot --workflow ${wf.workflow_id} --checklist --json\` prints (.question), verbatim - one form for every deferred credential; the deferred approvals (${(autopilot.checklistApprovals ?? []).join(', ') || 'none'}) are released at the same time (api autopilot --release <dispatchId>). The deferred live proofs resume by themselves once the owner answers` });
  }
  for (const row of workflowJobs.filter((job) => LEG_IN_FLIGHT.includes(job.status))) {
    actions.push({ kind: 'wait', op: row.op_id, jobId: row.job_id, reason: row.status === 'effect_unknown' ? 'effect_unknown: reconcile it' : row.status });
  }
  for (const item of queued.filter((row) => !['ready', 'owner-gate', SUPERVISOR_GATE].includes(row.queuedBecause) && !deferredQueued.has(row.jobId))) {
    const seamFirst = item.seam && ['max-ops', 'pool-full', 'circuit-open', 'path-lease'].includes(item.queuedBecause)
      ? '; seam first: it takes the next free slot of this workflow (api dispatch refuses other work the last slot while it is queued)' : '';
    actions.push({ kind: 'wait', op: item.opId, jobId: item.jobId, reason: `${item.queuedBecause}${item.detail ? `: ${item.detail}` : ''}${seamFirst}` });
  }
  for (const wait of peerWaits) actions.push({ kind: 'wait', op: wait.opId, incidentId: wait.incidentId, reason: `peer-wait on ${wait.peer}: ${wait.detail.slice(0, 160)}` });
  // A proposed leg has no job yet, so queuedBecause cannot mark it held. Keep it visible, but do not
  // turn the frontier actionable for a dispatch the same supervisor-gate will refuse after enqueue.
  const nextActions = NEXT_ACTION_KINDS.flatMap((kind) => actions.filter((action) => action.kind === kind).map((action) => {
    if (!NEXT_ACTION_MOVES.includes(action.kind) || action.deferred) return action;
    const gate = ownerGates.find((item) => item.kind === SUPERVISOR_GATE
      && (item.holds.includes('*') || (action.jobId && item.holds.includes(action.jobId)) || (action.op && item.holds.includes(action.op))));
    if (gate) return { ...action, heldBy: { incident: gate.incidentId }, reason: `${action.reason}; held by supervisor-gate ${gate.incidentId} until the Supervisor resolves it` };
    // A peer-wait whose --holds names the step's op or job holds it too (fe-hold-until-landed): the other steps stay moves.
    const wait = peerWaits.find((item) => (action.jobId && item.holds.includes(action.jobId)) || (action.op && item.holds.includes(action.op)));
    return wait ? { ...action, heldBy: { incident: wait.incidentId, peer: wait.peer }, reason: `${action.reason}; held by peer-wait ${wait.incidentId} on ${wait.peer}: ${wait.detail.slice(0, 120)}` } : action;
  }));

  const unresolvedIds = new Set(unresolved.map((row) => row.job_id));
  const ownerWaitOps = new Set(awaitingOwner.map((item) => item.opId));
  const reworkOps = new Set(contractFollowUps.map((item) => item.followUpOp));
  const ops = [...legOps, ...[...jobsByOp.keys()].filter((op) => !legOps.includes(op))];
  const provisional = autopilot?.provisionalOps ?? new Set();
  const legs = ops.map((op) => {
    const rows = (jobsByOp.get(op) ?? []).filter((row) => row.status !== 'cancelled');
    const latest = rows.at(-1) ?? null;
    // Autopilot: a leg whose open work is only deferred reads `deferred`; a green leg resting on a provisional
    // acceptance reads green-provisional, labelled "tự nhận tạm" (the owner reviews it once at handover).
    if (rows.length && rows.every((row) => row.status === 'succeeded' || deferredJobs.has(row.job_id) || !['queued', 'failed', ...LEG_IN_FLIGHT].includes(row.status))
      && rows.some((row) => deferredJobs.has(row.job_id)) && !rows.some((row) => row.status === 'succeeded')) {
      return { op, color: 'deferred', label: 'hoãn tới buổi duyệt cuối', jobId: latest?.job_id ?? null, status: latest?.status ?? null };
    }
    const color = !rows.length ? 'gray'
      : rows.some((row) => LEG_IN_FLIGHT.includes(row.status)) ? 'yellow'
      : failedRows.some((row) => row.op_id === op && unresolvedIds.has(row.job_id)) ? 'red'
      : rows.some((row) => row.status === 'queued' && rowOf.get(jobPayloadOf(row).retry?.retryOf)?.status === 'failed') ? 'red'
      : rows.some((row) => row.status === 'queued') || ownerWaitOps.has(op) ? 'yellow'
      : rows.some((row) => row.status === 'succeeded') ? (reworkOps.has(op) ? 'red' : 'green')
      : 'red';
    const deferred = latest ? specDeferredJobs.get(latest.job_id) ?? null : null;
    const deferredField = deferred ? { deferred } : !rows.length && deferredPlanOps.has(op) ? { deferred: deferredPlanOps.get(op).reason } : {};
    if (color === 'green' && provisional.has(op)) return { op, color: 'green-provisional', label: PROVISIONAL_LABEL, jobId: latest?.job_id ?? null, status: latest?.status ?? null, ...deferredField };
    // A leg whose latest try ended asking the owner is yellow and says so: it is a wait, never a failure.
    const waitsOnOwner = latest?.status === 'awaiting_owner' && ownerWaitOps.has(op) ? { awaitingOwner: true } : {};
    return { op, color, jobId: latest?.job_id ?? null, status: latest?.status ?? null, ...waitsOnOwner, ...deferredField };
  });
  return { nextActions, legs };
}
/**
 * The stub siblings a pass reconciles (cut-seam.mjs): its own job when it ran on a stub and the seam
 * already passed (via settle-checks), and every stub sibling still owed when this pass closes the set
 * (via full-regression-final). Reads the ledger inside the settle transaction, after the job's update.
 */
function seamSettleReconciles(db, { job, jobId, payload, closesSet }) {
  const op = jobOpOf(job), cutId = String(payload.cut.id), out = [];
  try {
    const isOwnerWait = (row) => isAwaitingOwner(db, row);
    const reconcile = seamReconcileOf(db, { workflowId: job.workflow_id, op, cutId, isOwnerWait });
    for (const item of reconcile.owed) {
      if (item.jobId === jobId) out.push({ jobId, via: 'settle-checks', seamJobId: reconcile.seamJobId });
      else if (closesSet) out.push({ jobId: item.jobId, via: CUT_SET_CLOSING_CHECK, seamJobId: reconcile.seamJobId });
    }
  } catch { /* the settle stands; status still lists the reconcile owed */ }
  return out;
}
/**
 * The seam view of one cut set for api status cutSets[].seam (scripts/kernel/cut-seam.mjs): the seam head,
 * the siblings released to a stub (from the queued projection), the reconcile duty and a re-cut plan once
 * the seam slipped. Null when the cut has no seam attempt.
 */
function cutSeamViewOf(db, { workflowId, op, cutId, queued = [] }) {
  try {
    const isOwnerWait = (row) => isAwaitingOwner(db, row);
    const seam = seamStateOf(db, { workflowId, op, cutId, isOwnerWait });
    if (!seam.head) return null;
    const { recutAfterFailures } = cutSeamSettings();
    const seamIds = new Set(seam.rows.map((row) => row.job_id));
    const stubbed = queued.filter((item) => item.seamStub && seamIds.has(item.seamStub.seamJobId)).map((item) => ({ jobId: item.jobId, mode: item.seamStub.mode }));
    const held = queued.filter((item) => item.queuedBecause === 'dependency' && seamIds.has(item.blockedBy?.job) && jobPayloadOf(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(item.jobId)).cut?.id === String(cutId)).map((item) => item.jobId);
    const reconcile = seamReconcileOf(db, { workflowId, op, cutId, isOwnerWait });
    const slipped = !seam.passed && (seam.dead || seam.failures >= recutAfterFailures);
    return {
      jobId: seam.head.job_id, status: seam.head.status, passed: seam.passed, failures: seam.failures,
      ...(seam.interface ? { interface: { files: seam.interface.files ?? [], publishedBy: seam.interface.entityId, at: seam.interface.at } } : {}),
      ...(seam.released ? { released: { reason: seam.released.reason ?? null, at: seam.released.at } } : {}),
      ...(held.length ? { siblingsHeld: held } : {}),
      ...(stubbed.length ? { siblingsOnStub: stubbed } : {}),
      ...(reconcile.pending.length || reconcile.owed.length || reconcile.red.length || reconcile.green.length ? { reconcile } : {}),
      ...(slipped ? { recutPlan: recutPlanOf(db, { workflowId, op, cutId, isOwnerWait }) } : {}),
    };
  } catch { return null; }
}
/** The nextActions a cut set's seam view owes: reconcile each owed stub sibling, redo a red one, re-cut a slipped seam. */
function seamActionsOf(set) {
  const view = set.seam;
  if (!view) return [];
  const actions = [];
  for (const item of view.reconcile?.owed ?? []) {
    actions.push({ kind: 'impact-check', op: set.op, jobId: item.jobId, cutId: set.id, seamDuty: 'reconcile',
      reason: `cut ${set.id} seam ${view.jobId} landed after ordinal ${item.ordinal} (${item.jobId}) passed on a stub (${item.mode}): re-verify it against the real seam - rerun its scoped checks (typecheck/build and its slice tests) and record api cut-seam --reconcile --job ${item.jobId} --exit-code <n> --command "<cmd>"; a light re-check, not a redo` });
  }
  for (const item of view.reconcile?.red ?? []) {
    actions.push({ kind: 'retry', op: set.op, jobId: item.jobId, cutId: set.id, seamDuty: 'reconcile-red',
      reason: `ordinal ${item.ordinal} (${item.jobId}) does not reconcile with the landed seam (${SEAM_RECONCILE_CHECK} red): api enqueue --op ${set.op} with its paths --cut-id ${set.id} --cut-ordinal ${item.ordinal} --cut-total ${set.total} --retry-of ${item.jobId} (that ordinal only)` });
  }
  if (view.recutPlan) {
    actions.push({ kind: 'retry', op: set.op, jobId: view.jobId, cutId: set.id, seamDuty: 'recut',
      reason: `cut ${set.id} seam ${view.jobId} slipped (${view.failures} failed attempt(s), now ${view.status}); its siblings already run on a stub - re-cut the seam smaller: ${view.recutPlan.steps.join('; ')}` });
  }
  return actions;
}
/* ------------------------------------------------------- status git memo */
// api status took 26-31 s per workflow under load (8 s idle) on the nivo ledger, nearly all of it in
// spawnSync: every git call pays a process start (0.1-2.5 s on a loaded Windows host), and status repeated
// the same reads - runtime-rev.mjs re-resolved the current rev once per running job and re-diffed the same
// commit pair on every call, and two typed waits naming the same --until-commit targets ran the same
// rev-parse/ls-tree/log twice. While status runs, spawnSync of a read-only git verb is memoised:
//   - within the call, an identical read (root, argv, input, encoding) answers from memory;
//   - across calls, a read whose every revision is a full commit sha (HEAD is pinned to the sha the git
//     files name, gitHeadShaOf, no spawn) answers from a file under
//     STARCI_GIT_MEMO_DIR (default <tmpdir>/starci-git-memo). Such an answer is immutable, so the memo
//     needs no invalidation; only a clean exit (status 0, no spawn error) is kept, so a timeout or a
//     revision git does not know yet is asked again.
// The Orca reads status makes (terminal show and read per worker terminal) each
// cost 1-3 s of orca.exe start under load and ran one after another; prefetchStatusOrcaReads runs them in
// parallel just before the projection, and the projection's own call takes the prefetched answer once
// (a failed or timed-out prefetch is asked again live). STARCI_STATUS_MEMO=off turns all of it off.
// Every other spawn, and every git verb that reads refs or the worktree, runs live.
const GIT_MEMO_SCHEMA = 'starci/status-git-memo@1';
const GIT_READ_VERBS = new Set(['rev-parse', 'ls-tree', 'log', 'show', 'diff', 'cat-file']);
// The flags a pinned read may carry: each shapes the answer from the named objects alone.
const GIT_PINNED_FLAG_RX = /^(--verify|--quiet|-q|--name-only|--name-status|-r|-z|-\d+|-e|-t|-s|--batch|--batch-check|--format=.*|--pretty=.*)$/s;
const FULL_SHA_RX = /^[0-9a-f]{40}$/;
const GIT_PINNED_REV_RX = /^(HEAD|[0-9a-f]{40})(\^\{commit\}|:.*)?$/s;
// One entry holds at most GIT_MEMO_MAX_BYTES (a product repo's committed-Work cat-file batch runs ~4 MB); the
// directory is kept under GIT_MEMO_BUDGET_BYTES least-recently-used first (a hit refreshes its mtime), since
// every product commit pins a new HEAD and strands the entries of the old one.
const GIT_MEMO_MAX_BYTES = 16 * 1024 * 1024;
const GIT_MEMO_BUDGET_BYTES = 256 * 1024 * 1024;
const GIT_MEMO_TTL_MS = 14 * 24 * 3600 * 1000;
const gitMemoDirOf = (env = process.env) => (env.STARCI_GIT_MEMO_DIR ? path.resolve(env.STARCI_GIT_MEMO_DIR) : path.join(os.tmpdir(), 'starci-git-memo'));

/**
 * The commit HEAD names in the checkout at `root` (its top level), read from the git files with no spawn; null
 * when it cannot be told that way (not a top level, reftable, an unreadable ref), and the read then runs live.
 * Branch refs are read from the common dir only, as git does for a linked worktree.
 */
const gitHeadShaOf = (root) => {
  const isSha = (text) => FULL_SHA_RX.test(text);
  try {
    let gitDir = path.join(root, '.git');
    if (fs.statSync(gitDir).isFile()) {
      const pointer = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(gitDir, 'utf8'))?.[1];
      if (!pointer) return null;
      gitDir = path.resolve(root, pointer.trim());
    }
    const head = fs.readFileSync(path.join(gitDir, 'HEAD'), 'utf8').trim();
    if (isSha(head)) return head;
    const ref = /^ref:\s*(refs\/heads\/\S+)$/.exec(head)?.[1];
    if (!ref) return null;
    let common = gitDir;
    try { common = path.resolve(gitDir, fs.readFileSync(path.join(gitDir, 'commondir'), 'utf8').trim()); } catch { /* not a linked worktree */ }
    try { const loose = fs.readFileSync(path.join(common, ref), 'utf8').trim(); return isSha(loose) ? loose : null; } catch { /* packed */ }
    for (const line of fs.readFileSync(path.join(common, 'packed-refs'), 'utf8').split('\n')) {
      const [sha, name] = line.trim().split(' ');
      if (name === ref && isSha(sha)) return sha;
    }
  } catch { /* no git files to read */ }
  return null;
};

/** A spawnSync call as a read-only git read {root, verb, args}, or null. */
const gitReadOf = (command, argv, options) => {
  if (!/^git(\.exe)?$/i.test(path.basename(String(command ?? ''))) || !Array.isArray(argv)) return null;
  let root = options?.cwd ?? process.cwd(), rest = argv.map(String);
  if (rest[0] === '-C' && rest.length > 1) { root = rest[1]; rest = rest.slice(2); }
  return GIT_READ_VERBS.has(rest[0]) ? { root: path.resolve(String(root)), verb: rest[0], args: rest.slice(1) } : null;
};

/**
 * The cross-call key of a git read whose answer is fixed by commit objects alone, or null: every revision
 * is a full sha (HEAD pinned to its sha), every flag is in GIT_PINNED_FLAG_RX, a diff compares two commits
 * (one would read the worktree), a rev-parse only verifies (--abbrev-ref and the like read refs), and an
 * input is cat-file's list of pinned object names.
 */
const pinnedGitKeyOf = ({ root, verb, args }, input = null) => {
  let head;
  const pin = (spec) => {
    const m = GIT_PINNED_REV_RX.exec(spec);
    if (!m) return null;
    const rev = m[1] === 'HEAD' ? (head === undefined ? (head = gitHeadShaOf(root)) : head) : m[1];
    return rev ? `${rev}${m[2] ?? ''}` : null;
  };
  const out = [];
  let paths = false, revs = 0;
  for (const arg of args) {
    if (paths) { out.push(arg); continue; }
    if (arg === '--') { paths = true; out.push(arg); continue; }
    if (arg.startsWith('-')) { if (!GIT_PINNED_FLAG_RX.test(arg)) return null; out.push(arg); continue; }
    const pinned = pin(arg);
    if (!pinned) return null;
    out.push(pinned); revs += 1;
  }
  let lines = null;
  if (input != null) {
    if (verb !== 'cat-file') return null;
    lines = String(input).split('\n').map((line) => (line === '' ? '' : pin(line.replace(/\r$/, ''))));
    if (lines.some((line) => line == null)) return null;
  }
  if (verb === 'diff' && revs !== 2) return null;
  if (verb === 'rev-parse' && !(revs === 1 && args.includes('--verify'))) return null;
  if (revs === 0 && !lines?.some(Boolean)) return null;
  return JSON.stringify([GIT_MEMO_SCHEMA, root, verb, out, lines]);
};

const gitMemoFileOf = (dir, key) => path.join(dir, `${createHash('sha256').update(key).digest('hex').slice(0, 40)}.json`);
const gitMemoResult = (stdout, text) => {
  const out = text ? stdout : Buffer.from(stdout, 'base64'), err = text ? '' : Buffer.alloc(0);
  return { pid: 0, output: [null, out, err], stdout: out, stderr: err, status: 0, signal: null };
};
const readGitMemo = (dir, key, text) => {
  try {
    const file = gitMemoFileOf(dir, key);
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (doc?.key !== key || doc.text !== text || typeof doc.stdout !== 'string') return null;
    try { const now = new Date(); fs.utimesSync(file, now, now); } catch { /* recency is best effort */ }
    return gitMemoResult(doc.stdout, text);
  } catch { return null; }
};
const writeGitMemo = (dir, key, stdout, text) => {
  try {
    const body = text ? String(stdout ?? '') : Buffer.from(stdout ?? []).toString('base64');
    if (body.length > GIT_MEMO_MAX_BYTES) return;
    fs.mkdirSync(dir, { recursive: true });
    const file = gitMemoFileOf(dir, key), tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ key, text, stdout: body }));
    try { fs.renameSync(tmp, file); } catch { fs.rmSync(tmp, { force: true }); }
    pruneGitMemo(dir);
  } catch { /* a memo that cannot be written is asked again next call */ }
};
/** Drops entries unused past GIT_MEMO_TTL_MS, then the least recently used until the dir fits `budget`. */
const pruneGitMemo = (dir, { now = Date.now(), budget = GIT_MEMO_BUDGET_BYTES } = {}) => {
  try {
    const entries = [];
    for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name);
      try {
        const st = fs.statSync(file);
        if (now - st.mtimeMs > GIT_MEMO_TTL_MS) fs.rmSync(file, { force: true });
        else entries.push({ file, size: st.size, used: st.mtimeMs });
      } catch { /* raced */ }
    }
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries.sort((a, b) => a.used - b.used)) {
      if (total <= budget) break;
      try { fs.rmSync(entry.file, { force: true }); total -= entry.size; } catch { /* raced */ }
    }
  } catch { /* no memo dir yet */ }
};

const spawnKeyOf = (command, argv) => JSON.stringify([String(command), (Array.isArray(argv) ? argv : []).map(String)]);

/**
 * Runs `fn` with spawnSync answering the `prefetched` spawns ({spawnKeyOf: result}, each once) and
 * memoising read-only git reads (see above); the original is restored after.
 */
function withStatusSpawnMemo(fn, { prefetched = new Map(), env = process.env } = {}) {
  if (env.STARCI_STATUS_MEMO === 'off' || cp.spawnSync.statusMemo) return fn();
  const original = cp.spawnSync, dir = gitMemoDirOf(env), seen = new Map();
  const memoised = function spawnSyncStatusMemo(command, argv, options) {
    const ahead = spawnKeyOf(command, argv);
    if (prefetched.has(ahead)) { const result = prefetched.get(ahead); prefetched.delete(ahead); return result; }
    const read = gitReadOf(command, argv, options);
    if (!read) return original.apply(this, arguments);
    const encoding = options?.encoding ?? null, input = options?.input == null ? null : String(options.input);
    const text = encoding === 'utf8' || encoding === 'utf-8', raw = encoding == null || encoding === 'buffer';
    const local = JSON.stringify([read.root, read.verb, read.args, input, encoding]);
    if (seen.has(local)) return seen.get(local);
    const key = text || raw ? pinnedGitKeyOf(read, input) : null;
    const hit = key ? readGitMemo(dir, key, text) : null;
    if (hit) { seen.set(local, hit); return hit; }
    const result = original.apply(this, arguments);
    if (result && !result.error) {
      seen.set(local, result);
      // A HEAD that moved while git ran may have answered for the new commit: kept only when the pin held.
      if (key && result.status === 0 && pinnedGitKeyOf(read, input) === key) writeGitMemo(dir, key, result.stdout, text);
    }
    return result;
  };
  memoised.statusMemo = true;
  cp.spawnSync = memoised;
  syncBuiltinESMExports();
  try { return fn(); } finally { cp.spawnSync = original; syncBuiltinESMExports(); }
}

/** The jobs whose worker status observes: open, and running, leased or bound to a terminal. */
const statusWorkerRowsOf = (db, workflowId) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel'
    AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
  .all(workflowId, ...FINAL_SETTLED)
  .filter((job) => job.status === 'running' || job.status === 'leased' || operationTerminalHandleOf(job));

/** The spawns `fn` makes, recorded instead of run (each answers a spawn error, which the wrappers absorb). */
const recordSpawns = (fn) => {
  const calls = [], original = cp.spawnSync;
  cp.spawnSync = function spawnSyncRecorder(command, argv, options) {
    calls.push({ command, argv: Array.isArray(argv) ? argv : [], options: (Array.isArray(argv) ? options : argv) ?? {} });
    const error = Object.assign(new Error('recorded, not run'), { code: 'ERECORDED' });
    return { pid: 0, output: [null, '', ''], stdout: '', stderr: '', status: null, signal: null, error };
  };
  syncBuiltinESMExports();
  try { fn(); } catch { /* a wrapper that throws records what it reached */ } finally { cp.spawnSync = original; syncBuiltinESMExports(); }
  return calls;
};

/** One recorded spawn run asynchronously, as spawnSync would answer it; null when it did not exit on its own. */
const spawnAsyncOf = ({ command, argv, options }) => new Promise((resolve) => {
  try {
    cp.execFile(command, argv, { encoding: options.encoding ?? 'buffer', timeout: options.timeout ?? 0, maxBuffer: options.maxBuffer ?? 1024 * 1024,
      windowsHide: options.windowsHide ?? true, ...(options.cwd ? { cwd: options.cwd } : {}), ...(options.env ? { env: options.env } : {}) }, (error, stdout, stderr) => {
      if (error && typeof error.code !== 'number') return resolve(null);
      resolve({ pid: 0, output: [null, stdout, stderr], stdout, stderr, status: error ? error.code : 0, signal: null });
    });
  } catch { resolve(null); }
});

const STATUS_PREFETCH_CONCURRENCY = 8;
/**
 * The Orca reads status is about to make for `workflowId` - terminal show and read of every observed
 * worker terminal (a released worker is not observed) - run in parallel: {spawnKeyOf: result} for
 * withStatusSpawnMemo. The orchestration check is never prefetched: it consumes a Delivery.
 */
async function prefetchStatusOrcaReads(db, workflowId, env = process.env) {
  const prefetched = new Map();
  if (env.STARCI_STATUS_MEMO === 'off') return prefetched;
  const rows = statusWorkerRowsOf(db, workflowId).filter((job) => operationTerminalHandleOf(job));
  if (!rows.length) return prefetched;
  const handles = [...new Set(rows.filter((job) => jobPayloadOf(job).workerReleased?.custody?.state !== 'released').map((job) => operationTerminalHandleOf(job)))];
  const calls = recordSpawns(() => {
    for (const terminal of handles) { terminalShow({ terminal }); terminalRead({ terminal, screen: true }); }
  });
  const results = await mapConcurrent(calls, STATUS_PREFETCH_CONCURRENCY, spawnAsyncOf);
  calls.forEach((call, index) => { if (results[index]) prefetched.set(spawnKeyOf(call.command, call.argv), results[index]); });
  return prefetched;
}

/** api status with its Orca reads prefetched in parallel and its git reads memoised (see status git memo). */
/** `fn` over `items` with at most `limit` in flight; results in item order. */
async function mapConcurrent(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const index = next++; results[index] = await fn(items[index]); }
  }));
  return results;
}

/* ------------------------------------------------------------- hierarchy */
/* ------------------------------------------------------------------ plan */
/* -------------------------------------------------------------- estimate */
// Deterministic same-op sizing. The kernel measures the write scope and passes
// the counts; the computation is scripts/work/slice-estimate.mjs and every number
// lives in runtimes.yaml allocation.slicing, so the estimate is a declared
// computation and never a model's guess. The class plus the owner's config.yaml
// parallel.gear names agentsRequested, and the closure's disjoint path partition
// bounds agentsAchievable.
/* --------------------------------------------------------------- enqueue */
/* ---------------------------------------------------------- deferred tests */
// The owner's config.yaml `specs` switches (scripts/kernel/spec-deferral.mjs): a queued leg whose op only tests a
// class that is off is never routed or dispatched - route and dispatch settle it deferred (status succeeded,
// result verdict deferred, no attempt spent) and say so. Returns true when it did.
function deferQueuedTestLeg(ledger, { job, op, payload, via, args }) {
  const deferral = testDeferralOf({ skillRoot, op, payload });
  if (!deferral) return false;
  const deferred = deferJob(ledger, { job, deferral, via });
  if (!deferred) return false;
  const out = { ok: true, jobId: job.job_id, op, status: 'succeeded', deferred };
  emit(out, `${via} of ${job.job_id} (${op}) DEFERRED: ${deferral.reason} - settled without dispatch, no attempt spent; the legs behind it proceed; api run-deferred-tests --workflow ${job.workflow_id} runs it later`, args.json);
  return true;
}
// `api run-deferred-tests --workflow <id> [--kind unit|e2e|integration] [--dry-run]`: the owner's "test later" - every leg the
// specs switches deferred goes back to queued on its same attempt, stamped specsForced so it dispatches even while
// its class is still off; then the Kernel routes and dispatches it as usual.
/* ----------------------------------------------------------------- route */
// The quota probe shells out to a provider CLI, so it is imported lazily and
// every probe degrades to {state:'unknown'} when it throws — routing still
// decides on the capacity rows it can prove (running counts, maxParallel,
// open incidents). A probe is evidence, never a verdict.
const quotaModule = import('../agent/quota/index.mjs').catch(() => null);
const probeQuotaSafe = async (provider) => {
  try {
    const mod = await quotaModule;
    if (typeof mod?.probeQuota !== 'function') {
      return { state: 'unknown', usedPercent: null, detail: 'quota module unavailable' };
    }
    const probe = await mod.probeQuota(provider);
    return probe && typeof probe === 'object' ? probe : { state: 'unknown', usedPercent: null, detail: 'quota probe returned no result' };
  } catch (e) {
    return { state: 'unknown', usedPercent: null, detail: String(e?.message ?? e) };
  }
};

// A Kernel does not bias a route (owner decision 2026-09-25): `api route` and `api dispatch` refuse
// --prefer/--avoid as unknown options. The router decides from ledger facts; the owner's goal
// routing_bias is the only bias.
const refuseKernelBias = (verb, args) => {
  const flags = ['prefer', 'avoid'].filter((name) => args[name] !== undefined);
  if (flags.length) throw Object.assign(new Error(`api ${verb}: unknown option ${flags.map((f) => `--${f}`).join(', ')}; the router decides (open provider-health circuits, the retry lineage) and only the owner goal routing_bias applies`), { code: 'unknown-option' });
};

const normalizeProviderId = (provider) => {
  const id = String(provider ?? '').trim().toLowerCase();
  return id.replace(/-agent$/, '');
};
const failureText = (...parts) => parts.map((part) => {
  if (part == null) return '';
  if (typeof part === 'string') return part;
  try { return JSON.stringify(part); } catch { return String(part); }
}).join(' ');
const confirmedAuthFailure = ({ step, signal, error, details } = {}) => {
  const stages = [step, details?.stage, details?.failedStage, details?.result?.stage, details?.result?.failedStage]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase());
  if (stages.includes('auth') || stages.includes('authentication')) return true;
  const text = failureText(signal, error, details).toLowerCase();
  return /(?:\b401\b|not[_ -]?authenticated|authentication (?:failed|required)|oauth[^\n]*(?:expired|invalid|rejected)|(?:access[_ -]?)?token[^\n]*(?:expired|invalid|rejected)|invalid api[- ]?key|missing credentials|credential[^\n]*(?:expired|invalid|rejected))/.test(text);
};
// The credential a launch of this provider would present now, fingerprinted
// (scripts/agent/credential-fingerprint.mjs). An Orca-managed provider's
// identity comes from one `orca account list` per process, read only when a
// circuit or a strike needs the comparison.
let accountsOnce;
const currentCredentialOf = (provider) => {
  const card = credentialFingerprintOf(provider);
  if (card.resolved) return card;
  if (accountsOnce === undefined) { try { accountsOnce = accountList() ?? null; } catch { accountsOnce = null; } }
  return credentialFingerprintOf(provider, { accounts: accountsOnce?.ok ? accountsOnce : null });
};
// An open circuit, closed early only by a rotated credential or api provider-health --recover.
const providerHealthOf = (db, provider, now = Date.now()) => providerCircuitOf(db, provider, now, { credential: currentCredentialOf });
// The one command that clears an open circuit before its expiry (kernel caller only).
const providerRecoverCommand = (provider) => `api provider-health --provider ${provider} --recover --reason <text> --probe`;
// How an open circuit clears: a quota circuit by its recovery probe (the watchdog runs it), any other by the Kernel's --recover.
const circuitClearHint = (circuit) => circuit?.failureKind === 'quota'
  ? `; its quota probe clears it (${circuit.recover ?? `api provider-health --provider ${circuit.provider} --quota-probe`}, run by the watchdog at most once per probe interval and right after the plan reset)`
  : `; the Kernel clears it early with ${providerRecoverCommand(circuit?.provider)}`;
const providerCooldownMs = (failureKind) =>
  allocationMs(`cooldownMs.${Object.hasOwn(allocationSettings().cooldownMs ?? {}, failureKind) ? failureKind : 'other'}`);
// How many observations of one failure kind open the pool's circuit. A kind
// with no declared limit opens on the first: an authenticated provider that
// answers 401 is not a flake. runtimes.yaml allocation.providerStrikes.
const providerStrikeLimit = (failureKind) => {
  const value = Number(allocationSettings().providerStrikes?.[failureKind]);
  return Number.isInteger(value) && value > 0 ? value : 1;
};
// The raw provider-health row, open circuit or not: providerHealthOf answers
// only for an OPEN circuit, so it cannot count the strikes leading to one.
const providerSignalOf = (db, provider, now = Date.now()) => {
  const key = normalizeProviderId(provider);
  if (!key) return null;
  const row = readProviderCircuit(key);
  if (!row || (row.expiresAt != null && row.expiresAt <= now)) return null;
  return { ...row.value, at: row.at, expiresAt: row.expiresAt };
};
// Records one provider failure. Below the kind's strike limit the row is a
// durable 'striking' strike counter that routing ignores; on the limit it
// becomes the 'unavailable' circuit route/dispatch skip. The return value is
// the OPEN circuit or null — a strike is not yet provider health.
// A circuit that keeps reopening for the same failure is a condition that does
// not clear on its own (an un-onboarded CLI, a revoked credential): each reopen
// inside allocation.circuitBackoff.windowMs multiplies the cooldown by
// .factor, capped at .capMs. The trip count survives the row's expiry.
const circuitBackoff = () => allocationSettings().circuitBackoff ?? null;
// An auth failure records the fingerprint of the credential it was observed
// with (`credential`, resolved by the caller before its transaction); a row
// recorded against a different credential is no prior strike and no prior trip.
const writeProviderCircuit = (db, { provider, model, jobId, step, signal, error, now, failureKind = 'auth', credential = null,
  fixedExpiresAt = null, extra = null }) => {
  const key = normalizeProviderId(provider);
  if (!key) return null;
  const auth = failureKind === 'auth';
  const rotatedFrom = (row) => auth && credentialRotated(row, credential);
  const priorRow = providerSignalOf(db, key, now);
  const prior = rotatedFrom(priorRow) ? null : priorRow;
  const failures = (prior?.failureKind === failureKind ? Number(prior.failures ?? 0) : 0) + 1;
  const strikeLimit = providerStrikeLimit(failureKind);
  const opens = failures >= strikeLimit;
  const last = readProviderCircuit(key)?.value ?? {};
  const backoff = circuitBackoff();
  const sameRecent = last?.failureKind === failureKind && Number.isFinite(Number(last?.observedAt))
    && backoff && now - Number(last.observedAt) <= Number(backoff.windowMs) && !rotatedFrom(last);
  const trips = opens ? (sameRecent ? Number(last.trips ?? 0) : 0) + 1 : Number(sameRecent ? (last.trips ?? 0) : 0);
  const base = providerCooldownMs(failureKind);
  // A quota circuit with a known plan reset lasts until that reset: no backoff arithmetic guesses it.
  const fixed = opens && Number.isFinite(fixedExpiresAt) && fixedExpiresAt > now ? fixedExpiresAt : null;
  const cooldown = fixed ? fixed - now : opens && backoff && trips > 1
    ? Math.min(Number(backoff.capMs), base * Math.pow(Number(backoff.factor), trips - 1))
    : base;
  const expiresAt = now + cooldown;
  const value = {
    schema: 'starci/provider-health@1', provider: key,
    status: opens ? 'unavailable' : 'striking',
    failureKind, strikeLimit, model: model ?? null, jobId, step,
    signal: signal ?? null, detail: error ?? null, observedAt: now,
    failures, trips, cooldownMs: cooldown,
    ...(auth ? { credentialFingerprint: credential?.fingerprint ?? null, credentialSource: credential?.source ?? null } : {}),
    ...(extra ?? {}),
    ...(opens ? { recover: failureKind === QUOTA_FAILURE_KIND ? providerQuotaProbeCommand(key) : providerRecoverCommand(key) } : {}),
  };
  // The circuit is a machine.sqlite provider_health row (scripts/kernel/provider-circuit.mjs), fleet-wide.
  storeProviderCircuit(key, { value, expiresAt });
  return value.status === 'unavailable' ? { ...value, expiresAt } : null;
};

/* -------------------------------------------------------- outage circuits */
// A provider whose agent card declares an outage key (scripts/agent/provider-outage.mjs) opens its
// circuit on the evidence of a launch failure text (rejectDispatch) or a worker screen row (api status /
// api observe). quotaExhausted opens failureKind quota: the circuit lasts for
// allocation.cooldownMs.quota and
// `api provider-health --quota-probe` clears it earlier on a passing 1-token completion.
// capacityExhausted opens failureKind capacity for allocation.cooldownMs.capacity (circuitBackoff on a reopen).
const providerQuotaProbeCommand = (provider) => `api provider-health --provider ${provider} --quota-probe`;
const jobProviderOf = (job) => {
  const payload = jobPayloadOf(job);
  const declared = payload?.hierarchy?.runtime?.provider ?? null;
  if (declared) return declared;
  if (!payload?.model) return null;
  return poolCardFor(runtimeProfile(), payload.model)?.provider ?? null;
};
// The outage row a worker screen shows, or null (a provider whose card declares no outage key never matches).
const workerOutageEvidence = (job, screen) => {
  const provider = jobProviderOf(job);
  if (!provider || !outageSpecsOf(provider).length) return null;
  return outageOnScreen(provider, String(screen ?? ''));
};
const openQuotaCircuit = (db, { provider, model = null, jobId = null, step, signal = null, error = null, evidence, now }) => {
  return writeProviderCircuit(db, { provider, model, jobId, step, signal, error, now, failureKind: QUOTA_FAILURE_KIND,
    fixedExpiresAt: null, extra: { evidence: evidence ?? null } });
};
// The circuit an outage evidence opens: its failureKind decides quota (plan reset) or cooldown.
const openOutageCircuit = (db, { evidence, ...fields }) => evidence?.failureKind === QUOTA_FAILURE_KIND
  ? openQuotaCircuit(db, { ...fields, evidence })
  : writeProviderCircuit(db, { signal: null, error: null, model: null, jobId: null, ...fields, failureKind: evidence.failureKind, extra: { evidence } });
// Whether an open quota circuit's recovery probe is due: never probed, a probe interval since the
// last one, or the plan reset passed since it.
// `api provider-health [--provider <p>] --quota-probe [--force] [--workflow <id>]`: for each provider
// whose card declares quotaExhausted.probe (or the one named) with an OPEN quota circuit in this
// ledger, one real 1-token completion when due (quotaProbeDue; --force ignores the throttle). A pass
// clears the circuit (status recovered, event provider-health-recovered); a quota answer keeps it and,
// past the reset, rolls it to the next reset; any other answer is recorded and keeps it. Needs no
// Kernel proof: the probe is the evidence. The kernel watchdog runs it every tick under --repair.
// Opens the outage circuit for each observed worker whose screen shows an outage row. Not again while
// that provider's circuit of the same kind is open (a re-read screen is no new strike), and not for a row
// printed before the last observation of that kind or its recovery (the frame still shows the old error).
// Returns the circuits opened.
function recordWorkerOutageEvidence(ledger, workers, now = Date.now()) {
  const opened = [];
  const seen = new Set();
  for (const worker of workers ?? []) {
    const evidence = worker?.providerOutage;
    if (!evidence?.provider || seen.has(evidence.provider)) continue;
    seen.add(evidence.provider);
    const kind = evidence.failureKind;
    const row = providerSignalOf(ledger.db, evidence.provider, now);
    if (row?.status === 'unavailable' && row.failureKind === kind) continue;
    const lastRow = readProviderCircuit(evidence.provider)?.value ?? {};
    const lastSame = lastRow.failureKind === kind ? lastRow
      : lastRow.previous?.failureKind === kind ? lastRow.previous : null;
    const seenUntil = Math.max(Number(lastSame?.observedAt) || 0, lastSame ? Number(lastRow.recoveredAt) || 0 : 0);
    const printedAt = Number(worker.lastOutputAt);
    if (lastSame && !(Number.isFinite(printedAt) && printedAt > seenUntil)) continue;
    const job = ledger.db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(worker.jobId);
    const payload = job ? jobPayloadOf(job) : {};
    ledger.transaction(() => {
      const circuit = openOutageCircuit(ledger.db, { provider: evidence.provider, model: payload.model ?? null, jobId: worker.jobId,
        step: 'worker-screen', signal: evidence.match, error: `worker screen shows ${evidence.provider} ${kind === QUOTA_FAILURE_KIND ? 'plan quota exhausted' : `out of ${kind}`}`, evidence, now });
      if (!circuit) return;
      if (job?.workflow_id) ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'provider', entityId: circuit.provider,
        kind: 'provider-unavailable', payload: { ...circuit, source: 'worker-screen' } });
      opened.push({ provider: circuit.provider, failureKind: kind, jobId: worker.jobId, match: evidence.match, expiresAt: circuit.expiresAt });
    });
  }
  return opened;
}

/* -------------------------------------------------------- provider-health */
// `api provider-health --provider <p>` shows this ledger's provider-health row
// for one provider credential: open or not, the fingerprint of the credential
// it recorded and of the one a launch would present now (never the value).
// `--recover --reason <text> [--probe]` clears an OPEN circuit before its
// expiry, so a fixed credential is not parked for the rest of an auth cooldown.
// Nothing else clears one early but a rotated credential (providerCircuitOf):
// resolving an incident does not. Kernel only: the caller's
// ORCA_TERMINAL_HANDLE must be the terminal of a running kernel job of this
// ledger; an op (op-context-refused) and any unproven caller
// (kernel-proof-required) are refused. With --probe the credential is proven live first
// (scripts/agent/credential-probe.mjs) and a failed probe refuses the clear
// (probe-failed, recorded as 'provider-health-recover-refused'). A clear
// rewrites the row as status 'recovered' expiring now (failures and trips
// restart) and appends 'provider-health-recovered' with the reason, the probe
// and the circuit it cleared.
// `api route` — resolve the pool/model for one job and persist the decision on
// its payload so `dispatch --spawn` launches exactly what was routed. Bias: only
// the owner's routing_bias {prefer[], avoid[]} on the workflow goal's json
// (define-goal). A Kernel's --prefer/--avoid is refused as an unknown option
// (owner decision 2026-09-25: starci-next op-interface.implement-c3bcc0d5e4 was routed around
// devin-agent onto codex on a hunch). The router itself skips a
// pool whose provider-health circuit is open (capacity below) and, for a retry,
// demotes or excludes the pools its lineage failed on (scripts/kernel/lineage-route.mjs).
// Difficulty: --difficulty > job payload.difficulty > 'medium'.
/* --------------------------------------------------------------- cut-seam */
/* -------------------------------------------------------------- dispatch */
const resolveModel = (target) => {
  if (!target) return { error: 'no operation target given and modules/models/registry.yaml names no orchestration.defaultOperationTarget' };
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${target}.yaml`);
  if (!fs.existsSync(file)) return { error: `no model profile ${target} at ${path.relative(skillRoot, file)}` };
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  return { target, provider: doc?.provider ?? null,
    requestedModel: doc?.identity?.requestedModel ?? null, profile: path.relative(skillRoot, file) };
};

// The owner's language (config.yaml `language`) for every string the owner
// reads; canonical records stay English. A broken config falls back to English.
const ownerLanguage = () => { try { return loadConfig()?.language ?? 'en'; } catch { return 'en'; } };
const ownerDelegation = () => { try { return activeDelegation(); } catch { return null; } };

// Each owned path as the packet carries it. A path the target resolver
// (scripts/kernel/target-repo.mjs) retargets carries its path relative to its
// repository, that repository's binding role and checkout root, and the
// declared spelling; a path it leaves where dispatch placed the worker stays
// {path} exactly as declared.
const packetOwnedPaths = (payload, placements = []) => (payload.owned_paths ?? []).map((p) => {
  const entry = typeof p === 'string' ? { path: p } : p;
  const at = placements.find((x) => x.owned === entry.path);
  if (!at || at.via === 'placement') return entry;
  if (at.unresolved) return { ...entry, repository: at.repository, unresolved: true };
  return { ...entry, declared: entry.path, path: at.path, repository: at.role, root: at.base };
});
const buildPacket = ({ job, payload, model, goal, params, placements, productLocale = null, ownerAnswers = [], boundGoal = null }) => ({
  op: job.op_id ?? payload.opId,
  brief: `modules/ops/ops/${job.op_id ?? payload.opId}.yaml`,
  ...(params && Object.keys(params).length ? { params } : {}),
  context: {
    workflow: {
      id: job.workflow_id,
      goal_revision: payload.goal_binding?.revision ?? goal?.revision ?? null,
      goal_identity: payload.goal_binding?.identity ?? goal?.goal_identity ?? null,
    },
    // The owner's goal text of the revision the job is bound to, so an op reads it from
    // `api op-contract --json` and never opens the ledger for it (nivo auth inc-26b260e101e4).
    ...((boundGoal ?? (payload.goal_binding?.revision == null ? goal : null)) ? { goal: goalForPacket(boundGoal ?? goal) } : {}),
    attempt: tryOf(job),
    owner_language: ownerLanguage(),
    owner_delegation: ownerDelegation(),
    // UI copy language, not the log language (scripts/kernel/product-locale.mjs).
    product_locale: productLocale,
    records: payload.records ?? [],
    owned_paths: packetOwnedPaths(payload, placements),
    ...(payload.cut ? { cut: payload.cut } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.risk ? { risk: payload.risk } : {}),
    // The asks this job's retry lineage already had answered (scripts/kernel/owner-answers.mjs):
    // binding input for this attempt, never a question to file again.
    ...(ownerAnswers.length ? { owner_answers: ownerAnswers } : {}),
    // The owner asked for this deferred test leg to run anyway (api run-deferred-tests): its specs switch no longer applies.
    ...(payload.specsForced ? { specs_forced: payload.specsForced } : {}),
  },
  constraints: { model: model.target, provider: model.provider, budget: payload.budget ?? null, lease: job.lease_token ?? null },
  returns: { verdict: 'pass|fail|blocked', evidence: ['...paths'], suspicion: 'string?' },
});

// dispatch-rejected — the shared refusal for every launch kind: the job must
// NEVER stand 'running' on a launch that failed. Job → failed with a typed
// result, lease rows released, one event — and when `incident` is set (the
// post-launch attestation failures) a typed infra-provider incident so survey
// sees it without parsing events. `terminal` is the launch's handle: the worker's Dispatch id.
const bestEffort = (fn) => { try { return fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };

// A refusal must leave no live worker or open Task behind. Whatever this
// attempt created before the host said no is closed exactly once here: its
// worker with worker-stop + worker-release. It runs before the rejection is written so the answer —
// terminalClosed: true | false | null when the attempt created nothing to
// close — is part of the dispatch-rejected record rather than a second
// unrecorded effect. `settled` is a cleanup the caller already performed
// (cmdDispatchManaged reconciles partial effects before rejecting); it is
// reported, never repeated.
// An unknown effect is the one case a refusal may NOT force closed: calls.yaml
// reconcile-then-stop says the job is fenced at effect_unknown until `api
// reconcile` proves the state. terminalClosed is false there — outstanding,
// not silent.
const closeRejectedLaunch = ({ terminal, settled, effectState }) => {
  if (!terminal) return { terminalClosed: null, closed: null };
  if (!settled && effectState === 'unknown')
    return { terminalClosed: false, closed: { kind: 'managed', dispatchId: terminal, deferred: 'reconcile-then-stop' } };
  const stop = settled ? settled.stop : bestEffort(() => workerStop({ dispatch: terminal }));
  const release = settled ? settled.release : bestEffort(() => workerRelease({ dispatch: terminal }));
  const provenNoEffect = settled?.provenNoEffect === true;
  return {
    terminalClosed: provenNoEffect || (stop?.ok === true && release?.ok === true),
    closed: { kind: 'managed', dispatchId: terminal, stop: { ok: stop?.ok === true },
      release: { ok: release?.ok === true }, ...(provenNoEffect ? { provenNoEffect: true } : {}) },
  };
};

// The last rows the refused terminal showed. Five Codex op launches failed
// model attestation ("did not render gpt-6-sol within 15000ms") and the
// rejections kept no screen, so nobody could tell a slow start from an update
// prompt or an error; the tail now rides on the dispatch-rejected event.
const screenTailOf = (screen) => {
  const rows = String(screen ?? '').split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(-15);
  return rows.length ? rows.join('\n').slice(-1500) : null;
};
// The one human-readable line of a refused launch (op attempt settle_json.message, the UI): what step refused it and why.
export const dispatchRejectedMessage = ({ step, signal = null, error = null }) =>
  `dispatch rejected at ${step ?? 'launch'}${signal ? ` (${signal})` : ''}${error ? `: ${String(error).slice(0, 300)}` : ''}; no try spent, the job goes back to ready`;
const rejectDispatch = (ledger, job, jobId, op, model, {
  step, signal = null, error = null, terminal = null, incident = false, attemptId = null,
  effectState = 'none', details = null, providerHealthEvidence = null,
  settled = null, trust = null, task = null,
}) => {
  // A provider whose card declares an outage key: its outage codes in the failure text, or its outage
  // error row on the refused terminal's screen, open that outage circuit (not the auth one).
  const outageFailure = !providerHealthEvidence && model?.provider
    ? (outageInText(model.provider, [signal, error, details?.signal, details?.error])
      ?? outageOnScreen(model.provider, typeof details?.screen === 'string' ? details.screen : ''))
    : null;
  const authFailure = !outageFailure && (Boolean(providerHealthEvidence) || confirmedAuthFailure({ step, signal, error, details }));
  const { terminalClosed, closed } = closeRejectedLaunch({ terminal, settled, effectState });
  // The Orca Task the refused attempt opened is closed with its terminal (the retry opens its own): a refusal leaves
  // no open worker-task entry behind. An unknown effect keeps its Task: reconcile proves the state first.
  const taskClosed = task?.taskId && effectState === 'none'
    ? closeOperationTask(ledger.db, job, { orca: { taskId: task.taskId, runId: task.runId ?? null } }, task.kernelHandle ?? null) : null;
  // rejectDispatch is reached only before an accepted operation contract or
  // business verdict. Once the host proves effectState:none, the same durable
  // candidate is safe to reroute regardless of whether the infrastructure
  // cause was auth, the machine arbiter, or worker startup. Provider auth has
  // the additional side effect of opening the typed provider circuit.
  // H13: a launch refused before the op accepted its contract spends no try of the unit, whatever its effect: the same
  // job goes back to ready (leased -> ready) when nothing ran, or is fenced effect_unknown (reconcile requeues the SAME
  // job, effect_unknown -> ready) when a worker may have started. It never becomes a failed try.
  const reusable = effectState === 'none';
  const status = reusable ? 'ready' : 'effect_unknown';
  let providerHealth = null;
  // Resolved outside the transaction: an Orca-managed identity is a host call.
  const credential = authFailure && !providerHealthEvidence && model?.provider ? currentCredentialOf(model.provider) : null;
  ledger.transaction(() => {
    const now = Date.now();
    const leasesReleased = effectState === 'none' ? releaseLeases(ledger.db, { jobId }) : 0;
    if (outageFailure) {
      providerHealth = openOutageCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, evidence: outageFailure, now,
      });
    } else if (authFailure) {
      providerHealth = providerHealthEvidence ?? writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now, credential,
      });
        } else if ((step === 'worker-start' || signal === PROMPT_DELIVERY_STALLED) && model?.provider) {
      // A managed launch the host refused without saying why, or a prompt
      // lost on two stalled sends (scripts/agent/lib.mjs deliverPrompt), is
      // still the provider's launch path failing. Left unclassified it fed nothing, so
      // the kernel rerouted straight back to the same pool and burned another
      // launch. It is a strike (runtimes.yaml allocation.providerStrikes) —
      // one flake never parks a pool, the second one does.
      providerHealth = writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now,
        failureKind: step === 'worker-start' ? 'worker-start' : PROMPT_DELIVERY_STALLED,
      });
    }
    const priorPayload = jobPayloadOf(job);
    // A rejected dispatch is EVIDENCE, never a binding. Overwriting
    // managed.dispatchId with it made one field mean two things, and the
    // readers that resolve a report's dispatch could not tell them apart:
    // a valid report from the live retry was refused because the payload
    // still pointed at the dispatch that never got a contract. The rejected
    // id goes on its own list; reconcile reads it there.
    if (terminal) {
      priorPayload.rejectedDispatches = [
        ...(Array.isArray(priorPayload.rejectedDispatches) ? priorPayload.rejectedDispatches : []),
        { dispatchId: terminal, step, at: now, effectState },
      ];
    }
    const result = {
      reason: 'dispatch-rejected', step, signal, detail: error, provider: model.provider,
      effectState, attemptConsumed: false, retryable: reusable, providerHealth, at: now,
      message: dispatchRejectedMessage({ step, signal, error }),
      terminalClosed, ...(closed ? { closed } : {}), ...(taskClosed ? { taskClosed } : {}),
    };
    const db = ledger.db, current = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;
    if (reusable) setJobStatus(db, { jobId, to: 'ready', reason: `dispatch-rejected:${step}`, at: now, payload: priorPayload, workerId: null, leaseToken: null, deadline: null });
    else {
      if (current === 'leased') setJobStatus(db, { jobId, to: 'running', reason: `dispatch-rejected:${step}`, at: now, workerId: terminal ?? null });
      setJobStatus(db, { jobId, to: 'effect_unknown', reason: `dispatch-rejected:${step}`, at: now, payload: priorPayload });
    }
    // The attempt row ends in the same transaction as the refusal: never left open, never a try of the unit.
    if (attemptId != null) endRejectedAttempt(db, { attemptId, at: now, endState: reusable ? 'requeued' : 'effect-unknown', effectState,
      releasedAt: reusable ? now : null, taskClosedAt: taskClosed?.ok === true ? now : null });
    recordJobResult(db, { jobId, result, at: now });
    recordWhy(db, attemptId, { at: now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId, ...(attemptId != null ? { attemptId } : {}),
      kind: 'dispatch-rejected',
      payload: { op, step, signal, error, provider: model.provider, model: model.target, terminal,
        effectState, attemptConsumed: false, retryable: reusable, leasesReleased, providerHealth,
        terminalClosed, ...(closed ? { closed } : {}), ...(taskClosed ? { taskClosed } : {}), ...(attemptId != null ? { attemptId } : {}),
        ...(trust ? { trust } : {}),
        ...(screenTailOf(details?.screen) ? { screenTail: screenTailOf(details.screen) } : {}) },
    });
    if (providerHealth) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'provider', entityId: providerHealth.provider,
        kind: providerHealth.failureKind === 'auth' ? 'provider-auth-unavailable' : 'provider-unavailable',
        payload: providerHealth,
      });
    }
    // Provider auth is represented by the expiring provider-health circuit.
    // A permanent open incident would outlive that cooldown and prevent
    // recovery after the owner refreshes credentials.
    if (incident && !authFailure && !outageFailure) {
      openIncident(ledger.db, { workflowId: job.workflow_id, kind: 'infra-provider', opId: op, jobId, attemptId, at: now,
        detail: `[infra-provider] ${JSON.stringify({ provider: model.provider, signal: signal ?? error ?? null, jobId,
          ...(providerHealth?.status === 'unavailable' ? { circuitUntil: providerHealth.expiresAt ?? null, recover: providerRecoverCommand(providerHealth.provider) } : {}) })}` });
    }
  });
  return { status, effectState, attemptConsumed: false, retryable: reusable, providerHealth,
    terminalClosed, ...(closed ? { closed } : {}), ...(taskClosed ? { taskClosed } : {}) };
};

/* ------------------------------------------------------ op IPC helpers */
// §6 admission for an op dispatch. The durable fence is taken BEFORE anything
// launches: one `path:<normalized owned_path>` resource
// per payload.owned_paths entry (capacity 1 = exclusive write ownership —
// seeded OR IGNORE so an operator-declared capacity is never overwritten),
// then reserveTwoPhase flips the job queued → leased with its fencing token
// and registers the ledger on the machine arbiter. The arbiter is REQUIRED by
// reserveTwoPhase's signature even for repo-only leases (it registers the
// ledger; machine leases are gone — machine_ref is always NULL now) — the
// same openMachine handle settle already uses. An open failure returns !ok:
// a dispatch that cannot fence must not launch.
// Bounds a crashed worker's fence; settle releases early. One authority:
// modules/models/runtimes.yaml allocation.dispatchLeaseTtlMs.
const DISPATCH_LEASE_TTL_MS = allocationMs('dispatchLeaseTtlMs');
// engine/admission.mjs owns owned-path normalization and the capacity-1 lease
// request per minimal prefix — the same function the ledger's conflict finder
// resolves paths with, so a request and a held lease can never disagree.
// In a bound project each request is spelled repository-qualified (scripts/kernel/lease-canon.mjs), and
// held rows are compared in that form through their holder job, so a bare and a repository-prefixed
// spelling of one file overlap (nivo inc-52a4a5ee5b12). Without a canonicalizer: the paths as written.
const opLeaseRequests = (payload, canon = null, op = null) => (canon
  ? canon.requests(payload, op ?? payload?.opId ?? null)
  : ownedPathLeaseRequests((payload.owned_paths ?? []).filter(Boolean)));

// A write set another job's LIVE lease still owns is a wait, never a launch failure. A nivo job
// was dispatched twice and rejected at `reserve` both times behind its own workflow's running
// interface.implement (en.json/vi.json); each refusal was recorded dispatch-rejected and fed
// repeat-reject OWED. Now route and dispatch answer path-lease and leave the job queued: status
// projects it queuedBecause path-lease naming the holder and its expiry, and once the holder settles
// (releasing its rows) the job reads ready, the frontier turns actionable and the Kernel's next wake
// dispatches it. Live means the row has not expired and its holder has not settled; an expired or
// orphaned row is a recovery signal (the prior attempt's effect may exist), so any such conflict is
// no wait here and reserve still refuses it as before. `conflicts` takes reserveTwoPhase's
// pathConflicts (the race after this check) or, absent, the ledger is read now.
const livePathLeaseWait = (db, job, payload, { conflicts = null, now = Date.now(), repo = null } = {}) => {
  let found = conflicts;
  if (!Array.isArray(found)) {
    const canon = repo ? leaseCanonOf(db, repo) : null;
    try { found = findOwnedPathLeaseConflicts(db, opLeaseRequests(payload, canon, job.op_id), { excludeJobId: job.job_id, canonicalOf: canon?.canonicalOf }); }
    catch { return null; }
  }
  const rows = found.map((c) => ({
    requested: c.requested, held: c.held, jobId: c.jobId ?? c.job_id, opId: c.opId ?? c.op_id ?? null,
    workflowId: c.workflowId ?? c.workflow_id ?? null, expiresAt: Number(c.expiresAt ?? c.expires_at),
  }));
  if (!rows.length) return null;
  const holderStatus = new Map();
  for (const row of rows) {
    if (!holderStatus.has(row.jobId)) holderStatus.set(row.jobId, db.prepare('SELECT status FROM jobs WHERE job_id=?').get(row.jobId)?.status ?? null);
    const status = holderStatus.get(row.jobId);
    if (!(row.expiresAt > now) || !status || FINAL_SETTLED.includes(status)) return null;
  }
  const holders = [...new Map(rows.map((row) => [row.jobId, {
    jobId: row.jobId, opId: row.opId, workflowId: row.workflowId, status: holderStatus.get(row.jobId),
    sameWorkflow: row.workflowId === job.workflow_id,
    paths: [...new Set(rows.filter((r) => r.jobId === row.jobId).map((r) => r.held))],
    expiresAt: Math.max(...rows.filter((r) => r.jobId === row.jobId).map((r) => r.expiresAt)),
  }])).values()];
  const minutes = (at) => Math.max(0, Math.round((at - now) / 60000));
  const detail = [
    rows.map((r) => `${r.requested} overlaps durable lease ${r.held} held by ${r.jobId}`).join('; '),
    `waiting on ${holders.map((h) => `${h.jobId} (${h.opId ?? '-'}${h.sameWorkflow ? ', this workflow' : `, workflow ${h.workflowId}`}, ${h.status}, lease expires in ~${minutes(h.expiresAt)}m at ${new Date(h.expiresAt).toISOString()})`).join(', ')}`,
    'the job stays queued (queuedBecause path-lease) and reads ready once the holder settles and releases the lease; the next wake dispatches it, so do not re-dispatch it by hand',
  ].join(' — ');
  return { queuedBecause: 'path-lease', holders, conflicts: rows, detail };
};

const reserveOpLeases = (ledger, job, payload, { ttlMs = DISPATCH_LEASE_TTL_MS, repo = null } = {}) => {
  const canon = repo ? leaseCanonOf(ledger.db, repo) : null;
  const db = ledger.db, leases = opLeaseRequests(payload, canon, job.op_id);
  // An undeclared path resource has capacity 1 (no resources row is seeded); reserveTwoPhase flips the job
  // queued → ready → leased with its fencing token.
  let machine;
  try { machine = openMachine({ file: machineFileFor() }); }
  catch (e) { return { ok: false, reasons: [`machine arbiter unavailable: ${String(e?.message ?? e)}`], machineUnavailable: true }; }
  try {
    return reserveTwoPhase(ledger, machine, {
      job: {
        jobId: job.job_id, workflowId: job.workflow_id, opId: job.op_id,
        attempt: tryOf(job), generation: job.generation, kind: job.kind, role: job.role ?? null,
      },
      leases, ttlMs, canonicalOf: canon?.canonicalOf ?? null,
    });
  } finally { machine.close(); }
};

// The kernel → worker half of the op IPC: one contracts row per
// (workflow_id,op_id,attempt) carrying what the worker was actually asked to
// do — the rendered prompt plus the structured packet. Written before the job
// is marked running; dispatch_id is the worker's handle (terminal handle for
// command-terminal launches, Dispatch id for managed ones).
const buildContractMarkdown = ({ op, jobId, prompt, packet }) =>
  `# dispatch contract — [Op] ${op} (job ${jobId})\n\n${prompt}\n\n## packet\n\n\`\`\`json\n${JSON.stringify(packet, null, 2)}\n\`\`\`\n`;
// context.contract is the contract version the leg is admitted under (scripts/kernel/contract-version.mjs):
// the leg is judged against it for life, whatever lands on main after (modules/kernel/contract-changes.yaml).
// A frozen family's batched changes not yet released for this workflow are WITHHELD from the leg (contract.withheld,
// modules/kernel/contract-freeze.yaml): it is judged as if admitted before them, for life.
const admittedVersionOf = (op, now, { db = null, workflowId = null } = {}) => {
  let version = null;
  try { version = contractVersionOf(skillRoot, op, { now }); } catch { return null; }
  let withheld = [];
  try { if (db && workflowId) withheld = withheldChangesFor(db, loadContractChanges(skillRoot), { workflowId, op, now }); } catch { withheld = []; }
  return withheld.length ? { ...version, withheld } : version;
};
/**
 * The dispatch's attempt and its contract (DBTREE op_attempts + contracts): one op_attempts row per dispatch - the
 * dispatch guard admits it only for a leased job of a running workflow - carrying the job scratch the op reports from
 * (a3-3: api report reads the report ONLY from op_attempts.scratch_dir), then the contract keyed by that attempt.
 * Returns the attempt id. Runs inside the caller's transaction.
 */
const fileContract = (db, { job, op, dispatchId, markdown, context, now, attempt = {} }) => {
  const row = startAttempt(db, { workflowId: job.workflow_id, jobId: job.job_id, dispatchId, at: now, dispatchedAt: now, ...attempt });
  writeContract(db, { attemptId: row.attempt_id, markdown, createdAt: now,
    context: context ? { ...context, contract: context.contract ?? admittedVersionOf(op, now, { db, workflowId: job.workflow_id }) } : null });
  return row.attempt_id;
};

/** One line per checked service of an env-health result. */
const envServicesOf = (health) => (health?.environments ?? []).flatMap((e) => e.services.map((s) => ({ env: e.id, service: s.service, state: s.state, ready: s.ready,
  url: s.url, ...(s.status != null ? { status: s.status } : {}), ...(s.discovered ? { discovered: `${s.discovered.method} ${s.discovered.url}` } : {}),
  ...(s.listener ? { listener: { pid: s.listener.pid, commandLine: String(s.listener.commandLine ?? '').slice(0, 200) } } : {}), ...(s.action ? { action: s.action } : {}) })));
/** Run scripts/uat/env-health.mjs check --restart for a job's referenced environments; null when it cannot run. */
// Every op lands into its product repository's main at its settle, so the stack is served from the live checkout.
function environmentPreStep(repo, payload) {
  const script = path.join(skillRoot, 'scripts', 'uat', 'env-health.mjs');
  const paths = (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
  const env = typeof payload.params?.environment === 'string' ? ['--env', payload.params.environment] : [];
  const r = spawnSync(process.execPath, [script, 'check', '--repo', repo, '--paths', JSON.stringify(paths), ...env, '--restart', '--json'],
    { encoding: 'utf8', windowsHide: true, timeout: 300000 });
  try { return JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { return null; }
}
/** One open [environment] incident per workflow and environment state; refreshed, never duplicated. */
function raiseEnvironmentIncident(ledger, job, health) {
  const db = ledger.db, now = Date.now();
  const blocked = envServicesOf(health).filter((s) => !s.ready);
  const detail = `[environment] ${blocked.map((s) => `${s.env}/${s.service} ${s.state}${s.listener ? ` (PID ${s.listener.pid})` : ''}`).join(', ')}: ${health.remedies.join(' | ')}`.slice(0, 1800);
  const open = db.prepare("SELECT incident_id FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE '[environment]%'").get(job.workflow_id);
  if (open) { ledger.transaction(() => updateIncident(ledger.db, { incidentId: open.incident_id, lastProgress: detail, at: now })); return open.incident_id; }
  const incidentId = `inc-${newToken().slice(0, 12)}`;
  ledger.transaction(() => {
    openIncident(ledger.db, { incidentId, workflowId: job.workflow_id, kind: 'environment', opId: jobOpOf(job), jobId: job.job_id,
      detail, lastProgress: detail, at: now });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'incident', entityId: incidentId, kind: 'incident-raised',
      payload: { kind: 'environment', detail, opId: jobOpOf(job), jobId: job.job_id, services: blocked, auto: true } });
  });
  return incidentId;
}




// One Orca Run per workflow, bound to the dedicated Kernel terminal. The Run
// is created lazily by the first operation so Kernel boot stays independent of
// launcher context. Every operation Task in that Run is therefore a semantic
// child of the Kernel coordinator even when its terminal is a peer tab in the
// same worktree.
// Every Run-scoped call (dispatch, api reply, a Task close) binds the Run to the workflow's current Kernel
// terminal first: a replaced Kernel (start-workflow) is not the Run's consumer until one run-use, and Orca
// refuses its reply and task-update consumer_fenced until then (nivo inc-e523617a3c31). bindWorkflowRun
// is a no-op once bound. A rebind is recorded as event run-rebound when a ledger handle is given.
const latestKernelJobOf = (db, workflowId) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY updated_at DESC LIMIT 1`).get(workflowId);
const bindRunToKernel = ({ db, ledger = null, workflowId, runId, by }, { bind = bindWorkflowRun, kernelJob = latestKernelJobOf(db, workflowId) } = {}) => {
  const kernelHandle = kernelJob?.worker_id ?? null;
  if (!runId || !kernelHandle) return { ok: false, action: 'failed', kernelHandle, error: 'no run or no kernel terminal' };
  const bound = bind({ runId, kernelHandle });
  if (bound.ok && bound.action === 'rebound' && ledger) {
    ledger.transaction(() => ledger.appendEvent({
      workflowId, entityType: 'job', entityId: kernelJob.job_id,
      kind: 'run-rebound', payload: { runId, kernelTerminal: kernelHandle, previousCoordinator: bound.previousCoordinator, by },
    }));
  }
  return { ...bound, kernelHandle };
};
// The terminal a dispatch created, recorded on the leased job before the launch waits on it
// (payload.launchTerminal): a dispatch killed mid-spawn leaves a terminal that settle and
// reconcile --dead-worker can still quit and close.
const recordLaunchTerminal = (ledger, jobId, handle) => ledger.transaction(() => {
  const row = ledger.db.prepare("SELECT payload_json FROM jobs WHERE job_id=? AND status='leased'").get(jobId);
  if (!row) return;
  updateJob(ledger.db, { jobId, payload: { ...jobPayloadOf(row), launchTerminal: { handle, at: Date.now() } } });
});
function ensureWorkflowRun(ledger, { job, jobId, payload }, { bind = bindWorkflowRun } = {}) {
  const db = ledger.db;
  const kernelJob = latestKernelJobOf(db, job.workflow_id);
  const kernelPayload = jobPayloadOf(kernelJob);
  const kernelHandle = kernelJob?.worker_id ?? null;
  let runId = kernelPayload?.orca?.runId ?? payload?.orca?.runId ?? null;
  // A durable Run is reused only while Orca names the current Kernel terminal
  // as its coordinator: a restarted Kernel re-binds it once (run-use), and a
  // Run Orca lost is replaced by a new one (orca-runs.mjs bindWorkflowRun).
  let replacedRunId = null;
  if (runId && kernelHandle) {
    const bound = bindRunToKernel({ db, ledger, workflowId: job.workflow_id, runId, by: jobId }, { bind, kernelJob });
    if (bound.ok) {
      return { ok: true, runId, kernelJob, kernelPayload, kernelHandle, bound: bound.action };
    }
    if (bound.action !== 'missing') return { ok: false, error: bound.error ?? `run ${runId} could not be bound to ${kernelHandle}`, kernelJob, kernelPayload };
    replacedRunId = runId;
    runId = null;
  }
  if (runId) return { ok: true, runId, kernelJob, kernelPayload, kernelHandle };

  const wf = getWorkflow(db, job.workflow_id);
  const objective = `[Workflow] ${workflowDisplayName(wf) ?? job.workflow_id} — ${job.workflow_id}`;
  const created = runCreate({ objective, from: kernelHandle });
  if (!created?.ok || !created.runId) {
    return { ok: false, error: created?.error ?? 'run-create returned no runId', kernelJob, kernelPayload };
  }
  runId = created.runId;
  ledger.transaction(() => {
    const now = Date.now();
    if (kernelJob) {
      kernelPayload.orca = { ...(kernelPayload.orca ?? {}), runId,
        ...(replacedRunId ? { previousRunIds: [...new Set([...(kernelPayload.orca?.previousRunIds ?? []), replacedRunId])] } : {}) };
      kernelPayload.hierarchy = kernelPayload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: kernelNodeId(job.workflow_id),
        parentNodeId: workflowNodeId(job.workflow_id), role: 'kernel',
        workflowId: job.workflow_id, jobId: kernelJob.job_id,
        attempt: tryOf(kernelJob), generation: kernelJob.generation,
      };
      kernelPayload.hierarchy.runtime = { ...(kernelPayload.hierarchy.runtime ?? {}), host: 'orca', runId };
      updateJob(db, { jobId: kernelJob.job_id, payload: kernelPayload, at: now });
    } else {
      payload.orca = { ...(payload.orca ?? {}), runId };
      payload.hierarchy = payload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
        workflowId: job.workflow_id, jobId, opId: job.op_id,
        attempt: tryOf(job), generation: job.generation,
      };
      payload.hierarchy.runtime = { ...(payload.hierarchy.runtime ?? {}), host: 'orca', runId };
      updateJob(db, { jobId, payload, at: now });
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'run-created', payload: { runId, kernelTerminal: kernelJob?.worker_id ?? null, storedOn: kernelJob ? kernelJob.job_id : jobId, ...(replacedRunId ? { replacedRunId } : {}) },
    });
  });
  return { ok: true, runId, kernelJob, kernelPayload, kernelHandle: kernelJob?.worker_id ?? null };
}

// Every operation Task is created in the workflow's Run - the Run the Kernel worker bound as its own coordinator,
// Orca's sub-dispatch shape (run-create, task-create, worker-start --task) - issued `from` the CURRENT kernel terminal.
// It takes no `--parent`: Orca requires a parent to be a Task of the same Run, and the Kernel's own Task lives in its
// entry Run; the Run's coordinator places the op under the Kernel (smoke 2026-10-01, launch.report.md).
// A packet longer than the host's argv takes is written to the job's evidence directory and the
// spec points at it (task-spec.mjs; inc-826e077777de: 993 owned_paths hit ENAMETOOLONG at spawn).
const createOperationTask = ({ runId, prompt, op, title, attempt, kernelHandle, jobId = null, packetFile = null }) =>
  taskCreate({
    run: runId,
    spec: taskSpecOf({ prompt, file: packetFile, op, jobId, attempt }).spec,
    taskTitle: `${op} #${attempt}`,
    displayName: title,
    from: kernelHandle,
  });

// Orca can report worker-start as effect_unknown when prompt injection stalls,
// even though the exact worker process has already exited.  A retained
// terminal with reason=identity_unproven is then bookkeeping, not a live
// process.  This is the narrow proof accepted by calls.yaml: exact worker,
// failed before model input, process gone, and release either completed or
// retained only because there is no remaining process identity to release.
const managedNoEffectProof = ({ shown, release }) => {
  const result = shown?.result ?? {};
  const observation = result.observation ?? {};
  const terminal = result.terminal ?? observation.terminal ?? result.worker?.terminal ?? {};
  const workerStage = result.worker?.stage ?? result.stage ?? null;
  const lastFailure = result.dispatch?.last_failure ?? shown?.dispatch?.last_failure ?? null;
  const exactExited = observation.exactWorker === true && (
    observation.status === 'exited'
    || (terminal.connected === false && terminal.writable === false)
  );
  const releaseSettled = release?.ok === true || (
    release?.state === 'retained' && release?.result?.reason === 'identity_unproven'
  );
  return shown?.ok === true
    && shown?.state === 'failed'
    && workerStage === 'dispatch_input'
    && lastFailure === 'agent_prompt_stalled'
    && exactExited
    && releaseSettled;
};

const cleanupManagedWorker = (dispatchId) => {
  if (!dispatchId) return { effectState: 'partial', stop: null, release: null, observation: null };
  let stop = null, release = null, observation = null;
  try { stop = workerStop({ dispatch: dispatchId }); }
  catch (e) { stop = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
  try { release = workerRelease({ dispatch: dispatchId }); }
  catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
  try { observation = workerShow({ dispatch: dispatchId }); }
  catch (e) { observation = { ok: false, error: String(e?.message ?? e) }; }
  const provenNoEffect = managedNoEffectProof({ shown: observation, release });
  const effectState = provenNoEffect || (stop?.ok && release?.ok)
    ? 'none'
    : ([stop?.effectState, release?.effectState].includes('unknown') ? 'unknown' : 'partial');
  return { effectState, stop, release, observation, provenNoEffect };
};

// Managed-agent dispatch: run → task → worker-start → worker-show attestation.
// worker-start owns Task injection; issuing orchestration dispatch again would
// double-dispatch the Task and is a typed runtime rejection. Any step's failure takes the same dispatch-rejected
// path as a dead terminal spawn (job failed + event + infra-provider incident
// on attestation failures) — after stopping and releasing whatever partial
// Dispatch the attempt created, per calls.yaml settle-dispatch.


/* ----------------------------------------------------------- reconcile */
// `reconcile --drop --reason <text>`: retire a QUEUED job that never crossed
// the dispatch boundary. A StarCi Next Kernel held two cut ordinals behind a
// failed seam whose grants broke the Work layout; the api had no way to drop
// them, so the cut could not be re-planned and the workflow sat still. The row
// settles `cancelled` with the reason, and every queued job that waits on it
// is named so the Kernel re-points or drops those too.
// `reconcile --job <id> --reap`: a settled op whose terminal is still live -
// settled before settle closed tabs and stopped leftover processes - is the
// Kernel's to clean, not the supervisor's. Closes the terminal with its tab,
// then stops the agent process when the close did not (reapIfStillLive).
function reconcileReap(ledger, args, job) {
  const db = ledger.db, jobId = job.job_id;
  if (!FINAL_SETTLED.includes(job.status)) {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --reap cleans only a settled job's leftover terminal`), { code: 'reap-not-settled' });
  }
  const payload = jobPayloadOf(job);
  const handle = payload.managed?.agentTerminalHandle ?? payload.orca?.agentTerminalHandle ?? payload.hierarchy?.runtime?.terminalHandle
    ?? (String(job.worker_id ?? '').startsWith('term_') ? job.worker_id : null);
  if (!handle) throw Object.assign(new Error(`job ${jobId} names no op terminal`), { code: 'reap-no-terminal' });
  let before = null;
  try { before = terminalShow({ terminal: handle }); } catch { /* unreadable reads as not live */ }
  if (!before?.ok || before.connected !== true) {
    const out = { ok: true, jobId, handle, live: false };
    emit(out, `reap ${jobId}: terminal ${handle} is not live; nothing to clean`, args.json);
    return;
  }
  const closed = closeOperationTerminal(handle);
  const reaped = reapIfStillLive(db, job, payload, handle, path.resolve(args.repo ?? process.cwd()));
  let after = null;
  try { after = terminalShow({ terminal: handle }); } catch { /* reported as unknown */ }
  const result = { handle, closed: closed.ok === true, ...(closed.tab ? { tab: closed.tab } : {}), ...(reaped ? { reaped } : {}), connected: after?.ok ? after.connected === true : null };
  ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'terminal-reaped', payload: result });
  const out = { ok: true, jobId, live: true, ...result };
  emit(out, `reap ${jobId}: terminal ${handle} closed=${result.closed}${reaped ? ` reaped=${reaped.reaped}${reaped.pid ? ` pid ${reaped.pid}` : ''}` : ''} connected=${result.connected}`, args.json);
}

function reconcileDrop(ledger, args, job) {
  const db = ledger.db, jobId = job.job_id;
  if (job.status !== 'queued') {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --drop retires only a queued job that was never dispatched`), { code: 'drop-not-queued' });
  }
  const reason = String(args.reason ?? '').trim();
  if (!reason) throw Object.assign(new Error('--drop needs --reason <text>: a dropped job keeps why it was retired'), { code: 'drop-needs-reason' });
  const payload = jobPayloadOf(job);
  const evidence = dispatchEvidenceOf(db, job, payload);
  if (evidence.length) {
    throw Object.assign(new Error(`job ${jobId} was dispatched (${evidence.join(', ')}); a dispatched attempt settles through settle, never --drop`), { code: 'drop-dispatched', evidence });
  }
  // Siblings wait on this job as a seam only while it is the seam's live head.
  const isSeamHead = Boolean(payload.cut && Number(payload.cut.ordinal) === 1
    && cutSeamHeadOf(db, { workflowId: job.workflow_id, op: job.op_id, cutId: payload.cut.id })?.job_id === jobId);
  const waiting = db.prepare("SELECT job_id,op_id,payload_json FROM jobs WHERE workflow_id=? AND status='queued' AND job_id<>?").all(job.workflow_id, jobId)
    .filter((row) => {
      const p = jobPayloadOf(row);
      const seamOf = isSeamHead && p.cut && String(p.cut.id) === String(payload.cut.id) && Number(p.cut.ordinal) > 1;
      return (Array.isArray(p.after) && p.after.includes(jobId)) || seamOf;
    }).map((row) => row.job_id);
  ledger.transaction(() => {
    const now = Date.now();
    setJobStatus(db, { jobId, to: 'cancelled', reason: `dropped: ${reason}`, expect: 'queued', at: now });
    recordJobResult(db, { jobId, result: { verdict: 'dropped', reason, at: now }, at: now });
    const unit = job.unit_id ? getUnit(db, job.workflow_id, job.unit_id) : null;
    if (unit?.current_job_id === jobId) setUnitState(db, { workflowId: job.workflow_id, unitId: job.unit_id, to: 'dropped', reason: `${jobId} dropped: ${reason}`, at: now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'job-dropped', payload: { op: job.op_id, attempt: tryOf(job), reason, cut: payload.cut ?? null, waiting },
    });
  });
  const out = { ok: true, jobId, dropped: true, status: 'cancelled', reason, waiting };
  emit(out, `dropped ${jobId} (cancelled: ${reason})${waiting.length ? `; still waiting on it: ${waiting.join(', ')}` : ''}`, args.json);
}

// `reconcile --job <id> --dead-worker`: saga recovery of a RUNNING job whose
// exact worker terminal is gone (status frontier 'worker-dead'). A host
// shutdown kills every Orca terminal; the ledger still says running, and no
// worker will ever file the report. Three routes, decided from the ledger and
// git only - never from a screen:
//   report filed      -> nothing is written; the ordinary consume/check/settle
//                        route owns it (route:'settle').
//   provably no effect -> the SAME job and attempt return to queued: leases
//                        released, stale worker/terminal bindings cleared, one
//                        'dead-worker-requeued' event. An infrastructure retry
//                        that spends no business attempt, like the
//                        effect_unknown no-effect rule above it.
//   anything else     -> fenced effect_unknown with the evidence; leases stay
//                        held and the Kernel inspects and settles it.
// No effect means: no report, no checks row, no worker question, an op whose
// manifest declares no effect outside its owned paths, and not one uncommitted
// change or commit (any ref, since the dispatch contract) under the owned
// paths. An unreadable tree is evidence, never proof. The same attempt is
// requeued at most DEAD_WORKER_REQUEUE_LIMIT times; a worker that keeps dying
// is fenced for the Kernel's business verdict.
const DEAD_WORKER_REQUEUE_LIMIT = 3;
// modules/ops/ops/<op>.yaml route.riskHints whose effects live outside the
// owned paths, where git cannot prove their absence.
const UNPROVABLE_EFFECT_HINTS = ['external-effects', 'runtime-effects', 'live-provider', 'destructive-gate'];
const opRiskHints = (op) => {
  try {
    const hints = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'))?.route?.riskHints;
    return Array.isArray(hints) ? hints.map(String) : [];
  } catch { return null; }
};
const EVIDENCE_CAP = 40;
// The dead worker's terminal is not left open behind the recovery: an agent
// that exited leaves its host shell (a stray PowerShell tab per dead op), and
// a requeue clears the bindings settle would have closed it by. It is closed
// with its tab only on fresh proof that it is a bare shell or disconnected
// (close-op-terminal.mjs closeExitedTerminal); an agent screen or an Orca that
// does not answer leaves it open. A close attempt is recorded on the job as
// 'dead-worker-terminal-closed'. Returns the close result, or null.
// A quiet or wedged worker's agent is still alive at or behind its prompt: it quits itself first
// (quit-agent.mjs), then its terminal is closed with its tab.
// A terminal Orca refuses writes to ('unwritable') takes no quit input: it is closed at once.
const closeQuietTerminal = (job, handle, liveness = 'quiet') => bestEffort(() => {
  // A gate-loop worker still shows its host dialog, where a typed quit command is not read: Esc closes the
  // dialog first (a loop menu that takes Esc as 'Keep' leaves the request halted at the prompt).
  if (liveness === 'gate-loop') { bestEffort(() => terminalSend({ terminal: handle, text: '\x1b', enter: false })); sleepSync(500); }
  const quit = liveness === 'unwritable' ? null : quitAgent({ handle, agent: agentOfJob(jobPayloadOf(job)) });
  const closed = closeOperationTerminal(handle);
  return { handle, closed: closed?.ok === true || quit?.exited === true, proof: liveness === 'unwritable' ? 'unwritable' : `${liveness}-quit`, ...(quit ? { quit } : {}),
    ...(closed?.tab ? { tab: closed.tab } : {}), ...(closed?.error ? { error: String(closed.error) } : {}) };
}) ?? null;
const closeDeadWorkerTerminal = (ledger, job, handle, { liveness = null, errorCode = null } = {}) => {
  if (!handle) return null;
  // A repeat after the close landed is a no-op, not a second close event.
  const done = ledger.db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='dead-worker-terminal-closed'").all(job.job_id)
    .map((row) => parseJson(row.payload_json, {}) ?? {}).find((p) => p.attempt === tryOf(job) && p.handle === handle && p.closed === true);
  if (done) return { handle, closed: true, proof: done.proof ?? null, alreadyClosed: true };
  const mode = errorCode === TERMINAL_NOT_WRITABLE ? 'unwritable' : liveness;
  const closed = ['quiet', 'wedged', 'gate-loop', 'unwritable', 'launch-abandoned'].includes(mode) ? closeQuietTerminal(job, handle, mode) : (bestEffort(() => closeExitedTerminal(handle)) ?? null);
  if (closed?.proof && closed.proof !== 'gone') {
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'dead-worker-terminal-closed',
      payload: { opId: jobOpOf(job), attempt: tryOf(job), ...closed } });
  }
  return closed;
};
const closedNote = (closed) => !closed ? ''
  : closed.closed ? `; terminal ${closed.handle} closed (${closed.proof}${closed.shellPrompt ? ` '${closed.shellPrompt}'` : ''})`
  : closed.proof === 'gone' ? '' : `; terminal ${closed.handle} left open (${closed.reason ?? closed.error ?? 'close refused'})`;
// A worker terminal a responding Orca calls gone (TERMINAL_GONE_CODES) died with its host when the
// workflow's Kernel terminal went the same way: the Kernel seat still names a gone terminal, or the seat
// was cleared for a gone terminal (kernel-stale-cleared) since this attempt's dispatch. That is an Orca
// restart or host reboot wiping every terminal, not the provider or the op: on 2026-09-26 (09:55, 11:30,
// 17:04 +07) three such wipes killed every Kernel and worker, and each worker with partial effects spent
// a business attempt, demoted its pool and fed a worker-died-no-report pattern (inc-ceb153dfd2cf,
// inc-65666fb85763). Returns {cause:'host-terminal-wipe', errorCode, kernelTerminal, proof} or null.
const HOST_TERMINAL_WIPE = 'host-terminal-wipe';
// A host-wide DISCONNECT is the same event seen from a responding Orca: 2026-09-27 13:20-13:30Z every
// Kernel terminal of both ledgers was cleared 'terminal disconnected' within ten minutes, and the five
// workers alive then (nivo app-auth uat.verify a3, collab backend.implement a9, agentos interface.draw
// a3; starci-next learn-content and foundation backend.implement a2) settled failed-no-report as the
// op's own deaths - a business attempt spent, their pools demoted, feeding the pattern incident. A
// worker disconnected or gone while Kernel terminals of HOST_EVENT_MIN_WORKFLOWS workflows of this
// ledger were cleared for a gone or disconnected terminal inside HOST_EVENT_WINDOW_MS before now is
// that host event, not the op (scripts/kernel/host-event.mjs). A launch that never produced a worker
// (launch-abandoned: a lease past its deadline with no terminal) cannot have run the op: the launcher's
// failure, never a business attempt (inc-b8e1ee7619ca).
const LAUNCH_ABANDONED = 'launch-abandoned';
const hostTerminalWipeOf = (db, job, worker, sinceMs) => {
  if (worker?.liveness === LAUNCH_ABANDONED) return { cause: LAUNCH_ABANDONED, errorCode: null, kernelTerminal: null, proof: 'no-worker-launched' };
  // H14: EVERY death without a report is checked against the host-event window, whatever the worker's liveness
  // read (gone, disconnected, wedged, quiet): a host wipe is never the op's business failure.
  const wide = hostWideDisconnectOf(db);
  if (wide) return { cause: HOST_TERMINAL_WIPE, errorCode: worker?.errorCode ?? null, kernelTerminal: null, proof: 'host-wide-disconnect', workflows: wide };
  const clearedSince = () => db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-cleared' AND created_at>=? ORDER BY seq DESC")
    .all(job.workflow_id, Number(sinceMs) || 0).map((row) => parseJson(row.payload_json, {}) ?? {}).find((p) => TERMINAL_GONE_CODES.has(p.reason));
  if (worker?.liveness !== 'gone' || !TERMINAL_GONE_CODES.has(worker.errorCode)) {
    const cleared = clearedSince();
    return cleared ? { cause: HOST_TERMINAL_WIPE, errorCode: worker?.errorCode ?? null, kernelTerminal: cleared.terminal ?? null, proof: 'kernel-stale-cleared' } : null;
  }
  const seat = kernelSeatOf(db, job.workflow_id);
  if (seat?.terminal && seat.terminal !== worker.terminalHandle) {
    const shown = bestEffort(() => terminalShow({ terminal: seat.terminal }));
    if (shown && !shown.ok && !shown.hostUnavailable && TERMINAL_GONE_CODES.has(shown.errorCode)) {
      return { cause: HOST_TERMINAL_WIPE, errorCode: worker.errorCode, kernelTerminal: seat.terminal, proof: 'kernel-terminal-gone' };
    }
  }
  const cleared = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-stale-cleared' AND created_at>=? ORDER BY seq DESC")
    .all(job.workflow_id, Number(sinceMs) || 0).map((row) => parseJson(row.payload_json, {}) ?? {})
    .find((p) => TERMINAL_GONE_CODES.has(p.reason));
  return cleared ? { cause: HOST_TERMINAL_WIPE, errorCode: worker.errorCode, kernelTerminal: cleared.terminal ?? null, proof: 'kernel-stale-cleared' } : null;
};
function reconcileDeadWorker(ledger, args, job, repo) {
  const db = ledger.db, jobId = job.job_id, op = jobOpOf(job), payload = jobPayloadOf(job);
  const prior = jobResult(db, jobId) ?? {};
  // A job recovered before its shell was closed: the recorded dead terminal of this attempt.
  const recordedDeadTerminal = () => [...(Array.isArray(payload.deadWorkers) ? payload.deadWorkers : [])]
    .reverse().find((entry) => entry?.attempt === tryOf(job) && entry?.terminal)?.terminal ?? null;
  if (job.status === 'queued' && prior.reason === 'dead-worker-requeued') {
    const terminalClosed = closeDeadWorkerTerminal(ledger, job, recordedDeadTerminal());
    const out = { ok: true, jobId, recovery: 'requeued', alreadyRecovered: true, status: 'queued', attempt: tryOf(job), ...(terminalClosed ? { terminalClosed } : {}) };
    emit(out, `reconcile ${jobId}: dead worker already requeued (attempt ${tryOf(job)})${closedNote(terminalClosed)}`, args.json);
    return;
  }
  if (job.status === 'effect_unknown' && prior.reason === 'dead-worker-fenced') {
    // A fence whose evidence the owned paths bound settles failed-no-report and retries, like a fresh recovery.
    if (args['settle-failed'] && settleableEvidence(prior.evidence)) {
      return settleFailedNoReport(ledger, job, { workerProof: prior.worker ?? null, evidence: prior.evidence ?? [], dispatchId: prior.dispatchId ?? null, pathProof: prior.paths ?? null, repo, args });
    }
    const terminalClosed = closeDeadWorkerTerminal(ledger, job, recordedDeadTerminal());
    const out = { ok: true, jobId, recovery: 'fenced', alreadyRecovered: true, status: 'effect_unknown', attempt: tryOf(job), evidence: prior.evidence ?? [], ...(terminalClosed ? { terminalClosed } : {}) };
    emit(out, `reconcile ${jobId}: dead worker already fenced effect_unknown (${(prior.evidence ?? []).join(', ')}); inspect and api settle it${closedNote(terminalClosed)}`, args.json);
    return;
  }
  // Already settled failed-no-report (by the watchdog, or a repeat): the receipt names its retry.
  if (job.status === 'failed' && prior.reason === FAILED_NO_REPORT) {
    const retry = db.prepare('SELECT job_id,try_no AS attempt,status FROM jobs WHERE workflow_id=? AND retry_of=?').get(job.workflow_id, jobId) ?? null;
    const out = { ok: true, jobId, recovery: 'settled-failed', alreadyRecovered: true, status: 'failed', attempt: tryOf(job),
      retry: retry ? { jobId: retry.job_id, attempt: retry.attempt, status: retry.status } : null };
    emit(out, `reconcile ${jobId}: dead worker already settled failed-no-report${retry ? `; retry ${retry.job_id} (attempt ${retry.attempt}) is ${retry.status}` : ''}`, args.json);
    return;
  }
  if (!['running', 'answering', 'leased'].includes(job.status)) {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --dead-worker recovers only a running, answering or leased job`), { code: 'dead-worker-not-running' });
  }
  const worker = observeOperationWorker(job, Date.now(), db);
  if (worker.liveness === 'launching') {
    const out = { ok: false, jobId, recovery: null, reason: 'dispatch-in-flight', worker };
    emit(out, `reconcile REFUSED for ${jobId}: dispatch-in-flight (leased with no worker until its lease deadline ${new Date(worker.leaseDeadline ?? 0).toISOString()}); nothing written`, args.json);
    process.exit(1);
  }
  // A wedged worker is dead to its contract - the turn can never file the report - but only the
  // settle-failed route accepts it: a plain --dead-worker requeue spends nothing for an attempt
  // whose 30+ minute turn may hold effects the owned paths cannot bound (inc-2c1ac4ff3e48).
  // A gate-loop worker (a host dialog back after maxPerAttempt answers) recovers the same way.
  const wedged = worker.liveness === 'wedged' || worker.liveness === 'gate-loop';
  if (!DEAD_WORKER_LIVENESS.includes(worker.liveness) && !(wedged && args['settle-failed'])) {
    const reason = worker.liveness === 'unknown' ? 'worker-liveness-unproven' : worker.liveness === 'gate-loop' ? 'worker-gate-loop' : wedged ? 'worker-wedged' : 'worker-alive';
    const out = { ok: false, jobId, recovery: null, reason, worker };
    emit(out, `reconcile REFUSED for ${jobId}: ${reason} (liveness ${worker.liveness}${worker.reason ? `: ${worker.reason}` : ''}); nothing written${wedged ? ` - a wedged worker recovers only through api reconcile --job ${jobId} --dead-worker --settle-failed` : ''}`, args.json);
    process.exit(1);
  }
  const contract = latestContractOf(db, jobId);
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId
    ?? contract?.dispatch_id ?? job.worker_id ?? null;
  const report = db.prepare(`SELECT dispatch_id,outcome,consumed_at FROM reports WHERE workflow_id=?
      AND (dispatch_id=? OR attempt_id=(SELECT max(attempt_id) FROM op_attempts WHERE job_id=?)) ORDER BY created_at DESC LIMIT 1`)
    .get(job.workflow_id, reportDispatchIdOf(db, job), jobId);
  if (report) {
    const next = report.consumed_at ? 'api check, then api settle' : 'api consume-report, api check, then api settle';
    const out = { ok: true, jobId, recovery: 'settle', route: 'settle', worker,
      report: { dispatchId: report.dispatch_id, outcome: report.outcome, consumed: Boolean(report.consumed_at) }, next };
    emit(out, `reconcile ${jobId}: the dead worker filed report ${report.dispatch_id} (${report.outcome}); nothing written - ${next}`, args.json);
    return;
  }
  // A report the worker wrote but never filed is filed on its behalf through api report itself, so every
  // report guard still applies (scripts/kernel/report-salvage.mjs); the Kernel then checks and settles it.
  if (!args['no-salvage']) {
    const salvage = bestEffort(() => {
      const roots = jobPlacements(db, job, repo).filter((p) => !p.unresolved).map((p) => path.resolve(p.base, String(p.path).replace(/[\\/]\*\*[\\/]?$/, '') || '.'));
      const candidates = unfiledReportCandidates({ roots, sinceMs: contract?.created_at ?? job.created_at, jobId, dispatchId: reportDispatchIdOf(db, job) });
      return salvageUnfiledReport({ candidates, fileReport: (file) => {
        const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'report', '--repo', repo, '--job', jobId, '--report', file, '--json'],
          { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
        return { ok: r.status === 0, error: (r.stderr || r.stdout || '').trim().split(/\r?\n/).pop() };
      } });
    });
    if (salvage?.salvaged) {
      ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'report-salvaged',
        payload: { opId: op, attempt: tryOf(job), file: salvage.salvaged.file, outcome: salvage.salvaged.outcome, liveness: worker.liveness, tried: salvage.tried.length } });
      const out = { ok: true, jobId, recovery: 'settle', route: 'settle', worker, salvaged: salvage.salvaged, tried: salvage.tried, next: 'api consume-report, api check, then api settle' };
      emit(out, `reconcile ${jobId}: the dead worker wrote report ${salvage.salvaged.file} (${salvage.salvaged.outcome}) but never filed it; filed on its behalf - api consume-report, api check, then api settle`, args.json);
      return;
    }
  }

  const evidence = [];
  if (independentChecksOf(db, { jobId })) evidence.push('checks');
  const asked = db.prepare("SELECT key FROM inbox WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.jobId')=?")
    .all(job.workflow_id, WORKER_QUESTION, jobId);
  for (const row of asked) evidence.push(`worker-question:${row.key}`);
  const hints = opRiskHints(op);
  if (hints == null) evidence.push('op-manifest-unreadable');
  else for (const hint of hints) if (UNPROVABLE_EFFECT_HINTS.includes(hint)) evidence.push(`risk:${hint}`);
  let paths;
  try {
    paths = ownedPathEffects({ base: repo, ownedPaths: ownedPathsOf(payload), placements: jobPlacements(db, job, repo),
      sinceMs: contract?.created_at ?? job.created_at });
  } catch (error) { paths = { provable: false, why: 'placement', error: String(error?.message ?? error) }; }
  if (!paths.provable) evidence.push(`owned-paths-unverifiable:${paths.why}`);
  else {
    for (const file of paths.dirty) evidence.push(`dirty:${file}`);
    for (const sha of paths.commits) evidence.push(`commit:${sha}`);
  }
  const effectEvidence = evidence.length > 0;
  const priorDeaths = (payload.deadWorkers ?? []).filter((entry) => entry?.attempt === tryOf(job) && entry?.recovery === 'requeued').length;
  if (priorDeaths >= DEAD_WORKER_REQUEUE_LIMIT) evidence.push(`infra-retries-exhausted:${priorDeaths}`);
  const recovery = evidence.length ? 'fenced' : 'requeued';
  const recorded = evidence.length > EVIDENCE_CAP ? [...evidence.slice(0, EVIDENCE_CAP), `+${evidence.length - EVIDENCE_CAP} more`] : evidence;
  const hostWipe = hostTerminalWipeOf(db, job, worker, contract?.created_at ?? job.created_at);
  const workerProof = { terminal: worker.terminalHandle ?? worker.launchTerminal ?? null, liveness: worker.liveness, ...(worker.errorCode ? { errorCode: worker.errorCode } : {}),
    terminalStatus: worker.terminalStatus ?? null, ...(hostWipe ? { hostWipe } : {}) };
  const pathProof = paths.provable
    ? { provable: true, since: paths.since ?? null, repos: (paths.repos ?? []).map((r) => ({ repo: r.repo, paths: r.paths, dirty: r.dirty.length, commits: r.commits.length, ...(r.preexisting ? { preexisting: r.preexisting } : {}) })) }
    : { provable: false, why: paths.why, ...(paths.error ? { error: String(paths.error).slice(0, 300) } : {}) };
  // --settle-failed (the watchdog's recovery): effect evidence the owned paths bound is what the
  // retry continues from, so the attempt settles failed-no-report and its retry is queued.
  if (args['settle-failed'] && recovery === 'fenced' && settleableEvidence(evidence)) {
    return settleFailedNoReport(ledger, job, { workerProof, evidence: recorded, dispatchId, pathProof, repo, args });
  }

  // A managed Dispatch record may outlive its terminal on a host that did not
  // restart; stop and release it before the slot is reused. Best effort and
  // recorded only: the terminal is already proven gone, and after a reboot
  // Orca no longer knows the Dispatch at all.
  let cleanup = null;
  if (recovery === 'requeued' && payload.managed?.dispatchId) {
    const stop = bestEffort(() => workerStop({ dispatch: payload.managed.dispatchId }));
    const release = bestEffort(() => workerRelease({ dispatch: payload.managed.dispatchId }));
    cleanup = { dispatchId: payload.managed.dispatchId, stop: stop?.ok === true, release: release?.ok === true };
  }

  let machineRefs = [], leasesReleased = 0, result;
  ledger.transaction(() => {
    const now = Date.now();
    const fresh = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
    if (fresh?.status !== job.status) throw Object.assign(new Error(`job ${jobId} moved to ${fresh?.status} during recovery; re-read status`), { code: 'dead-worker-raced' });
    const next = jobPayloadOf(job);
    next.deadWorkers = [...(Array.isArray(next.deadWorkers) ? next.deadWorkers : []),
      { attempt: tryOf(job), dispatchId, ...workerProof, recovery, at: now }];
    const attemptId = latestAttemptOf(db, jobId)?.attempt_id ?? null;
    if (recovery === 'requeued') {
      leasesReleased = releaseLeases(db, { jobId });
      delete next.managed;
      if (next.orca) { const { dispatchId: d, agentTerminalHandle: h, ...orca } = next.orca; next.orca = orca; }
      if (next.hierarchy?.runtime) {
        const { taskId, dispatchId: d, terminalHandle, ...runtime } = next.hierarchy.runtime;
        next.hierarchy.runtime = runtime;
      }
      result = { reason: 'dead-worker-requeued', effectState: 'none', attemptConsumed: false, retryable: true, dispatchId,
        proof: { worker: workerProof, report: false, checks: false, workerQuestions: 0, riskHints: hints, paths: pathProof,
          priorRequeues: priorDeaths, ...(cleanup ? { cleanup } : {}) }, at: now };
      // running|answering|leased -> ready -> queued (job_transitions): the same job and try, no business try spent.
      if (job.status === 'answering') setJobStatus(db, { jobId, to: 'running', reason: 'dead-worker-requeued', attemptId, at: now });
      setJobStatus(db, { jobId, to: 'ready', reason: 'dead-worker-requeued', attemptId, at: now });
      setJobStatus(db, { jobId, to: 'queued', reason: 'dead-worker-requeued', attemptId, at: now,
        payload: next, workerId: null, leaseToken: null, deadline: null });
      recordJobResult(db, { jobId, result, at: now });
      if (attemptId != null) updateAttempt(db, { attemptId, at: now, endState: 'requeued', effectState: 'none' });
      recordWhy(db, attemptId, { at: now });
    } else {
      result = { reason: 'dead-worker-fenced', effectState: effectEvidence ? 'partial' : 'unknown', attemptConsumed: false, retryable: false,
        dispatchId, evidence: recorded, worker: workerProof, paths: pathProof, at: now };
      if (job.status === 'answering') setJobStatus(db, { jobId, to: 'running', reason: 'dead-worker-fenced', attemptId, at: now });
      if (job.status === 'leased') setJobStatus(db, { jobId, to: 'running', reason: 'dead-worker-fenced', attemptId, at: now });
      setJobStatus(db, { jobId, to: 'effect_unknown', reason: 'dead-worker-fenced', attemptId, at: now, payload: next });
      recordJobResult(db, { jobId, result, at: now });
      if (attemptId != null) updateAttempt(db, { attemptId, at: now, endState: 'effect-unknown', effectState: result.effectState });
      recordWhy(db, attemptId, { at: now });
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: recovery === 'requeued' ? 'dead-worker-requeued' : 'dead-worker-fenced',
      payload: { opId: op, attempt: tryOf(job), dispatchId, worker: workerProof, attemptConsumed: false,
        ...(recovery === 'requeued' ? { leasesReleased, machineRefs } : { evidence: recorded, effectState: result.effectState }) },
    });
  });
  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  // After the recovery is written: the dead worker's shell is closed, never before.
  const terminalClosed = closeDeadWorkerTerminal(ledger, job, workerProof.terminal, { liveness: worker.liveness, errorCode: worker.errorCode });
  const out = recovery === 'requeued'
    ? { ok: true, jobId, recovery, status: 'queued', attempt: tryOf(job), attemptConsumed: false, effectState: 'none', dispatchId,
      leasesReleased, machineRefsReleased, worker, proof: result.proof, ...(terminalClosed ? { terminalClosed } : {}) }
    : { ok: true, jobId, recovery, status: 'effect_unknown', attempt: tryOf(job), effectState: result.effectState, dispatchId,
      evidence: recorded, worker, paths: pathProof, ...(terminalClosed ? { terminalClosed } : {}) };
  emit(out, recovery === 'requeued'
    ? `reconciled ${jobId}: worker ${worker.terminalHandle} is ${worker.liveness} and the attempt proved no effect; same attempt ${tryOf(job)} queued (leases released: ${leasesReleased}) - route and dispatch it again${closedNote(terminalClosed)}`
    : `reconciled ${jobId}: worker ${worker.terminalHandle} is ${worker.liveness}; fenced effect_unknown on ${recorded.join(', ')} - inspect the evidence and api settle it (fail or blocked), then retry as a new attempt${closedNote(terminalClosed)}`, args.json);
}

// `reconcile --job <id> --dead-worker --settle-failed`: a dead worker's attempt settled with no
// human. The watchdog runs it under --repair for every frontier deadWorkerJobs entry: a worker
// whose agent exited to a bare shell, whose terminal disconnected or vanished, or that stayed quiet
// past its provider's timeout after a nudge will never file its report, and before this each one
// became a hand-written incident and four manual steps for the Kernel (inc-305adcb1d3c1,
// inc-e6e2e0d274a9, inc-c6cf249ecd5a, inc-2ce87e0e7703 and 25 more on 2026-09-23). Effect evidence
// the owned paths bound (dirty files, commits, a checks row, a worker question, exhausted
// infrastructure requeues) is what a retry continues from, so the attempt settles failed (reason
// failed-no-report, reportFiled false: a business attempt spent, engine/admission.mjs
// retryDisposition), its leases, managed worker, terminal and Orca Task are released, and the
// no-report route of modules/models/kinds.yaml runs (enqueueNextStep): ONE retry of the same op and
// cut ordinal as attempt+1, which api route moves off the pools its lineage died on
// (lineage-route.mjs), and past the route's limit an owner gate on the job instead. Evidence the owned paths cannot bound (an op's external,
// runtime, live-provider or destructive risk hint, an unverifiable tree) stays fenced for the
// Kernel. Once one op of a workflow has ended failed-no-report DEAD_WORKER_PATTERN_THRESHOLD
// times, one open incident names the pattern for the runtime supervisor, raised once while open.
const FAILED_NO_REPORT = 'failed-no-report';
const DEAD_WORKER_PATTERN_THRESHOLD = 3;
const DEAD_WORKER_PATTERN_TAG = '[worker-died-no-report-pattern]';
const SETTLEABLE_EVIDENCE = /^(?:dirty:|commit:|checks$|worker-question:|infra-retries-exhausted:|\+\d+ more$)/;
const settleableEvidence = (evidence) => Array.isArray(evidence) && evidence.every((item) => SETTLEABLE_EVIDENCE.test(String(item)));
// A follow-on job the runtime enqueues itself: `template`'s op (or `op`), records, owned paths and cut
// ordinal as a new attempt, exactly as `api enqueue` builds it, marked retryReason.auto. `retryOf`
// pins the predecessor and makes it idempotent: a job already naming it as retry.retryOf is returned
// instead. Runs inside the caller's transaction.
// `repair` {records, ownedPaths, repository, params} enqueues a FRESH job of `op` for the owner a failed
// verify named (verify-failure.mjs resolveRootOwner) when the workflow has no job of that op to reopen.
const enqueueFollowOn = (ledger, template, { op = jobOpOf(template), retryOf = null, after = null, reason, of, liveness = null, routed = null, rootVerify = null, ownedPaths = null, params = null, title = null, repair = null }) => {
  const db = ledger.db, workflowId = template.workflow_id, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf || wf.phase === 'finished' || wf.archived_at) return { enqueued: false, reason: `workflow ${wf ? (wf.archived_at ? 'archived' : wf.phase) : 'unknown'}` };
  const source = jobPayloadOf(template);
  const fresh = Boolean(rootVerify || repair);
  const payload = rootVerify ? { records: source.records ?? [], owned_paths: ownedPaths, ...(params ? { params } : {}) }
    : repair ? { records: repair.records ?? [], owned_paths: repair.ownedPaths ?? [], ...(repair.repository ? { repository: repair.repository } : {}), ...(repair.params ? { params: repair.params } : {}) }
      : source;
  const cut = fresh ? null : payload.cut ?? null;
  // The try is admitted on the unit's gate like every enqueue (scripts/kernel/units.mjs): a route re-runs the unit's
  // latest try - a passed one only through a reopen that names the route as its reason - and never past its budget.
  // A fresh repair or root verify over a failed unit of the same work continues that unit instead of starting one.
  const reopen = { reason: `${reason}: ${of ?? template.job_id}${routed?.route ? ` (route ${routed.route})` : ''}`, by: 'runtime' };
  const spec = { workflowId, op, goalRevision: latestGoal(db, workflowId)?.revision ?? null, payload: { ...payload, cut }, retryOf, resolveLatest: true, reopen: null };
  let admitted = null;
  for (let hop = 0; !admitted && hop < 3; hop += 1) {
    try { admitted = admitUnit(db, spec); }
    catch (error) {
      if (!error?.code) throw error;
      if (error.code === 'unit-in-flight') return { enqueued: false, jobId: error.open?.[0] ?? null, reason: 'retry-exists' };
      if (error.code === 'unit-already-passed' && !spec.reopen) { spec.reopen = reopen; continue; }
      if (error.code === 'unit-overlaps-failed-unit' && !spec.retryOf) { spec.retryOf = error.overlaps[0].jobId; continue; }
      return { enqueued: false, reason: error.code, detail: error.message };
    }
  }
  if (!admitted) return { enqueued: false, reason: 'unit-not-admitted' };
  const goal = latestGoal(db, workflowId);
  const jobId = `op-${op}-${newToken().slice(0, 10)}`;
  const priorAfter = !fresh && Array.isArray(payload.after) ? payload.after : [];
  const next = {
    opId: op, records: payload.records ?? [], owned_paths: payload.owned_paths ?? [], title: title ?? payload.title ?? op, risk: fresh ? null : payload.risk ?? null,
    ...((!rootVerify || repair) && payload.repository ? { repository: payload.repository } : {}),
    ...(payload.params ? { params: payload.params } : {}),
    ...(cut ? { cut } : {}),
    ...(after?.length || priorAfter.length ? { after: [...new Set([...priorAfter, ...(after ?? [])])] } : {}),
    ...(!fresh && payload.foundation ? { foundation: payload.foundation } : {}),
    ...(!fresh && payload.contractChange ? { contractChange: payload.contractChange } : {}),
    retryReason: { reason, of, liveness, auto: true },
    ...(routed ? { routed } : {}),
    ...(rootVerify ? { rootVerify } : {}),
    goal_binding: { revision: goal?.revision ?? null, identity: goal?.goal_identity ?? null },
    hierarchy: {
      schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId), parentNodeId: kernelNodeId(workflowId), role: 'operation',
      workflowId, jobId, opId: op, attempt: admitted.tryNo, generation: wf.generation ?? 0, runtime: { host: 'orca' },
    },
  };
  const unitTry = writeUnitTry(db, admitted, { workflowId, jobId, op, title: next.title, cut, repository: next.repository ?? null, at: now });
  ledger.enqueueJob({ jobId, workflowId, opId: op, ...unitTry, generation: wf.generation ?? 0, kind: 'op', role: 'op', payload: next, priority: seamPriorityOf(cut), createdAt: now });
  ledger.appendEvent({
    workflowId, entityType: 'job', entityId: jobId, kind: 'follow-on-enqueued',
    payload: { opId: op, ...unitTry, records: next.records.length, ownedPaths: next.owned_paths.length, risk: next.risk, cut, repository: next.repository ?? null, reason, ...(routed ? { route: routed.route } : {}), ...(repair ? { repairOf: of } : {}), ...(admitted.reopen ? { reopen: admitted.reopen } : {}) },
  });
  return { enqueued: true, jobId, tryNo: unitTry.tryNo, unitId: unitTry.unitId };
};

/*
 * The next step a failed attempt leaves in the ledger (driver-loop.yaml repair). The route table is
 * modules/models/kinds.yaml routes: the first route matching the settle's shape wins (an explicit
 * `from` before `any`), `to` names the op, `then` whether the reporter runs again behind it, and
 * `limit` bounds how often one route fires for one node group - the failed job's retry lineage, counted
 * from the recorded result_json.nextStep since the owner last opened that route's gate. Past it, or on a
 * needUser route, an owner-gate incident holds the failed job alone; other legs keep running.
 */
const ROOT_VERIFY_OP = 'review.verify';
let kindsCatalogCache = null;
const kindsCatalog = () => (kindsCatalogCache ??= parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'kinds.yaml'), 'utf8')));
const kindOfOp = (catalog, op) => (catalog.kinds?.[op] ? op : Object.keys(catalog.kinds ?? {}).find((kind) => catalog.kinds[kind]?.operator === op) ?? op);
const opOfKind = (catalog, kind) => catalog.kinds?.[kind]?.operator ?? kind;
/** The route-table key of a failed settle: no report, a done claim the Kernel's checks overruled, or the report outcome. */
const failureShapeOf = ({ reportFiled, reportOutcome, claimOverruled, failureClass = null, op = null }) => (!reportFiled ? { verdict: 'no-report' }
  : claimOverruled ? { outcome: reportOutcome, verdict: 'rejected' }
    : { outcome: reportOutcome ?? 'failed', ...(failureClass ? { class: failureClass } : {}),
      // A review's measured findings are the `findings` verdict the review route repairs from.
      ...(failureClass === 'findings' && op === ROOT_VERIFY_OP ? { verdict: 'findings' } : {}) });
/** The build-family ops of modules/models/kinds.yaml (a measurement leg becomes a gate once one of them settled). */
const buildOpsOf = () => [...new Set(Object.entries(kindsCatalog().kinds ?? {}).filter(([, k]) => k?.family === 'build').map(([kind]) => opOfKind(kindsCatalog(), kind)))];
/** The previous attempt of a job's retry lineage as {report, checks}, or null. */
const priorAttemptOf = (db, job) => {
  const prior = lineageJobsOf(db, job)[0];
  if (!prior) return null;
  const row = db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=?').get(prior.workflow_id, reportDispatchIdOf(db, prior));
  const checks = independentChecksOf(db, { jobId: prior.job_id });
  return { report: parseJson(row?.report_json), checks: Array.isArray(checks?.checks) ? checks.checks : null };
};
/** Why one attempt failed (scripts/kernel/verify-failure.mjs classifyFailure) - the `class` of its route shape. */
const failureClassOf = (db, job, envelope, recordedChecks) => {
  try {
    return classifyFailure({ op: jobOpOf(job), report: envelope, checks: recordedChecks, measurement: isMeasurementLeg(db, job, { buildOps: buildOpsOf() }), prior: priorAttemptOf(db, job) });
  } catch (error) { return { class: 'transient', reason: `unclassified: ${String(error?.message ?? error)}` }; }
};
/** A job of the owner's op that already works on the owner's record, else null: the one a repair reopens. */
const ownerTemplateOf = (db, job, owner) => {
  const rows = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id=? AND status<>'cancelled' ORDER BY created_at DESC, try_no DESC`).all(job.workflow_id, owner.op);
  const norm = (p) => String(typeof p === 'string' ? p : p?.path ?? '').replace(/\\/g, '/').replace(/\/\*\*$/, '').replace(/\/+$/, '');
  const want = new Set([owner.record, ...owner.ownedPaths].filter(Boolean).map(norm));
  return rows.find((row) => { const p = jobPayloadOf(row); return [...(p.records ?? []), ...(p.owned_paths ?? [])].some((x) => want.has(norm(x))); }) ?? null;
};
const failureRoutesOf = (catalog, op, shape) => {
  const kind = kindOfOp(catalog, op);
  const matches = (route) => Object.entries(route.on ?? {}).every(([key, value]) => shape[key] === value);
  const routes = (catalog.routes ?? []).filter(matches);
  return [...routes.filter((route) => route.from === kind || route.from === op), ...routes.filter((route) => route.from === 'any')];
};
/** The ops a route's `to` names for reporter `op`: [op] for `same`, the build step of the reporter's lane for `lane.build`. */
const routeTargetOps = (catalog, route, op) => {
  const to = route.to ?? {};
  if (!to.kind) return [];
  if (to.kind === 'same') return [op];
  const kind = kindOfOp(catalog, op);
  if (to.kind !== 'lane.build') return [opOfKind(catalog, to.kind)];
  if (catalog.kinds?.[kind]?.family === 'build') return [op];
  return [...new Set((catalog.lanes ?? []).filter((lane) => (lane.steps ?? []).some((step) => step.kind === kind))
    .flatMap((lane) => lane.steps.map((step) => step.kind).filter((step) => catalog.kinds?.[step]?.family === 'build'))
    .map((step) => opOfKind(catalog, step)))];
};
const workKeyOf = (payload) => ({ records: (payload.records ?? []).map((r) => (typeof r === 'string' ? r : r?.path)).filter(Boolean), ...(payload.params?.subject ? { params: { subject: payload.params.subject } } : {}) });
/** The same work of two ops: the same params.subject when either names one, else overlapping records. */
const sameWorkKey = (a, b) => {
  if (a.params?.subject || b.params?.subject) return a.params?.subject === b.params?.subject;
  const safe = (x, y) => { try { return ownedPathsIntersect(x, y); } catch { return x === y; } };
  return !a.records.length || !b.records.length || a.records.some((x) => b.records.some((y) => safe(x, y)));
};
/** The job a repair re-runs: the latest job of a target op on the reporter's records. */
const repairTemplateOf = (db, job, ops) => {
  const want = workKeyOf(jobPayloadOf(job));
  return db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND op_id IN (${ops.map(() => '?').join(',')}) ORDER BY created_at DESC, try_no DESC`)
    .all(job.workflow_id, ...ops).filter((row) => row.status !== 'cancelled')
    .find((row) => sameWorkKey(workKeyOf(jobPayloadOf(row)), want)) ?? null;
};
/**
 * The job that owns the Work record a rootCause.node names when the node is a record id rather than `<op>#...`
 * (nivo wf-nivo-app-auth-mujek72s: uat.verify named impl.login.nivo-backend.session-custody five times and the
 * route re-ran the same UAT, never the owner of that record): the newest settled job of another op of the workflow
 * whose owned .starciwork record directory holds an index.yaml with that id. Null when none does.
 */
const recordOwnerJobOf = (db, job, node, repo) => {
  const id = String(node ?? '').split('#')[0].trim();
  if (!id || !repo) return null;
  const rows = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND COALESCE(op_id,'')<>? AND status IN (${FINAL_SETTLED.map(() => '?').join(',')}) AND status<>'cancelled' ORDER BY created_at DESC`)
    .all(job.workflow_id, jobOpOf(job) ?? '', ...FINAL_SETTLED);
  for (const row of rows) {
    for (const rel of recordPathsOf(jobPayloadOf(row))) {
      try {
        const doc = parseYaml(fs.readFileSync(path.join(repo, rel.replace(/\/+$/, ''), 'index.yaml'), 'utf8'));
        if (doc?.id === id) return row;
      } catch { /* not a record directory */ }
    }
  }
  return null;
};
const routeFiringsOf = (db, job, routeId) => {
  let fired = 0;
  for (const row of lineageJobsOf(db, job)) {
    const step = (jobResult(db, row.job_id) ?? {}).nextStep;
    if (step?.route !== routeId) continue;
    if (step.kind === 'owner-gate' || step.kind === SUPERVISOR_GATE) break;
    if (step.counted !== false) fired += 1;
  }
  return fired;
};
const openRouteGate = (ledger, job, detail, route) => {
  const db = ledger.db, incidentId = `inc-${newToken().slice(0, 12)}`, op = jobOpOf(job);
  openIncident(db, { incidentId, workflowId: job.workflow_id, kind: 'owner-gate', opId: op, jobId: job.job_id, detail, lastProgress: `[owner-gate] ${detail}` });
  ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'incident', entityId: incidentId, kind: 'incident-raised',
    payload: { kind: 'owner-gate', detail, opId: op, holds: [job.job_id], auto: true, route } });
  return incidentId;
};
/** The .starciwork record directories a job owns: where a read-only verify of its node writes its evidence. */
const recordPathsOf = (payload) => (payload.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter((p) => typeof p === 'string' && /^\.starciwork\//.test(p));
/**
 * The report's own red checks, attributed like api check attributes the Kernel's (gate-attribution.mjs):
 * {peer:true, checks[], peers[], routes[]} when every red check (at least one) names files and reads
 * `peer`, and no check the Kernel recorded for this attempt read `own`; else {peer:false, reason}.
 */
function reportPeerAttribution(db, job, envelope, repo) {
  const red = (Array.isArray(envelope?.checks) ? envelope.checks : []).filter((c) => c && Number.isInteger(c.exitCode) && c.exitCode !== 0);
  if (!red.length) return { peer: false, reason: 'the report records no red check' };
  const kernel = independentChecksOf(db, { jobId: job.job_id })?.checks ?? [];
  if (kernel.some((c) => c?.attribution?.class === 'own')) return { peer: false, reason: "a Kernel check reads the red as this op's own" };
  if (!repo) return { peer: false, reason: 'no repository to attribute in' };
  const canon = leaseCanonOf(db, repo);
  const checks = [], peers = [], routes = [];
  for (const check of red) {
    const failing = Array.isArray(check.failing) && check.failing.length ? check.failing : failingFromText(check.evidence);
    if (!failing.length) return { peer: false, reason: `red check ${check.name} names no failing file` };
    let attribution;
    try { attribution = attributeRedGate(db, { repo, job, failing, canon }); } catch (error) { return { peer: false, reason: `attribution failed: ${error?.message ?? error}` }; }
    if (attribution.class !== 'peer') return { peer: false, reason: `red check ${check.name} reads ${attribution.class} (${attribution.files.map((f) => `${f.path}:${f.owner}`).join(', ')})` };
    checks.push(check.name);
    for (const peer of attribution.peers) {
      if (!peers.some((p) => p.workflowId === peer.workflowId && p.commit === peer.commit && p.jobId === peer.jobId)) peers.push(peer);
      routes.push(peerRouteOf(job.workflow_id, peer, check.name));
    }
  }
  return { peer: true, checks, peers, routes: [...new Set(routes)] };
}
/**
 * Route one failed attempt and record the step on its result_json.nextStep:
 * {kind: retry|repair|root-verify|owner-gate|none, route?, limit?, firing?, counted?, jobs?[], incidentId?, rootCause?, reason}.
 * `environment` (a host terminal wipe) fires without counting against the limit.
 */
function enqueueNextStep(ledger, job, { shape, envelope = null, environment = false, liveness = null, repo = null, failure = null }) {
  const db = ledger.db, op = jobOpOf(job), wf = getWorkflow(db, job.workflow_id);
  const record = (step) => {
    const result = jobResult(db, job.job_id) ?? {};
    recordJobResult(db, { jobId: job.job_id, result: { ...result, nextStep: step } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'failure-routed', payload: { opId: op, shape, ...step } });
    return step;
  };
  if (!wf || wf.phase === 'finished' || wf.archived_at) return record({ kind: 'none', reason: `workflow ${wf ? (wf.archived_at ? 'archived' : wf.phase) : 'unknown'}` });
  const catalog = kindsCatalog();
  const reason = shape.verdict === 'no-report' ? FAILED_NO_REPORT : 'routed';
  // H3: the unit's try budget caps every route - a unit that spent it goes to the owner/Supervisor gate, never another try.
  const unit = unitStateOf(db, job.workflow_id, job.unit_id);
  const exhausted = Boolean(unit?.exhausted) && !environment;
  for (const route of failureRoutesOf(catalog, op, shape)) {
    const limit = Number(route.limit), fired = routeFiringsOf(db, job, route.id);
    const base = { route: route.id, limit, firing: fired + 1, ...(environment ? { counted: false } : {}) };
    if (route.to?.needUser || (!environment && fired >= limit) || exhausted) {
      // Autopilot (owner ruling 2026-09-28 autopilot-run-to-finish): a spent retry cap or an environment blocker is a
      // runtime/process issue - the Supervisor's (supervisor-gate), within supervisorExtraBudget gates per node group,
      // then the leg is deferred to the final review. An authority blocker is the owner's: deferred to handover.
      const autopilot = routeCapUnderAutopilot(db, job, { lineage: lineageJobsOf(db, job), routeId: route.id });
      if (autopilot) {
        const blocker = route.on?.blocker ?? null;
        const evidence = { route: route.id, limit, fired, shape, jobId: job.job_id, attempt: tryOf(job),
          lineage: lineageJobsOf(db, job).slice(-6).map((row) => ({ jobId: row.job_id, attempt: tryOf(row), status: row.status, ...(({ verdict = null, reason = null, report = null }) => ({ verdict, reason, report }))(jobResult(db, row.job_id) ?? {}) })) };
        if (blocker === 'authority' || autopilot.kind === 'deferred') {
          const reason = blocker === 'authority'
            ? `${op} ${job.job_id}: an authority blocker (route ${route.id}) is the owner's decision - deferred to handover, independent legs proceed`
            : `${op} ${job.job_id}: route ${route.id} spent its limit ${limit} and ${autopilot.gates} supervisor-gate(s) (supervisorExtraBudget ${autopilot.budget}) - deferred to the final review`;
          ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: blocker === 'authority' ? AUTOPILOT_EVENTS.deferredToHandover : AUTOPILOT_EVENTS.deferred,
            payload: { jobId: job.job_id, jobIds: [job.job_id], opId: op, by: AUTOPILOT_BY, reason, route: route.id, ...(blocker === 'authority' ? { key: `job:${job.job_id}`, deferClass: 'owner-decision', classes: ['owner-decision'], stubPath: 'the leg waits for the owner at the end; independent legs proceed', owed: 'the owner decision the authority blocker names' } : {}) } });
          return record({ kind: 'deferred', route: route.id, limit, firing: fired, reason });
        }
        const detail = route.to?.needUser
          ? `${op} ${job.job_id}: route ${route.id} (${blocker ?? 'needUser'}) cannot run on its own - a runtime/environment issue for the Supervisor (autopilot); fix it (land to .claude) or decide the retry, then resolve --by supervisor`
          : `${op} ${job.job_id}: route ${route.id} already fired ${fired} of ${limit} times for this node group - a runtime/process issue for the Supervisor (autopilot, gate ${autopilot.gates + 1} of ${autopilot.budget}): read the attempts' reports, fix the root cause (land to .claude) or route the fix to the op that owns it, then resolve --by supervisor and the Kernel retries`;
        const incidentId = openSupervisorGate(ledger, { workflowId: job.workflow_id, opId: op, holds: [job.job_id], detail, evidence, route: route.id });
        return record({ kind: SUPERVISOR_GATE, route: route.id, limit, firing: fired, incidentId, reason: detail });
      }
      const detail = route.to?.needUser
        ? `${op} ${job.job_id}: route ${route.id} needs the owner${failure?.class ? ` (failure class ${failure.class}: ${failure.reason}${envelope?.rootCause?.node ? `; the report names ${envelope.rootCause.node}, which resolves to no build op this workflow can repair` : ''})` : ''}`
        : exhausted ? `${op} ${job.job_id}: unit ${unit.unit.unit_id} spent ${spentTriesOf(ledger.db, unit.unit)} of its ${unit.unit.try_budget} tries (unit-try-budget-exhausted); the owner or the Supervisor decides - api unit --raise-budget, a reshaped unit, or drop it`
        : `${op} ${job.job_id}: route ${route.id} already fired ${fired} of ${limit} times for this node group; the owner decides whether it runs again`;
      return record({ kind: 'owner-gate', route: route.id, limit, firing: fired, ...(failure?.class ? { class: failure.class, classReason: failure.reason } : {}), incidentId: openRouteGate(ledger, job, detail, route.id), reason: detail });
    }
    const routed = { route: route.id, from: job.job_id, firing: base.firing, limit };
    const classNote = failure?.class ? { class: failure.class, classReason: failure.reason } : {};
    // A product defect or measured findings with a named owner: repair THAT build, then this op runs again
    // behind it - never the same walk again at the same HEAD (nivo app-auth uat.verify a1-a5).
    // A node that names an op with a job in this workflow keeps the read-only root verify below (the
    // op-graph ruling); a Work record id, an explicit rootCause.op/files, or an op with no job here is
    // repaired directly.
    const rcNode = typeof envelope?.rootCause?.node === 'string' ? envelope.rootCause.node.trim().split('#')[0] : '';
    const rcNamesOp = Boolean(rcNode && catalog.kinds?.[kindOfOp(catalog, rcNode)]);
    const rcDirect = envelope?.rootCause && (!rcNamesOp || typeof envelope.rootCause.op === 'string' || (Array.isArray(envelope.rootCause.files) && envelope.rootCause.files.length)
      || !repairTemplateOf(db, job, [opOfKind(catalog, kindOfOp(catalog, rcNode))]));
    if (['product', 'findings'].includes(shape.class) && rcDirect && route.to?.kind && route.to.kind !== 'same') {
      const failing = (Array.isArray(envelope.checks) ? envelope.checks : []).flatMap((c) => (Array.isArray(c?.failing) ? c.failing : []));
      let owner = null;
      try { owner = resolveRootOwner({ repo, rootCause: envelope.rootCause, kinds: catalog, failing, reporterPayload: jobPayloadOf(job) }); } catch { owner = null; }
      if (owner && owner.family === 'build' && owner.op !== op) {
        const ownerView = { op: owner.op, via: owner.via, ...(owner.record ? { record: owner.record } : {}), ...(owner.repository ? { repository: owner.repository } : {}), files: owner.ownedPaths.slice(0, 30) };
        const existing = ownerTemplateOf(db, job, owner);
        let repair = null;
        if (existing && !FINAL_SETTLED.includes(existing.status)) repair = { jobId: existing.job_id, enqueued: false, reason: 'in-flight' };
        else if (existing) repair = enqueueFollowOn(ledger, existing, { retryOf: existing.job_id, reason, of: job.job_id, routed });
        else if (owner.ownedPaths.length) {
          let target = { ok: true, repository: null };
          try { if (repo) target = enqueueRepository({ op: owner.op, repository: null, ownedPaths: owner.ownedPaths, repo }); } catch { /* dispatch places it */ }
          const rc = envelope.rootCause;
          repair = enqueueFollowOn(ledger, job, { op: owner.op, reason, of: job.job_id, routed,
            title: `repair ${owner.record ?? owner.op}: ${String(rc.claim ?? '').slice(0, 160)}`,
            repair: { records: owner.record ? [owner.record] : [], ownedPaths: owner.ownedPaths, repository: target.ok ? target.repository : null } });
          const repairRow = repair?.jobId ? db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(repair.jobId) : null;
          if (repairRow) {
            const p = jobPayloadOf(repairRow);
            p.repairFor = { of: job.job_id, op, route: route.id, class: shape.class,
              rootCause: Object.fromEntries(['node', 'category', 'claim', 'evidence', 'counterCheck', 'expectedFix', 'recheck'].filter((k) => rc[k] != null).map((k) => [k, rc[k]])) };
            updateJob(db, { jobId: repair.jobId, payload: p });
          }
        }
        if (repair?.jobId) {
          const rerun = ['reopen', 'pause'].includes(route.then) ? enqueueFollowOn(ledger, job, { retryOf: job.job_id, after: [repair.jobId], reason, of: job.job_id, routed }) : null;
          return record({ kind: 'repair', ...base, ...classNote, owner: ownerView, jobs: [repair.jobId, rerun?.jobId].filter(Boolean),
            reason: `${op} failed on a ${shape.class === 'findings' ? 'measured finding' : 'product defect'} owned by ${owner.op}${owner.record ? ` (${owner.record})` : ''}: route ${route.id} repairs it (${repair.jobId})${rerun ? `, then ${op} runs again (${rerun.jobId})` : ''} (${base.firing} of ${limit})` });
        }
      }
    }
    const node = typeof envelope?.rootCause?.node === 'string' ? envelope.rootCause.node.trim() : '';
    const rootOp = node ? node.split('#')[0] : null;
    const root = (rootOp && rootOp !== op ? repairTemplateOf(db, job, [rootOp]) : null)
      ?? (node && envelope?.rootCause?.self !== true ? recordOwnerJobOf(db, job, node, repo) : null);
    const rootPaths = root ? recordPathsOf(jobPayloadOf(root)) : [];
    if (rootPaths.length) {
      const rootCause = { node, ...Object.fromEntries(['self', 'category', 'claim', 'evidence', 'counterCheck', 'expectedFix', 'recheck'].filter((k) => envelope.rootCause[k] != null).map((k) => [k, envelope.rootCause[k]])) };
      const verify = enqueueFollowOn(ledger, root, { op: ROOT_VERIFY_OP, reason: 'root-verify', of: job.job_id, ownedPaths: rootPaths, params: { mode: 'select' },
        title: `root.verify: is ${node} the root cause of ${op} ${job.job_id} failing? Read-only: confirm or reject the claim with evidence`,
        rootVerify: { node, claim: rootCause, of: job.job_id, rootJob: root.job_id } });
      const rerun = enqueueFollowOn(ledger, job, { retryOf: job.job_id, after: [verify.jobId], reason, of: job.job_id, liveness, routed });
      return record({ kind: 'root-verify', ...base, rootCause, jobs: [verify.jobId, rerun.jobId].filter(Boolean),
        reason: `${node} is claimed as the root cause: ${verify.jobId} verifies it read-only, then ${rerun.jobId} runs ${op} again` });
    }
    const targets = routeTargetOps(catalog, route, op);
    // A report that names its root cause outside itself (rootCause.self false) and that this workflow
    // cannot verify through a job of its own is never re-run blind: the same op on the same tree files
    // the same partial (nivo collab op-backend.implement-bd2609ff17 -> a1dad730db, starci-next
    // foundation f920334582 -> a89b597df5: an hour or more each, identical open items). A red the
    // report's own checks pin on a peer's change settles peer-blocked like api check's (no business
    // attempt, routes to the peer); any other foreign root waits for the Kernel to hand it to its owner.
    const foreignRoot = envelope?.rootCause && envelope.rootCause.self === false && shape.verdict !== 'rejected' && shape.verdict !== 'no-report';
    if (foreignRoot && route.then === 'retry' && targets.length === 1 && targets[0] === op) {
      const rootCause = { node: node || null, ...Object.fromEntries(['self', 'category', 'claim', 'evidence', 'expectedFix', 'recheck'].filter((k) => envelope.rootCause[k] != null).map((k) => [k, envelope.rootCause[k]])) };
      const attributed = reportPeerAttribution(db, job, envelope, repo);
      if (attributed.peer) {
        const peerBlocked = { checks: attributed.checks, peers: attributed.peers, routes: attributed.routes, source: 'report' };
        const step = { kind: 'peer-blocked', route: route.id, limit, firing: fired, counted: false, rootCause, jobs: [],
          reason: `the report's red ${attributed.checks.join(', ')} is a peer's change (${attributed.peers.map((p) => p.workflowId).join(', ')}): no blind retry of ${op} and no business attempt spent; run ${attributed.routes.join(' ; ')}, then api enqueue --op ${op} --retry-of ${job.job_id} once it is released` };
        const result = jobResult(db, job.job_id) ?? {};
        recordJobResult(db, { jobId: job.job_id, result: { ...result, peerBlocked, nextStep: step } });
        ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'failure-routed', payload: { opId: op, shape, ...step, peerBlocked } });
        return step;
      }
      return record({ kind: 'root-elsewhere', route: route.id, limit, firing: fired, counted: false, rootCause, jobs: [],
        reason: `rootCause names ${node || 'another node'} (self false${rootCause.category ? `, ${rootCause.category}` : ''}) that this workflow runs no job of; a same-op retry would re-run identical work (${attributed.reason}). Hand the root to its owner - api incident --kind shared-blocker --introduced-by <sha> | --introducer <workflow> for another workflow's change, a widened --owned-paths re-enqueue for a scope gap - then api enqueue --op ${op} --retry-of ${job.job_id}` });
    }
    if (targets.length === 1 && targets[0] === op) {
      const retry = enqueueFollowOn(ledger, job, { retryOf: job.job_id, reason, of: job.job_id, liveness, routed });
      return record({ kind: 'retry', ...base, ...classNote, jobs: [retry.jobId].filter(Boolean), reason: `route ${route.id} runs ${op} again (${base.firing} of ${limit})${failure?.class ? ` - failure class ${failure.class}: ${failure.reason}` : ''}` });
    }
    const template = targets.length ? repairTemplateOf(db, job, targets) : null;
    if (!template) continue;
    const repair = FINAL_SETTLED.includes(template.status)
      ? enqueueFollowOn(ledger, template, { retryOf: template.job_id, reason, of: job.job_id, routed })
      : { jobId: template.job_id, enqueued: false, reason: 'in-flight' };
    const rerun = ['reopen', 'pause'].includes(route.then) ? enqueueFollowOn(ledger, job, { retryOf: job.job_id, after: [repair.jobId], reason, of: job.job_id, routed }) : null;
    return record({ kind: 'repair', ...base, jobs: [repair.jobId, rerun?.jobId].filter(Boolean),
      reason: `route ${route.id} repairs ${jobOpOf(template)} (${repair.jobId})${rerun ? `, then ${op} runs again (${rerun.jobId})` : ''} (${base.firing} of ${limit})` });
  }
  return record({ kind: 'none', reason: `no route in modules/models/kinds.yaml resolves ${op} with ${JSON.stringify(shape)}` });
}
const CANON_FOLLOW_UP_REASON = 'canon-follow-up';
const CANON_FOLLOW_UP_LIMIT = 3;
const REPORT_COMMIT_RE = /\b(?:commit(?:ted)?|land(?:ed)?(?: commit)?|đã (?:land )?commit)\s+([0-9a-f]{7,40})\b/i;
/**
 * Settle's own next step for a canon slice (code.refactor params.canonFamilies, not its canon-wire leg) that
 * settled blocked with a filed report (cut-seam.mjs canonSettleFollowUpOf): ONE follow-up attempt of the same
 * ordinal --retry-of it - a continuation from its commit (params.resumeFrom, kernelEdit.continuationOf, so the
 * unit counts it) when it committed, owning the relocation grants its report names - and the shared-root,
 * config and public-entry files it needs go to the cut's queued canon-wire leg (widened), or a new wire leg
 * after the follow-up. Bounded by CANON_FOLLOW_UP_LIMIT per ordinal; a retry the Kernel already queued wins.
 * Records result_json.nextStep {kind: canon-follow-up}. Null when there is nothing to do.
 */
/**
 * The cut's canon-wire leg takes `paths` (cut-seam.mjs canonSettleFollowUpOf wire, or a passed slice's report
 * owedToWire): the newest queued, never-dispatched wire leg of the workflow is widened (and waits on `after`),
 * else a new wire leg is enqueued after `after`. {jobId, widened|created} or null.
 */
function widenCanonWire(ledger, job, payload, paths, after = []) {
  const db = ledger.db, op = jobOpOf(job), wf = job.workflow_id;
  let wire = null;
  const queuedWire = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND op_id=? AND status='queued' AND json_extract(payload_json,'$.params.canonWire')=1 ORDER BY try_no DESC, created_at DESC`).all(wf, op)
    .find((row) => !db.prepare("SELECT 1 FROM events WHERE entity_type='job' AND entity_id=? AND kind IN ('op-dispatched','dispatch-attested','worker-attested') LIMIT 1").get(row.job_id));
  if (queuedWire) {
    const wp = jobPayloadOf(queuedWire);
    const add = paths.filter((p) => !(wp.owned_paths ?? []).includes(p));
    if (add.length || after.some((id) => !(wp.after ?? []).includes(id))) {
      wp.owned_paths = [...(wp.owned_paths ?? []), ...add];
      wp.after = [...new Set([...(wp.after ?? []), ...after])];
      updateJob(db, { jobId: queuedWire.job_id, payload: wp });
      ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: queuedWire.job_id, kind: 'canon-wire-widened', payload: { add, after, of: job.job_id, by: 'settle' } });
    }
    return { jobId: queuedWire.job_id, widened: add };
  }
  const created = enqueueFollowOn(ledger, job, { reason: 'canon-wire', of: job.job_id, after, title: `code.refactor: canon-wire ${paths.slice(0, 2).map((p) => p.split('/').pop()).join(',')}`,
    repair: { records: payload.records ?? [], ownedPaths: paths, repository: payload.repository ?? null, params: { ...(payload.params ?? {}), canonWire: true, resumeFrom: '', admissionBase: '' } } });
  return created?.jobId ? { jobId: created.jobId, created: true } : wire;
}
// The admission commit a slice's gate measured against (`gate.mjs ... --base <sha>` in its report's checks).
const admissionBaseOfReport = (envelope) => (Array.isArray(envelope?.checks) ? envelope.checks : [])
  .map((check) => /--base\s+([0-9a-f]{7,40})\b/i.exec(String(check?.command ?? ''))?.[1]).find(Boolean) ?? null;
function canonSettleFollowUp(ledger, job, payload, envelope) {
  const db = ledger.db, op = jobOpOf(job), wf = job.workflow_id;
  const manifest = cutManifestOf(db, { workflowId: wf, op, cut: payload.cut, ownJobId: job.job_id });
  const commit = REPORT_COMMIT_RE.exec([envelope?.summary, envelope?.blocker?.detail].join(' '))?.[1] ?? null;
  let sharedRoots = [];
  try { sharedRoots = canonConformancePolicy().sharedRoots; } catch { /* no shared roots: the wire carries only contested relocations and config files */ }
  const plan = canonSettleFollowUpOf({ payload, report: envelope, manifest, destinations: destinationsOf(envelope, payload.owned_paths ?? []), commit, sharedRoots });
  if (!plan) return null;
  const record = (step) => {
    const result = jobResult(db, job.job_id) ?? {};
    recordJobResult(db, { jobId: job.job_id, result: { ...result, nextStep: step } });
    ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: job.job_id, kind: 'failure-routed', payload: { opId: op, shape: { verdict: 'blocked', class: 'canon-follow-up' }, ...step } });
    return step;
  };
  const prior = db.prepare(`SELECT COUNT(*) n FROM jobs WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')=?
    AND json_extract(payload_json,'$.retryReason.reason')=?`).get(wf, op, String(payload.cut.id), Number(payload.cut.ordinal), CANON_FOLLOW_UP_REASON).n;
  if (prior >= CANON_FOLLOW_UP_LIMIT) return record({ kind: 'none', reason: `cut ${payload.cut.id} ordinal ${payload.cut.ordinal} already had ${prior} canon follow-up(s) (limit ${CANON_FOLLOW_UP_LIMIT}): the Kernel re-cuts or wires it` });
  const follow = enqueueFollowOn(ledger, job, { retryOf: job.job_id, reason: CANON_FOLLOW_UP_REASON, of: job.job_id });
  const jobs = [];
  if (follow?.jobId) jobs.push(follow.jobId);
  if (follow?.jobId && follow.reason !== 'retry-exists') {
    const row = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(follow.jobId);
    const next = jobPayloadOf(row);
    const params = { ...(next.params ?? {}), ...(plan.resumeFrom ? { resumeFrom: plan.resumeFrom, admissionBase: String(payload.params?.admissionBase || admissionBaseOfReport(envelope) || '') } : {}) };
    const note = [
      plan.resumeFrom ? `Continuation of ${job.job_id}: its commit ${plan.resumeFrom} already landed the in-ceiling part - bring it in (params.resumeFrom) and finish what its report left open; never redo it.` : `Follow-up of ${job.job_id}, which blocked ${plan.blocker ?? ''}: its report is your starting point.`,
      plan.grants.length ? `You now also own the relocation destinations ${plan.grants.join(', ')}.` : null,
      plan.wire.length ? `The canon-wire leg owns ${plan.wire.join(', ')}: a finding that needs one of them is owedToWire [{path, finding}] - fix everything else, commit, and report done; never block on it.` : 'A finding that needs a shared-root, config or public-entry file outside your owned paths is owedToWire [{path, finding}]: report done with it listed, never blocked.',
    ].filter(Boolean).join(' ');
    next.owned_paths = [...new Set([...(next.owned_paths ?? []), ...plan.grants])];
    next.params = params;
    next.kernelEdit = { ...(next.kernelEdit ?? {}), unitOf: job.job_id, by: 'settle', ...(plan.resumeFrom ? { continuationOf: job.job_id, commits: [plan.resumeFrom] } : { retryOf: job.job_id }) };
    next.kernelOverride = { ...(next.kernelOverride ?? {}), notes: [...(next.kernelOverride?.notes ?? []), note] };
    updateJob(db, { jobId: follow.jobId, payload: next });
    if (plan.resumeFrom) ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: job.job_id, kind: 'unit-partial-continued', payload: { by: follow.jobId, commit: plan.resumeFrom, via: 'settle' } });
  }
  let wire = null;
  if (plan.wire.length) {
    wire = widenCanonWire(ledger, job, payload, plan.wire, jobs);
    if (wire?.jobId) jobs.push(wire.jobId);
  }
  const how = plan.resumeFrom ? `continues from ${plan.resumeFrom}` : 'follow-up';
  return record({ kind: 'canon-follow-up', counted: false, jobs, ...(plan.resumeFrom ? { resumeFrom: plan.resumeFrom } : {}), grants: plan.grants, wire: plan.wire, ...(wire ? { wireJob: wire.jobId } : {}),
    reason: `canon slice ${payload.cut.id} ${payload.cut.ordinal}/${payload.cut.total} blocked (${plan.blocker ?? 'no kind'}): ${how} as ${follow?.jobId ?? '-'}${follow?.reason === 'retry-exists' ? " (the Kernel's own redo)" : ''}${plan.grants.length ? `, +grants ${plan.grants.join(', ')}` : ''}${wire ? `; wire ${wire.jobId} owns ${plan.wire.join(', ')}` : ''}` });
}
// One open pattern incident per (workflow, op) once its failed-no-report settles reach the threshold.
const raiseDeadWorkerPattern = (ledger, job) => {
  const db = ledger.db, op = jobOpOf(job), workflowId = job.workflow_id;
  // A death the environment caused (a host terminal wipe) is no pattern of the op's workers.
  const deaths = db.prepare("SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND kind='worker-failed-no-report' AND json_extract(payload_json,'$.opId')=? AND json_extract(payload_json,'$.environment') IS NULL ORDER BY seq").all(workflowId, op);
  if (deaths.length < DEAD_WORKER_PATTERN_THRESHOLD) return { raised: false, count: deaths.length, threshold: DEAD_WORKER_PATTERN_THRESHOLD };
  const open = db.prepare("SELECT incident_id FROM incidents WHERE workflow_id=? AND status='open' AND last_progress LIKE ?").get(workflowId, `${DEAD_WORKER_PATTERN_TAG} ${op}:%`);
  if (open) return { raised: false, count: deaths.length, threshold: DEAD_WORKER_PATTERN_THRESHOLD, incidentId: open.incident_id, existing: true };
  const tally = (values) => Object.entries(values.reduce((acc, v) => ({ ...acc, [v]: (acc[v] ?? 0) + 1 }), {})).map(([k, n]) => `${n}x ${k}`).join(', ');
  const models = deaths.map((d) => jobPayloadOf(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(d.entity_id) ?? {}).model ?? 'unrouted');
  const livenesses = deaths.map((d) => parseJson(d.payload_json, {})?.liveness ?? 'unknown');
  const detail = `${DEAD_WORKER_PATTERN_TAG} ${op}: ${deaths.length} attempts ended with no report (${tally(livenesses)}; ${tally(models)}), latest ${deaths.slice(-5).map((d) => d.entity_id).join(', ')}. The runtime settled each failed-no-report and queued its retry; the Kernel owes nothing for them. For the runtime supervisor: why this op's workers die (provider, launcher, host), and whether to route it off that provider.`;
  const incidentId = `inc-${newToken().slice(0, 12)}`, now = Date.now();
  ledger.transaction(() => {
    openIncident(db, { incidentId, workflowId, kind: 'worker-died-no-report-pattern', opId: op, jobId: job.job_id, detail, lastProgress: detail, at: now });
    ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: 'incident-raised',
      payload: { kind: 'worker-died-no-report-pattern', detail, opId: op, count: deaths.length, auto: true } });
  });
  return { raised: true, count: deaths.length, threshold: DEAD_WORKER_PATTERN_THRESHOLD, incidentId };
};
function settleFailedNoReport(ledger, job, { workerProof = null, evidence = [], dispatchId = null, pathProof = null, repo, args }) {
  const db = ledger.db, jobId = job.job_id, op = jobOpOf(job);
  const handle = workerProof?.terminal ?? null, liveness = workerProof?.liveness ?? null;
  const environment = workerProof?.hostWipe?.cause ?? null;
  let machineRefs = [], leasesReleased = 0, retry = null, nextStep = null, settledPayload = null, effectState = 'unknown';
  ledger.transaction(() => {
    const fresh = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
    if (fresh?.status !== job.status) throw Object.assign(new Error(`job ${jobId} moved to ${fresh?.status} during recovery; re-read status`), { code: 'dead-worker-raced' });
    const at = Date.now();
    const next = jobPayloadOf(job);
    next.deadWorkers = [...(Array.isArray(next.deadWorkers) ? next.deadWorkers : []),
      { attempt: tryOf(job), dispatchId, ...(workerProof ?? {}), recovery: 'settled-failed', at }];
    next.verdict = 'fail';
    next.report = null;
    next.settledAt = at;
    effectState = evidence.some((item) => /^(?:dirty|commit):/.test(String(item))) ? 'partial' : 'unknown';
    // A host terminal wipe is the environment's: the retry continues from the partial tree, but no
    // business attempt is spent (engine/admission.mjs retryClass environment) and no pool is blamed.
    const result = { verdict: 'fail', reason: FAILED_NO_REPORT, reportFiled: false, effectState, attemptConsumed: !environment, retryable: true, dispatchId,
      ...(environment ? { retryClass: RETRY_CLASS_ENVIRONMENT, environment } : {}),
      evidence, worker: workerProof, paths: pathProof, at, checkEvidence: { observed: 0, passed: 0, failed: 0, green: false } };
    leasesReleased = releaseLeases(db, { jobId });
    const attemptId = latestAttemptOf(db, jobId)?.attempt_id ?? null;
    // running|answering|leased|effect_unknown -> failed along job_transitions (answering and leased pass through running).
    if (['answering', 'leased'].includes(job.status)) setJobStatus(db, { jobId, to: 'running', reason: FAILED_NO_REPORT, attemptId, at });
    setJobStatus(db, { jobId, to: 'failed', reason: FAILED_NO_REPORT, attemptId, at, payload: next, leaseToken: null, deadline: null });
    recordJobResult(db, { jobId, result, at });
    if (attemptId != null) updateAttempt(db, { attemptId, at, endState: 'worker-dead', effectState, settledAt: at, settledBy: 'reconcile' });
    recordWhy(db, attemptId, { at });
    if (job.unit_id) setUnitState(db, { workflowId: job.workflow_id, unitId: job.unit_id, to: 'failed', reason: `${jobId} ${FAILED_NO_REPORT}`, at });
    // A question the dead worker asked through Orca has no one left to answer.
    for (const { inbox_id: inboxId } of db.prepare("SELECT inbox_id FROM inbox WHERE workflow_id=? AND kind=? AND status='pending' AND json_extract(payload_json,'$.jobId')=?")
      .all(job.workflow_id, WORKER_QUESTION, jobId)) setInboxStatus(db, { inboxId, status: 'done', disposition: { reason: 'job-settled' }, at });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'op-settled',
      payload: { verdict: 'fail', status: 'failed', report: null, reportFiled: false, reportOutcome: null, reason: FAILED_NO_REPORT, auto: true, effectState, evidence,
        leasesReleased, machineRefs, reportsConsumed: false, ...(environment ? { environment } : {}) } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'worker-failed-no-report',
      payload: { opId: op, attempt: tryOf(job), dispatchId, liveness, terminal: handle, effectState, evidence,
        ...(environment ? { environment, attemptConsumed: false, hostWipe: workerProof.hostWipe } : {}) } });
    settledPayload = next;
    nextStep = enqueueNextStep(ledger, { ...job, payload_json: JSON.stringify(next) }, { shape: failureShapeOf({ reportFiled: false }), environment: Boolean(environment), liveness, repo });
    const retried = nextStep.kind === 'retry' && nextStep.jobs?.[0]
      ? db.prepare('SELECT job_id,try_no,unit_id FROM jobs WHERE job_id=?').get(nextStep.jobs[0]) : null;
    retry = retried
      ? { enqueued: true, jobId: retried.job_id, tryNo: retried.try_no, unitId: retried.unit_id }
      : { enqueued: false, reason: nextStep.kind === 'owner-gate' ? 'route-limit' : nextStep.reason, ...(nextStep.incidentId ? { incidentId: nextStep.incidentId } : {}) };
  });
  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  // After the verdict is written: the managed worker is stopped and released (custody proven), a
  // plain terminal's dead shell or quiet agent is closed, and the op's Orca Task is closed.
  const managedWorker = settledPayload.managed?.dispatchId ? releaseManagedWorker(db, job, settledPayload, repo) : null;
  const terminalClosed = settledPayload.managed ? null : closeDeadWorkerTerminal(ledger, job, handle, { liveness, errorCode: workerProof?.errorCode });
  const taskClosed = closeOperationTask(db, job, settledPayload);
  if (taskClosed || managedWorker) {
    ledger.transaction(() => {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
      updateJob(db, { jobId, payload: { ...stored, ...(taskClosed ? { taskClosed } : {}), ...(managedWorker ? { managedWorker } : {}) } });
    });
  }
  const artifacts = indexSettledArtifacts(ledger, job, repo);
  const pattern = bestEffort(() => raiseDeadWorkerPattern(ledger, job));
  const typedReleased = bestEffort(() => releaseTypedWaits(ledger, { repo, wake: true, self: job.workflow_id }).resolved) ?? [];
  const out = { ok: true, jobId, recovery: 'settled-failed', status: 'failed', verdict: 'fail', reason: FAILED_NO_REPORT, reportFiled: false, attempt: tryOf(job),
    effectState, evidence, dispatchId, liveness, leasesReleased, machineRefsReleased, retry, nextStep, attemptConsumed: !environment, ...(environment ? { environment, hostWipe: workerProof.hostWipe } : {}),
    ...(terminalClosed ? { terminalClosed } : {}), ...(managedWorker ? { managedWorker } : {}), ...(taskClosed ? { taskClosed } : {}),
    artifacts, ...(pattern ? { pattern } : {}), ...(Array.isArray(typedReleased) && typedReleased.length ? { autoResolved: typedReleased.map(({ incidentId, workflowId }) => ({ incidentId, workflowId })) } : {}) };
  emit(out, `settled ${jobId} failed-no-report (worker ${handle ?? '?'} ${liveness ?? 'dead'}${environment ? ` in a ${environment}: no business attempt spent` : ''}; effect ${effectState}${evidence.length ? `: ${evidence.slice(0, 6).join(', ')}` : ''}; leases released: ${leasesReleased})`
    + `${retry?.jobId ? `; retry ${retry.jobId} (attempt ${retry.tryNo}) ${retry.enqueued ? 'queued' : 'already queued'} - route and dispatch it` : `; no retry queued (${retry?.reason ?? 'unknown'}${retry?.incidentId ? `: owner-gate ${retry.incidentId}` : ''})`}`
    + `${managedWorker ? `; worker ${managedWorker.dispatchId} custody=${managedWorker.custody?.state ?? 'unknown'}` : ''}${closedNote(terminalClosed)}${taskClosed ? `; task ${taskClosed.taskId} ok=${taskClosed.ok}` : ''}`
    + `${pattern?.raised ? `; pattern incident ${pattern.incidentId} raised (${pattern.count} no-report deaths of ${op})` : ''}`, args?.json);
}

// `reconcile --job <id> --release-worker`: prove, and if needed redo, a SETTLED job's worker
// release. Idempotent: a job whose recorded custody is already released writes nothing. Settle
// used to answer "release unknown/retained" for a worker whose path leases were released, whose
// Task was closed and whose agent terminal was already disconnected, and each such receipt became
// an incident (inc-eb9a21769d69, inc-a253fdf2deda, inc-fbff1e65b60f, inc-d1c5a963c8bb, inc-2ce5f44f858a).
/**
 * The wait that alone holds a running job's settle, or null: its report is filed and consumed, and an
 * open owner-gate or peer-wait incident names it (--holds, else --op) - exactly status heldSettleJobs.
 */
const heldSettleWaitOf = (db, job) => {
  if (!['running', 'answering'].includes(job.status)) return null;
  const dispatchId = reportDispatchIdOf(db, job);
  const report = dispatchId ? db.prepare('SELECT outcome,consumed_at FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId) : null;
  if (!report?.consumed_at) return null;
  const gate = ownerGateOf(openOwnerGates(db, job.workflow_id), job);
  if (gate) return { heldBecause: 'owner-gate', incident: gate.incidentId, reportOutcome: report.outcome, consumedAt: report.consumed_at };
  const wait = ownerGateOf(openPeerWaits(db, job.workflow_id), job);
  return wait ? { heldBecause: PEER_WAIT, incident: wait.incidentId, peer: wait.peer, reportOutcome: report.outcome, consumedAt: report.consumed_at } : null;
};
// A worker already released while its settle was held: settle and --release-worker reuse its proof
// instead of quitting, closing or releasing a terminal that no longer exists.
const releasedWhileHeldOf = (payload) => (payload?.workerReleased?.custody?.state === 'released' ? payload.workerReleased : null);
/**
 * `reconcile --job <id> --release-worker` on a RUNNING job whose settle a wait holds: the worker filed
 * its report, the Kernel consumed it, and only an owner-gate or peer-wait keeps the settle open, so the
 * worker has nothing left to do. Its agent quits and its terminal closes (a managed worker gets settle's
 * worker-stop/-release), its path leases go back, and the job stays running for the settle the wait
 * releases - which then needs no live worker (cmdSettle reuses payload.workerReleased). The Orca Task
 * stays open with the job. Idempotent. One event 'worker-released-while-held'.
 */
function releaseHeldWorker(ledger, args, job, repo, held) {
  const db = ledger.db, jobId = job.job_id, payload = jobPayloadOf(job);
  const prior = releasedWhileHeldOf(payload);
  if (prior) {
    const out = { ok: true, jobId, alreadyReleased: true, status: job.status, custody: prior.custody, heldBy: prior.heldBy ?? null };
    emit(out, `release-worker ${jobId}: already released while its settle is held (${prior.custody.proof}); nothing written`, args.json);
    return;
  }
  let managedWorker = null, terminalClosed = null;
  if (payload.managed?.dispatchId) managedWorker = releaseManagedWorker(db, job, payload, repo);
  else if (job.worker_id) terminalClosed = quitWorkerTerminal(job.worker_id, payload);
  const custody = (managedWorker ?? terminalClosed)?.custody ?? { state: 'released', proof: 'no-terminal-handle' };
  const released = custody.state === 'released';
  const heldBy = { heldBecause: held.heldBecause, incident: held.incident, ...(held.peer ? { peer: held.peer } : {}) };
  let leasesReleased = 0, machineRefs = [];
  ledger.transaction(() => {
    const fresh = db.prepare('SELECT status,payload_json FROM jobs WHERE job_id=?').get(jobId);
    if (fresh?.status !== job.status) throw Object.assign(new Error(`job ${jobId} moved to ${fresh?.status} during the release; re-read status`), { code: 'release-worker-raced' });
    const stored = parseJson(fresh.payload_json) ?? {};
    const at = Date.now();
    if (released) leasesReleased = releaseLeases(db, { jobId });
    updateJob(db, { jobId, at, payload: { ...stored,
      ...(managedWorker ? { managedWorker } : {}), ...(terminalClosed ? { terminalClosed } : {}),
      ...(released ? { workerReleased: { at, heldBy, reportOutcome: held.reportOutcome, custody: { ...custody, whileHeld: true }, leasesReleased } } : {}) } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'worker-released-while-held',
      payload: { opId: jobOpOf(job), attempt: tryOf(job), heldBy, custody, leasesReleased, terminal: operationTerminalHandleOf(job, payload) } });
  });
  if (machineRefs.length) {
    try { const machine = openMachine({ file: machineFileFor() }); try { machine.release(machineRefs); } finally { machine.close(); } }
    catch { /* ledger rows are the record; machine TTLs expire on their own */ }
  }
  const out = { ok: released, jobId, status: job.status, releasedWhileHeld: released, heldBy, custody, leasesReleased,
    ...(managedWorker ? { managedWorker } : {}), ...(terminalClosed ? { terminalClosed } : {}) };
  emit(out, `release-worker ${jobId}: ${released ? 'released' : 'NOT released'} while its settle is held by ${held.heldBecause} ${held.incident} (custody ${custody.state}${custody.proof ? ` ${custody.proof}` : ''}; leases released: ${leasesReleased}); the job stays ${job.status} for its settle`, args.json);
  if (!released) process.exitCode = 1;
}
function reconcileReleaseWorker(ledger, args, job, repo) {
  const db = ledger.db, jobId = job.job_id, payload = jobPayloadOf(job);
  if (!FINAL_SETTLED.includes(job.status)) {
    // A worker released earlier answers alreadyReleased even after its wait resolved.
    const held = releasedWhileHeldOf(payload)?.heldBy ?? heldSettleWaitOf(db, job);
    if (held) return releaseHeldWorker(ledger, args, job, repo, held);
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --release-worker proves the release of a settled job (settle releases its own), or releases the worker of a running job whose consumed report's settle an open owner-gate or peer-wait holds - none holds this one`), { code: 'release-worker-not-settled' });
  }
  const recorded = payload.managed ? payload.managedWorker?.custody : payload.terminalClosed?.custody;
  const taskDone = !operationTaskOf(payload) || payload.taskClosed?.ok === true;
  if (recorded?.state === 'released' && taskDone) {
    const out = { ok: true, jobId, alreadyReleased: true, custody: recorded, taskClosed: payload.taskClosed ?? null };
    emit(out, `release-worker ${jobId}: already released (${recorded.proof}); nothing written`, args.json);
    return;
  }
  let managedWorker = null, terminalClosed = null;
  if (payload.managed?.dispatchId) managedWorker = recorded?.state === 'released' ? payload.managedWorker : releaseManagedWorker(db, job, payload, repo);
  else if (job.worker_id && recorded?.state !== 'released') terminalClosed = quitWorkerTerminal(job.worker_id, payload);
  const taskClosed = closeOperationTask(db, job, payload);
  ledger.transaction(() => {
    const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
    updateJob(db, { jobId, payload: { ...stored, ...(taskClosed ? { taskClosed } : {}), ...(managedWorker ? { managedWorker } : {}), ...(terminalClosed ? { terminalClosed } : {}) } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'worker-release-reconciled',
      payload: { opId: jobOpOf(job), attempt: tryOf(job), custody: (managedWorker ?? terminalClosed)?.custody ?? null, taskClosed: taskClosed?.ok ?? null } });
  });
  const custody = (managedWorker ?? terminalClosed)?.custody ?? null;
  const out = { ok: custody?.state !== 'retained', jobId, custody, ...(managedWorker ? { managedWorker } : {}), ...(terminalClosed ? { terminalClosed } : {}), taskClosed };
  emit(out, `release-worker ${jobId}: custody ${custody?.state ?? 'unknown'}${custody?.proof ? ` (${custody.proof})` : ''}${taskClosed ? `; task ${taskClosed.taskId} ok=${taskClosed.ok}` : ''}`, args.json);
  if (!out.ok) process.exitCode = 1;
}

// Re-open an effect_unknown dispatch only when the host can now prove that
// the exact managed worker never crossed the operation boundary.  This is an
// infrastructure retry, so it preserves the same job id and attempt number.
// `reconcile --orphan-kernel-jobs [--workflow <id>] [--dry-run]`: a kernel job
// still dispatchable (running/queued/leased/answering) whose workflow is
// finished or archived. Nothing will ever release it — finish settles the
// kernel job it finds, and a restart after finish (or a finish from an older
// runtime) left kernel-wf-nivo-ang-stales-refactor-mu9nfaxf 'running' for a
// workflow finished days before. Each is settled cancelled with its leases, a
// finished workflow's kernel signal is released, and one
// 'orphan-kernel-job-reconciled' event records the row as it was. Its terminal
// is named, never closed here (resume-all's dedupe owns stray terminals).
const workflowFinished = (db, workflowId) => { const wf = getWorkflow(db, workflowId); return !wf || wf.phase === 'finished' || !!wf.archived_at; };
function reconcileOrphanKernelJobs(ledger, args) {
  const db = ledger.db, now = Date.now();
  const rows = db.prepare(`SELECT j.job_id,j.workflow_id,j.status,j.worker_id,j.try_no AS attempt,j.generation,j.payload_json,w.phase,w.archived_at
      FROM jobs j JOIN workflows w ON w.workflow_id=j.workflow_id
     WHERE j.kind='kernel' AND j.status IN (${DISPATCHABLE.map(() => '?').join(',')}) AND (w.phase='finished' OR w.archived_at IS NOT NULL)
     ORDER BY j.job_id`).all(...DISPATCHABLE).filter((row) => !args.workflow || row.workflow_id === args.workflow);
  const reconciled = [];
  for (const row of rows) {
    const signal = db.prepare("SELECT token,value_json FROM signals WHERE scope='kernel' AND key=?").get(row.workflow_id);
    const entry = { jobId: row.job_id, workflowId: row.workflow_id, status: row.status, terminal: row.worker_id ?? null,
      phase: row.phase, archivedAt: row.archived_at ?? null, signal: signal ? parseJson(signal.value_json, {})?.terminal ?? null : null };
    if (args['dry-run']) { reconciled.push({ ...entry, wouldSettle: 'cancelled' }); continue; }
    ledger.transaction(() => {
      if (db.prepare('SELECT status FROM jobs WHERE job_id=?').get(row.job_id)?.status !== row.status) { entry.raced = true; return; }
      entry.leasesReleased = releaseLeases(db, { jobId: row.job_id });
      if (row.status === 'answering') setJobStatus(db, { jobId: row.job_id, to: 'running', reason: 'orphan-kernel-job', at: now });
      setJobStatus(db, { jobId: row.job_id, to: 'cancelled', reason: 'orphan-kernel-job', at: now, workerId: null, leaseToken: null, deadline: null });
      recordJobResult(db, { jobId: row.job_id, at: now,
        result: { reason: 'orphan-kernel-job', workflowPhase: row.phase, archivedAt: row.archived_at ?? null, terminal: row.worker_id ?? null, at: now } });
      entry.signalReleased = row.phase === 'finished' ? clearSignal(db, { scope: 'kernel', key: row.workflow_id }) : false;
      ledger.appendEvent({ workflowId: row.workflow_id, entityType: 'job', entityId: row.job_id, generation: row.generation ?? 0,
        kind: 'orphan-kernel-job-reconciled', payload: { ...entry, settledAs: 'cancelled' } });
      entry.settledAs = 'cancelled';
    });
    reconciled.push(entry);
  }
  const out = { ok: true, mode: 'orphan-kernel-jobs', dryRun: args['dry-run'] === true, reconciled };
  emit(out, reconciled.length
    ? reconciled.map((r) => `${args['dry-run'] ? 'would settle' : r.raced ? 'raced (left as is)' : 'settled cancelled'} ${r.jobId} (${r.status}; workflow ${r.phase}${r.archivedAt ? ', archived' : ''}${r.terminal ? `; terminal ${r.terminal}` : ''}${r.signalReleased ? '; kernel signal released' : ''})`).join('\n')
    : 'no orphan kernel job: every dispatchable kernel job belongs to a running, unarchived workflow', args.json);
}

// `reconcile --orca-tasks [--workflow <id>] [--dry-run]`: the Orca side of a
// workflow's tree against the ledger. For a running workflow whose Kernel
// terminal is live, its current Run is bound to that terminal (orca-runs.mjs
// bindWorkflowRun: one run-use after a restart) and every open StarCi Task in
// the Run that no live job holds is closed (task-update completed) — the
// grey rows of dead ops that sat under the new kernels after the 2026-09-24
// reboot. Runs whose coordinator is gone (superseded or finished) are read
// only: their open Tasks are counted `unclosable`, never re-bound to a live
// terminal that coordinates another Run. Ledger bookkeeping follows Orca: a
// settled job whose Task Orca lists closed (or no longer lists) gets
// payload.taskClosed, which is what poll's "open Task(s) left by finished
// workflows" counts.
function reconcileOrcaTasks(ledger, args) {
  const db = ledger.db, now = Date.now(), dryRun = args['dry-run'] === true;
  const HELD = ['running', 'answering', 'leased'];
  const runIdOf = (payload) => payload?.orca?.runId ?? payload?.managed?.runId ?? payload?.hierarchy?.runtime?.runId ?? null;
  const workflows = db.prepare('SELECT workflow_id,phase,archived_at,generation FROM workflows ORDER BY workflow_id').all()
    .filter((w) => !args.workflow || w.workflow_id === args.workflow);
  const report = [];
  for (const wf of workflows) {
    const jobs = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=?`).all(wf.workflow_id);
    const kernelJob = jobs.find((j) => j.kind === 'kernel') ?? null;
    const kernelPayload = kernelJob ? jobPayloadOf(kernelJob) : {};
    const currentRun = kernelPayload?.orca?.runId ?? null;
    const openLedgerTasks = jobs.filter((j) => j.kind !== 'kernel').map((j) => ({ job: j, payload: jobPayloadOf(j) }))
      .filter(({ payload }) => operationTaskOf(payload) && payload?.taskClosed?.ok !== true);
    const runIds = new Set([currentRun, ...openLedgerTasks.map(({ payload }) => runIdOf(payload))].filter(Boolean));
    if (!runIds.size) continue;
    const heldTaskIds = new Set(jobs.filter((j) => j.kind !== 'kernel' && HELD.includes(j.status))
      .map((j) => operationTaskOf(jobPayloadOf(j))?.taskId).filter(Boolean));
    // The coordinator we may speak as: the running workflow's live kernel terminal.
    let kernelHandle = null;
    if (wf.phase !== 'finished' && !wf.archived_at && kernelJob?.status === 'running' && kernelJob.worker_id) {
      const shown = terminalShow({ terminal: kernelJob.worker_id });
      if (shown?.ok && shown.connected === true) kernelHandle = kernelJob.worker_id;
    }
    const entry = { workflowId: wf.workflow_id, phase: wf.phase, kernelTerminal: kernelHandle, currentRun, runs: [] };
    for (const runId of runIds) {
      const run = { runId, current: runId === currentRun, bound: null, closed: [], kept: 0, unclosable: [], errors: [] };
      const listed = taskList({ run: runId });
      if (!listed.ok) { run.errors.push(`task-list: ${listed.error || listed.errorCode || 'no listing'}`); entry.runs.push(run); continue; }
      const plan = staleTasks(listed.tasks, { heldTaskIds });
      run.kept = plan.keep.length;
      const coordinator = run.current && kernelHandle ? kernelHandle : null;
      // A leased job is a dispatch in flight: its Task exists before the job names it.
      const inFlight = jobs.some((j) => j.kind !== 'kernel' && j.status === 'leased');
      if (coordinator && plan.close.length && inFlight) run.deferred = { reason: 'dispatch-in-flight', tasks: plan.close.map((task) => task.id) };
      else if (coordinator && plan.close.length) {
        const bound = dryRun ? { ok: true, action: 'unchecked' } : bindWorkflowRun({ runId, kernelHandle: coordinator });
        run.bound = bound.action;
        if (!bound.ok) run.errors.push(bound.error ?? `run ${runId} not bound`);
        else for (const task of plan.close) {
          if (dryRun) { run.closed.push({ taskId: task.id, title: task.task_title ?? null, wouldClose: true }); continue; }
          const r = taskUpdate({ id: task.id, status: TASK_CLOSED_STATUS, run: runId, from: coordinator });
          if (r?.ok) { task.status = TASK_CLOSED_STATUS; run.closed.push({ taskId: task.id, title: task.task_title ?? null }); }
          else run.errors.push(`task-update ${task.id}: ${r?.error || 'refused'}`);
        }
      } else if (!run.deferred) run.unclosable = plan.close.map((task) => task.id);
      // Bookkeeping: a settled job whose Task Orca shows closed, or no longer lists, is closed in the ledger.
      const byId = new Map(listed.tasks.map((task) => [task.id, task]));
      run.ledgerClosed = [];
      for (const { job, payload } of openLedgerTasks) {
        if (runIdOf(payload) !== runId || HELD.includes(job.status)) continue;
        const task = byId.get(operationTaskOf(payload).taskId);
        if (task && !CLOSED_TASK_STATUSES.has(task.status)) continue;
        run.ledgerClosed.push(job.job_id);
        if (dryRun) continue;
        const taskClosed = { taskId: operationTaskOf(payload).taskId, status: task?.status ?? 'absent', ok: true,
          verifiedBy: task ? 'orca-task-list' : 'orca-task-list-absent', at: now };
        ledger.transaction(() => updateJob(db, { jobId: job.job_id, payload: { ...payload, taskClosed }, at: now }));
      }
      entry.runs.push(run);
    }
    const closed = entry.runs.reduce((n, r) => n + r.closed.length, 0);
    const ledgerClosed = entry.runs.reduce((n, r) => n + r.ledgerClosed.length, 0);
    const rebound = entry.runs.some((r) => r.bound === 'rebound');
    if (!dryRun && (closed || ledgerClosed || rebound)) {
      ledger.transaction(() => ledger.appendEvent({ workflowId: wf.workflow_id, entityType: 'workflow', entityId: wf.workflow_id,
        generation: wf.generation ?? 0, kind: 'orca-tasks-reconciled',
        payload: { kernelTerminal: kernelHandle, runs: entry.runs.map((r) => ({ runId: r.runId, current: r.current, bound: r.bound,
          closed: r.closed.map((c) => c.taskId), unclosable: r.unclosable, ledgerClosed: r.ledgerClosed, errors: r.errors })) } }));
    }
    report.push(entry);
  }
  const totals = report.reduce((t, e) => {
    for (const r of e.runs) { t.closed += r.closed.length; t.unclosable += r.unclosable.length; t.ledgerClosed += r.ledgerClosed.length; t.errors += r.errors.length; t.rebound += r.bound === 'rebound' ? 1 : 0; }
    return t;
  }, { closed: 0, unclosable: 0, ledgerClosed: 0, rebound: 0, errors: 0 });
  const out = { ok: totals.errors === 0, mode: 'orca-tasks', dryRun, totals, workflows: report };
  emit(out, [`orca-tasks${dryRun ? ' (dry run)' : ''}: ${totals.closed} open Task(s) ${dryRun ? 'would close' : 'closed'}, ${totals.unclosable} unclosable (no live coordinator), ${totals.ledgerClosed} ledger row(s) marked closed, ${totals.rebound} Run(s) re-bound, ${totals.errors} error(s)`,
    ...report.flatMap((e) => e.runs.filter((r) => r.closed.length || r.unclosable.length || r.deferred || r.errors.length || r.bound === 'rebound')
      .map((r) => `  ${e.workflowId} ${r.runId}${r.current ? ' (current)' : ''}: closed ${r.closed.length}, unclosable ${r.unclosable.length}${r.deferred ? `, deferred ${r.deferred.tasks.length} (${r.deferred.reason})` : ''}${r.bound ? `, run ${r.bound}` : ''}${r.errors.length ? `; errors: ${r.errors.join('; ')}` : ''}`))].join('\n'), args.json);
  if (!out.ok) process.exitCode = 1;
}

// Ambiguous state remains fenced and requires owner/runtime intervention.
/* ------------------------------------------------------ settle helpers */
// A job's owned paths resolved per target repository, against the dispatch
// contract's worktree (where the worker was placed) when it recorded one.
const contractWorktreeOf = (db, job, repo) => {
  const context = parseJson(latestContractOf(db, job.job_id)?.context_json);
  return typeof context?.worktree === 'string' ? path.resolve(repo, context.worktree) : null;
};
function jobPlacements(db, job, repo) {
  const op = jobOpOf(job), payload = jobPayloadOf(job);
  return ownedPathPlacements({ op, payload, ownedPaths: ownedPathsOf(payload), repo, worktree: contractWorktreeOf(db, job, repo), timeoutMs: allocationMs('settleGit.commandMs') });
}

// The owned paths a report's files may name: the declared spellings plus each
// retargeted path as the packet showed it — bare in the worker's or ledger
// checkout, rooted at its own checkout otherwise (scripts/kernel/target-repo.mjs).
function reportOwnedPaths(db, job, repo) {
  const declared = ownedPathsOf(jobPayloadOf(job));
  let placements = [];
  try { placements = jobPlacements(db, job, repo); } catch { return declared; }
  const checkouts = [repo, contractWorktreeOf(db, job, repo)].filter(Boolean).map((p) => path.resolve(p));
  const resolved = placements.filter((p) => !p.unresolved && p.via !== 'placement').flatMap((p) => {
    const rooted = slash(path.resolve(p.base, p.path));
    return checkouts.includes(path.resolve(p.base)) ? [p.path, rooted] : [rooted];
  });
  return [...new Set([...declared, ...resolved])];
}

// The visual proof a pass owes (job-artifacts.mjs proofMediaGate over the op's policy.proofMedia): read-only,
// before anything is written. A leg admitted before the job-proof-media change settles on its old contract.
function settleProofMedia(db, jobId, repo, reportAbs, reportText) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status)) return null;
  const op = jobOpOf(job), policy = proofMediaPolicyOf(skillRoot, op);
  if (!policy) return null;
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), PROOF_MEDIA_CHANGE);
  if (admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  const envelope = filed.envelope ?? (reportText !== null ? parseJson(reportText) : null);
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope, roots, jobId: job.job_id, artifacts: filed.artifacts });
  const recorded = independentChecksOf(db, { jobId: job.job_id })?.checks;
  const gate = proofMediaGate({ policy, files, checks: [...(Array.isArray(recorded) ? recorded : []), ...(Array.isArray(envelope?.checks) ? envelope.checks : [])] });
  return gate ? { ...gate, op, status: job.status } : null;
}
// The Sonar gate a code-writing op's settle owes (scripts/kernel/sonar-settle.mjs over knowledge/sonar-gate.yaml): the
// runtime reads the op's attached sonar.json itself. Read-only here - api settle records the judgment. A leg admitted before
// the sonar-enforce change settles on its old contract. Null when the op is not held to the gate.
function settleSonarGate(db, jobId, repo) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status)) return null;
  const op = jobOpOf(job);
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), SONAR_ENFORCE_CHANGE);
  if (admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  if (filed.attemptId == null || filed.reportId == null) return null; // no filed report: pass-report-missing owns the refusal
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope: filed.envelope, roots, jobId: job.job_id, artifacts: filed.artifacts });
  const judgment = judgeJob({ op, files });
  return judgment ? { ...judgment, workflowId: job.workflow_id, jobId: job.job_id, attemptId: filed.attemptId, status: job.status } : null;
}
// The op loop a code-writing op's settle owes (scripts/kernel/gate-settle.mjs over knowledge/op-gate.yaml): the runtime re-reads
// the op's attached gate JSON and READ digest itself and resolves the touched kinds with the app's own hfs explain. Read-only
// here - api settle records the judgment. A leg admitted before the op-gate-loop change settles on its old contract. Null when
// the op is not held to the loop.
async function settleOpGate(db, jobId, repo) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status)) return null;
  const op = jobOpOf(job);
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), OP_GATE_CHANGE);
  if (admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  if (filed.attemptId == null || filed.reportId == null) return null; // no filed report: pass-report-missing owns the refusal
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope: filed.envelope, roots, jobId: job.job_id, artifacts: filed.artifacts });
  // A workflow-worktree op is gated against its workflow's previous checkpoint (op-gate-base-mismatch otherwise).
  const wfCtx = { db, env: process.env };
  const expectedBase = workflowWorktreeOf(wfCtx, job.workflow_id) ? gateBaseOf(wfCtx, job.workflow_id) : null;
  const judgment = await judgeJobLoop({ op, files, roots: roots.length ? roots : [repo], expectedBase });
  return judgment ? { ...judgment, jobId: job.job_id, attemptId: filed.attemptId, status: job.status } : null;
}
// The mechanism proofs an op owes at settle (scripts/kernel/gate-settle.mjs judgeJobProofs over knowledge/op-gate.yaml opProofs):
// the test world, the unit kit, the document gate, the READ of a deciding op, the lint of a security or interface op, the review
// gate and defect classes, the release proof. The runtime re-reads each attached document itself. Read-only here - api settle
// records the judgment. A leg admitted before the op-mechanism-proofs change settles on its old contract. Null when the op owes
// no proof for its mode.
async function settleOpProofs(db, jobId, repo) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status)) return null;
  const op = jobOpOf(job);
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), OP_PROOF_CHANGE);
  if (admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  if (filed.attemptId == null || filed.reportId == null) return null; // no filed report: pass-report-missing owns the refusal
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope: filed.envelope, roots, jobId: job.job_id, artifacts: filed.artifacts });
  const mode = typeof jobPayloadOf(job).params?.mode === 'string' ? jobPayloadOf(job).params.mode : null;
  const judgment = judgeJobProofs({ op, files, mode });
  return judgment ? { ...judgment, jobId: job.job_id, attemptId: filed.attemptId, status: job.status } : null;
}
// The draw acceptance an interface.draw pass owes (scripts/work/draw/draw-acceptance.mjs): every asset the pass binds -
// written, adopted, inherited or already there - is a token-rendered shape, no drawing names a data status, and the pass
// drew something under the current contract (nivo op-interface.draw-7c2821e002 adopted 40 image-gen files unchanged).
// Read-only, before anything is written. A leg admitted before the draw-adopt-gate change settles on its old contract.
function settleDrawAcceptance(db, jobId, repo, reportAbs, reportText) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status) || jobOpOf(job) !== 'interface.draw') return null;
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), DRAW_ACCEPTANCE_CHANGE);
  if (admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  const envelope = filed.envelope ?? (reportText !== null ? parseJson(reportText) : null);
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope, roots, artifacts: filed.artifacts });
  const owned = (jobPayloadOf(job).owned_paths ?? []).filter((p) => typeof p === 'string' && !p.includes(':'));
  const verdict = drawAcceptanceFindings({ repo, files: [...files.map((f) => f.abs), ...owned] });
  // A code a contract change added after this leg was admitted is a suspect for it, never a refusal.
  const advisory = Number.isFinite(admitted.at) ? new Set(advisoryCodesFor(loadContractChanges(skillRoot), { admittedAt: admitted.at, op: 'interface.draw', withheld: admitted.withheld }).codes) : new Set();
  const findings = verdict.findings.filter((f) => !advisory.has(f.code));
  return findings.length ? { op: jobOpOf(job), status: job.status, findings, records: verdict.records } : null;
}
// The draw loop's machine metrics, RE-RUN by the runtime (scripts/work/draw-loop-settle.mjs): every live part of every
// ui record the pass binds is re-rendered from its render source and re-measured - the capture, the DNA gate, the
// taste metrics, the palette, the Grammar geometry and the ui-proof score - never the loop's self-reported numbers.
// A leg admitted before the draw-loop-dna change settles on its old contract; a code it added is advisory for it.
async function settleDrawMetrics(db, jobId, repo, reportAbs, reportText) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status) || jobOpOf(job) !== 'interface.draw') return null;
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), DRAW_LOOP_CHANGE);
  if (admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  const envelope = filed.envelope ?? (reportText !== null ? parseJson(reportText) : null);
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope, roots, artifacts: filed.artifacts });
  const owned = (jobPayloadOf(job).owned_paths ?? []).filter((p) => typeof p === 'string' && !p.includes(':'));
  const verdict = await settleDrawMetricFindings({ repo, files: [...files.map((f) => f.abs), ...owned] });
  const advisory = Number.isFinite(admitted.at) ? new Set(advisoryCodesFor(loadContractChanges(skillRoot), { admittedAt: admitted.at, op: 'interface.draw', withheld: admitted.withheld }).codes) : new Set();
  const findings = verdict.findings.filter((f) => !advisory.has(f.code));
  return findings.length ? { op: jobOpOf(job), status: job.status, findings, records: verdict.records, loops: verdict.loops } : null;
}
// The Work hygiene a pass owes when it changed files under .starciwork/ or .starcistacks/ (scripts/work/validate/work-hygiene.mjs,
// the same parse + scoped strict validate + secret scan the product repo's pre-commit hook runs): the files its report
// names plus every file its commits changed since the base it was admitted on. Read-only, before anything is written.
// A leg admitted before the work-hygiene-gate change settles on its old contract.
function settleWorkHygiene(db, jobId, repo, reportAbs, reportText) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status)) return null;
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), WORK_HYGIENE_CHANGE);
  if (!change || admittedBeforeChange(admitted, change)) return null;
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  const envelope = filed.envelope ?? (reportText !== null ? parseJson(reportText) : null);
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope, roots, artifacts: filed.artifacts });
  const changed = files.map((f) => f.abs);
  const { head, base } = jobShasOf({ envelope, result: null, payload: jobPayloadOf(job) });
  if (head) for (const root of [...new Set([repo, ...roots].filter(Boolean).map((r) => path.resolve(r)))]) {
    for (const rel of rangeFiles(root, base ?? `${head}~1`, head)) if (inSecretScope(rel)) changed.push(path.join(root, rel));
  }
  const checked = checkWorkFilesAbs([...new Set(changed.filter((p) => inSecretScope(p)))]);
  return checked.ok ? null : { op: jobOpOf(job), status: job.status, findings: checked.findings, files: checked.files };
}
// The grammar proposals an interface.draw job carries (scripts/work/grammar-proposal.mjs): one grammar-proposal-filed
// event each, status proposed - the owner decides them, never the runtime. Never un-settles.
function recordSettledGrammarProposals(ledger, job, repo) {
  if (jobOpOf(job) !== 'interface.draw') return [];
  try {
    const bound = jobBoundFiles(ledger.db, job.job_id);
    const files = (bound?.files ?? []).filter((f) => typeof f === 'string' && !f.includes(':')).map((f) => (path.isAbsolute(f) ? f : path.resolve(repo, f)));
    // A bound file inside a ui record also carries the record's proposals (beside its parts and in its loops).
    const dirs = new Set(files.map((f) => { const m = /^(.*[\\/]\.starciwork[\\/]features[\\/][^\\/]+[\\/]ui[\\/][^\\/]+)/.exec(f); return m ? m[1] : null; }).filter(Boolean));
    return recordGrammarProposals(ledger, { job, repo, files: [...files, ...dirs] });
  } catch { return []; }
}
// The artwork slots an interface.draw or interface.asset job's files carry (scripts/work/asset-slot.mjs): one
// asset-slot-owed event per placeholder slot, one asset-slot-filled per slot whose data-asset-sha256 names the bytes of
// its src. Never un-settles.
function recordSettledAssetSlots(ledger, job, repo) {
  if (!['interface.draw', ASSET_OP].includes(jobOpOf(job))) return { owed: [], filled: [] };
  try {
    const bound = jobBoundFiles(ledger.db, job.job_id);
    const files = (bound?.files ?? []).filter((f) => typeof f === 'string' && !f.includes(':')).map((f) => (path.isAbsolute(f) ? f : path.resolve(repo, f)));
    const dirs = new Set(files.map((f) => { const m = /^(.*[\\/]\.starciwork[\\/]features[\\/][^\\/]+[\\/]ui[\\/][^\\/]+)/.exec(f); return m ? m[1] : null; }).filter(Boolean));
    return recordAssetSlots(ledger, { job, repo, files: [...files, ...dirs] });
  } catch { return { owed: [], filled: [] }; }
}
// Every output of a settled job, whatever its verdict, indexed into job_artifacts with its patch
// (job-artifacts.mjs). An index failure never un-settles; it rides on the receipt, and the backfill retries it.
function indexSettledArtifacts(ledger, job, repo) {
  let placements = null;
  try { placements = jobPlacements(ledger.db, job, repo); } catch { placements = null; }
  try {
    const r = indexJobArtifacts(ledger, { repo, jobId: job.job_id, dispatchId: reportDispatchIdOf(ledger.db, job), placements });
    const logs = settleJobLogs(ledger, job, repo);
    return r.ok ? { indexed: r.indexed, byKind: r.byKind, patch: r.patch, ...(r.patchJson ? { patchJson: r.patchJson } : {}), ...(r.missing.length ? { missing: r.missing.slice(0, 20) } : {}), logs } : { error: r.error, logs };
  } catch (error) { return { error: String(error?.message ?? error) }; }
}
// A settled job's typed log is complete: the op's own rows came through `api log`, and the rows its settle events stand
// for are derived here (typed-logs.mjs). A failure never un-settles; the next read of the workflow's logs catches up.
function settleJobLogs(ledger, job, repo) {
  let logs = null;
  try {
    logs = openLogs(repo);
    const derived = syncLogs(logs, ledger.db, { repo }).derived;
    const typedMissing = warnTypedLogGaps(ledger, logs, job);
    return { derived: derived.inserted, ...(typedMissing ? { typedMissing } : {}) };
  } catch (error) { return { error: String(error?.message ?? error) }; }
  finally { try { logs?.close(); } catch { /* closing */ } }
}
// LOG_TYPED_MISSING (WARN, never a refusal): an op job settled without the typed rows it owed of itself - a step.start,
// a step.end and a cmd.run per check its report ran (typed-logs.mjs typedLogGaps). Recorded once per job as a
// log-typed-missing ledger event (api status logTypedMissing) and a runtime `warning` row in the job's own log.
function warnTypedLogGaps(ledger, logs, job) {
  if (job.kind === 'kernel' || !jobOpOf(job)) return null;
  const { envelope } = filedReportOf(ledger.db, job, { dispatchId: reportDispatchIdOf(ledger.db, job) });
  const gaps = typedLogGaps(logs, { jobId: job.job_id, checks: Array.isArray(envelope?.checks) ? envelope.checks : [] });
  if (!gaps.missing.length) return null;
  const op = jobOpOf(job);
  const out = { code: LOG_TYPED_MISSING, level: 'warn', missing: gaps.missing, opRows: gaps.opRows };
  const prepared = prepareLogRow({ workflowId: job.workflow_id, jobId: job.job_id, actor: 'runtime', kind: 'warning', level: 'warn', src: `ltm:${job.job_id}`,
    msg: `${LOG_TYPED_MISSING}: op không ghi đủ nhật ký có cấu trúc (${gaps.missing.slice(0, 3).join(', ')}${gaps.missing.length > 3 ? ', …' : ''})`,
    data: { code: LOG_TYPED_MISSING, message: `${op} attempt ${tryOf(job)} settled with ${gaps.opRows} op log row(s); missing ${gaps.missing.join('; ')}`.slice(0, 1500), missing: gaps.missing.slice(0, 40),
      hint: 'op prompt logging: block - api log step.start, step.end and cmd.run per check' } });
  if (prepared.row) insertLogRows(logs, [prepared.row]);
  const seen = ledger.db.prepare('SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1').get(LOG_TYPED_MISSING_EVENT, job.job_id);
  if (!seen) ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: LOG_TYPED_MISSING_EVENT,
    payload: { jobId: job.job_id, op, attempt: tryOf(job), code: LOG_TYPED_MISSING, level: 'warn', missing: gaps.missing.slice(0, 40), opRows: gaps.opRows, kinds: gaps.kinds } }));
  return out;
}
/** The LOG_TYPED_MISSING warnings of a workflow's newest settled op jobs (log-typed-missing events), newest first. */
function typedLogWarningsOf(db, workflowId, { limit = 20 } = {}) {
  return db.prepare('SELECT entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT ?').all(workflowId, LOG_TYPED_MISSING_EVENT, limit)
    .map((e) => { const p = parseJson(e.payload_json) ?? {}; return { jobId: e.entity_id, op: p.op ?? null, attempt: p.attempt ?? null, code: LOG_TYPED_MISSING, level: 'warn', missing: Array.isArray(p.missing) ? p.missing : [], opRows: p.opRows ?? 0, at: e.created_at }; });
}

/**
 * The settle's async tail for one settled job (owner ruling settle-runtime-service): session retention, the Telegram
 * media sender, the input re-baseline, artifact indexing (evidence copy + typed logs). Each step is best effort and
 * never un-settles; {ok, sessionReleased, artifacts, errors}. Run inline by settle under the test runner, else by
 * `api settle-tail` (scripts/kernel/verbs/settle-tail.mjs), retried by the settler until it succeeds.
 */
async function runSettleTail(ledger, job, repo, { verdict = null } = {}) {
  const db = ledger.db, jobId = job.job_id, errors = [];
  const payload = jobPayloadOf(job);
  const settledVerdict = verdict ?? jobResult(db, jobId)?.verdict ?? payload.verdict ?? null;
  let sessionReleased = null;
  try {
    sessionReleased = await releaseSettledSession({ db, job, payload, repo, archiveRoot: allocationSettings()?.housekeeping?.archiveRoot ?? null,
      beforeArchive: ({ agent, files }) => { recordSettledAttemptUsage(ledger, { jobId, agent, files }); } });
  } catch (error) { sessionReleased = { released: false, reason: String(error?.message ?? error) }; }
  if (sessionReleased) {
    ledger.transaction(() => {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
      updateJob(db, { jobId, payload: { ...stored, sessionReleased } });
    });
  }
  // The owner sees on Telegram what a draw or UAT op produced (the drawn
  // screens, the UAT videos): a detached sender, so Telegram never slows or
  // fails the settle (scripts/connectors/telegram-media.mjs).
  try { queueSettleMedia({ repo, ledgerFile: ledgerFileFor(repo), workflowId: job.workflow_id, jobId, attempt: tryOf(job), op: jobOpOf(job), verdict: settledVerdict, dispatchId: reportDispatchIdOf(db, job) }); }
  catch (error) { errors.push(`media: ${String(error?.message ?? error).slice(0, 200)}`); }
  // The product records this job read, re-baselined to the bytes it settled on: its own writes are
  // its result, and only a later change from outside its workflow makes it stale (input-digests.mjs).
  try {
    const contract = latestContractOf(db, jobId);
    const context = parseJson(contract?.context_json);
    const rebased = context?.inputs ? baselineWorkInputs(context.inputs, repo, { workDir: workDirOf(repo) }) : null;
    if (rebased && rebased !== context.inputs) {
      ledger.transaction((tx) => updateContractContext(tx, { attemptId: contract.attempt_id, context: { ...context, inputs: rebased } }));
    }
  } catch (error) { errors.push(`baseline: ${String(error?.message ?? error).slice(0, 200)}`); }
  const artifacts = indexSettledArtifacts(ledger, job, repo);
  if (artifacts?.error) errors.push(`artifacts: ${String(artifacts.error).slice(0, 200)}`);
  return { ok: errors.length === 0, sessionReleased, artifacts, errors };
}

// Managed settle — calls.yaml settle-dispatch: worker-stop then
// worker-release the exact Dispatch. A stop that classifies unknown is
// reconciled by a worker-show read and the residual state is recorded on
// the settle result (worker-abandon stays out of scope here — it is only
// legal once the attempt's own terminal is proven closed). A stop/release
// failure never un-settles the job; the ledger row already stands.
// The agent quits itself first with ITS OWN quit input (quit-agent.mjs; a
// managed worker is not always Claude), so worker-stop/release find nothing
// running. `custody` is the proof the worker is gone (custodyOf).
function releaseManagedWorker(db, job, settledPayload, repo) {
  const managed = settledPayload.managed;
  let stop = null, release = null, residual = null;
  const managedQuit = quitAgent({ handle: managed.agentTerminalHandle ?? null, agent: agentOfJob(settledPayload) ?? 'claude' });
  try { stop = workerStop({ dispatch: managed.dispatchId }); }
  catch (e) { stop = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
  if (stop?.ok !== true || stop?.outcome === 'unknown') {
    try {
      const shown = workerShow({ dispatch: managed.dispatchId });
      residual = { ok: shown?.ok === true, state: shown?.state ?? null, effective: shown?.effective ?? null };
    } catch (e) { residual = { error: String(e?.message ?? e) }; }
  }
  try { release = workerRelease({ dispatch: managed.dispatchId }); }
  catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
  // Orca answers release_unknown ("the agent terminal was closed but its
  // process could not be confirmed stopped") while the Claude terminal is
  // still connected; two settled nivo business.decide ops sat live as
  // ORPHAN_TERMINAL until a second release closed them. Its own recovery is
  // to repeat worker-release, so a release that is not ok is repeated once
  // and the exact agent terminal is read back; a terminal still connected
  // after that is closed by its exact handle and the receipt says so.
  let agentTerminal = null;
  const agentHandle = managed.agentTerminalHandle ?? null;
  if (release?.ok !== true && agentHandle) {
    const connectedNow = () => { try { const s = terminalShow({ terminal: agentHandle }); return s?.ok === true ? s.connected === true : null; } catch { return null; } };
    let retry = null;
    try { retry = workerRelease({ dispatch: managed.dispatchId }); }
    catch (e) { retry = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; }
    agentTerminal = { handle: agentHandle, retryRelease: { ok: retry?.ok === true, state: retry?.state ?? null }, connected: connectedNow() };
    if (agentTerminal.connected === true) {
      const closed = closeOperationTerminal(agentHandle);
      agentTerminal.closed = closed.ok === true;
      agentTerminal.connected = connectedNow();
    }
  }
  // worker-release closes the agent's pane, not its tab; the tab outlives it
  // in Orca's layout and the session comes back under a new handle.
  let agentTab = null;
  if (agentHandle && !agentTerminal?.closed) agentTab = closeOperationTerminal(agentHandle, { tabOnly: true });
  const reaped = agentHandle ? reapIfStillLive(db, job, settledPayload, agentHandle, repo) : null;
  if (reaped) agentTerminal = { ...(agentTerminal ?? { handle: agentHandle }), reaped };
  return {
    dispatchId: managed.dispatchId,
    stop: { ok: stop?.ok === true, outcome: stop?.outcome ?? null, state: stop?.state ?? null, ...(stop?.error ? { error: stop.error } : {}) },
    release: { ok: release?.ok === true, outcome: release?.outcome ?? null, state: release?.state ?? null, ...(release?.error ? { error: release.error } : {}) },
    ...(residual ? { residual } : {}),
    ...(agentTerminal ? { agentTerminal } : {}),
    ...(agentTab ? { agentTab: { tab: agentTab.tab ?? null, ok: agentTab.ok === true } } : {}),
    ...(managedQuit ? { quit: managedQuit } : {}),
    custody: custodyOf({ release, agentHandle }),
  };
}

// A plain operation terminal's release: a still-connected agent quits with its own quit input and
// its terminal closes; custody is read back (custodyOf). {handle, ok, quit?, tab?, error?, custody}.
function quitWorkerTerminal(handle, payload) {
  let shown = null;
  try { shown = terminalShow({ terminal: handle }); } catch { shown = null; }
  let quit = null, closed = null;
  if (shown?.ok && shown.connected === true) {
    quit = quitAgent({ handle, agent: agentOfJob(payload) });
    closed = closeOperationTerminal(handle);
  }
  return { handle, ok: closed ? closed.ok === true : true, ...(quit ? { quit } : {}), ...(closed?.tab ? { tab: closed.tab } : {}),
    ...(closed?.error ? { error: closed.error } : {}), custody: custodyOf({ release: closed ? { ok: closed.ok === true } : null, agentHandle: handle }) };
}

// Whether a settled op's worker is proven gone - read back, never inferred from Orca's release
// answer: `released` when the release (worker-release, or the terminal close) said ok, or when the
// exact agent terminal now reads disconnected or unknown to a running Orca. A dead worker's
// terminal has nothing left to release, and Orca still answers release_unknown/retained for it:
// settle receipts said "release unknown/retained" for workers whose leases were released, whose
// Task was closed and whose terminal was disconnected (inc-eb9a21769d69, inc-a253fdf2deda,
// inc-fbff1e65b60f, inc-d1c5a963c8bb). `retained` only while that terminal still reads connected;
// `unknown` when Orca does not answer. {state, proof, terminal?}.
function custodyOf({ release = null, agentHandle = null } = {}) {
  if (release?.ok === true) return { state: 'released', proof: 'release-ok' };
  if (!agentHandle) return { state: 'unknown', proof: 'no-terminal-handle' };
  let shown = null;
  try { shown = terminalShow({ terminal: agentHandle }); } catch { shown = null; }
  if (shown?.ok && shown.connected !== true) return { state: 'released', proof: 'terminal-disconnected', terminal: agentHandle };
  if (shown && !shown.ok && !shown.hostUnavailable && TERMINAL_GONE_CODES.has(shown.errorCode)) return { state: 'released', proof: 'terminal-gone', terminal: agentHandle };
  if (shown?.ok && shown.connected === true) return { state: 'retained', proof: 'terminal-connected', terminal: agentHandle };
  return { state: 'unknown', proof: shown?.hostUnavailable ? 'host-unavailable' : 'terminal-unreadable', terminal: agentHandle };
}

// 'completed' is Task closure, not a verdict: the verdict lives in the ledger.
// An op that fails still leaves no open Task. Orca accepts only pending,
// ready, dispatched, completed, failed or blocked; the former 'done' was
// refused on every call, so no settle or finish ever closed a Task and 133
// settled operations piled up as open worker-task entries in the sidebar.
export const TASK_CLOSED_STATUS = 'completed';

function closeOperationTask(db, job, payload, kernelHandle) {
  const task = operationTaskOf(payload);
  if (!task) return null;
  if (payload?.taskClosed?.ok === true) return payload.taskClosed;
  const from = kernelHandle !== undefined ? kernelHandle : latestKernelJobOf(db, job.workflow_id)?.worker_id ?? null;
  if (kernelHandle === undefined) bestEffort(() => bindRunToKernel({ db, workflowId: job.workflow_id, runId: task.runId }));
  const r = bestEffort(() => taskUpdate({ id: task.taskId, status: TASK_CLOSED_STATUS, run: task.runId, from }));
  return { taskId: task.taskId, status: TASK_CLOSED_STATUS, ok: r?.ok === true, ...(r?.error ? { error: String(r.error) } : {}) };
}

/* ------------------------------------------------------------- op IPC */
// The op-IPC durability verbs: contracts out (kernel→worker, written at
// dispatch), reports in (worker→kernel, filed by the worker), checks beside
// them. The files on disk stay the artifacts; the rows are the durable
// signal the kernel consumes.
// A handover ask reaches the owner only with every must-have proven (proof-integrity.mjs coverageOf): an FR whose
// requiresProof has a required kind and whose evidence is missing or stale refuses it handover-proof-owed. Any other
// unproven item is flagged on stderr and belongs in the package's "not proven" section. A coverage that cannot be
// computed refuses too (fail closed). A leg admitted before the proof-integrity change hands over as admitted.
function handoverProofGate(db, job, repo) {
  const admitted = admittedContractOf(db, job);
  const change = changeById(loadContractChanges(skillRoot), PROOF_INTEGRITY_CHANGE);
  if (!change || admittedBeforeChange(admitted, change)) return;
  let cov;
  try { cov = coverageOf(db, job.workflow_id, { repo, notCounted: specsOff(ownerSpecs(skillRoot)) }); }
  catch (error) { throw Object.assign(new Error(`handover-proof-unjudged: api coverage could not be computed (${String(error?.message ?? error).slice(0, 300)}); a handover cannot claim proof it cannot read`), { code: 'handover-proof-unjudged' }); }
  if (cov.mustOwed.length) {
    throw Object.assign(new Error(`handover-proof-owed: ${cov.mustOwed.map((i) => `${i.kind} ${i.id} is ${i.status}`).join('; ')}. A must-have is never handed over unproven: file outcome blocked, blocker kind test-gap, naming each; the Kernel re-runs the check that proves it (api coverage --workflow ${job.workflow_id}, api status nextActions)`), { code: 'handover-proof-owed', owed: cov.mustOwed });
  }
  const flagged = cov.items.filter((i) => i.status !== 'proven');
  if (flagged.length) console.error(`api report WARNING: ${flagged.length} scoped item(s) not proven, none a must-have: ${flagged.slice(0, 12).map((i) => `${i.kind} ${i.id} ${i.status}`).join(', ')}${flagged.length > 12 ? ', ...' : ''}; the package lists them under what was not proven`);
}

/* --------------------------------------------------------------- report */
// Worker-facing: the report file is a starci/op-report@1 JSON envelope — the
// row is the durable signal and the ONLY shape the kernel reads
// (UNIQUE(workflow_id,dispatch_id) makes a re-file idempotent). The api stamps
// run/task/dispatch/from from the job row; a file that claims a different
// identity is report-invalid. --outcome is optional consistency: when given it
// must equal the envelope's outcome.
/**
 * RELEASE ON REPORT (owner 2026-09-28: "tức là kernel xong việc không tự đóng op à?"): once `api report` validated and
 * filed an op's report, its worker has nothing left to do - the report and the evidence are in the ledger and files -
 * so the runtime closes it now instead of waiting for the Kernel's settle: the agent terminal is closed and verified
 * gone with its process tree (close-verify.mjs; from the op's own terminal a detached verifier does it after this
 * process exits). payload.workerReleased {at, by: 'report', ...} records it with custody `releasing`; settle still
 * runs its own verified close, which then only proves the release (and does it when it is missing, e.g. a failed
 * close or failed-no-report). Exception: an `ask` report keeps its worker - the answer arrives in that same session.
 * A managed worker is released by settle (worker-stop/-release). Best effort: a close failure never touches the report.
 */
function releaseWorkerOnReport(ledger, job, payload, report) {
  try {
    if (report?.outcome === 'ask' || payload?.managed?.dispatchId) return null;
    const handle = job.worker_id ?? payload?.orca?.agentTerminalHandle ?? payload?.launchTerminal?.handle ?? null;
    if (!handle || releasedWhileHeldOf(payload)) return null;
    const closed = closeSelfSafe(handle, { owner: 'report', tree: true });
    const at = Date.now();
    ledger.transaction(() => {
      const fresh = ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(job.job_id);
      const stored = parseJson(fresh?.payload_json) ?? {};
      updateJob(ledger.db, { jobId: job.job_id, at, payload: { ...stored,
        workerReleased: { at, by: 'report', handle, outcome: report?.outcome ?? null, detached: Boolean(closed?.detached),
          custody: { state: closed?.detached ? 'releasing' : closed?.ok ? 'closed-verified' : 'close-failed', proof: closed?.proof ?? null } } } });
      ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'worker-released-on-report',
        payload: { handle, outcome: report?.outcome ?? null, detached: Boolean(closed?.detached), ok: closed?.ok ?? false, proof: closed?.proof ?? null } });
    });
    return closed;
  } catch { return null; /* settle closes it; the tick GC reaps a leftover */ }
}

/* ---------------------------------------------------------------- check */
// The verification half: upsert the re-run check results for an op attempt
// (one row per workflow_id,op_id,attempt).
// A red check that names its `failing` files is attributed (scripts/kernel/gate-attribution.mjs):
// class peer marks it peerBlocked {peers[], routes[]}, which summarizeCheckEvidence counts neither
// passed nor failed. Only the api decides: a caller-supplied peerBlocked or attribution is dropped.
// A red check with no `failing` list is attributed on the source files its own evidence/output text
// names (failingFromText), recorded as failing + failingDerived: nivo collab's Kernel re-ran the
// typecheck, wrote the peer's tsc line into the evidence and filed no list, so the peer's red was
// counted this op's and the same op re-ran for hours.
function attributeChecks(db, { repo, job, checks }) {
  let canon;
  return checks.map((check) => {
    if (!check || typeof check !== 'object') return check;
    const { peerBlocked: _peer, attribution: _attr, failingDerived: _derived, ...clean } = check;
    if (clean.exitCode === 0 || clean.advisory) return clean;
    const listed = Array.isArray(clean.failing) && clean.failing.length;
    const failing = listed ? clean.failing : failingFromText([clean.evidence, clean.output].filter((v) => typeof v === 'string').join('\n'));
    if (!failing.length) return clean;
    const derived = listed ? {} : { failing, failingDerived: true };
    if (canon === undefined) canon = leaseCanonOf(db, repo);
    let attribution;
    try { attribution = attributeRedGate(db, { repo, job, failing, canon }); }
    catch (error) { return { ...clean, ...derived, attribution: { class: 'unknown', error: String(error?.message ?? error) } }; }
    // Every failing file is a Work record outside the job's owned paths that nothing touched since the lineage
    // began: inherited debt, recorded advisory (neither passed nor failed) with the files named, never this op's fail.
    if (attribution.class === 'foreign') return { ...clean, ...derived, attribution: { class: 'foreign', files: attribution.files },
      advisory: { changes: [], outOfScope: attribution.files.map((f) => f.path), why: 'every failing file is a Work record outside the owned paths of this job, untouched since its lineage began' } };
    if (attribution.class !== 'peer') return { ...clean, ...derived, attribution: { class: attribution.class, files: attribution.files } };
    return { ...clean, ...derived, attribution: { class: 'peer', files: attribution.files },
      peerBlocked: { peers: attribution.peers, routes: attribution.peers.map((peer) => peerRouteOf(job.workflow_id, peer, clean.name)) } };
  });
}

/* ------------------------------------------------------ reap-agent-process */
// A settled op's terminal that still reads connected after its close is an
// agent process Orca could not stop (stop_unverified, no renderer pane). Five
// such Claude/Codex workers ran hidden on a machine short of memory until the
// supervisor matched and stopped them by hand. The match is the agent image
// started inside the op's dispatch window, and only a single candidate is
// stopped (scripts/kernel/reap-agent-process.mjs).
// The worker's own agent CLI: its routed provider/model, else Claude for a managed Dispatch (the
// managed pool's agent). A managed worker used to get Claude's quit input whatever it ran.
const agentOfJob = (payload) => /^(claude|codex|devin)/i.exec(String(payload?.provider ?? payload?.agent ?? payload?.model ?? payload?.route?.agent ?? ''))?.[1]?.toLowerCase()
  ?? (payload?.managed ? 'claude' : null);
// The launches of every OTHER live agent this host's ledgers know - running, answering or leased
// ops (their latest op-dispatched time; a leased one is launching now) and running kernels (their
// latest boot/restart/adopt) - in this ledger and every config.yaml supervisor.repos ledger. The
// reaper stops no candidate process that one of them may own (reap-agent-process.mjs: on
// 2026-09-23 it killed live Codex workers of other ops, other workflows and other repos that
// launched in the settled op's window). Null when a listed ledger cannot be read.
const launchesIn = (db, exclude, now) => db.prepare("SELECT job_id,workflow_id,kind,status,updated_at FROM jobs WHERE status IN ('leased','running','answering')").all()
  .filter((row) => row.job_id !== exclude)
  .map((row) => ({ id: row.job_id, at: row.kind === 'kernel'
    ? db.prepare(`SELECT MAX(created_at) at FROM events WHERE workflow_id=? AND kind IN (${KERNEL_LAUNCH_EVENTS.map(() => '?').join(',')})`).get(row.workflow_id, ...KERNEL_LAUNCH_EVENTS)?.at ?? row.updated_at
    : row.status === 'leased' ? now
    : db.prepare("SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind='op-dispatched'").get(row.job_id)?.at ?? row.updated_at }));
function liveAgentLaunches(db, { repo = null, exclude = null, now = Date.now() } = {}) {
  try {
    const launches = launchesIn(db, exclude, now);
    const key = (p) => path.resolve(p).toLowerCase();
    const seen = new Set(repo ? [key(repo)] : []);
    let listed = [];
    try { listed = (loadConfig()?.supervisor?.repos ?? []).map((r) => path.resolve(starciSourceRoot(), r)); } catch { listed = []; }
    for (const other of listed) {
      if (seen.has(key(other))) continue;
      seen.add(key(other));
      if (!fs.existsSync(ledgerFileFor(other))) continue;
      const rows = withLedgerRead(other, (odb) => launchesIn(odb, exclude, now), null);
      if (!rows) return null;
      launches.push(...rows);
    }
    return launches;
  } catch { return null; }
}
function reapIfStillLive(db, job, payload, handle, repo = null) {
  let shown = null;
  try { shown = terminalShow({ terminal: handle }); } catch { return null; }
  if (!shown?.ok || shown.connected !== true) return null;
  const dispatched = db.prepare("SELECT created_at FROM events WHERE workflow_id=? AND entity_id=? AND kind='op-dispatched' ORDER BY seq DESC LIMIT 1").get(job.workflow_id, job.job_id)?.created_at ?? null;
  const otherLaunches = liveAgentLaunches(db, { repo, exclude: job.job_id });
  try { return reapAgentProcess({ agent: agentOfJob(payload), dispatchedAt: dispatched, otherLaunches }); }
  catch (error) { return { reaped: false, reason: String(error?.message ?? error) }; }
}
// Path leases of a running job whose worker is not proven dead are renewed to a full
// dispatchLeaseTtlMs once less than half of it is left (api status). Settle and the dead-worker
// recovery still release them; only a worker nobody observes can outlive its fence.
function renewLiveWorkerLeases(ledger, workers, now) {
  const live = workers.filter((worker) => ['running', 'answering'].includes(worker.ledgerStatus) && !DEAD_WORKER_LIVENESS.includes(worker.liveness) && worker.liveness !== 'released');
  if (!live.length) return 0;
  let renewed = 0;
  try {
    ledger.transaction(() => {
      for (const worker of live) {
        const due = ledger.db.prepare('SELECT 1 FROM leases WHERE job_id=? AND expires_at<? LIMIT 1').get(worker.jobId, now + DISPATCH_LEASE_TTL_MS / 2);
        if (due) renewed += renewLeases(ledger.db, { jobId: worker.jobId, expiresAt: now + DISPATCH_LEASE_TTL_MS, at: now });
      }
    });
  } catch { /* a busy ledger renews on the next status */ }
  return renewed;
}

/* -------------------------------------------------------------- autopilot */
// The autopilot surface (scripts/kernel/autopilot.mjs; owner ruling 2026-09-28 autopilot-run-to-finish). Every write
// is an autopilot-* event by autopilot or by the supervisor; nothing here records an owner answer.
/* ------------------------------------------------------ caller boundary */
// An op worker ran node:sqlite against .starciwork/runtime.sqlite to inspect
// jobs (inc-360891316369). The op contract already forbade it; the owner wants
// the boundary enforced, not instructed. What the api can enforce:
//  - the op launch carries no ledger path (the packet and prompt name only the
//    api verbs);
//  - Orca exports ORCA_TERMINAL_HANDLE into every terminal it owns, including
//    every worker-start agent (whose env StarCi cannot set), so a caller whose
//    handle is the bound terminal of an op job IS that op;
//  - from an op caller the api refuses every kernel verb, and `report` only
//    files for the caller's own job (whose dispatch/contract binding
//    requireDispatchedReportBinding already proves).
// Residual (modules/kernel/api.yaml conventions.callerBoundary): a worker
// running with unattended permissions can still read the ledger file or unset
// the marker; the api cannot stop raw file access, only refuse its verbs.
// The shared-checkout guard of one op launch (scripts/guards/hook-install.mjs,
// modules/kernel/api.yaml conventions.sharedCheckout): the job's owned paths as
// absolute paths for the command guard (bound to the worker's terminal once it
// starts), and the history hook in every checkout the job writes. Best effort — a guard that cannot be put in place rides on the
// dispatch receipt and never refuses the launch.
const opGuardLaunch = ({ job, jobId, repo, placements, workerCwd, workflowWorktree = null }) => {
  try {
    const items = (placements ?? []).filter((p) => p && !p.unresolved && p.base);
    const owned = items.map((p) => path.resolve(p.base, String(p.path ?? '.').replace(/[\\/]\*\*[\\/]?$/, '') || '.'));
    const gitRoot = (value) => {
      let dir = path.resolve(value);
      while (true) {
        if (fs.existsSync(dir)) {
          const root = gitResult(['rev-parse', '--show-toplevel'], { dir, timeout: 10_000 });
          if (root.ok && root.stdout.trim()) return path.resolve(root.stdout.trim());
        }
        const parent = path.dirname(dir);
        if (parent === dir) return path.resolve(value);
        dir = parent;
      }
    };
    const repos = [...new Set([workerCwd ?? repo, ...items.map((p) => p.base)].filter(Boolean).map(gitRoot))];
    let config = null;
    try { config = loadConfig(); } catch { config = null; }
    return guardLaunch({ skillRoot, jobId, workflowId: job.workflow_id, ledgerRepo: repo, owned, repos, config, workflowWorktree });
  } catch (e) {
    return { receipt: { error: String(e?.message ?? e) } };
  }
};
/* ------------------------------------------------------------------ extensions */
// New verbs, boolean flags and status fields are files, not edits of the shared lines above
// (scripts/kernel/api-extensions.mjs; lane land-throughput 2026-09-28).
const API_EXT = await loadApiExtensions();
// Shared runtime helpers supplied to the per-verb modules; each implementation stays in one place.
const API_INTERNALS = Object.freeze({
  skillRoot, SETTLED, opSlotAdmission, queuedSeamsOf, observeOperationWorker, AGENT_HIERARCHY_SCHEMA,
  kernelNodeId, operationNodeId, openOwnerGates, ownerGateOf, refuseStaleKernelRev, latestGraphNodesOf,
  deferQueuedTestLeg, refuseKernelBias, providerHealthOf, circuitClearHint, resolveModel,
  buildPacket, bestEffort, rejectDispatch, DISPATCH_LEASE_TTL_MS, opLeaseRequests,
  livePathLeaseWait, reserveOpLeases, buildContractMarkdown, fileContract, envServicesOf,
  environmentPreStep, raiseEnvironmentIncident, recordLaunchTerminal, ensureWorkflowRun,
  createOperationTask, opGuardLaunch,
  runSettleTail, ownerRoot, agentHierarchyOf, bindRunToKernel, foundationDutyOf,
  FINAL_SETTLED, staleInputProjection, staleOperationLine, sourceDriftLines, peerDriftLines,
  resolveJob, parseAttempt, reportDispatchIdOf, OWNER_GATE_KINDS,
  getWorkflow, indexSettledArtifacts,
  stagedInputEvidenceOf, livenessMsOf, ACTIVE_STALE_MS, workerOutageEvidence, recordWorkerOutageEvidence,
  LAUNCH_GRACE_MS, workerCardOf, GATE_ANSWERED_EVENT, runningOpRevDriftOf,
  workerInputRowText, INPUT_ROW_PLACEHOLDER, runtimeOwnedInput, TERMINAL_NOT_WRITABLE, UNWRITABLE_EVENT,
  requireDispatchedReportBinding, reportOwnedPaths, reportIdentityOf,
  handoverProofGate, reportFiledWake, releaseWorkerOnReport,
  isCheckResultEnvelope, attributeChecks, buildOpsOf, markMeasured, isPeerBlockedCheck,
  summarizeCheckEvidence,
  normalizeProviderId, providerQuotaProbeCommand, providerRecoverCommand,
  currentCredentialOf,
  accountsOnceOf: () => accountsOnce,
  refuseDecisionsFirst, goalLegOf, workflowFinished,
  ACTIONABLE_FRONTIER_STATES, CUT_SET_CLOSING_CHECK, DEAD_WORKER_LIVENESS, LEG_IN_FLIGHT, NEXT_ACTION_MOVES,
  QUEUED_BECAUSE, approvedLegOps, askFormAlive, cutSeamViewOf, cutSetStateOf, graphProjectionOf,
  heldSettleText, nextActionLabel, opRevDriftOf, poolLoadOf, queuedBecauseOf, recordDependencies,
  renewLiveWorkerLeases, rereadActionOf, seamActionsOf, staleLabel, statusWorkerRowsOf, typedLogWarningsOf,
  prefetchStatusOrcaReads, withStatusSpawnMemo, setStatusAsk: (value) => { statusAsk = value; },
  refuseSettleBacklog, operationTerminalHandleOf, jobPayloadOf,
  releaseTypedWaits, openPeerWaits, PEER_WAIT,
  goalJsonOf, latestGoal, csvList,
  lineageRouteAdjust, accountList, probeQuotaSafe,
  configuredAllocationPolicy, loadConfig, recentDispatchCounts, kindRouteOf, auditAuthorOf,
  isFanOutSlice, selectPool, blockingViewOf, parseYaml, fs, path,
  reconcileOrphanKernelJobs, reconcileOrcaTasks,
  reconcileDrop, reconcileReap, reconcileReleaseWorker, reconcileDeadWorker,
  cleanupManagedWorker,
  releaseManagedWorker, closeOperationTask, custodyOf, quitWorkerTerminal,
  CUT_SLICE_CHECKS, VERDICT_OUTCOMES, agentOfJob, canonSettleFollowUp, enqueueNextStep, failureClassOf,
  failureShapeOf, latestKernelJobOf, reapIfStillLive, recordOpRevDrift,
  recordSettledAssetSlots, recordSettledGrammarProposals, releasedWhileHeldOf, seamSettleReconciles,
  settleDrawAcceptance, settleDrawMetrics, settleOpGate, settleOpProofs, settleProofMedia, settleSonarGate, settleWorkHygiene, widenCanonWire,
});
let statusAsk = null;
const runExtensionVerb = async (spec, args, repo) => {
  for (const k of requiredOf(spec, args)) need(args[k], `${spec.verb} needs --${k}`);
  if (typeof spec.validate === 'function') spec.validate(args, need);
  if (spec.ledger === false) return await spec.run({ ledger: null, args, repo, emit, need, caller: null, ext: API_EXT, internals: API_INTERNALS });
  let ledger;
  try { ledger = openRepoLedger(repo); } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
    process.exit(1);
  }
  const caller = callerOf(ledger.db);
  if (caller.role === OP_ROLE && spec.kernelOnly) {
    refuseOpCaller(ledger, { cmd: spec.verb, caller, code: 'op-context-refused',
      detail: `'${spec.verb}' is a kernel verb and this caller is operation ${caller.jobId ?? '(unbound)'} (${caller.via}); an op files its own api report and nothing else` });
  }
  if (caller.role === OP_ROLE && spec.jobOwnerOnly && caller.jobId !== args.job) {
    refuseOpCaller(ledger, { cmd: spec.verb, caller, code: 'report-identity-mismatch',
      detail: `operation ${caller.jobId ?? '(unbound)'} (${caller.via}) may file a report only for its own job, not ${args.job}` });
  }
  try { return await spec.run({ ledger, args, repo, emit, need, caller, ext: API_EXT, internals: API_INTERNALS }); } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code }));
    process.exit(1);
  } finally { ledger.close(); }
};

/* ------------------------------------------------------------------ main */
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') { const lines = extensionUsage(API_EXT); if (lines.length) console.log(`extension verbs (scripts/kernel/verbs):\n${lines.join('\n')}\n`); }
  if (!cmd || cmd === '--help' || cmd === '-h') usage(cmd ? 0 : 2);
  const args = parseArgs(argv.slice(1));
  const repo = path.resolve(args.repo ?? process.cwd());
  if (API_EXT.verbs.has(cmd)) return runExtensionVerb(API_EXT.verbs.get(cmd), args, repo);
  usage(2);
}

main();
