import { CommandHandler } from "@nestjs/cqrs"
import { OccurrenceService } from "@modules/domain/recur"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CompleteOccurrenceCommand } from "./complete-occurrence.command"
import type { CompleteOccurrenceResult } from "./complete-occurrence.contracts"

@CommandHandler(CompleteOccurrenceCommand)
/** Completes a materialised occurrence and the task it spawned, in one transaction; only the owner may, and completing again changes nothing. */
export class CompleteOccurrenceHandler extends ICQRSHandler<CompleteOccurrenceCommand, CompleteOccurrenceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
    }

    protected override async process(command: CompleteOccurrenceCommand): Promise<CompleteOccurrenceResult> {
        const { request, principal } = command.params
        return this.occurrences.complete({ id: request.occurrenceId, actorId: principal.id })
    }
}
