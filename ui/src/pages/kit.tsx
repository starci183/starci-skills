import { useState } from 'react';
import { Advanced } from '../components/motion';
import { DataTable } from '../components/data-table';
import { Drawer } from '../components/drawer';
import { FeedbackState, PageSkeleton } from '../components/feedback-state';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ConceptBlock, type Concept } from '../components/concept';
import { LifecycleBar, type UnitState } from '../components/lifecycle-bar';
import { StateChip } from '../components/state-chip';
import { StepBar, type StepItem } from '../components/step-bar';
import { FileTypeBadge, StatusChip, StatusDot } from '../components/status-chip';
import { PathLink } from '../components/path-link';
import { Progress } from '../components/ui/progress';
import { statusLabels, statusTone, type Status } from '../components/status';
import { t } from '../i18n/t';
import type { UiState } from '../contract';
import type { AttemptStep } from '../router';

export const concept: Concept = 'frame';

const states: UiState[] = ['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'];
const unitCounts: Record<UnitState, number> = { planned: 2, queued: 3, running: 4, reported: 1, deciding: 1, done: 8, failed: 2, dropped: 1 };
const allStatuses = Object.keys(statusLabels) as Status[];
const fileKinds = ['json', 'yaml', 'markdown', 'text', 'diff', 'image', 'video', 'audio', 'pdf', 'binary'];
const toneSteps: StepItem[] = [
  { key: 'dispatch', state: 'done', at: null, tone: 'success', detail: `09:12 · ${t('done')}` },
  { key: 'run', state: 'done', at: null, tone: 'success', detail: `09:14 · ${t('{n} min', { n: 2 })}` },
  { key: 'report', state: 'ok', at: null, tone: 'warning', detail: t('Partial report') },
  { key: 'checks', state: 'bad', at: null, tone: 'failed', detail: t('{pass} passed · {fail} failed', { pass: 3, fail: 1 }), segments: [{ tone: 'success', n: 3 }, { tone: 'failed', n: 1 }, { tone: 'skipped', n: 1 }] },
  { key: 'verdict', state: 'running', at: null, tone: 'running', detail: t('settling') },
  { key: 'land', state: 'waiting', at: null, tone: 'queued', detail: t('Not reached yet') },
];
const steps = [
  { key: 'dispatch', state: 'done', at: null },
  { key: 'run', state: 'done', at: null },
  { key: 'report', state: 'done', at: null },
  { key: 'checks', state: 'bad', at: null },
  { key: 'verdict', state: 'waiting', at: null },
  { key: 'land', state: 'unknown', at: null },
] as const;

export default function KitPage() {
  const [step, setStep] = useState<AttemptStep>('checks');
  const [drawerOpen, setDrawerOpen] = useState(false);
  return <ConceptBlock concept="frame" className="flex flex-col gap-6 md:gap-8">
    <div><h1 className="text-2xl font-semibold tracking-tight">{t('Component kit')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('A UI sample for checking both themes. The numbers below are demo data of the component kit.')}</p></div>
    <div className="kit-grid">
      {(['dark', 'light'] as const).map((theme) => <div key={theme} className={`kit-preview ${theme}`}>
        <Card><CardHeader><CardTitle>{theme === 'dark' ? t('Dark') : t('Light')}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4">
          <ConceptBlock concept="frame"><h2 className="mb-2 text-sm font-medium">{t('Seven states')}</h2><div className="flex flex-wrap gap-2">{states.map((state) => <StateChip state={state} key={state} />)}</div></ConceptBlock>
          <ConceptBlock concept="frame"><h2 className="mb-2 text-sm font-medium">{t('Semantic statuses')}</h2>
            <div className="flex flex-wrap gap-2">{allStatuses.map((status) => <StatusChip status={status} key={status} />)}</div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{allStatuses.map((status) => <span key={status} className="inline-flex items-center gap-1.5"><StatusDot status={status} />{statusTone[status]}</span>)}</div>
            <div className="mt-3 grid gap-2">{(['success', 'running', 'queued', 'failed', 'warning', 'skipped'] as const).map((tone) => <Progress key={tone} tone={tone} value={tone === 'queued' ? 8 : 64} className="h-2" aria-label={tone} />)}</div>
            <div className="mt-3 grid gap-3 text-xs text-muted-foreground">
              {[
                { key: 'unknown', label: t('Unknown progress'), value: null, max: 100 },
                { key: 'nan', label: t('Non-finite progress'), value: Number.NaN, max: 100 },
                { key: 'invalid-maximum', label: t('Invalid progress maximum'), value: 50, max: 0 },
                { key: 'known-zero', label: t('Known zero progress'), value: 0, max: 100 },
              ].map(sample => <div key={sample.key} className="grid gap-1"><span>{sample.label}</span><Progress value={sample.value} max={sample.max} aria-label={`${sample.label} · ${theme}`} data-demo-progress={sample.key} className="h-2" /></div>)}
            </div>
          </ConceptBlock>
          <ConceptBlock concept="frame"><h2 className="mb-2 text-sm font-medium">{t('File types and paths')}</h2>
            <div className="mb-3 flex flex-wrap gap-2">{fileKinds.map((kind) => <FileTypeBadge kind={kind} key={kind} />)}</div>
            <div className="grid gap-2"><PathLink path="shop/.starciwork/evidence" kind="dir" /><PathLink path="shop/src/module.ts" kind="file" /></div>
          </ConceptBlock>
          <ConceptBlock concept="C4"><h2 className="mb-2 text-sm font-medium">{t('Unit distribution')}</h2><LifecycleBar counts={unitCounts} /></ConceptBlock>
        </CardContent></Card>
      </div>)}
    </div>
    <ConceptBlock concept="C7"><Card><CardHeader><CardTitle>{t('Attempt lifecycle')}</CardTitle></CardHeader><CardContent className="flex flex-col gap-4"><StepBar steps={toneSteps} selected={step} onSelect={setStep} /><StepBar steps={[...steps]} selected={step} onSelect={setStep} /></CardContent></Card></ConceptBlock>
    <div className="kit-grid">
      <Card><CardHeader><CardTitle>{t('Card and Advanced')}</CardTitle></CardHeader><CardContent className="grid gap-4">
        <p className="text-sm text-muted-foreground">{t('One surface, clearly tiered text, details separated by thin lines.')}</p>
        <Advanced summary={t('Code and paths')} variant="inline"><PathLink path="shop/src/module.ts" kind="file" /></Advanced>
        <Button variant="outline" className="justify-self-start" onClick={() => setDrawerOpen(true)}>{t('View the drawer')}</Button>
      </CardContent></Card>
      <Card><CardHeader><CardTitle>{t('Table and states')}</CardTitle></CardHeader><CardContent className="grid gap-4">
        <DataTable rows={[{ name: t('Verification'), value: '3/3', status: 'success' as Status }, { name: t('Awaiting a decision'), value: '1', status: 'awaiting-owner' as Status }]} getKey={row => row.name}
          columns={[{ key: 'name', header: t('Item'), render: row => row.name }, { key: 'value', header: t('Count'), render: row => row.value }, { key: 'status', header: t('State'), render: row => <StatusChip status={row.status} /> }]} />
        <FeedbackState>{t('No matching data.')}</FeedbackState>
      </CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>{t('Loading and errors')}</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><PageSkeleton /><FeedbackState error onRetry={() => undefined}>{t('Could not read the data source.')}</FeedbackState></CardContent></Card>
    <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} title="Drawer" description={t('Read-only technical details')}><div className="grid gap-4"><p>{t('Info stays on one surface level.')}</p><Advanced summary={t('Code and paths')}><PathLink path="shop/src/module.ts" kind="file" /></Advanced></div></Drawer>
  </ConceptBlock>;
}
