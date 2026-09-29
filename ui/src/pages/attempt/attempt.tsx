import { useEffect, useRef, useState } from 'react';
import { useApiQuery } from '../../api/query';
import type { AttemptDetailV2, EvidenceFile } from '../../contract';
import { useRoute, type AttemptStep } from '../../router';
import { StepBar } from '../../components/step-bar';
import type { Concept } from '../../components/concept';
import { AttemptIO } from '../../components/attempt/io-panels';
import { CheckList } from '../../components/attempt/check-list';
import { AttemptWhereCard } from '../../components/attempt/where-card';
import { EvidenceBrowser } from '../../components/evidence/evidence-browser';
import { Card } from '../../components/attempt/frame/card';
import { AttemptHeader } from '../../components/attempt/frame/header';
import { AttemptTrail, DiffSection, LandSection, TranscriptSection } from '../../components/attempt/frame/sections';
import { stepItems } from '../../components/attempt/frame/steps';
import { formatBytes, hashParam, setHashParam } from '../../components/attempt/frame/util';

export const concept: Concept = 'C7';
const baseOf = (project: string, id: string) => `/api/attempts/${encodeURIComponent(project)}/${encodeURIComponent(id)}`;
/** Where each step lives on the page; every step scrolls to its own section. */
const anchors: Record<AttemptStep, string> = { dispatch: 'attempt-step-io', run: 'attempt-step-run', report: 'attempt-step-io', checks: 'attempt-step-checks', verdict: 'attempt-step-io', land: 'attempt-step-land' };

function initialStep(attempt: AttemptDetailV2): AttemptStep {
  if (attempt.checksRed > 0) return 'checks';
  if (attempt.verdict === null) return 'run';
  return 'verdict';
}

function AttemptPage() {
  const route = useRoute();
  if (route.kind !== 'attempt') return null;
  return <AttemptDetailPage key={`${route.project}/${route.attemptId}`} project={route.project} attemptId={route.attemptId} routeStep={route.step} />;
}

function AttemptDetailPage({ project, attemptId, routeStep }: { project: string; attemptId: string; routeStep: AttemptStep }) {
  const attempt = useApiQuery<AttemptDetailV2>(baseOf(project, attemptId), { topics: [`attempt:${project}:${attemptId}`], intervalMs: 20_000 });
  const data = attempt.data;
  const [fileId, setFileId] = useState<number | null>(() => { const raw = hashParam('file'); return raw && /^\d+$/.test(raw) ? Number(raw) : null; });
  const [picked, setPicked] = useState<AttemptStep | null>(() => (hashParam('step') ? routeStep : null));
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
  const selectFile = (artifactId: number) => { setFileId(artifactId); setHashParam('file', String(artifactId)); };
  const openFile = (file: EvidenceFile) => {
    selectFile(file.artifactId);
    document.getElementById('attempt-evidence')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const totalBytes = data.files.reduce((sum, file) => sum + file.bytes, 0);

  return <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-5 p-4 pb-24 sm:p-6 lg:p-8">
    <AttemptHeader attempt={data} project={project} />
    <StepBar steps={stepItems(data)} selected={step} onSelect={selectStep} />
    <div id="attempt-step-io" className="scroll-mt-4"><AttemptIO attempt={data} /></div>
    <AttemptWhereCard attempt={data} />
    <CheckList attempt={data} onOpenFile={openFile} />
    <Card id="attempt-evidence" concept="C8" title="Bằng chứng" hint={`${data.files.length} tệp${data.files.length ? ` · ${formatBytes(totalBytes)}` : ''}`}>
      <EvidenceBrowser files={data.files} selected={fileId} onSelect={selectFile} />
    </Card>
    <TranscriptSection project={project} attemptId={attemptId} attempt={data} />
    <DiffSection project={project} attemptId={attemptId} attempt={data} />
    <LandSection attempt={data} />
    <AttemptTrail attempt={data} />
  </div>;
}

export default AttemptPage;
