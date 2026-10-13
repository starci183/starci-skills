import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { orderGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { MutationClearCartResponse } from "./types/clear-cart"

const mutation = graphql(`
    mutation ClearCart {
        clearCart {
            cleared
        }
    }
`)

/** Empties the person's cart: the only removal the order service exposes. */
export const mutateClearCart = async ({ signal }: { readonly signal?: AbortSignal } = {}): Promise<
    GraphQLResponse<MutationClearCartResponse>
> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: orderGraphqlUrl(), auth: authClient, signal }).mutate({ mutation }),
        (data) => data.clearCart,
    )
