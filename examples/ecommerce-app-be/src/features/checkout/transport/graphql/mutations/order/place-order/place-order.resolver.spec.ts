import {
    Test 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    OrderService 
} from "@modules/domain/order/index"
import {
    CheckoutRefusalException 
} from "@modules/platform/errors/index"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/index"

import {
    PlaceOrderInput 
} from "./graphql-types/input"
import {
    PlaceOrderResolver 
} from "./place-order.resolver"

const PLACED = {
    orderId: "order-1", status: "confirmed" as const, totalMinorUnits: 2598, currency: "USD" as const, paymentId: "payment-1", replayed: false 
}

describe("PlaceOrderResolver - sds.checkout.order-flow t-confirm mutation",
    () => {
        const orderService = mock<OrderService>()
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
                        provide: IdentityApiClient, useValue: mock<IdentityApiClient>()
                    },
                ],
            }).compile()
            resolver = moduleRef.get(PlaceOrderResolver)
        })

        it("places the order for the verified person when no idempotency key arrives",
            async () => {
                orderService.place.mockResolvedValue(PLACED)
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
                    ...PLACED, replayed: true 
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
                orderService.place.mockResolvedValue(PLACED)
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
                await expect(resolver.placeOrder({
                    personId: "person-1" 
                },
                {
                } as PlaceOrderInput)).rejects.toMatchObject({
                    code: "CHECKOUT_REFUSAL_EXCEPTION", metadata: expect.objectContaining({
                        reason: "insufficient-stock" 
                    }) 
                })
            })
    })
