import useSWR, { SWRResponse } from 'swr';
import { useSessionToken } from '@/hooks/auth/use-session';
import { listTasks, type Task } from '@/modules/api/tasks';

/**
 * ui.task.list backs its empty/one-task/many-tasks/refused states on this query. The key carries the
 * viewer's own token (`token`) so one signed-in person never reads another person's cached rows, and it
 * resolves to `null` - disabling the request - the moment there is no session to read with.
 */
export function useTasks(): SWRResponse<Task[]> {
  const token = useSessionToken();
  const tasksQuery = useSWR(token ? (['tasks', token] as const) : null, ([, activeToken]) => listTasks(activeToken));
  return tasksQuery;
}
