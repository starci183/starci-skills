export interface DowngradePlanCommandParams {
  readonly ownerId: string;
}

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
