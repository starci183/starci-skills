/** StarCi public read API. Source and projection ownership are documented in ui/CONTRACT.md. */
export const CONTRACT_VERSION = '2026-10-v3' as const;
/**
 * How readable one backing database was when the API answered, so a page can tell a missing source
 * from a failed one.
 */
export type SourceAvailability = 'available' | 'missing' | 'unavailable' | 'unsupported';
/**
 * Provenance of one database behind a response: which store was read, when, and why it could not be
 * read if it failed.
 */
export type ReadSource = {
  db: string; rel: string; at?: number | null; readAt?: number | null; availability?: SourceAvailability | 'pending'; error?: string | null;
  code?: 'DB_MISSING' | 'DB_UNAVAILABLE' | 'SCHEMA_UNSUPPORTED' | 'READ_FAILED'; ledgerId?: string; name?: string;
};
/**
 * The wrapper every successful read endpoint returns, pairing the data with its observation time,
 * etag and per-source provenance.
 */
export type Envelope<T> = { data: T; meta: { at: number; etag: string; sources: ReadSource[]; stale?: string[]; next?: string | null } };
/**
 * The provenance carried on a failed read, so the UI can still show which sources were stale or
 * unreadable.
 */
export type ReadErrorMeta = { at: number; sources: ReadSource[]; stale?: string[] };
/**
 * The body of a failed API read: a machine code and message, plus whatever source provenance was
 * gathered.
 */
export type ReadErrorEnvelope = { error: { code: string; message: string }; meta?: ReadErrorMeta };
/**
 * The closed list of display states a row may carry, used to validate server values and to order
 * them by severity.
 */
export const UI_STATES = ['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'] as const;
/**
 * The enumerations the server publishes so the UI filters and legends use the server's own words
 * instead of a hard-coded copy.
 */
export type ContractVocab = {
  uiStates: UiState[];
  unitStates: UnitRow['state'][];
  verdicts: NonNullable<AttemptRow['verdict']>[];
  reportOutcomes: NonNullable<AttemptRow['reportOutcome']>[];
  diStatuses: DecisionRow['status'][];
  diKinds: string[];
  violationCodes: string[];
  artifactRoles: string[];
  logActors: string[];
  logKinds: string[];
  levels: ('debug' | 'info' | 'warn' | 'error')[];
};
/**
 * The self-description served by the contract endpoint: version, schema levels, registered projects,
 * vocabulary and reason codes.
 */
export type ContractInfo = {
  version: typeof CONTRACT_VERSION;
  schema: { machine: number; ledgers: Record<string, number> };
  projects: { id: string; ledgerId: string; name: string; product: string | null; availability: SourceAvailability }[];
  opLabels?: Record<string, { vi: string; en: string }>;
  vocab: ContractVocab;
  reasonCodes: string[];
};

/**
 * The single display state every row is reduced to, which drives its tone, icon and sort order
 * across the interface.
 */
export type UiState = 'ok'|'running'|'waiting'|'warn'|'bad'|'done'|'unknown';
/**
 * A typed pointer to another record, with the link the UI follows to reach it and the store it lives
 * in.
 */
export type Ref = { kind: 'workflow'|'unit'|'attempt'|'di'|'incident'|'service'|'seat'|'lane'|'land'|'gc'|'blob'|'terminal'|'violation'; project?: string; id: string; href: string;
  store?: 'machine' | 'ledger'; ledgerId?: string | null };
/**
 * Handle to a stored file in the blob store, with its size, media type and whether the bytes were
 * archived away.
 */
export type BlobLink = { sha: string; bytes: number; mediaType: string; href: `/api/blob/${string}`; archived: boolean };
/**
 * The full identity of a search match across stores, enough to resolve it unambiguously to one
 * record.
 */
export type SearchIdentity = { store: 'machine' | 'ledger'; ledgerId: string | null; workflow: string | null; kind: string; id: string };
/**
 * One result of the global search: the record found, how it matched, and where to navigate to open
 * it.
 */
export type SearchHit = {
  kind: string; id: string; title: string; ui: UiState; project?: string | null; href: string | null;
  matched: SearchIdentity; ref: (SearchIdentity & { href: string }) | null;
};
/**
 * The search response: the ranked hits plus the limit applied and whether more matches were cut off.
 */
export type SearchView = { hits: SearchHit[]; limit: number; truncated: boolean };
/**
 * A machine reason code with its parameters, rendered into a sentence by the translation layer
 * rather than shipped as prose.
 */
export type Reason = { code: string; params: Record<string, string|number>; raw?: string };
/**
 * How many registered ledgers could actually be read for a view, so partial totals are never shown
 * as complete.
 */
export type LedgerReadCoverage = { registered: number; readable: number; complete: boolean; unavailable: string[] };

/**
 * The overview payload: what needs attention, every workflow, the health summary and the counts
 * shown on the home page.
 */
export type WorkersView = {
  attention: { ref: Ref; ui: UiState; reason: Reason; age: number; who: 'owner'|'supervisor'|'kernel'|'controller';
    detail?: { summary?: string | null; status?: string | null; project?: string | null; workflow?: string | null };
    scope?: { store: 'machine' | 'ledger'; ledgerId?: string | null; project?: string | null; workflow?: string | null; decider?: string | null } }[];
  workflows: WorkflowRow[];
  health: HealthSummary;
  counts: { live: number | null; bad: number | null; warn: number | null; ownerDecisions: number | null; violationsOpen: number };
  coverage: { workflows: LedgerReadCoverage; ownerDecisions: LedgerReadCoverage };
};
/**
 * One workflow as listed on the overview, with its phase, progress, rate, seat and who is currently
 * acting on it.
 */
export type WorkflowRow = {
  project: string; id: string; name: string; phase: string; ui: UiState; reason: Reason | null;
  ledgerId: string; progressSnapshot: MetricSnapshotProvenance | null; progressReadError: string | null;
  generation: number; observedGeneration: number; goalRevision: number | null;
  units: { done: number; total: number; active: number; failed: number }; unitStates: Record<UnitRow['state'], number>;
  ratePerHour: number | null; minRatePerHour: number | null; etaAt: number | null;
  running: number; allowedParallel: number | null; lastUnitAt: number | null;
  onIt: { who: 'owner'|'supervisor'|'kernel'|'controller'; ref: Ref | null; reason: Reason } | null;
  seat: { state: string; lastSeenAt: number | null } | null; updatedAt: number | null;
};
/**
 * A workflow row extended with its goal, phase reason, kernel revision, blockers and 24-hour
 * counters for the detail page.
 */
export type WorkflowDetail = WorkflowRow & {
  goal: { text: string; revision: number; at: number; approvedBy: string | null; approvalRef: string | null };
  phaseReason: string | null;
  kernelRev: { current: string; acked: string | null; stale: boolean } | null;
  blockedBy: { ref: Ref; ui: UiState; reason: Reason; since: number; who: string }[];
  counts: { decisionsOpen: number; incidentsOpen: number; violationsOpen: number; failed24h: number; attempts24h: number; costUsd24h: number | null };
};
/**
 * One unit of work as a node in the dependency graph, with its operation, state and the cut it
 * belongs to.
 */
export type GraphNode = { unit: string; workflowId: string; goalRevision: number; subjectKey: string; currentJob: string | null;
  op: string; title: string; ui: UiState; state: string; attempts: number; cut: { ordinal: number; total: number } | null; href: string };
/** A dependency between two units in the graph, with the kind of link and where it was recorded. */
export type GraphEdge = { from: string; to: string; kind: string; source: string; createdAt: number };
/**
 * One planned unit of work in a workflow, with its lifecycle state, try budget and the attempt
 * currently running it.
 */
export type UnitRow = { unit: string; op: string; title: string; state: 'planned'|'queued'|'running'|'reported'|'deciding'|'done'|'failed'|'dropped'; ui: UiState;
  workflowId: string; goalRevision: number; subjectKey: string; currentJob: string | null;
  attempts: number; tries: number; tryBudget: number; current: AttemptRow | null; updatedAt: number; doneAt: number | null };

/**
 * One execution attempt of a job as listed in tables: who ran it, what it cost, how it was checked
 * and how it settled.
 */
export type AttemptRow = {
  project: string; id: number; wf: string; unit: string | null; job: string; op: string; attempt: number; dispatchSeq: number;
  ledgerId: string | null; provider: string | null; requestedModel: string | null; attestedAt: number | null; modelAuthority: 'attested' | 'unobserved';
  startedAt: number | null; terminalEndedAt: number | null;
  agent: 'devin'|'codex'|'claude'|null; model: string | null; pool: string | null; effort: string | null;
  dispatchedAt: number | null; reportedAt: number | null; settledAt: number | null; cycleMs: number | null;
  reportOutcome: 'done'|'partial'|'failed'|'ask'|'blocked'|null;
  verdict: 'pass'|'fail'|'partial'|'blocked'|'dropped'|'cancelled'|null; settledBy: string | null;
  failureClass: string | null; endState: string | null; ui: UiState | 'awaiting-owner' | 'rejected';
  checks: number; checksPass: number; checksRed: number; artifacts: number; tokensIn: number | null; tokensOut: number | null; costUsd: number | null;
  summary: string | null; href: string;
};
/**
 * A decision stored against an attempt or job, with who made it, what they chose and the stated
 * rationale.
 */
export type RecordedDecision = { id: string; decider: string; choice: string | null; rationale: string | null; result: unknown; at: number; association: 'attempt' | 'job' };
/** The commit the runtime recorded for a piece of work, with the scope and files it covered. */
export type RuntimeCheckpoint = { sha: string; at: number; committed: boolean | null; scope: string[] | null; files: string[] | null };
/**
 * The record of a workflow's final merge into its repository, including the resulting sha and
 * whether it was pushed.
 */
export type WorkflowLand = {
  scope: 'workflow'; workflow: string; repo: string; branch: string | null; source: 'workflow-landed';
  result: string; mergedSha: string | null; reason: string | null; output: BlobLink | null; at: number; steps: unknown[];
  pushed: boolean | null; checkpoint: RuntimeCheckpoint | null; attemptAssociation: 'head-match' | 'unproven';
};
/**
 * What the resource admission layer recorded for an attempt: its selection and the reservation that
 * was granted.
 */
export type AttemptAdmission = {
  observed: boolean; source: 'contract' | null; recordedAt: number | null; selection: unknown;
  receipt: AdmissionReservation | null; capturedReceipt: AdmissionReservation | null;
};
/**
 * The full attempt page payload: timeline, routing, location, report, checks, artifacts, lessons,
 * decisions and terminal.
 */
export type AttemptDetail = Omit<AttemptRow, 'checks'> & {
  admission: AttemptAdmission;
  dispatchContext: { source: 'contract'; contractRev: string | null; runtimeSha: string | null; createdAt: number; packet: unknown; managed: unknown; hierarchy: unknown } | null;
  currentInput: AttemptInput | null;
  capturedGoal: { revision: number | null; identity: string | null; text: string | null; source: 'contract'; at: number } | null;
  relatedScope: { actions: 'job'; decisions: 'mixed'; lessons: 'global-heuristic'; logs: 'job' };
  timeline: { step: 'routed'|'dispatched'|'started'|'attested'|'reported'|'consumed'|'checked'|'settled'|'released'|'terminal-closed'|'worktree-removed'; at: number | null; slaMs?: number; late?: boolean }[];
  route: { by: string | null; chain: unknown; rejected: unknown };
  where: { repo: string | null; worktree: string | null; branch: string | null; baseSha: string | null; headSha: string | null; integratedSha: string | null; worktreeRemovedAt: number | null };
  checkpoint: RuntimeCheckpoint | null;
  land: WorkflowLand | null;
  report: { id: number; outcome: string; json: unknown; attachments: MediaItem[] } | null;
  checks: CheckRow[]; artifacts: MediaItem[]; nonMedia: (MediaItem & { role: string })[];
  settle: { by: string | null; json: unknown; decision: Ref | null; nextStep: string | null } | null;
  lessons: { id: string; title: string; state: string; landedSha: string | null }[];
  decisions: RecordedDecision[]; actions: ActionRow[];
  terminal: { handle: string; live: boolean; transcript: BlobLink | null; snapshots: number; lastSnapshotAt: number | null; href: string } | null;
  retry: { retryOf: Ref | null; resumeOf: Ref | null; redispatchOf: Ref | null; class: string | null; next: Ref | null };
};
/**
 * One verification check run for an attempt, with its runner, authority, command, exit code and
 * captured output.
 */
export type CheckRow = { id: number; name: string; phase: 'before'|'after'|'verify'|'parity'|'integrate'; runner: 'op'|'settler'|'kernel'|'parity'|'integrate';
  key: string; inputDigest: string | null; observation: 'pass' | 'fail' | 'unavailable' | 'skipped' | 'unknown';
  authority: 'runtime'|'declared'; runSeq: number; command: string | null; cwd: string | null;
  exitCode: number | null; declaredExitCode: number | null;
  status: 'pass'|'fail'|'unavailable'|'error'|'skipped'; ui: UiState; startedAt: number | null; finishedAt: number | null; wallMs: number | null;
  stdout: BlobLink | null; stderr: BlobLink | null; output: BlobLink | null; summary: unknown; attribution: unknown; note: string | null };
/** A page of a terminal transcript with its line numbers, search hits and redaction notice. */
export type Transcript = { final: boolean; snapshotId: number | null; at: number | null; timeSource: 'blob' | 'snapshot' | null; totalLines: number; bytes: number; blob: BlobLink; redaction: string;
  lines: { n: number; text: string; hit?: boolean }[];
  hits: { n: number; preview: string }[] | null; hitCount: number | null };
/** An artifact attached to an attempt, with the role it played and the blob that holds its bytes. */
export type MediaItem = { artifactId: number; project: string; wf: string; job: string; attempt: number; role: string; kind: string; subkind: string | null;
  name: string; label: string | null; scopeRef: string | null; round: number | null; blob: BlobLink; createdAt: number };

/**
 * One decision awaiting or having received an answer, with its decider, urgency, claim and the
 * entity it is about.
 */
export type DecisionRow = { id: string; project: string | null; wf: string | null; kind: string; decider: 'kernel'|'supervisor'|'owner'; status: 'open'|'claimed'|'resolved'|'escalated'|'expired'|'superseded';
  key: string; store: 'machine' | 'ledger'; ledgerId: string | null; href: string;
  ui: UiState; summary: string; entity: Ref | null; openedBy: string | null; openedAt: number; dueAt: number | null; overdue: boolean;
  escalations: number; claim: { by: string; at: number; expiresAt: number } | null; resolvedAt: number | null;
  channel: 'kernel-seat'|'supervisor-seat'|'telegram'|'serve-ask'|null };
/**
 * A question put to the owner through a channel, with whether it carried a credential and whether
 * the answer arrived.
 */
export type AskRow = { id: string; store: 'machine'; ledgerId: string | null; project: string | null; wf: string | null; di: Ref | null;
  channel: string | null; question: string | null; credential: boolean; credentialObserved: boolean; contentSuppressed: boolean;
  askedAt: number; answeredAt: number | null; state: string };
/**
 * An open or closed incident raised against a workflow, with who owns it and how much effort it has
 * consumed.
 */
export type IncidentRow = { id: string; store: 'ledger'; ledgerId: string; project: string; wf: string; op: string | null; kind: string; owner: string;
  status: string; resolvedReason: string | null; ui: UiState; dueAt: number | null; attempts: number;
  modelCalls: number; tokens: number; elapsedMs: number; lastProgress: string | null; updatedAt: number };
/**
 * A decision plus the evidence, options, history and resolution needed to answer it from the
 * decision page.
 */
export type DecisionDetail = DecisionRow & {
  evidence: (Ref | { text: string })[]; options: { key: string; verb: string; recommended: boolean }[]; allowedVerbs: string[];
  history: { kind: string; at: number; by: string | null; from?: string | null; to?: string | null }[];
  resolution: { by: string | null; verb: string | null; decision: Ref | null; result: unknown } | null; payload: unknown;
};

/**
 * The reconciler's health: leader lease, crash loop signals, each controller's mode and queue, and
 * its schedules.
 */
export type ReconcilerView = {
  leader: { holder: string; epoch: number; heartbeatAt: number; heartbeatAgeMs: number; expiresAt: number; rev: string | null; draining: boolean;
    passes: number | null; lastPassMs: number | null; lastError: string | null; ui: UiState } | null;
  starts24h: { at: number; reason: string; endedAt: number | null; exitReason: string | null; killedBy: string | null }[];
  crashLoop: boolean; startsLastHour: number; badExits24h: number; queueDepth: number; openViolations: number;
  controllers: { name: 'job'|'workflow'|'resource'|'host'|'gc'|'workers'|'learning'; mode: 'off'|'shadow'|'active'; modeSetAt: number | null; modeSetBy: string | null;
    queue: { depth: number; failing: number; nextDueAt: number | null }; actions24h: { intent: number; running: number; done: number; failed: number; unknown: number; fenced: number };
    lastActionAt: number | null; lastError: { at: number; text: string } | null; ui: UiState }[];
  schedules: { controller: string; duty: string; intervalMs: number; lastStartedAt: number | null; lastResult: string | null; nextDueAt: number; runs24h: number; ui: UiState }[];
};
/** One action a controller took or attempted, with its steps, result and captured output. */
export type ActionRow = { id: string; controller: string; duty: string | null; key: string | null; verb: string | null; state: 'intent'|'running'|'done'|'failed'|'unknown'|'fenced'; ui: UiState;
  mode: 'shadow'|'active'|null; epoch: number | null; startedAt: number | null; finishedAt: number | null; exitCode: number | null; errorSignature: string | null;
  target: Ref | null; result: unknown; resultBlob: BlobLink | null; stdout: BlobLink | null; stderr: BlobLink | null;
  steps: { stepNo: number; step: string; startedAt: number; ms: number | null; ok: boolean | null }[] };

/**
 * The roll-up of system areas (engine, services, seats, memory and so on) behind the health strip at
 * the top of each page.
 */
export type HealthSummary = { ui: UiState; items: { key: 'engine'|'services'|'seats'|'ram'|'sla'|'leaks'|'gc'|'land'|'providers'; ui: UiState; value: string; reason: Reason | null; href: string }[] };
/** The kind of agent seat a reservation is held for. */
export type AdmissionRole = 'kernel' | 'op' | 'supervisor' | 'worker' | 'critic';
/** Where a resource reservation is in its life, from reserved through live to released. */
export type AdmissionState = 'reserved' | 'launching' | 'live' | 'unknown' | 'released';
/**
 * The provider quota evidence attached to a reservation, with each usage window and how fresh it is.
 */
export type AdmissionQuota = {
  authority: string | null; auth: string; state: string; fresh: boolean | null; observedAt: number | null; expiresAt: number | null;
  windows: { id: string; usedPercent: number | null; resetsAt: number | null; observedAt: number | null; windowMinutes: number | null }[];
  usedPercent: number | null; detail: string | null;
};
/**
 * One reservation of agent capacity (provider, account, model, slots), with the quota proof and
 * fencing token.
 */
export type AdmissionReservation = {
  id: string; fence: number; attemptId: string; provider: string; account: string; model: string; role: AdmissionRole; state: AdmissionState;
  slots: number; maxParallel: number; scope: unknown; handle: string | null; pid: number | null; launchIdentity: string | null; hostRequestId: string | null;
  createdAt: number; updatedAt: number; releasedAt: number | null; estimate: unknown; override: unknown; proof: unknown;
  quota: AdmissionQuota | null; quotaCodes: string[];
};
/**
 * All current admission reservations with the running and unknown counts, or a note that none were
 * observed.
 */
export type AdmissionView = { observed: boolean; running: number | null; unknown: number | null; reservations: AdmissionReservation[] };
/**
 * The resources page payload: admission, throttle, pools, providers, quotas, leases, budgets and
 * deferred work.
 */
export type ResourcesView = {
  admission: AdmissionView;
  throttle: { mode: 'normal'|'heavy'|'critical'|'unknown'; observedAt: number | null; effectiveCap: number | null; running: number | null; freeRamPct: number | null; cpuPct: number | null; since: number | null; reason: string | null; priorities: unknown; ui: UiState; recent: { at: number; from: string | null; to: string; reason: string | null }[] };
  pools: { pool: string; observedAt: number | null; untilAt: number | null; strikes: number; reason: string | null; ui: UiState }[];
  providers: { provider: string; observedAt: number | null; status: string; failureKind: string | null; strikes: number; circuitOpenUntil: number | null; reason: string | null; ui: UiState }[];
  quotas: { provider: string; window: string; used: number | null; limit: number | null; resetAt: number | null; observedAt: number; ui: UiState }[];
  leases: { resource: string; capacity: number; used: number; holders: Ref[] }[];
  budgets: { scope: string; observedAt: number | null; limit: number; used: number; reserved: number; window: string | null; ui: UiState }[];
  deferred: { at: number; project: string | null; wf: string | null; workflow: Ref | null; job: string | null; reason: string; waitedMs: number | null; releasedAt: number | null }[];
};
/**
 * One attempt to land a commit on the main line, with its verdict, reason and the output of the
 * landing run.
 */
export type LandRun = { id: number; ticket: string | null; lane: string | null; commit: string; landedSha: string | null; result: 'passed'|'failed'|'conflict'|'refused'; ui: UiState; reason: string | null;
  scope: 'runtime';
  specs: unknown; push: Ref | null; stdout: BlobLink | null; stderr: BlobLink | null; startedAt: number; finishedAt: number | null };

/** One structured log entry with its actor, level, kind, message and the records it refers to. */
export type LogRow = { key: string; db: string; seq: number; at: number; actor: string; controller: string | null; project: string | null; wf: string | null; job: string | null;
  store: 'machine' | 'ledger'; ledgerId: string | null;
  level: 'debug'|'info'|'warn'|'error'; kind: string; msg: string; data: unknown; refs: Ref[]; traceId: string | null; spanId: string | null };
/**
 * One entry of a merged workflow timeline drawn from events, logs, attempts, checks, decisions and
 * actions.
 */
export type TimelineItem = { key: string; id: string; ledgerId: string; project: string; at: number; source: 'event'|'log'|'attempt'|'check'|'decision'|'violation'|'action'; kind: string; ui: UiState; title: string; ref: Ref | null; detail: unknown };

/* ---- v2 (2026-09-29): pipeline, transparency, evidence. Served by ui/api/pipeline.mjs and routes. ---- */
/** The status of one operation in a workflow's chain, as shown on the pipeline strip. */
export type LegStatus = 'success'|'running'|'settling'|'queued'|'retry'|'failed'|'blocked'|'awaiting-owner'|'planned'|'deferred'|'external'|'dropped'|'rejected'|'warning'|'unknown';
/**
 * A compact attempt record used inside pipeline legs, enough to draw the attempt chip and its
 * outcome.
 */
export type AttemptBrief = { why?: Why | null; usageSource?: string | null; id: number; unit: string | null; job: string; try: number; dispatchSeq: number; status: LegStatus;
  reportOutcome: AttemptRow['reportOutcome']; verdict: AttemptRow['verdict']; model: string | null; agent: string | null; pool: string | null;
  dispatchedAt: number | null; reportedAt: number | null; settledAt: number | null; endedAt: number | null; settledBy: string | null;
  open: boolean; endState: string | null; checks: number; checksPass: number; checksRed: number;
  tokensIn: number | null; tokensOut: number | null; costUsd: number | null; summary: string | null; href: string };
/** A unit of work bound to a pipeline leg, with its state and try counters. */
export type LegUnit = { unit: string; goalRevision: number; subjectKey: string; currentJob: string | null; title: string; state: UnitRow['state']; tries: number; dispatches: number; tryBudget: number; updatedAt: number; doneAt: number | null; href: string };
/**
 * One operation in a workflow's planned chain, with its status, dependencies, bound units and
 * attempts.
 */
export type LegRow = { why?: Why | null; seq: number; op: string; status: LegStatus; level: number; external: boolean; deferred: string | null; injected: string | null;
  inPlan: boolean; runtimeAggregate: boolean; binding: 'recorded-unit' | 'unbound' | 'operation-history'; goalRevision: number | null;
  needs: string[]; produces: string[]; conditions: string[]; manifest: string | null; units: LegUnit[]; attempts: AttemptBrief[]; current: boolean };
/**
 * The authored work graph of a workflow: its domains, nodes, edges and where the colours came from.
 */
export type WorkGraphView = { version: number | null; digest?: string | null; authorJob?: string | null; colorSource?: 'runtime-live' | 'artifact';
  event: string; reason: string; authorOp: string; at: number; domains: { id: string; title?: string }[];
  nodes: { id: string; title: string; domain: string | null; kind: string | null; ownedPaths: string[] | null; color: string | null;
    slice?: string | null; parent?: string | null; rollbackTo?: string | null; reads?: string[]; frs?: string[]; shapes?: string[]; inferred?: string[];
    size?: { files?: number; assertions?: number; components?: number; records?: number } | null }[];
  edges: { from: string; to: string; kind: string | null; reason: string | null; inferred?: boolean }[] };
/** The names of the token and cost counters a usage record can carry. */
export type UsageField = 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'reasoning' | 'costUsd' | 'turns' | 'toolCalls' | 'toolErrors';
/** For each usage counter, how many rows actually reported it, so totals can be flagged as partial. */
export type UsageCompleteness = { rows: number; fields: Record<UsageField, { known: number; total: number; complete: boolean }>; complete: boolean };
/** Token and cost usage grouped by model with an overall total and the completeness of each figure. */
export type Usage = { recorded: boolean; byModel: { model: string; subject_type: string; input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null;
  reasoning: number | null; costUsd: number | null; turns: number | null; toolCalls: number | null; toolErrors: number | null; n: number; completeness: UsageCompleteness }[];
  total: Record<UsageField, number | null> & { completeness: UsageCompleteness } | null };
/**
 * Where a stored metric snapshot came from, its window and its age, so a derived number can be
 * traced.
 */
export type MetricSnapshotProvenance = { id: number; kind: string; ledgerId: string | null; workflowId: string | null; at: number | null;
  windowMs: number | null; subject: string | null; dataSha: string | null; payloadSource: 'blob' | 'inline'; ageMs: number | null };
/** A metric payload paired with the snapshot it was read from. */
export type MetricRead<T = Record<string, unknown>> = { snapshot: MetricSnapshotProvenance; payload: T };
/**
 * A workflow's whole pipeline: legs, edges, progress, anomalies, work graph and usage for the
 * pipeline page.
 */
export type PipelineView = { goalRevision: number | null; chainStatus: string; legs: LegRow[]; edges: { from: string; to: string }[];
  approvedBy: string | null; approvalRef: string | null; approvalState: 'recorded' | 'unproven'; planSource: 'goals.opChain';
  scheduling: { source: string; ops: string[]; edges: { from: string; to: string }[]; readError: string | null };
  anomalies: { kind: string; from: string | null; to: string | null }[];
  progress: { scope: 'goal-revision'; available: boolean; done: number; total: number; byStatus: Partial<Record<LegStatus, number>> }; current: string[]; waiting: string[];
  failures: number; attempts: number; lastEventAt: number | null; workGraph: WorkGraphView | null; usage: Usage; kernelNotes?: KernelNote[] };
/** A trimmed pipeline carried on each workflow row to draw the small chain of legs. */
export type MiniPipeline = { goalRevision: number | null; chainStatus: string; approvedBy: string | null; approvalRef: string | null; approvalState: 'recorded' | 'unproven';
  legs: { op: string; status: LegStatus; current: boolean; tries: number; tryBudget: number | null; units: number; attempts: number;
    inPlan: boolean; runtimeAggregate: boolean; binding: LegRow['binding']; goalRevision: number | null }[];
  progress: PipelineView['progress']; current: string[]; failures: number; attempts: number; lastEventAt: number | null;
  why?: { op: string; headline: string; owner: string | null } | null };
/**
 * Host-wide worker counts and 24-hour usage across every registered ledger, with the coverage they
 * rest on.
 */
export type WorkersSummary = { scope: 'host-registered-ledgers'; window: { from: number; to: number };
  coverage: LedgerReadCoverage;
  opsRunning: number | null; opsSettling: number | null; unitsQueued: number | null; failed24h: number | null; passed24h: number | null;
  models: { model: string | null; pool: string | null; agent: string | null; running: number; settling: number }[];
  usage24h: { recorded: boolean; inputTokens: number | null; outputTokens: number | null; cacheRead: number | null; cacheWrite: number | null;
    reasoning: number | null; costUsd: number | null; turns: number | null; toolCalls: number | null; completeness: UsageCompleteness } };
/** Where a workflow lives on disk: repos, work tree, ledger file, blob root and its open terminals. */
export type WorkflowWhere = { repos: { name: string; role: string; root: string }[]; workTree: string | null; ledgerFile: string | null; blobRoot: string; runtimeRoot: string;
  kernelSeat: string; terminals: { handle: string; role: string; attempt: number | null; pid: number | null; openedAt: number | null; closedAt: number | null }[];
  worktreesOpen: number; worktreesRemoved: number };
/**
 * Where an attempt ran: repo, worktree, branch, shas, owned paths and the agent, terminal and trace
 * identifiers.
 */
export type AttemptWhere = { repo: string | null; worktree: string | null; mainCheckout: boolean | null; scopeSource: 'contract' | 'unobserved'; currentJobStatus: string | null;
  branch: string | null; baseSha: string | null; headSha: string | null;
  integratedSha: string | null; worktreeRemovedAt: number | null; ownedPaths: { rel: string; abs: string | null }[]; ledgerFile: string | null; blobRoot: string; runtimeRoot: string;
  host: string | null; agent: string | null; provider: string | null; profile: string | null; pool: string | null; terminalHandle: string | null;
  runId: string | null; taskId: string | null; dispatchId: string | null; parentAgent: string | null; agentNode: string | null; traceSpan: string | null; job: string | null; jobStatus: string | null };
/**
 * What an attempt was asked to do: the task, owned paths, route chosen and the goal it was cut from.
 */
export type AttemptInput = { what: string | null; op: string | null; records: unknown[]; ownedPaths: string[]; recordsKnown: boolean; writeScopeKnown: boolean;
  source: 'contract' | 'current-job'; sourceAt: number | null; params: unknown; goal: { revision: number | null; identity: string | null } | null;
  cut: unknown; after: unknown; risk: unknown; model: string | null; profile: string | null; effort: string | null; difficulty: string | null;
  route: { chain: string[]; rejected: unknown[]; tier: string | null; pick: unknown; at: number | null } };
/** The bucket an evidence file is filed under on the evidence tab. */
export type EvidenceGroup = 'evidence'|'op-run'|'check'|'diff'|'media'|'log'|'other';
/** The content kind of an evidence file, which decides how the viewer renders it. */
export type EvidenceKind = 'json'|'yaml'|'markdown'|'text'|'diff'|'image'|'video'|'audio'|'pdf'|'binary';
/**
 * One evidence file of an attempt, with its blob identity, kind, origin and the check it belongs to.
 */
export type EvidenceFile = { artifactId: number; name: string; base: string; group: EvidenceGroup; role: string; kind: EvidenceKind; subkind: string | null;
  mediaType: string; bytes: number; sha: string; href: `/api/blob/${string}`; hostPath: string | null; encoding: 'utf-8'|'utf-8-bom'|'utf-16le'|'utf-16be'|null;
  redaction: string | null; origin: string; label: string | null; scopeRef: string | null; round: number | null;
  check: { id: number | null; name: string; status: CheckRow['status'] | null; ui: UiState; binding: 'sha' | 'recorded-id' | 'unbound';
    runner: CheckRow['runner'] | null; phase: CheckRow['phase'] | null; authority: CheckRow['authority'] | null } | null; archived: boolean; createdAt: number; project: string };
/**
 * The attempt payload with explicit location, input, evidence files and usage added to the base
 * detail.
 */
export type AttemptDetailV2 = Omit<AttemptDetail, 'where'> & { where: AttemptWhere; input: AttemptInput | null; files: EvidenceFile[]; usage: Usage; tryBudget: number | null };
/** A workflow row that also carries its mini pipeline. */
export type WorkflowRowV2 = WorkflowRow & { pipeline: MiniPipeline };
/** A workflow detail that also carries its pipeline, location and usage. */
export type WorkflowDetailV2 = WorkflowDetail & { pipeline: MiniPipeline; where: WorkflowWhere; usage: Usage };
/** The overview payload with each workflow carrying its mini pipeline, plus the host-wide summary. */
export type WorkersViewV2 = Omit<WorkersView, 'workflows'> & { workflows: WorkflowRowV2[]; summary: WorkersSummary };

/* ---- v3 (2026-09-29): op identity, agents, host machine. ---- */
/** From modules/ops/ops/<op>.yaml + the contract op labels (slice A fills it into LegRow.info). */
export type OpInfo = { op: string; nameVi: string | null; nameEn: string | null; goal: { en: string | null; vi: string | null };
  reference: 'current-runtime'; recordedManifest: string | null; readError: string | null; declarations?: { reads: boolean; writes: boolean; sideEffects: boolean };
  reads: { id: string; purpose: string | null }[]; writes: string[]; sideEffects: string[]; manifest: string | null };
/** A pipeline leg with the identity and declarations of its operation attached. */
export type LegRowV3 = LegRow & { info: OpInfo | null };
/** Which vendor family an agent belongs to, used to pick its mark and colour. */
export type AgentFamily = 'claude' | 'codex' | 'devin' | 'unknown';
/** A reference to an agent by family, pool and model, with the label to display for it. */
export type AgentRef = { family: AgentFamily; pool: string | null; model: string | null; label: string };
/** /api/host (slice C). Temperatures are null when the OS refuses the sensor read. */
export type HostSourceObservation = { source: string; observedAt: number | null; readAt: number | null; cached: boolean; refreshing: boolean;
  availability: 'available' | 'unavailable' | 'pending'; error: string | null };
/**
 * The host machine payload: CPU, memory, GPUs, disks, agent memory and the sampled history behind
 * the gauges.
 */
export type HostView = { at: number; name: string | null; os: string; uptimeSec: number;
  sources: Record<string, HostSourceObservation>; hostSampleAt: number | null; agentsRamObservedAt: number | null;
  cpu: { model: string; cores: number | null; threads: number | null; loadPct: number | null; tempC: number | null };
  ram: { totalMb: number; freeMb: number; usedPct: number };
  gpus: { name: string; tempC: number | null; utilPct: number | null; memUsedMb: number | null; memTotalMb: number | null; powerW: number | null }[];
  disks: { mount: string; totalGb: number; freeGb: number }[];
  agentsRamMb: Record<string, number>; running: number | null; throttleMode: string | null;
  history: { at: number; cpuPct: number | null; freeRamPct: number | null; gpuTempC?: number | null }[] };

/* ---- v3.1: attempt page as a story (P1 server fields, P2–P4 UI). ---- */
/**
 * A file an attempt produced or changed, with its status, content and diff when they could be read.
 */
export type ProductFile = { path: string; status: 'added'|'modified'|'deleted'|'unchanged'|'missing'; kind: EvidenceKind; bytes: number | null;
  hostPath: string | null; content: string | null; truncated: boolean; diff: string | null; diffTruncated: boolean; error: string | null };
/**
 * The files an attempt produced against its parent, with the head they were measured at and how
 * complete the list is.
 */
export type AttemptProducts = { head: string | null; parent: string | null; repo: string | null; files: ProductFile[];
  headSource: 'runtime-checkpoint' | 'report-tested' | null; headAt: number | null; reportHead: string | null;
  scope: { listed: number; returned: number; truncated: boolean }; errorCode: string | null;
  otherChanged: { path: string; status: string }[]; claims: unknown[]; error: string | null };
/** An evidence file annotated with duplicate, emptiness and key-file flags for the story view. */
export type EvidenceFileV3 = EvidenceFile & { dupOf: number | null; empty: boolean; key: boolean; schema: string | null };
/** The manifest an attempt published about its own outcome: assertions, assets and provenance. */
export type AttemptManifest = { outcome: string | null; assertions: { id: string; outcome: string; detail?: string }[]; assets: string[]; provenance: unknown };
/** The previous try of the same job, shown so the reader can see why it was retried. */
export type PriorAttempt = { ui?: string; why?: Why | null; id: number; try: number; verdict: AttemptRow['verdict']; reportOutcome: AttemptRow['reportOutcome']; summary: string | null;
  settleReason: unknown; nextStep: string | null; href: string };
/** The operation-side and runtime-side runs of the same check, paired so disagreements are visible. */
export type CheckPair = { key: string; name: string; phase: CheckRow['phase']; runner: CheckRow['runner']; authority: CheckRow['authority']; op: CheckRow | null; runtime: CheckRow | null };
/**
 * The attempt-as-a-story payload: evidence with flags, manifest, prior try and paired checks over
 * the V2 detail.
 */
export type AttemptDetailV3 = Omit<AttemptDetailV2, 'files'> & Partial<AttemptWhyFields> & { files: EvidenceFileV3[]; manifest: AttemptManifest | null;
  manifestRead: { state: 'missing' | 'ready' | 'unavailable' | 'invalid'; artifactId: number | null; sha: string | null };
  prior: PriorAttempt | null; checkPairs: CheckPair[] };

/* ---- why (docs/why.md, starci/why@1) and the token meter. ---- */
/** A pointer from an explanation to the record that supports it. */
export type WhyRef = { kind: string; name?: string; runner?: string; status?: string; reportId?: number; sha?: string };
/**
 * The structured explanation of why something is in its current state: headline, cause,
 * disagreement, next step and owner.
 */
export type Why = { headline: string; state: string; cause: string | null; disagreement: string | null; next: string | null;
  provenance?: { source: 'stored' | 'computed'; at: number | null };
  owner: string | null; codes: string[]; refs: WhyRef[]; attemptId?: number; opId?: string; tryNo?: number;
  codeInfo?: { code: string; known: boolean; title: string; meaning: string | null; next: string | null }[] };
/**
 * A note the kernel recorded as a decision or proposal, with what it observed and the evidence it
 * cited.
 */
export type KernelNote = { kind: 'decision' | 'proposal'; id: string; at: number; status: string; headline: string; observed?: string | null; evidence?: string | null; tier?: string | null; files?: string[] };
/** The explanation and usage-source fields added to an attempt payload. */
export type AttemptWhyFields = { why: Why | null; usageSource: string | null; usageReason: string | null };
