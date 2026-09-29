import {
    Test 
} from "@nestjs/testing"
import {
    HttpStatus 
} from "@nestjs/common"
import {
    CheckoutRefusalException, CheckoutRefusalExceptionMetadata 
} from "./checkout-refusal"

describe("CheckoutRefusalException - sds.checkout.order-flow t-refuse",
    () => {
    // Not a provider - a pure exception value; the empty module boot keeps the TestingModule convention.
        const exception = (metadata: CheckoutRefusalExceptionMetadata) => new CheckoutRefusalException({
            ...metadata 
        })

        beforeEach(async () => {
            await Test.createTestingModule({
                providers: [] 
            }).compile()
        })

        it("insufficient-stock answers 409 CONFLICT: a retryable, inventory-bound refusal",
            () => {
                const error = exception({
                    ok: false, reason: "insufficient-stock", productId: "sku-thermos", requested: 5, available: 2 
                })
                expect(error.getStatus()).toBe(HttpStatus.CONFLICT)
                expect(error.getResponse()).toEqual({
                    code: "CHECKOUT_REFUSAL_EXCEPTION",
                    message: "The checkout was refused: insufficient-stock.",
                    ok: false,
                    reason: "insufficient-stock",
                    productId: "sku-thermos",
                    requested: 5,
                    available: 2,
                })
            })

        it("cart-empty answers 400 BAD_REQUEST carrying the refusal verbatim",
            () => {
                const error = exception({
                    ok: false, reason: "cart-empty", productId: "" 
                })
                expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
                expect(error.getResponse()).toMatchObject({
                    code: "CHECKOUT_REFUSAL_EXCEPTION", reason: "cart-empty" 
                })
            })

        it("unknown-product answers 400 BAD_REQUEST naming the product",
            () => {
                const error = exception({
                    ok: false, reason: "unknown-product", productId: "sku-ghost" 
                })
                expect(error.getStatus()).toBe(HttpStatus.BAD_REQUEST)
                expect(error.getResponse()).toMatchObject({
                    code: "CHECKOUT_REFUSAL_EXCEPTION", reason: "unknown-product", productId: "sku-ghost" 
                })
            })
    })
