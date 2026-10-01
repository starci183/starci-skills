import { Query } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { PlanUsageRequest, PlanUsageResult } from "./plan-usage.contracts"

/** Asks for the plan of the caller and how many active tasks the caller holds. */
export class PlanUsageQuery extends Query<PlanUsageResult> {
    constructor(readonly params: ExecuteParams<PlanUsageRequest>) {
        super()
    }
}
