// contract-shapes.mjs — the harness data contract as runtime-checkable shapes: one entry per endpoint of ui/server.mjs,
// mirroring ui/src/contract.ts field for field (tests/harness-contract.spec.mjs holds the two in step). What the
// contract spec validates the fixture server's responses and ui/fixtures/*.json against, and what
// ui/contract-capture.mjs checks a live capture with.
//
// Shape DSL: S string, N number, I integer, B boolean, U unknown (any JSON), nul(x) x|null, opt(x) key may be absent,
// arr(x), rec(x) (a string-keyed map of x), en(...values), obj(name, fields) (strict: an unknown key is a finding,
// so a server field the contract does not document fails the spec), open(name, fields) (extra keys allowed).
import { JOB_ARTIFACT_KINDS, JOB_ARTIFACT_SUBKINDS } from '../engine/ledger-db.mjs';
import { LOG_ACTORS, LOG_KINDS, LOG_LEVELS, validateLogData } from '../scripts/kernel/typed-logs.mjs';
import { UNIT_EDGE_KINDS } from './unit-graph.mjs';

const S = { t: 'string' }, N = { t: 'number' }, I = { t: 'int' }, B = { t: 'bool' }, U = { t: 'any' };
const nul = (x) => ({ ...x, nullable: true });
const opt = (x) => ({ ...x, optional: true });
const arr = (item) => ({ t: 'array', item });
const rec = (val) => ({ t: 'record', val });
const en = (...vals) => ({ t: 'enum', vals: vals.flat() });
const obj = (name, fields) => ({ t: 'object', name, fields, strict: true });
const open = (name, fields) => ({ t: 'object', name, fields, strict: false });
const tuple = (...items) => ({ t: 'tuple', items });

// ------------------------------------------------------------------------------------------ vocabularies
export const VOCAB = Object.freeze({
  artifactKinds: JOB_ARTIFACT_KINDS,
  artifactSubkinds: JOB_ARTIFACT_SUBKINDS,
  logKinds: Object.keys(LOG_KINDS),
  logActors: LOG_ACTORS,
  logLevels: LOG_LEVELS,
  jobStatuses: ['queued', 'leased', 'running', 'answering', 'effect_unknown', 'succeeded', 'failed', 'cancelled'],
  verdicts: ['pass', 'fail', 'blocked', 'unknown'],
  legColors: ['green', 'yellow', 'red', 'gray', 'green-provisional', 'deferred'],
  workflowEventKinds: ['job-enqueued', 'op-dispatched', 'report-filed', 'kernel-transition-woken', 'report-consumed', 'checks-recorded', 'op-settled', 'job-dropped', 'work-graph-version'],
  evidenceKinds: ['ai-draw', 'screenshot', 'uat-video'],
  agentProviders: ['qwen', 'devin', 'claude', 'codex'],
  agentRoles: ['kernel', 'op', 'other'],
  agentActivities: ['cooking', 'idle', 'unknown', 'disconnected'],
  repositories: ['BE', 'FE'],
  diffStatuses: ['A', 'M', 'D', 'R'],
  diffLineTypes: [' ', '+', '-'],
  proofFileKinds: ['image', 'video', 'patch', 'file'],
  coverageStatuses: ['proven', 'stale', 'missing'],
  coverageItemKinds: ['fr', 'shape', 'case'],
  evidenceStates: ['fresh', 'stale', 'unbaselined'],
  tamperReasons: ['missing', 'modified', 'ledger-row-differs-from-chain'],
  attemptStages: ['dispatched', 'routed', 'none'],
  unitEdgeKinds: UNIT_EDGE_KINDS,
  controllers: ['job', 'host', 'gc', 'resource', 'workflow', 'fleet', 'learning'],
});
const V = VOCAB;

// -------------------------------------------------------------------------------------------- snapshot
const Unit = obj('Unit', { label: S, displayName: opt(S), jobId: nul(S), status: S, model: nul(S), cut: opt(nul(obj('UnitCut', { id: S, ordinal: I, total: I }))),
  queuedBecause: opt(S), ceiling: opt(nul(N)), slotsHeld: opt(nul(N)) });
const LegRow = obj('LegRow', { op: S, state: S, since: nul(N), rework: opt(B), color: opt(nul(en(V.legColors))), units: opt(obj('LegUnits', { total: I, planned: B, units: arr(Unit) })) });
const WorkGraphNode = obj('WorkGraphNode', { id: S, domain: S, slice: S, kind: S, title: S, parent: nul(S), color: en(V.legColors), frs: arr(S), shapes: arr(S), inferred: B,
  lastOp: nul(S), jobs: arr(obj('WorkGraphNodeJob', { jobId: S, op: S, status: S, model: nul(S) })) });
const WorkGraph = obj('WorkGraph', { version: I, event: S, domains: arr(S), nodes: arr(WorkGraphNode), edges: arr(obj('WorkGraphEdge', { from: S, to: S, kind: S })), frontier: arr(S),
  history: arr(obj('WorkGraphVersion', { version: I, event: S, reason: S, authorOp: S, authorJob: nul(S), at: N, added: I, removed: I, changed: I, red: arr(S) })) });
const VerdictEntry = obj('VerdictEntry', { jobId: S, op: S, attempt: nul(I), verdict: S, checks: nul(open('VerdictChecks', { observed: opt(N), passed: opt(N), failed: opt(N), green: opt(B) })), at: N, displayName: opt(S) });
const DrawReviewNote = obj('DrawReviewNote', { id: S, text: S, round: nul(I), class: S, shape: nul(S), addressed: opt(B), reasons: opt(arr(S)) });
const DrawReview = obj('DrawReview', { record: S, state: S, awaitingOwner: B,
  rounds: arr(obj('DrawReviewRound', { round: nul(I), dispatchId: S, state: S, decision: nul(S), answeredAt: nul(S), golden: B, notes: arr(DrawReviewNote) })),
  shapes: arr(obj('DrawReviewShape', { shape: S, round: nul(I), golden: S, addressed: I, unaddressed: I, openNotes: arr(DrawReviewNote),
    images: arr(obj('DrawReviewImage', { path: S, shape: nul(S), breakpoint: nul(S), imageId: nul(S) })) })) });
const WorkflowRow = obj('WorkflowRow', {
  id: S, name: S, projectId: S, goal: S,
  kernel: obj('KernelSignal', { state: S, at: nul(N), agent: S, model: S }),
  verdicts: obj('VerdictCounts', { pass: I, fail: I, blocked: I }),
  running: arr(obj('RunningJob', { jobId: S, op: S, attempt: I, since: N, status: S, displayName: opt(S) })),
  queued: arr(obj('QueuedJob', { jobId: S, op: S, since: nul(N), reason: S, displayName: opt(S), queuedBecause: opt(S), ceiling: opt(nul(N)), slotsHeld: opt(nul(N)), peer: opt(S), blockedBy: opt(nul(obj('BlockedBy', { op: S, job: S }))) })),
  incidents: arr(obj('IncidentRow', { id: S, op: nul(S), text: S, at: N })),
  recentVerdicts: arr(VerdictEntry),
  frontier: nul(obj('Frontier', { state: S, actionable: B, reason: S, queuedCauses: rec(N), peerWaits: arr(obj('PeerWait', { peer: S, job: S, reason: S })) })),
  plan: opt(nul(obj('PlanGraph', { edges: arr(tuple(S, S)), source: S }))),
  workGraph: opt(nul(WorkGraph)),
  done: nul(N), total: nul(N), legs: arr(LegRow),
  nextActions: opt(nul(arr(obj('NextAction', { kind: S, op: S, jobId: nul(S), incidentId: nul(S), reason: S, displayName: opt(S) })))),
  etaAt: nul(N),
  lastReport: nul(obj('LastReport', { op: S, outcome: S, summary: S, at: N })),
  asks: arr(obj('AskRow', { op: S, askClass: S, text: S, link: nul(S) })),
  holds: arr(obj('HoldRow', { op: S, reason: S, peer: S, jobId: S, since: nul(N) })),
  workers: opt(arr(obj('WorkerRow', { jobId: S, liveness: S, connected: B }))),
  grammarProposals: opt(arr(obj('GrammarProposal', { name: S, opId: nul(S), jobId: nul(S), file: nul(S), complete: B }))),
  drawReviews: opt(arr(DrawReview)),
  logTypedMissing: opt(arr(obj('LogTypedMissing', { jobId: S, op: nul(S), attempt: nul(I), code: en('LOG_TYPED_MISSING'), missing: arr(S), opRows: I, at: nul(N) }))),
});
const DependencyView = obj('DependencyView', {
  edges: arr(obj('DependencyEdge', { from: S, to: S, via: S })),
  findings: arr(obj('DependencyFinding', { kind: S, workflows: arr(S), summary: S, action: S, clearCut: B })),
  bridges: arr(obj('BridgeRow', { id: S, action: S, state: S, workflowId: nul(S), provisional: B })),
});
const ProjectRow = obj('ProjectRow', { id: S, name: S, repo: S, error: opt(S),
  totals: nul(obj('ProjectTotals', { workflows: I, kernels: I, workers: I, pass: I, fail: I, blocked: I, incidents: I })), workflows: arr(WorkflowRow),
  dependencies: opt(nul(DependencyView)) });
const OpHealthRow = obj('OpHealthRow', { key: S, jobs: I, succeeded: I, failed: I, successRate: nul(N), queueWaitP50: nul(N), queueWaitP90: nul(N), runP50: nul(N), settleP50: nul(N),
  topFailureClass: nul(S), failureClasses: arr(obj('FailureClassCount', { class: S, n: I })), repeatedIdentical: I, deadWorkerRate: nul(N), attemptsMax: nul(I), ownerWaitMs: N, throttleMs: N });
const LandEvent = obj('LandEvent', { kind: S, id: S, at: N });
const PushEvent = obj('PushEvent', { kind: S, repo: S, head: S, error: S, at: N });
const OpHealth = obj('OpHealth', { windowMs: N, at: N, totals: OpHealthRow, ops: arr(OpHealthRow) });
const StuckItem = obj('StuckItem', { key: S, projectId: nul(S), workflowId: S, kind: S, cause: S, jobId: nul(S), opId: nul(S), incidentId: nul(S),
  since: N, ageMs: N, severity: en('ok', 'warn', 'critical'), owner: S, count: I, detail: S });
const Snapshot = obj('Snapshot', {
  updatedAt: N, sources: rec(nul(S)), opLabels: opt(rec(obj('OpLabel', { vi: S, en: S }))), projects: arr(ProjectRow),
  owed: arr(obj('OwedItem', { key: S, projectId: nul(S), workflowId: S, kind: S, summary: S, ageMin: nul(N), status: S })),
  owedCounts: rec(N), inboxUnreadTotal: I,
  inbox: arr(obj('InboxMessage', { id: S, at: S, from: S, text: S, read: B, judgedAt: nul(S) })),
  supervisor: nul(obj('SupervisorView', {
    activeWorkers: arr(obj('SupervisorWorker', { agent: S, cluster: S, ageMin: nul(N) })),
    land: obj('LandQueue', { busy: B, queued: I, current: S }),
    lastLands: arr(LandEvent),
    pushes: arr(PushEvent),
    basePool: obj('BasePool', { name: S, provider: S, model: S, open: I, ledgers: I }),
  })),
  opHealth: opt(nul(OpHealth)),
  stuck: opt(arr(StuckItem)),
});

// ------------------------------------------------------------------------- workflow page, system page
const UnitAttempt = obj('UnitAttempt', { number: nul(I), stage: en(V.attemptStages), agent: nul(S), provider: nul(S), model: nul(S), pool: nul(S), effort: nul(S),
  routedAt: nul(N), startedAt: nul(N), dispatches: I, lastEventAt: nul(N), reportedAt: nul(N), settledAt: nul(N), source: nul(S), why: nul(S) });
const BoardUnit = obj('BoardUnit', { key: S, op: S, jobId: S, status: S, unitState: S, attempts: I, label: S, title: nul(S), displayName: nul(S),
  verdict: nul(S), outcome: nul(S), summary: nul(S), at: nul(N), attempt: UnitAttempt,
  diff: nul(obj('UnitDiffRef', { jobId: S, label: nul(en('landed', 'unlanded')), headSha: nul(S), landedSha: nul(S), at: nul(N) })) });
const UnitGraph = obj('UnitGraph', { status: en('ok', 'empty'), reason: nul(S),
  nodes: arr(obj('UnitGraphNode', { unitKey: S, jobId: S, op: S, status: S, unitState: S, attempts: I, cut: nul(obj('UnitGraphCut', { id: S, ordinal: I, total: nul(I) })) })),
  edges: arr(obj('UnitGraphEdge', { from: S, to: S, kind: en(V.unitEdgeKinds), source: S, fromJob: S, toJob: S, met: B, released: nul(S) })),
  counts: obj('UnitGraphCounts', { after: I, seam: I, dangling: I, selfLoops: I }),
  sources: obj('UnitGraphSources', { after: S, seam: S }),
  omitted: arr(obj('UnitGraphOmission', { kind: S, why: S })), at: N, source: S });
const UnitBoard = obj('UnitBoard', {
  counts: obj('UnitBoardCounts', { queued: I, running: I, reported: I, settled: I, released: I }),
  groups: obj('UnitBoardGroups', { queued: arr(BoardUnit), running: arr(BoardUnit), reported: arr(BoardUnit), settled: arr(BoardUnit), released: arr(BoardUnit) }),
  graph: UnitGraph });
const DecisionView = obj('DecisionView', { id: S, kind: S, decider: nul(S), status: S, ledger: S, workflowId: nul(S), summary: S,
  entity: nul(obj('DecisionEntity', { type: S, id: S })), openedBy: nul(S), openedAt: nul(N), dueAt: nul(N), escalations: I, severity: nul(S),
  claim: nul(obj('DecisionClaim', { by: S, at: N })), resolution: nul(obj('DecisionResolution', { by: S, verb: S, at: N })),
  options: arr(obj('DecisionOption', { key: S, recommended: B })), projectId: opt(S) });
const ProgressBlock = obj('ProgressBlock', { unitsDone: I, unitsTotal: I, unitsOpen: I, unitsFailed: I, share: nul(N), unitsPerHour: N, minUnitsPerHour: N, priority: B,
  running: I, allowedParallel: I, parallelWhy: S, queuedReady: I, etaHours: nul(N), eta: nul(S), lastUnitAt: nul(S),
  legs: obj('ProgressLegs', { done: I, total: I }),
  stall: obj('ProgressStall', { stalled: B, reasons: arr(S), since: nul(S), sinceMin: N, supervisorDue: B }), unsettled: I });
const Fleet = obj('Fleet', { progress: ProgressBlock, pill: S, topReason: nul(obj('TopReason', { text: S, cause: nul(S), source: S })),
  onIt: obj('OnIt', { who: S, next: nul(S), source: nul(S), actionKey: opt(nul(S)), unblocks: opt(nul(N)) }),
  rca: obj('RcaView', { id: S, attempts: I, trigger: nul(S), why: nul(S),
    clusters: arr(obj('RcaCluster', { cause: S, why: S, authority: S, count: I, open: I, units: I, examples: arr(S) })),
    actions: arr(obj('RcaAction', { rank: I, key: S, tier: S, cause: S, unblocks: N, title: S, expected: S, tried: nul(obj('RcaTried', { decision: S, status: S })) })) }),
  decisionLog: arr(obj('DecisionLogRow', { id: S, actionKey: nul(S), status: S, hypothesis: S, observed: U })) });
const WorkflowPageData = obj('WorkflowPageData', { updatedAt: N, projectId: S, projectName: S, snapshot: Snapshot, fleet: nul(Fleet), board: nul(UnitBoard),
  decisions: arr(DecisionView),
  worktrees: arr(obj('WorktreeRow', { kind: en('wf', 'op'), path: S, branch: nul(S), short: nul(S), jobId: nul(S), jobStatus: nul(S), exists: B, state: S, at: opt(nul(N)) })),
  statusAt: nul(N) });
const ServiceRow = obj('ServiceRow', { name: S, state: S, since: nul(N), restarts: I, lastAt: opt(nul(N)), detail: nul(S), down: opt(B) });
const ReconcilerView = obj('ReconcilerView', { at: N,
  engine: obj('EngineView', { running: B, why: nul(S), holder: nul(S), pid: nul(I), epoch: nul(I), heartbeatAgeMs: nul(N), rev: nul(S) }),
  controllers: arr(obj('ControllerRow', { name: en(V.controllers), mode: nul(S), modeSource: nul(S), modeAt: nul(N), lastPassAt: nul(N),
    would: I, acts: I, failed: I, errors: I, events: I, lastActAt: nul(N), lastErrorAt: nul(N), lastError: nul(S), lastWould: nul(S),
    queue: obj('ControllerQueue', { depth: I, failing: I, dueAt: nul(N) }) })),
  others: arr(obj('ReconcilerOtherRow', { name: S, would: I, acts: I, errors: I, events: I, lastAt: nul(N), lastErrorAt: nul(N), lastError: nul(S) })),
  windowMs: N, logSource: S, queueDepth: I,
  services: obj('ServicesView', { rows: arr(ServiceRow), managed: I, healthy: I, down: arr(S), seats: arr(ServiceRow), ledgers: arr(ServiceRow), source: nul(S) }),
  violations: obj('ViolationsView', { open: I, critical: I, byCode: rec(I), rows: arr(obj('ViolationRow', { key: S, code: nul(S), severity: nul(S), entity: S, at: nul(N) })), clocks: I, source: nul(S) }),
  gc: nul(obj('GcView', { at: N, msg: S, collected24h: I, leftovers: nul(N), counts: nul(obj('GcCounts', { agents: I, terminals: I, worktrees: I, freedBytes: N, refused: I, errors: I })), source: S })) });
const SystemView = obj('SystemView', { updatedAt: N, reconciler: ReconcilerView, ram: obj('HostRam', { percent: N, usedBytes: N, totalBytes: N }),
  supervisor: obj('SystemSupervisor', {
    seat: nul(obj('SystemSeat', { state: S, since: nul(N), lastAt: nul(N), source: S })),
    notifier: nul(obj('NotifierView', { lastDigestAt: nul(N), urgent: arr(obj('NotifierUrgent', { key: S, at: N })), judgements: arr(obj('NotifierJudgement', { text: S, at: N })), source: S })),
    inboxUnread: I, inbox: arr(obj('SystemInboxRow', { at: S, from: S, text: S, read: B })) }),
  decisions: obj('SystemDecisions', { supervisor: arr(DecisionView), product: arr(DecisionView) }),
  opHealth: nul(OpHealth), stuck: arr(StuckItem),
  land: nul(obj('SystemLand', { busy: B, queued: I, current: S, lastLands: arr(LandEvent), pushes: arr(PushEvent) })),
  sources: rec(nul(S)) });

// ---------------------------------------------------------------------------------------------- agents
const AgentRow = obj('AgentRow', { id: S, workflowId: nul(S), workflowName: nul(S), displayName: opt(nul(S)), projectId: nul(S), projectName: nul(S), role: en(V.agentRoles), op: S, attempt: nul(I), task: S, action: S,
  cut: nul(obj('AgentCut', { ordinal: I, total: I })), status: S, provider: nul(en(V.agentProviders)), model: nul(S), terminal: nul(S), since: nul(N), activity: en(V.agentActivities),
  connected: nul(B), lastOutputAt: nul(N) });
const ProviderGroup = obj('ProviderGroup', { terminals: I, cooking: I, processCount: nul(I), cpuPercent: nul(N), ramBytes: nul(N) });
const AgentSnapshot = obj('AgentSnapshot', { updatedAt: N, language: S, agents: arr(AgentRow), groups: rec(ProviderGroup),
  machine: nul(obj('MachineStats', { cpu: obj('CpuStats', { name: S, cores: I, threads: I, percent: N }), memory: obj('MemoryStats', { totalBytes: N, usedBytes: N, percent: N }),
    gpu: arr(obj('GpuStats', { name: S, percent: nul(N), totalBytes: nul(N), usedBytes: nul(N), temperatureC: nul(N), powerW: nul(N) })) })),
  sources: rec(nul(S)) });
const AgentLog = obj('AgentLog', { terminal: S, updatedAt: N, source: S, language: S, lines: arr(S),
  events: arr(obj('AgentLogEvent', { kind: en('running', 'command', 'success', 'error', 'change'), title: S, detail: S, line: I })), limited: B });
const AgentChanges = obj('AgentChanges', { jobId: S, updatedAt: N, source: en('op-worktree', 'shared-tree', 'worktree-missing'),
  worktree: nul(obj('AgentWorktree', { repository: nul(en(V.repositories)), path: S, branch: nul(S), workflowBranch: nul(S), base: nul(S), head: nul(S) })), note: S,
  patches: arr(obj('AgentPatch', { repository: en(V.repositories), kind: en('working', 'staged', 'untracked', 'committed'), files: arr(S), patch: S, truncated: B })),
  images: arr(obj('AgentImage', { id: S, repository: en(V.repositories), name: S, path: S, modifiedAt: N, size: I })) });

// ------------------------------------------------------------------------------------ evidence, history
const EvidenceItem = obj('EvidenceItem', { id: S, projectId: S, projectName: S, kind: en(V.evidenceKinds), name: S, path: S, workflowId: nul(S), size: I, modifiedAt: N,
  surface: opt(nul(S)), shape: opt(nul(S)), retired: opt(B) });
const EvidencePage = obj('EvidencePage', { updatedAt: N, total: I, counts: rec(I), items: arr(EvidenceItem) });
const History = obj('History', { projectId: nul(S), commits: arr(obj('CommitRow', { sha: S, repository: en(V.repositories), at: N, subject: S })) });
const CommitPatch = obj('CommitPatch', { sha: S, repository: en(V.repositories), files: arr(S), patch: S, truncated: B });

// ----------------------------------------------------------------------------------- proofs, artifacts
const ProofFile = obj('ProofFile', { id: S, kind: en(V.proofFileKinds), name: S, path: S, size: I, modifiedAt: N, url: S, shape: opt(nul(S)) });
const JobProofs = obj('JobProofs', { jobId: S, op: S, status: en(V.jobStatuses), attempt: I, model: nul(S), createdAt: N, updatedAt: N,
  cut: nul(obj('ProofCut', { id: S, ordinal: nul(I), total: nul(I) })), title: nul(S), verdict: nul(S),
  report: nul(obj('ProofReport', { outcome: nul(S), summary: nul(S), rootCause: nul(S), nextStep: nul(S), checks: I, filedAt: nul(N) })),
  heads: arr(obj('ProofHead', { sha: S, repository: en(V.repositories), source: en('landed', 'report') })), files: arr(ProofFile) });
const OpProofs = obj('OpProofs', { projectId: S, workflowId: S, op: S, jobs: arr(JobProofs) });
const Artifact = obj('Artifact', { kind: en(V.artifactKinds), subkind: opt(nul(en(V.artifactSubkinds))), path: S, sha256: S, bytes: I, mime: nul(S), label: nul(S), origin: nul(S),
  headSha: opt(nul(S)), landedSha: opt(nul(S)), baseSha: opt(nul(S)), createdAt: N });
const ArtifactJob = obj('ArtifactJob', { jobId: S, opId: nul(S), attempt: nul(I), cut: nul(S), status: nul(en(V.jobStatuses)), byKind: rec(I), bySubkind: opt(rec(I)), artifacts: arr(Artifact) });
const Artifacts = obj('Artifacts', { projectId: S, workflowId: S, jobs: arr(ArtifactJob), total: I });

// --------------------------------------------------------------------------------------- events, logs
const WorkflowEvent = obj('WorkflowEvent', { seq: I, kind: en(V.workflowEventKinds), at: N, jobId: nul(S), op: nul(S), from: S, to: S, attempt: nul(I), outcome: nul(S), verdict: nul(S),
  transition: nul(S), delivery: nul(S), model: nul(S), version: nul(I) });
const WorkflowEvents = obj('WorkflowEvents', { workflowId: S, projectId: S, events: arr(WorkflowEvent), cursor: I });
const LogRow = obj('LogRow', { seq: I, at: N, workflowId: S, jobId: nul(S), actor: en(V.logActors), nodeId: nul(S), level: en(V.logLevels), kind: en(V.logKinds), msg: S, data: rec(U), refs: arr(S) });
const LogPage = obj('LogPage', { projectId: S, workflowId: S, rows: arr(LogRow), cursor: I, more: B,
  synced: nul(obj('LogSync', { derived: opt(I), sidecar: opt(I), error: opt(S), deferred: opt(S) })) });

// ------------------------------------------------------------------------------------------ supervisor
const SupervisorLogPage = obj('SupervisorLogPage', { workflowId: S, rows: arr(LogRow), cursor: I, more: B });
const OwedAction = obj('OwedAction', { key: S, class: S, workflowId: nul(S), subject: nul(S), evidence: S, do: S, ageMin: I, firstSeenAt: I, actedAt: nul(N), breach: B, lessons: arr(S) });
const SupervisorState = obj('SupervisorState', { schema: en('starci/supervisor-state@1'), at: N,
  seat: obj('SupervisorSeat', { mode: en('chat', 'kernel'), enabled: nul(B), terminal: nul(S), agent: nul(S), model: nul(S), state: nul(S), since: nul(N), lastBoot: nul(N) }),
  tick: nul(obj('SupervisorTick', { at: I, ok: B, alerts: I, errors: I, owed: I, clusters: I,
    ramThrottle: nul(obj('SupervisorRamThrottle', { effectiveCap: nul(N), maxParallelOps: nul(N), running: I, queued: I, mode: S, why: nul(S), capWhy: nul(S), freeRamPct: nul(N), cpuBusy: nul(N) })) })),
  workflows: arr(obj('SupervisorWorkflow', { workflowId: S, state: nul(S), ready: I, holds: rec(I), error: nul(S) })),
  owed: obj('SupervisorOwed', { at: nul(N), items: arr(OwedAction) }),
  actions: arr(obj('SupervisorActionRecord', { at: N, item: S, action: S, reason: nul(S), workflowId: nul(S) })),
  messages: obj('SupervisorMessages', {
    inbox: arr(obj('SupervisorInboxMessage', { id: S, at: S, from: nul(S), text: S, read: B })),
    outbox: arr(obj('SupervisorReply', { id: S, at: S, to: nul(S), via: nul(S), ok: B, text: S })) }),
  learning: obj('SupervisorLearning', {
    hypotheses: arr(obj('SupervisorHypothesis', { signature: S, causeClass: S, symptom: S, source: S, at: I })),
    experiments: arr(obj('SupervisorExperiment', { id: S, signature: S, status: S, tier: S, commits: arr(S), lane: nul(S), landedAt: nul(N), reason: nul(S), result: nul(S) })),
    lessons: arr(obj('SupervisorLesson', { signature: nul(S), source: S, weight: N, status: S, text: S, at: I })),
    proposals: arr(obj('SupervisorProposal', { id: S, title: S, evidence: S, options: S, recommendation: S, status: S, at: I })) }),
  digest: nul(obj('SupervisorDigest', { at: I, sent: B })) });

// ------------------------------------------------------------------------------------------------ diff
const DiffLine = obj('DiffLine', { t: en(V.diffLineTypes), o: nul(I), n: nul(I), s: S });
const DiffBlob = obj('DiffBlob', { blob: S, asset: opt(S) });
const DiffFile = obj('DiffFile', { path: S, oldPath: nul(S), status: en(V.diffStatuses), added: I, removed: I, language: S, binary: B, image: B, touches: I,
  hunks: arr(obj('DiffHunk', { header: S, oldStart: I, newStart: I, lines: arr(DiffLine) })), truncated: B, before: opt(DiffBlob), after: opt(DiffBlob), omitted: opt(B) });
const JobDiff = obj('JobDiff', { projectId: S, jobId: S, stored: B, patchPath: opt(S), schema: opt(S), patch: opt(S), base: nul(S), head: nul(S), landed: nul(S), unlanded: B, landedLater: opt(nul(S)),
  commits: arr(obj('DiffCommit', { sha: S, subject: nul(S) })), totals: obj('DiffTotals', { files: I, added: I, removed: I }), files: arr(DiffFile),
  truncated: opt(B), omittedFiles: opt(I), tooLarge: opt(B), bytes: opt(I),
  caps: opt(obj('DiffCaps', { fileLines: I, totalLines: I, files: I, lineChars: I, assetBytes: I })) });

// ------------------------------------------------------------------------------- contract, proof verbs
const ContractInfo = obj('ContractInfo', { schema: en('starci/harness-contract@1'), version: nul(S), projects: arr(obj('ContractProject', { id: S, name: S })),
  artifactKinds: arr(S), artifactSubkinds: arr(S), logKinds: arr(S), logActors: arr(S), logLevels: arr(S) });
const CoverageEvidence = obj('CoverageEvidence', { jobId: S, op: nul(S), attempt: nul(I), path: S, kind: S, sha256: S, codeSha: nul(S), state: en(V.evidenceStates), changed: opt(arr(S)) });
const Coverage = obj('Coverage', { ok: B, schema: S, workflowId: S, graphVersion: nul(I),
  summary: obj('CoverageSummary', { proven: I, stale: I, missing: I, total: I, mustOwed: I }),
  mustOwed: arr(open('MustOwed', { kind: S, id: S, status: S })),
  items: arr(obj('CoverageItem', { kind: en(V.coverageItemKinds), id: S, must: opt(B), requires: opt(arr(S)), record: opt(nul(S)), records: opt(arr(S)), status: en(V.coverageStatuses), evidence: arr(CoverageEvidence) })),
  errors: opt(arr(open('CoverageError', { record: S, error: S }))) });
const VerifyProofs = obj('VerifyProofs', { ok: B, schema: S, workflowId: S,
  files: obj('VerifyFiles', { checked: I, intact: I, unchained: I, tampered: arr(obj('Tampered', { jobId: S, path: S, reason: en(V.tamperReasons), expected: S, actual: opt(S) })) }),
  chain: obj('VerifyChain', { events: I, ok: B, broken: arr(obj('ChainBreak', { seq: I, kind: S, reason: S })) }) });

/** Every JSON endpoint (fixture name -> shape). Stream items: workflow-event (workflow-events-stream), log-row (logs-stream). */
export const ENDPOINTS = Object.freeze({
  snapshot: Snapshot, contract: ContractInfo, agents: AgentSnapshot, 'agent-log': AgentLog, 'agent-changes': AgentChanges,
  evidence: EvidencePage, history: History, 'history-commit': CommitPatch, proofs: OpProofs, artifacts: Artifacts,
  'workflow-events': WorkflowEvents, logs: LogPage, diff: JobDiff, coverage: Coverage, 'verify-proofs': VerifyProofs,
  'supervisor-logs': SupervisorLogPage, 'supervisor-state': SupervisorState, workflow: WorkflowPageData, system: SystemView,
  'workflow-event': WorkflowEvent, 'log-row': LogRow,
});
/** Streams (SSE): fixture name -> the item endpoint each `data:` line is. */
export const STREAMS = Object.freeze({ 'workflow-events-stream': 'workflow-event', 'logs-stream': 'log-row', 'supervisor-logs-stream': 'log-row' });

// -------------------------------------------------------------------------------------------- validate
const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
/** Findings of `value` against `shape` at `at` (a JSON path): [] when it fits. */
export function validateShape(shape, value, at = '$', out = []) {
  if (out.length > 200) return out;
  if (value === null) { if (!shape.nullable && shape.t !== 'any') out.push(`${at}: null is not allowed`); return out; }
  if (value === undefined) { out.push(`${at}: missing`); return out; }
  switch (shape.t) {
    case 'any': break;
    case 'string': if (typeof value !== 'string') out.push(`${at}: expected string, got ${typeName(value)}`); break;
    case 'number': if (typeof value !== 'number' || !Number.isFinite(value)) out.push(`${at}: expected number, got ${typeName(value)}`); break;
    case 'int': if (!Number.isInteger(value)) out.push(`${at}: expected integer, got ${typeName(value)} ${typeof value === 'number' ? value : ''}`.trim()); break;
    case 'bool': if (typeof value !== 'boolean') out.push(`${at}: expected boolean, got ${typeName(value)}`); break;
    case 'enum': if (!shape.vals.includes(value)) out.push(`${at}: ${JSON.stringify(value)} is not one of ${shape.vals.join('|')}`); break;
    case 'array': if (!Array.isArray(value)) out.push(`${at}: expected array, got ${typeName(value)}`); else value.forEach((v, i) => validateShape(shape.item, v, `${at}[${i}]`, out)); break;
    case 'tuple': if (!Array.isArray(value) || value.length !== shape.items.length) out.push(`${at}: expected a ${shape.items.length}-tuple`); else value.forEach((v, i) => validateShape(shape.items[i], v, `${at}[${i}]`, out)); break;
    case 'record': if (typeName(value) !== 'object') out.push(`${at}: expected object map, got ${typeName(value)}`); else for (const [k, v] of Object.entries(value)) validateShape(shape.val, v, `${at}.${k}`, out); break;
    case 'object': {
      if (typeName(value) !== 'object') { out.push(`${at}: expected ${shape.name} object, got ${typeName(value)}`); break; }
      for (const [k, f] of Object.entries(shape.fields)) {
        if (!(k in value)) { if (!f.optional) out.push(`${at}.${k}: missing (${shape.name})`); continue; }
        validateShape(f, value[k], `${at}.${k}`, out);
      }
      if (shape.strict) for (const k of Object.keys(value)) if (!(k in shape.fields)) out.push(`${at}.${k}: not in the contract (${shape.name})`);
      break;
    }
    default: out.push(`${at}: unknown shape ${shape.t}`);
  }
  return out;
}

/** Findings of one endpoint's response body (a log row's data is also checked against its kind's typed fields). */
export function validateEndpoint(name, body) {
  const shape = ENDPOINTS[name];
  if (!shape) return [`no contract shape for endpoint ${name}`];
  const out = validateShape(shape, body);
  const rows = name === 'logs' || name === 'supervisor-logs' ? (Array.isArray(body?.rows) ? body.rows : []) : name === 'log-row' ? [body] : [];
  rows.forEach((row, i) => { if (row && LOG_KINDS[row.kind]) for (const f of validateLogData(row.kind, row.data)) out.push(`${name === 'logs' ? `$.rows[${i}]` : '$'}.data (${row.kind}): ${f}`); });
  return out;
}

/** The object shapes by interface name (every obj/open reachable from ENDPOINTS): what the spec compares with contract.ts. */
export function interfaceShapes() {
  const found = new Map();
  const visit = (s) => {
    if (!s || typeof s !== 'object') return;
    if (s.t === 'object') { if (found.has(s.name)) return; found.set(s.name, s); Object.values(s.fields).forEach(visit); }
    else if (s.t === 'array') visit(s.item);
    else if (s.t === 'record') visit(s.val);
    else if (s.t === 'tuple') s.items.forEach(visit);
  };
  Object.values(ENDPOINTS).forEach(visit);
  return found;
}
