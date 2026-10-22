import { createAuthApolloClient, graphqlResponseOf } from "@ecommerce/api"
import type { GraphQLResponse, OperationParams } from "@ecommerce/api"
import { authClient } from "@/modules/auth"
import { orderGraphqlUrl } from "@/modules/config"
import { graphql } from "../__generated__"
import type { MutationPlaceOrderResponse, MutationPlaceOrderRequest } from "./types/place-order"

const mutation = graphql(`
    mutation PlaceOrder($input: PlaceOrderInput!) {
        placeOrder(input: $input) {
            orderId
            status
            totalMinorUnits
            currency
            replayed
        }
    }
`)

/** Confirms the person's cart into an order under an idempotency key: the same key answers the first confirmation with `replayed: true` instead of writing a second order. A named refusal (`ORDER_CART_EMPTY`, `ORDER_UNKNOWN_PRODUCT`, `ORDER_INSUFFICIENT_STOCK`) carries its parameters. */
export const mutatePlaceOrder = async ({
    request,
    signal,
}: OperationParams<MutationPlaceOrderRequest>): Promise<GraphQLResponse<MutationPlaceOrderResponse>> =>
    graphqlResponseOf(
        await createAuthApolloClient({ uri: orderGraphqlUrl(), auth: authClient, signal }).mutate({
            mutation,
            variables: { input: request },
        }),
        (data) => data.placeOrder,
    )
