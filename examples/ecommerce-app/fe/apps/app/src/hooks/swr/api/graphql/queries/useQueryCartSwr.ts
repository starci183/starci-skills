import useSWR from "swr"
import { queryCart } from "@/modules/api"
import { useAppSelector } from "@/redux"

/** The SWR key of the cart query; the signed-in person is its identity. */
const QUERY_CART_SWR_KEY = "QUERY_CART_SWR"

/** The signed-in person's cart and the catalogue snapshot (order `cart`); no request while nobody is signed in. */
export const useQueryCartSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWR(personId === undefined ? null : [QUERY_CART_SWR_KEY, personId], () => queryCart())
}
