import { useState } from 'react';
import { Accordion, Alert, Button, Card, Chip, Drawer, Skeleton, Table, Tabs } from '@heroui/react';
import { Advanced } from '../components/motion';
import { FeedbackState } from '../components/feedback-state';
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
  { key: 'dispatch', state: 'done', at: null, tone: 'success', detail: '09:12 · ' + t('done') },
  { key: 'run', state: 'done', at: null, tone: 'success', detail: '09:14 · ' + t('{n} min', { n: 2 }) },
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

function ThemeKit({ theme }: Readonly<{ theme: 'light' | 'dark' }>) {
  return <div className={'kit-preview ' + theme} data-theme={theme}>
    <Card variant="transparent" className="min-w-0">
      <Card.Header>
        <Card.Title render={props => <h2 {...props} />}>{theme === 'dark' ? t('Dark theme') : t('Light theme')}</Card.Title>
        <Card.Description>{t('Demo data · no live source')}</Card.Description>
      </Card.Header>
      <Card.Content className="grid min-w-0 gap-6">
        <section className="grid gap-3" aria-label={t('Chip')}>
          <h3 className="text-sm font-medium">{t('Chip')} · {t('Seven states')}</h3>
          <div className="flex flex-wrap gap-2">{states.map(state => <StateChip key={state} state={state} />)}</div>
        </section>
        <section className="grid gap-3" aria-label={t('Tabs')}>
          <h3 className="text-sm font-medium">{t('Tabs')}</h3>
          <Tabs defaultSelectedKey="overview">
            <Tabs.ListContainer><Tabs.List aria-label={t('Component kit tabs')}>
              <Tabs.Tab id="overview">{t('Overview')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="details">{t('Details')}<Tabs.Indicator /></Tabs.Tab>
              <Tabs.Tab id="history">{t('History')}<Tabs.Indicator /></Tabs.Tab>
            </Tabs.List></Tabs.ListContainer>
            <Tabs.Panel id="overview"><p className="text-sm text-muted-foreground">{t('Read-only component preview.')}</p></Tabs.Panel>
            <Tabs.Panel id="details"><p className="text-sm text-muted-foreground">{t('The examples use demo data and do not query StarCi sources.')}</p></Tabs.Panel>
            <Tabs.Panel id="history"><p className="text-sm text-muted-foreground">{t('No recorded events in this demo.')}</p></Tabs.Panel>
          </Tabs>
        </section>
        <section className="grid gap-3" aria-label={t('Accordion')}>
          <h3 className="text-sm font-medium">{t('Accordion')}</h3>
          <Accordion defaultExpandedKeys={['source']}>
            <Accordion.Item id="source"><Accordion.Heading><Accordion.Trigger><span>{t('Source observations')}</span><Accordion.Indicator /></Accordion.Trigger></Accordion.Heading>
              <Accordion.Panel><Accordion.Body><dl className="grid gap-2 text-sm">
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{t('Observed at')}</dt><dd className="tabular-nums">09:12:04 · 09/10/2026</dd></div>
                <div className="flex flex-wrap justify-between gap-2"><dt className="text-muted-foreground">{t('Source')}</dt><dd className="font-mono">demo-ledger</dd></div>
              </dl></Accordion.Body></Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item id="technical"><Accordion.Heading><Accordion.Trigger><span>{t('Read-only technical details')}</span><Accordion.Indicator /></Accordion.Trigger></Accordion.Heading>
              <Accordion.Panel><Accordion.Body><p className="text-sm text-muted-foreground">{t('One surface, clearly tiered text, details separated by thin lines.')}</p></Accordion.Body></Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </section>
        <section className="grid gap-3" aria-label={t('Table')}>
          <h3 className="text-sm font-medium">{t('Table')}</h3>
          <Table><Table.ScrollContainer><Table.Content aria-label={t('Component kit table')}>
            <Table.Header>
              <Table.Column id="item" isRowHeader>{t('Item')}</Table.Column>
              <Table.Column id="count">{t('Count')}</Table.Column>
              <Table.Column id="state">{t('State')}</Table.Column>
            </Table.Header>
            <Table.Body>
              <Table.Row id="verification"><Table.Cell>{t('Verification')}</Table.Cell><Table.Cell>3/3</Table.Cell><Table.Cell><StatusChip status="success" /></Table.Cell></Table.Row>
              <Table.Row id="decision"><Table.Cell>{t('Awaiting a decision')}</Table.Cell><Table.Cell>1</Table.Cell><Table.Cell><StatusChip status="awaiting-owner" /></Table.Cell></Table.Row>
            </Table.Body>
          </Table.Content></Table.ScrollContainer></Table>
        </section>
        <section className="grid gap-3" aria-label={t('Alert')}>
          <h3 className="text-sm font-medium">{t('Alert')}</h3>
          <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Title>{t('Could not read the data source.')}</Alert.Title><Alert.Description>{t('This is a demo of a source warning, separate from a workflow or attempt outcome.')}</Alert.Description></Alert.Content></Alert>
        </section>
        <section className="grid gap-3" aria-label={t('Skeleton')}>
          <h3 className="text-sm font-medium">{t('Skeleton')}</h3>
          <div className="grid gap-2" role="status" aria-label={t('Loading…')}><Skeleton className="h-3 w-3/5 rounded" /><Skeleton className="h-3 w-4/5 rounded" /><Skeleton className="h-3 w-2/5 rounded" /></div>
          <FeedbackState>{t('No matching data.')}</FeedbackState>
        </section>
        <section className="grid gap-3" aria-label={t('Drawer')}>
          <h3 className="text-sm font-medium">{t('Drawer')}</h3>
          <Drawer>
            <Button variant="outline" className="justify-self-start">{t('View the drawer')}</Button>
            <Drawer.Backdrop className={theme} data-theme={theme}>
              <Drawer.Content placement="right" className={'kit-drawer ' + theme} data-theme={theme}>
                <Drawer.Dialog>
                  <Drawer.CloseTrigger aria-label={t('Close')} />
                  <Drawer.Header><Drawer.Heading>{t('Read-only technical details')}</Drawer.Heading><p className="text-sm text-muted-foreground">{t('Demo data · no live source')}</p></Drawer.Header>
                  <Drawer.Body className="grid gap-4">
                    <dl className="grid gap-3 text-sm">
                      <div className="grid gap-1"><dt className="text-muted-foreground">{t('Source')}</dt><dd className="break-all font-mono">demo-ledger</dd></div>
                      <div className="grid gap-1"><dt className="text-muted-foreground">{t('Workflow id')}</dt><dd className="break-all font-mono">demo-workflow</dd></div>
                    </dl>
                    <Advanced summary={t('Code and paths')}><PathLink path="demo/src/module.ts" kind="file" /></Advanced>
                  </Drawer.Body>
                  <Drawer.Footer><Chip size="sm" variant="soft"><Chip.Label>{t('Read-only UI')}</Chip.Label></Chip></Drawer.Footer>
                </Drawer.Dialog>
              </Drawer.Content>
            </Drawer.Backdrop>
          </Drawer>
        </section>
        <Advanced summary={t('Domain component samples')}>
          <div className="grid gap-6">
            <section className="grid gap-3"><h3 className="text-sm font-medium">{t('Semantic statuses')}</h3>
              <div className="flex flex-wrap gap-2">{allStatuses.map(status => <StatusChip status={status} key={status} />)}</div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{allStatuses.map(status => <span key={status} className="inline-flex items-center gap-1.5"><StatusDot status={status} />{statusTone[status]}</span>)}</div>
              <div className="grid gap-2">{(['success', 'running', 'queued', 'failed', 'warning', 'skipped'] as const).map(tone => <Progress key={tone} tone={tone} value={tone === 'queued' ? 8 : 64} className="h-2" aria-label={tone} />)}</div>
              <div className="grid gap-3 text-xs text-muted-foreground">{[
                { key: 'unknown', label: t('Unknown progress'), value: null, max: 100 },
                { key: 'nan', label: t('Non-finite progress'), value: Number.NaN, max: 100 },
                { key: 'invalid-maximum', label: t('Invalid progress maximum'), value: 50, max: 0 },
                { key: 'known-zero', label: t('Known zero progress'), value: 0, max: 100 },
              ].map(sample => <div key={sample.key} className="grid gap-1"><span>{sample.label}</span><Progress value={sample.value} max={sample.max} aria-label={sample.label + ' · ' + theme} data-demo-progress={sample.key} className="h-2" /></div>)}</div>
            </section>
            <section className="grid gap-3"><h3 className="text-sm font-medium">{t('File types and paths')}</h3><div className="flex flex-wrap gap-2">{fileKinds.map(kind => <FileTypeBadge kind={kind} key={kind} />)}</div><PathLink path="demo/src/module.ts" kind="file" /></section>
            <ConceptBlock concept="C4"><h3 className="mb-3 text-sm font-medium">{t('Unit distribution')}</h3><LifecycleBar counts={unitCounts} /></ConceptBlock>
          </div>
        </Advanced>
      </Card.Content>
    </Card>
  </div>;
}

export default function KitPage() {
  const [step, setStep] = useState<AttemptStep>('checks');
  return <ConceptBlock concept="frame" className="flex min-w-0 flex-col gap-6 md:gap-8">
    <header className="grid gap-2"><h1 className="text-2xl font-semibold tracking-tight">{t('Component kit')}</h1><p className="text-sm text-muted-foreground">{t('A UI sample for checking both themes. The numbers below are demo data of the component kit.')}</p></header>
    <div className="kit-grid"><ThemeKit theme="light" /><ThemeKit theme="dark" /></div>
    <ConceptBlock concept="C7"><Card><Card.Header><Card.Title>{t('Attempt lifecycle')}</Card.Title><Card.Description>{t('Demo data · no live source')}</Card.Description></Card.Header><Card.Content className="grid gap-4"><StepBar steps={toneSteps} selected={step} onSelect={setStep} /><StepBar steps={[...steps]} selected={step} onSelect={setStep} /></Card.Content></Card></ConceptBlock>
  </ConceptBlock>;
}
