"use client"

import { useAddToCart } from "../../../hooks/cart"
import { AddToCartControlBase } from "./component"
import type { AddToCartControlBaseProps } from "./component"

/** The add-to-cart control's resolved inputs: the product it adds and every string it can render. */
type AddToCartControlProps = Pick<
    AddToCartControlBaseProps["props"],
    "addLabel" | "addingLabel" | "inCartLabel" | "refusedLabel"
> & {
    /** The catalog product id one press adds one of. */
    readonly productId: string
}

/**
 * One tile's add-to-cart affordance. A press goes through the server action to the order service's
 * real `addCartItem`; the answered line quantity is shown as the running count, a refusal is named
 * inline, and the button stays honest while the call is pending - no optimistic "added".
 */
export const AddToCartControl = (props: AddToCartControlProps) => {
    const add = useAddToCart(props.productId)
    return <AddToCartControlBase state="ready" props={{ ...props, ...add.props }} on={add.on} />
}
