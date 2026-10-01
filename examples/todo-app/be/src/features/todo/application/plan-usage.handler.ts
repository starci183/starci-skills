import { QueryHandler } from "@nestjs/cqrs"
import { PlanUsageService } from "@modules/domain/taskflow"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import type { PlanUsageResult } from "./plan-usage.contracts"
import { PlanUsageQuery } from "./plan-usage.query"

@QueryHandler(PlanUsageQuery)
/** The effective plan of the caller and the active tasks the caller holds, as the cap guard of create-task counts them. */
export class PlanUsageHandler extends ICQRSHandler<PlanUsageQuery, PlanUsageResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly usage: PlanUsageService,
    ) {
        super(logger)
    }

    protected override process(query: PlanUsageQuery): Promise<PlanUsageResult> {
        return this.usage.read({ personId: query.params.principal.id })
    }
}
