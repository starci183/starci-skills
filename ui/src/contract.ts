/**
 * contract.ts — the harness data contract (harness.starci.org): every response of the status API (ui/server.mjs),
 * typed. The prose is ui/CONTRACT.md; the runtime-checkable twin is ui/contract-shapes.mjs, and
 * tests/harness-contract.spec.mjs fails when an interface here and a shape there disagree on a field, or when a
 * fixture (ui/fixtures/*.json) or the fixture server's response does not fit.
 *
 * Conventions: every time is epoch milliseconds (number) unless the field says ISO; sizes are bytes; `null` means
 * "known to be absent", an optional field (`?`) means "this server version may not send it". Every string the
 * server sends has passed its secret redaction and is clipped (e.g. 300 chars for status text).
 */

export const CONTRACT_VERSION = '2026-09-28.2';

// ------------------------------------------------------------------------------------------ vocabularies

/** job_artifacts.kind: the file's type, from its name (scripts/kernel/job-artifacts.mjs kindOf). */
export type ArtifactKind = 'diff' | 'patch' | 'image' | 'video' | 'report' | 'log' | 'trace' | 'file';
/**
 * job_artifacts.subkind: what produced the file (scripts/kernel/artifact-subkind.mjs), null when no rule proves it.
 * draw-render: interface.draw token render (parts, draw-loop rounds); asset-gen: image-model output and its prompt
 * (interface.asset, image_gen); app-capture: screenshots of the running app (served render, implement, audit);
 * e2e-capture / uat-capture: screenshots of an e2e / UAT run; uat-video / e2e-video: its browser video;
 * playwright-trace: a Playwright trace.zip (open it with `npx playwright show-trace`); patch: the job's
 * format-patch; patch-json: its pre-structured diff (what /api/diff serves); diff: a .diff file; report: a report
 * envelope or report file; log: a log/text output; critique: the draw loop's independent critic verdict;
 * metrics: draw-loop machine metrics / scores; grammar-proposal: a proposed Grammar component; asset-request: an
 * asset request.
 */
export type ArtifactSubkind = 'draw-render' | 'asset-gen' | 'app-capture' | 'e2e-capture' | 'uat-capture' | 'uat-video' | 'e2e-video'
  | 'playwright-trace' | 'patch' | 'patch-json' | 'diff' | 'report' | 'log' | 'critique' | 'metrics' | 'grammar-proposal' | 'asset-request';
/** Who wrote a log row: the Kernel, the op agent itself, the runtime (derived from ledger events), a check, a land. */
export type LogActor = 'kernel' | 'op' | 'runtime' | 'check' | 'land';
export type LogLevel = 'info' | 'warn' | 'error';
/** Typed log kinds (scripts/kernel/typed-logs.mjs LOG_KINDS); LogData below gives each kind's data fields. */
export type LogKind = 'step.start' | 'step.end' | 'cmd.run' | 'file.edit' | 'check.result' | 'test.result' | 'render' | 'video' | 'trace' | 'warning'
  | 'decision' | 'narration' | 'ask' | 'error' | 'dispatch' | 'report' | 'settle' | 'land' | 'incident' | 'job.drop' | 'supervisor.action' | 'log.truncated';
/** jobs.status (engine/ledger-db.mjs JOB_STATUSES): queued..answering hold the frontier, effect_unknown is fenced. */
export type JobStatus = 'queued' | 'leased' | 'running' | 'answering' | 'effect_unknown' | 'succeeded' | 'failed' | 'cancelled';
export type Verdict = 'pass' | 'fail' | 'blocked' | 'unknown';
/** The owner's leg colours: done, running, sent back for rework, not reached. */
export type LegColor = 'green' | 'yellow' | 'red' | 'gray' | 'green-provisional' | 'deferred';
/** The ledger transitions /api/workflow-events projects (never raw payloads). */
export type WorkflowEventKind = 'job-enqueued' | 'op-dispatched' | 'report-filed' | 'kernel-transition-woken' | 'report-consumed' | 'checks-recorded' | 'op-settled' | 'job-dropped' | 'work-graph-version';
export type EvidenceKind = 'ai-draw' | 'screenshot' | 'uat-video';
export type AgentProvider = 'qwen' | 'devin' | 'claude' | 'codex';
export type Repository = 'BE' | 'FE';

// --------------------------------------------------------------------------------- GET /api/contract

/** GET /api/contract — the contract version this server speaks and the runtime's live vocabularies. */
export interface ContractInfo {
  schema: 'starci/harness-contract@1';
  /** CONTRACT_VERSION of the server's contract.ts; null when unreadable. A client pins what it was built against. */
  version: string | null;
  projects: ContractProject[];
  artifactKinds: string[]; artifactSubkinds: string[]; logKinds: string[]; logActors: string[]; logLevels: string[];
}
export interface ContractProject { id: string; name: string }

// --------------------------------------------------------------------------------- GET /api/snapshot

/** GET /api/snapshot — the whole board, cached 30 s server-side. */
export interface Snapshot {
  updatedAt: number;
  /** Per source (progress, owed, inbox, supervisor, <project id>, status:<workflow>): null = read fine, else the error text. */
  sources: Record<string, string | null>;
  /** The shared op labels (modules/ops/labels.yaml): the words the UI shows for an op id. */
  opLabels?: Record<string, OpLabel>;
  projects: ProjectRow[];
  /** OWED items (scripts/supervisor/owed.mjs), at most 50. ageMin in minutes. */
  owed: OwedItem[];
  /** OWED counts by owner (owner, peer, kernel, in-progress, supervisor, fixedBy, acked). */
  owedCounts: Record<string, number>;
  inboxUnreadTotal: number;
  /** The supervisor channel inbox, newest first, at most 30. `at` is ISO. */
  inbox: InboxMessage[];
  supervisor: SupervisorView | null;
}
export interface OpLabel { vi: string; en: string }
export interface OwedItem { key: string; projectId: string | null; workflowId: string; kind: string; summary: string; ageMin: number | null; status: string }
export interface InboxMessage { id: string; at: string; from: string; text: string; read: boolean; judgedAt: string | null }
export interface SupervisorView {
  activeWorkers: SupervisorWorker[]; land: LandQueue; lastLands: LandEvent[]; pushes: PushEvent[]; basePool: BasePool;
}
export interface SupervisorWorker { agent: string; cluster: string; ageMin: number | null }
export interface LandQueue { busy: boolean; queued: number; current: string }
export interface LandEvent { kind: string; id: string; at: number }
export interface PushEvent { kind: string; repo: string; head: string; error: string; at: number }
export interface BasePool { name: string; provider: string; model: string; open: number; ledgers: number }

export interface ProjectRow {
  id: string; name: string;
  /** The backend checkout holding the ledger (<repo>/.starciwork/runtime.sqlite). */
  repo: string;
  error?: string;
  totals: ProjectTotals | null;
  /** Running, unarchived workflows only. */
  workflows: WorkflowRow[];
  /**
   * The ledger's cross-workflow dependency graph (scripts/kernel/dependency-graph.mjs): hard waits between live
   * workflows, the Supervisor's findings (circular-wait | unowned-need | hub-blocker | duplicate-work) with the action it
   * takes (bridge | transfer | revise | designate), and its bridging records. null when the runtime cannot compute it.
   */
  dependencies?: DependencyView | null;
}
export interface DependencyView { edges: DependencyEdge[]; findings: DependencyFinding[]; bridges: BridgeRow[] }
export interface DependencyEdge { from: string; to: string; via: string }
export interface DependencyFinding { kind: string; workflows: string[]; summary: string; action: string; clearCut: boolean }
/** A Supervisor bridging record: action bridge|transfer|revise|designate; provisional under autopilot. */
export interface BridgeRow { id: string; action: string; state: string; workflowId: string | null; provisional: boolean }
export interface ProjectTotals { workflows: number; kernels: number; workers: number; pass: number; fail: number; blocked: number; incidents: number }

export interface WorkflowRow {
  id: string; name: string; projectId: string;
  /** The goal text (clipped). */
  goal: string;
  kernel: KernelSignal;
  /** op-settled verdict counts over the workflow's history. */
  verdicts: VerdictCounts;
  running: RunningJob[];
  queued: QueuedJob[];
  incidents: IncidentRow[];
  /** Newest settles first, at most 12. */
  recentVerdicts: VerdictEntry[];
  /** api status frontier; null when status could not be read. */
  frontier: Frontier | null;
  /** Approved leg DAG as op-level [from, to] edges; null when the runtime does not expose it. */
  plan?: PlanGraph | null;
  workGraph?: WorkGraph | null;
  /** progress-report counts; null when unavailable. */
  done: number | null; total: number | null;
  legs: LegRow[];
  nextActions?: NextAction[] | null;
  /** Estimated finish, epoch ms. */
  etaAt: number | null;
  lastReport: LastReport | null;
  asks: AskRow[];
  holds: HoldRow[];
  workers?: WorkerRow[];
  /** Grammar proposals interface.draw filed that nobody resolved yet (the owner decides them). */
  grammarProposals?: GrammarProposal[];
  /** The owner's image review board (api status drawReviews): per ui record its review rounds and per shape the open notes and golden status. */
  drawReviews?: DrawReview[];
  /** LOG_TYPED_MISSING warnings: op jobs that settled without their own typed log rows (WARN only). */
  logTypedMissing?: LogTypedMissing[];
}
/** `state`: live (signal valid and api status running), stale, unknown. `at` is when the signal was written, not a heartbeat. */
export interface KernelSignal { state: string; at: number | null; agent: string; model: string }
export interface VerdictCounts { pass: number; fail: number; blocked: number }
/** `displayName`: the op job's human name, `<op label> · <what> · <workflow name>` (scripts/lib/display-names.mjs). */
export interface RunningJob { jobId: string; op: string; attempt: number; since: number; status: string; displayName?: string }
export interface QueuedJob {
  jobId: string; op: string; since: number | null; reason: string; queuedBecause?: string; displayName?: string;
  /** The slot ceiling / slots held when a slot is what the job waits on. */
  ceiling?: number | null; slotsHeld?: number | null; peer?: string; blockedBy?: BlockedBy | null;
}
export interface BlockedBy { op: string; job: string }
export interface IncidentRow { id: string; op: string | null; text: string; at: number }
export interface VerdictEntry { jobId: string; op: string; attempt: number | null; verdict: string; checks: VerdictChecks | null; at: number; displayName?: string }
export interface VerdictChecks { observed?: number; passed?: number; failed?: number; green?: boolean }
export interface Frontier { state: string; actionable: boolean; reason: string; queuedCauses: Record<string, number>; peerWaits: PeerWait[] }
export interface PeerWait { peer: string; job: string; reason: string }
export interface PlanGraph { edges: [string, string][]; source: string }
export interface LegRow { op: string; state: string; since: number | null; rework?: boolean; color?: LegColor | null; units?: LegUnits }
export interface LegUnits { total: number; planned: boolean; units: Unit[] }
/** One parallel unit of a leg (a cut ordinal or an open job). */
export interface Unit {
  /** What the unit works on (the job's `what`, else the cut label); `displayName` is the job's full human name. */
  label: string; displayName?: string; jobId: string | null; status: string; model: string | null; cut?: UnitCut | null;
  queuedBecause?: string; ceiling?: number | null; slotsHeld?: number | null;
}
export interface UnitCut { id: string; ordinal: number; total: number }
export interface NextAction { kind: string; op: string; jobId: string | null; incidentId: string | null; reason: string; displayName?: string }
export interface LastReport { op: string; outcome: string; summary: string; at: number }
/** `link` is a live response form URL (response.starci.org) or null. */
export interface AskRow { op: string; askClass: string; text: string; link: string | null }
export interface HoldRow { op: string; reason: string; peer: string; jobId: string; since: number | null }
export interface WorkerRow { jobId: string; liveness: string; connected: boolean }
export interface GrammarProposal { name: string; opId: string | null; jobId: string | null; file: string | null; complete: boolean }
export interface DrawReview {
  /** The ui record (feature/surface) under review; state of its draw-review ask; awaitingOwner true while the owner has not answered. */
  record: string; state: string; awaitingOwner: boolean;
  rounds: DrawReviewRound[];
  shapes: DrawReviewShape[];
}
/** One draw-review ask round; answeredAt is ISO; golden true when the owner accepted it as the golden. */
export interface DrawReviewRound { round: number | null; dispatchId: string; state: string; decision: string | null; answeredAt: string | null; golden: boolean; notes: DrawReviewNote[] }
/** An owner note; addressed/reasons appear once a redraw was judged against it. */
export interface DrawReviewNote { id: string; text: string; round: number | null; class: string; shape: string | null; addressed?: boolean; reasons?: string[] }
/** Per XBase#state: golden status, notes addressed / not, and its images (imageId -> GET /api/evidence/<imageId>). */
export interface DrawReviewShape { shape: string; round: number | null; golden: string; addressed: number; unaddressed: number; openNotes: DrawReviewNote[]; images: DrawReviewImage[] }
export interface DrawReviewImage { path: string; shape: string | null; breakpoint: string | null; imageId: string | null }
export interface LogTypedMissing {
  jobId: string; op: string | null; attempt: number | null; code: 'LOG_TYPED_MISSING';
  /** What the op did not log itself: 'step.start', 'step.end', 'cmd.run <check name>'. */
  missing: string[];
  /** Rows the op did write (actor op). */
  opRows: number; at: number | null;
}

/** The workflow's work graph at its latest version, with live colours. */
export interface WorkGraph {
  version: number; event: string; domains: string[]; nodes: WorkGraphNode[]; edges: WorkGraphEdge[];
  /** Runnable node ids. */
  frontier: string[];
  /** Every version, newest first. */
  history: WorkGraphVersion[];
}
export interface WorkGraphNode {
  id: string; domain: string;
  /** The node's slice root id. */
  slice: string;
  /** foundation | slice | task. */
  kind: string; title: string; parent: string | null; color: LegColor; frs: string[]; shapes: string[]; inferred: boolean;
  lastOp: string | null;
  /** Covering jobs, newest first, at most 12. */
  jobs: WorkGraphNodeJob[];
}
export interface WorkGraphNodeJob { jobId: string; op: string; status: string; model: string | null }
/** kind: data | contract | order. */
export interface WorkGraphEdge { from: string; to: string; kind: string }
export interface WorkGraphVersion {
  version: number; event: string; reason: string; authorOp: string; authorJob: string | null; at: number;
  added: number; removed: number; changed: number; red: string[];
}

// ------------------------------------------------------------------------------------- GET /api/agents

/** GET /api/agents — live agent terminals (Orca) joined to the ledger, cached 10 s. */
export interface AgentSnapshot {
  updatedAt: number;
  /** config.yaml language: the language `action` text is written in. */
  language: string;
  agents: AgentRow[];
  /** Per provider (qwen, devin, claude, codex): process group totals; CPU is % of the whole machine. */
  groups: Record<string, ProviderGroup>;
  machine: MachineStats | null;
  sources: Record<string, string | null>;
}
export interface AgentRow {
  /** The job id (op-...) or kernel id. */
  id: string;
  /** workflowName: the workflow's display name; displayName: the op job's `<op label> · <what> · <workflow name>`. */
  workflowId: string | null; workflowName: string | null; displayName?: string | null; projectId: string | null; projectName: string | null;
  role: 'kernel' | 'op' | 'other'; op: string; attempt: number | null; task: string;
  /** One owner-language sentence of what it is doing. */
  action: string;
  cut: AgentCut | null; status: string; provider: AgentProvider | null; model: string | null;
  /** Orca terminal handle (term_...); GET /api/agents/<terminal>/log. */
  terminal: string | null;
  since: number | null;
  activity: 'cooking' | 'idle' | 'unknown' | 'disconnected';
  connected: boolean | null; lastOutputAt: number | null;
}
export interface AgentCut { ordinal: number; total: number }
export interface ProviderGroup { terminals: number; cooking: number; processCount: number | null; cpuPercent: number | null; ramBytes: number | null }
export interface MachineStats { cpu: CpuStats; memory: MemoryStats; gpu: GpuStats[] }
export interface CpuStats { name: string; cores: number; threads: number; percent: number }
export interface MemoryStats { totalBytes: number; usedBytes: number; percent: number }
export interface GpuStats { name: string; percent: number | null; totalBytes: number | null; usedBytes: number | null; temperatureC: number | null; powerW: number | null }

/** GET /api/agents/<terminal>/log — the terminal's current screen (at most 80 lines), not full history. */
export interface AgentLog {
  terminal: string; updatedAt: number; source: string; language: string; lines: string[];
  events: AgentLogEvent[];
  limited: boolean;
}
/** `line` indexes into lines. */
export interface AgentLogEvent { kind: 'running' | 'command' | 'success' | 'error' | 'change'; title: string; detail: string; line: number }
/** GET /api/agents/<op job>/changes — the running op's uncommitted and recent diffs and images in its owned paths. */
export interface AgentChanges { jobId: string; updatedAt: number; note: string; patches: AgentPatch[]; images: AgentImage[] }
export interface AgentPatch { repository: Repository; kind: 'working' | 'staged' | 'untracked' | 'committed'; files: string[]; patch: string; truncated: boolean }
/** GET /api/agents/<job>/images/<id> serves the bytes. */
export interface AgentImage { id: string; repository: Repository; name: string; path: string; modifiedAt: number; size: number }

// --------------------------------------------------------------------------- evidence, history, proofs

/** GET /api/evidence[?project&kind&q&offset] — the evidence gallery, 48 items per page; GET /api/evidence/<id> streams the file. */
export interface EvidencePage { updatedAt: number; total: number; counts: Record<string, number>; items: EvidenceItem[] }
export interface EvidenceItem {
  id: string; projectId: string; projectName: string; kind: EvidenceKind; name: string;
  /** Relative to <repo>/.starciwork. */
  path: string;
  workflowId: string | null; size: number; modifiedAt: number;
  /** `feature/surface` of a drawing under a ui record; `shape` its XBase#state; `retired` a drawing no shape owns. */
  surface?: string | null; shape?: string | null; retired?: boolean;
}
/** GET /api/history?project — recent code commits of the project's BE/FE repos (at most 30). */
export interface History { projectId: string | null; commits: CommitRow[] }
export interface CommitRow { sha: string; repository: Repository; at: number; subject: string }
/** GET /api/history/<project>/<BE|FE>/<sha> — one commit's code patch (redacted, at most 120 KB). */
export interface CommitPatch { sha: string; repository: Repository; files: string[]; patch: string; truncated: boolean }

/** GET /api/proofs?project&workflow&op[&jobs] — what one op's recent jobs (at most 16) produced. */
export interface OpProofs { projectId: string; workflowId: string; op: string; jobs: JobProofs[] }
export interface JobProofs {
  jobId: string; op: string; status: JobStatus; attempt: number; model: string | null; createdAt: number; updatedAt: number;
  cut: ProofCut | null; title: string | null; verdict: string | null; report: ProofReport | null;
  heads: ProofHead[];
  /** At most 160; each served by `url` (/api/proofs/<project>/<job>/<id>) with byte ranges. */
  files: ProofFile[];
}
export interface ProofCut { id: string; ordinal: number | null; total: number | null }
/** rootCause is flattened to text ("[node · category] claim fix: ..."). checks = number of checks the report lists. */
export interface ProofReport { outcome: string | null; summary: string | null; rootCause: string | null; nextStep: string | null; checks: number; filedAt: number | null }
export interface ProofHead { sha: string; repository: Repository; source: 'landed' | 'report' }
export interface ProofFile { id: string; kind: 'image' | 'video' | 'patch' | 'file'; name: string; path: string; size: number; modifiedAt: number; url: string; shape?: string | null }

/** GET /api/artifacts?project&workflow[&job][&kind][&subkind] — the indexed job_artifacts rows, grouped by job. */
export interface Artifacts { projectId: string; workflowId: string; jobs: ArtifactJob[]; total: number }
export interface ArtifactJob {
  jobId: string; opId: string | null; attempt: number | null;
  /** "<cut id>#<ordinal>/<total>" or null. */
  cut: string | null;
  status: JobStatus | null;
  byKind: Record<string, number>;
  /** Counts by subkind; a null subkind counts as "unknown". */
  bySubkind?: Record<string, number>;
  artifacts: Artifact[];
}
export interface Artifact {
  kind: ArtifactKind;
  /** null: no rule proves what produced it. Absent only from a server older than the subkind column. */
  subkind?: ArtifactSubkind | null;
  /** Repo-relative, '/'-separated. */
  path: string;
  /** Hex sha256 of the bytes when indexed (api verify-proofs re-checks it). */
  sha256: string; bytes: number; mime: string | null;
  /** XBase#state@viewport, a viewport, "draw-loop <shape> round-<n> <viewport>", or a patch state. */
  label: string | null;
  /** A file copied in from outside .starciwork: where it came from. */
  origin: string | null;
  /** patch rows: the report head, the landed sha and the diff base. */
  headSha?: string | null; landedSha?: string | null; baseSha?: string | null;
  createdAt: number;
}

// ------------------------------------------------------------------------------------ events and logs

/** GET /api/workflow-events?project&workflow[&after] (newest 80, or after a seq); /stream is SSE of WorkflowEvent. */
export interface WorkflowEvents { workflowId: string; projectId: string; events: WorkflowEvent[]; cursor: number }
export interface WorkflowEvent {
  seq: number; kind: WorkflowEventKind; at: number; jobId: string | null; op: string | null;
  /** Arrow ends for the timeline: Kernel / Runtime / Owner / <op> / Work Graph. */
  from: string; to: string;
  attempt: number | null; outcome: string | null; verdict: string | null; transition: string | null; delivery: string | null;
  model: string | null; version: number | null;
}

/** GET /api/logs?project&workflow[&job=a,b][&kinds=][&after][&limit] and /api/logs/stream (SSE of LogRow, id = seq). */
export interface LogPage {
  projectId: string; workflowId: string;
  /** Oldest first. Without `after`: the newest `limit` (default 3000, max 5000). */
  rows: LogRow[];
  /** The last seq returned: pass as `after` (or Last-Event-ID) to follow. */
  cursor: number; more: boolean;
  /** Rows the pre-read sync added; null when this read did not sync (at most every 2.5 s). */
  synced: LogSync | null;
}
/** deferred: 'legacy-logs-pending' while the retired logs.sqlite is not yet migrated into the ledger (sync waits). */
export interface LogSync { derived?: number; sidecar?: number; error?: string; deferred?: string }
export interface LogRow {
  seq: number; at: number; workflowId: string;
  /** null: a workflow-level row (a Kernel decision, an incident with no held job). */
  jobId: string | null;
  actor: LogActor;
  /** A work-graph node id the row is about. */
  nodeId: string | null;
  level: LogLevel; kind: LogKind;
  /** One short owner-language line. */
  msg: string;
  /** The kind's typed fields (LogData[kind]); extra fields may appear; at most 4 KB. */
  data: Record<string, unknown>;
  /** Repo-relative files / artifacts / `commit:<sha>` the row points at. */
  refs: string[];
}
/** The data fields per log kind (scripts/kernel/typed-logs.mjs LOG_KINDS). Times are ms. */
export interface LogData {
  'step.start': { name: string };
  'step.end': { name: string; durationMs?: number; ok?: boolean };
  /** actor op: a command the op ran; actor check: the runtime's row for a recorded check (checkName, evidenceRef). exit -1 = unknown. */
  'cmd.run': { cmd: string; exit: number; durationMs?: number; stdoutRef?: string; stderrRef?: string; cwd?: string; output?: string; checkName?: string; evidenceRef?: string; evidence?: string };
  /** diffRef: "<patch>.json#<path>" into /api/diff's document. */
  'file.edit': { path: string; added?: number; removed?: number; diffRef?: string; oldPath?: string; status?: 'A' | 'M' | 'D' | 'R'; binary?: boolean; image?: boolean };
  'check.result': { name: string; pass: boolean; evidenceRef?: string; command?: string; exit?: number; evidence?: string };
  'test.result': { suite: string; passed: number; failed: number; skipped?: number; durationMs?: number; failures?: { name: string; message?: string; file?: string }[] };
  /** An image the job produced (artifactRef = repo-relative path; find it in /api/artifacts). */
  render: { artifactRef: string; label?: string; subkind?: ArtifactSubkind; bytes?: number; mime?: string; sha256?: string };
  video: { artifactRef: string; label?: string; subkind?: ArtifactSubkind; bytes?: number; mime?: string; sha256?: string };
  trace: { artifactRef: string; label?: string; subkind?: ArtifactSubkind; bytes?: number; sha256?: string };
  /** LOG_TYPED_MISSING and other runtime warnings. */
  warning: { code: string; message: string; missing?: string[]; hint?: string };
  decision: { markdown: string };
  narration: { markdown: string };
  ask: { question: string; options?: unknown[] };
  error: { code: string; message: string; hint?: string };
  dispatch: { op: string; attempt?: number; model?: string; modelId?: string; effort?: string; dispatchId?: string };
  report: { outcome: string; op?: string; attempt?: number; reportRef?: string };
  settle: { verdict: string; status?: string; observed?: number; passed?: number; failed?: number; leasesReleased?: number };
  land: { head: string; repo?: string; headCheck?: string; paths?: string[] };
  incident: { id: string; state: 'raised' | 'resolved'; kind?: string; detail?: string; holds?: string[] };
  'job.drop': { reason: string; op?: string; attempt?: number };
  /** The Supervisor's act on an owed action (machine log only, /api/supervisor/logs). item: the owed-action key. */
  'supervisor.action': { action: string; item: string; reason?: string; class?: string; workflowId?: string; repo?: string; delivered?: boolean };
  'log.truncated': { cap: number };
}

// ------------------------------------------------------------------------------------------ supervisor

/**
 * GET /api/supervisor/logs[?kinds=a,b][&levels=warn,error][&ref=workflow:wf-x][&after][&limit] and
 * /api/supervisor/logs/stream (SSE of LogRow, id = seq): the Supervisor's machine log - every observation, decision,
 * action, message and experiment as a typed row of the supervisor ledger (scripts/supervisor/sup-log.mjs). Rows are
 * LogRow with workflowId 'wf-supervisor' and actor 'runtime'; `refs` name what a row concerns (`workflow:<id>`,
 * `job:<id>`, `repo:<path>`, `commit:<sha>`, `item:<owed-action key>`, `experiment:<id>`, `signature:<s>`,
 * `proposal:<id>`), and `ref` filters by one of them.
 */
export interface SupervisorLogPage {
  workflowId: string;
  /** Oldest first. Without `after`: the newest `limit` (default 1000, max 5000). */
  rows: LogRow[];
  cursor: number; more: boolean;
}

/** GET /api/supervisor/state — the Supervisor's seat, owed actions, messages and self-learning (scripts/supervisor/state.mjs). */
export interface SupervisorState {
  schema: 'starci/supervisor-state@1'; at: number;
  seat: SupervisorSeat;
  /** The newest tick; null before the first. */
  tick: SupervisorTick | null;
  /** Per running workflow at the newest tick: frontier state, ready ops and holds (api status queuedCauses: the sequence it waits in). */
  workflows: SupervisorWorkflow[];
  owed: SupervisorOwed;
  /** Newest first: owed-action acts (actions.mjs record) and Kernel notices (notify.mjs). */
  actions: SupervisorActionRecord[];
  messages: SupervisorMessages;
  learning: SupervisorLearning;
  /** The newest owner digest; null before the first. */
  digest: SupervisorDigest | null;
}
export interface SupervisorSeat {
  /** config.yaml supervisor.mode. */
  mode: 'chat' | 'kernel';
  enabled: boolean | null;
  terminal: string | null;
  /** Values recorded when the live seat was started or adopted. */
  agent: string | null; model: string | null;
  /** starting | live | expired; null when no seat was ever taken. */
  state: string | null;
  since: number | null; lastBoot: number | null;
}
export interface SupervisorTick { at: number; ok: boolean; alerts: number; errors: number; owed: number; clusters: number; ramThrottle: SupervisorRamThrottle | null }
/** The recorded RAM guard summary from the latest Supervisor tick; null until the guard reports. */
export interface SupervisorRamThrottle { effectiveCap: number | null; maxParallelOps: number | null; running: number; queued: number; mode: string; why: string | null; capWhy: string | null; freeRamPct: number | null; cpuBusy: number | null }
export interface SupervisorWorkflow { workflowId: string; state: string | null; ready: number; holds: Record<string, number>; error: string | null }
export interface SupervisorOwed { at: number | null; items: OwedAction[] }
/**
 * One stuck item (scripts/supervisor/actions.mjs). class: runtime-defect | fixed-defect | retry-cap | stale-gate |
 * owner-gate-no-ask | owner-ask | peer-wait | unread-peer | undispatched | dead-worker | dead-kernel | orphaned | stalled |
 * contract-stale | experiment-revert | push-refused (supervise.yaml mission.classes).
 */
export interface OwedAction {
  key: string; class: string;
  /** Comma-joined when a cluster spans workflows; null for a machine-level item (a push). */
  workflowId: string | null; subject: string | null;
  evidence: string;
  /** The class action the Supervisor takes. */
  do: string;
  ageMin: number; firstSeenAt: number;
  /** The newest act on it since it was first seen; null: none yet. */
  actedAt: number | null;
  /** No act for runtimes.yaml supervisorTick.actionSlaMs. */
  breach: boolean;
  /** Matching lessons, '[owner|self] text'. */
  lessons: string[];
}
export interface SupervisorActionRecord { at: number; item: string; action: string; reason: string | null; workflowId: string | null }
export interface SupervisorMessages { inbox: SupervisorInboxMessage[]; outbox: SupervisorReply[] }
/** A message in channel 'main' (at is ISO). from: telegram | desktop | supervisor-tick | stall-alert | land-gate | ... */
export interface SupervisorInboxMessage { id: string; at: string; from: string | null; text: string; read: boolean }
/** A reply the Supervisor sent (at is ISO); via: telegram | desktop | none. */
export interface SupervisorReply { id: string; at: string; to: string | null; via: string | null; ok: boolean; text: string }
export interface SupervisorLearning {
  hypotheses: SupervisorHypothesis[]; experiments: SupervisorExperiment[]; lessons: SupervisorLesson[];
  /** PROPOSE-TO-OWNER upgrades (supervise.yaml selfLearning.tiers.propose). */
  proposals: SupervisorProposal[];
}
/** causeClass: gate-defect | brief-gap | runtime-flow | env | contract-churn. */
export interface SupervisorHypothesis { signature: string; causeClass: string; symptom: string; source: string; at: number }
/** status: measuring | revert-due | kept | reverted | did-not-work; tier: auto | propose. */
export interface SupervisorExperiment { id: string; signature: string; status: string; tier: string; commits: string[]; lane: string | null; landedAt: number | null; reason: string | null; result: string | null }
/** source: owner | self (owner lessons weigh more); status: kept | reverted | owner-feedback | refused. */
export interface SupervisorLesson { signature: string | null; source: string; weight: number; status: string; text: string; at: number }
export interface SupervisorProposal { id: string; title: string; evidence: string; options: string; recommendation: string; status: string; at: number }
export interface SupervisorDigest { at: number; sent: boolean }

// ------------------------------------------------------------------------------------------------ diff

/** GET /api/diff?project&job — the job's patch pre-structured (scripts/kernel/patch-json.mjs); 404 when it has none. */
export interface JobDiff {
  projectId: string; jobId: string;
  /** true: read from <patch>.json; false: parsed in memory (no json written yet). */
  stored: boolean;
  patchPath?: string;
  /** 'starci/patch-json@1' and the patch file name, when stored. */
  schema?: string; patch?: string;
  base: string | null; head: string | null; landed: string | null; unlanded: boolean;
  /** The sha the job landed later, when the patch was cut before it landed. */
  landedLater?: string | null;
  commits: DiffCommit[]; totals: DiffTotals; files: DiffFile[];
  truncated?: boolean; omittedFiles?: number;
  /** tooLarge: the patch (bytes) was over 64 MB and not parsed. */
  tooLarge?: boolean; bytes?: number;
  caps?: DiffCaps;
}
export interface DiffCommit { sha: string; subject: string | null }
export interface DiffTotals { files: number; added: number; removed: number }
export interface DiffCaps { fileLines: number; totalLines: number; files: number; lineChars: number; assetBytes: number }
export interface DiffFile {
  path: string; oldPath: string | null; status: 'A' | 'M' | 'D' | 'R'; added: number; removed: number;
  /** Highlighter language id (typescript, tsx, json, yaml, markdown, css, text, ...). */
  language: string;
  binary: boolean; image: boolean;
  /** How many commits of the patch touched it. */
  touches: number;
  hunks: DiffHunk[]; truncated: boolean;
  /** Image sides: GET /api/diff/asset?project&job&blob=<blob> serves the bytes. */
  before?: DiffBlob; after?: DiffBlob;
  omitted?: boolean;
}
export interface DiffHunk { header: string; oldStart: number; newStart: number; lines: DiffLine[] }
/** t: ' ' context, '+' added, '-' removed; o / n: old / new line numbers (null on the side it is absent). */
export interface DiffLine { t: ' ' | '+' | '-'; o: number | null; n: number | null; s: string }
export interface DiffBlob { blob: string; asset?: string }

// ------------------------------------------------------------------------------------- proof verbs

/** GET /api/coverage?project&workflow — api coverage (modules/kernel/api.yaml), cached 60 s. */
export interface Coverage {
  ok: boolean; schema: string; workflowId: string; graphVersion: number | null;
  summary: CoverageSummary; mustOwed: MustOwed[]; items: CoverageItem[]; errors?: CoverageError[];
}
export interface CoverageSummary { proven: number; stale: number; missing: number; total: number; mustOwed: number }
export interface MustOwed { kind: string; id: string; status: string }
export interface CoverageItem {
  kind: 'fr' | 'shape' | 'case'; id: string; must?: boolean; requires?: string[]; record?: string | null;
  /** case items: the ui records the proof case applies to. */
  records?: string[];
  status: 'proven' | 'stale' | 'missing'; evidence: CoverageEvidence[];
}
export interface CoverageEvidence {
  jobId: string; op: string | null; attempt: number | null; path: string; kind: string; sha256: string; codeSha: string | null;
  state: 'fresh' | 'stale' | 'unbaselined'; changed?: string[];
}
export interface CoverageError { record: string; error: string }
/** GET /api/verify-proofs?project&workflow — every indexed file re-hashed and the events chain walked, cached 60 s. */
export interface VerifyProofs { ok: boolean; schema: string; workflowId: string; files: VerifyFiles; chain: VerifyChain }
export interface VerifyFiles { checked: number; intact: number; unchained: number; tampered: Tampered[] }
export interface Tampered { jobId: string; path: string; reason: 'missing' | 'modified' | 'ledger-row-differs-from-chain'; expected: string; actual?: string }
export interface VerifyChain { events: number; ok: boolean; broken: ChainBreak[] }
export interface ChainBreak { seq: number; kind: string; reason: string }
