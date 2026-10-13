import type { PlaceOrderMutation, PlaceOrderMutationVariables } from "../../__generated__/graphql"

/** The confirmation of the placed or replayed order. */
export type MutationPlaceOrderResponse = PlaceOrderMutation["placeOrder"]

/** The input of `placeOrder`. */
export type MutationPlaceOrderRequest = PlaceOrderMutationVariables["input"]
