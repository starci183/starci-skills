"use client"

import { useConfirmOrder } from "../../../hooks/cart"
import { ConfirmOrderBase } from "./component"
import type { ConfirmOrderBaseProps } from "./component"

/** The confirm control's attempt key, product names and resolved copy. */
type ConfirmOrderProps = Omit<ConfirmOrderBaseProps["props"], "outcome" | "confirmedTotal" | "pending">

/** Owns one confirmation attempt and hands its answer to the pure control. */
export const ConfirmOrder = (props: ConfirmOrderProps) => {
    const confirm = useConfirmOrder(props.attemptKey)
    return <ConfirmOrderBase state="ready" props={{ ...props, ...confirm.props }} on={confirm.on} />
}
