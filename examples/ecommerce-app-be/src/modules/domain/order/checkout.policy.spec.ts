import type { ProductLookup } from "@modules/domain/catalog"
import { evaluateCheckout } from "./checkout.policy"
import { OrderErrorCode } from "./errors/order.error"

const products: ProductLookup = {
    mug: { id: "mug", name: "Mug", priceMinorUnits: 1299, stock: 5 },
    thermos: { id: "thermos", name: "Thermos", priceMinorUnits: 2499, stock: 2 },
}

describe("evaluateCheckout", () => {
    it("prices every line at the catalog unit price and totals them", () => {
        const outcome = evaluateCheckout(
            [
                { productId: "mug", quantity: 2 },
                { productId: "thermos", quantity: 1 },
            ],
            products,
        )
        expect(outcome).toEqual({
            kind: "ok",
            value: {
                lines: [
                    { productId: "mug", quantity: 2, unitPriceMinorUnits: 1299 },
                    { productId: "thermos", quantity: 1, unitPriceMinorUnits: 2499 },
                ],
                totalMinorUnits: 5097,
                currency: "USD",
            },
        })
    })

    it("refuses an empty cart", () => {
        expect(evaluateCheckout([], products)).toMatchObject({ kind: "refused", code: OrderErrorCode.CartEmpty })
    })

    it("refuses a product the catalog does not have and names it", () => {
        expect(evaluateCheckout([{ productId: "ghost", quantity: 1 }], products)).toEqual({
            kind: "refused",
            code: OrderErrorCode.UnknownProduct,
            params: { productId: "ghost" },
        })
    })

    it("refuses insufficient stock and says how much was asked and how much exists", () => {
        expect(evaluateCheckout([{ productId: "thermos", quantity: 3 }], products)).toEqual({
            kind: "refused",
            code: OrderErrorCode.InsufficientStock,
            params: { productId: "thermos", requested: 3, available: 2 },
        })
    })
})
