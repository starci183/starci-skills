/** StarCi public read API. Source and projection ownership are documented in ui/CONTRACT.md. */
export const CONTRACT_VERSION = '2026-10-v3' as const;
export type SourceAvailability = 'available' | 'missing' | 'unavailable' | 'unsupported';
export type ReadSource = {
  db: string; rel: string; at?: number | null; readAt?: number | null; availability?: SourceAvailability | 'pending'; error?: string | null;
  code?: 'DB_MISSING' | 'DB_UNAVAILABLE' | 'SCHEMA_UNSUPPORTED' | 'READ_FAILED'; ledgerId?: string; name?: string;
};
export type Envelope<T> = { data: T; meta: { at: number; etag: string; sources: ReadSource[]; stale?: string[]; next?: string | null } };
export type ReadErrorMeta = { at: number; sources: ReadSource[]; stale?: string[] };
export type ReadErrorEnvelope = { error: { code: string; message: string }; meta?: ReadErrorMeta };
export const UI_STATES = ['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'] as const;
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
export type ContractInfo = {
  version: typeof CONTRACT_VERSION;
  schema: { machine: number; ledgers: Record<string, number> };
  projects: { id: string; ledgerId: string; name: string; product: string | null; availability: SourceAvailability }[];
  opLabels?: Record<string, { vi: string; en: string }>;
  vocab: ContractVocab;
  reasonCodes: string[];
};

export type UiState = 'ok'|'running'|'waiting'|'warn'|'bad'|'done'|'unknown';
export type Ref = { kind: 'workflow'|'unit'|'attempt'|'di'|'incident'|'service'|'seat'|'lane'|'land'|'gc'|'blob'|'terminal'|'violation'; project?: string; id: string; href: string };
export type BlobLink = { sha: string; bytes: number; mediaType: string; href: `/api/blob/${string}`; archived: boolean };
export type SearchIdentity = { store: 'machine' | 'ledger'; ledgerId: string | null; workflow: string | null; kind: string; id: string };
export type SearchHit = {
  kind: string; id: string; title: string; ui: UiState; project?: string | null; href: string | null;
  matched: SearchIdentity; ref: (SearchIdentity & { href: string }) | null;
};
export type SearchView = { hits: SearchHit[]; limit: number; truncated: boolean };
export type Reason = { code: string; params: Record<string, string|number>; raw?: string };
export type LedgerReadCoverage = { registered: number; readable: number; complete: boolean; unavailable: string[] };

export type WorkersView = {
  attention: { ref: Ref; ui: UiState; reason: Reason; age: number; who: 'owner'|'supervisor'|'kernel'|'controller' }[];
  workflows: WorkflowRow[];
  health: HealthSummary;
  counts: { live: number | null; bad: number | null; warn: number | null; ownerDecisions: number | null; violationsOpen: number };
  coverage: { workflows: LedgerReadCoverage; ownerDecisions: LedgerReadCoverage };
};
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
export type WorkflowDetail = WorkflowRow & {
  goal: { text: string; revision: number; at: number; approvedBy: string | null; approvalRef: string | null };
  phaseReason: string | null;
  kernelRev: { current: string; acked: string | null; stale: boolean } | null;
  blockedBy: { ref: Ref; ui: UiState; reason: Reason; since: number; who: string }[];
  counts: { decisionsOpen: number; incidentsOpen: number; violationsOpen: number; failed24h: number; attempts24h: number; costUsd24h: number | null };
};
export type GraphNode = { unit: string; workflowId: string; goalRevision: number; subjectKey: string; currentJob: string | null;
  op: string; title: string; ui: UiState; state: string; attempts: number; cut: { ordinal: number; total: number } | null; href: string };
export type GraphEdge = { from: string; to: string; kind: string; source: string; createdAt: number };
export type UnitRow = { unit: string; op: string; title: string; state: 'planned'|'queued'|'running'|'reported'|'deciding'|'done'|'failed'|'dropped'; ui: UiState;
  workflowId: string; goalRevision: number; subjectKey: string; currentJob: string | null;
  attempts: number; tries: number; tryBudget: number; current: AttemptRow | null; updatedAt: number; doneAt: number | null };

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
export type RecordedDecision = { id: string; decider: string; choice: string | null; rationale: string | null; result: unknown; at: number; association: 'attempt' | 'job' };
export type RuntimeCheckpoint = { sha: string; at: number; committed: boolean | null; scope: string[] | null; files: string[] | null };
export type WorkflowLand = {
  scope: 'workflow'; workflow: string; repo: string; branch: string | null; source: 'workflow-landed' | 'product-land';
  result: string; mergedSha: string | null; reason: string | null; output: BlobLink | null; at: number; steps: unknown[];
  pushed: boolean | null; checkpoint: RuntimeCheckpoint | null; attemptAssociation: 'head-match' | 'unproven';
};
export type AttemptAdmission = {
  observed: boolean; source: 'contract' | null; recordedAt: number | null; selection: unknown;
  receipt: AdmissionReservation | null; capturedReceipt: AdmissionReservation | null;
};
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
export type CheckRow = { id: number; name: string; phase: 'before'|'after'|'verify'|'parity'|'integrate'; runner: 'op'|'settler'|'kernel'|'parity'|'integrate';
  key: string; inputDigest: string | null; observation: 'pass' | 'fail' | 'unavailable' | 'skipped' | 'unknown';
  authority: 'runtime'|'declared'; runSeq: number; command: string | null; cwd: string | null;
  exitCode: number | null; declaredExitCode: number | null;
  status: 'pass'|'fail'|'unavailable'|'error'|'skipped'; ui: UiState; startedAt: number | null; finishedAt: number | null; wallMs: number | null;
  stdout: BlobLink | null; stderr: BlobLink | null; output: BlobLink | null; summary: unknown; attribution: unknown; note: string | null };
export type Transcript = { final: boolean; snapshotId: number | null; at: number | null; timeSource: 'blob' | 'snapshot' | null; totalLines: number; bytes: number; blob: BlobLink; redaction: string;
  lines: { n: number; text: string; hit?: boolean }[];
  hits: { n: number; preview: string }[] | null; hitCount: number | null };
export type MediaItem = { artifactId: number; project: string; wf: string; job: string; attempt: number; role: string; kind: string; subkind: string | null;
  name: string; label: string | null; scopeRef: string | null; round: number | null; blob: BlobLink; createdAt: number };

export type DecisionRow = { id: string; project: string | null; wf: string | null; kind: string; decider: 'kernel'|'supervisor'|'owner'; status: 'open'|'claimed'|'resolved'|'escalated'|'expired'|'superseded';
  key: string; store: 'machine' | 'ledger'; ledgerId: string | null; href: string;
  ui: UiState; summary: string; entity: Ref | null; openedBy: string | null; openedAt: number; dueAt: number | null; overdue: boolean;
  escalations: number; claim: { by: string; at: number; expiresAt: number } | null; resolvedAt: number | null;
  channel: 'kernel-seat'|'supervisor-seat'|'telegram'|'serve-ask'|null };
export type AskRow = { id: string; store: 'machine'; ledgerId: string | null; project: string | null; wf: string | null; di: Ref | null;
  channel: string | null; question: string | null; credential: boolean; credentialObserved: boolean; contentSuppressed: boolean;
  askedAt: number; answeredAt: number | null; state: string };
export type IncidentRow = { id: string; store: 'ledger'; ledgerId: string; project: string; wf: string; op: string | null; kind: string; owner: string;
  status: string; resolvedReason: string | null; ui: UiState; dueAt: number | null; attempts: number;
  modelCalls: number; tokens: number; elapsedMs: number; lastProgress: string | null; updatedAt: number };
export type DecisionDetail = DecisionRow & {
  evidence: (Ref | { text: string })[]; options: { key: string; verb: string; recommended: boolean }[]; allowedVerbs: string[];
  history: { kind: string; at: number; by: string | null; from?: string | null; to?: string | null }[];
  resolution: { by: string | null; verb: string | null; decision: Ref | null; result: unknown } | null; payload: unknown;
};

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
export type ActionRow = { id: string; controller: string; duty: string | null; key: string | null; verb: string | null; state: 'intent'|'running'|'done'|'failed'|'unknown'|'fenced'; ui: UiState;
  mode: 'shadow'|'active'|null; epoch: number | null; startedAt: number | null; finishedAt: number | null; exitCode: number | null; errorSignature: string | null;
  target: Ref | null; result: unknown; resultBlob: BlobLink | null; stdout: BlobLink | null; stderr: BlobLink | null;
  steps: { stepNo: number; step: string; startedAt: number; ms: number | null; ok: boolean | null }[] };

export type HealthSummary = { ui: UiState; items: { key: 'engine'|'services'|'seats'|'ram'|'sla'|'leaks'|'gc'|'land'|'providers'; ui: UiState; value: string; reason: Reason | null; href: string }[] };
export type AdmissionRole = 'kernel' | 'op' | 'supervisor' | 'worker' | 'critic';
export type AdmissionState = 'reserved' | 'launching' | 'live' | 'unknown' | 'released';
export type AdmissionQuota = {
  authority: string | null; auth: string; state: string; fresh: boolean | null; observedAt: number | null; expiresAt: number | null;
  windows: { id: string; usedPercent: number | null; resetsAt: number | null; observedAt: number | null; windowMinutes: number | null }[];
  usedPercent: number | null; detail: string | null;
};
export type QuotaSnapshot = AdmissionQuota;
export type AdmissionReservation = {
  id: string; fence: number; attemptId: string; provider: string; account: string; model: string; role: AdmissionRole; state: AdmissionState;
  slots: number; maxParallel: number; scope: unknown; handle: string | null; pid: number | null; launchIdentity: string | null; hostRequestId: string | null;
  createdAt: number; updatedAt: number; releasedAt: number | null; estimate: unknown; override: unknown; proof: unknown;
  quota: AdmissionQuota | null; quotaCodes: string[];
};
export type AdmissionView = { observed: boolean; running: number | null; unknown: number | null; reservations: AdmissionReservation[] };
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
export type LandRun = { id: number; ticket: string | null; lane: string | null; commit: string; landedSha: string | null; result: 'passed'|'failed'|'conflict'|'refused'; ui: UiState; reason: string | null;
  scope: 'runtime';
  specs: unknown; push: Ref | null; stdout: BlobLink | null; stderr: BlobLink | null; startedAt: number; finishedAt: number | null };

export type LogRow = { key: string; db: 'machine'|string; seq: number; at: number; actor: string; controller: string | null; project: string | null; wf: string | null; job: string | null;
  store: 'machine' | 'ledger'; ledgerId: string | null;
  level: 'debug'|'info'|'warn'|'error'; kind: string; msg: string; data: unknown; refs: Ref[]; traceId: string | null; spanId: string | null };
export type TimelineItem = { key: string; id: string; ledgerId: string; project: string; at: number; source: 'event'|'log'|'attempt'|'check'|'decision'|'violation'|'action'; kind: string; ui: UiState; title: string; ref: Ref | null; detail: unknown };

/* ---- v2 (2026-09-29): pipeline, transparency, evidence. Served by ui/api/pipeline.mjs and routes. ---- */
export type LegStatus = 'success'|'running'|'settling'|'queued'|'retry'|'failed'|'blocked'|'awaiting-owner'|'planned'|'deferred'|'external'|'dropped'|'rejected'|'warning'|'unknown';
export type AttemptBrief = { why?: Why | null; usageSource?: string | null; id: number; unit: string | null; job: string; try: number; dispatchSeq: number; status: LegStatus;
  reportOutcome: AttemptRow['reportOutcome']; verdict: AttemptRow['verdict']; model: string | null; agent: string | null; pool: string | null;
  dispatchedAt: number | null; reportedAt: number | null; settledAt: number | null; endedAt: number | null; settledBy: string | null;
  open: boolean; endState: string | null; checks: number; checksPass: number; checksRed: number;
  tokensIn: number | null; tokensOut: number | null; costUsd: number | null; summary: string | null; href: string };
export type LegUnit = { unit: string; goalRevision: number; subjectKey: string; currentJob: string | null; title: string; state: UnitRow['state']; tries: number; dispatches: number; tryBudget: number; updatedAt: number; doneAt: number | null; href: string };
export type LegRow = { why?: Why | null; seq: number; op: string; status: LegStatus; level: number; external: boolean; deferred: string | null; injected: string | null;
  inPlan: boolean; runtimeAggregate: boolean; binding: 'recorded-unit' | 'unbound' | 'operation-history'; goalRevision: number | null;
  needs: string[]; produces: string[]; conditions: string[]; manifest: string | null; units: LegUnit[]; attempts: AttemptBrief[]; current: boolean };
export type WorkGraphView = { version: number | null; digest?: string | null; authorJob?: string | null; colorSource?: 'runtime-live' | 'artifact';
  event: string; reason: string; authorOp: string; at: number; domains: { id: string; title?: string }[];
  nodes: { id: string; title: string; domain: string | null; kind: string | null; ownedPaths: string[] | null; color: string | null;
    slice?: string | null; parent?: string | null; rollbackTo?: string | null; reads?: string[]; frs?: string[]; shapes?: string[]; inferred?: string[];
    size?: { files?: number; assertions?: number; components?: number; records?: number } | null }[];
  edges: { from: string; to: string; kind: string | null; reason: string | null; inferred?: boolean }[] };
export type UsageField = 'input' | 'output' | 'cacheRead' | 'cacheWrite' | 'reasoning' | 'costUsd' | 'turns' | 'toolCalls' | 'toolErrors';
export type UsageCompleteness = { rows: number; fields: Record<UsageField, { known: number; total: number; complete: boolean }>; complete: boolean };
export type Usage = { recorded: boolean; byModel: { model: string; subject_type: string; input: number | null; output: number | null; cacheRead: number | null; cacheWrite: number | null;
  reasoning: number | null; costUsd: number | null; turns: number | null; toolCalls: number | null; toolErrors: number | null; n: number; completeness: UsageCompleteness }[];
  total: Record<UsageField, number | null> & { completeness: UsageCompleteness } | null };
export type MetricSnapshotProvenance = { id: number; kind: string; ledgerId: string | null; workflowId: string | null; at: number | null;
  windowMs: number | null; subject: string | null; dataSha: string | null; payloadSource: 'blob' | 'inline'; ageMs: number | null };
export type MetricRead<T = Record<string, unknown>> = { snapshot: MetricSnapshotProvenance; payload: T };
export type MetricOpRow = { op: string; agent: string | null; model: string | null; attempts: number; pass: number; fail: number; blocked: number;
  workerDead: number; settled: number; passRate: number | null; cohort: { since: number; until: number; basis: 'dispatch' };
  p50CycleMs: number | null; p90QueueMs: number | null; topFailure: { class: string; n: number }[];
  tokensIn: number | null; tokensOut: number | null; costUsd: number | null;
  usageCoverage: { rows: number; tokensIn: number; tokensOut: number; costUsd: number; complete: boolean } };
export type PipelineView = { goalRevision: number | null; chainStatus: string; legs: LegRow[]; edges: { from: string; to: string }[];
  approvedBy: string | null; approvalRef: string | null; approvalState: 'recorded' | 'unproven'; planSource: 'goals.opChain';
  scheduling: { source: string; ops: string[]; edges: { from: string; to: string }[]; readError: string | null };
  anomalies: { kind: string; from: string | null; to: string | null }[];
  progress: { scope: 'goal-revision'; available: boolean; done: number; total: number; byStatus: Partial<Record<LegStatus, number>> }; current: string[]; waiting: string[];
  failures: number; attempts: number; lastEventAt: number | null; workGraph: WorkGraphView | null; usage: Usage; kernelNotes?: KernelNote[] };
export type MiniPipeline = { goalRevision: number | null; chainStatus: string; approvedBy: string | null; approvalRef: string | null; approvalState: 'recorded' | 'unproven';
  legs: { op: string; status: LegStatus; current: boolean; tries: number; tryBudget: number | null; units: number; attempts: number;
    inPlan: boolean; runtimeAggregate: boolean; binding: LegRow['binding']; goalRevision: number | null }[];
  progress: PipelineView['progress']; current: string[]; failures: number; attempts: number; lastEventAt: number | null;
  why?: { op: string; headline: string; owner: string | null } | null };
export type WorkersSummary = { scope: 'host-registered-ledgers'; window: { from: number; to: number };
  coverage: LedgerReadCoverage;
  opsRunning: number | null; opsSettling: number | null; unitsQueued: number | null; failed24h: number | null; passed24h: number | null;
  models: { model: string | null; pool: string | null; agent: string | null; running: number; settling: number }[];
  usage24h: { recorded: boolean; inputTokens: number | null; outputTokens: number | null; cacheRead: number | null; cacheWrite: number | null;
    reasoning: number | null; costUsd: number | null; turns: number | null; toolCalls: number | null; completeness: UsageCompleteness } };
export type WorkflowWhere = { repos: { name: string; role: string; root: string }[]; workTree: string | null; ledgerFile: string | null; blobRoot: string; runtimeRoot: string;
  kernelSeat: string; terminals: { handle: string; role: string; attempt: number | null; pid: number | null; openedAt: number | null; closedAt: number | null }[];
  worktreesOpen: number; worktreesRemoved: number };
export type AttemptWhere = { repo: string | null; worktree: string | null; mainCheckout: boolean | null; scopeSource: 'contract' | 'unobserved'; currentJobStatus: string | null;
  branch: string | null; baseSha: string | null; headSha: string | null;
  integratedSha: string | null; worktreeRemovedAt: number | null; ownedPaths: { rel: string; abs: string | null }[]; ledgerFile: string | null; blobRoot: string; runtimeRoot: string;
  host: string | null; agent: string | null; provider: string | null; profile: string | null; pool: string | null; terminalHandle: string | null;
  runId: string | null; taskId: string | null; dispatchId: string | null; parentAgent: string | null; agentNode: string | null; traceSpan: string | null; job: string | null; jobStatus: string | null };
export type AttemptInput = { what: string | null; op: string | null; records: unknown[]; ownedPaths: string[]; recordsKnown: boolean; writeScopeKnown: boolean;
  source: 'contract' | 'current-job'; sourceAt: number | null; params: unknown; goal: { revision: number | null; identity: string | null } | null;
  cut: unknown; after: unknown; risk: unknown; model: string | null; profile: string | null; effort: string | null; difficulty: string | null;
  route: { chain: string[]; rejected: unknown[]; order: string | null; policy: string | null; balance: unknown; crossFamily: unknown; at: number | null } };
export type EvidenceGroup = 'evidence'|'op-run'|'check'|'diff'|'media'|'log'|'other';
export type EvidenceKind = 'json'|'yaml'|'markdown'|'text'|'diff'|'image'|'video'|'audio'|'pdf'|'binary';
export type EvidenceFile = { artifactId: number; name: string; base: string; group: EvidenceGroup; role: string; kind: EvidenceKind; subkind: string | null;
  mediaType: string; bytes: number; sha: string; href: `/api/blob/${string}`; hostPath: string | null; encoding: 'utf-8'|'utf-8-bom'|'utf-16le'|'utf-16be'|null;
  redaction: string | null; origin: string; label: string | null; scopeRef: string | null; round: number | null;
  check: { id: number | null; name: string; status: CheckRow['status'] | null; ui: UiState; binding: 'sha' | 'recorded-id' | 'unbound';
    runner: CheckRow['runner'] | null; phase: CheckRow['phase'] | null; authority: CheckRow['authority'] | null } | null; archived: boolean; createdAt: number; project: string };
export type AttemptDetailV2 = Omit<AttemptDetail, 'where'> & { where: AttemptWhere; input: AttemptInput | null; files: EvidenceFile[]; usage: Usage; tryBudget: number | null };
export type WorkflowRowV2 = WorkflowRow & { pipeline: MiniPipeline };
export type WorkflowDetailV2 = WorkflowDetail & { pipeline: MiniPipeline; where: WorkflowWhere; usage: Usage };
export type WorkersViewV2 = Omit<WorkersView, 'workflows'> & { workflows: WorkflowRowV2[]; summary: WorkersSummary };

/* ---- v3 (2026-09-29): op identity, agents, host machine. ---- */
/** From modules/ops/ops/<op>.yaml + the contract op labels (slice A fills it into LegRow.info). */
export type OpInfo = { op: string; nameVi: string | null; nameEn: string | null; goal: { en: string | null; vi: string | null };
  reference: 'current-runtime'; recordedManifest: string | null; readError: string | null; declarations?: { reads: boolean; writes: boolean; sideEffects: boolean };
  reads: { id: string; purpose: string | null }[]; writes: string[]; sideEffects: string[]; manifest: string | null };
export type LegRowV3 = LegRow & { info: OpInfo | null };
export type AgentFamily = 'claude' | 'codex' | 'devin' | 'unknown';
export type AgentRef = { family: AgentFamily; pool: string | null; model: string | null; label: string };
/** /api/host (slice C). Temperatures are null when the OS refuses the sensor read. */
export type HostSourceObservation = { source: string; observedAt: number | null; readAt: number | null; cached: boolean; refreshing: boolean;
  availability: 'available' | 'unavailable' | 'pending'; error: string | null };
export type HostView = { at: number; name: string | null; os: string; uptimeSec: number;
  sources: Record<string, HostSourceObservation>; hostSampleAt: number | null; agentsRamObservedAt: number | null;
  cpu: { model: string; cores: number | null; threads: number | null; loadPct: number | null; tempC: number | null };
  ram: { totalMb: number; freeMb: number; usedPct: number };
  gpus: { name: string; tempC: number | null; utilPct: number | null; memUsedMb: number | null; memTotalMb: number | null; powerW: number | null }[];
  disks: { mount: string; totalGb: number; freeGb: number }[];
  agentsRamMb: Record<string, number>; running: number | null; throttleMode: string | null;
  history: { at: number; cpuPct: number | null; freeRamPct: number | null; gpuTempC?: number | null }[] };

/* ---- v3.1: attempt page as a story (P1 server fields, P2–P4 UI). ---- */
export type ProductFile = { path: string; status: 'added'|'modified'|'deleted'|'unchanged'|'missing'; kind: EvidenceKind; bytes: number | null;
  hostPath: string | null; content: string | null; truncated: boolean; diff: string | null; diffTruncated: boolean; error: string | null };
export type AttemptProducts = { head: string | null; parent: string | null; repo: string | null; files: ProductFile[];
  headSource: 'runtime-checkpoint' | 'report-tested' | null; headAt: number | null; reportHead: string | null;
  scope: { listed: number; returned: number; truncated: boolean }; errorCode: string | null;
  otherChanged: { path: string; status: string }[]; claims: unknown[]; error: string | null };
export type EvidenceFileV3 = EvidenceFile & { dupOf: number | null; empty: boolean; key: boolean; schema: string | null };
export type AttemptManifest = { outcome: string | null; assertions: { id: string; outcome: string; detail?: string }[]; assets: string[]; provenance: unknown };
export type PriorAttempt = { ui?: string; why?: Why | null; id: number; try: number; verdict: AttemptRow['verdict']; reportOutcome: AttemptRow['reportOutcome']; summary: string | null;
  settleReason: unknown; nextStep: string | null; href: string };
export type CheckPair = { key: string; name: string; phase: CheckRow['phase']; runner: CheckRow['runner']; authority: CheckRow['authority']; op: CheckRow | null; runtime: CheckRow | null };
export type AttemptDetailV3 = Omit<AttemptDetailV2, 'files'> & Partial<AttemptWhyFields> & { files: EvidenceFileV3[]; manifest: AttemptManifest | null;
  manifestRead: { state: 'missing' | 'ready' | 'unavailable' | 'invalid'; artifactId: number | null; sha: string | null };
  prior: PriorAttempt | null; checkPairs: CheckPair[] };

/* ---- why (docs/why.md, starci/why@1) and the token meter. ---- */
export type WhyRef = { kind: 'check' | 'report' | 'commit' | string; name?: string; runner?: string; status?: string; reportId?: number; sha?: string };
export type Why = { headline: string; state: string; cause: string | null; disagreement: string | null; next: string | null;
  provenance?: { source: 'stored' | 'computed'; at: number | null };
  owner: string | null; codes: string[]; refs: WhyRef[]; attemptId?: number; opId?: string; tryNo?: number;
  codeInfo?: { code: string; known: boolean; title: string; meaning: string | null; next: string | null }[] };
export type KernelNote = { kind: 'decision' | 'proposal'; id: string; at: number; status: string; headline: string; observed?: string | null; evidence?: string | null; tier?: string | null; files?: string[] };
export type AttemptWhyFields = { why: Why | null; usageSource: string | null; usageReason: string | null };
