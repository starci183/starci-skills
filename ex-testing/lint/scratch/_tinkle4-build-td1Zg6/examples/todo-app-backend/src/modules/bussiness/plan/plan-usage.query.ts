/** Contract naming the plan usage query params shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
export interface PlanUsageQueryParams {
  readonly ownerId: string;
}

/** Contract naming the plan usage query result shape bussiness/plan code and its consumers share; a second site never retypes it inline. */
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
