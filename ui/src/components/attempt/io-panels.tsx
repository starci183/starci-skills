import { useApiQuery } from '../../api/query';
import type { AttemptDetailV3, LegRowV3, OpInfo, PipelineView, WorkflowDetailV2 } from '../../contract';
import type { Concept } from '../concept';
import { InputContextCard } from './context/input-context';
import { OpGoalCard } from './context/op-goal';

export const concept: Concept = 'C8';

/** Op contract info (goal, reads, writes) from the pipeline leg matching this attempt's op. `info` is null while loading or when the op has no yaml. */
export function useOpInfo(attempt: Pick<AttemptDetailV3, 'project' | 'wf' | 'op'>): { info: OpInfo | null; loading: boolean } {
  const enc = encodeURIComponent;
  const pipeline = useApiQuery<PipelineView>(`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}/pipeline`, { enabled: Boolean(attempt.project && attempt.wf) });
  const leg = pipeline.data?.legs?.find(item => item.op === attempt.op) as LegRowV3 | undefined;
  return { info: leg?.info ?? null, loading: pipeline.loading };
}

/** Essentials block "Op này làm gì". */
export function AttemptOpGoal({ attempt, info, loading }: { attempt: AttemptDetailV3; info: OpInfo | null; loading: boolean }) {
  return <OpGoalCard attempt={attempt} info={info} loading={loading} />;
}

/** Advanced block "Đầu vào & ngữ cảnh"; fetches the workflow goal only once it is mounted (i.e. opened). */
export function AttemptInputContext({ attempt, info }: { attempt: AttemptDetailV3; info: OpInfo | null }) {
  const enc = encodeURIComponent;
  const workflow = useApiQuery<WorkflowDetailV2>(`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}`);
  return <InputContextCard attempt={attempt} info={info} goal={workflow.data?.goal ?? null} />;
}

/** Blocks 2 and 3 together (kept for other callers). */
export function AttemptIO({ attempt }: { attempt: AttemptDetailV3 }) {
  const { info, loading } = useOpInfo(attempt);
  return <>
    <AttemptOpGoal attempt={attempt} info={info} loading={loading} />
    <AttemptInputContext attempt={attempt} info={info} />
  </>;
}
