"use client"

import { useConfirmOrder } from "../../../hooks/cart"
import { ConfirmOrderControlBase } from "./component"
import type { ConfirmOrderControlBaseProps } from "./component"

/** The confirm control's attempt key, product names and resolved copy. */
type ConfirmOrderControlProps = Omit<ConfirmOrderControlBaseProps["props"], "outcome" | "pending">

/** Owns one confirmation attempt and hands its answer to the pure control. */
export const ConfirmOrderControl = (props: ConfirmOrderControlProps) => {
    const confirm = useConfirmOrder(props.attemptKey)
    return <ConfirmOrderControlBase state="ready" props={{ ...props, ...confirm.props }} on={confirm.on} />
}
