import { Controller, Get, HttpException, HttpStatus, Param } from '@nestjs/common';
import { AccountResult, AccountService } from '../../../../modules/bussiness/account';
import { BuyerStatusResult, OrderApiClient } from '../../../../modules/integrations/order';

export interface AccountWithBuyerStatusResult extends AccountResult {
  hasOrders: boolean;
}

/**
 * GET /accounts/:personId - the account view, including how identity learns a person has orders:
 * the buyer status is read live from the order service through contract.checkout.order-for-identity
 * (modules/integrations/order). An unreachable order service answers 503 with a stable code - it
 * never degrades into `hasOrders: false`, which would make an outage look like an answer.
 */
@Controller('accounts')
export class AccountController {
  constructor(
    private readonly accounts: AccountService,
    private readonly orderApi: OrderApiClient,
  ) {}

  @Get(':personId')
  async getAccount(@Param('personId') personId: string): Promise<AccountWithBuyerStatusResult> {
    const account = await this.accounts.getAccount(personId);
    if (!account) {
      throw new HttpException({ code: 'PERSON_UNKNOWN', message: 'No person answers this id.' }, HttpStatus.NOT_FOUND);
    }
    const buyer: BuyerStatusResult = await this.orderApi.getBuyerStatus(personId);
    return { ...account, hasOrders: buyer.hasOrders };
  }
}
