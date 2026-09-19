/** Type alias naming the confirm payment outcome set confirm-payment.command switches on; a new member is added here once, not scattered as literals. */
export type ConfirmPaymentOutcome = "paid" | "failed";

/** Contract naming the confirm payment command params shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
export interface ConfirmPaymentCommandParams {
  /** SePay's own id for the transaction; data.plan.payment-intent's gatewayIntentId. */
  readonly gatewayIntentId: string;
  readonly outcome: ConfirmPaymentOutcome;
  /** Only meaningful when outcome is 'paid'; defaults to 30 days from now if omitted. */
  readonly periodEnd?: Date;
}

/** Contract naming the confirm payment command result shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
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
