// The launch plan of `starci kernel dispatch`: the model and its order, the worker placement, the packet, the environment
// pre-step, the prompt and the Orca commands. Every step reads and fills the dispatch context `d` the gates
// (dispatch-gates.mjs) share, so the dry run and the spawn report the same plan.
import fs from 'node:fs';
import path from 'node:path';
import { allocationMs } from '../../../../engine/config.mjs';
import { buildOpPrompt, renderOwnedPath, ensureJobScratch, jobScratchDirOf } from '../../op-prompt.mjs';
import { priorAttemptFailures } from '../../prior-failures.mjs';
import { withLessons } from '../../../machine/lessons-file.mjs';
import { ownerAnswersOf } from '../../../machine/owner-answers.mjs';
import { ownedPathPlacements } from '../../target-repo.mjs';
import { opWorktreeArgs, sideOf, workflowWorktreePromptRules } from '../../workflow-worktree.mjs';
import { grammarContextRequired, grammarInputsOf, resolveGrammarContext, grammarMissingDetail } from '../../grammar-context.mjs';
import { loadAdapter } from '../../../agent/lib.mjs';
import { latestGoal, ownedPathsOf, workDirOf } from './rows.mjs';
import { leaseCanonOf } from './peer-waits.mjs';
import { resolveWorkerLaunchModel, missingHostTools, defaultOperationTarget, kindRoute, raiseToFloor, loadRuntimes, loadModelRegistry } from '../../../agent/models.mjs';
import { tierMembers, tierOfOp } from '../../../agent/tiers.mjs';
import { resumeContextOf } from '../../resume-context.mjs';
import { jobDisplayName, jobWhat, workflowNameOf } from '../../../lib/display-names.mjs';
import { productLocaleFor } from '../../product-locale.mjs';
import { cutManifestOf } from '../../seam-policy.mjs';
import { kernelOverrideFor } from '../../kernel-authority.mjs';
import { pinNamesPool, recordedPinOf } from '../../lineage-pin.mjs';
import { jobDirOf } from '../../job-artifacts.mjs';
import { packetFileOf } from '../../../machine/task-spec.mjs';
import { ENV_GATED_OPS } from '../../verify-failure.mjs';
import { readEnv } from '../../../lib/env.mjs';
import { admitPacket, captureDispatchInputs } from '../../dispatch-admission.mjs';
import { refuseVerb } from './verb-exit.mjs';
import { lineageRouteAdjust } from '../../lineage-route.mjs';

/** An explicit --model pin the job's lineage excluded needs the Kernel's recorded op-override decision naming that pool. */
function refuseExcludedPin(d, model) {
  const { args, db, job, op, payload } = d;
  if (!args.model) return;
  const excluded = lineageRouteAdjust(db, job)?.exclude ?? [];
  if (!excluded.includes(model.target) || pinNamesPool(recordedPinOf(db, job.workflow_id, op, payload), [model.target])) return;
  throw Object.assign(new Error(`--model ${model.target} is excluded for ${job.job_id} by its launch and retry history; record the pin with starci kernel op-override --op ${op} --set '{"model":"${model.target}"}' --decision <id> to overrule it, or dispatch without --model`), { code: 'pin-lineage-excluded' });
}

/** The launch model, the order its kind may launch in, the brief on disk and the host tools the model lacks. */
export function planModel(d) {
  const { args, jobId, op, payload, internals } = d;
  const { skillRoot } = internals;
  const model = internals.resolveModel(args.model ?? payload.model ?? defaultOperationTarget());
  if (model.error) throw Object.assign(new Error(model.error), { code: 'model-unknown' });
  refuseExcludedPin(d, model);
  // Dispatch launches only inside the op's tier (tiers.yaml), so each kind runs on the members of its difficulty's chain.
  const route = kindRoute(op, loadRuntimes());
  const difficulty = raiseToFloor(payload.difficulty ?? 'medium', route.floor);
  const tier = tierOfOp({ kind: op, difficulty });
  const chain = tierMembers(tier);
  const allowed = chain.map((member) => member.id);
  let selectedRoute = 'the unrouted default';
  if (payload.model) selectedRoute = 'the persisted route';
  if (args.model) selectedRoute = '--model';
  const correction = args.model ? 'dispatch without --model or name a member of that tier' : `re-run starci kernel route --job ${jobId}`;
  // A persisted route names its member; an explicit agent or pool takes the tier's member of that agent (a launch-only target keeps its own model).
  const routed = payload.modelId && (!payload.model || payload.model === model.target) ? `${model.provider}/${payload.modelId}` : null;
  const targetModel = loadModelRegistry().targets?.[model.target]?.defaultModel ?? null;
  const member = chain.find((candidate) => (routed ? candidate.id === routed : candidate.provider === model.provider && (!targetModel || candidate.model === targetModel))) ?? null;
  const outsideDetail = `${selectedRoute} ${routed ?? model.target} is outside ${op}'s tier ${tier} at ${difficulty} [${allowed.join(', ')}]; ${correction}. The job stays queued.`;
  const outsideOrder = member ? null : outsideDetail;
  const launchOrder = { difficulty, tier, member, routed: Boolean(routed) };
  const briefAbs = path.join(skillRoot, 'modules', 'ops', 'ops', `${op}.yaml`);
  const briefExists = fs.existsSync(briefAbs);
  const lackingTools = missingHostTools({ pool: { provider: model.provider }, kind: op });
  Object.assign(d, { model, launchOrder, allowed, outsideOrder, briefExists, lackingTools });
}

/**
 * The workflow worktree (owner decision WFWT, scripts/kernel/workflow-worktree.mjs): Orca created it before the
 * Kernel started, and every op of the workflow launches with `--worktree <it>`; no op gets a tree of its own. Ops on
 * one side (be/ or fe/) run one at a time, across sides together (canDispatchConcurrently): a busy side is the typed
 * wait workflow-side-busy, checked with the other waits. A workflow with no worktree (an unbound repo, the
 * runtime repo included) is refused before preparation. An explicit --worktree may name this same registered tree.
 */
function planPlacement(d) {
  const { args, repo, job, op, payload, workflowTree } = d;
  const opTreeArgs = workflowTree ? opWorktreeArgs({ env: process.env }, { workflowId: job.workflow_id }) : [];
  const checkoutRoot = args.worktree ?? opTreeArgs[1] ?? repo;
  // The worker starts and works ON its checkout root: the workflow worktree is a git worktree of the app repository,
  // which Orca created and lists under the project. Every owned path is app-relative (target-repo.mjs), so the app root
  // is where they, gate.mjs --root and the app scripts resolve.
  const worktree = checkoutRoot;
  const workerCwd = (() => { const abs = path.resolve(repo, worktree); try { return fs.statSync(abs).isDirectory() ? abs : repo; } catch { return repo; } })();
  const placements = (() => {
    try {
      return ownedPathPlacements({ op, payload, ownedPaths: ownedPathsOf(payload), repo, worktree: checkoutRoot, timeoutMs: allocationMs('settleGit.commandMs') });
    } catch { return []; }
  })();
  Object.assign(d, { checkoutRoot, worktree, workerCwd, placements });
}

/** The cut manifest the brief binds before the first edit (cut-seam.mjs cutManifestOf), read from the ledger now; packet-only, never persisted on the job. */
function addCutManifest(d, packet) {
  const { db, job, jobId, op, payload } = d;
  if (!packet.context.cut) return;
  let manifest = null;
  try { manifest = cutManifestOf(db, { workflowId: job.workflow_id, op, cut: payload.cut, ownJobId: jobId }); } catch { manifest = null; }
  if (manifest) packet.context.cut = { ...packet.context.cut, manifest };
}

/** grammarContext: required rides the grammar sources in the packet; a missing one refuses the spawn (scripts/kernel/grammar-context.mjs). */
function addGrammarContext(d, packet) {
  const { repo, briefDoc, internals, workflowTree } = d;
  const grammarContext = grammarContextRequired(briefDoc) ? resolveGrammarContext({ skillRoot: internals.skillRoot, repo, tree: workflowTree?.path ?? null, inputs: grammarInputsOf(briefDoc) }) : null;
  if (grammarContext) packet.context.grammar = { family: grammarContext.family, sources: grammarContext.sources };
  d.grammarContext = grammarContext;
  d.grammarMissing = grammarContext?.missing.length ? grammarMissingDetail(grammarContext.missing) : null;
}

/** The dispatch packet: the op's contract plus the context the worker reads (owner answers, workflow tree, cut manifest, overrides, resume, grammar). */
function planPacket(d) {
  const { db, job, op, payload, model, repo, workflowTree, selectedDispatch, dispatchParams, placements, internals } = d;
  const { skillRoot, bestEffort } = internals;
  // The asks this job's retry lineage already had answered ride in the packet, so an owner-answer
  // retry applies the answer instead of asking again (scripts/machine/owner-answers.mjs).
  const ownerAnswers = (() => { try { return ownerAnswersOf(db, job); } catch { return []; } })();
  const boundGoal = payload.goal_binding?.revision != null
    ? db.prepare('SELECT * FROM goals WHERE workflow_id=? AND revision=?').get(job.workflow_id, payload.goal_binding.revision) ?? null : null;
  const packet = internals.buildPacket({ job: { ...job, op_id: op }, payload, model, goal: latestGoal(db, job.workflow_id), params: dispatchParams, placements, productLocale: productLocaleFor(repo), ownerAnswers, boundGoal });
  admitPacket(skillRoot, { packet, op, placements, db, workflowId: job.workflow_id });
  packet.context.selected_op = selectedDispatch.selected;
  if (payload.repairFor) packet.context.repair_for = payload.repairFor;
  if (workflowTree) packet.context.workflow_worktree = { repo: workflowTree.repoRoot, path: workflowTree.path, branch: workflowTree.branch, checkpoint: workflowTree.checkpoint ?? null, side: sideOf(payload) };
  addCutManifest(d, packet);
  // The Kernel's local, additive override of this op (starci kernel op-override, graph-edit params/continue, redesign).
  const ko = kernelOverrideFor(db, job.workflow_id, op, payload);
  if (ko) packet.context.kernel_override = ko;
  // The retry of a worker that died without a report resumes from what it left (scripts/kernel/resume-context.mjs).
  const resumeFrom = bestEffort(() => resumeContextOf(db, job));
  if (resumeFrom?.of) packet.context.resume_from = resumeFrom;
  addGrammarContext(d, packet);
  d.packet = packet;
}

/** The job scratch (evidence contract), the retry lineage's red checks and the captured dispatch inputs. */
function planInputs(d) {
  const { db, args, repo, job, jobId, op, packet, briefDoc, dispatchParams, workerCwd, internals } = d;
  const { skillRoot } = internals;
  // The red checks of this job's own retry lineage - for a cut ordinal its own
  // ordinal, never a sibling slice (scripts/kernel/prior-failures.mjs).
  // plus the Supervisor's lessons whose signature names one of those checks (scripts/machine/lessons-file.mjs).
  d.priorFailures = withLessons(priorAttemptFailures(db, { ...job, op_id: op }), { root: skillRoot });
  // The job scratch (evidence contract): the op writes its report and attachments there and starci kernel report reads them
  // only from op_attempts.scratch_dir / STARCI_JOB_SCRATCH. Created fresh right before the launch.
  d.scratchDir = repo ? jobScratchDirOf(repo, job.workflow_id, jobId) : null;
  const { inputs, contextPack } = captureDispatchInputs({ skillRoot, op, packet, briefDoc, params: dispatchParams,
    repo, stateDir: repo ? path.resolve(repo, workDirOf(repo)) : null, workDir: workDirOf(repo), workerCwd, planning: !args.spawn });
  Object.assign(d, { inputs, contextPack });
}

/** The worktree placement, the packet and the inputs the worker starts from. */
export function planWorker(d) {
  planPlacement(d);
  planPacket(d);
  planInputs(d);
}

/**
 * Environment pre-step, before any Orca call: a walk on a served stack (uat.verify, uat.assisted.verify, e2e.verify)
 * first proves the environment its records reference is up - probes, health-endpoint discovery, a restart of the
 * servers the runtime knows how to start - so a dead server is an environment fact on the packet, never a red walk
 * blamed on the product (scripts/uat/env-health.mjs). A port held by a process that is not this workspace's server is
 * the one state no op can fix: the job stays queued behind an [environment] incident. `--env-gate off` (or
 * STARCI_ENV_GATE=off) skips it.
 */
export function environmentGate(d) {
  const { ledger, args, repo, job, jobId, op, payload, packet, internals } = d;
  let environmentHealth = null;
  if (ENV_GATED_OPS.includes(op) && args['env-gate'] !== 'off' && readEnv('STARCI_ENV_GATE') !== 'off') {
    environmentHealth = internals.environmentPreStep(repo, payload);
    if (environmentHealth?.declared) {
      ledger.transaction(() => ledger.appendEvent({ workflowId: job.workflow_id, entityType: 'job', entityId: jobId, kind: 'environment-checked',
        payload: { op, ready: environmentHealth.ready, hardBlock: environmentHealth.hardBlock, services: internals.envServicesOf(environmentHealth) } }));
    }
    if (environmentHealth?.hardBlock) {
      const incidentId = internals.raiseEnvironmentIncident(ledger, job, environmentHealth);
      const out = { ok: false, jobId, op, reason: 'environment-not-ready', incident: incidentId, services: internals.envServicesOf(environmentHealth), remedies: environmentHealth.remedies };
      refuseVerb(d, out, `dispatch REFUSED for ${jobId} (${op}): environment-not-ready — ${environmentHealth.remedies.join(' | ')}; incident ${incidentId}. This is the environment, not the product: the job stays queued and costs no attempt; dispatch again once the port is free (or --env-gate off to walk anyway)`);
    }
  }
  if (environmentHealth?.declared) packet.context.environment = { ready: environmentHealth.ready, checkedAt: environmentHealth.at, services: internals.envServicesOf(environmentHealth), remedies: environmentHealth.remedies };
}

/** The Orca commands one launch is made of (the plan shows the flags spawnAgent really sends). */
function orcaCommandsOf(d) {
  const { db, job, op, model, checkoutRoot, title, launchModel, takesModel } = d;
  return [
    { step: 'run', argv: ['orchestration', 'run-create', '--objective', `[Workflow] ${workflowNameOf(db, job.workflow_id)} — ${job.workflow_id}`, '--from', '<kernel-terminal>', '--json'], note: 'created once per workflow by the Kernel; later operations reuse it' },
    { step: 'worker-start', argv: ['orchestration', 'worker-start', '--spec', '<prompt>', '--task-title', `${op} #${job.try_no}`, '--worktree', checkoutRoot, '--agent', model.provider ?? '<agent>',
      ...(takesModel && launchModel.modelId ? ['--model', launchModel.modelId, ...(launchModel.effort ? ['--effort', launchModel.effort] : [])] : []), '--display-name', title, '--run', '<workflow-run-id>', '--from', '<kernel-terminal>',
      '--retry-request', '<uuid derived from the job + lease>', '--json'], note: 'Orca files the Task (result.taskId) and names the agent terminal (result.worker.agentTerminalHandle)' },
    { step: 'title', argv: ['terminal', 'rename', '--terminal', '<agent-terminal>', '--title', title, '--json'] },
    { step: 'attest', argv: ['orchestration', 'worker-show', '--dispatch', '<dispatch-id>', '--json'], note: 'effective agent/model must equal the route' },
  ];
}

/** The prompt, the packet file, the names a person reads, the launch model and the Orca commands. */
export function planPrompt(d) {
  const { db, repo, job, jobId, op, payload, model, launchOrder, packet, priorFailures, workerCwd, scratchDir, contextPack, workflowTree, internals } = d;
  const { skillRoot } = internals;
  d.prompt = buildOpPrompt({ skillRoot, packet, jobId, repo, priorFailures, cwd: workerCwd, scratchDir, contextPack }) + workflowWorktreePromptRules(workflowTree);
  d.packetFile = repo ? packetFileOf(jobDirOf(repo, job.workflow_id, jobId), job.try_no) : null;
  // The names a person reads (owner request 2026-09-27, scripts/lib/display-names.mjs): the Task display
  // name, the managed worker's tab (terminal-rename once its handle is known) and the command terminal's title
  // are all `[Op] <op label> · <what> · <workflow name>`. Left untitled, a terminal shows the provider's
  // own auto-summary ("devin.exe: Kernel orchestration for…"). op_id and job_id stay the keys.
  const opWhat = jobWhat({ payload, op, nodes: internals.latestGraphNodesOf(db, job.workflow_id), repo });
  d.title = `[Op] ${jobDisplayName({ op, what: opWhat, workflowName: workflowNameOf(db, job.workflow_id) })}`;
  // The one launch (modules/kernel/start-workflow.yaml, worker-start-spec.yaml): worker-start --spec
  // --agent on the op's own worktree, which files the Task in the same call. The launch model is the persisted route's, else the pool's
  // pin at the kind's tier, else the registry default (resolveWorkerLaunchModel); a card that takes no model flag (devin) starts on its default.
  const { member, routed } = launchOrder;
  d.launchModel = member ? { modelId: member.model, effort: (routed ? payload.effort : null) ?? member.effort ?? null, source: routed ? 'route' : 'tier' }
    : resolveWorkerLaunchModel({ target: model.target, payload: { ...payload, difficulty: launchOrder.difficulty ?? payload.difficulty } });
  d.takesModel = loadAdapter(model.provider).card?.start?.modelArgument !== false; // the plan shows the flags spawnAgent really sends: a card with start.modelArgument false (devin) gets no --model/--effort
  d.orcaCommands = orcaCommandsOf(d);
}

/** The dry-run result object: the packet, the prompt, the lease requests, the launch model and what a spawn would refuse. */
function dryRunOut(d) {
  const { db, repo, jobId, op, payload, model, packet, prompt, checkoutRoot, title, launchModel, orcaCommands, briefExists, lackingTools, outsideOrder, grammarMissing, internals } = d;
  const launch = launchModel.error ? { agent: model.provider, error: `${model.target} has no launch model: ${launchModel.error}` }
    : { agent: model.provider, model: launchModel.modelId, effort: launchModel.effort ?? null, modelSource: launchModel.source };
  return {
    ok: true, spawned: false, jobId, packet, prompt,
    leases: internals.opLeaseRequests(payload, leaseCanonOf(db, repo), op),
    launch,
    orca: { worktree: checkoutRoot, title, profile: model.profile, commands: orcaCommands.map((c) => ({ step: c.step, cli: `orca ${c.argv.join(' ')}`, note: c.note })) },
    ...(!briefExists && { briefMissing: `modules/ops/ops/${op}.yaml not present — spawn will refuse` }),
    ...(lackingTools.length && { toolUnavailable: `${model.target} lacks host tool ${lackingTools.join(', ')} — spawn will refuse tool-unavailable` }),
    ...(outsideOrder && { modelOutsideOrder: outsideOrder }),
    ...(grammarMissing && { grammarContextMissing: `${grammarMissing} — spawn will refuse grammar-context-missing` }),
  };
}

/** The human lines of a dry run. */
function dryRunLines(d, out) {
  const { jobId, op, model, packet, workerCwd, briefExists, grammarMissing } = d;
  const ownerAnswerValues = packet.context.owner_answers?.map((answer) => `${answer.dispatchId} -> ${answer.chosen?.label ?? answer.chosen?.index ?? 'answered'} (${answer.answeredBy})`).join(', ');
  const ownerAnswersLine = packet.context.owner_answers ? `  owner_answers: ${ownerAnswerValues}` : null;
  const launchCommand = out.launch.error ?? `worker-start --agent ${out.launch.agent} --model ${out.launch.model} (${out.launch.modelSource})`;
  const orcaCommandLines = out.orca.commands.map((command) => `    $ ${command.cli}`);
  return [
    `PACKET job=${jobId} op=${op} model=${model.target}`,
    `  brief: ${packet.brief}${briefExists ? '' : ' — MISSING ON DISK'}`,
    `  records: ${packet.context.records.join(', ') || '(none)'}`,
    ...(packet.context.grammar ? [`  grammar (${packet.context.grammar.family ?? 'unset'}): ${packet.context.grammar.sources.map((s) => s.path).join(', ')}`] : []),
    ...(grammarMissing ? [`  grammar MISSING: ${grammarMissing}`] : []),
    ...(packet.context.cut ? [`  cut: ${packet.context.cut.id} ${packet.context.cut.ordinal}/${packet.context.cut.total}`] : []),
    ...(ownerAnswersLine ? [ownerAnswersLine] : []),
    `  owned_paths: ${packet.context.owned_paths.map((p) => renderOwnedPath(p, workerCwd)).join(', ') || '(none)'}`,
    `  launch: ${launchCommand}`,
    '  orca commands:', ...orcaCommandLines,
    '  (dry run — pass --spawn to launch)',
  ];
}

/** The dry run (no --spawn): the packet and what a spawn would do, emitted without launching anything. */
export function emitDryRun(d) {
  const out = dryRunOut(d);
  d.emit(out, dryRunLines(d, out).join('\n'), d.args.json);
}

/** Creates the job scratch right before the launch. */
export function prepareScratch(d) {
  if (d.scratchDir) ensureJobScratch({ repo: d.repo, workflowId: d.job.workflow_id, jobId: d.jobId });
}
