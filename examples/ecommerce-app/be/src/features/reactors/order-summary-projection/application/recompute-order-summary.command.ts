import { Command } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RecomputeOrderSummaryRequest, RecomputeOrderSummaryResult } from "./recompute-order-summary.contracts"

/** Recomputes the summary of one order; the order placed, order paid and order expired consumers send it for every delivered event. */
export class RecomputeOrderSummaryCommand extends Command<RecomputeOrderSummaryResult> {
    constructor(readonly params: PublicExecuteParams<RecomputeOrderSummaryRequest>) {
        super()
    }
}
