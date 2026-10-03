import { useEffect, useRef, useState } from 'react';
import { refreshQuery, useApiQuery } from '../../api/query';
import type { AttemptDetailV3, EvidenceFile } from '../../contract';
import { useRoute, type AttemptStep } from '../../router';
import { StepBar } from '../../components/step-bar';
import { FeedbackState, PageSkeleton } from '../../components/feedback-state';
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
import { t } from '../../i18n/t';

export const concept: Concept = 'C7';
const baseOf = (project: string, id: string) => `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
/** Where each step lives on the page; every step scrolls to its own section. Run/checks/land sections live under "Advanced" and open when targeted. */
const anchors: Record<AttemptStep, string> = { dispatch: 'attempt-op-goal', run: 'attempt-step-run', report: 'attempt-result', checks: 'attempt-step-checks', verdict: 'attempt-result', land: 'attempt-step-land' };
const advancedIds = new Set(['attempt-input', 'attempt-step-checks', 'attempt-where', 'attempt-evidence', 'attempt-step-run', 'attempt-step-diff', 'attempt-step-land', 'attempt-timeline', 'attempt-decisions']);

function initialStep(attempt: AttemptDetailV3): AttemptStep {
  if (attempt.checksRed > 0) return 'checks';
  if (attempt.verdict === null) return 'run';
  return 'verdict';
}

/** "gpt-6.1-sol · codex-agent · 12 min 52 sec · tokens not recorded" */
function costSummary(a: AttemptDetailV3): string {
  const end = a.settledAt ?? a.reportedAt;
  const total = a.usage?.total;
  return [a.model, a.agent ?? a.where?.agent, a.dispatchedAt && end ? formatSpan(end - a.dispatchedAt) : null, total ? t('{n} tokens', { n: compactVi(total.input + total.output) }) : t('tokens not recorded')].filter(Boolean).join(' · ');
}

/** One "Advanced" card. `nonce` > 0 means a deep link / step click asked for it open; a new nonce remounts it open. */
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

  if (attempt.error) return <div className="mx-auto max-w-6xl p-6"><a href="#/" className="text-sm hover:underline">{t('← Overview')}</a><div className="mt-4"><FeedbackState error onRetry={() => refreshQuery(baseOf(project, attemptId))}>{attempt.error}</FeedbackState></div></div>;
  if (!data) return <div className="mx-auto max-w-6xl p-6"><PageSkeleton label={t('Reading the attempt…')} /></div>;

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

  return <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6 pb-8 min-[760px]:gap-8">
    <Stagger className="flex min-w-0 flex-col gap-6 min-[760px]:gap-8">
      <StaggerItem><AttemptHeader attempt={data} project={project} /></StaggerItem>
      <StaggerItem><StepBar steps={stepItems(data)} selected={step} onSelect={selectStep} /></StaggerItem>
      <StaggerItem><AttemptOpGoal attempt={data} info={info.info} loading={info.loading} /></StaggerItem>
      <StaggerItem><ResultCard attempt={data} /></StaggerItem>
      <StaggerItem><ProductsCard project={project} attempt={data} /></StaggerItem>
    </Stagger>

    <Enter delay={0.12} className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="m-0 text-lg font-semibold">{t('Advanced')}</h2>
        <span className="text-xs text-muted-foreground">{t('Inputs, detailed verification, cost, raw files, transcript, diff, land and the timeline.')}</span>
      </div>
      <Stagger className="flex min-w-0 flex-col gap-4">
        <AdvancedSection id="attempt-input" title={t('Inputs & context')} summary={t('what the kernel hands over, what the op must read')} concept="C8" nonce={n('attempt-input')}><AttemptInputContext attempt={data} info={info.info} /></AdvancedSection>
        <AdvancedSection id="attempt-step-checks" title={t('Verification')} summary={pairs.length ? `${pairs.length} check${data.checks.length > pairs.length ? t(' · {n} runs', { n: data.checks.length }) : ''}${t(' · runtime confirmed {done}/{total}', { done: confirmed, total: pairs.length })}${data.checksRed ? t(' · {n} failed', { n: data.checksRed }) : ''}` : t('no checks yet')} concept="C9" nonce={n('attempt-step-checks')}><CheckList attempt={data} onOpenFile={openFile} /></AdvancedSection>
        <AdvancedSection id="attempt-where" title={t('Cost & where it ran')} summary={costSummary(data)} concept="C6" nonce={n('attempt-where')}><AttemptWhereCard attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-evidence" title={t('Raw files')} summary={`${t('{n} files', { n: data.files.length })}${data.files.length ? ` · ${formatBytes(totalBytes)}` : ''}`} concept="C8" nonce={n('attempt-evidence')}><EvidenceBrowser files={data.files} selected={fileId} onSelect={selectFile} /></AdvancedSection>
        <AdvancedSection id="attempt-step-run" title="Transcript" summary={terminal?.transcript ? `${formatBytes(terminal.transcript.bytes)}${terminal.live ? t(' · open') : ''}` : t('No transcript yet')} concept="C7" nonce={n('attempt-step-run')}><TranscriptSection project={project} attemptId={attemptId} attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-step-diff" title="Diff" summary={where.baseSha || where.headSha ? `${where.baseSha?.slice(0, 8) ?? '—'} → ${where.headSha?.slice(0, 8) ?? '—'}` : t('changes the op wrote to the repo')} concept="C11" nonce={n('attempt-step-diff')}><DiffSection project={project} attemptId={attemptId} attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-step-land" title="Land" summary={data.land ? data.land.result : t('no land record yet')} concept="C11" nonce={n('attempt-step-land')}><LandSection attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-timeline" title={t('Timeline')} summary={t('{n}/{total} marks', { n: data.timeline.filter(item => item.at).length, total: data.timeline.length })} concept="C7" nonce={n('attempt-timeline')}><TimelineCard attempt={data} /></AdvancedSection>
        <AdvancedSection id="attempt-decisions" title={t('Decisions')} summary={t('{actions} actions · {decisions} decisions · {lessons} lessons', { actions: data.actions.length, decisions: data.decisions.length, lessons: data.lessons.length })} concept="C12" nonce={n('attempt-decisions')}><AttemptDecisions attempt={data} /></AdvancedSection>
      </Stagger>
    </Enter>
  </div>;
}

export default AttemptPage;
