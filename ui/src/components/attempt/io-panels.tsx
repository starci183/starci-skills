import { useApiQuery } from '../../api/query';
import type { AttemptDetailV3, LegRowV3, OpInfo, PipelineView, WorkflowDetailV2 } from '../../contract';
import type { Concept } from '../concept';
import { InputContextCard } from './context/input-context';
import { OpGoalCard } from './context/op-goal';
import { ReadWarning } from './frame/read-warning';

export const concept: Concept = 'C8';

/** Op contract info (goal, reads, writes) from the pipeline leg matching this attempt's op. `info` is null while loading or when the op has no yaml. */
export function useOpInfo(attempt: Pick<AttemptDetailV3, 'project' | 'wf' | 'op'>) {
  const enc = encodeURIComponent;
  const pipeline = useApiQuery<PipelineView>(`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}/pipeline`, { enabled: Boolean(attempt.project && attempt.wf) });
  const leg = pipeline.data?.legs?.find(item => item.op === attempt.op) as LegRowV3 | undefined;
  return { info: leg?.info ?? null, loading: pipeline.loading, read: pipeline,
    url: `/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}/pipeline` };
}

/** Essentials block "What this op does". */
export function AttemptOpGoal({ attempt, info, loading, reference }: Readonly<{ attempt: AttemptDetailV3; info: OpInfo | null; loading: boolean; reference?: ReturnType<typeof useOpInfo> }>) {
  return <div className="grid gap-3">{reference ? <ReadWarning read={reference.read} url={reference.url} retained={Boolean(info)} /> : null}<OpGoalCard attempt={attempt} info={info} loading={loading} /></div>;
}

/** Advanced block "Inputs & context"; fetches the workflow goal only once it is mounted (i.e. opened). */
export function AttemptInputContext({ attempt, info }: Readonly<{ attempt: AttemptDetailV3; info: OpInfo | null }>) {
  const enc = encodeURIComponent;
  const workflow = useApiQuery<WorkflowDetailV2>(`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}`);
  return <div className="grid gap-3"><ReadWarning read={workflow} url={`/api/workflows/${enc(attempt.project)}/${enc(attempt.wf)}`} retained={Boolean(workflow.data)} /><InputContextCard attempt={attempt} info={info} goal={workflow.data?.goal ?? null} /></div>;
}

/** Blocks 2 and 3 together (kept for other callers). */
export function AttemptIO({ attempt }: Readonly<{ attempt: AttemptDetailV3 }>) {
  const reference = useOpInfo(attempt);
  const { info, loading } = reference;
  return <>
    <AttemptOpGoal attempt={attempt} info={info} loading={loading} reference={reference} />
    <AttemptInputContext attempt={attempt} info={info} />
  </>;
}
