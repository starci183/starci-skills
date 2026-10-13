import useSWRMutation from "swr/mutation"
import { mutateAddCartItem } from "@/modules/api"
import type { MutationAddCartItemRequest } from "@/modules/api"
import { useAppSelector } from "@/redux"

/** What one trigger of the mutation carries: the product and the quantity to add. */
type Trigger = { readonly arg: MutationAddCartItemRequest }

/** The SWR key of the add-to-cart mutation; the signed-in person is its identity. */
const MUTATE_ADD_CART_ITEM_SWR_KEY = "MUTATE_ADD_CART_ITEM_SWR"

/** Adds a quantity of a product to the signed-in person's cart (order `addCartItem`). */
export const useMutateAddCartItemSwr = () => {
    const personId = useAppSelector((state) => state.session.session?.personId)
    return useSWRMutation(
        [MUTATE_ADD_CART_ITEM_SWR_KEY, personId],
        (_key: ReadonlyArray<string | undefined>, { arg }: Trigger) => mutateAddCartItem({ request: arg }),
    )
}
