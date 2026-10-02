import { useState } from "react"
import { parseOutcome } from "@ecommerce/api"
import { callDoor } from "../../modules/doors"
import { toReceiptLink } from "../../modules/order"

/** Why the last receipt press did not download: the archive has not taken the receipt yet, or the session may not read it. */
export type ReceiptFailure = "notReady" | "refused" | null

/**
 * Owns the receipt press of one confirmed order: it asks the shop's receipt door for a fresh download link and sends the
 * browser to it. A receipt the archive has not taken yet is named as not ready (a press later succeeds); any other
 * refusal is named as refused.
 */
export const useDownloadReceipt = (orderId: string) => {
    const [failure, setFailure] = useState<ReceiptFailure>(null)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void callDoor("orderReceipt", "POST", { orderId }).then((answer) => {
            const outcome = parseOutcome(answer, toReceiptLink)
            setPending(false)
            if (outcome.kind === "ok") {
                setFailure(null)
                window.location.assign(outcome.data.url)
                return
            }
            setFailure(
                outcome.kind === "invalid" && outcome.code === "ORDER_RECEIPT_NOT_READY" ? "notReady" : "refused",
            )
        })
    }
    return { props: { failure, pending }, on: { onPress } }
}
