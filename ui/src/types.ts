export type Verdict = 'pass' | 'fail' | 'blocked' | 'unknown';

export type AgentProvider = 'qwen' | 'devin' | 'claude' | 'codex';

export interface AgentRow {
  id: string;
  workflowId: string | null;
  workflowName: string | null;
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
}

export interface WorkflowRow {
  id: string;
  name: string;
  projectId: string;
  goal: string;
  kernel: { state: string; at: number | null; agent: string; model: string };
  verdicts: { pass: number; fail: number; blocked: number };
  running: { jobId: string; op: string; attempt: number; since: number; status: string }[];
  queued: { jobId: string; op: string; since: number | null; reason: string; queuedBecause?: string; peer?: string; blockedBy?: { op: string; job: string } | null }[];
  incidents: { id: string; op: string; text: string; at: number }[];
  recentVerdicts: VerdictEntry[];
  done: number | null;
  total: number | null;
  legs: { op: string; state: string; since: number | null }[];
  etaAt: number | null;
  lastReport: { op: string; outcome: string; summary: string; at: number } | null;
  asks: { op: string; askClass: string; text: string; link: string | null }[];
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
