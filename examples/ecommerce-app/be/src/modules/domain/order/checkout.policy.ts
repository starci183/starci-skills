import type { CartLine } from "@modules/domain/cart"
import type { ProductLookup } from "@modules/domain/catalog"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { OrderErrorCode } from "./errors/order.error"
import type { CheckoutLine, CheckoutPlan } from "./order.contracts"

/**
 * The pure decision of a checkout: what a cart and the catalog truth yield, a plan with every line priced and one
 * total, or the named refusal. No I/O: the transaction re-checks stock with a guarded decrement, so a race between
 * evaluation and decrement still refuses.
 */
export const evaluateCheckout = (
    cart: ReadonlyArray<CartLine>,
    products: ProductLookup,
): Outcome<CheckoutPlan, OrderErrorCode> => {
    if (cart.length === 0) return refused(OrderErrorCode.CartEmpty)
    const lines: Array<CheckoutLine> = []
    let totalMinorUnits = 0
    for (const line of cart) {
        const product = products[line.productId]
        if (!product) return refused(OrderErrorCode.UnknownProduct, { productId: line.productId })
        if (product.stock < line.quantity) {
            return refused(OrderErrorCode.InsufficientStock, {
                productId: line.productId,
                requested: line.quantity,
                available: product.stock,
            })
        }
        lines.push({ productId: line.productId, quantity: line.quantity, unitPriceMinorUnits: product.priceMinorUnits })
        totalMinorUnits += product.priceMinorUnits * line.quantity
    }
    return ok<CheckoutPlan>({ lines, totalMinorUnits, currency: "USD" })
}
