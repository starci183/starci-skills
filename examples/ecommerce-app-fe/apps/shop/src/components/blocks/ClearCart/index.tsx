"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { clearCartAction } from "../../../modules/server-actions/clear-cart"
import { ClearCartControlBase } from "./component"
import type { ClearCartControlBaseProps } from "./component"

/** The clear-cart control's resolved inputs: every string it can render. */
export type ClearCartControlProps = Pick<ClearCartControlBaseProps["props"], "clearLabel" | "clearingLabel" | "refusedLabel">

/**
 * The cart's clear affordance. A press runs the real `clearCart` mutation and refreshes the server
 * render so the page re-reads the now-empty cart; a refusal is named inline and nothing is
 * pretended empty.
 */
export const ClearCartControl = (props: ClearCartControlProps) => {
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
    return <ClearCartControlBase state="ready" props={{ ...props, refused, pending }} on={{ onPress }} />
}
