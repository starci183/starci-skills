"use client"

import { useState } from "react"
import { Button, Text } from "@starci/grammar/common"
import { addToCart } from "./actions"

/** The add-to-cart control's resolved inputs: the product it adds and every string it can render. */
export type AddToCartControlProps = {
    /** The catalog product id one press adds one of. */
    readonly productId: string
    /** The idle button label. */
    readonly addLabel: string
    /** The pending label while the service answers. */
    readonly addingLabel: string
    /** The running-count line, with `{count}` where the line's total quantity lands. */
    readonly inCartLabel: string
    /** The refusal line shown when the service - or an absent session - refuses the add. */
    readonly refusedLabel: string
}

/**
 * One tile's add-to-cart affordance. A press goes through the server action to the order service's
 * real `addCartItem`; the answered line quantity is shown as the running count, a refusal is named
 * inline, and the button stays honest while the call is pending - no optimistic "added".
 */
export const AddToCartControl = (props: AddToCartControlProps) => {
    const [quantity, setQuantity] = useState(0)
    const [refused, setRefused] = useState(false)
    const [pending, setPending] = useState(false)
    const onPress = () => {
        setPending(true)
        void addToCart(props.productId).then((outcome) => {
            if (outcome.ok) {
                setQuantity(outcome.quantity)
                setRefused(false)
            } else {
                setRefused(true)
            }
            setPending(false)
        })
    }
    return (
        <>
            <Button
                variant="primary"
                size="sm"
                onPress={onPress}
                isPending={pending}
                isDisabled={pending}
            >
                {pending ? props.addingLabel : props.addLabel}
            </Button>
            {quantity > 0 ? (
                <Text as="p" size="sm" tone="muted">
                    {props.inCartLabel.replace("{count}", String(quantity))}
                </Text>
            ) : null}
            {refused ? (
                <Text as="p" size="sm" live="assertive">
                    {props.refusedLabel}
                </Text>
            ) : null}
        </>
    )
}
