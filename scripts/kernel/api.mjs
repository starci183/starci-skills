#!/usr/bin/env node
// api.mjs — the kernel agent's ONLY gate to the ledger. One thin command per
// state operation; the long-lived [Kernel] never opens .starciwork/runtime.sqlite
// itself and never spawns op terminals by hand — `dispatch` owns that.
//
//   node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
//
//   survey   --repo <path> --workflow <id> [--deliveries]
//   status   --repo <path> --workflow <id>
//   hierarchy --repo <path> --workflow <id>
//   plan     --repo <path> --workflow <id> --file <plan.json>
//   enqueue  --repo <path> --workflow <id> --op <opId> --paths <csv> [--title <t>] [--risk <r>]
//            [--repository <repo-id>] [--cut-id <id> --cut-ordinal <n> --cut-total <n>]
//   estimate --repo <path> --files <n> [--assertions <n>] [--components <n>] [--records <n>]
//            [--paths <csv>] [--gear <n>]
//   route    --repo <path> --job <job_id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
//   dispatch --repo <path> --job <job_id> [--model <target>] [--worktree <sel>] [--spawn] [--lease-ttl <ms>]
//   reconcile --repo <path> --job <job_id> [--retry-lineage]
//   reconcile --repo <path> (--orphan-kernel-jobs | --orca-tasks) [--workflow <id>] [--dry-run]
//   nudge    --repo <path> --job <job_id>
//   observe  --repo <path> --job <job_id> [--lines <n>]
//   questions --repo <path> --workflow <id>
//   reply    --repo <path> --workflow <id> --message <msg_id> (--body <answer> | --to-owner [--body <note>])
//   peers    --repo <path> --workflow <id>
//   notify   --repo <path> --workflow <id> --to <peerId,...|peers> --kind <request|heads-up|handoff|reply>
//            --subject <s> --body <text> [--reply-to <key>] [--refs <csv>]
//   inbox    --repo <path> --workflow <id> [--ack <key> --disposition <text>]
//   settle   --repo <path> --job <job_id> --verdict <pass|fail|blocked> [--report <path>]
//   report   --repo <path> --job <job_id> --report <file> [--outcome <done|partial|failed|ask|blocked>]
//   op-contract --repo <path> --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
//   check    --repo <path> --job <job_id> (--checks '<json>' | --checks-file <path>)
//   consume-report --repo <path> --job <job_id>
//   (enqueue also takes [--after <jobId>,...]: jobs that must settle succeeded first)
//   incident --repo <path> --workflow <id> --kind <k> --detail <s> [--op <opId>] [--holds <opId|jobId>,...]
//   incident --repo <path> --workflow <id> --kind peer-wait --peer <workflowId> --detail <s> [--op <opId>] [--holds ...] [--refs <csv>] [--until-message]
//   incident --repo <path> --workflow <id> --resolve <incidentId> [--detail <s>]
//   finish   --repo <path> --workflow <id>
//
// Every read prints a JSON-safe result; every write runs inside one
// ledger.transaction. --json gives the machine form; without it each command
// prints a compact human line. Bad arguments exit 2 with usage.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import {
  openLedger, ledgerFileFor, machineFileFor, openMachine,
  newToken, JOB_STATUSES, reserveTwoPhase, transitionWorkflowToRunning,
} from '../../engine/ledger-db.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import {
  AWAITING_OWNER, admitOpSlot, cutRetryLineage, deriveRetryLineage, findOwnedPathLeaseConflicts, normalizeOwnedPaths, ownedPathLeaseRequests,
  ownedPathsIntersect, retiredBeforeDispatch,
} from '../../engine/admission.mjs';
import {
  activeDelegation, allocationMs, allocationSettings, connectorsConfig, defaultParallelGear, inspectOwnerConfig, loadConfig, slicingGears,
} from '../../engine/config.mjs';
import { OP_REPORT_OUTCOMES, validateOpReport } from './report-envelope.mjs';
import { renderReportBlock } from './report-render.mjs';
import { commitPolicyOf, landedProof, ownedPathEffects, policyCommits, policyPushes } from './settle-landed.mjs';
import { priorAttemptFailures } from './prior-failures.mjs';
import { ownerAnswerLine, ownerAnswersOf, repeatedAnswerOf } from './owner-answers.mjs';
import { enqueueRepository, ownedPathPlacements } from './target-repo.mjs';
import {
  spawnAgent, buildSpawnCommand, deliverPrompt, cleanupDeliveryArtifact,
  awaitSubmission, awaitAttestation, loadAdapter,
} from '../agent/lib.mjs';
import { ensureLaunchTrust } from '../agent/trust.mjs';
import { terminalClose } from '../api/orca/terminal-close.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow, TERMINAL_GONE_CODES } from '../api/orca/terminal-show.mjs';
import { closeOperationTerminal, closeExitedTerminal } from './close-op-terminal.mjs';
import { reapAgentProcess } from './reap-agent-process.mjs';
import { quitAgent } from './quit-agent.mjs';
import { autoAcceptAsk, closeAskMessages, parkAsk, supersedeEarlierAsks } from './serve-ask.mjs';
import { classifyAgentScreen, staleAwareState, exitedAgentPromptRow, DEFAULT_STAGED_PATTERN } from './terminal-liveness.mjs';
import { sendWakeWithProof, sendEnterWithProof, deliveryFieldsOf } from './wake-delivery.mjs';
// Pool selection and launch-model resolution, plus the Orca orchestration
// wrappers the managed-agent dispatch path drives — one thin wrapper per
// calls.yaml verb (run-create/task-create/worker-start/dispatch/
// dispatch-show/worker-show/worker-stop/worker-release).
import { selectPool, resolveLaunchModel, resolveCardLaunchModel, missingHostTools, providerCircuitOf, PROVIDER_HEALTH_SCOPE } from '../agent/models.mjs';
import { credentialFingerprintOf, credentialRotated } from '../agent/credential-fingerprint.mjs';
import { kindRoute as kindRouteOf } from '../agent/models.mjs';
import { recentDispatchCounts, thinkAuthorOf } from '../agent/balance.mjs';
import { configuredAllocationPolicy } from '../../engine/config.mjs';
import { resolveOpParams } from '../route/dispatch-op.mjs';
import { checkPrerequisites, prerequisiteDetail } from './prerequisites.mjs';
import {
  HANDOVER_APPROVED, HANDOVER_OP, deliveriesOf, handoverApprovalOf, handoverAskProblem, handoverGateOf, handoverProjection, handoverReason,
} from './handover.mjs';
import { opInputPaths, recordInputs, staleInputs, staleOperationsOf } from './input-digests.mjs';
import { queueSettleMedia } from '../connectors/telegram-media.mjs';
import { accountList } from '../api/orca/account-list.mjs';
import { runCreate } from '../api/orca/run-create.mjs';
import { taskCreate } from '../api/orca/task-create.mjs';
import { workerStart } from '../api/orca/worker-start.mjs';
import { orchDispatch } from '../api/orca/orch-dispatch.mjs';
import { dispatchShow } from '../api/orca/dispatch-show.mjs';
import { workerShow } from '../api/orca/worker-show.mjs';
import { workerStop } from '../api/orca/worker-stop.mjs';
import { workerRelease } from '../api/orca/worker-release.mjs';
import { terminalRename } from '../api/orca/terminal-rename.mjs';
import { taskUpdate } from '../api/orca/task-update.mjs';
import { orchInbox } from '../api/orca/orch-inbox.mjs';
import { orchReply } from '../api/orca/orch-reply.mjs';
import { productLocaleFor } from './product-locale.mjs';
import { bindWorkflowRun, staleTasks, CLOSED_TASK_STATUSES } from './orca-runs.mjs';
import { taskList } from '../api/orca/task-list.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// The owner config (config.yaml) lives at the runtime root. STARCI_OWNER_ROOT points the one
// reader in engine/config.mjs at a different directory holding one — the same test and tooling
// seam scripts/kernel/start-workflow.mjs and scripts/route/route-model.mjs use.
const ownerRoot = process.env.STARCI_OWNER_ROOT ? path.resolve(process.env.STARCI_OWNER_ROOT) : skillRoot;
const VERDICT_CONTRACT = 'modules/kernel/verdict-contract.yaml';

// The status vocabulary is engine/ledger-db.mjs JOB_STATUSES; these are the
// three views this gate reasons in. enqueue writes 'queued' and settle writes
// 'succeeded'|'failed' — the durable engine's own words.
const FINAL_SETTLED = [...JOB_STATUSES.settled];
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
    return true;
  });
};
const summarizeCheckEvidence = (value) => {
  if (isCheckResultEnvelope(value)) {
    const passed = value.checks.filter((check) => check.exitCode === 0).length;
    const failed = value.checks.length - passed;
    return { observed: value.checks.length, passed, failed, green: value.checks.length > 0 && failed === 0 };
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
  console.error(`use: node scripts/kernel/api.mjs <cmd> --repo <path> [...] [--json]
  survey   --workflow <id> [--deliveries]
  status   --workflow <id>
  hierarchy --workflow <id>
  plan     --workflow <id> --file <plan.json>
  enqueue  --workflow <id> --op <opId> --paths <csv> [--records <csv>] [--title <t>] [--risk <r>]
           [--repository <repo-id>] [--params '<json>'] [--cut-id <id> --cut-ordinal <n> --cut-total <n>]
  estimate --files <n> [--assertions <n>] [--components <n>] [--records <n>]
           [--paths <csv>] [--gear <n>]
           deterministic size class + agent count from runtimes.yaml allocation.slicing
  route    --job <job_id> [--prefer <pool>] [--avoid <pool>] [--difficulty <d>]
  dispatch --job <job_id> [--model <target>] [--worktree <sel>] [--spawn]
  reconcile --job <job_id> [--retry-lineage | --drop --reason <text> | --reap | --dead-worker]
  reconcile --orphan-kernel-jobs [--workflow <id>] [--dry-run]   kernel jobs of finished/archived workflows -> cancelled
  reconcile --orca-tasks [--workflow <id>] [--dry-run]           re-bind the Run to the live Kernel, close open Tasks no live job holds
  nudge    --job <job_id>
  observe  --job <job_id> [--lines <n>]
  questions --workflow <id>
  reply    --workflow <id> --message <msg_id> (--body <answer> | --to-owner [--body <note>])
  peers    --workflow <id>
  notify   --workflow <id> --to <peerId,...|peers> --kind <request|heads-up|handoff|reply>
           --subject <s> --body <text> [--reply-to <key>] [--refs <csv>]
  inbox    --workflow <id> [--ack <key> --disposition <text>]
  settle   --job <job_id> --verdict <pass|fail|blocked> [--report <path>]
  report   --job <job_id> --report <file> [--outcome <${REPORT_OUTCOMES.join("|")}>]
  op-contract --job <job_id>  |  --workflow <id> --op <opId> [--attempt <n>]
  check    --job <job_id> (--checks '<json>' | --checks-file <path>)
  consume-report --job <job_id>
  serve-ask --workflow <id> [--dispatch <id>] [--ttl <ms>] [--now]
  retire-ask --workflow <id> --dispatch <id> --reason <text>
  incident --workflow <id> --kind <k> --detail <s> [--op <opId>] [--holds <opId|jobId>,...]
           [--peer <workflowId> [--refs <csv>] [--until-message]]  (--peer only with --kind peer-wait)
  incident --workflow <id> --resolve <incidentId> [--detail <s>]
  provider-health --provider <p> [--recover --reason <text> [--probe]]
           the ledger provider-health row; --recover clears an open circuit (Kernel terminal only)
  finish   --workflow <id>`);
  process.exit(code);
};

const parseJson = (text, fallback = null) => { try { return JSON.parse(text); } catch { return fallback; } };
const parseArgs = (argv) => {
  const a = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) { a._.push(k); continue; }
    const name = k.slice(2);
    if (['json', 'spawn', 'retry-lineage', 'drop', 'to-owner', 'reap', 'deliveries', 'dead-worker', 'now', 'recover', 'probe', 'until-message', 'orphan-kernel-jobs', 'orca-tasks', 'dry-run'].includes(name)) { a[name] = true; continue; }
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

// Operation statuses that hold one of the workflow's concurrent slots. A queued
// job has not been dispatched and holds nothing; everything from the lease
// forward does, including a fenced launch whose effect may exist.
const SLOT_HOLDING_STATUSES = [...JOB_STATUSES.dispatchable.filter((status) => status !== 'queued'), ...JOB_STATUSES.fenced];
// modules/models/runtimes.yaml — the pool cards and the fleet ceiling. Every
// concurrency number this gate reasons with comes from here.
const runtimesDoc = () => {
  try { return parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'runtimes.yaml'), 'utf8')); }
  catch { return null; }
};
const poolCardFor = (doc, target) => Object.entries(doc?.runtimes ?? {})
  .find(([poolId, runtime]) => (runtime?.target ?? poolId) === target)?.[1] ?? null;
const fleetMaxParallelOps = () => {
  const value = Number(runtimesDoc()?.maxParallelOps);
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

const getWorkflow = (db, workflowId) => db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
const latestGoal = (db, workflowId) => db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId);

/** What the approved goal leg for this op carries as `params` — the owner's
 *  side of the tunables (scripts/goal/define-goal.mjs --params writes it into
 *  goals.json.opChain.legs[]). An absent chain or leg means the owner set none. */
const goalLegParams = (goal, opId) => {
  try {
    const legs = JSON.parse(goal?.json ?? '{}')?.opChain?.legs;
    const leg = Array.isArray(legs) ? legs.find((l) => l?.op === opId) : null;
    return leg?.params && typeof leg.params === 'object' ? leg.params : null;
  } catch { return null; }
};
const goalJsonOf = (row) => parseJson(row?.json ?? '', {});
const jobPayloadOf = (row) => parseJson(row?.payload_json ?? '', {});
const ownedPathsOf = (payload) => (payload?.owned_paths ?? []).map((p) => (typeof p === 'string' ? p : p?.path)).filter(Boolean);
const jobResultOf = (row) => parseJson(row?.result_json ?? '', {}) ?? {};
/**
 * A settled attempt that asked the owner a question is a wait, not a failure. Settle records it as
 * result.verdict `awaiting-owner`; an attempt a kernel settled `blocked` on a filed `ask` report
 * before that verdict existed reads the same, so its successor is accounted identically.
 */
const isAwaitingOwner = (db, row) => {
  const result = jobResultOf(row);
  if (result.verdict === AWAITING_OWNER) return true;
  if (row?.status !== 'failed' || result.verdict !== 'blocked' || !row.op_id) return false;
  return Boolean(db.prepare("SELECT 1 FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? AND outcome='ask' LIMIT 1")
    .get(row.workflow_id, row.op_id, row.attempt));
};
const withOwnerWaitResult = (db, row) => (row && isAwaitingOwner(db, row) && jobResultOf(row).verdict !== AWAITING_OWNER
  ? { ...row, result_json: JSON.stringify({ ...jobResultOf(row), verdict: AWAITING_OWNER, kernelVerdict: 'blocked' }) }
  : row);
/**
 * The retry lineage a job of {workflowId, op, cut} at durable `attempt` carries, derived from the jobs
 * before it (attempt < `attempt`). An uncut op chains to the op's latest attempt. A cut ordinal chains
 * only to its own ordinal - the latest job with the SAME op, cut id AND ordinal - and counts only that
 * ordinal's business attempts (engine/admission.mjs cutRetryLineage): a sibling ordinal that settled
 * later is never its predecessor. A row retired before it dispatched (reconcile --drop, a superseding goal
 * revision) ran nothing and is skipped either way, so an owner-answer retry keeps the ask attempt as its
 * predecessor (inc-5005d003825a). Null when there is no predecessor (a first attempt).
 */
const retryLineageFor = (db, { workflowId, op, cut, attempt }) => {
  const cols = 'job_id,workflow_id,op_id,status,attempt,worker_id,payload_json,result_json';
  if (cut) {
    const ordinalJobs = db.prepare(`SELECT ${cols} FROM jobs WHERE workflow_id=? AND op_id=? AND attempt<?
      AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')=? ORDER BY attempt`)
      .all(workflowId, op, attempt, String(cut.id), Number(cut.ordinal)).map((row) => withOwnerWaitResult(db, row));
    return cutRetryLineage(ordinalJobs, { attempt });
  }
  const priorJob = db.prepare(`SELECT ${cols} FROM jobs WHERE workflow_id=? AND op_id=? AND attempt<? ORDER BY attempt DESC`)
    .all(workflowId, op, attempt).find((row) => !retiredBeforeDispatch(row));
  return priorJob ? deriveRetryLineage(withOwnerWaitResult(db, priorJob), { attempt }) : null;
};
/**
 * The live head of a cut's seam (ordinal 1): its latest job that was not retired before dispatch. A
 * dropped seam retry is no seam - the ordinals behind it wait on the attempt that actually ran, or on
 * the retry the Kernel enqueues next (inc-b428eb47fde3). Null when the seam has no such job.
 */
const cutSeamHeadOf = (db, { workflowId, op, cutId }) => db.prepare(`SELECT job_id,status,attempt,worker_id,payload_json,result_json FROM jobs
  WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? AND json_extract(payload_json,'$.cut.ordinal')=1 ORDER BY attempt DESC`)
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
  const rows = db.prepare(`SELECT job_id,status,attempt,worker_id,payload_json,result_json,json_extract(payload_json,'$.cut.ordinal') AS ordinal FROM jobs
    WHERE workflow_id=? AND op_id=? AND json_extract(payload_json,'$.cut.id')=? ORDER BY attempt`).all(workflowId, op, String(cut.id))
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
const operationTerminalHandleOf = (row, payload = jobPayloadOf(row)) => payload?.managed?.agentTerminalHandle
  ?? payload?.orca?.agentTerminalHandle
  ?? payload?.hierarchy?.runtime?.terminalHandle
  ?? (payload?.managed ? null : row?.worker_id)
  ?? null;
// What the runtime typed into an operation's terminal (the contract row, plus
// the exact delivered text dispatch recorded) and how the worker's provider
// renders a staged paste (its card's submission.stagedPattern). The classifier
// needs both to tell an unsubmitted paste from a running turn: a Devin worker's
// inline contract sat in its input box for 13 minutes and read `active` from
// the words it contains (inc-06aeecf432f1).
const stagedInputEvidenceOf = (db, job, payload = jobPayloadOf(job)) => {
  const row = db?.prepare('SELECT markdown,context_json FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(job.workflow_id, job.op_id ?? payload.opId ?? null, job.attempt) ?? null;
  const context = parseJson(row?.context_json ?? '', {}) ?? {};
  const sentText = [context.delivery?.text, row?.markdown].filter((text) => typeof text === 'string' && text).join('\n') || null;
  const provider = payload.provider ?? payload.agent ?? null;
  const cardPattern = provider ? loadAdapter(provider)?.card?.submission?.stagedPattern : null;
  let stagedPattern = DEFAULT_STAGED_PATTERN;
  if (typeof cardPattern === 'string' && cardPattern.trim()) {
    try { stagedPattern = new RegExp(`${DEFAULT_STAGED_PATTERN.source}|${cardPattern}`, 'i'); } catch { /* the default still holds */ }
  }
  return { sentText, stagedPattern };
};
// The worker liveness values that prove the exact operation terminal can never
// file its report: the terminal exists but is disconnected/unwritable, a
// running Orca answered that the handle names no terminal at all, or the
// terminal is back at a bare shell prompt because its agent exited.
const DEAD_WORKER_LIVENESS = ['disconnected', 'gone', 'agent-exited'];
const observeOperationWorker = (job, now = Date.now(), db = null) => {
  const terminalHandle = operationTerminalHandleOf(job);
  if (!terminalHandle) return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle: null, liveness: 'unknown', reason: 'operation terminal handle unavailable', observedAt: now };
  try {
    const shown = terminalShow({ terminal: terminalHandle });
    const lastOutputAt = Number(shown?.terminal?.lastOutputAt);
    const outputAgeMs = Number.isFinite(lastOutputAt) ? Math.max(0, now - lastOutputAt) : null;
    const connected = shown?.connected === true, writable = shown?.writable === true;
    let screenState = null, shellPrompt = null;
    if (shown?.ok && connected && writable) {
      try {
        const read = terminalRead({ terminal: terminalHandle, screen: true });
        // A frame ending in a bare shell prompt: the agent exited and its
        // terminal is a plain shell that would run a nudge as a command.
        if (read?.ok) shellPrompt = exitedAgentPromptRow(read.screen);
        if (read?.ok) screenState = shellPrompt ? 'agent-exited' : classifyAgentScreen(read.screen, db ? stagedInputEvidenceOf(db, job) : {}).state;
      } catch { /* terminal-show fallback below remains conservative */ }
    }
    const stale = staleAwareState(screenState, outputAgeMs, ACTIVE_STALE_MS);
    // 'gone' is a running Orca's typed answer that the handle names no
    // terminal (after a host reboot Orca knows none of them); an unreachable
    // Orca stays 'unknown' and never proves a worker dead.
    const liveness = !shown?.ok ? (TERMINAL_GONE_CODES.has(shown?.errorCode) ? 'gone' : 'unknown')
      : !connected || !writable ? 'disconnected'
      : screenState === 'agent-exited' ? 'agent-exited'
      : screenState === 'staged-input' ? 'staged-input'
      : screenState === 'wedged' ? 'wedged'
      : stale.staleActive ? 'turn-idle'
      : screenState === 'active' ? 'active'
      : screenState === 'turn-idle' ? 'turn-idle'
      : screenState === 'interactive-gate' ? 'interactive-gate'
      : screenState === 'failed' ? 'failed'
      : outputAgeMs != null && outputAgeMs <= ACTIVE_UNCLASSIFIED_MS ? 'active-unclassified'
      : 'live-idle';
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness, connected, writable,
      terminalStatus: shown?.terminal?.status ?? null, lastOutputAt: Number.isFinite(lastOutputAt) ? lastOutputAt : null,
      outputAgeMs, screenState, ...(shellPrompt ? { shellPrompt } : {}), ...(stale.staleActive && connected && writable ? { livenessReason: 'stale-active' } : {}),
      ...(shown?.errorCode ? { errorCode: shown.errorCode } : {}), observedAt: now };
  } catch (error) {
    return { jobId: job.job_id, opId: job.op_id, ledgerStatus: job.status, terminalHandle, liveness: 'unknown', reason: String(error?.message ?? error), observedAt: now };
  }
};

// A durable transition should wake the workflow coordinator immediately when
// its previous model turn has yielded back to the provider prompt.  The
// watchdog remains the coarse five-minute fallback; this path is event-driven
// and best-effort so a terminal transport failure can never roll back or hide
// the report row that was already committed.
const wakeKernelForTransition = (ledger, { workflowId, transition, jobId, dispatchId, lines = null }) => {
  const db = ledger.db;
  const signal = db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const terminal = parseJson(signal?.value_json ?? '')?.terminal ?? null;
  if (!terminal) return { action: 'kernel-signal-absent', terminal: null };
  try {
    const shown = terminalShow({ terminal });
    if (!shown?.ok || shown.connected !== true || shown.writable !== true) {
      return { action: 'kernel-unavailable', terminal, error: shown?.error ?? shown?.exitCause ?? null };
    }
    const read = terminalRead({ terminal, screen: true });
    if (!read?.ok) return { action: 'kernel-unreadable', terminal, error: read?.error ?? null };
    const shellPrompt = exitedAgentPromptRow(read.screen);
    if (shellPrompt) return { action: 'kernel-exited', terminal, state: 'agent-exited', shellPrompt };
    const lastOutputAt = Number(shown?.terminal?.lastOutputAt);
    const outputAgeMs = Number.isFinite(lastOutputAt) && lastOutputAt > 0 ? Math.max(0, Date.now() - lastOutputAt) : null;
    const state = staleAwareState(classifyAgentScreen(read.screen).state, outputAgeMs, ACTIVE_STALE_MS).state;
    // A queued message waits for Enter: deliver it; it already asks the
    // Kernel to act, and it reads status first. A staged paste is submitted
    // the same way, never buried under a second wake (inc-06aeecf432f1).
    // Delivery is proven from the screen, not Orca's receipt: a stalled or
    // blocked send whose text landed or queued is delivered, and only a screen
    // that shows none of it fails (scripts/kernel/wake-delivery.mjs).
    if (state === 'queued-input' || state === 'staged-input') {
      const proof = sendEnterWithProof({ terminal });
      return { action: proof.ok ? `kernel-${state}-sent` : 'kernel-wake-failed', terminal, state, ...deliveryFieldsOf(proof),
        ...(proof.ok ? {} : { error: proof.sent?.error || proof.sendErrorCode || null }) };
    }
    if (state !== 'turn-idle') return { action: 'kernel-active', terminal, state };
    const prompt = (lines ?? [
      `Durable transition wake for workflow ${workflowId}: ${transition}.`,
      `Operation job ${jobId} filed dispatch ${dispatchId}.`,
      'Re-read canonical api status and survey now; consume, independently check and settle the exact report, release its worker, then continue the approved frontier.',
      'This wake grants no new scope, path, retry or authority and must not duplicate an existing job or bypass an effect fence.',
    ]).join(' ');
    const proof = sendWakeWithProof({ terminal, text: prompt, before: String(read.screen ?? '') });
    const sent = proof.sent ?? {}, delivered = deliveryFieldsOf(proof);
    if (!proof.ok) return { action: 'kernel-wake-failed', terminal, state, error: sent.error || proof.sendErrorCode || null, ...delivered };
    ledger.transaction(() => ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'kernel-transition-woken',
      payload: { transition, jobId, dispatchId, terminal, priorState: state, ...delivered },
    }));
    return { action: 'kernel-woken', terminal, state, receipt: sent.receipt ?? null, ...delivered };
  } catch (error) {
    return { action: 'kernel-wake-error', terminal, error: String(error?.message ?? error) };
  }
};

/* --------------------------------------------------------------- nudge */
// A connected terminal at its provider input prompt is not an active model
// turn.  Nudge wakes that exact operation worker so it can file the report its
// accepted contract owes.  This is liveness maintenance only: it grants no
// paths or approval and never creates/retries/settles a job.
function cmdNudge(ledger, args) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  if (job.status !== 'running') throw Object.assign(new Error(`job ${jobId} is ${job.status}; nudge requires running`), { code: 'job-not-running' });
  const payload = jobPayloadOf(job);
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? job.worker_id;
  const report = dispatchId
    ? db.prepare('SELECT outcome,consumed_at FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId)
    : null;
  if (report) {
    const out = { ok: true, jobId, nudged: false, reason: 'report-filed', report };
    emit(out, `nudge skipped for ${jobId}: report already filed (${report.outcome})`, args.json);
    return;
  }
  const worker = observeOperationWorker(job, Date.now(), db);
  if (!worker.terminalHandle || !worker.connected || !worker.writable) {
    const out = { ok: false, jobId, nudged: false, reason: 'worker-unavailable', worker };
    emit(out, `nudge REFUSED for ${jobId}: exact worker is unavailable`, args.json);
    process.exit(1);
  }
  // The agent exited and left a bare shell: a wake would run as a shell command.
  // Nothing is typed; status reads it worker-dead and reconcile --dead-worker recovers it.
  if (worker.liveness === 'agent-exited') {
    const out = { ok: false, jobId, nudged: false, reason: 'agent-exited', delivery: 'agent-exited', worker };
    emit(out, `nudge REFUSED for ${jobId}: the worker's agent exited (its terminal shows the shell prompt '${worker.shellPrompt}'); nothing was typed - run api reconcile --job ${jobId} --dead-worker`, args.json);
    process.exit(1);
  }
  if (worker.liveness === 'active' || worker.liveness === 'active-unclassified') {
    const out = { ok: true, jobId, nudged: false, reason: 'worker-active', worker };
    emit(out, `nudge skipped for ${jobId}: exact worker is active`, args.json);
    return;
  }
  // A staged, unsubmitted paste (the dispatch contract still in the input
  // row) is not started work and not an idle prompt: typing a wake on top of
  // it would bury it. One Enter-only send submits exactly what is there
  // (inc-06aeecf432f1; the dispatch-time twin is scripts/agent/lib.mjs
  // awaitSubmission).
  // A stalled/blocked receipt is not a failure when the next frame no longer
  // reads staged-input (scripts/kernel/wake-delivery.mjs).
  if (worker.liveness === 'staged-input') {
    const proof = sendEnterWithProof({ terminal: worker.terminalHandle, ...stagedInputEvidenceOf(db, job) });
    const sent = proof.sent ?? {};
    if (!proof.ok) {
      const out = { ok: false, jobId, nudged: false, reason: 'terminal-send-failed', delivery: 'failed', evidence: proof.evidence, sendErrorCode: proof.sendErrorCode, worker, error: sent.error };
      emit(out, `nudge FAILED for ${jobId}: ${sent.error || proof.sendErrorCode || 'terminal send failed'}; the screen still shows the staged input`, args.json);
      process.exit(1);
    }
    ledger.transaction(() => ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-worker-nudged', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, priorLiveness: worker.liveness, action: 'submit-staged-input', delivery: proof.delivery, evidence: proof.evidence, ...(proof.sendErrorCode ? { sendErrorCode: proof.sendErrorCode } : {}) },
    }));
    const out = { ok: true, jobId, nudged: true, action: 'submit-staged-input', delivery: proof.delivery, evidence: proof.evidence, ...(proof.sendErrorCode ? { sendErrorCode: proof.sendErrorCode } : {}), worker, receipt: sent.receipt ?? null };
    emit(out, `nudged ${jobId}: submitted the staged input on exact worker ${worker.terminalHandle} with one Enter`, args.json);
    return;
  }
  if (worker.liveness === 'interactive-gate' || worker.liveness === 'failed') {
    const out = { ok: false, jobId, nudged: false, reason: worker.liveness, worker };
    emit(out, `nudge REFUSED for ${jobId}: terminal state=${worker.liveness}`, args.json);
    process.exit(1);
  }
  if (!['turn-idle', 'live-idle'].includes(worker.liveness)) {
    const out = { ok: false, jobId, nudged: false, reason: 'worker-state-unknown', worker };
    emit(out, `nudge REFUSED for ${jobId}: terminal state=${worker.liveness}`, args.json);
    process.exit(1);
  }
  const prompt = [
    `Operation liveness wake for durable job ${jobId} (${job.op_id}) attempt ${job.attempt}.`,
    'Your accepted contract remains running but no durable report is filed.',
    'Re-read the exact contract with api op-contract, continue only inside its existing authority, and file exactly one api report.',
    'Report done, partial, failed, ask or blocked truthfully; do not wait for another chat prompt and do not widen scope.',
  ].join(' ');
  // Delivery is proven from the screen, not Orca's receipt: agent_prompt_stalled
  // (text queued behind a running turn) and agent_prompt_blocked (Enter refused,
  // then retried) left wakes on the worker's screen while nudge reported
  // terminal-send-failed (inc-b87a42ec8690, inc-e4f69f9ef061, inc-13ab4be5059f).
  const proof = sendWakeWithProof({ terminal: worker.terminalHandle, text: prompt, stagedPattern: stagedInputEvidenceOf(db, job).stagedPattern });
  const sent = proof.sent ?? {};
  // A dropped wake (ok receipt, idle frame, no text) is retried once split -
  // text, then Enter-only - and says so: splitRetried/splitOutcome.
  const delivered = deliveryFieldsOf(proof);
  // The agent exited after the observation: the frame read right before typing
  // ended in a shell (nothing typed), or the frames after the send show a shell
  // got the text. Never a delivery; reconcile --dead-worker recovers the job.
  if (!proof.ok && proof.delivery === 'agent-exited') {
    const typed = Boolean(proof.sent);
    if (typed) ledger.transaction(() => ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-worker-wake-to-shell', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle,
        priorLiveness: worker.liveness, shellPrompt: proof.shellPrompt ?? null, ...delivered },
    }));
    const out = { ok: false, jobId, nudged: false, reason: 'agent-exited', ...delivered, shellPrompt: proof.shellPrompt ?? null, typed, worker };
    emit(out, `nudge REFUSED for ${jobId}: the worker's agent exited (${typed ? `a shell received the wake: '${proof.shellPrompt}'` : `its terminal shows the shell prompt '${proof.shellPrompt}'; nothing was typed`}) - run api reconcile --job ${jobId} --dead-worker`, args.json);
    process.exit(1);
  }
  if (!proof.ok) {
    const out = { ok: false, jobId, nudged: false, reason: 'terminal-send-failed', ...delivered, worker, error: sent.error };
    emit(out, `nudge FAILED for ${jobId}: ${sent.error || proof.sendErrorCode || 'terminal send failed'}; the screen shows no wake (${proof.evidence})`, args.json);
    process.exit(1);
  }
  ledger.transaction(() => ledger.appendEvent({
    workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
    kind: 'op-worker-nudged', payload: { opId: job.op_id, attempt: job.attempt, dispatchId, terminal: worker.terminalHandle, priorLiveness: worker.liveness, ...(worker.livenessReason ? { livenessReason: worker.livenessReason } : {}), ...delivered },
  }));
  const out = { ok: true, jobId, nudged: true, action: 'wake', ...delivered, worker, receipt: sent.receipt ?? null };
  emit(out, `nudged ${jobId}: ${proof.delivery === 'queued' ? 'queued the wake behind the running turn of' : 'resumed'} exact worker ${worker.terminalHandle} to file its durable report (${proof.evidence})`, args.json);
}

/* --------------------------------------------------------------- observe */
// READ-ONLY context: the kernel's only window onto its own job's exact op
// terminal — terminal-show liveness plus a bounded screen tail — so a ~3min
// cadence keeps reasoning context when an op is silent between reports. It
// never sends (that is `nudge`), never closes (that is `settle`), and an
// op's screen is NEVER proof: only a filed `api report` plus kernel-run
// `api check` rows settle a verdict. The sole durable write is a compact
// 'op-observed' event (handle, turnState, screen byte length — the screen
// itself stays out of the ledger).
const OBSERVE_SCREEN_LINES = 80;
const OBSERVE_TURN_STATES = { active: 'active', wedged: 'wedged', 'turn-idle': 'turn-idle', 'interactive-gate': 'turn-idle', 'staged-input': 'staged-input' };
function cmdObserve(ledger, args) {
  const db = ledger.db, jobId = args.job, now = Date.now();
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-not-found' });
  if (job.kind !== 'op') throw Object.assign(new Error(`job ${jobId} is not an operation`), { code: 'job-not-operation' });
  let lines = OBSERVE_SCREEN_LINES;
  if (args.lines != null) {
    const n = Number(args.lines);
    need(Number.isInteger(n) && n > 0, `observe --lines must be a positive integer, got '${args.lines}'`);
    lines = n;
  }
  const handle = operationTerminalHandleOf(job);
  if (!handle) {
    const out = { ok: false, job: jobId, reason: 'no-live-worker', ledgerStatus: job.status };
    emit(out, `observe REFUSED for ${jobId}: no-live-worker (a ${job.status} job binds no worker terminal)`, args.json);
    process.exit(1);
  }
  // Host reads only — terminal-show for liveness, terminal-read for the
  // screen tail. A dead or unreadable terminal is a typed projection, not a
  // refusal: the kernel still needs the context to reason about the op.
  const terminal = { handle, connected: false, writable: false, status: null, idleMs: null };
  let screen = null, turnState = 'unknown', screenState = null;
  let shown;
  try { shown = terminalShow({ terminal: handle }); }
  catch (error) { shown = { ok: false, error: String(error?.message ?? error) }; }
  terminal.connected = shown?.ok === true && shown?.connected === true;
  terminal.writable = shown?.ok === true && shown?.writable === true;
  terminal.status = shown?.terminal?.status ?? null;
  const lastOutputAt = Number(shown?.terminal?.lastOutputAt);
  terminal.idleMs = Number.isFinite(lastOutputAt) ? Math.max(0, now - lastOutputAt) : null;
  if (!shown?.ok) turnState = 'unreadable';
  else if (!terminal.connected || !terminal.writable) turnState = 'disconnected';
  else {
    let read;
    try { read = terminalRead({ terminal: handle, screen: true }); }
    catch (error) { read = { ok: false, error: String(error?.message ?? error) }; }
    if (!read?.ok) turnState = 'unreadable';
    else {
      const shellPrompt = exitedAgentPromptRow(read.screen);
      screenState = shellPrompt ? 'agent-exited' : classifyAgentScreen(read.screen, stagedInputEvidenceOf(db, job)).state;
      const stale = staleAwareState(screenState, terminal.idleMs, ACTIVE_STALE_MS);
      turnState = shellPrompt ? 'agent-exited' : OBSERVE_TURN_STATES[stale.state] ?? 'unknown';
      if (stale.staleActive) terminal.livenessReason = 'stale-active';
      screen = String(read.screen ?? '').split(/\r?\n/).slice(-lines).join('\n');
    }
  }
  if (screenState) terminal.screenState = screenState;
  ledger.transaction(() => ledger.appendEvent({
    workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
    kind: 'op-observed',
    payload: { opId: job.op_id, attempt: job.attempt, terminal: handle, turnState, screenBytes: screen == null ? 0 : Buffer.byteLength(screen) },
  }));
  const out = { ok: true, job: jobId, jobId, opId: job.op_id, attempt: job.attempt, ledgerStatus: job.status, terminal, screen, turnState, observedAt: now };
  emit(out, [
    `observe ${jobId} — ${turnState} (terminal ${handle}, connected=${terminal.connected} writable=${terminal.writable}, screen ${screen == null ? 0 : screen.split('\n').length} lines)`,
    ...(screen == null ? [] : [screen]),
  ].join('\n'), args.json);
}
/* ------------------------------------------------------ worker questions */
// Orca's managed preamble tells every worker to reach its coordinator with
// `orca orchestration ask`, and the coordinator of a workflow Run is the
// Kernel terminal - which may not call Orca. With no api verb to read or
// answer those messages, a StarCi Next backend.scaffold cut sat waiting on an
// ESLint question and a seam retry waited on a background ask, both
// unanswered while status said engaged (inc-b944cbaef24b, inc-20449a260df8);
// 83 of 87 question messages in the host inbox had no reply. The op contract
// still says an op files `api report --outcome ask` (modules/ops/_common.yaml),
// but the runtime never strands a worker that asked through Orca instead:
// status projects its question as actionable, `api questions` bridges it into
// the ledger inbox (kind worker-question), and `api reply` answers it through
// scripts/api/orca/orch-reply.mjs - a technical answer inside the job's
// authority, or --to-owner, which tells the worker to file the question as an
// outcome ask so serve-ask carries it to the owner.
const ORCHESTRATION_INBOX_LIMIT = 1000;
const WORKER_QUESTION = 'worker-question';
const OWNER_ROUTED_REPLY = [
  'This question needs the owner, and an Orca ask never reaches them.',
  'Do not wait for a reply here: write your report.json with outcome ask and question {text, options},',
  'file it with api report exactly as your contract says, and end your turn.',
  'The Kernel serves the question to the owner (serve-ask) and re-enqueues this operation with the answer bound.',
].join(' ');
const workflowRunIdsOf = (db, workflowId) => {
  const ids = new Set();
  for (const row of db.prepare('SELECT payload_json FROM jobs WHERE workflow_id=?').all(workflowId)) {
    const payload = jobPayloadOf(row);
    for (const id of [payload.orca?.runId, payload.managed?.runId, payload.hierarchy?.runtime?.runId]) if (id) ids.add(String(id));
  }
  return ids;
};
const jobDispatchIdsOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return new Set([payload.managed?.dispatchId, payload.orca?.dispatchId, payload.hierarchy?.runtime?.dispatchId, contractDispatchIdOf(db, job)].filter(Boolean));
};
/**
 * The workflow's worker questions: Orca `question` rows of its Runs (read through the non-consuming
 * inbox wrapper) joined to the job that asked, plus the worker-question rows already bridged into the
 * ledger inbox. A question is pending while its job is open, no reply is threaded onto it in Orca and
 * its ledger row (if any) is still pending. Reads only; `api questions` is the writer.
 */
const workerQuestionsOf = (db, workflowId) => {
  const rows = db.prepare('SELECT inbox_id,key,payload_json,status FROM inbox WHERE workflow_id=? AND kind=? ORDER BY inbox_id').all(workflowId, WORKER_QUESTION);
  const ledgerRow = new Map(rows.map((row) => [row.key, row]));
  const jobs = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel'").all(workflowId);
  const runIds = workflowRunIdsOf(db, workflowId);
  const seen = new Map();
  let error = null;
  if (runIds.size) {
    let listed;
    try { listed = orchInbox({ limit: ORCHESTRATION_INBOX_LIMIT }); }
    catch (e) { listed = { ok: false, error: String(e?.message ?? e), messages: [] }; }
    if (!listed.ok) error = listed.error ?? 'orchestration inbox unreadable';
    const messages = listed.messages.filter((message) => runIds.has(String(message.run_id)));
    const repliedTo = new Set(messages.filter((message) => message.thread_id && message.thread_id !== message.id).map((message) => message.thread_id));
    for (const message of messages.filter((item) => item.type === 'question')) {
      const body = parseJson(message.payload ?? '', {}) ?? {};
      const from = String(message.from_handle ?? '');
      const dispatchId = body.dispatchId ?? (from.startsWith('dispatch:') ? from.slice('dispatch:'.length) : null);
      const job = jobs.find((row) => (dispatchId && jobDispatchIdsOf(db, row).has(dispatchId))
        || (from && operationTerminalHandleOf(row) === from)) ?? null;
      seen.set(message.id, {
        messageId: message.id, runId: message.run_id ?? null, jobId: job?.job_id ?? null, opId: job?.op_id ?? null,
        attempt: job?.attempt ?? null, jobStatus: job?.status ?? null, dispatchId, taskId: body.taskId ?? null,
        question: String(body.question ?? message.body ?? ''), options: Array.isArray(body.options) ? body.options : [],
        subject: message.subject ?? null, askedAt: message.created_at ?? null, repliedInOrca: repliedTo.has(message.id),
      });
    }
  }
  // A bridged question the host inbox no longer lists (it scrolled past the
  // read limit) is still the ledger's to answer.
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    const stored = parseJson(row.payload_json, {}) ?? {};
    const job = stored.jobId ? jobs.find((item) => item.job_id === stored.jobId) : null;
    seen.set(row.key, { ...stored, jobStatus: job?.status ?? null, repliedInOrca: false });
  }
  const questions = [...seen.values()].map((item) => {
    const row = ledgerRow.get(item.messageId) ?? null;
    const open = Boolean(item.jobId) && !FINAL_SETTLED.includes(item.jobStatus);
    const state = row && row.status !== 'pending' ? 'answered'
      : item.repliedInOrca ? 'replied-elsewhere'
      : !item.jobId ? 'unmatched'
      : !open ? 'job-settled'
      : 'pending';
    return { ...item, bridged: Boolean(row), state };
  });
  return { questions, pending: questions.filter((item) => item.state === 'pending'), error };
};

function cmdQuestions(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const { questions, pending, error } = workerQuestionsOf(db, workflowId);
  let bridged = 0, closed = 0;
  ledger.transaction(() => {
    const now = Date.now();
    for (const item of pending.filter((q) => !q.bridged)) {
      const { state, bridged: _b, jobStatus, repliedInOrca, ...stored } = item;
      db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?, 'pending',?)")
        .run(workflowId, WORKER_QUESTION, item.messageId, JSON.stringify(stored), now);
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: item.jobId, kind: 'worker-question-bridged',
        payload: { messageId: item.messageId, dispatchId: item.dispatchId, runId: item.runId } });
      bridged += 1;
    }
    // A bridged question whose worker is gone, or that someone answered in
    // Orca directly, no longer waits on the Kernel.
    for (const item of questions.filter((q) => q.bridged && ['job-settled', 'replied-elsewhere'].includes(q.state))) {
      closed += db.prepare("UPDATE inbox SET status='done', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind=? AND key=? AND status='pending'")
        .run(JSON.stringify({ reason: item.state }), now, workflowId, WORKER_QUESTION, item.messageId).changes;
    }
  });
  const out = { ok: true, workflowId, bridged, closed, pending: workerQuestionsOf(db, workflowId).pending, ...(error ? { error } : {}) };
  emit(out, [
    `questions ${workflowId}: ${out.pending.length} pending worker question(s) (bridged ${bridged}, closed ${closed})${error ? ` — host inbox unreadable: ${error}` : ''}`,
    ...out.pending.map((q) => `  ${q.messageId} ${q.jobId} (${q.opId} a${q.attempt}): ${q.question}${q.options.length ? ` [${q.options.join(' | ')}]` : ''}`),
  ].join('\n'), args.json);
}

function cmdReply(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, messageId = args.message;
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const toOwner = Boolean(args['to-owner']);
  if (!toOwner && !(typeof args.body === 'string' && args.body.trim())) {
    throw Object.assign(new Error('reply needs --body <answer> or --to-owner'), { code: 'reply-body-missing' });
  }
  const item = workerQuestionsOf(db, workflowId).questions.find((q) => q.messageId === messageId);
  if (!item) throw Object.assign(new Error(`no worker question ${messageId} in ${workflowId}'s Runs`), { code: 'question-unknown' });
  if (item.state !== 'pending') {
    throw Object.assign(new Error(`worker question ${messageId} is ${item.state}; nothing waits on this reply`), { code: `question-${item.state}` });
  }
  const body = toOwner ? `${OWNER_ROUTED_REPLY}${args.body ? ` Kernel note: ${args.body}` : ''}` : String(args.body);
  const sent = orchReply({ id: messageId, body, run: item.runId });
  if (!sent.ok) {
    const out = { ok: false, workflowId, messageId, jobId: item.jobId, reason: 'reply-failed', error: sent.error ?? sent.outcome };
    emit(out, `reply FAILED for ${messageId}: ${out.error}`, args.json);
    process.exit(1);
  }
  ledger.transaction(() => {
    const now = Date.now();
    const disposition = JSON.stringify({ reply: body, toOwner, at: now });
    const { state, bridged, jobStatus, repliedInOrca, ...stored } = item;
    if (bridged) {
      db.prepare('UPDATE inbox SET status=\'applied\', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind=? AND key=?')
        .run(disposition, now, workflowId, WORKER_QUESTION, messageId);
    } else {
      db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,disposition_json,created_at,applied_at) VALUES(?,?,?,?, 'applied',?,?,?)")
        .run(workflowId, WORKER_QUESTION, messageId, JSON.stringify(stored), disposition, now, now);
    }
    ledger.appendEvent({ workflowId, entityType: 'job', entityId: item.jobId, kind: 'worker-question-answered',
      payload: { messageId, dispatchId: item.dispatchId, runId: item.runId, toOwner } });
  });
  const out = { ok: true, workflowId, messageId, jobId: item.jobId, toOwner, body };
  emit(out, `replied to ${messageId} (${item.jobId})${toOwner ? ': routed to the owner through outcome ask' : ''}`, args.json);
}

/* --------------------------------------------------------- peer messages */
// Several workflows of one product repo share its ledger and build in the
// same source repositories (nivo: Login, workspace provision, modules and
// collab in nivo-backend + nivo-fe). With no channel between their Kernels a
// Collab Kernel that needed the Login workflow's phone verification asked the
// owner who should build it, two workflows edited overlapping areas, and a
// repo-wide migration was owned by no workflow. Peers now talk through the
// ledger inbox (kind peer-message): `api notify` writes one pending row per
// target, the target's status frontier is actionable until its Kernel reads
// `api inbox` and acks each row with a disposition the sender can read back,
// and `api enqueue` sends an automatic heads-up when a new job's owned_paths
// overlap an open job of a peer. These are Kernel verbs; an op never sends.
//
// PEER RULE: every other workflow of the same ledger that is phase running,
// not archived, and shares a source root with this one; a workflow with no
// recorded roots shares every root. define-goal records the ledger's own repo
// as each workflow's source_roots_json and a job's `repository` is rarely set,
// so in practice every running workflow of one ledger is a peer: the ledger
// is one product and its binding spans the product's repositories.
const PEER_MESSAGE = 'peer-message';
const PEER_MESSAGE_KINDS = ['request', 'heads-up', 'handoff', 'reply'];
const PEER_RULE = 'every other running, unarchived workflow of this ledger that shares a source root (source_roots_json; unrecorded roots share all)';
const PEER_OPEN_JOB_STATUSES = [...DISPATCHABLE, ...JOB_STATUSES.fenced];
const PEER_SENT_LIMIT = 20;
const sourceRootKey = (root) => {
  const resolved = path.resolve(String(root)).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};
const sourceRootsOf = (wf) => {
  const roots = parseJson(wf?.source_roots_json ?? '', null);
  return Array.isArray(roots) ? roots.filter((root) => typeof root === 'string' && root.trim()).map(sourceRootKey) : [];
};
const sharesSourceRoot = (a, b) => {
  const left = sourceRootsOf(a), right = sourceRootsOf(b);
  return !left.length || !right.length || left.some((root) => right.includes(root));
};
const peerWorkflowsOf = (db, self) => db.prepare("SELECT * FROM workflows WHERE workflow_id<>? AND phase='running' AND archived_at IS NULL ORDER BY created_at,workflow_id")
  .all(self.workflow_id).filter((wf) => sharesSourceRoot(self, wf));
/** Why `to` is not a running peer of `self`, or null when it is. */
const peerRefusalOf = (db, self, to) => {
  if (to === self.workflow_id) return { code: 'peer-self', detail: `${to} is the sending workflow itself` };
  const wf = getWorkflow(db, to);
  if (!wf) return { code: 'peer-unknown', detail: `no workflow ${to} in this ledger` };
  if (wf.phase !== 'running' || wf.archived_at != null) {
    return { code: 'peer-not-running', detail: `${to} is ${wf.archived_at != null ? 'archived' : `phase ${wf.phase ?? 'unset'}`}; only a running workflow is a peer` };
  }
  if (!sharesSourceRoot(self, wf)) return { code: 'peer-not-shared-source', detail: `${to} shares no source root with ${self.workflow_id}` };
  return null;
};
const peerOpenJobsOf = (db, workflowId) => db.prepare(`SELECT job_id,op_id,status,attempt,payload_json,created_at,updated_at FROM jobs
    WHERE workflow_id=? AND kind<>'kernel' AND status IN (${PEER_OPEN_JOB_STATUSES.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
  .all(workflowId, ...PEER_OPEN_JOB_STATUSES)
  .map((row) => ({ jobId: row.job_id, op: row.op_id ?? jobPayloadOf(row).opId ?? null, status: row.status, attempt: row.attempt,
    paths: ownedPathsOf(jobPayloadOf(row)), updatedAt: row.updated_at ?? row.created_at ?? 0 }));
/** A workflow's current leg: its most recently moved in-flight job, else its latest queued one. */
const currentLegOf = (jobs) => {
  const inFlight = jobs.filter((job) => job.status !== 'queued').sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const pick = inFlight ?? jobs.filter((job) => job.status === 'queued').at(-1) ?? null;
  return pick ? { jobId: pick.jobId, op: pick.op, status: pick.status, attempt: pick.attempt } : null;
};
const peerMessageOf = (row) => {
  const payload = parseJson(row.payload_json, {}) ?? {};
  return {
    key: row.key, to: row.workflow_id, from: payload.from ?? null, fromTitle: payload.fromTitle ?? null, kind: payload.kind ?? null,
    subject: payload.subject ?? null, body: payload.body ?? null, replyTo: payload.replyTo ?? null,
    refs: Array.isArray(payload.refs) ? payload.refs : [], at: payload.at ?? row.created_at,
    status: row.status, disposition: parseJson(row.disposition_json ?? '', null), appliedAt: row.applied_at ?? null,
  };
};
// Every peer-message row, read by kind and filtered in JS: json_extract over
// the whole inbox would also parse the other kinds' payloads.
const peerMessageRows = (db) => db.prepare('SELECT * FROM inbox WHERE kind=? ORDER BY inbox_id').all(PEER_MESSAGE);
const pendingPeerMessagesOf = (db, workflowId) => db.prepare("SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND status='pending' ORDER BY inbox_id")
  .all(workflowId, PEER_MESSAGE).map(peerMessageOf);
const pathsIntersectSafe = (a, b) => { try { return ownedPathsIntersect(a, b); } catch { return false; } };
/**
 * One pending peer-message row in `to`'s inbox plus the sender's 'peer-message-sent' event. The
 * caller holds the transaction and has already proven `to` a running peer.
 */
const writePeerMessage = (ledger, { from, to, kind, subject, body, replyTo = null, refs = [], extra = {}, now = Date.now() }) => {
  const key = `pm-${newToken().slice(0, 12)}`;
  const payload = { from: from.workflow_id, fromTitle: from.title ?? null, kind, subject, body, replyTo, refs, at: now, ...extra };
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?, 'pending',?)")
    .run(to, PEER_MESSAGE, key, JSON.stringify(payload), now);
  ledger.appendEvent({ workflowId: from.workflow_id, entityType: 'workflow', entityId: from.workflow_id, kind: 'peer-message-sent',
    payload: { to, key, kind, subject, replyTo, ...(extra.auto ? { auto: extra.auto } : {}) } });
  return { to, key, kind, subject };
};
/**
 * A peer message from `peer` just reached `waiter`. Each open peer-wait of `waiter` on `peer` marked
 * --until-message is resolved (incident-resolved {detail, peerMessage}), and the waiter's Kernel is
 * woken best-effort: a turn-idle Kernel gets the wake now instead of at the next watchdog tick (the
 * pending message already makes its frontier peer-message, actionable). Null when `waiter` waits on
 * nothing from `peer`; otherwise {waits, resolved, wake}.
 */
const peerWaitMessageArrived = (ledger, { waiter, peer, key, kind, subject }) => {
  const db = ledger.db;
  const waits = openPeerWaits(db, waiter).filter((wait) => wait.peer === peer);
  if (!waits.length) return null;
  const resolved = waits.filter((wait) => wait.untilMessage).map((wait) => wait.incidentId);
  if (resolved.length) {
    ledger.transaction(() => {
      const now = Date.now();
      for (const incidentId of resolved) {
        db.prepare("UPDATE incidents SET status='resolved',updated_at=? WHERE incident_id=? AND status='open'").run(now, incidentId);
        ledger.appendEvent({ workflowId: waiter, entityType: 'incident', entityId: incidentId, kind: 'incident-resolved',
          payload: { detail: `peer-wait met by peer message ${key} (${kind}) from ${peer}: ${subject}`, peerMessage: key, peer, by: 'peer-message' } });
      }
    });
  }
  const wake = wakeKernelForTransition(ledger, {
    workflowId: waiter, transition: 'peer-wait-message', jobId: null, dispatchId: null,
    lines: [
      `Durable transition wake for workflow ${waiter}: peer-wait-message.`,
      `Peer ${peer} sent ${kind} ${key} (${subject}), which peer-wait ${waits.map((wait) => wait.incidentId).join(', ')} waits on${resolved.length ? `; ${resolved.join(', ')} resolved by it` : ''}.`,
      'Re-read canonical api status and api inbox now; verify the prerequisite the wait named actually holds before you enqueue the held work, ack the message, and resolve any wait still open once its proof holds (or record a new peer-wait when it does not).',
      'This wake grants no new scope, path, retry or authority and must not duplicate an existing job or bypass an effect fence.',
    ],
  });
  return { waits: waits.map((wait) => wait.incidentId), resolved, wake: wake.action };
};
/**
 * The enqueue-time overlap heads-up. Every open job of a running peer holding an owned path equal to,
 * above or below one of the new job's paths is returned as {workflowId, jobId, path, ownPath}, and
 * each such peer gets ONE heads-up naming the overlapping job pairs. A job pair already announced
 * (either direction) is never announced again. Nothing is blocked: the capacity-1 path leases
 * dispatch takes already serialize the writes.
 */
const peerOverlapHeadsUp = (ledger, { self, jobId, op, ownedPaths, now = Date.now() }) => {
  const db = ledger.db, overlap = [], messages = [];
  const peers = peerWorkflowsOf(db, self);
  if (!peers.length) return { overlap, messages };
  const pairKey = (other) => [jobId, other].sort().join('|');
  const announced = new Set(peerMessageRows(db).flatMap((row) => {
    const pairs = parseJson(row.payload_json, {})?.overlapPairs;
    return Array.isArray(pairs) ? pairs : [];
  }));
  for (const peer of peers) {
    const hits = [];
    for (const job of peerOpenJobsOf(db, peer.workflow_id)) {
      for (const peerPath of job.paths) {
        const ownPath = ownedPaths.find((own) => pathsIntersectSafe(own, peerPath));
        if (ownPath) hits.push({ workflowId: peer.workflow_id, jobId: job.jobId, op: job.op, path: peerPath, ownPath });
      }
    }
    if (!hits.length) continue;
    overlap.push(...hits.map(({ workflowId, jobId: peerJob, path: peerPath, ownPath }) => ({ workflowId, jobId: peerJob, path: peerPath, ownPath })));
    const fresh = hits.filter((hit) => !announced.has(pairKey(hit.jobId)));
    if (!fresh.length) continue;
    const pairs = [...new Set(fresh.map((hit) => pairKey(hit.jobId)))];
    for (const pair of pairs) announced.add(pair);
    const peerJobs = [...new Set(fresh.map((hit) => hit.jobId))];
    const subject = `overlap: ${op} (${jobId}) owns paths your open job${peerJobs.length > 1 ? 's' : ''} ${peerJobs.join(', ')} own${peerJobs.length > 1 ? '' : 's'}`;
    const body = `${self.title ?? self.workflow_id} (${self.workflow_id}) enqueued ${op} as ${jobId} owning ${ownedPaths.join(', ')}. `
      + `It overlaps ${fresh.map((hit) => `${hit.jobId} (${hit.op ?? '-'}) ${hit.path}`).join('; ')}. `
      + 'The path lease serializes the writes and nothing is blocked. If the two changes conflict in intent or in a shared contract, '
      + `agree the order or the owner of the change with ${self.workflow_id} (api notify --kind reply --reply-to <this key>), then ack this message with what you decided.`;
    messages.push(writePeerMessage(ledger, { from: self, to: peer.workflow_id, kind: 'heads-up', subject, body,
      refs: [jobId, ...peerJobs], extra: { auto: 'enqueue-overlap', overlapPairs: pairs }, now }));
  }
  return { overlap, messages };
};

function cmdPeers(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  const self = getWorkflow(db, workflowId);
  if (!self) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const pendingRows = peerMessageRows(db).filter((row) => row.status === 'pending').map(peerMessageOf);
  const peers = peerWorkflowsOf(db, self).map((wf) => {
    const jobs = peerOpenJobsOf(db, wf.workflow_id);
    const brief = ({ key, from, to, kind, subject, at }) => ({ key, from, to, kind, subject, at });
    return {
      workflowId: wf.workflow_id, title: wf.title ?? null, phase: wf.phase ?? null, currentLeg: currentLegOf(jobs),
      ownedPaths: jobs.filter((job) => job.paths.length).map(({ jobId, op, status, paths }) => ({ jobId, op, status, paths })),
      pending: {
        toPeer: pendingRows.filter((m) => m.to === wf.workflow_id && m.from === workflowId).map(brief),
        fromPeer: pendingRows.filter((m) => m.to === workflowId && m.from === wf.workflow_id).map(brief),
      },
    };
  });
  const out = { ok: true, workflowId, rule: PEER_RULE, peers };
  emit(out, [
    `peers ${workflowId}: ${peers.length} running peer(s)`,
    ...peers.flatMap((peer) => [
      `  ${peer.workflowId} "${peer.title ?? '-'}" leg=${peer.currentLeg ? `${peer.currentLeg.op ?? '-'}:${peer.currentLeg.status} (${peer.currentLeg.jobId})` : '-'} pending to-peer=${peer.pending.toPeer.length} from-peer=${peer.pending.fromPeer.length}`,
      ...peer.ownedPaths.map((job) => `    ${job.jobId} ${job.op ?? '-'} ${job.status}: ${job.paths.join(', ')}`),
    ]),
  ].join('\n'), args.json);
}

function cmdNotify(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  const self = getWorkflow(db, workflowId);
  if (!self) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (self.phase === 'finished') {
    throw Object.assign(new Error(`workflow ${workflowId} is finished; a finished workflow sends no peer message`), { code: 'workflow-finished' });
  }
  const kind = String(args.kind).trim();
  if (!PEER_MESSAGE_KINDS.includes(kind)) {
    throw Object.assign(new Error(`--kind must be ${PEER_MESSAGE_KINDS.join('|')}, got '${kind}'`), { code: 'peer-kind-invalid' });
  }
  const subject = String(args.subject).trim(), body = String(args.body).trim();
  if (!subject || !body) throw Object.assign(new Error('notify needs a non-empty --subject and --body'), { code: 'peer-message-empty' });
  const replyTo = args['reply-to'] ? String(args['reply-to']).trim() : null;
  let original = null;
  if (replyTo) {
    const row = db.prepare('SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND key=? ORDER BY inbox_id DESC LIMIT 1').get(workflowId, PEER_MESSAGE, replyTo);
    if (!row) throw Object.assign(new Error(`--reply-to ${replyTo} names no peer message ${workflowId} received`), { code: 'reply-to-unknown' });
    original = peerMessageOf(row);
  } else if (kind === 'reply') {
    throw Object.assign(new Error('a reply names the message it answers with --reply-to <key>'), { code: 'reply-to-missing' });
  }
  const wanted = String(args.to).trim();
  const targets = wanted === 'peers' ? peerWorkflowsOf(db, self).map((wf) => wf.workflow_id) : csvList(wanted);
  for (const to of new Set(targets)) {
    const refusal = peerRefusalOf(db, self, to);
    if (refusal) throw Object.assign(new Error(refusal.detail), { code: refusal.code });
  }
  if (original && !targets.includes(original.from)) {
    throw Object.assign(new Error(`--reply-to ${replyTo} came from ${original.from}; a reply goes back to its sender`), { code: 'reply-to-mismatch' });
  }
  const refs = csvList(args.refs);
  const sent = [];
  ledger.transaction(() => {
    const now = Date.now();
    for (const to of [...new Set(targets)]) {
      // A Kernel re-sending after a crash sends the same message, not a second one.
      const same = pendingPeerMessagesOf(db, to).find((m) => m.from === workflowId && m.kind === kind && m.subject === subject
        && m.body === body && (m.replyTo ?? null) === replyTo);
      if (same) { sent.push({ to, key: same.key, kind, subject, deduped: true }); continue; }
      sent.push(writePeerMessage(ledger, { from: self, to, kind, subject, body, replyTo, refs, now }));
    }
  });
  // A target waiting on this workflow (peer-wait) is woken now, and its --until-message waits resolve.
  for (const message of sent.filter((m) => !m.deduped)) {
    const arrived = peerWaitMessageArrived(ledger, { waiter: message.to, peer: workflowId, key: message.key, kind, subject });
    if (arrived) message.peerWait = arrived;
  }
  const out = { ok: true, workflowId, kind, subject, replyTo, sent };
  emit(out, `notify ${workflowId} [${kind}] ${subject} -> ${sent.map((m) => `${m.to} (${m.key}${m.deduped ? ', already pending' : ''})`).join(', ') || 'no running peer'}`, args.json);
}

function cmdInbox(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (args.ack != null) {
    const key = String(args.ack).trim();
    const disposition = typeof args.disposition === 'string' ? args.disposition.trim() : '';
    if (!disposition) throw Object.assign(new Error('an ack says what was done: --disposition <text>'), { code: 'disposition-missing' });
    const row = db.prepare("SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND key=? ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, inbox_id DESC LIMIT 1")
      .get(workflowId, PEER_MESSAGE, key);
    if (!row) throw Object.assign(new Error(`no peer message ${key} in ${workflowId}'s inbox`), { code: 'peer-message-unknown' });
    const message = peerMessageOf(row);
    if (row.status !== 'pending') {
      throw Object.assign(new Error(`peer message ${key} is already ${row.status}${message.disposition?.disposition ? `: ${message.disposition.disposition}` : ''}`), { code: 'peer-message-not-pending' });
    }
    ledger.transaction(() => {
      const now = Date.now();
      db.prepare("UPDATE inbox SET status='applied', disposition_json=?, applied_at=? WHERE inbox_id=? AND status='pending'")
        .run(JSON.stringify({ disposition, by: workflowId, at: now }), now, row.inbox_id);
      ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'peer-message-acked',
        payload: { key, from: message.from, kind: message.kind, disposition } });
    });
    const out = { ok: true, workflowId, acked: { key, from: message.from, kind: message.kind, subject: message.subject, disposition },
      pending: pendingPeerMessagesOf(db, workflowId).length };
    emit(out, `acked ${key} from ${message.from} [${message.kind}] ${message.subject}: ${disposition} (${out.pending} still pending)`, args.json);
    return;
  }
  const pending = pendingPeerMessagesOf(db, workflowId)
    .map(({ key, from, fromTitle, kind, subject, body, replyTo, refs, at }) => ({ key, from, fromTitle, kind, subject, body, replyTo, refs, at }));
  const sent = peerMessageRows(db).map(peerMessageOf).filter((m) => m.from === workflowId).slice(-PEER_SENT_LIMIT).reverse()
    .map(({ key, to, kind, subject, replyTo, at, status, disposition, appliedAt }) => ({ key, to, kind, subject, replyTo, at, status, disposition, appliedAt }));
  const out = { ok: true, workflowId, pending, sent };
  emit(out, [
    `inbox ${workflowId}: ${pending.length} pending peer message(s)`,
    ...pending.map((m) => `  ${m.key} from ${m.from} [${m.kind}] ${m.subject}${m.replyTo ? ` (reply to ${m.replyTo})` : ''}\n    ${m.body}${m.refs.length ? `\n    refs: ${m.refs.join(', ')}` : ''}`),
    ...(sent.length ? [`sent (latest ${sent.length}):`] : []),
    ...sent.map((m) => `  ${m.key} to ${m.to} [${m.kind}] ${m.subject} — ${m.status}${m.disposition?.disposition ? `: ${m.disposition.disposition}` : ''}`),
  ].join('\n'), args.json);
}

const AGENT_HIERARCHY_SCHEMA = 'starci/agent-hierarchy@1';
const workflowNodeId = (workflowId) => `workflow:${workflowId}`;
const kernelNodeId = (workflowId) => `agent:kernel:${workflowId}`;
const operationNodeId = (jobId) => `agent:operation:${jobId}`;
const profileProviderCache = new Map();
const providerForProfile = (profile) => {
  if (!profile) return null;
  if (profileProviderCache.has(profile)) return profileProviderCache.get(profile);
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${profile}.yaml`);
  let provider = null;
  try { provider = fs.existsSync(file) ? (parseYaml(fs.readFileSync(file, 'utf8'))?.provider ?? null) : null; } catch { provider = null; }
  profileProviderCache.set(profile, provider);
  return provider;
};

// Durable semantic hierarchy. Terminal tabs and pane ancestry are placement
// hints only; workflow/job identities survive terminal recreation, Kernel
// restarts and operation retries.
const hierarchyNodeOf = (row) => {
  const payload = jobPayloadOf(row);
  const stored = payload.hierarchy ?? {};
  const kernel = row.kind === 'kernel';
  const managed = payload.managed ?? {};
  const orca = payload.orca ?? {};
  const route = payload.route ?? {};
  const runtime = stored.runtime ?? {};
  const profile = runtime.profile ?? route.profile ?? payload.model ?? null;
  const profileProvider = providerForProfile(profile);
  return {
    nodeId: stored.nodeId ?? (kernel ? kernelNodeId(row.workflow_id) : operationNodeId(row.job_id)),
    parentNodeId: stored.parentNodeId ?? (kernel ? workflowNodeId(row.workflow_id) : kernelNodeId(row.workflow_id)),
    role: stored.role ?? (kernel ? 'kernel' : 'operation'),
    workflowId: row.workflow_id,
    jobId: row.job_id,
    opId: row.op_id ?? payload.opId ?? null,
    attempt: row.attempt,
    generation: row.generation,
    status: row.status,
    runtime: {
      host: runtime.host ?? route.host ?? 'orca',
      agent: runtime.agent ?? route.agent ?? payload.agent ?? payload.provider ?? profileProvider ?? null,
      provider: runtime.provider ?? payload.provider ?? route.agent ?? profileProvider ?? null,
      model: runtime.model ?? route.model ?? payload.modelId ?? null,
      profile,
      runtimePool: runtime.runtimePool ?? route.runtimePool ?? payload.model ?? null,
      runId: runtime.runId ?? managed.runId ?? orca.runId ?? null,
      taskId: runtime.taskId ?? managed.taskId ?? orca.taskId ?? null,
      dispatchId: runtime.dispatchId ?? managed.dispatchId ?? orca.dispatchId ?? null,
      terminalHandle: runtime.terminalHandle ?? managed.agentTerminalHandle ?? orca.agentTerminalHandle
        ?? (kernel ? row.worker_id : (managed.dispatchId ? null : row.worker_id)) ?? null,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const agentHierarchyOf = (db, workflowId) => {
  const workflow = getWorkflow(db, workflowId);
  if (!workflow) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const root = {
    nodeId: workflowNodeId(workflowId), role: 'workflow', workflowId,
    title: workflow.title ?? workflowId, status: workflow.phase ?? null,
    generation: workflow.generation ?? 0,
  };
  const nodes = db.prepare('SELECT * FROM jobs WHERE workflow_id=? ORDER BY created_at,job_id').all(workflowId)
    .map((row) => ({ ...hierarchyNodeOf(row), verdict: isAwaitingOwner(db, row) ? AWAITING_OWNER : (jobResultOf(row).verdict ?? null) }));
  const edges = nodes.map((node) => ({
    parentNodeId: node.parentNodeId,
    childNodeId: node.nodeId,
    relation: node.role === 'kernel' ? 'coordinates' : 'dispatches',
  }));
  return { schema: AGENT_HIERARCHY_SCHEMA, workflow: root, nodes, edges };
};

/* ---------------------------------------------------------------- survey */
// Settled results whose law inputs changed since dispatch (input-digests.mjs).
// A finished workflow reports none; a projection error is surfaced beside an
// empty list rather than failing the poll.
const staleInputProjection = (db, wf) => {
  if (wf.phase === 'finished') return { staleInput: [] };
  try { return { staleInput: staleInputs(db, wf.workflow_id, { root: skillRoot }) }; }
  catch (e) { return { staleInput: [], staleInputError: String(e?.message ?? e) }; }
};
const staleLabel = (item) => `${item.jobId} (${item.op} a${item.attempt}${item.cut ? ` cut ${item.cut.id} ${item.cut.ordinal}/${item.cut.total}` : ''})`;
function cmdSurvey(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const g = latestGoal(db, workflowId), gj = goalJsonOf(g);
  const openJobs = db.prepare(
    `SELECT * FROM jobs WHERE workflow_id=? AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
  ).all(workflowId, ...FINAL_SETTLED)
    .map((r) => ({ job_id: r.job_id, op_id: r.op_id, kind: r.kind, status: r.status, attempt: r.attempt, generation: r.generation, worker_id: r.worker_id, payload: jobPayloadOf(r), created_at: r.created_at, updated_at: r.updated_at }));
  const inbox = db.prepare('SELECT * FROM inbox WHERE workflow_id=? ORDER BY inbox_id').all(workflowId)
    .map((r) => ({ ...r, payload: parseJson(r.payload_json), disposition: parseJson(r.disposition_json) }));
  const signals = db.prepare(
    `SELECT scope,key,holder_pid,token,value_json,at,expires_at FROM signals
     WHERE (scope=? OR key=? OR scope=?) AND (expires_at IS NULL OR expires_at>?) ORDER BY scope,key`
  ).all(workflowId, workflowId, PROVIDER_HEALTH_SCOPE, now).map((r) => ({ ...r, value: parseJson(r.value_json) }));
  const events = db.prepare('SELECT seq,event_id,generation,entity_type,entity_id,kind,payload_json,created_at FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 10')
    .all(workflowId).reverse().map((r) => ({ ...r, payload: parseJson(r.payload_json) }));
  const incidents = db.prepare("SELECT * FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId);
  const stale = staleInputProjection(db, wf);
  const out = {
    ok: true, workflowId,
    workflow: wf,
    goal: g ? {
      revision: g.revision, identity: g.goal_identity, markdown: g.markdown,
      opChain: gj.opChain ?? null, derivedPlan: gj.derivedPlan ?? null, json: gj,
    } : null,
    jobs: openJobs,
    inbox, signals, events,
    incidentsOpen: incidents,
    eventsHead: ledger.eventsHead(workflowId),
    ...stale,
    // --deliveries: what a handover package is assembled from - every settled
    // job's filed report and the earlier handover answers. A read projection,
    // so an op terminal may call it (modules/ops/ops/handover.review.yaml).
    ...(args.deliveries ? deliveriesOf(db, workflowId) : {}),
  };
  emit(out, [
    `workflow ${workflowId} — phase=${wf.phase ?? '-'} title=${wf.title ?? '-'}`,
    `goal rev ${g?.revision ?? '-'} (${g?.goal_identity ?? '-'}) chain: ${(gj.opChain?.legs ?? []).map((l) => l.op).join(' → ') || '(none stored)'}`,
    `open jobs: ${openJobs.length} (${openJobs.map((j) => `${j.job_id}:${j.status}`).join(', ') || 'none'})`,
    `inbox: ${inbox.length} rows (${inbox.filter((i) => i.status === 'pending').length} pending) | live signals: ${signals.length} | open incidents: ${incidents.length}`,
    `last events: ${events.map((e) => `${e.seq}:${e.kind}`).join(', ') || 'none'}`,
    ...staleOperationsOf(stale.staleInput).map((item) => `stale-input: ${staleLabel(item)} — ${item.paths.join(', ')}`),
    ...(out.deliveries ? [
      `deliveries: ${out.deliveries.length} settled job(s); credentialPending: ${out.credentialPending.join(', ') || 'none'}; handover asks: ${out.handoverHistory.length}`,
      ...out.deliveries.map((d) => `  ${d.jobId} ${d.op} a${d.attempt} ${d.status}${d.outcome ? ` outcome=${d.outcome}` : ''}${d.head ? ` head=${d.head}` : ''}${d.summary ? ` — ${d.summary}` : ''}`),
      ...out.handoverHistory.map((h) => `  handover ${h.dispatchId} a${h.attempt} ${h.state}${h.decision ? ` ${h.decision} by ${h.answeredBy ?? '-'}` : ''}${h.note ? ` — ${h.note}` : ''}`),
    ] : []),
  ].join('\n'), args.json);
}

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
const ACTIONABLE_FRONTIER_STATES = ['transition-ready', 'settle-ready', 'worker-dead', 'worker-question', 'worker-nudge-ready', 'worker-wedged', 'peer-message', 'handover-answered', 'finish-ready', 'ask-reserve', 'handover-due', 'orphaned-frontier', 'idle'];
/**
 * Why one queued job is not running, in the order the causes actually bite. `dependency` is the
 * plan gate the Kernel applies before it routes at all; the four after it are the admission checks
 * `api route` and `api dispatch` run, in their own order (workflow ceiling, provider circuit, path
 * fence, pool saturation); `ready` means nothing blocks it and the Kernel is the only thing left.
 */
// 'dependency-failed' is a dependency that can no longer succeed on its own: the
// seam or --after job it waits on settled failed (not an owner wait), so only
// the Kernel can move it - retry the blocker, re-point the dependant, or drop it.
const QUEUED_BECAUSE = ['owner-gate', 'peer-wait', 'dependency', 'dependency-failed', 'max-ops', 'circuit-open', 'path-lease', 'pool-full', 'ready'];
/**
 * Open owner-gate incidents of a workflow: a step only the owner can drive
 * (an assisted OAuth run, a consent screen) holds the jobs it names until the
 * Kernel resolves the incident. `api incident --kind owner-gate --holds` names
 * the held ops or jobs; without --holds the incident's --op is held. A job the
 * owner holds is not work the Kernel can do, so status never calls it ready
 * and the watchdog never wakes a Kernel for it.
 */
const OWNER_GATE_KINDS = ['owner-gate', 'owner-gate-pending'];
const openOwnerGates = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
  .map((row) => {
    const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
    if (!OWNER_GATE_KINDS.includes(kind)) return null;
    const raised = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const holds = parseJson(raised?.payload_json, {})?.holds;
    return { incidentId: row.incident_id, holds: Array.isArray(holds) && holds.length ? holds : [row.op_id].filter(Boolean) };
  })
  .filter(Boolean);
const ownerGateOf = (gates, job) => {
  const opId = job.op_id ?? jobPayloadOf(job).opId ?? null;
  return gates.find((gate) => gate.holds.includes(job.job_id) || (opId && gate.holds.includes(opId))) ?? null;
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
const PEER_WAIT = 'peer-wait';
const openPeerWaits = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress,updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
  .map((row) => {
    const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
    if (kind !== PEER_WAIT) return null;
    const raised = db.prepare("SELECT payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const payload = parseJson(raised?.payload_json, {}) ?? {};
    const peer = typeof payload.peer === 'string' ? payload.peer : null;
    const peerRow = peer ? getWorkflow(db, peer) : null;
    return {
      incidentId: row.incident_id, opId: row.op_id ?? null, peer,
      holds: Array.isArray(payload.holds) && payload.holds.length ? payload.holds : [row.op_id].filter(Boolean),
      detail: payload.detail ?? String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, ''),
      untilMessage: payload.untilMessage === true, refs: Array.isArray(payload.refs) ? payload.refs : [],
      since: raised?.created_at ?? row.updated_at,
      peerPhase: peerRow ? (peerRow.archived_at != null ? 'archived' : peerRow.phase ?? null) : 'unknown',
      peerRunning: Boolean(peerRow && peerRow.phase === 'running' && peerRow.archived_at == null),
    };
  })
  .filter(Boolean);
/**
 * The approved leg order for a workflow: the derived plan when one exists, else the approved
 * opChain. modules/schemas/goal-plan.yaml carries no dependsOn field — ordering IS the legs array,
 * so an op's dependency is every earlier leg, and an earlier leg with no succeeded job blocks it.
 */
const approvedLegOps = (goalJson) => {
  const legs = goalJson?.derivedPlan?.legs ?? goalJson?.opChain?.legs ?? null;
  if (!Array.isArray(legs)) return [];
  return [...new Set(legs.map((leg) => (typeof leg === 'string' ? leg : leg?.op)).filter(Boolean))];
};
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
function queuedBecauseOf(db, job, { legOps, jobsByOp, slots, rtDoc, runningByModel, ownerGates = [], peerWaits = [], recordDeps = new Map() }) {
  const payload = jobPayloadOf(job);
  const opId = job.op_id ?? payload.opId ?? null;

  const gate = ownerGateOf(ownerGates, job);
  if (gate) {
    return {
      queuedBecause: 'owner-gate',
      blockedBy: { incident: gate.incidentId },
      detail: `owner-gate incident ${gate.incidentId} holds it; the Kernel resolves it (api incident --resolve) once the owner's step lands`,
    };
  }
  const peerWait = ownerGateOf(peerWaits, job);
  if (peerWait) {
    return {
      queuedBecause: 'peer-wait',
      blockedBy: { incident: peerWait.incidentId, peer: peerWait.peer },
      detail: `peer-wait incident ${peerWait.incidentId} holds it until peer ${peerWait.peer} lands what it waits on (${peerWait.detail.slice(0, 160)}); a peer message from ${peerWait.peer} wakes the Kernel${peerWait.untilMessage ? ' and resolves the wait' : ', which resolves it (api incident --resolve) once the proof holds'}`,
    };
  }

  const index = opId ? legOps.indexOf(opId) : -1;
  if (index > 0) {
    // An earlier leg holds this job only while it has a job still in flight or
    // queued. A leg with no job, or whose jobs all settled, is not a wait: the
    // plan either never enqueued it (intake legs) or already moved past it.
    const blocking = legOps.slice(0, index)
      .map((earlier) => ({ earlier, pending: (jobsByOp.get(earlier) ?? []).filter((row) => row.job_id !== job.job_id && !FINAL_SETTLED.includes(row.status)) }))
      .find(({ pending }) => pending.length > 0);
    if (blocking) {
      return {
        queuedBecause: 'dependency',
        blockedBy: { op: blocking.earlier, job: blocking.pending[blocking.pending.length - 1].job_id },
        detail: `approved leg ${blocking.earlier} still has job ${blocking.pending[blocking.pending.length - 1].job_id} ${blocking.pending[blocking.pending.length - 1].status}; it precedes ${opId} in the approved order`,
      };
    }
  }

  // A declared --after job, or the seam (ordinal 1) of this job's cut, that
  // has not settled succeeded holds it like an earlier leg does. The seam is
  // its live head: a dropped, never-dispatched seam retry is skipped.
  const heldByJob = (priorId) => {
    const prior = db.prepare('SELECT job_id,op_id,status FROM jobs WHERE job_id=?').get(priorId);
    return prior && prior.status !== 'succeeded' ? prior : null;
  };
  const seam = payload.cut && Number(payload.cut.ordinal) > 1
    ? cutSeamHeadOf(db, { workflowId: job.workflow_id ?? payload.hierarchy?.workflowId, op: opId, cutId: payload.cut.id })?.job_id ?? null
    : null;
  for (const priorId of [...(Array.isArray(payload.after) ? payload.after : []), ...(seam ? [seam] : []), ...(recordDeps.get(job.job_id) ?? [])]) {
    const prior = heldByJob(priorId);
    if (prior) {
      // A StarCi Next and a MiaMia workspace.manage sat queued behind a seam
      // and an --after job that had settled failed; the frontier read engaged,
      // the watchdog never woke the Kernel, and both workflows stalled.
      const dead = FINAL_SETTLED.includes(prior.status) && !isAwaitingOwner(db, db.prepare('SELECT * FROM jobs WHERE job_id=?').get(prior.job_id));
      return {
        queuedBecause: dead ? 'dependency-failed' : 'dependency',
        blockedBy: { op: prior.op_id, job: prior.job_id },
        detail: (priorId === seam
          ? `cut ${payload.cut.id} seam ${prior.job_id} is ${prior.status}; the other ordinals wait for it`
          : (recordDeps.get(job.job_id) ?? []).includes(priorId)
            ? `a Work record this job owns dependsOn a record owned by ${prior.job_id}, which is ${prior.status}`
            : `declared --after job ${prior.job_id} is ${prior.status}`)
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
        detail: `provider ${health.provider} circuit open (${health.failureKind ?? 'auth'}) until ${health.expiresAt ?? 'explicit recovery'}; the Kernel clears it early with ${providerRecoverCommand(health.provider)}`,
      };
    }
  }

  // Lease-row existence is the fence, expiry only a recovery signal
  // (engine/admission.mjs findOwnedPathLeaseConflicts) — an expired row still
  // answers "why is this queued", because the prior attempt's effect may exist.
  // A projection never throws on a malformed stored path: dispatch admission is
  // where that row is refused, and status must still answer for its siblings.
  let conflict = null;
  try { conflict = findOwnedPathLeaseConflicts(db, opLeaseRequests(payload), { excludeJobId: job.job_id })[0] ?? null; }
  catch { conflict = null; }
  if (conflict) {
    return {
      queuedBecause: 'path-lease',
      blockedBy: { path: conflict.held, job: conflict.job_id },
      detail: `${conflict.held} is held by ${conflict.job_id} and overlaps ${conflict.requested}`,
    };
  }

  // A routed-but-queued job already counts toward its pool (the same count
  // `api route` reasons with), so this job is in that tally: what bounds it is
  // the OTHER holders of the lane.
  const maxParallel = Number(card?.maxParallel);
  const otherHolders = Math.max(0, (runningByModel[target] ?? 0) - 1);
  if (target && Number.isInteger(maxParallel) && maxParallel > 0 && otherHolders >= maxParallel) {
    return {
      queuedBecause: 'pool-full',
      blockedBy: { pool: target, running: otherHolders, maxParallel },
      detail: `pool ${target} holds ${otherHolders} of ${maxParallel} slots`,
    };
  }

  return { queuedBecause: 'ready', blockedBy: null, detail: null };
}
function cmdStatus(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const byStatus = {};
  for (const r of db.prepare('SELECT status,count(*) n FROM jobs WHERE workflow_id=? GROUP BY status ORDER BY status').all(workflowId)) byStatus[r.status] = r.n;
  const leases = db.prepare('SELECT resource_key,job_id,expires_at FROM leases WHERE workflow_id=? AND expires_at>? ORDER BY resource_key').all(workflowId, now);
  const inboxPending = db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(workflowId).n;
  // Filed op reports — the kernel's exact "is it done and with what result"
  // signal. dispatch_id binds the worker handle (falling back to the job id),
  // so each row joins back to its job either way.
  const reports = db.prepare(
    `SELECT r.dispatch_id, r.op_id, r.attempt, r.outcome, r.consumed_at, r.created_at,
            COALESCE(jw.job_id, jj.job_id, jp.job_id) AS job_id
     FROM reports r
     LEFT JOIN jobs jw ON jw.workflow_id=r.workflow_id AND jw.worker_id=r.dispatch_id
     LEFT JOIN jobs jj ON jj.workflow_id=r.workflow_id AND jj.job_id=r.dispatch_id
     LEFT JOIN jobs jp ON jp.workflow_id=r.workflow_id AND (
       json_extract(jp.payload_json,'$.orca.dispatchId')=r.dispatch_id OR
       json_extract(jp.payload_json,'$.managed.dispatchId')=r.dispatch_id OR
       json_extract(jp.payload_json,'$.hierarchy.runtime.dispatchId')=r.dispatch_id)
     WHERE r.workflow_id=? ORDER BY r.created_at`
  ).all(workflowId);
  // Report age alone is not worker liveness. Project the exact operation
  // terminal's host state and output freshness so the Kernel never labels a
  // live, thinking worker as wedged or attempts a duplicate same-job spawn.
  const workers = db.prepare(`SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
    .all(workflowId, ...FINAL_SETTLED)
    .filter((job) => job.status === 'running' || operationTerminalHandleOf(job))
    .map((job) => observeOperationWorker(job, now, db));
  const openOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`).get(workflowId, ...FINAL_SETTLED).n;
  // Operations the Kernel can move right now with no wait at all: a queued job
  // to route/dispatch, a fenced launch to reconcile. An 'engaged' frontier that
  // holds one of these is not a reason to yield.
  const fencedOperations = db.prepare(`SELECT count(*) n FROM jobs WHERE workflow_id=? AND kind<>'kernel'
      AND status='effect_unknown'`).get(workflowId).n;
  // Why each queued job is not running. A queued row is the dispatch candidate;
  // without this the Kernel can only see that it did not move, not what to
  // clear. The causes and their order are QUEUED_BECAUSE above.
  const workflowJobs = db.prepare("SELECT job_id,op_id,status,attempt,payload_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId);
  const jobsByOp = new Map();
  for (const row of workflowJobs) {
    if (!row.op_id) continue;
    if (!jobsByOp.has(row.op_id)) jobsByOp.set(row.op_id, []);
    jobsByOp.get(row.op_id).push(row);
  }
  const legOps = approvedLegOps(goalJsonOf(latestGoal(db, workflowId)));
  const slots = opSlotAdmission(db, workflowId);
  const rtDoc = runtimesDoc();
  // A persisted payload.model marks a committed lane fleet-wide — the same
  // count `api route` reasons with, so status and route agree on pool load.
  const runningByModel = {};
  for (const row of db.prepare(`SELECT payload_json FROM jobs WHERE status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`).all(...FINAL_SETTLED)) {
    const model = parseJson(row.payload_json, {})?.model;
    if (model) runningByModel[model] = (runningByModel[model] ?? 0) + 1;
  }
  const ownerGates = openOwnerGates(db, workflowId);
  const peerWaits = openPeerWaits(db, workflowId);
  const recordDeps = recordDependencies(path.resolve(args.repo ?? process.cwd()), workflowJobs);
  const queued = workflowJobs.filter((row) => row.status === 'queued').map((row) => ({
    jobId: row.job_id, opId: row.op_id ?? null, attempt: row.attempt,
    ...queuedBecauseOf(db, row, { legOps, jobsByOp, slots, rtDoc, runningByModel, ownerGates, peerWaits, recordDeps }),
  }));
  // Queued jobs a peer-wait holds are the peer's to unblock: when they are all that is open, the
  // frontier is peer-wait rather than engaged. A wait whose peer is no longer running can never be
  // met by it, so it is the Kernel's move again.
  const peerHeld = queued.filter((item) => item.queuedBecause === PEER_WAIT).length;
  const deadPeerWaits = wf.phase === 'finished' ? [] : peerWaits.filter((wait) => !wait.peerRunning);
  // Ready means the Kernel can move it now: a queued job nothing holds, or a
  // fenced launch to reconcile. A queued job waiting on a leg, a slot or a
  // circuit is not work the Kernel can do this turn.
  const readyOperations = fencedOperations + queued.filter((item) => ['ready', 'dependency-failed'].includes(item.queuedBecause)).length;
  const queuedCauses = Object.fromEntries(QUEUED_BECAUSE
    .map((cause) => [cause, queued.filter((item) => item.queuedBecause === cause).length])
    .filter(([, n]) => n > 0));

  // Settled asks are waits on the owner, projected apart from failures. Only an
  // op's latest attempt still waits: an older one was already re-enqueued.
  const failedRows = db.prepare("SELECT job_id,workflow_id,op_id,status,attempt,result_json FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status='failed' ORDER BY created_at,job_id").all(workflowId);
  const ownerWaits = failedRows.filter((row) => isAwaitingOwner(db, row));
  const askAnswers = new Map();
  // The last lifecycle event wins; an ask parked again (served, or notified
  // for on-demand serving) after a supersede is pending again until answered.
  for (const event of db.prepare("SELECT kind,payload_json FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded','ask-serving','ask-notified') ORDER BY seq").all(workflowId)) {
    const dispatchId = parseJson(event.payload_json, {})?.dispatchId;
    if (!dispatchId) continue;
    if (event.kind === 'ask-serving' || event.kind === 'ask-notified') { if (askAnswers.get(dispatchId) === 'superseded') askAnswers.delete(dispatchId); continue; }
    askAnswers.set(dispatchId, event.kind === 'ask-answered' ? 'answered' : 'superseded');
  }
  const latestAttempt = new Map();
  for (const row of workflowJobs) if (row.op_id) latestAttempt.set(row.op_id, Math.max(latestAttempt.get(row.op_id) ?? 0, row.attempt));
  // One op may hold several owner waits at once - three provision.ask jobs,
  // one per subject, or one ask per cut slice. A wait is replaced only by a
  // later job of the same op with the same lineage (params.subject, else the
  // cut id and ordinal); without either the op's latest attempt waits.
  const subjectOfJob = (jobId) => {
    const payload = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json, {}) ?? {};
    const subject = payload.params?.subject;
    if (typeof subject === 'string' && subject.trim()) return `subject:${subject.trim()}`;
    if (payload.cut?.id != null && payload.cut?.ordinal != null) return `cut:${payload.cut.id}#${payload.cut.ordinal}`;
    return null;
  };
  const stillWaits = (row) => {
    const subject = subjectOfJob(row.job_id);
    if (!subject) return latestAttempt.get(row.op_id) === row.attempt;
    return !workflowJobs.some((other) => other.op_id === row.op_id && other.attempt > row.attempt && subjectOfJob(other.job_id) === subject);
  };
  const askDispatchOf = (row) => jobResultOf(row).askDispatchId
    ?? db.prepare("SELECT dispatch_id FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? AND outcome='ask' ORDER BY created_at DESC LIMIT 1").get(workflowId, row.op_id, row.attempt)?.dispatch_id
    ?? null;
  // An ask nobody answered or retired still waits on the owner whatever its
  // lineage: a later job of the same op without a shared subject or cut is not
  // its replacement.
  const pendingAsk = (row) => { const d = askDispatchOf(row); return Boolean(d) && !askAnswers.has(d); };
  const awaitingOwner = ownerWaits.filter((row) => stillWaits(row) || pendingAsk(row)).map((row) => {
    const dispatchId = askDispatchOf(row);
    return { jobId: row.job_id, opId: row.op_id, attempt: row.attempt, dispatchId, answer: (dispatchId && askAnswers.get(dispatchId)) ?? 'pending' };
  });
  const pendingOwner = awaitingOwner.filter((item) => item.answer === 'pending');
  // A pending ask is only answerable while its serve-ask form is up. The form
  // expires (ask-serving-expired, --ttl) and then the owner's link is dead
  // while the Kernel waits on them: a Modules tax ask sat unanswerable that
  // way. Such an ask is the Kernel's to re-serve, so it is actionable.
  const lastLifecycle = (dispatchId, kind) => db.prepare("SELECT seq FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, kind, dispatchId)?.seq ?? null;
  // A form that died without expiring is dead too: a nivo Modules Kernel
  // served its scope ask as its own Claude Code background shell, Claude Code
  // reaped it under memory pressure, and status kept calling the ask served,
  // so nothing woke the Kernel while the owner's link returned nothing.
  const formLive = (dispatchId) => {
    const served = lastLifecycle(dispatchId, 'ask-serving');
    const expired = lastLifecycle(dispatchId, 'ask-serving-expired');
    if (served == null || (expired != null && expired > served)) return false;
    const payload = parseJson(db.prepare('SELECT payload_json FROM events WHERE seq=?').get(served)?.payload_json, {}) ?? {};
    return askFormAlive(payload) !== false;
  };
  // Owner, 2026-09-24: a form is served only when the owner asks for it. An
  // ask parkAsk told the owner about on Telegram (ask-notified) waits on the
  // owner with no form at all - its link is generated from the chat's button
  // (and regenerated after the form expires or dies) - so it is healthy
  // (askOnDemandDispatches), never the Kernel's to re-serve.
  const askOnDemand = [], askReserve = [];
  for (const item of pendingOwner) {
    if (!item.dispatchId || formLive(item.dispatchId)) continue;
    (lastLifecycle(item.dispatchId, 'ask-notified') != null ? askOnDemand : askReserve).push(item.dispatchId);
  }
  const failures = { failed: failedRows.length - ownerWaits.length, awaitingOwner: ownerWaits.length };

  const unconsumedReports = reports.filter((report) => !report.consumed_at).length;
  // A consumed report whose job is still open is a verdict the Kernel owes:
  // it read the report and yielded before check/settle (a WSPV kernel sat
  // idle on one, and nothing woke it because the frontier read engaged).
  const settleReady = reports.filter((report) => report.consumed_at && report.job_id).filter((report) => {
    const row = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(report.job_id);
    return row && ['running', 'answering'].includes(row.status);
  }).map((report) => report.job_id);
  const nudgeReadyWorkers = workers.filter((worker) => ['turn-idle', 'live-idle', 'staged-input'].includes(worker.liveness)
    && !reports.some((report) => report.job_id === worker.jobId));
  // A worker whose turn has run past WEDGE_MINUTES on one shell command that
  // still shows no output (terminal-liveness.mjs) is stuck, not busy.
  const wedgedWorkers = workers.filter((worker) => worker.liveness === 'wedged');
  // A running job whose exact terminal is proven gone (disconnected, or a
  // handle a live Orca no longer knows - every terminal after a host reboot)
  // has no worker left to file its report. Without this it read 'engaged' and
  // nothing ever woke the Kernel. A filed report takes the transition/settle
  // states above instead; api reconcile --dead-worker recovers the rest.
  const deadWorkers = workers.filter((worker) => DEAD_WORKER_LIVENESS.includes(worker.liveness)
    && ['running', 'answering'].includes(worker.ledgerStatus)
    && !reports.some((report) => report.job_id === worker.jobId));
  // A worker that asked its coordinator through `orca orchestration ask` waits
  // on the Kernel until `api reply` answers (inc-b944cbaef24b). The host inbox
  // is read only when a live operation terminal exists - the same condition
  // under which the worker projection above already reads the host.
  const workerAsks = workers.some((worker) => worker.terminalHandle)
    ? workerQuestionsOf(db, workflowId)
    : { pending: db.prepare("SELECT key,payload_json FROM inbox WHERE workflow_id=? AND kind=? AND status='pending'").all(workflowId, WORKER_QUESTION)
      .map((row) => ({ ...(parseJson(row.payload_json, {}) ?? {}), messageId: row.key, bridged: true, state: 'pending' }))
      .filter((item) => item.jobId && workers.some((worker) => worker.jobId === item.jobId)), error: null };
  const workerQuestions = workerAsks.pending.map(({ messageId, jobId, opId, attempt, question, options, askedAt, bridged }) => ({ messageId, jobId, opId, attempt, question, options, askedAt, bridged }));
  // A peer workflow's pending message (api notify, or the enqueue overlap
  // heads-up) waits on this Kernel until it reads api inbox and acks it. It
  // ranks below the reports, settles and blocked workers already in flight.
  const peerMessages = wf.phase === 'finished' ? []
    : pendingPeerMessagesOf(db, workflowId).map(({ key, from, kind, subject, at }) => ({ key, from, kind, subject, at }));
  // The owner handover (scripts/kernel/handover.mjs): an answered handover ask
  // is the Kernel's move, a current owner approval makes finish the next move,
  // and a chain whose every leg settled owes the handover leg.
  const handover = handoverProjection(db, workflowId, { legOps });
  const frontierState = wf.phase === 'finished' ? 'finished'
    : unconsumedReports > 0 ? 'transition-ready'
    : settleReady.length > 0 ? 'settle-ready'
    : deadWorkers.length > 0 ? 'worker-dead'
    : workerQuestions.length > 0 ? 'worker-question'
    : nudgeReadyWorkers.length > 0 ? 'worker-nudge-ready'
    : wedgedWorkers.length > 0 ? 'worker-wedged'
    : peerMessages.length > 0 ? 'peer-message'
    : openOperations > peerHeld ? 'engaged'
    : wf.phase === 'running' && handover.state === 'answered' ? 'handover-answered'
    : wf.phase === 'running' && handover.state === 'approved' ? 'finish-ready'
    // Nothing open, but a question is with the owner: the workflow waits on
    // them, not on the Kernel, so nothing should wake it until the answer.
    : wf.phase === 'running' && askReserve.length > 0 ? 'ask-reserve'
    // An open owner-gate incident waits on the owner too, even with no job to
    // hold yet (a leg whose first job cannot be enqueued before the owner
    // decides - a StarCi Next frontend waiting on brand, inc-103f2028ba77).
    : wf.phase === 'running' && (pendingOwner.length > 0 || ownerGates.length > 0) ? 'awaiting-owner'
    // A typed wait on a peer workflow (api incident --kind peer-wait): the next approved step cannot
    // pass its preflight until the peer lands something, so the peer's message, not the watchdog,
    // wakes the Kernel. Never orphaned-frontier: that re-woke the Kernel for nothing (inc-0aebf976e625).
    : wf.phase === 'running' && peerWaits.length > 0 ? 'peer-wait'
    : wf.phase === 'running' && handover.due ? 'handover-due'
    : wf.phase === 'running' ? 'orphaned-frontier'
    : 'idle';
  // A settled result whose law inputs changed is work the Kernel owes now: it
  // is re-dispatched as a new attempt (driver-loop.yaml enqueue.cutExecution).
  const stale = staleInputProjection(db, wf);
  const staleOperations = staleOperationsOf(stale.staleInput);
  const staleReady = staleOperations.filter((item) => !item.heldBy);
  const actionable = ACTIONABLE_FRONTIER_STATES.includes(frontierState) || readyOperations > 0 || staleReady.length > 0 || askReserve.length > 0 || peerMessages.length > 0 || deadPeerWaits.length > 0;
  const frontier = {
    state: frontierState,
    actionable,
    openOperations,
    readyOperations,
    staleOperations,
    unconsumedReports,
    nudgeReadyJobs: nudgeReadyWorkers.map((worker) => worker.jobId),
    workerQuestionJobs: [...new Set(workerQuestions.map((item) => item.jobId))],
    wedgedJobs: wedgedWorkers.map((worker) => worker.jobId),
    deadWorkerJobs: deadWorkers.map((worker) => worker.jobId),
    settleReadyJobs: settleReady,
    askReserveDispatches: askReserve,
    askOnDemandDispatches: askOnDemand,
    peerMessageKeys: peerMessages.map((message) => message.key),
    peerWaits: peerWaits.map(({ incidentId, peer, peerPhase, holds, detail, untilMessage, refs, since }) => ({ incidentId, peer, peerPhase, holds, detail, untilMessage, refs, since })),
    peerWaitsDead: deadPeerWaits.map((wait) => wait.incidentId),
    queued,
    queuedCauses,
    reason: frontierState === 'ask-reserve' || (askReserve.length > 0 && !['transition-ready', 'settle-ready', 'worker-dead', 'worker-nudge-ready', 'worker-wedged', 'peer-message', 'handover-answered', 'finish-ready'].includes(frontierState))
      ? `unanswered ask(s) ${askReserve.join(', ')} never reached the owner (not notified on Telegram, and no live form: never served, or the serve-ask ttl expired); park each with api serve-ask --workflow <id> --dispatch <id> before yielding`
      : frontierState === 'worker-question'
      ? `${workerQuestions.map((item) => `${item.jobId} (${item.messageId})`).join(', ')} asked the coordinator through orca orchestration ask and wait for the answer; run api questions, then api reply --message <id> --body <answer> for a technical answer inside the job's authority, or --to-owner when it needs the owner (the worker then files outcome ask and serve-ask carries it)`
      : frontierState === 'settle-ready'
      ? `${settleReady.join(', ')} filed a report you consumed but never settled; run api check and api settle for each before yielding`
      : frontierState === 'worker-dead'
      ? `${deadWorkers.map((worker) => `${worker.jobId} (${worker.liveness})`).join(', ')} still read running but the exact worker terminal is gone and no report is filed; run api reconcile --job <id> --dead-worker for each: a provably no-effect attempt returns to queued at the same attempt (route/dispatch it again), any effect evidence fences it effect_unknown for you to inspect and settle`
      : frontierState === 'worker-wedged'
      ? `${wedgedWorkers.map((worker) => worker.jobId).join(', ')} sat past the wedge threshold on one shell command with no output; api observe once, then api nudge it to interrupt that command, or reconcile and re-dispatch the attempt`
      : frontierState === 'peer-message'
      ? `${peerMessages.length} peer message(s) wait on you (${peerMessages.map((message) => `${message.key} ${message.kind} from ${message.from}`).join(', ')}); read api inbox --workflow <id>, act on each (a request in your scope becomes work, a heads-up adjusts your plan, answer with api notify --kind reply --reply-to <key>), then ack each with api inbox --ack <key> --disposition <what you did> before yielding`
      : ['handover-answered', 'finish-ready', 'handover-due'].includes(frontierState)
      ? handoverReason(handover, workflowId)
      : frontierState === 'awaiting-owner'
      ? `no operation is open and the owner holds ${[pendingOwner.length ? `${pendingOwner.length} unanswered ask(s) (${pendingOwner.map((item) => item.dispatchId).join(', ')})` : null, ownerGates.length ? `owner-gate incident(s) ${ownerGates.map((gate) => gate.incidentId).join(', ')}` : null].filter(Boolean).join(' and ')}${askOnDemand.length ? `; ${askOnDemand.join(', ')} ${askOnDemand.length === 1 ? 'is' : 'are'} on Telegram with a Generate URL button (the form is served when the owner presses it; nothing to re-serve)` : ''}; the answer or api incident --resolve wakes the Kernel`
      : frontierState === 'peer-wait' || deadPeerWaits.length > 0
      ? (deadPeerWaits.length
        ? `peer-wait ${deadPeerWaits.map((wait) => `${wait.incidentId} on ${wait.peer} (${wait.peerPhase})`).join(', ')} can no longer be met: the peer is not running; re-check the prerequisite yourself, then resolve the wait (api incident --resolve) and continue, or raise what is still missing`
        : `no operation the Kernel can move: ${peerWaits.map((wait) => `peer-wait ${wait.incidentId} waits on ${wait.peer}${wait.holds.length ? ` (holds ${wait.holds.join(', ')})` : ''}: ${wait.detail.slice(0, 160)}`).join('; ')}; a peer message from the awaited peer (api notify) wakes the Kernel${peerWaits.every((wait) => wait.untilMessage) ? ' and resolves the wait' : '; resolve the wait (api incident --resolve) once its proof holds'}`)
      : frontierState === 'orphaned-frontier'
      ? 'workflow is running but has no open operation and no unconsumed report; Kernel must derive/repair the next approved transition or finish; a next step that waits on a peer workflow is recorded as api incident --kind peer-wait --peer <workflowId>, never left orphaned'
      : frontierState === 'worker-nudge-ready'
        ? 'one or more exact running workers are at an idle provider prompt, or hold an unsubmitted paste in their input row, without a report; Kernel must call api nudge for each listed job now (a staged paste gets one Enter)'
      : actionable && readyOperations > 0
        ? 'queued or fenced operations are waiting on the Kernel; route/dispatch or reconcile them before yielding'
      : staleReady.length > 0
        ? `settled ${staleReady.map(staleLabel).join(', ')} read inputs that changed since dispatch; re-dispatch each as a new attempt of the same op and cut ordinal (a cut seam-first) before yielding`
      : null,
  };
  // Open cut sets and which ordinal's pass closes each: that pass is the one
  // `api settle` holds to full-regression-final, so the Kernel runs the whole-set
  // integration gate before it (inc-751dd1ac4492). A set with one open ordinal
  // names it; ordinals settle out of order, so it need not be the highest.
  const cutSets = [];
  for (const row of workflowJobs) {
    const cut = jobPayloadOf(row).cut;
    if (!cut?.id || !row.op_id || cutSets.some((set) => set.op === row.op_id && set.id === String(cut.id))) continue;
    const set = cutSetStateOf(db, { workflowId, op: row.op_id, cut });
    if (!set.open.length) continue;
    cutSets.push({ op: row.op_id, id: set.id, total: set.total, passed: set.passed, open: set.open, jobs: set.jobs,
      ...(set.open.length === 1 ? { closingOrdinal: set.open[0], closingJob: set.jobs[set.open[0]]?.jobId ?? null, closingCheck: CUT_SET_CLOSING_CHECK } : {}) });
  }
  const out = { ok: true, workflowId, phase: wf.phase ?? null, frontier, jobs: byStatus, failures, awaitingOwner, activeLeases: leases, inboxPending, reports, workers, workerQuestions, peerMessages, ...(workerAsks.error ? { workerQuestionsError: workerAsks.error } : {}), cutSets, handover, ...stale };
  emit(out,
    [
      `${workflowId} phase=${out.phase ?? '-'} frontier=${frontierState}${actionable ? ' ACTIONABLE' : ' (no actionable work)'} jobs{${Object.entries(byStatus).map(([s, n]) => `${s}:${n}`).join(',') || '-'}} failures{failed:${failures.failed},awaiting-owner:${failures.awaitingOwner}} leases=${leases.length} inbox-pending=${inboxPending} reports=${reports.length}(${unconsumedReports} unconsumed) workers=${workers.map((w) => `${w.jobId}:${w.liveness}`).join(',') || '-'}`,
      ...awaitingOwner.map((item) => `  ${item.jobId} (${item.opId} a${item.attempt}) awaiting-owner — ask ${item.dispatchId ?? '-'} ${item.answer}`),
      `  handover: ${handover.state}${handover.ask ? ` ask ${handover.ask.dispatchId} ${handover.ask.state}${handover.ask.decision ? ` ${handover.ask.decision} by ${handover.ask.answeredBy ?? '-'}` : ''}` : ''}${handover.finishAllowed ? ' — finish allowed' : ' — finish refused until the owner approves'}`,
      ...(frontier.reason ? [`  reason: ${frontier.reason}`] : []),
      ...workerQuestions.map((item) => `  worker-question: ${item.messageId} ${item.jobId} (${item.opId} a${item.attempt}): ${item.question}${item.options?.length ? ` [${item.options.join(' | ')}]` : ''}`),
      ...peerMessages.map((message) => `  peer-message: ${message.key} from ${message.from} [${message.kind}] ${message.subject}`),
      ...peerWaits.map((wait) => `  peer-wait: ${wait.incidentId} on ${wait.peer} (${wait.peerPhase})${wait.holds.length ? ` holds ${wait.holds.join(', ')}` : ''}${wait.untilMessage ? ' until-message' : ''} — ${wait.detail.slice(0, 160)}`),
      ...askReserve.map((dispatchId) => `  ask-reserve: ${dispatchId} never reached the owner; park it: api serve-ask --repo <repo> --workflow ${workflowId} --dispatch ${dispatchId}`),
      ...askOnDemand.map((dispatchId) => `  ask-on-demand: ${dispatchId} is on Telegram; the owner generates its link (no form until then)`),
      ...(queued.length ? [`queued{${Object.entries(queuedCauses).map(([cause, n]) => `${cause}:${n}`).join(',')}}`] : []),
      ...queued.map((item) => `  ${item.jobId} (${item.opId ?? '-'}) ${item.queuedBecause}${item.detail ? ` — ${item.detail}` : ''}`),
      ...staleOperations.map((item) => `  stale-input: ${staleLabel(item)} — ${item.paths.join(', ')}${item.heldBy ? ` (waits on seam ${item.heldBy})` : ''}`),
      ...cutSets.map((set) => `  cut-set: ${set.op} ${set.id} passed ${set.passed.length}/${set.total}, open ${set.open.join(',')}${set.closingOrdinal ? ` — the pass of ordinal ${set.closingOrdinal}${set.closingJob ? ` (${set.closingJob})` : ''} closes it and records ${set.closingCheck}` : ''}`),
    ].join('\n'),
    args.json);
}

/* ------------------------------------------------------------- hierarchy */
function cmdHierarchy(ledger, args) {
  const out = { ok: true, ...agentHierarchyOf(ledger.db, args.workflow) };
  emit(out, [
    `${out.workflow.nodeId} (${out.workflow.status ?? '-'})`,
    ...out.nodes.map((node) => `  ${node.parentNodeId} -> ${node.nodeId} [${node.status}${node.verdict === AWAITING_OWNER ? ` ${AWAITING_OWNER}` : ''}]${node.runtime.model ? ` ${node.runtime.agent ?? '-'} / ${node.runtime.model}` : ''}`),
  ].join('\n'), args.json);
}

/* ------------------------------------------------------------------ plan */
function cmdPlan(ledger, args) {
  const db = ledger.db, workflowId = args.workflow;
  const now = Date.now();
  const file = path.resolve(args.file);
  if (!fs.existsSync(file)) throw Object.assign(new Error(`plan file missing: ${file}`), { code: 'plan-file-missing' });
  const plan = parseJson(fs.readFileSync(file, 'utf8'));
  if (!plan || !Array.isArray(plan.legs) || plan.legs.some((l) => !l || typeof l.op !== 'string' || !l.op)) {
    throw Object.assign(new Error(`invalid plan file ${file} — expected {legs:[{op,paths?,notes?}]}`), { code: 'plan-file-invalid' });
  }
  const legs = plan.legs.map((l) => ({ op: l.op, ...(l.paths ? { paths: l.paths } : {}), ...(l.notes ? { notes: l.notes } : {}) }));
  const planOps = legs.map((l) => l.op);

  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const g = latestGoal(db, workflowId);
  const storedLegs = goalJsonOf(g)?.opChain?.legs ?? null;
  const storedOps = storedLegs ? storedLegs.map((l) => l?.op ?? l).filter(Boolean) : null;
  // A chain approved before the owner handover existed lacks its final leg.
  // Appending handover.review as the LAST leg is the one addition the Kernel
  // makes without the owner (api finish requires it), so it is no divergence.
  const handoverAppended = Boolean(storedOps) && !storedOps.includes(HANDOVER_OP) && planOps.at(-1) === HANDOVER_OP
    && planOps.indexOf(HANDOVER_OP) === planOps.length - 1;
  const comparedOps = handoverAppended ? planOps.slice(0, -1) : planOps;
  // Structural diff only: which stored legs the plan dropped, which plan ops
  // were never in the approved chain, whether shared ops changed order.
  const divergence = {
    storedOps: storedOps ?? null,
    planOps,
    missing: storedOps ? storedOps.filter((o) => !planOps.includes(o)) : [],
    extra: storedOps ? comparedOps.filter((o) => !storedOps.includes(o)) : [...planOps],
    reordered: storedOps
      ? JSON.stringify(storedOps.filter((o) => comparedOps.includes(o))) !== JSON.stringify(comparedOps.filter((o) => storedOps.includes(o)))
      : false,
    noStoredChain: storedOps === null,
    ...(handoverAppended ? { handoverAppended: true } : {}),
  };
  divergence.diverged = divergence.missing.length > 0 || divergence.extra.length > 0 || divergence.reordered;

  const lineage = {
    replannedFrom: args['replanned-from'] ?? null,
    blocker: args.blocker ?? null,
    pathDelta: args['path-delta'] ?? null,
    routingReason: args['routing-reason'] ?? null,
  };
  let inboxApplied = 0;

  ledger.transaction(() => {
    if (g) {
      const gj = goalJsonOf(g);
      gj.derivedPlan = { legs, divergence, lineage, derivedAt: now };
      db.prepare('UPDATE goals SET json=? WHERE goal_seq=?').run(JSON.stringify(gj), g.goal_seq);
      inboxApplied = db.prepare("UPDATE inbox SET status='applied', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind='goal-revision' AND status='pending' AND key=?")
        .run(JSON.stringify({ action: 'plan-derived', revision: g.revision, lineage }), now, workflowId, `${workflowId}:${g.revision}`).changes;
    }
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'plan-derived', payload: { goal_revision: g?.revision ?? null, legs, divergence, lineage, inboxApplied, file },
    });
  });

  const out = { ok: true, workflowId, goalRevision: g?.revision ?? null, divergence, lineage, inboxApplied, legs };
  emit(out,
    `plan-derived for ${workflowId}: ${legs.length} legs — diverged=${divergence.diverged}` +
    (divergence.missing.length ? ` missing=[${divergence.missing.join(',')}]` : '') +
    (divergence.extra.length ? ` extra=[${divergence.extra.join(',')}]` : '') +
    (divergence.reordered ? ' reordered' : '') +
    (divergence.noStoredChain ? ' (no stored opChain to diff)' : ''),
    args.json);
}

/* -------------------------------------------------------------- estimate */
// The plural `from:` keys of allocation.slicing.size.<class> against the
// singular count names the weights use. One map, both directions.
const SIZE_MEASURE_KEYS = { files: 'file', assertions: 'assertion', components: 'component', records: 'record' };
// Size classes that never fan out, whatever the gear: the owner's table
// applies to the declared classes only (runtimes.yaml allocation.slicing.size).
const SINGLE_AGENT_SIZES = ['s', 'm'];
// Deterministic same-op sizing. The kernel measures the write scope and passes
// the counts; the weights, the class bounds, the gear vocabulary and the
// agents-per-gear table all live in runtimes.yaml allocation.slicing, so the
// estimate is a declared computation and never a model's guess.
// W = sum(weight * count) agent-minutes places the closure in a size class; the
// class plus the owner's config.yaml parallel.gear names agentsRequested, and
// the closure's disjoint path partition bounds agentsAchievable.
function cmdEstimate(ledger, args) {
  const slicing = allocationSettings().slicing ?? {};
  const weights = slicing.weights ?? {};
  const target = Array.isArray(slicing.targetMinutes) ? slicing.targetMinutes.map(Number) : [];
  const maxSlices = Number(slicing.maxSlices);
  const sizes = slicing.size;
  if (target.length !== 2 || target.some((n) => !Number.isFinite(n) || n <= 0)
    || !Number.isFinite(maxSlices) || maxSlices < 1
    || !sizes || typeof sizes !== 'object' || Array.isArray(sizes) || !Object.keys(sizes).length) {
    throw Object.assign(
      new Error('modules/models/runtimes.yaml allocation.slicing must declare {weights, targetMinutes:[lo,hi], maxSlices, gears, size}'),
      { code: 'slicing-undeclared' });
  }
  const gears = slicingGears();
  const counts = {
    file: Math.max(0, Number(args.files) || 0),
    assertion: Math.max(0, Number(args.assertions) || 0),
    component: Math.max(0, Number(args.components) || 0),
    record: Math.max(0, Number(args.records) || 0),
  };
  if (!Object.values(counts).some((n) => n > 0)) {
    throw Object.assign(
      new Error('estimate needs at least one of --files/--assertions/--components/--records'),
      { code: 'estimate-no-measure' });
  }
  const unweighted = Object.entries(counts).filter(([k, n]) => n > 0 && !Number.isFinite(Number(weights[k])));
  if (unweighted.length) {
    throw Object.assign(
      new Error(`modules/models/runtimes.yaml allocation.slicing.weights declares no weight for ${unweighted.map(([k]) => k).join(', ')}`),
      { code: 'slicing-undeclared' });
  }
  const minutes = Object.entries(counts).reduce((sum, [k, n]) => sum + (Number(weights[k]) || 0) * n, 0);

  // The largest declared class any single count reaches; below them all, one
  // targetMinutes[0] window of work is 's' and anything above it is 'm'.
  let size = minutes <= target[0] ? 's' : 'm';
  for (const [name, card] of Object.entries(sizes)) {
    const bounds = Object.entries(card?.from ?? {});
    if (bounds.length && bounds.some(([key, bound]) => {
      const measure = SIZE_MEASURE_KEYS[key];
      return measure && Number.isFinite(Number(bound)) && counts[measure] >= Number(bound);
    })) size = name;
  }

  // --gear is a dry run: the owner's config.yaml parallel.gear is the standing
  // answer and is never written by this command.
  const gearSource = args.gear !== undefined ? 'flag' : 'config';
  let gear;
  if (gearSource === 'flag') {
    gear = Number(args.gear);
    if (!Number.isInteger(gear) || !gears.includes(gear)) {
      throw Object.assign(
        new Error(`--gear ${args.gear} is not declared by modules/models/runtimes.yaml allocation.slicing.gears (known: ${gears.join(', ')})`),
        { code: 'gear-undeclared' });
    }
  } else {
    gear = loadConfig(ownerRoot)?.parallel?.gear ?? defaultParallelGear();
  }

  const agentsRequested = (() => {
    if (SINGLE_AGENT_SIZES.includes(size)) return 1;
    const declared = Number(sizes[size]?.agents?.[gear]);
    if (!Number.isInteger(declared) || declared < 1) {
      throw Object.assign(
        new Error(`modules/models/runtimes.yaml allocation.slicing.size.${size}.agents declares no agent count for gear ${gear}`),
        { code: 'slicing-undeclared' });
    }
    return declared;
  })();

  // The seam-first partition itself is derived by the Kernel agent from
  // repository evidence (driver-loop.yaml cutExecution), not by this code, so
  // what is computable here is an UPPER BOUND: the pairwise-disjoint concrete
  // prefixes the declared closure already holds. Without --paths there is no
  // closure to bound it with and the request stands unbounded.
  const pathArg = args.paths === undefined ? null : csvList(args.paths);
  let pathGroups = null;
  if (pathArg) {
    try { pathGroups = normalizeOwnedPaths(pathArg); }
    catch (e) { throw Object.assign(new Error(`--paths: ${e.message}`), { code: 'estimate-paths-invalid' }); }
    if (!pathGroups.length) {
      throw Object.assign(new Error('--paths resolved to no concrete prefix'), { code: 'estimate-paths-invalid' });
    }
  }
  const achievableBasis = pathGroups ? 'disjoint-owned-path-prefixes' : 'unbounded-no-path-closure';
  const bounds = [agentsRequested, maxSlices, ...(pathGroups ? [pathGroups.length] : [])];
  const agentsAchievable = Math.max(1, Math.min(...bounds));
  const reason = agentsAchievable < agentsRequested
    ? (pathGroups && pathGroups.length < agentsRequested
      ? `closure partitions into ${pathGroups.length} pairwise-disjoint path prefix(es); size ${size} at gear ${gear} requests ${agentsRequested}`
      : `allocation.slicing.maxSlices ${maxSlices} caps the ${agentsRequested} agents size ${size} requests at gear ${gear}`)
    : null;

  const slices = agentsAchievable;
  const perSliceMinutes = Math.round((minutes / slices) * 10) / 10;
  const out = {
    ok: true, minutes, size, gear, gearSource,
    agentsRequested, agentsAchievable, achievableBasis, reason,
    ...(pathGroups ? { pathGroups } : {}),
    slices, perSliceMinutes, counts, weights,
    targetMinutes: target, maxSlices, gears,
    overTarget: perSliceMinutes > target[1],
  };
  emit(out, [
    `estimate: ${minutes} agent-min -> size ${size} at gear ${gear} (${gearSource})`,
    `  agents: requested ${agentsRequested}, achievable ${agentsAchievable} (${achievableBasis})${reason ? ` — ${reason}` : ''}`,
    `  ${slices} slice(s) ~${perSliceMinutes}min each (target ${target[0]}-${target[1]}min, cap ${maxSlices})`,
    // What would actually move the number: a gear only helps while the gear is
    // what bounds the set. Once the partition does, a wider closure decomposition is the only lever.
    ...(out.overTarget ? [`  each slice still exceeds ${target[1]}min — ${reason ? 'decompose the closure into more disjoint prefixes' : 'raise the gear or decompose the closure finer'} before enqueue`] : []),
  ].join('\n'), args.json);
}

/* --------------------------------------------------------------- enqueue */
function cmdEnqueue(ledger, args, repo) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (wf.phase === 'finished') {
    throw Object.assign(new Error(`workflow ${workflowId} is finished; a finished phase takes no new work`), { code: 'workflow-finished' });
  }
  const briefFile = path.join(skillRoot, 'modules', 'ops', 'ops', `${args.op}.yaml`);
  if (!fs.existsSync(briefFile)) {
    throw Object.assign(new Error(`unknown op ${args.op} — no brief at modules/ops/ops/${args.op}.yaml`), { code: 'unknown-op' });
  }
  const goal = latestGoal(db, workflowId);
  // Tunables are data. The brief declares each param's type, default and setter;
  // the approved goal leg carries what the owner chose, --params carries what the
  // kernel chose, and a value that fails either authority is refused here rather
  // than reaching an agent as an unbound number.
  const brief = parseYaml(fs.readFileSync(briefFile, 'utf8'));
  let flagParams = null;
  if (args.params !== undefined) {
    try { flagParams = JSON.parse(args.params); }
    catch (e) { throw Object.assign(new Error(`--params is not JSON: ${e.message}`), { code: 'params-invalid' }); }
    if (flagParams === null || typeof flagParams !== 'object' || Array.isArray(flagParams)) {
      throw Object.assign(new Error('--params must be a JSON object of {name: value}'), { code: 'params-invalid' });
    }
  }
  const resolvedParams = resolveOpParams(brief, { leg: goalLegParams(goal, args.op), flag: flagParams, enforceRequired: true });
  if (!resolvedParams.ok && resolvedParams.param) {
    const out = { ok: false, workflowId, op: args.op, reason: resolvedParams.reason, param: resolvedParams.param, detail: resolvedParams.detail };
    emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
  }
  if (!resolvedParams.ok) throw Object.assign(new Error(resolvedParams.detail), { code: resolvedParams.reason });
  const ownedPaths = [...new Set(String(args.paths).split(',').map((s) => s.trim()).filter(Boolean))];
  // An op with no owned_paths is an unbounded write grant: the packet would
  // tell the worker "(per brief write-ceiling)" and nothing would fence it.
  if (ownedPaths.length === 0) {
    throw Object.assign(new Error(`--paths resolved to no path for ${args.op} — an op without owned_paths is an unbounded grant`), { code: 'empty-paths' });
  }
  // The kernel custody roots (modules/schemas/work-layout.yaml kernelCustody)
  // belong to the kernel. An op that owns one also takes a path lease every
  // sibling op in the workflow collides with, which serializes parallel cells.
  const custody = ownedPaths.filter((p) => /(^|\/)\.starciwork\/(kernel-evidence|kernel-strays|kernel-approvals)(\/|$)/.test(p.replace(/\\/g, '/')));
  if (custody.length) {
    throw Object.assign(new Error(`--paths names kernel custody ${custody.join(', ')} for ${args.op}; kernel-evidence, kernel-strays and kernel-approvals are the kernel's, never an op's write set`), { code: 'path-kernel-custody' });
  }
  // The repository the job's bare owned paths land in, recorded so dispatch
  // and settle resolve them alike (scripts/kernel/target-repo.mjs).
  const target = enqueueRepository({ op: args.op, repository: args.repository, ownedPaths, repo });
  if (!target.ok) {
    const out = { ok: false, workflowId, op: args.op, reason: target.reason, detail: target.detail };
    emit(out, `enqueue REFUSED for ${args.op}: ${out.reason} — ${out.detail}`, args.json);
    process.exit(1);
  }
  const records = [...new Set(String(args.records ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  const cutValues = [args['cut-id'], args['cut-ordinal'], args['cut-total']];
  const hasCut = cutValues.some((value) => value != null);
  if (hasCut && cutValues.some((value) => value == null)) {
    throw Object.assign(new Error('cut enqueue requires --cut-id, --cut-ordinal and --cut-total together'), { code: 'cut-invalid' });
  }
  const cutOrdinal = hasCut ? Number(args['cut-ordinal']) : null;
  const cutTotal = hasCut ? Number(args['cut-total']) : null;
  if (hasCut && (!String(args['cut-id']).trim() || !Number.isInteger(cutOrdinal) || !Number.isInteger(cutTotal)
      || cutOrdinal < 1 || cutTotal < 2 || cutOrdinal > cutTotal)) {
    throw Object.assign(new Error('cut enqueue requires a non-empty id and integers 1 <= ordinal <= total with total >= 2'), { code: 'cut-invalid' });
  }
  const cut = hasCut ? { id: String(args['cut-id']).trim(), ordinal: cutOrdinal, total: cutTotal } : null;
  // --after: jobs of this workflow that must settle succeeded before this one
  // may run (a seam/composition job ahead of its record-level siblings). The
  // order lives in the ledger, so status never calls a held sibling ready.
  const after = [...new Set(String(args.after ?? '').split(',').map((s) => s.trim()).filter(Boolean))];
  for (const prior of after) {
    const row = db.prepare('SELECT status FROM jobs WHERE job_id=? AND workflow_id=?').get(prior, workflowId);
    if (!row) throw Object.assign(new Error(`--after names ${prior}, which is not a job of ${workflowId}`), { code: 'after-unknown' });
    // A settled row never changes status, so an --after on one that did not
    // succeed can never be met. inc-5005d003825a: a retry of an answered ask
    // was enqueued --after the ask attempt and could only be dropped; the
    // retry chains to the ask through its retry lineage, never through --after.
    if (FINAL_SETTLED.includes(row.status) && row.status !== 'succeeded') {
      throw Object.assign(new Error(`--after names ${prior}, which already settled ${row.status} and can never succeed; a retry of it chains through its retry lineage (enqueue the same op${hasCut ? ' and cut ordinal' : ''} without --after)`), { code: 'after-settled' });
    }
  }
  const jobId = `op-${args.op}-${newToken().slice(0, 10)}`;
  let payload;

  let job, peers = { overlap: [], messages: [] };
  ledger.transaction(() => {
    const attempt = db.prepare('SELECT COALESCE(MAX(attempt),0)+1 a FROM jobs WHERE workflow_id=? AND op_id=?').get(workflowId, args.op).a;
    // A retry's provenance. `attempt` is durable dispatch identity; the route's
    // limit is budgeted against `businessAttempt`, which only advances when the
    // prior attempt actually spent one — an infrastructure launch rejected
    // before any effect does not (engine/admission.mjs deriveRetryLineage).
    // A cut ordinal's predecessor is its own ordinal, never a sibling slice.
    const retry = retryLineageFor(db, { workflowId, op: args.op, cut, attempt });
    payload = {
      opId: args.op, records, owned_paths: ownedPaths, title: args.title ?? args.op, risk: args.risk ?? null,
      ...(target.repository ? { repository: target.repository } : {}),
      ...(Object.keys(resolvedParams.params).length ? { params: resolvedParams.params } : {}),
      ...(cut ? { cut } : {}),
      ...(after.length ? { after } : {}),
      ...(retry ? { retry } : {}),
      goal_binding: { revision: goal?.revision ?? null, identity: goal?.goal_identity ?? null },
      hierarchy: {
        schema: AGENT_HIERARCHY_SCHEMA,
        nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(workflowId),
        role: 'operation',
        workflowId,
        jobId,
        opId: args.op,
        attempt,
        generation: wf.generation ?? 0,
        runtime: { host: 'orca' },
      },
    };
    db.prepare(
      "INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at) VALUES(?,?,?,?,?, 'op','op',?, 'queued',?,?)"
    ).run(jobId, workflowId, args.op, attempt, wf.generation ?? 0, JSON.stringify(payload), now, now);
    ledger.appendEvent({
      workflowId, entityType: 'job', entityId: jobId,
      kind: 'job-enqueued', payload: { opId: args.op, attempt, records: records.length, ownedPaths: ownedPaths.length, risk: payload.risk, cut, repository: payload.repository ?? null },
    });
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    // Owned paths that overlap an open job of a running peer workflow: the
    // receipt names them and each such peer gets one heads-up. Never a refusal.
    peers = peerOverlapHeadsUp(ledger, { self: wf, jobId, op: args.op, ownedPaths, now });
  });

  const out = { ok: true, job_id: jobId, workflowId, op: args.op, status: job.status, attempt: job.attempt, cut, params: payload.params ?? null, repository: payload.repository ?? null,
    peerOverlap: peers.overlap, peerHeadsUp: peers.messages };
  emit(out, `enqueued ${jobId} (op ${args.op}, attempt ${job.attempt}, status ${job.status}${payload.repository ? `, repository ${payload.repository}` : ''}${cut ? `, cut ${cut.ordinal}/${cut.total} ${cut.id}` : ''}${payload.params ? `, params ${Object.entries(payload.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}` : ''})${peers.overlap.length ? `; overlaps peer job(s) ${[...new Set(peers.overlap.map((hit) => `${hit.workflowId}/${hit.jobId}`))].join(', ')}, heads-up sent to ${peers.messages.map((message) => message.to).join(', ') || 'nobody new'}` : ''}`, args.json);
}

/* ----------------------------------------------------------------- route */
// The quota probe shells out to a provider CLI, so it is imported lazily and
// every probe degrades to {state:'unknown'} when it throws — routing still
// decides on the capacity rows it can prove (running counts, maxParallel,
// open incidents). A probe is evidence, never a verdict.
const quotaModule = import('../api/quota/index.mjs').catch(() => null);
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

const csvList = (v) => (v == null ? [] : (Array.isArray(v) ? v : String(v).split(','))
  .map((s) => String(s).trim()).filter(Boolean));

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
const allocationOf = (section) => {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'runtimes.yaml'), 'utf8'));
    return doc?.allocation?.[section] ?? {};
  } catch { return {}; }
};
const providerCooldownMs = (failureKind) => {
  const map = allocationOf('cooldownMs');
  const value = Number(map[failureKind] ?? map.other);
  return Number.isFinite(value) && value > 0 ? value : 5 * 60 * 1000;
};
// How many observations of one failure kind open the pool's circuit. A kind
// with no declared limit opens on the first: an authenticated provider that
// answers 401 is not a flake. runtimes.yaml allocation.providerStrikes.
const providerStrikeLimit = (failureKind) => {
  const value = Number(allocationOf('providerStrikes')[failureKind]);
  return Number.isInteger(value) && value > 0 ? value : 1;
};
// The raw provider-health row, open circuit or not: providerHealthOf answers
// only for an OPEN circuit, so it cannot count the strikes leading to one.
const providerSignalOf = (db, provider, now = Date.now()) => {
  const key = normalizeProviderId(provider);
  if (!key) return null;
  const row = db.prepare('SELECT value_json,at,expires_at FROM signals WHERE scope=? AND key=?')
    .get(PROVIDER_HEALTH_SCOPE, key);
  if (!row || (row.expires_at != null && row.expires_at <= now)) return null;
  return { ...parseJson(row.value_json, {}), at: row.at, expiresAt: row.expires_at };
};
// Records one provider failure. Below the kind's strike limit the row is a
// durable 'striking' strike counter that routing ignores; on the limit it
// becomes the 'unavailable' circuit route/dispatch skip. The return value is
// the OPEN circuit or null — a strike is not yet provider health.
// A circuit that keeps reopening for the same failure is a condition that does
// not clear on its own (an un-onboarded CLI, a revoked credential): each reopen
// inside allocation.circuitBackoff.windowMs multiplies the cooldown by
// .factor, capped at .capMs. The trip count survives the row's expiry.
const circuitBackoff = () => {
  try {
    const doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'runtimes.yaml'), 'utf8'));
    return doc?.allocation?.circuitBackoff ?? null;
  } catch { return null; }
};
// An auth failure records the fingerprint of the credential it was observed
// with (`credential`, resolved by the caller before its transaction); a row
// recorded against a different credential is no prior strike and no prior trip.
const writeProviderCircuit = (db, { provider, model, jobId, step, signal, error, now, failureKind = 'auth', credential = null }) => {
  const key = normalizeProviderId(provider);
  if (!key) return null;
  const auth = failureKind === 'auth';
  const rotatedFrom = (row) => auth && credentialRotated(row, credential);
  const priorRow = providerSignalOf(db, key, now);
  const prior = rotatedFrom(priorRow) ? null : priorRow;
  const failures = (prior?.failureKind === failureKind ? Number(prior.failures ?? 0) : 0) + 1;
  const strikeLimit = providerStrikeLimit(failureKind);
  const opens = failures >= strikeLimit;
  const lastRow = db.prepare('SELECT value_json FROM signals WHERE scope=? AND key=?').get(PROVIDER_HEALTH_SCOPE, key);
  const last = parseJson(lastRow?.value_json, {});
  const backoff = circuitBackoff();
  const sameRecent = last?.failureKind === failureKind && Number.isFinite(Number(last?.observedAt))
    && backoff && now - Number(last.observedAt) <= Number(backoff.windowMs) && !rotatedFrom(last);
  const trips = opens ? (sameRecent ? Number(last.trips ?? 0) : 0) + 1 : Number(sameRecent ? (last.trips ?? 0) : 0);
  const base = providerCooldownMs(failureKind);
  const cooldown = opens && backoff && trips > 1
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
    ...(opens ? { recover: providerRecoverCommand(key) } : {}),
  };
  db.prepare(`INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at)
    VALUES(?,?,NULL,NULL,?,?,?)
    ON CONFLICT(scope,key) DO UPDATE SET holder_pid=NULL,token=NULL,value_json=excluded.value_json,at=excluded.at,expires_at=excluded.expires_at`)
    .run(PROVIDER_HEALTH_SCOPE, key, JSON.stringify(value), now, expiresAt);
  return value.status === 'unavailable' ? { ...value, expiresAt } : null;
};

/* -------------------------------------------------------- provider-health */
// `api provider-health --provider <p>` shows this ledger's provider-health row
// for one provider credential: open or not, the fingerprint of the credential
// it recorded and of the one a launch would present now (never the value).
// `--recover --reason <text> [--probe]` clears an OPEN circuit before its
// expiry, so a fixed credential is not parked for the rest of an auth cooldown.
// Nothing else clears one early but a rotated credential (providerCircuitOf):
// resolving an incident does not. Kernel only: the caller's
// ORCA_TERMINAL_HANDLE must be the terminal of a running kernel job of this
// ledger; an op (op-context-refused), a caller marked STARCI_ROLE=supervisor
// (supervisor-refused) and any unproven caller (kernel-proof-required) are
// refused. With --probe the credential is proven live first
// (scripts/agent/credential-probe.mjs) and a failed probe refuses the clear
// (probe-failed, recorded as 'provider-health-recover-refused'). A clear
// rewrites the row as status 'recovered' expiring now (failures and trips
// restart) and appends 'provider-health-recovered' with the reason, the probe
// and the circuit it cleared.
const kernelCallerProof = (db, env = process.env) => {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  if (!handle) return null;
  const hit = db.prepare("SELECT job_id,workflow_id,worker_id,payload_json FROM jobs WHERE kind='kernel' AND status='running' ORDER BY updated_at DESC").all()
    .find((r) => r.worker_id === handle || parseJson(r.payload_json, {})?.hierarchy?.runtime?.terminalHandle === handle);
  return hit ? { jobId: hit.job_id, workflowId: hit.workflow_id, handle } : null;
};
const refuseProviderRecover = (out, human) => {
  console.error(JSON.stringify(out));
  console.log(human);
  process.exit(1);
};
async function cmdProviderHealth(ledger, args) {
  const db = ledger.db, key = normalizeProviderId(args.provider), now = Date.now();
  if (!key) throw Object.assign(new Error('provider-health needs a provider id'), { code: 'provider-unknown' });
  const raw = db.prepare('SELECT value_json,at,expires_at FROM signals WHERE scope=? AND key=?').get(PROVIDER_HEALTH_SCOPE, key);
  const value = raw ? parseJson(raw.value_json, {}) ?? {} : null;
  const current = currentCredentialOf(key);
  const rotated = Boolean(value?.failureKind === 'auth' && credentialRotated(value, current));
  const circuit = providerHealthOf(db, key, now);
  const row = raw ? { ...value, at: raw.at, expiresAt: raw.expires_at, expired: raw.expires_at != null && raw.expires_at <= now } : null;
  const credential = { fingerprint: current.fingerprint, source: current.source, resolved: current.resolved,
    recorded: value?.credentialFingerprint ?? null, rotated };
  const until = (at) => (at ? new Date(at).toISOString() : 'explicit recovery');
  const state = circuit ? `OPEN (${circuit.failureKind ?? 'auth'}) until ${until(circuit.expiresAt)}`
    : !row ? 'no row' : row.expired ? `closed (${row.status ?? '-'} row expired ${until(row.expiresAt)})`
      : rotated ? `closed (credential rotated ${credential.recorded} -> ${credential.fingerprint}; row ${row.status})`
        : `closed (${row.status ?? '-'})`;
  if (!args.recover) {
    emit({ ok: true, provider: key, open: Boolean(circuit), row, credential },
      `provider-health ${key}: ${state}${row?.jobId ? `; opened by ${row.jobId} at ${row.step ?? '-'}: ${row.detail ?? row.signal ?? '-'}` : ''}; credential ${credential.fingerprint ?? 'unresolved'} (${credential.source ?? 'no source'})`
      + (circuit ? `; clear with ${providerRecoverCommand(key)}` : ''), args.json);
    return;
  }
  if (process.env.STARCI_ROLE === 'supervisor') {
    refuseProviderRecover({ ok: false, code: 'supervisor-refused', provider: key,
      error: `provider-health --recover is a Kernel decision; a supervisor reports the command and the workflow's Kernel runs it: ${providerRecoverCommand(key)}` },
    `provider-health --recover REFUSED for ${key}: supervisor-refused`);
  }
  const kernel = kernelCallerProof(db);
  if (!kernel) {
    refuseProviderRecover({ ok: false, code: 'kernel-proof-required', provider: key, terminal: process.env.ORCA_TERMINAL_HANDLE || null,
      error: `provider-health --recover runs only from a running Kernel terminal of this ledger (ORCA_TERMINAL_HANDLE bound to a running kernel job); the Kernel runs ${providerRecoverCommand(key)}` },
    `provider-health --recover REFUSED for ${key}: kernel-proof-required`);
  }
  if (!circuit) {
    emit({ ok: true, provider: key, recovered: false, reason: 'no-open-circuit', row, credential },
      `provider-health ${key}: nothing to recover - ${state}`, args.json);
    return;
  }
  let probe = null;
  if (args.probe) {
    const { probeProviderCredential } = await import('../agent/credential-probe.mjs');
    probe = await probeProviderCredential(key, { accounts: accountsOnce?.ok ? accountsOnce : undefined });
    if (!probe.ok) {
      ledger.transaction(() => ledger.appendEvent({ workflowId: kernel.workflowId, entityType: 'provider', entityId: key,
        kind: 'provider-health-recover-refused', payload: { provider: key, reason: args.reason, probe, kernelJob: kernel.jobId } }));
      refuseProviderRecover({ ok: false, code: 'probe-failed', provider: key, probe,
        error: `the ${probe.kind ?? 'credential'} probe failed (${probe.detail}); the circuit stays open until ${until(circuit.expiresAt)}` },
      `provider-health --recover REFUSED for ${key}: probe-failed - ${probe.detail}`);
    }
  }
  const previous = { status: circuit.status, failureKind: circuit.failureKind ?? null, jobId: circuit.jobId ?? null, step: circuit.step ?? null,
    signal: circuit.signal ?? null, detail: circuit.detail ?? null, observedAt: circuit.observedAt ?? null, expiresAt: circuit.expiresAt ?? null,
    trips: circuit.trips ?? null, credentialFingerprint: circuit.credentialFingerprint ?? null };
  const probeSummary = probe ? { ok: probe.ok, kind: probe.kind, status: probe.status ?? null, detail: probe.detail } : null;
  const recovered = {
    schema: 'starci/provider-health@1', provider: key, status: 'recovered', recoveredAt: now, reason: args.reason,
    failures: 0, trips: 0, credentialFingerprint: current.fingerprint, credentialSource: current.source, probe: probeSummary,
    recoveredBy: { kernelJob: kernel.jobId, workflowId: kernel.workflowId, terminal: kernel.handle }, previous,
  };
  ledger.transaction(() => {
    db.prepare('UPDATE signals SET value_json=?, at=?, expires_at=?, holder_pid=NULL, token=NULL WHERE scope=? AND key=?')
      .run(JSON.stringify(recovered), now, now, PROVIDER_HEALTH_SCOPE, key);
    ledger.appendEvent({ workflowId: kernel.workflowId, entityType: 'provider', entityId: key, kind: 'provider-health-recovered',
      payload: { provider: key, reason: args.reason, probe: probeSummary, previous, credential, kernelJob: kernel.jobId } });
  });
  emit({ ok: true, provider: key, recovered: true, previous, probe, credential },
    `provider-health ${key}: circuit cleared (was ${previous.failureKind} until ${until(previous.expiresAt)}, opened by ${previous.jobId ?? '-'})${probe ? `; probe: ${probe.detail}` : ' without a probe'}; reason: ${args.reason}`, args.json);
}

// `api route` — resolve the pool/model for one job and persist the decision on
// its payload so `dispatch --spawn` launches exactly what was routed. Bias:
// routing_bias {prefer[], avoid[]} on the workflow goal's json, with --prefer/
// --avoid flags taking precedence (flag entries lead the merged list).
// Difficulty: --difficulty > job payload.difficulty > 'medium'.
async function cmdRoute(ledger, args) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (job.status === 'effect_unknown') throw Object.assign(new Error(`job ${jobId} requires reconcile before it can be routed`), { code: 'job-reconcile-required' });
  if (FINAL_SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  if (job.status !== 'queued') throw Object.assign(new Error(`job ${jobId} cannot be routed while ${job.status}; only queued jobs are routable`), { code: 'job-not-queued' });
  const priorWorker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${jobId} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of rerouting`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const kind = job.op_id ?? payload.opId;
  if (!kind) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });

  // Concurrency admission BEFORE the pool decision: a route that lands on a
  // full workflow is a decision the kernel cannot spend. The ceiling is the
  // lower of the owner's budgets.maxOps and the fleet's maxParallelOps.
  // An owner-gate incident naming this job refuses first: no pool can run a
  // step only the owner drives.
  const heldBy = ownerGateOf(openOwnerGates(db, job.workflow_id), job);
  if (heldBy) {
    const out = { ok: false, jobId, kind, reason: 'owner-gate', incident: heldBy.incidentId };
    emit(out, `route REFUSED for ${jobId} (${kind}): owner-gate — incident ${heldBy.incidentId} holds it until the Kernel resolves it`, args.json);
    process.exit(1);
  }
  const peerHeldBy = ownerGateOf(openPeerWaits(db, job.workflow_id), job);
  if (peerHeldBy) {
    const out = { ok: false, jobId, kind, reason: PEER_WAIT, incident: peerHeldBy.incidentId, peer: peerHeldBy.peer };
    emit(out, `route REFUSED for ${jobId} (${kind}): peer-wait — incident ${peerHeldBy.incidentId} holds it until peer ${peerHeldBy.peer} lands what it waits on and the wait is resolved`, args.json);
    process.exit(1);
  }
  const slots = opSlotAdmission(db, job.workflow_id, { excludeJobId: jobId });
  if (!slots.ok) {
    const out = { ok: false, jobId, kind, reason: 'max-ops', slots };
    emit(out, `route REFUSED for ${jobId} (${kind}): max-ops — ${slots.running} operation(s) already hold a slot at ceiling ${slots.ceiling} (${slots.ceilingSource})`, args.json);
    process.exit(1);
  }

  const gj = goalJsonOf(latestGoal(db, job.workflow_id));
  const goalBias = gj.routing_bias ?? {};
  const bias = {
    prefer: [...new Set([...csvList(args.prefer), ...csvList(goalBias.prefer)])],
    avoid: [...new Set([...csvList(args.avoid), ...csvList(goalBias.avoid)])],
  };
  const difficulty = args.difficulty ?? payload.difficulty ?? 'medium';

  // Capacity per runtimes.yaml pool: live running count, declared maxParallel,
  // the provider quota probe and the typed, expiring provider-health circuit.
  // Generic workflow incidents are evidence for the Kernel, not provider
  // health. Their free-form text can mention every fallback provider (for
  // example while documenting a recovered dispatch failure), so substring
  // matching them here would permanently poison every pool because incidents
  // are intentionally append-only until workflow finish.
  const rtFile = path.join(skillRoot, 'modules', 'models', 'runtimes.yaml');
  const rtDoc = fs.existsSync(rtFile) ? parseYaml(fs.readFileSync(rtFile, 'utf8')) : null;
  const pools = rtDoc?.runtimes ?? {};
  // A persisted payload.model marks a lane already committed: routed-but-queued,
  // leased and answering jobs hold the same pool slot a running one does, so
  // sequential route calls in one fan-out see the fleet filling instead of
  // piling every slice onto the first preferred pool.
  const runningByModel = {};
  for (const r of db.prepare(
    `SELECT payload_json FROM jobs WHERE status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')})`
  ).all(...FINAL_SETTLED)) {
    const p = parseJson(r.payload_json, {});
    if (p?.model) runningByModel[p.model] = (runningByModel[p.model] ?? 0) + 1;
  }
  let accounts = null;
  try { accounts = await accountList() ?? null; } catch { accounts = null; }
  const quotaByProvider = new Map();
  const capacity = {};
  for (const [poolId, rt] of Object.entries(pools)) {
    const target = rt?.target ?? poolId;
    const provider = rt?.provider ?? null;
    const providerKey = normalizeProviderId(provider);
    if (provider && !quotaByProvider.has(providerKey)) quotaByProvider.set(providerKey, await probeQuotaSafe(provider));
    const quota = provider ? quotaByProvider.get(providerKey)
      : { state: 'unknown', usedPercent: null, detail: 'pool declares no provider' };
    const providerHealth = provider ? providerHealthOf(db, provider) : null;
    capacity[target] = {
      running: runningByModel[target] ?? 0,
      maxParallel: rt?.maxParallel ?? null,
      quota,
      auth: providerHealth || quota?.state === 'dead' ? 'dead' : 'ok',
      authDetail: providerHealth
        ? `${providerHealth.detail ?? providerHealth.signal ?? providerHealth.failureKind ?? 'circuit open'} (circuit open until ${providerHealth.expiresAt ? new Date(providerHealth.expiresAt).toISOString() : 'explicit recovery'}; the Kernel clears it with ${providerRecoverCommand(providerHealth.provider)})`
        : quota?.detail ?? null,
      providerHealth,
      openIncident: false,
    };
  }

  // Owner allocation (config.yaml allocation, engine/config.mjs configuredAllocationPolicy): the policy,
  // target shares and window of the balanced allocator, and the grants that open an
  // explicit-workflow-quota pool (Devin). A declared grants list is the whole set of grants; with none
  // declared, or no readable config, routing keeps the runtimes.yaml default policy and ungated pools.
  let allocation = null;
  try { allocation = configuredAllocationPolicy(loadConfig(ownerRoot)); } catch { allocation = null; }
  const balancedRoute = (allocation?.policy ?? rtDoc?.allocation?.policy) === 'balanced';
  const recent = balancedRoute
    ? recentDispatchCounts({ db, ledgerFile: ledger.path ?? null, windowHours: allocation?.windowHours })
    : null;
  const routeKind = kindRouteOf(kind, rtDoc);
  const author = routeKind.work === 'think' && routeKind.role === 'verify'
    ? (() => { try { return thinkAuthorOf(db, job, { runtimes: rtDoc }); } catch { return null; } })()
    : null;
  const decision = selectPool({ kind, difficulty, bias, capacity,
    policy: allocation?.policy ?? undefined,
    shares: allocation?.shares ?? undefined,
    recent: recent?.counts,
    grants: allocation?.grants ?? undefined,
    auditOf: author?.pool ?? undefined });
  if (decision?.toolUnavailable) {
    const { tools, holders } = decision.toolUnavailable;
    const serving = holders.filter((h) => h.roles.includes(decision.role));
    const avoided = bias.avoid.filter((p) => serving.some((h) => h.target === p));
    const detail = `${kind} needs host tool ${tools.join(', ')} (route.riskHints host-tool-required on modules/ops/ops/${kind}.yaml) and no agent in its ${decision.work ?? decision.role} order at ${decision.difficulty} [${decision.chain.join(', ')}] has it`
      + (avoided.length
        ? `; ${avoided.join(', ')} has it and is excluded by the avoid bias. Re-run api route --job ${jobId} without --avoid ${avoided.join(',')}.`
        : `; ${serving.length ? `the agents that have it (${serving.map((h) => h.target).join(', ')}) are outside that order` : 'no agent card lists it under capabilities.hostTools'}. Raise api incident --kind tool-unavailable for the owner.`)
      + ' The job stays queued; never dispatch it on an agent without the tool.';
    const out = { ok: false, jobId, kind, difficulty: decision.difficulty, bias, reason: 'tool-unavailable', tools, holders: serving, detail };
    emit(out, `route REFUSED for ${jobId} (${kind}): tool-unavailable — ${detail}`, args.json);
    process.exit(1);
  }
  if (!decision || decision.error) {
    const out = { ok: false, jobId, kind, difficulty, bias, error: decision?.error ?? 'selectPool returned no decision' };
    emit(out, `route REFUSED for ${jobId} (${kind}, ${difficulty}): ${out.error}`, args.json);
    process.exit(1);
  }

  const decided = {
    model: decision.target, modelId: decision.modelId ?? null, effort: decision.effort ?? null,
    routeChain: decision.chain ?? [], routeRejected: decision.rejected ?? [],
    // Always written (null when absent) so a reroute never keeps the previous decision's values.
    routePolicy: decision.policy ?? null,
    routeBalance: decision.balance ? {
      windowHours: recent?.windowHours ?? null, recentTotal: recent?.total ?? null, ledgers: recent?.ledgers?.length ?? 0,
      candidates: decision.balance.candidates,
      deficits: Object.fromEntries(Object.entries(decision.balance.deficits).map(([pool, d]) => [pool, {
        target: Number(d.target.toFixed(3)), actual: Number(d.actual.toFixed(3)), deficit: Number(d.deficit.toFixed(3)) }])),
    } : null,
    routeCrossFamily: decision.crossFamily
      ? { ...decision.crossFamily, authorJob: author?.jobId ?? null, authorOp: author?.opId ?? null } : null,
  };
  const selectedRuntime = Object.entries(pools)
    .find(([poolId, runtime]) => (runtime?.target ?? poolId) === decision.target)?.[1] ?? null;
  ledger.transaction(() => {
    const now = Date.now();
    const hierarchy = payload.hierarchy ?? {
      schema: AGENT_HIERARCHY_SCHEMA,
      nodeId: operationNodeId(jobId), parentNodeId: kernelNodeId(job.workflow_id),
      role: 'operation', workflowId: job.workflow_id, jobId, opId: kind,
      attempt: job.attempt, generation: job.generation,
    };
    hierarchy.runtime = {
      ...(hierarchy.runtime ?? {}), host: 'orca',
      agent: selectedRuntime?.provider ?? null,
      provider: selectedRuntime?.provider ?? null,
      model: decided.modelId,
      profile: decided.model,
      runtimePool: decided.model,
    };
    db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?')
      .run(JSON.stringify({ ...payload, ...decided, difficulty, hierarchy }), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'route-decided', payload: { kind, difficulty, bias, ...decided },
    });
  });

  const out = { ok: true, jobId, kind, difficulty, bias, decision: decided, rejected: decided.routeRejected, ...(accounts ? { accounts } : {}) };
  emit(out, [
    `route ${jobId} (${kind}, ${difficulty}) → ${decided.model} model=${decided.modelId ?? '-'} effort=${decided.effort ?? '-'}`,
    `  chain: ${decided.routeChain.join(' → ') || '(none)'}`,
    ...(decided.routeBalance
      ? [`  balanced (last ${decided.routeBalance.windowHours}h, ${decided.routeBalance.recentTotal} jobs): ${Object.entries(decided.routeBalance.deficits)
        .map(([pool, d]) => `${pool} ${Math.round(d.actual * 100)}%/${Math.round(d.target * 100)}%`).join(', ')}`]
      : []),
    ...(decided.routeCrossFamily?.applied
      ? [`  cross-family audit: ${decided.routeCrossFamily.authorOp ?? 'think op'} ran on ${decided.routeCrossFamily.author}; the auditor takes the other family`]
      : []),
    ...(decided.routeRejected.length
      ? ['  rejected:', ...decided.routeRejected.map((r) => `    ${r.target}: ${r.reason}`)]
      : []),
  ].join('\n'), args.json);
}

/* -------------------------------------------------------------- dispatch */
const resolveModel = (target) => {
  const file = path.join(skillRoot, 'modules', 'models', 'profiles', `${target}.yaml`);
  if (!fs.existsSync(file)) return { error: `no model profile ${target} at ${path.relative(skillRoot, file)}` };
  const doc = parseYaml(fs.readFileSync(file, 'utf8'));
  const orca = doc?.launch?.orca ?? {};
  return { target, provider: doc?.provider ?? null, kind: orca.kind ?? 'unknown', command: orca.command ?? null,
    requestedModel: doc?.identity?.requestedModel ?? null, profile: path.relative(skillRoot, file) };
};

// dispatch-op.mjs's packet builder is not exported (it runs main() on import),
// so the packet shape is replicated here: same fields, same returns contract.
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
// An owned path as the worker reads it: bare when it lives in the worker's
// checkout, rooted at its own checkout otherwise.
const renderOwnedPath = (p, cwd) => (p.root && path.resolve(p.root) !== path.resolve(cwd)
  ? `${p.root.replace(/\\/g, '/')}/${p.path}`.replace(/\/\.$/, '') : p.path);

const buildPacket = ({ job, payload, model, goal, params, placements, productLocale = null, ownerAnswers = [] }) => ({
  op: job.op_id ?? payload.opId,
  brief: `modules/ops/ops/${job.op_id ?? payload.opId}.yaml`,
  ...(params && Object.keys(params).length ? { params } : {}),
  context: {
    workflow: {
      id: job.workflow_id,
      goal_revision: payload.goal_binding?.revision ?? goal?.revision ?? null,
      goal_identity: payload.goal_binding?.identity ?? goal?.goal_identity ?? null,
    },
    attempt: job.attempt,
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
  },
  constraints: { model: model.target, provider: model.provider, budget: payload.budget ?? null, lease: job.lease_token ?? null },
  returns: { verdict: 'pass|fail|blocked', evidence: ['...paths'], suspicion: 'string?' },
});

const buildPrompt = (packet, jobId, repo, priorFailures = [], cwd = repo) => {
  const owned = packet.context.owned_paths;
  const unresolved = owned.filter((p) => p.unresolved);
  const roots = [...new Map(owned.filter((p) => p.root).map((p) => [path.resolve(p.root), p])).values()];
  const entrySkill = path.join(skillRoot, 'CONTEXT.md');
  const brief = path.join(skillRoot, packet.brief);
  const verdictContract = path.join(skillRoot, VERDICT_CONTRACT);
  return [
  `[Op] ${packet.op} — one operation, one verdict. You are an ephemeral op agent spawned by the workflow kernel (job ${jobId}, attempt ${packet.context.attempt ?? 1}).`,
  ...(packet.context.owner_answers?.length ? [
    `owner_answers: these questions were ALREADY ANSWERED in this job's retry lineage (packet context.owner_answers). Each answer is binding input for`,
    `  this attempt: apply it and record the decision with its answeredBy source. Do NOT ask it again — not reworded, not with the same options;`,
    `  api report refuses such an ask (ask-already-answered). Ask only a genuinely new question the answer left open:`,
    ...packet.context.owner_answers.map(ownerAnswerLine),
  ] : []),
  ...(priorFailures.length ? [
    `prior_attempt_failures: an earlier attempt of this same op settled fail on the kernel checks below.`,
    `  They are your authoritative residual defects — verify and repair them first; records already on`,
    `  disk are prior attempts' output you must check, not license to file done. Re-filing another`,
    `  attempt's report or claiming done without new authored writes is an automatic fail:`,
    ...priorFailures.map((f) => `  - [${f.name}] ${f.evidence}`),
  ] : []),
  `MANDATORY LOAD ORDER — read before any action:`,
  `  1. ${entrySkill} — canonical Source runtime load order (the routed repository may not contain .claude)`,
  `  2. ${brief} — your contract. It declares your reads, writes, steps, proofs and blockers.`,
  `  3. ${verdictContract} — what your return must look like`,
  `source_runtime: ${skillRoot}`,
  `target_repository: ${repo}`,
  `brief: ${brief}  (your contract — never renegotiate it)`,
  ...(packet.params ? [`params: ${Object.entries(packet.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')} — the resolved tunables for this dispatch; use these values, never a number you read in prose`] : []),
  `workflow: ${packet.context.workflow.id} goal_revision=${packet.context.workflow.goal_revision ?? '(unbound)'} goal_identity=${packet.context.workflow.goal_identity ?? '(unbound)'}`,
  `owner_language: ${packet.context.owner_language ?? 'en'} — every string the owner reads (ask text, option and pick labels, owner-facing summaries) is written in this language in plain words; canonical records stay English`,
  `product_locale: ${packet.context.product_locale ? `${packet.context.product_locale.locale} (${packet.context.product_locale.source})` : '(unset - no shell or brand locale)'} — every string a product user reads (UI copy, labels, sample data in prompts, message files) is written in this locale, never in owner_language; chrome, nav labels and the demo persona come from .starciwork/shell/index.yaml verbatim`,
  ...(packet.context.owner_delegation ? [`owner_delegation: the owner delegated ask answers to ${packet.context.owner_delegation.asks} until ${packet.context.owner_delegation.until} (config.yaml delegation); an answer receipt with answeredBy ${packet.context.owner_delegation.asks} inside that window IS the owner's answer, except for the excluded classes ${JSON.stringify(packet.context.owner_delegation.excludes)} which stay owner-only`] : []),
  `records: ${packet.context.records.join(', ') || '(none bound)'}`,
  ...(packet.context.cut ? [`cut: ${packet.context.cut.id} ordinal=${packet.context.cut.ordinal}/${packet.context.cut.total} — this job owns only this bounded SAME-op slice; never widen to sibling slices`] : []),
  ...(roots.length ? [`writes_in: ${roots.map((p) => `${path.resolve(p.root)}${p.repository ? ` (repository ${p.repository})` : ''}`).join(', ')} — each owned path below is relative to your checkout ${cwd} unless it is written rooted at another checkout; edit, commit and report head in the checkout that holds it (api settle checks it there)`] : []),
  `owned_paths: ${[...new Set(owned.filter((p) => !p.unresolved).map((p) => renderOwnedPath(p, cwd)))].join(', ') || '(per brief write-ceiling)'}`,
  `   only owned_paths may be modified; anything else is out of scope.`,
  ...(unresolved.length ? [`unresolved_owned_paths: ${unresolved.map((p) => `${p.path} (repository ${p.repository} is not bound)`).join(', ')} — report blocked with kind authority; never guess a root`] : []),
  `constraints: lease=${packet.constraints.lease ?? '(none)'} model=${packet.constraints.model} budget=${packet.constraints.budget ?? '(unset)'}`,
  `machines: check names in your brief (layoutPolicy.checks, proofs) are executable canonical validators — run them verbatim, never invent placeholder commands (e.g. validateWorkspace):`,
  `  starci-validate → node ${path.join(skillRoot, 'bin', 'starci.mjs')} validate <work-root-or-record-dir> [--json]`,
  `  starci-stacks-check → checkApplicationStacks({repoRoot,environment,deploymentModelFile}) in ${path.join(skillRoot, 'scripts', 'checks', 'stacks.mjs')}`,
  `  starci-code-patterns-check → node ${path.join(skillRoot, 'scripts', 'checks', 'check-scoped-lint.mjs')} --profile <nest|next> --root <repo> (--all|-- <files>)`,
  `  a check you cannot execute is reported as environment/unavailable evidence — a placeholder result is NOT proof of an upstream defect.`,
  `persistence: workflow state lives in the ledger, reached only through the api commands below (op-contract, report) — never open, query or copy a ledger file; the api refuses kernel verbs from an op terminal (inc-360891316369). Your own state lives in files under owned_paths, never in your memory.`,
  `reporting: your answer is a starci/op-report@1 JSON envelope — report.json on disk (the artifact) filed into the ledger (the durable signal):`,
  `  {"outcome":"${REPORT_OUTCOMES.join("|")}","summary":"<=600 chars","files":["paths under owned_paths"],"checks":[{"name","command","exitCode","evidence<=400ch"}],`,
  `   "open":[...] when partial, "question":{"text","options":[]} when ask, "blocker":{"kind","detail"} when blocked}`,
  `  run/task/dispatch/from are stamped by the api — never write another job's identity.`,
  `questions: a question for the owner is outcome ask filed with api report, then end your turn. An Orca orchestration ask reaches only the Kernel (technical guidance inside this contract) and never the owner (inc-b944cbaef24b).`,
  ...(policyCommits(opCommitPolicy(packet.op)) ? [`  your op commits (commitPolicy): on done|partial add "head": the output of \`git rev-parse HEAD\` in the checkout holding your owned paths, after your commit — api report refuses a done|partial report without it.`] : []),
  `  Write report.json as UTF-8 (Node fs.writeFileSync, or PowerShell Out-File -Encoding utf8); Windows PowerShell Set-Content turns every non-ASCII letter into '?' and the api refuses it. File it:`,
  `  node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} report --repo ${repo} --job ${jobId} --report <path-to-report.json>`,
  `  read your contract the same way: node ${path.join(skillRoot, 'scripts', 'kernel', 'api.mjs')} op-contract --repo ${repo} --job ${jobId}`,
  `returns: {verdict: pass|fail|blocked, evidence: [...paths], suspicion?: string} — contract: ${verdictContract}`,
  `Return verdict + evidence paths. Cite suspicion instead of fixing out of scope — a wrong spec is a blocker, not a guess.`,
  ].join('\n');
};

// dispatch-rejected — the shared refusal for every launch kind: the job must
// NEVER stand 'running' on a launch that failed. Job → failed with a typed
// result, lease rows released, one event — and when `incident` is set (the
// post-launch attestation failures) a typed infra-provider incident so survey
// sees it without parsing events. `terminal` is the launch's handle: a
// terminal handle for command-terminal jobs, a Dispatch id for managed ones.
const bestEffort = (fn) => { try { return fn(); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };

// A refusal must leave no live terminal, worker or open Task behind. Whatever
// this attempt created before the host said no is closed exactly once here:
// a command terminal with terminal-close, a managed worker with worker-stop +
// worker-release. It runs before the rejection is written so the answer —
// terminalClosed: true | false | null when the attempt created nothing to
// close — is part of the dispatch-rejected record rather than a second
// unrecorded effect. `settled` is a cleanup the caller already performed
// (cmdDispatchManaged reconciles partial effects before rejecting); it is
// reported, never repeated.
// An unknown effect is the one case a refusal may NOT force closed: calls.yaml
// reconcile-then-stop says the job is fenced at effect_unknown until `api
// reconcile` proves the state. terminalClosed is false there — outstanding,
// not silent.
const closeRejectedLaunch = ({ model, terminal, closeTerminal, alreadyClosed, settled, effectState }) => {
  if (closeTerminal) {
    if (alreadyClosed)
      return { terminalClosed: true, closed: { kind: 'terminal', handle: closeTerminal, ok: true, by: 'launcher' } };
    const r = bestEffort(() => closeOperationTerminal(closeTerminal));
    return { terminalClosed: r?.ok === true,
      closed: { kind: 'terminal', handle: closeTerminal, ok: r?.ok === true, ...(r?.error ? { error: String(r.error) } : {}) } };
  }
  if (!terminal || !MANAGED_KINDS.includes(model?.kind)) return { terminalClosed: null, closed: null };
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
const rejectDispatch = (ledger, job, jobId, op, model, {
  step, signal = null, error = null, terminal = null, incident = false,
  effectState = 'none', details = null, providerHealthEvidence = null,
  closeTerminal = null, alreadyClosed = false, settled = null, createRecovery = null, trust = null,
}) => {
  const authFailure = Boolean(providerHealthEvidence) || confirmedAuthFailure({ step, signal, error, details });
  const { terminalClosed, closed } = closeRejectedLaunch({ model, terminal, closeTerminal, alreadyClosed, settled, effectState });
  // rejectDispatch is reached only before an accepted operation contract or
  // business verdict. Once the host proves effectState:none, the same durable
  // candidate is safe to reroute regardless of whether the infrastructure
  // cause was auth, the machine arbiter, or worker startup. Provider auth has
  // the additional side effect of opening the typed provider circuit.
  const reusable = effectState === 'none';
  const status = reusable ? 'queued' : (['partial', 'unknown', 'committed'].includes(effectState) ? 'effect_unknown' : 'failed');
  let providerHealth = null;
  // Resolved outside the transaction: an Orca-managed identity is a host call.
  const credential = authFailure && !providerHealthEvidence && model?.provider ? currentCredentialOf(model.provider) : null;
  ledger.transaction(() => {
    const now = Date.now();
    const leasesReleased = effectState === 'none'
      ? ledger.db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes
      : 0;
    if (authFailure) {
      providerHealth = providerHealthEvidence ?? writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now, credential,
      });
    } else if (step === 'readiness' && model?.provider) {
      // A spawned terminal that never reaches readiness means the provider's
      // launch path is broken, not the job. Open the same typed circuit (with
      // the shorter non-auth cooldown) so route/dispatch skip the dead pool
      // instead of burning attempts on repeated readiness timeouts.
      providerHealth = writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now,
        failureKind: 'readiness',
      });
    } else if (step === 'worker-start' && model?.provider) {
      // A managed launch the host refused without saying why is still the
      // provider's launch path failing. Left unclassified it fed nothing, so
      // the kernel rerouted straight back to the same pool and burned another
      // launch. It is a strike (runtimes.yaml allocation.providerStrikes) —
      // one flake never parks a pool, the second one does.
      providerHealth = writeProviderCircuit(ledger.db, {
        provider: model.provider, model: model.target, jobId, step, signal, error, now,
        failureKind: 'worker-start',
      });
    }
    const priorPayload = jobPayloadOf(job);
    // A rejected dispatch is EVIDENCE, never a binding. Overwriting
    // managed.dispatchId with it made one field mean two things, and the
    // readers that resolve a report's dispatch could not tell them apart:
    // a valid report from the live retry was refused because the payload
    // still pointed at the dispatch that never got a contract. The rejected
    // id goes on its own list; reconcile reads it there.
    if (terminal && MANAGED_KINDS.includes(model.kind)) {
      priorPayload.rejectedDispatches = [
        ...(Array.isArray(priorPayload.rejectedDispatches) ? priorPayload.rejectedDispatches : []),
        { dispatchId: terminal, step, at: now, effectState },
      ];
    }
    const result = {
      reason: 'dispatch-rejected', step, signal, detail: error, provider: model.provider,
      effectState, attemptConsumed: !reusable, retryable: reusable, providerHealth, at: now,
      terminalClosed, ...(closed ? { closed } : {}),
    };
    if (effectState === 'none') {
      ledger.db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, worker_id=NULL, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?')
        .run(status, JSON.stringify(priorPayload), JSON.stringify(result), now, jobId);
    } else {
      ledger.db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, worker_id=COALESCE(?,worker_id), updated_at=? WHERE job_id=?')
        .run(status, JSON.stringify(priorPayload), JSON.stringify(result), terminal, now, jobId);
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-rejected',
      payload: { op, step, signal, error, provider: model.provider, model: model.target, terminal,
        effectState, attemptConsumed: !reusable, retryable: reusable, leasesReleased, providerHealth,
        terminalClosed, ...(closed ? { closed } : {}), ...(createRecovery ? { createRecovery } : {}), ...(trust ? { trust } : {}),
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
    if (incident && !authFailure) {
      ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)")
        .run(`inc-${newToken().slice(0, 12)}`, job.workflow_id, op,
          `[infra-provider] ${JSON.stringify({ provider: model.provider, signal: signal ?? error ?? null, jobId,
            ...(providerHealth?.status === 'unavailable' ? { circuitUntil: providerHealth.expiresAt ?? null, recover: providerRecoverCommand(providerHealth.provider) } : {}) })}`, now);
    }
  });
  return { status, effectState, attemptConsumed: !reusable, retryable: reusable, providerHealth,
    terminalClosed, ...(closed ? { closed } : {}) };
};

// gate-auto-approved: one event per launch gate the runtime answered
// (scripts/agent/lib.mjs awaitReadiness), whether or not the gate then cleared.
function recordGateAnswers(ledger, { workflowId, entityType, entityId, provider, terminal, answers }) {
  const sent = (Array.isArray(answers) ? answers : []).filter((a) => a?.keystroke);
  if (!sent.length) return;
  ledger.transaction(() => {
    for (const a of sent) ledger.appendEvent({ workflowId, entityType, entityId, kind: 'gate-auto-approved',
      payload: { gate: a.gate, keystroke: a.keystroke, answered: a.answered === true, cleared: a.cleared === true,
        provider, terminal, ...(a.reason ? { reason: a.reason } : {}) } });
  });
}

/* ------------------------------------------------------ op IPC helpers */
// §6 admission for an op dispatch. The durable fence is taken BEFORE anything
// launches, on both launch kinds: one `path:<normalized owned_path>` resource
// per payload.owned_paths entry (capacity 1 = exclusive write ownership —
// seeded OR IGNORE so an operator-declared capacity is never overwritten),
// then reserveTwoPhase flips the job queued → leased with its fencing token
// and registers the ledger on the machine arbiter. The arbiter is REQUIRED by
// reserveTwoPhase's signature even for repo-only leases (it registers the
// ledger and would hold any machineNeeds) — the same openMachine handle
// settle already uses. An open failure returns !ok: a dispatch that cannot
// fence must not launch.
// Bounds a crashed worker's fence; settle releases early. One authority:
// modules/models/runtimes.yaml allocation.dispatchLeaseTtlMs.
const DISPATCH_LEASE_TTL_MS = allocationMs('dispatchLeaseTtlMs');
// engine/admission.mjs owns owned-path normalization and the capacity-1 lease
// request per minimal prefix — the same function the ledger's conflict finder
// resolves paths with, so a request and a held lease can never disagree.
const opLeaseRequests = (payload) => ownedPathLeaseRequests((payload.owned_paths ?? []).filter(Boolean));

const reserveOpLeases = (ledger, job, payload, { ttlMs = DISPATCH_LEASE_TTL_MS } = {}) => {
  const db = ledger.db, leases = opLeaseRequests(payload);
  // Declare the path resources; reserveTwoPhase then flips the job
  // queued → leased with its fencing token — it only admits 'queued'.
  ledger.transaction(() => {
    for (const l of leases) db.prepare('INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES(?,1)').run(l.resourceKey);
  });
  let machine;
  try { machine = openMachine({ file: machineFileFor() }); }
  catch (e) { return { ok: false, reasons: [`machine arbiter unavailable: ${String(e?.message ?? e)}`], machineUnavailable: true }; }
  try {
    return reserveTwoPhase(ledger, machine, {
      job: {
        jobId: job.job_id, workflowId: job.workflow_id, opId: job.op_id,
        attempt: job.attempt, generation: job.generation, kind: job.kind, role: job.role ?? null,
      },
      leases, ttlMs,
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
const fileContract = (db, { job, op, dispatchId, markdown, context, now }) =>
  db.prepare('INSERT OR REPLACE INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(job.workflow_id, op, job.attempt, dispatchId, markdown, JSON.stringify(context ?? null), now);

function cmdDispatch(ledger, args, repo) {
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (SETTLED.includes(job.status)) throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
  if (job.status !== 'queued') throw Object.assign(new Error(`job ${jobId} cannot dispatch while ${job.status}; settle/reconcile the current worker first`), { code: 'job-not-queued' });
  const priorWorker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
  if (priorWorker?.connected && priorWorker?.writable) {
    throw Object.assign(new Error(`job ${jobId} is queued in the ledger but exact worker ${priorWorker.terminalHandle} is still live; reconcile it instead of dispatching a duplicate`), {
      code: 'job-live-worker', worker: priorWorker,
    });
  }
  const payload = jobPayloadOf(job);
  const op = job.op_id ?? payload.opId;
  if (!op) throw Object.assign(new Error(`job ${jobId} carries no op identity`), { code: 'job-no-op' });

  // Concurrency admission, before the packet and before any Orca call: the
  // workflow may hold min(budgets.maxOps, maxParallelOps) operations at once
  // and a job above that line stays queued rather than launching
  // (engine/admission.mjs admitOpSlot). Pool maxParallel is a separate fence
  // route already applies; this one is the workflow's own ceiling.
  const heldBy = ownerGateOf(openOwnerGates(db, job.workflow_id), job);
  if (heldBy) {
    const out = { ok: false, jobId, op, reason: 'owner-gate', incident: heldBy.incidentId };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): owner-gate — incident ${heldBy.incidentId} holds it until the Kernel resolves it; job stays queued`, args.json);
    process.exit(1);
  }
  const peerHeldBy = ownerGateOf(openPeerWaits(db, job.workflow_id), job);
  if (peerHeldBy) {
    const out = { ok: false, jobId, op, reason: PEER_WAIT, incident: peerHeldBy.incidentId, peer: peerHeldBy.peer };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): peer-wait — incident ${peerHeldBy.incidentId} holds it until peer ${peerHeldBy.peer} lands what it waits on and the wait is resolved; job stays queued`, args.json);
    process.exit(1);
  }
  const slots = opSlotAdmission(db, job.workflow_id, { excludeJobId: jobId });
  if (!slots.ok) {
    const out = { ok: false, jobId, op, reason: 'max-ops', slots };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): max-ops — ${slots.running} operation(s) already hold a slot at ceiling ${slots.ceiling} (${slots.ceilingSource}); job stays queued`, args.json);
    process.exit(1);
  }

  // Data prerequisites, before the packet and before any Orca call: a record
  // the op must read that the binding names but the repository lacks, or a
  // bound record whose dependsOn is not done where the op requires done. A
  // dispatch that can only end blocked on them is a wasted launch.
  const briefForAdmission = (() => {
    try { return parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8')); } catch { return null; }
  })();
  const prerequisites = briefForAdmission ? checkPrerequisites({ brief: briefForAdmission, payload, repo }) : { unmet: [], unknown: [] };
  if (prerequisites.unmet.length) {
    const out = { ok: false, jobId, op, reason: 'prerequisite-unmet', unmet: prerequisites.unmet,
      detail: prerequisiteDetail({ op, jobId, unmet: prerequisites.unmet }) };
    emit(out, `dispatch REFUSED for ${jobId} (${op}): prerequisite-unmet — ${out.detail}`, args.json);
    process.exit(1);
  }

  const model = resolveModel(args.model ?? payload.model ?? 'qwen-agent'); // orchestrationDefault: qwen-agent
  if (model.error) throw Object.assign(new Error(model.error), { code: 'model-unknown' });
  const briefAbs = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  const briefExists = fs.existsSync(briefAbs);
  const lackingTools = missingHostTools({ pool: { provider: model.provider }, kind: op });

  // The packet's params are the brief's defaults with the overrides enqueue
  // already validated on top — dispatch resolves, it never re-decides.
  const briefDoc = briefForAdmission ?? parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'));
  const dispatchParams = resolveOpParams(briefDoc, {}).params;
  for (const [name, value] of Object.entries(payload.params ?? {})) if (Object.hasOwn(briefDoc?.params ?? {}, name)) dispatchParams[name] = value;
  const worktree = args.worktree ?? repo;
  const workerCwd = (() => { const abs = path.resolve(repo, worktree); try { return fs.statSync(abs).isDirectory() ? abs : repo; } catch { return repo; } })();
  const placements = (() => {
    try {
      return ownedPathPlacements({ op, payload, ownedPaths: ownedPathsOf(payload), repo, worktree: workerCwd, timeoutMs: allocationMs('settleGit.commandMs') });
    } catch { return []; }
  })();
  // The asks this job's retry lineage already had answered ride in the packet, so an owner-answer
  // retry applies the answer instead of asking again (scripts/kernel/owner-answers.mjs).
  const ownerAnswers = (() => { try { return ownerAnswersOf(db, job); } catch { return []; } })();
  const packet = buildPacket({ job: { ...job, op_id: op }, payload, model, goal: latestGoal(db, job.workflow_id), params: dispatchParams, placements, productLocale: productLocaleFor(repo), ownerAnswers });
  // The law inputs this attempt binds, digested now so survey/status can say
  // when one changed under a settled result (scripts/kernel/input-digests.mjs).
  // A digest failure records nothing rather than refusing the dispatch.
  const inputs = (() => {
    try { return recordInputs(skillRoot, opInputPaths(briefDoc, { params: dispatchParams, mode: payload.mode ?? dispatchParams.mode ?? null })); }
    catch { return null; }
  })();
  // The red checks of this job's own retry lineage - for a cut ordinal its own
  // ordinal, never a sibling slice (scripts/kernel/prior-failures.mjs).
  const priorFailures = priorAttemptFailures(db, { ...job, op_id: op });
  const prompt = buildPrompt(packet, jobId, repo, priorFailures, workerCwd);
  const title = `[Op] ${op}`;
  // The Task display name is `[Op] <op>` — it hangs under its parent, which
  // says the rest. A command terminal is a flat sidebar row with no parent to
  // read, and left untitled it shows the provider's own auto-summary
  // ("devin.exe: Kernel orchestration for…"), so its title carries the
  // attempt and the workflow as well.
  const terminalTitle = `[Op] ${op} a${job.attempt} · ${job.workflow_id}`;
  // The composed command is what a spawn would actually run — card env prefix
  // + credential strip + requirements (the --yolo/dangerous flags). Dry-run
  // prints it so reviewers see the injected flags, not just the profile body.
  // A command-terminal profile without a static command (the Codex
  // profiles) is card-composed: the agent card's terminalFallback supplies the
  // binary, modelArgs/effortArgs carry the routed model + effort, and its
  // bypassArgs make the op unattended — the same composition the Kernel
  // terminal boots with (modules/models/agents/codex.yaml).
  const cardLaunch = model.kind === 'command-terminal' && !model.command
    ? resolveCardLaunchModel({ target: model.target, requestedModel: model.requestedModel, payload })
    : null;
  const spawnCmd = model.kind === 'command-terminal'
    ? (cardLaunch?.error
      ? { error: `${model.target} has no launch model: ${cardLaunch.error}` }
      : buildSpawnCommand({ provider: model.provider, command: model.command,
        model: cardLaunch?.modelId ?? null, effort: cardLaunch?.effort ?? null, env: opLaunchEnv(jobId) }))
    : null;
  const composedCommand = spawnCmd?.command ?? model.command;
  const orcaCommands = model.kind === 'command-terminal'
    ? [
      { step: 'run', argv: ['orchestration', 'run-create', '--objective', `[Workflow] ${job.workflow_id}`, '--from', '<kernel-terminal>', '--json'], note: 'created once per workflow; later operations reuse it' },
      { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.attempt}`, '--display-name', title, '--spec', '<prompt>', '--parent', '<kernel-terminal>', '--from', '<kernel-terminal>', '--json'] },
      { step: 'create', argv: ['terminal', 'create', '--worktree', worktree, '--title', terminalTitle, '--command', composedCommand ?? '<command>', '--json'] },
      { step: 'read', argv: ['terminal', 'read', '--terminal', '<handle>', '--screen', '--json'], note: 'readiness — verify the prompt landed before sending' },
      { step: 'dispatch', argv: ['orchestration', 'dispatch', '--task', '<operation-task-id>', '--to', '<handle>', '--from', '<kernel-terminal>', '--run', '<workflow-run-id>', '--return-preamble', '--json'] },
      { step: 'send', argv: ['terminal', 'send', '--terminal', '<handle>', '--text', '<dispatch-preamble>', '--enter', '--json'] },
    ]
    : [
      { step: 'task', argv: ['orchestration', 'task-create', '--run', '<workflow-run-id>', '--task-title', `${op} #${job.attempt}`, '--display-name', title, '--spec', '<prompt>', '--parent', '<kernel-terminal>', '--from', '<kernel-terminal>', '--json'] },
      { step: 'worker-start', argv: ['orchestration', 'worker-start', '--task', '<task-id>', '--worktree', worktree, '--agent', model.provider ?? '<agent>', '--model', '<resolved-model-id>', '--display-name', title, '--run', '<workflow-run-id>', '--from', '<kernel-terminal>', '--json'], note: `${model.target} is a managed agent; worker-start owns dispatch/injection and must not be followed by orchestration dispatch` },
    ];

  if (!args.spawn) {
    const out = {
      ok: true, spawned: false, jobId, packet, prompt,
      leases: opLeaseRequests(payload),
      spawnCommand: spawnCmd
        ? { command: spawnCmd.command ?? null, commandSource: spawnCmd.commandSource ?? null,
          ...(cardLaunch && !cardLaunch.error ? { model: cardLaunch.modelId, effort: cardLaunch.effort, modelSource: cardLaunch.source } : {}),
          ...(spawnCmd.error ? { error: spawnCmd.error } : {}) }
        : { command: null, error: `${model.target} is launch kind '${model.kind}' — composed by 'orca orchestration worker-start', not terminal create` },
      orca: { worktree, title, terminalTitle, launchKind: model.kind, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
      ...(briefExists ? {} : { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
      ...(lackingTools.length ? { toolUnavailable: `${model.target} lacks host tool ${lackingTools.join(', ')} — spawn will refuse tool-unavailable` } : {}),
    };
    emit(out, [
      `PACKET job=${jobId} op=${op} model=${model.target} (${model.kind})`,
      `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
      `  records: ${packet.context.records.join(', ') || '(none)'}`,
      ...(packet.context.cut ? [`  cut: ${packet.context.cut.id} ${packet.context.cut.ordinal}/${packet.context.cut.total}`] : []),
      ...(packet.context.owner_answers ? [`  owner_answers: ${packet.context.owner_answers.map((a) => `${a.dispatchId} -> ${a.chosen?.label ?? a.chosen?.index ?? 'answered'} (${a.answeredBy})`).join(', ')}`] : []),
      `  owned_paths: ${packet.context.owned_paths.map((p) => renderOwnedPath(p, workerCwd)).join(', ') || '(none)'}`,
      `  spawn command: ${out.spawnCommand.command ?? `(none — ${out.spawnCommand.error})`}`,
      ...(out.spawnCommand.commandSource ? [`  command source: ${out.spawnCommand.commandSource}`] : []),
      '  orca commands:', ...out.orca.commands.map((c) => `    $ ${c.cli}`),
      '  (dry run — pass --spawn to launch)',
    ].join('\n'), args.json);
    return;
  }

  if (!briefExists) throw Object.assign(new Error(`spawn refused — no brief at modules/ops/ops/${op}.yaml`), { code: 'brief-missing' });
  // A route persisted before host tools gated routing, an unrouted job's
  // default pool or a --model override can name an agent without a tool the op
  // cannot run without. That launch is a wasted dispatch; nothing is reserved.
  if (lackingTools.length) {
    const detail = `${model.target} (agent ${model.provider}) lacks host tool ${lackingTools.join(', ')} that ${op} requires (route.riskHints host-tool-required on modules/ops/ops/${op}.yaml). Re-run api route --job ${jobId} — it now selects only agents whose card lists the tool — then dispatch again${args.model ? ' without --model' : ''}. The job stays queued.`;
    emit({ ok: false, jobId, op, reason: 'tool-unavailable', tools: lackingTools, model: model.target, detail },
      `dispatch REFUSED for ${jobId} (${op}): tool-unavailable — ${detail}`, args.json);
    process.exit(1);
  }
  // A route decision may have been persisted before another job proves the
  // shared provider credential is dead. Re-check the durable provider circuit
  // before taking leases or creating an Orca Task so an already-routed sibling
  // pool cannot slip through the circuit.
  const providerHealth = providerHealthOf(db, model.provider);
  if (providerHealth) {
    const error = `provider ${providerHealth.failureKind ?? 'auth'} unavailable (${providerHealth.provider}); circuit open until ${providerHealth.expiresAt ?? 'explicit recovery'}`;
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step: 'provider-health', error, effectState: 'none', details: providerHealth,
      providerHealthEvidence: providerHealth,
    });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, providerHealth },
      `dispatch REJECTED for ${jobId} (provider-health): ${error}; logical attempt retained; once the credential is fixed the Kernel runs ${providerRecoverCommand(providerHealth.provider)}`, args.json);
    process.exit(1);
  }
  // §6 admission — the repo-path leases and the job's fencing token are taken
  // BEFORE anything launches, for both launch kinds. A refusal (a live lease
  // already owns a path, or the machine arbiter can't open) is a dispatch
  // rejection: the worker must never be what discovers the write set was
  // already taken, and an unfenced dispatch is exactly what this layer kills.
  const leaseTtlMs = Number(args['lease-ttl'] ?? payload.leaseTtlMs ?? 0) || DISPATCH_LEASE_TTL_MS;
  let reserve;
  try {
    reserve = reserveOpLeases(ledger, job, payload, { ttlMs: leaseTtlMs });
  } catch (e) {
    // Identity/status refusal (job already leased/running, or row drift): the
    // job is left untouched — an operator error, not a dispatch rejection.
    const error = String(e?.message ?? e);
    emit({ ok: false, jobId, refused: 'reserve-failed', error }, `dispatch REFUSED for ${jobId}: ${error}`, args.json);
    process.exit(1);
  }
  if (!reserve.ok) {
    const reason = (reserve.reasons ?? [reserve.reason]).filter(Boolean).join('; ') || 'reservation refused';
    rejectDispatch(ledger, job, jobId, op, model, { step: 'reserve', error: reason });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, reserve },
      `dispatch REJECTED for ${jobId} (reserve): ${reason} — job status=failed`, args.json);
    process.exit(1);
  }
  // Managed-agent launch (managed-agent / native-managed-agent): the run →
  // task → worker-start → return-preamble → attest pipeline owns this profile.
  if (MANAGED_KINDS.includes(model.kind)) {
    return cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, worktree, title, reserve, inputs });
  }
  if (model.kind !== 'command-terminal') {
    throw Object.assign(new Error(`spawn refused: ${model.target} is launch kind '${model.kind}' — use 'orca orchestration worker-start' with a Task id (managed-agent path)`), { code: 'managed-agent' });
  }
  // Command-terminal agents still join the workflow's Orca Run. Create the
  // operation Task first, then create/attest the terminal, dispatch that Task
  // to the exact handle and submit Orca's returned preamble. This gives Qwen,
  // Devin and Codex the same durable Kernel → Task → Dispatch hierarchy as managed
  // workers without pretending Orca owns their process lifecycle.
  if (cardLaunch?.error) {
    const error = `${model.target} has no launch model: ${cardLaunch.error}`;
    rejectDispatch(ledger, job, jobId, op, model, { step: 'route', error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'route', error },
      `dispatch REJECTED for ${jobId} (route): ${error}`, args.json);
    process.exit(1);
  }
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) {
    rejectDispatch(ledger, job, jobId, op, model, { step: 'run-create', error: run.error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'run-create', error: run.error },
      `dispatch REJECTED for ${jobId} (run-create): ${run.error}`, args.json);
    process.exit(1);
  }
  const { runId, kernelHandle } = run;
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.attempt, kernelHandle });
  if (!task?.ok || !task.taskId) {
    const error = task?.error ?? 'task-create returned no taskId';
    rejectDispatch(ledger, job, jobId, op, model, { step: 'task-create', error });
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, step: 'task-create', error },
      `dispatch REJECTED for ${jobId} (task-create): ${error}`, args.json);
    process.exit(1);
  }
  const taskId = task.taskId;

  // spawnAgent assembles the command and attests readiness/model, but prompt
  // delivery is delayed until Orca returns this Task's authoritative preamble.
  // A card-composed launch pins the routed model and effort on the command
  // line and spawnAgent attests the model from the rendered terminal before
  // the Task is dispatched to it.
  const spawned = spawnAgent({
    provider: model.provider, worktree, title: terminalTitle, prompt: null,
    command: model.command, dispatchId: jobId,
    model: cardLaunch?.modelId ?? null, effort: cardLaunch?.effort ?? null,
    env: opLaunchEnv(jobId),
  });
  const handle = spawned.terminal ?? null;
  recordGateAnswers(ledger, { workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
    provider: model.provider, terminal: handle, answers: spawned.gateAnswers });
  const spawn = { step: spawned.step, error: spawned.error, signal: spawned.signal ?? null, command: spawned.command, handle,
    ...(spawned.trust ? { trust: spawned.trust } : {}), ...(spawned.gateAnswers ? { gateAnswers: spawned.gateAnswers } : {}),
    ...(spawned.gate ? { gate: spawned.gate, remedy: spawned.remedy ?? null } : {}),
    ...(spawned.createRecovery ? { createRecovery: spawned.createRecovery } : {}) };
  spawn.ok = spawned.ok === true;
  if (!spawn.ok) {
    // dispatch-rejected: the job must NEVER sit 'running' on a dead spawn.
    // Job → failed with a typed result, lease rows released, one event — and
    // for attestation rejections a typed infra-provider incident so survey
    // sees it without parsing events. Terminal is already closed by spawnAgent.
    const reason = (spawned.gate ? spawned.error : null) ?? spawned.signal ?? spawned.error ?? `spawn failed at ${spawned.step}`;
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step: spawned.step, signal: spawned.signal ?? null, error: spawned.error ?? null,
      terminal: handle, closeTerminal: handle, alreadyClosed: true,
      incident: spawned.step === 'attestation', details: spawned,
      createRecovery: spawned.createRecovery ?? null, trust: spawned.trust ?? null,
    });
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, spawn: { ...spawn, reason } };
    emit(out, `dispatch REJECTED for ${jobId} (${spawned.step}): ${reason} — job status=${rejection.status}, terminal closed`, args.json);
    process.exit(1);
  }

  let artifact = null;
  const rejectCommand = ({ step, error = null, signal = null, dispatchId = null, incident = false, details = null }) => {
    cleanupDeliveryArtifact(artifact);
    // The terminal this attempt created is closed by rejectDispatch, in the
    // same step that records the refusal — a refused op never keeps a row in
    // the sidebar (fable.md orca-hierarchy: [Op] interface.audit "Idle").
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId ?? handle, closeTerminal: handle,
      incident, effectState: 'none', details, createRecovery: spawned.createRecovery ?? null, trust: spawned.trust ?? null,
    });
    const reason = signal ?? error ?? `command-terminal dispatch failed at ${step}`;
    emit({ ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection, step, dispatchId, terminal: handle, error: reason },
      `dispatch REJECTED for ${jobId} (${step}): ${reason} — terminal closed=${rejection.terminalClosed}`, args.json);
    process.exit(1);
  };

  const dispatched = orchDispatch({ task: taskId, to: handle, from: kernelHandle, run: runId });
  const dispatchId = dispatched?.dispatchId ?? null;
  if (!dispatched?.ok || !dispatchId || !dispatched.preamble) {
    return rejectCommand({ step: 'dispatch', dispatchId, error: dispatched?.error ?? 'orchestration dispatch returned no dispatch/preamble' });
  }
  const adapter = spawnCmd?.adapter;
  const sent = deliverPrompt({ handle, adapter, prompt: dispatched.preamble, worktree, dispatchId });
  artifact = sent.artifact ?? null;
  if (!sent.ok) return rejectCommand({ step: 'send', dispatchId, error: sent.error ?? 'terminal send failed' });
  const submitted = awaitSubmission(handle, adapter, { sentText: sent.sentText ?? dispatched.preamble });
  if (!submitted.ok) return rejectCommand({ step: 'submission', dispatchId, signal: submitted.signal ?? null,
    error: submitted.reason, details: submitted });
  const attested = awaitAttestation(handle, adapter);
  if (!attested.ok) return rejectCommand({ step: 'attestation', dispatchId, signal: attested.signal,
    error: `attestation rejected: ${attested.signal}`, incident: true, details: attested });
  cleanupDeliveryArtifact(artifact);
  artifact = null;
  const shown = dispatchShow({ task: taskId, from: kernelHandle });
  if (!shown?.ok || shown.assigneeHandle !== handle) {
    return rejectCommand({ step: 'dispatch-show', dispatchId, error: shown?.error ?? `expected assignee ${handle}, got ${shown?.assigneeHandle ?? 'none'}` });
  }

  payload.orca = { ...(payload.orca ?? {}), runId, taskId, dispatchId, agentTerminalHandle: handle };
  payload.agent = model.provider;
  payload.provider = model.provider;
  payload.model = model.target;
  if (cardLaunch) {
    payload.modelId = spawned.modelAttested ?? cardLaunch.modelId;
    payload.effort = cardLaunch.effort ?? null;
  }
  payload.hierarchy = payload.hierarchy ?? {
    schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
    parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
    workflowId: job.workflow_id, jobId, opId: op,
    attempt: job.attempt, generation: job.generation,
  };
  payload.hierarchy.runtime = {
    ...(payload.hierarchy.runtime ?? {}), host: 'orca',
    agent: model.provider, provider: model.provider,
    model: payload.modelId ?? null, profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: handle,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  ledger.transaction(() => {
    const now = Date.now();
    fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      // delivery.text is exactly what the terminal was given (Orca preamble +
      // Task spec, or the file-reference line): status/nudge/observe find an
      // unsubmitted paste by it (inc-06aeecf432f1).
      context: { packet, worktree, model: model.target, orca: payload.orca, hierarchy: payload.hierarchy, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing }, inputs, delivery: { text: sent.sentText ?? dispatched.preamble } },
    });
    db.prepare("UPDATE jobs SET status='running', worker_id=?, payload_json=?, result_json=NULL, updated_at=? WHERE job_id=?")
      .run(handle, JSON.stringify(payload), now, jobId);
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, generation: job.generation });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, terminal: handle, dispatch: dispatchId, runId, taskId, model: model.target, ...(cardLaunch ? { modelId: payload.modelId, effort: payload.effort } : {}), ...(spawned.createRecovery ? { createRecovery: spawned.createRecovery } : {}), ...(spawned.trust ? { trust: spawned.trust } : {}), worktree, nodeId: payload.hierarchy.nodeId, parentNodeId: payload.hierarchy.parentNodeId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  });
  const out = { ok: true, jobId, spawned: true, handle, dispatchId, packet, spawn, hierarchy: payload.hierarchy,
    orca: { runId, taskId, dispatchId, assignee: handle } };
  emit(out, `dispatched ${jobId} — [Op] ${op} on ${handle} (${model.target}, dispatch ${dispatchId}); job status=running`, args.json);
}

// launch.orca.kind values that take the managed pipeline — profiles write
// 'managed-agent', agent cards write 'native-managed-agent'; both mean
// orchestration worker-start, never terminal create.
const MANAGED_KINDS = ['native-managed-agent', 'managed-agent'];

// One Orca Run per workflow, bound to the dedicated Kernel terminal. The Run
// is created lazily by the first operation so Kernel boot stays independent of
// launcher context. Every operation Task in that Run is therefore a semantic
// child of the Kernel coordinator even when its terminal is a peer tab in the
// same worktree.
function ensureWorkflowRun(ledger, { job, jobId, payload }, { bind = bindWorkflowRun } = {}) {
  const db = ledger.db;
  const kernelJob = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY updated_at DESC LIMIT 1").get(job.workflow_id);
  const kernelPayload = jobPayloadOf(kernelJob);
  const kernelHandle = kernelJob?.worker_id ?? null;
  let runId = kernelPayload?.orca?.runId ?? payload?.orca?.runId ?? null;
  // A durable Run is reused only while Orca names the current Kernel terminal
  // as its coordinator: a restarted Kernel re-binds it once (run-use), and a
  // Run Orca lost is replaced by a new one (orca-runs.mjs bindWorkflowRun).
  let replacedRunId = null;
  if (runId && kernelHandle) {
    const bound = bind({ runId, kernelHandle });
    if (bound.ok) {
      if (bound.action === 'rebound') {
        ledger.transaction(() => ledger.appendEvent({
          workflowId: job.workflow_id, entityType: 'job', entityId: kernelJob.job_id,
          kind: 'run-rebound', payload: { runId, kernelTerminal: kernelHandle, previousCoordinator: bound.previousCoordinator, by: jobId },
        }));
      }
      return { ok: true, runId, kernelJob, kernelPayload, kernelHandle, bound: bound.action };
    }
    if (bound.action !== 'missing') return { ok: false, error: bound.error ?? `run ${runId} could not be bound to ${kernelHandle}`, kernelJob, kernelPayload };
    replacedRunId = runId;
    runId = null;
  }
  if (runId) return { ok: true, runId, kernelJob, kernelPayload, kernelHandle };

  const wf = getWorkflow(db, job.workflow_id);
  const objective = `[Workflow] ${job.workflow_id} — ${wf?.title ?? job.workflow_id}`;
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
        attempt: kernelJob.attempt, generation: kernelJob.generation,
      };
      kernelPayload.hierarchy.runtime = { ...(kernelPayload.hierarchy.runtime ?? {}), host: 'orca', runId };
      db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify(kernelPayload), now, kernelJob.job_id);
    } else {
      payload.orca = { ...(payload.orca ?? {}), runId };
      payload.hierarchy = payload.hierarchy ?? {
        schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
        parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
        workflowId: job.workflow_id, jobId, opId: job.op_id,
        attempt: job.attempt, generation: job.generation,
      };
      payload.hierarchy.runtime = { ...(payload.hierarchy.runtime ?? {}), host: 'orca', runId };
      db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify(payload), now, jobId);
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'run-created', payload: { runId, kernelTerminal: kernelJob?.worker_id ?? null, storedOn: kernelJob ? kernelJob.job_id : jobId, ...(replacedRunId ? { replacedRunId } : {}) },
    });
  });
  return { ok: true, runId, kernelJob, kernelPayload, kernelHandle: kernelJob?.worker_id ?? null };
}

// Every operation Task is created in the workflow's Run with the CURRENT
// kernel terminal as both `from` (who issues it) and `parent` (whose child it
// is). `from` alone left the Orca tree to be inferred from the Run, so a Task
// whose Run was bound to a replaced kernel terminal fell out to the sidebar
// root (fable.md orca-hierarchy, root cause 3).
const createOperationTask = ({ runId, prompt, op, title, attempt, kernelHandle }) =>
  taskCreate({
    run: runId,
    spec: prompt,
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
function cmdDispatchManaged(ledger, args, { job, jobId, payload, op, model, packet, prompt, worktree, title, reserve, inputs = null }) {
  const db = ledger.db;

  const reconcileFailure = (effectState, dispatchId) => {
    if (effectState === 'none') return { effectState: 'none', observation: null, cleanup: null };
    if (effectState === 'unknown') {
      if (!dispatchId) return { effectState: 'unknown', observation: null, cleanup: null };
      let observation;
      try { observation = workerShow({ dispatch: dispatchId }); }
      catch (e) { observation = { ok: false, error: String(e?.message ?? e) }; }
      if (!observation?.ok || !['failed', 'stopped', 'released'].includes(observation.state))
        return { effectState: 'unknown', observation, cleanup: null };
      const cleanup = cleanupManagedWorker(dispatchId);
      return { effectState: cleanup.effectState, observation, cleanup };
    }
    const cleanup = cleanupManagedWorker(dispatchId);
    return { effectState: cleanup.effectState, observation: null, cleanup };
  };

  let trust = null;
  const reject = ({ step, signal = null, error = null, dispatchId = null, incident = false,
    effectState = 'none', details = null }) => {
    const reconciliation = reconcileFailure(effectState, dispatchId);
    const rejection = rejectDispatch(ledger, job, jobId, op, model, {
      step, signal, error, terminal: dispatchId, incident,
      effectState: reconciliation.effectState, details, settled: reconciliation.cleanup, trust,
    });
    const reason = signal ?? error ?? `managed dispatch failed at ${step}`;
    const out = { ok: false, jobId, rejected: 'dispatch-rejected', packet, rejection,
      managed: { step, dispatchId, effectState: reconciliation.effectState,
        ...(reconciliation.observation ? { observation: reconciliation.observation } : {}),
        ...(reconciliation.cleanup ? { cleanup: reconciliation.cleanup } : {}) } };
    emit(out, `dispatch REJECTED for ${jobId} (${step}): ${reason} — job status=${rejection.status}, effect=${reconciliation.effectState}${reconciliation.cleanup ? `, worker ${dispatchId} cleanup stop=${reconciliation.cleanup.stop?.ok} release=${reconciliation.cleanup.release?.ok}` : ''}`, args.json);
    process.exit(1);
  };

  // 1. Launch model: the `api route` decision on the job payload wins; without
  // it resolveLaunchModel picks the pool's pin for the job's difficulty.
  let modelId = payload.modelId ?? null;
  let effort = payload.effort ?? null;
  if (!modelId) {
    const resolved = resolveLaunchModel(model.target, payload.difficulty ?? 'medium');
    if (!resolved || resolved.error || !resolved.modelId) {
      return reject({ step: 'route', error: resolved?.error ?? 'resolveLaunchModel returned no modelId' });
    }
    modelId = resolved.modelId;
    effort = resolved.effort ?? null;
  }

  // 2. Run id — one workflow Run, with the Kernel terminal as coordinator.
  const run = ensureWorkflowRun(ledger, { job, jobId, payload });
  if (!run.ok) return reject({ step: 'run-create', error: run.error });
  const { runId, kernelHandle } = run;

  // 3. Task — the operation's contract. The spec is the rendered packet prompt
  // (the same text a command-terminal launch would have sent).
  const task = createOperationTask({ runId, prompt, op, title, attempt: job.attempt, kernelHandle });
  if (!task?.ok || !task.taskId) {
    return reject({ step: 'task-create', error: task?.error ?? 'task-create returned no taskId' });
  }
  const taskId = task.taskId;

  // 4a. Pre-trust the worktree the managed worker launches in (trust.mjs):
  // the owner never answers a Claude/Codex launch prompt.
  try { trust = ensureLaunchTrust({ agent: model.provider, cwd: worktree }); }
  catch (e) { trust = { agent: model.provider, paths: [], status: 'failed', errors: [{ error: String(e?.message ?? e) }] }; }

  // 4. worker-start — outcome ok means a ready worker (calls.yaml classify:
  // exit 0 + result.state 'ready'). Anything else, including a receipt with no
  // dispatchId, is a rejection; a partial effect is stopped + released.
  const started = workerStart({
    task: taskId, worktree, agent: model.provider, model: modelId, effort,
    displayName: title, run: runId, from: kernelHandle,
  });
  const dispatchId = started?.dispatchId ?? null;
  if (started?.ok !== true || (started.outcome != null && started.outcome !== 'ok') || !dispatchId) {
    return reject({
      step: 'worker-start', dispatchId,
      error: started?.error ?? `worker-start outcome=${started?.outcome ?? 'none'} state=${started?.state ?? 'none'} effect=${started?.effectState ?? 'none'}`,
      effectState: started?.effectState ?? 'unknown', details: started,
    });
  }

  // 5. Resolve the exact terminal worker-start already dispatched. This is a
  // read/attestation step, not a second orchestration dispatch.
  const shown = dispatchShow({ task: taskId, from: kernelHandle });
  if (!shown?.ok || !shown.assigneeHandle) {
    return reject({ step: 'dispatch-show', error: shown?.error ?? 'dispatch-show returned no assignee', dispatchId,
      effectState: 'partial', details: shown });
  }

  // Managed workers created inside an existing worktree receive Orca's
  // default `worker-task_<id>` terminal title; worker-start creation labels
  // do not apply there. Rename the exact attested assignee so the visible UI
  // preserves the semantic [Op] role. A presentation failure must not stop a
  // healthy worker, but it is returned and persisted for diagnosis.
  let terminalTitle = null;
  try { terminalTitle = terminalRename({ terminal: shown.assigneeHandle, title }); }
  catch (e) { terminalTitle = { ok: false, terminal: shown.assigneeHandle, title, error: String(e?.message ?? e) }; }

  // 6. Attest — the worker's EFFECTIVE agent/model must equal what routing
  // decided. A mismatch is a provider-side defect: rejected with the typed
  // infra-provider incident (same as a terminal attestation rejection).
  const attest = workerShow({ dispatch: dispatchId });
  const eff = attest?.effective ?? {};
  const effAgent = eff.agent ?? eff.provider ?? null;
  const effModel = eff.model ?? eff.modelId ?? null;
  if (attest?.ok !== true || effAgent !== model.provider || effModel !== modelId) {
    return reject({
      step: 'attestation', dispatchId, incident: true,
      signal: `worker attest failed: expected agent=${model.provider} model=${modelId}, got agent=${effAgent} model=${effModel} state=${attest?.state ?? 'none'}`,
      effectState: 'partial', details: attest,
    });
  }

  // 7. Running — worker_id is the Dispatch id (managed workers have no
  // command-terminal handle); payload.managed carries the Orca ids settle needs.
  payload.managed = { runId, taskId, dispatchId, agentTerminalHandle: shown.assigneeHandle,
    terminalTitle: title, terminalTitleApplied: terminalTitle?.ok === true };
  payload.agent = model.provider;
  payload.provider = model.provider;
  payload.model = model.target;
  payload.modelId = modelId;
  payload.effort = effort;
  payload.hierarchy = payload.hierarchy ?? {
    schema: AGENT_HIERARCHY_SCHEMA, nodeId: operationNodeId(jobId),
    parentNodeId: kernelNodeId(job.workflow_id), role: 'operation',
    workflowId: job.workflow_id, jobId, opId: op,
    attempt: job.attempt, generation: job.generation,
  };
  payload.hierarchy.runtime = {
    ...(payload.hierarchy.runtime ?? {}), host: 'orca',
    agent: model.provider, provider: model.provider, model: modelId,
    profile: model.target, runtimePool: model.target,
    runId, taskId, dispatchId, terminalHandle: shown.assigneeHandle,
  };
  const contractMarkdown = buildContractMarkdown({ op, jobId, prompt, packet });
  ledger.transaction(() => {
    const now = Date.now();
    // Same contract-first order as the terminal path: the contracts row is
    // the dispatch authority; dispatch_id is the worker's Dispatch id.
    fileContract(db, {
      job, op, dispatchId, markdown: contractMarkdown, now,
      context: { packet, worktree, model: model.target, managed: payload.managed, hierarchy: payload.hierarchy, lease: { token: reserve.leaseToken, expiresAt: reserve.expiresAt, fencing: reserve.fencing }, inputs },
    });
    db.prepare("UPDATE jobs SET status='running', worker_id=?, payload_json=?, result_json=NULL, updated_at=? WHERE job_id=?")
      .run(dispatchId, JSON.stringify(payload), now, jobId);
    transitionWorkflowToRunning(ledger, { workflowId: job.workflow_id, now, generation: job.generation });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-dispatched',
      payload: { op, dispatch: dispatchId, model: model.target, worktree, managed: true, runId, taskId, modelId, ...(trust ? { trust } : {}), parentNodeId: payload.hierarchy.parentNodeId, nodeId: payload.hierarchy.nodeId, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
    });
  });
  const out = {
    ok: true, jobId, spawned: true, dispatchId, packet,
    managed: { runId, taskId, dispatchId, modelId, effort, assignee: shown.assigneeHandle, terminalTitle },
    hierarchy: payload.hierarchy,
  };
  emit(out, `dispatched ${jobId} — [Op] ${op} managed worker ${dispatchId} (${model.target}/${modelId}, task ${taskId}); job status=running`, args.json);
}

/* ----------------------------------------------------------- reconcile */
// `reconcile --retry-lineage`: re-derive a QUEUED job's payload.retry from the
// predecessor enqueue should have chained it to (retryLineageFor — for a cut,
// the same op + cut id + ordinal). Only a row that never crossed the dispatch
// boundary may be rewritten: no contract, report or check for its attempt, no
// dispatch/worker binding in the payload, no held lease and no dispatch-side
// event. Anything else is history, and history is never rewritten.
const DISPATCH_EVENT_KINDS = ['op-dispatched', 'dispatch-rejected', 'dispatch-reconciled', 'live-worker-reconciled',
  'report-filed', 'report-consumed', 'checks-recorded', 'op-settled', 'op-worker-nudged'];
const dispatchEvidenceOf = (db, job, payload) => {
  const key = [job.workflow_id, job.op_id, job.attempt];
  const evidence = [];
  if (db.prepare('SELECT 1 FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(...key)) evidence.push('contract');
  if (db.prepare('SELECT 1 FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? LIMIT 1').get(...key)) evidence.push('report');
  if (db.prepare('SELECT 1 FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?').get(...key)) evidence.push('checks');
  if (db.prepare('SELECT 1 FROM leases WHERE job_id=? LIMIT 1').get(job.job_id)) evidence.push('lease');
  if (job.worker_id) evidence.push('worker');
  if (payload.managed || payload.orca || payload.hierarchy?.runtime?.dispatchId || payload.hierarchy?.runtime?.terminalHandle
    || (Array.isArray(payload.rejectedDispatches) && payload.rejectedDispatches.length)) evidence.push('dispatch-binding');
  const events = db.prepare(`SELECT DISTINCT kind FROM events WHERE workflow_id=? AND entity_type='job' AND entity_id=?
    AND kind IN (${DISPATCH_EVENT_KINDS.map(() => '?').join(',')})`).all(job.workflow_id, job.job_id, ...DISPATCH_EVENT_KINDS);
  for (const { kind } of events) evidence.push(`event:${kind}`);
  return evidence;
};
function reconcileRetryLineage(ledger, args, job) {
  const db = ledger.db, jobId = job.job_id;
  if (job.status !== 'queued') {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --retry-lineage rewrites only a queued job that was never dispatched`), { code: 'retry-lineage-not-queued' });
  }
  const payload = jobPayloadOf(job);
  const evidence = dispatchEvidenceOf(db, job, payload);
  if (evidence.length) {
    throw Object.assign(new Error(`job ${jobId} was dispatched (${evidence.join(', ')}); its retry lineage is history and is never rewritten`), { code: 'retry-lineage-dispatched', evidence });
  }
  const cut = payload.cut?.id != null && payload.cut?.ordinal != null ? payload.cut : null;
  const before = payload.retry ?? null;
  const after = retryLineageFor(db, { workflowId: job.workflow_id, op: job.op_id, cut, attempt: job.attempt });
  if (JSON.stringify(before) === JSON.stringify(after)) {
    const out = { ok: true, jobId, repaired: false, attempt: job.attempt, cut, retry: after };
    emit(out, `reconcile ${jobId}: retry lineage already correct (retryOf ${after?.retryOf ?? after?.resumeOf ?? 'none'})`, args.json);
    return;
  }
  ledger.transaction(() => {
    const now = Date.now();
    const next = { ...payload };
    if (after) next.retry = after; else delete next.retry;
    db.prepare("UPDATE jobs SET payload_json=?,updated_at=? WHERE job_id=? AND status='queued'").run(JSON.stringify(next), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'retry-lineage-repaired', payload: { attempt: job.attempt, cut, before, after },
    });
  });
  const out = { ok: true, jobId, repaired: true, attempt: job.attempt, cut, before, after };
  emit(out, `reconciled ${jobId}: retry lineage ${before?.retryOf ?? 'none'} -> ${after?.retryOf ?? after?.resumeOf ?? 'none'} (businessAttempt ${before?.businessAttempt ?? '-'} -> ${after?.businessAttempt ?? '-'})`, args.json);
}

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
  const reaped = reapIfStillLive(db, job, payload, handle);
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
    db.prepare("UPDATE jobs SET status='cancelled', result_json=?, updated_at=? WHERE job_id=? AND status='queued'")
      .run(JSON.stringify({ verdict: 'dropped', reason, at: now }), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'job-dropped', payload: { op: job.op_id, attempt: job.attempt, reason, cut: payload.cut ?? null, waiting },
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
const closeDeadWorkerTerminal = (ledger, job, handle) => {
  if (!handle) return null;
  // A repeat after the close landed is a no-op, not a second close event.
  const done = ledger.db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='dead-worker-terminal-closed'").all(job.job_id)
    .map((row) => parseJson(row.payload_json, {}) ?? {}).find((p) => p.attempt === job.attempt && p.handle === handle && p.closed === true);
  if (done) return { handle, closed: true, proof: done.proof ?? null, alreadyClosed: true };
  const closed = bestEffort(() => closeExitedTerminal(handle)) ?? null;
  if (closed?.proof && closed.proof !== 'gone') {
    ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id, kind: 'dead-worker-terminal-closed',
      payload: { opId: jobOpOf(job), attempt: job.attempt, ...closed } });
  }
  return closed;
};
const closedNote = (closed) => !closed ? ''
  : closed.closed ? `; terminal ${closed.handle} closed (${closed.proof}${closed.shellPrompt ? ` '${closed.shellPrompt}'` : ''})`
  : closed.proof === 'gone' ? '' : `; terminal ${closed.handle} left open (${closed.reason ?? closed.error ?? 'close refused'})`;
function reconcileDeadWorker(ledger, args, job, repo) {
  const db = ledger.db, jobId = job.job_id, op = jobOpOf(job), payload = jobPayloadOf(job);
  const prior = parseJson(job.result_json ?? '', {}) ?? {};
  // A job recovered before its shell was closed: the recorded dead terminal of this attempt.
  const recordedDeadTerminal = () => [...(Array.isArray(payload.deadWorkers) ? payload.deadWorkers : [])]
    .reverse().find((entry) => entry?.attempt === job.attempt && entry?.terminal)?.terminal ?? null;
  if (job.status === 'queued' && prior.reason === 'dead-worker-requeued') {
    const terminalClosed = closeDeadWorkerTerminal(ledger, job, recordedDeadTerminal());
    const out = { ok: true, jobId, recovery: 'requeued', alreadyRecovered: true, status: 'queued', attempt: job.attempt, ...(terminalClosed ? { terminalClosed } : {}) };
    emit(out, `reconcile ${jobId}: dead worker already requeued (attempt ${job.attempt})${closedNote(terminalClosed)}`, args.json);
    return;
  }
  if (job.status === 'effect_unknown' && prior.reason === 'dead-worker-fenced') {
    const terminalClosed = closeDeadWorkerTerminal(ledger, job, recordedDeadTerminal());
    const out = { ok: true, jobId, recovery: 'fenced', alreadyRecovered: true, status: 'effect_unknown', attempt: job.attempt, evidence: prior.evidence ?? [], ...(terminalClosed ? { terminalClosed } : {}) };
    emit(out, `reconcile ${jobId}: dead worker already fenced effect_unknown (${(prior.evidence ?? []).join(', ')}); inspect and api settle it${closedNote(terminalClosed)}`, args.json);
    return;
  }
  if (!['running', 'answering'].includes(job.status)) {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; --dead-worker recovers only a running or answering job`), { code: 'dead-worker-not-running' });
  }
  const worker = observeOperationWorker(job, Date.now(), db);
  if (!DEAD_WORKER_LIVENESS.includes(worker.liveness)) {
    const reason = worker.liveness === 'unknown' ? 'worker-liveness-unproven' : 'worker-alive';
    const out = { ok: false, jobId, recovery: null, reason, worker };
    emit(out, `reconcile REFUSED for ${jobId}: ${reason} (liveness ${worker.liveness}${worker.reason ? `: ${worker.reason}` : ''}); nothing written`, args.json);
    process.exit(1);
  }
  const key = [job.workflow_id, op, job.attempt];
  const contract = db.prepare('SELECT dispatch_id,created_at FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(...key) ?? null;
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId
    ?? contract?.dispatch_id ?? job.worker_id ?? null;
  const report = db.prepare(`SELECT dispatch_id,outcome,consumed_at FROM reports WHERE workflow_id=?
      AND (dispatch_id=? OR (op_id=? AND attempt=?)) ORDER BY created_at DESC LIMIT 1`)
    .get(job.workflow_id, reportDispatchIdOf(db, job), op, job.attempt);
  if (report) {
    const next = report.consumed_at ? 'api check, then api settle' : 'api consume-report, api check, then api settle';
    const out = { ok: true, jobId, recovery: 'settle', route: 'settle', worker,
      report: { dispatchId: report.dispatch_id, outcome: report.outcome, consumed: Boolean(report.consumed_at) }, next };
    emit(out, `reconcile ${jobId}: the dead worker filed report ${report.dispatch_id} (${report.outcome}); nothing written - ${next}`, args.json);
    return;
  }

  const evidence = [];
  if (db.prepare('SELECT 1 FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?').get(...key)) evidence.push('checks');
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
  const priorDeaths = (payload.deadWorkers ?? []).filter((entry) => entry?.attempt === job.attempt && entry?.recovery === 'requeued').length;
  if (priorDeaths >= DEAD_WORKER_REQUEUE_LIMIT) evidence.push(`infra-retries-exhausted:${priorDeaths}`);
  const recovery = evidence.length ? 'fenced' : 'requeued';
  const recorded = evidence.length > EVIDENCE_CAP ? [...evidence.slice(0, EVIDENCE_CAP), `+${evidence.length - EVIDENCE_CAP} more`] : evidence;
  const workerProof = { terminal: worker.terminalHandle, liveness: worker.liveness, ...(worker.errorCode ? { errorCode: worker.errorCode } : {}),
    terminalStatus: worker.terminalStatus ?? null };
  const pathProof = paths.provable
    ? { provable: true, since: paths.since ?? null, repos: (paths.repos ?? []).map((r) => ({ repo: r.repo, paths: r.paths, dirty: r.dirty.length, commits: r.commits.length })) }
    : { provable: false, why: paths.why, ...(paths.error ? { error: String(paths.error).slice(0, 300) } : {}) };

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
      { attempt: job.attempt, dispatchId, ...workerProof, recovery, at: now }];
    if (recovery === 'requeued') {
      machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(jobId).map((r) => r.machine_ref);
      leasesReleased = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
      delete next.managed;
      if (next.orca) { const { dispatchId: d, agentTerminalHandle: h, ...orca } = next.orca; next.orca = orca; }
      if (next.hierarchy?.runtime) {
        const { taskId, dispatchId: d, terminalHandle, ...runtime } = next.hierarchy.runtime;
        next.hierarchy.runtime = runtime;
      }
      result = { reason: 'dead-worker-requeued', effectState: 'none', attemptConsumed: false, retryable: true, dispatchId,
        proof: { worker: workerProof, report: false, checks: false, workerQuestions: 0, riskHints: hints, paths: pathProof,
          priorRequeues: priorDeaths, ...(cleanup ? { cleanup } : {}) }, at: now };
      db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,payload_json=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?")
        .run(JSON.stringify(next), JSON.stringify(result), now, jobId);
    } else {
      result = { reason: 'dead-worker-fenced', effectState: effectEvidence ? 'partial' : 'unknown', attemptConsumed: false, retryable: false,
        dispatchId, evidence: recorded, worker: workerProof, paths: pathProof, at: now };
      db.prepare("UPDATE jobs SET status='effect_unknown',payload_json=?,result_json=?,updated_at=? WHERE job_id=?")
        .run(JSON.stringify(next), JSON.stringify(result), now, jobId);
    }
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: recovery === 'requeued' ? 'dead-worker-requeued' : 'dead-worker-fenced',
      payload: { opId: op, attempt: job.attempt, dispatchId, worker: workerProof, attemptConsumed: false,
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
  const terminalClosed = closeDeadWorkerTerminal(ledger, job, worker.terminalHandle);
  const out = recovery === 'requeued'
    ? { ok: true, jobId, recovery, status: 'queued', attempt: job.attempt, attemptConsumed: false, effectState: 'none', dispatchId,
      leasesReleased, machineRefsReleased, worker, proof: result.proof, ...(terminalClosed ? { terminalClosed } : {}) }
    : { ok: true, jobId, recovery, status: 'effect_unknown', attempt: job.attempt, effectState: result.effectState, dispatchId,
      evidence: recorded, worker, paths: pathProof, ...(terminalClosed ? { terminalClosed } : {}) };
  emit(out, recovery === 'requeued'
    ? `reconciled ${jobId}: worker ${worker.terminalHandle} is ${worker.liveness} and the attempt proved no effect; same attempt ${job.attempt} queued (leases released: ${leasesReleased}) - route and dispatch it again${closedNote(terminalClosed)}`
    : `reconciled ${jobId}: worker ${worker.terminalHandle} is ${worker.liveness}; fenced effect_unknown on ${recorded.join(', ')} - inspect the evidence and api settle it (fail or blocked), then retry as a new attempt${closedNote(terminalClosed)}`, args.json);
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
function reconcileOrphanKernelJobs(ledger, args) {
  const db = ledger.db, now = Date.now();
  const rows = db.prepare(`SELECT j.job_id,j.workflow_id,j.status,j.worker_id,j.attempt,j.generation,j.payload_json,w.phase,w.archived_at
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
      const changed = db.prepare("UPDATE jobs SET status='cancelled',worker_id=NULL,lease_token=NULL,deadline=NULL,result_json=?,updated_at=? WHERE job_id=? AND status=?")
        .run(JSON.stringify({ reason: 'orphan-kernel-job', workflowPhase: row.phase, archivedAt: row.archived_at ?? null, terminal: row.worker_id ?? null, at: now }), now, row.job_id, row.status).changes;
      if (!changed) { entry.raced = true; return; }
      entry.leasesReleased = db.prepare('DELETE FROM leases WHERE job_id=?').run(row.job_id).changes;
      entry.signalReleased = row.phase === 'finished'
        ? db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(row.workflow_id).changes > 0 : false;
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
    const jobs = db.prepare('SELECT * FROM jobs WHERE workflow_id=?').all(wf.workflow_id);
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
        db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?').run(JSON.stringify({ ...payload, taskClosed }), now, job.job_id);
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
function cmdReconcile(ledger, args, repo = path.resolve(args.repo ?? process.cwd())) {
  if (args['orphan-kernel-jobs']) return reconcileOrphanKernelJobs(ledger, args);
  if (args['orca-tasks']) return reconcileOrcaTasks(ledger, args);
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (args['retry-lineage']) return reconcileRetryLineage(ledger, args, job);
  if (args.drop) return reconcileDrop(ledger, args, job);
  if (args.reap) return reconcileReap(ledger, args, job);
  if (args['dead-worker']) return reconcileDeadWorker(ledger, args, job, repo);
  if (job.status === 'effect_unknown' && parseJson(job.result_json ?? '', {})?.reason === 'dead-worker-fenced') {
    throw Object.assign(new Error(`job ${jobId} was fenced by --dead-worker on effect evidence (${(parseJson(job.result_json, {})?.evidence ?? []).join(', ')}); no host proof can requeue it - inspect the evidence and api settle it fail or blocked, then retry as a new attempt`), { code: 'dead-worker-fenced' });
  }
  const payload = jobPayloadOf(job);
  if (job.status === 'queued') {
    const worker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
    const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? null;
    const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, job.op_id, job.attempt);
    if (worker?.connected && worker?.writable && contract && (!dispatchId || contract.dispatch_id === dispatchId)) {
      const reserve = reserveOpLeases(ledger, job, payload);
      if (!reserve?.ok) {
        throw Object.assign(new Error(`live worker ${worker.terminalHandle} cannot recover its exact lease: ${(reserve?.reasons ?? [reserve?.reason]).filter(Boolean).join('; ') || 'reservation refused'}`), {
          code: 'live-worker-lease-conflict', worker, reserve,
        });
      }
      const workerId = payload.managed?.dispatchId ?? worker.terminalHandle;
      ledger.transaction(() => {
        const now = Date.now();
        const result = { reason: 'live-worker-reconciled', effectState: 'committed', attemptConsumed: false,
          worker: worker.terminalHandle, dispatchId: contract.dispatch_id, leaseToken: reserve.leaseToken, at: now };
        db.prepare("UPDATE jobs SET status='running',worker_id=?,result_json=?,updated_at=? WHERE job_id=?")
          .run(workerId, JSON.stringify(result), now, jobId);
        ledger.appendEvent({
          workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
          kind: 'live-worker-reconciled', payload: { terminal: worker.terminalHandle, dispatchId: contract.dispatch_id,
            attempt: job.attempt, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
        });
      });
      const out = { ok: true, jobId, reconciled: true, status: 'running', attempt: job.attempt,
        effectState: 'committed', worker, dispatchId: contract.dispatch_id, leasesRecovered: reserve.leases?.length ?? opLeaseRequests(payload).length };
      emit(out, `reconciled ${jobId}: reattached live worker ${worker.terminalHandle}; exact leases restored; no duplicate spawned`, args.json);
      return;
    }
    const out = { ok: true, jobId, reconciled: false, alreadyQueued: true, attempt: job.attempt };
    emit(out, `reconcile ${jobId}: already queued (attempt ${job.attempt})`, args.json);
    return;
  }
  if (job.status !== 'effect_unknown') {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; reconcile requires effect_unknown`), { code: 'job-not-reconcilable' });
  }
  // What reconcile must prove no-effect is the launch that left the job
  // effect_unknown — the newest rejected dispatch that is not already settled
  // (payload.rejectedDispatches, where rejectDispatch records the evidence it
  // used to write over managed.dispatchId). Only when no rejection owns this
  // state is the job's own managed binding the thing to reconcile.
  const unsettledRejection = [...(payload.rejectedDispatches ?? [])].reverse()
    .find((entry) => entry?.dispatchId && entry.effectState && entry.effectState !== 'none')?.dispatchId ?? null;
  const dispatchId = unsettledRejection ?? payload.managed?.dispatchId
    ?? (String(job.worker_id ?? '').startsWith('ctx_') || String(job.worker_id ?? '').startsWith('dispatch-') ? job.worker_id : null);
  if (!dispatchId) throw Object.assign(new Error(`job ${jobId} has no managed dispatch identity`), { code: 'dispatch-identity-missing' });

  // An accepted contract or worker report is evidence that the operation may
  // have begun.  Never turn that evidence back into a reusable launch slot.
  const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(job.workflow_id, job.op_id, job.attempt);
  const report = db.prepare('SELECT dispatch_id,outcome FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (contract || report) {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: 'unknown',
      reason: contract ? 'accepted-contract-exists' : 'worker-report-exists', contract: contract ?? null, report: report ?? null };
    emit(out, `reconcile REFUSED for ${jobId}: ${out.reason}; exact-path lease retained`, args.json);
    process.exit(1);
  }

  const cleanup = cleanupManagedWorker(dispatchId);
  if (cleanup.effectState !== 'none') {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: cleanup.effectState, cleanup };
    emit(out, `reconcile WAIT for ${jobId}: effect=${cleanup.effectState}; exact-path lease retained`, args.json);
    process.exit(1);
  }

  let machineRefs = [], leasesReleased = 0;
  ledger.transaction(() => {
    const now = Date.now();
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL')
      .all(jobId).map((r) => r.machine_ref);
    leasesReleased = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    const nextPayload = jobPayloadOf(job);
    delete nextPayload.managed;
    // The rejection is settled now: keep it as evidence, but stop it naming
    // the state a later reconcile would have to prove again.
    if (Array.isArray(nextPayload.rejectedDispatches)) {
      nextPayload.rejectedDispatches = nextPayload.rejectedDispatches.map((entry) =>
        entry?.dispatchId === dispatchId ? { ...entry, effectState: 'none', reconciledAt: now } : entry);
    }
    if (nextPayload.hierarchy?.runtime) {
      const { taskId, dispatchId: ignoredDispatch, terminalHandle, ...runtime } = nextPayload.hierarchy.runtime;
      nextPayload.hierarchy.runtime = runtime;
    }
    const result = {
      reason: 'dispatch-reconciled', dispatchId, effectState: 'none',
      attemptConsumed: false, retryable: true, proof: {
        exactWorker: cleanup.observation?.result?.observation?.exactWorker === true,
        workerState: cleanup.observation?.state ?? null,
        workerStage: cleanup.observation?.result?.worker?.stage ?? cleanup.observation?.result?.stage ?? null,
        lastFailure: cleanup.observation?.result?.dispatch?.last_failure ?? cleanup.observation?.dispatch?.last_failure ?? null,
        releaseState: cleanup.release?.state ?? null,
        releaseReason: cleanup.release?.result?.reason ?? null,
      }, at: now,
    };
    db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,payload_json=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?")
      .run(JSON.stringify(nextPayload), JSON.stringify(result), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-reconciled', payload: { dispatchId, effectState: 'none', attempt: job.attempt,
        attemptConsumed: false, leasesReleased, machineRefs, proof: result.proof },
    });
  });

  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  const out = { ok: true, jobId, reconciled: true, dispatchId, status: 'queued', attempt: job.attempt,
    effectState: 'none', attemptConsumed: false, leasesReleased, machineRefsReleased, cleanup };
  emit(out, `reconciled ${jobId}: ${dispatchId} proved no-effect; same attempt ${job.attempt} queued (leases released: ${leasesReleased})`, args.json);
}

/* ---------------------------------------------------------------- settle */
// The op manifest's policy.commitPolicy — null for an unknown op or one that
// declares none. api report and api settle read it the same way.
const opCommitPolicy = (op) => {
  try { return commitPolicyOf(parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`), 'utf8'))); } catch { return null; }
};

// A job's owned paths resolved per target repository, against the dispatch
// contract's worktree (where the worker was placed) when it recorded one.
const contractWorktreeOf = (db, job, repo) => {
  const context = parseJson(db.prepare('SELECT context_json FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(job.workflow_id, jobOpOf(job), job.attempt)?.context_json);
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
    const rooted = path.resolve(p.base, p.path).replace(/\\/g, '/');
    return checkouts.includes(path.resolve(p.base)) ? [p.path, rooted] : [rooted];
  });
  return [...new Set([...declared, ...resolved])];
}

// The landed proof a pass owes when the op's commitPolicy commits
// (scripts/kernel/settle-landed.mjs). Null — settle as before — when there is
// nothing to prove yet: an unknown or inactive job and a pass without a filed
// done report are refused by the settle transaction itself, and an op without
// a committing commitPolicy never commits. Each owned path resolves against
// its own repository (jobPlacements above; order in
// scripts/kernel/target-repo.mjs ownedPathPlacements) and the proof runs per
// repository; a job whose owned paths sit in no git checkout returns
// {checked:false}.
function settleLanding(db, jobId, repo, reportAbs) {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job || !REPORTABLE_JOB_STATUSES.has(job.status)) return null;
  const op = jobOpOf(job);
  const policy = opCommitPolicy(op);
  if (!policyCommits(policy)) return null;
  const row = db.prepare('SELECT report_json FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, reportDispatchIdOf(db, job));
  const envelope = row ? parseJson(row.report_json) : (reportAbs ? parseJson(fs.readFileSync(reportAbs, 'utf8')) : null);
  if (envelope?.outcome !== 'done') return null;
  const pushes = policyPushes(policy);
  const placements = jobPlacements(db, job, repo);
  const proof = landedProof({ placements, head: envelope.head, branch: envelope.branch, pushes });
  return { ...proof, op, status: job.status, pushes };
}

function cmdSettle(ledger, args, repo) {
  const db = ledger.db, jobId = args.job, verdict = args.verdict;
  const reportAbs = args.report
    ? [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p))
    : null;
  if (args.report && !reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });

  const landed = verdict === 'pass' ? settleLanding(db, jobId, repo, reportAbs) : null;
  if (landed?.checked && !landed.ok) {
    const out = { ok: false, jobId, op: landed.op, reason: landed.reason, detail: landed.detail };
    emit(out, `settle REFUSED for ${jobId} (${landed.op}): ${landed.reason} — ${JSON.stringify(landed.detail)}; the job stays ${landed.status}. Re-dispatch the owning slice to commit its own paths${landed.pushes ? ' and push' : ''}, then settle again`, args.json);
    process.exit(1);
  }

  let machineRefs = [], released = 0, job, reportsConsumed = false, reportFiled = false, reportOutcome = null;
  let checkEvidence = { observed: 0, passed: 0, failed: 0, green: false }, claimOverruled = false;
  let awaitingOwner = false, cutSet = null, handoverApproval = null;
  ledger.transaction(() => {
    job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
    if (SETTLED.includes(job.status) && job.status !== 'effect_unknown') {
      throw Object.assign(new Error(`job ${jobId} is already settled (${job.status})`), { code: 'job-settled' });
    }
    if (verdict === 'pass') requireDispatchedReportBinding(db, job);
    const payload = jobPayloadOf(job);
    payload.verdict = verdict;
    payload.report = reportAbs;
    payload.settledAt = Date.now();
    const status = verdict === 'pass' ? 'succeeded' : 'failed';
    const checkRow = db.prepare('SELECT checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, jobOpOf(job), job.attempt);
    const checksEnvelope = parseJson(checkRow?.checks_json);
    const recordedChecks = Array.isArray(checksEnvelope?.checks) ? checksEnvelope.checks : [];
    checkEvidence = summarizeCheckEvidence(checksEnvelope);
    const result = { verdict, report: reportAbs, at: payload.settledAt, checkEvidence, ...(landed?.checked ? { landed: landed.detail } : {}) };
    // The worker's claim is the reports row keyed by its dispatch. No row yet:
    // a --report file that is itself a valid op-report@1 envelope is filed on
    // the job's behalf first; anything else (markdown, absent — a dead worker)
    // settles on the kernel's verdict alone.
    const dispatchId = reportDispatchIdOf(db, job);
    const row = db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(job.workflow_id, dispatchId);
    let envelope = null;
    if (row) envelope = parseJson(row.report_json);
    if (!row && reportAbs) {
      const valid = validateOpReport(parseJson(fs.readFileSync(reportAbs, 'utf8')), { ownedPaths: reportOwnedPaths(db, job, repo), identity: reportIdentityOf(db, job) });
      const malformedHandoverAsk = valid.ok && jobOpOf(job) === HANDOVER_OP && valid.report.outcome === 'ask' && handoverAskProblem(valid.report.question);
      if (valid.ok && !malformedHandoverAsk) {
        envelope = valid.report;
        db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
          .run(job.workflow_id, dispatchId, jobOpOf(job), job.attempt, job.generation, envelope.outcome, JSON.stringify(envelope), job.worker_id ?? null, payload.settledAt);
      }
    }
    if (envelope?.outcome) {
      reportOutcome = envelope.outcome;
      reportFiled = true;
      if (!VERDICT_OUTCOMES[verdict].includes(envelope.outcome)) {
        if (verdict === 'fail' && envelope.outcome === 'done' && checkEvidence.failed > 0) {
          claimOverruled = true;
          result.claimOverruled = true;
        } else {
          throw Object.assign(new Error(`verdict '${verdict}' cannot settle a report of outcome '${envelope.outcome}'`), { code: 'verdict-outcome-mismatch' });
        }
      }
    }
    // An ask is a wait on the owner, not a failed attempt: the row settles (the
    // worker is released and the next attempt is a new job), but the recorded
    // verdict says what happened and retry accounting spends no business attempt
    // on it (engine/admission.mjs retryDisposition).
    if (verdict === 'blocked' && reportOutcome === 'ask') {
      awaitingOwner = true;
      Object.assign(result, { verdict: AWAITING_OWNER, kernelVerdict: verdict, askDispatchId: dispatchId });
    }
    if (verdict === 'pass') {
      if (reportOutcome !== 'done') {
        throw Object.assign(new Error(`pass requires a filed done report for ${jobId}`), { code: 'pass-report-missing' });
      }
      if (!checkEvidence.green) {
        throw Object.assign(new Error(`pass requires independently recorded green checks for ${jobId}`), { code: 'checks-not-green' });
      }
      if (payload.cut) {
        // Every slice pass records its scoped postcondition and the unchanged
        // inventory. The pass that CLOSES the set - every other ordinal's
        // latest job already settled succeeded, whichever ordinal settles last
        // - additionally records full-regression-final: the unchanged full
        // gates run once over the whole cut set before it counts done
        // (inc-751dd1ac4492; verdict-contract.yaml cutSetAuthority).
        cutSet = cutSetStateOf(db, { workflowId: job.workflow_id, op: jobOpOf(job), cut: payload.cut, ownJobId: jobId });
        const closesSet = cutSet.open.length === 0;
        const requiredNames = closesSet ? [...CUT_SLICE_CHECKS, CUT_SET_CLOSING_CHECK] : CUT_SLICE_CHECKS;
        const missing = requiredNames.filter((name) => !recordedChecks.some((check) => check?.name === name && check.exitCode === 0));
        if (missing.length) {
          const why = closesSet
            ? `this pass closes cut set ${cutSet.id} (every other ordinal of ${cutSet.total} settled succeeded), so the unchanged full gates run over the whole set and record ${CUT_SET_CLOSING_CHECK}`
            : `ordinal(s) ${cutSet.open.join(',')} of cut set ${cutSet.id} are still open, so this slice records its scoped checks and the set's last pass records ${CUT_SET_CLOSING_CHECK}`;
          throw Object.assign(new Error(`cut pass for ${jobId} missing required green checks: ${missing.join(', ')} — ${why}`), {
            code: 'cut-checks-missing', cut: payload.cut, missing,
          });
        }
        result.cutSet = { id: cutSet.id, total: cutSet.total, closesSet, open: cutSet.open };
      }
    }
    // A handover.review pass is the owner's approval turned into a ledger fact:
    // it settles only on the owner's approve receipt for the latest handover
    // ask with no business settle after it (scripts/kernel/handover.mjs). A
    // delegated answer never approves.
    if (verdict === 'pass' && jobOpOf(job) === HANDOVER_OP) {
      const approval = handoverApprovalOf(db, job.workflow_id, { attempt: job.attempt });
      if (!approval.approved) {
        throw Object.assign(new Error(`handover.review ${jobId} cannot settle pass: ${approval.reason}`), { code: 'handover-not-approved' });
      }
      handoverApproval = approval;
      result.handoverApproval = { dispatchId: approval.ask.dispatchId, answeredBy: approval.ask.answeredBy, receiptPath: approval.ask.receiptPath };
    }
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL').all(jobId).map((r) => r.machine_ref);
    released = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    db.prepare('UPDATE jobs SET status=?, payload_json=?, result_json=?, lease_token=NULL, deadline=NULL, updated_at=? WHERE job_id=?')
      .run(status, JSON.stringify(payload), JSON.stringify(result), payload.settledAt, jobId);
    // Integrating the verdict consumes the job's reports row — the durable
    // worker→kernel signal is spent exactly once (dispatch_id is the worker's
    // handle, falling back to the job id when none was ever bound).
    reportsConsumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(payload.settledAt, job.workflow_id, reportDispatchIdOf(db, job)).changes > 0;
    // A question the settled worker asked through Orca has no one left to answer.
    db.prepare("UPDATE inbox SET status='done', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind=? AND status='pending' AND json_extract(payload_json,'$.jobId')=?")
      .run(JSON.stringify({ reason: 'job-settled' }), payload.settledAt, job.workflow_id, WORKER_QUESTION, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'op-settled', payload: { verdict, status, report: reportAbs, reportFiled, reportOutcome, checkEvidence, claimOverruled, awaitingOwner, leasesReleased: released, machineRefs, reportsConsumed, ...(result.cutSet ? { cutSet: result.cutSet } : {}) },
    });
    // The owner's approval, recorded after the settle it rides on so it is
    // newer than every business settle (api finish reads it: handoverGateOf).
    if (handoverApproval) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: HANDOVER_APPROVED, payload: {
          jobId, dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy,
          at: handoverApproval.ask.answeredAt, askJobId: handoverApproval.ask.jobId, receiptPath: handoverApproval.ask.receiptPath,
          lastBusinessSettleSeq: handoverApproval.lastBusinessSettleSeq,
        },
      });
    }
    // The set is done only here: its last pass recorded the whole-set gate.
    if (result.cutSet?.closesSet) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'cut-set-closed', payload: { op: jobOpOf(job), cut: payload.cut, closedBy: jobId, ordinal: payload.cut.ordinal, check: CUT_SET_CLOSING_CHECK },
      });
    }
  });

  // Mirror of releaseTwoPhase's machine half: lease rows are gone; now release
  // the paired machine tokens. Best-effort — a missing machine db never fails
  // the settle (the ledger row is already the record).
  let machineReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger settle stands; machine TTLs expire on their own */ }
  }

  // The settled op's Orca terminal is released with its leases — worker_id is
  // the handle. Runs after the settled state is written; a close failure
  // never un-settles.
  // Managed jobs hold a Dispatch id in worker_id, not a terminal handle — they
  // take the worker-stop/-release path below, never terminal close.
  const settledPayload = jobPayloadOf(job);
  const managed = settledPayload?.managed ?? null;
  let terminalClosed = null;
  if (job.worker_id && !managed) {
    const quit = quitAgent({ handle: job.worker_id, agent: agentOfJob(settledPayload) });
    const closed = closeOperationTerminal(job.worker_id);
    terminalClosed = { handle: job.worker_id, ok: closed.ok === true, ...(closed.tab ? { tab: closed.tab } : {}), ...(quit ? { quit } : {}), ...(closed.error ? { error: closed.error } : {}) };
    const reaped = reapIfStillLive(db, job, settledPayload, job.worker_id);
    if (reaped) terminalClosed.reaped = reaped;
  }

  // Managed settle — calls.yaml settle-dispatch: worker-stop then
  // worker-release the exact Dispatch. A stop that classifies unknown is
  // reconciled by a worker-show read and the residual state is recorded on
  // the settle result (worker-abandon stays out of scope here — it is only
  // legal once the attempt's own terminal is proven closed). A stop/release
  // failure never un-settles the job; the ledger row already stands.
  let managedWorker = null;
  if (managed?.dispatchId) {
    let stop = null, release = null, residual = null;
    // The agent quits itself first, so worker-stop/release find nothing running.
    const managedQuit = quitAgent({ handle: managed.agentTerminalHandle ?? null, agent: 'claude' });
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
    const reaped = agentHandle ? reapIfStillLive(db, job, settledPayload, agentHandle) : null;
    if (reaped) agentTerminal = { ...(agentTerminal ?? { handle: agentHandle }), reaped };
    managedWorker = {
      dispatchId: managed.dispatchId,
      stop: { ok: stop?.ok === true, outcome: stop?.outcome ?? null, state: stop?.state ?? null, ...(stop?.error ? { error: stop.error } : {}) },
      release: { ok: release?.ok === true, outcome: release?.outcome ?? null, state: release?.state ?? null, ...(release?.error ? { error: release.error } : {}) },
      ...(residual ? { residual } : {}),
      ...(agentTerminal ? { agentTerminal } : {}),
      ...(agentTab ? { agentTab: { tab: agentTab.tab ?? null, ok: agentTab.ok === true } } : {}),
      ...(managedQuit ? { quit: managedQuit } : {}),
    };
  }

  // The op's Orca Task is closed with its worker. Settling only the worker
  // left every finished operation as an open Task in the workflow Run, which
  // is what the owner saw as ticked [Op] rows sitting at the sidebar root
  // (fable.md orca-hierarchy, row 3). A close failure never un-settles the
  // job; the ledger row is already the record.
  const taskClosed = closeOperationTask(db, job, settledPayload);
  // The worker receipt is kept with the Task proof: settle's stdout is the
  // only other place it lived, and an orphaned op terminal left no trace.
  if (taskClosed || managedWorker || terminalClosed) {
    const stored = parseJson(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)?.payload_json) ?? {};
    db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?')
      .run(JSON.stringify({ ...stored, ...(taskClosed ? { taskClosed } : {}), ...(managedWorker ? { managedWorker } : {}), ...(terminalClosed ? { terminalClosed } : {}) }), Date.now(), jobId);
  }

  // The owner sees on Telegram what a draw or UAT op produced (the drawn
  // screens, the UAT videos): a detached sender, so Telegram never slows or
  // fails the settle (scripts/connectors/telegram-media.mjs).
  try { queueSettleMedia({ repo, ledgerFile: ledgerFileFor(repo), workflowId: job.workflow_id, jobId, attempt: job.attempt, op: jobOpOf(job), verdict, dispatchId: reportDispatchIdOf(db, job) }); } catch { /* never un-settles */ }

  const status = verdict === 'pass' ? 'succeeded' : 'failed';
  const out = { ok: true, jobId, verdict, status, awaitingOwner, report: reportAbs, reportFiled, reportOutcome, checkEvidence, claimOverruled, ...(handoverApproval ? { handoverApproved: { dispatchId: handoverApproval.ask.dispatchId, answeredBy: handoverApproval.ask.answeredBy } } : {}), ...(cutSet ? { cutSet: { id: cutSet.id, total: cutSet.total, closesSet: cutSet.open.length === 0, open: cutSet.open } } : {}), leasesReleased: released, machineRefsReleased: machineReleased, reportsConsumed, terminalClosed, taskClosed, ...(managedWorker ? { managedWorker } : {}), ...(landed?.checked ? { landed: landed.detail } : {}) };
  emit(out, `settled ${jobId} verdict=${verdict}${awaitingOwner ? ` (${AWAITING_OWNER}: no business attempt spent)` : ''} status=${status} (leases released: ${released}${reportsConsumed ? ', report consumed' : ''}${terminalClosed ? `, terminal ${terminalClosed.handle} closed=${terminalClosed.ok}` : ''}${taskClosed ? `, task ${taskClosed.taskId} ${taskClosed.status} ok=${taskClosed.ok}` : ''}${managedWorker ? `, worker ${managedWorker.dispatchId} stop=${managedWorker.stop.ok} release=${managedWorker.release.ok}` : ''}${out.cutSet ? `, cut ${out.cutSet.id} ${out.cutSet.closesSet ? 'CLOSED' : `open ${out.cutSet.open.join(',')}`}` : ''})`, args.json);
}

// The operation Task an op holds, whichever launch kind opened it, and the
// Run/kernel-terminal identity task-update needs to address it. Returns null
// when the attempt never got a Task — there is then nothing to close.
const operationTaskOf = (payload) => {
  const taskId = payload?.orca?.taskId ?? payload?.managed?.taskId ?? payload?.hierarchy?.runtime?.taskId ?? null;
  if (!taskId) return null;
  return { taskId, runId: payload?.orca?.runId ?? payload?.managed?.runId ?? payload?.hierarchy?.runtime?.runId ?? null };
};

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
  const from = kernelHandle !== undefined ? kernelHandle
    : db.prepare("SELECT worker_id FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY updated_at DESC LIMIT 1").get(job.workflow_id)?.worker_id ?? null;
  const r = bestEffort(() => taskUpdate({ id: task.taskId, status: TASK_CLOSED_STATUS, run: task.runId, from }));
  return { taskId: task.taskId, status: TASK_CLOSED_STATUS, ok: r?.ok === true, ...(r?.error ? { error: String(r.error) } : {}) };
}

/* -------------------------------------------------------------- incident */
function cmdIncident(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  if (args.resolve) {
    const row = db.prepare('SELECT incident_id,status FROM incidents WHERE incident_id=? AND workflow_id=?').get(args.resolve, workflowId);
    if (!row) throw Object.assign(new Error(`incident ${args.resolve} is not on ${workflowId}`), { code: 'incident-unknown' });
    const changed = row.status === 'open';
    if (changed) {
      ledger.transaction(() => {
        db.prepare("UPDATE incidents SET status='resolved',updated_at=? WHERE incident_id=?").run(now, row.incident_id);
        ledger.appendEvent({
          workflowId, entityType: 'incident', entityId: row.incident_id,
          kind: 'incident-resolved', payload: { detail: args.detail ?? null },
        });
      });
    }
    const out = { ok: true, incidentId: row.incident_id, workflowId, status: 'resolved', changed };
    emit(out, `incident ${row.incident_id} ${changed ? 'resolved' : 'was already ' + row.status} on ${workflowId}`, args.json);
    return;
  }
  const holds = String(args.holds ?? '').split(',').map((item) => item.trim()).filter(Boolean);
  // A peer-wait names the peer workflow it waits on (openPeerWaits): only a running peer of this
  // workflow can land the thing and send the message that wakes it.
  let peerWait = null;
  if (args.kind === PEER_WAIT) {
    const peer = typeof args.peer === 'string' ? args.peer.trim() : '';
    if (!peer) throw Object.assign(new Error('a peer-wait names the workflow it waits on: --peer <workflowId>'), { code: 'peer-wait-peer-missing' });
    const refusal = peerRefusalOf(db, getWorkflow(db, workflowId), peer);
    if (refusal) throw Object.assign(new Error(`peer-wait on ${peer} refused: ${refusal.detail}`), { code: refusal.code });
    peerWait = { peer, untilMessage: args['until-message'] === true, refs: csvList(args.refs) };
  } else if (args.peer || args['until-message']) {
    throw Object.assign(new Error('--peer and --until-message go with --kind peer-wait'), { code: 'peer-wait-kind-mismatch' });
  }
  const incidentId = `inc-${newToken().slice(0, 12)}`;
  ledger.transaction(() => {
    db.prepare(
      "INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,?,0,0,0,0,?,'open',?)"
    ).run(incidentId, workflowId, args.op ?? null, `[${args.kind}] ${args.detail}`, now);
    ledger.appendEvent({
      workflowId, entityType: 'incident', entityId: incidentId,
      kind: 'incident-raised', payload: { kind: args.kind, detail: args.detail, opId: args.op ?? null, ...(holds.length ? { holds } : {}), ...(peerWait ?? {}) },
    });
  });
  const out = { ok: true, incidentId, workflowId, kind: args.kind, status: 'open', ...(holds.length ? { holds } : {}), ...(peerWait ?? {}) };
  emit(out, `incident ${incidentId} open on ${workflowId} — ${args.kind}${peerWait ? ` on ${peerWait.peer}${peerWait.untilMessage ? ' (until its next message)' : ''}` : ''}: ${args.detail}`, args.json);
}

/* ---------------------------------------------------------------- finish */
function cmdFinish(ledger, args) {
  const db = ledger.db, workflowId = args.workflow, now = Date.now();
  const wf = getWorkflow(db, workflowId);
  if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const already = wf.phase === 'finished';

  const openOperations = db.prepare(
    `SELECT job_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status NOT IN (${FINAL_SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`
  ).all(workflowId, ...FINAL_SETTLED);
  if (!already && openOperations.length) {
    throw Object.assign(new Error(`workflow ${workflowId} still has ${openOperations.length} unsettled operation(s)`), {
      code: 'workflow-open-jobs', openJobs: openOperations,
    });
  }
  // A workflow is done when the owner approved its handover: a handover-approved
  // event newer than the last business settle (scripts/kernel/handover.mjs
  // handoverGateOf). An archived workflow is the one existing way out.
  const handoverGate = already ? null : handoverGateOf(db, workflowId);
  if (handoverGate && !handoverGate.ok) {
    throw Object.assign(new Error(`workflow ${workflowId} cannot finish: ${handoverGate.reason}; run handover.review as the final leg and let the owner approve it (api status handover)`), {
      code: 'handover-not-approved', approvedSeq: handoverGate.approvedSeq ?? null, lastBusinessSettleSeq: handoverGate.lastBusinessSettleSeq ?? null,
    });
  }
  const handoverFinish = handoverGate ? { via: handoverGate.via, approvedSeq: handoverGate.approvedSeq ?? null, answeredBy: handoverGate.approval?.answeredBy ?? null } : null;

  const kernelSignal = db.prepare("SELECT token,value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const kernelJob = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind='kernel' ORDER BY created_at DESC LIMIT 1").get(workflowId);
  const kernelPayload = kernelJob ? jobPayloadOf(kernelJob) : null;
  const kernelTerminal = parseJson(kernelSignal?.value_json)?.terminal
    ?? kernelJob?.worker_id
    ?? kernelPayload?.hierarchy?.runtime?.terminalHandle
    ?? null;

  // Finish ≠ erase: goals/events/jobs history stays. Live Kernel custody does
  // not: release the singleton signal and settle its job before asking Orca
  // to close the exact terminal.
  let closed = 0, kernelSignalsReleased = 0, kernelJobsSettled = 0;
  ledger.transaction(() => {
    db.prepare("UPDATE workflows SET phase='finished', finished_json=?, updated_at=? WHERE workflow_id=?")
      .run(JSON.stringify({ finishedAt: now, by: 'kernel-api', ...(handoverFinish ? { handover: handoverFinish } : {}) }), now, workflowId);
    closed = db.prepare("UPDATE inbox SET status='done', applied_at=? WHERE workflow_id=? AND status NOT IN ('done','applied')").run(now, workflowId).changes;
    kernelSignalsReleased = db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(workflowId).changes;
    if (kernelJob) {
      const nextPayload = { ...kernelPayload, finishedAt: now };
      if (nextPayload.hierarchy?.runtime) {
        nextPayload.hierarchy = { ...nextPayload.hierarchy, runtime: {
          ...nextPayload.hierarchy.runtime, terminalHandle: null, releasedAt: now,
        } };
      }
      kernelJobsSettled = db.prepare("UPDATE jobs SET status='succeeded',worker_id=NULL,lease_token=NULL,deadline=NULL,payload_json=?,result_json=?,updated_at=? WHERE job_id=? AND status NOT IN ('succeeded','failed')")
        .run(JSON.stringify(nextPayload), JSON.stringify({ verdict: 'pass', reason: 'workflow-finished', at: now }), now, kernelJob.job_id).changes;
      db.prepare('DELETE FROM leases WHERE job_id=?').run(kernelJob.job_id);
    }
    ledger.appendEvent({
      workflowId, entityType: 'workflow', entityId: workflowId,
      kind: 'workflow-finished', payload: { inboxClosed: closed, alreadyFinished: already, kernelSignalsReleased, kernelJobsSettled, kernelTerminal, ...(handoverFinish ? { handover: handoverFinish } : {}) },
    });
  });
  // A finish leaves no open Task in the workflow Run. Settle closes an op's
  // Task as it settles; this catches the ones no settle ever reached — a
  // cancelled attempt, a job settled before task closure existed, an op whose
  // task-update was refused (taskClosed.ok false).
  const tasksClosed = [];
  for (const row of db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId)) {
    const payload = jobPayloadOf(row);
    if (!operationTaskOf(payload) || payload?.taskClosed?.ok === true) continue;
    const result = closeOperationTask(db, row, payload, kernelTerminal);
    if (!result) continue;
    tasksClosed.push({ jobId: row.job_id, ...result });
    db.prepare('UPDATE jobs SET payload_json=?, updated_at=? WHERE job_id=?')
      .run(JSON.stringify({ ...payload, taskClosed: result }), now, row.job_id);
  }

  const out = { ok: true, workflowId, phase: 'finished', inboxClosed: closed, alreadyFinished: already,
    kernelSignalsReleased, kernelJobsSettled, kernelTerminal, kernelTerminalCloseRequested: Boolean(kernelTerminal),
    tasksClosed, ...(handoverFinish ? { handover: handoverFinish } : {}) };
  emit(out, `workflow ${workflowId} finished${already ? ' (was already finished)' : ''} — inbox rows closed: ${closed}; kernel signal released=${kernelSignalsReleased}, kernel job settled=${kernelJobsSettled}${tasksClosed.length ? `, ${tasksClosed.length} open Task(s) closed` : ''}${kernelTerminal ? `, terminal ${kernelTerminal} close requested` : ''}; history preserved`, args.json);
  // Emit the durable receipt first because a Kernel normally closes its own
  // terminal here. The ledger is already authoritative if the host closes the
  // PTY before the terminal-close client can print its own receipt.
  if (kernelTerminal) {
    try { terminalClose({ terminal: kernelTerminal }); } catch { /* finished state stands; monitor reconciles host cleanup */ }
  }
}

/* ------------------------------------------------------------- op IPC */
// The op-IPC durability verbs: contracts out (kernel→worker, written at
// dispatch), reports in (worker→kernel, filed by the worker), checks beside
// them. The files on disk stay the artifacts; the rows are the durable
// signal the kernel consumes.
const resolveJob = (db, jobId) => {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  return job;
};
const jobOpOf = (job) => job.op_id ?? jobPayloadOf(job).opId ?? null;
// reports.dispatch_id is the orchestration Dispatch id whenever one exists.
// command-terminal jobs retain their terminal handle in worker_id for exact
// cleanup, so payload.orca.dispatchId is the durable report identity.
// The contracts row for (workflow, op, attempt) IS the dispatch authority —
// `api dispatch` writes it before the job goes running, on both launch kinds.
// The payload is a cache of the same fact and can lag it (a launch rejected
// after an earlier one succeeded leaves a stale id behind), so the contract
// answers first and the payload only fills in for an attempt that has none.
const contractDispatchIdOf = (db, job) => db
  .prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
  .get(job.workflow_id, jobOpOf(job), job.attempt)?.dispatch_id ?? null;
const rejectedDispatchIdsOf = (job) => new Set(
  (jobPayloadOf(job).rejectedDispatches ?? []).map((entry) => entry?.dispatchId).filter(Boolean));
const reportDispatchIdOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return contractDispatchIdOf(db, job) ?? explicitReportDispatchIdOf(db, job)
    ?? payload.orca?.dispatchId ?? job.worker_id ?? job.job_id;
};
const REPORTABLE_JOB_STATUSES = new Set(['running', 'answering', 'effect_unknown']);
const explicitReportDispatchIdOf = (db, job) => {
  const contract = contractDispatchIdOf(db, job);
  if (contract) return contract;
  // No contract for this attempt: the payload is the only binding there is,
  // and a dispatch that was rejected is never one.
  const payload = jobPayloadOf(job);
  const rejected = rejectedDispatchIdsOf(job);
  const bound = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? null;
  return bound && !rejected.has(bound) ? bound : null;
};
const requireDispatchedReportBinding = (db, job) => {
  if (!REPORTABLE_JOB_STATUSES.has(job.status)) {
    throw Object.assign(new Error(`job ${job.job_id} cannot file or verify a worker report while ${job.status}`), {
      code: 'report-job-not-active', status: job.status,
    });
  }
  const dispatchId = explicitReportDispatchIdOf(db, job);
  if (!dispatchId) {
    throw Object.assign(new Error(`job ${job.job_id} has no bound operation dispatch`), { code: 'report-dispatch-unbound' });
  }
  const contract = contractDispatchIdOf(db, job);
  if (!contract || contract !== dispatchId) {
    throw Object.assign(new Error(`job ${job.job_id} has no contract bound to dispatch ${dispatchId}`), {
      code: 'report-contract-unbound', dispatchId,
    });
  }
  return dispatchId;
};
const parseAttempt = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error(`--attempt must be a positive integer, got '${v}'`), { code: 'bad-attempt' });
  return n;
};

/* --------------------------------------------------------------- report */
// Worker-facing: the report file is a starci/op-report@1 JSON envelope — the
// row is the durable signal and the ONLY shape the kernel reads
// (UNIQUE(workflow_id,dispatch_id) makes a re-file idempotent). The api stamps
// run/task/dispatch/from from the job row; a file that claims a different
// identity is report-invalid. --outcome is optional consistency: when given it
// must equal the envelope's outcome.
const reportIdentityOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return { run: payload.managed?.runId ?? payload.orca?.runId ?? null,
           task: payload.managed?.taskId ?? payload.orca?.taskId ?? null,
           dispatch: reportDispatchIdOf(db, job), from: job.job_id };
};
function cmdReport(ledger, args, repo) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const jobPayload = jobPayloadOf(job);
  requireDispatchedReportBinding(db, job);
  const reportAbs = [path.resolve(args.report), path.resolve(repo, args.report)].find((p) => fs.existsSync(p));
  if (!reportAbs) throw Object.assign(new Error(`report file missing: ${args.report}`), { code: 'report-missing' });
  const parsed = parseJson(fs.readFileSync(reportAbs, 'utf8'));
  const valid = validateOpReport(parsed, { ownedPaths: reportOwnedPaths(db, job, repo), identity: reportIdentityOf(db, job), commitPolicy: opCommitPolicy(jobOpOf(job)) });
  if (!valid.ok) throw Object.assign(new Error(`report fails starci/op-report@1: ${valid.reasons.join('; ')}`), { code: 'report-invalid' });
  const report = valid.report;
  if (args.outcome && args.outcome !== report.outcome)
    throw Object.assign(new Error(`--outcome '${args.outcome}' contradicts the envelope's '${report.outcome}'`), { code: 'outcome-mismatch' });
  // The handover ask is the one ask whose answer the kernel routes: its three
  // options are closed and ordered (scripts/kernel/handover.mjs).
  const handoverProblem = jobOpOf(job) === HANDOVER_OP && report.outcome === 'ask' ? handoverAskProblem(report.question) : null;
  if (handoverProblem) throw Object.assign(new Error(`report fails the handover ask: ${handoverProblem}`), { code: 'report-invalid' });
  // An ask the job's retry lineage already had answered is never filed again (scripts/kernel/owner-answers.mjs):
  // the answer rides in the packet as context.owner_answers. The one way past is a declared re-ask,
  // question.reasks {dispatchId: <the answered ask>, reason}, for an answer that could not take effect.
  let reask = null;
  if (report.outcome === 'ask') {
    const repeated = repeatedAnswerOf(report.question, ownerAnswersOf(db, job), { op: jobOpOf(job) });
    if (repeated) {
      const declared = report.question?.reasks;
      const reason = typeof declared?.reason === 'string' ? declared.reason.trim() : '';
      if (declared?.dispatchId !== repeated.dispatchId || !reason) {
        throw Object.assign(new Error(`ask-already-answered: this question repeats ask ${repeated.dispatchId} (attempt ${repeated.attempt}), which ${repeated.answeredBy} already answered ${repeated.chosen ? `with option ${repeated.chosen.index != null ? repeated.chosen.index + 1 : '?'}${repeated.chosen.label ? ` "${repeated.chosen.label}"` : ''}` : ''} at ${repeated.answeredAt}${repeated.receipt ? ` (receipt ${repeated.receipt})` : ''}. Apply that answer (packet context.owner_answers) and file done|partial|failed|blocked; ask only a question the answer left open. When the answer provably could not take effect, re-ask it with question.reasks {"dispatchId":"${repeated.dispatchId}","reason":"<why>"}`), {
          code: 'ask-already-answered', answered: repeated,
        });
      }
      reask = { dispatchId: repeated.dispatchId, reason };
    }
  }
  const dispatchId = report.dispatch, op = jobOpOf(job);
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(job.workflow_id, dispatchId, op, job.attempt, job.generation, report.outcome, JSON.stringify(report),
        jobPayload.managed?.agentTerminalHandle ?? jobPayload.orca?.agentTerminalHandle ?? job.worker_id ?? null, now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'report-filed', payload: { dispatchId, op, attempt: job.attempt, outcome: report.outcome, report: reportAbs, ...(reask ? { reask } : {}) },
    });
  });
  if (reask) console.error(`api report WARNING: ask ${dispatchId} re-asks ${reask.dispatchId}, which is already answered in this job's lineage; declared reason: ${reask.reason}`);
  const kernelWake = wakeKernelForTransition(ledger, {
    workflowId: job.workflow_id,
    transition: `report-filed:${report.outcome}`,
    jobId: job.job_id,
    dispatchId,
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, outcome: report.outcome, report: reportAbs, kernelWake, ...(reask ? { reask } : {}) };
  emit(out, `report filed for ${job.job_id} (dispatch ${dispatchId}, outcome ${report.outcome})`, args.json);
  // The op terminal gets the canonical human rendering of the filed row — the
  // reports row is the truth, this block is its projection.
  console.log(renderReportBlock(report));
}

/* ---------------------------------------------------------- op-contract */
// The worker reads its own contract: print the markdown to stdout. --job
// resolves (workflow,op,attempt); --workflow + --op [--attempt] works too
// (latest attempt's contract when --attempt is omitted).
function cmdOpContract(ledger, args) {
  const db = ledger.db;
  let workflowId, op, attempt = parseAttempt(args.attempt);
  if (args.job) {
    const job = resolveJob(db, args.job);
    workflowId = job.workflow_id; op = args.op ?? jobOpOf(job);
    if (attempt == null) attempt = job.attempt;
  } else {
    workflowId = args.workflow; op = args.op;
    if (attempt == null) attempt = db.prepare('SELECT MAX(attempt) a FROM contracts WHERE workflow_id=? AND op_id=?').get(workflowId, op)?.a ?? null;
  }
  const row = attempt == null ? null
    : db.prepare('SELECT * FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?').get(workflowId, op, attempt);
  if (!row) throw Object.assign(new Error(`no contract row for ${workflowId}/${op} attempt ${attempt ?? '(none filed)'}`), { code: 'contract-missing' });
  if (args.json) {
    emit({ ok: true, workflowId, op, attempt: row.attempt, dispatchId: row.dispatch_id, markdown: row.markdown, context: parseJson(row.context_json), createdAt: row.created_at }, '', true);
  } else {
    process.stdout.write(row.markdown.endsWith('\n') ? row.markdown : `${row.markdown}\n`);
  }
}

/* ---------------------------------------------------------------- check */
// The verification half: upsert the re-run check results for an op attempt
// (one row per workflow_id,op_id,attempt).
function cmdCheck(ledger, args, repo) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const op = args.op ?? jobOpOf(job);
  if (!op) throw Object.assign(new Error(`job ${job.job_id} carries no op identity — pass --op`), { code: 'job-no-op' });
  const attempt = parseAttempt(args.attempt) ?? job.attempt;
  const raw = args.checks ?? (() => {
    const file = [path.resolve(args['checks-file']), path.resolve(repo, args['checks-file'])].find((p) => fs.existsSync(p));
    if (!file) throw Object.assign(new Error(`checks file missing: ${args['checks-file']}`), { code: 'checks-file-missing' });
    return fs.readFileSync(file, 'utf8');
  })();
  const parsed = parseJson(raw);
  if (!isCheckResultEnvelope(parsed)) {
    throw Object.assign(new Error('checks payload must be an object with a non-empty checks[] of {name, exitCode, command?, evidence?} entries'), { code: 'checks-invalid' });
  }
  if (attempt !== job.attempt) {
    throw Object.assign(new Error(`checks attempt ${attempt} does not match job ${job.job_id} attempt ${job.attempt}`), {
      code: 'checks-attempt-mismatch', attempt, jobAttempt: job.attempt,
    });
  }
  const dispatchId = requireDispatchedReportBinding(db, job);
  const reportRow = db.prepare('SELECT dispatch_id FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (!reportRow) {
    throw Object.assign(new Error(`job ${job.job_id} has no filed worker report for dispatch ${dispatchId}`), {
      code: 'checks-report-missing', dispatchId,
    });
  }
  const checkEvidence = summarizeCheckEvidence(parsed);
  ledger.transaction(() => {
    const now = Date.now();
    db.prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(job.workflow_id, op, attempt, JSON.stringify(parsed), now);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
      kind: 'checks-recorded', payload: { op, attempt },
    });
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, op, attempt, checks: parsed.checks.length, checkEvidence };
  emit(out, `checks recorded for ${job.job_id} (op ${op}, attempt ${attempt})`, args.json);
}

/* ------------------------------------------------------ reap-agent-process */
// A settled op's terminal that still reads connected after its close is an
// agent process Orca could not stop (stop_unverified, no renderer pane). Five
// such Claude/Codex workers ran hidden on a machine short of memory until the
// supervisor matched and stopped them by hand. The match is the agent image
// started inside the op's dispatch window, and only a single candidate is
// stopped (scripts/kernel/reap-agent-process.mjs).
const agentOfJob = (payload) => (payload?.managed ? 'claude'
  : /^(claude|codex|devin|qwen)/i.exec(String(payload?.model ?? payload?.route?.agent ?? ''))?.[1]?.toLowerCase() ?? null);
function reapIfStillLive(db, job, payload, handle) {
  let shown = null;
  try { shown = terminalShow({ terminal: handle }); } catch { return null; }
  if (!shown?.ok || shown.connected !== true) return null;
  const dispatched = db.prepare("SELECT created_at FROM events WHERE workflow_id=? AND entity_id=? AND kind='op-dispatched' ORDER BY seq DESC LIMIT 1").get(job.workflow_id, job.job_id)?.created_at ?? null;
  try { return reapAgentProcess({ agent: agentOfJob(payload), dispatchedAt: dispatched }); }
  catch (error) { return { reaped: false, reason: String(error?.message ?? error) }; }
}

/* ------------------------------------------------------------- serve-ask */
function ensureAskConnectors() {
  if (process.env.STARCI_CONNECTORS_OFF === '1') return null;
  let cf = null;
  try { cf = connectorsConfig()?.cloudflare ?? null; } catch { return null; }
  if (!cf || cf.mode === 'off') return null;
  const start = (name) => {
    const r = spawnSync(process.execPath, [path.join(skillRoot, 'scripts', 'connectors', name), 'start'], { cwd: skillRoot, encoding: 'utf8', windowsHide: true, timeout: 60000 });
    try { return JSON.parse(String(r.stdout ?? '').trim().split(/\r?\n/).pop()); } catch { return { ok: false, status: r.status }; }
  };
  const gateway = start('ask-gateway.mjs'), tunnel = start('tunnel.mjs');
  return { gateway: gateway?.ok === true, tunnel: tunnel?.ok === true, publicBase: tunnel?.publicBase ?? null };
}

// `serve-ask --workflow <id> [--dispatch <id>] [--ttl <ms>] [--now]`: park an
// owner ask. A StarCi Next Kernel held an ask-reserve for an hour
// (inc-2558dd227dfd) because it could mutate only through api.mjs, so this
// verb is the Kernel's one way to put a question in front of the owner.
// Owner, 2026-09-24: a form URL is served only when the owner asks for it. So
// with Telegram ready this verb serves NOTHING: parkAsk (serve-ask.mjs)
// supersedes the asks it replaces, sends the owner the question with a
// "Generate URL" button and records `ask-notified`; the Telegram bridge serves
// the form (scripts/kernel/serve-ask.mjs --on-demand telegram) when the button
// is pressed. `--now` also launches the form at once (local use), and with
// Telegram off or unreachable the form is launched at once as before, since
// nothing else could ever serve it. An ask config.yaml
// asks.autoAcceptRecommended answers (serve-ask.mjs autoAcceptAsk) is
// answered here instead, in-process, so the calling Kernel reads the answer
// in this verb's own output and nothing is served.
async function cmdServeAsk(ledger, args, repo) {
  const db = ledger.db, workflowId = args.workflow;
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const dispatchId = args.dispatch ?? null;
  if (dispatchId && !db.prepare("SELECT 1 FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' LIMIT 1").get(workflowId, dispatchId)) {
    throw Object.assign(new Error(`dispatch ${dispatchId} filed no ask report in ${workflowId}`), { code: 'ask-unknown' });
  }
  const report = db.prepare(`SELECT * FROM reports WHERE workflow_id=? AND outcome='ask' ${dispatchId ? 'AND dispatch_id=?' : ''} ORDER BY report_id DESC LIMIT 1`)
    .get(...(dispatchId ? [workflowId, dispatchId] : [workflowId]));
  const answered = report && db.prepare("SELECT 1 FROM events WHERE workflow_id=? AND kind='ask-answered' AND json_extract(payload_json,'$.dispatchId')=? LIMIT 1").get(workflowId, report.dispatch_id);
  if (report && !answered) {
    const auto = await autoAcceptAsk({ ledger, ledgerFile: ledgerFileFor(repo), repo, workflowId, report });
    if (auto.accepted) {
      const superseded = supersedeEarlierAsks(ledger, workflowId, report);
      await closeAskMessages(ledger, { ledgerFile: ledgerFileFor(repo), workflowId, dispatchIds: superseded, reason: 'retired' });
      const out = { ok: true, workflowId, dispatchId: report.dispatch_id, autoAccepted: true, optionIndex: auto.optionIndex, option: auto.option, answeredBy: auto.answeredBy, receiptPath: auto.receiptPath, wake: auto.wake?.action ?? null, telegram: auto.telegram?.sent ? 'sent' : (auto.telegram?.skipped ?? auto.telegram?.error ?? null) };
      emit(out, `ask ${report.dispatch_id} auto-accepted by config.yaml asks.autoAcceptRecommended: option ${auto.optionIndex + 1} (${auto.option}), answeredBy ${auto.answeredBy}; no form served. It binds like an owner answer for this business choice: re-enqueue the op with the answer bound (receipt ${auto.receiptPath}); a later owner answer supersedes it`, args.json);
      return;
    }
  }
  // Tell the owner, serve on demand (parkAsk). An answered ask (or none) goes
  // straight to serve-ask.mjs, which refuses it with its own error.
  const parked = report && !answered ? await parkAsk({ ledger, ledgerFile: ledgerFileFor(repo), repo, workflowId, report }) : null;
  const notice = parked?.notified ? { notified: true, messageId: parked.telegram?.messageId ?? null, fresh: Boolean(parked.telegram?.sent) } : null;
  if (parked?.notified && args.now !== true) {
    const out = { ok: true, workflowId, dispatchId: report.dispatch_id, onDemand: true, telegram: notice, superseded: parked.superseded, pid: null, servedBy: null };
    emit(out, `ask ${report.dispatch_id} parked: the owner has it on Telegram with a Generate URL button (${notice.fresh ? 'sent now' : 'already in the chat'}); no form is served until the owner asks for one. status reads awaiting-owner; the answer's ask-answered wakes you`, args.json);
    return;
  }
  // Served now: --now (local use), or Telegram is off / unreachable so nothing
  // else could serve it. Without a Telegram notice the gateway and tunnel are
  // kept up here (both starts are idempotent) so a public link exists.
  const connectors = parked?.notified ? null : ensureAskConnectors();
  const script = path.join(skillRoot, 'scripts', 'kernel', 'serve-ask.mjs');
  const argv = [script, '--repo', repo, '--workflow', workflowId, ...(dispatchId ? ['--dispatch', dispatchId] : []), ...(args.ttl ? ['--ttl', String(args.ttl)] : [])];
  const child = spawn(process.execPath, argv, { detached: true, stdio: 'ignore', windowsHide: true, cwd: skillRoot });
  child.unref();
  const why = parked ? (parked.notified ? 'now' : `telegram: ${parked.telegram?.skipped ?? parked.telegram?.error ?? 'not sent'}`) : null;
  const out = { ok: true, workflowId, dispatchId, pid: child.pid ?? null, servedBy: 'scripts/kernel/serve-ask.mjs', onDemand: false, ...(notice ? { telegram: notice } : {}), ...(why ? { servedBecause: why } : {}), ...(connectors ? { connectors } : {}) };
  emit(out, `serve-ask launched for ${workflowId}${dispatchId ? ` dispatch ${dispatchId}` : ''} (pid ${out.pid}${why ? `, ${why}` : ''}); status shows ask-serving once the form binds`, args.json);
}

/* ------------------------------------------------------------ retire-ask */
// `retire-ask --workflow <id> --dispatch <id> --reason <text>`: close an ask the
// owner should no longer answer. A StarCi Next brand ask asked the owner to
// rule on 0.4.13 contrast values that grammar 0.5.0 then fixed; with no way to
// retire it the workflow read awaiting-owner on a stale question
// (inc-6886d1399989). The ask is recorded ask-superseded with by:null and the
// reason, the same terminal kind serve-ask writes for a replaced ask.
async function cmdRetireAsk(ledger, args, repo) {
  const db = ledger.db, workflowId = args.workflow, dispatchId = args.dispatch;
  if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
  const report = db.prepare("SELECT op_id FROM reports WHERE workflow_id=? AND dispatch_id=? AND outcome='ask' LIMIT 1").get(workflowId, dispatchId);
  if (!report) throw Object.assign(new Error(`dispatch ${dispatchId} filed no ask report in ${workflowId}`), { code: 'ask-unknown' });
  const reason = String(args.reason ?? '').trim();
  if (!reason) throw Object.assign(new Error('retire-ask needs --reason <text>: a retired ask keeps why the owner no longer answers it'), { code: 'retire-needs-reason' });
  const closed = db.prepare("SELECT kind FROM events WHERE workflow_id=? AND kind IN ('ask-answered','ask-superseded') AND json_extract(payload_json,'$.dispatchId')=? ORDER BY seq DESC LIMIT 1").get(workflowId, dispatchId);
  if (closed) {
    const out = { ok: true, workflowId, dispatchId, retired: false, already: closed.kind };
    emit(out, `retire-ask ${dispatchId}: already ${closed.kind}`, args.json);
    return;
  }
  ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: 'ask-superseded',
    payload: { dispatchId, by: null, opId: report.op_id ?? null, retired: true, reason } });
  // The ask's Telegram messages leave the owner's chat (deleted; edited to
  // "no longer needs an answer" only where Telegram refuses the delete).
  const [telegram] = await closeAskMessages(ledger, { ledgerFile: ledgerFileFor(repo), workflowId, dispatchIds: [dispatchId], reason: 'retired' });
  const out = { ok: true, workflowId, dispatchId, retired: true, reason,
    ...(telegram?.deleted?.length ? { telegramDeleted: telegram.deleted } : {}), ...(telegram?.edited?.length ? { telegramEdited: telegram.edited } : {}) };
  emit(out, `retired ask ${dispatchId}: ${reason}`, args.json);
}

/* -------------------------------------------------------- consume-report */
// Kernel-facing: mark the job's reports row integrated so it is never read
// as a live answer again.
function cmdConsumeReport(ledger, args) {
  const db = ledger.db, job = resolveJob(db, args.job);
  const dispatchId = reportDispatchIdOf(db, job);
  let consumed = false;
  ledger.transaction(() => {
    const now = Date.now();
    consumed = db.prepare('UPDATE reports SET consumed_at=? WHERE workflow_id=? AND dispatch_id=? AND consumed_at IS NULL')
      .run(now, job.workflow_id, dispatchId).changes > 0;
    if (consumed) {
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
        kind: 'report-consumed', payload: { dispatchId },
      });
    }
  });
  const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, consumed };
  emit(out, `consume-report ${job.job_id} (dispatch ${dispatchId}): ${consumed ? 'report consumed' : 'no unconsumed report row'}`, args.json);
}

/* ------------------------------------------------------ caller boundary */
// An op worker ran node:sqlite against .starciwork/runtime.sqlite to inspect
// jobs (inc-360891316369). The op contract already forbade it; the owner wants
// the boundary enforced, not instructed. What the api can enforce:
//  - the op launch carries no ledger path (the packet and prompt name only the
//    api verbs) and a role marker: a command-terminal op starts with
//    STARCI_ROLE=op and STARCI_OP_JOB=<job> in its own shell (opLaunchEnv);
//  - Orca exports ORCA_TERMINAL_HANDLE into every terminal it owns, including
//    a managed worker-start agent whose env StarCi cannot set, so a caller
//    whose handle is the bound terminal of an op job IS that op;
//  - from an op caller the api refuses every kernel verb, and `report` only
//    files for the caller's own job (whose dispatch/contract binding
//    requireDispatchedReportBinding already proves).
// Residual (modules/kernel/api.yaml conventions.callerBoundary): a worker
// running with unattended permissions can still read the ledger file or unset
// the marker; the api cannot stop raw file access, only refuse its verbs.
const OP_ROLE = 'op';
const opLaunchEnv = (jobId) => ({ STARCI_ROLE: OP_ROLE, STARCI_OP_JOB: jobId });
const KERNEL_ONLY_VERBS = new Set(['plan', 'enqueue', 'route', 'dispatch', 'reconcile', 'nudge', 'observe',
  'questions', 'reply', 'peers', 'notify', 'inbox', 'settle', 'check', 'consume-report', 'serve-ask', 'retire-ask', 'incident', 'provider-health', 'finish']);
const callerOf = (db, env = process.env) => {
  const handle = env.ORCA_TERMINAL_HANDLE || null;
  const byHandle = handle ? db.prepare(`SELECT job_id,workflow_id FROM jobs WHERE kind<>'kernel' AND (worker_id=?
      OR json_extract(payload_json,'$.managed.agentTerminalHandle')=? OR json_extract(payload_json,'$.orca.agentTerminalHandle')=?
      OR json_extract(payload_json,'$.hierarchy.runtime.terminalHandle')=?) ORDER BY updated_at DESC LIMIT 1`).get(handle, handle, handle, handle) : null;
  if (env.STARCI_ROLE === OP_ROLE) return { role: OP_ROLE, jobId: env.STARCI_OP_JOB || byHandle?.job_id || null, via: 'env-role', handle };
  if (byHandle) return { role: OP_ROLE, jobId: byHandle.job_id, via: 'terminal-handle', handle };
  return { role: 'kernel', jobId: null, via: null, handle };
};
const refuseOpCaller = (ledger, { cmd, caller, code, detail }) => {
  const job = caller.jobId ? ledger.db.prepare('SELECT job_id,workflow_id FROM jobs WHERE job_id=?').get(caller.jobId) : null;
  if (job) {
    try {
      ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
        kind: 'op-caller-refused', payload: { verb: cmd, code, via: caller.via, terminal: caller.handle } }));
    } catch { /* the refusal stands without its receipt */ }
  }
  console.error(JSON.stringify({ ok: false, error: detail, code, verb: cmd, caller: { role: caller.role, jobId: caller.jobId, via: caller.via } }));
  process.exit(1);
};

/* ------------------------------------------------------------------ main */
async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === '--help' || cmd === '-h') usage(cmd ? 0 : 2);
  const args = parseArgs(argv.slice(1));
  const repo = path.resolve(args.repo ?? process.cwd());

  const required = {
    survey: ['workflow'], status: ['workflow'], hierarchy: ['workflow'], plan: ['workflow', 'file'],
    enqueue: ['workflow', 'op', 'paths'], estimate: [], route: ['job'], dispatch: ['job'],
    reconcile: [], nudge: ['job'], observe: ['job'],
    questions: ['workflow'], reply: ['workflow', 'message'],
    peers: ['workflow'], notify: ['workflow', 'to', 'kind', 'subject', 'body'], inbox: ['workflow'],
    settle: ['job', 'verdict'],
    report: ['job', 'report'], 'op-contract': [], check: ['job'],
    'consume-report': ['job'], 'serve-ask': ['workflow'], 'retire-ask': ['workflow', 'dispatch', 'reason'],
    incident: [],
    'provider-health': ['provider'],
    finish: ['workflow'],
  };
  if (!required[cmd]) usage(2);
  for (const k of required[cmd]) need(args[k], `${cmd} needs --${k}`);
  if (cmd === 'settle' && !['pass', 'fail', 'blocked'].includes(args.verdict)) need(false, `settle --verdict must be pass|fail|blocked, got '${args.verdict}'`);
  if (cmd === 'report' && args.outcome) need(REPORT_OUTCOMES.includes(args.outcome), `report --outcome must be ${REPORT_OUTCOMES.join('|')}, got '${args.outcome}'`);
  if (cmd === 'op-contract') need(args.job || (args.workflow && args.op), 'op-contract needs --job <job_id> or --workflow <id> --op <opId> [--attempt <n>]');
  if (cmd === 'reconcile') need(args.job || args['orphan-kernel-jobs'] || args['orca-tasks'], 'reconcile needs --job <job_id> (or --orphan-kernel-jobs | --orca-tasks)');
  if (cmd === 'check') need(args.checks != null || args['checks-file'], 'check needs --checks <json> or --checks-file <path>');
  if (cmd === 'inbox' && args.ack != null) need(args.disposition, 'inbox --ack <key> needs --disposition <what was done>');
  if (cmd === 'provider-health' && args.recover) need(typeof args.reason === 'string' && args.reason.trim(), 'provider-health --recover needs --reason <text>');
  if (cmd === 'provider-health' && args.probe) need(args.recover, 'provider-health --probe goes with --recover');
  if (cmd === 'incident') {
    need(args.workflow, 'incident needs --workflow');
    if (!args.resolve) { need(args.kind, 'incident needs --kind (or --resolve <incidentId>)'); need(args.detail, 'incident needs --detail'); }
  }

  let ledger;
  try {
    ledger = openRepoLedger(repo);
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error) }));
    process.exit(1);
  }
  // An op terminal reaches the ledger only through its own report and the
  // read projections (inc-360891316369).
  const caller = callerOf(ledger.db);
  if (caller.role === OP_ROLE && KERNEL_ONLY_VERBS.has(cmd)) {
    refuseOpCaller(ledger, { cmd, caller, code: 'op-context-refused',
      detail: `'${cmd}' is a kernel verb and this caller is operation ${caller.jobId ?? '(unbound)'} (${caller.via}); an op files its own api report and nothing else` });
  }
  if (caller.role === OP_ROLE && cmd === 'report' && caller.jobId !== args.job) {
    refuseOpCaller(ledger, { cmd, caller, code: 'report-identity-mismatch',
      detail: `operation ${caller.jobId ?? '(unbound)'} (${caller.via}) may file a report only for its own job, not ${args.job}` });
  }
  try {
    switch (cmd) {
      case 'survey': return cmdSurvey(ledger, args);
      case 'status': return cmdStatus(ledger, args);
      case 'hierarchy': return cmdHierarchy(ledger, args);
      case 'plan': return cmdPlan(ledger, args);
      case 'enqueue': return cmdEnqueue(ledger, args, repo);
      case 'estimate': return cmdEstimate(ledger, args);
      case 'route': return await cmdRoute(ledger, args);
      case 'dispatch': return cmdDispatch(ledger, args, repo);
      case 'reconcile': return cmdReconcile(ledger, args, repo);
      case 'nudge': return cmdNudge(ledger, args);
      case 'observe': return cmdObserve(ledger, args);
      case 'questions': return cmdQuestions(ledger, args);
      case 'reply': return cmdReply(ledger, args);
      case 'peers': return cmdPeers(ledger, args);
      case 'notify': return cmdNotify(ledger, args);
      case 'inbox': return cmdInbox(ledger, args);
      case 'settle': return cmdSettle(ledger, args, repo);
      case 'report': return cmdReport(ledger, args, repo);
      case 'op-contract': return cmdOpContract(ledger, args);
      case 'check': return cmdCheck(ledger, args, repo);
      case 'consume-report': return cmdConsumeReport(ledger, args);
      case 'serve-ask': return await cmdServeAsk(ledger, args, repo);
      case 'retire-ask': return await cmdRetireAsk(ledger, args, repo);
      case 'incident': return cmdIncident(ledger, args);
      case 'provider-health': return await cmdProviderHealth(ledger, args);
      case 'finish': return cmdFinish(ledger, args);
    }
  } catch (error) {
    console.error(JSON.stringify({ ok: false, error: String(error?.message ?? error), code: error?.code }));
    process.exit(1);
  } finally {
    ledger.close();
  }
}

main();
