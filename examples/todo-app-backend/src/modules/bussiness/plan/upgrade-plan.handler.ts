import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { AppConfigService } from '../../platform/config';
import { SepayClient } from '../../integrations/sepay';
import { SubscriptionService } from './subscription.service';
import { PaymentService } from './payment.service';
import { UpgradePlanCommand, UpgradePlanCommandResult } from './upgrade-plan.command';

/**
 * fr.plan.upgrade's mainFlow, first two steps: the subscription becomes pending (t-checkout-started) and
 * a payment intent is created against SePay (integration.plan.sepay's create-intent endpoint). The third
 * step - the gateway's webhook confirming the intent (t-gateway-confirmed) - is a separate path
 * (ConfirmPaymentHandler, triggered by the SePay webhook controller), not this handler: this handler only
 * starts checkout and returns where the owner completes payment.
 *
 * Ordering matters here: the gateway call happens first, against the subscription's id (read via
 * getOrCreate, which never transitions it), and t-checkout-started is only applied once SePay has
 * actually returned an intent. A live run surfaced the alternative ordering's defect directly: with
 * t-checkout-started applied before the gateway call, a gateway failure (the real case whenever
 * integration.plan.sepay is unreachable, per gap.plan.sepay-not-reachable) left the subscription
 * "pending" with no payment intent row behind it - an inconsistent write. This order never writes a
 * pending status without a payment intent to match it.
 */
@Injectable()
@CommandHandler(UpgradePlanCommand)
export class UpgradePlanHandler implements ICommandHandler<UpgradePlanCommand, UpgradePlanCommandResult> {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly paymentService: PaymentService,
    private readonly sepayClient: SepayClient,
    private readonly config: AppConfigService,
  ) {}

  async execute(command: UpgradePlanCommand): Promise<UpgradePlanCommandResult> {
    const { ownerId } = command.params;
    const existing = await this.subscriptionService.getOrCreate(ownerId);
    const amount = this.config.getPaidPlanPriceMinorUnits();
    const currency = this.config.getPaidPlanCurrency();
    const intent = await this.sepayClient.createIntent({ subscriptionId: existing.id, amount, currency });
    const subscription = await this.subscriptionService.tCheckoutStarted(ownerId);
    const paymentIntent = await this.paymentService.create(subscription.id, intent.gatewayIntentId, amount, currency);
    return {
      subscriptionId: subscription.id,
      paymentIntentId: paymentIntent.id,
      checkoutUrl: intent.checkoutUrl,
      status: subscription.status,
    };
  }
}
