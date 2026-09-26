import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2,
  ChevronRight, CircleAlert, CircleDashed, Clock3, Database, ExternalLink,
  FolderKanban, GitBranch, FileCode2, Inbox, Layers3, ListFilter, LoaderCircle, RefreshCw,
  Search, Server, ShieldAlert, Workflow as WorkflowIcon, XCircle,
  Bot, Languages, Moon, Sun,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AgentSnapshot, ProjectRow, Snapshot, Verdict, VerdictEntry, WorkflowRow } from './types';
import { AgentBadges, AgentOverview, AgentsPage, WorkflowAgents } from './agents';
import { CodeDiffPage, CodeDiffTeaser } from './changes';
import { applyPreferences, initialLanguage, initialTheme, observeLanguage, type Language, type Theme } from './preferences';

const nav = [
  { href: '#/', label: 'Tổng quan', icon: Activity },
  { href: '#/projects', label: 'Dự án', icon: FolderKanban },
  { href: '#/workflows', label: 'Luồng việc', icon: WorkflowIcon },
  { href: '#/agents', label: 'Agents', icon: Bot },
  { href: '#/changes', label: 'Code diff & ảnh', icon: FileCode2 },
  { href: '#/verdicts', label: 'Kết quả kiểm tra', icon: CheckCircle2 },
  { href: '#/owner', label: 'Cần thầy làm', icon: Bell },
  { href: '#/supervisor', label: 'Giám sát', icon: ShieldAlert },
];
const time = (value: number | string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(date);
};
const age = (value: number | null | undefined) => {
  if (!value) return '—';
  const min = Math.max(0, Math.round((Date.now() - value) / 60_000));
  if (min < 1) return 'vừa xong';
  if (min < 60) return `${min} phút`;
  if (min < 1440) return `${Math.floor(min / 60)} giờ ${min % 60} phút`;
  return `${Math.floor(min / 1440)} ngày`;
};
const opLabel: Record<string, string> = {
  'request.analyze': 'Phân tích yêu cầu', 'scope.define': 'Xác định phạm vi', 'business.decide': 'Chốt nghiệp vụ',
  'architecture.decide': 'Thiết kế kiến trúc', 'brand.decide': 'Chốt thương hiệu', 'interface.draw': 'Vẽ giao diện',
  'interface.implement': 'Code giao diện', 'interface.audit': 'Soát giao diện', 'backend.implement': 'Code backend',
  'integration.verify': 'Kiểm thử tích hợp', 'e2e.verify': 'Kiểm thử đầu cuối', 'uat.verify': 'Nghiệm thu',
  'review.verify': 'Review cuối', 'handover.review': 'Bàn giao', 'work.author': 'Chia việc chi tiết',
  'provision.ask': 'Xin thông tin', 'code.refactor': 'Chỉnh sửa mã nguồn',
};
const label = (op: string) => opLabel[op] || op || 'Chưa rõ bước';
const title = (wf: WorkflowRow) => wf.name?.replaceAll('-', ' ') || wf.id;
const incidentKind = (text: string) => /^\[([^\]]+)]/.exec(text)?.[1] || '';
const blockingIncidents = (wf: WorkflowRow) => wf.incidents.filter((item) => !['plan', 'plan-note', 'spec-consistency-followup'].includes(incidentKind(item.text)));
const frontierLabel: Record<string, string> = {
  'settle-ready': 'Cần chốt kết quả', 'peer-message': 'Có thư từ workflow khác', 'peer-wait': 'Chờ workflow khác',
  'owner-gate': 'Chờ thầy', 'orphaned-frontier': 'Thiếu bước tiếp theo', engaged: 'Đang xử lý',
  actionable: 'Có việc cần làm', idle: 'Tạm nghỉ', stalled: 'Kẹt tiến độ', queued: 'Trong hàng chờ',
};
const frontierReason = (wf: WorkflowRow) => {
  switch (wf.frontier?.state) {
    case 'settle-ready': return 'Có báo cáo đã được nhận nhưng chưa chốt verdict.';
    case 'peer-message': return 'Có thư từ luồng việc khác đang chờ kernel đọc và phản hồi.';
    case 'peer-wait': return 'Luồng việc đang đợi điều kiện từ luồng khác.';
    case 'orphaned-frontier': return 'Chưa có op mở hoặc báo cáo chờ xử lý; kernel cần xác định bước tiếp theo.';
    default: return wf.frontier?.reason ? 'Runtime đã ghi lý do chi tiết; mở dữ liệu bên dưới để xem nguyên văn.' : 'Không có lý do bổ sung.';
  }
};
const verdictLabel: Record<Verdict, string> = { pass: 'Đạt', fail: 'Trượt', blocked: 'Bị chặn', unknown: 'Chưa rõ' };
const verdictTone: Record<Verdict, string> = {
  pass: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10',
  fail: 'text-red-400 border-red-500/20 bg-red-500/10',
  blocked: 'text-amber-400 border-amber-500/20 bg-amber-500/10',
  unknown: 'text-zinc-300 border-zinc-500/20 bg-zinc-500/10',
};

function go(href: string) { window.location.hash = href.slice(1); }
function useRoute() {
  const [route, setRoute] = useState(window.location.hash || '#/');
  useEffect(() => {
    const update = () => setRoute(window.location.hash || '#/');
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  return route;
}

function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const code = verdict in verdictLabel ? verdict : 'unknown';
  return <Badge variant="outline" className={verdictTone[code]}>{verdictLabel[code]}</Badge>;
}
function StateBadge({ wf }: { wf: WorkflowRow }) {
  const asks = wf.asks?.filter((ask) => ask.askClass !== 'credential').length ?? 0;
  if (asks) return <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-400">Chờ thầy</Badge>;
  if (wf.kernel.state === 'stale') return <Badge variant="destructive">Tín hiệu kernel cũ</Badge>;
  if (wf.frontier?.state === 'peer-wait') return <Badge variant="outline" className="border-amber-500/25 bg-amber-500/10 text-amber-400">Chờ workflow khác</Badge>;
  if (wf.frontier?.actionable) return <Badge variant="outline" className="border-sky-500/25 bg-sky-500/10 text-sky-400">Kernel cần xử lý</Badge>;
  if (wf.running.length) return <Badge variant="outline" className="border-emerald-500/25 bg-emerald-500/10 text-emerald-400">Đang làm</Badge>;
  if (blockingIncidents(wf).length) return <Badge variant="outline" className="border-red-500/25 bg-red-500/10 text-red-400">Có vướng mắc</Badge>;
  if (wf.queued.length) return <Badge variant="secondary">Đang chờ</Badge>;
  return <Badge variant="outline">Sẵn sàng</Badge>;
}
function SectionHeading({ eyebrow, title: sectionTitle, note, action }: { eyebrow?: string; title: string; note?: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
    <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">{eyebrow}</div><h2 className="text-xl font-semibold tracking-tight text-zinc-50">{sectionTitle}</h2>{note && <p className="mt-1 text-sm text-zinc-500">{note}</p>}</div>
    {action}
  </div>;
}
function Metric({ icon: Icon, label: metricLabel, value, note, tone = 'normal' }: { icon: typeof Activity; label: string; value: number | string; note: string; tone?: 'normal' | 'red' | 'amber' | 'green' }) {
  const colors = { normal: 'text-zinc-300 bg-zinc-800/70', red: 'text-red-400 bg-red-500/10', amber: 'text-amber-400 bg-amber-500/10', green: 'text-emerald-400 bg-emerald-500/10' };
  return <Card className="min-w-0 border border-zinc-800/70 bg-zinc-950/80 shadow-none">
    <CardContent className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-medium text-zinc-500">{metricLabel}</p><p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p><p className="mt-1 text-xs text-zinc-600">{note}</p></div>
      <div className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="size-4" /></div>
    </CardContent>
  </Card>;
}
function ProjectCard({ project }: { project: ProjectRow }) {
  const t = project.totals;
  return <Card role="button" tabIndex={0} className="cursor-pointer border border-zinc-800/80 bg-zinc-950/80 shadow-none transition-colors hover:border-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-400" onClick={() => go(`#/projects/${project.id}`)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(`#/projects/${project.id}`); } }}>
    <CardHeader>
      <CardTitle className="flex items-center gap-2 text-lg"><span className="flex size-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-900 text-sm font-semibold">{project.name.slice(0, 1)}</span>{project.name}</CardTitle>
      <CardDescription>{t ? `${t.workflows} luồng đang chạy` : project.error || 'Không đọc được dự án'}</CardDescription>
      <CardAction><ChevronRight className="size-4 text-zinc-500" /></CardAction>
    </CardHeader>
    <CardContent>
      {t ? <><div className="grid grid-cols-3 gap-3 border-y border-zinc-800/80 py-4">
        <div><div className="text-xl font-semibold text-zinc-100">{t.pass}</div><div className="mt-1 text-xs text-zinc-500">lần đạt</div></div>
        <div><div className="text-xl font-semibold text-red-400">{t.fail}</div><div className="mt-1 text-xs text-zinc-500">lần trượt</div></div>
        <div><div className="text-xl font-semibold text-amber-400">{t.blocked}</div><div className="mt-1 text-xs text-zinc-500">bị chặn</div></div>
      </div><div className="mt-4 flex items-center justify-between text-xs text-zinc-500"><span>{t.kernels} kernel có tín hiệu · {t.workers} worker chạy</span><span>{t.incidents} incident/ghi chú mở</span></div></> : <p className="text-sm text-red-400">{project.error}</p>}
    </CardContent>
  </Card>;
}
function WorkflowTable({ rows, projectNames, agents }: { rows: WorkflowRow[]; projectNames: Record<string, string>; agents: AgentSnapshot | null }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500">Không có workflow phù hợp.</div>;
  return <div className="overflow-x-auto rounded-xl border border-zinc-800/80 bg-zinc-950/70">
    <Table>
      <TableHeader><TableRow className="border-zinc-800 hover:bg-transparent"><TableHead className="w-[30%]">Luồng việc</TableHead><TableHead>Dự án</TableHead><TableHead>Tiến độ</TableHead><TableHead>Trạng thái</TableHead><TableHead>Agent</TableHead><TableHead className="text-right">Verdict</TableHead><TableHead className="w-8" /></TableRow></TableHeader>
      <TableBody>{rows.map((wf) => <TableRow key={wf.id} className="border-zinc-800/70 hover:bg-zinc-900/70">
        <TableCell><button className="text-left font-medium text-zinc-100 hover:underline" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>{title(wf)}</button><div className="mt-1 max-w-[350px] truncate text-xs text-zinc-500">{wf.goal || wf.id}</div></TableCell>
        <TableCell className="text-zinc-400">{projectNames[wf.projectId] || wf.projectId}</TableCell>
        <TableCell><div className="w-28"><div className="mb-1.5 text-xs text-zinc-400">{wf.done ?? '—'} / {wf.total ?? '—'} chặng</div><Progress value={wf.total ? 100 * (wf.done || 0) / wf.total : 0} className="h-1.5" /></div></TableCell>
        <TableCell><StateBadge wf={wf} /></TableCell>
        <TableCell><AgentBadges data={agents} workflowId={wf.id} /></TableCell>
        <TableCell className="text-right text-xs tabular-nums"><span className="text-emerald-400">{wf.verdicts.pass}</span><span className="px-1.5 text-zinc-700">/</span><span className="text-red-400">{wf.verdicts.fail}</span><span className="px-1.5 text-zinc-700">/</span><span className="text-amber-400">{wf.verdicts.blocked}</span></TableCell>
        <TableCell><Button variant="ghost" size="icon-sm" aria-label={`Xem ${title(wf)}`} onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}><ChevronRight /></Button></TableCell>
      </TableRow>)}</TableBody>
    </Table>
  </div>;
}

function Overview({ data, agents }: { data: Snapshot; agents: AgentSnapshot | null }) {
  const all = data.projects.flatMap((p) => p.workflows);
  const totals = data.projects.reduce((acc, p) => { if (p.totals) for (const key of Object.keys(acc) as (keyof typeof acc)[]) acc[key] += p.totals[key]; return acc; }, { workflows: 0, kernels: 0, workers: 0, pass: 0, fail: 0, blocked: 0, incidents: 0 });
  const asks = all.flatMap((wf) => wf.asks.filter((ask) => ask.askClass !== 'credential').map((ask) => ({ wf, ask })));
  const creds = all.reduce((n, wf) => n + wf.asks.filter((ask) => ask.askClass === 'credential').length, 0);
  const planCount = all.flatMap((wf) => wf.incidents.filter((incident) => /^\[owner-gate/.test(incident.text) && /\b(?:goal|plan) revision\b|bản chỉnh kế hoạch|sửa kế hoạch/i.test(incident.text))).length;
  const recent = all.flatMap((wf) => wf.recentVerdicts.map((entry) => ({ wf, entry }))).sort((a, b) => b.entry.at - a.entry.at).slice(0, 6);
  const peerEdges = all.flatMap((wf) => (wf.frontier?.peerWaits || []).map((wait) => ({ from: wf, to: all.find((other) => other.id === wait.peer), wait })));
  return <div className="space-y-8">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric icon={WorkflowIcon} label="Luồng đang chạy" value={totals.workflows} note="trên 3 dự án" />
      <Metric icon={Activity} label="Kernel có tín hiệu" value={`${totals.kernels}/${totals.workflows}`} note={`${totals.workers} worker đang chạy`} tone="green" />
      <Metric icon={Bell} label="Cần thầy xử lý" value={asks.length + planCount} note={`${creds} credential riêng · ${planCount} bản kế hoạch`} tone="amber" />
      <Metric icon={ShieldAlert} label="Supervisor còn nợ" value={data.owedCounts.supervisor ?? data.owed.length} note={`${totals.incidents} incident/ghi chú mở`} tone="red" />
    </div>
    <AgentOverview data={agents} open={() => go('#/agents')} />
    <CodeDiffTeaser data={agents} open={() => go('#/changes')} />
    <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <Card className="border border-zinc-800/80 bg-zinc-950/80 shadow-none">
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="size-4 text-amber-400" /> Cần thầy làm</CardTitle><CardDescription>Những quyết định đang chặn tiến độ</CardDescription><CardAction><Button variant="ghost" size="sm" onClick={() => go('#/owner')}>Xem tất cả <ArrowRight /></Button></CardAction></CardHeader>
        <CardContent className="space-y-3">
          {asks.length ? asks.slice(0, 3).map(({ wf, ask }, index) => <div key={`${wf.id}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
            <div className="mb-1 flex items-center gap-2"><Badge variant="outline" className="border-amber-500/25 text-amber-400">Cần duyệt</Badge><span className="text-xs text-zinc-500">{wf.name}</span></div>
            <p className="text-sm leading-6 text-zinc-200">{ask.text}</p>
          </div>) : <div className="flex items-center gap-2 rounded-lg border border-zinc-800 p-5 text-sm text-zinc-500"><Check className="size-4 text-emerald-400" /> Hiện không có câu hỏi cần thầy trả lời.</div>}
          {planCount > 0 && <button className="flex w-full items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-left text-sm text-amber-300" onClick={() => go('#/owner')}><GitBranch className="size-4" /> {planCount} bản chỉnh kế hoạch đang chờ xác nhận <ArrowRight className="ml-auto size-4" /></button>}
          {creds > 0 && <div className="flex items-center gap-2 text-xs text-zinc-500"><Database className="size-3.5" /> {creds} yêu cầu credential được tách riêng</div>}
        </CardContent>
      </Card>
      <Card className="border border-zinc-800/80 bg-zinc-950/80 shadow-none">
        <CardHeader><CardTitle>Bức tranh verdict</CardTitle><CardDescription>Số lần op được chốt trong các workflow đang chạy</CardDescription></CardHeader>
        <CardContent><div className="flex h-20 items-end gap-1 overflow-hidden rounded-lg">
          <div className="flex h-full flex-[var(--pass)] flex-col justify-end bg-emerald-500/15 p-3" style={{ '--pass': Math.max(1, totals.pass) } as React.CSSProperties}><span className="text-2xl font-semibold text-emerald-400">{totals.pass}</span><span className="text-xs text-zinc-500">Đạt</span></div>
          <div className="flex h-full flex-[var(--fail)] flex-col justify-end bg-red-500/15 p-3" style={{ '--fail': Math.max(1, totals.fail) } as React.CSSProperties}><span className="text-2xl font-semibold text-red-400">{totals.fail}</span><span className="text-xs text-zinc-500">Trượt</span></div>
          <div className="flex h-full flex-[var(--blocked)] flex-col justify-end bg-amber-500/15 p-3" style={{ '--blocked': Math.max(1, totals.blocked) } as React.CSSProperties}><span className="text-2xl font-semibold text-amber-400">{totals.blocked}</span><span className="text-xs text-zinc-500">Bị chặn</span></div>
        </div><p className="mt-3 text-xs leading-5 text-zinc-500">Đây là lịch sử từng lần chạy, không phải số workflow đã hoàn thành.</p></CardContent>
      </Card>
    </div>
    <section><SectionHeading eyebrow="Danh mục" title="Dashboard dự án" note="Chọn một dự án để xem các workflow và điểm nghẽn của dự án đó." action={<Button variant="outline" size="sm" onClick={() => go('#/projects')}>Xem dự án <ArrowRight /></Button>} /><div className="grid gap-4 lg:grid-cols-3">{data.projects.map((project) => <ProjectCard key={project.id} project={project} />)}</div></section>
    <section><SectionHeading eyebrow="Liên kết" title="Luồng việc chờ nhau" note="Các phụ thuộc đang giữ việc ở bước tiếp theo." /><div className="grid gap-3 lg:grid-cols-2">{peerEdges.length ? peerEdges.map(({ from, to, wait }, index) => <Card key={`${from.id}-${index}`} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent className="flex items-center gap-3"><div className="min-w-0 flex-1"><div className="text-xs text-zinc-500">Đang chờ</div><button className="mt-1 truncate text-left text-sm font-medium hover:underline" onClick={() => go(`#/workflows/${encodeURIComponent(from.id)}`)}>{title(from)}</button></div><ArrowRight className="size-4 shrink-0 text-zinc-600" /><div className="min-w-0 flex-1"><div className="text-xs text-zinc-500">Phụ thuộc</div><button className="mt-1 truncate text-left text-sm font-medium hover:underline" onClick={() => to && go(`#/workflows/${encodeURIComponent(to.id)}`)}>{to ? title(to) : wait.peer || 'Luồng khác'}</button></div></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-6 text-sm text-zinc-500">Không có luồng nào đang chờ luồng khác.</div>}</div></section>
    <section><SectionHeading eyebrow="Hoạt động mới" title="Verdict gần đây" action={<Button variant="ghost" size="sm" onClick={() => go('#/verdicts')}>Xem lịch sử <ArrowRight /></Button>} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{recent.map(({ wf, entry }) => <VerdictCard key={entry.jobId} entry={entry} wf={wf} />)}</div>
    </section>
  </div>;
}

function VerdictCard({ entry, wf }: { entry: VerdictEntry; wf: WorkflowRow }) {
  return <Card className="border border-zinc-800/80 bg-zinc-950/80 shadow-none">
    <CardHeader><CardTitle className="text-sm">{label(entry.op)}</CardTitle><CardDescription className="truncate">{title(wf)}</CardDescription><CardAction><VerdictBadge verdict={entry.verdict} /></CardAction></CardHeader>
    <CardContent className="flex items-center justify-between text-xs text-zinc-500"><span>Lần #{entry.attempt ?? '—'} · {entry.checks?.observed != null ? `${entry.checks.passed ?? 0} đạt · ${entry.checks.failed ?? 0} trượt` : 'Chưa có số check'}</span><span>{time(entry.at)}</span></CardContent>
  </Card>;
}

function ProjectsPage({ data, agents, projectId }: { data: Snapshot; agents: AgentSnapshot | null; projectId?: string }) {
  const project = data.projects.find((item) => item.id === projectId);
  if (!project) return <div className="space-y-8"><SectionHeading eyebrow="Danh mục" title="Các dự án" note="Tổng hợp trực tiếp từ ledger của từng dự án." /><div className="grid gap-4 lg:grid-cols-3">{data.projects.map((item) => <ProjectCard key={item.id} project={item} />)}</div><div className="rounded-xl border border-zinc-800 p-5 text-sm text-zinc-500">Dữ liệu của từng dự án được đọc từ ledger riêng, làm mới tối đa mỗi 30 giây.</div></div>;
  const t = project.totals;
  return <div className="space-y-8"><Button variant="ghost" size="sm" onClick={() => go('#/projects')}><ArrowLeft /> Tất cả dự án</Button>
    <div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Dashboard dự án</div><h1 className="text-3xl font-semibold tracking-tight">{project.name}</h1><p className="mt-2 text-sm text-zinc-500">{project.repo}</p></div><Badge variant="outline">Chỉ đọc</Badge></div>
    {t ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={WorkflowIcon} label="Workflow đang chạy" value={t.workflows} note="trong dự án" /><Metric icon={Activity} label="Kernel có tín hiệu" value={`${t.kernels}/${t.workflows}`} note={`${t.workers} worker đang chạy`} tone="green" /><Metric icon={XCircle} label="Lần trượt" value={t.fail} note={`${t.blocked} lần bị chặn`} tone="red" /><Metric icon={CircleAlert} label="Incident/ghi chú mở" value={t.incidents} note="xem theo từng workflow" tone="amber" /></div> : <div className="text-sm text-red-400">{project.error}</div>}
    <section><SectionHeading eyebrow="Thực thi" title="Luồng việc của dự án" /><WorkflowTable rows={project.workflows} projectNames={{ [project.id]: project.name }} agents={agents} /></section>
    <section><SectionHeading eyebrow="Rủi ro" title="Việc cần chú ý" /><div className="grid gap-3 lg:grid-cols-2">{project.workflows.filter((wf) => blockingIncidents(wf).length || wf.asks.length || wf.kernel.state === 'stale').slice(0, 8).map((wf) => <Card key={wf.id} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle className="text-sm">{title(wf)}</CardTitle><CardAction><StateBadge wf={wf} /></CardAction></CardHeader><CardContent className="text-sm text-zinc-400">{wf.asks[0]?.text || blockingIncidents(wf)[0]?.text || 'Tín hiệu kernel đã cũ.'}</CardContent></Card>)}</div></section>
  </div>;
}

function WorkflowsPage({ data, agents }: { data: Snapshot; agents: AgentSnapshot | null }) {
  const [query, setQuery] = useState('');
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const rows = data.projects.flatMap((p) => p.workflows).filter((wf) => {
    const match = `${wf.name} ${wf.goal} ${wf.id}`.toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));
    const blocked = blockingIncidents(wf).length > 0 || wf.asks.length > 0 || wf.kernel.state === 'stale';
    return match && (!onlyBlocked || blocked) && (!onlyMine || wf.asks.some((ask) => ask.askClass !== 'credential'));
  });
  return <div className="space-y-6"><SectionHeading eyebrow="Vận hành" title="Luồng công việc" note="Theo dõi từng luồng, lý do chờ và lịch sử verdict." />
    <div className="flex flex-wrap gap-2"><div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-2.5 size-4 text-zinc-500" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm workflow hoặc mục tiêu..." /></div><Button variant={onlyBlocked ? 'secondary' : 'outline'} onClick={() => setOnlyBlocked(!onlyBlocked)}><ListFilter /> Chỉ có vướng mắc</Button><Button variant={onlyMine ? 'secondary' : 'outline'} onClick={() => setOnlyMine(!onlyMine)}><Bell /> Chờ thầy</Button></div>
    <WorkflowTable rows={rows} projectNames={Object.fromEntries(data.projects.map((p) => [p.id, p.name]))} agents={agents} /><p className="text-xs text-zinc-600">Hiển thị {rows.length} workflow. Agent làm mới mỗi 10 giây; ledger sau 30 giây.</p></div>;
}

function WorkflowDetail({ data, agents, id }: { data: Snapshot; agents: AgentSnapshot | null; id: string }) {
  const wf = data.projects.flatMap((p) => p.workflows).find((item) => item.id === id);
  const project = data.projects.find((p) => p.id === wf?.projectId);
  if (!wf) return <div className="space-y-4"><Button variant="ghost" onClick={() => go('#/workflows')}><ArrowLeft /> Workflows</Button><p>Không tìm thấy workflow.</p></div>;
  const percent = wf.total ? Math.round(100 * (wf.done || 0) / wf.total) : 0;
  const blockers = blockingIncidents(wf);
  const notes = wf.incidents.filter((item) => !blockers.includes(item));
  return <div className="space-y-7">
    <Button variant="ghost" size="sm" onClick={() => go('#/workflows')}><ArrowLeft /> Luồng việc</Button>
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{project?.name || wf.projectId} / Luồng việc</div><h1 className="text-3xl font-semibold tracking-tight">{title(wf)}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">{wf.goal || 'Chưa có mô tả mục tiêu.'}</p><p className="mt-2 font-mono text-xs text-zinc-600">{wf.id}</p></div><StateBadge wf={wf} /></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric icon={Layers3} label="Chặng hoàn tất" value={`${wf.done ?? '—'}/${wf.total ?? '—'}`} note={`${percent}% kế hoạch`} /><Metric icon={Activity} label="Tín hiệu kernel" value={wf.kernel.state === 'live' ? 'Gần đây' : wf.kernel.state === 'stale' ? 'Cũ' : 'Chưa rõ'} note={[wf.kernel.agent, wf.kernel.model].filter(Boolean).join(' · ') || 'Agent chưa rõ'} tone={wf.kernel.state === 'live' ? 'green' : 'red'} /><Metric icon={Server} label="Worker đang chạy" value={wf.running.length} note={`${wf.queued.length} việc trong hàng chờ`} /><Metric icon={CircleAlert} label="Incident cần xem" value={blockers.length} note={`${notes.length} ghi chú · ${wf.asks.length} yêu cầu thầy`} tone={blockers.length ? 'red' : 'normal'} /></div>
    <WorkflowAgents data={agents} workflowId={wf.id} />
    {wf.frontier && <Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-1 text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Trạng thái bước tiếp theo</div><div className="flex items-center gap-2"><Badge variant="secondary">{frontierLabel[wf.frontier.state] || 'Trạng thái khác'}</Badge>{wf.frontier.actionable && <Badge variant="outline" className="border-emerald-500/25 text-emerald-400">Có việc cần làm</Badge>}</div><p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">{frontierReason(wf)}</p><details className="mt-2 text-xs text-zinc-600"><summary className="cursor-pointer">Xem lý do nguyên văn</summary><p className="mt-2 max-w-4xl break-words">{wf.frontier.reason}</p></details></div><div className="text-xs text-zinc-500">Ước tính xong: {time(wf.etaAt)}</div></CardContent></Card>}
    <div className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]"><Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Chuỗi công việc</CardTitle><CardDescription>{wf.done ?? '—'} trên {wf.total ?? '—'} chặng đã xong</CardDescription></CardHeader><CardContent><Progress value={percent} className="mb-6 h-2" /><div className="space-y-0">{wf.legs.length ? wf.legs.map((leg, index) => <div key={`${leg.op}-${index}`} className="flex gap-3 border-l border-zinc-800 pb-5 pl-4 last:border-transparent last:pb-0"><div className={`-ml-[25px] flex size-4 shrink-0 items-center justify-center rounded-full border ${leg.state === 'done' ? 'border-emerald-500 bg-emerald-500 text-black' : leg.state === 'running' ? 'border-zinc-200 bg-zinc-900 text-white' : 'border-zinc-700 bg-zinc-950 text-zinc-500'}`}>{leg.state === 'done' && <Check className="size-2.5" />}</div><div className="-mt-1 flex flex-1 items-center justify-between gap-2"><span className="text-sm text-zinc-200">{label(leg.op)}</span><span className="text-xs text-zinc-500">{{ done: 'Xong', running: 'Đang làm', queued: 'Chờ', failed: 'Trượt', todo: 'Chưa tới' }[leg.state] || leg.state}</span></div></div>) : <p className="text-sm text-zinc-500">Chưa đọc được chuỗi công việc.</p>}</div></CardContent></Card>
      <div className="space-y-4"><Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Đang diễn ra</CardTitle><CardDescription>Worker và hàng chờ hiện tại</CardDescription></CardHeader><CardContent className="space-y-3">{wf.running.map((job) => <div key={job.jobId} className="rounded-lg border border-zinc-800 p-3"><div className="flex items-center justify-between"><span className="text-sm font-medium">{label(job.op)}</span><Badge variant="outline" className="border-emerald-500/25 text-emerald-400">Đang chạy</Badge></div><p className="mt-1 text-xs text-zinc-500">Lần #{job.attempt} · {age(job.since)}</p></div>)}{wf.queued.map((job) => <div key={job.jobId} className="rounded-lg border border-zinc-800 p-3"><div className="flex items-center justify-between"><span className="text-sm font-medium">{label(job.op)}</span><Badge variant="secondary">Chờ</Badge></div><p className="mt-1 text-xs text-zinc-500">{job.reason || 'Chưa có lý do chờ trong snapshot'}</p></div>)}{!wf.running.length && !wf.queued.length && <p className="text-sm text-zinc-500">Không có op đang chạy hoặc chờ.</p>}</CardContent></Card>
        <Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Điểm nghẽn</CardTitle><CardDescription>Incident, peer-wait và yêu cầu đang mở</CardDescription></CardHeader><CardContent className="space-y-3">{wf.asks.map((ask, index) => <div key={index} className="rounded-lg border border-amber-500/15 bg-amber-500/5 p-3"><Badge variant="outline" className="mb-2 border-amber-500/25 text-amber-400">{ask.askClass === 'credential' ? 'Credential' : 'Chờ thầy'}</Badge><p className="text-sm leading-6 text-zinc-300">{ask.text}</p>{ask.link && <a className="mt-2 inline-flex items-center gap-1 text-xs text-zinc-100 underline" href={ask.link} target="_blank" rel="noreferrer">Mở mẫu đang hoạt động <ExternalLink className="size-3" /></a>}</div>)}{wf.frontier?.peerWaits.map((wait, index) => <div key={index} className="rounded-lg border border-zinc-800 p-3"><Badge variant="secondary" className="mb-2">Chờ workflow khác</Badge><p className="text-sm text-zinc-300">{wait.peer || 'Workflow khác'} · {wait.job || 'job chưa rõ'}</p><p className="mt-1 text-xs text-zinc-500">{wait.reason}</p></div>)}{blockers.map((incident) => <div key={incident.id} className="rounded-lg border border-zinc-800 p-3"><p className="text-sm leading-6 text-zinc-300">{incident.text}</p><p className="mt-2 text-xs text-zinc-600">{incident.id} · {time(incident.at)}</p></div>)}{!wf.asks.length && !blockers.length && !wf.frontier?.peerWaits.length && <p className="text-sm text-zinc-500">Không có điểm nghẽn đang mở.</p>}</CardContent></Card></div></div>
    {notes.length > 0 && <details className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4"><summary className="cursor-pointer text-sm font-medium text-zinc-400">{notes.length} ghi chú mở khác</summary><div className="mt-4 space-y-2">{notes.map((item) => <div key={item.id} className="rounded-lg border border-zinc-800 p-3 text-xs leading-5 text-zinc-500">{item.text}</div>)}</div></details>}
    <section><SectionHeading eyebrow="Kiểm chứng" title="Verdict gần nhất" note="Mỗi dòng là một lần op được chốt, kể cả khi cần chạy lại." /><VerdictTable entries={wf.recentVerdicts.map((entry) => ({ wf, entry }))} /></section>
    <details className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4"><summary className="cursor-pointer text-sm font-medium">Xem dữ liệu JSON đã rút gọn</summary><pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black p-4 text-xs text-zinc-400">{JSON.stringify(wf, null, 2)}</pre></details>
  </div>;
}

function VerdictTable({ entries }: { entries: { wf: WorkflowRow; entry: VerdictEntry }[] }) {
  return <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80"><Table><TableHeader><TableRow className="border-zinc-800 hover:bg-transparent"><TableHead>Thời điểm</TableHead><TableHead>Workflow</TableHead><TableHead>Op</TableHead><TableHead>Lần</TableHead><TableHead>Check đạt / trượt</TableHead><TableHead>Verdict</TableHead></TableRow></TableHeader><TableBody>{entries.length ? entries.map(({ wf, entry }) => <TableRow key={`${entry.jobId}-${entry.at}`} className="border-zinc-800/70"><TableCell className="whitespace-nowrap text-xs text-zinc-500">{time(entry.at)}</TableCell><TableCell><button className="text-left text-sm hover:underline" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>{title(wf)}</button></TableCell><TableCell className="text-sm text-zinc-400">{label(entry.op)}</TableCell><TableCell className="text-xs text-zinc-500">#{entry.attempt ?? '—'}</TableCell><TableCell className="text-xs text-zinc-400">{entry.checks?.passed ?? '—'} / {entry.checks?.failed ?? '—'}</TableCell><TableCell><VerdictBadge verdict={entry.verdict} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-zinc-500">Chưa có verdict.</TableCell></TableRow>}</TableBody></Table></div>;
}
function VerdictsPage({ data }: { data: Snapshot }) {
  const [filter, setFilter] = useState<'all' | Verdict>('all');
  const entries = data.projects.flatMap((p) => p.workflows.flatMap((wf) => wf.recentVerdicts.map((entry) => ({ wf, entry })))).sort((a, b) => b.entry.at - a.entry.at).filter(({ entry }) => filter === 'all' || entry.verdict === filter).slice(0, 120);
  return <div className="space-y-6"><SectionHeading eyebrow="Bằng chứng thực thi" title="Lịch sử verdict" note="Xem những lần chạy mới nhất, kể cả retry và lần bị chặn." /><div className="flex flex-wrap gap-2">{(['all', 'pass', 'fail', 'blocked'] as const).map((item) => <Button key={item} variant={filter === item ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter(item)}>{item === 'all' ? 'Tất cả' : verdictLabel[item]}</Button>)}</div><VerdictTable entries={entries} /><p className="text-xs text-zinc-600">Tối đa 12 verdict gần nhất mỗi workflow, 120 dòng trên màn hình. Tổng lịch sử được cộng riêng ở dashboard dự án.</p></div>;
}

function OwnerPage({ data }: { data: Snapshot }) {
  const all = data.projects.flatMap((p) => p.workflows);
  const asks = all.flatMap((wf) => wf.asks.map((ask) => ({ wf, ask })));
  const approvals = asks.filter((item) => item.ask.askClass !== 'credential');
  const credentials = asks.filter((item) => item.ask.askClass === 'credential');
  const gates = all.flatMap((wf) => wf.incidents.filter((incident) => /^\[owner-gate/.test(incident.text)).map((incident) => ({ wf, incident })));
  const planRevisions = gates.filter(({ incident }) => /\b(?:goal|plan) revision\b|bản chỉnh kế hoạch|sửa kế hoạch/i.test(incident.text));
  const otherGates = gates.filter((item) => !planRevisions.includes(item));
  return <div className="space-y-8"><SectionHeading eyebrow="Hàng chờ quyết định" title="Cần thầy làm" note="Các mục được tách theo loại. App chỉ hiển thị, không gửi câu trả lời vào luồng việc." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Bell} label="Câu hỏi chờ duyệt" value={approvals.length} note="có câu hỏi cụ thể" tone="amber" /><Metric icon={Database} label="Yêu cầu credential" value={credentials.length} note="xử lý qua kênh riêng" /><Metric icon={GitBranch} label="Bản chỉnh kế hoạch" value={planRevisions.length} note="chờ xác nhận phạm vi" tone="amber" /><Metric icon={CircleDashed} label="Owner gate khác" value={otherGates.length} note="incident chờ quyết định đang mở" /></div>
    <section><SectionHeading eyebrow="Quyết định" title="Câu hỏi đang chờ" /><div className="grid gap-3">{approvals.length ? approvals.map(({ wf, ask }, index) => <Card key={`${wf.id}-${index}`} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle className="text-sm">{title(wf)}</CardTitle><CardDescription>{label(ask.op)}</CardDescription><CardAction><Badge variant="outline" className="border-amber-500/25 text-amber-400">Chờ thầy</Badge></CardAction></CardHeader><CardContent><p className="text-sm leading-6 text-zinc-200">{ask.text}</p><div className="mt-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>Xem workflow <ArrowRight /></Button>{ask.link && <Button size="sm" asChild><a href={ask.link} target="_blank" rel="noreferrer">Mở mẫu trả lời <ExternalLink /></a></Button>}</div></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Hiện không có câu hỏi cần thầy trả lời.</div>}</div></section>
    <section><SectionHeading eyebrow="Thông tin nhạy cảm" title="Credential" note="Không hiển thị hoặc nhận giá trị credential tại trang này." /><div className="grid gap-3">{credentials.length ? credentials.map(({ wf, ask }, index) => <Card key={`${wf.id}-${index}`} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent><div className="mb-2 flex items-center gap-2"><Database className="size-4 text-zinc-500" /><span className="font-medium">{title(wf)}</span></div><p className="text-sm text-zinc-400">{ask.text}</p></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có yêu cầu credential.</div>}</div></section>
    <section><SectionHeading eyebrow="Phạm vi" title="Bản chỉnh kế hoạch" note="Nhận diện từ owner-gate ghi rõ goal hoặc plan revision." /><div className="grid gap-3">{planRevisions.length ? planRevisions.map(({ wf, incident }) => <Card key={incident.id} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent><div className="mb-2 flex items-center justify-between"><span className="font-medium">{title(wf)}</span><Badge variant="outline" className="border-amber-500/25 text-amber-400">Chờ thầy</Badge></div><p className="text-sm leading-6 text-zinc-400">{incident.text}</p><Button className="mt-4" variant="outline" size="sm" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>Xem luồng việc <ArrowRight /></Button></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có bản chỉnh kế hoạch đang chờ.</div>}</div></section>
    {otherGates.length > 0 && <section><SectionHeading eyebrow="Cần rà soát" title="Owner gate khác" /><div className="grid gap-3">{otherGates.map(({ wf, incident }) => <div key={incident.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="mb-2 text-sm font-medium">{title(wf)}</div><p className="text-sm text-zinc-400">{incident.text}</p></div>)}</div></section>}
  </div>;
}

function SupervisorPage({ data }: { data: Snapshot }) {
  const unread = data.inbox.filter((message) => !message.read);
  const stale = unread.filter((message) => Date.now() - new Date(message.at).getTime() > 3_600_000);
  return <div className="space-y-8"><SectionHeading eyebrow="Trung tâm giám sát" title="Supervisor" note="Các việc đang nợ và thư chưa đọc; không đánh dấu đã đọc từ app này." />
    <div className="grid gap-3 sm:grid-cols-3"><Metric icon={ShieldAlert} label="OWED đang mở" value={data.owedCounts.supervisor ?? data.owed.length} note="cần supervisor xử lý" tone="red" /><Metric icon={Inbox} label="Thư chưa đọc" value={data.inboxUnreadTotal} note={`${stale.length} trong 30 thư mới cũ hơn 1 giờ`} tone="amber" /><Metric icon={Database} label="Nguồn dữ liệu" value={Object.values(data.sources).filter(Boolean).length ? 'Có lỗi' : 'Ổn định'} note="CLI + SQLite chỉ đọc" tone={Object.values(data.sources).filter(Boolean).length ? 'red' : 'green'} /></div>
    <div className="grid gap-6 xl:grid-cols-2"><section><SectionHeading eyebrow="Hàng chờ" title="Supervisor còn nợ" /><div className="space-y-3">{data.owed.length ? data.owed.map((item) => <Card key={item.key} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent><div className="mb-2 flex items-center justify-between gap-2"><Badge variant="destructive">OWED</Badge><span className="text-xs text-zinc-500">{item.ageMin == null ? '—' : `${item.ageMin} phút`}</span></div><p className="text-sm leading-6 text-zinc-200">{item.summary}</p><p className="mt-2 font-mono text-xs text-zinc-600">{item.kind} · {item.workflowId}</p></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có việc OWED.</div>}</div></section>
      <section><SectionHeading eyebrow="Thư đến" title="Inbox mới nhất" /><div className="space-y-3">{data.inbox.length ? data.inbox.slice(0, 12).map((message) => <Card key={message.id} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent><div className="mb-2 flex items-center justify-between gap-2"><div className="flex items-center gap-2">{!message.read && <span className="size-1.5 rounded-full bg-zinc-100" />}<span className="text-xs text-zinc-500">{message.from || 'Nguồn chưa rõ'}</span></div><span className="text-xs text-zinc-600">{time(message.at)}</span></div>{message.judgedAt && <div className="mb-2 text-[11px] text-zinc-600">Đánh giá lúc: {message.judgedAt}</div>}<p className="line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{message.text}</p>{!message.read && Date.now() - new Date(message.at).getTime() > 3_600_000 && <Badge variant="outline" className="mt-2 border-amber-500/25 text-amber-400">Quá 1 giờ</Badge>}</CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có thư.</div>}</div></section></div>
    <section><SectionHeading eyebrow="Nhịp vận hành" title="Land, push và pool" /><div className="grid gap-4 lg:grid-cols-3">
      <Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Hàng chờ land</CardTitle><CardDescription>Trạng thái từ supervisor</CardDescription></CardHeader><CardContent><div className="text-2xl font-semibold">{data.supervisor?.land.queued ?? '—'}</div><p className="mt-2 text-xs text-zinc-500">{data.supervisor?.land.busy ? `Đang land ${data.supervisor.land.current || ''}` : 'Không có lượt land đang chạy'}</p><div className="mt-4 space-y-2">{data.supervisor?.lastLands.slice(0, 2).map((item) => <div key={`${item.id}-${item.at}`} className="flex justify-between gap-3 border-t border-zinc-800 pt-2 text-xs"><span className={item.kind === 'land-passed' ? 'text-emerald-400' : 'text-red-400'}>{item.kind === 'land-passed' ? 'Land đạt' : 'Land trượt'}</span><span className="truncate text-zinc-500">{item.id}</span></div>)}</div></CardContent></Card>
      <Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Lần push gần nhất</CardTitle><CardDescription>Push lên nhánh chính</CardDescription></CardHeader><CardContent className="space-y-3">{data.supervisor?.pushes.slice(0, 3).map((item) => <div key={`${item.repo}-${item.at}`} className="border-b border-zinc-800 pb-2 text-xs last:border-0"><div className="flex items-center justify-between gap-2"><span className="font-medium text-zinc-200">{item.repo}</span><span className={item.kind === 'push-main' ? 'text-emerald-400' : 'text-red-400'}>{item.kind === 'push-main' ? 'Đạt' : 'Từ chối'}</span></div><p className="mt-1 truncate text-zinc-500">{item.head || item.error || time(item.at)}</p></div>)}{!data.supervisor?.pushes.length && <p className="text-sm text-zinc-500">Chưa có bản ghi push.</p>}</CardContent></Card>
      <Card className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Pool nền</CardTitle><CardDescription>Tình trạng provider</CardDescription></CardHeader><CardContent><div className="flex items-center justify-between gap-2"><span className="text-sm font-medium">{data.supervisor?.basePool.provider || 'Chưa rõ'}</span><Badge variant="outline" className={data.supervisor?.basePool.open ? 'border-red-500/25 text-red-400' : 'border-emerald-500/25 text-emerald-400'}>{data.supervisor?.basePool.open ? 'Có circuit mở' : 'Không có circuit mở'}</Badge></div><p className="mt-2 text-xs text-zinc-500">{data.supervisor?.basePool.model || 'Chưa rõ model'} · {data.supervisor?.basePool.ledgers ?? 0} ledger</p><Separator className="my-4" /><p className="text-xs text-zinc-500">{data.supervisor?.activeWorkers.length ?? 0} worker supervisor đang hoạt động</p></CardContent></Card>
    </div></section>
    <section><SectionHeading eyebrow="Sức khỏe nguồn" title="Trạng thái đọc dữ liệu" /><div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">{Object.entries(data.sources).map(([source, error]) => <div key={source} className="flex items-center justify-between gap-4 border-b border-zinc-800 py-3 last:border-0"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} /><span className="text-sm">{source}</span></div><span className="max-w-lg truncate text-xs text-zinc-500">{error || 'Đọc thành công'}</span></div>)}</div></section>
  </div>;
}

export default function App() {
  const route = useRoute();
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [language, setLanguage] = useState<Language>(initialLanguage);
  useEffect(() => { applyPreferences(theme, language); }, [theme, language]);
  useEffect(() => {
    return observeLanguage(document.body, language);
  }, [language]);
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [agents, setAgents] = useState<AgentSnapshot | null>(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const fetchSnapshot = useCallback(async () => {
    setBusy(true);
    try {
      const response = await fetch('/api/snapshot', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as Snapshot;
      setData(body); setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }, []);
  const fetchAgents = useCallback(async () => {
    try {
      const response = await fetch('/api/agents', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setAgents(await response.json() as AgentSnapshot); setAgentError(null);
    } catch (cause) { setAgentError(cause instanceof Error ? cause.message : String(cause)); }
  }, []);
  useEffect(() => { void fetchSnapshot(); const timer = window.setInterval(() => void fetchSnapshot(), 30_000); return () => window.clearInterval(timer); }, [fetchSnapshot]);
  useEffect(() => { void fetchAgents(); const timer = window.setInterval(() => void fetchAgents(), 10_000); return () => window.clearInterval(timer); }, [fetchAgents]);
  const current = useMemo(() => {
    if (route.startsWith('#/projects/')) return 'Dự án';
    if (route.startsWith('#/workflows/')) return 'Chi tiết luồng việc';
    return nav.find((item) => item.href === route)?.label || 'Tổng quan';
  }, [route]);
  const inboxCount = data?.inboxUnreadTotal ?? 0;
  const agentRoute = route === '#/agents';
  const liveRoute = agentRoute || route === '#/changes';
  const updatedAt = liveRoute ? agents?.updatedAt : data?.updatedAt;
  return <div id="status-app" className="min-h-screen bg-[#09090b] text-zinc-100">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-zinc-800/70 bg-[#0c0c0e] lg:flex">
      <div className="flex h-20 items-center gap-3 px-5"><div className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950"><GitBranch className="size-5" /></div><div><div className="text-sm font-bold tracking-tight">StarCi<span className="text-zinc-500"> / status</span></div><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Owner console</div></div></div>
      <div className="px-3"><div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Điều hướng</div><nav className="space-y-1">{nav.map(({ href, label: navLabel, icon: Icon }) => <button key={href} onClick={() => go(href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${route === href || (href !== '#/' && route.startsWith(`${href}/`)) ? 'bg-zinc-800/80 font-medium text-zinc-100' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'}`}><Icon className="size-4" /><span className="flex-1">{navLabel}</span>{href === '#/supervisor' && inboxCount > 0 && <span className="rounded-md bg-zinc-800 px-1.5 text-[10px] text-zinc-300">{inboxCount}</span>}</button>)}</nav></div>
      <div className="mt-auto p-4"><div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300"><span className="size-1.5 rounded-full bg-emerald-500" /> Kết nối cục bộ</div><p className="text-[11px] leading-5 text-zinc-600">Đọc ledger và CLI trên máy này. Không gửi lệnh thực thi.</p></div></div>
    </aside>
    <div className="lg:pl-56">
      <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-zinc-800/70 bg-[#09090b]/90 px-4 backdrop-blur md:px-8">
        <div className="flex items-center gap-3"><span className="hidden text-xs text-zinc-600 md:inline">StarCi Status</span><ChevronRight className="hidden size-3 text-zinc-700 md:inline" /><span className="text-sm font-medium">{current}</span></div>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-zinc-600 sm:inline">Cập nhật: {time(updatedAt)}</span><Button variant="outline" size="sm" onClick={() => { void fetchSnapshot(); void fetchAgents(); }} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Làm mới</span></Button><Button variant="outline" size="sm" aria-label={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}<span className="hidden sm:inline">{theme === 'dark' ? 'Sáng' : 'Tối'}</span></Button><Button variant="outline" size="sm" aria-label={language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'} title={language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'} onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}><Languages className="size-4" /><span>{language === 'vi' ? 'EN' : 'VI'}</span></Button><span className="hidden rounded-md border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500 md:inline">Chỉ đọc</span></div>
      </header>
      <div className="overflow-x-auto border-b border-zinc-800/70 px-4 lg:hidden"><nav className="flex min-w-max gap-1 py-2">{nav.map((item) => <Button key={item.href} variant={route === item.href ? 'secondary' : 'ghost'} size="sm" onClick={() => go(item.href)}>{item.label}</Button>)}</nav></div>
      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-8 md:px-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"><span className="size-1.5 rounded-full bg-emerald-500" /> Bảng điều khiển cục bộ</div><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{current}</h1><p className="mt-2 text-sm text-zinc-500">{agentRoute ? 'Agent, model và tài nguyên đang sử dụng trên máy này.' : route === '#/changes' ? 'Thay đổi code và ảnh trong các op đang chạy.' : 'Một góc nhìn về tiến độ, kết quả và những việc cần xử lý.'}</p></div><div className="hidden items-center gap-2 text-xs text-zinc-600 md:flex"><Clock3 className="size-3.5" /> Làm mới mỗi {agentRoute ? '10' : '30'} giây</div></div>
        {!liveRoute && error && <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"><CircleAlert className="size-4" /> Không tải được snapshot: {error}. {data && 'Đang giữ bản gần nhất.'}</div>}
        {liveRoute && agentError && <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300"><CircleAlert className="size-4" /> Không tải được số liệu agent: {agentError}. {agents && 'Đang giữ bản gần nhất.'}</div>}
        {!liveRoute && data && Object.values(data.sources).some(Boolean) && <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300"><span className="flex items-center gap-2"><CircleAlert className="size-4" /> Có {Object.values(data.sources).filter(Boolean).length} nguồn dữ liệu chưa đọc được.</span><Button variant="ghost" size="sm" onClick={() => go('#/supervisor')}>Xem lỗi nguồn <ArrowRight /></Button></div>}
        {route === '#/agents' ? <AgentsPage data={agents} /> : route === '#/changes' ? <CodeDiffPage data={agents} /> : !data ? <div className="flex h-72 items-center justify-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" /> Đang đọc các ledger...</div> : route === '#/' || route === '' ? <Overview data={data} agents={agents} /> : route === '#/projects' ? <ProjectsPage data={data} agents={agents} /> : route.startsWith('#/projects/') ? <ProjectsPage data={data} agents={agents} projectId={decodeURIComponent(route.split('/')[2] || '')} /> : route === '#/workflows' ? <WorkflowsPage data={data} agents={agents} /> : route.startsWith('#/workflows/') ? <WorkflowDetail data={data} agents={agents} id={decodeURIComponent(route.split('/')[2] || '')} /> : route === '#/verdicts' ? <VerdictsPage data={data} /> : route === '#/owner' ? <OwnerPage data={data} /> : route === '#/supervisor' ? <SupervisorPage data={data} /> : <Overview data={data} agents={agents} />}
      </main>
      <footer className="mx-auto flex max-w-[1600px] items-center justify-between border-t border-zinc-800/70 px-4 py-5 text-[11px] text-zinc-600 md:px-8"><span>StarCi Status · Dữ liệu cục bộ</span><span>Snapshot {time(updatedAt)}</span></footer>
    </div>
  </div>;
}
