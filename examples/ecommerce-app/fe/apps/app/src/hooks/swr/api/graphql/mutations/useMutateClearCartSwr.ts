import useSWRMutation from "swr/mutation"
import type { GraphQLResponse } from "@ecommerce/api"
import { mutateClearCart } from "@/modules/api/graphql/mutations/mutation-clear-cart"
import type { MutationClearCartResponse } from "@/modules/api/graphql/mutations/types/clear-cart"
import { useAppSelector } from "@/redux"

/** The SWR key of the clear-cart mutation; the signed-in person is its identity. */
const MUTATE_CLEAR_CART_SWR_KEY = "MUTATE_CLEAR_CART_SWR"

/** Empties the signed-in person's cart (order `clearCart`). */
export const useMutateClearCartSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWRMutation(
        [MUTATE_CLEAR_CART_SWR_KEY, personId],
        (): Promise<GraphQLResponse<MutationClearCartResponse>> => mutateClearCart(),
    )
}
