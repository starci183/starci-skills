import {
    Test 
} from "@nestjs/testing"
import {
    CartService 
} from "@modules/bussiness/cart/cart.service"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"

import {
    ClearCartResolver 
} from "./clear-cart.resolver"

describe("ClearCartResolver - the person-scoped clear-cart mutation",
    () => {
        const cartService = {
            clear: jest.fn() 
        }
        let resolver: ClearCartResolver

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    ClearCartResolver,
                    {
                        provide: CartService, useValue: cartService 
                    },
                    // The class-level @UseGuards binding instantiates the guard through DI; its own suite is session-guard.wiring.spec.ts.
                    {
                        provide: IdentityApiClient, useValue: {
                            verifySession: jest.fn() 
                        } 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(ClearCartResolver)
        })

        it("empties the actor's cart and answers the cleared flag",
            async () => {
                expect(await resolver.clearCart({
                    personId: "person-1" 
                })).toEqual({
                    cleared: true 
                })
                expect(cartService.clear).toHaveBeenCalledWith("person-1")
            })
    })
