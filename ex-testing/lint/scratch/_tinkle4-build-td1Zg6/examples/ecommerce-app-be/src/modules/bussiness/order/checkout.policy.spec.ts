import {
    Test 
} from "@nestjs/testing"
import {
    CheckoutPolicy, CartLineParams, ProductStockParams 
} from "./checkout.policy"

describe("CheckoutPolicy - sds.checkout.order-flow t-stock",
    () => {
        let policy: CheckoutPolicy
        const products: Record<string, ProductStockParams | undefined> = {
            "sku-mug": {
                priceMinorUnits: 1299, stock: 40 
            },
            "sku-thermos": {
                priceMinorUnits: 2499, stock: 2 
            },
        }

        beforeEach(async () => {
            const moduleRef = await Test.createTestingModule({
                providers: [CheckoutPolicy] 
            }).compile()
            policy = moduleRef.get(CheckoutPolicy)
        })

        it("fr.checkout.place-order plans a cart in minor units: totals and per-line unit prices",
            () => {
                const cart: Array<CartLineParams> = [
                    {
                        productId: "sku-mug", quantity: 2 
                    },
                    {
                        productId: "sku-thermos", quantity: 1 
                    },
                ]
                const plan = policy.evaluate(cart,
                    products)
                expect(plan).toEqual({
                    ok: true,
                    lines: [
                        {
                            productId: "sku-mug", quantity: 2, unitPriceMinorUnits: 1299 
                        },
                        {
                            productId: "sku-thermos", quantity: 1, unitPriceMinorUnits: 2499 
                        },
                    ],
                    totalMinorUnits: 1299 * 2 + 2499,
                    currency: "USD",
                })
            })

        it("ac.checkout.place-order.empty-cart-is-refused",
            () => {
                const refusal = policy.evaluate([],
                    products)
                expect(refusal).toEqual({
                    ok: false, reason: "cart-empty", productId: "" 
                })
            })

        it("a line with a non-positive quantity reads as an empty cart for that product",
            () => {
                const refusal = policy.evaluate([{
                    productId: "sku-mug", quantity: 0 
                }],
                products)
                expect(refusal).toEqual({
                    ok: false, reason: "cart-empty", productId: "sku-mug" 
                })
            })

        it("ac.checkout.place-order.stock-is-checked-at-confirmation: the refusal names the product and the truth",
            () => {
                const refusal = policy.evaluate([{
                    productId: "sku-thermos", quantity: 5 
                }],
                products)
                expect(refusal).toEqual({
                    ok: false,
                    reason: "insufficient-stock",
                    productId: "sku-thermos",
                    requested: 5,
                    available: 2,
                })
            })

        it("a line asking exactly the stock on hand plans - the boundary is inclusive",
            () => {
                const plan = policy.evaluate([{
                    productId: "sku-thermos", quantity: 2 
                }],
                products)
                expect(plan).toEqual({
                    ok: true,
                    lines: [{
                        productId: "sku-thermos", quantity: 2, unitPriceMinorUnits: 2499 
                    }],
                    totalMinorUnits: 4998,
                    currency: "USD",
                })
            })

        it("one unit above the stock on hand is the first refusal past the boundary",
            () => {
                const refusal = policy.evaluate([{
                    productId: "sku-thermos", quantity: 3 
                }],
                products)
                expect(refusal).toEqual({
                    ok: false,
                    reason: "insufficient-stock",
                    productId: "sku-thermos",
                    requested: 3,
                    available: 2,
                })
            })

        it("a zero-stock product refuses even a single unit, naming zero availability",
            () => {
                const refusal = policy.evaluate([{
                    productId: "sku-mug", quantity: 1 
                }],
                {
                    "sku-mug": {
                        priceMinorUnits: 1299, stock: 0 
                    },
                })
                expect(refusal).toEqual({
                    ok: false,
                    reason: "insufficient-stock",
                    productId: "sku-mug",
                    requested: 1,
                    available: 0,
                })
            })

        it("sds.checkout.order-flow t-refuse: an unknown product is a named refusal, never a partial order",
            () => {
                const refusal = policy.evaluate([{
                    productId: "sku-ghost", quantity: 1 
                }],
                products)
                expect(refusal).toEqual({
                    ok: false, reason: "unknown-product", productId: "sku-ghost" 
                })
            })

        it("the first failing line names the refusal - later lines never become a partial plan",
            () => {
                const refusal = policy.evaluate(
                    [
                        {
                            productId: "sku-mug", quantity: 1 
                        },
                        {
                            productId: "sku-thermos", quantity: 99 
                        },
                    ],
                    products,
                )
                expect(refusal).toMatchObject({
                    ok: false, reason: "insufficient-stock", productId: "sku-thermos" 
                })
            })
    })
