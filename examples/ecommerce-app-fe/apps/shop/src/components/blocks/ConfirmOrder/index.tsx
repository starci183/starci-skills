"use client"

import { useState } from "react"
import { placeOrderAction } from "../../../modules/server-actions/place-order"
import type { PlaceOrderOutcome } from "../../../modules/api/orders"
import { ConfirmOrderControlBase } from "./component"
import type { ConfirmOrderControlBaseProps } from "./component"

/** The confirm control's attempt key, product names and resolved copy. */
export type ConfirmOrderControlProps = Omit<ConfirmOrderControlBaseProps["props"], "outcome" | "pending">

/** Owns one confirmation attempt and hands its answer to the pure control. */
export const ConfirmOrderControl = (props: ConfirmOrderControlProps) => {
    const [outcome, setOutcome] = useState<PlaceOrderOutcome | null>(null)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void placeOrderAction(props.attemptKey).then((answer) => {
            setOutcome(answer)
            setPending(false)
        })
    }
    return <ConfirmOrderControlBase state="ready" props={{ ...props, outcome, pending }} on={{ onPress }} />
}
