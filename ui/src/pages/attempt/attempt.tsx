import { useEffect, useRef, useState } from 'react';
import { useApiQuery } from '../../api/query';
import type { AttemptDetailV3, EvidenceFile } from '../../contract';
import { useRoute, type AttemptStep } from '../../router';
import { StepBar } from '../../components/step-bar';
import { ConceptBlock, type Concept } from '../../components/concept';
import { Advanced, Enter, Stagger, StaggerItem } from '../../components/motion';
import { AttemptInputContext, AttemptOpGoal, useOpInfo } from '../../components/attempt/io-panels';
import { CheckList, derivePairs } from '../../components/attempt/check-list';
import { ResultCard } from '../../components/attempt/result/result-card';
import { ProductsCard } from '../../components/attempt/products/products-card';
import { compactVi } from '../../components/usage-view';
import { AttemptWhereCard } from '../../components/attempt/where-card';
import { EvidenceBrowser } from '../../components/evidence/evidence-browser';
import { AttemptHeader } from '../../components/attempt/frame/header';
import { BareCards } from '../../components/attempt/frame/card';
import { AttemptDecisions, DiffSection, LandSection, TimelineCard, TranscriptSection } from '../../components/attempt/frame/sections';
import { stepItems } from '../../components/attempt/frame/steps';
import { formatBytes, formatSpan, hashParam, setHashParam } from '../../components/attempt/frame/util';

export const concept: Concept = 'C7';
const baseOf = (project: string, id: string) => `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
/** Where each step lives on the page; every step scrolls to its own section. Run/checks/land sections live under "Nâng cao" and open when targeted. */
const anchors: Record<AttemptStep, string> = { dispatch: 'attempt-op-goal', run: 'attempt-step-run', report: 'attempt-result', checks: 'attempt-step-checks', verdict: 'attempt-result', land: 'attempt-step-land' };
const advancedIds = new Set(['attempt-input', 'attempt-step-checks', 'attempt-where', 'attempt-evidence', 'attempt-step-run', 'attempt-step-diff', 'attempt-step-land', 'attempt-timeline', 'attempt-decisions']);

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

/** One "Nâng cao" card. `nonce` > 0 means a deep link / step click asked for it open; a new nonce remounts it open. */
function AdvancedSection({ id, title, summary, concept: c, nonce, children }: { id: string; title: string; summary: string; concept: Concept; nonce: number; children: React.ReactNode }) {
  return <StaggerItem>
    <ConceptBlock concept={c} as="section" id={id} className="min-w-0 scroll-mt-4">
      <Advanced key={`${id}:${nonce}`} variant="card" title={title} summary={summary} defaultOpen={nonce > 0}>
        <BareCards value>{children}</BareCards>
      </Advanced>
    </ConceptBlock>
  </StaggerItem>;
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
  const [nonce, setNonce] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (hashParam('file') != null) initial['attempt-evidence'] = 1;
    if (hashParam('step') && advancedIds.has(anchors[routeStep])) initial[anchors[routeStep]] = 1;
    return initial;
  });
  const scrolled = useRef(false);
  const info = useOpInfo({ project, wf: data?.wf ?? '', op: data?.op ?? '' });

  /** Open an advanced section (if the target is one) and bring it into view once it has mounted. */
  const reveal = (id: string) => {
    const advanced = advancedIds.has(id);
    if (advanced) setNonce(current => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
    window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), advanced ? 80 : 0);
  };

  // A deep link with ?step= or ?file= scrolls to that section once the page has content.
  useEffect(() => {
    if (!data || scrolled.current) return;
    scrolled.current = true;
    const target = picked ? anchors[picked] : fileId != null ? 'attempt-evidence' : null;
    if (target) window.requestAnimationFrame(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }));
  }, [data, picked, fileId]);

  if (attempt.error) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">← Tổng quan</a><p role="alert" className="mb-0 mt-4 rounded-xl border p-4">{attempt.error}</p></div>;
  if (!data) return <div className="mx-auto max-w-6xl p-6 text-sm text-muted-foreground">Đang đọc lần thử…</div>;

  const step = picked ?? initialStep(data);
  const selectStep = (value: AttemptStep) => {
    setPicked(value);
    setHashParam('step', value);
    reveal(anchors[value]);
  };
  const selectFile = (artifactId: number) => { setFileId(artifactId); setHashParam('file', String(artifactId)); };
  const openFile = (file: EvidenceFile) => { selectFile(file.artifactId); reveal('attempt-evidence'); };
  const totalBytes = data.files.reduce((sum, file) => sum + file.bytes, 0);
  const pairs = derivePairs(data);
  const confirmed = pairs.filter(pair => pair.runtime && (pair.runtime.status === 'pass' || (pair.runtime.status == null && pair.runtime.exitCode === 0))).length;
  const terminal = data.terminal;
  const where = data.where;
  const n = (id: string) => nonce[id] ?? 0;

  return <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6 p-4 pb-8 min-[760px]:gap-8 sm:p-6 lg:p-8">
    <Stagger className="flex min-w-0 flex-col gap-6 min-[760px]:gap-8">
      <StaggerItem><AttemptHeader attempt={data} project={project} /></StaggerItem>
      <StaggerItem><StepBar steps={stepItems(data)} selected={step} onSelect={selectStep} /></StaggerItem>
      <StaggerItem><AttemptOpGoal attempt={data} info={info.info} loading={info.loading} /></StaggerItem>
      <StaggerItem><ResultCard attempt={data} /></StaggerItem>
      <StaggerItem><ProductsCard project={project} attempt={data} /></StaggerItem>
    </Stagger>

    <Enter delay={0.12} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-lg font-semibold">Nâng cao</h2>
        <span className="text-xs text-muted-foreground">Đầu vào, kiểm chứng chi tiết, chi phí, tệp thô, transcript, diff, land và dòng thời gian.</span>
      </div>
      <Stagger className="flex min-w-0 flex-col gap-4">
        <AdvancedSection id="attempt-input" title="Đầu vào & ngữ cảnh" summary="kernel giao gì, op phải đọc gì" concept="C8" nonce={n('attempt-input')}><AttemptInputContext attempt={data} info={info.info} /></AdvancedSection>
        <AdvancedSection id="attempt-step-checks" title="Kiểm chứng" summary={pairs.length ? `${pairs.length} check · runtime xác nhận ${confirmed}/${pairs.length}${data.checksRed ? ` · ${data.checksRed} hỏng` : ''}` : 'chưa có check'} concept="C9" nonce={n('attempt-step-checks')}><CheckList attempt={data} onOpenFile={openFile} /></AdvancedSection>
        <AdvancedSection id="attempt-where" title="Chi phí & nơi chạy" summary={costSummary(data)} concept="C6" nonce={n('attempt-where')}><AttemptWhereCard attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-evidence" title="Tệp thô" summary={`${data.files.length} tệp${data.files.length ? ` · ${formatBytes(totalBytes)}` : ''}`} concept="C8" nonce={n('attempt-evidence')}><EvidenceBrowser files={data.files} selected={fileId} onSelect={selectFile} /></AdvancedSection>
        <AdvancedSection id="attempt-step-run" title="Transcript" summary={terminal?.transcript ? `${formatBytes(terminal.transcript.bytes)}${terminal.live ? ' · đang mở' : ''}` : 'chưa có transcript'} concept="C7" nonce={n('attempt-step-run')}><TranscriptSection project={project} attemptId={attemptId} attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-step-diff" title="Diff" summary={where.baseSha || where.headSha ? `${where.baseSha?.slice(0, 8) ?? '—'} → ${where.headSha?.slice(0, 8) ?? '—'}` : 'thay đổi op ghi vào repo'} concept="C11" nonce={n('attempt-step-diff')}><DiffSection project={project} attemptId={attemptId} attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-step-land" title="Land" summary={data.land ? data.land.result : 'chưa có bản ghi land'} concept="C11" nonce={n('attempt-step-land')}><LandSection attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-timeline" title="Dòng thời gian" summary={`${data.timeline.filter(item => item.at).length}/${data.timeline.length} mốc`} concept="C7" nonce={n('attempt-timeline')}><TimelineCard attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-decisions" title="Quyết định" summary={`${data.actions.length} tác động · ${data.decisions.length} quyết định · ${data.lessons.length} bài học`} concept="C12" nonce={n('attempt-decisions')}><AttemptDecisions attempt={data} /></AdvancedSection>
      </Stagger>
    </Enter>
  </div>;
}

export default AttemptPage;
