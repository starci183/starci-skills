import useSWRMutation from "swr/mutation"
import { mutateRevokeSession } from "@/modules/api"
import type { MutationRevokeSessionRequest } from "@/modules/api"

/** What one trigger of the mutation carries: its request. */
type Trigger = { readonly arg: MutationRevokeSessionRequest }

/** The SWR key of the `revokeSession` mutation. */
const MUTATE_REVOKE_SESSION_SWR_KEY = "MUTATE_REVOKE_SESSION_SWR"

/** Ends a session at the identity service (identity `revokeSession`). */
export const useMutateRevokeSessionSwr = () =>
    useSWRMutation(MUTATE_REVOKE_SESSION_SWR_KEY, (_key: string, { arg }: Trigger) =>
        mutateRevokeSession({ request: arg }),
    )
