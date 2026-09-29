import {
    Injectable
} from "@nestjs/common"
import {
    BuyerStatusResult, OrderService
} from "ecommerce-app-be/modules/domain/order"

@Injectable()
/**
 * Whether one person has confirmed orders, the answer contract.checkout.order-for-identity
 * publishes. An unknown person is not an error: no orders is the honest answer.
 */
export class BuyerStatusUseCase {
    constructor(private readonly orders: OrderService) {}

    execute(personId: string): Promise<BuyerStatusResult> {
        return this.orders.buyerStatus(personId)
    }
}
