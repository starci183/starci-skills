import {
    Controller, Get, Param 
} from "@nestjs/common"
import {
    BuyerStatusResult, OrderService 
} from "@modules/bussiness/order/order.service"

@Controller("internal/buyers")
/**
 * The provider half of contract.checkout.order-for-identity (the layout's cross-repo
 * contract.checkout.order-for-identity surface): GET /internal/buyers/:personId answers whether
 * that person has confirmed orders - the one question the identity service asks this one, live,
 * with no shared database between the two services and no user session to carry. An unknown
 * person is not a 404 here: no orders is the honest answer, and the consumer never reads this
 * door for "who is this person".
 */
export class BuyerController {
    constructor(private readonly orders: OrderService) {}

  @Get(":personId")
    async status(@Param("personId") personId: string): Promise<BuyerStatusResult> {
        return this.orders.buyerStatus(personId)
    }
}
