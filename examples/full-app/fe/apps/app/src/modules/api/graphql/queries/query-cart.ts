import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { orderGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { QueryCartResponse } from "./types/cart"

const query = graphql(`
    query Cart {
        cart {
            items {
                productId
                quantity
            }
            catalog {
                id
                name
                priceMinorUnits
                stock
            }
        }
    }
`)

/** The signed-in person's cart with the catalogue snapshot it is read against - the only door the order service serves the catalogue through. */
export const queryCart = async ({ signal }: { readonly signal?: AbortSignal } = {}): Promise<
    GraphQLResponse<QueryCartResponse>
> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: orderGraphqlUrl(), auth: authClient, signal }).query({ query }),
        (data) => data.cart,
    )
