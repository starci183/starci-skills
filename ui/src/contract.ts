/** StarCi public UI API v3. Kept in sync with UI-API.md §2. */
export const CONTRACT_VERSION = '2026-10-v3' as const;
export type Envelope<T> = { data: T; meta: { at: number; etag: string; sources: { db: 'machine' | string; rel: string; at?: number }[]; stale?: string[]; next?: string | null } };
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
  projects: { id: string; name: string; product: string | null }[];
  opLabels?: Record<string, { vi: string; en: string }>;
  vocab: ContractVocab;
  reasonCodes: string[];
};

export type UiState = 'ok'|'running'|'waiting'|'warn'|'bad'|'done'|'unknown';
export type Ref = { kind: 'workflow'|'unit'|'attempt'|'di'|'incident'|'service'|'seat'|'lane'|'land'|'gc'|'blob'|'terminal'|'violation'; project?: string; id: string; href: string };
export type BlobLink = { sha: string; bytes: number; mediaType: string; href: `/api/blob/${string}`; archived: boolean };
export type Reason = { code: string; params: Record<string, string|number>; raw?: string };

export type FleetView = {
  attention: { ref: Ref; ui: UiState; reason: Reason; age: number; who: 'owner'|'supervisor'|'kernel'|'controller' }[];
  workflows: WorkflowRow[];
  health: HealthSummary;
  counts: { live: number; bad: number; warn: number; ownerDecisions: number; violationsOpen: number };
};
export type WorkflowRow = {
  project: string; id: string; name: string; phase: string; ui: UiState; reason: Reason | null;
  units: { done: number; total: number; active: number; failed: number }; unitStates: Record<UnitRow['state'], number>;
  ratePerHour: number; minRatePerHour: number | null; etaAt: number | null;
  running: number; allowedParallel: number | null; lastUnitAt: number | null;
  onIt: { who: 'owner'|'supervisor'|'kernel'|'controller'; ref: Ref | null; reason: Reason } | null;
  seat: { state: string; lastSeenAt: number | null } | null; updatedAt: number;
};
export type WorkflowDetail = WorkflowRow & {
  goal: { text: string; revision: number; at: number };
  phaseReason: string | null;
  kernelRev: { current: string; acked: string | null; stale: boolean } | null;
  blockedBy: { ref: Ref; ui: UiState; reason: Reason; since: number; who: string }[];
  counts: { decisionsOpen: number; incidentsOpen: number; violationsOpen: number; failed24h: number; attempts24h: number; costUsd24h: number | null };
};
export type GraphNode = { unit: string; op: string; title: string; ui: UiState; state: string; attempts: number; cut: { ordinal: number; total: number } | null; href: string };
export type UnitRow = { unit: string; op: string; title: string; state: 'planned'|'queued'|'running'|'reported'|'deciding'|'done'|'failed'|'dropped'; ui: UiState;
  attempts: number; tries: number; tryBudget: number; current: AttemptRow | null; updatedAt: number; doneAt: number | null };

export type AttemptRow = {
  project: string; id: number; wf: string; unit: string | null; job: string; op: string; attempt: number; dispatchSeq: number;
  agent: 'devin'|'codex'|'claude'|'qwen'|null; model: string | null; pool: string | null; effort: string | null;
  dispatchedAt: number | null; reportedAt: number | null; settledAt: number | null; cycleMs: number | null;
  reportOutcome: 'done'|'partial'|'failed'|'ask'|'blocked'|null;
  verdict: 'pass'|'fail'|'partial'|'blocked'|'dropped'|'cancelled'|null; settledBy: string | null;
  failureClass: string | null; endState: string | null; ui: UiState;
  checks: number; checksRed: number; artifacts: number; tokensIn: number | null; tokensOut: number | null; costUsd: number | null;
  summary: string | null; href: string;
};
export type AttemptDetail = Omit<AttemptRow, 'checks'> & {
  timeline: { step: 'routed'|'dispatched'|'started'|'attested'|'reported'|'consumed'|'checked'|'settled'|'released'|'terminal-closed'|'worktree-removed'; at: number | null; slaMs?: number; late?: boolean }[];
  route: { by: string | null; chain: unknown; rejected: unknown };
  where: { repo: string | null; worktree: string | null; branch: string | null; baseSha: string | null; headSha: string | null; integratedSha: string | null; worktreeRemovedAt: number | null };
  land: { result: string; mergedSha: string | null; reason: string | null; output: BlobLink | null; at: number } | null;
  report: { id: number; outcome: string; json: unknown; attachments: MediaItem[] } | null;
  checks: CheckRow[]; artifacts: MediaItem[]; nonMedia: (MediaItem & { role: string })[];
  settle: { by: string | null; json: unknown; decision: Ref | null; nextStep: string | null } | null;
  lessons: { id: string; title: string; state: string; landedSha: string | null }[];
  decisions: DecisionRow[]; actions: ActionRow[];
  terminal: { handle: string; live: boolean; transcript: BlobLink | null; snapshots: number; lastSnapshotAt: number | null; href: string } | null;
  retry: { retryOf: Ref | null; resumeOf: Ref | null; class: string | null; next: Ref | null };
};
export type CheckRow = { id: number; name: string; phase: 'before'|'after'|'verify'|'parity'|'integrate'; runner: 'op'|'settler'|'kernel'|'parity'|'integrate';
  authority: 'runtime'|'declared'; runSeq: number; command: string | null; cwd: string | null;
  exitCode: number | null; declaredExitCode: number | null;
  status: 'pass'|'fail'|'unavailable'|'error'|'skipped'; ui: UiState; startedAt: number | null; finishedAt: number | null; wallMs: number | null;
  stdout: BlobLink | null; stderr: BlobLink | null; output: BlobLink | null; summary: unknown; attribution: unknown; note: string | null };
export type Transcript = { final: boolean; snapshotId: number | null; at: number; totalLines: number; bytes: number; blob: BlobLink; redaction: string;
  lines: { n: number; text: string; hit?: boolean }[];
  hits: { n: number; preview: string }[] | null; hitCount: number | null };
export type MediaItem = { artifactId: number; project: string; wf: string; job: string; attempt: number; role: string; kind: string; subkind: string | null;
  name: string; label: string | null; scopeRef: string | null; round: number | null; blob: BlobLink; createdAt: number };

export type DecisionRow = { id: string; project: string | null; wf: string | null; kind: string; decider: 'kernel'|'supervisor'|'owner'; status: 'open'|'claimed'|'resolved'|'escalated'|'expired'|'superseded';
  ui: UiState; summary: string; entity: Ref | null; openedBy: string | null; openedAt: number; dueAt: number | null; overdue: boolean;
  escalations: number; claim: { by: string; at: number; expiresAt: number } | null; resolvedAt: number | null;
  channel: 'kernel-seat'|'supervisor-seat'|'telegram'|'serve-ask'|null };

export type ReconcilerView = {
  leader: { holder: string; epoch: number; heartbeatAt: number; heartbeatAgeMs: number; expiresAt: number; rev: string | null; draining: boolean;
    passes: number | null; lastPassMs: number | null; lastError: string | null; ui: UiState } | null;
  starts24h: { at: number; reason: string; endedAt: number | null; exitReason: string | null; killedBy: string | null }[];
  crashLoop: boolean; startsLastHour: number; badExits24h: number; queueDepth: number; openViolations: number;
  controllers: { name: 'job'|'workflow'|'resource'|'host'|'gc'|'fleet'|'learning'; mode: 'off'|'shadow'|'active'; modeSetAt: number | null; modeSetBy: string | null;
    queue: { depth: number; failing: number; nextDueAt: number | null }; actions24h: { intent: number; running: number; done: number; failed: number; unknown: number; fenced: number };
    lastActionAt: number | null; lastError: { at: number; text: string } | null; ui: UiState }[];
  schedules: { controller: string; duty: string; intervalMs: number; lastStartedAt: number | null; lastResult: string | null; nextDueAt: number; runs24h: number; ui: UiState }[];
};
export type ActionRow = { id: string; controller: string; duty: string | null; key: string | null; verb: string | null; state: 'intent'|'running'|'done'|'failed'|'unknown'|'fenced'; ui: UiState;
  mode: 'shadow'|'active'|null; epoch: number | null; startedAt: number | null; finishedAt: number | null; exitCode: number | null; errorSignature: string | null;
  target: Ref | null; result: unknown; resultBlob: BlobLink | null; stdout: BlobLink | null; stderr: BlobLink | null;
  steps: { stepNo: number; step: string; startedAt: number; ms: number | null; ok: boolean | null }[] };

export type HealthSummary = { ui: UiState; items: { key: 'engine'|'services'|'seats'|'ram'|'sla'|'leaks'|'gc'|'land'|'providers'; ui: UiState; value: string; reason: Reason | null; href: string }[] };
export type ResourcesView = {
  throttle: { mode: 'normal'|'heavy'|'critical'; effectiveCap: number | null; running: number | null; freeRamPct: number | null; cpuPct: number | null; since: number | null; reason: string | null; priorities: unknown; ui: UiState; recent: { at: number; from: string | null; to: string; reason: string | null }[] };
  pools: { pool: string; untilAt: number | null; strikes: number; reason: string | null; ui: UiState }[];
  providers: { provider: string; status: string; failureKind: string | null; strikes: number; circuitOpenUntil: number | null; reason: string | null; ui: UiState }[];
  quotas: { provider: string; window: string; used: number | null; limit: number | null; resetAt: number | null; observedAt: number; ui: UiState }[];
  leases: { resource: string; capacity: number; used: number; holders: Ref[] }[];
  budgets: { scope: string; limit: number; used: number; reserved: number; window: string | null; ui: UiState }[];
  deferred: { at: number; project: string | null; wf: string | null; job: string | null; reason: string; waitedMs: number | null; releasedAt: number | null }[];
};
export type LandRun = { id: number; ticket: string | null; lane: string | null; commit: string; landedSha: string | null; result: 'passed'|'failed'|'conflict'|'refused'; ui: UiState; reason: string | null;
  specs: unknown; push: Ref | null; stdout: BlobLink | null; stderr: BlobLink | null; startedAt: number; finishedAt: number | null };

export type LogRow = { key: string; db: 'machine'|string; seq: number; at: number; actor: string; controller: string | null; project: string | null; wf: string | null; job: string | null;
  level: 'debug'|'info'|'warn'|'error'; kind: string; msg: string; data: unknown; refs: Ref[]; traceId: string | null; spanId: string | null };
export type TimelineItem = { at: number; source: 'event'|'log'|'attempt'|'check'|'decision'|'violation'|'action'; kind: string; ui: UiState; title: string; ref: Ref | null; detail: unknown };
