"use client"

import { useConfirmOrder, useDownloadReceipt } from "../../../hooks/cart"
import { ConfirmOrderBase } from "./component"
import type { ConfirmOrderBaseProps } from "./component"

/** The confirm control's attempt key, product names and resolved copy. */
type ConfirmOrderProps = Omit<
    ConfirmOrderBaseProps["props"],
    "outcome" | "confirmedTotal" | "pending" | "receiptFailure" | "receiptPending"
>

/** Owns one confirmation attempt and the receipt press of the order it confirmed, and hands both to the pure control. */
export const ConfirmOrder = (props: ConfirmOrderProps) => {
    const confirm = useConfirmOrder(props.attemptKey)
    const confirmedOrderId = confirm.props.outcome?.kind === "ok" ? confirm.props.outcome.data.orderId : ""
    const receipt = useDownloadReceipt(confirmedOrderId)
    return (
        <ConfirmOrderBase
            state="ready"
            props={{
                ...props,
                ...confirm.props,
                receiptFailure: receipt.props.failure,
                receiptPending: receipt.props.pending,
            }}
            on={{ onPress: confirm.on.onPress, onReceipt: receipt.on.onPress }}
        />
    )
}
