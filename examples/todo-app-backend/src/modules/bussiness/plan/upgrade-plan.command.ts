export interface UpgradePlanCommandParams {
  readonly ownerId: string;
}

export interface UpgradePlanCommandResult {
  readonly subscriptionId: string;
  readonly paymentIntentId: string;
  readonly checkoutUrl: string;
  readonly status: string;
}

/** fr.plan.upgrade's mainFlow step 1 (t-checkout-started) as a CQRS write, dispatched by the GraphQL
 * upgradePlan mutation resolver. */
export class UpgradePlanCommand {
  constructor(readonly params: UpgradePlanCommandParams) {}
}
