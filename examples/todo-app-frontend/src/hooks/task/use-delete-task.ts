import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth/use-session';
import { deleteTask as deleteTaskRequest } from '@/modules/api/tasks';

/** br.task.delete.final: there is no undo, so the mutation never leaves a soft-deleted row behind. */
export function useDeleteTask() {
  const token = useSessionToken();
  const deleteTask = useSWRMutation(
    token ? (['tasks', token] as const) : null,
    ([, activeToken], { arg }: { arg: { id: string } }) => deleteTaskRequest(activeToken, arg.id),
  );
  return deleteTask;
}
