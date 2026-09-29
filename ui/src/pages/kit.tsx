import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ConceptBlock, type Concept } from '../components/concept';
import { LifecycleBar, type UnitState } from '../components/lifecycle-bar';
import { StateChip } from '../components/state-chip';
import { StepBar, type StepItem } from '../components/step-bar';
import { FileTypeBadge, StatusChip, StatusDot } from '../components/status-chip';
import { PathLink } from '../components/path-link';
import { Progress } from '../components/ui/progress';
import { statusLabels, statusTone, type Status } from '../components/status';
import type { UiState } from '../contract';
import type { AttemptStep } from '../router';

export const concept: Concept = 'frame';

const states: UiState[] = ['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'];
const unitCounts: Record<UnitState, number> = { planned: 2, queued: 3, running: 4, reported: 1, deciding: 1, done: 8, failed: 2, dropped: 1 };
const allStatuses = Object.keys(statusLabels) as Status[];
const fileKinds = ['json', 'yaml', 'markdown', 'text', 'diff', 'image', 'video', 'audio', 'pdf', 'binary'];
const toneSteps: StepItem[] = [
  { key: 'dispatch', state: 'done', at: null, tone: 'success', detail: '09:12 · xong' },
  { key: 'run', state: 'done', at: null, tone: 'success', detail: '09:14 · 2 phút' },
  { key: 'report', state: 'ok', at: null, tone: 'warning', detail: 'Báo cáo một phần' },
  { key: 'checks', state: 'bad', at: null, tone: 'failed', detail: '3 đạt · 1 hỏng', segments: [{ tone: 'success', n: 3 }, { tone: 'failed', n: 1 }, { tone: 'skipped', n: 1 }] },
  { key: 'verdict', state: 'running', at: null, tone: 'running', detail: 'Đang chốt' },
  { key: 'land', state: 'waiting', at: null, tone: 'queued', detail: 'Chưa tới' },
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
  return <ConceptBlock concept="frame" className="space-y-6">
    <div><h1 className="text-2xl font-semibold tracking-tight">Bộ thành phần</h1><p className="mt-1 text-sm text-muted-foreground">Mẫu giao diện kiểm tra hai theme. Các con số dưới đây chỉ là dữ liệu minh họa của bộ thành phần.</p></div>
    <div className="kit-grid">
      {(['dark', 'light'] as const).map((theme) => <div key={theme} className={`kit-preview ${theme}`}>
        <Card><CardHeader><CardTitle>{theme === 'dark' ? 'Tối' : 'Sáng'}</CardTitle></CardHeader><CardContent className="space-y-5">
          <ConceptBlock concept="frame"><h2 className="mb-2 text-sm font-medium">Bảy trạng thái</h2><div className="flex flex-wrap gap-2">{states.map((state) => <StateChip state={state} key={state} />)}</div></ConceptBlock>
          <ConceptBlock concept="frame"><h2 className="mb-2 text-sm font-medium">Trạng thái ngữ nghĩa</h2>
            <div className="flex flex-wrap gap-2">{allStatuses.map((status) => <StatusChip status={status} key={status} />)}</div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">{allStatuses.map((status) => <span key={status} className="inline-flex items-center gap-1.5"><StatusDot status={status} />{statusTone[status]}</span>)}</div>
            <div className="mt-3 grid gap-2">{(['success', 'running', 'queued', 'failed', 'warning', 'skipped'] as const).map((tone) => <Progress key={tone} tone={tone} value={tone === 'queued' ? 8 : 64} className="h-2" aria-label={tone} />)}</div>
          </ConceptBlock>
          <ConceptBlock concept="frame"><h2 className="mb-2 text-sm font-medium">Loại tệp và đường dẫn</h2>
            <div className="mb-3 flex flex-wrap gap-1.5">{fileKinds.map((kind) => <FileTypeBadge kind={kind} key={kind} />)}</div>
            <div className="grid gap-2"><PathLink path="D:/Repositories/nivo-backend/.starciwork/evidence" kind="dir" /><PathLink path="D:/Repositories/nivo-backend/src/module.ts" kind="file" /></div>
          </ConceptBlock>
          <ConceptBlock concept="C4"><h2 className="mb-2 text-sm font-medium">Phân bố đơn vị</h2><LifecycleBar counts={unitCounts} /></ConceptBlock>
        </CardContent></Card>
      </div>)}
    </div>
    <ConceptBlock concept="C7"><Card><CardHeader><CardTitle>Vòng đời lần thử</CardTitle></CardHeader><CardContent className="space-y-4"><StepBar steps={toneSteps} selected={step} onSelect={setStep} /><StepBar steps={[...steps]} selected={step} onSelect={setStep} /></CardContent></Card></ConceptBlock>
  </ConceptBlock>;
}
