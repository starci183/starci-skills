import useSWR from 'swr';
import { useSessionToken } from '@/hooks/auth/useSessionToken';
import { listCollaborators } from '@/modules/api/share';

/**
 * fr.share.list backs ui.share.invite's pending-list/accepted/refused states on this query. The key
 * carries the viewer's own token (`token`) and the task (`taskId`) so one signed-in person never reads
 * another person's or another task's cached rows, and it resolves to `null` - disabling the request -
 * the moment there is no session or task to read with.
 */
export const useCollaborators = (taskId: string) => {
  const token = useSessionToken();
  const collaboratorsQuery = useSWR(
    token ? (taskId ? (['collaborators', taskId, token] as const) : null) : null,
    ([, id, activeToken]) => listCollaborators(activeToken, id),
  );
  return collaboratorsQuery;
};
