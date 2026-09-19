import {
    Test 
} from "@nestjs/testing"
import {
    CartService 
} from "@modules/bussiness/cart/cart.service"
import {
    CatalogService 
} from "@modules/bussiness/catalog/catalog.service"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/identity.client"

import {
    CartResolver 
} from "./cart.resolver"

describe("CartResolver - the person-scoped cart query",
    () => {
        const cartService = {
            list: jest.fn() 
        }
        const catalogService = {
            list: jest.fn() 
        }
        let resolver: CartResolver

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    CartResolver,
                    {
                        provide: CartService, useValue: cartService 
                    },
                    {
                        provide: CatalogService, useValue: catalogService 
                    },
                    // The class-level @UseGuards binding instantiates the guard through DI; its own suite is session-guard.wiring.spec.ts.
                    {
                        provide: IdentityApiClient, useValue: {
                            verifySession: jest.fn() 
                        } 
                    },
                ],
            }).compile()
            resolver = moduleRef.get(CartResolver)
        })

        it("answers the actor's items alongside the catalog for rendering",
            async () => {
                cartService.list.mockResolvedValue([{
                    productId: "sku-mug", quantity: 2 
                }])
                catalogService.list.mockResolvedValue([{
                    id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                }])

                const result = await resolver.cart({
                    personId: "person-1" 
                })

                expect(cartService.list).toHaveBeenCalledWith("person-1")
                expect(result).toEqual({
                    items: [{
                        productId: "sku-mug", quantity: 2 
                    }],
                    catalog: [{
                        id: "sku-mug", name: "Mug", priceMinorUnits: 1299, stock: 40 
                    }],
                })
            })
    })
