import { SubscriptionEntity, PaymentIntentEntity } from '../../platform/databases/postgresql/primary';
import { createFakeEntityManager } from '../../platform/databases/postgresql/primary/testing/fake-entity-manager';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { ConfirmPaymentCommand } from './confirm-payment.command';
import { ConfirmPaymentHandler } from './confirm-payment.handler';

describe('ConfirmPaymentHandler', () => {
  let subscriptionService: SubscriptionService;
  let paymentService: PaymentService;
  let handler: ConfirmPaymentHandler;

  beforeEach(() => {
    subscriptionService = new SubscriptionService(createFakeEntityManager<SubscriptionEntity>('id') as never);
    paymentService = new PaymentService(createFakeEntityManager<PaymentIntentEntity>('id') as never);
    handler = new ConfirmPaymentHandler(subscriptionService, paymentService);
  });

  async function startCheckout(ownerId: string) {
    const subscription = await subscriptionService.tCheckoutStarted(ownerId);
    const intent = await paymentService.create(subscription.id, `gw-${ownerId}`, 99000, 'VND');
    return { subscription, intent };
  }

  it('sds.plan.subscription-lifecycle t-gateway-confirmed: a paid webhook activates a pending subscription', async () => {
    const { intent } = await startCheckout('owner-1');

    const result = await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'paid' }));

    expect(result.applied).toBe(true);
    expect(result.subscriptionStatus).toBe('active');
  });

  it('ac.plan.payment.idempotent.replay-is-noop: the same webhook applied twice activates only once', async () => {
    const { intent } = await startCheckout('owner-1');

    await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'paid' }));
    const replay = await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'paid' }));

    expect(replay.applied).toBe(false);
    expect(replay.subscriptionStatus).toBe('active');
  });

  it('br.plan.payment.idempotent: a late webhook after fr.plan.reconcile already applied the same intent is a no-op', async () => {
    const { intent } = await startCheckout('owner-1');

    // Simulate reconciliation applying it first.
    await paymentService.markPaidIfNotApplied(intent.id);
    await subscriptionService.tGatewayConfirmed(intent.subscriptionId, new Date());

    const lateWebhook = await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'paid' }));
    expect(lateWebhook.applied).toBe(false);
  });

  it('sds.plan.subscription-lifecycle t-gateway-abandoned: a failed outcome on a still-pending intent returns the subscription to free', async () => {
    const { intent } = await startCheckout('owner-1');

    const result = await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'failed' }));

    expect(result.applied).toBe(false);
    expect(result.subscriptionStatus).toBe('free');
  });

  it('a failed outcome arriving after the intent was already applied paid never unwinds the activation', async () => {
    const { intent } = await startCheckout('owner-1');
    await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'paid' }));

    const result = await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'failed' }));

    expect(result.subscriptionStatus).toBe('active');
  });

  it('sds.plan.subscription-lifecycle t-renewal-confirmed: a paid webhook on a past-due subscription returns it to active', async () => {
    const { intent, subscription } = await startCheckout('owner-1');
    await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: intent.gatewayIntentId, outcome: 'paid' }));
    await subscriptionService.tRenewalDue(subscription.id);

    const renewalIntent = await paymentService.create(subscription.id, `gw-renewal-${subscription.id}`, 99000, 'VND');
    const result = await handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: renewalIntent.gatewayIntentId, outcome: 'paid' }));

    expect(result.subscriptionStatus).toBe('active');
  });

  it('PLAN_PAYMENT_INTENT_NOT_FOUND: an unknown gatewayIntentId is refused rather than silently ignored', async () => {
    await expect(
      handler.execute(new ConfirmPaymentCommand({ gatewayIntentId: 'never-created', outcome: 'paid' })),
    ).rejects.toMatchObject({ code: 'PLAN_PAYMENT_INTENT_NOT_FOUND' });
  });
});
