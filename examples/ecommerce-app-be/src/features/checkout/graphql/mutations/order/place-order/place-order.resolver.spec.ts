import {
    Test 
} from "@nestjs/testing"
import {
    HttpException, HttpStatus 
} from "@nestjs/common"
import {
    OrderService 
} from "@modules/bussiness/order/order.service"
import {
    CheckoutRefusalException 
} from "@modules/platform/exceptions/errors/checkout/checkout-refusal"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"

import {
    PlaceOrderInput 
} from "./graphql-types/input"
import {
    PlaceOrderResolver 
} from "./place-order.resolver"

describe("PlaceOrderResolver - sds.checkout.order-flow t-confirm mutation",
    () => {
        const orderService = {
            place: jest.fn() 
        }
        let resolver: PlaceOrderResolver

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    PlaceOrderResolver,
                    {
                        provide: OrderService, useValue: orderService 
                    },
                    // The class-level @UseGuards binding instantiates the guard through DI; its own suite is session-guard.wiring.spec.ts.
                    {
                        provide: IdentityApiClient, useValue: {
                            verifySession: jest.fn() 
                        } 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(PlaceOrderResolver)
        })

        it("places the order for the verified person when no idempotency key arrives",
            async () => {
                orderService.place.mockResolvedValue({
                    orderId: "order-1", status: "confirmed", totalMinorUnits: 2598, currency: "USD", paymentId: "payment-1", replayed: false 
                })
                const result = await resolver.placeOrder({
                    personId: "person-1" 
                },
                {
                } as PlaceOrderInput)
                expect(orderService.place).toHaveBeenCalledWith("person-1",
                    undefined)
                expect(result.orderId).toBe("order-1")
            })

        it("forwards a trimmed input idempotencyKey to the service",
            async () => {
                orderService.place.mockResolvedValue({
                    orderId: "order-1", replayed: true 
                })
                await resolver.placeOrder({
                    personId: "person-1" 
                },
                {
                    idempotencyKey: "  key-1  " 
                } as PlaceOrderInput)
                expect(orderService.place).toHaveBeenCalledWith("person-1",
                    "key-1")
            })

        it.each([
            [{
                idempotencyKey: "" 
            }],
            [{
                idempotencyKey: "   " 
            }],
        ])("treats %j as no key at all",
            async (input) => {
                orderService.place.mockResolvedValue({
                    orderId: "order-1" 
                })
                await resolver.placeOrder({
                    personId: "person-1" 
                },
                input as PlaceOrderInput)
                expect(orderService.place).toHaveBeenCalledWith("person-1",
                    undefined)
            })

        it("a named checkout refusal from the service reaches the caller as the refusal, not an empty order",
            async () => {
                orderService.place.mockRejectedValue(
                    new CheckoutRefusalException({
                        ok: false, reason: "insufficient-stock", productId: "sku-thermos", requested: 5, available: 2 
                    }),
                )
                try {
                    await resolver.placeOrder({
                        personId: "person-1" 
                    },
                    {
                    } as PlaceOrderInput)
                    throw new Error("the call should have failed")
                } catch (error) {
                    expect(error).toBeInstanceOf(HttpException)
                    expect((error as HttpException).getStatus()).toBe(HttpStatus.CONFLICT)
                    expect((error as HttpException).getResponse()).toMatchObject({
                        code: "CHECKOUT_REFUSAL_EXCEPTION", reason: "insufficient-stock" 
                    })
                }
            })
    })
