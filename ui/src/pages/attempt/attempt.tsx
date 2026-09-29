import { useEffect, useRef, useState } from 'react';
import { useApiQuery } from '../../api/query';
import type { AttemptDetailV3, EvidenceFile } from '../../contract';
import { useRoute, type AttemptStep } from '../../router';
import { StepBar } from '../../components/step-bar';
import { ConceptBlock, type Concept } from '../../components/concept';
import { ChevronRight } from 'lucide-react';
import { AttemptIO } from '../../components/attempt/io-panels';
import { CheckList } from '../../components/attempt/check-list';
import { ResultCard } from '../../components/attempt/result/result-card';
import { ProductsCard } from '../../components/attempt/products/products-card';
import { compactVi } from '../../components/usage-view';
import { AttemptWhereCard } from '../../components/attempt/where-card';
import { EvidenceBrowser } from '../../components/evidence/evidence-browser';
import { AttemptHeader } from '../../components/attempt/frame/header';
import { AttemptTrail, DiffSection, LandSection, TranscriptSection } from '../../components/attempt/frame/sections';
import { stepItems } from '../../components/attempt/frame/steps';
import { formatBytes, formatSpan, hashParam, setHashParam } from '../../components/attempt/frame/util';

export const concept: Concept = 'C7';
const baseOf = (project: string, id: string) => `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
/** Where each step lives on the page; every step scrolls to its own section. */
const anchors: Record<AttemptStep, string> = { dispatch: 'attempt-op-goal', run: 'attempt-step-run', report: 'attempt-result', checks: 'attempt-step-checks', verdict: 'attempt-result', land: 'attempt-step-land' };

function initialStep(attempt: AttemptDetailV3): AttemptStep {
  if (attempt.checksRed > 0) return 'checks';
  if (attempt.verdict === null) return 'run';
  return 'verdict';
}

/** "gpt-6-sol · codex-agent · 12 phút 52 giây · token chưa ghi nhận" */
function costSummary(a: AttemptDetailV3): string {
  const end = a.settledAt ?? a.reportedAt;
  const total = a.usage?.total;
  return [a.model, a.agent ?? a.where?.agent, a.dispatchedAt && end ? formatSpan(end - a.dispatchedAt) : null, total ? `${compactVi(total.input + total.output)} token` : 'token chưa ghi nhận'].filter(Boolean).join(' · ');
}

/** A closed-by-default section whose one-line summary stays visible. */
function Collapsible({ id, title, summary, concept: c, open, onToggle, children }: { id: string; title: string; summary: string; concept: Concept; open?: boolean; onToggle?: (open: boolean) => void; children: React.ReactNode }) {
  const [own, setOwn] = useState(false);
  const isOpen = open ?? own;
  return <ConceptBlock concept={c} as="section" id={id} className="min-w-0 scroll-mt-4 rounded-xl border bg-card shadow-sm">
    <button type="button" aria-expanded={isOpen} onClick={() => { const next = !isOpen; setOwn(next); onToggle?.(next); }} className="flex w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left sm:px-5">
      <ChevronRight className={`size-4 shrink-0 transition-transform ${isOpen ? 'rotate-90' : ''}`} aria-hidden="true" />
      <h2 className="m-0 font-semibold">{title}</h2>
      <span className="min-w-0 break-words text-xs text-muted-foreground">{summary}</span>
    </button>
    {isOpen ? <div className="min-w-0 border-t p-4 sm:p-5">{children}</div> : null}
  </ConceptBlock>;
}

function AttemptPage() {
  const route = useRoute();
  if (route.kind !== 'attempt') return null;
  return <AttemptDetailPage key={`${route.project}/${route.attemptId}`} project={route.project} attemptId={route.attemptId} routeStep={route.step} />;
}

function AttemptDetailPage({ project, attemptId, routeStep }: { project: string; attemptId: string; routeStep: AttemptStep }) {
  const attempt = useApiQuery<AttemptDetailV3>(baseOf(project, attemptId), { topics: [`attempt:${project}:${attemptId}`], intervalMs: 20_000 });
  const data = attempt.data;
  const [fileId, setFileId] = useState<number | null>(() => { const raw = hashParam('file'); return raw && /^\d+$/.test(raw) ? Number(raw) : null; });
  const [picked, setPicked] = useState<AttemptStep | null>(() => (hashParam('step') ? routeStep : null));
  const [filesOpen, setFilesOpen] = useState(() => hashParam('file') != null);
  const scrolled = useRef(false);

  // A deep link with ?step= scrolls to that section once the page has content.
  useEffect(() => {
    if (!data || scrolled.current) return;
    scrolled.current = true;
    if (picked) window.requestAnimationFrame(() => document.getElementById(anchors[picked])?.scrollIntoView({ block: 'start' }));
  }, [data, picked]);

  if (attempt.error) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">← Tổng quan</a><p role="alert" className="mt-4 rounded-xl border p-5">{attempt.error}</p></div>;
  if (!data) return <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Đang đọc lần thử…</div>;

  const step = picked ?? initialStep(data);
  const selectStep = (value: AttemptStep) => {
    setPicked(value);
    setHashParam('step', value);
    document.getElementById(anchors[value])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const selectFile = (artifactId: number) => { setFileId(artifactId); setFilesOpen(true); setHashParam('file', String(artifactId)); };
  const openFile = (file: EvidenceFile) => {
    selectFile(file.artifactId);
    document.getElementById('attempt-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const totalBytes = data.files.reduce((sum, file) => sum + file.bytes, 0);

  return <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-4 pb-24 sm:p-6 lg:p-8">
    <AttemptHeader attempt={data} project={project} />
    <StepBar steps={stepItems(data)} selected={step} onSelect={selectStep} />
    <AttemptIO attempt={data} />
    <div id="attempt-result" className="scroll-mt-4"><ResultCard attempt={data} /></div>
    <ProductsCard project={project} attempt={data} />
    <CheckList attempt={data} onOpenFile={openFile} />
    <Collapsible id="attempt-where" title="Chi phí & tài nguyên" summary={costSummary(data)} concept="C6"><AttemptWhereCard attempt={data} /></Collapsible>
    <Collapsible id="attempt-evidence" title="Tệp thô" summary={`${data.files.length} tệp${data.files.length ? ` · ${formatBytes(totalBytes)}` : ''}`} concept="C8" open={filesOpen} onToggle={setFilesOpen}>
      <EvidenceBrowser files={data.files} selected={fileId} onSelect={selectFile} />
    </Collapsible>
    <TranscriptSection project={project} attemptId={attemptId} attempt={data} />
    <DiffSection project={project} attemptId={attemptId} attempt={data} />
    <LandSection attempt={data} />
    <AttemptTrail attempt={data} />
  </div>;
}

export default AttemptPage;
