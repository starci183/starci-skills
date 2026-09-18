export interface PlanUsageQueryParams {
  readonly ownerId: string;
}

export interface PlanUsageQueryResult {
  readonly plan: string;
  /** null on the paid plan: "no cap" (fr.plan.usage.view's mainFlow). */
  readonly cap: number | null;
  readonly activeCount: number;
}

/** fr.plan.usage.view as a CQRS read, dispatched by the GraphQL planUsage query resolver. */
export class PlanUsageQuery {
  constructor(readonly params: PlanUsageQueryParams) {}
}
