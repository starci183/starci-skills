import { ArrowLeft, ArrowRight, FileCode2, ShieldCheck } from 'lucide-react';
import { useApiQuery } from '../../api/query';
import type { AttemptDetail, CheckRow, LogRow } from '../../contract';
import { formatAbsolute, stepLabels } from '../../i18n/vi';
import { useRoute, type AttemptStep } from '../../router';
import { StateChip } from '../../components/state-chip';
import { StepBar, type StepItem } from '../../components/step-bar';
import { ConceptBlock, type Concept } from '../../components/concept';
import { TranscriptViewer } from '../../components/attempt/transcript';
import { DiffView, MediaGrid, type JobDiff } from '../../components/attempt/evidence';

export const concept: Concept = 'C7';
const order: AttemptStep[] = ['dispatch', 'run', 'report', 'checks', 'verdict', 'land'];
const baseOf = (project: string, id: string) => `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
const hrefOf = (project: string, id: string, step: AttemptStep) => `#/a/${encodeURIComponent(project)}/${encodeURIComponent(id)}?step=${step}`;

function labelOutcome(value: string | null) { return value ?? 'chưa báo cáo'; }
function labelVerdict(value: string | null) { return value ?? 'chưa chốt'; }
function initialStep(attempt: AttemptDetail): AttemptStep {
  if (attempt.checksRed > 0) return 'checks';
  if (attempt.verdict === null) return 'run';
  if (/(^|\.)((interface\.draw)|(uat\.verify))$/.test(attempt.op)) return 'report';
  return 'verdict';
}
function stepItems(attempt: AttemptDetail): StepItem[] {
  const at = (step: string) => attempt.timeline.find(item => item.step === step)?.at ?? null;
  return [
    { key: 'dispatch', state: attempt.dispatchedAt ? 'done' : 'waiting', at: attempt.dispatchedAt },
    { key: 'run', state: !attempt.reportedAt ? 'running' : attempt.endState === 'worker-dead' ? 'bad' : 'done', at: at('started') },
    { key: 'report', state: attempt.reportOutcome === 'failed' ? 'bad' : attempt.reportedAt ? 'done' : 'waiting', at: attempt.reportedAt },
    { key: 'checks', state: attempt.checksRed > 0 ? 'bad' : attempt.checks.length ? 'done' : 'waiting', at: at('checked'), detail: attempt.checks.length ? `${attempt.checks.length - attempt.checksRed}/${attempt.checks.length} đạt` : undefined },
    { key: 'verdict', state: attempt.verdict === 'fail' ? 'bad' : attempt.verdict === 'pass' ? 'done' : attempt.verdict ? 'warn' : 'waiting', at: attempt.settledAt },
    { key: 'land', state: attempt.land?.result === 'passed' ? 'done' : attempt.land?.result === 'failed' ? 'bad' : 'waiting', at: attempt.land?.at ?? null },
  ];
}
function Section({ title, children, concept: id }: { title: string; children: React.ReactNode; concept: Concept }) {
  return <ConceptBlock concept={id} as="section" className="min-w-0 rounded-xl border bg-card p-4 shadow-sm sm:p-5"><h2 className="mb-4 font-semibold">{title}</h2>{children}</ConceptBlock>;
}

function CheckItem({ project, attemptId, check }: { project: string; attemptId: string; check: CheckRow }) {
  const query = useApiQuery<CheckRow & { stdoutTail: string; stderrTail: string }>(`${baseOf(project, attemptId)}/checks/${check.id}`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 60_000 });
  const item = query.data ?? check;
  const stderrTail = query.data?.stderrTail ?? '';
  return <div className="min-w-0 border-t py-3 first:border-t-0 first:pt-0"><div className="flex flex-wrap items-center gap-2 text-sm"><StateChip state={item.status === 'unavailable' ? 'warn' : item.ui} compact /><strong className="min-w-0 break-words">{item.name}</strong><span className="text-xs text-muted-foreground">{item.runner}/{item.phase} · {item.authority} · {item.wallMs == null ? '—' : `${(item.wallMs / 1000).toFixed(1)}s`}</span></div>
    <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground"><span>Exit: {item.exitCode ?? '—'}</span>{item.declaredExitCode != null && item.declaredExitCode !== item.exitCode && <span>Op khai: {item.declaredExitCode}</span>}{item.command && <code className="break-all">{item.command}</code>}</div>
    {item.note && <p className="mt-2 text-xs text-muted-foreground">{item.note}</p>}
    {stderrTail && <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border bg-muted/30 p-3 font-mono text-xs">{stderrTail}</pre>}
    <div className="mt-2 flex flex-wrap gap-3 text-xs">{item.stdout && <a href={item.stdout.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">stdout</a>}{item.stderr && <a href={item.stderr.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">stderr</a>}{item.output && <a href={item.output.href} target="_blank" rel="noreferrer" className="text-primary hover:underline">output</a>}</div>
  </div>;
}

function RunSection({ project, attemptId, attempt }: { project: string; attemptId: string; attempt: AttemptDetail }) {
  const logs = useApiQuery<LogRow[]>(`/api/logs?project=${encodeURIComponent(project)}&job=${encodeURIComponent(attempt.job)}&limit=100`, { topics: [`attempt:${project}:${attemptId}`], intervalMs: 30_000 });
  return <Section title="Chạy · transcript" concept="C7"><TranscriptViewer project={project} attemptId={attemptId} live={attempt.verdict == null} />
    <details className="mt-5"><summary className="cursor-pointer text-sm font-medium">Nhật ký theo kiểu · {logs.data?.length ?? 0}</summary><div className="mt-2 divide-y">{logs.data?.map(item => <div key={item.key} className="py-2 text-xs"><span className="text-muted-foreground">{formatAbsolute(item.at)} · {item.level} · {item.actor}</span><p className="break-words">{item.msg}</p></div>)}</div></details>
  </Section>;
}

function ReportSection({ project, attemptId, attempt }: { project: string; attemptId: string; attempt: AttemptDetail }) {
  const diff = useApiQuery<JobDiff | null>(`${baseOf(project, attemptId)}/diff`, { intervalMs: 60_000 });
  return <div className="space-y-4"><Section title="Báo cáo của Op" concept="C8"><p className="whitespace-pre-wrap break-words text-sm">{attempt.summary ?? 'Op chưa gửi tóm tắt.'}</p><p className="mt-2 text-xs text-muted-foreground">Kết quả Op nói: {labelOutcome(attempt.reportOutcome)} · {attempt.artifacts.length} media</p></Section>
    <Section title="Diff" concept="C11"><DiffView diff={diff.data} /></Section>
    <Section title="Media và artifact" concept="C11"><MediaGrid items={[...attempt.artifacts, ...attempt.nonMedia]} /></Section>
  </div>;
}

function StepContent({ project, attemptId, attempt, step }: { project: string; attemptId: string; attempt: AttemptDetail; step: AttemptStep }) {
  if (step === 'dispatch') return <Section title="Giao" concept="C6"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Agent / model</dt><dd>{attempt.agent ?? 'Chưa rõ'} / {attempt.model ?? 'Chưa rõ'}</dd></div><div><dt className="text-xs text-muted-foreground">Nỗ lực</dt><dd>{attempt.effort ?? 'Chưa rõ'} · pool {attempt.pool ?? 'chưa rõ'}</dd></div><div><dt className="text-xs text-muted-foreground">Giao lúc</dt><dd>{formatAbsolute(attempt.dispatchedAt)}</dd></div><div><dt className="text-xs text-muted-foreground">Nhánh</dt><dd className="break-all">{attempt.where.branch ?? 'Chưa rõ'}</dd></div></dl></Section>;
  if (step === 'run') return <RunSection project={project} attemptId={attemptId} attempt={attempt} />;
  if (step === 'report') return <ReportSection project={project} attemptId={attemptId} attempt={attempt} />;
  if (step === 'checks') return <Section title={`Kiểm · ${attempt.checks.length - attempt.checksRed}/${attempt.checks.length} đạt`} concept="C9">{attempt.checks.length ? attempt.checks.map(check => <CheckItem key={check.id} project={project} attemptId={attemptId} check={check} />) : <p className="text-sm text-muted-foreground">Chưa có kết quả kiểm.</p>}</Section>;
  if (step === 'verdict') return <Section title="Chốt" concept="C10"><div className="flex flex-wrap items-center gap-3"><StateChip state={attempt.ui} /><span className="text-sm">Kernel chốt: <strong>{labelVerdict(attempt.verdict)}</strong></span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Người chốt</dt><dd>{attempt.settledBy ?? 'Chưa rõ'}</dd></div><div><dt className="text-xs text-muted-foreground">Lý do lỗi</dt><dd>{attempt.failureClass ?? 'Không ghi nhận'}</dd></div><div><dt className="text-xs text-muted-foreground">Bước kế tiếp</dt><dd>{attempt.settle?.nextStep ?? 'Chưa rõ'}</dd></div><div><dt className="text-xs text-muted-foreground">Chốt lúc</dt><dd>{formatAbsolute(attempt.settledAt)}</dd></div></dl>{attempt.retry.next && <a href={attempt.retry.next.href} className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">Mở lần thử kế tiếp <ArrowRight className="size-4" /></a>}</Section>;
  return <Section title="Land" concept="C11"><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Commit tích hợp</dt><dd className="break-all font-mono">{attempt.where.integratedSha ?? 'Chưa có'}</dd></div><div><dt className="text-xs text-muted-foreground">Kết quả product land</dt><dd>{attempt.land?.result ?? 'Chưa có'}</dd></div><div><dt className="text-xs text-muted-foreground">SHA sau land</dt><dd className="break-all font-mono">{attempt.land?.mergedSha ?? 'Chưa có'}</dd></div><div><dt className="text-xs text-muted-foreground">Thời điểm</dt><dd>{formatAbsolute(attempt.land?.at)}</dd></div></dl>{attempt.land?.reason && <p className="mt-3 text-sm text-muted-foreground">{attempt.land.reason}</p>}{attempt.land?.output && <a href={attempt.land.output.href} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm text-primary hover:underline">Mở đầu ra land</a>}</Section>;
}

function AttemptPage() {
  const route = useRoute();
  if (route.kind !== 'attempt') return null;
  return <AttemptDetailPage project={route.project} attemptId={route.attemptId} routeStep={route.step} />;
}

function AttemptDetailPage({ project, attemptId, routeStep }: { project: string; attemptId: string; routeStep: AttemptStep }) {
  const attempt = useApiQuery<AttemptDetail>(baseOf(project, attemptId), { topics: [`attempt:${project}:${attemptId}`], intervalMs: 20_000 });
  const data = attempt.data;
  if (attempt.error) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">← Tổng quan</a><p role="alert" className="mt-4 rounded-xl border p-5">{attempt.error}</p></div>;
  if (!data) return <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Đang đọc lần thử…</div>;
  const step = window.location.hash.includes('step=') ? routeStep : initialStep(data);
  const steps = stepItems(data);
  return <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-4 pb-24 sm:p-6 lg:p-8">
    <header className="space-y-3"><a href={`#/w/${encodeURIComponent(project)}/${encodeURIComponent(data.wf)}?tab=units`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> {project} / {data.wf}</a><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{data.op} · {data.unit ?? data.job}</p><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lần thử {data.attempt} · giao #{data.dispatchSeq}</h1></div><StateChip state={data.ui} /></div>
      <div className="flex flex-wrap items-center gap-2 text-sm"><span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><FileCode2 className="size-3.5" /> Op nói: <strong>{labelOutcome(data.reportOutcome)}</strong></span><span className="inline-flex items-center gap-1 rounded-full border px-2 py-1"><ShieldCheck className="size-3.5" /> Kernel chốt: <strong>{labelVerdict(data.verdict)}</strong></span><span className="text-xs text-muted-foreground">{data.agent ?? 'agent chưa rõ'} · {data.model ?? 'model chưa rõ'} · {data.effort ?? 'effort chưa rõ'}</span></div>
    </header>
    <div className="hidden md:block"><StepBar steps={steps} selected={step} onSelect={value => { window.location.hash = hrefOf(project, attemptId, value); }} /></div>
    <div className="hidden md:block"><StepContent project={project} attemptId={attemptId} attempt={data} step={step} /></div>
    <div className="space-y-2 md:hidden" aria-label="Vòng đời lần thử">{order.map(value => { const entry = steps.find(item => item.key === value)!; return <div key={value} className="min-w-0 overflow-hidden rounded-xl border bg-card"><a href={hrefOf(project, attemptId, value)} aria-expanded={step === value} className="flex items-center justify-between gap-2 p-3 text-sm"><span className="font-medium">{stepLabels[value]}</span><span className="flex items-center gap-2"><StateChip state={entry.state} compact /><span className="text-xs text-muted-foreground">{entry.detail ?? (entry.at ? formatAbsolute(entry.at) : '—')}</span></span></a>{step === value && <div className="border-t p-2"><StepContent project={project} attemptId={attemptId} attempt={data} step={value} /></div>}</div>; })}</div>
    <ConceptBlock concept="C13" as="section" className="rounded-xl border bg-card p-4"><h2 className="mb-3 text-sm font-semibold">Ai đã đụng</h2><div className="divide-y">{data.actions.map(action => <div key={action.id} className="flex flex-wrap items-center gap-2 py-2 text-xs"><StateChip state={action.ui} compact /><span>{action.controller} · {action.duty ?? action.verb ?? action.state}</span><span className="text-muted-foreground">{formatAbsolute(action.startedAt)}</span></div>)}</div>{!data.actions.length && <p className="text-sm text-muted-foreground">Chưa có tác động controller được ghi nhận.</p>}</ConceptBlock>
    <ConceptBlock concept="C16" as="section" className="rounded-xl border bg-card p-4"><h2 className="mb-3 text-sm font-semibold">Bài học liên quan</h2><div className="space-y-2">{data.lessons.map(lesson => <div key={lesson.id} className="text-sm"><strong>{lesson.title}</strong><span className="ml-2 text-xs text-muted-foreground">{lesson.state}{lesson.landedSha ? ` · ${lesson.landedSha.slice(0, 10)}` : ''}</span></div>)}</div>{!data.lessons.length && <p className="text-sm text-muted-foreground">Chưa có bài học liên quan.</p>}</ConceptBlock>
  </div>;
}

export default AttemptPage;
