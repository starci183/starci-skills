import { QueryHandler } from "@nestjs/cqrs"
import { GeneratorService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { UpcomingOccurrencesQuery } from "./upcoming-occurrences.query"
import type { UpcomingOccurrencesResult } from "./upcoming-occurrences.contracts"

@QueryHandler(UpcomingOccurrencesQuery)
/**
 * The materialised occurrences of a rule of the caller come from the store; the preview of the dates the rule will fire
 * on next is computed live from the rule. An ended rule has no preview, only its history.
 */
export class UpcomingOccurrencesHandler extends ICQRSHandler<UpcomingOccurrencesQuery, UpcomingOccurrencesResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly generator: GeneratorService,
    ) {
        super(logger)
    }

    protected override async process(query: UpcomingOccurrencesQuery): Promise<UpcomingOccurrencesResult> {
        return this.generator.upcoming({
            ruleId: query.params.request.ruleId,
            actorId: query.params.principal.id,
            previewDays: query.params.request.previewDays,
        })
    }
}
