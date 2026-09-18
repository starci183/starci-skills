import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth/useSessionToken';
import { deleteTaskAndNotify } from '@/modules/api/tasks';

type DeleteTaskMutationArg = { readonly arg: { readonly id: string } };

/** br.task.delete.final: there is no undo, so the mutation never leaves a soft-deleted row behind. */
export const useDeleteTask = () => {
  const token = useSessionToken();
  const deleteTask = useSWRMutation(
    token ? (['tasks', token] as const) : null,
    ([, activeToken], { arg }: DeleteTaskMutationArg) => deleteTaskAndNotify(activeToken, arg.id),
  );
  return deleteTask;
};
