#!/usr/bin/env node
// cli.mjs — the kernel agent's ONLY gate to the ledger. One thin command per
// state operation; the long-lived [Kernel] never opens .starciwork/runtime.sqlite
// itself and never spawns op terminals by hand — `dispatch` owns that.
//
//   starci kernel <cmd> --repo <path> [...] [--json]
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
//   reconcile --repo <path> --orphan-kernel-jobs [--workflow <id>] [--dry-run]
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
//   report   --repo <path> --job <job_id> --report <file> [--outcome <done|partial|failed|ask|blocked>] [--dispatch-capability <cap>]
//   op-contract --repo <path> --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
//   record-checks --repo <path> --job <job_id> (--checks '<json>' | --checks-file <path>)
//   consume-report --repo <path> --job <job_id>
//   (enqueue also takes [--after <jobId>,...]: jobs that must settle succeeded first)
//   incident --repo <path> --workflow <id> --kind <k> --detail <s> [--op <opId>] [--holds <opId|jobId>,...]
//   incident --repo <path> --workflow <id> --kind peer-wait --peer <workflowId> --detail <s> [--op <opId>] [--holds ...] [--refs <csv>] [--until-message]
//   incident --repo <path> --workflow <id> --resolve <incidentId> [--detail <s>] [--by kernel|owner|supervisor] [--owner-answer <dispatchId>]
//   (incident also takes typed release conditions, [--until-record <path>[@state|>=rev]] [--until-job <jobId>[:settled|succeeded]]
//    [--until-message <peer>[:kind]] [--until-commit <repo>:<ref-or-path>] [--until-incident <id>[:resolved]], each repeatable,
//    or --attach <incidentId> with them to type an open incident; scripts/kernel/gate-conditions.mjs)
//   finish   --repo <path> --workflow <id>
//   kernel-ack-rev --repo <path> --workflow <id> --plan | --rev <revision> --read-manifest <file>
//   run-deferred-tests --repo <path> --workflow <id> [--kind unit|e2e|integration] [--dry-run]
//
// Every read prints a JSON-safe result; every write runs inside one
// ledger.transaction. --json gives the machine form; without it each command
// prints a compact human line. Bad arguments exit 2 with usage.

import { mechanismGates } from './settle/mechanism-gates.mjs';
import { stripSlashes } from './settle/canon-parity.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode } from '../api/node/run-node.mjs';
import {
  openLedger, ledgerFileFor, newToken, JOB_STATUSES, OP_SLOT_HOLDING_STATUSES as SLOT_HOLDING_STATUSES, reserveTwoPhase,
  startAttempt, writeContract, updateContractContext, updateAttempt, endRejectedAttempt, setJobStatus, recordJobResult, releaseLeases, openIncident,
  updateJob, updateIncident, renewLeases, clearSignal, setInboxStatus, jobResult, setUnitState, getUnit,
} from '../../engine/db/ledger.mjs';
import { machineFileFor, openMachine } from '../../engine/db/machine.mjs';
import { recordWhy } from './why-record.mjs';
import { opGateBasesOf } from './workflow-checkpoint.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import {
  RETRY_CLASS_ENVIRONMENT, workflowOpSlots,
  findOwnedPathLeaseConflicts, ownedPathLeaseRequests, retiredBeforeDispatch, ownedPathsIntersect,
} from '../../engine/admission.mjs';
import { admitUnit, spentTriesOf, unitStateOf, writeUnitTry } from './units.mjs';
import { independentChecksOf } from './verbs/shared/check-evidence.mjs';
import { activeDelegation, allocationMs, allocationSettings, configuredAllocationPolicy, inspectOwnerConfig, loadConfig, runtimeProfile } from '../../engine/config.mjs';
import { OP_REPORT_OUTCOMES } from './report-envelope.mjs';
import { ownedPathEffects } from './owned-path-effects.mjs';
import { lineageJobsOf } from '../machine/owner-answers.mjs';
import { isAwaitingOwner } from './failure-steps.mjs';
import { planGraphOf } from '../route/plan-edges.mjs';
import { lineageRouteAdjust } from './lineage-route.mjs'; import { queuedBecauseKinds } from './op-incident-policy.mjs';
import { enqueueRepository, ownedPathPlacements } from './target-repo.mjs';
import { loadAdapter, PROMPT_DELIVERY_STALLED, gateAutoAnswerRule } from '../agent/lib.mjs';
import { withStatusSpawnMemo, statusWorkerRowsOf, prefetchStatusOrcaReads } from './status-memo.mjs';
import { DOMAIN_PARALLEL_OPS, LEG_IN_FLIGHT, NEXT_ACTION_MOVES, disjointDomains, graphProjectionOf, latestGraphNodesOf, nextActionLabel, ownerGateOf } from './graph-projection.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { TERMINAL_GONE_CODES } from '../lib/orca-terminal.mjs';
import { workerObservation } from './worker-observation.mjs';
import { queuedDependencyDetail } from './queued-dependency-detail.mjs';
import { parseJson } from '../lib/json.mjs';
import { isMain } from '../lib/is-main.mjs';
import { ownerLanguage as ownerLanguageOf, translator } from '../lib/i18n.mjs';
// The reads the split-out verbs share with what stays here: one definition per helper (scripts/kernel/verbs/shared/).
import {
  csvList, getWorkflow, goalJsonOf, jobOpOf, jobPayloadOf, operationTerminalHandleOf, latestGoal, ownedPathsOf, recordPathsOf, workDirOf, operationDispatchOf,
} from './verbs/shared/rows.mjs';
import { JOB_ROW, jobResultSql, latestAttemptOf, latestKernelJobOf } from '../machine/job-row.mjs';
import { agentOfJob } from '../lib/job-agent.mjs';
import { kernelSeatOf } from './verbs/shared/kernel-seat.mjs';
import { dispatchEvidenceOf } from './verbs/shared/dispatch-state.mjs';
import { foundationDutyFor } from './verbs/shared/foundation-duty.mjs';
import { resolveJob, reportDispatchIdOf, REPORTABLE_JOB_STATUSES, requireDispatchedReportBinding, parseAttempt, reportIdentityOf } from './verbs/shared/report-binding.mjs';
import { AGENT_HIERARCHY_SCHEMA, workflowNodeId, kernelNodeId, operationNodeId, agentHierarchyFor } from './verbs/shared/agent-hierarchy.mjs';
import { WORKER_QUESTION } from './verbs/shared/worker-messages.mjs';
import { PEER_WAIT, blockingViewOf, leaseCanonOf, openPeerWaits, releaseTypedWaits } from './verbs/shared/peer-waits.mjs';
import { VerbExit } from './verbs/shared/verb-exit.mjs';
import { OP_ROLE, callerOf, refuseOpCaller } from '../guards/op-caller.mjs';
import { callerAdmission, requireAdmittedKernelRead } from './caller-admission.mjs';
import { slash } from '../lib/path-key.mjs';
import { releaseSettledSession } from './op-session.mjs';
import { recordSettledAttemptUsage } from './usage-record.mjs';
import {
  AUTOPILOT_BY,
  AUTOPILOT_EVENTS,
  SUPERVISOR_GATE,
  deferredQueueCause,
  openSupervisorGate,
  routeCapUnderAutopilot,
} from './autopilot-run.mjs';
import {
  classifyAgentScreen, staleAwareState, outputAgeOf, exitedAgentPromptRow, echoesSentText,
  clipDraft, TRAILING_ROWS, cardLivenessPatterns, DEFAULT_STAGED_PATTERN,
} from '../lib/terminal-liveness.mjs';
import { squash } from '../lib/clip.mjs';
import { wakeKernelForTransition } from './wake-delivery.mjs';
import { FOUNDATION_WAIT, SHELL_FOUNDATION, shellFoundationWaitOf } from './shell-foundation.mjs';
import {
  KERNEL_REV_STALE, KERNEL_REV_UNKNOWN, OP_REV_DRIFT, currentRuntimeRev, kernelRevState, opRevDrift, opRevStale, revRootOf,
  shortRev,
} from './runtime-rev.mjs';
// Pool selection and launch-model resolution, plus the Orca orchestration
// wrappers the managed-agent dispatch path drives — one thin wrapper per
// calls.yaml verb (run-create/worker-start/worker-show/worker-stop/
// worker-release).
import { providerCircuitOf } from '../agent/models.mjs';
import { readProviderCircuit, writeProviderCircuit as storeProviderCircuit } from '../machine/provider-circuit.mjs';
import { credentialFingerprintOf, credentialRotated } from '../agent/credential-fingerprint.mjs';
import { QUOTA_FAILURE_KIND, outageSpecsOf, outageInText, outageOnScreen } from '../agent/provider-outage.mjs';
import { deferJob, deferralOf as testDeferralOf, ownerSpecs, specsOff } from '../route/spec-deferral.mjs';
import { admittedVersionOf } from './dispatch-admission.mjs';
import { baselineWorkInputs, inputDrift } from './input-digests.mjs';
import { admittedContractOf, latestContractOf } from '../machine/contract-version.mjs';
import { queueSettleMedia } from '../connectors/telegram-media.mjs';
import { guardLaunch } from '../guards/hook-install.mjs';
import { attributeRedGate, failingFromText, peerRouteOf } from './gate-attribution.mjs';
import { accountList } from '../api/orca/account-list.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { salvageUnfiledReport, unfiledReportCandidates } from './report-salvage.mjs';
import { revParseQuery } from '../api/git/rev-parse-query.mjs'; import { gitResultOf } from '../lib/git.mjs';
import { hostWideDisconnectOf } from './host-event.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { closeWorker } from '../machine/worker-close.mjs';
import { workflowDisplayName } from '../lib/display-names.mjs';
import {
  SEAM_RECONCILE_CHECK,
  cutSeamSettings,
  isSeamCut,
  recutPlanOf,
  seamPriorityOf,
  seamReconcileOf,
  seamStateOf,
  siblingSeamHold,
  cutManifestOf,
  canonSettleFollowUpOf,
  canonConformancePolicy,
} from './seam-policy.mjs';
import { preservedRefOf } from './preserved-ref.mjs';
import { destinationsOf } from './progress-rca.mjs';
import {
  LOG_TYPED_MISSING, LOG_TYPED_MISSING_EVENT, insertLogRows,
  openLogs, prepareLogRow, syncLogs, typedLogGaps,
} from './typed-logs.mjs';
import { bindWorkflowRun } from './orca-runs.mjs';
import { UNTIL_FLAGS, lineageHeadById } from './gate-conditions.mjs';
import { extensionUsage, loadApiExtensions, requiredOf, statusExtras } from './api-extensions.mjs';
import { refuseSettleBacklog } from './kernel-authority.mjs';
import { refuseDecisionsFirst } from '../machine/decisions.mjs';
import { drawAcceptanceFindings, jobBoundFiles } from '../work/draw/draw-acceptance.mjs';
import { settleDrawMetricFindings } from '../work/draw-loop-settle.mjs';
import { recordGrammarProposals } from '../work/grammar-proposal.mjs';
import { ASSET_OP, recordAssetSlots } from '../work/asset-slot.mjs';
import { judgeJob } from './sonar-settle.mjs';
import { collectJobFiles, evidenceHostPathGate, filedReportOf, indexJobArtifacts, jobShasOf, proofMediaGate, proofMediaPolicyOf } from './job-artifacts.mjs';
import { checkWorkFilesAbs, inSecretScope, rangeFiles } from '../work/validate/work-hygiene.mjs';
import { legOrderExemption } from './leg-order.mjs';
import { proofAcceptanceOf, coverageOf, verifyProofs } from './proof-integrity.mjs';
import { classifyFailure, isMeasurementLeg, measurementCheckClass, resolveRootOwner } from './verify-failure.mjs';
import { readEnv } from '../lib/env.mjs';
import { bestEffortCall } from '../agent/best-effort-call.mjs';
import { normalizeProvider } from '../lib/provider.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// The owner config (config.yaml) lives at the runtime root. STARCI_OWNER_ROOT points the one
// reader in engine/config.mjs at a different directory holding one — the same test and tooling
// seam scripts/kernel/start-workflow.mjs and scripts/route/route-model.mjs use.
const ownerRoot = readEnv('STARCI_OWNER_ROOT') ? path.resolve(readEnv('STARCI_OWNER_ROOT')) : skillRoot;

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
    // codes: the finding codes that made a red check red (scripts/machine/contract-version.mjs
    // classifyChecks reads them against the leg's admitted contract).
    if (check.codes != null && (!Array.isArray(check.codes) || !check.codes.every((code) => typeof code === 'string'))) return false;
    // failing: the files a red check's failure implicates (scripts/kernel/gate-attribution.mjs).
    if (check.failing != null && (!Array.isArray(check.failing) || !check.failing.every((file) => typeof file === 'string'))) return false;
    return true;
  });
};
// A red check recorded as `advisory` because its unchanged Work inputs are outside the owned
// scope is a suspect, and one marked `peerBlocked` (its failing files are a
// peer's change, scripts/kernel/gate-attribution.mjs) is the peer's: neither counts passed or
// failed, and a pass still needs at least one green check.
const isAdvisoryCheck = (check) => check.exitCode !== 0 && Array.isArray(check.advisory?.outOfScope) && check.advisory.outOfScope.length > 0;
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
    // A measurement leg's check that ran and measured findings (starci kernel record-checks marks it `measured`,
    // scripts/kernel/verify-failure.mjs) is a completed measurement: it counts passed.
    const measured = value.checks.filter(isMeasuredCheck).length;
    const declared = value.checks.filter(isDeclaredGreen).length, unavailable = value.checks.filter(isUnavailableCheck).length;
    const passed = value.checks.filter((check) => check.exitCode === 0 && !isDeclaredGreen(check) && !isUnavailableCheck(check)).length + measured;
    const failed = value.checks.length - passed - advisory - peerBlocked - declared - unavailable;
    return { observed: value.checks.length, passed, failed, green: passed > 0 && failed === 0, ...(declared ? { declared } : {}), ...(unavailable ? { unavailable } : {}), ...(advisory ? { advisory } : {}), ...(peerBlocked ? { peerBlocked } : {}), ...(measured ? { measured } : {}) };
  }
  const summary = { observed: 0, passed: 0, failed: 0 };
  const countLeaf = (item, normalizedKey) => {
    if (normalizedKey === 'exitcode' || normalizedKey === 'exit_code') {
      const code = Number(item);
      if (!Number.isFinite(code)) return;
      summary.observed += 1;
      if (code === 0) summary.passed += 1;
      else summary.failed += 1;
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
  const visit = (item, key = '') => {
    const normalizedKey = String(key).trim().toLowerCase();
    if (Array.isArray(item)) {
      for (const entry of item) visit(entry, normalizedKey);
      return;
    }
    if (item && typeof item === 'object') {
      for (const [childKey, child] of Object.entries(item)) visit(child, childKey);
      return;
    }
    countLeaf(item, normalizedKey);
  };
  visit(value);
  return { ...summary, green: summary.observed > 0 && summary.failed === 0 && summary.passed > 0 };
};

const usage = (code) => {
  console.error(`use: starci kernel <cmd> --repo <path> [...] [--json]
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
  reconcile --job <job_id> [--drop --reason <text> | --dead-worker [--settle-failed] [--no-salvage] | --release-worker]
  reconcile --orphan-kernel-jobs [--workflow <id>] [--dry-run]   kernel jobs of finished/archived workflows -> cancelled
  nudge    --job <job_id>
  observe  --job <job_id> [--lines <n>]
  questions --workflow <id>
  messages  --workflow <id>   every orchestration message on the workflow's Runs (read-only; the 'You have N orchestration messages' notice)
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
  record-checks --job <job_id> (--checks '<json>' | --checks-file <path>)
  consume-report --job <job_id>
  serve-ask --workflow <id> [--dispatch <id>] [--ttl <ms>] [--now]
  retire-ask --workflow <id> --dispatch <id> --reason <text>
  incident --workflow <id> --kind <k> --detail <s> [--op <opId>] [--holds <opId|jobId>,...]
           [--introduced-by <commit>,... | --introducer <workflowId>] [--fix <text>]  (--kind shared-blocker: routed to the introducing workflow as a follow-up)
           [--peer <workflowId> [--refs <csv>] [--until-message]]  (--peer and a bare --until-message only with --kind peer-wait)
  incident --workflow <id> --resolve <incidentId> [--detail <s>] [--by kernel|owner|supervisor] [--owner-answer <dispatchId>]
           typed release (repeatable; the runtime resolves the incident once all hold):
           [--until-record <path>[@state|>=rev]] [--until-job <jobId>[:settled|succeeded]]
           [--until-message <peer>[:kind]] [--until-commit <repo>:<ref-or-path>] [--until-incident <id>[:resolved]] [--until-foundation <name>] [--until-landed <workflowId>@<repository>] [--until-runtime-has <commit>] [--until-admission <jobId>] [--until-check <jobId>:<name>]
  incident --workflow <id> --attach <incidentId> --until-<type> <spec> ...   type an open incident's release
  provider-health --provider <p> [--recover --reason <text> [--probe]]
           the ledger provider-health row; --recover clears an open circuit (Kernel terminal only)
  provider-health [--provider <p>] --quota-probe [--force]
           an open quota circuit: a real 1-token completion at most once per probe.everyMs (and right after
           the plan reset); a pass clears it (the kernel watchdog runs it under --repair)
  finish   --workflow <id>
  cut-seam --publish-interface --job <seam job> --files <csv> [--summary <s>]   the seam publishes its interface: siblings start on it
  cut-seam --release --workflow <id> --op <op> --cut-id <id> --reason <text>     the Kernel releases a cut's siblings to run on a stub now
  cut-seam --reconcile --job <sibling job> --exit-code <n> [--command <c>] [--evidence <path>]   cut-seam-reconcile of a stub sibling against the landed seam
  kernel-ack-rev --workflow <id> --plan | --rev <revision> --read-manifest <file>
  autopilot --workflow <id> [--sweep|--bundle|--checklist [--lang vi|en]|--set on|off --reason <s>|--defer-to-handover --op <opId> --class credential|real-money|shared-system|owner-decision --detail <s> [--fields <csv>] [--stub <s>] [--job <id>]|--release <dispatchId|key> --reason <s>|--defer-leg <jobId> --reason <s>|--reopen <dispatchId> --handover-answer <dispatchId> [--note <s>]|--extend-budget attempts=<n>,tokens=<n>,wallMs=<n> --reason <s>]
           attest the complete server-derived current-incarnation READ manifest (required-read.mjs)
  archive  --workflow <id> --reason <text> [--by owner|supervisor]
           stop a workflow that will not finish: archived_at set, open jobs dropped, asks retired, Kernel and Tasks closed
  rename   --workflow <id> --title "<name>" [--by owner|supervisor] [--no-terminals] [--dry-run]
           set the workflow's display name (workflow_id unchanged); renames its live [Kernel] and [Op] tabs
  run-deferred-tests --workflow <id> [--kind unit|e2e|integration] [--dry-run]
           re-queue the test legs the owner's config.yaml specs switches deferred (starci kernel status testsDeferred)`);
  throw new VerbExit(code);
};
const BOOLEAN_FLAGS = new Set(['json', 'spawn', 'drop', 'to-owner', 'deliveries', 'dead-worker', 'settle-failed', 'release-worker', 'route-failure', 'now', 'recover', 'probe', 'until-message', 'orphan-kernel-jobs', 'dry-run', 'sweep', 'bundle', 'checklist', 'defer-to-handover', 'declare-none', 'quota-probe', 'force', 'no-terminals', 'publish-interface', 'release', 'reconcile']);
// A --until-<type> <spec> collects in order as [type, spec] (gate-conditions.mjs); a bare
// --until-message keeps its peer-wait meaning (any next message from --peer).
const untilSpecOf = (argv, i) => {
  const k = argv[i];
  if (!UNTIL_FLAGS.includes(k.slice(2))) return null;
  if (k === '--until-message' && (argv[i + 1] === undefined || argv[i + 1].startsWith('--'))) return null;
  const v = argv[i + 1];
  if (v === undefined) usage(2);
  return [k.slice('--until-'.length), v];
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
    const until = untilSpecOf(argv, i);
    if (until) { a.until ??= []; a.until.push(until); i += 1; continue; }
    if (API_EXT.flags.has(k.slice(2))) { a[k.slice(2)] = true; continue; }   // scripts/kernel/api-extensions.mjs
    const name = k.slice(2);
    if (BOOLEAN_FLAGS.has(name)) { a[name] = true; continue; }
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
// minutes; a worker sat leased at a PowerShell prompt, nudged, with no report, until the
// Kernel wrote an incident by hand.
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
// modules/models/runtimes.yaml — the pool cards and the worker ceiling. Every
// concurrency number this gate reasons with comes from here, through the one
// cached loader (engine/config.mjs runtimeProfile): a missing or unparsable
// file throws, never reads as an empty document.
const poolCardFor = (doc, target) => Object.entries(doc?.runtimes ?? {})
  .find(([poolId, runtime]) => (runtime?.target ?? poolId) === target)?.[1] ?? null;
const workersMaxParallelOps = () => {
  const value = Number(runtimeProfile()?.maxParallelOps);
  return Number.isInteger(value) && value > 0 ? value : null;
};
/**
 * The owner's concurrent-operation budget. A missing, unparsable or schema-short config.yaml must
 * never stop a workflow from routing (the same tolerance start-workflow and route-model keep), so
 * an unreadable owner file leaves `maxOps` unbounded and the worker ceiling admits alone.
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
  return workflowOpSlots(db, workflowId, { excludeJobId, holdingStatuses: SLOT_HOLDING_STATUSES, maxOps: ownerMaxOps(), maxParallelOps: workersMaxParallelOps() });
};

/**
 * The queued cut seams of a workflow that a free slot would launch: ordinal 1 of a cut of more than one,
 * not held by an owner-gate or peer-wait. starci kernel dispatch gives them the workflow's last free slot.
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
const goalFieldOf = (boundGoal, payload, goal) => { const selected = boundGoal ?? (payload.goal_binding?.revision == null ? goal : null); return selected ? { goal: goalForPacket(boundGoal ?? goal) } : {}; }; const workflowStopLabel = (wf) => { if (!wf) { return 'unknown'; } return wf.archived_at ? 'archived' : wf.phase; };

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
    const text = squash(rows[i].replace(INPUT_ROW_GLYPH, ''));
    if (text) return text;
  }
  return null;
};
// What a provider paints in an EMPTY input row: Codex 'Ask Codex to do anything', Devin
// 'Ask/Guide/Message Devin ...', Claude's rotating 'Try "..."' hint,
// the queued-message Enter prompts. Painted placeholder is not input text.
const INPUT_ROW_PLACEHOLDER_PARTS = String.raw`ask (?:codex|claude|devin)\b|message devin\b|guide devin\b|enter a prompt\b|press enter to send queued messages\b|press up to (?:edit|select) (?:a )?queued messages?\b|you have \d+ orchestration messages?\b|try\s*["'“]`;
const INPUT_ROW_PLACEHOLDER = new RegExp('^(?:' + INPUT_ROW_PLACEHOLDER_PARTS + ')', 'iu');
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
// starci kernel nudge answers it, one op-worker-gate-answered event per answer. After `limit` answers on the same
// attempt (the gate's maxPerAttempt, default GATE_ANSWER_LIMIT) the gate is a loop, not a prompt: the
// worker reads `gate-loop`, nudge refuses it, and it recovers like a wedged worker through
// reconcile --dead-worker --settle-failed, so repeats across attempts become a retry-loop finding
// (a provider's "A potential loop was detected" menu).
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
// process incarnation, and every terminal created before the update refuses (inc-f1b576fb6006). A nudge records that
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
// caller that reasons on the same frame (starci kernel nudge's foreign-input check) does not read the terminal
// a second time with a TOCTOU window between classification and send.
// The screen read of a live, writable terminal: a bare-shell prompt, the input draft, the classified
// state with its gate and an outage error row the provider CLI rendered (evidence for the provider
// circuit; an active turn is getting completions, so an old error row above it proves nothing).
const workerScreenRead = (db, job, terminalHandle, { frame }) => {
  const out = { shellPrompt: null, inputDraft: null, screen: null, screenState: null, screenGate: null, providerOutage: null };
  try {
    const read = terminalRead({ terminal: terminalHandle, screen: true });
    // A frame ending in a bare shell prompt: the agent exited and its
    // terminal is a plain shell that would run a nudge as a command.
    if (read?.ok) out.shellPrompt = exitedAgentPromptRow(read.screen);
    // The input box's draft is read in its input row (Orca lifts it out of the frame): the
    // contract left unsubmitted there is staged input, not an idle prompt.
    if (read?.ok) out.inputDraft = read.draft ?? null;
    if (read?.ok && frame) out.screen = read.screen ?? null;
    if (read?.ok) {
      const classified = out.shellPrompt ? { state: 'agent-exited' } : classifyAgentScreen(read.screen, { ...(db ? stagedInputEvidenceOf(db, job) : {}), draft: out.inputDraft });
      out.screenState = classified.state;
      out.screenGate = classified.state === 'interactive-gate' ? classified.gate ?? null : null;
    }
    if (read?.ok && out.screenState !== 'active') out.providerOutage = workerOutageEvidence(job, read.screen);
  } catch { /* terminal-show fallback below remains conservative */ }
  return out;
};

// Released while its settle is held (reconcile --release-worker on a held job): its report is
// consumed and its terminal is closed on purpose, so there is nothing left to observe.
const releasedObservation = (job, terminalHandle, now) => {
  const releasedWhileHeld = jobPayloadOf(job).workerReleased;
  if (releasedWhileHeld?.custody?.state !== 'released') return null;
  return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness: 'released', releasedAt: releasedWhileHeld.at ?? null,
    heldBy: releasedWhileHeld.heldBy ?? null, observedAt: now };
};
// A leased job with no worker bound is a launch: in flight until its lease deadline (jobs.deadline,
// dispatchLeaseTtlMs after the lease), abandoned after it. A dispatch killed mid-spawn (a shell timeout
// around starci kernel dispatch, inc-c1d5bdbea173) leaves exactly that row.
const launchObservation = (job, terminalHandle, now) => {
  if (job.status !== 'leased' || terminalHandle) return null;
  const deadline = Number(job.deadline);
  return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle: null,
    liveness: deadline > 0 && deadline <= now ? 'launch-abandoned' : 'launching', leaseDeadline: deadline > 0 ? deadline : null,
    ...(jobPayloadOf(job).launchTerminal?.handle ? { launchTerminal: jobPayloadOf(job).launchTerminal.handle } : {}), observedAt: now };
};

const observeOperationWorker = (job, now = Date.now(), db = null, { frame = false } = {}) => {
  const terminalHandle = operationTerminalHandleOf(job);
  const early = releasedObservation(job, terminalHandle, now) ?? launchObservation(job, terminalHandle, now);
  if (early) return early;
  if (!terminalHandle) return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle: null, liveness: 'unknown', reason: 'operation terminal handle unavailable', observedAt: now };
  try {
    const shown = terminalShow({ terminal: terminalHandle });
    const { lastOutputAt, outputAgeMs } = outputAgeOf(shown?.terminal?.lastOutputAt, now);
    const connected = shown?.connected === true, shownWritable = shown?.writable === true;
    const refusedAt = shownWritable ? sendRefusedAtOf(db, job, terminalHandle) : null;
    const outputSince = lastOutputAt >= refusedAt, refused = refusedAt != null && !outputSince;
    const { shellPrompt, inputDraft, screen, screenState, screenGate, providerOutage } = shown?.ok && connected && shownWritable
      ? workerScreenRead(db, job, terminalHandle, { frame })
      : { shellPrompt: null, inputDraft: null, screen: null, screenState: null, screenGate: null, providerOutage: null };
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
    const heartbeatAfter = heartbeatAt > refusedAt, unwritable = refused && !heartbeatAfter;
    const writable = shownWritable && !unwritable;
    return workerObservation({ job, now, db, frame, terminalHandle, shown, connected, writable, lastOutputAt, outputAgeMs,
      screenState, shellPrompt, inputDraft, screen, screenGate, providerOutage, stale, beating, heartbeatAgeMs, unwritable, refusedAt },
    { workerGateAnswerOf, terminalGoneCodes: TERMINAL_GONE_CODES, activeUnclassifiedMs: ACTIVE_UNCLASSIFIED_MS,
      quietAfterNudge, launchGraceOf, clipDraft, terminalNotWritable: TERMINAL_NOT_WRITABLE });
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
    'Re-read canonical starci kernel status and survey now; consume, independently check and settle the exact report, release its worker, then continue the approved frontier.',
  ],
});

/* ----------------------------------------------------------- foundations */
// Shared foundations across the workflows of one ledger (scripts/kernel/foundation-registry.mjs;
// modules/kernel/driver-loop.yaml foundations): a layout tree/shell, a brand, a @starci/grammar
// version, a shared module - each with ONE owner workflow, a state and its dependents. The owner's
// foundation legs run first; a dependent waits on the landing with a typed wait
// (starci kernel incident --kind peer-wait --until-foundation <name>), which the landing releases.
const foundationDutyOf = (db, wf, options) => foundationDutyFor(db, wf, skillRoot, options);
const agentHierarchyOf = (db, workflowId) => agentHierarchyFor(db, workflowId, skillRoot);
const staleInputProjection = (db, wf, repo = null) => {
  if (wf.phase === 'finished') return { staleInput: [], sourceDrift: [], peerDrift: [] };
  try {
    const drift = inputDrift(db, wf.workflow_id, { root: skillRoot, repo, workDir: repo ? workDirOf(repo) : '.starciwork' });
    return { staleInput: drift.stale, sourceDrift: drift.sourceDrift, peerDrift: drift.peerDrift };
  } catch (e) { return { staleInput: [], sourceDrift: [], peerDrift: [], staleInputError: String(e?.message ?? e) }; }
};
const peerDriftLines = (summary, indent = '') => (summary ? summary.records.map((entry) => `${indent}peer-drift (advisory, not stale): ${entry.file} (owner ${entry.owner ?? '-'} by ${entry.ownerBy}) changed after ${entry.jobs} settled job(s) read it${entry.writers.length ? ' — written by ' + entry.writers.join(', ') : ''}${entry.foreignWrite ? ' (a peer wrote a record this workflow owns: review it, redo nothing)' : ''}${entry.breakingIgnored === 'written-by-non-owner' ? ' — its breaking change note was written by a non-owner and binds nothing' : ''}; nothing to redo unless its owner declares the change breaking`) : []);
const breakingNoteOf = (item) => {
  if (!item.breakingBy) return '';
  return ' (breaking change declared by owner ' + item.breakingBy.join(', ') + (item.followUp ? '; ONE follow-up leg' : '') + ')';
};
const staleOperationLine = (item) => (item.followUp ? 'breaking-follow-up' : 'stale-input') + ': ' + staleLabel(item) + ' — ' + item.paths.join(', ') + breakingNoteOf(item);
const sourceDriftLines = (summary, indent = '') => (summary ? summary.paths.map((entry) => `${indent}source-drift (advisory, not stale): ${entry.path} edited after ${entry.jobs} settled job(s) were admitted; current READ and native CHECK remain required`) : []);
const staleLabel = (item) => item.jobId + ' (' + item.op + ' a' + item.attempt + (item.cut ? ' cut ' + item.cut.id + ' ' + item.cut.ordinal + '/' + item.cut.total : '') + ')';
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
  const probe = runNode(['-e', `const s=require('net').connect(${port},'127.0.0.1');s.on('connect',()=>process.exit(0));s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),${probeMs})`], { timeout: probeMs + 2000 });
  return probe.status === 0;
}

// Frontier states that are themselves a call to act. 'engaged' is not one —
// it only becomes actionable when the workflow also holds a ready operation.
// frontier.actionable is the single boolean the driver's yield rule reads.
const ACTIONABLE_FRONTIER_STATES = ['transition-ready', 'settle-ready', 'worker-dead', 'worker-question', 'worker-nudge-ready', 'worker-wedged', 'peer-message', 'handover-answered', 'finish-ready', 'ask-reserve', 'handover-due', 'next-ready', 'orphaned-frontier', 'idle'];
/**
 * Why one queued job is not running, in the order the causes actually bite. `dependency` is the
 * plan gate the Kernel applies before it routes at all; the four after it are the admission checks
 * `starci kernel route` and `starci kernel dispatch` run, in their own order (workflow ceiling, provider circuit, path
 * fence, pool saturation); `ready` means nothing blocks it and the Kernel is the only thing left.
 */
// 'dependency-failed' is a dependency that can no longer succeed on its own: the
// seam or --after job it waits on settled failed (not an owner wait), so only
// the Kernel can move it - retry the blocker, re-point the dependant, or drop it.
const QUEUED_BECAUSE = queuedBecauseKinds();
/**
 * Open owner-gate incidents of a workflow: a step only the owner can drive
 * (an assisted OAuth run, a consent screen) holds the jobs it names until the
 * Kernel resolves the incident. `starci kernel incident --kind owner-gate --holds` names
 * the held ops or jobs; without --holds the incident's --op is held. A job the
 * owner holds is not work the Kernel can do, so status never calls it ready
 * and the watchdog never wakes a Kernel for it.
 */
const OWNER_GATE_KINDS = ['owner-gate', 'owner-gate-pending'];
// Autopilot (scripts/kernel/autopilot-run.mjs): a supervisor-gate holds its jobs the way an owner gate does, but it is
// the Supervisor's to resolve; `holds: ['*']` (a spent autopilot budget) holds every queued job.
const HOLDING_GATE_KINDS = new Set([...OWNER_GATE_KINDS, SUPERVISOR_GATE]);
const openOwnerGates = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
  .map((row) => {
    const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
    if (!HOLDING_GATE_KINDS.has(kind)) return null;
    const raised = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const holds = parseJson(raised?.payload_json, {})?.holds;
    return { incidentId: row.incident_id, kind, holds: Array.isArray(holds) && holds.length ? holds : [row.op_id].filter(Boolean),
      opId: row.op_id ?? null, detail: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, '') };
  })
  .filter(Boolean);
/** The frontier reason's clause for settles a recorded wait holds (cmdStatus heldSettle). */
const heldWaitLabel = (length) => length === 1 ? 'its wait' : 'those waits'; const heldSettleText = (held) => held.length ? `; the settle of ${held.map((item) => item.jobId + ' (' + item.blockedBy.incident + ')').join(', ')} is deferred behind ${heldWaitLabel(held.length)} (report consumed; check and settle once the wait resolves)` : '';
/**
 * Open peer-wait incidents of a workflow: work that cannot pass its preflight until a PEER workflow
 * lands something (installs a dependency, writes a record). `starci kernel incident --kind peer-wait --peer
 * <workflowId>` records it; --holds (else --op) names the held ops or jobs, which read queuedBecause
 * peer-wait, and with nothing else open the frontier reads `peer-wait`, not actionable, instead of
 * orphaned-frontier (a brand.decide waited
 * on a peer workflow's Grammar install while status re-woke the Kernel for nothing). A
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
      try { doc = parseYaml(fs.readFileSync(path.join(repo, stripSlashes(rel), 'index.yaml'), 'utf8')); } catch { continue; }
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
 * queuedBecauseOf plus the cut seam's contract-first release (scripts/kernel/seam-policy.mjs): a sibling
 * ordinal its seam no longer holds carries seamStub {mode, seamJobId, reason} - it runs now on the seam's
 * published interface or a stub of its own, never waiting past allocation.cutSeam.maxSiblingWaitMs.
 */
/** runtimes.yaml allocation.routeHoldMs: how long a routed-but-queued job keeps its pool slot after its latest route. */
const routeHoldMsOf = () => allocationMs('routeHoldMs');
/**
 * Pool load worker-wide, the one count `starci kernel route` (capacity) and `starci kernel status` (queuedBecause pool-full) both
 * reason with, so they agree: every non-settled job whose payload.model names a pool holds a slot of it - running,
 * leased and answering jobs always, and a routed-but-QUEUED one only while its latest route decision (payload.routedAt,
 * else its newest route-decided event) is younger than allocation.routeHoldMs. The hold lets sequential route calls of
 * one fan-out see the workers filling instead of piling every slice onto the first preferred pool; past it, a job parked
 * behind a gate, a hold, a peer-wait, a dependency or a readiness loop no longer starves the pool for hours (seen live
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
  if (seamHold?.hold === false) out.seamStub = { mode: seamHold.stub.mode, seamJobId: seamHold.stub.seamJobId, seamStatus: seamHold.stub.seamStatus, reason: seamHold.stub.reason };
  if (isSeamCut(payload.cut)) out.seam = { cutId: String(payload.cut.id), siblings: Number(payload.cut.total) - 1 };
  return out;
}
/** An open owner-gate or supervisor-gate incident that holds the job. */
const holdByIncidentGate = (cause) => {
  const { job, ownerGates } = cause;
  const gate = ownerGateOf(ownerGates, job);
  if (!gate) { return null; }
    return gate.kind === SUPERVISOR_GATE ? {
      queuedBecause: SUPERVISOR_GATE,
      blockedBy: { incident: gate.incidentId },
      detail: `supervisor-gate incident ${gate.incidentId} holds it (autopilot): the Supervisor fixes the runtime/process cause or decides the retry and resolves it --by supervisor; never the owner`,
    } : {
      queuedBecause: 'owner-gate',
      blockedBy: { incident: gate.incidentId },
      detail: `owner-gate incident ${gate.incidentId} holds it; the Kernel resolves it (starci kernel incident --resolve) once the owner's step lands`,
    };
};
/** An open peer-wait incident that holds the job until the peer lands what it waits on. */
const holdByPeerWait = (cause) => {
  const { job, peerWaits } = cause;
  const peerWait = ownerGateOf(peerWaits, job);
  if (!peerWait) { return null; }
    return {
      queuedBecause: 'peer-wait',
      blockedBy: { incident: peerWait.incidentId, peer: peerWait.peer },
      detail: `peer-wait incident ${peerWait.incidentId} holds it until peer ${peerWait.peer} lands what it waits on (${peerWait.detail.slice(0, 160)}); a peer message from ${peerWait.peer} wakes the Kernel${peerWait.untilMessage ? ' and resolves the wait' : ', which resolves it (starci kernel incident --resolve) once the proof holds'}`,
    };
};
/** A claimed foundation `shell` an interface.draw of a dependent workflow waits for. */
const holdByShellFoundation = (cause) => {
  const { db, job, opId } = cause;
  // An interface.draw whose workflow is a declared dependent of a claimed foundation `shell` (the layout chain another
  // live workflow draws) waits for its landing (scripts/kernel/shell-foundation.mjs); it never drafts a second shell.
  if (opId === 'interface.draw') {
    const shellFoundation = shellFoundationWaitOf(db, job.workflow_id);
    if (shellFoundation) return { queuedBecause: FOUNDATION_WAIT, blockedBy: { foundation: SHELL_FOUNDATION, workflow: shellFoundation.owner }, detail: shellFoundation.detail };
  }
  return null;
};
/** An earlier plan leg that still has a job in flight or queued. */
const holdByPlanDependency = (cause) => {
  const { db, job, payload, opId, planAncestors, jobsByOp, workGraph, typedGates } = cause;
  // A plan ancestor (planAncestorsOf) holds this job only while it has a job still in flight or
  // queued. A leg with no job, or whose jobs all settled, is not a wait: the plan either never
  // enqueued it (intake legs) or already moved past it. Nor is a pending row whose own --after chain
  // reaches this job — the Kernel declared that order explicitly, so it overrides the plan. A leg the
  // plan edges do not lead from never holds it.
  // Nor does a job whose own wait's typed conditions name this one (scripts/kernel/leg-order.mjs legOrderExemption).
  // With a work graph, a business or architecture leg is held only by an ancestor of the same phase in a domain it shares.
  const otherDomain = (row) => workGraph && DOMAIN_PARALLEL_OPS.has(opId) && DOMAIN_PARALLEL_OPS.has(row.op_id)
    && disjointDomains(workGraph.graph, payload.owned_paths, jobPayloadOf(row).owned_paths);
  // Nor does a test leg the owner's config.yaml specs switches defer (spec-deferral.mjs): nothing waits on a deferred test.
  const specs = ownerSpecs(skillRoot);
  const blocking = (opId ? planAncestors.get(opId) ?? [] : [])
    .map((earlier) => ({ earlier, pending: (jobsByOp.get(earlier) ?? []).filter((row) => row.job_id !== job.job_id && !FINAL_SETTLED.includes(row.status) && !afterChainReaches(db, row, job.job_id) && !otherDomain(row)
      && !testDeferralOf({ skillRoot, op: row.op_id, payload: jobPayloadOf(row), settings: specs })
      && !legOrderExemption({ row, rowPayload: jobPayloadOf(row), job, typedGates, headOf: (id) => lineageHeadById(db, id)?.row.job_id ?? id })) }))
    .find(({ pending }) => pending.length > 0);
  if (!blocking) { return null; }
    return {
      queuedBecause: 'dependency',
      blockedBy: { op: blocking.earlier, job: blocking.pending[blocking.pending.length - 1].job_id },
      detail: `approved leg ${blocking.earlier} still has job ${blocking.pending[blocking.pending.length - 1].job_id} ${blocking.pending[blocking.pending.length - 1].status}; it precedes ${opId} in the approved order`,
    };
};
/** A declared --after job, the seam of the job's cut or a Work-record edge that has not settled succeeded. */
const holdByDeclaredJob = (cause) => {
  const { db, job, payload, opId, recordDeps, seamHold } = cause;
  // A declared --after job, or the seam (ordinal 1) of this job's cut, that
  // has not settled succeeded holds it like an earlier leg does. The seam is
  // its live head: a dropped, never-dispatched seam retry is skipped. A named
  // job is followed down its retry lineage (gate-conditions.mjs lineageHeadOf):
  // a failed --after job whose retry is queued is a live wait, not a dead one
  // the Kernel must drop and re-enqueue.
  // A lineage that leads back to this job is its own history, never a wait: a retry whose --after
  // names the attempt it retries (a draw follow-up enqueued --after op-interface.draw-3cd517a152
  // as that job's retry, wf-<product>-workspace-provision-mujek7cb) otherwise held itself forever.
  const heldByJob = (priorId) => {
    const prior = lineageHeadById(db, priorId)?.row ?? null;
    return prior && prior.status !== 'succeeded' && prior.job_id !== job.job_id ? prior : null;
  };
  // The seam holds a sibling only while siblingSeamHold says so: a published interface, a dead or slipped
  // seam, a Kernel release or allocation.cutSeam.maxSiblingWaitMs lets it run on a stub (cut-seam.mjs).
  const seam = payload.cut && Number(payload.cut.ordinal) > 1 && (!seamHold || seamHold.hold)
    ? cutSeamHeadOf(db, { workflowId: job.workflow_id ?? payload.hierarchy?.workflowId, op: opId, cutId: payload.cut.id })?.job_id ?? null
    : null;
  // A released sibling is not held back through the seam's Work record either: a record edge to a job
  // of its own cut's seam (ordinal 1) is the same wait the release lifted (cut-seam.mjs; a product's collab-impl-be
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
      // Two products' workspace.manage jobs sat queued behind a seam
      // and an --after job that had settled failed; the frontier read engaged,
      // the watchdog never woke the Kernel, and both workflows stalled.
      const dead = FINAL_SETTLED.includes(prior.status) && !isAwaitingOwner(db, db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(prior.job_id));
      return {
        queuedBecause: dead ? 'dependency-failed' : 'dependency',
        blockedBy: { op: prior.op_id, job: prior.job_id },
        detail: queuedDependencyDetail({ priorId, prior, seam, seamHold, payload, recordDeps, jobId: job.job_id, dead }),
      };
    }
  }
  return null;
};
/** The workflow holds every operation slot its ceiling allows. */
const holdByMaxOps = (cause) => {
  const { slots } = cause;
  if (slots.ok) { return null; }
    return {
      queuedBecause: 'max-ops',
      blockedBy: { ceiling: slots.ceiling, ceilingSource: slots.ceilingSource, running: slots.running },
      detail: `the workflow holds ${slots.running} of ${slots.ceiling} operations (${slots.ceilingSource})`,
    };
};
/** An open provider circuit of the job's pool. */
const holdByCircuit = (cause) => {
  const { db, payload, rtDoc } = cause;
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
  return null;
};
/** A held owned-path lease that overlaps the job's paths. */
const holdByPathLease = (cause) => {
  const { db, job, payload, opId, canon } = cause;
  // Lease-row existence is the fence, expiry only a recovery signal
  // (engine/admission.mjs findOwnedPathLeaseConflicts) — an expired row still
  // answers "why is this queued", because the prior attempt's effect may exist.
  // A projection never throws on a malformed stored path: dispatch admission is
  // where that row is refused, and status must still answer for its siblings.
  let conflict = null;
  try { conflict = findOwnedPathLeaseConflicts(db, opLeaseRequests(payload, canon, opId), { excludeJobId: job.job_id, canonicalOf: canon?.canonicalOf })[0] ?? null; }
  catch { conflict = null; }
  if (!conflict) { return null; }
    const unexpired = Number(conflict.expires_at) > Date.now(), expired = !unexpired;
    return {
      queuedBecause: 'path-lease',
      blockedBy: { path: conflict.held, job: conflict.job_id, op: conflict.op_id ?? null, expiresAt: conflict.expires_at ?? null },
      detail: `${conflict.held} is held by ${conflict.job_id} (${conflict.op_id ?? '-'}) and overlaps ${conflict.requested}; `
        + (expired
          ? `that lease expired at ${new Date(Number(conflict.expires_at)).toISOString()} but its row still fences — reconcile or settle ${conflict.job_id}`
          : `lease expires ${new Date(Number(conflict.expires_at)).toISOString()}; it becomes ready when ${conflict.job_id} settles and releases it — wait, never re-dispatch it by hand`),
    };
};
/** The job's pool is full of other holders. */
const holdByFullPool = (cause) => {
  const { job, payload, rtDoc, poolLoad } = cause;
  const target = payload.model ?? null;
  const card = target ? poolCardFor(rtDoc, target) : null;
  // A routed-but-queued job counts toward its pool while its route hold lasts (poolLoadOf, the same count
  // `starci kernel route` reasons with); what bounds it is the OTHER holders of the lane.
  const maxParallel = Number(card?.maxParallel);
  const otherHolders = Math.max(0, (poolLoad.byModel[target] ?? 0) - (poolLoad.holders.has(job.job_id) ? 1 : 0));
  if (target && Number.isInteger(maxParallel) && maxParallel > 0 && otherHolders >= maxParallel) {
    return {
      queuedBecause: 'pool-full',
      blockedBy: { pool: target, running: otherHolders, maxParallel },
      detail: `pool ${target} holds ${otherHolders} of ${maxParallel} slots`,
    };
  }
  return null;
};
function queuedBecauseInner(db, job, { planAncestors, jobsByOp, slots, rtDoc, poolLoad, ownerGates = [], peerWaits = [], recordDeps = new Map(), canon = null, workGraph = null, typedGates = [], seamHold = null, hostHold = null }) {
  const payload = jobPayloadOf(job);
  const opId = job.op_id ?? payload.opId ?? null;
  const cause = { db, job, payload, opId, planAncestors, jobsByOp, slots, rtDoc, poolLoad, ownerGates, peerWaits, recordDeps, canon, workGraph, typedGates, seamHold, hostHold };
  // The first hold wins, in this order: an incident gate, a deferral (autopilot: a deferred leg, or a live proof waiting for the
  // handover credential checklist), a peer wait, a shell foundation, an earlier plan leg, a declared job, the slot ceiling, a
  // provider circuit, a path lease, a full pool.
  return holdByIncidentGate(cause) || deferredQueueCause(db, job) || holdByPeerWait(cause) || holdByShellFoundation(cause) || holdByPlanDependency(cause)
    || holdByDeclaredJob(cause) || holdByMaxOps(cause) || holdByCircuit(cause) || holdByPathLease(cause) || holdByFullPool(cause) || hostHold?.(opId) /* host-hold.mjs: dispatch would refuse host-resources-low */
    || { queuedBecause: 'ready', blockedBy: null, detail: null };
}
// The Kernel seat as the ledger holds it: the attempt, its terminal, the launch that seated it and who
// ran that launch. `you` is true when the caller's ORCA_TERMINAL_HANDLE is the seat's terminal, so a
// Kernel proves a launch prompt or a wake (both name the attempt) against the ledger, not against the text.
/**
 * op-rev-drift at settle (WARN, never a refusal): the runtime rev the leg was dispatched under
 * (contracts.context_json.contract.runtimeSha) against the current one; when the op's contract files
 * changed in between, one op-rev-drift event {op, attempt, from, to, files} (starci kernel status opRevDrift, typed
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
  reason: `the runtime moved from the rev you acked (${shortRev(rev.acked)}) to ${shortRev(rev.current)}: re-read ${rev.full ? 'modules/kernel/kernel-prompt.md and modules/kernel/driver-loop.yaml in full' : rev.files.join(', ')}, then starci kernel kernel-ack-rev --workflow ${workflowId} --plan and submit the complete READ manifest with --rev ${rev.current} --read-manifest <file>; until then enqueue/dispatch of a leg whose op contract changed is refused ${KERNEL_REV_STALE}` });
/**
 * The RUNNING legs whose op contract moved on the runtime since their dispatch (op-rev-drift before settle): the
 * worker still runs its brief, is judged by its admission, and hears it on its next nudge. [{jobId, op, attempt, from,
 * to, files}]
 */
function runningOpRevDriftOf(db, workflowId, { root = revRootOf() } = {}) {
  const rows = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind='op' AND status IN ('running','answering')`).all(workflowId);
  if (!rows.length) return [];
  const current = currentRuntimeRev(root), out = [];
  for (const job of rows) {
    const op = jobOpOf(job);
    const admission = admittedContractOf(db, job);
    const drift = opRevDrift(root, op, admission.version?.runtimeSha ?? null, current);
    if (!drift) continue;
    out.push({ jobId: job.job_id, op, attempt: tryOf(job), ...drift });
  }
  return out;
}
/** The newest op-rev-drift warnings of a workflow (starci kernel settle): [{jobId, op, attempt, from, to, files, at}]. */
const opRevDriftOf = (db, workflowId, limit = 5) => db.prepare('SELECT entity_id,payload_json,created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT ?')
  .all(workflowId, OP_REV_DRIFT, limit).map((row) => ({ jobId: row.entity_id, ...parseJson(row.payload_json), at: row.created_at }));

/**
 * enqueue/dispatch refuse kernel-rev-stale for a leg whose current op contract
 * changed between the runtime rev the Kernel acked and the current one (runtime-rev.mjs opRevStale). Other
 * legs, a Kernel that never acked (booted before this gate) and an unreadable rev pass.
 */
function refuseStaleKernelRev(db, workflowId, op, verb) {
  requireAdmittedKernelRead(db, workflowId, op);
  const root = revRootOf();
  let state = null;
  try { state = kernelRevState(db, workflowId, { root, ops: [op] }); } catch (error) { throw Object.assign(new Error(`runtime READ comparison unavailable: ${error.message}`), { code: KERNEL_REV_UNKNOWN }); }
  const hit = opRevStale(state, op, { root });
  if (!hit) return;
  const what = hit.files.join(', ');
  throw Object.assign(new Error(`${KERNEL_REV_STALE}: ${verb} of ${op} refused - its op contract changed between the runtime rev you acked (${shortRev(state.acked)}) and the current one (${shortRev(state.current)}): ${what}. Re-read ${state.full ? 'modules/kernel/kernel-prompt.md and modules/kernel/driver-loop.yaml in full' : state.files.join(', ')}, then starci kernel kernel-ack-rev --workflow ${workflowId} --plan and attest its complete manifest with --rev ${state.current} --read-manifest <file>, then ${verb} again (starci kernel status kernelRev)`),
    { code: KERNEL_REV_STALE, op, acked: state.acked, current: state.current, files: hit.files });
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
 * The seam view of one cut set for starci kernel status cutSets[].seam (scripts/kernel/seam-policy.mjs): the seam head,
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
      reason: `cut ${set.id} seam ${view.jobId} landed after ordinal ${item.ordinal} (${item.jobId}) passed on a stub (${item.mode}): re-verify it against the real seam - rerun its scoped checks (typecheck/build and its slice tests) and record starci kernel cut-seam --reconcile --job ${item.jobId} --exit-code <n> --command "<cmd>"; a light re-check, not a redo` });
  }
  for (const item of view.reconcile?.red ?? []) {
    actions.push({ kind: 'retry', op: set.op, jobId: item.jobId, cutId: set.id, seamDuty: 'reconcile-red',
      reason: `ordinal ${item.ordinal} (${item.jobId}) does not reconcile with the landed seam (${SEAM_RECONCILE_CHECK} red): starci kernel enqueue --op ${set.op} with its paths --cut-id ${set.id} --cut-ordinal ${item.ordinal} --cut-total ${set.total} --retry-of ${item.jobId} (that ordinal only)` });
  }
  if (view.recutPlan) {
    actions.push({ kind: 'retry', op: set.op, jobId: view.jobId, cutId: set.id, seamDuty: 'recut',
      reason: `cut ${set.id} seam ${view.jobId} slipped (${view.failures} failed attempt(s), now ${view.status}); its siblings already run on a stub - re-cut the seam smaller: ${view.recutPlan.steps.join('; ')}` });
  }
  return actions;
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
// The owner's config.yaml `specs` switches (scripts/route/spec-deferral.mjs): a queued leg whose op only tests a
// class that is off is never routed or dispatched - route and dispatch settle it deferred (status succeeded,
// result verdict deferred, no attempt spent) and say so. Returns true when it did.
function deferQueuedTestLeg(ledger, { job, op, payload, via, args }) {
  const deferral = testDeferralOf({ skillRoot, op, payload });
  if (!deferral) return false;
  const deferred = deferJob(ledger, { job, deferral, via });
  if (!deferred) return false;
  const out = { ok: true, jobId: job.job_id, op, status: 'succeeded', deferred };
  emit(out, `${via} of ${job.job_id} (${op}) DEFERRED: ${deferral.reason} - settled without dispatch, no attempt spent; the legs behind it proceed; starci kernel run-deferred-tests --workflow ${job.workflow_id} runs it later`, args.json);
  return true;
}
// `starci kernel run-deferred-tests --workflow <id> [--kind unit|e2e|integration] [--dry-run]`: the owner's "test later" - every leg the
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

// A Kernel does not bias a route (owner decision 2026-09-25): `starci kernel route` and `starci kernel dispatch` refuse
// --prefer/--avoid as unknown options. The router decides from ledger facts; the owner's goal
// routing_bias is the only bias.
const refuseKernelBias = (verb, args) => {
  const flags = ['prefer', 'avoid'].filter((name) => args[name] !== undefined);
  if (flags.length) throw Object.assign(new Error(`api ${verb}: unknown option ${flags.map((f) => '--' + f).join(', ')}; the router decides (open provider-health circuits, the retry lineage) and only the owner goal routing_bias applies`), { code: 'unknown-option' });
};

const failureText = (...parts) => parts.map((part) => {
  if (part == null) return '';
  if (typeof part === 'string') return part;
  try { return JSON.stringify(part); } catch { return String(part); }
}).join(' ');
const confirmedAuthFailure = ({ step, signal, error, details } = {}) => {
  const stages = new Set([step, details?.stage, details?.failedStage, details?.result?.stage, details?.result?.failedStage]
    .filter(Boolean).map((value) => String(value).trim().toLowerCase()));
  if (stages.has('auth') || stages.has('authentication')) return true;
  const text = failureText(signal, error, details).toLowerCase();
  return AUTH_FAILURE_RX.test(text);
};
const AUTH_FAILURE_PARTS = String.raw`\b401\b|not[_ -]?authenticated|authentication (?:failed|required)|oauth[^\n]*(?:expired|invalid|rejected)|(?:access[_ -]?)?token[^\n]*(?:expired|invalid|rejected)|invalid api[- ]?key|missing credentials|credential[^\n]*(?:expired|invalid|rejected)`;
const AUTH_FAILURE_RX = new RegExp('(?:' + AUTH_FAILURE_PARTS + ')');
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
// An open circuit, closed early only by a rotated credential or starci kernel provider-health --recover.
const providerHealthOf = (db, provider, now = Date.now()) => providerCircuitOf(db, provider, now, { credential: currentCredentialOf });
// The one command that clears an open circuit before its expiry (kernel caller only).
const providerRecoverCommand = (provider) => `starci kernel provider-health --provider ${provider} --recover --reason <text> --probe`;
// How an open circuit clears: a quota circuit by its recovery probe (the watchdog runs it), any other by the Kernel's --recover.
const circuitClearHint = (circuit) => circuit?.failureKind === 'quota'
  ? '; its quota probe clears it (' + (circuit.recover ?? ('starci kernel provider-health --provider ' + circuit.provider + ' --quota-probe')) + ', run by the watchdog at most once per probe interval and right after the plan reset)'
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
  const key = normalizeProvider(provider);
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
/** The trip count this observation makes: one more than the last same-kind trip inside the backoff window, one when it opens fresh, else the last count carried. */
const circuitTripsOf = ({ opens, sameRecent, last }) => {
  if (opens && sameRecent) return Number(last.trips ?? 0) + 1;
  if (opens) return 1;
  return Number(sameRecent ? (last.trips ?? 0) : 0);
};
/** The cooldown of a circuit: until a known plan reset, else the base cooldown grown by the backoff factor per repeated trip (capped). */
const circuitCooldownMs = ({ fixed, now, base, opens, backoff, trips }) => {
  if (fixed) return fixed - now;
  if (opens && backoff && trips > 1) return Math.min(Number(backoff.capMs), base * Math.pow(Number(backoff.factor), trips - 1));
  return base;
};
const writeProviderCircuit = (db, { provider, model, jobId, step, signal, error, now, failureKind = 'auth', credential = null,
  fixedExpiresAt = null, extra = null }) => {
  const key = normalizeProvider(provider);
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
  const trips = circuitTripsOf({ opens, sameRecent, last });
  const base = providerCooldownMs(failureKind);
  // A quota circuit with a known plan reset lasts until that reset: no backoff arithmetic guesses it.
  const fixed = opens && Number.isFinite(fixedExpiresAt) && fixedExpiresAt > now ? fixedExpiresAt : null;
  const cooldown = circuitCooldownMs({ fixed, now, base, opens, backoff, trips });
  const expiresAt = now + cooldown;
  const value = {
    schema: 'starci/provider-health@1', provider: key,
    status: opens ? 'unavailable' : 'striking',
    failureKind, strikeLimit, model: model ?? null, jobId, step,
    signal: signal ?? null, detail: error ?? null, observedAt: now,
    failures, trips, cooldownMs: cooldown,
    ...(auth ? { credentialFingerprint: credential?.fingerprint ?? null, credentialSource: credential?.source ?? null } : {}),
    ...extra,
    ...(opens ? { recover: failureKind === QUOTA_FAILURE_KIND ? providerQuotaProbeCommand(key) : providerRecoverCommand(key) } : {}),
  };
  // The circuit is a machine.sqlite provider_health row (scripts/machine/provider-circuit.mjs), worker-wide.
  storeProviderCircuit(key, { value, expiresAt });
  return value.status === 'unavailable' ? { ...value, expiresAt } : null;
};

/* -------------------------------------------------------- outage circuits */
// A provider whose agent card declares an outage key (scripts/agent/provider-outage.mjs) opens its
// circuit on the evidence of a launch failure text (rejectDispatch) or a worker screen row (starci kernel status /
// starci kernel observe). quotaExhausted opens failureKind quota: the circuit lasts for
// allocation.cooldownMs.quota and
// `starci kernel provider-health --quota-probe` clears it earlier on a passing 1-token completion.
// capacityExhausted opens failureKind capacity for allocation.cooldownMs.capacity (circuitBackoff on a reopen).
const providerQuotaProbeCommand = (provider) => `starci kernel provider-health --provider ${provider} --quota-probe`;
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
// `starci kernel provider-health [--provider <p>] --quota-probe [--force] [--workflow <id>]`: for each provider
// whose card declares quotaExhausted.probe (or the one named) with an OPEN quota circuit in this
// ledger, one real 1-token completion when due (quotaProbeDue; --force ignores the throttle). A pass
// clears the circuit (status recovered, event provider-health-recovered); a quota answer keeps it and,
// past the reset, rolls it to the next reset; any other answer is recorded and keeps it. Needs no
// Kernel proof: the probe is the evidence. The kernel watchdog runs it every tick under --repair.
// Opens the outage circuit for each observed worker whose screen shows an outage row. Not again while
// that provider's circuit of the same kind is open (a re-read screen is no new strike), and not for a row
// printed before the last observation of that kind or its recovery (the frame still shows the old error).
// Returns the circuits opened.
/** The last circuit row of this failure kind (the row itself or the one it replaced), else null. */
const lastSameKindOf = (lastRow, kind) => {
  if (lastRow.failureKind === kind) return lastRow;
  return lastRow.previous?.failureKind === kind ? lastRow.previous : null;
};
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
    const lastSame = lastSameKindOf(lastRow, kind);
    const seenUntil = Math.max(Number(lastSame?.observedAt) || 0, lastSame ? Number(lastRow.recoveredAt) || 0 : 0);
    const printedAt = Number(worker.lastOutputAt);
    if (lastSame && !(Number.isFinite(printedAt) && printedAt > seenUntil)) continue;
    const job = ledger.db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(worker.jobId);
    const payload = job ? jobPayloadOf(job) : {};
    ledger.transaction(() => {
      const circuit = openOutageCircuit(ledger.db, { provider: evidence.provider, model: payload.model ?? null, jobId: worker.jobId,
        step: 'worker-screen', signal: evidence.match, error: `worker screen shows ${evidence.provider} ${kind === QUOTA_FAILURE_KIND ? 'plan quota exhausted' : 'out of ' + kind}`, evidence, now });
      if (!circuit) return;
      if (job?.workflow_id) ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'provider', entityId: circuit.provider,
        kind: 'provider-unavailable', payload: { ...circuit, source: 'worker-screen' } });
      opened.push({ provider: circuit.provider, failureKind: kind, jobId: worker.jobId, match: evidence.match, expiresAt: circuit.expiresAt });
    });
  }
  return opened;
}

/* -------------------------------------------------------- provider-health */
// `starci kernel provider-health --provider <p>` shows this ledger's provider-health row
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
// `starci kernel route` — resolve the pool/model for one job and persist the decision on
// its payload so `dispatch --spawn` launches exactly what was routed. Bias: only
// the owner's routing_bias {prefer[], avoid[]} on the workflow goal's json
// (define-goal). A Kernel's --prefer/--avoid is refused as an unknown option
// (owner decision 2026-09-25: an interface.implement op was routed around
// devin-agent onto codex on a hunch). The router itself skips a
// pool whose provider-health circuit is open (capacity below) and, for a retry,
// demotes or excludes the pools its lineage failed on (scripts/kernel/lineage-route.mjs).
// Difficulty: --difficulty > job payload.difficulty > 'medium'.
/* --------------------------------------------------------------- cut-seam */
/* -------------------------------------------------------------- dispatch */
const resolveModel = (target) => {
  if (!target) return { error: 'no operation target given and modules/models/registry.yaml names no orchestration.defaultOperationTarget' };
  const file = path.join(skillRoot, 'modules', 'models', 'registry.yaml');
  const doc = fs.existsSync(file) ? parseYaml(fs.readFileSync(file, 'utf8')) : null;
  const entry = doc?.pools?.[target] ?? doc?.targets?.[target];
  if (!entry) return { error: `no model target '${target}' in modules/models/registry.yaml (pools, targets)` };
  return { target, provider: entry.provider ?? entry.runtime ?? null, profile: 'modules/models/registry.yaml' };
};

const ownerLanguage = () => ownerLanguageOf();
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
    // `starci kernel op-contract --json` and never opens the ledger for it (a product's auth, inc-26b260e101e4).
    ...goalFieldOf(boundGoal, payload, goal),
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
    // The asks this job's retry lineage already had answered (scripts/machine/owner-answers.mjs):
    // binding input for this attempt, never a question to file again.
    ...(ownerAnswers.length ? { owner_answers: ownerAnswers } : {}),
    // The owner asked for this deferred test leg to run anyway (starci kernel run-deferred-tests): its specs switch no longer applies.
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
const bestEffort = bestEffortCall;

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
  // One close path (scripts/machine/worker-close.mjs): worker-stop, worker-release, the terminal close and the process verify.
  const closedNow = settled ? null : bestEffort(() => closeWorker({ dispatch: terminal, stopFirst: true }));
  const stop = settled ? settled.stop : closedNow?.stop;
  const release = settled ? settled.release : closedNow;
  const provenNoEffect = settled?.provenNoEffect === true;
  return {
    terminalClosed: provenNoEffect || (stop?.ok === true && release?.ok === true),
    closed: { kind: 'managed', dispatchId: terminal, stop: { ok: stop?.ok === true },
      release: { ok: release?.ok === true }, ...(provenNoEffect ? { provenNoEffect: true } : {}) },
  };
};

// The last rows the refused terminal showed. Five Codex op launches failed
// model attestation ("did not render gpt-6.1-sol within 15000ms") and the
// rejections kept no screen, so nobody could tell a slow start from an update
// prompt or an error; the tail now rides on the dispatch-rejected event.
const screenTextOf = (details) => typeof details?.screen === 'string' ? details.screen : '';
const screenTailOf = (screen) => {
  const rows = String(screen ?? '').split(/\r?\n/).map((line) => line.trimEnd()).filter(Boolean).slice(-15);
  return rows.length ? rows.join('\n').slice(-1500) : null;
};
// The one human-readable line of a refused launch (op attempt settle_json.message, the UI): what step refused it and why.
const dispatchRejectedMessage = ({ step, signal = null, error = null }) =>
  'dispatch rejected at ' + (step ?? 'launch') + (signal ? ' (' + signal + ')' : '') + (error ? ': ' + String(error).slice(0, 300) : '') + '; no try spent, the job goes back to ready';
/** The provider circuit a refused launch opens, or null: an outage circuit, the auth circuit, or a strike when the host refused a launch path without saying why. */
const rejectionCircuit = (db, { outageFailure, authFailure, providerHealthEvidence, model, jobId, step, signal, error, now, credential }) => {
  if (outageFailure) {
    return openOutageCircuit(db, {
      provider: model.provider, model: model.target, jobId, step, signal, error, evidence: outageFailure, now,
    });
  }
  if (authFailure) {
    return providerHealthEvidence ?? writeProviderCircuit(db, {
      provider: model.provider, model: model.target, jobId, step, signal, error, now, credential,
    });
  }
  if ((step === 'worker-start' || signal === PROMPT_DELIVERY_STALLED) && model?.provider) {
    // A managed launch the host refused without saying why, or a prompt
    // lost on two stalled sends (scripts/agent/lib.mjs deliverPrompt), is
    // still the provider's launch path failing. Left unclassified it fed nothing, so
    // the kernel rerouted straight back to the same pool and burned another
    // launch. It is a strike (runtimes.yaml allocation.providerStrikes) —
    // one flake never parks a pool, the second one does.
    return writeProviderCircuit(db, {
      provider: model.provider, model: model.target, jobId, step, signal, error, now,
      failureKind: step === 'worker-start' ? 'worker-start' : PROMPT_DELIVERY_STALLED,
    });
  }
  return null;
};
/** The job's rejected dispatches with this one appended. */
const rejectedDispatchesOf = (payload, { terminal, step, now, effectState }) => [
  ...(Array.isArray(payload.rejectedDispatches) ? payload.rejectedDispatches : []),
  { dispatchId: terminal, step, at: now, effectState },
];
/** The job back to ready (nothing ran), or fenced effect_unknown (a worker may have started). */
const requeueRejectedJob = (db, { reusable, jobId, step, now, priorPayload, current, terminal }) => {
  if (reusable) {
    setJobStatus(db, { jobId, to: 'ready', reason: `dispatch-rejected:${step}`, at: now, payload: priorPayload, workerId: null, leaseToken: null, deadline: null });
    return;
  }
  if (current === 'leased') setJobStatus(db, { jobId, to: 'running', reason: `dispatch-rejected:${step}`, at: now, workerId: terminal ?? null });
  setJobStatus(db, { jobId, to: 'effect_unknown', reason: `dispatch-rejected:${step}`, at: now, payload: priorPayload });
};
/** The provider-unavailable event of a refused launch, and its infra-provider incident (an auth or outage circuit expires on its own and raises none). */
const recordRejectionCause = (ledger, { job, op, jobId, attemptId, now, providerHealth, incident, authFailure, outageFailure, model, signal, error }) => {
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
};
const rejectDispatch = (ledger, job, jobId, op, model, {
  step, signal = null, error = null, terminal = null, incident = false, attemptId = null,
  effectState = 'none', details = null, providerHealthEvidence = null,
  settled = null, trust = null,
}) => {
  // A provider whose card declares an outage key: its outage codes in the failure text, or its outage
  // error row on the refused terminal's screen, open that outage circuit (not the auth one).
  const outageFailure = !providerHealthEvidence && model?.provider
    ? (outageInText(model.provider, [signal, error, details?.signal, details?.error])
      ?? outageOnScreen(model.provider, screenTextOf(details)))
    : null;
  const authFailure = !outageFailure && (Boolean(providerHealthEvidence) || confirmedAuthFailure({ step, signal, error, details }));
  const { terminalClosed, closed } = closeRejectedLaunch({ terminal, settled, effectState });
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
    providerHealth = rejectionCircuit(ledger.db, { outageFailure, authFailure, providerHealthEvidence, model, jobId, step, signal, error, now, credential });
    const priorPayload = jobPayloadOf(job);
    // A rejected dispatch is EVIDENCE, never a binding. Overwriting
    // managed.dispatchId with it made one field mean two things, and the
    // readers that resolve a report's dispatch could not tell them apart:
    // a valid report from the live retry was refused because the payload
    // still pointed at the dispatch that never got a contract. The rejected
    // id goes on its own list; reconcile reads it there.
    if (terminal) priorPayload.rejectedDispatches = rejectedDispatchesOf(priorPayload, { terminal, step, now, effectState });
    const result = {
      reason: 'dispatch-rejected', step, signal, detail: error, provider: model.provider,
      effectState, attemptConsumed: false, retryable: reusable, providerHealth, at: now,
      message: dispatchRejectedMessage({ step, signal, error }),
      terminalClosed, ...(closed ? { closed } : {}),
    };
    const db = ledger.db, current = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;
    requeueRejectedJob(db, { reusable, jobId, step, now, priorPayload, current, terminal });
    // The attempt row ends in the same transaction as the refusal: never left open, never a try of the unit.
    if (attemptId != null) endRejectedAttempt(db, { attemptId, at: now, endState: reusable ? 'requeued' : 'effect-unknown', effectState,
      releasedAt: reusable ? now : null });
    recordJobResult(db, { jobId, result, at: now });
    recordWhy(db, attemptId, { at: now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId, ...(attemptId != null ? { attemptId } : {}),
      kind: 'dispatch-rejected',
      payload: { op, step, signal, error, provider: model.provider, model: model.target, terminal,
        effectState, attemptConsumed: false, retryable: reusable, leasesReleased, providerHealth,
        terminalClosed, ...(closed ? { closed } : {}), ...(attemptId != null ? { attemptId } : {}),
        ...(trust ? { trust } : {}),
        ...(screenTailOf(details?.screen) ? { screenTail: screenTailOf(details.screen) } : {}) },
    });
    recordRejectionCause(ledger, { job, op, jobId, attemptId, now, providerHealth, incident, authFailure, outageFailure, model, signal, error });
  });
  return { status, effectState, attemptConsumed: false, retryable: reusable, providerHealth,
    terminalClosed, ...(closed ? { closed } : {}) };
};

/* ------------------------------------------------------ op IPC helpers */
// §6 admission for an op dispatch. The durable fence is taken BEFORE anything
// launches: one `path:<normalized owned_path>` resource
// per payload.owned_paths entry (capacity 1 = exclusive write ownership —
// seeded OR IGNORE so an operator-declared capacity is never overwritten),
// then reserveTwoPhase flips the job queued → leased with its fencing token
// and registers the ledger on the machine arbiter. The arbiter is REQUIRED by
// reserveTwoPhase's signature even for repo-only leases (it registers the
// ledger; machine_ref is always NULL) — the
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
// spelling of one file overlap (inc-52a4a5ee5b12). Without a canonicalizer: the paths as written.
const opLeaseRequests = (payload, canon = null, op = null) => (canon
  ? canon.requests(payload, op ?? payload?.opId ?? null)
  : ownedPathLeaseRequests((payload.owned_paths ?? []).filter(Boolean)));

// A write set another job's LIVE lease still owns is a wait, never a launch failure. A job
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
    const unexpired = row.expiresAt > now;
    if (!unexpired || !status || FINAL_SETTLED.includes(status)) return null;
  }
  const holders = [...new Map(rows.map((row) => [row.jobId, {
    jobId: row.jobId, opId: row.opId, workflowId: row.workflowId, status: holderStatus.get(row.jobId),
    sameWorkflow: row.workflowId === job.workflow_id,
    paths: [...new Set(rows.filter((r) => r.jobId === row.jobId).map((r) => r.held))],
    expiresAt: Math.max(...rows.filter((r) => r.jobId === row.jobId).map((r) => r.expiresAt)),
  }])).values()];
  const minutes = (at) => Math.max(0, Math.round((at - now) / 60000));
  const holderLabel = (h) => `${h.jobId} (${h.opId ?? '-'}${h.sameWorkflow ? ', this workflow' : ', workflow ' + h.workflowId}, ${h.status}, lease expires in ~${minutes(h.expiresAt)}m at ${new Date(h.expiresAt).toISOString()})`;
  const detail = [
    rows.map((r) => `${r.requested} overlaps durable lease ${r.held} held by ${r.jobId}`).join('; '),
    `waiting on ${holders.map(holderLabel).join(', ')}`,
    'the job stays queued (queuedBecause path-lease) and reads ready once the holder settles and releases the lease; the next wake dispatches it, so do not re-dispatch it by hand',
  ].join(' — ');
  return { queuedBecause: 'path-lease', holders, conflicts: rows, detail };
};

const reserveOpLeases = (ledger, job, payload, { ttlMs = DISPATCH_LEASE_TTL_MS, repo = null } = {}) => {
  const canon = repo ? leaseCanonOf(ledger.db, repo) : null;
  const leases = opLeaseRequests(payload, canon, job.op_id);
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
      leases, ttlMs, canonicalOf: canon?.canonicalOf ?? null, opSlots: { maxOps: ownerMaxOps(), maxParallelOps: workersMaxParallelOps() },
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
/**
 * The dispatch's attempt and its contract (DBTREE op_attempts + contracts): one op_attempts row per dispatch - the
 * dispatch guard admits it only for a leased job of a running workflow - carrying the job scratch the op reports from
 * (starci kernel report reads the report ONLY from op_attempts.scratch_dir), then the contract keyed by that attempt.
 * Returns the attempt id. Runs inside the caller's transaction.
 */
const fileContract = (db, { job, op, dispatchId, markdown, context, now, attempt = {} }) => {
  const row = startAttempt(db, { workflowId: job.workflow_id, jobId: job.job_id, dispatchId, at: now, dispatchedAt: now, ...attempt });
  writeContract(db, { attemptId: row.attempt_id, markdown, createdAt: now,
    context: context ? { ...context, contract: context.contract ?? admittedVersionOf(skillRoot, op, now, { db, workflowId: job.workflow_id }) } : null });
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
  const r = runNode([script, 'check', '--repo', repo, '--paths', JSON.stringify(paths), ...env, '--restart', '--json'],
    { timeout: 300000 });
  try { return JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { return null; }
}
/** One open [environment] incident per workflow and environment state; refreshed, never duplicated. */
function raiseEnvironmentIncident(ledger, job, health) {
  const db = ledger.db, now = Date.now();
  const blocked = envServicesOf(health).filter((s) => !s.ready);
  const detail = `[environment] ${blocked.map((s) => s.env + '/' + s.service + ' ' + s.state + (s.listener ? ' (PID ' + s.listener.pid + ')' : '')).join(', ')}: ${health.remedies.join(' | ')}`.slice(0, 1800);
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
// Every Run-scoped call (dispatch, starci kernel reply, a Task close) binds the Run to the workflow's current Kernel
// terminal first: a replaced Kernel (start-workflow) is not the Run's consumer until one run-use, and Orca
// refuses its reply and task-update consumer_fenced until then (inc-e523617a3c31). bindWorkflowRun
// is a no-op once bound. A rebind is recorded as event run-rebound when a ledger handle is given.

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
// The terminal and Dispatch a dispatch created, recorded on the leased job before the launch waits on it
// (payload.launchTerminal): a dispatch killed mid-spawn leaves a worker that settle and
// reconcile --dead-worker can still release by its Dispatch.
const recordLaunchTerminal = (ledger, jobId, handle, dispatchId = null) => ledger.transaction(() => {
  const row = ledger.db.prepare("SELECT payload_json FROM jobs WHERE job_id=? AND status='leased'").get(jobId);
  if (!row) return;
  updateJob(ledger.db, { jobId, payload: { ...jobPayloadOf(row), launchTerminal: { handle, ...(dispatchId ? { dispatchId } : {}), at: Date.now() } } });
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
  // Ledger identity of this Run (calls.yaml run-create replay: request): a lost receipt replays it, never a second Run.
  const created = runCreate({ objective, from: kernelHandle, request: { workflow: job.workflow_id, kernel: kernelHandle, replaces: replacedRunId ?? null } });
  if (!created?.ok || !created.runId) {
    return { ok: false, error: created?.error ?? 'run-create returned no runId', kernelJob, kernelPayload };
  }
  runId = created.runId;
  ledger.transaction(() => {
    const now = Date.now();
    if (kernelJob) {
      kernelPayload.orca = { ...kernelPayload.orca, runId,
        ...(replacedRunId ? { previousRunIds: [...new Set([...(kernelPayload.orca?.previousRunIds ?? []), replacedRunId])] } : {}) };
      kernelPayload.hierarchy = kernelPayload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: kernelNodeId(job.workflow_id),
        parentNodeId: workflowNodeId(job.workflow_id), role: 'kernel',
        workflowId: job.workflow_id, jobId: kernelJob.job_id,
        attempt: tryOf(kernelJob), generation: kernelJob.generation,
      };
      kernelPayload.hierarchy.runtime = { ...kernelPayload.hierarchy.runtime, host: 'orca', runId };
      updateJob(db, { jobId: kernelJob.job_id, payload: kernelPayload, at: now });
    } else {
      payload.orca = { ...payload.orca, runId };
      payload.hierarchy = payload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
        workflowId: job.workflow_id, jobId, opId: job.op_id,
        attempt: tryOf(job), generation: job.generation,
      };
      payload.hierarchy.runtime = { ...payload.hierarchy.runtime, host: 'orca', runId };
      updateJob(db, { jobId, payload, at: now });
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'run-created', payload: { runId, kernelTerminal: kernelJob?.worker_id ?? null, storedOn: kernelJob ? kernelJob.job_id : jobId, ...(replacedRunId ? { replacedRunId } : {}) },
    });
  });
  return { ok: true, runId, kernelJob, kernelPayload, kernelHandle: kernelJob?.worker_id ?? null };
}

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
  try { release = closeWorker({ dispatch: dispatchId, stopFirst: true }); stop = release.stop ?? null; }
  catch (e) { release = { ok: false, outcome: 'unknown', error: String(e?.message ?? e) }; stop = release; }
  try { observation = workerShow({ dispatch: dispatchId }); }
  catch (e) { observation = { ok: false, error: String(e?.message ?? e) }; }
  const provenNoEffect = managedNoEffectProof({ shown: observation, release });
  let effectState; if (provenNoEffect || (stop?.ok && release?.ok)) effectState = 'none'; else if ([stop?.effectState, release?.effectState].includes('unknown')) effectState = 'unknown'; else effectState = 'partial';
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
// the dispatch boundary. A Kernel held two cut ordinals behind a
// failed seam whose grants broke the Work layout; the api had no way to drop
// them, so the cut could not be re-planned and the workflow sat still. The row
// settles `cancelled` with the reason, and every queued job that waits on it
// is named so the Kernel re-points or drops those too.
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
  emit(out, `dropped ${jobId} (cancelled: ${reason})${waiting.length ? '; still waiting on it: ' + waiting.join(', ') : ''}`, args.json);
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
const UNPROVABLE_EFFECT_HINTS = new Set(['external-effects', 'runtime-effects', 'live-provider', 'destructive-gate']);
const opRiskHints = (op) => {
  try {
    const hints = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'))?.route?.riskHints;
    return Array.isArray(hints) ? hints.map(String) : [];
  } catch { return null; }
};
const EVIDENCE_CAP = 40;
// A worker terminal a responding Orca calls gone (TERMINAL_GONE_CODES) died with its host when the
// workflow's Kernel terminal went the same way: the Kernel seat still names a gone terminal, or the seat
// was cleared for a gone terminal (kernel-stale-cleared) since this attempt's dispatch. That is an Orca
// restart or host reboot wiping every terminal, not the provider or the op: on 2026-09-26 (09:55, 11:30,
// 17:04 +07) three such wipes killed every Kernel and worker, and each worker with partial effects spent
// a business attempt, demoted its pool and fed a worker-died-no-report pattern (inc-ceb153dfd2cf,
// inc-65666fb85763). Returns {cause:'host-terminal-wipe', errorCode, kernelTerminal, proof} or null.
const HOST_TERMINAL_WIPE = 'host-terminal-wipe';
// A host-wide DISCONNECT is the same event seen from a responding Orca: once every
// Kernel terminal of both ledgers was cleared 'terminal disconnected' within ten minutes, and the five
// workers alive then - three on one product's ops, two on the other's - settled failed-no-report as the
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
/** A requeue already written for this job: its receipt, as {result}, or null. */
const alreadyRequeued = (ledger, args, job, prior) => {
  const jobId = job.job_id;
  if (job.status === 'queued' && prior.reason === 'dead-worker-requeued') {
    const released = releaseDeadWorker(ledger, job);
    const out = { ok: true, jobId, recovery: 'requeued', alreadyRecovered: true, status: 'queued', attempt: tryOf(job), ...(released ? { managedWorker: released } : {}) };
    emit(out, `reconcile ${jobId}: dead worker already requeued (attempt ${tryOf(job)})${workerNote(released)}`, args.json);
    return { result: undefined };
  }
  return null;
};
/** A fence already written for this job (settled failed-no-report when the owned paths bound its evidence): its receipt, as {result}, or null. */
const alreadyFenced = (ledger, args, job, prior, repo) => {
  const jobId = job.job_id;
  if (job.status === 'effect_unknown' && prior.reason === 'dead-worker-fenced') {
    // A fence whose evidence the owned paths bound settles failed-no-report and retries, like a fresh recovery.
    if (args['settle-failed'] && settleableEvidence(prior.evidence)) {
      settleFailedNoReport(ledger, job, { workerProof: prior.worker ?? null, evidence: prior.evidence ?? [], dispatchId: prior.dispatchId ?? null, pathProof: prior.paths ?? null, repo, args }); return { result: undefined };
    }
    const released = releaseDeadWorker(ledger, job);
    const out = { ok: true, jobId, recovery: 'fenced', alreadyRecovered: true, status: 'effect_unknown', attempt: tryOf(job), evidence: prior.evidence ?? [], ...(released ? { managedWorker: released } : {}) };
    emit(out, `reconcile ${jobId}: dead worker already fenced effect_unknown (${(prior.evidence ?? []).join(', ')}); inspect and starci kernel settle it${workerNote(released)}`, args.json);
    return { result: undefined };
  }
  return null;
};
/** A failed-no-report settle already written for this job: its receipt, as {result}, or null. */
const alreadySettledFailed = (db, args, job, prior) => {
  const jobId = job.job_id;
  // Already settled failed-no-report (by the watchdog, or a repeat): the receipt names its retry.
  if (job.status === 'failed' && prior.reason === FAILED_NO_REPORT) {
    const retry = db.prepare('SELECT job_id,try_no AS attempt,status FROM jobs WHERE workflow_id=? AND retry_of=?').get(job.workflow_id, jobId) ?? null;
    const out = { ok: true, jobId, recovery: 'settled-failed', alreadyRecovered: true, status: 'failed', attempt: tryOf(job),
      retry: retry ? { jobId: retry.job_id, attempt: retry.attempt, status: retry.status } : null };
    emit(out, `reconcile ${jobId}: dead worker already settled failed-no-report${retry ? '; retry ' + retry.job_id + ' (attempt ' + retry.attempt + ') is ' + retry.status : ''}`, args.json);
    return { result: undefined };
  }
  return null;
};
/** A dead-worker recovery already written for this job: its receipt, as {result}, or null. */
const alreadyReconciledDeadWorker = (ledger, args, job, prior, repo) => alreadyRequeued(ledger, args, job, prior)
  ?? alreadyFenced(ledger, args, job, prior, repo) ?? alreadySettledFailed(ledger.db, args, job, prior);
/** The observed worker of a job `--dead-worker` may recover; a job that cannot be recovered, or a worker that is alive, is refused. */
const recoverableWorkerOf = (db, args, job) => {
  const jobId = job.job_id;
  if (!['running', 'answering', 'leased'].includes(job.status)) {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --dead-worker recovers only a running, answering or leased job`), { code: 'dead-worker-not-running' });
  }
  const worker = observeOperationWorker(job, Date.now(), db);
  if (worker.liveness === 'launching') {
    const out = { ok: false, jobId, recovery: null, reason: 'dispatch-in-flight', worker };
    emit(out, `reconcile REFUSED for ${jobId}: dispatch-in-flight (leased with no worker until its lease deadline ${new Date(worker.leaseDeadline ?? 0).toISOString()}); nothing written`, args.json);
    throw new VerbExit(1);
  }
  // A wedged worker is dead to its contract - the turn can never file the report - but only the
  // settle-failed route accepts it: a plain --dead-worker requeue spends nothing for an attempt
  // whose 30+ minute turn may hold effects the owned paths cannot bound (inc-2c1ac4ff3e48).
  // A gate-loop worker (a host dialog back after maxPerAttempt answers) recovers the same way.
  const wedged = worker.liveness === 'wedged' || worker.liveness === 'gate-loop';
  if (!DEAD_WORKER_LIVENESS.includes(worker.liveness) && !(wedged && args['settle-failed'])) {
    let reason;
    if (worker.liveness === 'unknown') reason = 'worker-liveness-unproven';
    else if (worker.liveness === 'gate-loop') reason = 'worker-gate-loop';
    else if (wedged) reason = 'worker-wedged';
    else reason = 'worker-alive';
    const out = { ok: false, jobId, recovery: null, reason, worker };
    emit(out, `reconcile REFUSED for ${jobId}: ${reason} (liveness ${worker.liveness}${worker.reason ? ': ' + worker.reason : ''}); nothing written${wedged ? ' - a wedged worker recovers only through starci kernel reconcile --job ' + jobId + ' --dead-worker --settle-failed' : ''}`, args.json);
    throw new VerbExit(1);
  }
  return worker;
};
/** A report the dead worker filed (nothing is written): true when there is one. */
const deadWorkerFiledReport = ({ job, db, jobId, repo, worker, args }) => {
  const report = db.prepare(`SELECT dispatch_id,outcome,consumed_at FROM reports WHERE workflow_id=?
      AND (dispatch_id=? OR attempt_id=(SELECT max(attempt_id) FROM op_attempts WHERE job_id=?)) ORDER BY created_at DESC LIMIT 1`)
    .get(job.workflow_id, reportDispatchIdOf(db, job), jobId);
  if (report) {
    const next = report.consumed_at ? 'starci kernel record-checks, then starci kernel settle' : 'starci kernel consume-report, starci kernel record-checks, then starci kernel settle';
    const out = { ok: true, jobId, recovery: 'settle', route: 'settle', worker,
      report: { dispatchId: report.dispatch_id, outcome: report.outcome, consumed: Boolean(report.consumed_at) }, next };
    emit(out, `reconcile ${jobId}: the dead worker filed report ${report.dispatch_id} (${report.outcome}); nothing written - ${next}`, args.json);
    return true;
  }
  return false;
};
/** A report the dead worker wrote but never filed: filed on its behalf; true when that worked. */
const deadWorkerSalvagedReport = ({ ledger, args, job, db, jobId, op, repo, worker, contract }) => {
  // A report the worker wrote but never filed is filed on its behalf through starci kernel report itself, so every
  // report guard still applies (scripts/kernel/report-salvage.mjs); the Kernel then checks and settles it.
  if (!args['no-salvage']) {
    const salvage = bestEffort(() => {
      const roots = jobPlacements(db, job, repo).filter((p) => !p.unresolved).map((p) => path.resolve(p.base, String(p.path).replace(/[\\/]\*\*[\\/]?$/, '') || '.'));
      const candidates = unfiledReportCandidates({ roots, sinceMs: contract?.created_at ?? job.created_at, jobId, dispatchId: reportDispatchIdOf(db, job) });
      return salvageUnfiledReport({ candidates, fileReport: (file) => {
        const r = runNode([fileURLToPath(import.meta.url), 'report', '--repo', repo, '--job', jobId, '--report', file, '--json'],
          { timeout: 120_000 });
        return { ok: r.status === 0, error: (r.stderr || r.stdout || '').trim().split(/\r?\n/).pop() };
      } });
    });
    if (salvage?.salvaged) {
      ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'report-salvaged',
        payload: { opId: op, attempt: tryOf(job), file: salvage.salvaged.file, outcome: salvage.salvaged.outcome, liveness: worker.liveness, tried: salvage.tried.length } });
      const out = { ok: true, jobId, recovery: 'settle', route: 'settle', worker, salvaged: salvage.salvaged, tried: salvage.tried, next: 'starci kernel consume-report, starci kernel record-checks, then starci kernel settle' };
      emit(out, `reconcile ${jobId}: the dead worker wrote report ${salvage.salvaged.file} (${salvage.salvaged.outcome}) but never filed it; filed on its behalf - starci kernel consume-report, starci kernel record-checks, then starci kernel settle`, args.json);
      return true;
    }
  }
  return false;
};
/** A report the dead worker filed, or wrote and never filed: true when one was found. */
const deadWorkerReportFound = (ctx) => deadWorkerFiledReport(ctx) || deadWorkerSalvagedReport(ctx);
/** The effects of the job's owned paths, or why they cannot be proven. */
const ownedPathEffectsOf = ({ db, job, payload, repo, contract }) => {
  try {
    return ownedPathEffects({ base: repo, ownedPaths: ownedPathsOf(payload), placements: jobPlacements(db, job, repo),
      sinceMs: contract?.created_at ?? job.created_at });
  } catch (error) { return { provable: false, why: 'placement', error: String(error?.message ?? error) }; }
};
/** The effect evidence a dead worker leaves: its checks, worker questions, op risk hints and the owned paths. */
const deadWorkerEvidenceOf = ({ db, job, jobId, op, payload, repo, contract }) => {
  const evidence = [];
  if (independentChecksOf(db, { jobId })) evidence.push('checks');
  const asked = db.prepare("SELECT key FROM inbox WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.jobId')=?")
    .all(job.workflow_id, WORKER_QUESTION, jobId);
  for (const row of asked) evidence.push(`worker-question:${row.key}`);
  const hints = opRiskHints(op);
  if (hints == null) evidence.push('op-manifest-unreadable');
  else for (const hint of hints) if (UNPROVABLE_EFFECT_HINTS.has(hint)) evidence.push(`risk:${hint}`);
  const paths = ownedPathEffectsOf({ db, job, payload, repo, contract });
  if (!paths.provable) evidence.push(`owned-paths-unverifiable:${paths.why}`);
  else {
    for (const file of paths.dirty) evidence.push(`dirty:${file}`);
    for (const sha of paths.commits) evidence.push(`commit:${sha}`);
  }
  return { evidence, hints, paths };
};
/** Requeues the dead worker's job on the same attempt (no business try spent); the result and the leases released. */
const requeueDeadWorker = (db, { job, jobId, next, attemptId, now, dispatchId, workerProof, hints, pathProof, priorDeaths, cleanup }) => {
  const leasesReleased = releaseLeases(db, { jobId });
  delete next.managed;
  if (next.orca) { const orca = { ...next.orca }; delete orca.dispatchId; delete orca.agentTerminalHandle; next.orca = orca; }
  if (next.hierarchy?.runtime) {
    const runtime = { ...next.hierarchy.runtime }; delete runtime.taskId; delete runtime.dispatchId; delete runtime.terminalHandle;
    next.hierarchy.runtime = runtime;
  }
  const result = { reason: 'dead-worker-requeued', effectState: 'none', attemptConsumed: false, retryable: true, dispatchId,
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
  return { result, leasesReleased };
};
/** Fences the dead worker's job effect_unknown (its effect cannot be bounded); the result. */
const fenceDeadWorker = (db, { job, jobId, next, attemptId, now, dispatchId, workerProof, effectEvidence, recorded, pathProof }) => {
  const result = { reason: 'dead-worker-fenced', effectState: effectEvidence ? 'partial' : 'unknown', attemptConsumed: false, retryable: false,
    dispatchId, evidence: recorded, worker: workerProof, paths: pathProof, at: now };
  if (job.status === 'answering') setJobStatus(db, { jobId, to: 'running', reason: 'dead-worker-fenced', attemptId, at: now });
  if (job.status === 'leased') setJobStatus(db, { jobId, to: 'running', reason: 'dead-worker-fenced', attemptId, at: now });
  setJobStatus(db, { jobId, to: 'effect_unknown', reason: 'dead-worker-fenced', attemptId, at: now, payload: next });
  recordJobResult(db, { jobId, result, at: now });
  if (attemptId != null) updateAttempt(db, { attemptId, at: now, endState: 'effect-unknown', effectState: result.effectState });
  recordWhy(db, attemptId, { at: now });
  return result;
};
/** Stops and releases the managed Dispatch of a requeued job before its slot is reused (best effort, recorded only): its receipt, else null. */
const managedCleanupOf = (payload, recovery) => {
  if (recovery !== 'requeued' || !payload.managed?.dispatchId) return null;
  const closedNow = bestEffort(() => closeWorker({ dispatch: payload.managed.dispatchId, stopFirst: true }));
  return { dispatchId: payload.managed.dispatchId, stop: closedNow?.stop?.ok === true, release: closedNow?.ok === true };
};
/** Releases the machine refs a recovery freed (the ledger proof stands when the machine store cannot be reached); the count released. */
const releaseMachineRefs = (machineRefs) => {
  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  return machineRefsReleased;
};
/** The receipt of a written dead-worker recovery, printed as JSON or as one line. */
const emitDeadWorkerRecovery = (args, { job, jobId, recovery, dispatchId, leasesReleased, machineRefsReleased, worker, result, released, recorded, pathProof }) => {
  const out = recovery === 'requeued'
    ? { ok: true, jobId, recovery, status: 'queued', attempt: tryOf(job), attemptConsumed: false, effectState: 'none', dispatchId,
      leasesReleased, machineRefsReleased, worker, proof: result.proof, ...(released ? { managedWorker: released } : {}) }
    : { ok: true, jobId, recovery, status: 'effect_unknown', attempt: tryOf(job), effectState: result.effectState, dispatchId,
      evidence: recorded, worker, paths: pathProof, ...(released ? { managedWorker: released } : {}) };
  emit(out, recovery === 'requeued'
    ? `reconciled ${jobId}: worker ${worker.terminalHandle} is ${worker.liveness} and the attempt proved no effect; same attempt ${tryOf(job)} queued (leases released: ${leasesReleased}) - route and dispatch it again${workerNote(released)}`
    : `reconciled ${jobId}: worker ${worker.terminalHandle} is ${worker.liveness}; fenced effect_unknown on ${recorded.join(', ')} - inspect the evidence and starci kernel settle it (fail or blocked), then retry as a new attempt${workerNote(released)}`, args.json);
};
function reconcileDeadWorker(ledger, args, job, repo) {
  const db = ledger.db, jobId = job.job_id, op = jobOpOf(job), payload = jobPayloadOf(job);
  const prior = jobResult(db, jobId) ?? {};
  const already = alreadyReconciledDeadWorker(ledger, args, job, prior, repo);
  if (already) return already.result;
  const worker = recoverableWorkerOf(db, args, job);
  const contract = latestContractOf(db, jobId);
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId
    ?? contract?.dispatch_id ?? job.worker_id ?? null;
  if (deadWorkerReportFound({ ledger, args, job, db, jobId, op, repo, worker, contract })) return;

  const { evidence, hints, paths } = deadWorkerEvidenceOf({ db, job, jobId, op, payload, repo, contract });
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
    settleFailedNoReport(ledger, job, { workerProof, evidence: recorded, dispatchId, pathProof, repo, args }); return undefined;
  }

  // A managed Dispatch record may outlive its terminal on a host that did not
  // restart; stop and release it before the slot is reused. Best effort and
  // recorded only: the terminal is already proven gone, and after a reboot
  // Orca no longer knows the Dispatch at all.
  const cleanup = managedCleanupOf(payload, recovery);

  const machineRefs = [];
  let leasesReleased = 0, result;
  ledger.transaction(() => {
    const now = Date.now();
    const fresh = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
    if (fresh?.status !== job.status) throw Object.assign(new Error(`job ${jobId} moved to ${fresh?.status} during recovery; re-read status`), { code: 'dead-worker-raced' });
    const next = jobPayloadOf(job);
    next.deadWorkers = [...(Array.isArray(next.deadWorkers) ? next.deadWorkers : []),
      { attempt: tryOf(job), dispatchId, ...workerProof, recovery, at: now }];
    const attemptId = latestAttemptOf(db, jobId)?.attempt_id ?? null;
    if (recovery === 'requeued') ({ result, leasesReleased } = requeueDeadWorker(db, { job, jobId, next, attemptId, now, dispatchId, workerProof, hints, pathProof, priorDeaths, cleanup }));
    else result = fenceDeadWorker(db, { job, jobId, next, attemptId, now, dispatchId, workerProof, effectEvidence, recorded, pathProof });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: recovery === 'requeued' ? 'dead-worker-requeued' : 'dead-worker-fenced',
      payload: { opId: op, attempt: tryOf(job), dispatchId, worker: workerProof, attemptConsumed: false,
        ...(recovery === 'requeued' ? { leasesReleased, machineRefs } : { evidence: recorded, effectState: result.effectState }) },
    });
  });
  const machineRefsReleased = releaseMachineRefs(machineRefs);
  // After the recovery is written: the dead worker's shell is closed, never before.
  const released = releaseDeadWorker(ledger, job);
  emitDeadWorkerRecovery(args, { job, jobId, recovery, dispatchId, leasesReleased, machineRefsReleased, worker, result, released, recorded, pathProof });
}

// `reconcile --job <id> --dead-worker --settle-failed`: a dead worker's attempt settled with no
// human. The watchdog runs it under --repair for every frontier deadWorkerJobs entry: a worker
// whose agent exited to a bare shell, whose terminal disconnected or vanished, or that stayed quiet
// past its provider's timeout after a nudge will never file its report; the repair replaces the manual steps for the Kernel. Effect evidence
// the owned paths bound (dirty files, commits, a checks row, a worker question, exhausted
// infrastructure requeues) is what a retry continues from, so the attempt settles failed (reason
// failed-no-report, reportFiled false: a business attempt spent, engine/admission.mjs
// retryDisposition), its leases, managed worker, terminal and Orca Task are released, and the
// no-report route of modules/models/kinds.yaml runs (enqueueNextStep): ONE retry of the same op and
// cut ordinal as attempt+1, which starci kernel route moves off the pools its lineage died on
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
// ordinal as a new attempt, exactly as `starci kernel enqueue` builds it, marked retryReason.auto. `retryOf`
// pins the predecessor and makes it idempotent: a job already naming it as retry.retryOf is returned
// instead. Runs inside the caller's transaction.
// `repair` {records, ownedPaths, repository, params} enqueues a FRESH job of `op` for the owner a failed
// verify named (verify-failure.mjs resolveRootOwner) when the workflow has no job of that op to reopen.
/** The payload a follow-on starts from: a root verify's records and paths, a repair's own, else its template's. */
const followOnBasePayloadOf = ({ rootVerify, repair, source, ownedPaths, params }) => {
  if (rootVerify) return { records: source.records ?? [], owned_paths: ownedPaths, ...(params ? { params } : {}) };
  if (repair) return { records: repair.records ?? [], owned_paths: repair.ownedPaths ?? [], ...(repair.repository ? { repository: repair.repository } : {}), ...(repair.params ? { params: repair.params } : {}) };
  return source;
};
/** What an admission error asks for: {refused} (the enqueue result), or {retry} once the spec was adjusted; an unknown error is rethrown. */
const followOnAdmissionError = (error, spec, reopen) => {
  if (!error?.code) throw error;
  if (error.code === 'unit-in-flight') return { refused: { enqueued: false, jobId: error.open?.[0] ?? null, reason: 'retry-exists' } };
  if (error.code === 'unit-already-passed' && !spec.reopen) { spec.reopen = reopen; return { retry: true }; }
  if (error.code === 'unit-overlaps-failed-unit' && !spec.retryOf) { spec.retryOf = error.overlaps[0].jobId; return { retry: true }; }
  return { refused: { enqueued: false, reason: error.code, detail: error.message } };
};
/** Admits the follow-on's try on its unit's gate (a passed unit reopens, an overlapping failed unit is continued): {admitted}, or {refused} with the enqueue result. */
const admitFollowOnUnit = (db, spec, reopen) => {
  let admitted = null;
  for (let hop = 0; !admitted && hop < 3; hop += 1) {
    try { admitted = admitUnit(db, spec); }
    catch (error) {
      const asked = followOnAdmissionError(error, spec, reopen);
      if (asked.refused) return asked;
    }
  }
  if (!admitted) return { refused: { enqueued: false, reason: 'unit-not-admitted' } };
  return { admitted };
};
/** The fields a follow-on carries over from its source payload: repository, params, cut, the --after jobs and the foundation. */
const followOnCarriedFields = ({ payload, fresh, rootVerify, repair, cut, after, priorAfter }) => ({
  ...((!rootVerify || repair) && payload.repository ? { repository: payload.repository } : {}),
  ...(payload.params ? { params: payload.params } : {}),
  ...(cut ? { cut } : {}),
  ...(after?.length || priorAfter.length ? { after: [...new Set([...priorAfter, ...(after ?? [])])] } : {}),
  ...(!fresh && payload.foundation ? { foundation: payload.foundation } : {}),
});
/** The payload of the job a follow-on enqueues. */
const followOnJobPayloadOf = ({ op, payload, fresh, title, rootVerify, repair, cut, after, priorAfter, reason, of, liveness, routed, goal, jobId, workflowId, wf, admitted }) => {
  return {
    opId: op, records: payload.records ?? [], owned_paths: payload.owned_paths ?? [], title: title ?? payload.title ?? op, risk: fresh ? null : payload.risk ?? null,
    ...followOnCarriedFields({ payload, fresh, rootVerify, repair, cut, after, priorAfter }),
    retryReason: { reason, of, liveness, auto: true },
    ...(routed ? { routed } : {}),
    ...(rootVerify ? { rootVerify } : {}),
    goal_binding: { revision: goal?.revision ?? null, identity: goal?.goal_identity ?? null },
    hierarchy: {
      schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId), parentNodeId: kernelNodeId(workflowId), role: 'operation',
      workflowId, jobId, opId: op, attempt: admitted.tryNo, generation: wf.generation ?? 0, runtime: { host: 'orca' },
    },
  };
};
const enqueueFollowOn = (ledger, template, { op = jobOpOf(template), retryOf = null, after = null, reason, of, liveness = null, routed = null, rootVerify = null, ownedPaths = null, params = null, title = null, repair = null }) => {
  const db = ledger.db, workflowId = template.workflow_id, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf || wf.phase === 'finished' || wf.archived_at) return { enqueued: false, reason: `workflow ${workflowStopLabel(wf)}` };
  const source = jobPayloadOf(template);
  const fresh = Boolean(rootVerify || repair);
  const payload = followOnBasePayloadOf({ rootVerify, repair, source, ownedPaths, params });
  const cut = fresh ? null : payload.cut ?? null;
  // The try is admitted on the unit's gate like every enqueue (scripts/kernel/units.mjs): a route re-runs the unit's
  // latest try - a passed one only through a reopen that names the route as its reason - and never past its budget.
  // A fresh repair or root verify over a failed unit of the same work continues that unit instead of starting one.
  const reopen = { reason: `${reason}: ${of ?? template.job_id}${routed?.route ? ' (route ' + routed.route + ')' : ''}`, by: 'runtime' };
  const spec = { workflowId, op, goalRevision: latestGoal(db, workflowId)?.revision ?? null, payload: { ...payload, cut }, retryOf, resolveLatest: true, reopen: null };
  const admission = admitFollowOnUnit(db, spec, reopen);
  if (admission.refused) return admission.refused;
  const admitted = admission.admitted;
  const goal = latestGoal(db, workflowId);
  const jobId = `op-${op}-${newToken().slice(0, 10)}`;
  const priorAfter = !fresh && Array.isArray(payload.after) ? payload.after : [];
  const next = followOnJobPayloadOf({ op, payload, fresh, title, rootVerify, repair, cut, after, priorAfter, reason, of, liveness, routed, goal, jobId, workflowId, wf, admitted });
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
const failureShapeOf = ({ reportFiled, reportOutcome, claimOverruled, failureClass = null, op = null }) => {
  if (!reportFiled) return { verdict: 'no-report' };
  if (claimOverruled) return { outcome: reportOutcome, verdict: 'rejected' };
  return { outcome: reportOutcome ?? 'failed', ...(failureClass ? { class: failureClass } : {}),
    // A review's measured findings are the `findings` verdict the review route repairs from.
    ...(failureClass === 'findings' && op === ROOT_VERIFY_OP ? { verdict: 'findings' } : {}) };
};
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
  const norm = (p) => stripSlashes(String(typeof p === 'string' ? p : p?.path ?? '').replaceAll('\\', '/').replace(/\/\*\*$/, ''));
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
 * (a uat.verify named a record id of another repository five times and the
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
        const doc = parseYaml(fs.readFileSync(path.join(repo, stripSlashes(rel), 'index.yaml'), 'utf8'));
        if (doc?.id === id) return row;
      } catch { /* not a record directory */ }
    }
  }
  return null;
};
const routeFiringsOf = (db, job, routeId) => {
  let fired = 0;
  for (const row of lineageJobsOf(db, job)) {
    const step = jobResult(db, row.job_id)?.nextStep;
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
/**
 * The report's own red checks, attributed like starci kernel record-checks attributes the Kernel's (gate-attribution.mjs):
 * {peer:true, checks[], peers[], routes[]} when every red check (at least one) names files and reads
 * `peer`, and no check the Kernel recorded for this attempt read `own`; else {peer:false, reason}.
 */
/** One red check attributed: {peer:true, peers[]} when it reads `peer`, else {peer:false, reason}. */
const redCheckAttribution = (db, { repo, job, check, canon }) => {
  const failing = Array.isArray(check.failing) && check.failing.length ? check.failing : failingFromText(check.evidence);
  if (!failing.length) return { peer: false, reason: `red check ${check.name} names no failing file` };
  let attribution;
  try { attribution = attributeRedGate(db, { repo, job, failing, canon }); } catch (error) { return { peer: false, reason: `attribution failed: ${error?.message ?? error}` }; }
  if (attribution.class !== 'peer') return { peer: false, reason: `red check ${check.name} reads ${attribution.class} (${attribution.files.map((f) => f.path + ':' + f.owner).join(', ')})` };
  return { peer: true, peers: attribution.peers };
};
function reportPeerAttribution(db, job, envelope, repo) {
  const red = (Array.isArray(envelope?.checks) ? envelope.checks : []).filter((c) => c && Number.isInteger(c.exitCode) && c.exitCode !== 0);
  if (!red.length) return { peer: false, reason: 'the report records no red check' };
  const kernel = independentChecksOf(db, { jobId: job.job_id })?.checks ?? [];
  if (kernel.some((c) => c?.attribution?.class === 'own')) return { peer: false, reason: "a Kernel check reads the red as this op's own" };
  if (!repo) return { peer: false, reason: 'no repository to attribute in' };
  const canon = leaseCanonOf(db, repo);
  const checks = [], peers = [], routes = [];
  for (const check of red) {
    const attributed = redCheckAttribution(db, { repo, job, check, canon });
    if (!attributed.peer) return attributed;
    checks.push(check.name);
    for (const peer of attributed.peers) {
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
/** A spent retry cap under the autopilot that only the owner or the final review can settle: the leg is deferred and independent legs proceed. */
const deferredCapStep = (c, route, s, { autopilot, blocker }) => {
  const { ledger, job, op, record } = c;
  const { limit, fired } = s;
  const reason = blocker === 'authority'
    ? `${op} ${job.job_id}: an authority blocker (route ${route.id}) is the owner's decision - deferred to handover, independent legs proceed`
    : `${op} ${job.job_id}: route ${route.id} spent its limit ${limit} and ${autopilot.gates} supervisor-gate(s) (supervisorExtraBudget ${autopilot.budget}) - deferred to the final review`;
  ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: blocker === 'authority' ? AUTOPILOT_EVENTS.deferredToHandover : AUTOPILOT_EVENTS.deferred,
    payload: { jobId: job.job_id, jobIds: [job.job_id], opId: op, by: AUTOPILOT_BY, reason, route: route.id, ...(blocker === 'authority' ? { key: `job:${job.job_id}`, deferClass: 'owner-decision', classes: ['owner-decision'], stubPath: 'the leg waits for the owner at the end; independent legs proceed', owed: 'the owner decision the authority blocker names' } : {}) } });
  return record({ kind: 'deferred', route: route.id, limit, firing: fired, reason });
};
/** A spent retry cap or an environment blocker under the autopilot: a runtime or process issue, so a supervisor-gate holds the failed job. */
const supervisorCapStep = (c, route, s, { autopilot, blocker, evidence }) => {
  const { ledger, job, op, record } = c;
  const { limit, fired } = s;
  const detail = route.to?.needUser
    ? `${op} ${job.job_id}: route ${route.id} (${blocker ?? 'needUser'}) cannot run on its own - a runtime/environment issue for the Supervisor (autopilot); fix it (land to .claude) or decide the retry, then resolve --by supervisor`
    : `${op} ${job.job_id}: route ${route.id} already fired ${fired} of ${limit} times for this node group - a runtime/process issue for the Supervisor (autopilot, gate ${autopilot.gates + 1} of ${autopilot.budget}): read the attempts' reports, fix the root cause (land to .claude) or route the fix to the op that owns it, then resolve --by supervisor and the Kernel retries`;
  const incidentId = openSupervisorGate(ledger, { workflowId: job.workflow_id, opId: op, holds: [job.job_id], detail, evidence, route: route.id, workaround: { cause: 'retry-cap', noWorkaround: 'retry-cap-spent' } });
  return record({ kind: SUPERVISOR_GATE, route: route.id, limit, firing: fired, incidentId, reason: detail });
};
/** Under the autopilot a spent retry cap is the Supervisor's (supervisor-gate, within supervisorExtraBudget gates per node group), then deferred to the final review; null without the autopilot. */
const autopilotCapStep = (c, route, s) => {
  const { db, job, shape } = c;
  const { limit, fired } = s;
  // Autopilot (owner ruling 2026-09-28 autopilot-run-to-finish): a spent retry cap or an environment blocker is a
  // runtime/process issue - the Supervisor's (supervisor-gate), within supervisorExtraBudget gates per node group,
  // then the leg is deferred to the final review. An authority blocker is the owner's: deferred to handover.
  const autopilot = routeCapUnderAutopilot(db, job, { lineage: lineageJobsOf(db, job), routeId: route.id });
  if (!autopilot) { return null; }
  const blocker = route.on?.blocker ?? null;
  const evidence = { route: route.id, limit, fired, shape, jobId: job.job_id, attempt: tryOf(job),
    lineage: lineageJobsOf(db, job).slice(-6).map((row) => { const { verdict = null, reason = null, report = null } = jobResult(db, row.job_id) ?? {}; return { jobId: row.job_id, attempt: tryOf(row), status: row.status, verdict, reason, report }; }) };
  if (blocker === 'authority' || autopilot.kind === 'deferred') return deferredCapStep(c, route, s, { autopilot, blocker });
  return supervisorCapStep(c, route, s, { autopilot, blocker, evidence });
};
/** An owner-gate incident holds the failed job alone; other legs keep running. */
const ownerGateStep = (c, route, s) => {
  const { ledger, job, op, envelope, failure, record, unit, exhausted } = c;
  const { limit, fired } = s;
  const routeGateDetail = () => {
    if (route.to?.needUser) {
      let text = `${op} ${job.job_id}: route ${route.id} needs the owner`;
      if (failure?.class) { text += ' (failure class ' + failure.class + ': ' + failure.reason + (envelope?.rootCause?.node ? '; the report names ' + envelope.rootCause.node + ', which resolves to no build op this workflow can repair' : '') + ')'; }
      return text;
    }
    if (exhausted) { return `${op} ${job.job_id}: unit ${unit.unit.unit_id} spent ${spentTriesOf(ledger.db, unit.unit)} of its ${unit.unit.try_budget} tries (unit-try-budget-exhausted); the owner or the Supervisor decides - starci kernel unit --raise-budget, a reshaped unit, or drop it`; }
    return `${op} ${job.job_id}: route ${route.id} already fired ${fired} of ${limit} times for this node group; the owner decides whether it runs again`;
  };
  const detail = routeGateDetail();
  return record({ kind: 'owner-gate', route: route.id, limit, firing: fired, ...(failure?.class ? { class: failure.class, classReason: failure.reason } : {}), incidentId: openRouteGate(ledger, job, detail, route.id), reason: detail });
};
/** A route that needs the owner, or spent its limit, or whose unit spent its tries: the autopilot defers it or opens a supervisor-gate, else an owner-gate holds the failed job. */
const routeCapStep = (c, route, s) => autopilotCapStep(c, route, s) ?? ownerGateStep(c, route, s);
/** The build owner a product defect or measured finding names directly (not an op with a job in this workflow), else null. */
const directRootOwnerOf = (c, route, s) => {
  const { db, job, op, shape, envelope, repo, catalog } = c;
  // A product defect or measured findings with a named owner: repair THAT build, then this op runs again
  // behind it - never the same walk again at the same HEAD (an app-auth uat.verify, a1-a5).
  // A node that names an op with a job in this workflow keeps the read-only root verify below (the
  // op-graph ruling); a Work record id, an explicit rootCause.op/files, or an op with no job here is
  // repaired directly.
  const rcNode = typeof envelope?.rootCause?.node === 'string' ? envelope.rootCause.node.trim().split('#')[0] : '';
  const rcNamesOp = Boolean(rcNode && catalog.kinds?.[kindOfOp(catalog, rcNode)]);
  const rcDirect = envelope?.rootCause && (!rcNamesOp || typeof envelope.rootCause.op === 'string' || (Array.isArray(envelope.rootCause.files) && envelope.rootCause.files.length)
    || !repairTemplateOf(db, job, [opOfKind(catalog, kindOfOp(catalog, rcNode))]));
  if (!['product', 'findings'].includes(shape.class) || !rcDirect || !route.to?.kind || route.to.kind === 'same') { return null; }
  const failing = (Array.isArray(envelope.checks) ? envelope.checks : []).flatMap((c) => (Array.isArray(c?.failing) ? c.failing : []));
  let owner = null;
  try { owner = resolveRootOwner({ repo, rootCause: envelope.rootCause, kinds: catalog, failing, reporterPayload: jobPayloadOf(job) }); } catch { owner = null; }
  return owner?.family === 'build' && owner.op !== op ? owner : null;
};
/** The repair job of a root owner: its job in flight, its settled job reopened, or a new repair of its records; null when it owns no path. */
const ownerRepairJobOf = (c, route, s, { owner }) => {
  const { ledger, db, job, op, shape, envelope, repo, reason } = c;
  const { routed } = s;
  const existing = ownerTemplateOf(db, job, owner);
  if (existing && !FINAL_SETTLED.includes(existing.status)) return { jobId: existing.job_id, enqueued: false, reason: 'in-flight' };
  if (existing) return enqueueFollowOn(ledger, existing, { retryOf: existing.job_id, reason, of: job.job_id, routed });
  if (!owner.ownedPaths.length) { return null; }
  let target = { ok: true, repository: null };
  try { if (repo) target = enqueueRepository({ op: owner.op, repository: null, ownedPaths: owner.ownedPaths, repo }); } catch { /* dispatch places it */ }
  const rc = envelope.rootCause;
  const repair = enqueueFollowOn(ledger, job, { op: owner.op, reason, of: job.job_id, routed,
    title: `repair ${owner.record ?? owner.op}: ${String(rc.claim ?? '').slice(0, 160)}`,
    repair: { records: owner.record ? [owner.record] : [], ownedPaths: owner.ownedPaths, repository: target.ok ? target.repository : null } });
  const repairRow = repair?.jobId ? db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(repair.jobId) : null;
  if (repairRow) {
    const p = jobPayloadOf(repairRow);
    p.repairFor = { of: job.job_id, op, route: route.id, class: shape.class,
      rootCause: Object.fromEntries(['node', 'category', 'claim', 'evidence', 'counterCheck', 'expectedFix', 'recheck'].filter((k) => rc[k] != null).map((k) => [k, rc[k]])) };
    updateJob(db, { jobId: repair.jobId, payload: p });
  }
  return repair;
};
/** A product defect or measured findings with a named build owner: repair THAT build, then this op runs again behind it; null when the report names no such owner. */
const ownerRepairStep = (c, route, s) => {
  const { ledger, job, op, shape, record, reason } = c;
  const { base, routed, classNote, limit } = s;
  const owner = directRootOwnerOf(c, route, s);
  if (!owner) { return null; }
  const ownerView = { op: owner.op, via: owner.via, ...(owner.record ? { record: owner.record } : {}), ...(owner.repository ? { repository: owner.repository } : {}), files: owner.ownedPaths.slice(0, 30) };
  const repair = ownerRepairJobOf(c, route, s, { owner });
  if (!repair?.jobId) { return null; }
  const rerun = ['reopen', 'pause'].includes(route.then) ? enqueueFollowOn(ledger, job, { retryOf: job.job_id, after: [repair.jobId], reason, of: job.job_id, routed }) : null;
  return record({ kind: 'repair', ...base, ...classNote, owner: ownerView, jobs: [repair.jobId, rerun?.jobId].filter(Boolean),
  reason: `${op} failed on a ${shape.class === 'findings' ? 'measured finding' : 'product defect'} owned by ${owner.op}${owner.record ? ' (' + owner.record + ')' : ''}: route ${route.id} repairs it (${repair.jobId})${rerun ? ', then ' + op + ' runs again (' + rerun.jobId + ')' : ''} (${base.firing} of ${limit})` });
};
/** A root-cause claim this workflow can verify through a job of its own: a read-only root verify, then the op again; null when there is none. */
const rootVerifyStep = (c, route, s) => {
  const { ledger, db, job, op, envelope, liveness, repo, record, reason } = c;
  const { base, routed, node } = s;
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
  return null;
};
/** A root cause outside the report that this workflow cannot verify is never re-run blind: peer-blocked or root-elsewhere; null when the report names no such root. */
const foreignRootStep = (c, route, s) => {
  const { ledger, db, job, op, shape, envelope, repo, record } = c;
  const { limit, fired, node, targets } = s;
  // A report that names its root cause outside itself (rootCause.self false) and that this workflow
  // cannot verify through a job of its own is never re-run blind: the same op on the same tree files
  // the same partial (a collab op-backend.implement-bd2609ff17 -> a1dad730db and another
  // product's foundation f920334582 -> a89b597df5: an hour or more each, identical open items). A red the
  // report's own checks pin on a peer's change settles peer-blocked like starci kernel record-checks's (no business
  // attempt, routes to the peer); any other foreign root waits for the Kernel to hand it to its owner.
  const foreignRoot = envelope?.rootCause?.self === false && shape.verdict !== 'rejected' && shape.verdict !== 'no-report';
  if (foreignRoot && route.then === 'retry' && targets.length === 1 && targets[0] === op) {
    const rootCause = { node: node || null, ...Object.fromEntries(['self', 'category', 'claim', 'evidence', 'expectedFix', 'recheck'].filter((k) => envelope.rootCause[k] != null).map((k) => [k, envelope.rootCause[k]])) };
    const attributed = reportPeerAttribution(db, job, envelope, repo);
    if (attributed.peer) {
      const peerBlocked = { checks: attributed.checks, peers: attributed.peers, routes: attributed.routes, source: 'report' };
      const step = { kind: 'peer-blocked', route: route.id, limit, firing: fired, counted: false, rootCause, jobs: [],
        reason: `the report's red ${attributed.checks.join(', ')} is a peer's change (${attributed.peers.map((p) => p.workflowId).join(', ')}): no blind retry of ${op} and no business attempt spent; run ${attributed.routes.join(' ; ')}, then starci kernel enqueue --op ${op} --retry-of ${job.job_id} once it is released` };
      const result = jobResult(db, job.job_id) ?? {};
      recordJobResult(db, { jobId: job.job_id, result: { ...result, peerBlocked, nextStep: step } });
      ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'failure-routed', payload: { opId: op, shape, ...step, peerBlocked } });
      return step;
    }
    return record({ kind: 'root-elsewhere', route: route.id, limit, firing: fired, counted: false, rootCause, jobs: [],
      reason: `rootCause names ${node || 'another node'} (self false${rootCause.category ? ', ' + rootCause.category : ''}) that this workflow runs no job of; a same-op retry would re-run identical work (${attributed.reason}). Hand the root to its owner - starci kernel incident --kind shared-blocker --introduced-by <sha> | --introducer <workflow> for another workflow's change, a widened --owned-paths re-enqueue for a scope gap - then starci kernel enqueue --op ${op} --retry-of ${job.job_id}` });
  }
  return null;
};
/** The route's own retry of the op, or the repair of its target op; null when it names no job of this workflow to repair. */
const routeTargetStep = (c, route, s) => {
  const { ledger, db, job, op, liveness, failure, record, reason } = c;
  const { base, routed, classNote, limit, targets } = s;
  if (targets.length === 1 && targets[0] === op) {
    const retry = enqueueFollowOn(ledger, job, { retryOf: job.job_id, reason, of: job.job_id, liveness, routed });
    return record({ kind: 'retry', ...base, ...classNote, jobs: [retry.jobId].filter(Boolean), reason: `route ${route.id} runs ${op} again (${base.firing} of ${limit})${failure?.class ? ' - failure class ' + failure.class + ': ' + failure.reason : ''}` });
  }
  const template = targets.length ? repairTemplateOf(db, job, targets) : null;
  if (!template) { return null; }
  const repair = FINAL_SETTLED.includes(template.status)
    ? enqueueFollowOn(ledger, template, { retryOf: template.job_id, reason, of: job.job_id, routed })
    : { jobId: template.job_id, enqueued: false, reason: 'in-flight' };
  const rerun = ['reopen', 'pause'].includes(route.then) ? enqueueFollowOn(ledger, job, { retryOf: job.job_id, after: [repair.jobId], reason, of: job.job_id, routed }) : null;
  return record({ kind: 'repair', ...base, jobs: [repair.jobId, rerun?.jobId].filter(Boolean),
    reason: `route ${route.id} repairs ${jobOpOf(template)} (${repair.jobId})${rerun ? ', then ' + op + ' runs again (' + rerun.jobId + ')' : ''} (${base.firing} of ${limit})` });
};
/** The step one route resolves for a failed attempt, recorded on its result; null when the route does not apply. */
const routedStepOf = (c, route) => {
  const { db, job, op, catalog, envelope, environment, failure, exhausted } = c;
  const limit = Number(route.limit), fired = routeFiringsOf(db, job, route.id);
  const base = { route: route.id, limit, firing: fired + 1, ...(environment ? { counted: false } : {}) };
  if (route.to?.needUser || (!environment && fired >= limit) || exhausted) return routeCapStep(c, route, { base, limit, fired });
  const routed = { route: route.id, from: job.job_id, firing: base.firing, limit };
  const classNote = failure?.class ? { class: failure.class, classReason: failure.reason } : {};
  const node = typeof envelope?.rootCause?.node === 'string' ? envelope.rootCause.node.trim() : '';
  const s = { base, routed, classNote, limit, fired, node };
  const early = ownerRepairStep(c, route, s) ?? rootVerifyStep(c, route, s);
  if (early) return early;
  const targets = routeTargetOps(catalog, route, op);
  return foreignRootStep(c, route, { ...s, targets }) ?? routeTargetStep(c, route, { ...s, targets });
};
function enqueueNextStep(ledger, job, { shape, envelope = null, environment = false, liveness = null, repo = null, failure = null }) {
  const db = ledger.db, op = jobOpOf(job), wf = getWorkflow(db, job.workflow_id);
  const record = (step) => {
    const result = jobResult(db, job.job_id) ?? {};
    recordJobResult(db, { jobId: job.job_id, result: { ...result, nextStep: step } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'failure-routed', payload: { opId: op, shape, ...step } });
    return step;
  };
  if (!wf || wf.phase === 'finished' || wf.archived_at) return record({ kind: 'none', reason: `workflow ${workflowStopLabel(wf)}` });
  const catalog = kindsCatalog();
  const reason = shape.verdict === 'no-report' ? FAILED_NO_REPORT : 'routed';
  // H3: the unit's try budget caps every route - a unit that spent it goes to the owner/Supervisor gate, never another try.
  const unit = unitStateOf(db, job.workflow_id, job.unit_id);
  const exhausted = Boolean(unit?.exhausted) && !environment;
  const c = { ledger, db, job, op, shape, envelope, environment, liveness, repo, failure, record, catalog, reason, unit, exhausted };
  for (const route of failureRoutesOf(catalog, op, shape)) {
    const step = routedStepOf(c, route);
    if (step) return step;
  }
  return record({ kind: 'none', reason: `no route in modules/models/kinds.yaml resolves ${op} with ${JSON.stringify(shape)}` });
}
const CANON_FOLLOW_UP_REASON = 'canon-follow-up';
const CANON_FOLLOW_UP_LIMIT = 3;
/**
 * Settle's own next step for a canon slice (code.refactor params.canonFamilies, not its canon-wire leg) that
 * settled blocked with a filed report (cut-seam.mjs canonSettleFollowUpOf): ONE follow-up attempt of the same
 * ordinal --retry-of it - a continuation from its preserved work (params.resumeFrom = preserved/<wf>/<job>,
 * kernelEdit.continuationOf, so the unit counts it) when the runtime preserved some, owning the relocation grants its report names - and the shared-root,
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
    repair: { records: payload.records ?? [], ownedPaths: paths, repository: payload.repository ?? null, params: { ...payload.params, canonWire: true, resumeFrom: '' } } });
  return created?.jobId ? { jobId: created.jobId, created: true } : wire;
}
/** Gives the follow-up attempt the relocation destinations it now owns, the preserved continuation and the Kernel's note. */
const prepareCanonFollowUp = (ledger, job, follow, plan) => {
  const db = ledger.db, wf = job.workflow_id;
  const row = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(follow.jobId);
  const next = jobPayloadOf(row);
  const params = { ...next.params, ...(plan.resumeFrom ? { resumeFrom: plan.resumeFrom } : {}) };
  const note = [
    plan.resumeFrom ? `Continuation of ${job.job_id}: the runtime preserved its in-ceiling work as ${plan.resumeFrom} - apply it to your owned paths first (git diff ${plan.resumeFrom}^ ${plan.resumeFrom} -- <owned paths> | git apply) and finish what its report left open; never redo it.` : `Follow-up of ${job.job_id}, which blocked ${plan.blocker ?? ''}: its report is your starting point.`,
    plan.grants.length ? `You now also own the relocation destinations ${plan.grants.join(', ')}.` : null,
    plan.wire.length ? `The canon-wire leg owns ${plan.wire.join(', ')}: a finding that needs one of them is owedToWire [{path, finding}] - fix everything else and report done; never block on it.` : 'A finding that needs a shared-root, config or public-entry file outside your owned paths is owedToWire [{path, finding}]: report done with it listed, never blocked.',
  ].filter(Boolean).join(' ');
  next.owned_paths = [...new Set([...(next.owned_paths ?? []), ...plan.grants])];
  next.params = params;
  next.kernelEdit = { ...next.kernelEdit, unitOf: job.job_id, by: 'settle', ...(plan.resumeFrom ? { continuationOf: job.job_id, preserved: plan.resumeFrom } : { retryOf: job.job_id }) };
  next.kernelOverride = { ...next.kernelOverride, notes: [...(next.kernelOverride?.notes ?? []), note] };
  updateJob(db, { jobId: follow.jobId, payload: next });
  if (plan.resumeFrom) ledger.appendEvent({ workflowId: wf, entityType: 'job', entityId: job.job_id, kind: 'unit-partial-continued', payload: { by: follow.jobId, preserved: plan.resumeFrom, via: 'settle' } });
};
function canonSettleFollowUp(ledger, job, payload, envelope) {
  const db = ledger.db, op = jobOpOf(job), wf = job.workflow_id;
  const manifest = cutManifestOf(db, { workflowId: wf, op, cut: payload.cut, ownJobId: job.job_id });
  let sharedRoots = [];
  try { sharedRoots = canonConformancePolicy().sharedRoots; } catch { /* no shared roots: the wire carries only contested relocations and config files */ }
  const plan = canonSettleFollowUpOf({ payload, report: envelope, manifest, destinations: destinationsOf(envelope, payload.owned_paths ?? []), preserved: preservedRefOf(db, job.job_id), sharedRoots });
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
  if (follow?.jobId && follow.reason !== 'retry-exists') prepareCanonFollowUp(ledger, job, follow, plan);
  let wire = null;
  if (plan.wire.length) {
    wire = widenCanonWire(ledger, job, payload, plan.wire, jobs);
    if (wire?.jobId) jobs.push(wire.jobId);
  }
  const how = plan.resumeFrom ? `continues from ${plan.resumeFrom}` : 'follow-up';
  return record({ kind: 'canon-follow-up', counted: false, jobs, ...(plan.resumeFrom ? { resumeFrom: plan.resumeFrom } : {}), grants: plan.grants, wire: plan.wire, ...(wire ? { wireJob: wire.jobId } : {}),
    reason: `canon slice ${payload.cut.id} ${payload.cut.ordinal}/${payload.cut.total} blocked (${plan.blocker ?? 'no kind'}): ${how} as ${follow?.jobId ?? '-'}${follow?.reason === 'retry-exists' ? " (the Kernel's own redo)" : ''}${plan.grants.length ? ', +grants ' + plan.grants.join(', ') : ''}${wire ? '; wire ' + wire.jobId + ' owns ' + plan.wire.join(', ') : ''}` });
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
/** The retry clause of a failed-no-report settle line. */
const retryNoteOf = (retry) => {
  if (retry?.jobId) { return `; retry ${retry.jobId} (attempt ${retry.tryNo}) ${retry.enqueued ? 'queued' : 'already queued'} - route and dispatch it`; }
  return '; no retry queued (' + (retry?.reason ?? 'unknown') + (retry?.incidentId ? ': owner-gate ' + retry.incidentId : '') + ')';
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
      { attempt: tryOf(job), dispatchId, ...workerProof, recovery: 'settled-failed', at }];
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
    const retryReceiptOf = (row, step) => {
      if (row) { return { enqueued: true, jobId: row.job_id, tryNo: row.try_no, unitId: row.unit_id }; }
      return { enqueued: false, reason: step.kind === 'owner-gate' ? 'route-limit' : step.reason, ...(step.incidentId ? { incidentId: step.incidentId } : {}) };
    };
    retry = retryReceiptOf(retried, nextStep);
  });
  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  // After the verdict is written: the managed worker is released (a dead op sent no worker_done, so
  // releaseManagedWorker fences its Dispatch with worker-stop first) and a plain terminal's dead shell or
  // quiet agent is closed. The op's Orca Task is Orca's: it settles with the Dispatch.
  const managedWorker = heldDispatchOf(settledPayload) ? releaseManagedWorker(settledPayload) : null;
  if (managedWorker) {
    ledger.transaction(() => {
      const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
      updateJob(db, { jobId, payload: { ...stored, managedWorker } });
    });
  }
  const artifacts = indexSettledArtifacts(ledger, job, repo);
  const pattern = bestEffort(() => raiseDeadWorkerPattern(ledger, job));
  const typedReleased = bestEffort(() => releaseTypedWaits(ledger, { repo, wake: true, self: job.workflow_id }).resolved) ?? [];
  const out = { ok: true, jobId, recovery: 'settled-failed', status: 'failed', verdict: 'fail', reason: FAILED_NO_REPORT, reportFiled: false, attempt: tryOf(job),
    effectState, evidence, dispatchId, liveness, leasesReleased, machineRefsReleased, retry, nextStep, attemptConsumed: !environment, ...(environment ? { environment, hostWipe: workerProof.hostWipe } : {}),
    ...(managedWorker ? { managedWorker } : {}),
    artifacts, ...(pattern ? { pattern } : {}), ...(Array.isArray(typedReleased) && typedReleased.length ? { autoResolved: typedReleased.map(({ incidentId, workflowId }) => ({ incidentId, workflowId })) } : {}) };
  emit(out, `settled ${jobId} failed-no-report (worker ${handle ?? '?'} ${liveness ?? 'dead'}${environment ? ' in a ' + environment + ': no business attempt spent' : ''}; effect ${effectState}${evidence.length ? ': ' + evidence.slice(0, 6).join(', ') : ''}; leases released: ${leasesReleased})`
    + retryNoteOf(retry)
    + (managedWorker ? '; worker ' + managedWorker.dispatchId + ' custody=' + (managedWorker.custody?.state ?? 'unknown') : '')
    + (pattern?.raised ? '; pattern incident ' + pattern.incidentId + ' raised (' + pattern.count + ' no-report deaths of ' + op + ')' : ''), args?.json);
}

// `reconcile --job <id> --release-worker`: prove, and if needed redo, a SETTLED job's worker
// release. Idempotent: a job whose recorded custody is already released writes nothing. A worker whose path leases are released, whose
// Task is closed and whose agent terminal is already disconnected settles as released, not as "release unknown/retained".
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
 * settled with the op's own worker_done. Idempotent. One event 'worker-released-while-held'.
 */
// ---- the release of a managed worker -------------------------------------------------------------------------
// calls.yaml settle-dispatch: worker-release alone does NOT end every agent (a released cursor worker kept its cursor-agent running), so the release goes
// through the one close path, scripts/machine/worker-close.mjs: worker-stop first for a Dispatch that did not settle itself (worker_done is read and only
// released), worker-release (repeated once), the close of the worker's own terminal and a bounded proof that no process of that terminal's shell tree
// remains; a survivor proven to belong to it is stopped and raises the host-hygiene finding worker-process-survived on the receipt (`hygiene`), never
// changing the job's outcome. A stop that classifies unknown is reconciled by a worker-show read and the residual state recorded (worker-abandon is out of scope).
const WORKER_SELF_SETTLED_STATES = new Set(['succeeded', 'failed', 'stopped', 'released']);
// The Dispatch a job holds: the attested one (payload.managed), else the one a dispatch killed mid-launch recorded.
const heldDispatchOf = (payload) => {
  if (payload?.managed?.dispatchId) { return payload.managed; }
  if (payload?.launchTerminal?.dispatchId) { return { dispatchId: payload.launchTerminal.dispatchId, agentTerminalHandle: payload.launchTerminal.handle ?? null }; }
  return null;
};
// Custody is the release receipt's own state; when the release is not ok (Orca still answers retained for a worker whose
// terminal already died: inc-eb9a21769d69, inc-a253fdf2deda) the exact agent terminal is READ back - a disconnected or gone
// terminal proves the worker is gone. Nothing is closed by hand.
const custodyOfRelease = (release, agentHandle = null) => {
  if (release?.ok === true) return { state: 'released', proof: 'release-ok' };
  if (agentHandle) {
    let shown = null;
    try { shown = terminalShow({ terminal: agentHandle }); } catch { shown = null; }
    if (shown?.ok && shown.connected !== true) return { state: 'released', proof: 'terminal-disconnected', terminal: agentHandle };
    if (TERMINAL_GONE_CODES.has(shown?.errorCode) && !shown.ok && !shown.hostUnavailable) return { state: 'released', proof: 'terminal-gone', terminal: agentHandle };
    if (shown?.ok && shown.connected === true) return { state: 'retained', proof: 'terminal-connected', terminal: agentHandle };
  }
  return { state: 'unknown', proof: release ? `release-${release.state ?? release.outcome ?? 'refused'}` : 'release-unanswered' };
};
/** The dispatch as worker-show reads it after a stop that did not prove the worker gone, else null. */
const survivingWorkerOf = (stop, dispatchId) => {
  if (!stop || (stop.ok === true && stop.outcome !== 'unknown')) return null;
  try {
    const shown = workerShow({ dispatch: dispatchId });
    return { ok: shown?.ok === true, state: shown?.state ?? null, effective: shown?.effective ?? null };
  } catch (e) { return { error: String(e?.message ?? e) }; }
};
function releaseManagedWorker(settledPayload) {
  const managed = heldDispatchOf(settledPayload);
  const unknown = (e) => ({ ok: false, outcome: 'unknown', error: String(e?.message ?? e) });
  let stop = null, release = null, retry = null, residual = null, before = null;
  try { before = workerShow({ dispatch: managed.dispatchId }); } catch { before = null; }
  const dispatchState = before?.ok ? before.state : null;
  const workerDone = WORKER_SELF_SETTLED_STATES.has(dispatchState);
  // The one close path: worker-stop only for a Dispatch that did not settle itself, worker-release (repeated once), the terminal close and the
  // process verify (scripts/machine/worker-close.mjs). A survivor finding rides on the receipt as host hygiene and never changes the job's outcome.
  let closed = null;
  try { closed = closeWorker({ dispatch: managed.dispatchId, handle: managed.agentTerminalHandle ?? null, stopFirst: !workerDone, retryRelease: true }); } catch (e) { release = unknown(e); }
  if (closed) { stop = closed.stop ?? null; release = { ok: closed.ok, outcome: closed.outcome, state: closed.state, ...(closed.error ? { error: closed.error } : {}) }; retry = closed.retryRelease ?? null; }
  residual = survivingWorkerOf(stop, managed.dispatchId);
  const last = retry ?? release;
  const shape = (r) => ({ ok: r?.ok === true, outcome: r?.outcome ?? null, state: r?.state ?? null, ...(r?.error ? { error: r.error } : {}) });
  return {
    dispatchId: managed.dispatchId,
    dispatch: { state: dispatchState, workerDone, ...(before?.ok === false ? { unreadable: true } : {}) },
    stop: stop ? shape(stop) : null,
    release: shape(release),
    ...(retry ? { retryRelease: shape(retry) } : {}),
    ...(residual ? { residual } : {}),
    custody: custodyOfRelease(last, managed.agentTerminalHandle ?? null),
    ...(closed ? { terminal: { closed: closed.closed?.ok === true ? closed.closed.proof ?? true : false, processes: closed.processes?.verdict ?? null } } : {}),
    ...(closed?.hygiene ? { hygiene: closed.hygiene } : {}),
  };
}
// A dead worker's Dispatch is released once per attempt (a repeat of the recovery is a no-op, not a second release event).
const releaseDeadWorker = (ledger, job) => {
  const payload = jobPayloadOf(job);
  if (!heldDispatchOf(payload)) return null;
  const done = ledger.db.prepare("SELECT 1 AS hit FROM events WHERE entity_id=? AND kind='dead-worker-released' AND json_extract(payload_json,'$.attempt')=?").get(job.job_id, tryOf(job));
  if (done) return { dispatchId: heldDispatchOf(payload).dispatchId, alreadyReleased: true };
  const released = releaseManagedWorker(payload);
  ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'dead-worker-released',
    payload: { opId: jobOpOf(job), attempt: tryOf(job), dispatchId: released.dispatchId, custody: released.custody } });
  return released;
};
const workerNote = (released) => !released || released.alreadyReleased ? '' : `; worker ${released.dispatchId} custody=${released.custody?.state ?? 'unknown'}`;

function releaseHeldWorker(ledger, args, job, repo, held) {
  const db = ledger.db, jobId = job.job_id, payload = jobPayloadOf(job);
  const prior = releasedWhileHeldOf(payload);
  if (prior) {
    const out = { ok: true, jobId, alreadyReleased: true, status: job.status, custody: prior.custody, heldBy: prior.heldBy ?? null };
    emit(out, `release-worker ${jobId}: already released while its settle is held (${prior.custody.proof}); nothing written`, args.json);
    return;
  }
  const managedWorker = heldDispatchOf(payload) ? releaseManagedWorker(payload) : null;
  const custody = managedWorker?.custody ?? { state: 'released', proof: 'no-dispatch' };
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
      ...(managedWorker ? { managedWorker } : {}),
      ...(released ? { workerReleased: { at, heldBy, reportOutcome: held.reportOutcome, custody: { ...custody, whileHeld: true }, leasesReleased } } : {}) } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'worker-released-while-held',
      payload: { opId: jobOpOf(job), attempt: tryOf(job), heldBy, custody, leasesReleased, terminal: operationTerminalHandleOf(job, payload) } });
  });
  if (machineRefs.length) {
    try { const machine = openMachine({ file: machineFileFor() }); try { machine.release(machineRefs); } finally { machine.close(); } }
    catch { /* ledger rows are the record; machine TTLs expire on their own */ }
  }
  const out = { ok: released, jobId, status: job.status, releasedWhileHeld: released, heldBy, custody, leasesReleased,
    ...(managedWorker ? { managedWorker } : {}) };
  emit(out, `release-worker ${jobId}: ${released ? 'released' : 'NOT released'} while its settle is held by ${held.heldBecause} ${held.incident} (custody ${custody.state}${custody.proof ? ' ' + custody.proof : ''}; leases released: ${leasesReleased}); the job stays ${job.status} for its settle`, args.json);
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
  const recorded = payload.managedWorker?.custody;
  if (recorded?.state === 'released') {
    const out = { ok: true, jobId, alreadyReleased: true, custody: recorded };
    emit(out, `release-worker ${jobId}: already released (${recorded.proof}); nothing written`, args.json);
    return;
  }
  const managedWorker = heldDispatchOf(payload) ? releaseManagedWorker(payload) : null;
  ledger.transaction(() => {
    const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
    updateJob(db, { jobId, payload: { ...stored, ...(managedWorker ? { managedWorker } : {}) } });
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'worker-release-reconciled',
      payload: { opId: jobOpOf(job), attempt: tryOf(job), custody: managedWorker?.custody ?? null } });
  });
  const custody = managedWorker?.custody ?? null;
  const out = { ok: custody?.state !== 'retained', jobId, custody, ...(managedWorker ? { managedWorker } : {}) };
  emit(out, `release-worker ${jobId}: custody ${custody?.state ?? 'unknown'}${custody?.proof ? ' (' + custody.proof + ')' : ''}`, args.json);
  if (!out.ok) process.exitCode = 1;
}

// Re-open an effect_unknown dispatch only when the host can now prove that
// the exact managed worker never crossed the operation boundary.  This is an
// infrastructure retry, so it preserves the same job id and attempt number.
// `reconcile --orphan-kernel-jobs [--workflow <id>] [--dry-run]`: a kernel job
// still dispatchable (running/queued/leased/answering) whose workflow is
// finished or archived. Nothing will ever release it — finish settles the
// kernel job it finds, and a restart after finish (or a finish from an older
// runtime) left kernel-wf-<product>-ang-stales-refactor-mu9nfaxf 'running' for a
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
  const actionOf = (row) => {
    if (args['dry-run']) { return 'would settle'; }
    if (row.raced) { return 'raced (left as is)'; }
    return 'settled cancelled';
  };
  emit(out, reconciled.length
    ? reconciled.map((r) => `${actionOf(r)} ${r.jobId} (${r.status}; workflow ${r.phase}${r.archivedAt ? ', archived' : ''}${r.terminal ? '; terminal ' + r.terminal : ''}${r.signalReleased ? '; kernel signal released' : ''})`).join('\n')
    : 'no orphan kernel job: every dispatchable kernel job belongs to a running, unarchived workflow', args.json);
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
  const checkouts = new Set([repo, contractWorktreeOf(db, job, repo)].filter(Boolean).map((p) => path.resolve(p)));
  const resolved = placements.filter((p) => !p.unresolved && p.via !== 'placement').flatMap((p) => {
    const rooted = slash(path.resolve(p.base, p.path));
    return checkouts.has(path.resolve(p.base)) ? [p.path, rooted] : [rooted];
  });
  return [...new Set([...declared, ...resolved])];
}

// The visual proof a pass owes (proofMediaGate over policy.proofMedia) and the host-path-free evidence it keeps (evidenceHostPathGate): read-only,
// before anything is written.
/**
 * The settle-gate prelude every per-gate settle function shares: the job row (null when the job is gone, its status
 * is not reportable, or `opOnly` names another op), its op and its contract admission.
 * `requiresReport` returns null when nothing is filed - pass-report-missing owns that refusal.
 */
function settleJobContext(db, jobId, { opOnly = null, requiresReport = false } = {}) {
  const job = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status) || (opOnly !== null && jobOpOf(job) !== opOnly)) return null;
  const admitted = admittedContractOf(db, job);
  const filed = filedReportOf(db, job, { dispatchId: reportDispatchIdOf(db, job) });
  if (requiresReport && (filed.attemptId == null || filed.reportId == null)) return null; // no filed report: pass-report-missing owns the refusal
  return { job, op: jobOpOf(job), admitted, filed };
}

/**
 * The report evidence a settle gate reads: the filed envelope (or `reportText` parsed when nothing is filed), the
 * job's placement roots and the collected job files. `jobId` scopes collectJobFiles' recordings; null omits it.
 */
function settleJobFiles(db, job, repo, filed, { reportText = null, jobId = null } = {}) {
  const envelope = filed.envelope ?? (reportText !== null ? parseJson(reportText) : null);
  let roots = [];
  try { roots = jobPlacements(db, job, repo).map((p) => p.base).filter(Boolean); } catch { roots = []; }
  const { files } = collectJobFiles({ repo, envelope, roots, ...(jobId === null ? {} : { jobId }), artifacts: filed.artifacts });
  return { envelope, roots, files };
}

function settleProofMedia(db, jobId, repo, reportAbs, reportText) {
  const s = settleJobContext(db, jobId);
  if (!s) return null;
  const policy = proofMediaPolicyOf(skillRoot, s.op);
  const { envelope, files } = settleJobFiles(db, s.job, repo, s.filed, { reportText, jobId: s.job.job_id });
  const recorded = independentChecksOf(db, { jobId: s.job.job_id })?.checks;
  const gate = evidenceHostPathGate({ files }) ?? (policy ? proofMediaGate({ policy, files, checks: [...(Array.isArray(recorded) ? recorded : []), ...(Array.isArray(envelope?.checks) ? envelope.checks : [])] }) : null);
  return gate ? { ...gate, op: s.op, status: s.job.status } : null;
}
// The Sonar gate a code-writing op's settle owes (scripts/kernel/sonar-settle.mjs over knowledge/sonar-gate.yaml): the
// runtime reads the op's attached sonar.json itself. Read-only here - starci kernel settle records the judgment. Null when the op is not held to the gate.
function settleSonarGate(db, jobId, repo) {
  const s = settleJobContext(db, jobId, { requiresReport: true });
  if (!s) return null;
  const { files } = settleJobFiles(db, s.job, repo, s.filed, { jobId: s.job.job_id });
  const judgment = judgeJob({ op: s.op, files });
  return judgment ? { ...judgment, workflowId: s.job.workflow_id, jobId: s.job.job_id, attemptId: s.filed.attemptId, status: s.job.status } : null;
}
const { settleOpGate, settleOpProofs } = mechanismGates({ skillRoot, settleJobContext, settleJobFiles, jobPlacements, opGateBasesOf });
// The draw acceptance an interface.draw pass owes (scripts/work/draw/draw-acceptance.mjs): every asset the pass binds -
// written, adopted, inherited or already there - is a token-rendered shape, no drawing names a data status, and the pass
// drew something under the current contract (a product's op-interface.draw-7c2821e002 adopted 40 image-gen files unchanged).
// Read-only, before anything is written.
function settleDrawAcceptance(db, jobId, repo, reportAbs, reportText) {
  const s = settleJobContext(db, jobId, { opOnly: 'interface.draw' });
  if (!s) return null;
  const { files } = settleJobFiles(db, s.job, repo, s.filed, { reportText });
  const owned = (jobPayloadOf(s.job).owned_paths ?? []).filter((p) => typeof p === 'string' && !p.includes(':'));
  const verdict = drawAcceptanceFindings({ repo, files: [...files.map((f) => f.abs), ...owned] });
  const findings = verdict.findings;
  return findings.length ? { op: s.op, status: s.job.status, findings, records: verdict.records } : null;
}
// The draw loop's machine metrics, RE-RUN by the runtime (scripts/work/draw-loop-settle.mjs): every live part of every
// ui record the pass binds is re-rendered from its render source and re-measured - the capture, the DNA gate, the
// taste metrics, the palette, the Grammar geometry and the ui-proof score - never the loop's self-reported numbers.
async function settleDrawMetrics(db, jobId, repo, reportAbs, reportText) {
  const s = settleJobContext(db, jobId, { opOnly: 'interface.draw' });
  if (!s) return null;
  const { files } = settleJobFiles(db, s.job, repo, s.filed, { reportText });
  const owned = (jobPayloadOf(s.job).owned_paths ?? []).filter((p) => typeof p === 'string' && !p.includes(':'));
  const verdict = await settleDrawMetricFindings({ repo, files: [...files.map((f) => f.abs), ...owned] });
  const findings = verdict.findings;
  return findings.length ? { op: s.op, status: s.job.status, findings, records: verdict.records, loops: verdict.loops } : null;
}
// The Work hygiene a pass owes when it changed files under .starciwork/ or .starcistacks/ (scripts/work/validate/work-hygiene.mjs,
// the same parse + scoped strict validate + secret scan the product repo's pre-commit hook runs): the files its report
// names plus every file its commits changed since the base it was admitted on. Read-only, before anything is written.
function settleWorkHygiene(db, jobId, repo, reportAbs, reportText) {
  const s = settleJobContext(db, jobId, {});
  if (!s) return null;
  const { envelope, roots, files } = settleJobFiles(db, s.job, repo, s.filed, { reportText });
  const changed = files.map((f) => f.abs);
  const { head, base } = jobShasOf({ envelope, result: null, payload: jobPayloadOf(s.job) });
  if (head) for (const root of new Set([repo, ...roots].filter(Boolean).map((r) => path.resolve(r)))) {
    for (const rel of rangeFiles(root, base ?? `${head}~1`, head)) if (inSecretScope(rel)) changed.push(path.join(root, rel));
  }
  const checked = checkWorkFilesAbs([...new Set(changed.filter((p) => inSecretScope(p)))]);
  return checked.ok ? null : { op: s.op, status: s.job.status, findings: checked.findings, files: checked.files };
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
// A settled job's typed log is complete: the op's own rows came through `starci kernel log`, and the rows its settle events stand
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
// log-typed-missing ledger event (starci kernel status logTypedMissing) and a runtime `warning` row in the job's own log.
function warnTypedLogGaps(ledger, logs, job) {
  if (job.kind === 'kernel' || !jobOpOf(job)) return null;
  const { envelope } = filedReportOf(ledger.db, job, { dispatchId: reportDispatchIdOf(ledger.db, job) });
  const gaps = typedLogGaps(logs, { jobId: job.job_id, checks: Array.isArray(envelope?.checks) ? envelope.checks : [] });
  if (!gaps.missing.length) return null;
  const op = jobOpOf(job);
  const out = { code: LOG_TYPED_MISSING, level: 'warn', missing: gaps.missing, opRows: gaps.opRows };
  const prepared = prepareLogRow({ workflowId: job.workflow_id, jobId: job.job_id, actor: 'runtime', kind: 'warning', level: 'warn', src: `ltm:${job.job_id}`,
    msg: `${LOG_TYPED_MISSING}: ${translator(ownerLanguage())('the op did not write the structured log rows it owed ({missing})', { missing: gaps.missing.slice(0, 3).join(', ') + (gaps.missing.length > 3 ? ', …' : '') })}`,
    data: { code: LOG_TYPED_MISSING, message: `${op} attempt ${tryOf(job)} settled with ${gaps.opRows} op log row(s); missing ${gaps.missing.join('; ')}`.slice(0, 1500), missing: gaps.missing.slice(0, 40),
      hint: 'op prompt logging: block - starci kernel log step.start, step.end and cmd.run per check' } });
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
 * `starci kernel settle-tail` (scripts/kernel/verbs/settle-tail.mjs), retried by the settler until it succeeds.
 */
async function runSettleTail(ledger, job, repo, { verdict = null } = {}) {
  const db = ledger.db, jobId = job.job_id, errors = [];
  const payload = jobPayloadOf(job);
  const settledVerdict = verdict ?? jobResult(db, jobId)?.verdict ?? payload.verdict ?? null;
  let sessionReleased = null;
  try {
    sessionReleased = await releaseSettledSession({ db, job, payload, repo, archiveRoot: null,
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

/* ------------------------------------------------------------- op IPC */
// The op-IPC durability verbs: contracts out (kernel→worker, written at
// dispatch), reports in (worker→kernel, filed by the worker), checks beside
// them. The files on disk stay the artifacts; the rows are the durable
// signal the kernel consumes.
// A handover ask reaches the owner only with every must-have proven (proof-integrity.mjs coverageOf): an FR whose
// requiresProof has a required kind and whose evidence is missing or stale refuses it handover-proof-owed. Any other
// unproven item is flagged on stderr and belongs in the package's "not proven" section. A coverage that cannot be
// computed refuses too (fail closed).
function handoverProofGate(db, job, repo) {
  let cov;
  try {
    const { integrity, qualified } = proofAcceptanceOf(db, job, skillRoot);
    if (!integrity) return;
    if (qualified) { const verified = verifyProofs(db, job.workflow_id); if (!verified.ok || verified.files.unchained) throw new Error('the workflow proof blobs or event chain are missing, modified or unchained'); }
    cov = coverageOf(db, job.workflow_id, { repo, notCounted: specsOff(ownerSpecs(skillRoot)), qualified });
  }
  catch (error) { throw Object.assign(new Error(`handover-proof-unjudged: starci kernel coverage could not be computed (${String(error?.message ?? error).slice(0, 300)}); a handover cannot claim proof it cannot read`), { code: 'handover-proof-unjudged' }); }
  if (cov.mustOwed.length) {
    throw Object.assign(new Error(`handover-proof-owed: ${cov.mustOwed.map((i) => i.kind + ' ' + i.id + ' is ' + i.status).join('; ')}. A must-have is never handed over unproven: file outcome blocked, blocker kind test-gap, naming each; the Kernel re-runs the check that proves it (starci kernel coverage --workflow ${job.workflow_id}, starci kernel status nextActions)`), { code: 'handover-proof-owed', owed: cov.mustOwed });
  }
  const flagged = cov.items.filter((i) => i.status !== 'proven');
  if (flagged.length) console.error(`starci kernel report WARNING: ${flagged.length} scoped item(s) not proven, none a must-have: ${flagged.slice(0, 12).map((i) => i.kind + ' ' + i.id + ' ' + i.status).join(', ')}${flagged.length > 12 ? ', ...' : ''}; the package lists them under what was not proven`);
}

/* --------------------------------------------------------------- report */
// Worker-facing: the report file is a starci/op-report@1 JSON envelope — the
// row is the durable signal and the ONLY shape the kernel reads
// (UNIQUE(workflow_id,dispatch_id) makes a re-file idempotent). The api stamps
// run/task/dispatch/from from the job row; a file that claims a different
// identity is report-invalid. --outcome is optional consistency: when given it
// must equal the envelope's outcome.
/* ---------------------------------------------------------------- check */
// The verification half: upsert the re-run check results for an op attempt
// (one row per workflow_id,op_id,attempt).
// A red check that names its `failing` files is attributed (scripts/kernel/gate-attribution.mjs):
// class peer marks it peerBlocked {peers[], routes[]}, which summarizeCheckEvidence counts neither
// passed nor failed. Only the api decides: a caller-supplied peerBlocked or attribution is dropped.
// A red check with no `failing` list is attributed on the source files its own evidence/output text
// names (failingFromText), recorded as failing + failingDerived: a product's collab Kernel re-ran the
// typecheck, wrote the peer's tsc line into the evidence and filed no list, so the peer's red was
// counted this op's and the same op re-ran for hours.
function attributeChecks(db, { repo, job, checks }) {
  let canon;
  return checks.map((check) => {
    if (!check || typeof check !== 'object') return check;
    const clean = { ...check }; delete clean.peerBlocked; delete clean.attribution; delete clean.failingDerived;
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

/* ------------------------------------------------------ the worker's agent */
// The worker's own agent CLI: its routed provider/model, else Claude for a managed Dispatch (the
// managed pool's agent).
// Path leases of a running job whose worker is not proven dead are renewed to a full
// dispatchLeaseTtlMs once less than half of it is left (starci kernel status). Settle and the dead-worker
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
// The autopilot surface (scripts/kernel/autopilot-run.mjs; owner ruling 2026-09-28 autopilot-run-to-finish). Every write
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
          const root = gitResultOf(revParseQuery(['--show-toplevel'], { dir, timeout: 10_000 }));
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
    return guardLaunch({ skillRoot, jobId, workflowId: job.workflow_id, ledgerRepo: repo, owned, repos, config, workflowWorktree, op: job.op_id });
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
  opGuardLaunch,
  runSettleTail, ownerRoot, agentHierarchyOf, bindRunToKernel, foundationDutyOf,
  FINAL_SETTLED, staleInputProjection, staleOperationLine, sourceDriftLines, peerDriftLines,
  resolveJob, parseAttempt, reportDispatchIdOf, OWNER_GATE_KINDS,
  getWorkflow, indexSettledArtifacts,
  stagedInputEvidenceOf, livenessMsOf, ACTIVE_STALE_MS, workerOutageEvidence, recordWorkerOutageEvidence,
  LAUNCH_GRACE_MS, workerCardOf, GATE_ANSWERED_EVENT, runningOpRevDriftOf,
  workerInputRowText, INPUT_ROW_PLACEHOLDER, runtimeOwnedInput, TERMINAL_NOT_WRITABLE, UNWRITABLE_EVENT,
  requireDispatchedReportBinding, reportOwnedPaths, reportIdentityOf,
  handoverProofGate, reportFiledWake,
  isCheckResultEnvelope, attributeChecks, buildOpsOf, markMeasured, isPeerBlockedCheck,
  summarizeCheckEvidence,
  normalizeProvider, providerQuotaProbeCommand, providerRecoverCommand,
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
  configuredAllocationPolicy, loadConfig, blockingViewOf, parseYaml, fs, path,
  reconcileOrphanKernelJobs,
  reconcileDrop, reconcileReleaseWorker, reconcileDeadWorker,
  cleanupManagedWorker,
  releaseManagedWorker, heldDispatchOf,
  CUT_SLICE_CHECKS, VERDICT_OUTCOMES, agentOfJob, canonSettleFollowUp, enqueueNextStep, failureClassOf,
  failureShapeOf, enqueueFollowOn, latestKernelJobOf, recordOpRevDrift,
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
    process.exitCode = 1; return;
  }
  const caller = callerOf(ledger.db, process.env, { file: ledger.path });
  if (caller.role === OP_ROLE && spec.kernelOnly) {
    refuseOpCaller(ledger, { cmd: spec.verb, caller, code: 'op-context-refused',
      detail: `'${spec.verb}' is a kernel verb and this caller is operation ${caller.jobId ?? '(unbound)'} (${caller.via}); an op files its own starci kernel report and nothing else` });
  }
  if (caller.role === OP_ROLE && spec.jobOwnerOnly && caller.jobId !== args.job) {
    refuseOpCaller(ledger, { cmd: spec.verb, caller, code: 'report-identity-mismatch',
      detail: `operation ${caller.jobId ?? '(unbound)'} (${caller.via}) may file a report only for its own job, not ${args.job}` });
  }
  try {
    const admitted = callerAdmission(ledger, args, { caller });
    return await admitted.run(() => spec.run({ ledger, args, repo, emit, need, caller: admitted.caller, ext: API_EXT, internals: API_INTERNALS }));
  } catch (error) {
    if (!(error instanceof VerbExit)) console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code }));
    process.exitCode = error instanceof VerbExit ? error.exitCode : 1;
  } finally { ledger.close(); }
};
/* ------------------------------------------------------------------ main */
export const main = () => runMain().catch((error) => { if (!(error instanceof VerbExit)) { throw error; } process.exitCode = error.exitCode; });
async function runMain() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') { const lines = extensionUsage(API_EXT); if (lines.length) console.log(`extension verbs (scripts/kernel/verbs):\n${lines.join('\n')}\n`); }
  if (!cmd || cmd === '--help' || cmd === '-h') { usage(cmd ? 0 : 2); }
  const args = parseArgs(argv.slice(1));
  const repo = path.resolve(args.repo ?? process.cwd());
  if (API_EXT.verbs.has(cmd)) return runExtensionVerb(API_EXT.verbs.get(cmd), args, repo);
  usage(2);
}

if (isMain(import.meta.url)) { try { await main(); } catch (error) { console.error(error); process.exitCode = 1; } }
