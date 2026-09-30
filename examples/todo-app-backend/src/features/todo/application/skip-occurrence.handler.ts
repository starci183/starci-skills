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
import { SkipOccurrenceCommand } from "./skip-occurrence.command"
import type { SkipOccurrenceResult } from "./skip-occurrence.contracts"

@CommandHandler(SkipOccurrenceCommand)
/** Skips a materialised occurrence without completing its task; only the owner may, and skipping again changes nothing. */
export class SkipOccurrenceHandler extends ICQRSHandler<SkipOccurrenceCommand, SkipOccurrenceResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        private readonly occurrences: OccurrenceService,
    ) {
        super(logger)
    }

    protected override async process(command: SkipOccurrenceCommand): Promise<SkipOccurrenceResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        const skipped = await this.entityManager.transaction((manager) =>
            this.occurrences.skip({ manager, id: request.occurrenceId, actorId: principal.id, at }),
        )
        if (skipped.kind === "refused") return skipped
        return ok({ occurrenceId: skipped.value.id, status: skipped.value.status })
    }
}
