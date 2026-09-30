import { randomUUID } from "node:crypto"
import { CommandHandler } from "@nestjs/cqrs"
import { AuditAction, AuditErasureService, SYSTEM_ACTOR_ID, toAuditAppendMessage } from "@modules/domain/audit"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { ICQRSHandler } from "@modules/platform/cqrs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectOutbox } from "@modules/platform/outbox"
import type { Outbox } from "@modules/platform/outbox"
import { ok } from "@modules/platform/primitives"
import type { EntityManager } from "typeorm"
import { CompleteErasureCommand } from "./complete-erasure.command"
import type { CompleteErasureResult } from "./complete-erasure.contracts"

@CommandHandler(CompleteErasureCommand)
/**
 * Completes a verified erasure request of the caller: the subject key is destroyed, nothing about the subject stays
 * readable, and the person id is dropped from the request. The erasure-completed line names the request and the system
 * actor, never the erased person, and joins the same transaction.
 */
export class CompleteErasureHandler extends ICQRSHandler<CompleteErasureCommand, CompleteErasureResult> {
    constructor(
        @InjectLogger() logger: Logger,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectOutbox() private readonly outbox: Outbox,
        private readonly erasure: AuditErasureService,
    ) {
        super(logger)
    }

    protected override async process(command: CompleteErasureCommand): Promise<CompleteErasureResult> {
        const { request, principal } = command.params
        const at = this.clock.now()
        return this.entityManager.transaction(async (manager): Promise<CompleteErasureResult> => {
            const outcome = await this.erasure.execute({
                manager,
                requestId: request.requestId,
                callerId: principal.id,
                at,
            })
            if (outcome.kind === "refused") return outcome
            await this.outbox.enqueue(
                manager,
                toAuditAppendMessage({
                    eventId: randomUUID(),
                    actorId: SYSTEM_ACTOR_ID,
                    action: AuditAction.ErasureCompleted,
                    target: outcome.value.requestId,
                    at,
                }),
            )
            return ok({ requestId: outcome.value.requestId, state: outcome.value.state })
        })
    }
}
