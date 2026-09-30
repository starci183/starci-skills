import { useState } from "react"
import { useRouter } from "next/navigation"
import { clearCartAction } from "../../modules/server-actions"

/**
 * Owns the cart's clear press: it runs the real `clearCart` mutation and refreshes the server
 * render so the page re-reads the now-empty cart; a refusal is named inline and nothing is
 * pretended empty.
 */
export const useClearCart = () => {
    const router = useRouter()
    const [refused, setRefused] = useState(false)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void clearCartAction().then((outcome) => {
            setPending(false)
            if (outcome.ok) {
                setRefused(false)
                router.refresh()
            } else {
                setRefused(true)
            }
        })
    }
    return { props: { refused, pending }, on: { onPress } }
}
