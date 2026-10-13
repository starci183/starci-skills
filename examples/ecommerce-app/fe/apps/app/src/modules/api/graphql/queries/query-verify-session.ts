import { createNoAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { identityGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { QueryVerifySessionResponse, QueryVerifySessionRequest } from "./types/verify-session"

const query = graphql(`
    query VerifySession($input: VerifySessionInput!) {
        verifySession(input: $input) {
            personId
        }
    }
`)

/** Asks the identity service whether a session bearer is live; a dead one is refused with `SESSION_INVALID`. The token travels in the input, so the call is public. */
export const queryVerifySession = async ({
    request,
    signal,
}: OperationParams<QueryVerifySessionRequest>): Promise<GraphQLResponse<QueryVerifySessionResponse>> =>
    graphqlResponseOf(
        await createNoAuthApolloClient({ uri: identityGraphqlUrl(), signal }).query({
            query,
            variables: { input: request },
        }),
        (data) => data.verifySession,
    )
