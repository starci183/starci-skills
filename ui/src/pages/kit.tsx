import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ConceptBlock, type Concept } from '../components/concept';
import { LifecycleBar, type UnitState } from '../components/lifecycle-bar';
import { StateChip } from '../components/state-chip';
import { StepBar } from '../components/step-bar';
import type { UiState } from '../contract';
import type { AttemptStep } from '../router';

export const concept: Concept = 'frame';

const states: UiState[] = ['bad', 'warn', 'running', 'waiting', 'ok', 'done', 'unknown'];
const unitCounts: Record<UnitState, number> = { planned: 2, queued: 3, running: 4, reported: 1, deciding: 1, done: 8, failed: 2, dropped: 1 };
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
          <ConceptBlock concept="C4"><h2 className="mb-2 text-sm font-medium">Phân bố đơn vị</h2><LifecycleBar counts={unitCounts} /></ConceptBlock>
        </CardContent></Card>
      </div>)}
    </div>
    <ConceptBlock concept="C7"><Card><CardHeader><CardTitle>Vòng đời lần thử</CardTitle></CardHeader><CardContent><StepBar steps={[...steps]} selected={step} onSelect={setStep} /></CardContent></Card></ConceptBlock>
  </ConceptBlock>;
}
