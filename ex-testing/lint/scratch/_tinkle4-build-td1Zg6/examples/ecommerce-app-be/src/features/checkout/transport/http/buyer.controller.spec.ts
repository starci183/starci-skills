import {
    Test 
} from "@nestjs/testing"
import {
    OrderService, BuyerStatusResult 
} from "@modules/bussiness/order/order.service"
import {
    BuyerController 
} from "./buyer.controller"

/**
 * The provider half of contract.checkout.order-for-identity in unit form - the door's answer
 * shape and its always-200 rule. The live pair (identity's client reading this route on the
 * running services) is scripts/live-proof.mjs.
 */
describe("BuyerController - contract.checkout.order-for-identity provider",
    () => {
        const orderService = {
            buyerStatus: jest.fn() 
        }
        let controller: BuyerController

        beforeEach(async () => {
            jest.clearAllMocks()
            const moduleRef = await Test.createTestingModule({
                providers: [BuyerController,
                    {
                        provide: OrderService, useValue: orderService 
                    }],
            }).compile()
            controller = moduleRef.get(BuyerController)
        })

        it("contract.checkout.order-for-identity provider: a person with orders answers hasOrders true",
            async () => {
                const answer: BuyerStatusResult = {
                    personId: "person-1", hasOrders: true 
                }
                orderService.buyerStatus.mockResolvedValue(answer)
                expect(await controller.status("person-1")).toEqual(answer)
                expect(orderService.buyerStatus).toHaveBeenCalledWith("person-1")
            })

        it("contract.checkout.order-for-identity provider: a person without orders answers hasOrders false, not a 404",
            async () => {
                const answer: BuyerStatusResult = {
                    personId: "person-2", hasOrders: false 
                }
                orderService.buyerStatus.mockResolvedValue(answer)
                expect(await controller.status("person-2")).toEqual(answer)
            })
    })
