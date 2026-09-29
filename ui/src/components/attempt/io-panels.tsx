import { useApiQuery } from '../../api/query';
import type { AttemptDetailV3, LegRowV3, PipelineView, WorkflowDetailV2 } from '../../contract';
import type { Concept } from '../concept';
import { InputContextCard } from './context/input-context';
import { OpGoalCard } from './context/op-goal';

export const concept: Concept = 'C8';

/** Blocks 2 and 3: "Op này làm gì" then "Đầu vào & ngữ cảnh". Op info comes from the pipeline leg matching this op. */
export function AttemptIO({ attempt }: { attempt: AttemptDetailV3 }) {
  const enc = encodeURIComponent;
  const pipeline = useApiQuery<PipelineView>(`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}/pipeline`);
  const workflow = useApiQuery<WorkflowDetailV2>(`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}`);
  const leg = pipeline.data?.legs?.find(item => item.op === attempt.op) as LegRowV3 | undefined;
  const info = leg?.info ?? null;
  return <>
    <OpGoalCard attempt={attempt} info={info} loading={pipeline.loading} />
    <InputContextCard attempt={attempt} info={info} goal={workflow.data?.goal ?? null} />
  </>;
}
