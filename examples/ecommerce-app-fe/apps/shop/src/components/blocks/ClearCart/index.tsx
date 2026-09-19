"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button, Text } from "@starci/grammar/common"
import { clearCartAction } from "./actions"

/** The clear-cart control's resolved inputs: every string it can render. */
export type ClearCartControlProps = {
    /** The idle button label. */
    readonly clearLabel: string
    /** The pending label while the service answers. */
    readonly clearingLabel: string
    /** The refusal line shown when the service - or an absent session - refuses the clear. */
    readonly refusedLabel: string
}

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
    return (
        <>
            <Button
                variant="secondary"
                size="sm"
                onPress={onPress}
                isPending={pending}
                isDisabled={pending}
            >
                {pending ? props.clearingLabel : props.clearLabel}
            </Button>
            {refused ? (
                <Text as="span" size="sm" live="assertive">
                    {props.refusedLabel}
                </Text>
            ) : null}
        </>
    )
}
