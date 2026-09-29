import {
    Test 
} from "@nestjs/testing"
import {
    mock 
} from "@starci/jest-preset/mock"
import {
    CartService 
} from "@modules/domain/cart/index"
import {
    IdentityApiClient 
} from "@modules/integrations/identity/index"

import {
    AddCartItemInput 
} from "./graphql-types/input"
import {
    AddCartItemResolver 
} from "./add-cart-item.resolver"

describe("AddCartItemResolver - the person-scoped add-to-cart mutation",
    () => {
        const cartService = mock<CartService>()
        let resolver: AddCartItemResolver

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [
                    AddCartItemResolver,
                    {
                        provide: CartService, useValue: cartService 
                    },
                    // The class-level @UseGuards binding instantiates the guard through DI; its own suite is session-guard.wiring.spec.ts.
                    {
                        provide: IdentityApiClient, useValue: mock<IdentityApiClient>()
                    },
                ],
            }).compile()
            resolver = moduleRef.get(AddCartItemResolver)
        })

        it("a product id and a positive integer quantity reaches the service",
            async () => {
                cartService.add.mockResolvedValue({
                    productId: "sku-mug", quantity: 3 
                })
                const input = {
                    productId: "sku-mug", quantity: 3 
                } as AddCartItemInput
                const result = await resolver.addCartItem({
                    personId: "person-1" 
                },
                input)
                expect(cartService.add).toHaveBeenCalledWith("person-1",
                    "sku-mug",
                    3)
                expect(result).toEqual({
                    item: {
                        productId: "sku-mug", quantity: 3 
                    } 
                })
            })

        it.each([
            [{
                productId: "", quantity: 2 
            }],
            [{
                productId: "sku-mug", quantity: 0 
            }],
            [{
                productId: "sku-mug", quantity: -1 
            }],
            [{
                productId: "sku-mug", quantity: 1.5 
            }],
        ])("input %j refuses REQUEST_INVALID without touching the cart",
            async (body) => {
                await expect(resolver.addCartItem({
                    personId: "person-1" 
                },
                body as AddCartItemInput)).rejects.toMatchObject({
                    name: "RequestInvalidException", code: "REQUEST_INVALID_EXCEPTION" 
                })
                expect(cartService.add).not.toHaveBeenCalled()
            })
    })
