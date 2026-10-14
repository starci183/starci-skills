import useSWRMutation from "swr/mutation"
import type { GraphQLResponse } from "@ecommerce/api"
import { mutatePlaceOrder } from "@/modules/api/graphql/mutations/mutation-place-order"
import type {
    MutationPlaceOrderRequest,
    MutationPlaceOrderResponse,
} from "@/modules/api/graphql/mutations/types/place-order"
import { useAppSelector } from "@/redux"

/** What one trigger of the mutation carries: its request. */
type Trigger = { readonly arg: MutationPlaceOrderRequest }

/** The SWR key of the place-order mutation; the signed-in person is its identity. */
const MUTATE_PLACE_ORDER_SWR_KEY = "MUTATE_PLACE_ORDER_SWR"

/** Confirms the signed-in person's cart into an order under an idempotency key (order `placeOrder`). */
export const useMutatePlaceOrderSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWRMutation(
        [MUTATE_PLACE_ORDER_SWR_KEY, personId],
        (
            _key: ReadonlyArray<string | undefined>,
            { arg }: Trigger,
        ): Promise<GraphQLResponse<MutationPlaceOrderResponse>> => mutatePlaceOrder({ request: arg }),
    )
}
