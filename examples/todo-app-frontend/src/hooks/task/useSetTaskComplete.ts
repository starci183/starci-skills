import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth/useSessionToken';
import { setTaskCompleteAndNotify } from '@/modules/api/tasks';

type SetTaskCompleteMutationArg = { readonly arg: { readonly id: string; readonly complete: boolean } };

/** br.task.complete.once: completing twice is a no-op and reopening clears the timestamp; both are one call. */
export const useSetTaskComplete = () => {
  const token = useSessionToken();
  const setTaskComplete = useSWRMutation(
    token ? (['tasks', token] as const) : null,
    ([, activeToken], { arg }: SetTaskCompleteMutationArg) => setTaskCompleteAndNotify(activeToken, arg.id, arg.complete),
  );
  return setTaskComplete;
};
