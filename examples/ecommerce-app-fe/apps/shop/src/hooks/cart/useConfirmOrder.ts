import { useState } from "react"
import { placeOrderAction } from "../../modules/server-actions"
import type { PlaceOrderOutcome } from "../../modules/types"

/** Owns one confirmation attempt under the render's idempotency key and keeps its answer. */
export const useConfirmOrder = (attemptKey: string) => {
    const [outcome, setOutcome] = useState<PlaceOrderOutcome | null>(null)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void placeOrderAction(attemptKey).then((answer) => {
            setOutcome(answer)
            setPending(false)
        })
    }
    return { props: { outcome, pending }, on: { onPress } }
}
