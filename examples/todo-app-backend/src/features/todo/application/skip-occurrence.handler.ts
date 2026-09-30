import { CommandHandler } from "@nestjs/cqrs"
import { OccurrenceService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { SkipOccurrenceCommand } from "./skip-occurrence.command"
import type { SkipOccurrenceResult } from "./skip-occurrence.contracts"

@CommandHandler(SkipOccurrenceCommand)
/** Skips a materialised occurrence without completing its task; only the owner may, and skipping again changes nothing. */
export class SkipOccurrenceHandler extends ICQRSHandler<SkipOccurrenceCommand, SkipOccurrenceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
    }

    protected override async process(command: SkipOccurrenceCommand): Promise<SkipOccurrenceResult> {
        const { request, principal } = command.params
        return this.occurrences.skip({ id: request.occurrenceId, actorId: principal.id })
    }
}
