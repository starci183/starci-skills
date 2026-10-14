import useSWR from "swr"
import type { GraphQLResponse } from "@ecommerce/api"
import { queryVerifySession } from "@/modules/api/graphql/queries/query-verify-session"
import type {
    QueryVerifySessionRequest,
    QueryVerifySessionResponse,
} from "@/modules/api/graphql/queries/types/verify-session"
import { authClient } from "@/modules/auth"
import { useAppSelector } from "@/redux"

/** The SWR key of the session check; the signed-in person is its identity. */
const QUERY_VERIFY_SESSION_SWR_KEY = "QUERY_VERIFY_SESSION_SWR"

/**
 * Checks the stored session at the identity service once per signed-in person (identity `verifySession`): a session the
 * service refuses as dead is ended locally, so every page settles as signed out. Runs app-wide from SwrSideEffects.
 */
export const useQueryVerifySessionSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWR(
        personId === undefined ? null : [QUERY_VERIFY_SESSION_SWR_KEY, personId],
        async (): Promise<GraphQLResponse<QueryVerifySessionResponse> | undefined> => {
            const sessionToken = await authClient.accessToken()
            if (sessionToken === undefined) return undefined
            const request: QueryVerifySessionRequest = { sessionToken }
            const response = await queryVerifySession({ request })
            if (!response.success && response.kind === "unauthenticated") authClient.end()
            return response
        },
    )
}
