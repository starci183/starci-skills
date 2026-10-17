import useSWR from "swr"
import type { GraphQLResponse } from "@ecommerce/api"
import { queryCart } from "@/modules/api/graphql/queries/query-cart"
import type { QueryCartResponse } from "@/modules/api/graphql/queries/types/cart"
import { useAppSelector } from "@/redux"

/** The cart snapshot consumed by presentation hooks. */
export type { QueryCartResponse } from "@/modules/api/graphql/queries/types/cart"

/** The SWR key of the cart query; the signed-in person is its identity. */
const QUERY_CART_SWR_KEY = "QUERY_CART_SWR"

/** The signed-in person's cart and the catalogue snapshot (order `cart`); no request while nobody is signed in. */
export const useQueryCartSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWR(
        personId === undefined ? null : [QUERY_CART_SWR_KEY, personId],
        (): Promise<GraphQLResponse<QueryCartResponse>> => queryCart(),
    )
}
