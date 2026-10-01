"use client"

import { useClearCart } from "../../../hooks/cart"
import { ClearCartControlBase } from "./component"
import type { ClearCartControlBaseProps } from "./component"

/** The clear-cart control's resolved inputs: every string it can render. */
type ClearCartControlProps = Pick<ClearCartControlBaseProps["props"], "clearLabel" | "clearingLabel" | "refusedLabel">

/**
 * The cart's clear affordance. A press runs the real `clearCart` mutation and refreshes the server
 * render so the page re-reads the now-empty cart; a refusal is named inline and nothing is
 * pretended empty.
 */
export const ClearCartControl = (props: ClearCartControlProps) => {
    const clear = useClearCart()
    return <ClearCartControlBase state="ready" props={{ ...props, ...clear.props }} on={clear.on} />
}
