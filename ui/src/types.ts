export type Verdict = 'pass' | 'fail' | 'blocked' | 'unknown';

export type AgentProvider = 'qwen' | 'devin' | 'claude' | 'codex';

export interface AgentRow {
  id: string;
  workflowId: string | null;
  workflowName: string | null;
  /** The op job's human name (`<op label> · <what> · <workflow name>`); null for a terminal outside StarCi. */
  displayName?: string | null;
  projectId: string | null;
  projectName: string | null;
  role: 'kernel' | 'op' | 'other';
  op: string;
  attempt: number | null;
  task: string;
  action: string;
  cut: { ordinal: number; total: number } | null;
  status: string;
  provider: AgentProvider | null;
  model: string | null;
  terminal: string | null;
  since: number | null;
  activity: 'cooking' | 'idle' | 'unknown' | 'disconnected';
  connected: boolean | null;
  lastOutputAt: number | null;
}

export interface AgentLog {
  terminal: string;
  updatedAt: number;
  source: string;
  language: string;
  lines: string[];
  events: { kind: 'running' | 'command' | 'success' | 'error' | 'change'; title: string; detail: string; line: number }[];
  limited: boolean;
}

export interface AgentChanges {
  jobId: string;
  updatedAt: number;
  note: string;
  patches: { repository: 'BE' | 'FE'; kind: 'working' | 'staged' | 'untracked' | 'committed'; files: string[]; patch: string; truncated: boolean }[];
  images: { id: string; repository: 'BE' | 'FE'; name: string; path: string; modifiedAt: number; size: number }[];
}

export interface AgentSnapshot {
  updatedAt: number;
  language: string;
  agents: AgentRow[];
  groups: Record<AgentProvider, { terminals: number; cooking: number; processCount: number | null; cpuPercent: number | null; ramBytes: number | null }>;
  machine: { cpu: { name: string; cores: number; threads: number; percent: number }; memory: { totalBytes: number; usedBytes: number; percent: number }; gpu: { name: string; percent: number | null; totalBytes: number | null; usedBytes: number | null; temperatureC: number | null; powerW: number | null }[] } | null;
  sources: Record<string, string | null>;
}

export interface EvidenceItem {
  id: string; projectId: string; projectName: string; kind: 'ai-draw' | 'screenshot' | 'uat-video';
  name: string; path: string; workflowId: string | null; size: number; modifiedAt: number;
  /** `feature/surface` of a drawing under a ui record; `shape` is its `XBase#state`, `retired` a drawing no shape owns. */
  surface?: string | null; shape?: string | null; retired?: boolean;
}
export interface EvidencePage {
  updatedAt: number; total: number; counts: Record<'all' | EvidenceItem['kind'], number>; items: EvidenceItem[];
}
export interface CommitRow { sha: string; repository: 'BE' | 'FE'; at: number; subject: string }
export interface CommitPatch { sha: string; repository: 'BE' | 'FE'; files: string[]; patch: string; truncated: boolean }

export interface VerdictEntry {
  jobId: string;
  op: string;
  attempt: number | null;
  verdict: Verdict;
  checks: { observed?: number; passed?: number; failed?: number; green?: boolean } | null;
  at: number;
  displayName?: string;
}

/** The owner's four leg colors: done, running, sent back for rework, not reached. */
export type LegColor = 'green' | 'yellow' | 'red' | 'gray';
/** One parallel unit of a leg (a cut ordinal or an open job) or of a work-graph slice (a child node). */
export interface Unit {
  label: string; displayName?: string; jobId: string | null; status: string; model: string | null;
  cut?: { id: string; ordinal: number; total: number } | null; queuedBecause?: string; ceiling?: number | null; slotsHeld?: number | null;
}
export interface LegUnits { total: number; planned: boolean; units: Unit[] }
export interface LegRow { op: string; state: string; since: number | null; rework?: boolean; color?: LegColor | null; units?: LegUnits }
export interface NextAction { kind: string; op: string; jobId: string | null; incidentId: string | null; reason: string; displayName?: string }

export interface WorkflowRow {
  id: string;
  name: string;
  projectId: string;
  goal: string;
  kernel: { state: string; at: number | null; agent: string; model: string };
  verdicts: { pass: number; fail: number; blocked: number };
  running: { jobId: string; op: string; attempt: number; since: number; status: string; displayName?: string }[];
  queued: { jobId: string; op: string; since: number | null; reason: string; displayName?: string; queuedBecause?: string; ceiling?: number | null; slotsHeld?: number | null; peer?: string; blockedBy?: { op: string; job: string } | null }[];
  incidents: { id: string; op: string; text: string; at: number }[];
  recentVerdicts: VerdictEntry[];
  done: number | null;
  total: number | null;
  legs: LegRow[];
  /** Approved leg DAG as op-level [from, to] edges; null when the runtime does not expose it. */
  plan?: { edges: [string, string][]; source: string } | null;
  /** The workflow's work graph (domains, slices, nodes) at its latest version; null when it has none. */
  workGraph?: WorkGraph | null;
  /** `api status` nextActions; null when status does not carry them. */
  nextActions?: NextAction[] | null;
  etaAt: number | null;
  lastReport: { op: string; outcome: string; summary: string; at: number } | null;
  asks: { op: string; askClass: string; text: string; link: string | null }[];
  /** The owner's image review board (api status drawReviews). */
  drawReviews?: DrawReview[];
  holds: { op: string; reason: string; peer: string; jobId: string; since: number }[];
  frontier: { state: string; actionable: boolean; reason: string; queuedCauses: Record<string, number>; peerWaits: { peer: string; job: string; reason: string }[] } | null;
  workers?: { jobId: string; liveness: string; connected: boolean }[];
}

export interface ProjectRow {
  id: string;
  name: string;
  repo: string;
  error?: string;
  totals: { workflows: number; kernels: number; workers: number; pass: number; fail: number; blocked: number; incidents: number } | null;
  workflows: WorkflowRow[];
}

export interface Snapshot {
  updatedAt: number;
  sources: Record<string, string | null>;
  /** The shared op labels (modules/ops/labels.yaml). */
  opLabels?: Record<string, { vi: string; en: string }>;
  projects: ProjectRow[];
  owed: { key: string; projectId: string | null; workflowId: string; kind: string; summary: string; ageMin: number | null; status: string }[];
  owedCounts: Record<string, number>;
  inboxUnreadTotal: number;
  inbox: { id: string; at: string; from: string; text: string; read: boolean; judgedAt: string | null }[];
  supervisor: {
    activeWorkers: { agent: string; cluster: string; ageMin: number | null }[];
    land: { busy: boolean; queued: number; current: string };
    lastLands: { kind: string; id: string; at: number }[];
    pushes: { kind: string; repo: string; head: string; error: string; at: number }[];
    basePool: { name: string; provider: string; model: string; open: number; ledgers: number };
  } | null;
}

/** One node of the work graph; `slice` is its slice root, `color` its live colour. */
export interface WorkGraphNode {
  id: string; domain: string; slice: string; kind: 'foundation' | 'slice' | 'task'; title: string; parent: string | null;
  color: LegColor; frs: string[]; shapes: string[]; inferred: boolean;
  /** The op of the newest job covering the node, and those jobs newest first (work-graph-store.mjs coverageOf). */
  lastOp: string | null; jobs: { jobId: string; op: string; status: string; model: string | null }[];
}
export interface WorkGraphVersion {
  version: number; event: string; reason: string; authorOp: string; authorJob: string | null; at: number;
  added: number; removed: number; changed: number; red: string[];
}
export interface WorkGraph {
  version: number; event: string; domains: string[]; nodes: WorkGraphNode[];
  edges: { from: string; to: string; kind: 'data' | 'contract' | 'order' }[]; frontier: string[]; history: WorkGraphVersion[];
}

export interface ProofFile { id: string; kind: 'image' | 'video' | 'patch' | 'file'; name: string; path: string; size: number; modifiedAt: number; url: string; shape?: string | null }
export interface JobProofs {
  jobId: string; op: string; status: string; attempt: number; model: string | null; createdAt: number; updatedAt: number;
  cut: { id: string; ordinal: number | null; total: number | null } | null; title: string | null; verdict: string | null;
  report: { outcome: string | null; summary: string | null; rootCause: string | null; nextStep: string | null; checks: number; filedAt: number | null } | null;
  heads: { sha: string; repository: 'BE' | 'FE'; source: string }[];
  files: ProofFile[];
}
export interface OpProofs { projectId: string; workflowId: string; op: string; jobs: JobProofs[] }

/** A whitelisted ledger transition; the public API never returns raw event payloads. */
export interface WorkflowEvent {
  seq: number; kind: string; at: number; jobId: string | null; op: string | null;
  from: string; to: string; attempt: number | null; outcome: string | null; verdict: string | null;
  transition: string | null; delivery: string | null; model: string | null; version: number | null;
}

/** One typed log row (scripts/kernel/typed-logs.mjs, served by /api/logs). */
export type LogActor = 'kernel' | 'op' | 'runtime' | 'check' | 'land';
export type LogLevel = 'info' | 'warn' | 'error';
export type LogKind = 'step.start' | 'step.end' | 'cmd.run' | 'file.edit' | 'check.result' | 'test.result' | 'render' | 'decision' | 'narration' | 'ask' | 'error'
  | 'dispatch' | 'report' | 'settle' | 'land' | 'incident' | 'job.drop' | 'log.truncated';
export interface LogRow {
  seq: number; at: number; workflowId: string; jobId: string | null; actor: LogActor; nodeId: string | null;
  level: LogLevel; kind: LogKind; msg: string; data: Record<string, unknown>; refs: string[];
}
export interface LogPage { projectId: string; workflowId: string; rows: LogRow[]; cursor: number; more: boolean; synced: { derived?: number; sidecar?: number; error?: string } | null }

/** A job patch pre-structured (scripts/kernel/patch-json.mjs, served by /api/diff). */
export interface DiffLine { t: ' ' | '+' | '-'; o: number | null; n: number | null; s: string }
export interface DiffHunk { header: string; oldStart: number; newStart: number; lines: DiffLine[] }
export interface DiffBlob { blob: string; asset?: string }
export interface DiffFile {
  path: string; oldPath: string | null; status: 'A' | 'M' | 'D' | 'R'; added: number; removed: number; language: string;
  binary: boolean; image: boolean; touches: number; hunks: DiffHunk[]; truncated: boolean; before?: DiffBlob; after?: DiffBlob;
}
export interface JobDiff {
  projectId: string; jobId: string; stored: boolean; patchPath?: string; base: string | null; head: string | null; landed: string | null; unlanded: boolean; landedLater?: string | null;
  commits: { sha: string; subject: string | null }[]; totals: { files: number; added: number; removed: number }; files: DiffFile[];
  truncated: boolean; omittedFiles?: number; tooLarge?: boolean;
}

/** One ui record the owner reviews as images (api status drawReviews, scripts/work/draw-feedback.mjs). */
export interface DrawReviewNote { id: string; text: string; round?: number; class?: string; shape?: string | null; addressed?: boolean; reasons?: string[] }
export interface DrawReviewImage { path: string; shape: string | null; breakpoint: string | null; imageId: string | null }
export interface DrawReview {
  record: string; state: 'awaiting-owner' | 'redraw-owed' | 'accepted' | 'idle'; awaitingOwner: boolean;
  rounds: { round: number; dispatchId: string; state: string; decision: string | null; answeredAt: string | null; golden: boolean; notes: DrawReviewNote[] }[];
  shapes: { shape: string; round: number | null; golden: string; addressed: number; unaddressed: number; openNotes: DrawReviewNote[]; images: DrawReviewImage[] }[];
}
