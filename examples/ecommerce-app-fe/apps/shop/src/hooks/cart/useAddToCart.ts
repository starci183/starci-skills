import { useState } from "react"
import { addToCart } from "../../modules/server-actions"

/**
 * Owns one product's add-to-cart press: the running quantity the service answered, the inline
 * refusal, and the pending flag. The press goes through the server action to the order service's
 * real `addCartItem`; nothing is optimistic.
 */
export const useAddToCart = (productId: string) => {
    const [quantity, setQuantity] = useState(0)
    const [refused, setRefused] = useState(false)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void addToCart(productId).then((outcome) => {
            if (outcome.ok) {
                setQuantity(outcome.quantity)
                setRefused(false)
            } else {
                setRefused(true)
            }
            setPending(false)
        })
    }
    return { props: { quantity, refused, pending }, on: { onPress } }
}
