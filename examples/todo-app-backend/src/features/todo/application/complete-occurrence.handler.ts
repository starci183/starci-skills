import { CommandHandler } from "@nestjs/cqrs"
import { OccurrenceService } from "@modules/domain/recur"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { CompleteOccurrenceCommand } from "./complete-occurrence.command"
import type { CompleteOccurrenceResult } from "./complete-occurrence.contracts"

@CommandHandler(CompleteOccurrenceCommand)
/** Completes a materialised occurrence and the task it spawned, in one transaction; only the owner may, and completing again changes nothing. */
export class CompleteOccurrenceHandler extends ICQRSHandler<CompleteOccurrenceCommand, CompleteOccurrenceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
    }

    protected override async process(command: CompleteOccurrenceCommand): Promise<CompleteOccurrenceResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const completed = await this.entityManager.transaction((manager) =>
            this.occurrences.complete({ manager, id: request.occurrenceId, actorId: principal.id, at }),
        )
        if (completed.kind === "refused") return completed
        return ok({ occurrenceId: completed.value.id, status: completed.value.status })
    }
}
