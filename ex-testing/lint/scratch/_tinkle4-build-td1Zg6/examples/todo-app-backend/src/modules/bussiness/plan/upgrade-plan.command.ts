/** Contract naming the upgrade plan command params shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
export interface UpgradePlanCommandParams {
  readonly ownerId: string;
}

/** Contract naming the upgrade plan command result shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
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
