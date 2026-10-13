import { useState } from "react"
import { useGraphQLWithToast } from "@/modules/toast"
import { useMutateAddCartItemSwr, useQueryCartSwr } from "../swr"

/**
 * Owns the add-to-cart presses of the catalogue: the running quantity the order service answered per product, the
 * products whose add it refused, and the product whose add is running. Each press runs the real `addCartItem` mutation;
 * nothing is optimistic, and the cart query revalidates after an add.
 */
export const useAddToCart = () => {
    const runGraphQL = useGraphQLWithToast()
    const cart = useQueryCartSwr()
    const add = useMutateAddCartItemSwr()
    const [quantities, setQuantities] = useState<Readonly<Record<string, number>>>({})
    const [refusedIds, setRefusedIds] = useState<ReadonlyArray<string>>([])
    const [pendingId, setPendingId] = useState<string | null>(null)
    const onAdd = (productId: string) => {
        setPendingId(productId)
        void runGraphQL(() => add.trigger({ productId, quantity: 1 }), { showSuccessToast: false }).then(
            async (response) => {
                setPendingId(null)
                setRefusedIds((ids) => [
                    ...ids.filter((id) => id !== productId),
                    ...(response.success ? [] : [productId]),
                ])
                if (!response.success) return
                setQuantities((current) => ({ ...current, [productId]: response.data.item.quantity }))
                await cart.mutate()
            },
        )
    }
    return { props: { quantities, refusedIds, pendingId }, on: { onAdd } }
}
