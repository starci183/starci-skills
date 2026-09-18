import useSWR from 'swr';
import { useSessionToken } from '@/hooks/auth/useSessionToken';
import { listTasks } from '@/modules/api/tasks';

/**
 * The task breadcrumb and subtitle on ui.share.invite name the task being shared. The backend exposes
 * no single-task read, so this resolves the title from the viewer's own task list - the same
 * `listTasks` the tasks screen uses - and yields `null` when the task is not among the viewer's own.
 * The title is page furniture, not the screen's subject, so a refused read degrades to no title rather
 * than to the screen's refused state.
 */
export const useTaskTitle = (taskId: string) => {
  const token = useSessionToken();
  const taskTitleQuery = useSWR(
    token ? (taskId ? (['task-title', taskId, token] as const) : null) : null,
    async ([, id, activeToken]): Promise<string | null> => {
      const tasks = await listTasks(activeToken);
      return tasks.find(task => task.id === id)?.title ?? null;
    },
  );
  return taskTitleQuery;
};
