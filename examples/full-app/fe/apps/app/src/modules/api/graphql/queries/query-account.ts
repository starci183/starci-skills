import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { identityGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { QueryAccountResponse } from "./types/account"

const query = graphql(`
    query Account {
        account {
            personId
            email
            hasOrders
        }
    }
`)

/** The caller's own account behind the session bearer: the person, the email they registered and whether the order service knows them as a buyer. */
export const queryAccount = async ({ signal }: { readonly signal?: AbortSignal } = {}): Promise<
    GraphQLResponse<QueryAccountResponse>
> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: identityGraphqlUrl(), auth: authClient, signal }).query({ query }),
        (data) => data.account,
    )
