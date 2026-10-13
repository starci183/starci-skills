import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { identityGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { MutationRevokeSessionResponse, MutationRevokeSessionRequest } from "./types/revoke-session"

const mutation = graphql(`
    mutation RevokeSession($input: RevokeSessionInput!) {
        revokeSession(input: $input) {
            revoked
        }
    }
`)

/** Ends a session at the identity service that owns it. */
export const mutateRevokeSession = async ({
    request,
    signal,
}: OperationParams<MutationRevokeSessionRequest>): Promise<GraphQLResponse<MutationRevokeSessionResponse>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: identityGraphqlUrl(), auth: authClient, signal }).mutate({
            mutation,
            variables: { input: request },
        }),
        (data) => data.revokeSession,
    )
