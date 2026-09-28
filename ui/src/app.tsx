import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeft, ArrowRight, Bell,
  ChevronRight, CircleAlert, CircleDashed, Clock3, Database, ExternalLink,
  GitBranch, ListFilter, LoaderCircle, RefreshCw,
  Search, Workflow as WorkflowIcon, XCircle,
  Languages, Moon, Sun, Server, ScrollText,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AgentSnapshot, DrawReview, ProjectRow, Snapshot, Verdict, VerdictEntry, WorkflowRow } from './types';
import { AgentBadges, AgentsPage } from './agents';
import { CodeDiffPage } from './changes';
import { ProofBody } from './proofs';
import { ArtifactText, artifactUrl } from './artifacts';
import type { Artifacts, DrawReviewImage } from './contract';
import { WorkflowTracker } from './workflow-tracker';
import { applyOpNames } from './workflow-tracker-model';
import { SupervisorPage } from './supervisor-page';
import { applyPreferences, initialLanguage, initialTheme, observeLanguage, type Language, type Theme, registerTranslations } from './preferences';
import { HomePage, LogPage, SystemPage, WorkflowListPage, WorkflowPage, usePoll, type NavView } from './reconciler';

// Owner 2026-09-28 ("giờ loạn thông tin quá"): four pages, plus Cần thầy only while something waits on the owner.
// The older pages (projects, agents, diff, verdicts, supervisor) stay reachable from Hệ thống, off the navigation.
const baseNav = [
  { href: '#/', label: 'Tình hình', icon: Activity },
  { href: '#/workflows', label: 'Workflow', icon: WorkflowIcon },
  { href: '#/system', label: 'Hệ thống', icon: Server },
  { href: '#/log', label: 'Nhật ký', icon: ScrollText },
];
const ownerNav = { href: '#/owner', label: 'Cần thầy', icon: Bell };
const legacyTitle: Record<string, string> = { '#/projects': 'Dự án', '#/agents': 'Máy và agent', '#/changes': 'Diff và bằng chứng', '#/verdicts': 'Lịch sử verdict', '#/supervisor': 'Supervisor' };
const time = (value: number | string | null | undefined) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }).format(date);
};
const opLabel: Record<string, string> = {
  'request.analyze': 'Phân tích yêu cầu', 'scope.define': 'Xác định phạm vi', 'business.decide': 'Chốt nghiệp vụ',
  'architecture.decide': 'Thiết kế kiến trúc', 'brand.decide': 'Chốt thương hiệu', 'interface.draw': 'Vẽ giao diện',
  'interface.implement': 'Code giao diện', 'interface.audit': 'Soát giao diện', 'backend.implement': 'Code backend',
  'integration.verify': 'Kiểm thử tích hợp', 'e2e.verify': 'Kiểm thử đầu cuối', 'uat.verify': 'Nghiệm thu',
  'review.verify': 'Review cuối', 'handover.review': 'Bàn giao', 'work.author': 'Chia việc chi tiết',
  'provision.ask': 'Xin thông tin', 'code.refactor': 'Chỉnh sửa mã nguồn',
};
// The shared op labels (modules/ops/labels.yaml) arrive with the snapshot and replace the built-in fallback.
const label = (op: string) => opLabel[op] || op || 'Chưa rõ bước';
function applyOpLabels(labels: Record<string, { vi: string; en: string }> | undefined) {
  if (!labels) return;
  applyOpNames(labels);
  for (const [op, entry] of Object.entries(labels)) if (entry?.vi) opLabel[op] = entry.vi;
  registerTranslations(Object.fromEntries(Object.values(labels).filter((entry) => entry?.vi && entry?.en).map((entry) => [entry.vi, entry.en])));
}
// The workflow's display name (`<Product> · <what it does>`); a slug-only name still reads with spaces.
const title = (wf: WorkflowRow) => (wf.name && /\s/.test(wf.name) ? wf.name : wf.name?.replaceAll('-', ' ')) || wf.id;
/** A job's human name (`<op label> · <what> · <workflow name>`), else the op label. */
const jobTitle = (entry: { op: string; displayName?: string }) => entry.displayName || label(entry.op);
const incidentKind = (text: string) => /^\[([^\]]+)]/.exec(text)?.[1] || '';
const blockingIncidents = (wf: WorkflowRow) => wf.incidents.filter((item) => !['plan', 'plan-note', 'spec-consistency-followup'].includes(incidentKind(item.text)));
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
  if (wf.frontier?.state === 'orphaned-frontier') return <Badge variant="destructive">Lỗi runtime</Badge>;
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
        <TableCell><button className="text-left font-medium text-zinc-100 hover:underline" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>{title(wf)}</button><div className="mt-0.5 font-mono text-[11px] text-zinc-600">{wf.id}</div><div className="mt-1 max-w-[350px] truncate text-xs text-zinc-500">{wf.goal}</div></TableCell>
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

/** One op's proofs on its own page: #/proofs/<project>/<workflow>/<op>, for a link to a workflow the board no longer lists. */
function ProofPage({ parts }: { parts: string[] }) {
  const [projectId, workflowId, op] = parts;
  const target = useMemo(() => ({ title: `${op} · ${label(op || '')}`, op: op || null, jobIds: null, units: [] }), [op]);
  return <div className="space-y-4"><Button variant="ghost" size="sm" onClick={() => go('#/workflows')}><ArrowLeft /> Luồng việc</Button>
    <Card className="min-w-0 border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle>Bằng chứng · {op}</CardTitle><CardDescription className="break-all font-mono text-xs">{projectId} / {workflowId}</CardDescription></CardHeader><CardContent>{projectId && workflowId && op ? <ProofBody projectId={projectId} workflowId={workflowId} target={target} labelOf={label} /> : <p className="text-sm text-zinc-500">Đường dẫn thiếu dự án, workflow hoặc op.</p>}</CardContent></Card></div>;
}

function WorkflowDetail({ data, agents, id, snapshotError }: { data: Snapshot; agents: AgentSnapshot | null; id: string; snapshotError?: string | null }) {
  return <WorkflowTracker data={data as unknown as import('./contract').Snapshot} agents={agents as unknown as import('./contract').AgentSnapshot | null} id={id} snapshotError={snapshotError} />;
}

function VerdictTable({ entries }: { entries: { wf: WorkflowRow; entry: VerdictEntry }[] }) {
  return <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/80"><Table><TableHeader><TableRow className="border-zinc-800 hover:bg-transparent"><TableHead>Thời điểm</TableHead><TableHead>Workflow</TableHead><TableHead>Op</TableHead><TableHead>Lần</TableHead><TableHead>Check đạt / trượt</TableHead><TableHead>Verdict</TableHead></TableRow></TableHeader><TableBody>{entries.length ? entries.map(({ wf, entry }) => <TableRow key={`${entry.jobId}-${entry.at}`} className="border-zinc-800/70"><TableCell className="whitespace-nowrap text-xs text-zinc-500">{time(entry.at)}</TableCell><TableCell><button className="text-left text-sm hover:underline" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>{title(wf)}</button></TableCell><TableCell className="text-sm text-zinc-400">{jobTitle(entry)}<div className="font-mono text-[10px] text-zinc-600">{entry.jobId}</div></TableCell><TableCell className="text-xs text-zinc-500">#{entry.attempt ?? '—'}</TableCell><TableCell className="text-xs text-zinc-400">{entry.checks?.passed ?? '—'} / {entry.checks?.failed ?? '—'}</TableCell><TableCell><VerdictBadge verdict={entry.verdict} /></TableCell></TableRow>) : <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-zinc-500">Chưa có verdict.</TableCell></TableRow>}</TableBody></Table></div>;
}
function VerdictsPage({ data }: { data: Snapshot }) {
  const [filter, setFilter] = useState<'all' | Verdict>('all');
  const entries = data.projects.flatMap((p) => p.workflows.flatMap((wf) => wf.recentVerdicts.map((entry) => ({ wf, entry })))).sort((a, b) => b.entry.at - a.entry.at).filter(({ entry }) => filter === 'all' || entry.verdict === filter).slice(0, 120);
  return <div className="space-y-6"><SectionHeading eyebrow="Bằng chứng thực thi" title="Lịch sử verdict" note="Xem những lần chạy mới nhất, kể cả retry và lần bị chặn." /><div className="flex flex-wrap gap-2">{(['all', 'pass', 'fail', 'blocked'] as const).map((item) => <Button key={item} variant={filter === item ? 'secondary' : 'outline'} size="sm" onClick={() => setFilter(item)}>{item === 'all' ? 'Tất cả' : verdictLabel[item]}</Button>)}</div><VerdictTable entries={entries} /><p className="text-xs text-zinc-600">Tối đa 12 verdict gần nhất mỗi workflow, 120 dòng trên màn hình. Tổng lịch sử được cộng riêng ở dashboard dự án.</p></div>;
}

const reviewState: Record<string, { text: string; tone: string }> = {
  'awaiting-owner': { text: 'Chờ thầy duyệt', tone: 'border-amber-500/25 text-amber-400' },
  'redraw-owed': { text: 'Đang vẽ lại theo ghi chú', tone: 'border-sky-500/25 text-sky-400' },
  accepted: { text: 'Đã duyệt', tone: 'border-emerald-500/25 text-emerald-400' },
  idle: { text: 'Chưa có vòng duyệt', tone: 'border-zinc-700 text-zinc-400' },
};
const goldenText: Record<string, string> = { golden: 'Hình chuẩn (golden)', accepted: 'Đã duyệt', none: 'Chưa có hình chuẩn' };

function ReviewImages({ images, shape }: { images: DrawReviewImage[]; shape: string }) {
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (selected === null) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelected(null);
      if (event.key === 'ArrowLeft') setSelected((n) => n === null ? null : (n + images.length - 1) % images.length);
      if (event.key === 'ArrowRight') setSelected((n) => n === null ? null : (n + 1) % images.length);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [selected, images.length]);
  return <><div className="grid grid-cols-2 gap-2">{images.map((image, index) => <button type="button" key={image.path} onClick={() => image.imageId && setSelected(index)} title={image.path} className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/40 text-left hover:border-sky-500/50">{image.imageId ? <img src={`/api/evidence/${image.imageId}`} alt={`${shape} ${image.breakpoint ?? ''}`} loading="lazy" className="aspect-video w-full object-contain" /> : <div className="p-4 text-xs text-zinc-500">{image.path}</div>}<span className="block px-2 py-1 text-xs text-zinc-500">{image.breakpoint === 'mobile' ? 'Điện thoại' : image.breakpoint === 'desktop' ? 'Máy tính' : image.path}</span></button>)}</div>
    {selected !== null && images[selected]?.imageId && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={`Ảnh ${shape}`} onClick={() => setSelected(null)}><button autoFocus type="button" onClick={() => setSelected(null)} aria-label="Đóng" className="absolute right-4 top-4 rounded bg-zinc-800 p-2 text-white">✕</button><button type="button" onClick={(event) => { event.stopPropagation(); setSelected((selected + images.length - 1) % images.length); }} aria-label="Ảnh trước" className="absolute left-3 rounded bg-zinc-800 p-2 text-white">‹</button><img onClick={(event) => event.stopPropagation()} src={`/api/evidence/${images[selected].imageId}`} alt={`${shape} ${images[selected].breakpoint ?? ''}`} className="max-h-[85vh] max-w-[85vw] object-contain" /><button type="button" onClick={(event) => { event.stopPropagation(); setSelected((selected + 1) % images.length); }} aria-label="Ảnh sau" className="absolute right-3 rounded bg-zinc-800 p-2 text-white">›</button></div>}</>;
}

function ReviewFiles({ projectId, workflowId, review }: { projectId: string; workflowId: string; review: DrawReview }) {
  const [data, setData] = useState<Artifacts | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/artifacts?${new URLSearchParams({ project: projectId, workflow: workflowId })}`, { signal: controller.signal }).then((response) => response.json()).then(setData).catch(() => {});
    return () => controller.abort();
  }, [projectId, workflowId]);
  const tokens = [review.record.split('.').pop() || '', ...review.shapes.map((shape) => shape.shape.split('#')[0])].map((token) => token.toLowerCase());
  const files = (data?.jobs || []).flatMap((job) => job.artifacts.filter((artifact) => /(?:rationale\.json|redline)/i.test(artifact.path) && tokens.some((token) => token && artifact.path.toLowerCase().includes(token))).map((artifact) => ({ artifact, jobId: job.jobId })));
  if (!files.length) return null;
  return <details className="rounded-lg border border-zinc-800 p-3"><summary className="cursor-pointer text-xs text-zinc-300">Lý do bản vẽ và redline · {files.length} tệp</summary><div className="mt-3 space-y-2">{files.map(({ artifact, jobId }) => artifact.kind === 'image' ? <a key={artifact.path} href={artifactUrl(projectId, jobId, artifact)} target="_blank" rel="noreferrer" className="block overflow-hidden rounded border border-zinc-800"><img src={artifactUrl(projectId, jobId, artifact)} alt={`Redline ${artifact.label || artifact.path}`} loading="lazy" className="max-h-72 w-full object-contain" /><span className="block px-2 py-1 text-xs text-zinc-500">{artifact.label || artifact.path}</span></a> : <ArtifactText key={artifact.path} projectId={projectId} jobId={jobId} artifact={artifact} />)}</div></details>;
}

/** "Cần thầy duyệt hình": each drawn shape with its images, the owner's open notes and the round history. */
function DrawReviewList({ items }: { items: { wf: WorkflowRow; review: DrawReview }[] }) {
  if (!items.length) return <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có hình nào đang chờ thầy duyệt.</div>;
  return <div className="grid gap-3">{items.map(({ wf, review }) => {
    const state = reviewState[review.state] ?? reviewState.idle;
    return <Card key={`${wf.id}-${review.record}`} className="border border-zinc-800 bg-zinc-950/80 shadow-none">
      <CardHeader><CardTitle className="text-sm">{review.record}</CardTitle><CardDescription>{title(wf)} · vòng {review.rounds.length || 1}</CardDescription><CardAction><Badge variant="outline" className={state.tone}>{state.text}</Badge></CardAction></CardHeader>
      <CardContent className="space-y-4">
        {review.shapes.map((shape) => <div key={shape.shape} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-zinc-200">{shape.shape}</span><Badge variant="secondary">{goldenText[shape.golden] ?? shape.golden}</Badge>{shape.openNotes.length > 0 && <span className="text-xs text-zinc-500">{shape.addressed}/{shape.openNotes.length} ghi chú đã xử lý</span>}</div>
          <ReviewImages images={shape.images} shape={shape.shape} />
          {shape.openNotes.map((n) => <div key={n.id} className="rounded-lg border border-zinc-800 p-2 text-sm"><div className="flex items-center gap-2 text-xs"><code className="text-zinc-500">{n.id}</code><span className="text-zinc-500">vòng {n.round ?? '—'}</span>{n.class && <Badge variant="outline">{n.class}</Badge>}<Badge variant="outline" className={n.addressed ? 'border-emerald-500/25 text-emerald-400' : 'border-red-500/25 text-red-400'}>{n.addressed ? 'Đã xử lý' : 'Chưa xử lý'}</Badge></div><p className="mt-1 text-zinc-300">{n.text}</p>{!n.addressed && n.reasons?.length ? <p className="mt-1 text-xs text-zinc-500">{n.reasons.join(' · ')}</p> : null}</div>)}
        </div>)}
        {review.rounds.length > 0 && <div><div className="mb-1 text-xs uppercase tracking-wide text-zinc-500">Lịch sử các vòng</div><ol className="space-y-1 text-xs text-zinc-400">{review.rounds.map((round) => <li key={round.dispatchId}>Vòng {round.round}: {round.state === 'open' ? 'đang chờ thầy' : round.decision === 'accept' ? `thầy duyệt${round.golden ? ' (golden)' : ''}` : round.decision === 'redraw' ? `thầy yêu cầu vẽ lại (${round.notes.length} ghi chú)` : round.state}{round.answeredAt ? ` · ${time(round.answeredAt)}` : ''}{round.notes.length ? <ul className="ml-4 list-disc text-zinc-500">{round.notes.map((n) => <li key={n.id}>{n.text}</li>)}</ul> : null}</li>)}</ol></div>}
        <ReviewFiles projectId={wf.projectId} workflowId={wf.id} review={review} />
      </CardContent></Card>;
  })}</div>;
}

function OwnerPage({ data }: { data: Snapshot }) {
  const all = data.projects.flatMap((p) => p.workflows);
  const asks = all.flatMap((wf) => wf.asks.map((ask) => ({ wf, ask })));
  const approvals = asks.filter((item) => item.ask.askClass !== 'credential');
  const credentials = asks.filter((item) => item.ask.askClass === 'credential');
  const gates = all.flatMap((wf) => wf.incidents.filter((incident) => /^\[owner-gate/.test(incident.text)).map((incident) => ({ wf, incident })));
  const planRevisions = gates.filter(({ incident }) => /\b(?:goal|plan) revision\b|bản chỉnh kế hoạch|sửa kế hoạch/i.test(incident.text));
  const otherGates = gates.filter((item) => !planRevisions.includes(item));
  const drawReviews = all.flatMap((wf) => (wf.drawReviews ?? []).filter((review) => review.state !== 'idle' && (review.state !== 'accepted' || review.shapes.some((s) => s.golden === 'golden'))).map((review) => ({ wf, review })));
  return <div className="space-y-8"><SectionHeading eyebrow="Hàng chờ quyết định" title="Cần thầy làm" note="Các mục được tách theo loại. App chỉ hiển thị, không gửi câu trả lời vào luồng việc." />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric icon={Bell} label="Câu hỏi chờ duyệt" value={approvals.length} note="có câu hỏi cụ thể" tone="amber" /><Metric icon={Database} label="Yêu cầu credential" value={credentials.length} note="xử lý qua kênh riêng" /><Metric icon={GitBranch} label="Bản chỉnh kế hoạch" value={planRevisions.length} note="chờ xác nhận phạm vi" tone="amber" /><Metric icon={CircleDashed} label="Owner gate khác" value={otherGates.length} note="incident chờ quyết định đang mở" /></div>
    <section><SectionHeading eyebrow="Quyết định" title="Câu hỏi đang chờ" /><div className="grid gap-3">{approvals.length ? approvals.map(({ wf, ask }, index) => <Card key={`${wf.id}-${index}`} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardHeader><CardTitle className="text-sm">{title(wf)}</CardTitle><CardDescription>{label(ask.op)}</CardDescription><CardAction><Badge variant="outline" className="border-amber-500/25 text-amber-400">Chờ thầy</Badge></CardAction></CardHeader><CardContent><p className="text-sm leading-6 text-zinc-200">{ask.text}</p><div className="mt-4 flex gap-2"><Button variant="outline" size="sm" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>Xem workflow <ArrowRight /></Button>{ask.link && <Button size="sm" asChild><a href={ask.link} target="_blank" rel="noreferrer">Mở mẫu trả lời <ExternalLink /></a></Button>}</div></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Hiện không có câu hỏi cần thầy trả lời.</div>}</div></section>
    <section><SectionHeading eyebrow="Hình vẽ" title="Cần thầy duyệt hình" note="Mỗi hình dạng một phiên bản. Thầy trả lời trên Telegram: ok/duyệt để chấp nhận, nội dung khác là ghi chú để vẽ lại." /><DrawReviewList items={drawReviews} /></section>
    <section><SectionHeading eyebrow="Thông tin nhạy cảm" title="Credential" note="Không hiển thị hoặc nhận giá trị credential tại trang này." /><div className="grid gap-3">{credentials.length ? credentials.map(({ wf, ask }, index) => <Card key={`${wf.id}-${index}`} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent><div className="mb-2 flex items-center gap-2"><Database className="size-4 text-zinc-500" /><span className="font-medium">{title(wf)}</span></div><p className="text-sm text-zinc-400">{ask.text}</p></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có yêu cầu credential.</div>}</div></section>
    <section><SectionHeading eyebrow="Phạm vi" title="Bản chỉnh kế hoạch" note="Nhận diện từ owner-gate ghi rõ goal hoặc plan revision." /><div className="grid gap-3">{planRevisions.length ? planRevisions.map(({ wf, incident }) => <Card key={incident.id} className="border border-zinc-800 bg-zinc-950/80 shadow-none"><CardContent><div className="mb-2 flex items-center justify-between"><span className="font-medium">{title(wf)}</span><Badge variant="outline" className="border-amber-500/25 text-amber-400">Chờ thầy</Badge></div><p className="text-sm leading-6 text-zinc-400">{incident.text}</p><Button className="mt-4" variant="outline" size="sm" onClick={() => go(`#/workflows/${encodeURIComponent(wf.id)}`)}>Xem luồng việc <ArrowRight /></Button></CardContent></Card>) : <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-sm text-zinc-500">Không có bản chỉnh kế hoạch đang chờ.</div>}</div></section>
    {otherGates.length > 0 && <section><SectionHeading eyebrow="Cần rà soát" title="Owner gate khác" /><div className="grid gap-3">{otherGates.map(({ wf, incident }) => <div key={incident.id} className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"><div className="mb-2 text-sm font-medium">{title(wf)}</div><p className="text-sm text-zinc-400">{incident.text}</p></div>)}</div></section>}
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
      applyOpLabels(body.opLabels); setData(body); setError(null);
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
  // Each new page reads its own endpoint (ui/src/reconciler.tsx); the legacy snapshot and the agent sample are read
  // only on the routes that still use them.
  const newRoute = route === '#/' || route === '' || route === '#/workflows' || route.startsWith('#/workflows/') || route === '#/system' || route === '#/log';
  const needsAgents = ['#/agents', '#/changes', '#/supervisor'].includes(route);
  useEffect(() => { if (newRoute) return; void fetchSnapshot(); const timer = window.setInterval(() => void fetchSnapshot(), 30_000); return () => window.clearInterval(timer); }, [fetchSnapshot, newRoute]);
  useEffect(() => { if (!needsAgents) return; void fetchAgents(); const timer = window.setInterval(() => void fetchAgents(), 10_000); return () => window.clearInterval(timer); }, [fetchAgents, needsAgents]);
  const { data: navData } = usePoll<NavView>('/api/nav', 20_000);
  const nav = navData?.owner || route === '#/owner' ? [...baseNav, ownerNav] : baseNav;
  const current = useMemo(() => {
    if (route.startsWith('#/projects/')) return 'Dự án';
    if (route.startsWith('#/workflows/')) return 'Chi tiết workflow';
    if (route.startsWith('#/proofs/')) return 'Bằng chứng';
    return [...baseNav, ownerNav].find((item) => item.href === route)?.label || legacyTitle[route] || 'Tình hình';
  }, [route]);
  const agentRoute = route === '#/agents';
  const liveRoute = agentRoute || route === '#/changes';
  const updatedAt = newRoute ? navData?.updatedAt : liveRoute ? agents?.updatedAt : data?.updatedAt;
  const detailRoute = route.startsWith('#/workflows/');
  const subtitle: Record<string, string> = { '#/': 'Công việc có đang tiến không, cái gì kẹt, cái gì cần thầy.', '#/workflows': 'Các luồng việc đang chạy.', '#/system': 'Reconciler, dịch vụ, SLA, dọn rác, tài nguyên và quyết định của Supervisor.', '#/log': 'Dòng thời gian nhật ký có kiểu, lọc được.' };
  return <div id="status-app" className="min-h-screen bg-background text-foreground">
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-20 items-center gap-3 px-5"><div className="flex size-8 items-center justify-center rounded-lg bg-zinc-100 text-zinc-950"><GitBranch className="size-5" /></div><div><div className="text-sm font-bold tracking-tight">StarCi<span className="text-zinc-500"> / status</span></div><div className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">Owner console</div></div></div>
      <div className="px-3"><div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">Điều hướng</div><nav className="space-y-1">{nav.map(({ href, label: navLabel, icon: Icon }) => <button key={href} onClick={() => go(href)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${route === href || (href !== '#/' && route.startsWith(`${href}/`)) ? 'bg-zinc-800/80 font-medium text-zinc-100' : 'text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200'}`}><Icon className="size-4" /><span className="flex-1">{navLabel}</span>{href === '#/owner' && (navData?.owner ?? 0) > 0 && <span className="rounded-md bg-amber-500/20 px-1.5 text-[10px] text-amber-300">{navData?.owner}</span>}{href === '#/workflows' && (navData?.stuck ?? 0) > 0 && <span className="rounded-md bg-red-500/20 px-1.5 text-[10px] text-red-300">{navData?.stuck} kẹt</span>}</button>)}</nav></div>
      <div className="mt-auto p-4"><div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3"><div className="mb-2 flex items-center gap-2 text-xs font-medium text-zinc-300"><span className="size-1.5 rounded-full bg-emerald-500" /> Kết nối cục bộ</div><p className="text-[11px] leading-5 text-zinc-600">Đọc ledger và CLI trên máy này. Không gửi lệnh thực thi.</p></div></div>
    </aside>
    <div className="lg:pl-56">
      <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
        <div className="hidden items-center gap-3 min-[280px]:flex"><span className="hidden text-xs text-zinc-600 md:inline">StarCi Status</span><ChevronRight className="hidden size-3 text-zinc-700 md:inline" /><span className="text-sm font-medium">{current}</span></div>
        <div className="flex items-center gap-2"><span className="hidden text-xs text-zinc-600 sm:inline">Cập nhật: {time(updatedAt)}</span><Button variant="outline" size="sm" onClick={() => { if (newRoute) window.location.reload(); else { void fetchSnapshot(); if (needsAgents) void fetchAgents(); } }} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''} /> <span className="hidden sm:inline">Làm mới</span></Button><Button variant="outline" size="sm" aria-label={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}<span className="hidden sm:inline">{theme === 'dark' ? 'Sáng' : 'Tối'}</span></Button><Button variant="outline" size="sm" aria-label={language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'} title={language === 'vi' ? 'Switch to English' : 'Chuyển sang tiếng Việt'} onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}><Languages className="size-4" /><span>{language === 'vi' ? 'EN' : 'VI'}</span></Button><span className="hidden rounded-md border border-zinc-800 px-2 py-1 text-[10px] uppercase tracking-wide text-zinc-500 md:inline">Chỉ đọc</span></div>
      </header>
      <div className="overflow-x-auto border-b border-zinc-800/70 px-4 lg:hidden"><nav className="flex min-w-max gap-1 py-2">{nav.map((item) => <Button key={item.href} variant={route === item.href || (item.href !== '#/' && route.startsWith(`${item.href}/`)) ? 'secondary' : 'ghost'} size="sm" onClick={() => go(item.href)}>{item.label}{item.href === '#/owner' && navData?.owner ? ` · ${navData.owner}` : ''}</Button>)}</nav></div>
      <main className={`mx-auto max-w-[1600px] px-4 pb-16 md:px-8 ${detailRoute ? 'pt-5' : 'pt-8'}`}>
        {!detailRoute && <div className="mb-7 flex flex-wrap items-end justify-between gap-3"><div><div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500"><span className="size-1.5 rounded-full bg-emerald-500" /> Bảng điều khiển cục bộ</div><h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{current}</h1><p className="mt-2 text-sm text-zinc-500">{subtitle[route || '#/'] ?? (agentRoute ? 'Agent, model và tài nguyên đang sử dụng trên máy này.' : route === '#/changes' ? 'Code diff, ảnh AI, ảnh chụp và video UAT.' : 'Trang chi tiết, mở từ Hệ thống.')}</p></div><div className="hidden items-center gap-2 text-xs text-zinc-600 md:flex"><Clock3 className="size-3.5" /> Làm mới mỗi {agentRoute ? '10' : newRoute ? '20' : '30'} giây</div></div>}
        {!newRoute && !liveRoute && !detailRoute && error && <div className="mb-5 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"><CircleAlert className="size-4" /> Không tải được snapshot: {error}. {data && 'Đang giữ bản gần nhất.'}</div>}
        {liveRoute && agentError && <div className="mb-5 flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300"><CircleAlert className="size-4" /> Không tải được số liệu agent: {agentError}. {agents && 'Đang giữ bản gần nhất.'}</div>}
        {!newRoute && !liveRoute && !detailRoute && data && Object.values(data.sources).some(Boolean) && <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-300"><span className="flex items-center gap-2"><CircleAlert className="size-4" /> Có {Object.values(data.sources).filter(Boolean).length} nguồn dữ liệu chưa đọc được.</span><Button variant="ghost" size="sm" onClick={() => go('#/system')}>Xem lỗi nguồn <ArrowRight /></Button></div>}
        {route === '#/' || route === '' ? <HomePage /> : route === '#/workflows' ? <WorkflowListPage /> : route.startsWith('#/workflows/') ? <WorkflowPage id={decodeURIComponent(route.split('/')[2] || '')} /> : route === '#/system' ? <SystemPage /> : route === '#/log' ? <LogPage /> : route === '#/agents' ? <AgentsPage data={agents} /> : route === '#/changes' ? <CodeDiffPage data={agents} /> : !data ? <div className="flex h-72 items-center justify-center gap-2 text-sm text-zinc-500"><LoaderCircle className="size-4 animate-spin" /> Đang đọc trạng thái...</div> : route === '#/' || route === '' ? <HomePage /> : route === '#/projects' ? <ProjectsPage data={data} agents={agents} /> : route.startsWith('#/projects/') ? <ProjectsPage data={data} agents={agents} projectId={decodeURIComponent(route.split('/')[2] || '')} /> : route === '#/workflows' ? <WorkflowsPage data={data} agents={agents} /> : route.startsWith('#/workflows/') ? <WorkflowDetail data={data} agents={agents} id={decodeURIComponent(route.split('/')[2] || '')} snapshotError={error} /> : route.startsWith('#/proofs/') ? <ProofPage parts={route.split('/').slice(2).map((part) => decodeURIComponent(part))} /> : route === '#/verdicts' ? <VerdictsPage data={data} /> : route === '#/owner' ? <OwnerPage data={data} /> : route === '#/supervisor' ? <SupervisorPage data={data} agents={agents} /> : <HomePage />}
      </main>
      <footer className="mx-auto flex max-w-[1600px] items-center justify-between border-t border-zinc-800/70 px-4 py-5 text-[11px] text-zinc-600 md:px-8"><span>StarCi Status · Dữ liệu cục bộ</span><span>Snapshot {time(updatedAt)}</span></footer>
    </div>
  </div>;
}
