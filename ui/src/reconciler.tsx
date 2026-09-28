// reconciler.tsx — the owner's pages after the 2026-09-28 redesign ("sửa .claude ux ui cho dễ track chứ giờ loạn
// thông tin quá"). Each page answers from ONE endpoint the server builds once per tick (ui/reconciler.mjs):
//   Tình hình  /api/home      is the work moving (per live workflow), what needs the owner, one health strip;
//   Workflow   /api/workflow  op-graph, units by job state, the Kernel's decisions, RCA, worktrees, drill-down;
//   Hệ thống   /api/system    reconciler controllers, services, SLA, GC, resources, Supervisor decisions, land gate;
//   Nhật ký    /api/logs, /api/supervisor/logs   the typed timeline, filterable.
// Progress is units that passed their gates (progress-rca.mjs), never attempt counts. Times are relative.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, CheckCircle2, ChevronRight, CircleAlert, Cpu, GitBranch, LoaderCircle, Server, ShieldAlert, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { WorkflowRow as LegacyWorkflowRow, WorkGraph } from './types';
import type { OpHealth, StuckItem } from './contract';
import type { Snapshot as ContractSnapshot } from './contract';
import { ago, clock, DecisionList, deciderName, type DecisionView } from './decisions';
import { OpHealthPanel } from './op-health';
import { LegGraph, WorkGraphView } from './workflow-graph';
import { ProofDrawer, type ProofTarget } from './proofs';
import { LogTimeline } from './log-timeline';
import { WorkflowTracker } from './workflow-tracker';
import { opName } from './workflow-tracker-model';

/* ------------------------------------------------------------ data */

export type Pill = 'ok' | 'slow' | 'stuck' | 'done' | 'unknown';
export interface ProgressBlock {
  unitsDone: number; unitsTotal: number; unitsOpen: number; unitsFailed: number; share: number | null; unitsPerHour: number; minUnitsPerHour: number; priority: boolean;
  running: number; allowedParallel: number; parallelWhy: string; queuedReady: number; etaHours: number | null; eta: string | null; lastUnitAt: string | null;
  legs: { done: number; total: number }; stall: { stalled: boolean; reasons: string[]; since: string | null; sinceMin: number; supervisorDue: boolean }; unsettled: number;
}
export interface OnIt { who: 'owner' | 'supervisor' | 'kernel' | string; next: string | null; source: string | null }
export interface HomeWorkflow {
  id: string; projectId: string; projectName: string; name: string; goal: string; kernel: string; pill: Pill; progress: ProgressBlock | null;
  topReason: { text: string; cause: string | null; source: string } | null; onIt: OnIt | null; rcaWhy: string | null; statusAt: number | null; source: string;
}
export interface OwnerItem { kind: string; workflowId: string | null; workflowName: string | null; text: string; link: string | null; source: string }
export interface Health {
  ram: { percent: number; usedBytes: number; totalBytes: number; source: string };
  services: { healthy: number; total: number; down: string[]; source: string | null };
  violations: { open: number; critical: number; source: string | null };
  gc: { leftovers: number | null; at: number; msg: string; source: string } | null;
  controllers: { engineRunning: boolean; why: string | null; modes: Record<string, number>; source: string };
  land: { busy: boolean; queued: number; source: string } | null;
  sourcesMissing: number; ok: boolean;
}
export interface HomeView { updatedAt: number; workflows: HomeWorkflow[]; owner: OwnerItem[]; health: Health }
interface Cluster { cause: string; why: string; authority: string; count: number; open: number; units: number; examples: string[] }
interface RcaAction { rank: number; key: string; tier: string; cause: string; unblocks: number; title: string; expected: string; tried: { decision: string; status: string } | null }
interface Fleet {
  progress: ProgressBlock; pill: Pill; topReason: HomeWorkflow['topReason']; onIt: OnIt;
  rca: { id: string; attempts: number; trigger: string | null; why: string | null; clusters: Cluster[]; actions: RcaAction[] };
  decisionLog: { id: string; actionKey: string | null; status: string; hypothesis: string; observed: string | null }[];
}
interface BoardUnit { key: string; op: string; jobId: string; status: string; unitState: string; attempts: number; label: string; title: string | null; displayName: string | null; verdict: string | null; outcome: string | null; summary: string | null; at: number | null }
type Phase = 'queued' | 'running' | 'reported' | 'settled' | 'released';
interface WorkflowPageData {
  updatedAt: number; projectId: string; projectName: string; snapshot: ContractSnapshot; fleet: Fleet | null;
  board: { counts: Record<Phase, number>; groups: Record<Phase, BoardUnit[]> } | null; decisions: DecisionView[];
  worktrees: { kind: 'wf' | 'op'; path: string; branch: string | null; head: string | null; jobId: string | null; jobStatus: string | null; state: string }[]; statusAt: number | null;
}
interface ControllerRow { name: string; mode: string | null; modeSource: string | null; lastPassAt: number | null; would: number; acts: number; failed: number; errors: number; lastWould: string | null; queue: { depth: number; failing: number; dueAt: number | null } }
interface ServiceRow { name: string; state: string; since: number | null; restarts: number; lastAt?: number | null; detail: string | null; down?: boolean }
interface SystemView {
  updatedAt: number;
  reconciler: {
    engine: { running: boolean; why: string | null; holder: string | null; pid: number | null; epoch: number | null; heartbeatAgeMs: number | null; rev: string | null };
    controllers: ControllerRow[]; queueDepth: number;
    services: { rows: ServiceRow[]; managed: number; healthy: number; down: string[]; seats: ServiceRow[]; ledgers: ServiceRow[]; source: string | null };
    violations: { open: number; critical: number; byCode: Record<string, number>; rows: { key: string; code: string | null; severity: string | null; entity: string; at: number }[]; clocks: number; source: string | null };
    gc: { at: number; msg: string; collected24h: number; leftovers: number | null; counts: Record<string, number> | null; source: string } | null;
  };
  ram: { percent: number; usedBytes: number; totalBytes: number };
  decisions: { supervisor: DecisionView[]; product: DecisionView[] };
  opHealth: OpHealth | null; stuck: StuckItem[];
  land: { busy: boolean; queued: number; current: string; lastLands: { kind: string; id: string; at: number }[]; pushes: { kind: string; repo: string; head: string; error: string; at: number }[] } | null;
  sources: Record<string, string | null>;
}
export interface NavView { updatedAt: number; owner: number; live: number; stuck: number }

/** Poll one endpoint every `ms`; keeps the last good body on an error. */
export function usePoll<T>(url: string | null, ms = 20_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    if (!url) return;
    setBusy(true);
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setData(await response.json() as T); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setBusy(false); }
  }, [url]);
  useEffect(() => { setData(null); void load(); if (!url) return; const id = window.setInterval(() => void load(), ms); return () => window.clearInterval(id); }, [load, ms, url]);
  return { data, error, busy, reload: load };
}
function useNow(ms = 15_000) { const [now, setNow] = useState(Date.now()); useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), ms); return () => window.clearInterval(id); }, [ms]); return now; }

/* ------------------------------------------------------------ small pieces */

const card = 'rounded-xl border border-zinc-800 bg-zinc-950/70';
const pillView: Record<Pill, { name: string; tone: string }> = {
  ok: { name: 'Đúng tiến độ', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  slow: { name: 'Chậm', tone: 'border-amber-500/30 bg-amber-500/10 text-amber-400' },
  stuck: { name: 'Kẹt', tone: 'border-red-500/30 bg-red-500/10 text-red-400' },
  done: { name: 'Xong', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' },
  unknown: { name: 'Chưa rõ', tone: 'border-zinc-700 text-zinc-400' },
};
export function StatePill({ pill }: { pill: Pill }) { const v = pillView[pill] ?? pillView.unknown; return <Badge variant="outline" className={v.tone}>{v.name}</Badge>; }
const whoName = (who: string) => deciderName[who] ?? who;
const gb = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(1)} GB`;
function Loading({ error }: { error: string | null }) {
  return error ? <p className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"><CircleAlert className="size-4" /> Không tải được: {error}</p>
    : <div className="flex h-48 items-center justify-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" /> Đang đọc trạng thái...</div>;
}
function StaleNote({ error, hasData }: { error: string | null; hasData: boolean }) {
  return error && hasData ? <p className="mb-3 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-2 text-xs text-amber-300"><CircleAlert className="size-3.5" /> Lần tải mới nhất lỗi ({error}); đang giữ bản gần nhất.</p> : null;
}
function H2({ children, note }: { children: React.ReactNode; note?: string }) { return <div className="mb-2"><h2 className="text-base font-semibold text-zinc-100">{children}</h2>{note && <p className="text-xs text-zinc-500">{note}</p>}</div>; }
/**
 * The runtime writes its stall reasons in English (progress-rca.mjs progressOf); the owner reads Vietnamese. Known
 * shapes are translated; anything else passes through. The original stays in the tooltip.
 */
export function reasonVi(text: string): string {
  let m = /^needs-kernel-decision: (\d+) reported job/.exec(text);
  if (m) return `${m[1]} báo cáo chờ Kernel quyết settle (slot của chúng vẫn bị giữ)`;
  m = /^under-dispatched: (\d+) running of (\d+) allowed with (\d+) queued-ready/.exec(text);
  if (m) return `Giao thiếu: ${m[1]}/${m[2]} đang chạy trong khi ${m[3]} đơn vị đã sẵn sàng`;
  m = /^slow: ([\d.]+) units\/h < ([\d.]+)\/h(?: \(priority workflow\))?, last unit (.+)$/.exec(text);
  if (m) return `Chậm: ${m[1]} đơn vị/giờ, dưới mức ${m[2]}/giờ; đơn vị gần nhất ${m[3] === 'never' ? 'chưa có' : m[3].replace(/m ago$/, ' phút trước')}`;
  m = /^failing: (\d+) unit\(s\) parked failed vs (\d+) done/.exec(text);
  if (m) return `${m[1]} đơn vị hỏng so với ${m[2]} đạt`;
  return text;
}
const etaLine = (p: ProgressBlock, now: number) => p.unitsTotal > 0 && p.unitsDone === p.unitsTotal ? 'Đã đủ đơn vị' : p.eta ? `Dự kiến xong ${ago(p.eta, now).replace('còn ', 'sau ')} (${clock(p.eta)})` : 'Chưa ước tính được (chưa có đơn vị nào đạt trong 6 giờ)';

/** The progress line of one workflow: bar, units, speed, ETA. Every number carries its source in a tooltip. */
function ProgressLine({ p, now }: { p: ProgressBlock; now: number }) {
  const pct = p.unitsTotal ? Math.round(100 * p.unitsDone / p.unitsTotal) : 0;
  return <div className="space-y-1.5">
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
      <span title="Đơn vị đã qua cổng kiểm tra (job succeeded), không đếm số lần thử · progress-rca.mjs progressOf" className="font-medium tabular-nums text-zinc-100">{p.unitsDone}/{p.unitsTotal} đơn vị đạt <span className="text-zinc-500">({pct}%)</span></span>
      <span title={`Đơn vị đạt trong 1 giờ qua; mức tối thiểu ${p.minUnitsPerHour}/giờ${p.priority ? ' (luồng ưu tiên)' : ''} · progress.unitsPerHour`} className="tabular-nums text-zinc-400">{p.unitsPerHour}/giờ{p.minUnitsPerHour ? <span className="text-zinc-600"> (tối thiểu {p.minUnitsPerHour})</span> : null}</span>
    </div>
    <Progress value={pct} className="h-2" aria-label={`Tiến độ ${pct}%`} />
    <div className="flex flex-wrap justify-between gap-x-3 text-xs text-zinc-500">
      <span title="progress.eta: phần còn lại chia cho tốc độ 6 giờ qua">{etaLine(p, now)}</span>
      <span title={`progress.running (kể cả job đã báo cáo chờ settle) · trần song song ${p.allowedParallel}: ${p.parallelWhy}`}>{p.running > p.allowedParallel ? `${p.running} đang chạy (trần ${p.allowedParallel})` : `${p.running}/${p.allowedParallel} đang chạy`}{p.unitsFailed ? ` · ${p.unitsFailed} đơn vị hỏng` : ''}{p.lastUnitAt ? ` · đơn vị gần nhất ${ago(p.lastUnitAt, now)}` : ''}</span>
    </div>
  </div>;
}

function OnItLine({ onIt }: { onIt: OnIt | null }) {
  if (!onIt) return null;
  return <p className="line-clamp-2 break-words text-xs text-zinc-400" title={`${onIt.next ?? ''}\n${onIt.source ?? ''}`}><span className="font-medium text-zinc-300">{whoName(onIt.who)} đang lo</span>{onIt.next ? <> · tiếp theo: <span className="text-zinc-300">{reasonVi(onIt.next)}</span></> : ' · không có việc chờ quyết'}</p>;
}

/** One live workflow as a row: name, pill, progress, top reason when slow/stuck, who is on it. */
export function WorkflowCard({ wf, now }: { wf: HomeWorkflow; now: number }) {
  const href = `#/workflows/${encodeURIComponent(wf.id)}`;
  return <article className={`${card} p-4 transition-colors hover:border-zinc-600`} data-testid="home-workflow">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0"><a href={href} className="text-base font-semibold text-zinc-50 hover:underline">{wf.name || wf.id}</a><p className="text-[11px] text-zinc-500">{wf.projectName}{wf.kernel !== 'live' ? ' · tín hiệu Kernel cũ' : ''}</p></div>
      <div className="flex items-center gap-2"><StatePill pill={wf.pill} /><a href={href} aria-label={`Xem ${wf.name}`} className="rounded-md p-1 text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"><ChevronRight className="size-4" /></a></div>
    </div>
    {wf.progress ? <ProgressLine p={wf.progress} now={now} /> : <p className="text-sm text-zinc-500">Chưa đọc được tiến độ.</p>}
    {wf.topReason && <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-xs text-amber-200" title={`${wf.topReason.text}\n${wf.topReason.source}`}><AlertTriangle className="mt-0.5 size-3.5 shrink-0" /><span className="break-words">Vì sao: {reasonVi(wf.topReason.text)}</span></p>}
    <div className="mt-3"><OnItLine onIt={wf.onIt} /></div>
  </article>;
}

const ownerKind: Record<string, string> = { ask: 'Câu hỏi', 'draw-review': 'Duyệt hình', 'plan-revision': 'Kế hoạch', decision: 'Quyết định', credentials: 'Credential' };
/** "Cần thầy": shown only when there is something. */
export function OwnerCard({ items }: { items: OwnerItem[] }) {
  if (!items.length) return null;
  return <section className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-4" aria-labelledby="owner-card">
    <div className="mb-2 flex items-center justify-between gap-2"><h2 id="owner-card" className="flex items-center gap-2 text-base font-semibold"><Bell className="size-4 text-amber-400" /> Cần thầy · {items.length}</h2><a href="#/owner" className="inline-flex items-center gap-1 text-xs text-amber-300 hover:underline">Mở tất cả <ArrowRight className="size-3" /></a></div>
    <ul className="space-y-2">{items.slice(0, 5).map((item, index) => <li key={index} className="flex flex-wrap items-start gap-2 text-sm" title={item.source}>
      <Badge variant="outline" className="border-amber-500/30 text-amber-300">{ownerKind[item.kind] ?? item.kind}</Badge>
      <span className="min-w-0 flex-1 break-words text-zinc-200">{item.text}{item.workflowName ? <span className="text-zinc-500"> · {item.workflowName}</span> : null}</span>
      {item.link && <a className="text-xs text-sky-400 hover:underline" href={item.link} target="_blank" rel="noreferrer">Trả lời</a>}
    </li>)}</ul>
  </section>;
}

/** The one thin health strip: green when fine, amber/red otherwise; a click goes to Hệ thống. */
export function HealthStrip({ h }: { h: Health }) {
  const ramTone = h.ram.percent >= 90 ? 'text-red-400' : h.ram.percent >= 85 ? 'text-amber-400' : 'text-zinc-300';
  const modeText = h.controllers.engineRunning ? Object.entries(h.controllers.modes).map(([mode, n]) => `${n} ${mode}`).join(' · ') || 'chưa có mode' : 'engine chưa chạy';
  const items: { label: string; value: string; bad: boolean; title: string }[] = [
    { label: 'RAM', value: `${Math.round(h.ram.percent)}%`, bad: h.ram.percent >= 85, title: `${gb(h.ram.usedBytes)} / ${gb(h.ram.totalBytes)} · ${h.ram.source}` },
    { label: 'Dịch vụ', value: h.services.total ? `${h.services.healthy}/${h.services.total}` : '—', bad: h.services.down.length > 0, title: `${h.services.down.length ? `Đang lỗi: ${h.services.down.join(', ')} · ` : ''}${h.services.source ?? 'chưa có nguồn'}` },
    { label: 'Vi phạm SLA', value: String(h.violations.open), bad: h.violations.open > 0, title: `${h.violations.critical} nghiêm trọng · ${h.violations.source ?? 'chưa có nguồn'}` },
    { label: 'Rác GC', value: h.gc?.leftovers == null ? '—' : String(h.gc.leftovers), bad: (h.gc?.leftovers ?? 0) > 0, title: h.gc ? `${h.gc.msg} · ${ago(h.gc.at)} · ${h.gc.source}` : 'chưa có lần dọn nào' },
    { label: 'Controller', value: modeText, bad: !h.controllers.engineRunning, title: h.controllers.why ?? h.controllers.source },
    ...(h.land ? [{ label: 'Land', value: h.land.busy ? `đang chạy · ${h.land.queued} chờ` : h.land.queued ? `${h.land.queued} chờ` : 'rảnh', bad: false, title: h.land.source }] : []),
  ];
  return <a href="#/system" data-testid="health-strip" className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-xs transition-colors hover:bg-zinc-900/60 ${h.ok ? 'border-emerald-500/30 bg-emerald-500/[0.04]' : 'border-amber-500/30 bg-amber-500/[0.05]'}`}>
    <span className={`inline-flex items-center gap-1.5 font-medium ${h.ok ? 'text-emerald-400' : 'text-amber-400'}`}>{h.ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{h.ok ? 'Hệ thống ổn' : 'Hệ thống cần xem'}</span>
    {items.map((item) => <span key={item.label} title={item.title} className="whitespace-nowrap text-zinc-500">{item.label} <span className={item.bad ? 'font-medium text-amber-400' : item.label === 'RAM' ? ramTone : 'text-zinc-300'}>{item.value}</span></span>)}
    <ChevronRight className="ml-auto hidden size-3.5 text-zinc-600 sm:block" />
  </a>;
}

/* ------------------------------------------------------------ Tình hình */

export function HomePage() {
  const { data, error } = usePoll<HomeView>('/api/home', 20_000);
  const now = useNow();
  if (!data) return <Loading error={error} />;
  const stuck = data.workflows.filter((w) => w.pill === 'stuck').length;
  const slow = data.workflows.filter((w) => w.pill === 'slow').length;
  return <div className="space-y-5" data-testid="home">
    <StaleNote error={error} hasData />
    <p className="text-sm text-zinc-400">{data.workflows.length} luồng đang chạy{stuck ? ` · ${stuck} kẹt` : ''}{slow ? ` · ${slow} chậm` : ''}{data.owner.length ? ` · ${data.owner.length} việc cần thầy` : ' · không có việc cần thầy'} · cập nhật {ago(data.updatedAt, now)}</p>
    <OwnerCard items={data.owner} />
    <section className="space-y-3" aria-label="Luồng việc đang chạy">
      {data.workflows.length ? data.workflows.map((wf) => <WorkflowCard key={wf.id} wf={wf} now={now} />) : <p className={`${card} p-6 text-sm text-zinc-500`}>Không có luồng việc nào đang chạy.</p>}
    </section>
    <HealthStrip h={data.health} />
  </div>;
}

/** Workflow list: the same rows as home, nothing else. */
export function WorkflowListPage() {
  const { data, error } = usePoll<HomeView>('/api/home', 20_000);
  const now = useNow();
  if (!data) return <Loading error={error} />;
  return <div className="space-y-3"><StaleNote error={error} hasData />
    {data.workflows.length ? data.workflows.map((wf) => <WorkflowCard key={wf.id} wf={wf} now={now} />) : <p className={`${card} p-6 text-sm text-zinc-500`}>Không có luồng việc nào đang chạy.</p>}
    <p className="text-xs text-zinc-500">Chỉ luồng đang chạy. Lịch sử các lần chạy: <a className="underline" href="#/verdicts">Lịch sử verdict</a>.</p>
  </div>;
}

/* ------------------------------------------------------------ Workflow detail */

const phaseView: Record<Phase, { name: string; note: string }> = {
  queued: { name: 'Chờ giao', note: 'chưa dispatch' },
  running: { name: 'Đang chạy', note: 'đã giao, chưa nộp báo cáo' },
  reported: { name: 'Đã báo cáo', note: 'chờ settle (settler hoặc Kernel)' },
  settled: { name: 'Đã chốt', note: 'kết thúc, chưa ghi giải phóng worker' },
  released: { name: 'Đã giải phóng', note: 'kết thúc, worker/lease đã trả' },
};
const PHASES: Phase[] = ['queued', 'running', 'reported', 'settled', 'released'];
const statusName: Record<string, string> = { queued: 'chờ', leased: 'đã nhận', running: 'đang chạy', answering: 'đang hỏi', effect_unknown: 'chưa rõ', succeeded: 'đạt', failed: 'hỏng', cancelled: 'bỏ' };
const causeName: Record<string, string> = {
  'dead-worker': 'Worker chết', 'missing-paths': 'Cắt trên đường dẫn không tồn tại', 'grant-too-narrow': 'Quyền sửa quá hẹp', 'tool-timeout': 'Công cụ quá thời gian', 'test-gap': 'Thiếu test hồi quy',
  'partial-commit': 'Commit một phần', 'canon-conflict': 'Xung đột canon', 'binding-defect': 'Gắn sai repo', 'checker-unavailable': 'Checker không chạy', upstream: 'Gốc ở luồng khác', 'product-defect': 'Lỗi code sản phẩm', other: 'Chưa phân loại',
};
const tierName: Record<string, string> = { light: 'Kernel sửa nhẹ', heavy: 'Giao op làm lại', proposal: 'Đề xuất', supervisor: 'Supervisor' };

function UnitBoard({ board, open }: { board: NonNullable<WorkflowPageData['board']>; open: (u: BoardUnit) => void }) {
  const [phase, setPhase] = useState<Phase>(() => (['running', 'reported', 'queued', 'settled', 'released'] as Phase[]).find((p) => board.counts[p]) ?? 'running');
  const now = useNow();
  const rows = board.groups[phase] ?? [];
  return <div>
    <div className="mb-2 grid grid-cols-5 gap-1" role="tablist">{PHASES.map((p) => <button key={p} type="button" role="tab" aria-selected={phase === p} onClick={() => setPhase(p)} title={phaseView[p].note}
      className={`rounded-lg border px-1 py-2 text-center text-xs transition-colors ${phase === p ? 'border-zinc-500 bg-zinc-800/80 text-zinc-100' : 'border-zinc-800 text-zinc-400 hover:border-zinc-600'}`}>
      <div className="text-lg font-semibold tabular-nums">{board.counts[p] ?? 0}</div><div className="truncate">{phaseView[p].name}</div></button>)}</div>
    <p className="mb-2 text-[11px] text-zinc-500">{phaseView[phase].name}: {phaseView[phase].note}. Bấm một đơn vị để xem bằng chứng và diff.</p>
    {rows.length ? <ul className="max-h-[420px] divide-y divide-zinc-800/80 overflow-y-auto rounded-lg border border-zinc-800">{rows.map((u) => <li key={u.key}>
      <button type="button" onClick={() => open(u)} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-zinc-900/70">
        <span className="min-w-0 flex-1 truncate text-zinc-200">{u.displayName || u.label}</span>
        <span className="text-xs text-zinc-500">{statusName[u.status] ?? u.status}{u.attempts > 1 ? ` · lần ${u.attempts}` : ''}{u.outcome ? ` · ${u.outcome}` : ''}</span>
        <span className="text-[11px] text-zinc-600">{ago(u.at, now)}</span>
        {u.summary && <span className="w-full truncate text-xs text-zinc-500">{u.summary}</span>}
      </button></li>)}</ul> : <p className="rounded-lg border border-dashed border-zinc-800 p-3 text-sm text-zinc-500">Không có đơn vị nào ở trạng thái này.</p>}
  </div>;
}

function RcaPanel({ rca }: { rca: Fleet['rca'] }) {
  const open = rca.clusters.filter((c) => c.open > 0);
  const closed = rca.clusters.filter((c) => c.open === 0);
  return <div className="space-y-3">
    <p className="text-xs text-zinc-500">{rca.attempts} lần hỏng/bị chặn trong 24 giờ, gom theo nguyên nhân (progress-rca.mjs rcaOf). "Còn mở" là đơn vị chưa đạt.</p>
    {open.length ? <ul className="space-y-2">{open.map((c) => <li key={c.cause} className="rounded-lg border border-zinc-800 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2"><span className="font-medium text-zinc-100">{causeName[c.cause] ?? c.cause}</span><span className="font-mono text-[11px] text-zinc-500">{c.cause}</span><Badge variant="outline" className={c.authority === 'supervisor' ? 'border-violet-500/30 text-violet-300' : 'border-sky-500/30 text-sky-300'}>{c.authority === 'supervisor' ? 'Supervisor sửa' : 'Kernel sửa'}</Badge><span className="ml-auto tabular-nums text-xs text-zinc-400">{c.open} còn mở / {c.count}</span></div>
      <p className="mt-1 text-xs text-zinc-500">{c.why}</p>
      {c.examples.length > 0 && <details className="mt-1 text-xs text-zinc-500"><summary className="cursor-pointer text-sky-400">Ví dụ ({c.examples.length})</summary><ul className="mt-1 space-y-1">{c.examples.map((e, i) => <li key={i} className="break-words">{e}</li>)}</ul></details>}
    </li>)}</ul> : <p className="text-sm text-zinc-500">Không có cụm lỗi nào còn mở.</p>}
    {closed.length > 0 && <p className="text-xs text-zinc-500">Đã qua: {closed.map((c) => `${causeName[c.cause] ?? c.cause} ×${c.count}`).join(' · ')}</p>}
    {rca.actions.length > 0 && <div><h3 className="mb-1 text-sm font-medium">Hành động xếp hạng</h3><ol className="space-y-1.5">{rca.actions.map((a) => <li key={a.key} className="rounded-lg border border-zinc-800 p-2 text-xs">
      <div className="flex flex-wrap items-center gap-2"><span className="font-semibold tabular-nums text-zinc-300">#{a.rank}</span><Badge variant="secondary">{tierName[a.tier] ?? a.tier}</Badge><span className="text-zinc-500">{a.unblocks >= 1000 ? 'làm trước mọi việc khác' : `gỡ ${a.unblocks} đơn vị`}</span>{a.tried && <Badge variant="outline" className={a.tried.status === 'revert' ? 'border-red-500/30 text-red-400' : 'border-sky-500/30 text-sky-400'}>{a.tried.status === 'revert' ? 'đã thử, không hiệu quả' : a.tried.status === 'keep' ? 'đã thử, giữ' : 'đang đo'}</Badge>}</div>
      <p className="mt-1 break-words text-zinc-300">{a.title}</p></li>)}</ol></div>}
  </div>;
}

const decisionStatus: Record<string, string> = { open: 'đang đo', keep: 'giữ', revert: 'bỏ (không hiệu quả)' };

export function WorkflowPage({ id }: { id: string }) {
  const { data, error } = usePoll<WorkflowPageData>(`/api/workflow?id=${encodeURIComponent(id)}`, 20_000);
  const [target, setTarget] = useState<ProofTarget | null>(null);
  const now = useNow();
  const wf = data?.snapshot.projects[0]?.workflows[0] as unknown as LegacyWorkflowRow | undefined;
  const openUnit = useCallback((u: BoardUnit) => setTarget({ title: `${u.displayName || u.label} · ${opName(u.op)}`, op: u.op, jobIds: [u.jobId], units: [] }), []);
  const liveDis = useMemo(() => (data?.decisions ?? []).filter((d) => ['open', 'claimed', 'escalated'].includes(d.status)), [data]);
  if (!data || !wf) return <div className="space-y-3"><a href="#/workflows" className="text-xs text-zinc-500 hover:underline">← Workflow</a><Loading error={error} /></div>;
  const f = data.fleet;
  return <div className="min-w-0 space-y-6" data-testid="workflow-page">
    <StaleNote error={error} hasData />
    <header className="space-y-3">
      <a href="#/workflows" className="text-xs text-zinc-500 hover:underline">← Workflow</a>
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="text-xs text-zinc-500">{data.projectName}</p><h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{wf.name || wf.id}</h1><p className="mt-1 line-clamp-2 text-sm text-zinc-500">{wf.goal}</p></div>{f && <StatePill pill={f.pill} />}</div>
      {f && <div className={`${card} space-y-3 p-4`}><ProgressLine p={f.progress} now={now} />{f.topReason && <p className="text-xs text-amber-300" title={`${f.topReason.text}\n${f.topReason.source}`}>Vì sao: {reasonVi(f.topReason.text)}</p>}{f.progress.stall.stalled && f.progress.stall.reasons.length > 1 && <ul className="list-disc pl-5 text-xs text-zinc-400">{f.progress.stall.reasons.slice(1).map((r, i) => <li key={i} title={r}>{reasonVi(r)}</li>)}</ul>}<OnItLine onIt={f.onIt} /><p className="text-[11px] text-zinc-600">Nguồn: progress-rca.mjs workflowView (= api status progress) · cập nhật {ago(data.updatedAt, now)}{data.statusAt ? ` · api status ${ago(data.statusAt, now)}` : ' · api status chưa về'}</p></div>}
    </header>

    <section className={`${card} p-4`}><H2 note="Xanh: xong · Vàng: đang chạy · Đỏ: làm lại · Xám: chưa tới">Đồ thị công việc</H2>
      {wf.workGraph ? <WorkGraphView wf={wf} graph={wf.workGraph as WorkGraph} labelOf={opName} timeOf={(at) => ago(at, now)} /> : wf.legs?.length ? <LegGraph wf={wf} labelOf={opName} ageOf={(at) => ago(at, now)} /> : <p className="text-sm text-zinc-500">Luồng này chưa có đồ thị chặng (chỉ có các đơn vị bên dưới).</p>}
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className={`${card} p-4`}><H2 note="Theo máy trạng thái job (DESIGN §9.1), mỗi đơn vị một dòng theo job mới nhất.">Đơn vị theo trạng thái</H2>{data.board ? <UnitBoard board={data.board} open={openUnit} /> : <p className="text-sm text-zinc-500">Chưa đọc được đơn vị.</p>}</section>
      <section className={`${card} p-4`}><H2 note="Kernel thử một giả thuyết, đo, rồi giữ hoặc bỏ (api decide).">Nhật ký quyết định của Kernel</H2>
        {f?.decisionLog.length ? <ol className="space-y-2">{[...f.decisionLog].reverse().map((d) => <li key={d.id} className="rounded-lg border border-zinc-800 p-2 text-xs"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={d.status === 'revert' ? 'border-red-500/30 text-red-400' : d.status === 'keep' ? 'border-emerald-500/30 text-emerald-400' : 'border-sky-500/30 text-sky-400'}>{decisionStatus[d.status] ?? d.status}</Badge>{d.actionKey && <span className="font-mono text-zinc-500">{d.actionKey}</span>}<span className="ml-auto font-mono text-zinc-600">{d.id}</span></div><p className="mt-1 break-words text-zinc-300">{d.hypothesis}</p>{d.observed && <p className="mt-0.5 break-words text-zinc-500">Quan sát: {d.observed}</p>}</li>)}</ol> : <p className="text-sm text-zinc-500">Kernel chưa ghi quyết định nào.</p>}
        <h3 className="mb-1 mt-4 text-sm font-medium">Việc chờ quyết (Decision Item) · {liveDis.length}</h3>
        <DecisionList items={data.decisions} empty="Không có Decision Item nào cho luồng này." showWorkflow={false} />
      </section>
    </div>

    {f && <section className={`${card} p-4`}><H2>Vì sao chậm: phân tích nguyên nhân</H2><RcaPanel rca={f.rca} /></section>}

    <section className={`${card} p-4`}><H2 note="Worktree riêng của luồng (wf) và của từng op (op).">Worktree</H2>
      {data.worktrees.length ? <ul className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">{data.worktrees.map((w) => <li key={w.path} className="flex flex-wrap items-center gap-2 p-2 text-xs"><Badge variant="secondary">{w.kind}</Badge><span className="min-w-0 flex-1 break-all font-mono text-zinc-300">{w.path}</span><span className="text-zinc-500">{w.branch ?? 'detached'}{w.jobStatus ? ` · job ${statusName[w.jobStatus] ?? w.jobStatus}` : ''}</span><Badge variant="outline" className={w.state === 'active' ? 'border-emerald-500/30 text-emerald-400' : 'border-amber-500/30 text-amber-400'}>{w.state === 'active' ? 'đang dùng' : w.state === 'leftover' ? 'còn sót' : w.state}</Badge></li>)}</ul> : <p className="text-sm text-zinc-500">Luồng này chưa có worktree riêng (các op làm trên checkout chính).</p>}
    </section>

    <details className={`${card} p-4`}><summary className="cursor-pointer text-base font-semibold">Chi tiết đầy đủ: theo phần, diễn biến, bằng chứng</summary>
      <div className="mt-4 border-t border-zinc-800 pt-4"><WorkflowTracker data={data.snapshot} agents={null} id={wf.id} snapshotError={error} /></div>
    </details>
    <ProofDrawer projectId={data.projectId} workflowId={wf.id} target={target} onClose={() => setTarget(null)} labelOf={opName} />
  </div>;
}

/* ------------------------------------------------------------ Hệ thống */

const modeTone: Record<string, string> = { active: 'border-emerald-500/30 text-emerald-400', shadow: 'border-sky-500/30 text-sky-400', off: 'border-zinc-700 text-zinc-500' };
const svcTone = (state: string) => state === 'healthy' || state === 'ok' || state === 'live' ? 'border-emerald-500/30 text-emerald-400' : state === 'unmanaged' || state === 'declared' ? 'border-zinc-700 text-zinc-400' : 'border-red-500/30 text-red-400';

export function SystemPage() {
  const { data, error } = usePoll<SystemView>('/api/system', 20_000);
  const now = useNow();
  if (!data) return <Loading error={error} />;
  const r = data.reconciler;
  const liveSup = data.decisions.supervisor.filter((d) => ['open', 'claimed', 'escalated'].includes(d.status));
  const doneSup = data.decisions.supervisor.filter((d) => !liveSup.includes(d));
  const missing = Object.entries(data.sources).filter(([, v]) => v);
  return <div className="min-w-0 space-y-6" data-testid="system">
    <StaleNote error={error} hasData />
    <section className={`${card} p-4`}>
      <div className="flex flex-wrap items-center gap-2"><Server className="size-4 text-zinc-400" /><h2 className="text-base font-semibold">Reconciler engine</h2>
        <Badge variant="outline" className={r.engine.running ? 'border-emerald-500/30 text-emerald-400' : 'border-red-500/30 text-red-400'}>{r.engine.running ? 'Đang chạy' : 'Không chạy'}</Badge></div>
      <p className="mt-2 text-sm text-zinc-400">{r.engine.running ? `Leader epoch ${r.engine.epoch} · pid ${r.engine.pid} · nhịp tim ${r.engine.heartbeatAgeMs == null ? '—' : ago(now - r.engine.heartbeatAgeMs, now)} · rev ${r.engine.rev?.slice(0, 9) ?? '—'} · hàng đợi ${r.queueDepth}` : r.engine.why}</p>
      <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-xs"><thead className="text-zinc-500"><tr><th className="p-2 font-medium">Controller</th><th className="p-2 font-medium">Mode</th><th className="p-2 font-medium">Lượt gần nhất</th><th className="p-2 text-right font-medium" title="reconciler.would: việc controller shadow SẼ làm (24 giờ)">Sẽ làm</th><th className="p-2 text-right font-medium" title="reconciler.act: việc đã làm thật (24 giờ)">Đã làm</th><th className="p-2 text-right font-medium">Lỗi</th><th className="p-2 text-right font-medium">Hàng đợi</th></tr></thead>
        <tbody className="divide-y divide-zinc-800/80">{r.controllers.map((c) => <tr key={c.name} title={c.lastWould ? `Gần nhất sẽ làm: ${c.lastWould}` : undefined}><td className="p-2 font-medium text-zinc-200">{c.name}</td><td className="p-2">{c.mode ? <Badge variant="outline" className={modeTone[c.mode] ?? ''} title={c.modeSource ?? undefined}>{c.mode}</Badge> : <span className="text-zinc-600">—</span>}</td><td className="p-2 text-zinc-400">{ago(c.lastPassAt, now)}</td><td className="p-2 text-right tabular-nums">{c.would}</td><td className="p-2 text-right tabular-nums">{c.acts}</td><td className={`p-2 text-right tabular-nums ${c.failed + c.errors ? 'text-red-400' : ''}`}>{c.failed + c.errors}</td><td className="p-2 text-right tabular-nums">{c.queue.depth}{c.queue.failing ? <span className="text-red-400"> ({c.queue.failing} lỗi)</span> : null}</td></tr>)}</tbody></table></div>
      <p className="mt-2 text-[11px] text-zinc-600">Nguồn: reconciler.sqlite (leader, modes, queue, actions) và dòng reconciler.* trong nhật ký Supervisor, 24 giờ.</p>
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className={`${card} p-4`}><H2 note={r.services.source ?? 'chưa có nguồn'}>Dịch vụ · {r.services.healthy}/{r.services.managed} ổn</H2>
        <ul className="divide-y divide-zinc-800/80 rounded-lg border border-zinc-800">{[...r.services.rows, ...r.services.seats, ...r.services.ledgers].map((s) => <li key={s.name} className="flex flex-wrap items-center gap-2 p-2 text-xs"><span className="min-w-0 flex-1 break-all font-mono text-zinc-300">{s.name}</span>{s.restarts > 0 && <span className="text-amber-400">khởi động lại ×{s.restarts}</span>}{s.detail && <span className="text-zinc-500">{s.detail}</span>}{s.lastAt ? <span className="text-zinc-600">{ago(s.lastAt, now)}</span> : null}<Badge variant="outline" className={svcTone(s.state)}>{s.state}</Badge></li>)}</ul>
      </section>
      <section className={`${card} p-4`}><H2 note={r.violations.source ?? 'chưa có nguồn'}>Vi phạm SLA · {r.violations.open} đang mở</H2>
        {r.violations.rows.length ? <ul className="space-y-1 text-xs">{r.violations.rows.map((v) => <li key={v.key} className="flex flex-wrap gap-2 rounded border border-zinc-800 p-2"><Badge variant="outline" className={v.severity === 'critical' ? 'border-red-500/30 text-red-400' : 'border-amber-500/30 text-amber-400'}>{v.code ?? '?'}</Badge><span className="min-w-0 flex-1 break-all text-zinc-300">{v.entity}</span><span className="text-zinc-500">{ago(v.at, now)}</span></li>)}</ul> : <p className="text-sm text-emerald-400">Không có vi phạm nào đang mở.</p>}
        <p className="mt-2 text-[11px] text-zinc-600">{r.violations.clocks} đồng hồ SLA đang chạy.</p>
        <h3 className="mb-1 mt-4 flex items-center gap-2 text-sm font-medium"><Trash2 className="size-3.5 text-zinc-500" /> Dọn rác (GC)</h3>
        {r.gc ? <p className="text-xs text-zinc-400">{r.gc.msg} · {ago(r.gc.at, now)} · {r.gc.collected24h} mục đã dọn trong 24 giờ · còn sót <span className={(r.gc.leftovers ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}>{r.gc.leftovers ?? '—'}</span>{r.gc.counts?.refused ? ` · ${r.gc.counts.refused} bị từ chối` : ''}</p> : <p className="text-xs text-zinc-500">Chưa có lần dọn nào được ghi.</p>}
      </section>
    </div>

    <section className={`${card} p-4`}><div className="mb-2 flex flex-wrap items-center gap-2"><Cpu className="size-4 text-zinc-400" /><h2 className="text-base font-semibold">Tài nguyên</h2><span className="text-xs text-zinc-500">RAM {Math.round(data.ram.percent)}% · {gb(data.ram.usedBytes)} / {gb(data.ram.totalBytes)}</span><a href="#/agents" className="ml-auto text-xs text-sky-400 hover:underline">Máy và agent chi tiết →</a></div>
      <OpHealthPanel health={data.opHealth} stuck={data.stuck} />
    </section>

    <div className="grid gap-6 xl:grid-cols-2">
      <section className={`${card} p-4`}><div className="mb-2 flex items-center gap-2"><ShieldAlert className="size-4 text-zinc-400" /><h2 className="text-base font-semibold">Hàng quyết định của Supervisor · {liveSup.length}</h2><a href="#/supervisor" className="ml-auto text-xs text-sky-400 hover:underline">Supervisor chi tiết →</a></div>
        <DecisionList items={liveSup} empty="Supervisor không có việc chờ quyết." />
        {doneSup.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-xs text-sky-400">Quyết định gần đây ({doneSup.length})</summary><div className="mt-2"><DecisionList items={doneSup} empty="" /></div></details>}
        {data.decisions.product.length > 0 && <><h3 className="mb-1 mt-4 text-sm font-medium">Decision Item đang mở của các luồng</h3><DecisionList items={data.decisions.product} empty="" /></>}
      </section>
      <section className={`${card} p-4`}><div className="mb-2 flex items-center gap-2"><GitBranch className="size-4 text-zinc-400" /><h2 className="text-base font-semibold">Lane và cổng land</h2></div>
        {data.land ? <><p className="text-sm text-zinc-400">{data.land.busy ? `Đang land ${data.land.current || ''}` : 'Cổng land rảnh'} · {data.land.queued} đang chờ</p>
          <ul className="mt-2 space-y-1 text-xs">{data.land.lastLands.slice(0, 8).map((l, i) => <li key={i} className="flex gap-2"><span className={l.kind.includes('fail') || l.kind.includes('refus') ? 'text-red-400' : 'text-emerald-400'}>{l.kind}</span><span className="min-w-0 flex-1 truncate font-mono text-zinc-400">{l.id}</span><span className="text-zinc-600">{ago(l.at, now)}</span></li>)}</ul>
          {data.land.pushes.length > 0 && <><h3 className="mb-1 mt-3 text-sm font-medium">Push</h3><ul className="space-y-1 text-xs">{data.land.pushes.slice(0, 6).map((p, i) => <li key={i} className="flex gap-2"><span className={p.error ? 'text-red-400' : 'text-emerald-400'}>{p.kind}</span><span className="min-w-0 flex-1 truncate text-zinc-400">{p.repo} {p.head?.slice(0, 9)}{p.error ? ` · ${p.error}` : ''}</span><span className="text-zinc-600">{ago(p.at, now)}</span></li>)}</ul></>}</> : <p className="text-sm text-zinc-500">Chưa đọc được trạng thái land.</p>}
        <p className="mt-3 text-xs text-zinc-500">Khác: <a className="underline" href="#/changes">Diff và bằng chứng</a> · <a className="underline" href="#/verdicts">Lịch sử verdict</a> · <a className="underline" href="#/projects">Dự án</a></p>
      </section>
    </div>
    {missing.length > 0 && <section className={`${card} p-4`}><H2>Nguồn chưa đọc được · {missing.length}</H2><ul className="space-y-1 text-xs text-zinc-400">{missing.map(([k, v]) => <li key={k}><span className="font-mono text-zinc-500">{k}</span>: {v}</li>)}</ul></section>}
    <p className="text-[11px] text-zinc-600">Cập nhật {ago(data.updatedAt, now)} · /api/system dựng một lần mỗi nhịp.</p>
  </div>;
}

/* ------------------------------------------------------------ Nhật ký */

export function LogPage() {
  const { data } = usePoll<HomeView>('/api/home', 60_000);
  const [source, setSource] = useState('supervisor');
  const wf = data?.workflows.find((w) => w.id === source) ?? null;
  return <div className="space-y-3" data-testid="log-page">
    <div className="flex flex-wrap items-center gap-2"><label htmlFor="log-source" className="text-sm text-zinc-400">Nguồn</label>
      <select id="log-source" value={source} onChange={(event) => setSource(event.target.value)} className="min-w-0 max-w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-200">
        <option value="supervisor">Supervisor và reconciler</option>
        {(data?.workflows ?? []).map((w) => <option key={w.id} value={w.id}>{w.name || w.id}</option>)}
      </select>
      <span className="text-xs text-zinc-500">Lọc theo loại, tác nhân, mức và từ khóa ngay trong khung bên dưới.</span></div>
    {source === 'supervisor' || !wf
      ? <LogTimeline key="supervisor" projectId="supervisor" workflowId="wf-supervisor" jobIds={[]} endpoint="/api/supervisor/logs" live />
      : <LogTimeline key={wf.id} projectId={wf.projectId} workflowId={wf.id} jobIds={[]} live />}
  </div>;
}
