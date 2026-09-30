import { useState } from "react"
import { isRecord } from "@ecommerce/api"
import { callDoor } from "../../modules/doors"

/**
 * Owns one product's add-to-cart press: the running quantity the service answered, the inline
 * refusal, and the pending flag. The press goes through the shop's cart door to the order service's
 * real `addCartItem`; nothing is optimistic.
 */
export const useAddToCart = (productId: string) => {
    const [quantity, setQuantity] = useState(0)
    const [refused, setRefused] = useState(false)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void callDoor("cartItems", "POST", { productId }).then((outcome) => {
            if (outcome.kind === "ok" && isRecord(outcome.data) && typeof outcome.data.quantity === "number") {
                setQuantity(outcome.data.quantity)
                setRefused(false)
            } else {
                setRefused(true)
            }
            setPending(false)
        })
    }
    return { props: { quantity, refused, pending }, on: { onPress } }
}
