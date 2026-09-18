import { AppConfigService } from '../../platform/config';
import { SepayClient, SepayGetTransactionResult } from '../../integrations/sepay';
import { SubscriptionEntity, PaymentIntentEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { ConfirmPaymentHandler } from './confirm-payment.handler';
import { ReconcilePaymentCommand } from './reconcile-payment.command';
import { ReconcilePaymentHandler } from './reconcile-payment.handler';

class FakeSepayClient extends SepayClient {
  public nextResult: SepayGetTransactionResult = { status: 'pending' };

  constructor() {
    super(new AppConfigService());
  }

  async getTransaction(): Promise<SepayGetTransactionResult> {
    return this.nextResult;
  }
}

describe('ReconcilePaymentHandler (fr.plan.reconcile / sds.plan.reconciliation)', () => {
  let subscriptionService: SubscriptionService;
  let paymentService: PaymentService;
  let sepayClient: FakeSepayClient;
  let handler: ReconcilePaymentHandler;

  beforeEach(() => {
    subscriptionService = new SubscriptionService(createFakeEntityManager<SubscriptionEntity>('id') as never);
    paymentService = new PaymentService(createFakeEntityManager<PaymentIntentEntity>('id') as never);
    sepayClient = new FakeSepayClient();
    const confirmPaymentHandler = new ConfirmPaymentHandler(subscriptionService, paymentService);
    handler = new ReconcilePaymentHandler(subscriptionService, paymentService, sepayClient, confirmPaymentHandler);
  });

  async function startCheckout(ownerId: string) {
    const subscription = await subscriptionService.tCheckoutStarted(ownerId);
    const intent = await paymentService.create(subscription.id, `gw-${ownerId}`, 99000, 'VND');
    return { subscription, intent };
  }

  it('exceptionFlow "still pending": nothing changes and it is checked again later', async () => {
    const { intent } = await startCheckout('owner-1');
    sepayClient.nextResult = { status: 'pending' };

    const result = await handler.execute(new ReconcilePaymentCommand({ actorId: 'owner-1', paymentIntentId: intent.id }));

    expect(result.applied).toBe(false);
    expect(result.gatewayStatus).toBe('pending');
    expect((await subscriptionService.findById(intent.subscriptionId)).status).toBe('pending');
  });

  it('mainFlow "gateway shows paid": the same activation a webhook would have caused is applied, once', async () => {
    const { intent } = await startCheckout('owner-1');
    sepayClient.nextResult = { status: 'paid', periodEnd: new Date('2027-01-01T00:00:00.000Z') };

    const result = await handler.execute(new ReconcilePaymentCommand({ actorId: 'owner-1', paymentIntentId: intent.id }));

    expect(result.applied).toBe(true);
    expect(result.subscriptionStatus).toBe('active');
  });

  it('mainFlow "gateway shows failed": t-gateway-abandoned returns the subscription to free', async () => {
    const { intent } = await startCheckout('owner-1');
    sepayClient.nextResult = { status: 'failed' };

    const result = await handler.execute(new ReconcilePaymentCommand({ actorId: 'owner-1', paymentIntentId: intent.id }));

    expect(result.subscriptionStatus).toBe('free');
  });

  it('br.plan.payment.idempotent: a webhook that already applied the intent leaves reconcile a no-op without a gateway call', async () => {
    const { intent } = await startCheckout('owner-1');
    await paymentService.markPaidIfNotApplied(intent.id);
    await subscriptionService.tGatewayConfirmed(intent.subscriptionId, new Date());
    sepayClient.nextResult = { status: 'paid' };
    const getTransactionSpy = jest.spyOn(sepayClient, 'getTransaction');

    const result = await handler.execute(new ReconcilePaymentCommand({ actorId: 'owner-1', paymentIntentId: intent.id }));

    expect(result.applied).toBe(false);
    expect(getTransactionSpy).not.toHaveBeenCalled();
  });

  it('PLAN_FORBIDDEN: a person may not reconcile a payment intent on somebody else\'s subscription', async () => {
    const { intent } = await startCheckout('owner-1');

    await expect(
      handler.execute(new ReconcilePaymentCommand({ actorId: 'owner-2', paymentIntentId: intent.id })),
    ).rejects.toMatchObject({ code: 'PLAN_FORBIDDEN' });
  });
});
