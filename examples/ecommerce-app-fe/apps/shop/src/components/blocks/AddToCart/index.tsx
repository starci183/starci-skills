"use client"

import { useState } from "react"
import { addToCart } from "../../../modules/server-actions/add-to-cart"
import { AddToCartControlBase } from "./component"
import type { AddToCartControlBaseProps } from "./component"

/** The add-to-cart control's resolved inputs: the product it adds and every string it can render. */
export type AddToCartControlProps = Pick<AddToCartControlBaseProps["props"], "addLabel" | "addingLabel" | "inCartLabel" | "refusedLabel"> & {
    /** The catalog product id one press adds one of. */
    readonly productId: string
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
    return <AddToCartControlBase state="ready" props={{ ...props, quantity, refused, pending }} on={{ onPress }} />
}
