import { useState } from "react"
import { useFormatter } from "next-intl"
import { parseOutcome, type Outcome } from "@ecommerce/api"
import { callDoor } from "../../modules/doors"
import { toOrderConfirmation } from "../../modules/order"
import type { OrderConfirmation } from "../../modules/types"

/**
 * Owns one confirmation attempt under the render's idempotency key and keeps its answer, with the
 * confirmed order's total formatted in the reader's language.
 */
export const useConfirmOrder = (attemptKey: string) => {
    const format = useFormatter()
    const [outcome, setOutcome] = useState<Outcome<OrderConfirmation> | null>(null)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void callDoor("orders", "POST", { idempotencyKey: attemptKey }).then((answer) => {
            setOutcome(parseOutcome(answer, toOrderConfirmation))
            setPending(false)
        })
    }
    const confirmedTotal =
        outcome?.kind === "ok"
            ? format.number(outcome.data.totalMinorUnits / 100, { style: "currency", currency: outcome.data.currency })
            : ""
    return { props: { outcome, confirmedTotal, pending }, on: { onPress } }
}
