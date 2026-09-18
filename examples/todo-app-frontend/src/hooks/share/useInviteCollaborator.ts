import useSWRMutation from 'swr/mutation';
import { useSessionToken } from '@/hooks/auth/useSessionToken';
import { inviteCollaboratorAndNotify, type ShareRole } from '@/modules/api/share';

type InviteCollaboratorMutationArg = { readonly arg: { readonly email: string; readonly role: ShareRole } };

/**
 * fr.share.invite: submits the entered email and viewer/editor role for the owner's own task. The
 * mutation shares the collaborators collection's own key, so an accepted submission revalidates the
 * list it just changed; a refused one surfaces on the mutation's own `error`, which the owning block
 * maps to ui.share.invite's refused state.
 */
export const useInviteCollaborator = (taskId: string) => {
  const token = useSessionToken();
  const invite = useSWRMutation(
    token ? (taskId ? (['collaborators', taskId, token] as const) : null) : null,
    ([, id, activeToken], { arg }: InviteCollaboratorMutationArg) => inviteCollaboratorAndNotify(activeToken, id, arg.email, arg.role),
  );
  return invite;
};
