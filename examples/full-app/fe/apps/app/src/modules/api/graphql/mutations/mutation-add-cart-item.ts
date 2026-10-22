import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { orderGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { MutationAddCartItemResponse, MutationAddCartItemRequest } from "./types/add-cart-item"

const mutation = graphql(`
    mutation AddCartItem($input: AddCartItemInput!) {
        addCartItem(input: $input) {
            item {
                productId
                quantity
            }
        }
    }
`)

/** Adds a quantity of a product to the person's cart; the order service accumulates per product and answers the line's new quantity. */
export const mutateAddCartItem = async ({
    request,
    signal,
}: OperationParams<MutationAddCartItemRequest>): Promise<GraphQLResponse<MutationAddCartItemResponse>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: orderGraphqlUrl(), auth: authClient, signal }).mutate({
            mutation,
            variables: { input: request },
        }),
        (data) => data.addCartItem,
    )
