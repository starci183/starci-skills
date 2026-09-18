export type ConfirmPaymentOutcome = 'paid' | 'failed';

export interface ConfirmPaymentCommandParams {
  /** SePay's own id for the transaction; data.plan.payment-intent's gatewayIntentId. */
  readonly gatewayIntentId: string;
  readonly outcome: ConfirmPaymentOutcome;
  /** Only meaningful when outcome is 'paid'; defaults to 30 days from now if omitted. */
  readonly periodEnd?: Date;
}

export interface ConfirmPaymentCommandResult {
  readonly applied: boolean;
  readonly subscriptionStatus: string;
}

/** sds.plan.subscription-lifecycle's t-gateway-confirmed / t-renewal-confirmed / t-gateway-abandoned, as
 * a single CQRS write dispatched by the SePay webhook controller (never by GraphQL: the gateway, not the
 * owner, is the only caller of this path). */
export class ConfirmPaymentCommand {
  constructor(readonly params: ConfirmPaymentCommandParams) {}
}
