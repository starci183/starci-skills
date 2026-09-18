import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth/use-session';
import { setTaskComplete as setTaskCompleteRequest } from '@/modules/api/tasks';

/** br.task.complete.once: completing twice is a no-op and reopening clears the timestamp; both are one call. */
export function useSetTaskComplete() {
  const token = useSessionToken();
  const setTaskComplete = useSWRMutation(
    token ? (['tasks', token] as const) : null,
    ([, activeToken], { arg }: { arg: { id: string; complete: boolean } }) => setTaskCompleteRequest(activeToken, arg.id, arg.complete),
  );
  return setTaskComplete;
}
