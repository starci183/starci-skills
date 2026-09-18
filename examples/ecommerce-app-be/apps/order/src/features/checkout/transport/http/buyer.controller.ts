import { Controller, Get, Param } from '@nestjs/common';
import { BuyerStatusResult, OrderService } from '../../../../modules/bussiness/order';

/**
 * The provider half of contract.checkout.order-for-identity (the layout's cross-repo
 * contract.checkout.order-for-identity surface): GET /buyers/:personId answers whether that
 * person has confirmed orders - the one question the identity service asks this one, live, with
 * no shared database between the two services. An unknown person is not a 404 here: no orders
 * is the honest answer, and the consumer never reads this door for "who is this person".
 */
@Controller('buyers')
export class BuyerController {
  constructor(private readonly orders: OrderService) {}

  @Get(':personId')
  async status(@Param('personId') personId: string): Promise<BuyerStatusResult> {
    return this.orders.buyerStatus(personId);
  }
}
