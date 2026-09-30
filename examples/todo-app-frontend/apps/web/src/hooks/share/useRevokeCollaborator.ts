import useSWRMutation from "swr/mutation"
import { useSessionToken } from "@/hooks/auth"
import { revokeCollaborator } from "@/modules/share"

type RevokeCollaboratorMutationArg = { readonly arg: { readonly invitationId: string } }

/**
 * fr.share.revoke: revokes one pending or accepted invitation on the owner's own task. The mutation
 * shares the collaborators collection's own key, so an accepted revoke revalidates the list it just
 * changed; a refused one (an already closed invitation) surfaces on the mutation's own `error`.
 */
export const useRevokeCollaborator = (taskId: string) => {
    const token = useSessionToken()
    const revoke = useSWRMutation(
        token ? (taskId ? (["collaborators", taskId, token] as const) : null) : null,
        ([, , activeToken], { arg }: RevokeCollaboratorMutationArg) =>
            revokeCollaborator(activeToken, arg.invitationId),
    )
    return revoke
}
