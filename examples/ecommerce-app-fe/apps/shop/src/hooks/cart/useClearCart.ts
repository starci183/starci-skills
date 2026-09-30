import { useState } from "react"
import { callDoor } from "../../modules/doors"
import { useLocaleRouter } from "../navigation"

/**
 * Owns the cart's clear press: it runs the real `clearCart` mutation through the shop's cart door and
 * refreshes the server render so the page re-reads the now-empty cart; a refusal is named inline and
 * nothing is pretended empty.
 */
export const useClearCart = () => {
    const router = useLocaleRouter()
    const [refused, setRefused] = useState(false)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void callDoor("cart", "DELETE").then((outcome) => {
            setPending(false)
            if (outcome.kind === "ok") {
                setRefused(false)
                router.refresh()
            } else {
                setRefused(true)
            }
        })
    }
    return { props: { refused, pending }, on: { onPress } }
}
