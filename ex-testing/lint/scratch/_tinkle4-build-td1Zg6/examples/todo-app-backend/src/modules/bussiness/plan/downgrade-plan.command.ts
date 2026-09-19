/** Contract naming the downgrade plan command params shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
export interface DowngradePlanCommandParams {
  readonly ownerId: string;
}

/** Contract naming the downgrade plan command result shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
export interface DowngradePlanCommandResult {
  readonly subscriptionId: string;
  readonly plan: string;
  readonly status: string;
}

/** fr.plan.downgrade (t-downgrade) as a CQRS write, dispatched by the GraphQL downgradePlan mutation
 * resolver. */
export class DowngradePlanCommand {
    constructor(readonly params: DowngradePlanCommandParams) {}
}
