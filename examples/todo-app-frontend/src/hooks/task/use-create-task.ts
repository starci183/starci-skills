import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth/use-session';
import { createTask as createTaskRequest } from '@/modules/api/tasks';

/** br.task.title.required is enforced server-side; this mutation only carries the trimmed title through. */
export function useCreateTask() {
  const token = useSessionToken();
  const createTask = useSWRMutation(
    token ? (['tasks', token] as const) : null,
    ([, activeToken], { arg }: { arg: { title: string } }) => createTaskRequest(activeToken, arg.title),
  );
  return createTask;
}
