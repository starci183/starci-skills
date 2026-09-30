import { Query } from "@nestjs/cqrs"
import type { PublicExecuteParams } from "@modules/platform/cqrs"
import type { RenderMetricsRequest, RenderMetricsResult } from "./render-metrics.contracts"

/** Asks for the request metrics of this process. */
export class RenderMetricsQuery extends Query<RenderMetricsResult> {
    constructor(readonly params: PublicExecuteParams<RenderMetricsRequest>) {
        super()
    }
}
