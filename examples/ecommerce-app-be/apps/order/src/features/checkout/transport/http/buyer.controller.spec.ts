import { OrderService, BuyerStatusResult } from '../../../../modules/bussiness/order';
import { BuyerController } from './buyer.controller';

/**
 * The provider half of contract.checkout.order-for-identity in unit form - the door's answer
 * shape and its always-200 rule. The live pair (identity's client reading this route on the
 * running services) is scripts/live-proof.mjs.
 */
describe('BuyerController - contract.checkout.order-for-identity provider', () => {
  function controllerWith(answer: BuyerStatusResult): BuyerController {
    const orders = {
      async buyerStatus(): Promise<BuyerStatusResult> {
        return answer;
      },
    } as unknown as OrderService;
    return new BuyerController(orders);
  }

  it('contract.checkout.order-for-identity provider: a person with orders answers hasOrders true', async () => {
    const controller = controllerWith({ personId: 'person-1', hasOrders: true });
    expect(await controller.status('person-1')).toEqual({ personId: 'person-1', hasOrders: true });
  });

  it('contract.checkout.order-for-identity provider: a person without orders answers hasOrders false, not a 404', async () => {
    const controller = controllerWith({ personId: 'person-2', hasOrders: false });
    expect(await controller.status('person-2')).toEqual({ personId: 'person-2', hasOrders: false });
  });
});
