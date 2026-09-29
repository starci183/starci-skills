import {
    DomainError 
} from "../domain-error"
import {
    CheckoutRefusalException, CheckoutRefusalExceptionMetadata 
} from "./checkout-refusal"

describe("CheckoutRefusalException - sds.checkout.order-flow t-refuse",
    () => {
        const refusal = (metadata: CheckoutRefusalExceptionMetadata) => new CheckoutRefusalException({
            ...metadata 
        })

        it("is a DomainError carrying the stable code and the class name",
            () => {
                const error = refusal({
                    ok: false, reason: "cart-empty", productId: "" 
                })

                expect(error).toBeInstanceOf(DomainError)
                expect(error.code).toBe("CHECKOUT_REFUSAL_EXCEPTION")
                expect(error.name).toBe("CheckoutRefusalException")
            })

        it("names the reason in the sentence and carries the stock truth verbatim in metadata",
            () => {
                const error = refusal({
                    ok: false, reason: "insufficient-stock", productId: "sku-thermos", requested: 5, available: 2 
                })

                expect(error.message).toBe("The checkout was refused: insufficient-stock.")
                expect(error.metadata).toEqual({
                    ok: false,
                    reason: "insufficient-stock",
                    productId: "sku-thermos",
                    requested: 5,
                    available: 2,
                })
            })

        it("carries an unknown product's id",
            () => {
                const error = refusal({
                    ok: false, reason: "unknown-product", productId: "sku-ghost" 
                })

                expect(error.metadata).toMatchObject({
                    reason: "unknown-product", productId: "sku-ghost" 
                })
            })
    })
